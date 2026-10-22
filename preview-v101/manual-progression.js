// Read-only candidate planning. Not a strength prescription or medical clearance.
const isPT = template => Boolean(template?.requiresClinicalReview || template?.name?.includes('[PT Review]'));
const sameSet = (row, templateId, exerciseIndex, set) =>
  row.templateId === templateId && row.exerciseIndex === exerciseIndex && row.set === set;
const concerning = row => row.severity !== 0 || row.tingling !== false ||
  row.numbness !== false || row.functionChange !== 'none' || row.location !== 'none';
const observations = (state, date, templateId, exerciseIndex) =>
  (state.symptomLogs || []).filter(row => row.date === date &&
    (row.templateId === null || (row.templateId === templateId &&
      (row.exerciseIndex === null || row.exerciseIndex === exerciseIndex))));
const completeResponse = (state, date, templateId, exerciseIndex) => {
  const rows = observations(state,date,templateId,exerciseIndex);
  return ['before','after','next_day'].every(t=>rows.some(r=>r.timepoint===t)) &&
    !rows.some(concerning);
};

export function manualProgression(state, {date, templateId, exerciseIndex, set}) {
  const template = state.templates.find(t => t.id === templateId);
  const exercise = template?.exercises?.[exerciseIndex];
  if (!exercise || !Number.isInteger(set) || set < 1 || set > exercise.sets ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw Error('Choose a valid exercise, set and date for progression review.');
  }
  const past = (state.logs || [])
    .filter(row => sameSet(row, templateId, exerciseIndex, set) &&
      row.date < date && row.isWarmup !== true && row.kind !== 'warmup')
    .sort((a,b) => b.date.localeCompare(a.date));
  const uniqueDays = [];
  for (const row of past) {
    if (!uniqueDays.some(other => other.date === row.date)) uniqueDays.push(row);
  }
  const latest = uniqueDays[0] || null;
  const base = {history:latest ? {date:latest.date,kg:latest.kg,reps:latest.reps,rpe:latest.rpe} : null,
    candidate:null, status:'review', reason:''};
  if (!latest) return {...base,status:'no-history',reason:'No comparable earlier set. Enter real values manually.'};
  if (isPT(template) || /\[PT\]/i.test(exercise.name)) {
    return {...base,status:'pt-review',reason:'Lower-body PT review: previous results are reference only. No progression suggestion.'};
  }
  if (exercise.repUnit === 'seconds_per_side') {
    return {...base,reason:'Timed hold: prior seconds/side are reference only; no automatic progression.'};
  }
  const checkin=(state.metrics || []).find(m=>m.date===date);
  if (!checkin || !Number.isInteger(checkin.recovery) || checkin.recovery < 4) {
    return {...base,reason:'Recovery score of 4–5 is not recorded for this day. Repeat or adjust manually; no progression candidate.'};
  }
  const timeline=observations(state,latest.date,templateId,exerciseIndex);
  if (timeline.some(concerning)) {
    return {...base,reason:'Recorded symptoms or functional changes require review; no progression candidate.'};
  }
  if (!completeResponse(state,latest.date,templateId,exerciseIndex)) {
    return {...base,reason:'Before, after and next-day observations are incomplete. Delayed response remains unknown; no progression candidate.'};
  }
  const target=exercise.setTargets?.[set-1] || {min:exercise.min,max:exercise.max};
  if (!Number.isFinite(latest.kg) || !Number.isInteger(latest.reps) ||
      latest.rpe == null || !Number.isFinite(latest.rpe) || latest.rpe > 8 ||
      latest.reps < target.min || latest.reps > target.max) {
    return {...base,reason:'Prior set is outside the target range or effort was unrecorded/high. Review performance before progressing.'};
  }
  if (latest.reps < target.max) {
    return {...base,status:'rep-candidate',candidate:{kg:latest.kg,reps:latest.reps+1},
      reason:'Optional same-weight +1 rep candidate, only if technique and symptoms remain acceptable. Not filled or saved automatically.'};
  }
  const prior=uniqueDays[1];
  const stableSecond=prior && prior.reps >= target.max && prior.kg === latest.kg &&
    Number.isFinite(prior.rpe) && prior.rpe <= 8 &&
    completeResponse(state,prior.date,templateId,exerciseIndex);
  if (stableSecond) {
    return {...base,status:'load-review',
      reason:'Top of rep range on two recorded sessions. Review the smallest available dumbbell increment manually, subject to symptoms and technique. No automatic load change.'};
  }
  return {...base,reason:'Top of rep range; repeat previous weight/reps while monitoring recovery. No load suggestion yet.'};
}
