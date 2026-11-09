// A deterministic, read-only volume stage generator. Neither source workouts nor logs are changed.
export const RETURN_STAGES = Object.freeze([25, 50, 75, 100]);

const muscleOf = exercise => exercise.muscleDetail || exercise.muscle;
const sum = values => values.reduce((total, value) => total + value, 0);

export function generateReturnStage(sources, percentage) {
  if (!RETURN_STAGES.includes(percentage)) throw Error('Choose a 25%, 50%, 75% or 100% training stage.');
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 7)
    throw Error('Choose between one and seven source workouts.');
  const seenDays = new Set();
  const items = [];
  sources.forEach((template, templateIndex) => {
    if (!template || typeof template.name !== 'string' || !Number.isInteger(template.day) || template.day < 0 || template.day > 6 || seenDays.has(template.day))
      throw Error('Choose at most one valid source workout per weekday.');
    seenDays.add(template.day);
    if (!Array.isArray(template.exercises) || !template.exercises.length)
      throw Error('Every source workout needs at least one exercise.');
    template.exercises.forEach((exercise, exerciseIndex) => {
      if (!exercise || !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 10 ||
          typeof muscleOf(exercise) !== 'string' || !muscleOf(exercise).trim())
        throw Error('Source exercises need a primary muscle and 1–10 working sets.');
      items.push({templateIndex, exerciseIndex, exercise, muscle: muscleOf(exercise).trim(), count: 0});
    });
  });

  // Highest-average allocation: a later stage never removes sets allocated at an earlier stage.
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.muscle)) groups.set(item.muscle, []);
    groups.get(item.muscle).push(item);
  }
  const muscles = [];
  for (const [muscle, members] of groups) {
    const original = sum(members.map(item => item.exercise.sets));
    const target = Math.round(original * percentage / 100);
    for (let i = 0; i < target; i++) {
      let best = null, bestPriority = -1;
      for (const member of members) {
        if (member.count >= member.exercise.sets) continue;
        const priority = member.exercise.sets / (member.count + 1);
        if (priority > bestPriority) {best = member; bestPriority = priority;}
      }
      if (!best) throw Error('Cannot allocate the requested working sets.');
      best.count++;
    }
    muscles.push({muscle, full: original, planned: target, actualPercent: Math.round(100 * target / original)});
  }

  const omitted = [];
  const workouts = sources.flatMap((source, templateIndex) => {
    const exercises = source.exercises.flatMap((exercise, exerciseIndex) => {
      const item = items.find(entry => entry.templateIndex === templateIndex && entry.exerciseIndex === exerciseIndex);
      if (item.count === 0) {
        omitted.push({day: source.day, workout: source.name, exercise: exercise.name});
        return [];
      }
      const copy = structuredClone(exercise);
      copy.sets = item.count;
      if (Array.isArray(copy.setTargets)) copy.setTargets = copy.setTargets.slice(0, item.count);
      return [copy];
    });
    if (!exercises.length) return [];
    const suffix = ` · Return ${percentage}%`;
    const sourceVersion = String(source.sourceVersion || 'Unversioned').slice(0, 35);
    const name = source.name.slice(0, 60 - suffix.length) + suffix;
    return [{...structuredClone(source), name, exercises, sourceVersion: `Return ${percentage}% of ${sourceVersion}`,
      returnSourceTemplateId: source.id || null, returnStagePercent: percentage,
      requiresClinicalReview: Boolean(source.requiresClinicalReview || /\[PT Review\]/i.test(source.name) ||
        /\b(lower|legs?)\b/i.test(source.name) || source.exercises.some(ex =>
          /\b(quads|hamstrings|glutes|calves)\b/i.test(String(muscleOf(ex))) ||
          /\b(squat|deadlift|lunge|leg press|split squat)\b/i.test(ex.name)))}];
  });
  return {percentage, workouts, muscles, omitted, full: sum(muscles.map(m => m.full)),
    planned: sum(muscles.map(m => m.planned))};
}
