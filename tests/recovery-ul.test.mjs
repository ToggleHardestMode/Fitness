import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_UL_CSV, parseWorkouts, addWorkouts, emptyState, validateBackup } from '../core.js';

test('latest user plan has the original four weekdays and 30 exercise rows', () => {
  const templates=parseWorkouts(RECOVERY_UL_CSV);
  assert.deepEqual(templates.map(x=>x.day),[0,1,3,4]);
  assert.deepEqual(templates.map(x=>x.exercises.length),[8,7,9,6]);
  assert.deepEqual(templates[0].exercises.slice(0,2).map(x=>[x.sets,x.min,x.max]),[[1,5,8],[2,8,12]]);
  assert.deepEqual(templates[1].exercises.slice(0,2).map(x=>[x.sets,x.min,x.max]),[[1,6,8],[2,10,12]]);
  assert.deepEqual(templates[2].exercises.slice(0,2).map(x=>[x.sets,x.min,x.max]),[[1,6,9],[2,10,12]]);
  assert.deepEqual(templates[2].exercises.slice(5,7).map(x=>x.rest),[60,60]);
});

test('adding templates preserves assignments, previously logged sets and metrics',()=>{
  const previous={...emptyState(),templates:[{id:'old',name:'Existing',day:0,exercises:[{name:'Old Press',muscle:'Chest',sets:1,min:1,max:10,rest:90}]}],assignments:{0:'old'},logs:[{id:'set',date:'2026-10-19',templateId:'old',exerciseIndex:0,exerciseName:'Old Press',muscle:'Chest',set:1,kg:20,reps:8,rpe:7,rest:90,notes:'',tempo:''}],metrics:[{date:'2026-10-19',weight:90,calories:null,protein:null,sleep:null,recovery:null}]};
  const before=structuredClone(previous);
  let ids=0;
  const first=addWorkouts(previous,parseWorkouts(RECOVERY_UL_CSV),false,()=>`latest-${++ids}`);
  assert.equal(first.added,4);
  assert.deepEqual(first.state.assignments,before.assignments);
  assert.deepEqual(first.state.logs,before.logs);
  assert.deepEqual(first.state.metrics,before.metrics);
  assert.deepEqual(previous,before);
  validateBackup(first.state);
  const second=addWorkouts(first.state,parseWorkouts(RECOVERY_UL_CSV),false,()=>`extra-${++ids}`);
  assert.equal(second.added,0);
  assert.equal(second.skipped,4);
  assert.deepEqual(second.state,first.state);
});
