import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {emptyState} from '../preview-v101/core.js';
import {encryptBoth,decryptBoth} from '../preview-v101/encrypted-backup-core.js';
import {migrateLegacyWorkout,recoverLegacyWorkout} from '../preview-v101/ledger-model.js';
import {encodeRecoveryBackup,decodeRecoveryBackup,RECOVERY_FORMAT} from '../preview-v101/ledger-recovery.js';
const secret='Synthetic recovery passphrase only';
const fixture=()=>({workout:{...emptyState(),templates:[{id:'test',name:'Synthetic plan',day:0,
  exercises:[{name:'Press',muscle:'Chest',sets:1,min:8,max:12,rest:90}]}],
  logs:[{id:'original',date:'2026-01-01',templateId:'test',exerciseIndex:0,set:1,kg:'10',reps:8,rpe:null}]},
  food:{version:1,entries:[{id:'synthetic-food-001',date:'2026-01-01',name:'Synthetic snack',occasion:'snack',
    servings:1,kcal:null,protein:0,carbs:null,fat:1}]}});
const candidate=()=>{
  const f=fixture(),document=migrateLegacyWorkout(f.workout);
  document.catalog.push({id:'movement',name:'Synthetic pull',muscle:null});
  document.sessions.push({id:'new',date:'2026-01-01',name:'New session',origin:'actual',planId:null,
    exercises:[{id:'occ',identity:{kind:'catalog',exerciseId:'movement'},plannedIndex:null,loadUnit:'unknown',
      repUnit:'reps_per_side',sets:[{id:'set',number:1,completed:true,kind:'working',
        measurement:{actualKg:null,actualReps:8,rpe:null,loadEvidence:'unknown',repsEvidence:'recorded'}}]}]});
  return {document,food:f.food};
};
test('legacy encrypted both-store backup opens without changing original data or food',async()=>{
  const old=fixture(),file=await encryptBoth(old,secret,webcrypto);
  const migrated=await decodeRecoveryBackup(file,secret,webcrypto);
  assert.deepEqual(recoverLegacyWorkout(migrated.document),old.workout);
  assert.deepEqual(migrated.food,(await decryptBoth(file,secret,webcrypto)).food);
});
test('encrypted candidate round-trip retains independent sessions, unknowns and food',async()=>{
  const data=candidate(),file=await encodeRecoveryBackup(data,secret,webcrypto);
  assert.equal(JSON.parse(file).format,RECOVERY_FORMAT);
  assert.doesNotMatch(file,/Synthetic|actualKg|New session/);
  const decoded=await decodeRecoveryBackup(file,secret,webcrypto);
  assert.deepEqual(decoded.document,data.document);
  assert.equal(decoded.food.entries[0].kcal,null);
  assert.equal(decoded.food.entries[0].protein,0);
  assert.deepEqual(recoverLegacyWorkout(decoded.document),fixture().workout);
  const another=JSON.parse(await encodeRecoveryBackup(data,secret,webcrypto)),first=JSON.parse(file);
  assert.notEqual(first.salt,another.salt);assert.notEqual(first.iv,another.iv);
});
test('wrong passphrase, tampering, malformed encoding and downgraded envelope reject',async()=>{
  const file=await encodeRecoveryBackup(candidate(),secret,webcrypto),outer=JSON.parse(file);
  await assert.rejects(decodeRecoveryBackup(file,'incorrect long passphrase',webcrypto),/Wrong passphrase/);
  const tampered={...outer,data:(outer.data[0]==='A'?'B':'A')+outer.data.slice(1)};
  await assert.rejects(decodeRecoveryBackup(JSON.stringify(tampered),secret,webcrypto),/corrupted/);
  await assert.rejects(decodeRecoveryBackup(JSON.stringify({...outer,iterations:1}),secret,webcrypto),/Unknown/);
  await assert.rejects(decodeRecoveryBackup(JSON.stringify({...outer,salt:'?'}),secret,webcrypto),/encoding/);
  await assert.rejects(decryptBoth(file,secret,webcrypto),/Unknown/);
  const data=candidate();data.food.entries[0].servings=-1;
  await assert.rejects(encodeRecoveryBackup(data,secret,webcrypto),/Servings/);
});
