import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workoutBackupStatus, markWorkoutBackupChecked, requestPersistentStorageOnce, WORKOUT_BACKUP_DATE_KEY} from '../preview-v101/backup-reminder.js';

function store() {
  const values = new Map([['fitnesspilot.preview.v101.v1', 'unchanged workouts'], ['fitnesspilot.preview.v101.foodDiary.v1', 'unchanged diary']]);
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('workout backup reminder starts due and nudges only after seven local calendar days', () => {
  const s = store();
  assert.equal(workoutBackupStatus(s, '2026-11-08').due, true);
  markWorkoutBackupChecked(s, '2026-11-01');
  assert.deepEqual(workoutBackupStatus(s, '2026-11-07'), {due:false, days:6, label:'Last checked workout backup: 6 days ago.'});
  assert.deepEqual(workoutBackupStatus(s, '2026-11-08'), {due:true, days:7, label:'Last checked workout backup: 7 days ago.'});
  assert.equal(s.getItem('fitnesspilot.preview.v101.v1'), 'unchanged workouts');
  assert.equal(s.getItem('fitnesspilot.preview.v101.foodDiary.v1'), 'unchanged diary');
});

test('malformed or future backup dates never falsely reassure', () => {
  const s = store();
  for (const date of ['2026-02-30', 'not a date', '2026-11-09']) {
    s.setItem(WORKOUT_BACKUP_DATE_KEY, date);
    const status = workoutBackupStatus(s, '2026-11-08');
    assert.equal(status.due, true);
    assert.equal(status.days, null);
  }
  assert.throws(() => markWorkoutBackupChecked(s, '2026-02-30'), /Invalid current backup date/);
});

test('metadata storage failure cannot change workout or diary data', () => {
  const s = store();
  s.setItem = () => { throw Error('quota'); };
  assert.throws(() => markWorkoutBackupChecked(s, '2026-11-08'), /Could not save/);
  assert.equal(s.getItem('fitnesspilot.preview.v101.v1'), 'unchanged workouts');
  assert.equal(s.getItem('fitnesspilot.preview.v101.foodDiary.v1'), 'unchanged diary');
});

test('persistence request is initiated at most once per storage context', async () => {
  const s = store(); let calls = 0;
  const manager = {persist:async () => { calls++; return false; }};
  assert.equal(await requestPersistentStorageOnce(s, manager), 'denied');
  assert.equal(await requestPersistentStorageOnce(s, manager), 'already-requested');
  assert.equal(calls, 1);
  assert.equal(await requestPersistentStorageOnce(s, null), 'unsupported');
  assert.equal(s.getItem('fitnesspilot.preview.v101.v1'), 'unchanged workouts');
});

test('failed persistence request does not retry without user changing browser data', async () => {
  const s = store(); let calls = 0;
  const manager = {persist:async () => { calls++; throw Error('browser refused'); }};
  assert.equal(await requestPersistentStorageOnce(s, manager), 'failed');
  assert.equal(await requestPersistentStorageOnce(s, manager), 'already-requested');
  assert.equal(calls, 1);
});

test('preview only shows checked date after matching-file gate and not after download alone', () => {
  // Integration contract: the existing downloaded JSON checker gates confirmation.
  const app = readFileSync(new URL('../preview-v101/app.js', import.meta.url), 'utf8');
  assert.match(app, /if\(act==='backup-check-confirm'\)/);
  assert.match(app, /if\(!backupExportPending\|\|!resetBackupReady\)throw Error/);
  assert.match(app, /markWorkoutBackupChecked\(localStorage,today\(\)\)/);
  assert.match(app, /if\(act==='backup-export'\)/);
  assert.match(app, /backupExportPending=true/);
});
