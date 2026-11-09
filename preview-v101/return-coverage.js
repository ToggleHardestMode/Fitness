// Optional movement-coverage entry dose. A separate mode, NOT a 25% volume stage.
import {generateReturnStage} from './return-training.js';

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

export function generateOneSetCoverage(sources) {
  generateReturnStage(sources, 100); // Existing validation of sources/exercises/days.
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
