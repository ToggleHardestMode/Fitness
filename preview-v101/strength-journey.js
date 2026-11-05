// Pure selectors: saved working sets only. No training records or targets are mutated.
export const STRENGTH_RULE_VERSION = "strength-v1";
import { linkedSources } from "./exercise-equivalence.js";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isWorking = row => row && row.isWarmup !== true && row.kind !== "warmup";
const isValid = row => isWorking(row) && DATE.test(row.date) &&
  Number.isFinite(row.kg) && row.kg >= 0 && row.kg <= 500 &&
  Number.isInteger(row.reps) && row.reps >= 1 && row.reps <= 100;
const ptReview = (template, exercise) =>
  Boolean(template.requiresClinicalReview || template.name.includes("[PT Review]") || /\[PT\]/i.test(exercise.name));
const concern = row => row.severity !== 0 || row.tingling !== false ||
  row.numbness !== false || row.location !== "none" || row.functionChange !== "none";

function responseStatus(state, date, templateId, exerciseIndex) {
  const rows = (state.symptomLogs || []).filter(row => row.date === date &&
    (row.templateId == null || (row.templateId === templateId &&
    (row.exerciseIndex == null || row.exerciseIndex === exerciseIndex))));
  if (rows.some(concern)) return "concerning";
  return ["before", "after", "next_day"].every(timepoint =>
    rows.some(row => row.timepoint === timepoint)) ? "complete" : "unknown";
}

export function getExerciseJourney(state, templateId, exerciseIndex) {
  const template = (state.templates || []).find(item => item.id === templateId);
  const exercise = template?.exercises?.[exerciseIndex];
  if (!exercise || !Number.isInteger(exerciseIndex))
    throw Error("Select an existing workout exercise to inspect.");
  const startDate = state.strengthJourneyStartDate || null;
  const allValid = (state.logs || []).filter(row => isValid(row) &&
    (!startDate || row.date >= startDate));
  const day1 = startDate || (allValid.length ? allValid.reduce((min, log) =>
    log.date < min ? log.date : min, allValid[0].date) : null);
  const sessionsOf = (tid, index, ex) => {
    const days = new Map();
    for (const row of allValid) {
      if (row.templateId !== tid || row.exerciseIndex !== index ||
          !Number.isInteger(row.set) || row.set < 1 || row.set > ex.sets) continue;
      if (!days.has(row.date)) days.set(row.date, new Map());
      // Existing validator disallows duplicates; first occurrence wins for defensive reads.
      if (!days.get(row.date).has(row.set)) days.get(row.date).set(row.set, row);
    }
    return [...days.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, setMap]) => {
        const sets = [...setMap.values()].sort((a, b) => a.set - b.set)
          .map(row => ({set:row.set, kg:row.kg, reps:row.reps, rpe:row.rpe ?? null,
            difficulty:row.difficulty || "", technique:row.technique || "", id:row.id}));
        const top = sets.reduce((best, row) =>
          !best || row.kg > best.kg || (row.kg === best.kg && row.reps > best.reps) ? row : best, null);
        return {date, sets, kg:top.kg, reps:top.reps, rpe:top.rpe};
      });
  };
  const sessions = sessionsOf(templateId, exerciseIndex, exercise);
  // Sessions of owner-linked earlier exercises: display and starting-weight reference only.
  const linkedSessions = [];
  for (const source of linkedSources(state, templateId, exerciseIndex)) {
    const sourceExercise = (state.templates || []).find(item => item.id === source.templateId)?.exercises?.[source.exerciseIndex];
    if (!sourceExercise) continue;
    for (const session of sessionsOf(source.templateId, source.exerciseIndex, sourceExercise))
      linkedSessions.push({...session, linked:true, source:{templateId:source.templateId,
        exerciseIndex:source.exerciseIndex, exerciseName:sourceExercise.name}});
  }
  linkedSessions.sort((a, b) => a.date.localeCompare(b.date));
  const allSessions = linkedSessions.length ?
    [...linkedSessions, ...sessions].sort((a, b) => a.date.localeCompare(b.date)) : sessions;
  const latest = sessions.at(-1) || null;
  const first = sessions[0] || null;
  const rated = sessions.reduce((total, session) =>
    total + session.sets.filter(set => Number.isFinite(set.rpe)).length, 0);
  const total = sessions.reduce((count, session) => count + session.sets.length, 0);
  const calibrated = {
    sessions:sessions.length, ratedSets:rated, totalSets:total,
    firstLoad:first?.kg ?? null, latestLoad:latest?.kg ?? null,
    loadChange:first && latest ? Math.round((latest.kg - first.kg) * 100) / 100 : null,
    evidence:sessions.length >= 3 ? "Multiple sessions" :
      sessions.length === 2 ? "Two sessions" : sessions.length === 1 ? "Single session" : "No sessions"
  };
  return {template, exercise, day1, firstExerciseDay:first?.date || null, sessions, linkedSessions, allSessions, calibrated};
}

