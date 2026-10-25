import test from 'node:test';
import assert from 'node:assert/strict';
import { newlyRecordedSets } from '../preview-v101/slime-hit.js';

const target = { date:'2026-10-26',templateId:'upper',exerciseIndex:0 };
const set = (id, setNumber, extra={}) => ({id,date:target.date,templateId:target.templateId,exerciseIndex:target.exerciseIndex,set:setNumber,kg:20,reps:8,...extra});

test('newly saved set counts as one cosmetic hit without mutating state',()=>{
  const original={logs:[]},next={logs:[set('x',1)]};
  const snapshot=structuredClone(next);
  assert.equal(newlyRecordedSets(original,next,target),1);
  assert.deepEqual(next,snapshot);
});

test('editing or resaving an existing set does not generate another hit',()=>{
  const old={logs:[set('x',1)]};
  const changed={logs:[set('x',1,{kg:22,reps:10})]};
  assert.equal(newlyRecordedSets(old,changed,target),0);
  assert.equal(newlyRecordedSets(changed,changed,target),0);
});

test('other dates, exercises, and warmups cannot produce hits',()=>{
  const old={logs:[]};
  const next={logs:[set('a',1,{date:'2026-10-25'}),set('b',2,{exerciseIndex:1}),set('c',3,{kind:'warmup'}),set('d',4,{isWarmup:true}),set('e',5,{templateId:'other'})]};
  assert.equal(newlyRecordedSets(old,next,target),0);
});

test('several newly saved sets are counted for a single post-save effect',()=>{
  const old={logs:[set('a',1)]};
  const next={logs:[set('a',1),set('b',2),set('c',3)]};
  assert.equal(newlyRecordedSets(old,next,target),2);
});

test('invalid states reject without silently granting effects',()=>{
  assert.throws(()=>newlyRecordedSets(null,{logs:[]},target),/unavailable/);
  assert.throws(()=>newlyRecordedSets({logs:[]},null,target),/unavailable/);
});
