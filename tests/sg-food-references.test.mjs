import test from 'node:test';
import assert from 'node:assert/strict';
import {SG_MACRO_REFERENCES,SG_REFERENCE_SOURCES} from '../preview-v101/sg-food-references.js';
import {SG_FOODS,lookupSgFoods,draftFromSgFood} from '../preview-v101/sg-food-lookup.js';
import {EMPTY_DIARY,saveEntry,totalsForDate,emptyOnlyRestore} from '../preview-v101/food-diary-core.js';

test('40 attributed reference portions, 4 original source groups',()=>{
 assert.equal(SG_MACRO_REFERENCES.length,40);
 assert.deepEqual(Object.fromEntries(Object.keys(SG_REFERENCE_SOURCES).map(k=>[k,SG_MACRO_REFERENCES.filter(x=>x.sourceKey===k).length])),{NUP:10,YEO21:21,SINGHEALTH:4,HPB2016:5});
 assert.equal(new Set(SG_MACRO_REFERENCES.map(x=>x.id)).size,40);
});
test('same dish shows different source-specific portions rather than merging',()=>{
 const choices=lookupSgFoods('chicken rice');
 assert.ok(choices.some(x=>x.kcal===635&&x.sourceKey==='NUP'&&x.portion==='1 plate'));
 assert.ok(choices.some(x=>x.kcal===778&&x.sourceKey==='YEO21'&&x.portion.includes('412 g')));
 assert.ok(choices.some(x=>x.kcal===null));
});
test('actual four-macro reference remains per listed serving and survives existing backup',()=>{
 const selected=lookupSgFoods('laksa').find(x=>x.sourceKey==='YEO21');
 const draft=draftFromSgFood(selected);
 assert.deepEqual([draft.kcal,draft.protein,draft.carbs,draft.fat],[881,46,106,30]);
 assert.match(draft.name,/YEO21/);
 const saved=saveEntry(EMPTY_DIARY(),{...draft,id:'reference-001',date:'2026-10-26',servings:0.5});
 const sums=totalsForDate(saved,'2026-10-26');
 assert.deepEqual(['kcal','protein','carbs','fat'].map(k=>sums.nutrients[k].value),[440.5,23,53,15]);
 assert.deepEqual(emptyOnlyRestore(EMPTY_DIARY(),JSON.parse(JSON.stringify(saved))),saved);
});
test('unknown cai png and kopi are not converted to zero',()=>{
 for(const q of ['cai png','kopi peng siu dai']){
   const food=lookupSgFoods(q)[0];
   assert.equal(food.kcal,null);
   assert.equal(draftFromSgFood(food).protein,null);
 }
});
test('malicious object with reused reference ID cannot supply invented values',()=>{
 const record=SG_MACRO_REFERENCES.find(r=>r.sourceKey==='NUP');
 const forged={...record,kcal:9999,protein:9999,name:'altered'};
 const draft=draftFromSgFood(forged);
 assert.equal(draft.kcal,record.kcal);
 assert.equal(draft.name.includes('altered'),false);
});
test('entry name and source links distinguish source and portion with existing v1 schema',()=>{
 for(const item of SG_MACRO_REFERENCES){
   const draft=draftFromSgFood(item);
   assert.ok(draft.name.length<=80);
   assert.ok(draft.name.includes('['+item.sourceKey+','));
   assert.ok(draft.label.includes(item.portion));
   assert.match(draft.url,/^https:/);
 }
});