export function recommendNextExercise(state, {templateId, exerciseIndex, date}) {
  if (!DATE.test(date)) throw Error("Next workout date must be YYYY-MM-DD.");
  const journey = getExerciseJourney(state, templateId, exerciseIndex);
  const {template, exercise} = journey;
  const sessions = journey.sessions.filter(row => row.date < date);
  const latest = sessions.at(-1) || null;
  const base = {version:STRENGTH_RULE_VERSION, status:"review", targets:[],
    reason:"", priorDate:latest?.date || null, sampleSessions:sessions.length};
  if (!latest) {
    const linked = journey.linkedSessions.filter(row => row.date < date).at(-1);
    if (!linked) return {...base, status:"no-history",
      reason:"No previous recorded workout before this date. Select a trial weight manually."};
    return {...base, status:"no-history",
      reference:{date:linked.date, kg:linked.kg, reps:linked.reps, exerciseName:linked.source.exerciseName},
      reason:"No previous recorded workout of this exercise before this date. Linked earlier history (" +
        linked.source.exerciseName + ", " + linked.date + ", " + linked.kg + " kg x " + linked.reps +
        " reps) is a reference for choosing a starting weight, not a target. Select a trial weight manually."};
  }
  if (ptReview(template, exercise)) return {...base, status:"pt-review",
    reason:"[PT Review]: previous sets are reference only. No loading recommendation."};
  if (exercise.repUnit === "seconds_per_side") return {...base, status:"timed",
    reason:"Timed holds use seconds/side and cannot receive a kilogram progression target."};
  const repeat = latest.sets.map(row => ({set:row.set, kg:row.kg, reps:row.reps}));
  const hold = reason => ({...base, status:"hold", targets:repeat, reason});
  if (responseStatus(state, latest.date, templateId, exerciseIndex) === "concerning")
    return {...base, status:"symptom-review", reason:"Concerning symptoms were recorded. No target is suggested."};
  if (latest.sets.length !== exercise.sets)
    return hold("The previous workout has incomplete working sets. Repeat or adjust the recorded loads manually.");
  if (latest.sets.some(row => row.technique === "unstable" || row.difficulty === "too_hard"))
    return hold("Technique or difficulty feedback indicates excessive challenge. Review the load before progressing.");
  if (latest.sets.some(row => !Number.isFinite(row.rpe) || row.rpe > 8))
    return hold("Effort was missing or above RPE 8. Do not increase the previous load.");
  if (responseStatus(state, latest.date, templateId, exerciseIndex) !== "complete")
    return hold("Before, after and next-day symptom observations are incomplete. No progression.");
  const currentRecovery = (state.metrics || []).find(row => row.date === date)?.recovery;
  if (!Number.isInteger(currentRecovery) || currentRecovery < 4)
    return hold("Recovery score 4–5 is not recorded for this workout date. No progression.");
  const targets = latest.sets.map(row => exercise.setTargets?.[row.set - 1] ||
    {min:exercise.min, max:exercise.max});
  if (latest.sets.some((row, index) =>
    row.reps < targets[index].min ||
    (row.reps > targets[index].max && !(row.difficulty === "too_easy" && row.rpe <= 6))))
    return hold("Repetitions are outside the prescribed range without verified low-effort feedback. Review the load.");
  const sameLoad = latest.sets.every(row => row.kg === latest.sets[0].kg);
  if (!sameLoad) return hold("Previous sets used different loads. Calibrate each working set manually.");
  if (latest.sets.some((row, index) => row.reps < targets[index].max)) {
    const easy = latest.sets.every(row => row.difficulty === "too_easy" && row.rpe <= 6);
    const extra = easy ? 2 : 1;
    return {...base, status:"rep", targets:latest.sets.map((row, index) =>
      ({set:row.set, kg:row.kg, reps:Math.min(row.reps + extra, targets[index].max)})),
      reason:easy ? "Low-effort feedback recorded with recovery gates passed. Trial: up to two more reps per set." :
        "Recovery and effort gates passed. Trial: one more rep within each set range."};
  }
  const previous = sessions.at(-2);
  if (!previous || previous.sets.length !== exercise.sets ||
      responseStatus(state, previous.date, templateId, exerciseIndex) !== "complete" ||
      previous.sets.some((row, index) => row.kg !== latest.sets[index].kg ||
        row.reps < targets[index].max || !Number.isFinite(row.rpe) || row.rpe > 8 ||
        row.technique === "unstable" || row.difficulty === "too_hard"))
    return hold("One complete top-of-range session is not enough to increase load. Repeat first.");
  const step = state.progressionStepKg;
  if (![0.5,1,2,2.5,4].includes(step))
    return hold("Top of range twice. Choose your actual dumbbell increment before a kilogram suggestion.");
  if (latest.sets.some(row => row.kg + step > 500))
    return hold("The proposed increment exceeds the supported weight range.");
  return {...base, status:"load", targets:latest.sets.map((row, index) => ({
    set:row.set, kg:Math.round((row.kg + step) * 100) / 100,
    reps:targets[index].min})),
    reason:"Two comparable sessions reached the top of every set range with controlled effort and complete recovery observations. Trial the selected smallest available weight increment."};
}
