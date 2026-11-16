import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { STORAGE_KEY, emptyState } from '../preview-v101/core.js';
import { loadWorkoutState, saveWorkoutState } from '../preview-v101/state.js';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
after(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

function installStorage(storage) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
}

test('workout state starts empty and reloads a saved record from the existing key', () => {
  const records = new Map();
  installStorage(records);
  records.getItem = key => records.get(key) ?? null;
  records.setItem = (key, value) => records.set(key, value);

  assert.deepEqual(loadWorkoutState(), { state: emptyState(), storageError: null });
  const next = { ...emptyState(), strengthJourneyStartDate: '2026-11-16' };
  assert.deepEqual(saveWorkoutState(next, null), next);
  assert.deepEqual([...records.keys()], [STORAGE_KEY]);
  assert.deepEqual(loadWorkoutState(), { state: next, storageError: null });
});

test('unreadable workout data remains locked and is never overwritten', () => {
  installStorage({
    getItem: () => '{invalid',
    setItem: () => assert.fail('Unreadable workout data must not be overwritten'),
  });

  const { state, storageError } = loadWorkoutState();
  assert.deepEqual(state, emptyState());
  assert.match(storageError, /Existing saved data could not be read/);
  assert.throws(() => saveWorkoutState(state, storageError), /Saved data is locked/);
});

test('a failed write reports the storage error and preserves the saved record', () => {
  const saved = JSON.stringify(emptyState());
  installStorage({
    getItem: () => saved,
    setItem: () => { throw new DOMException('Storage full', 'QuotaExceededError'); },
  });

  const next = { ...emptyState(), strengthJourneyStartDate: '2026-11-16' };
  assert.throws(() => saveWorkoutState(next, null), /Could not save locally \(QuotaExceededError\)/);
  assert.deepEqual(loadWorkoutState(), { state: emptyState(), storageError: null });
});
