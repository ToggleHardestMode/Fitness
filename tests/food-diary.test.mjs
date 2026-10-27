import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_DIARY,validateDiary,saveEntry,deleteEntry,totalsForDate,emptyOnlyRestore,recentFoods,repeatEntryToDate} from '../preview-v101/food-diary-core.js';
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

test('recent saved foods from prior days are ordered, deduplicated and never include future dates',()=>{
 let d=EMPTY_DIARY();
 d=saveEntry(d,item({id:'earlier-001',date:'2026-10-20',name:'Chicken rice',kcal:600}));
 d=saveEntry(d,item({id:'earlier-002',date:'2026-10-21',name:'Chicken rice',kcal:600}));
 d=saveEntry(d,item({id:'earlier-003',date:'2026-10-22',name:'Yogurt',kcal:140,protein:12}));
 d=saveEntry(d,item({id:'future-004',date:'2026-10-28',name:'Future rice'}));
 assert.deepEqual(recentFoods(d,'2026-10-26').map(x=>x.id),['earlier-003','earlier-002']);
 assert.equal(recentFoods(d,'2026-10-20').length,0);
 assert.throws(()=>recentFoods(d,'2026-10-26',0),/limit/);
});
test('repeat copies snapshot onto selected date without changing old meal or workout data',()=>{
 const original=saveEntry(EMPTY_DIARY(),item({date:'2026-10-23',protein:null}));
 const repeated=repeatEntryToDate(original,'fixture-001','2026-10-26','copied-001');
 assert.equal(original.entries.length,1);
 assert.equal(repeated.entries.length,2);
 assert.equal(repeated.entries[1].date,'2026-10-26');
 assert.equal(repeated.entries[1].protein,null);
 assert.equal(totalsForDate(repeated,'2026-10-26').nutrients.kcal.value,500);
 assert.deepEqual(original,saveEntry(EMPTY_DIARY(),item({date:'2026-10-23',protein:null})));
 assert.throws(()=>repeatEntryToDate(repeated,'fixture-001','2026-10-27','copied-001'),/already exists/);
 assert.throws(()=>repeatEntryToDate(original,'missing-source','2026-10-27','newmeal-001'),/unavailable/);
 assert.deepEqual(emptyOnlyRestore(EMPTY_DIARY(),JSON.parse(JSON.stringify(repeated))),repeated);
});
