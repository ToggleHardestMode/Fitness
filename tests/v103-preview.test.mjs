import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {V103_CSV,V103_VERSION,v103Templates} from '../preview-v101/v103-data.js';
import {addWorkouts,emptyState,validateBackup} from '../preview-v101/core.js';
import {generateOneSetCoverage} from '../preview-v101/return-coverage.js';

const idFactory=()=>{let n=0;return()=> 'v103-test-'+(++n);};

test('embedded V10.3 CSV matches the canonical committed workout file byte for byte',()=>{
  const raw=readFileSync(new URL('../templates/V10.3_Home_FitnessPilot_Import.csv',import.meta.url),'utf8');
  assert.equal(V103_CSV,raw);
});

test('V10.3 exact four-day plan has 27 exercises and 56 sets with 17/10/20/9 split',()=>{
  const templates=v103Templates();
  assert.deepEqual(templates.map(t=>[t.day,t.exercises.length,t.exercises.reduce((sum,e)=>sum+e.sets,0)]),
    [[0,7,17],[3,9,20],[1,6,10],[4,5,9]]);
  assert.equal(templates.reduce((sum,t)=>sum+t.exercises.reduce((n,e)=>n+e.sets,0),0),56);
  assert.ok(templates.every(t=>t.sourceVersion===V103_VERSION));
});

test('V10.3 source equipment/rest/notes, unilateral semantics and seconds-per-side hold survive',()=>{
  const templates=v103Templates(),upperA=templates[0],upperB=templates[1],lowerB=templates[3];
  assert.ok(templates.every(t=>t.exercises.every(e=>e.sourceNote&&e.equipment&&Number.isInteger(e.rest))));
  const pulldown=upperA.exercises.find(e=>e.name==='Neutral Close-Grip Lat Pulldown');
  assert.equal(pulldown.sets,2);
  assert.match(pulldown.equipment,/Cable weight stack; log kg shown on stack/);
  assert.match(upperB.exercises.find(e=>e.name.includes('One-Arm DB Row')).sourceNote,/one set = both arms/i);
  assert.equal(lowerB.exercises.find(e=>e.name.includes('Side Plank')).repUnit,'seconds_per_side');
  assert.equal(upperA.exercises.find(e=>e.name.includes('Supinating Curl')).muscleDetail,'Biceps');
  assert.equal(upperB.exercises.find(e=>e.name.includes('Overhead Triceps')).muscleDetail,'Triceps');
});

test('lower V10.3 workouts remain PT review and unassigned; source labels preserved',()=>{
  const source=v103Templates();
  assert.deepEqual(source.filter(t=>t.requiresClinicalReview).map(t=>t.day),[1,4]);
  for(const t of source.filter(t=>t.requiresClinicalReview)){
    assert.match(t.name,/\[PT Review\]/);
    assert.ok(t.exercises.every(e=>e.name.includes('[PT]')));
  }
  const out=addWorkouts(emptyState(),source,false,idFactory());
  assert.deepEqual(out.state.assignments,{});
  const optionalAuto=addWorkouts(emptyState(),source,true,idFactory());
  assert.deepEqual(Object.keys(optionalAuto.state.assignments).sort(),['0','3']);
});

test('V10.3 import skips identical old CSV, is append-only and preserves real saved configuration and logs',()=>{
  const state=emptyState();
  const old={id:'old-plan',day:0,name:'Archived sample',exercises:[{name:'Bench',muscle:'Chest',sets:2,min:8,max:12,rest:60}]};
  state.templates.push(old);state.assignments={0:'old-plan'};
  state.logs.push({id:'legacy-set',date:'2026-11-03',templateId:'old-plan',exerciseIndex:0,set:1,kg:10,reps:8,rpe:7});
  state.metrics.push({date:'2026-11-03',weight:80,calories:null,protein:null,sleep:null,recovery:null});
  const before=structuredClone(state),first=addWorkouts(state,v103Templates(),false,idFactory());
  assert.equal(first.added,4);assert.deepEqual(state,before);
  assert.deepEqual(first.state.logs,before.logs);assert.deepEqual(first.state.metrics,before.metrics);
  assert.deepEqual(first.state.assignments,before.assignments);
  assert.deepEqual(validateBackup(first.state),first.state);
  const repeat=addWorkouts(first.state,v103Templates(),false,idFactory());
  assert.equal(repeat.added,0);assert.equal(repeat.skipped,4);
  assert.deepEqual(repeat.state,first.state);
});

test('full V10.3 can generate Coverage-First as 16/37 upper sets, excluding 19 PT sets',()=>{
  const original=v103Templates(),snapshot=structuredClone(original);
  const stage=generateOneSetCoverage(original);
  assert.equal(stage.planned,16);
  assert.equal(stage.full,37);
  assert.equal(stage.percentage,43);
  assert.deepEqual(stage.workouts.map(t=>t.exercises.length),[7,9]);
  assert.equal(stage.excluded.reduce((sum,w)=>sum+w.planned,0),19);
  assert.deepEqual(original,snapshot);
});

test('V10.3 Plan UI requires preview, explicit confirmation and stale-record protection',()=>{
  const app=readFileSync(new URL('../preview-v101/app.js',import.meta.url),'utf8');
  for(const action of ['v103-preview','v103-apply','v103-cancel','v103-csv']){
    assert.match(app,new RegExp("data-action=\\\""+action+"\\\"|act==='"+action+"'"));
  }
  assert.match(app,/pendingV103=\{workouts:v103Templates\(\),snapshot:localStorage\.getItem\(STORAGE_KEY\)\}/);
  assert.match(app,/localStorage\.getItem\(STORAGE_KEY\)!==pending\.snapshot/);
  assert.match(app,/addWorkouts\(state,pending\.workouts,false\)/);
  assert.match(app,/if\(!confirm\(/);
  assert.match(app,/PT Review/);
});
