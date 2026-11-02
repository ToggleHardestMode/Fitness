import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateBackup,recordSets} from '../preview-v101/core.js';
import {verifiedSessions,exerciseChoices,saveStrengthFeedback,nextSessionTarget} from '../preview-v101/strength-journey.js';
import {previewDeviceMerge} from '../preview-v101/device-merge.js';

function specimen(name='Upper A') {
  const s=emptyState();
  s.templates=[{id:'upper-1',name,day:0,exercises:[{name:'Flat DB Bench',muscle:'Chest',sets:2,min:8,max:12,rest:90}]}];
  return s;
}
const set=(date,n,reps=12,kg=12,rpe=7)=>({
  id:date+'-set'+n,date,templateId:'upper-1',exerciseIndex:0,
  exerciseName:'Flat DB Bench',muscle:'Chest',set:n,reps,kg,rpe,rest:90,notes:'',tempo:''
});
function observe(s,date){
  s.symptomLogs ||= [];
  for(const timepoint of ['before','after','next_day'])
    s.symptomLogs.push({id:date+'-'+timepoint,date,timepoint,templateId:'upper-1',
      exerciseIndex:0,side:'none',location:'none',severity:0,tingling:false,
      numbness:false,functionChange:'none',notes:''});
}
function feedback(s,date){
  return saveStrengthFeedback(s,{date,templateId:'upper-1',exerciseIndex:0,
    difficulty:'target',technique:'good',nextDay:'good',note:'controlled'});
}
const options={templateId:'upper-1',exerciseIndex:0,nextDate:'2026-10-10',incrementsKg:[12,13,14]};

test('Day 1 includes saved working sets only, excludes warmups and duplicate date/set keys',()=>{
 const s=specimen();
 s.logs=[set('2026-10-01',1,10,10),{...set('2026-10-01',2,12,12),kind:'warmup'},
   set('2026-10-03',1,11,12)];
 const sessions=verifiedSessions(s,'upper-1',0);
 assert.deepEqual(sessions.map(x=>x.date),['2026-10-01','2026-10-03']);
 assert.deepEqual(sessions.map(x=>x.heaviest),[10,12]);
 assert.equal(sessions[0].rows.length,1);
 assert.equal(exerciseChoices(s)[0].sessions,2);
});

test('No data means no invented benchmark or candidate',()=>{
 const s=specimen();
 assert.equal(exerciseChoices(s).length,0);
 assert.equal(nextSessionTarget(s,options).candidate,null);
});
test('Feedback is saved in full backup schema and does not edit completed sets',()=>{
 let s=specimen();s.logs=[set('2026-10-01',1),set('2026-10-01',2)];
 const source=JSON.stringify(s.logs);
 s=feedback(s,'2026-10-01');
 assert.equal(s.strengthFeedback.length,1);
 assert.equal(JSON.stringify(s.logs),source);
 assert.doesNotThrow(()=>validateBackup(s));
});
test('Not-yet-next-day good response is disallowed',()=>{
 let s=specimen();s.logs=[set('2099-01-01',1),set('2099-01-01',2)];
 assert.throws(()=>saveStrengthFeedback(s,{date:'2099-01-01',templateId:'upper-1',exerciseIndex:0,
 difficulty:'target',technique:'good',nextDay:'good'}),/Next-day/);
});

test('Incomplete delayed observation prevents progression',()=>{
 let s=specimen();
 s.logs=[set('2026-10-03',1,10),set('2026-10-03',2,11)];
 s=feedback(s,'2026-10-03');
 s.metrics=[{date:'2026-10-10',recovery:5}];
 assert.match(nextSessionTarget(s,options).reason,/observations/);
});

test('Concerning symptoms prevent any load or repetition increase',()=>{
 let s=specimen();
 s.logs=[set('2026-10-03',1,10),set('2026-10-03',2,11)];
 observe(s,'2026-10-03');
 s.symptomLogs.find(x=>x.timepoint==='next_day').severity=4;
 s=feedback(s,'2026-10-03');
 s.metrics=[{date:'2026-10-10',recovery:5}];
 assert.equal(nextSessionTarget(s,options).candidate,null);
 assert.match(nextSessionTarget(s,options).reason,/Symptoms/);
});

test('Missing next-day score and high RPE block escalation',()=>{
 let s=specimen();
 s.logs=[set('2026-10-03',1,10,12,9),set('2026-10-03',2,10,12,9)];
 observe(s,'2026-10-03');s=feedback(s,'2026-10-03');
 assert.equal(nextSessionTarget(s,options).status,'hold');
 s.metrics=[{date:'2026-10-10',recovery:5}];
 assert.match(nextSessionTarget(s,options).reason,/RPE/);
});

