import test from 'node:test';
import assert from 'node:assert/strict';
import {readCsvBatch,previewWorkoutBatch,previewFoodBatch} from '../preview-v101/batch-import.js';
import {applyCompletedCsv} from '../preview-v101/completed-workout-csv.js';
import {applyDailyFoodCsv} from '../preview-v101/food-diary-csv.js';
import {EMPTY_DIARY} from '../preview-v101/food-diary-core.js';

const state = () => ({version:1,templates:[{id:'demo',name:'Synthetic Upper',day:0,exercises:[
  {name:'Press',muscle:'Chest',sets:2,min:8,max:12,rest:90}]}],
  assignments:{},logs:[],metrics:[],reminder:{hour:18,minute:30,lead:0}});
const workout = (name,date,kg=10,set=1) => ({name,text:'date,workout,exercise,set,kg,reps\n'+
  [date,'Synthetic Upper','Press',set,kg,8].join(',')});
const food = (name,...rows) => ({name,text:'date,name,occasion,servings,kcal,protein,carbs,fat\n'+rows.join('\n')});
const a=workout('a.csv','2026-10-01'), b=workout('b.csv','2026-10-02');
const fa=food('a.csv','2026-10-01,Water,drink,1,0,0,0,0','2026-10-01,Water,drink,1,0,0,0,0');
const fb=food('b.csv','2026-10-02,Meal,meal,1,300,,20,5');

test('ten workout files preview together, duplicates skipped, apply preserves history and retry is idempotent',()=>{
  const before=state(), files=Array.from({length:10},(_,i)=>workout(i+'.csv','2026-10-'+String(i+1).padStart(2,'0')));
  const p=previewWorkoutBatch(before,[...files,files[0]]);
  assert.equal(p.add.length,10);assert.equal(p.files.at(-1).duplicates,1);
  assert.deepEqual(before.logs,[]);
  let n=0;const saved=applyCompletedCsv(before,p,()=>String(++n));
  assert.equal(saved.logs.length,10);
  const again=previewWorkoutBatch(saved,files);
  assert.equal(again.add.length,0);assert.equal(again.skipped.length,10);
});

test('later workout conflicts, malformed files and within-file duplicates block the entire batch',()=>{
  const before=state();
  assert.throws(()=>previewWorkoutBatch(before,[a,workout('conflict.csv','2026-10-01',20)]),/conflict.csv: Conflicting set also in a.csv/);
  assert.throws(()=>previewWorkoutBatch(before,[a,{name:'bad.csv',text:'broken'}]),/bad.csv:/);
  assert.throws(()=>previewWorkoutBatch(before,[a,{name:'duplicate.csv',text:b.text+'\n'+b.text.split('\n')[1]}]),/appears twice/);
  assert.deepEqual(before.logs,[]);
});

test('food batch keeps repeated servings, unknowns and zero; duplicate file and retry cannot inflate entries',()=>{
  const before=EMPTY_DIARY(), p=previewFoodBatch(before,[fa,fb,{...fa,name:'copy.csv'}]);
  assert.equal(p.add.length,3);assert.equal(p.files[2].duplicate,true);
  assert.deepEqual(before.entries,[]);
  assert.throws(()=>applyDailyFoodCsv(before,p,{apply:true}),/Explicit/);
  const saved=applyDailyFoodCsv(before,p,{apply:true,confirmed:true}).diary;
  assert.equal(saved.entries.length,3);
  assert.equal(saved.entries.find(e=>e.name==='Meal').protein,null);
  assert.equal(saved.entries[0].kcal,0);
  assert.equal(previewFoodBatch(saved,[fa,fb]).add.length,0);
  assert.equal(previewFoodBatch(saved,[fa,fb]).skipped.length,3);
});

test('food overlap across different files is refused; disjoint meals on same date and reviewed corrections work',()=>{
  const before=EMPTY_DIARY();
  assert.throws(()=>previewFoodBatch(before,[fa,food('overlap.csv','2026-10-01,Water,drink,2,0,0,0,0')]),/Overlapping same-date food group/);
  assert.throws(()=>previewFoodBatch(before,[fa,{name:'bad.csv',text:'bad'}]),/bad.csv:/);
  const c=food('c.csv','2026-10-01,Snack,snack,1,100,2,3,4');
  const initial=applyDailyFoodCsv(before,previewFoodBatch(before,[fa,fb,c]),{apply:true,confirmed:true}).diary;
  const revised=food('rev.csv','2026-10-02,Meal,meal,1,350,,20,5');
  const p=previewFoodBatch(initial,[fa,revised]);
  assert.equal(p.updates.length,1);assert.equal(p.skipped.length,2);
  const result=applyDailyFoodCsv(initial,p,{apply:true,confirmed:true}).diary;
  assert.equal(result.entries.length,4);
  assert.equal(result.entries.find(e=>e.name==='Meal').kcal,350);
});

test('file selection limits and errors identify the affected file without reading unsupported files',async()=>{
  const file={name:'ok.csv',size:100,text:async()=>a.text};
  assert.deepEqual(await readCsvBatch([file],'workout'),[{name:'ok.csv',text:a.text}]);
  await assert.rejects(readCsvBatch([{...file,name:'wrong.xlsx'}],'workout'),/wrong.xlsx/);
  await assert.rejects(readCsvBatch(Array(21).fill(file),'food'),/1 and 20/);
  await assert.rejects(readCsvBatch([{...file,size:100001}],'food'),/ok.csv/);
  await assert.rejects(readCsvBatch([{...file,text:async()=>{throw Error('read');}}],'food'),/ok.csv: file could not be read/);
});
