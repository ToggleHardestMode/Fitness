// Owner-approved links between an earlier exercise and its replacement, so history can be shown
// across workout versions. A link never re-keys logs and never makes the earlier exercise's
// sessions count towards progression. Pure functions; no input is mutated or repaired.
export const EQUIVALENCE_NOTE_MAX = 200;

const fail = message => { throw new Error(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const keyOf = ref => `${ref.templateId}|${ref.exerciseIndex}`;

function realDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${label} must be YYYY-MM-DD.`);
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) fail(`${label} is not a real calendar date.`);
}

function resolve(state, ref, label) {
  if (!plain(ref)) fail(`Exercise link ${label} reference is invalid.`);
  const template = typeof ref.templateId === 'string' ? (state.templates || []).find(t => t.id === ref.templateId) : undefined;
  if (!template) fail(`Exercise link ${label} refers to a missing workout.`);
  if (!Number.isInteger(ref.exerciseIndex) || ref.exerciseIndex < 0 || ref.exerciseIndex >= template.exercises.length)
    fail(`Exercise link ${label} refers to a missing exercise.`);
  return template.exercises[ref.exerciseIndex];
}

// Validate without mutating or repairing. Backups from before V15.23 simply omit the field.
export function validateExerciseEquivalences(state) {
  const links = state.exerciseEquivalences;
  if (links === undefined) return;
  if (!Array.isArray(links) || links.length > 2000) fail('Backup contains an invalid exercise equivalence list.');
  const ids = new Set(), forward = new Map();
  for (const link of links) {
    if (!plain(link)) fail('Backup contains an invalid exercise link.');
    if (typeof link.id !== 'string' || !link.id.trim() || link.id.length > 140) fail('Exercise link IDs must be 1–140 characters.');
    if (ids.has(link.id)) fail('Backup contains duplicate exercise link IDs.');
    ids.add(link.id);
    const from = resolve(state, link.from, 'source'), to = resolve(state, link.to, 'target');
    if (keyOf(link.from) === keyOf(link.to)) fail('An exercise cannot be linked to itself.');
    if (from.repUnit !== to.repUnit) fail('A timed hold cannot be linked to a repetition exercise.');
    realDate(link.approvedDate, 'Exercise link approval date');
    if (link.note !== undefined && (typeof link.note !== 'string' || link.note.length > EQUIVALENCE_NOTE_MAX))
      fail(`Exercise link notes must be at most ${EQUIVALENCE_NOTE_MAX} characters.`);
    const fromKey = keyOf(link.from);
    if (forward.has(fromKey)) fail('An earlier exercise can be linked to only one replacement.');
    forward.set(fromKey, keyOf(link.to));
  }
  for (const start of forward.keys()) {
    const seen = new Set([start]);
    for (let at = forward.get(start); at !== undefined; at = forward.get(at)) {
      if (seen.has(at)) fail('Exercise links must not form a cycle.');
      seen.add(at);
    }
  }
}

// Earlier exercises whose history leads into this one, nearest link first. Follows chains backwards.
export function linkedSources(state, templateId, exerciseIndex) {
  const links = Array.isArray(state.exerciseEquivalences) ? state.exerciseEquivalences : [];
  const out = [], seen = new Set([keyOf({templateId, exerciseIndex})]);
  let frontier = [{templateId, exerciseIndex}];
  while (frontier.length) {
    const next = [];
    for (const target of frontier) {
      for (const link of links) {
        if (keyOf(link.to) !== keyOf(target) || seen.has(keyOf(link.from))) continue;
        seen.add(keyOf(link.from));
        const ref = {templateId: link.from.templateId, exerciseIndex: link.from.exerciseIndex};
        out.push(ref);
        next.push(ref);
      }
    }
    frontier = next;
  }
  return out;
}

const confirmedOnly = options => {
  if (options?.confirmed !== true) fail('Linking or unlinking exercise history needs your explicit confirmation.');
};

// The caller supplies the id and date; creation happens only after an explicit owner confirmation.
export function addExerciseEquivalence(state, draft, makeId = () => globalThis.crypto?.randomUUID?.() || `eq-${Date.now()}-${Math.random().toString(36).slice(2)}`, options) {
  confirmedOnly(options);
  if (!plain(draft)) fail('Choose the two exercises to link.');
  const note = typeof draft.note === 'string' ? draft.note.trim() : draft.note;
  const link = {
    id: makeId(),
    from: {templateId: draft.from?.templateId, exerciseIndex: draft.from?.exerciseIndex},
    to: {templateId: draft.to?.templateId, exerciseIndex: draft.to?.exerciseIndex},
    approvedDate: draft.approvedDate,
    ...(note ? {note} : {})
  };
  const next = structuredClone(state);
  next.exerciseEquivalences = [...(next.exerciseEquivalences || []), link];
  validateExerciseEquivalences(next);
  return next;
}

// Removes only the link record; logs, metrics and symptom entries are untouched.
export function removeExerciseEquivalence(state, id, options) {
  confirmedOnly(options);
  const links = state.exerciseEquivalences || [];
  if (!links.some(link => link.id === id)) fail('That exercise link no longer exists.');
  const next = structuredClone(state);
  next.exerciseEquivalences = links.filter(link => link.id !== id).map(link => structuredClone(link));
  return next;
}

// Earlier exercises in other workouts that could be linked to this one; identical names first.
export function linkCandidates(state, templateId, exerciseIndex) {
  const current = state.templates.find(t => t.id === templateId)?.exercises?.[exerciseIndex];
  if (!current) return [];
  const out = [];
  state.templates.forEach((template, templateOrder) => {
    if (template.id === templateId) return;
    template.exercises.forEach((exercise, index) => {
      if (exercise.repUnit !== current.repUnit) return;
      try {
        addExerciseEquivalence(state, {from:{templateId:template.id, exerciseIndex:index},
          to:{templateId, exerciseIndex}, approvedDate:'2000-01-01'}, () => 'candidate-check', {confirmed:true});
      } catch { return; }
      out.push({templateId:template.id, exerciseIndex:index, templateName:template.name,
        exerciseName:exercise.name, sameName:exercise.name.trim().toLowerCase() === current.name.trim().toLowerCase(), templateOrder});
    });
  });
  return out.sort((a, b) => Number(b.sameName) - Number(a.sameName) || a.templateOrder - b.templateOrder || a.exerciseIndex - b.exerciseIndex);
}
