import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,addWorkouts,recordSets,parseWorkouts,validateBackup} from '../preview-v101/core.js';
import {createExerciseVersion} from '../preview-v101/template-version.js';

const setup=()=>{
  let seq=0;
  const csv='day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds,source_note\nMon,Upper A,Dumbbell Press,Chest,3,8,12,90,Keep shoulder stable';
  const state=addWorkouts(emptyState(),parseWorkouts(csv).map(t=>({...t,sourceVersion:'V10.2 Home Overlap'})),false,()=>`t-${++seq}`).state;
  state.assignments[0]=state.templates[0].id;
  state.logs.push({id:'saved-1',date:'2026-10-19',templateId:state.templates[0].id,exerciseIndex:0,
    exerciseName:'Dumbbell Press',muscle:'Chest',set:1,kg:18,reps:10,rpe:7,rest:90,notes:'',tempo:''});
  state.metrics.push({date:'2026-10-19',weight:88,calories:null,protein:null,sleep:null,recovery:4});
  return state;
};
const edit=(s,override={})=>({...((({name,muscle,sets,min,max,rest,sourceNote})=>({name,muscle,sets:String(sets),min:String(min),max:String(max),rest:String(rest),sourceNote}))(s.templates[0].exercises[0])),...override});

test('saves a distinct custom template, never mutates old references or workout history',()=>{
  const state=setup(),before=structuredClone(state);
  const result=createExerciseVersion(state,state.templates[0].id,0,edit(state,{sets:'4'}),()=> 'new-version');
  assert.deepEqual(state,before);
  assert.equal(result.state.templates.length,2);
  assert.equal(result.template.id,'new-version');
  assert.equal(result.template.sourceVersion,'Custom');
  assert.match(result.template.name,/Custom 1$/);
  assert.equal(result.template.exercises[0].sets,4);
  assert.equal(result.state.templates[0].exercises[0].sets,3);
  assert.deepEqual(result.state.assignments,state.assignments);
  assert.deepEqual(result.state.logs,state.logs);
  assert.deepEqual(result.state.metrics,state.metrics);
  assert.deepEqual(validateBackup(result.state),result.state);
});

test('repeated customization has distinct names and IDs, not destructive replacement',()=>{
  const initial=setup();
  const first=createExerciseVersion(initial,initial.templates[0].id,0,edit(initial,{rest:'120'}),()=> 'new-1');
  const second=createExerciseVersion(first.state,initial.templates[0].id,0,edit(initial,{rest:'140'}),()=> 'new-2');
  assert.notEqual(first.template.name,second.template.name);
  assert.equal(second.state.templates.length,3);
  assert.deepEqual(second.state.logs,initial.logs);
  assert.deepEqual(second.state.assignments,initial.assignments);
});

test('substituted movement must have new instructions and removes stale muscle classification',()=>{
  const initial=setup();
  initial.templates[0].exercises[0].muscleDetail='Front Delts';
  const options=edit(initial,{name:'Seated Curl',muscle:'Biceps'});
  assert.throws(()=>createExerciseVersion(initial,initial.templates[0].id,0,options),/replace the old instructions/);
  const out=createExerciseVersion(initial,initial.templates[0].id,0,{...options,sourceNote:'Controlled curls with stable shoulders'},()=> 'swap');
  assert.equal(out.template.exercises[0].sourceNote,'Controlled curls with stable shoulders');
  assert.equal(out.template.exercises[0].muscleDetail,undefined);
  assert.equal(initial.templates[0].exercises[0].muscleDetail,'Front Delts');
});

test('PT warning cannot be cleared, lower-body substitution adds clinician review',()=>{
  const state=setup();
  state.templates[0].requiresClinicalReview=true;
  const old=createExerciseVersion(state,state.templates[0].id,0,edit(state,{rest:'100'}),()=> 'flagged');
  assert.equal(old.template.requiresClinicalReview,true);
  state.templates[0].requiresClinicalReview=false;
  const lower=createExerciseVersion(state,state.templates[0].id,0,edit(state,{muscle:'Quads'}),()=> 'lower');
  assert.equal(lower.template.requiresClinicalReview,true);
  const nameLower=createExerciseVersion(state,state.templates[0].id,0,
    edit(state,{name:'Squat',sourceNote:'Coach-reviewed movement instructions'}),()=> 'squat');
  assert.equal(nameLower.template.requiresClinicalReview,true);
});

test('per-set rep targets stay intact and block unsupported range edits',()=>{
  const state=setup(),ex=state.templates[0].exercises[0];
  ex.setTargets=[{min:8,max:10},{min:8,max:12},{min:8,max:12}];
  assert.throws(()=>createExerciseVersion(state,state.templates[0].id,0,edit(state,{sets:'4'})),/per-set rep targets/);
  const out=createExerciseVersion(state,state.templates[0].id,0,edit(state,{rest:'100'}),()=> 'target');
  assert.deepEqual(out.template.exercises[0].setTargets,ex.setTargets);
  assert.deepEqual(validateBackup(out.state),out.state);
});

test('invalid or no-op customization fails without touching original',()=>{
  const state=setup(),before=JSON.stringify(state),id=state.templates[0].id;
  assert.throws(()=>createExerciseVersion(state,id,0,edit(state)),/Change at least one/);
  assert.throws(()=>createExerciseVersion(state,id,0,edit(state,{min:'20',max:'5'})),/cannot exceed/);
  assert.throws(()=>createExerciseVersion(state,id,0,edit(state,{sets:'11'})),/between 1 and 10/);
  assert.throws(()=>createExerciseVersion(state,id,99,edit(state)),/Choose an existing/);
  assert.equal(JSON.stringify(state),before);
});

test('historical 30-set records retain their original version and set indices',()=>{
  const state=setup(), id=state.templates[0].id;
  state.logs=[];
  for(let day=1;day<=10;day++)
    for(let set=1;set<=3;set++)
      state.logs.push({id:`h-${day}-${set}`,date:`2026-10-${String(day).padStart(2,'0')}`,
        templateId:id,exerciseIndex:0,exerciseName:'Dumbbell Press',muscle:'Chest',
        set,kg:20,reps:10,rpe:null,rest:90,notes:'',tempo:''});
  const out=createExerciseVersion(state,id,0,edit(state,{rest:'110'}),()=> 'custom30');
  assert.equal(out.state.logs.length,30);
  assert.deepEqual(out.state.logs,state.logs);
  assert.equal(out.state.assignments[0],id);
  assert.doesNotThrow(()=>validateBackup(out.state));
});
