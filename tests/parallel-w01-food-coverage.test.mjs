import test from 'node:test';
import assert from 'node:assert/strict';
import {foodCoverageMissingness} from '../preview-v101/feature-labs/food-coverage.js';

const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
function snapshot(changes = {}) {
  const days = dates.map((date, index) => ({date, entries: 0, knownKcal: 0, unknownKcal: 0, ...(changes[index] ?? {})}));
  return {
    id: 'food.entry_coverage_week.v1', unit: 'days', source: 'food_diary',
    status: 'recording_coverage_only', completeness: 'not_verified', nutritionAdherence: null,
    from: dates[0], to: dates[6], periodDays: 7,
    value: days.filter(d => d.entries > 0).length,
    numericDays: days.filter(d => d.knownKcal > 0).length,
    daysWithUnknownKcal: days.filter(d => d.unknownKcal > 0).length, days
  };
}

test('seven unlogged dates are missing records, not zero intake or adherence', () => {
  const output = foodCoverageMissingness(snapshot());
  assert.equal(output.loggedDays, 0);
  assert.equal(output.daysWithoutEntries, 7);
  assert.ok(output.days.every(d => d.state === 'no_entries'));
  assert.equal(output.nutritionAdherence, null);
  assert.equal(output.completeness, 'not_verified');
  assert.match(output.interpretation, /not no food was eaten/);
});

test('known zero kcal is a present value, distinct from unknown kcal', () => {
  const out = foodCoverageMissingness(snapshot({0: {entries: 1, knownKcal: 1, unknownKcal: 0}}));
  assert.equal(out.days[0].state, 'kcal_values_present');
  assert.equal(out.kcalUnknownEntries, 0);
  assert.equal(out.daysWithoutEntries, 6);
  assert.equal(out.completeness, 'not_verified');
});

test('all-unknown and partially-known kcal are distinct evidence states', () => {
  const out = foodCoverageMissingness(snapshot({
    0: {entries: 2, knownKcal: 0, unknownKcal: 2},
    2: {entries: 3, knownKcal: 2, unknownKcal: 1},
    6: {entries: 1, knownKcal: 1, unknownKcal: 0}
  }));
  assert.equal(out.loggedDays, 3);
  assert.equal(out.daysWithoutEntries, 4);
  assert.equal(out.daysWithOnlyUnknownKcal, 1);
  assert.equal(out.daysWithSomeUnknownKcal, 1);
  assert.equal(out.kcalUnknownEntries, 3);
  assert.deepEqual([out.days[0].state, out.days[2].state, out.days[6].state],
    ['all_kcal_unknown', 'some_kcal_unknown', 'kcal_values_present']);
  assert.equal(out.nutritionAdherence, null);
});

test('read-only output does not mutate input or borrow mutable day objects', () => {
  const input = snapshot({3: {entries: 1, knownKcal: 1}});
  const before = structuredClone(input);
  const out = foodCoverageMissingness(input);
  out.days[3].entries = 999;
  assert.deepEqual(input, before);
});

test('dates crossing leap day are contiguous calendar days', () => {
  const datesBackup = [...dates];
  dates.splice(0, dates.length, '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02', '2024-03-03');
  try {
    const out = foodCoverageMissingness(snapshot({3: {entries: 1, knownKcal: 1}}));
    assert.equal(out.days[3].date, '2024-02-29');
    assert.equal(out.daysWithoutEntries, 6);
  } finally { dates.splice(0, dates.length, ...datesBackup); }
});

test('rejects invalid source identity and attempts to claim nutrition completeness', () => {
  for (const changes of [
    {id: 'food.complete_day_adherence.v0'}, {status: 'complete'},
    {completeness: 'verified'}, {nutritionAdherence: 100}, {source: 'manual_daily_checkin'}
  ]) {
    assert.throws(() => foodCoverageMissingness({...snapshot(), ...changes}), /Expected an F-078/);
  }
});

test('rejects duplicate, missing, shifted and impossible dates', () => {
  const duplicate = snapshot(); duplicate.days[1].date = duplicate.days[0].date;
  const shifted = snapshot(); shifted.days[4].date = '2026-11-03';
  const invalid = snapshot(); invalid.days[0].date = '2026-02-30';
  const wrongEnd = snapshot(); wrongEnd.to = '2026-11-02';
  for (const bad of [duplicate, shifted, invalid, wrongEnd]) {
    assert.throws(() => foodCoverageMissingness(bad), /consecutive|Inconsistent/);
  }
});

test('rejects inconsistent daily counts and summary metadata', () => {
  const badCount = snapshot({0: {entries: 1, knownKcal: 2, unknownKcal: 0}});
  const badNegative = snapshot({0: {entries: -1}});
  const badFraction = snapshot({0: {entries: 0.5}});
  const badCoverageValue = snapshot(); badCoverageValue.value = 7;
  const badKnownDays = snapshot({0: {entries: 1, knownKcal: 1}}); badKnownDays.numericDays = 0;
  const badUnknownDays = snapshot({0: {entries: 1, unknownKcal: 1}}); badUnknownDays.daysWithUnknownKcal = 0;
  for (const bad of [badCount, badNegative, badFraction, badCoverageValue, badKnownDays, badUnknownDays]) {
    assert.throws(() => foodCoverageMissingness(bad), /Inconsistent|disagrees/);
  }
});
