import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyState, validateBackup } from '../preview-v101/core.js';

function sample() {
  const state = emptyState();
  state.templates = [{ id: 'fixture-upper', name: 'Fixture Upper', day: 0, exercises: [
    { name: 'Fixture Press', muscle: 'Chest', sets: 2, min: 8, max: 12, rest: 90 }
  ] }];
  state.assignments = { 0: 'fixture-upper' };
  state.logs = [{ id: 'fixture-set', date: '2026-10-19', templateId: 'fixture-upper',
    exerciseIndex: 0, set: 1, kg: 10, reps: 8, rpe: 7 }];
  state.metrics = [{ date: '2026-10-19', weight: 90 }];
  state.symptomLogs = [];
  return state;
}

function withFile(callback) {
  const folder = mkdtempSync(join(tmpdir(), 'fitnesspilot-backup-'));
  const path = join(folder, 'fixture.json');
  try { callback(path); } finally { rmSync(folder, { recursive: true, force: true }); }
}

test('download-format JSON survives a file write, independent read and validation', () => {
  withFile(path => {
    const original = sample();
    writeFileSync(path, JSON.stringify(original, null, 2) + '\n', 'utf8');
    const restored = validateBackup(JSON.parse(readFileSync(path, 'utf8')));
    assert.deepEqual(restored, original);
    assert.notStrictEqual(restored, original);
    restored.logs[0].reps = 12;
    assert.equal(original.logs[0].reps, 8);
  });
});

test('truncated exported file is rejected', () => {
  withFile(path => {
    writeFileSync(path, JSON.stringify(sample()).slice(0, 80), 'utf8');
    assert.throws(() => validateBackup(JSON.parse(readFileSync(path, 'utf8'))), SyntaxError);
  });
});

test('a downloaded file with duplicate set entries is rejected', () => {
  withFile(path => {
    const state = sample();
    state.logs.push({ ...state.logs[0], id: 'second-id' });
    writeFileSync(path, JSON.stringify(state), 'utf8');
    assert.throws(() => validateBackup(JSON.parse(readFileSync(path, 'utf8'))), /duplicate sets/);
  });
});

test('a downloaded file referencing a missing workout is rejected', () => {
  withFile(path => {
    const state = sample();
    state.logs[0].templateId = 'missing-template';
    writeFileSync(path, JSON.stringify(state), 'utf8');
    assert.throws(() => validateBackup(JSON.parse(readFileSync(path, 'utf8'))), /missing workout/);
  });
});
