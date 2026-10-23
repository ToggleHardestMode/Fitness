import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lifetimeTrainingSets, weeklyTrainingAnalysis } from '../preview-v101/training-analytics.js';

const week = '2026-10-19';
const templates = [
  {id:'upper',exercises:[{name:'Press',muscle:'Chest',sets:2}]},
  {id:'holds',exercises:[{name:'Plank',muscle:'Core',sets:1,repUnit:'seconds_per_side'}]}
];
const set = (date, templateId, exerciseIndex, number, extras={}) =>
  ({date,templateId,exerciseIndex,set:number,kg:0,reps:10,...extras});
const makeState = logs => ({templates,assignments:{0:'upper',2:'holds'},logs});

test('weekly working sets ignore duplicate, warmup, invalid slot and orphan logs', () => {
  const data=makeState([
    set(week,'upper',0,1,{kg:12,reps:10}),
    set(week,'upper',0,1,{kg:30,reps:10}),
    set('2026-10-20','upper',0,2,{isWarmup:true}),
    set('2026-10-20','upper',0,0),
    set('2026-10-21','holds',0,1,{reps:30}),
    set('2026-10-22','upper',0,2),
    set('2026-10-23','upper',0,3),
    set('2026-10-23','missing',0,1),
    set('2026-10-24','upper',8,1),
    set('2026-10-25','upper',0,2,{kind:'warmup'})
  ]);
  const report=weeklyTrainingAnalysis(data,week);
  assert.equal(report.planned,3);
  assert.equal(report.completed,3);
  assert.equal(report.assignedCompleted,2);
  assert.equal(report.offPlan,1);
  assert.equal(report.loadVolume,120);
  assert.equal(report.days.filter(day=>day.completed>0).length,3);
  assert.deepEqual(report.days.map(day=>day.completed),[1,0,1,1,0,0,0]);
  assert.equal(lifetimeTrainingSets(data),3);
});

test('editing a saved set does not add to weekly or all-time counters', () => {
  const data=makeState([set(week,'upper',0,1,{kg:9,reps:8})]);
  const first=weeklyTrainingAnalysis(data,week);
  data.logs[0]={...data.logs[0],kg:11,reps:10};
  const revised=weeklyTrainingAnalysis(data,week);
  assert.equal(first.completed,1);
  assert.equal(revised.completed,1);
  assert.equal(lifetimeTrainingSets(data),1);
  assert.equal(revised.loadVolume,110);
});

test('planned workouts with no saved working sets show zero logged days', () => {
  const data=makeState([set(week,'upper',0,1,{kind:'warmup'})]);
  const report=weeklyTrainingAnalysis(data,week);
  assert.equal(report.planned,3);
  assert.equal(report.completed,0);
  assert.equal(report.days.filter(day=>day.completed>0).length,0);
});

test('dashboard week card shares the strict counted-day source with gold summary', () => {
  const app=readFileSync(new URL('../preview-v101/app.js',import.meta.url),'utf8');
  assert.match(app,/function inWeekCards\(s, analysis\)/);
  assert.match(app,/kpi-value">\$\{analysis\.days\.filter\(day=>day\.completed>0\)\.length\}/);
  assert.doesNotMatch(app,/kpi-value">\$\{s\.sessions\}/);
});
