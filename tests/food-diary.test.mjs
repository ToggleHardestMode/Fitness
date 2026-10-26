import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_DIARY,validateDiary,saveEntry,deleteEntry,totalsForDate,emptyOnlyRestore} from '../preview-v101/food-diary-core.js';
const item=(over={})=>({id:'fixture-001',date:'2026-10-26',name:'Synthetic meal',occasion:'meal',servings:2,kcal:250,protein:20,carbs:30,fat:5,...over});
test('selected servings derive calories/protein/carbs/fat independently',()=>{
 const r=totalsForDate(saveEntry(EMPTY_DIARY(),item()),'2026-10-26');
 assert.deepEqual(Object.fromEntries(Object.entries(r.nutrients).map(([k,v])=>[k,v.value])),{kcal:500,protein:40,carbs:60,fat:10});
});
test('null means unknown; numeric zero remains recorded; dates do not leak',()=>{
 let d=saveEntry(EMPTY_DIARY(),item({carbs:null}));
 d=saveEntry(d,item({id:'fixture-002',servings:1,kcal:0,protein:0,carbs:0,fat:0}));
 assert.equal(totalsForDate(d,'2026-10-26').nutrients.carbs.unknown,1);
 assert.equal(totalsForDate(d,'2026-10-26').nutrients.kcal.value,500);
 assert.equal(totalsForDate(d,'2026-10-27').count,0);
});
test('edit replaces same ID; delete leaves other entries',()=>{
 let d=saveEntry(EMPTY_DIARY(),item());
 d=saveEntry(d,item({servings:1}));
 assert.equal(d.entries.length,1);
 assert.equal(totalsForDate(d,'2026-10-26').nutrients.protein.value,20);
 assert.deepEqual(deleteEntry(d,'fixture-001'),EMPTY_DIARY());
});
test('malformed dates, duplicate IDs and negative nutrients rejected',()=>{
 assert.throws(()=>validateDiary({version:1,entries:[item(),item()]}),/Duplicate/);
 assert.throws(()=>validateDiary({version:1,entries:[item({date:'2026-02-30'})]}),/date/);
 assert.throws(()=>saveEntry(EMPTY_DIARY(),item({protein:-4})),/protein/);
 assert.throws(()=>emptyOnlyRestore(saveEntry(EMPTY_DIARY(),item()),EMPTY_DIARY()),/empty diary/);
});
test('JSON export-to-import round trip accepts only empty destination',()=>{
 const backup=saveEntry(EMPTY_DIARY(),item());
 assert.deepEqual(emptyOnlyRestore(EMPTY_DIARY(),JSON.parse(JSON.stringify(backup))),backup);
});
