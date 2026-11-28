import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../preview-v101/core.js';
import {migrateLegacyWorkout} from '../preview-v101/ledger-model.js';
import {classifyMigrationFixture,inspectMigrationFixture,initializeMigrationFixture} from '../preview-v101/ledger-migration-fixture.js';
const workout=()=>({...emptyState(),templates:[{id:'plan',name:'Synthetic plan',day:0,
 exercises:[{name:'Press',muscle:'Chest',sets:1,min:8,max:12,rest:90}]}],
 logs:[{id:'original',date:'2026-01-01',templateId:'plan',exerciseIndex:0,set:1,kg:10,reps:8,rpe:null}]});
const food=()=>({version:1,entries:[{id:'synthetic-food-001',date:'2026-01-01',name:'Synthetic snack',
 occasion:'snack',servings:1,kcal:null,protein:0,carbs:null,fat:1}]});
const raw=(w=workout(),f=food())=>({workout:JSON.stringify(w),food:JSON.stringify(f)});
test('migration alignment compares both original sources, not current session counts',()=>{
 const w=workout(),f=food(),document=migrateLegacyWorkout(w);
 document.sessions.push({id:'actual',date:'2026-01-01',name:'Independent',origin:'actual',planId:null,
   exercises:[{id:'occ',identity:{kind:'plan',templateId:'plan',exerciseIndex:0},plannedIndex:null,loadUnit:'unknown',repUnit:'reps',
     sets:[{id:'extra',number:1,completed:true,kind:'working',measurement:{actualKg:null,actualReps:8,rpe:null,loadEvidence:'unknown',repsEvidence:'recorded'}}]}]});
 const snapshot={revision:2,document,food:f};
 assert.equal(classifyMigrationFixture(null,raw()).status,'ready');
 assert.deepEqual(classifyMigrationFixture(snapshot,raw()),{status:'aligned',revision:2,changed:[]});
 w.logs[0].kg=11;f.entries[0].servings=2;
 assert.deepEqual(classifyMigrationFixture(snapshot,raw(w,f)).changed,['workout','food']);
 assert.deepEqual(classifyMigrationFixture(snapshot,{...raw(),food:null}).unavailable,['food']);
 assert.deepEqual(classifyMigrationFixture(null,{workout:'{bad',food:'{}'}).unavailable,['workout','food']);
});
test('migration APIs reject unrelated databases before accessing source storage',async()=>{
 const storage={getItem:()=>assert.fail('Must not read')},db={name:'fitnesspilot-preview-ledger-indexed-fixture-review-ui'};
 await assert.rejects(inspectMigrationFixture(db,storage),/Dedicated migration fixture/);
 await assert.rejects(initializeMigrationFixture(db,storage,{}, {confirmed:true}),/Dedicated migration fixture/);
});