test('Rep progression keeps load and respects every per-set ceiling',()=>{
 let s=specimen();
 s.logs=[set('2026-10-03',1,11),set('2026-10-03',2,12)];
 observe(s,'2026-10-03');s=feedback(s,'2026-10-03');
 s.metrics=[{date:'2026-10-10',recovery:5}];
 const out=nextSessionTarget(s,options);
 assert.equal(out.status,'reps');
 assert.deepEqual(out.candidate.map(x=>[x.kg,x.reps]),[[12,12],[12,12]]);
});
test('Load suggestion needs two fully checked top sessions and actual weights',()=>{
 let s=specimen();
 s.logs=[set('2026-10-01',1),set('2026-10-01',2),set('2026-10-03',1),set('2026-10-03',2)];
 observe(s,'2026-10-01');observe(s,'2026-10-03');
 s=feedback(feedback(s,'2026-10-01'),'2026-10-03');
 s.metrics=[{date:'2026-10-10',recovery:5}];
 assert.equal(nextSessionTarget(s,{...options,incrementsKg:[]}).candidate,null);
 const out=nextSessionTarget(s,options);
 assert.equal(out.status,'load');
 assert.deepEqual(out.candidate.map(x=>[x.kg,x.reps]),[[13,8],[13,8]]);
 assert.deepEqual(s.logs.map(x=>x.kg),[12,12,12,12]);
});
test('Increment above 10% threshold is blocked, never rounded silently',()=>{
 let s=specimen();
 s.logs=[set('2026-10-01',1),set('2026-10-01',2),set('2026-10-03',1),set('2026-10-03',2)];
 observe(s,'2026-10-01');observe(s,'2026-10-03');
 s=feedback(feedback(s,'2026-10-01'),'2026-10-03');
 s.metrics=[{date:'2026-10-10',recovery:5}];
 assert.match(nextSessionTarget(s,{...options,incrementsKg:[12,14]}).reason,/10%/);
});

test('Set edits make saved feedback stale until re-reviewed',()=>{
 let s=specimen();
 s.logs=[set('2026-10-03',1,10),set('2026-10-03',2,10)];
 observe(s,'2026-10-03');s=feedback(s,'2026-10-03');
 s.logs[0].reps=11;
 s.metrics=[{date:'2026-10-10',recovery:5}];
 assert.match(nextSessionTarget(s,options).reason,/changed/);
});
test('Lower-body PT and timed holds cannot receive load recommendations',()=>{
 for(const kind of ['lower','timed']){
  let s=specimen(kind==='lower'?'[PT Review] Lower A':'Upper A');
  if(kind==='timed')s.templates[0].exercises[0].repUnit='seconds_per_side';
  s.logs=[set('2026-10-03',1),set('2026-10-03',2)];
  assert.equal(nextSessionTarget(s,options).candidate,null);
 }
});

test('Disjoint device records merge without mutating either original',()=>{
 const a=specimen(), b=specimen();
 a.logs=[set('2026-10-01',1)];
 b.logs=[set('2026-10-03',1)];
 const beforeA=JSON.stringify(a),beforeB=JSON.stringify(b);
 const out=previewDeviceMerge(a,b);
 assert.equal(out.safe,true);
 assert.equal(out.merged.logs.length,2);
 assert.equal(JSON.stringify(a),beforeA);
 assert.equal(JSON.stringify(b),beforeB);
 assert.equal(out.summary.logs.added,1);
});

test('Identical records dedupe, but differing edits fail closed',()=>{
 const a=specimen(),b=specimen();
 a.logs=[set('2026-10-01',1)];b.logs=[set('2026-10-01',1)];
 assert.equal(previewDeviceMerge(a,b).merged.logs.length,1);
 b.logs[0].reps=9;
 const out=previewDeviceMerge(a,b);
 assert.equal(out.safe,false);
 assert.equal(out.merged,null);
 assert.equal(out.conflicts[0].collection,'logs');
});

test('Different schedules or reminder settings require explicit review',()=>{
 const a=specimen(),b=specimen();
 a.assignments={0:'upper-1'};b.assignments={};
 assert.equal(previewDeviceMerge(a,b).safe,false);
 b.assignments={0:'upper-1'};b.reminder.minute=45;
 assert.equal(previewDeviceMerge(a,b).safe,false);
});

test('A genuinely empty destination can import a whole original snapshot',()=>{
 const a=emptyState(),b=specimen();
 b.assignments={0:'upper-1'};b.logs=[set('2026-10-01',1)];
 b.reminder.minute=45;
 const out=previewDeviceMerge(a,b);
 assert.equal(out.safe,true);
 assert.equal(out.merged.logs.length,1);
 assert.equal(out.merged.reminder.minute,45);
});

test('Different versions and identities stay separate',()=>{
 const a=specimen(),b=specimen();
 a.templates[0].id='upper-v1';b.templates[0].id='upper-v2';
 const out=previewDeviceMerge(a,b);
 assert.equal(out.safe,true);
 assert.equal(out.merged.templates.length,2);
});
