import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMPTY_DIARY,saveEntry,validateDiary,totalsForDate} from '../preview-v101/food-diary-core.js';
import {FOOD_CSV_COLUMNS,blankDailyFoodCsv,previewDailyFoodCsv,applyDailyFoodCsv} from '../preview-v101/food-diary-csv.js';

const date='2026-11-09';
const header=FOOD_CSV_COLUMNS.join(',');
const food=(rows)=>header+'\n'+rows.join('\n')+'\n';
const sample=food([
  '2026-11-09,"Chicken rice, small",meal,1,550,30,60,18',
  '2026-11-09,Kopi,drink,2,90,,12,'
]);
const old=()=>saveEntry(EMPTY_DIARY(),{
  id:'historical-001',date:'2026-11-08',name:'Synthetic snack',occasion:'snack',
  servings:1,kcal:150,protein:5,carbs:null,fat:8
});

test('preview parses one day, quoted names, servings and unknown-vs-zero macros',()=>{
  const p=previewDailyFoodCsv(old(),sample,date);
  assert.equal(p.date,date);assert.equal(p.add.length,2);assert.equal(p.skipped.length,0);
  assert.equal(p.add[0].name,'Chicken rice, small');
  assert.equal(p.add[1].protein,null);assert.equal(p.add[1].fat,null);
  assert.equal(p.add[1].kcal,90);assert.equal(p.add[1].servings,2);
  const zero=previewDailyFoodCsv(EMPTY_DIARY(),food(['2026-11-09,Water,drink,1,0,0,0,0']),date);
  assert.deepEqual(['kcal','protein','carbs','fat'].map(k=>zero.add[0][k]),[0,0,0,0]);
});

test('read-only preview and default apply do not alter existing diary',()=>{
  const before=old(),snapshot=structuredClone(before),p=previewDailyFoodCsv(before,sample,date);
  const result=applyDailyFoodCsv(before,p);
  assert.deepEqual(result,{applied:false,added:2,skipped:0});
  assert.deepEqual(before,snapshot);
  assert.throws(()=>applyDailyFoodCsv(before,p,{apply:true}),/Explicit daily food import/);
  assert.deepEqual(before,snapshot);
});

test('explicit apply appends entries, preserving older dates and unknown macro semantics',()=>{
  const before=old(),p=previewDailyFoodCsv(before,sample,date);
  const r=applyDailyFoodCsv(before,p,{apply:true,confirmed:true});
  assert.equal(r.applied,true);assert.equal(r.added,2);
  assert.equal(r.diary.entries.length,3);assert.deepEqual(before,old());
  assert.deepEqual(totalsForDate(r.diary,'2026-11-08').rows,old().entries);
  const today=totalsForDate(r.diary,date);
  assert.equal(today.nutrients.kcal.value,730);
  assert.equal(today.nutrients.kcal.unknown,0);
  assert.equal(today.nutrients.protein.value,30);
  assert.equal(today.nutrients.protein.unknown,1);
  assert.deepEqual(validateDiary(r.diary),r.diary);
});

test('idempotent reimport skips identical CSV and leaves state untouched',()=>{
  const first=applyDailyFoodCsv(old(),previewDailyFoodCsv(old(),sample,date),{apply:true,confirmed:true}).diary;
  const p=previewDailyFoodCsv(first,sample,date);
  assert.equal(p.add.length,0);assert.equal(p.skipped.length,2);
  assert.deepEqual(applyDailyFoodCsv(first,p,{apply:true,confirmed:true}),{applied:false,added:0,skipped:2});
  assert.equal(first.entries.length,3);
});

test('reordering unique rows preserves import IDs and does not duplicate meals',()=>{
  const source=sample,reverse=food(sample.trim().split('\n').slice(1).reverse());
  const a=previewDailyFoodCsv(EMPTY_DIARY(),source,date).add.map(x=>x.id).sort();
  const b=previewDailyFoodCsv(EMPTY_DIARY(),reverse,date).add.map(x=>x.id).sort();
  assert.deepEqual(a,b);
});

