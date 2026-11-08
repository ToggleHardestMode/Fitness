import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mondayOf,shiftWeek,latestLoggedWeek} from '../preview-v101/week-window.js';
import {getExerciseJourney,recommendNextExercise} from '../preview-v101/strength-journey.js';
import {addExerciseEquivalence} from '../preview-v101/exercise-equivalence.js';
import {strengthWorkoutDay} from '../preview-v101/strength-journey-ui.js';
import {renderStrengthJourney} from '../preview-v101/strength-journey-visual.js';
import {recordedCaloriesThisWeek,foodDiaryChartMarkup} from '../preview-v101/food-diary-chart.js';
import {weeklyTrainingAnalysis} from '../preview-v101/training-analytics.js';

const ex=name=>({name,muscle:'Chest',sets:1,min:8,max:12,rest:90});
const t=(id,name,exercises)=>({id,name,exercises});
const state=()=>({
  templates:[t('a','V10.2 Upper A',[ex('DB Press'),ex('DB Row')]),
    t('b','V10.3 Upper A',[ex('DB Press'),ex('DB Curl')]),
    t('pt','Lower [PT Review]',[ex('Floor Bridge')])],
  assignments:{0:'b'},metrics:[],symptomLogs:[],
  logs:[
    {id:'one',templateId:'a',exerciseIndex:0,set:1,date:'2026-10-26',kg:18,reps:8,rpe:7},
    {id:'two',templateId:'b',exerciseIndex:0,set:1,date:'2026-11-02',kg:20,reps:10,rpe:7}
  ]
});

test('Monday boundaries and the latest logged week follow calendar dates',()=>{
  assert.equal(mondayOf('2026-11-06'),'2026-11-02');
  assert.equal(shiftWeek('2026-11-06',-1),'2026-10-26');
  assert.equal(latestLoggedWeek(state()),'2026-11-02');
  assert.throws(()=>mondayOf('2026-02-30'),/Invalid calendar date/);
});
test('warmups and invalid dates do not become the latest logged week',()=>{
  const s=state();
  s.logs.push({id:'warmup',templateId:'b',exerciseIndex:0,set:1,date:'2027-01-01',kind:'warmup',kg:0,reps:1});
  s.logs.push({id:'bad-date',templateId:'b',exerciseIndex:0,set:1,date:'2027-02-30',kg:0,reps:1});
  assert.equal(latestLoggedWeek(s),'2026-11-02');
});
test('Decision 7: same-name history stays isolated without explicit owner approval',()=>{
  const s=state(),before=structuredClone(s);
  const original=getExerciseJourney(s,'b',0);
  assert.deepEqual(original.sessions.map(row=>row.date),['2026-11-02']);
  assert.equal(original.linkedSessions.length,0);
  assert.equal(original.allSessions.length,1);
  const draft={from:{templateId:'a',exerciseIndex:0},to:{templateId:'b',exerciseIndex:0},approvedDate:'2026-11-06'};
  assert.throws(()=>addExerciseEquivalence(s,draft,()=> 'manual-1'),/explicit confirmation/);
  const approved=addExerciseEquivalence(s,draft,()=> 'manual-1',{confirmed:true});
  const journey=getExerciseJourney(approved,'b',0);
  assert.deepEqual(journey.sessions.map(row=>row.date),['2026-11-02']);
  assert.deepEqual(journey.linkedSessions.map(row=>row.date),['2026-10-26']);
  assert.equal(journey.allSessions.length,2);
  assert.deepEqual(s,before);
});
test('unapproved matching name cannot contribute to suggested loading',()=>{
  const s=state();s.logs=s.logs.filter(row=>row.templateId==='a');
  const selection={templateId:'b',exerciseIndex:0,date:'2026-11-06'};
  const plain=recommendNextExercise(s,selection);
  assert.equal(plain.status,'no-history');assert.equal(plain.reference,undefined);
  const linked=addExerciseEquivalence(s,
    {from:{templateId:'a',exerciseIndex:0},to:{templateId:'b',exerciseIndex:0},approvedDate:'2026-11-06'},
    ()=> 'manual-2',{confirmed:true});
  const recommendation=recommendNextExercise(linked,selection);
  assert.equal(recommendation.status,'no-history');
  assert.equal(recommendation.reference.exerciseName,'DB Press');
  assert.deepEqual(recommendation.targets,[]);
});
test('same-name plans remain separate choices in Strength Journey',()=>{
  const html=renderStrengthJourney(state(),0,{today:'2026-11-06'});
  const a=html.indexOf('id="strength-exercise"'),b=html.indexOf('</select>',a);
  assert.ok(a>=0&&b>a);
  const select=html.slice(a,b);
  assert.equal((select.match(/DB Press/g)||[]).length,2);
  assert.match(select,/V10.2 Upper A/);assert.match(select,/V10.3 Upper A/);
  assert.match(html,/Workout versions stay separate/);
});
test('PT review is respected even when no previous workout exists',()=>{
  assert.equal(recommendNextExercise(state(),{templateId:'pt',exerciseIndex:0,date:'2026-11-06'}).status,'pt-review');
});
test('full workout guide lists prescribed exercises but never saves targets',()=>{
  const s=state(),before=structuredClone(s);
  const html=strengthWorkoutDay(s,{templateId:'b',date:'2026-11-06'});
  assert.match(html,/DB Press/);assert.match(html,/DB Curl/);
  assert.match(html,/Nothing here is automatically saved/);
  assert.match(html,/explicitly owner-linked/);
  assert.deepEqual(s,before);
});
test('Food Diary week subtotal ignores prior Sunday and preserves unknown kcal',()=>{
  const report={recordedDays:3,numericDays:3,entries:[
    {date:'2026-11-01',foods:1,known:1,unknown:0,kcal:800},
    {date:'2026-11-02',foods:2,known:1,unknown:1,kcal:300},
    {date:'2026-11-06',foods:1,known:1,unknown:0,kcal:550}
  ]};
  assert.equal(recordedCaloriesThisWeek(report).recordedKcal,850);
  assert.equal(recordedCaloriesThisWeek(report).unknownFoods,1);
  assert.match(foodDiaryChartMarkup(report),/so far/);
});
test('off-plan sets count in the selected week but not scheduled completion',()=>{
  const s=state();
  s.logs.push({id:'third',templateId:'b',exerciseIndex:1,set:1,date:'2026-11-03',kg:8,reps:10});
  const now=weeklyTrainingAnalysis(s,'2026-11-02');
  assert.equal(now.completed,2);assert.equal(now.assignedCompleted,1);assert.equal(now.offPlan,1);
  const previous=weeklyTrainingAnalysis(s,'2026-10-26');
  assert.equal(previous.completed,1);assert.equal(previous.offPlan,1);
});
test('reconciliation retains the backup guard and excludes automatic grouping',()=>{
  const app=readFileSync(new URL('../preview-v101/app.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../preview-v101/sw.js',import.meta.url),'utf8');
  assert.match(app,/markWorkoutBackupChecked\(localStorage,today\(\)\)/);
  assert.match(app,/backupReminderCard\(\)/);
  assert.match(app,/week-current/);assert.match(app,/strengthWorkoutDay\(state,/);
  assert.match(sw,/\.\/backup-reminder\.js/);
  assert.match(sw,/\.\/week-window\.js/);
  assert.doesNotMatch(sw,/exercise-universe/);
  assert.doesNotMatch(app,/matchingExerciseReferences/);
});
