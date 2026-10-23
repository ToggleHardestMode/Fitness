import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, validateBackup } from '../preview-v101/core.js';
import { verifyLocalSnapshot } from '../preview-v101/recovery-check.js';

function example() {
  const data=emptyState();
  data.templates=[{id:'upper-v1',name:'Sample Upper',day:0,exercises:[
    {name:'Press',muscle:'Chest',sets:2,min:8,max:12,rest:90}
  ]}];
  data.assignments={0:'upper-v1'};
  data.logs=[{id:'set-a',date:'2026-10-19',templateId:'upper-v1',
    exerciseIndex:0,set:1,kg:10,reps:10,rpe:7,rest:90,notes:'test only',tempo:''}];
  data.metrics=[{date:'2026-10-19',weight:90,calories:2000,protein:150,sleep:7,recovery:4}];
  data.symptomLogs=[];
  return data;
}

test('synthetic JSON serialization and validation preserve logs, IDs and assignments', () => {
  const original=example();
  const serialized=JSON.stringify(original,null,2)+'\n';
  const restored=validateBackup(JSON.parse(serialized));
  assert.deepEqual(restored,original);
  restored.logs[0].reps=8;
  assert.equal(original.logs[0].reps,10);
});

test('read-only integrity check compares saved browser JSON with visible state', () => {
  const data=example();
  const result=verifyLocalSnapshot(data,JSON.stringify(data));
  assert.deepEqual(result,{templates:1,sets:1,checkins:1,symptoms:0,assignments:1});
});

test('malformed JSON and diverged state reject instead of pretending recovery', () => {
  const data=example();
  assert.throws(()=>verifyLocalSnapshot(data,'not-json'),/valid JSON/);
  assert.throws(()=>verifyLocalSnapshot({...data,logs:[]},JSON.stringify(data)),/differs from the visible/);
});

test('duplicate saved-set keys fail restore validation', () => {
  const data=example();
  data.logs.push({...data.logs[0],id:'set-b'});
  assert.throws(()=>validateBackup(data),/duplicate sets/);
});
