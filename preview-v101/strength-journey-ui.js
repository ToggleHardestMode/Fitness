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
