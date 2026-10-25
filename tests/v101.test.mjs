import test from 'node:test';
import assert from 'node:assert/strict';
import { V101_CSV, V101_VERSION, V101_EQUIPMENT } from '../v101-data.js';
import { parseWorkouts, addWorkouts, emptyState, validateBackup, STARTER_CSV, recordSets } from '../core.js';

const ids = prefix => { let i = 0; return () => `${prefix}-${++i}`; };
const v101 = () => parseWorkouts(V101_CSV).map(w => ({
  ...w, sourceVersion: V101_VERSION, equipmentNote: V101_EQUIPMENT,
  requiresClinicalReview: !!w.requiresClinicalReview
}));

test('A01 A02: canonical 24 exercises, 62 prescribed working sets, direct muscle totals', () => {
  const plan=v101();
  assert.deepEqual(plan.map(w=>w.day),[0,1,3,4]);
  assert.deepEqual(plan.map(w=>w.exercises.length),[6,5,8,5]);
  assert.deepEqual(plan.map(w=>w.exercises.reduce((total,e)=>total+e.sets,0)),[17,13,21,11]);
  const totals={};
  for(const w of plan) for(const e of w.exercises) totals[e.muscle]=(totals[e.muscle]||0)+e.sets;
  assert.deepEqual(totals, {Chest:10,Back:10,Shoulders:10,Arms:8,Quads:4,Glutes:5,Hamstrings:5,Calves:6,Core:4});
});

test('A05 A06 A12: all notes preserved; lower templates retain PT flag; isometric units explicit',()=>{
  const plan=v101();
  assert.deepEqual(plan.map(w=>!!w.requiresClinicalReview),[false,true,false,true]);
  assert.ok(plan.every(w=>w.exercises.every(e=>e.sourceNote && e.sourceNote.length>12)));
  const plank=plan[3].exercises.find(e=>e.name.startsWith('Modified Side Plank'));
  assert.equal(plank.repUnit,'seconds_per_side');
  assert.deepEqual([plank.min,plank.max],[15,30]);
  assert.match(plank.sourceNote,/SECONDS per side/);
});

test('A03 A04 A05: import twice without duplicate templates or any assignment to review workouts',()=>{
  const first=addWorkouts(emptyState(),v101(),true,ids('one'));
  assert.equal(first.added,4);
  assert.deepEqual(Object.keys(first.state.assignments),['0','3']);
  const second=addWorkouts(first.state,v101(),true,ids('two'));
  assert.deepEqual([second.added,second.skipped],[0,4]);
  assert.deepEqual(second.state,first.state);
});

test('A04 A09: no changes to older templates, actual sets, check-ins, or assignments',()=>{
  const old=addWorkouts(emptyState(),parseWorkouts(STARTER_CSV),true,ids('old')).state;
  const first=old.templates[0];
  const recorded=recordSets(old, {date:'2026-10-19',templateId:first.id,exerciseIndex:0,
    entries:[{completed:true,kg:20,reps:10,rpe:7,rest:120,notes:'keep',tempo:''},{completed:false},{completed:false}]},ids('log')).state;
  recorded.metrics=[{date:'2026-10-19',weight:90,calories:2050,protein:160,sleep:7,recovery:3}];
  const before=structuredClone(recorded);
  const after=addWorkouts(recorded,v101(),true,ids('new')).state;
  assert.deepEqual(after.assignments,before.assignments);
  assert.deepEqual(after.logs,before.logs);
  assert.deepEqual(after.metrics,before.metrics);
  assert.deepEqual(after.templates.slice(0,before.templates.length),before.templates);
  assert.deepEqual(recorded,before);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(after))),after);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(before))),before);
});

test('A06 A09: legacy imports and backups without optional metadata remain supported',()=>{
  const old=addWorkouts(emptyState(),parseWorkouts(STARTER_CSV),false,ids('legacy')).state;
  assert.equal(old.templates[0].exercises[0].sourceNote,undefined);
  assert.equal(old.templates[0].sourceVersion,undefined);
  assert.deepEqual(validateBackup(old),old);
});

test('A09: invalid optional metadata cannot be restored',()=>{
  const first=addWorkouts(emptyState(),v101(),false,ids('new')).state;
  const bad=structuredClone(first);
  bad.templates[0].exercises[0].sourceNote='x'.repeat(501);
  assert.throws(()=>validateBackup(bad),/invalid exercise notes/);
  bad.templates[0].exercises[0].sourceNote='ok';
  bad.templates[1].requiresClinicalReview='yes';
  assert.throws(()=>validateBackup(bad),/PT review flag/);
});