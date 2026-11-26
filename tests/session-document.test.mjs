import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateBackup,STORAGE_KEY} from '../preview-v101/core.js';
import {createSessionDocument,validateSessionDocument,readActualSessions} from '../preview-v101/session-document.js';
import {loadWorkoutState,saveWorkoutState} from '../preview-v101/state.js';
import {resetTrackingData} from '../preview-v101/tracking-reset.js';
import {restoreBothToEmpty} from '../preview-v101/encrypted-backup-core.js';

const legacy=()=>({...emptyState(),templates:[
  {id:'plan-a',name:'Synthetic plan A',day:0,exercises:[{name:'Press',muscle:'Chest',sets:2,min:8,max:12,rest:90}]},
  {id:'plan-b',name:'Synthetic plan B',day:0,exercises:[{name:'Press',muscle:'Chest',sets:3,min:8,max:12,rest:90}]}],
  assignments:{0:'plan-a'},logs:[{id:'old-set',date:'2026-10-05',templateId:'plan-a',exerciseIndex:0,set:1,
    kg:10,reps:8,rpe:null,notes:'synthetic'}],
  exerciseEquivalences:[{id:'approved-link',from:{templateId:'plan-a',exerciseIndex:0},to:{templateId:'plan-b',exerciseIndex:0},approvedDate:'2026-10-06'}],
  exerciseClearances:[],activeSets:{'plan-a|0':1}});
const set=(id,number=1,kg=null,reps=null)=>({id,number,completed:true,kind:'working',
  observations:[{actualKg:kg,actualReps:reps,rpe:null,source:{kind:'manual'}}]});
const occurrence=(id,sets,identity={kind:'catalog',exerciseId:'movement-a'})=>
  ({id,identity,loadUnit:'unknown',plannedExerciseIndex:null,sets});
const session=(id,exercises,planId=null,extendsLegacy=false)=>({id,date:'2026-10-05',name:'Synthetic session',planId,extendsLegacy,exercises});
function fixture(){
  const doc=createSessionDocument(legacy());
  doc.exercises.push({id:'movement-a',name:'Press',muscle:null,repUnit:'reps'});
  doc.sessions.push(session('morning',[occurrence('movement-1',[set('new-1',1,0,8),set('new-2',2,null,5)])]));
  doc.sessions.push(session('evening',[occurrence('movement-2',[set('new-3')])],'plan-a'));
  return doc;
}

test('legacy adapter is read-only, preserves original IDs, links, clearance and plan identity; no inferred unit or matching',()=>{
  const old=legacy(),before=structuredClone(old),doc=createSessionDocument(old);
  assert.deepEqual(doc.legacy,before);assert.deepEqual(old,before);
  const [actual]=readActualSessions(old);
  assert.equal(actual.exercises[0].loadUnit,'unknown');
  assert.deepEqual(actual.exercises[0].identity,{kind:'plan',templateId:'plan-a',exerciseIndex:0});
  assert.deepEqual(actual.exercises[0].sets[0].observations[0].source.record,before.logs[0]);
  assert.deepEqual(readActualSessions(doc),readActualSessions(old));
  assert.deepEqual(validateSessionDocument(JSON.parse(JSON.stringify(doc))),doc);
});

test('same-day sessions, substitutions, unknown measurements, zero and warmups remain distinct',()=>{
  const doc=fixture(),before=structuredClone(doc);
  doc.sessions[0].exercises[0].sets[0].kind='warmup';
  doc.sessions[1].exercises[0].plannedExerciseIndex=0;
  const actual=readActualSessions(doc);
  assert.equal(actual.length,3);
  const morning=actual.find(s=>s.id===JSON.stringify(['session','morning']));
  assert.equal(morning.exercises[0].sets[0].observations[0].actualKg,0);
  assert.equal(morning.exercises[0].sets[0].kind,'warmup');
  assert.equal(morning.exercises[0].sets[1].observations[0].actualKg,null);
  assert.equal(morning.exercises[0].muscle,null);
  const evening=actual.find(s=>s.id===JSON.stringify(['session','evening']));
  assert.deepEqual(evening.exercises[0].identity,{kind:'catalog',exerciseId:'movement-a'});
  assert.equal(evening.exercises[0].plannedExerciseIndex,0);
  assert.equal(evening.exercises[0].sets[0].observations[0].actualReps,null);
  assert.deepEqual(doc.legacy,before.legacy);
});

