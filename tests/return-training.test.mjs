import test from 'node:test';
import assert from 'node:assert/strict';
import {generateReturnStage, RETURN_STAGES} from '../preview-v101/return-training.js';
import {generateOneSetCoverage} from '../preview-v101/return-coverage.js';
import {addWorkouts, emptyState, validateBackup} from '../preview-v101/core.js';
import {returnStagePanel} from '../preview-v101/return-training-ui.js';
const sources = () => [
  {id:'a',day:0,name:'Upper A',sourceVersion:'V10.3',exercises:[
    {name:'DB bench',muscle:'Chest',sets:3,min:8,max:12,rest:90,setTargets:[{min:8,max:8},{min:9,max:10},{min:10,max:12}]},
    {name:'Incline press',muscle:'Chest',sets:3,min:8,max:12,rest:90},
    {name:'Curls',muscle:'Arms',muscleDetail:'Biceps',sets:3,min:8,max:12,rest:90}]},
  {id:'b',day:2,name:'Upper B',sourceVersion:'V10.3',exercises:[
    {name:'Chest fly',muscle:'Chest',sets:6,min:8,max:12,rest:90},
    {name:'Row',muscle:'Back',sets:2,min:8,max:12,rest:90}]},
  {id:'c',day:4,name:'Lower B [PT Review]',sourceVersion:'V10.3',requiresClinicalReview:true,exercises:[
    {name:'Goblet squat',muscle:'Quads',sets:4,min:8,max:12,rest:90,sourceNote:'[PT Review] do not self-progress'}]}
];
test('25/50/75/100% chest stage 3/6/9/12, rounding, no mutation',()=>{
  const src=sources(), baseline=structuredClone(src);
  assert.deepEqual(RETURN_STAGES.map(p=>generateReturnStage(src,p).muscles.find(m=>m.muscle==='Chest').planned),[3,6,9,12]);
  assert.deepEqual(src,baseline);
});
test('stage allocation is nested so raising stage never decreases exercise set count',()=>{
  const src=sources();
  const stages=RETURN_STAGES.map(p=>generateReturnStage(src,p));
  const setsAt = (stage, day, name) => stage.workouts.find(t=>t.day===day)?.exercises.find(e=>e.name===name)?.sets ?? 0;
  for(const t of src) for(const e of t.exercises) for(let i=1;i<stages.length;i++)
    assert.ok(setsAt(stages[i],t.day,e.name)>=setsAt(stages[i-1],t.day,e.name));
});
test('omitted exercises and days are transparent; PT review and set targets survive',()=>{
  const src=sources();src[2].exercises[0].sets=1;
  const stage=generateReturnStage(src,25);
  assert.ok(stage.omitted.some(item=>item.exercise==='Goblet squat'));
  assert.equal(stage.workouts.some(t=>t.day===4),false);
  const full=generateReturnStage(src,100);
  assert.equal(full.workouts.find(t=>t.day===4).requiresClinicalReview,true);
  assert.match(full.workouts.find(t=>t.day===4).exercises[0].sourceNote,/PT Review/);
  const bench=stage.workouts.find(t=>t.day===0).exercises.find(e=>e.name==='DB bench');
  if(bench)assert.equal(bench.setTargets.length,bench.sets);
});
test('full plan remains separately versioned and source workout identity preserved',()=>{
  const src=sources(), full=generateReturnStage(src,100);
  assert.equal(full.planned,full.full);
  assert.equal(full.workouts.find(t=>t.day===0).returnSourceTemplateId,'a');
  assert.notEqual(full.workouts.find(t=>t.day===0).name,src[0].name);
  assert.equal(full.workouts.find(t=>t.day===0).sourceVersion,'Return 100% of V10.3');
});
test('unclassified legacy Arms are not guessed as Biceps or Triceps',()=>{
  const src=sources();src[0].exercises[2].muscleDetail=undefined;
  const stage=generateReturnStage(src,50);
  assert.ok(stage.muscles.some(m=>m.muscle==='Arms'));
  assert.equal(stage.muscles.some(m=>m.muscle==='Biceps'),false);
});
test('invalid stages and duplicate-day source selection are rejected',()=>{
  assert.throws(()=>generateReturnStage(sources(),20),/Choose a 25%/);
  assert.throws(()=>generateReturnStage([],25),/between one and seven/);
  const src=sources();src[1].day=0;
  assert.throws(()=>generateReturnStage(src,50),/at most one/);
});
test('stage save via existing template API appends, preserves logs and assignments, and is idempotent',()=>{
  const src=sources(), state=emptyState();state.templates=structuredClone(src);state.assignments={0:'a'};
  state.logs=[{id:'log-1',date:'2026-11-09',templateId:'a',exerciseIndex:0,set:1,kg:10,reps:8,rpe:7}];
  const before=structuredClone(state);
  const stage=generateReturnStage(state.templates,25);
  const result=addWorkouts(state,stage.workouts,false,(()=>{let i=0;return ()=>`return-id-${++i}`;})());
  assert.ok(result.added>0);assert.deepEqual(state,before);
  assert.deepEqual(result.state.logs,before.logs);
  assert.deepEqual(result.state.assignments,before.assignments);
  assert.equal(validateBackup(result.state).templates.length,src.length+result.added);
  assert.ok(result.state.templates.filter(t=>t.returnStagePercent===25).every(t=>t.requiresClinicalReview===!!t.name.includes('Lower') || !t.name.includes('Lower')));
  assert.equal(addWorkouts(result.state,stage.workouts).added,0);
});
test('plan panel shows four percentages and no save action without preview',()=>{
  const state=emptyState();state.templates=sources();
  const html=returnStagePanel(state);
  assert.match(html,/Preview all four stages/);
  assert.doesNotMatch(html,/data-action="return-stage-save"/);
  const pending={ids:['a','','b','','c','',''],percent:25};
  const review=returnStagePanel(state,pending);
  assert.match(review,/return-stage-save/);
  assert.match(review,/Omitted exercises/);
  assert.match(review,/Volume is not clearance/);
});

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
  assert.match(html,/16 of 37/);
  assert.match(html,/43% achieved/);
  assert.match(html,/19 lower\/PT-review sets NOT counted/);
  assert.match(html,/one set per upper-body exercise/i);
  assert.match(html,/return-stage-save/);
});
