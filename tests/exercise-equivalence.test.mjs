import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackup} from '../preview-v101/core.js';
import {getExerciseJourney, recommendNextExercise} from '../preview-v101/strength-journey.js';
import {manualProgression} from '../preview-v101/manual-progression.js';
import {manualProgressionPanel} from '../preview-v101/manual-progression-ui.js';
import {strengthNextSession} from '../preview-v101/strength-journey-ui.js';
import {renderStrengthJourney} from '../preview-v101/strength-journey-visual.js';
import {addExerciseEquivalence, removeExerciseEquivalence, linkedSources, linkCandidates,
  validateExerciseEquivalences} from '../preview-v101/exercise-equivalence.js';
import {equivalencePanel} from '../preview-v101/exercise-equivalence-ui.js';
import {resetTrackingData} from '../preview-v101/tracking-reset.js';

const tpl = (id, name, exercises) => ({id, name, day:0, exercises});
const press = {name:'Synthetic Press', muscle:'Chest', sets:2, min:8, max:12, rest:90};
const hold = {name:'Synthetic Hold (seconds/side)', muscle:'Core', sets:2, min:20, max:40, rest:60, repUnit:'seconds_per_side'};
const row = (templateId, date, set, kg, reps, rpe = 7, exerciseIndex = 0) =>
  ({id:`${templateId}-${date}-${set}-${exerciseIndex}`, date, templateId, exerciseIndex, set, kg, reps, rpe, rest:90, notes:'', tempo:''});
const observations = (date, templateId) => ['before', 'after', 'next_day'].map(timepoint => ({
  id:`${date}-${timepoint}-${templateId}`, date, timepoint, templateId, exerciseIndex:0, severity:0,
  tingling:false, numbness:false, functionChange:'none', location:'none', side:'none', notes:''}));
const link = (id, from, to, extra = {}) => ({id, from:{templateId:from, exerciseIndex:0},
  to:{templateId:to, exerciseIndex:0}, approvedDate:'2026-11-01', ...extra});
const build = () => ({
  version:1,
  templates:[tpl('v1', 'Synthetic V1', [press]), tpl('v2', 'Synthetic V2', [press]), tpl('v3', 'Synthetic V3', [{...press, name:'Synthetic Press B'}]),
    tpl('t1', 'Synthetic Timed', [hold])],
  assignments:{},
  logs:[row('v1', '2026-09-01', 1, 10, 10), row('v1', '2026-09-01', 2, 10, 10),
    row('v2', '2026-10-01', 1, 12, 10), row('v2', '2026-10-01', 2, 12, 10)],
  metrics:[], symptomLogs:[], reminder:{hour:18, minute:30, lead:0}, progressionStepKg:2,
  exerciseEquivalences:[link('l1', 'v1', 'v2'), link('l2', 'v2', 'v3', {note:'same movement, new name'})]
});
const choice = {templateId:'v3', exerciseIndex:0, date:'2026-11-03'};

test('chain resolution follows links backwards across versions', () => {
  const state = build();
  assert.deepEqual(linkedSources(state, 'v3', 0), [{templateId:'v2', exerciseIndex:0}, {templateId:'v1', exerciseIndex:0}]);
  assert.deepEqual(linkedSources(state, 'v1', 0), []);
  const journey = getExerciseJourney(state, 'v3', 0);
  assert.deepEqual(journey.sessions, []);
  assert.deepEqual(journey.linkedSessions.map(s => [s.date, s.kg, s.source.exerciseName, s.linked]),
    [['2026-09-01', 10, 'Synthetic Press', true], ['2026-10-01', 12, 'Synthetic Press', true]]);
  assert.deepEqual(journey.linkedSessions[0].source, {templateId:'v1', exerciseIndex:0, exerciseName:'Synthetic Press'});
  assert.equal(journey.allSessions.length, 2);
});

test('cycles, duplicate sources, self links and duplicate ids are rejected', () => {
  const cyc = build(); cyc.exerciseEquivalences.push(link('l3', 'v3', 'v1'));
  assert.throws(() => validateBackup(cyc), /cycle/);
  const dup = build(); dup.exerciseEquivalences.push(link('l3', 'v1', 'v3'));
  assert.throws(() => validateBackup(dup), /only one replacement/);
  const self = build(); self.exerciseEquivalences = [link('l1', 'v1', 'v1')];
  assert.throws(() => validateBackup(self), /itself/);
  const ids = build(); ids.exerciseEquivalences[1].id = 'l1';
  assert.throws(() => validateBackup(ids), /duplicate exercise link IDs/);
});

