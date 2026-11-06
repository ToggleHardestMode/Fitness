// Read-only week navigation for saved training data; never changes workout records.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validatedDate(key) {
  if (typeof key !== 'string' || !DATE.test(key)) throw Error('Date must be YYYY-MM-DD.');
  const d = new Date(key + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== key)
    throw Error('Invalid calendar date.');
  return d;
}
export function mondayOf(key) {
  const date = validatedDate(key);
  const day = (date.getUTCDay()+6)%7;
  date.setUTCDate(date.getUTCDate()-day);
  return date.toISOString().slice(0,10);
}
export function shiftWeek(key, weeks) {
  if (!Number.isInteger(weeks) || Math.abs(weeks) > 520)
    throw Error('Week offset must be a whole number within 10 years.');
  const date = validatedDate(mondayOf(key));
  date.setUTCDate(date.getUTCDate()+weeks*7);
  return date.toISOString().slice(0,10);
}
export function latestLoggedWeek(state) {
  const templates = new Map((state.templates || []).map(t=>[t.id,t]));
  let latest = null;
  for (const row of state.logs || []) {
    if (row.isWarmup === true || row.kind === 'warmup') continue;
    const exercise = templates.get(row.templateId)?.exercises?.[row.exerciseIndex];
    if (!exercise || !Number.isInteger(row.set) || row.set < 1 || row.set > exercise.sets) continue;
    try {validatedDate(row.date);} catch {continue;}
    if (latest===null || row.date > latest) latest=row.date;
  }
  return latest ? mondayOf(latest) : null;
}
