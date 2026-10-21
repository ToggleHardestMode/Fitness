import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyTrainingAnalysis,recoveryReview} from '../training-analytics.js';

const templates=[
 {id:'upper',name:'Upper A',day:0,exercises:[
  {name:'Press',muscle:'Chest',sets:2},{name:'Curl',muscle:'Arms',sets:2}]},
 {id:'lower',name:'Lower B [PT Review]',day:4,requiresClinicalReview:true,exercises:[
  {name:'Split squat',muscle:'Quads',sets:2},{name:'Side plank (seconds/side)',muscle:'Core',sets:2,repUnit:'seconds_per_side'}]}
];
const set=(date,id,index,num,more={})=>({date,templateId:id,exerciseIndex:index,set:num,kg:10,reps:10,...more});
const sample=()=>({templates:structuredClone(templates),assignments:{0:'upper',4:'lower'},logs:[
 set('2026-10-19','upper',0,1),set('2026-10-19','upper',0,2),
 set('2026-10-19','upper',1,1),set('2026-10-19','upper',1,2,{isWarmup:true}),
 set('2026-10-23','lower',0,1),set('2026-10-23','lower',1,1,{kg:0,reps:20}),
 set('2026-10-23','lower',1,2,{kg:0,reps:25}),
 set('2026-10-22','upper',0,1),
]});
const symptom=(point,changes={})=>({date:'2026-10-23',timepoint:point,templateId:'lower',exerciseIndex:null,
 side:'left',location:'buttock',severity:2,numbness:false,tingling:true,functionChange:'none',...changes});

test('assigned planned vs recorded working sets and off-plan sets',()=>{
 const a=weeklyTrainingAnalysis(sample(),'2026-10-19');
 assert.equal(a.planned,8); assert.equal(a.completed,7); assert.equal(a.assignedCompleted,6);assert.equal(a.offPlan,1);
 assert.equal(a.days[0].status,'partial'); assert.equal(a.days[3].status,'off_plan_logged');
 assert.equal(a.days[4].status,'partial');
});
test('direct muscle categories are counted once per logged unilateral or ordinary set',()=>{
 const a=weeklyTrainingAnalysis(sample(),'2026-10-19');
 assert.deepEqual(a.byMuscle,{Chest:{planned:2,completed:3},Arms:{planned:2,completed:1},Quads:{planned:2,completed:1},Core:{planned:2,completed:2}});
 assert.equal(a.byMuscle.Biceps,undefined);
});
test('isometric seconds are separate from reps/tonnage',()=>{
 const a=weeklyTrainingAnalysis(sample(),'2026-10-19');
 assert.deepEqual(a.timedHolds.map(h=>h.secondsPerSide),[20,25]);
 assert.equal(a.loadVolume,500);
});
test('not importing or assigning V10.1 never pretends its sets were performed',()=>{
 const a=weeklyTrainingAnalysis({templates,assignments:{},logs:[]},'2026-10-19');
 assert.equal(a.planned,0);assert.equal(a.completed,0);assert.deepEqual(a.byMuscle,{});
});
test('unassigned but actually logged sets count as off-plan not programmed',()=>{
 const a=weeklyTrainingAnalysis({templates,assignments:{},logs:[set('2026-10-23','lower',0,1)]},'2026-10-19');
 assert.equal(a.planned,0);assert.equal(a.completed,1);assert.equal(a.offPlan,1);
});
test('duplicate log fixture cannot inflate set counts',()=>{
 const state=sample();state.logs.push({...state.logs[0],id:'duplicated'});
 assert.equal(weeklyTrainingAnalysis(state,'2026-10-19').completed,7);
});
test('unknown response is not symptom-free',()=>{
 const r=recoveryReview(sample(),'2026-10-23','2026-10-25','lower');
 assert.equal(r.level,'unknown');assert.match(r.message,/unknown/);
});
test('follow-up absent after the next morning is flagged',()=>{
 const state=sample();state.symptomLogs=[symptom('before'),symptom('after')];
 const r=recoveryReview(state,'2026-10-23','2026-10-25','lower');
 assert.equal(r.level,'followup_missing');assert.deepEqual(r.missing,['next_day']);
});
test('distal symptoms or higher severity block progression suggestions',()=>{
 const state=sample();state.symptomLogs=[symptom('before'),symptom('next_day',{location:'foot',severity:4})];
 assert.equal(recoveryReview(state,'2026-10-23','2026-10-25','lower').level,'hold');
});
test('new weakness calls for clinical review',()=>{
 const state=sample();state.symptomLogs=[symptom('after',{functionChange:'new_weakness'})];
 assert.equal(recoveryReview(state,'2026-10-23','2026-10-25','lower').level,'medical_review');
});
test('stable completed observations never imply clearance',()=>{
 const state=sample();state.symptomLogs=[symptom('before'),symptom('after'),symptom('next_day')];
 const r=recoveryReview(state,'2026-10-23','2026-10-25','lower');
 assert.equal(r.level,'observed');assert.match(r.message,/not clinical clearance/);
});
test('analytics does not modify input records',()=>{
 const s=sample(), before=structuredClone(s);
 weeklyTrainingAnalysis(s,'2026-10-19');recoveryReview(s,'2026-10-23','2026-10-25','lower');
 assert.deepEqual(s,before);
});
test('recorded calf/foot symptoms require review even without a comparable baseline',()=>{
 const state=sample();state.symptomLogs=[symptom('after',{location:'foot',severity:3})];
 const result=recoveryReview(state,'2026-10-23','2026-10-25','lower');
 assert.equal(result.level,'review');
 assert.match(result.message,/clinical review/);
});
test('working-set counting ignores explicitly tagged warm-ups, including kind warmup',()=>{
 const state=sample();state.logs.push(set('2026-10-19','upper',1,2,{kind:'warmup'}));
 assert.equal(weeklyTrainingAnalysis(state,'2026-10-19').completed,7);
});