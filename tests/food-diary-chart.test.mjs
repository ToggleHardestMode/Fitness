import test from 'node:test';
import assert from 'node:assert/strict';
const modulePath = ['..','preview-v101','food-diary-chart.js'].join('/');
const {diaryCalorieHistory,foodDiaryChartMarkup,readFoodDiaryChart}=await import(modulePath);
const entry=(id,calories,date='2026-10-26')=>({id,date,name:'Synthetic',occasion:'meal',servings:2,kcal:calories,protein:null,carbs:null,fat:null});
const record=entries=>({version:1,entries});

test('28-day view includes complete month boundary',()=>{
 const r=diaryCalorieHistory(record([]),'2026-11-02');
 assert.equal(r.entries.length,28);
 assert.equal(r.entries[0].date,'2026-10-06');
 assert.equal(r.entries.at(-1).date,'2026-11-02');
});

test('recorded calories are derived once from food servings',()=>{
 const r=diaryCalorieHistory(record([entry('sample0001',742.5)]),'2026-10-26');
 assert.equal(r.entries.at(-1).kcal,1485);
 assert.match(foodDiaryChartMarkup(r),/1,485 kcal/);
});

test('unknown amount remains separate from measured zero',()=>{
 const r=diaryCalorieHistory(record([entry('sample0001',0),entry('sample0002',null)]),'2026-10-26');
 assert.equal(r.entries.at(-1).known,1);
 assert.equal(r.entries.at(-1).unknown,1);
 assert.equal(r.entries.at(-1).kcal,0);
 assert.equal(r.entries.at(-2).foods,0);
});

test('corrupted diary shows a nonmutating error',()=>{
 let writes=0;
 const html=readFoodDiaryChart({getItem:()=>'{bad',setItem:()=>{writes+=1}},'2026-10-26');
 assert.match(html,/could not be read/);
 assert.equal(writes,0);
});
