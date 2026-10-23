import test from 'node:test';
import assert from 'node:assert/strict';
import {lifetimeTrainingSets, setMilestoneProgress} from '../preview-v101/training-analytics.js';

const at = (sets) => setMilestoneProgress(sets);

test('no saved sets starts at zero toward the first 25', () => {
  assert.deepEqual(at(0), {earned:0,next:25,progress:0,span:25,percent:0});
});

test('at a milestone, the earned level is recognized once', () => {
  for (const [done,next] of [[25,50],[50,100],[100,250],[250,500],[500,1000],[1000,1500],[1500,2000]]) {
    const result=at(done);
    assert.equal(result.earned,done);
    assert.equal(result.next,next);
    assert.equal(result.progress,0);
    assert.equal(result.percent,0);
  }
});

test('just below a threshold never shows 100 percent or a claimed milestone', () => {
  for (const [done,earned,next] of [[24,0,25],[49,25,50],[99,50,100],[249,100,250],[499,250,500],[999,500,1000],[1499,1000,1500]]) {
    const result=at(done);
    assert.equal(result.earned,earned);
    assert.equal(result.next,next);
    assert.ok(result.percent<100);
  }
});

test('larger totals continue in 500-set intervals', () => {
  assert.deepEqual(at(1750),{earned:1500,next:2000,progress:250,span:500,percent:50});
  assert.equal(at(5000).next,5500);
});

test('invalid counts reject instead of displaying invented milestones', () => {
  for (const value of [-1,0.1,NaN,Infinity,'100',null,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>at(value),/non-negative safe integer/);
  }
});

test('progress derives only from unique real working-set logs, not plans or duplicates', () => {
  const template={id:'upper',exercises:[{name:'Press',muscle:'Chest',sets:30}]};
  const logs=Array.from({length:24},(_,i)=>({date:'2026-10-19',templateId:'upper',exerciseIndex:0,set:i+1,kg:0,reps:8}));
  const state={templates:[template],assignments:{0:'upper'},logs};
  assert.equal(lifetimeTrainingSets(state),24);
  assert.equal(at(lifetimeTrainingSets(state)).next,25);
  state.logs.push({...logs[0],kg:12,reps:12});
  state.logs.push({...logs[0],set:25,isWarmup:true});
  assert.equal(lifetimeTrainingSets(state),24);
  state.logs.push({...logs[0],set:25});
  assert.equal(lifetimeTrainingSets(state),25);
  assert.equal(at(lifetimeTrainingSets(state)).earned,25);
});
