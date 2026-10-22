import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState as prodEmpty, parseWorkouts as parseProd, addWorkouts as addProd } from '../core.js';
import { emptyState, addWorkouts, validateBackup } from '../preview-v101/core.js';
import { templatesFromBackup } from '../preview-v101/template-transfer.js';

const source = () => {
  const csv = 'day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds\n'
    + 'Mon,Upper A,DB Bench Press,Chest,3,8,12,90\n'
    + 'Tue,Lower A,Goblet Squat,Quads,2,8,12,120';
  const s = addProd(prodEmpty(), parseProd(csv), false, (() => {let n=0;return ()=>`prod-${++n}`;})()).state;
  s.assignments[0] = s.templates[0].id;
  const t=s.templates[0], ex=t.exercises[0];
  s.logs.push({id:'sensitive-log',date:'2026-10-20',templateId:t.id,exerciseIndex:0,
    exerciseName:ex.name,muscle:ex.muscle,set:1,kg:20,reps:8,rpe:null,rest:90,notes:'private note',tempo:''});
  s.metrics.push({date:'2026-10-20',weight:90,calories:null,protein:null,sleep:null,recovery:null});
  return s;
};

test('production backup is accepted without importing private history', () => {
  const prod = source();
  const templates=templatesFromBackup(prod);
  assert.equal(templates.length,2);
  assert.equal(templates[0].name,'Upper A');
  assert.equal(templates[0].id,undefined);
  assert.equal(templates[1].requiresClinicalReview,true);
  const dest=emptyState();
  const imported=addWorkouts(dest,templates,false,(()=>{let n=0;return ()=>`preview-${++n}`;})());
  assert.equal(imported.added,2);
  assert.equal(imported.state.logs.length,0);
  assert.equal(imported.state.metrics.length,0);
  assert.deepEqual(imported.state.assignments,{});
  assert.equal(JSON.stringify(imported.state).includes('private note'),false);
  assert.deepEqual(prod.assignments,{'0':'prod-1'});
  assert.equal(prod.logs.length,1);
  assert.doesNotThrow(()=>validateBackup(imported.state));
});

test('repeated import skips existing templates and preserves preview logs and schedule', () => {
  const templates=templatesFromBackup(source());
  const first=addWorkouts(emptyState(),templates,false,(()=>{let n=0;return ()=>`fp-${++n}`;})()).state;
  first.assignments[0]=first.templates[0].id;
  first.logs.push({id:'existing',date:'2026-10-20',templateId:first.templates[0].id,exerciseIndex:0,
    exerciseName:'DB Bench Press',muscle:'Chest',set:1,kg:18,reps:9,rpe:null,rest:90,notes:'',tempo:''});
  const next=addWorkouts(first,templates,false);
  assert.equal(next.added,0);
  assert.equal(next.skipped,2);
  assert.deepEqual(next.state.logs,first.logs);
  assert.deepEqual(next.state.assignments,first.assignments);
});

test('malformed production backup is rejected without accepting any template', () => {
  const s=source();
  s.logs[0].kg=Number.NaN;
  assert.throws(()=>templatesFromBackup(s),/Kilograms/);
  assert.throws(()=>templatesFromBackup({templates:[]}),/compatible FitnessPilot backup/);
});

test('lower-body exercise muscle is flagged even without lower in template title', () => {
  const s=source();
  s.templates[1].name='Tuesday Session';
  const templates=templatesFromBackup(s);
  assert.equal(templates[1].requiresClinicalReview,true);
});
