import test from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_RPE, stepReps, chooseRpe } from '../preview-v101/focus-quick-entry.js';

test('repetition shortcuts adjust editable values by exactly one', () => {
  assert.equal(stepReps('10', 1), '11');
  assert.equal(stepReps('11', -1), '10');
  assert.equal(stepReps('1', 1), '2');
  assert.equal(stepReps('99', 1), '100');
  assert.deepEqual(QUICK_RPE, [6, 7, 8, 9]);
});

test('blank, invalid and out-of-bounds repetitions cannot be auto-filled', () => {
  for (const value of ['', '0', '101', '8.5', 'abc', '-2', 'NaN', 'Infinity']) {
    assert.throws(() => stepReps(value, 1));
  }
  assert.throws(() => stepReps('100', 1), /between 1 and 100/);
  assert.throws(() => stepReps('1', -1), /between 1 and 100/);
  assert.throws(() => stepReps('10', 2), /\+1 or -1/);
});

test('RPE quick choices allow only named presets; no automatic saving', () => {
  assert.equal(chooseRpe('6'), '6');
  assert.equal(chooseRpe(7), '7');
  assert.equal(chooseRpe('8'), '8');
  assert.equal(chooseRpe('9'), '9');
  for (const invalid of [0, 5, 10, '7.5', '', 'abc', null]) {
    assert.throws(() => chooseRpe(invalid));
  }
});

test('shortcuts do not require or mutate a log state object', () => {
  const old = Object.freeze({ logs: Object.freeze([{ id: 'test', reps: 8, rpe: 7 }]) });
  assert.equal(stepReps('8', 1), '9');
  assert.equal(chooseRpe(8), '8');
  assert.deepEqual(old.logs, [{ id: 'test', reps: 8, rpe: 7 }]);
});
