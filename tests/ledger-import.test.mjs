import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../preview-v101/core.js';
import {migrateLegacyWorkout,recoverLegacyWorkout,encodeLedgerBackup,decodeLedgerBackup,validateLedger} from '../preview-v101/ledger-model.js';
import {ledgerSourceId,previewLedgerImport} from '../preview-v101/ledger-import.js';
import {effectiveMeasurements} from '../preview-v101/ledger-import-evidence.js';
const fixture=()=>({...emptyState(),templates:[{id:'plan',name:'Synthetic workout',day:0,requiresClinicalReview:true,
  exercises:[{name:'Synthetic press',muscle:'Chest',sets:1,min:8,max:12,rest:90}]}],
  logs:[{id:'original',date:'2026-01-01',templateId:'plan',exerciseIndex:0,set:1,kg:10,reps:8,rpe:null}],
  exerciseClearances:[]});
const header='date,workout,exercise,set,kg,reps,notes';
const file=(kg='12',set=2)=>({name:'synthetic.csv',text:header+'\n2026-01-01,Synthetic workout,Synthetic press,'+set+','+kg+',8,"note, retained"\n'});
const review=async(doc,f,extra={})=>{
  const s=doc.sessions[0],e=s.exercises[0];
  return {sourceId:await ledgerSourceId(f.text),row:2,sessionId:s.id,occurrenceId:e.id,setId:'new-set',
    completed:true,loadEvidence:'recorded',repsEvidence:'recorded',...extra};
};
test('historical rows are unresolved without decisions; explicit extra set preserves original and source',async()=>{
  const old=fixture(),doc=migrateLegacyWorkout(old),f=file();
  const pending=await previewLedgerImport(doc,[f]);assert.equal(pending.unresolved.length,1);assert.equal(pending.document,null);
  const result=await previewLedgerImport(doc,[f],[await review(doc,f)]);
  assert.equal(result.counts.added,1);assert.equal(result.document.sessions[0].exercises[0].sets.length,2);
  assert.deepEqual(recoverLegacyWorkout(result.document),old);assert.equal(result.document.imports[0].text,f.text);
  assert.deepEqual(decodeLedgerBackup(encodeLedgerBackup(result.document)),result.document);
  const repeat=await previewLedgerImport(result.document,[{...f,name:'renamed.csv'}]);
  assert.equal(repeat.changed,false);assert.equal(repeat.counts.duplicates,1);
});
test('conflicting evidence needs explicit reason, correction preserves original set and round-trips',async()=>{
  const old=fixture(),doc=migrateLegacyWorkout(old),f=file('12',1),id=doc.sessions[0].exercises[0].sets[0].id;
  const d=await review(doc,f,{setId:id});
  assert.equal((await previewLedgerImport(doc,[f],[d])).unresolved.length,1);
  const r=await previewLedgerImport(doc,[f],[{...d,action:'correct',reason:'Reviewed synthetic observation'}]);
  assert.equal(r.counts.corrected,1);assert.equal(effectiveMeasurements(r.document).get(id).actualKg,12);
  assert.deepEqual(recoverLegacyWorkout(r.document),old);
  assert.equal(r.document.sessions[0].exercises[0].sets[0].measurement.actualKg,10);
  const bad=structuredClone(r.document);bad.imports[0].rows[0].before.actualKg=99;
  assert.throws(()=>validateLedger(bad),/correction/);
});
test('planned load remains unknown; changed file with same set and evidence becomes semantic duplicate',async()=>{
  const doc=migrateLegacyWorkout(fixture()),f=file('18'),choice=await review(doc,f,{loadEvidence:'planned'});
  const r=await previewLedgerImport(doc,[f],[choice]);assert.equal(r.document.sessions[0].exercises[0].sets[1].measurement.actualKg,null);
  const changed={...f,text:f.text.replace('note, retained','changed note')};
  const dup=await previewLedgerImport(r.document,[changed],[await review(doc,changed,{loadEvidence:'planned'})]);
  assert.equal(dup.counts.duplicates,1);assert.equal(dup.document.sessions[0].exercises[0].sets.length,2);
});
test('explicit independent same-day substitution; no name matching or transferred clearance',async()=>{
  const doc=migrateLegacyWorkout(fixture()),f=file();
  const d=await review(doc,f,{sessionId:'new-session',occurrenceId:'new-occ',setId:'new-set',newSession:true,
    identity:{kind:'catalog',exerciseId:'other'},newExercise:{id:'other',name:'Synthetic press',muscle:null},
    loadUnit:'kg_per_dumbbell',repUnit:'reps_per_side'});
  const r=await previewLedgerImport(doc,[f],[d]);assert.equal(r.document.sessions.length,2);
  assert.deepEqual(r.document.configuration,doc.configuration);
  assert.deepEqual(r.document.sessions[1].exercises[0].identity,d.identity);
});

test('matching legacy measurement is a duplicate; audit identity tampering is rejected',async()=>{
  const doc=migrateLegacyWorkout(fixture()),f=file('10',1),id=doc.sessions[0].exercises[0].sets[0].id;
  const result=await previewLedgerImport(doc,[f],[await review(doc,f,{setId:id})]);
  assert.equal(result.counts.duplicates,1);assert.equal(result.counts.corrected,0);
  const changed=structuredClone(result.document);changed.imports[0].rows[0].occurrenceId='wrong';
  assert.throws(()=>validateLedger(changed),/target/);
  const forged=structuredClone(result.document);forged.imports[0].id='sha256:'+'0'.repeat(64);
  await assert.rejects(previewLedgerImport(forged,[f]),/fingerprint mismatch/);
});

test('multi-file batch is all-or-nothing and stable identified CSV can be reviewed without manual row mapping',async()=>{
  const old=migrateLegacyWorkout(fixture()),f=file(),g=file('',3);
  const d=await review(old,f),d2=await review(old,g,{setId:'third-set',loadEvidence:'unknown'});
  const unresolved=await previewLedgerImport(old,[f,g],[d]);
  assert.equal(unresolved.document,null);assert.equal(unresolved.unresolved.length,1);
  const batch=await previewLedgerImport(old,[f,g],[d,d2]);
  assert.equal(batch.counts.added,2);assert.equal(batch.document.imports.length,2);
  assert.equal(batch.document.sessions[0].exercises[0].sets[2].measurement.actualKg,null);
  const identified=structuredClone(batch.document);
  identified.catalog.push({id:'catalog-ex',name:'Synthetic pull',muscle:null});
  const csv={name:'identified.csv',text:
    'date,workout,exercise,set,kg,reps,session_id,occurrence_id,set_id,exercise_id,completed,load_basis,rep_basis,load_evidence,reps_evidence\n'+
    '2026-01-01,Independent,Synthetic pull,1,12,8,session-2,occ-2,set-2,catalog-ex,true,kg_total,reps,recorded,recorded\n'};
  const result=await previewLedgerImport(identified,[csv]);
  assert.equal(result.counts.added,1);assert.equal(result.document.sessions.length,2);
  assert.deepEqual(recoverLegacyWorkout(result.document),fixture());
});