test('timed-unit mismatch, missing references, bad note and bad date are rejected', () => {
  const timed = build(); timed.exerciseEquivalences = [link('l1', 't1', 'v1')];
  assert.throws(() => validateBackup(timed), /timed hold/);
  const missing = build(); missing.exerciseEquivalences[0].from.templateId = 'nope';
  assert.throws(() => validateBackup(missing), /missing workout/);
  const index = build(); index.exerciseEquivalences[0].to.exerciseIndex = 5;
  assert.throws(() => validateBackup(index), /missing exercise/);
  const note = build(); note.exerciseEquivalences[0].note = 'x'.repeat(201);
  assert.throws(() => validateBackup(note), /at most 200/);
  const ok = build(); ok.exerciseEquivalences[0].note = 'x'.repeat(200);
  assert.doesNotThrow(() => validateBackup(ok));
  const date = build(); date.exerciseEquivalences[0].approvedDate = '2026-02-30';
  assert.throws(() => validateBackup(date), /calendar date/);
  const shape = build(); shape.exerciseEquivalences = {};
  assert.throws(() => validateBackup(shape), /invalid exercise equivalence list/);
});

test('linking and unlinking change only the link record and need explicit confirmation', () => {
  const state = build(); delete state.exerciseEquivalences;
  const before = structuredClone(state);
  assert.throws(() => addExerciseEquivalence(state, {from:{templateId:'v1', exerciseIndex:0},
    to:{templateId:'v2', exerciseIndex:0}, approvedDate:'2026-11-01'}), /explicit confirmation/);
  const linked = addExerciseEquivalence(state, {from:{templateId:'v1', exerciseIndex:0},
    to:{templateId:'v2', exerciseIndex:0}, approvedDate:'2026-11-01', note:' kept '}, () => 'new-link', {confirmed:true});
  assert.deepEqual(state, before);
  assert.deepEqual(linked.logs, before.logs);
  assert.deepEqual(linked.metrics, before.metrics);
  assert.deepEqual(linked.symptomLogs, before.symptomLogs);
  assert.equal(linked.exerciseEquivalences[0].id, 'new-link');
  assert.equal(linked.exerciseEquivalences[0].note, 'kept');
  assert.throws(() => removeExerciseEquivalence(linked, 'new-link'), /explicit confirmation/);
  const removed = removeExerciseEquivalence(linked, 'new-link', {confirmed:true});
  assert.deepEqual(removed.logs, before.logs);
  assert.deepEqual(removed.exerciseEquivalences, []);
  assert.throws(() => removeExerciseEquivalence(linked, 'gone', {confirmed:true}), /no longer exists/);
  assert.throws(() => addExerciseEquivalence(linked, {from:{templateId:'v1', exerciseIndex:0},
    to:{templateId:'v3', exerciseIndex:0}, approvedDate:'2026-11-01'}, () => 'x', {confirmed:true}), /only one replacement/);
});

test('no-history result carries a linked reference and says it is not a target', () => {
  const state = build();
  const plan = recommendNextExercise(state, choice);
  assert.equal(plan.status, 'no-history');
  assert.deepEqual(plan.targets, []);
  assert.deepEqual(plan.reference, {date:'2026-10-01', kg:12, reps:10, exerciseName:'Synthetic Press'});
  assert.match(plan.reason, /reference for choosing a starting weight, not a target/);
  const early = recommendNextExercise(state, {...choice, date:'2026-09-15'});
  assert.equal(early.reference.date, '2026-09-01');
  const none = recommendNextExercise(state, {...choice, date:'2026-08-01'});
  assert.equal(Object.hasOwn(none, 'reference'), false);
  assert.match(strengthNextSession(state, choice), /Linked earlier history \(reference only\)/);
  const unlinked = build(); delete unlinked.exerciseEquivalences;
  assert.deepEqual(recommendNextExercise(unlinked, choice),
    {version:'strength-v1', status:'no-history', targets:[], reason:'No previous recorded workout before this date. Select a trial weight manually.', priorDate:null, sampleSessions:0});
});

