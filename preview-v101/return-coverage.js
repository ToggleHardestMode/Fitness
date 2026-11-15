// Coverage-First is the only new return-to-training generator; old workout records are preserved.

const muscleOf = exercise => exercise.muscleDetail || exercise.muscle;

// Mixed lower/upper templates are excluded in full rather than partially clearing an exercise.
export function isReviewOnlyWorkout(workout) {
  return Boolean(workout?.requiresClinicalReview ||
    /\[PT Review\]|\b(lower|legs?)\b/i.test(String(workout?.name ?? '')) ||
    workout?.exercises?.some(ex =>
      /\[PT Review\]/i.test(String(ex.name ?? '') + ' ' + String(ex.sourceNote ?? '')) ||
      /\b(quads|hamstrings|glutes|calves)\b/i.test(String(muscleOf(ex))) ||
      /\b(squat|deadlift|lunge|leg press|split squat)\b/i.test(String(ex.name ?? ''))));
}

function validateCoverageSources(sources) {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 7)
    throw Error('Choose between one and seven source workouts.');
  const days = new Set();
  for (const source of sources) {
    if (!source || typeof source.name !== 'string' || !Number.isInteger(source.day) ||
        source.day < 0 || source.day > 6 || days.has(source.day))
      throw Error('Choose at most one valid source workout per weekday.');
    days.add(source.day);
    if (!Array.isArray(source.exercises) || !source.exercises.length)
      throw Error('Every source workout needs at least one exercise.');
    for (const ex of source.exercises) {
      if (!ex || !Number.isInteger(ex.sets) || ex.sets < 1 || ex.sets > 10 ||
          typeof muscleOf(ex) !== 'string' || !muscleOf(ex).trim())
        throw Error('Source exercises need a primary muscle and 1–10 working sets.');
    }
  }
}

export function generateOneSetCoverage(sources) {
  validateCoverageSources(sources);
  const upper = sources.filter(w => !isReviewOnlyWorkout(w));
  const excluded = sources.filter(isReviewOnlyWorkout).map(w => ({
    day: w.day, workout: w.name,
    planned: w.exercises.reduce((n,e) => n + e.sets,0)
  }));
  if (!upper.length)
    throw Error('Choose at least one non-PT-review upper-body workout.');
  const full = upper.reduce((n,w) => n + w.exercises.reduce((s,e) => s + e.sets,0),0);
  const planned = upper.reduce((n,w) => n + w.exercises.length,0);
  const percentage = Math.round(planned/full*100);
  const perMuscle = new Map();
  for(const w of upper) for(const e of w.exercises) {
    const muscle = muscleOf(e).trim();
    const group = perMuscle.get(muscle) || {muscle,full:0,planned:0};
    group.full += e.sets;
    group.planned++;
    perMuscle.set(muscle,group);
  }
  const workouts = upper.map(w => {
    const suffix = ' · Return 1 set';
    return {...structuredClone(w),
      name: w.name.slice(0,60-suffix.length) + suffix,
      sourceVersion: 'Return 1 set of ' + String(w.sourceVersion || 'Unversioned').slice(0,35),
      returnSourceTemplateId: w.id || null, returnStagePercent: percentage,
      returnStageMode: 'one-per-exercise', requiresClinicalReview: false,
      exercises: w.exercises.map(e => {
        const copy = structuredClone(e);
        copy.sets = 1;
        if (Array.isArray(copy.setTargets)) copy.setTargets = copy.setTargets.slice(0,1);
        return copy;
      })
    };
  });
  return {mode:'coverage',percentage,full,planned,
    muscles:[...perMuscle.values()].map(m=>({...m,actualPercent:Math.round(m.planned/m.full*100)})),
    omitted:[],excluded,workouts};
}
