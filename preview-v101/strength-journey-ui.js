import {getExerciseJourney, recommendNextExercise} from "./strength-journey.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g,
  mark => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[mark]));
const fmt = value => Number(value).toLocaleString("en-SG",{maximumFractionDigits:2});

function plot(sessions) {
  if (!sessions.length) return '<p class="hint">No completed sets for this exercise yet.</p>';
  const width = 600, left = 40, right = 580, top = 18, bottom = 172;
  const highest = Math.max(1, ...sessions.map(row => row.kg));
  const ceiling = Math.max(1, Math.ceil(highest / 2) * 2);
  const x = index => sessions.length === 1 ? (left + right) / 2 :
    left + (right - left) * index / (sessions.length - 1);
  const y = kg => bottom - (bottom - top) * kg / ceiling;
  const path = sessions.map((row,index) =>
    fmt(x(index)) + "," + fmt(y(row.kg))).join(" ");
  const circles = sessions.map((row,index) =>
    '<circle cx="' + fmt(x(index)) + '" cy="' + fmt(y(row.kg)) +
    '" r="5" class="strength-point"><title>' + esc(row.date + ": " +
    fmt(row.kg) + " kg × " + row.reps + " reps (heaviest saved set)") +
    '</title></circle>').join("");
  return '<svg class="strength-plot" viewBox="0 0 600 205" role="img" aria-label="' +
    esc("Actual heaviest saved working set each session from " +
      sessions[0].date + " through " + sessions.at(-1).date) + '">' +
    '<line x1="40" x2="580" y1="172" y2="172" class="strength-axis"/>' +
    '<line x1="40" x2="580" y1="18" y2="18" class="strength-grid"/>' +
    '<text x="8" y="22" class="strength-label">' + fmt(ceiling) + '</text>' +
    '<text x="15" y="176" class="strength-label">0</text>' +
    '<polyline fill="none" class="strength-line" points="' + path + '"/>' + circles +
    '<text x="40" y="197" class="strength-label">' + esc(sessions[0].date) + '</text>' +
    '<text x="580" y="197" text-anchor="end" class="strength-label">' +
      esc(sessions.at(-1).date) + '</text></svg>';
}

export function strengthDashboard(state, selectedIndex = 0) {
  const choices = [];
  for (const template of state.templates || []) {
    template.exercises.forEach((exercise, exerciseIndex) => {
      const journey = getExerciseJourney(state, template.id, exerciseIndex);
      if (journey.sessions.length && exercise.repUnit !== "seconds_per_side")
        choices.push({template, exercise, journey, exerciseIndex});
    });
  }
  if (!choices.length) return '<section class="card strength-card"><h2>Strength Journey</h2>' +
    '<p class="hint">Your Day 1 chart appears when you save a completed weight-based working set. No sample values are used.</p></section>';
  const index = Number.isInteger(selectedIndex) && selectedIndex >= 0 &&
    selectedIndex < choices.length ? selectedIndex : 0;
  const chosen = choices[index], journey = chosen.journey;
  const {sessions, calibrated} = journey;
  const rows = sessions.slice().reverse().map(row =>
    '<details class="strength-session"><summary>' + esc(row.date) + ' · ' +
    fmt(row.kg) + ' kg × ' + row.reps + ' reps</summary>' +
    row.sets.map(set => '<div>Set ' + set.set + ': ' + fmt(set.kg) +
      ' kg × ' + set.reps + ' reps' + (set.rpe == null ? '' : ' · RPE ' + fmt(set.rpe)) +
      (set.difficulty ? ' · ' + esc(set.difficulty.replace("_", " ")) : '') +
      (set.technique ? ' · ' + esc(set.technique) : '') + '</div>').join("") +
    '</details>').join("");
  return '<section class="card strength-card" aria-label="Strength journey">' +
    '<div class="card-head"><div><h2>Strength Journey</h2>' +
    '<p>Actual recorded workouts from Day 1 · saved sets only</p></div>' +
    '<span class="badge">ALL-TIME</span></div>' +
    '<label class="strength-filter"><span class="form-label">Exercise (workout version kept separate)</span>' +
    '<select class="field" id="strength-exercise">' +
    choices.map(({template,exercise},i) => '<option value="' + i + '"' +
      (i === index ? ' selected' : '') + '>' + esc(exercise.name + " · " + template.name) +
      '</option>').join("") + '</select></label>' +
    '<div class="strength-stats"><div><small>Journey Day 1</small><strong>' +
      esc(journey.day1 || "Unknown") + '</strong></div><div><small>Exercise sessions</small><strong>' +
      calibrated.sessions + '</strong></div><div><small>Load change</small><strong>' +
      (calibrated.loadChange == null ? "—" :
        (calibrated.loadChange > 0 ? "+" : "") + fmt(calibrated.loadChange) + " kg") +
      '</strong></div></div>' + plot(sessions) +
    '<p class="hint">Each point is the heaviest saved working set that day, not a strength prediction. ' +
    'Reps, RPE and qualitative feedback remain inspectable below. Kilograms are displayed exactly as entered.</p>' +
    '<div class="strength-session-list">' + rows + '</div>' +
    '<p class="hint">Calibration: ' + esc(calibrated.evidence) + ' · ' + calibrated.ratedSets +
    '/' + calibrated.totalSets + ' working sets with RPE. Different workout versions are not merged.</p></section>';
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
    '<form id="strength-step-form"><label class="form-label" for="strength-step">Smallest available per-dumbbell weight increase</label>' +
    '<div class="strength-step-row"><select class="field" id="strength-step" name="step">' +
    options.map(([value,label]) => '<option value="' + value + '"' +
    (step === value ? ' selected' : '') + '>' + label + '</option>').join("") +
    '</select><button class="btn secondary" type="submit">Save increment</button></div>' +
    '</form><p class="hint">The increment only informs a suggested load, never pre-fills or saves your workout. ' +
    'Progression requires completed before/after/next-day observations, current recovery and appropriate effort. ' +
    '[PT Review] restrictions remain unchanged.</p></section>';
}
