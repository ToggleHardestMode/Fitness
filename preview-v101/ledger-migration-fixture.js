// Rehearsal only. Never access the real legacy storage keys or activate a new writer.
import {migrateLegacyWorkout,legacyHasDiverged} from './ledger-model.js';
import {validateDiary} from './food-diary-core.js';
import {readIndexedFixture,initializeIndexedFixture} from './ledger-indexed-prototype.js';
export const MIGRATION_FIXTURE_KEYS=Object.freeze({
  workout:'fitnesspilot-ledger-migration-fixture-workout',
  food:'fitnesspilot-ledger-migration-fixture-food'
});
function requireFixture(db){
  if(!/^fitnesspilot-preview-ledger-indexed-fixture-migration-[a-zA-Z0-9-]{1,50}$/.test(db?.name??''))
    throw Error('Dedicated migration fixture required.');
}
function readSource(storage){
  const raw={};
  for(const [kind,key] of Object.entries(MIGRATION_FIXTURE_KEYS)){
    try{raw[kind]=storage.getItem(key);}catch{raw[kind]=null;}
  }
  return raw;
}
function decode(raw){
  const result={},unavailable=[];
  for(const kind of ['workout','food']){
    try{
      if(typeof raw?.[kind]!=='string'||!raw[kind].length)throw Error('Missing source');
      const parsed=JSON.parse(raw[kind]);
      result[kind]=kind==='workout'?migrateLegacyWorkout(parsed):validateDiary(parsed);
    }catch{unavailable.push(kind);}
  }
  return {result,unavailable};
}
// Alignment means agreement with the original legacy baseline, not permission to activate.
// The food comparison uses the existing normalized v1 diary contract.
export function classifyMigrationFixture(snapshot,raw){
  const {result,unavailable}=decode(raw),revision=snapshot?.revision??null;
  if(unavailable.length)return {status:'source-unavailable',revision,unavailable};
  if(!snapshot)return {status:'ready',revision};
  const changed=[];
  if(legacyHasDiverged(snapshot.document,JSON.parse(raw.workout)))changed.push('workout');
  if(JSON.stringify(validateDiary(snapshot.food))!==JSON.stringify(result.food))changed.push('food');
  return {status:changed.length?'diverged':'aligned',revision,changed};
}
export async function inspectMigrationFixture(db,storage){
  requireFixture(db);
  const snapshot=await readIndexedFixture(db),raw=readSource(storage);
  const report=classifyMigrationFixture(snapshot,raw);
  return report.status==='ready'?{...report,review:raw}:report;
}
export async function initializeMigrationFixture(db,storage,review,{confirmed=false,abortAfterPut=false}={}){
  requireFixture(db);
  if(confirmed!==true)throw Error('Explicit migration rehearsal confirmation required.');
  const approved=structuredClone(review);
  const snapshot=await readIndexedFixture(db),raw=readSource(storage);
  if(typeof approved?.workout!=='string'||typeof approved?.food!=='string'||
    approved.workout!==raw.workout||approved.food!==raw.food)
    throw Error('Legacy fixture changed since review; inspect again.');
  const report=classifyMigrationFixture(snapshot,raw);
  if(report.status==='aligned')return {...report,committed:false};
  if(report.status!=='ready')throw Error('Migration fixture is not ready: '+report.status+'.');
  const {result}=decode(raw);
  // Initialization is one IDB transaction, empty-only. The source is never written.
  await initializeIndexedFixture(db,{document:result.workout,food:result.food},{abortAfterPut});
  // localStorage and IndexedDB cannot share a transaction. Detect changes after commit,
  // retain both copies, and never silently reimport or claim that a source is locked.
  const after=await inspectMigrationFixture(db,storage);
  return {...after,committed:true};
}
