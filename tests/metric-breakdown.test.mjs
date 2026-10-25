import test from 'node:test';
import assert from 'node:assert/strict';
import { METRIC_FIELDS, weeklyMetricSources } from '../preview-v101/metric-breakdown.js';

const week = ['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25'];

test('lists only current-week contributing values by field and date', () => {
  const original = [
    {date:'2026-10-18',protein:600,calories:15000,sleep:24,recovery:5},
    {date:'2026-10-21',protein:366,calories:6222,sleep:12,recovery:null},
    {date:'2026-10-19',protein:300,calories:4000,sleep:11,recovery:1},
    {date:'2026-10-20',protein:null,calories:null,sleep:null,recovery:null},
    {date:'2026-10-26',protein:100,calories:2000,sleep:8,recovery:4}
  ];
  const snapshot = structuredClone(original);
  const result = weeklyMetricSources(original, week);
  assert.deepEqual(result.protein, [
    {date:'2026-10-19',value:300},{date:'2026-10-21',value:366}
  ]);
  assert.deepEqual(result.calories.map(x=>x.value),[4000,6222]);
  assert.deepEqual(result.sleep.map(x=>x.value),[11,12]);
  assert.deepEqual(result.recovery,[{date:'2026-10-19',value:1}]);
  assert.equal(result.protein.reduce((n,entry)=>n+entry.value,0)/result.protein.length,333);
  assert.equal(result.calories.reduce((n,entry)=>n+entry.value,0)/result.calories.length,5111);
  assert.equal(result.sleep.reduce((n,entry)=>n+entry.value,0)/result.sleep.length,11.5);
  assert.deepEqual(original,snapshot);
});

test('independent sample counts and no-entry weeks are correctly represented', () => {
  assert.deepEqual(METRIC_FIELDS.map(([,key])=>key),['protein','calories','sleep','recovery']);
  const v=weeklyMetricSources([{date:'2026-10-20',sleep:7},{date:'2026-10-19',protein:150}],week);
  assert.equal(v.protein.length,1);
  assert.equal(v.sleep.length,1);
  assert.equal(v.calories.length,0);
  assert.equal(v.recovery.length,0);
  assert.deepEqual(weeklyMetricSources([],week).protein,[]);
});

test('synthetic correction to a saved date replaces its source without adding a day', () => {
  const metrics=[{date:'2026-10-19',protein:300}];
  metrics[0]={date:'2026-10-19',protein:100};
  const v=weeklyMetricSources(metrics,week);
  assert.deepEqual(v.protein,[{date:'2026-10-19',value:100}]);
});
