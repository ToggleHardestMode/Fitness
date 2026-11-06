import {getExerciseJourney, recommendNextExercise} from "./strength-journey.js";
import {renderStrengthJourney} from "./strength-journey-visual.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g,
  mark => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[mark]));
const fmt = value => Number(value).toLocaleString("en-SG",{maximumFractionDigits:2});

// Dashboard layout is isolated from the existing Train target workflow.
export function strengthDashboard(state, selectedIndex = 0, options = {}) {
  return renderStrengthJourney(state, selectedIndex, options);
}

export function strengthNextSession(state, selection) {
  const journey = getExerciseJourney(state,selection.templateId,selection.exerciseIndex);
  const plan = recommendNextExercise(state,selection);
  const options = [["","Choose increment"],["0.5","0.5 kg"],["1","1 kg"],
    ["2","2 kg"],["2.5","2.5 kg"],["4","4 kg"]];
  const step = state.progressionStepKg == null ? "" : String(state.progressionStepKg);
  const rows = plan.targets.map(target => '<tr><th scope="row">Set ' + target.set +
    '</th><td>' + fmt(target.kg) + ' kg</td><td>' + target.reps +
    ' reps</td></tr>').join("");
  return '<section class="strength-target" aria-label="Next session targets">' +
    '<h3>Next session · optional targets</h3>' +
    '<p class="hint">Based on ' + plan.sampleSessions + ' earlier session(s). ' +
    'No planned or suggested values count as completed sets.</p>' +
    (rows ? '<table class="strength-target-table"><thead><tr><th>Set</th><th>Load entered</th><th>Target</th></tr></thead><tbody>' +
      rows + '</tbody></table>' : '<p class="hint">No numeric target available.</p>') +
    (plan.reference ? '<p class="hint"><strong>Linked earlier history (reference only):</strong> ' +
      esc(plan.reference.exerciseName) + ' · ' + esc(plan.reference.date) + ' · ' + fmt(plan.reference.kg) +
      ' kg × ' + plan.reference.reps + ' reps. Not a target.</p>' : '') +
    '<p class="hint"><strong>Why:</strong> ' + esc(plan.reason) + '</p>' +
    '<div class="strength-calibration">Calibration: ' + journey.calibrated.sessions +
    ' saved session(s) · ' + journey.calibrated.ratedSets + '/' +
    journey.calibrated.totalSets + ' sets rated for effort</div>' +
    '<form id="strength-step-form"><label class="form-label" for="strength-step">Smallest available load increment (in recorded kg units)</label>' +
    '<div class="strength-step-row"><select class="field" id="strength-step" name="step">' +
    options.map(([value,label]) => '<option value="' + value + '"' +
    (step === value ? ' selected' : '') + '>' + label + '</option>').join("") +
    '</select><button class="btn secondary" type="submit">Save increment</button></div>' +
    '</form><p class="hint">The increment only informs a suggested load, never pre-fills or saves your workout. ' +
    'Progression requires completed before/after/next-day observations, current recovery and appropriate effort. ' +
    '[PT Review] restrictions remain unchanged.</p></section>';
}


// Entire selected workout, not just the currently focused exercise.
// A suggested target is read-only and never becomes a saved workout set.
export function strengthWorkoutDay(state, {templateId, date}) {
  const template = (state.templates || []).find(item => item.id === templateId);
  if (!template) return '';
  const rows = template.exercises.map((exercise, exerciseIndex) => {
    const plan = recommendNextExercise(state, {templateId, exerciseIndex, date});
    const safeTarget = plan.status === 'rep' || plan.status === 'load';
    const target = safeTarget
      ? plan.targets.map(set => 'Set ' + set.set + ': ' + fmt(set.kg) + ' kg × ' +
          set.reps + ' reps').join(' · ')
      : plan.status === 'timed' ? 'Record actual seconds per side'
      : plan.status === 'pt-review' || plan.status === 'symptom-review'
        ? 'On hold — review first'
        : plan.status === 'hold' ? 'Repeat or adjust manually; no increase'
        : 'Choose a trial load manually';
    const outcome = plan.status === 'load' ? 'Possible weight increase' :
      plan.status === 'rep' ? 'Possible rep increase' :
      plan.status === 'pt-review' ? 'PT review required' :
      plan.status === 'symptom-review' ? 'Symptom review required' :
      plan.status === 'hold' ? 'Hold / repeat' :
      plan.status === 'timed' ? 'Timed exercise' : 'No comparable history';
    return '<tr><th scope="row">' + esc(exercise.name) +
      '</th><td><strong>' + esc(outcome) + '</strong><small>' +
      esc(target) + '</small></td><td><details><summary>Why?</summary><p>' +
      esc(plan.reason) + '</p></details></td></tr>';
  }).join('');
  return '<details class="card fp-workout-next" aria-label="Full workout next-session guide">' +
    '<summary><strong>Next-session guide · all exercises</strong><span>' +
    template.exercises.length + ' exercises · ' + esc(template.name) + '</span></summary>' +
    '<p class="hint">For ' + esc(date) + ' · Nothing here is automatically saved or counted as completed.</p>' +
    '<div class="fp-workout-next-scroll"><table><thead><tr><th>Exercise</th>' +
    '<th>Next attempt</th><th>Reason</th></tr></thead><tbody>' + rows +
    '</tbody></table></div>' +
    '<p class="hint">Suggestions use this plan’s completed comparable sets and recorded recovery. ' +
    'Matching exercise history from other workout plans is shown as a reference, ' +
    'not automatic permission to increase weight. If you did not complete a movement, skip it.</p></details>';
}
