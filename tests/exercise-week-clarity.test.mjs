import test from 'node:test';
import assert from 'node:assert/strict';
import {mondayOf} from '../preview-v101/week-window.js';
test('week starts Monday',()=>assert.equal(mondayOf('2026-11-06'),'2026-11-02'));
import {distinctExercises,matchingExerciseReferences} from '../preview-v101/exercise-universe.js';
import {getExerciseJourney,recommendNextExercise} from '../preview-v101/strength-journey.js';
import {strengthWorkoutDay} from '../preview-v101/strength-journey-ui.js';
import {renderStrengthJourney} from '../preview-v101/strength-journey-visual.js';
import {shiftWeek,latestLoggedWeek} from '../preview-v101/week-window.js';
import {recordedCaloriesThisWeek,foodDiaryChartMarkup} from '../preview-v101/food-diary-chart.js';
const ex=name=>({name,muscle:'Chest',sets:1,min:8,max:12,rest:90});
const t=(id,name,exercises)=>({id,name,exercises});
const state=()=>({templates:[t('a','V10.2 Upper A',[ex('DB Press'),ex('DB Row')]),
t('b','V10.3 Upper A',[ex('DB Press'),ex('DB Curl')]),
t('pt','Lower [PT Review]',[ex('Floor Bridge')])],
assignments:{0:'b'},metrics:[],symptomLogs:[],
logs:[{id:'one',templateId:'a',exerciseIndex:0,set:1,date:'2026-10-26',kg:18,reps:8,rpe:7},
{id:'two',templateId:'b',exerciseIndex:0,set:1,date:'2026-11-02',kg:20,reps:10,rpe:7}]});
test('same exercises are universal across named plan versions',()=>{
const s=state();assert.equal(distinctExercises(s).length,4);
assert.equal(matchingExerciseReferences(s,s.templates[0].exercises[0]).length,2);
const j=getExerciseJourney(s,'b',0);assert.equal(j.sessions.length,2);
assert.equal(j.ownSessions.length,1);
assert.deepEqual(j.sessions.map(x=>x.source.templateId),['a','b']);
});
test('PT review is checked even when there is no prior workout',()=>{
assert.equal(recommendNextExercise(state(),{templateId:'pt',exerciseIndex:0,date:'2026-11-06'}).status,'pt-review');
});
test('full workout guide includes every prescribed exercise',()=>{
 const s=state(),before=structuredClone(s);
 const html=strengthWorkoutDay(s,{templateId:'b',date:'2026-11-06'});
 assert.match(html,/DB Press/);assert.match(html,/DB Curl/);
 assert.deepEqual(s,before);
});
test('Strength Journey shows one exercise choice, even with two plan versions',()=>{
 const html=renderStrengthJourney(state(),0,{today:'2026-11-06'});
 assert.match(html,/data-session-count="2"/);
 const selection=html.slice(html.indexOf('id="strength-exercise"'),html.indexOf('</select>',html.indexOf('id="strength-exercise"')));
 assert.equal((selection.match(/DB Press/g)||[]).length,1);
});
test('week selection and latest saved week are calendar-based',()=>{
 assert.equal(shiftWeek('2026-11-06',-1),'2026-10-26');
 assert.equal(latestLoggedWeek(state()),'2026-11-02');
});
test('weekly food subtotal excludes previous Sunday and labels partial week',()=>{
 const report={recordedDays:3,numericDays:3,entries:[
 {date:'2026-11-01',foods:1,known:1,unknown:0,kcal:800},
 {date:'2026-11-02',foods:2,known:1,unknown:1,kcal:300},
 {date:'2026-11-06',foods:1,known:1,unknown:0,kcal:550}]};
 assert.equal(recordedCaloriesThisWeek(report).recordedKcal,850);
 assert.match(foodDiaryChartMarkup(report),/so far/);
});
