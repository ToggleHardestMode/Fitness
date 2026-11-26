import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../preview-v101/core.js';
import {migrateLegacyWorkout,validateLedger,recoverLegacyWorkout,legacyHasDiverged,
  validateAppend,encodeLedgerBackup,decodeLedgerBackup} from '../preview-v101/ledger-model.js';
import {openLedgerPrototype} from '../preview-v101/ledger-prototype.js';

const old=()=>({...emptyState(),templates:[
  {id:'a',name:'Synthetic plan',day:0,requiresClinicalReview:true,exercises:[
    {name:'Press',muscle:'Chest',sets:2,min:8,max:12,rest:90}]},
  {id:'b',name:'Synthetic second plan',day:1,exercises:[
    {name:'Press renamed',muscle:'Chest',sets:2,min:8,max:12,rest:90}]}],
  assignments:{0:'a'},logs:[{id:'original',date:'2026-10-05',templateId:'a',exerciseIndex:0,set:1,
    kg:'10',reps:8,rpe:null,notes:'synthetic'},{id:'original',date:'2026-10-06',templateId:'a',
    exerciseIndex:0,set:1,kg:0,reps:8,rpe:7}],activeSets:{'a|0':1},exerciseClearances:[],
  exerciseEquivalences:[{id:'link',from:{templateId:'a',exerciseIndex:0},to:{templateId:'b',exerciseIndex:0},
    approvedDate:'2026-10-07'}],symptomLogs:[],strengthJourneyStartDate:'2026-10-01'});
const independent=()=>({id:'new-session',date:'2026-10-05',name:'Synthetic actual',planId:'a',origin:'actual',
  exercises:[{id:'new-occurrence',identity:{kind:'catalog',exerciseId:'movement'},plannedIndex:0,
    loadUnit:'kg_per_dumbbell',repUnit:'reps_per_side',sets:[{id:'new-set',number:3,completed:true,kind:'working',
      measurement:{actualKg:null,actualReps:8,rpe:null,loadEvidence:'planned',repsEvidence:'recorded'}}]}]});
const extended=()=>{const d=migrateLegacyWorkout(old());d.catalog.push({id:'movement',name:'Other movement',muscle:null});
  d.sessions.push(independent());return d;};

test('lossless migration preserves raw IDs (including repeated legacy IDs), order, numeric text, settings and links',()=>{
  const input=old(),copy=structuredClone(input),doc=migrateLegacyWorkout(input);
  assert.deepEqual(input,copy);assert.deepEqual(recoverLegacyWorkout(doc),copy);
  assert.equal(doc.sessions[0].exercises[0].sets[0].measurement.actualKg,10);
  assert.equal(doc.sessions[1].exercises[0].sets[0].measurement.actualKg,0);
  assert.equal(doc.sessions[0].exercises[0].loadUnit,'unknown');
  assert.deepEqual(migrateLegacyWorkout(input),doc);
  assert.equal(Object.hasOwn(doc.configuration,'logs'),false);
  assert.equal(legacyHasDiverged(doc,{...copy,logs:[...copy.logs].reverse()}),true);
  assert.equal(legacyHasDiverged(doc,copy),false);
});
test('independent same-day session supports extra sets, substitutions and unknown evidence without linking names',()=>{
  const doc=extended();assert.deepEqual(validateLedger(doc),doc);
  assert.equal(doc.sessions.length,3);
  assert.equal(doc.sessions[2].exercises[0].identity.exerciseId,'movement');
  assert.deepEqual(recoverLegacyWorkout(doc),old());
  const bad=edit=>{const d=structuredClone(doc);edit(d);assert.throws(()=>validateLedger(d));};
  bad(d=>d.sessions[2].exercises[0].sets[0].measurement.actualKg=20);
  bad(d=>d.sessions[2].exercises[0].sets[0].completed=false);
  bad(d=>d.sessions[2].exercises[0].sets[0].id=d.sessions[0].exercises[0].sets[0].id);
  bad(d=>d.sessions[2].exercises[0].identity.exerciseId='missing');
  bad(d=>d.sessions[0].exercises[0].sets[0].measurement.actualKg=99);
});
test('append guard prevents losing original or newly committed sessions and configuration',()=>{
  const original=migrateLegacyWorkout(old()),next=extended();
  assert.deepEqual(validateAppend(original,next),next);
  assert.throws(()=>validateAppend(next,original),/cannot be changed or removed/);
  const changed=structuredClone(next);changed.configuration.assignments={};
  assert.throws(()=>validateAppend(next,changed),/configuration/);
  const dropped=structuredClone(next);dropped.sessions.splice(1,1);
  assert.throws(()=>validateAppend(next,dropped),/legacy history/);
});
test('legacy and new plain backups round-trip, malformed input is rejected',()=>{
  const doc=extended();assert.deepEqual(decodeLedgerBackup(encodeLedgerBackup(doc)),doc);
  assert.deepEqual(decodeLedgerBackup(JSON.stringify(old())),migrateLegacyWorkout(old()));
  assert.throws(()=>decodeLedgerBackup('{broken'),/valid JSON/);
  assert.throws(()=>decodeLedgerBackup('{"version":3}'),/Unknown/);
});
test('database API refuses non-fixture names before opening any database',async()=>{
  await assert.rejects(openLedgerPrototype('fitnesspilot.preview.v101.v1',{open:()=>assert.fail('Must not open')}),/fixture/);
});
