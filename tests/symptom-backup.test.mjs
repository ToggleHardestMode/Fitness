import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, parseWorkouts, STARTER_CSV, addWorkouts, recordSets, validateBackup} from '../core.js';
import {addSymptomEntry} from '../symptom-journal.js';

const ids = prefix => {let n=0;return ()=>`${prefix}-${++n}`;};
const build = () => {
  const original=addWorkouts(emptyState(),parseWorkouts(STARTER_CSV),true,ids('template')).state;
  const t=original.templates[0];
  const result=recordSets(original,{date:'2026-10-19',templateId:t.id,exerciseIndex:0,entries:[
    {completed:true,kg:20,reps:10,rpe:7,rest:90,notes:'previous',tempo:''},
    {completed:false},{completed:false}
  ]},ids('set'));
  result.state.metrics=[{date:'2026-10-19',weight:90,protein:160,calories:2100,sleep:7,recovery:3}];
  return result.state;
};

test('A09: backup with symptom data round-trips without changing training data',()=>{
  const old=build();
  const oldJson=JSON.stringify(old);
  const after=addSymptomEntry(old,{date:'2026-10-19',timepoint:'next_day',templateId:old.templates[0].id,exerciseIndex:0,side:'left',location:'foot',severity:'4',tingling:true,numbness:false,functionChange:'none',notes:'noticed following morning'},ids('sym'));
  assert.equal(JSON.stringify(old),oldJson);
  assert.deepEqual(after.templates,old.templates);
  assert.deepEqual(after.logs,old.logs);
  assert.deepEqual(after.metrics,old.metrics);
  assert.deepEqual(after.assignments,old.assignments);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(after))),after);
  assert.deepEqual(validateBackup(JSON.parse(oldJson)),old);
});

test('A09: invalid restore is rejected and does not change prior state',()=>{
  const old=build();
  const after=addSymptomEntry(old,{date:'2026-10-19',timepoint:'before',templateId:null,exerciseIndex:null,side:'none',location:'none',severity:0,tingling:false,numbness:false,functionChange:'none',notes:''},ids('sym'));
  const tampered=structuredClone(after);
  tampered.symptomLogs[0].templateId='missing-workout';
  assert.throws(()=>validateBackup(tampered),/missing workout/);
  assert.deepEqual(validateBackup(after),after);
  assert.equal(old.symptomLogs,undefined);
});