import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {STORAGE_KEY,emptyState,validateBackup} from '../preview-v101/core.js';
import {FOOD_KEY,validateDiary} from '../preview-v101/food-diary-core.js';
import {FILE_FORMAT,readBothStores,encryptBoth,decryptBoth,restoreBothToEmpty} from '../preview-v101/encrypted-backup-core.js';

const secret='Synthetic recovery password for 2026';
const fixture=()=>({
 workout:{...emptyState(),templates:[{id:'synthetic-plan',name:'Synthetic Upper',day:0,
   exercises:[{name:'Synthetic Press',muscle:'Chest',sets:1,min:8,max:12,rest:90}]}],
   assignments:{0:'synthetic-plan'},
   logs:[{id:'synthetic-set',date:'2026-11-08',templateId:'synthetic-plan',exerciseIndex:0,
     set:1,kg:12,reps:10,rpe:7}],
   metrics:[{date:'2026-11-08',weight:80,calories:null,protein:null,sleep:null,recovery:4}]},
 food:{version:1,entries:[{id:'synthetic-food-001',date:'2026-11-08',name:'Synthetic Snack',
   occasion:'snack',servings:1,kcal:null,protein:0,carbs:null,fat:1}]}
});
class Storage{
 constructor(seed={}){this.m=new Map(Object.entries(seed));this.writes=0;this.failOn=0;}
 getItem(k){return this.m.has(k)?this.m.get(k):null;}
 setItem(k,v){if(++this.writes===this.failOn)throw Error('Synthetic quota');this.m.set(k,String(v));}
 removeItem(k){this.m.delete(k);}
}
test('B110 encryption and independent decryption recover both validated stores',async()=>{
 const original=fixture(),file=await encryptBoth(original,secret,webcrypto);
 assert.equal(JSON.parse(file).format,FILE_FORMAT);
 assert.doesNotMatch(file,/Synthetic Upper|Synthetic Snack|synthetic-set/);
 const recovered=await decryptBoth(file,secret,webcrypto);
 assert.deepEqual(recovered.workout,validateBackup(original.workout));
 assert.deepEqual(recovered.food,validateDiary(original.food));
});
test('B110 wrong passphrase and corrupted ciphertext reject before any storage write',async()=>{
 const file=await encryptBoth(fixture(),secret,webcrypto);
 await assert.rejects(decryptBoth(file,'wrong but long passphrase',webcrypto),/Wrong passphrase/);
 const body=JSON.parse(file);
 body.data=(body.data[0]==='A'?'B':'A')+body.data.slice(1);
 await assert.rejects(decryptBoth(JSON.stringify(body),secret,webcrypto),/Wrong passphrase/);
});
test('B110 malformed file, KDF options, encoding and short ciphertext reject',async()=>{
 const body=JSON.parse(await encryptBoth(fixture(),secret,webcrypto));
 await assert.rejects(decryptBoth('{oops',secret,webcrypto),/not valid JSON/);
 await assert.rejects(decryptBoth(JSON.stringify({...body,iterations:5}),secret,webcrypto),/Unknown/);
 await assert.rejects(decryptBoth(JSON.stringify({...body,salt:'?'}),secret,webcrypto),/encoding/);
 await assert.rejects(decryptBoth(JSON.stringify({...body,data:'AAAA'}),secret,webcrypto),/payload size/);
});
test('B110 identical data uses random IV and salt',async()=>{
 const a=JSON.parse(await encryptBoth(fixture(),secret,webcrypto));
 const b=JSON.parse(await encryptBoth(fixture(),secret,webcrypto));
 assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);assert.notEqual(a.data,b.data);
});
test('B110 dry-run and unconfirmed apply never change data',()=>{
 const s=new Storage(),preview=restoreBothToEmpty(s,fixture());
 assert.deepEqual(preview.counts,{templates:1,sets:1,checkins:1,foods:1});
 assert.equal(preview.applied,false);assert.equal(s.m.size,0);
 assert.throws(()=>restoreBothToEmpty(s,fixture(),{apply:true}),/Explicit RESTORE BOTH/);
 assert.equal(s.m.size,0);
});
test('B110 empty-profile restore writes both stores losslessly',async()=>{
 const data=await decryptBoth(await encryptBoth(fixture(),secret,webcrypto),secret,webcrypto);
 const s=new Storage();
 assert.equal(restoreBothToEmpty(s,data,{apply:true,confirmed:true}).applied,true);
 assert.deepEqual(JSON.parse(s.getItem(STORAGE_KEY)),data.workout);
 assert.deepEqual(JSON.parse(s.getItem(FOOD_KEY)),data.food);
 assert.throws(()=>restoreBothToEmpty(s,data,{apply:true,confirmed:true}),/clean browser profile/);
});
test('B110 existing workout or diary key blocks restore even when malformed',()=>{
 for(const seed of [{[STORAGE_KEY]:'broken'}, {[FOOD_KEY]:'broken'}]){
   const s=new Storage(seed),before=new Map(s.m);
   assert.throws(()=>restoreBothToEmpty(s,fixture(),{apply:true,confirmed:true}),/clean browser profile/);
   assert.deepEqual(s.m,before);
 }
 const broken=fixture();broken.food.entries[0].servings=-1;
 assert.throws(()=>restoreBothToEmpty(new Storage(),broken,{apply:true,confirmed:true}),/Servings/);
});
test('B110 failed second write rolls back first key',()=>{
 const s=new Storage();s.failOn=2;
 assert.throws(()=>restoreBothToEmpty(s,fixture(),{apply:true,confirmed:true}),/rolled back/);
 assert.equal(s.getItem(STORAGE_KEY),null);assert.equal(s.getItem(FOOD_KEY),null);
});
test('B110 invalid existing records prevent export without modifying them',()=>{
 const s=new Storage({[STORAGE_KEY]:'broken'});
 assert.throws(()=>readBothStores(s),/invalid/);assert.equal(s.getItem(STORAGE_KEY),'broken');
 assert.deepEqual(readBothStores(new Storage()),{workout:emptyState(),food:{version:1,entries:[]}});
});
test('B110 short passphrases are rejected',async()=>{
 await assert.rejects(encryptBoth(fixture(),'short',webcrypto),/12–256/);
 await assert.rejects(decryptBoth('{}','short',webcrypto),/12–256/);
});
