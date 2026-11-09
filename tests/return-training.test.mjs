import test from 'node:test';
import assert from 'node:assert/strict';
import {generateReturnStage, RETURN_STAGES} from '../preview-v101/return-training.js';
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
