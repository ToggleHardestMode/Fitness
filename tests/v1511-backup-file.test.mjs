import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { emptyState, validateBackup } from '../preview-v101/core.js';

function sample() {
  const state = emptyState();
  state.templates = [{id:'fixture-upper',name:'Fixture Upper',day:0,
    exercises:[{name:'Press',muscle:'Chest',sets:2,min:8,max:12,rest:90}]}];
  state.assignments = {0:'fixture-upper'};
  state.logs = [{id:'fixture-set-1',date:'2026-10-19',templateId:'fixture-upper',
    exerciseIndex:0,set:1,kg:12,reps:10,rpe:7,rest:90,notes:'synthetic'}];
  state.metrics = [{date:'2026-10-19',weight:90,protein:150,calories:2200,sleep:7,recovery:4}];
  state.symptomLogs = [];
  return state;
}

function withTemporaryFile(run) {
  const directory = mkdtempSync(join(tmpdir(),'fitnesspilot-backup-check-'));
  const path = join(directory,'disposable-backup.json');
  try { run(path); } finally { rmSync(directory,{recursive:true,force:true}); }
}

test('exported JSON file round trips through the real backup validator', () => {
  withTemporaryFile(path => {
    const original = validateBackup(sample());
    writeFileSync(path,JSON.stringify(original,null,2)+'\n','utf8');
    const imported = validateBackup(JSON.parse(readFileSync(path,'utf8')));
    assert.deepEqual(imported,original);
    assert.equal(imported.logs.length,1);
    assert.equal(imported.assignments[0],'fixture-upper');
  });
});

test('invalid downloaded JSON cannot become valid workout state', () => {
  withTemporaryFile(path => {
    writeFileSync(path,'{ not JSON','utf8');
    assert.throws(()=>validateBackup(JSON.parse(readFileSync(path,'utf8'))),SyntaxError);
  });
});

test('duplicate set records in a file are rejected rather than silently accepted', () => {
  withTemporaryFile(path => {
    const state=sample();
    state.logs.push({...state.logs[0],id:'fixture-set-2'});
    writeFileSync(path,JSON.stringify(state),'utf8');
    assert.throws(()=>validateBackup(JSON.parse(readFileSync(path,'utf8'))),/duplicate sets/);
  });
});

test('a missing template referenced by saved history is rejected', () => {
  withTemporaryFile(path => {
    const state=sample();
    state.templates=[];
    state.assignments={};
    writeFileSync(path,JSON.stringify(state),'utf8');
    assert.throws(()=>validateBackup(JSON.parse(readFileSync(path,'utf8'))),/missing workout/);
  });
});
