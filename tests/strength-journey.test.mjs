import test from "node:test";
import assert from "node:assert/strict";
import {getExerciseJourney, recommendNextExercise} from "../preview-v101/strength-journey.js";
import {recordSets, validateBackup} from "../preview-v101/core.js";
import {strengthDashboard, strengthNextSession} from "../preview-v101/strength-journey-ui.js";

const template = {id:"upper-a",name:"Upper A",day:0,exercises:[
  {name:"Flat DB Press",muscle:"Chest",sets:2,min:8,max:12,rest:90}
]};
const entry = (date,set,kg,reps,rpe=7,extra={}) => ({
  id:date+"-"+set, date,templateId:"upper-a",exerciseIndex:0,set,
  kg,reps,rpe,rest:90,notes:"",tempo:"",...extra
});
const observations = date => ["before","after","next_day"].map(timepoint => ({
  id:date+"-"+timepoint,date,timepoint,templateId:"upper-a",exerciseIndex:0,
  severity:0,tingling:false,numbness:false,functionChange:"none",location:"none",
  side:"none",notes:""
}));
const build = () => ({
  version:1,templates:[structuredClone(template)],assignments:{},
  logs:[
    entry("2026-10-30",1,12,12),entry("2026-10-30",2,12,12),
    entry("2026-11-01",1,12,12),entry("2026-11-01",2,12,12)
  ],symptomLogs:[...observations("2026-10-30"),...observations("2026-11-01")],
  metrics:[{date:"2026-11-03",recovery:5}],reminder:{hour:18,minute:30,lead:0},
  progressionStepKg:2
});
const choice = {date:"2026-11-03",templateId:"upper-a",exerciseIndex:0};

test("Day 1 counts only actual working sets; retains original workout identity",()=>{
  const data=build();
  data.logs.push({...entry("2026-10-29",1,25,5),kind:"warmup"});
  data.templates.push({...structuredClone(template),id:"new-version"});
  data.logs.push({...entry("2026-10-28",1,44,10),id:"other",templateId:"new-version"});
  const actual=getExerciseJourney(data,"upper-a",0);
  assert.equal(actual.day1,"2026-10-28");
  assert.deepEqual(actual.sessions.map(s=>s.date),["2026-10-30","2026-11-01"]);
  assert.equal(actual.calibrated.loadChange,0);
});

test("two full, recovered sessions and a confirmed increment suggest next load",()=>{
  const plan=recommendNextExercise(build(),choice);
  assert.equal(plan.status,"load");
  assert.deepEqual(plan.targets,[{set:1,kg:14,reps:8},{set:2,kg:14,reps:8}]);
});

test("one rep at a time before increasing kilograms",()=>{
  const data=build();
  for(const set of data.logs)if(set.date==="2026-11-01")set.reps=11;
  const plan=recommendNextExercise(data,choice);
  assert.equal(plan.status,"rep");
  assert.deepEqual(plan.targets,[{set:1,kg:12,reps:12},{set:2,kg:12,reps:12}]);
});

test("missing next-day feedback, current recovery or selected increment blocks increasing load",()=>{
  const noSymptoms=build();noSymptoms.symptomLogs=[];
  assert.equal(recommendNextExercise(noSymptoms,choice).status,"hold");
  const noRecovery=build();noRecovery.metrics=[];
  assert.equal(recommendNextExercise(noRecovery,choice).status,"hold");
  const noStep=build();delete noStep.progressionStepKg;
  assert.equal(recommendNextExercise(noStep,choice).status,"hold");
});

test("reported technique problems, high RPE and PT review never recommend escalation",()=>{
  const hard=build();
  hard.logs[3].technique="unstable";
  assert.equal(recommendNextExercise(hard,choice).status,"hold");
  const highRpe=build();
  highRpe.logs[3].rpe=9;
  assert.equal(recommendNextExercise(highRpe,choice).status,"hold");
  const pt=build();pt.templates[0].requiresClinicalReview=true;
  const plan=recommendNextExercise(pt,choice);
  assert.equal(plan.status,"pt-review");
  assert.deepEqual(plan.targets,[]);
});

test("saved feedback survives backup checks and invalid values are rejected",()=>{
  const data=build();
  const saved=recordSets(data,{
    date:"2026-11-03",templateId:"upper-a",exerciseIndex:0,
    entries:[
      {completed:true,kg:"14",reps:"8",rpe:"7",rest:"90",
        difficulty:"on_target",technique:"controlled"},
      {completed:false}
    ]
  },()=> "new-set");
  assert.equal(saved.state.logs.at(-1).technique,"controlled");
  assert.equal(validateBackup(saved.state).logs.at(-1).difficulty,"on_target");
  saved.state.logs.at(-1).technique="fabricated";
  assert.throws(()=>validateBackup(saved.state),/invalid technique/);
});

test("Dashboard displays saved-only graph; recommendations never appear as completed points",()=>{
  const html=strengthDashboard(build());
  assert.match(html,/Strength Journey/);
  assert.match(html,/2026-10-30/);
  assert.match(html,/12 kg/);
  assert.doesNotMatch(html,/14 kg/);
  const proposed=strengthNextSession(build(),choice);
  assert.match(proposed,/14 kg/);
  assert.match(proposed,/Save increment/);
});

test("unsafe labels are escaped in graph choices",()=>{
  const data=build();
  data.templates[0].exercises[0].name='<img src=x onerror=alert(1)>';
  const html=strengthDashboard(data);
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/&lt;img/);
});
