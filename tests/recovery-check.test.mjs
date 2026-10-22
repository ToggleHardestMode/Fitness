import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateBackup,parseWorkouts,addWorkouts,recordSets,saveMetrics} from '../preview-v101/core.js';
import {verifyLocalSnapshot} from '../preview-v101/recovery-check.js';

function fixture(){
 let n=0;
 const csv='day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds\nMon,Upper A,DB Bench Press,Chest,3,8,12,90';
 let state=addWorkouts(emptyState(),parseWorkouts(csv),false,()=>`test-${++n}`).state;
 state.assignments[0]=state.templates[0].id;
 state=recordSets(state,{date:'2026-10-19',templateId:state.templates[0].id,exerciseIndex:0,
   entries:[{completed:true,kg:20,reps:10,rpe:7,rest:90,tempo:'',notes:''},
            {completed:false},{completed:false}]},()=>`log-${++n}`).state;
 state=saveMetrics(state,'2026-10-19',{weight:88,calories:'',protein:'',sleep:'',recovery:4});
 return state;
}

test('backup validation survives serialization without mutating saved state',()=>{
 const state=fixture(),before=JSON.stringify(state),report=verifyLocalSnapshot(state,before);
 assert.deepEqual(report,{templates:1,sets:1,checkins:1,symptoms:0,assignments:1});
 assert.equal(JSON.stringify(state),before);
 assert.deepEqual(validateBackup(JSON.parse(before)),state);
});

test('missing or malformed storage is rejected without replacing any records',()=>{
 const state=fixture(),before=JSON.stringify(state);
 assert.throws(()=>verifyLocalSnapshot(state,null),/No saved browser snapshot/);
 assert.throws(()=>verifyLocalSnapshot(state,'{invalid'),/not valid JSON/);
 assert.equal(JSON.stringify(state),before);
});

test('stale or different persisted storage is detected',()=>{
 const state=fixture(),bad=structuredClone(state);bad.logs[0].kg=22;
 assert.throws(()=>verifyLocalSnapshot(state,JSON.stringify(bad)),/differs from the visible workout data/);
});

test('malformed backup cannot pass validation',()=>{
 const state=fixture(),bad=structuredClone(state);
 bad.logs[0].set=5;
 assert.throws(()=>verifyLocalSnapshot(state,JSON.stringify(bad)),/Set number/);
});

test('older backup without symptomLogs remains compatible',()=>{
 const state=fixture();
 delete state.symptomLogs;
 assert.equal(verifyLocalSnapshot(state,JSON.stringify(state)).sets,1);
});
