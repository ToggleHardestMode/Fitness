import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workoutBackupStatus, markWorkoutBackupChecked, persistentStorageStatus, requestPersistentStorage, WORKOUT_BACKUP_DATE_KEY} from '../preview-v101/backup-reminder.js';

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

// Behaviour change (D-058 amended 2026-11-08): retry after denial; no attempt key.
test('persistence status is read only and denied requests can be retried by a user', async () => {
  const s=store(); let granted=false,calls=0;
  const manager={
    persisted:async()=>granted,
    persist:async()=>{calls++;if(calls===2)granted=true;return granted;}
  };
  assert.equal(await persistentStorageStatus(manager),'not-granted');
  assert.equal(calls,0);
  assert.equal(await requestPersistentStorage(manager),'denied');
  assert.equal(await persistentStorageStatus(manager),'not-granted');
  assert.equal(await requestPersistentStorage(manager),'granted');
  assert.equal(await persistentStorageStatus(manager),'granted');
  assert.equal(calls,2);
  assert.equal(s.getItem('fitnesspilot.preview.v101.v1'),'unchanged workouts');
  assert.equal(s.getItem('fitnesspilot.preview.v101.foodDiary.v1'),'unchanged diary');
});

test('persistence unsupported, failing status checks, and failed requests are explicit', async () => {
  assert.equal(await persistentStorageStatus(null),'unsupported');
  assert.equal(await requestPersistentStorage(null),'unsupported');
  const manager={persisted:async()=>{throw Error('no access');},persist:async()=>{throw Error('blocked');}};
  assert.equal(await persistentStorageStatus(manager),'failed');
  assert.equal(await requestPersistentStorage(manager),'failed');
  assert.equal(await requestPersistentStorage(manager),'failed');
});

// Behaviour change (D-058 amended 2026-11-08): matching file itself records date.
// This wiring assertion guards the failure mode where iOS reloads after a download.
test('matching downloaded file auto-records backup date without a same-session export flag', () => {
  const app=readFileSync(new URL('../preview-v101/app.js', import.meta.url),'utf8');
  const changeHandler=app.slice(app.indexOf("if(target.id==='backup-check-file')"),app.indexOf("document.addEventListener('submit'"));
  assert.match(changeHandler,/resetBackupReady=!storageError && checked===current && localStorage\.getItem\(STORAGE_KEY\)===current/);
  assert.match(changeHandler,/if\(resetBackupReady\)\s*\{\s*try\s*\{\s*markWorkoutBackupChecked\(localStorage,today\(\)\)/);
  assert.match(changeHandler,/if\(file.size>8_000_000 \|\| !\/\\.json\$\/i\.test\(file.name\)\)/);
  assert.doesNotMatch(app,/backupExportPending|backup-check-confirm/);
  const exportAction=app.slice(app.indexOf("if(act==='backup-export')"),app.indexOf("if(act==='storage-persist')"));
  assert.doesNotMatch(exportAction,/markWorkoutBackupChecked/);
  assert.match(app, /id="storage-persistence-status"/);
  assert.match(app,/persistentStorageStatus\(navigator\.storage\)/);
});

test('automatic checked date is retained across a fresh app session and does not alter records', () => {
  const s=store();
  markWorkoutBackupChecked(s,'2026-11-08');
  const secondSession=workoutBackupStatus(s,'2026-11-08');
  assert.equal(secondSession.label,'Last checked workout backup: today.');
  assert.equal(secondSession.due,false);
  assert.equal(s.getItem('fitnesspilot.preview.v101.v1'),'unchanged workouts');
  assert.equal(s.getItem('fitnesspilot.preview.v101.foodDiary.v1'),'unchanged diary');
});
