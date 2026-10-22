import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, parseWorkouts, addWorkouts, recordSets, validateBackup } from '../preview-v101/core.js';
import { focusEntries } from '../preview-v101/focus-mode.js';
import { repeatLastSessionSet } from '../preview-v101/quick-repeat.js';

const DATE='2026-10-22';
const makeState=(exerciseCount=1)=>{
  const header='day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds';
  const rows=Array.from({length:exerciseCount},(_,i)=>`Mon,Upper A,DB Exercise ${i+1},Chest,3,8,12,90`);
  let n=0;
  const state=addWorkouts(emptyState(),parseWorkouts([header,...rows].join('\n')),false,()=>`tpl-${++n}`).state;
  return {state,id:state.templates[0].id};
};
const log=(id,set,changes={})=>({id:`log-${set}`,date:DATE,templateId:id,exerciseIndex:0,
  exerciseName:'DB Exercise 1',muscle:'Chest',set,kg:14,reps:10,rpe:7,rest:90,notes:'',tempo:'',...changes});
const choice=(id,set,exerciseIndex=0)=>({date:DATE,templateId:id,exerciseIndex,set});

test('returns only saved same-session kg/reps, not RPE or progression',()=>{
  const {state,id}=makeState();
  state.logs.push(log(id,1,{rpe:9}));
  const before=structuredClone(state);
  assert.deepEqual(repeatLastSessionSet(state,choice(id,2)),{kg:14,reps:10,sourceSet:1});
  assert.deepEqual(state,before);
});

test('selects latest earlier saved set, never later or another date/exercise/template',()=>{
  const {state,id}=makeState(2);
  state.logs.push(log(id,1),log(id,2,{kg:16,reps:9}),
    log(id,3,{date:'2026-10-21',kg:30}),
    log(id,3,{exerciseIndex:1,kg:40}),
    log(id,3,{templateId:'other',kg:50}));
  assert.deepEqual(repeatLastSessionSet(state,choice(id,3)),{kg:16,reps:9,sourceSet:2});
  assert.equal(repeatLastSessionSet(state,choice(id,1)),null);
});

test('PT review and timed holds never offer quick reuse',()=>{
  const {state,id}=makeState();
  state.logs.push(log(id,1));
  state.templates[0].requiresClinicalReview=true;
  assert.equal(repeatLastSessionSet(state,choice(id,2)),null);
  state.templates[0].requiresClinicalReview=false;
  state.templates[0].name='Upper [PT Review]';
  assert.equal(repeatLastSessionSet(state,choice(id,2)),null);
  state.templates[0].name='Upper A';
  state.templates[0].exercises[0].repUnit='seconds_per_side';
  assert.equal(repeatLastSessionSet(state,choice(id,2)),null);
});

test('already-saved target, warmup, invalid or out-of-bounds logs cannot be reused',()=>{
  const {state,id}=makeState();
  state.logs.push(log(id,1,{kg:999,reps:10}));
  assert.equal(repeatLastSessionSet(state,choice(id,2)),null);
  state.logs[0].kg=14;state.logs[0].isWarmup=true;
  assert.equal(repeatLastSessionSet(state,choice(id,2)),null);
  state.logs[0].isWarmup=false;
  state.logs.push(log(id,2));
  assert.equal(repeatLastSessionSet(state,choice(id,2)),null);
  assert.equal(repeatLastSessionSet(state,choice(id,4)),null);
  assert.equal(repeatLastSessionSet(state,{...choice(id,3),templateId:'missing'}),null);
});

test('30 synthetic focused sets preserve unique IDs, history and existing forms',()=>{
  let {state,id}=makeState(10);
  let nextId=0, copied=0;
  for(let exerciseIndex=0;exerciseIndex<10;exerciseIndex++){
    for(let i=0;i<3;i++){
      const source=repeatLastSessionSet(state,choice(id,i+1,exerciseIndex));
      if(i===0)assert.equal(source,null);
      else{assert.deepEqual(source,{kg:12,reps:10,sourceSet:i});copied++;}
      const values={kg:String(source?.kg??12),reps:String(source?.reps??10),rpe:'8',
        rest:'90',tempo:'',notes:''};
      const result=recordSets(state,{date:DATE,templateId:id,exerciseIndex,
        entries:focusEntries(3,i,values)},()=>`set-${++nextId}`);
      assert.equal(result.saved,1);
      state=result.state;
    }
  }
  assert.equal(copied,20);
  assert.equal(state.logs.length,30);
  assert.equal(new Set(state.logs.map(x=>x.id)).size,30);
  assert.deepEqual(validateBackup(state),state);
  const snapshot=structuredClone(state);
  const rerecord=recordSets(state,{date:DATE,templateId:id,exerciseIndex:0,
    entries:focusEntries(3,0,{kg:'13',reps:'9',rpe:'8',rest:'90',tempo:'',notes:''})},()=> 'unexpected-id').state;
  assert.equal(rerecord.logs.length,30);
  assert.equal(rerecord.logs.find(x=>x.id==='set-1').kg,13);
  assert.equal(state.logs.find(x=>x.id==='set-1').kg,12);
  assert.deepEqual(state,snapshot);
});

test('Focus Mode UI requires deliberate copy action and never auto-saves',()=>{
  // Manual DOM acceptance is still required; this guards against accidental wiring.
  const {state,id}=makeState();
  state.logs.push(log(id,1));
  const result=repeatLastSessionSet(state,choice(id,2));
  assert.equal(Object.hasOwn(result,'rpe'),false);
  assert.equal(Object.hasOwn(result,'completed'),false);
  assert.equal(Object.hasOwn(result,'id'),false);
});
