import { addWorkouts } from './core.js';

// Append a custom template instead of editing a template referenced by saved logs.
// The original keeps its ID, exercise indices, history and weekday assignments.
export function createExerciseVersion(state, templateId, exerciseIndex, changes, makeId) {
  const original = state.templates.find(t => t.id === templateId);
  const old = original?.exercises?.[exerciseIndex];
  if (!old || !Number.isInteger(exerciseIndex)) throw Error('Choose an existing workout exercise to customize.');
  const str = (key, max) => {
    const value = String(changes[key] ?? '').trim();
    if (!value || value.length > max) throw Error(`${key} must contain 1–${max} characters.`);
    return value;
  };
  const num = (key, low, high) => {
    const raw = String(changes[key] ?? '').trim();
    if (!/^\d+$/.test(raw)) throw Error(`${key} must be a whole number.`);
    const value = Number(raw);
    if (value < low || value > high) throw Error(`${key} must be between ${low} and ${high}.`);
    return value;
  };
  const name = str('name', 80);
  const muscle = str('muscle', 40);
  const sets = num('sets', 1, 10);
  const min = num('min', 1, 100);
  const max = num('max', 1, 100);
  const rest = num('rest', 0, 600);
  const note = String(changes.sourceNote ?? '').trim();
  if (note.length > 500) throw Error('Exercise instructions must be 500 characters or fewer.');
  if (min > max) throw Error('Minimum repetitions cannot exceed maximum repetitions.');
  if (old.setTargets && (sets !== old.sets || min !== old.min || max !== old.max)) {
    throw Error('This exercise has per-set rep targets. Keep its sets and rep range unchanged in this editor.');
  }
  if (old.repUnit === 'seconds_per_side' && name !== old.name) {
    throw Error('Timed holds must keep their exercise name/unit. Create a separate reviewed template for a different movement.');
  }
  if (name !== old.name && (!note || note === (old.sourceNote || ''))) {
    throw Error('For an exercise substitution, replace the old instructions with instructions for the new movement.');
  }
  const revised = { ...structuredClone(old), name, muscle, sets, min, max, rest };
  if (name !== old.name || muscle !== old.muscle) delete revised.muscleDetail;
  if (note) revised.sourceNote = note;
  else delete revised.sourceNote;
  const unchanged = ['name','muscle','sets','min','max','rest','sourceNote']
    .every(key => (revised[key] ?? '') === (old[key] ?? ''));
  if (unchanged) throw Error('Change at least one exercise field before saving a custom version.');

  const nameStem = original.name.replace(/ · Custom \d+$/, '').slice(0, 45);
  let n = 1, templateName;
  do {
    templateName = `${nameStem} · Custom ${n++}`;
  } while (state.templates.some(t => t.name === templateName));
  const template = structuredClone(original);
  delete template.id;
  template.name = templateName;
  template.sourceVersion = 'Custom'; // Never apply canonical V10.2 overlap weights to modified plans.
  template.exercises[exerciseIndex] = revised;
  const isLower = template.exercises.some(ex =>
    ['quads','hamstrings','glutes','calves'].includes(ex.muscle.toLowerCase()));
  template.requiresClinicalReview = !!original.requiresClinicalReview ||
    /\b(lower|legs?)\b/i.test(original.name) || isLower;
  const result = addWorkouts(state, [template], false, makeId);
  if (result.added !== 1) throw Error('Custom version was not added; review the exercise fields.');
  return {state:result.state,template:result.state.templates.at(-1)};
}
