// Read-only training and recovery summaries. No medical clearance or automatic progression.
const V101_ARMS = Object.freeze({
  'DB Supinating Curl (SS1)': 'Biceps',
  'Lying DB Triceps Extension (SS1)': 'Triceps',
  'DB Hammer Curl (SS1)': 'Biceps',
  'Supported DB Overhead Triceps Ext (SS1)': 'Triceps'
});
const directMuscle = (template, exercise) => {
  if (exercise.muscle !== 'Arms') return exercise.muscle;
  if (exercise.muscleDetail === 'Biceps' || exercise.muscleDetail === 'Triceps') return exercise.muscleDetail;
  if (template?.sourceVersion === 'V10.1 Home' || template?.name?.startsWith('V10.1 Home —')) {
    return V101_ARMS[exercise.name] || 'Arms (unclassified)';
  }
  return 'Arms (unclassified)';
};
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DISTAL = {none: 0, back: 1, buttock: 2, thigh: 3, calf: 4, foot: 5};

function addDays(key, n) {
  if (!DATE_KEY.test(key)) throw Error('Week start must be YYYY-MM-DD.');
  const date = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw Error('Invalid week start date.');
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

const working = log => log.isWarmup !== true && log.kind !== 'warmup';
// Read-only lifetime progress: unique saved working sets, not scheduled work.
export function lifetimeTrainingSets(state) {
  const templates = new Map((state.templates ?? []).map(t => [t.id, t]));
  const seen = new Set();
  for (const log of state.logs ?? []) {
    if (!working(log) || typeof log.date !== 'string' || !DATE_KEY.test(log.date)) continue;
    const exercise = templates.get(log.templateId)?.exercises?.[log.exerciseIndex];
    if (!exercise || !Number.isInteger(log.set) || log.set < 1 || log.set > exercise.sets) continue;
    seen.add(`${log.date}|${log.templateId}|${log.exerciseIndex}|${log.set}`);
  }
  return seen.size;
}

const blankCount = () => ({planned: 0, completed: 0});
const addCount = (map, muscle, field) => {
  const category = typeof muscle === 'string' && muscle.trim() ? muscle.trim() : 'Unknown';
  if (!map[category]) map[category] = blankCount();
  map[category][field]++;
};

/**
 * Scheduled working sets are today's assigned template's prescription.
 * Completed sets are unique saved working-set logs, even on off-plan days.
 * No unilateral multiplier or indirect-compound muscle attribution.
 * Timed holds count as sets; their seconds are not counted as repetitions in tonnage.
 */
export function weeklyTrainingAnalysis(state, monday) {
  const templates = new Map((state.templates ?? []).map(t => [t.id, t]));
  const days = Array.from({length: 7}, (_, day) => ({
    date: addDays(monday, day), day, templateId: state.assignments?.[day] ?? null,
    planned: 0, completed: 0, assignedCompleted: 0, offPlan: 0, loadVolume: 0, status: 'not_scheduled'
  }));
  const dates = new Set(days.map(d => d.date));
  const byDate = new Map(days.map(d => [d.date, d]));
  const byMuscle = Object.create(null);
  let planned = 0, completed = 0, offPlan = 0, loadVolume = 0;
  const timedHolds = [];
  const volumeEntries = [];

  for (const day of days) {
    const t = templates.get(day.templateId);
    if (!t) continue;
    day.planned = t.exercises.reduce((total, e) => total + e.sets, 0);
    planned += day.planned;
    day.status = 'not_logged';
    for (const exercise of t.exercises) {
      for (let i = 0; i < exercise.sets; i++) addCount(byMuscle, directMuscle(t, exercise), 'planned');
    }
  }

  const keys = new Set();
  for (const log of state.logs ?? []) {
    if (!dates.has(log.date) || !working(log)) continue;
    const template = templates.get(log.templateId);
    const exercise = template?.exercises?.[log.exerciseIndex];
    if (!exercise) continue; // Legacy corrupt references should never create invented totals.
    const key = `${log.date}|${log.templateId}|${log.exerciseIndex}|${log.set}`;
    if (keys.has(key)) continue;
    keys.add(key);
    const day = byDate.get(log.date);
    completed++; day.completed++;
    if (day.templateId === log.templateId) day.assignedCompleted++;
    else {day.offPlan++;offPlan++;}
    addCount(byMuscle, directMuscle(template, exercise), 'completed');
    if (exercise.repUnit === 'seconds_per_side') {
      timedHolds.push({date: log.date, exercise: exercise.name, secondsPerSide: log.reps, muscle: exercise.muscle});
    } else if (Number.isFinite(log.kg) && Number.isFinite(log.reps)) {
      const contribution = log.kg * log.reps;
      loadVolume += contribution;
      day.loadVolume += contribution;
      volumeEntries.push({date:log.date, exercise:exercise.name, set:log.set, kg:log.kg, reps:log.reps, contribution});
    }
  }
  for (const day of days) {
    if (!day.templateId || !templates.has(day.templateId)) {
      day.status = day.offPlan ? 'off_plan_logged' : 'not_scheduled';
    } else if (day.assignedCompleted === 0) {
      day.status = day.offPlan ? 'off_plan_logged' : 'not_logged';
    } else {
      day.status = day.assignedCompleted >= day.planned ? 'all_sets_logged' : 'partial';
    }
  }
  return {
    planned, completed, assignedCompleted: days.reduce((n,d)=>n+d.assignedCompleted,0),
    offPlan, byMuscle: {...byMuscle}, days, timedHolds, loadVolume,
    volumeEntries: volumeEntries.sort((a,b)=>a.date.localeCompare(b.date) || a.exercise.localeCompare(b.exercise) || a.set-b.set),
    caveat: 'Direct categories only. V10.1 biceps and triceps are separated by exact exercise names; legacy arms without explicit labels remain unclassified. No indirect credits. Logged unilateral sets count once. Untagged legacy logs are assumed working sets.'
  };
}

const sameScope = (x, y) => x.templateId === y.templateId && x.exerciseIndex === y.exerciseIndex;
const serious = x => ['new_weakness','worse_weakness','walking_change'].includes(x.functionChange);
const isDistalSpread = (baseline, followup) =>
  Object.hasOwn(DISTAL, baseline.location) && Object.hasOwn(DISTAL, followup.location) &&
  DISTAL[followup.location] > DISTAL[baseline.location];

/** Observation-level guidance only: never returns 'safe', 'cleared', or loading increases. */
export function recoveryReview(state, workoutDate, today, templateId = null) {
  const entries = (state.symptomLogs ?? []).filter(e =>
    e.date === workoutDate && (templateId === null || e.templateId === templateId));
  if (!entries.length) return {level: 'unknown', message: 'No symptom observations: response unknown, not symptom-free or cleared.', missing: ['before','after','next_day']};
  const missing = ['before','after','next_day'].filter(point=>!entries.some(e=>e.timepoint===point));
  const followups = entries.filter(e=>e.timepoint!=='before');
  const increased = followups.some(e => {
    const baseline = entries.find(b => b.timepoint==='before' && sameScope(b,e));
    return baseline && (e.severity > baseline.severity ||
      (e.numbness && !baseline.numbness) || isDistalSpread(baseline,e));
  });
  if (entries.some(serious)) return {
    level:'medical_review', missing,
    message:'New/worsening weakness or walking changes were recorded. Stop provoking activity and seek prompt clinical assessment. No progression approval.'
  };
  if (increased) return {
    level:'hold', missing,
    message:'Symptoms increased, new numbness appeared, or symptoms spread farther down the leg versus a matched baseline. Hold progression and seek clinical review.'
  };
  if (followups.some(e=>e.severity > 0 && ['calf','foot','multiple'].includes(e.location))) return {
    level:'review', missing,
    message:'Symptoms involving the lower leg, foot, or multiple areas were recorded. If new or worsening, seek clinical review. No automatic loading progression.'
  };
  if (entries.some(e=>e.numbness && e.timepoint!=='before')) return {
    level:'review', missing,
    message:'Numbness was recorded after the workout; a matching baseline was unavailable or no change was established. Seek appropriate clinical review; no automatic progression.'
  };
  const afterDue = addDays(workoutDate,1) <= today;
  if (missing.includes('next_day') && afterDue) return {
    level:'followup_missing',missing,
    message:'Next-morning follow-up is missing. A missing entry is unknown, not a stable response or clearance.'
  };
  if (missing.length) return {
    level:'incomplete',missing,
    message:'Some symptom observations are missing. Do not interpret incomplete records as safe for progression.'
  };
  return {
    level:'observed',missing:[],
    message:'Recorded observations show no detected increase against matching baselines. This is not clinical clearance; [PT Review] remains in effect.'
  };
}