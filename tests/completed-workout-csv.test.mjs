import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCompletedCsv,applyCompletedCsv,blankCompletedCsv} from '../preview-v101/completed-workout-csv.js';
import {validateBackup} from '../preview-v101/core.js';
import {getExerciseJourney} from '../preview-v101/strength-journey.js';

const ex=(name,sets)=>({name,muscle:'Chest',sets,min:8,max:12,rest:90});
const state=()=>({version:1,templates:[{id:'example',name:'Demo Upper A',day:0,exercises:[
  ex('Flat Dumbbell Press',2),ex('Chest Supported Row',2)
]}],assignments:{},logs:[],metrics:[],reminder:{hour:18,minute:30,lead:0}});
const HEAD='date,workout,exercise,set,kg,reps,rpe,difficulty,technique,notes';
const row=(date,exercise,set,kg,reps,rpe='',difficulty='',technique='',notes='')=>
  [date,'Demo Upper A',exercise,set,kg,reps,rpe,difficulty,technique,notes].join(',');
const CSV=HEAD+'\n'+row('2026-11-02','Flat Dumbbell Press',1,12,15,6,'too_easy','controlled')+'\n'+
  row('2026-11-02','Flat Dumbbell Press',2,12,12,7,'on_target','controlled');

test('import is a separate completed-set format with no day column',()=>{
  const before=state();
  const preview=previewCompletedCsv(before,CSV);
  assert.equal(preview.add.length,2);
  assert.equal(before.logs.length,0);
  let id=0;
  const after=applyCompletedCsv(before,preview,()=>String(++id));
  assert.equal(after.logs.length,2);
  assert.equal(after.logs[0].date,'2026-11-02');
  assert.equal(after.logs[0].difficulty,'too_easy');
  assert.equal(after.logs[0].kg,12);
  assert.equal(validateBackup(after).logs.length,2);
  assert.equal(before.logs.length,0);
});
test('two dated sessions add to the actual Strength Journey graph',()=>{
  const input=CSV+'\n'+row('2026-11-03','Chest Supported Row',1,15,12,8);
  let id=0;
  const result=applyCompletedCsv(state(),previewCompletedCsv(state(),input),()=>String(++id));
  const press=getExerciseJourney(result,'example',0);
  const back=getExerciseJourney(result,'example',1);
  assert.equal(press.day1,'2026-11-02');
  assert.equal(press.sessions.length,1);
  assert.equal(back.sessions[0].date,'2026-11-03');
});
test('repeat of identical file skips all existing records',()=>{
  const before=state();let seq=0;
  const after=applyCompletedCsv(before,previewCompletedCsv(before,CSV),()=>String(++seq));
  const preview=previewCompletedCsv(after,CSV);
  assert.equal(preview.add.length,0);
  assert.equal(preview.skipped.length,2);
  assert.throws(()=>applyCompletedCsv(after,preview),/No new completed sets/);
  assert.equal(after.logs.length,2);
});
test('differing saved set blocks entire file, no overwrites',()=>{
  let n=0;
  const before=applyCompletedCsv(state(),previewCompletedCsv(state(),CSV),()=>String(++n));
  const conflict=CSV.replace(',12,15,6,',',20,15,6,');
  assert.throws(()=>previewCompletedCsv(before,conflict),/conflicts/);
  assert.equal(before.logs[0].kg,12);
});
test('stale preview cannot overwrite a later saved set',()=>{
  const initial=state(), preview=previewCompletedCsv(initial,CSV);
  let n=0;
  const later=applyCompletedCsv(initial,preview,()=>String(++n));
  assert.throws(()=>applyCompletedCsv(later,preview),/after the CSV preview/);
  assert.equal(later.logs.length,2);
});
test('duplicate rows in a single file are rejected',()=>{
  assert.throws(()=>previewCompletedCsv(state(),CSV+'\n'+row('2026-11-02','Flat Dumbbell Press',1,12,15)),/appears twice/);
});
test('unknown template or exercise and out-of-range sets are rejected',()=>{
  assert.throws(()=>previewCompletedCsv(state(),CSV.replaceAll('Demo Upper A','Other Plan')),/not in your library/);
  assert.throws(()=>previewCompletedCsv(state(),CSV.replaceAll('Flat Dumbbell Press','Unknown exercise')),/not in this workout/);
  assert.throws(()=>previewCompletedCsv(state(),HEAD+'\n'+row('2026-11-02','Flat Dumbbell Press',9,12,10)),/between 1 and 2/);
});
test('invalid date, incomplete weight/reps, invalid feedback and invalid RPE are rejected',()=>{
  assert.throws(()=>previewCompletedCsv(state(),CSV.replaceAll('2026-11-02','2026-02-30')),/Invalid calendar date/);
  assert.throws(()=>previewCompletedCsv(state(),HEAD+'\n'+row('2026-11-02','Flat Dumbbell Press',1,'',10)),/both kg and reps/);
  assert.throws(()=>previewCompletedCsv(state(),CSV.replace('too_easy','impossible')),/difficulty/);
  assert.throws(()=>previewCompletedCsv(state(),CSV.replace(',15,6,',',15,11,')),/RPE/);
});
test('Plan template CSV is rejected with a precise format message',()=>{
  const other='day,workout,exercise,muscle,sets,rep_min,rep_max\nMon,Demo Upper A,Press,Chest,2,8,12';
  assert.throws(()=>previewCompletedCsv(state(),other),/missing 'date'/);
});
test('blank rows do not become saved sets, only filled completed rows do',()=>{
  const template=blankCompletedCsv(state(),'2026-11-02','example');
  assert.match(template,/template_id/);
  assert.match(template,/2026-11-02/);
  assert.throws(()=>previewCompletedCsv(state(),template),/No completed sets/);
  const csv=HEAD+'\n'+row('2026-11-02','Flat Dumbbell Press',1,12,10)+
    '\n'+row('2026-11-02','Flat Dumbbell Press',2,'','','','','');
  assert.equal(previewCompletedCsv(state(),csv).add.length,1);
});
test('workout ID and exercise index resolve duplicate exercise names exactly',()=>{
  const data=state();
  data.templates[0].exercises.push(ex('Flat Dumbbell Press',1));
  const withID='date,workout,exercise,set,kg,reps,template_id,exercise_index\n'+
    '2026-11-02,Demo Upper A,Flat Dumbbell Press,1,8,10,example,3';
  const one=previewCompletedCsv(data,withID);
  assert.equal(one.add[0].exerciseIndex,2);
  assert.throws(()=>previewCompletedCsv(data,HEAD+'\n'+row('2026-11-02','Flat Dumbbell Press',1,8,10)),/ambiguous/);
});
test('quoted commas and newlines in notes are parsed as one CSV row',()=>{
  const csv=HEAD+'\n'+
    '2026-11-02,Demo Upper A,Flat Dumbbell Press,1,12,12,7,on_target,controlled,"felt good,\nand stable"';
  const one=previewCompletedCsv(state(),csv);
  assert.equal(one.add.length,1);
  assert.equal(one.add[0].notes,'felt good,\nand stable');
});
test('entire import fails without state mutation if a later row is invalid',()=>{
  const bad=CSV+'\n'+row('2026-11-02','Flat Dumbbell Press',2,999,10);
  const base=state();
  assert.throws(()=>previewCompletedCsv(base,bad));
  assert.deepEqual(base.logs,[]);
});
