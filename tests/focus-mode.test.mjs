import test from 'node:test';
import assert from 'node:assert/strict';
import {focusEntries,nextPendingSet,nextPendingExercise} from '../preview-v101/focus-mode.js';
import {emptyState,addWorkouts,parseWorkouts,recordSets} from '../preview-v101/core.js';
const d='2026-10-22',t='upper';
const row=(exerciseIndex,set)=>({date:d,templateId:t,exerciseIndex,set});
test('only selected set completed; no other set touched',()=>{
 assert.deepEqual(focusEntries(3,1,{kg:'20',reps:'10',rpe:'8'}),[
  {completed:false},{kg:'20',reps:'10',rpe:'8',completed:true},{completed:false}]);
});
test('invalid set selection throws',()=>{
 assert.throws(()=>focusEntries(3,-1,{}),/Invalid Focus Mode/);
 assert.throws(()=>focusEntries(3,3,{}),/Invalid Focus Mode/);
});
test('find first pending saved set and ignore unrelated logs',()=>{
 assert.equal(nextPendingSet([row(0,1),row(0,3)],d,t,0,4),1);
 assert.equal(nextPendingSet([{...row(0,1),date:'2026-10-21'}, {...row(0,2),templateId:'other'}],d,t,0,3),0);
});
test('wrap and stop when all sets logged',()=>{
 assert.equal(nextPendingSet([row(0,2)],d,t,0,3,0),2);
 assert.equal(nextPendingSet([row(0,2)],d,t,0,3,2),0);
 assert.equal(nextPendingSet([row(0,1),row(0,2),row(0,3)],d,t,0,3),-1);
});
test('advance to next exercise with missing sets',()=>{
 const logs=[row(0,1),row(0,2),row(1,1)];
 const exercises=[{sets:2},{sets:2},{sets:3}];
 assert.equal(nextPendingExercise(logs,d,t,exercises,0),1);
 assert.equal(nextPendingExercise([...logs,row(1,2)],d,t,exercises,0),2);
 assert.equal(nextPendingExercise([...logs,row(1,2),row(2,1),row(2,2),row(2,3)],d,t,exercises,0),-1);
});
test('single focused save writes exactly one and editing preserves its ID',()=>{
 const csv='day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds\nMon,Upper A,DB Bench Press,Chest,3,8,12,90';
 const imported=addWorkouts(emptyState(),parseWorkouts(csv));
 const base=imported.state;
 const id=base.templates[0].id;
 const input=focusEntries(3,0,{kg:'20',reps:'10',rpe:'8',rest:'90',notes:'',tempo:''});
 const first=recordSets(base,{date:d,templateId:id,exerciseIndex:0,entries:input},()=> 'test-set-1').state;
 assert.equal(first.logs.length,1);
 assert.equal(base.logs.length,0);
 assert.equal(first.logs[0].kg,20);
 const revised=recordSets(first,{date:d,templateId:id,exerciseIndex:0,entries:focusEntries(3,0,{kg:'22',reps:'9',rpe:'8',rest:'90',notes:'',tempo:''})},()=> 'new-id-should-not-be-used').state;
 assert.equal(revised.logs.length,1);
 assert.equal(revised.logs[0].id,'test-set-1');
 assert.equal(revised.logs[0].kg,22);
});
test('focus helpers are read-only',()=>{
 const logs=[row(0,1),row(1,1)];
 const before=JSON.stringify(logs);
 nextPendingExercise(logs,d,t,[{sets:2},{sets:2}],0);
 assert.equal(JSON.stringify(logs),before);
});
