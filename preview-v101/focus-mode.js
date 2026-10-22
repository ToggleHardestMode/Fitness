// Focus Mode helpers. Existing recordSets validates and persists completed sets.
export function focusEntries(count, index, values) {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) throw Error('Invalid Focus Mode set selection.');
  return Array.from({ length: count }, (_, i) => i === index ? { ...values, completed: true } : { completed: false });
}
export function nextPendingSet(logs, date, templateId, exerciseIndex, count, after = -1) {
  if (!Number.isInteger(count) || count < 1) return -1;
  const saved = new Set(logs.filter(l => l.date === date && l.templateId === templateId && l.exerciseIndex === exerciseIndex).map(l => l.set));
  for (let n = 1; n <= count; n++) {
    const i = (after + n) % count;
    if (!saved.has(i + 1)) return i;
  }
  return -1;
}
export function nextPendingExercise(logs, date, templateId, exercises, after = -1) {
  if (!Array.isArray(exercises) || !exercises.length) return -1;
  for (let n = 1; n <= exercises.length; n++) {
    const i = (after + n) % exercises.length;
    if (nextPendingSet(logs, date, templateId, i, exercises[i].sets) >= 0) return i;
  }
  return -1;
}