test('manual progression gets a linked reference only when the exercise has no own history', () => {
  const state = build();
  const result = manualProgression(state, {date:'2026-11-03', templateId:'v3', exerciseIndex:0, set:1});
  assert.equal(result.status, 'no-history');
  assert.equal(result.candidate, null);
  assert.equal(result.history, null);
  assert.deepEqual(result.reference, {date:'2026-10-01', kg:12, reps:10, exerciseName:'Synthetic Press'});
  assert.match(manualProgressionPanel(state, {date:'2026-11-03', templateId:'v3', exerciseIndex:0, set:1}), /Linked earlier history/);
  const plain = build(); delete plain.exerciseEquivalences;
  const unlinked = manualProgression(plain, {date:'2026-11-03', templateId:'v3', exerciseIndex:0, set:1});
  assert.equal(Object.hasOwn(unlinked, 'reference'), false);
});

test('suggestions are identical with or without links once the current exercise has its own sessions', () => {
  const base = build();
  base.logs.push(row('v3', '2026-10-20', 1, 14, 12), row('v3', '2026-10-20', 2, 14, 12),
    row('v3', '2026-10-27', 1, 14, 12), row('v3', '2026-10-27', 2, 14, 12));
  base.symptomLogs = [...observations('2026-10-20', 'v3'), ...observations('2026-10-27', 'v3')];
  base.metrics = [{date:'2026-11-03', recovery:5}];
  const unlinked = structuredClone(base); delete unlinked.exerciseEquivalences;
  const withLinks = recommendNextExercise(base, choice);
  assert.equal(withLinks.status, 'load');
  assert.deepEqual(withLinks, recommendNextExercise(unlinked, choice));
  for (const set of [1, 2]) {
    const input = {date:'2026-11-03', templateId:'v3', exerciseIndex:0, set};
    assert.deepEqual(manualProgression(base, input), manualProgression(unlinked, input));
  }
  assert.deepEqual(getExerciseJourney(base, 'v3', 0).sessions, getExerciseJourney(unlinked, 'v3', 0).sessions);
  assert.deepEqual(getExerciseJourney(base, 'v3', 0).calibrated, getExerciseJourney(unlinked, 'v3', 0).calibrated);
});

test('chart merges linked sessions and shows a marker where the exercise changed', () => {
  const state = build();
  state.logs.push(row('v3', '2026-10-20', 1, 14, 12), row('v3', '2026-10-20', 2, 14, 12));
  const html = renderStrengthJourney(state, 1, {today:'2026-11-03'});
  assert.match(html, /sj-svg-change/);
  assert.match(html, /Exercise changed/);
  assert.match(html, /sj-svg-dot-linked/);
  assert.match(html, /Synthetic Press/);
  const plain = build(); delete plain.exerciseEquivalences;
  assert.doesNotMatch(renderStrengthJourney(plain, 1, {today:'2026-11-03'}), /sj-svg-change|sj-svg-dot-linked/);
});

test('link candidates list identical names first and exclude invalid targets', () => {
  const state = build(); delete state.exerciseEquivalences;
  const names = linkCandidates(state, 'v2', 0).map(c => [c.templateId, c.sameName]);
  assert.deepEqual(names, [['v1', true], ['v3', false]]);
  assert.ok(!linkCandidates(state, 'v2', 0).some(c => c.templateId === 't1'));
  const linked = build();
  assert.ok(!linkCandidates(linked, 'v1', 0).some(c => c.templateId === 'v3'));
  const html = equivalencePanel(state, {templateId:'v2', exerciseIndex:0});
  assert.match(html, /Link earlier history/);
  assert.match(html, /Synthetic Press · Synthetic V1 \(same name\)/);
  assert.match(equivalencePanel(build(), {templateId:'v3', exerciseIndex:0}), /Unlink/);
});

test('backup round-trips with links; an old backup without the field validates unchanged', () => {
  const state = build();
  const restored = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  const old = build(); delete old.exerciseEquivalences;
  const checked = validateBackup(old);
  assert.equal(Object.hasOwn(checked, 'exerciseEquivalences'), false);
  assert.deepEqual(checked, old);
  assert.doesNotThrow(() => validateExerciseEquivalences(old));
});

test('reset keeps equivalence links because they are configuration, not tracking records', () => {
  const state = build();
  const {nextState} = resetTrackingData(state, {apply:true});
  assert.deepEqual(nextState.exerciseEquivalences, state.exerciseEquivalences);
  assert.deepEqual(nextState.logs, []);
});
