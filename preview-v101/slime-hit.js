// Cosmetic signal only: count new persisted working-set slots, never edits.
export function newlyRecordedSets(previous, next, { date, templateId, exerciseIndex }) {
  if (!Array.isArray(previous?.logs) || !Array.isArray(next?.logs)) throw Error('Saved-set history is unavailable.');
  const belongs = log => log.date === date && log.templateId === templateId &&
    log.exerciseIndex === exerciseIndex && Number.isInteger(log.set) && log.set > 0 &&
    log.isWarmup !== true && log.kind !== 'warmup';
  const oldSlots = new Set(previous.logs.filter(belongs).map(log => log.set));
  return next.logs.filter(log => belongs(log) && !oldSlots.has(log.set)).length;
}
