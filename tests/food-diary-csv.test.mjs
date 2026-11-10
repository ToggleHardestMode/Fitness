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


test('reuploading a revised CSV shows one reviewed correction, unchanged meal, and new meal',()=>{
  const prior=applyDailyFoodCsv(old(),previewDailyFoodCsv(old(),sample,date),
    {apply:true,confirmed:true}).diary;
  const oldMeal=prior.entries.find(e=>e.name==='Chicken rice, small');
  const revised=food([
    '2026-11-09,"Chicken rice, small",meal,1.5,600,32,65,19',
    '2026-11-09,Kopi,drink,2,90,,12,',
    '2026-11-09,Prata,meal,1,300,7,40,12'
  ]);
  const p=previewDailyFoodCsv(prior,revised,date);
  assert.deepEqual([p.add.length,p.skipped.length,p.updates.length],[1,1,1]);
  assert.equal(p.updates[0].before.id,oldMeal.id);
  assert.equal(p.updates[0].after.id,oldMeal.id);
  assert.equal(p.updates[0].before.kcal,550);
  assert.equal(p.updates[0].after.kcal,600);
  assert.equal(p.updates[0].after.servings,1.5);
  assert.deepEqual(applyDailyFoodCsv(prior,p),{applied:false,added:1,skipped:1,updated:1});
  assert.deepEqual(prior.entries.find(e=>e.id===oldMeal.id),oldMeal);
  const out=applyDailyFoodCsv(prior,p,{apply:true,confirmed:true});
  assert.deepEqual([out.added,out.updated,out.skipped],[1,1,1]);
  assert.equal(out.diary.entries.length,4);
  assert.equal(out.diary.entries.find(e=>e.id===oldMeal.id).servings,1.5);
  assert.deepEqual(totalsForDate(out.diary,'2026-11-08').rows,old().entries);
  assert.equal(totalsForDate(out.diary,date).nutrients.kcal.value,1380);
  const again=previewDailyFoodCsv(out.diary,revised,date);
  assert.deepEqual([again.add.length,again.updates.length,again.skipped.length],[0,0,3]);
  assert.deepEqual(applyDailyFoodCsv(out.diary,again,{apply:true,confirmed:true}),
    {applied:false,added:0,skipped:3});
});

test('corrections preserve ID, support blank to zero, and do not delete omitted meals',()=>{
  const first=applyDailyFoodCsv(EMPTY_DIARY(),
    previewDailyFoodCsv(EMPTY_DIARY(),sample,date),{apply:true,confirmed:true}).diary;
  const oldId=first.entries.find(e=>e.name==='Kopi').id;
  const correction=food(['2026-11-09,Kopi,drink,1,0,0,,0']);
  const preview=previewDailyFoodCsv(first,correction,date);
  assert.equal(preview.updates.length,1);
  assert.equal(preview.add.length,0);
  assert.equal(preview.skipped.length,0);
  assert.equal(preview.updates[0].after.id,oldId);
  assert.equal(preview.updates[0].after.carbs,null);
  const out=applyDailyFoodCsv(first,preview,{apply:true,confirmed:true});
  assert.equal(out.added,0);assert.equal(out.updated,1);
  assert.equal(out.diary.entries.length,2);
  assert.equal(out.diary.entries.find(e=>e.id===oldId).kcal,0);
  assert.equal(totalsForDate(out.diary,date).nutrients.carbs.unknown,1);
  assert.equal(totalsForDate(out.diary,date).nutrients.kcal.value,550);
  const second=previewDailyFoodCsv(out.diary,correction,date);
  assert.deepEqual([second.skipped.length,second.updates.length],[1,0]);
});

