import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, validateBackup, saveMetrics, parseWorkouts, addWorkouts, STARTER_CSV, recordSets } from '../preview-v101/core.js';
import { resetTrackingData } from '../preview-v101/tracking-reset.js';

const ids = prefix => { let n=0;return ()=>prefix+(++n); };

function fixture() {
  const imported = addWorkouts(emptyState(), parseWorkouts(STARTER_CSV), true, ids('template-')).state;
  const saved = saveMetrics(imported, '2026-10-19', {weight:'90',protein:'160',calories:'2000',sleep:'8',recovery:'3'});
  const set = recordSets(saved, {
    date:'2026-10-19',templateId:saved.assignments[0],exerciseIndex:0,
    entries:[{completed:true,kg:24,reps:10,rest:90,rpe:8},{completed:false},{completed:false}]
  },ids('set-')).state;
  return {...set,symptomLogs:[]};
}

test('preview is read-only and shows exact deletion/preservation counts',()=>{
  const source=fixture(),before=structuredClone(source);
  const {counts,nextState}=resetTrackingData(source);
  assert.deepEqual(counts,{templatesKept:4,assignmentsKept:4,setsRemoved:1,checkinsRemoved:1,symptomsRemoved:0});
  assert.equal(nextState,null);
  assert.deepEqual(source,before);
});

test('explicit apply drops records and preserves workout templates, schedule and preferences',()=>{
  const source=fixture(),before=structuredClone(source);
  const {nextState}=resetTrackingData(source,{apply:true});
  assert.deepEqual(nextState.templates,before.templates);
  assert.deepEqual(nextState.assignments,before.assignments);
  assert.deepEqual(nextState.reminder,before.reminder);
  assert.deepEqual(nextState.logs,[]);
  assert.deepEqual(nextState.metrics,[]);
  assert.deepEqual(nextState.symptomLogs,[]);
  assert.deepEqual(source,before);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(nextState))),nextState);
});

test('empty reset and repeating apply are idempotent; legacy missing symptoms stays missing',()=>{
  const source=emptyState(),first=resetTrackingData(source,{apply:true}).nextState;
  assert.deepEqual(first,source);
  assert.equal(Object.hasOwn(first,'symptomLogs'),false);
  assert.deepEqual(resetTrackingData(first,{apply:true}).nextState,first);
});

test('invalid data rejects both preview and apply rather than repairing it',()=>{
  const broken=fixture();
  broken.assignments[0]='missing';
  assert.throws(()=>resetTrackingData(broken),/missing workout/i);
  assert.throws(()=>resetTrackingData(broken,{apply:true}),/missing workout/i);
});