test('explicit extension appends five sets to a two-set prescription without rewriting existing logs',()=>{
  const doc=createSessionDocument(legacy());
  const ex={...occurrence('extra',Array.from({length:4},(_,i)=>set('extra-'+i,i+2,12,8)),
    {kind:'plan',templateId:'plan-a',exerciseIndex:0}),plannedExerciseIndex:0,legacyExerciseIndex:0};
  doc.sessions.push(session('extension',[ex],'plan-a',true));
  const actual=readActualSessions(doc);
  assert.equal(actual.length,1);assert.deepEqual(actual[0].exercises[0].sets.map(s=>s.number),[1,2,3,4,5]);
  assert.equal(doc.legacy.templates[0].exercises[0].sets,2);
  assert.deepEqual(doc.legacy,legacy());
  ex.sets[0].number=1;assert.throws(()=>validateSessionDocument(doc),/Duplicate set number/);
});

test('correction provenance round-trips; planned, malformed and duplicate records fail closed',()=>{
  const doc=fixture(),obs=doc.sessions[0].exercises[0].sets[0].observations;
  obs[0].source={kind:'csv',id:'source-row-1',file:'synthetic.csv',row:2,raw:'original,0,8'};
  obs.push({actualKg:5,actualReps:8,rpe:null,correctionReason:'Owner confirmed load',source:{kind:'manual'}});
  assert.deepEqual(validateSessionDocument(JSON.parse(JSON.stringify(doc))),doc);
  assert.equal(readActualSessions(doc).find(s=>s.id===JSON.stringify(['session','morning']))
    .exercises[0].sets[0].observations[0].actualKg,0);
  const bad=(edit,pattern)=>{const d=structuredClone(doc);edit(d);assert.throws(()=>validateSessionDocument(d),pattern);};
  bad(d=>d.sessions[0].exercises[0].sets[0].completed=false,/explicitly completed/);
  bad(d=>d.sessions[0].exercises[0].sets[0].observations[0].actualKg='5',/Actual kg/);
  bad(d=>delete d.sessions[0].exercises[0].sets[0].observations[1].correctionReason,/Correction reason/);
  bad(d=>d.sessions[1].exercises[0].sets[0].observations[0].source=obs[0].source,/Duplicate CSV source/);
  bad(d=>d.sessions[1].id=d.sessions[0].id,/Duplicate session/);
  bad(d=>d.sessions[1].exercises[0].identity.exerciseId='missing',/Unknown actual exercise/);
  bad(d=>d.sessions[1].exercises[0].sets[0].id='new-1',/Duplicate set ID/);
});

test('v2 is not activated: current v1 readers, reset, restore and stale-tab save refuse it',()=>{
  const doc=fixture(),raw=JSON.stringify(doc);
  assert.throws(()=>validateBackup(doc),/compatible/);
  assert.throws(()=>resetTrackingData(doc,{apply:true}),/compatible/);
  assert.throws(()=>restoreBothToEmpty({getItem:()=>null,setItem:()=>assert.fail('No write')},
    {workout:doc,food:{version:1,entries:[]}},{apply:true,confirmed:true}),/compatible/);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try{
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
      getItem:k=>{assert.equal(k,STORAGE_KEY);return raw;},
      setItem:()=>assert.fail('Must not overwrite v2')
    }});
    const loaded=loadWorkoutState();assert.match(loaded.storageError,/Unsupported workout document version/);
    assert.throws(()=>saveWorkoutState(legacy(),null),/Unsupported workout document version/);
    assert.throws(()=>saveWorkoutState(loaded.state,loaded.storageError),/locked/);
  }finally{
    if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;
  }
});
