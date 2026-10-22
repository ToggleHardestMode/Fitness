import test from 'node:test';
import assert from 'node:assert/strict';
import {workoutLogbook, workoutLogbookHtml, workoutLogbookCsv} from '../preview-v101/workout-logbook.js';

const state=()=>({
  templates:[
    {id:'v101',name:'Upper A',sourceVersion:'V10.1 Home',day:0,exercises:[
      {name:'Press',muscle:'Chest',sets:2,min:8,max:12,rest:90},
      {name:'Plank (seconds/side)',muscle:'Core',sets:1,min:20,max:30,rest:90,repUnit:'seconds_per_side'}]},
    {id:'custom',name:'Upper A · Custom 1',sourceVersion:'Custom',day:0,exercises:[
      {name:'Row',muscle:'Back',sets:2,min:8,max:12,rest:90}]}
  ],
  assignments:{0:'custom'}, logs:[
    {id:'1',date:'2026-10-18',templateId:'v101',exerciseIndex:0,set:1,kg:11,reps:12,rpe:7,notes:'First set'},
    {id:'2',date:'2026-10-18',templateId:'v101',exerciseIndex:0,set:2,kg:11,reps:11,rpe:null,notes:''},
    {id:'3',date:'2026-10-18',templateId:'v101',exerciseIndex:1,set:1,kg:0,reps:20,rpe:null,notes:''},
    {id:'4',date:'2026-10-20',templateId:'custom',exerciseIndex:0,set:1,kg:14,reps:10,rpe:8,notes:'Good form'}
  ]
});

test('historical sessions use original template IDs, not newly assigned versions',()=>{
  const s=state(),before=structuredClone(s);
  const report=workoutLogbook(s);
  assert.equal(report.totalSessions,2);
  assert.equal(report.totalSets,4);
  assert.deepEqual(report.sessions.map(x=>x.workout),['Upper A · Custom 1','Upper A']);
  assert.deepEqual(report.sessions.map(x=>x.version),['Custom','V10.1 Home']);
  assert.equal(report.sessions[1].volume,253);
  assert.equal(report.sessions[0].volume,140);
  assert.deepEqual(s,before);
});

test('timed holds and warm-ups do not inflate working-set count or kg times reps',()=>{
  const s=state();
  s.logs.push({id:'w',date:'2026-10-18',templateId:'v101',exerciseIndex:0,set:2,
    kg:20,reps:10,isWarmup:true,notes:'warm-up duplicate'});
  // Duplicate saved positions are ignored, independently of record order.
  const a=workoutLogbook(s);
  assert.equal(a.totalSets,4);
  assert.equal(a.sessions[1].volume,253);
  assert.equal(a.sessions[1].items.find(x=>x.unit==='seconds/side').reps,20);
  s.logs.pop();
  s.logs.push({id:'w',date:'2026-10-20',templateId:'custom',exerciseIndex:0,set:2,
    kg:5,reps:10,kind:'warmup'});
  const b=workoutLogbook(s);
  assert.equal(b.totalSets,4);
  assert.equal(b.sessions[0].items.length,2);
  assert.equal(b.sessions[0].items[1].warmup,true);
  assert.equal(b.sessions[0].volume,140);
});

test('escaped HTML keeps notes and exercise names as text, never markup',()=>{
  const s=state();
  s.logs[0].notes='<img src=x onerror=alert(1)>';
  s.templates[0].exercises[0].name='<script>x</script>';
  const html=workoutLogbookHtml(s);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/&lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>|<img/);
});

test('CSV preserves all historical set details and blocks spreadsheet formulas',()=>{
  const s=state();
  s.logs[0].notes='=HYPERLINK("https://example.test","Click")';
  s.templates[0].exercises[0].name='-SUM(1,1)';
  const csv=workoutLogbookCsv(s);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.trim().split('\r\n').length,5);
  assert.ok(csv.includes('"\'-SUM(1,1)"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.test"",""Click"")"'));
  assert.ok(csv.includes('"seconds/side"'));
  assert.ok(csv.includes('"V10.1 Home"'));
});

test('only latest 15 sessions are rendered; CSV exports all without cap',()=>{
  const s=state();
  s.logs=[];
  for(let day=0;day<115;day++){
    const date=new Date(Date.UTC(2026,0,1+day)).toISOString().slice(0,10);
    s.logs.push({id:String(day),date,templateId:'v101',exerciseIndex:0,set:1,kg:10,reps:10,rpe:7});
  }
  const report=workoutLogbook(s);
  assert.equal(report.totalSessions,115);
  assert.equal(report.sessions.length,15);
  assert.equal(report.totalSets,115);
  const html=workoutLogbookHtml(s);
  assert.match(html,/Showing 15 of 115/);
  assert.equal(workoutLogbookCsv(s).split('\r\n').length,117);
});

test('corrupt references and duplicate positions cannot create phantom session totals',()=>{
  const s=state();
  s.logs.push({...s.logs[0],id:'duplicate'});
  s.logs.push({id:'missing',date:'2026-10-21',templateId:'none',exerciseIndex:0,set:1,kg:30,reps:10});
  s.logs.push({id:'bad-set',date:'2026-10-21',templateId:'v101',exerciseIndex:0,set:99,kg:30,reps:10});
  const report=workoutLogbook(s);
  assert.equal(report.totalSets,4);
  assert.equal(report.totalSessions,2);
  assert.equal(workoutLogbookCsv(s).split('\r\n').length,6);
});

test('no history shows an empty state; invalid limits fail',()=>{
  const s=state();s.logs=[];
  assert.match(workoutLogbookHtml(s),/No workout sets saved/);
  assert.throws(()=>workoutLogbook(s,0),/1–100/);
});
