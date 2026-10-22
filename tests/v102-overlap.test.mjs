import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWorkouts, addWorkouts, emptyState, validateBackup } from '../core.js';

const source = () => readFileSync(new URL('../templates/V10.2_Home_FitnessPilot_Import.csv', import.meta.url), 'utf8');
test('V10.2 Home keeps 24 entries, four days and 62 prescribed sets', () => {
  const p=parseWorkouts(source());
  assert.deepEqual(p.map(w=>w.day), [0,1,3,4]);
  assert.deepEqual(p.map(w=>w.exercises.length), [6,5,8,5]);
  assert.deepEqual(p.map(w=>w.exercises.reduce((n,e)=>n+e.sets,0)), [17,13,21,11]);
  assert.equal(p.reduce((n,w)=>n+w.exercises.reduce((m,e)=>m+e.sets,0),0),62);
  assert.equal(p.filter(w=>w.name.includes('[PT Review]')).length,2);
  assert.equal(p.some(w=>w.name.startsWith('V10.1')),false);
});
test('V10.2 import is additive and preserves previous records and assignments', () => {
  const before=emptyState();
  before.assignments={0:'historic'};
  before.logs=[{id:'existing-log',templateId:'historic'}];
  before.metrics=[{date:'2026-10-21',weight:90}];
  let nextId=0;
  const add=addWorkouts(before,parseWorkouts(source()),false,()=> 'v102-'+(++nextId));
  assert.equal(add.added,4);
  assert.deepEqual(add.state.assignments,before.assignments);
  assert.deepEqual(add.state.logs,before.logs);
  assert.deepEqual(add.state.metrics,before.metrics);
  assert.deepEqual(before.templates,[]);
  assert.equal(addWorkouts(add.state,parseWorkouts(source()),false,()=> 'duplicate').added,0);
  // Current parser ignores source_note: this test does not imply PT notes are persisted.
});
