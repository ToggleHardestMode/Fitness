// Optional local-only symptom observations. Missing observations mean unknown, not symptom-free.
export const SYMPTOM_TIMEPOINTS = Object.freeze({
  before: 'Before exercise', after: 'Immediately after', next_day: 'Next morning', after_48h: '48-hour follow-up'
});
export const SYMPTOM_SIDES = Object.freeze({none: 'None', left: 'Left', right: 'Right', both: 'Both', unsure: 'Unsure'});
export const SYMPTOM_LOCATIONS = Object.freeze({none: 'None', back: 'Back', buttock: 'Buttock', thigh: 'Thigh', calf: 'Calf', foot: 'Foot', multiple: 'Multiple areas', unsure: 'Unsure'});
export const FUNCTION_CHANGES = Object.freeze({none: 'No change noticed', walking_change: 'Walking changed', new_weakness: 'New weakness', worse_weakness: 'Weakness worsened', unsure: 'Unsure'});

const fail = message => { throw new Error(message); };
const own = (dict, key) => Object.prototype.hasOwnProperty.call(dict, key);
const checkDate = date => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Symptom date must be YYYY-MM-DD.');
  const [y,m,d] = date.split('-').map(Number);
  const parsed = new Date(y, m-1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m-1 || parsed.getDate() !== d) fail('Symptom date is not a real calendar date.');
};
const choose = (dict,value,label) => {
  if (typeof value !== 'string' || !own(dict,value)) fail(`Choose a valid ${label}.`);
  return value;
};
const scopeKey = x => `${x.date}|${x.timepoint}|${x.templateId ?? ''}|${x.exerciseIndex ?? ''}`;
const safeID = makeId => {
  const id = makeId();
  if (typeof id !== 'string' || !id.trim() || id.length > 140) fail('Invalid symptom entry ID.');
  return id;
};

// Validate without mutating or repairing the input. A pre-V10.1 backup may omit symptomLogs.
export function validateSymptomLogs(state) {
  if (state.symptomLogs === undefined) return;
  const entries = state.symptomLogs;
  if (!Array.isArray(entries) || entries.length > 5000) fail('Backup contains an invalid symptom journal.');
  const ids = new Set(), keys = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('Backup contains an invalid symptom entry.');
    if (typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 140 || ids.has(entry.id)) fail('Backup contains duplicate or invalid symptom IDs.');
    ids.add(entry.id);
    checkDate(entry.date);
    choose(SYMPTOM_TIMEPOINTS,entry.timepoint,'observation time');
    choose(SYMPTOM_SIDES,entry.side,'leg side');
    choose(SYMPTOM_LOCATIONS,entry.location,'symptom location');
    choose(FUNCTION_CHANGES,entry.functionChange,'functional change');
    if (!Number.isInteger(entry.severity) || entry.severity < 0 || entry.severity > 10) fail('Symptom severity must be a whole number from 0 to 10.');
    if (typeof entry.tingling !== 'boolean' || typeof entry.numbness !== 'boolean') fail('Symptom tingling/numbness must be checked or unchecked.');
    if (typeof entry.notes !== 'string' || entry.notes.length > 500) fail('Symptom notes must be no more than 500 characters.');
    if (entry.templateId !== null) {
      if (typeof entry.templateId !== 'string' || !state.templates.some(t => t.id === entry.templateId)) fail('Symptom entry refers to a missing workout.');
      if (entry.exerciseIndex !== null) {
        const t = state.templates.find(t => t.id === entry.templateId);
        if (!Number.isInteger(entry.exerciseIndex) || entry.exerciseIndex < 0 || entry.exerciseIndex >= t.exercises.length) fail('Symptom entry refers to a missing exercise.');
      }
    } else if (entry.exerciseIndex !== null) fail('A symptom exercise must belong to a workout.');
    const key = scopeKey(entry);
    if (keys.has(key)) fail('Backup contains duplicate symptom observations for the same scope and time.');
    keys.add(key);
  }
}

export function addSymptomEntry(state, draft, makeId = () => globalThis.crypto?.randomUUID?.() || `sym-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  if (!state || !Array.isArray(state.templates)) fail('Workout data is missing.');
  const entry = {
    id: safeID(makeId), date: draft.date, timepoint: draft.timepoint,
    templateId: draft.templateId || null, exerciseIndex: draft.exerciseIndex === '' || draft.exerciseIndex === undefined ? null : draft.exerciseIndex,
    side: draft.side, location: draft.location, severity: typeof draft.severity === 'string' && draft.severity.trim() === '' || draft.severity == null ? null : Number(draft.severity),
    tingling: draft.tingling, numbness: draft.numbness, functionChange: draft.functionChange,
    notes: String(draft.notes ?? '').trim()
  };
  const next = structuredClone(state);
  if (!Object.hasOwn(next,'symptomLogs')) next.symptomLogs = [];
  if (next.symptomLogs.some(existing => scopeKey(existing) === scopeKey(entry))) fail('An observation already exists for this workout, time and exercise. It was not overwritten.');
  next.symptomLogs.push(entry);
  validateSymptomLogs(next);
  return next;
}

// Informational notices only. Neither a blank journal nor a mild response grants clearance.
export function symptomGuidance(entry, before = null) {
  if (['new_weakness','worse_weakness','walking_change'].includes(entry.functionChange))
    return 'New or worsening weakness or walking changes: stop provoking activity and seek prompt medical assessment. This journal cannot provide clearance.';
  if (before && entry.timepoint !== 'before' && entry.severity > before.severity)
    return 'Symptoms increased compared with the recorded baseline. Do not automatically progress lower-body training; arrange clinical review if worsening persists or symptoms spread.';
  if (entry.severity > 0 && ['calf','foot','multiple'].includes(entry.location))
    return 'Symptoms involving the lower leg or foot were recorded. Avoid automatic load increases; seek clinical review if symptoms are new, spreading, or worsening.';
  if (entry.severity > 0)
    return 'Symptoms recorded. Compare with your own baseline and next-day response; seek medical review if they worsen. No training clearance is implied.';
  return 'Observation saved. An entry of 0 does not establish medical clearance or predict the next-day response.';
}