import test from 'node:test';
import assert from 'node:assert/strict';
import { lifetimeTrainingSets, weeklyTrainingAnalysis } from '../preview-v101/training-analytics.js';
import { setsBarsMarkup, volumeBarsMarkup } from '../preview-v101/volume-bars.js';

const week = '2026-10-19';
const templates = [{id:'upper',exercises:[{name:'Press',muscle:'Chest',sets:3},{name:'Plank',muscle:'Core',sets:1,repUnit:'seconds_per_side'}]}];
const log = (date, exerciseIndex, set, kg=0, reps=10, extra={}) =>
  ({date,templateId:'upper',exerciseIndex,set,kg,reps,...extra});
const state = logs => ({templates,logs,assignments:{0:'upper'}});

test('lifetime includes earlier weeks, bodyweight and timed holds', () => {
  const data=state([log('2026-10-12',0,1),log(week,0,1,12,10),log(week,1,1,0,25)]);
  assert.equal(lifetimeTrainingSets(data),3);
  assert.equal(weeklyTrainingAnalysis(data,week).completed,2);
  assert.equal(weeklyTrainingAnalysis(data,week).loadVolume,120);
});

test('editing saved values never increments set progress', () => {
  const data=state([log(week,0,1,10,8)]);
  assert.equal(lifetimeTrainingSets(data),1);
  data.logs[0]={...data.logs[0],kg:12,reps:9};
  assert.equal(lifetimeTrainingSets(data),1);
});

test('duplicates, warmups and dangling/out-of-range entries do not inflate progress', () => {
  const data=state([log(week,0,1),log(week,0,1,12,12),log(week,0,2,10,8,{isWarmup:true}),
    log(week,0,3,10,8,{kind:'warmup'}),log(week,0,4),log(week,1,1,0,20),
    {...log(week,0,2),templateId:'missing'},log('bad-date',0,2)]);
  assert.equal(lifetimeTrainingSets(data),2);
});

test('planned templates without logs do not count as accomplished sets', () => {
  const data=state([]);
  assert.equal(lifetimeTrainingSets(data),0);
  assert.equal(weeklyTrainingAnalysis(data,week).planned,3);
});

test('daily set chart reflects counts, not kilogram volume', () => {
  const report=weeklyTrainingAnalysis(state([log(week,0,1),log(week,0,2,40,10),log('2026-10-21',1,1)]),week);
  const html=setsBarsMarkup(report.days);
  assert.match(html,/Mon: 2 completed set\(s\)/);
  assert.match(html,/Wed: 1 completed set\(s\)/);
  assert.match(html,/bar-zero/);
  assert.doesNotMatch(html,/kg·reps/);
  assert.match(volumeBarsMarkup(report.days),/kg·reps/);
});

test('bad chart input is rejected', () => {
  assert.throws(()=>setsBarsMarkup([]),/seven daily records/);
});
