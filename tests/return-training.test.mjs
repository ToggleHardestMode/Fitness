import test from 'node:test';
import assert from 'node:assert/strict';
import {generateOneSetCoverage} from '../preview-v101/return-coverage.js';
import {addWorkouts,emptyState,validateBackup} from '../preview-v101/core.js';
import {returnStagePanel} from '../preview-v101/return-training-ui.js';
const sampleV103 = () => {
  const ex=(name,sets,muscle='Chest')=>({name,muscle,sets,min:8,max:12,rest:90});
  return [
    {id:'ua',day:0,name:'Upper A',sourceVersion:'V10.3',exercises:[3,3,3,2,2,2,2].map((n,i)=>ex('Upper A '+i,n))},
    {id:'la',day:1,name:'Lower A [PT Review]',requiresClinicalReview:true,sourceVersion:'V10.3',exercises:[4,3,3].map((n,i)=>ex('Lower A '+i,n,'Quads'))},
    {id:'ub',day:3,name:'Upper B',sourceVersion:'V10.3',exercises:[3,3,3,2,2,2,2,2,1].map((n,i)=>ex('Upper B '+i,n))},
    {id:'lb',day:4,name:'Lower B [PT Review]',requiresClinicalReview:true,sourceVersion:'V10.3',exercises:[3,3,3].map((n,i)=>ex('Lower B '+i,n,'Hamstrings'))}
  ];
};
test('one-set coverage yields 7+9 of 37 upper sets (43%) and excludes 19 lower PT sets',()=>{
  const src=sampleV103(), snapshot=structuredClone(src);
  const c=generateOneSetCoverage(src);
  assert.equal(c.full,37);assert.equal(c.planned,16);assert.equal(c.percentage,43);
  assert.deepEqual(c.workouts.map(w=>w.exercises.length),[7,9]);
  assert.deepEqual(c.workouts.map(w=>w.exercises.reduce((n,e)=>n+e.sets,0)),[7,9]);
  assert.equal(c.excluded.reduce((n,w)=>n+w.planned,0),19);
  assert.ok(c.workouts.every(w=>w.exercises.every(e=>e.sets===1)));
  assert.deepEqual(src,snapshot);
});
test('coverage keeps original exercise identity, first per-set target, and source version',()=>{
  const src=sampleV103();
  src[0].exercises[0].setTargets=[{min:8,max:8},{min:9,max:10},{min:10,max:12}];
  const c=generateOneSetCoverage(src);
  assert.deepEqual(c.workouts[0].exercises[0].setTargets,[{min:8,max:8}]);
  assert.equal(c.workouts[0].returnSourceTemplateId,'ua');
  assert.equal(c.workouts[0].returnStageMode,'one-per-exercise');
  assert.match(c.workouts[0].sourceVersion,/V10.3/);
});
test('coverage fails when only PT/lower or a mixed lower template was selected',()=>{
  const s=sampleV103();
  assert.throws(()=>generateOneSetCoverage(s.filter(w=>w.requiresClinicalReview)),/non-PT-review/);
  const mixed={id:'mixed',day:2,name:'Mixed',exercises:[
    {name:'DB Bench',muscle:'Chest',sets:3,min:8,max:12,rest:90},
    {name:'Goblet Squat',muscle:'Quads',sets:3,min:8,max:12,rest:90}]};
  assert.throws(()=>generateOneSetCoverage([mixed]),/non-PT-review/);
  s[0].exercises[0].sourceNote='[PT Review]';
  assert.equal(generateOneSetCoverage(s).workouts.length,1);
});
test('coverage append is idempotent and retains source/logs/weekday assignments',()=>{
  const state=emptyState();state.templates=sampleV103();state.assignments={0:'ua',3:'ub'};
  state.logs=[{id:'demo',date:'2026-11-09',templateId:'ua',exerciseIndex:0,set:1,kg:10,reps:8,rpe:7}];
  const original=structuredClone(state), coverage=generateOneSetCoverage(state.templates);
  const result=addWorkouts(state,coverage.workouts,false,(()=>{let i=0;return()=> 'coverage-'+(++i);})());
  assert.equal(result.added,2);assert.deepEqual(state,original);assert.deepEqual(result.state.logs,original.logs);
  assert.deepEqual(result.state.assignments,original.assignments);
  assert.equal(validateBackup(result.state).templates.length,state.templates.length+2);
  assert.equal(addWorkouts(result.state,coverage.workouts).added,0);
});
test('coverage preview shows separate comparison, achieved percent, and excluded PT sets',()=>{
  const state=emptyState();state.templates=sampleV103();
  const html=returnStagePanel(state,{ids:['ua','la','','ub','lb','',''],percent:'coverage'});
  assert.match(html,/16 of 37 eligible upper-body sets/);
  assert.match(html,/43% of original volume/);
  assert.match(html,/19 prescribed sets are NOT counted/);
  assert.match(html,/one set per exercise/i);
  assert.match(html,/return-stage-save/);
});

test('exclusive coverage removes stage selector and preserves historical percentage templates',()=>{
  const state=emptyState();state.templates=sampleV103();
  const historic={...structuredClone(state.templates[0]),id:'old25',name:'Archived Return 25%',returnStagePercent:25};
  state.templates.push(historic);
  const original=structuredClone(state);
  const idle=returnStagePanel(state);
  assert.match(idle,/Preview Coverage-First plan/);
  assert.doesNotMatch(idle,/returnPercent|value="25"|value="50"|value="75"|value="100"|data-action="return-stage-save"/);
  assert.doesNotMatch(idle,/value="old25"/);
  const html=returnStagePanel(state,{ids:['ua','la','','ub','lb','','']});
  assert.match(html,/Add Coverage-First templates to library/);
  assert.doesNotMatch(html,/Stage comparison|25%<\/th>|50%<\/th>|75%<\/th>|100%<\/th>/);
  assert.deepEqual(state,original);
  assert.deepEqual(validateBackup(state).templates.find(t=>t.id==='old25'),historic);
});
test('coverage validates sources independently of retired percentage generator',()=>{
  assert.throws(()=>generateOneSetCoverage([]),/between one and seven/);
  const duplicate=sampleV103();duplicate[2].day=0;
  assert.throws(()=>generateOneSetCoverage(duplicate),/at most one/);
  const invalid=sampleV103();invalid[0].exercises[0].sets=0;
  assert.throws(()=>generateOneSetCoverage(invalid),/1–10 working sets/);
  const missing=sampleV103();delete missing[0].exercises[0].muscle;
  assert.throws(()=>generateOneSetCoverage(missing),/primary muscle/);
});
