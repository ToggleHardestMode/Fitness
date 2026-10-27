import test from 'node:test';
import assert from 'node:assert/strict';
import {SG_FOODS,lookupSgFoods,draftFromSgFood} from '../preview-v101/sg-food-lookup.js';
import {EMPTY_DIARY,saveEntry,totalsForDate,emptyOnlyRestore} from '../preview-v101/food-diary-core.js';
const food=(draft,id,servings=1)=>({...draft,id,date:'2026-10-26',servings});

test('search Singapore names and aliases',()=>{
 assert.equal(SG_FOODS.length,86);
 assert.ok(lookupSgFoods('cai png').some(x=>x.name.includes('Cai png')));
 assert.ok(lookupSgFoods('菜饭').some(x=>x.name.includes('Cai png')));
 assert.ok(lookupSgFoods('kopi peng siu dai').some(x=>x.name==='Kopi peng siu dai'));
});
test('never fabricate nutrition for hawker dishes',()=>{
 assert.ok(SG_FOODS.filter(x=>x.id.startsWith('sg-')).every(x=>['kcal','protein','carbs','fat'].every(k=>x[k]===null)));
});
test('USDA ingredient values are per 100 grams with source',()=>{
 const rice=draftFromSgFood(lookupSgFoods('rice 100g')[0]);
 assert.match(rice.name,/USDA FDC 169757/);
 const doc=saveEntry(EMPTY_DIARY(),food(rice,'test0001',2));
 assert.equal(totalsForDate(doc,'2026-10-26').nutrients.kcal.value,260);
 assert.deepEqual(emptyOnlyRestore(EMPTY_DIARY(),JSON.parse(JSON.stringify(doc))),doc);
});
test('missing SG dish macros stay unknown',()=>{
 const draft=draftFromSgFood(lookupSgFoods('cai png')[0]);
 const doc=saveEntry(EMPTY_DIARY(),food(draft,'test0001'));
 assert.equal(totalsForDate(doc,'2026-10-26').nutrients.kcal.unknown,1);
});
test('unknown catalogue key does not generate an entry',()=>{
 assert.throws(()=>draftFromSgFood({id:'invalid'}),/Unknown food reference/);
 assert.deepEqual(lookupSgFoods('no_such_food_name_123'),[]);
});
