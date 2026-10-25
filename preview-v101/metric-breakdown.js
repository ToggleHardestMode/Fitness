// Read-only provenance for dashboard averages; never modifies saved check-ins.
export const METRIC_FIELDS = Object.freeze([
  ['Protein', 'protein', 'g'],
  ['Calories', 'calories', 'kcal'],
  ['Sleep', 'sleep', 'h'],
  ['Recovery', 'recovery', '/ 5']
]);

export function weeklyMetricSources(metrics, weekDates) {
  const inWeek = new Set(weekDates);
  return Object.fromEntries(METRIC_FIELDS.map(([, key]) => [
    key,
    (metrics ?? [])
      .filter(entry => inWeek.has(entry.date) && typeof entry[key] === 'number' && Number.isFinite(entry[key]))
      .map(entry => ({ date: entry.date, value: entry[key] }))
      .sort((a, b) => a.date.localeCompare(b.date))
  ]));
}
