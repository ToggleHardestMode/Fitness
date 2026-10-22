// Read-only convenience: reuse an earlier saved set from this same session.
// Never copies RPE, saves a log, increases weight, or bypasses a PT-review gate.
export function repeatLastSessionSet(state, {date, templateId, exerciseIndex, set}) {
  const template = state.templates?.find(t => t.id === templateId);
  const exercise = template?.exercises?.[exerciseIndex];
  if (!template || !exercise || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isInteger(set) || set < 1 || set > exercise.sets) {
    return null;
  }
  if (template.requiresClinicalReview || template.name?.includes('[PT Review]') ||
      exercise.repUnit === 'seconds_per_side') return null;
  // Don't offer to replace a set that already has a saved record.
  if (state.logs.some(l => l.date === date && l.templateId === templateId &&
      l.exerciseIndex === exerciseIndex && l.set === set)) return null;
  const earlier = (state.logs || [])
    .filter(l => l.date === date && l.templateId === templateId &&
      l.exerciseIndex === exerciseIndex && l.set < set && l.set >= 1 &&
      l.isWarmup !== true && l.kind !== 'warmup' &&
      Number.isFinite(l.kg) && l.kg >= 0 && l.kg <= 500 &&
      Number.isInteger(l.reps) && l.reps >= 1 && l.reps <= 100)
    .sort((a,b) => b.set - a.set)[0];
  return earlier ? {kg:earlier.kg, reps:earlier.reps, sourceSet:earlier.set} : null;
}
