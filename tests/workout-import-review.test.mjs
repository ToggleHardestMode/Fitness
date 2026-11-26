import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateBackup} from '../preview-v101/core.js';
import {inspectWorkoutFiles,resolveWorkoutFiles} from '../preview-v101/workout-import-review.js';
import {applyCompletedCsv,previewCompletedCsv} from '../preview-v101/completed-workout-csv.js';
import {recommendNextExercise} from '../preview-v101/strength-journey.js';
import {generateOneSetCoverage} from '../preview-v101/return-coverage.js';

const file=(name,body,choice='historical')=>({name,choice,text:'date,workout,exercise,set,kg,reps,exercise_index,notes\n'+body});
const a=file('unknown.csv','2026-10-01,Unknown session,Press,1,10,8,2,\n2026-10-01,Unknown session,Press,3,12,6,2,');
const b=file('bad.csv','2026-10-02,Unknown session,Press,1,,8,1,');
const active=()=>({...emptyState(),templates:[{id:'plan',day:3,name:'Existing plan',exercises:[{name:'Press',muscle:'Chest',sets:2,min:8,max:12,rest:90}]}],assignments:{3:'plan'}});
const apply=(state,p)=>{let n=0;return applyCompletedCsv({...state,templates:[...state.templates,...p.historical]},p,()=>String(++n));};

test('unknown template still rejected by strict importer; historical review creates observed capacity only and does not mutate state',()=>{
  const before=active();
  assert.throws(()=>previewCompletedCsv(before,a.text),/not in your library/);
  assert.equal(inspectWorkoutFiles(before,[a])[0].choice,'');
  const p=resolveWorkoutFiles(before,[a,{...b,choice:'skip'}]);
  assert.equal(p.historical.length,1);assert.equal(p.historical[0].exercises[0].sets,3);
  assert.equal(p.add.length,2);assert.deepEqual(p.excluded,['bad.csv']);
  assert.equal(before.templates.length,1);assert.equal(before.logs.length,0);
  const saved=apply(before,p);
  assert.deepEqual(saved.assignments,before.assignments);assert.deepEqual(saved.templates[0],before.templates[0]);
  assert.equal(validateBackup(saved).logs.length,2);
  assert.equal(resolveWorkoutFiles(saved,[a]).skipped.length,2);
  assert.equal(resolveWorkoutFiles(saved,[a]).historical.length,0);
  const id=p.historical[0].id;
  assert.equal(recommendNextExercise(saved,{templateId:id,exerciseIndex:0,date:'2026-10-02'}).targets.length,0);
  assert.throws(()=>generateOneSetCoverage([p.historical[0]]),/Historical workouts/);
});

test('missing measurement and unresolved files block entire batch; duplicate identical files skip rows',()=>{
  const before=active();
  assert.throws(()=>resolveWorkoutFiles(before,[a,b]),/bad.csv:.*Missing values/);
  assert.throws(()=>resolveWorkoutFiles(before,[{...a,choice:''}]),/Choose a resolution/);
  assert.equal(resolveWorkoutFiles(before,[a,{...a,name:'copy.csv'}]).add.length,2);
  assert.equal(before.logs.length,0);
});

test('explicit existing match still enforces exact exercise names and original set limits',()=>{
  const before=active();
  assert.throws(()=>resolveWorkoutFiles(before,[{...a,choice:'match:plan'}]),/between 1 and 2/);
  const one=file('match.csv','2026-10-01,Other name,Press,1,10,8,3,','match:plan');
  const p=resolveWorkoutFiles(before,[one]);
  assert.equal(p.add[0].templateId,'plan');assert.equal(p.historical.length,0);
  assert.throws(()=>resolveWorkoutFiles(before,[{...one,text:one.text.replace(',Press,',',Row,')}]),/exact, unique name/);
  const saved=apply(before,p);
  assert.throws(()=>resolveWorkoutFiles(saved,[a]),/already has sets in a different workout/);
  assert.throws(()=>resolveWorkoutFiles(before,[one,a]),/identities overlap/);
});
