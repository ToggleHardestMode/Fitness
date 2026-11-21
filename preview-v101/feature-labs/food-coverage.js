/**
 * W01: a read-only missingness view over the existing F-078 seven-day coverage metric.
 * Pass the result of sevenDayFoodCoverage(diary, endDate); do not create a new metric ID.
 * A day with entries is NEVER evidence that the entire day's food was recorded.
 */
const DAY_MS = 86_400_000;

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + 'T12:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return Math.floor(timestamp / DAY_MS);
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 3000;
}

/** Convert validated F-078 diary coverage into explicit logging-evidence categories. */
export function foodCoverageMissingness(coverage) {
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage) ||
      coverage.id !== 'food.entry_coverage_week.v1' || coverage.unit !== 'days' ||
      coverage.source !== 'food_diary' || coverage.status !== 'recording_coverage_only' ||
      coverage.completeness !== 'not_verified' || coverage.nutritionAdherence !== null ||
      coverage.periodDays !== 7 || !Array.isArray(coverage.days) || coverage.days.length !== 7) {
    throw Error('Expected an F-078 seven-day food-entry coverage snapshot.');
  }
  const first = dayNumber(coverage.from);
  if (first === null || dayNumber(coverage.to) !== first + 6) {
    throw Error('Food coverage must cover seven consecutive local dates.');
  }

  let loggedDays = 0;
  let daysWithKnownKcal = 0;
  let daysWithUnknownKcal = 0;
  let kcalUnknownEntries = 0;
  const days = coverage.days.map((row, index) => {
    if (!row || dayNumber(row.date) !== first + index ||
        !count(row.entries) || !count(row.knownKcal) || !count(row.unknownKcal) ||
        row.knownKcal + row.unknownKcal !== row.entries) {
      throw Error('Inconsistent food coverage day at index ' + index + '.');
    }
    if (row.entries > 0) loggedDays++;
    if (row.knownKcal > 0) daysWithKnownKcal++;
    if (row.unknownKcal > 0) daysWithUnknownKcal++;
    kcalUnknownEntries += row.unknownKcal;

    const state = row.entries === 0 ? 'no_entries' :
      row.knownKcal === 0 ? 'all_kcal_unknown' :
      row.unknownKcal > 0 ? 'some_kcal_unknown' : 'kcal_values_present';
    return {
      date: row.date, entries: row.entries,
      knownKcalEntries: row.knownKcal, unknownKcalEntries: row.unknownKcal,
      state
    };
  });
  if (coverage.value !== loggedDays || coverage.numericDays !== daysWithKnownKcal ||
      coverage.daysWithUnknownKcal !== daysWithUnknownKcal) {
    throw Error('Food coverage summary disagrees with its daily records.');
  }

  return {
    from: coverage.from, to: coverage.to, periodDays: 7,
    source: 'food_diary',
    loggedDays, daysWithoutEntries: 7 - loggedDays,
    daysWithOnlyUnknownKcal: days.filter(row => row.state === 'all_kcal_unknown').length,
    daysWithSomeUnknownKcal: days.filter(row => row.state === 'some_kcal_unknown').length,
    kcalUnknownEntries, days,
    completeness: 'not_verified', nutritionAdherence: null,
    interpretation: 'No entry means no food was logged, not no food was eaten. Even days with all kcal fields filled are not verified complete days.'
  };
}
