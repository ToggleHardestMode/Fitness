import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, parseWorkouts, addWorkouts, recordSets, validateBackup } from '../preview-v101/core.js';
import { V101_CSV, V101_VERSION } from '../preview-v101/v101-data.js';
import { weeklyTrainingAnalysis, recoveryReview } from '../preview-v101/training-analytics.js';
import { addSymptomEntry } from '../preview-v101/symptom-journal.js';

const ids = prefix => { let n = 0; return () => `${prefix}-${++n}`; };
const program = () => parseWorkouts(V101_CSV).map(w => ({...w, sourceVersion: V101_VERSION}));
const setup = () => {
  const result = addWorkouts(emptyState(), program(), false, ids('template'));
  return result.state;
};
const scheduled = () => {
  const state = setup();
  state.assignments = Object.fromEntries(state.templates.map(t => [t.day, t.id]));
  return state;
};
const entry = (state, date, templateId, exerciseIndex = 0, set = 1, kg = 10, reps = 10) => {
  const t = state.templates.find(t => t.id === templateId);
  return {
    id: `log-${date}-${templateId}-${exerciseIndex}-${set}`,
    date, templateId, exerciseIndex, exerciseName: t.exercises[exerciseIndex].name,
    muscle: t.exercises[exerciseIndex].muscle, set, kg, reps, rpe: null, rest: 90, notes: '', tempo: ''
  };
};
const symptom = (date, timepoint, overrides = {}) => ({
  date, timepoint, templateId: null, exerciseIndex: null,
  side: 'left', location: 'buttock', severity: 1,
  tingling: false, numbness: false, functionChange: 'none', notes: '', ...overrides
});

test('preview V10.1 keeps four home sessions, 24 entries, 62 sets and source notes', () => {
  const workouts = program();
  assert.deepEqual(workouts.map(w => [w.day, w.exercises.length, w.exercises.reduce((n,e)=>n+e.sets,0)]),
    [[0,6,17],[1,5,13],[3,8,21],[4,5,11]]);
  assert.ok(workouts.every(w => w.exercises.every(e => typeof e.sourceNote === 'string' && e.sourceNote)));
  assert.ok(workouts[1].requiresClinicalReview);
  assert.ok(workouts[3].requiresClinicalReview);
  assert.equal(workouts[3].exercises.find(e => e.name.includes('Side Plank')).repUnit, 'seconds_per_side');
});
test('preview import is opt-in, idempotent and does not clear existing records', () => {
  const original = emptyState();
  original.metrics.push({date:'2026-10-19',weight:90,calories:null,protein:null,sleep:null,recovery:null});
  const initial = structuredClone(original);
  const first = addWorkouts(original, program(), false, ids('first'));
  assert.equal(first.added, 4);
  assert.deepEqual(first.state.assignments, {});
  assert.deepEqual(original, initial);
  const second = addWorkouts(first.state, program(), false, ids('second'));
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 4);
  assert.deepEqual(second.state.metrics, initial.metrics);
  assert.equal(second.state.templates.length, 4);
});
test('PT-review sessions never receive automatic weekday assignment', () => {
  const r = addWorkouts(emptyState(), program(), true, ids('review'));
  assert.equal(Object.keys(r.state.assignments).length, 2);
  assert.ok(r.state.assignments[0]);
  assert.ok(r.state.assignments[3]);
  assert.equal(r.state.assignments[1], undefined);
  assert.equal(r.state.assignments[4], undefined);
});
test('preview saved set editing preserves IDs, history and validates backups', () => {
  const state = scheduled(), t = state.templates[0];
  const entries = Array.from({length:t.exercises[0].sets},(_,i)=>({completed:i===0,kg:12,reps:10,rest:90}));
  const once = recordSets(state,{date:'2026-10-19',templateId:t.id,exerciseIndex:0,entries},ids('set'));
  assert.equal(once.saved,1);
  assert.equal(state.logs.length,0);
  const revised = recordSets(once.state,{date:'2026-10-19',templateId:t.id,exerciseIndex:0,entries:entries.map(e=>({...e,kg:14}))},ids('again'));
  assert.equal(revised.state.logs.length,1);
  assert.equal(revised.state.logs[0].id,once.state.logs[0].id);
  assert.equal(revised.state.logs[0].kg,14);
  assert.deepEqual(validateBackup(revised.state),revised.state);
  const corrupt=structuredClone(revised.state);
  corrupt.logs.push({...corrupt.logs[0],id:'another-id'});
  assert.throws(()=>validateBackup(corrupt),/duplicate sets/);
  assert.equal(revised.state.logs.length,1);
});
test('preview accounting deduplicates, distinguishes off-plan, and splits biceps from triceps', () => {
  const state=scheduled(), [upper,lower,upperB]=state.templates;
  state.logs.push(
    entry(state,'2026-10-19',upper.id,0,1),
    entry(state,'2026-10-19',upper.id,0,1),
    entry(state,'2026-10-19',upper.id,4,1),
    entry(state,'2026-10-20',upper.id,0,1),
    entry(state,'2026-10-22',upperB.id,7,1)
  );
  const report=weeklyTrainingAnalysis(state,'2026-10-19');
  assert.equal(report.planned,62);
  assert.equal(report.completed,4);
  assert.equal(report.assignedCompleted,3);
  assert.equal(report.offPlan,1);
  assert.equal(report.days.filter(day=>day.completed>0).length,3);
  assert.equal(report.byMuscle.Biceps.completed,1);
  assert.equal(report.byMuscle.Triceps.completed,1);
  assert.equal(report.byMuscle.Chest.completed,2);
});
test('preview time-based holds count as sets but not lifting volume', () => {
  const state=scheduled();
  const lower=state.templates[3];
  const exerciseIndex=lower.exercises.findIndex(e=>e.repUnit==='seconds_per_side');
  state.logs.push(entry(state,'2026-10-23',lower.id,exerciseIndex,1,0,20));
  const report=weeklyTrainingAnalysis(state,'2026-10-19');
  assert.equal(report.completed,1);
  assert.equal(report.loadVolume,0);
  assert.equal(report.timedHolds.length,1);
  assert.equal(report.timedHolds[0].secondsPerSide,20);
});
test('preview missing symptom follow-up never grants clearance', () => {
  const state=scheduled();
  assert.equal(recoveryReview(state,'2026-10-20','2026-10-22').level,'unknown');
  const first=addSymptomEntry(state,symptom('2026-10-20','before'),ids('sym'));
  const post=addSymptomEntry(first,symptom('2026-10-20','after'),ids('sym2'));
  assert.equal(recoveryReview(post,'2026-10-20','2026-10-22').level,'followup_missing');
  assert.deepEqual(validateBackup(post),post);
});
test('preview worsening symptoms and functional changes escalate review', () => {
  let state=scheduled();
  state=addSymptomEntry(state,symptom('2026-10-20','before'),ids('a'));
  state=addSymptomEntry(state,symptom('2026-10-20','next_day',{severity:3,location:'calf'}),ids('b'));
  assert.equal(recoveryReview(state,'2026-10-20','2026-10-22').level,'hold');
  const urgent=addSymptomEntry(state,symptom('2026-10-20','after',{functionChange:'new_weakness'}),ids('c'));
  assert.equal(recoveryReview(urgent,'2026-10-20','2026-10-22').level,'medical_review');
});