test('reupload adds extra duplicate food when the original CSV row is unchanged',()=>{
  const single=food(['2026-11-09,Water,drink,1,0,0,0,0']);
  const first=applyDailyFoodCsv(EMPTY_DIARY(),
    previewDailyFoodCsv(EMPTY_DIARY(),single,date),{apply:true,confirmed:true}).diary;
  const twice=food([
    '2026-11-09,Water,drink,1,0,0,0,0',
    '2026-11-09,Water,drink,1,0,0,0,0'
  ]);
  const p=previewDailyFoodCsv(first,twice,date);
  assert.deepEqual([p.add.length,p.skipped.length,p.updates.length],[1,1,0]);
  const result=applyDailyFoodCsv(first,p,{apply:true,confirmed:true});
  assert.equal(result.diary.entries.length,2);
  assert.equal(previewDailyFoodCsv(result.diary,twice,date).skipped.length,2);
});

test('ambiguous repeated CSV-owned names reject instead of guessing which record to change',()=>{
  const double=food([
    '2026-11-09,Water,drink,1,0,0,0,0',
    '2026-11-09,Water,drink,1,0,0,0,0'
  ]);
  const prior=applyDailyFoodCsv(EMPTY_DIARY(),
    previewDailyFoodCsv(EMPTY_DIARY(),double,date),{apply:true,confirmed:true}).diary;
  const changed=food([
    '2026-11-09,Water,drink,2,0,0,0,0',
    '2026-11-09,Water,drink,3,0,0,0,0'
  ]);
  assert.throws(()=>previewDailyFoodCsv(prior,changed,date),/ambiguous repeated entries/);
  assert.equal(prior.entries.length,2);
});

test('a manual entry is protected even when CSV-owned entries use the same meal name',()=>{
  const csv=food(['2026-11-09,Oatmeal,meal,1,250,7,40,5']);
  const imported=applyDailyFoodCsv(EMPTY_DIARY(),
    previewDailyFoodCsv(EMPTY_DIARY(),csv,date),{apply:true,confirmed:true}).diary;
  const withManual=saveEntry(imported,{
    id:'manual-food-1',date,name:'Oatmeal',occasion:'meal',servings:1,
    kcal:300,protein:8,carbs:45,fat:7
  });
  const changed=food(['2026-11-09,Oatmeal,meal,1,275,8,40,6']);
  assert.throws(()=>previewDailyFoodCsv(withManual,changed,date),/manual entry/);
  assert.equal(withManual.entries.length,2);
});

test('a concurrent or forged edit never changes stored rows during apply',()=>{
  const initial=applyDailyFoodCsv(old(),previewDailyFoodCsv(old(),sample,date),
    {apply:true,confirmed:true}).diary;
  const csv=food(['2026-11-09,"Chicken rice, small",meal,1,650,30,60,18']);
  const preview=previewDailyFoodCsv(initial,csv,date);
  assert.equal(preview.updates.length,1);
  const changed=saveEntry(initial,{...preview.updates[0].before,kcal:777});
  assert.throws(()=>applyDailyFoodCsv(changed,preview,{apply:true,confirmed:true}),
    /changed since preview/);
  assert.equal(changed.entries.find(e=>e.name==='Chicken rice, small').kcal,777);
  const forged=structuredClone(preview);
  forged.updates[0].after.id='forged-entry';
  assert.throws(()=>applyDailyFoodCsv(initial,forged,{apply:true,confirmed:true}),
    /changed since preview/);
  const withoutApply=applyDailyFoodCsv(initial,preview,{confirmed:true});
  assert.equal(withoutApply.applied,false);
});

test('old and new CSV workflow UI discloses every correction and retains safety gates',()=>{
  const html=readFileSync(new URL('../preview-v101/food-diary.html',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../preview-v101/food-diary.js',import.meta.url),'utf8');
  assert.match(html,/changes to previously CSV-imported meals require explicit confirmation/);
  assert.match(html,/Missing rows in the revised CSV stay saved/);
  assert.match(ui,/for\(const \{before,after\} of preview\.updates\)/);
  assert.match(ui,/oldValue\+' → '\+newValue/);
  assert.match(ui,/preview\.add\.length\+preview\.updates\.length/);
  assert.match(ui,/backupDownloaded/);
  assert.match(ui,/storage\.getItem\(FOOD_KEY\)!==pendingCsv\.snapshot/);
  assert.match(ui,/applyDailyFoodCsv\(diary,preview,\{apply:true,confirmed:true\}\)/);
});