test('two identical same-day rows intentionally represent two separate servings',()=>{
  const csv=food([
    '2026-11-09,Water,drink,1,0,0,0,0',
    '2026-11-09,Water,drink,1,0,0,0,0'
  ]);
  const p=previewDailyFoodCsv(EMPTY_DIARY(),csv,date);
  assert.equal(p.add.length,2);assert.notEqual(p.add[0].id,p.add[1].id);
  const next=applyDailyFoodCsv(EMPTY_DIARY(),p,{apply:true,confirmed:true}).diary;
  assert.equal(previewDailyFoodCsv(next,csv,date).skipped.length,2);
});

test('ambiguous same-name same-day manual food is blocked, not silently double logged',()=>{
  const doc=saveEntry(EMPTY_DIARY(),{
    id:'manually-001',date,name:'Chicken rice, small',occasion:'meal',
    servings:1,kcal:550,protein:30,carbs:60,fat:18
  });
  const before=structuredClone(doc);
  assert.throws(()=>previewDailyFoodCsv(doc,sample,date),/already exists on this day/);
  assert.deepEqual(doc,before);
});

test('mixed dates, corrupt numeric values, bad CSV and formulas reject without writing',()=>{
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),food(['2026-11-10,Meal,meal,1,100,1,1,1']),date),/must match selected day/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),food(['2026-11-09,Meal,meal,0,100,1,1,1']),date),/Servings/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),food(['2026-11-09,Meal,meal,1,=SUM(A1),1,1,1']),date),/nonnegative decimal/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),food(['2026-11-09,Meal,meal,1,-100,1,1,1']),date),/nonnegative decimal/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),header+'\n"unfinished',date),/unfinished quote/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),'date,name,occasion\n2026-11-09,X,meal',date),/columns/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),sample,'2026-02-30'),/valid daily import date/);
});

test('stale or malicious apply ID conflicts fail and 3000-entry cap holds',()=>{
  const p=previewDailyFoodCsv(EMPTY_DIARY(),sample,date);
  const sameId=saveEntry(EMPTY_DIARY(),{...p.add[0],kcal:999});
  assert.throws(()=>applyDailyFoodCsv(sameId,p,{apply:true,confirmed:true}),/changed since preview/);
  const forged=structuredClone(p);forged.add[0].date='2026-11-08';
  assert.throws(()=>applyDailyFoodCsv(EMPTY_DIARY(),forged,{apply:true,confirmed:true}),/changed since preview/);
});

test('blank template is valid CSV skeleton but is not mistaken for a logged meal',()=>{
  const blank=blankDailyFoodCsv(date);
  assert.match(blank,/date,name,occasion,servings,kcal,protein,carbs,fat/);
  assert.match(blank,/2026-11-09/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),blank,date),/servings must be a positive decimal/);
  assert.throws(()=>previewDailyFoodCsv(EMPTY_DIARY(),
    food(['2026-11-09,,meal,1,,,,']),date),/Food name/);
});

test('Food Diary UI has explicit per-day preview, backup acknowledgement and apply gate',()=>{
  const html=readFileSync(new URL('../preview-v101/food-diary.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../preview-v101/food-diary.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../preview-v101/sw.js',import.meta.url),'utf8');
  for(const id of ['fd-csv-file','fd-csv-template','fd-csv-preview'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(js,/previewDailyFoodCsv\(diary,await file\.text\(\),selected\)/);
  assert.match(js,/applyDailyFoodCsv\(diary,preview,\{apply:true,confirmed:true\}\)/);
  assert.match(js,/backupDownloaded/);
  assert.match(js,/storage\.getItem\(FOOD_KEY\)!==pendingCsv\.snapshot/);
  assert.match(js,/if\(!confirm\(/);
  assert.match(sw,/'\.\/food-diary-csv\.js'/);
  assert.match(js,/emptyOnlyRestore\(diary/);
});
