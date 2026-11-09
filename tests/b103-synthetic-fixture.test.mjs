import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordSets, validateBackup } from '../preview-v101/core.js';

const completed = JSON.parse(readFileSync(
  new URL('../qa/seeded-browser/fixtures/b103_30_complete.json', import.meta.url),
  'utf8'
));
const day = '2026-11-09';
const templateId = 'b103-fictional-30-set-plan';

test('B103 committed synthetic fixture is a valid complete 30-set backup', () => {
  assert.deepEqual(validateBackup(completed), completed);
  assert.equal(completed.templates.length, 1);
  assert.equal(completed.templates[0].exercises.length, 10);
  assert.equal(completed.logs.length, 30);
  const identities = new Set();
  for (const row of completed.logs) {
    assert.equal(row.date, day);
    assert.equal(row.templateId, templateId);
    assert.equal(row.exerciseName, completed.templates[0].exercises[row.exerciseIndex].name);
    assert.equal(row.kg, 10);
    assert.equal(row.reps, 10);
    assert.equal(row.rpe, 7);
    identities.add(`${row.exerciseIndex}:${row.set}`);
  }
  assert.equal(identities.size, 30);
});

test('B103 fixture reproduces exactly through the real recordSets function', () => {
  let state = { ...completed, logs: [] };
  for (let index = 0; index < 10; index++) {
    let id = 0;
    const entries = Array.from({ length: 3 }, () => ({
      completed: true, kg: 10, reps: 10, rpe: 7, rest: 90,
      notes: '', tempo: ''
    }));
    const result = recordSets(state, {
      date: day, templateId, exerciseIndex: index, entries
    }, () => `b103-set-${index + 1}-${++id}`);
    assert.equal(result.saved, 3);
    state = result.state;
  }
  assert.deepEqual(state, completed);
});

test('B103 duplicated synthetic set identity is rejected by backup validation', () => {
  const copy = structuredClone(completed);
  copy.logs.push({ ...copy.logs[0], id: 'b103-duplicate-id' });
  assert.throws(() => validateBackup(copy), /duplicate sets/i);
});
