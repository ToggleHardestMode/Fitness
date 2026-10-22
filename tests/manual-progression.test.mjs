import test from 'node:test';
import assert from 'node:assert/strict';
import {manualProgression} from '../preview-v101/manual-progression.js';
import {manualProgressionPanel} from '../preview-v101/manual-progression-ui.js';

const day='2026-10-22',prev='2026-10-19';
const fixture=()=>{
  const template={id:'upper',name:'Upper A',exercises:[{name:'DB Bench',sets:3,min:8,max:12}]};
  const state={templates:[template],logs:[{date:prev,templateId:'upper',exerciseIndex:0,set:1,kg:20,reps:8,rpe:7}],
    metrics:[{date:day,recovery:4}],symptomLogs:[]};
  const selection={date:day,templateId:'upper',exerciseIndex:0,set:1};
  return {state,selection};
};
function journal(state,date) {
  for(const timepoint of ['before','after','next_day']) {
    state.symptomLogs.push({date,timepoint,templateId:null,exerciseIndex:null,
      severity:0,tingling:false,numbness:false,functionChange:'none',location:'none'});
  }
}
test('read-only candidate needs complete symptom journal',()=>{
  const {state,selection}=fixture();
  assert.equal(manualProgression(state,selection).candidate,null);
  journal(state,prev);
  const original=structuredClone(state);
  assert.deepEqual(manualProgression(state,selection).candidate,{kg:20,reps:9});
  assert.deepEqual(state,original);
});
test('recorded symptoms or uncertain recovery block candidate',()=>{
  const {state,selection}=fixture();journal(state,prev);
  state.symptomLogs[1].severity=1;
  assert.equal(manualProgression(state,selection).candidate,null);
  state.symptomLogs[1].severity=0;
  state.metrics[0].recovery=3;
  assert.equal(manualProgression(state,selection).candidate,null);
  state.metrics[0].recovery=4;state.logs[0].rpe=9;
  assert.equal(manualProgression(state,selection).candidate,null);
});
test('PT Review and exercises with timed holds do not progress',()=>{
  const {state,selection}=fixture();journal(state,prev);
  state.templates[0].requiresClinicalReview=true;
  assert.equal(manualProgression(state,selection).status,'pt-review');
  state.templates[0].requiresClinicalReview=false;
  state.templates[0].exercises[0].repUnit='seconds_per_side';
  assert.equal(manualProgression(state,selection).candidate,null);
});
test('top reps only produce manual load review after two supported sessions',()=>{
  const {state,selection}=fixture();journal(state,prev);
  state.logs[0].reps=12;
  assert.equal(manualProgression(state,selection).candidate,null);
  state.logs.push({...state.logs[0],date:'2026-10-12'});
  journal(state,'2026-10-12');
  const r=manualProgression(state,selection);
  assert.equal(r.status,'load-review');
  assert.equal(r.candidate,null);
});
test('wrong date/position or different exercise does not create history',()=>{
  const {state,selection}=fixture();
  assert.throws(()=>manualProgression(state,{...selection,set:9}),/valid exercise/);
  state.logs[0].exerciseIndex=1;
  assert.equal(manualProgression(state,selection).status,'no-history');
});
test('UI contains read-only context, no auto-fill controls',()=>{
  const {state,selection}=fixture();journal(state,prev);
  const view=manualProgressionPanel(state,selection);
  assert.match(view,/Optional next target/);
  assert.doesNotMatch(view,/<input|<button/);
});
