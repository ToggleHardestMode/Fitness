// Owner-recorded clearance, given by a clinician, for one specific exercise. The app does not verify
// it and never infers or creates it. A clearance is keyed to templateId + exerciseIndex only, so it
// never carries across an equivalence link or to another exercise. Pure functions.
export const CLEARED_BY_MAX = 80;
export const CLEARANCE_NOTE_MAX = 200;

const fail = message => { throw new Error(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

function realDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${label} must be YYYY-MM-DD.`);
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) fail(`${label} is not a real calendar date.`);
}

// Same rule the progression guards use for the PT-review early return.
export const requiresPtReview = (template, exercise) =>
  Boolean(template?.requiresClinicalReview || template?.name?.includes('[PT Review]') || /\[PT\]/i.test(exercise?.name || ''));

// Validate without mutating or repairing. Backups from before V15.26 simply omit the field.
export function validateExerciseClearances(state) {
  const list = state.exerciseClearances;
  if (list === undefined) return;
  if (!Array.isArray(list) || list.length > 2000) fail('Backup contains an invalid clearance list.');
  const ids = new Set(), open = new Set();
  for (const item of list) {
    if (!plain(item)) fail('Backup contains an invalid clearance record.');
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 140) fail('Clearance IDs must be 1–140 characters.');
    if (ids.has(item.id)) fail('Backup contains duplicate clearance IDs.');
    ids.add(item.id);
    const template = typeof item.templateId === 'string' ? state.templates.find(t => t.id === item.templateId) : undefined;
    if (!template) fail('Clearance refers to a missing workout.');
    if (!Number.isInteger(item.exerciseIndex) || item.exerciseIndex < 0 || item.exerciseIndex >= template.exercises.length)
      fail('Clearance refers to a missing exercise.');
    realDate(item.clearedDate, 'Clearance date');
    if (typeof item.clearedBy !== 'string' || !item.clearedBy.trim() || item.clearedBy.length > CLEARED_BY_MAX)
      fail(`Clearance must name who cleared it (1–${CLEARED_BY_MAX} characters).`);
    if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > CLEARANCE_NOTE_MAX))
      fail(`Clearance notes must be at most ${CLEARANCE_NOTE_MAX} characters.`);
    if (item.revokedDate !== undefined) {
      realDate(item.revokedDate, 'Clearance revoked date');
      if (item.revokedDate < item.clearedDate) fail('A clearance cannot be revoked before it was given.');
    } else {
      const key = `${item.templateId}|${item.exerciseIndex}`;
      if (open.has(key)) fail('An exercise can have only one unrevoked clearance.');
      open.add(key);
    }
  }
}

// The unrevoked clearance for exactly this exercise that is dated on or before `date`, else null.
// A record with any revokedDate never applies (conservative). ISO dates compare as strings.
export function activeClearance(state, templateId, exerciseIndex, date) {
  const list = Array.isArray(state.exerciseClearances) ? state.exerciseClearances : [];
  return list.find(item => item.templateId === templateId && item.exerciseIndex === exerciseIndex &&
    item.revokedDate === undefined && typeof date === 'string' && item.clearedDate <= date) || null;
}

// Unrevoked clearance for this exercise regardless of date (for display).
export const currentClearance = (state, templateId, exerciseIndex) =>
  (state.exerciseClearances || []).find(item => item.templateId === templateId &&
    item.exerciseIndex === exerciseIndex && item.revokedDate === undefined) || null;

const confirmedOnly = options => {
  if (options?.confirmed !== true) fail('Recording or revoking a clearance needs your explicit confirmation.');
};

// Owner action only: records a clearance the owner says a clinician gave. Not verified by the app.
export function recordExerciseClearance(state, draft, makeId = () => globalThis.crypto?.randomUUID?.() || `clr-${Date.now()}-${Math.random().toString(36).slice(2)}`, options) {
  confirmedOnly(options);
  if (!plain(draft)) fail('Enter the clearance details.');
  const clearedBy = typeof draft.clearedBy === 'string' ? draft.clearedBy.trim() : draft.clearedBy;
  const note = typeof draft.note === 'string' ? draft.note.trim() : draft.note;
  const record = {id: makeId(), templateId: draft.templateId, exerciseIndex: draft.exerciseIndex,
    clearedDate: draft.clearedDate, clearedBy, ...(note ? {note} : {})};
  const next = structuredClone(state);
  next.exerciseClearances = [...(next.exerciseClearances || []), record];
  validateExerciseClearances(next);
  return next;
}

// Revoking keeps the record (with revokedDate) so the history stays visible; nothing is deleted.
export function revokeExerciseClearance(state, id, revokedDate, options) {
  confirmedOnly(options);
  const target = (state.exerciseClearances || []).find(item => item.id === id);
  if (!target) fail('That clearance no longer exists.');
  if (target.revokedDate !== undefined) fail('That clearance is already revoked.');
  const next = structuredClone(state);
  next.exerciseClearances = next.exerciseClearances.map(item => item.id === id ? {...item, revokedDate} : item);
  validateExerciseClearances(next);
  return next;
}
