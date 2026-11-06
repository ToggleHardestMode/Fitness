// Display-level exercise identity is universal, independent of workout template versions.
// Exact normalized names and rep units match; differently named movements remain separate
// until the owner explicitly links them. This does NOT alter saved template/log identifiers.
export function exerciseIdentity(exercise) {
  if (!exercise || typeof exercise.name !== 'string' || !exercise.name.trim())
    throw Error('Exercise needs a name.');
  const name = exercise.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
  return JSON.stringify([name, exercise.repUnit === 'seconds_per_side' ? 'seconds_per_side' : 'reps']);
}

export function matchingExerciseReferences(state, reference) {
  const key = exerciseIdentity(reference);
  const found = [];
  for (const template of state.templates || []) {
    (template.exercises || []).forEach((exercise, exerciseIndex) => {
      if (exerciseIdentity(exercise) === key)
        found.push({templateId:template.id, exerciseIndex, template, exercise});
    });
  }
  return found;
}

export function distinctExercises(state, includeTimed = false) {
  const seen = new Set(), choices = [];
  for (const template of state.templates || []) {
    (template.exercises || []).forEach((exercise, exerciseIndex) => {
      if (!includeTimed && exercise.repUnit === 'seconds_per_side') return;
      const key = exerciseIdentity(exercise);
      if (seen.has(key)) return;
      seen.add(key);
      choices.push({key, template, exercise, exerciseIndex});
    });
  }
  return choices;
}
