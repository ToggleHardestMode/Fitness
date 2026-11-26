import { activeSetsLabel, activeSetsPanel } from './active-sets-ui.js';
import { DAY_NAMES, isHistoricalWorkout } from './core.js';
import { clearancePanel } from './exercise-clearance-ui.js';
import { equivalencePanel } from './exercise-equivalence-ui.js';
import { effortHint, effortQuickLabel } from './floating-rest.js';
import { QUICK_RPE } from './focus-quick-entry.js';
import { esc } from './html.js';
import { repeatLastSessionSet } from './quick-repeat.js';
import { strengthNextSession, strengthWorkoutDay } from './strength-journey-ui.js';
import { symptomPanel } from './symptom-ui.js';

function resolutionPanel(review, templates) {
  if (!review) return '';
  const options = choice => templates.filter(t => !isHistoricalWorkout(t)).map(t =>
    '<option value="match:' + esc(t.id) + '"' + (choice === 'match:' + t.id ? ' selected' : '') +
    '>' + esc(t.name) + '</option>').join('');
  return '<div class="completed-csv-preview" aria-label="Workout import resolution"><h3>Resolve workout identities</h3>' +
    '<p>Review each file. Edit CSV exercise names only to reflect the actual movement. Missing measurements must be supplied or the file excluded. Historical workouts are unscheduled, history only, and never linked to other plans automatically.</p>' +
    review.map((file, i) => '<details open><summary>' + esc(file.name) + '</summary><p>' +
      esc(file.error || 'Exact library match; check notes and actual movements.') + '</p>' +
      '<label class="form-label" for="completed-review-choice-' + i + '">Resolution</label>' +
      '<select class="field" id="completed-review-choice-' + i + '">' +
      '<option value="">Choose a resolution</option><option value="exact"' +
      (file.choice === 'exact' ? ' selected' : '') + '>Use exact library identity</option>' +
      '<option value="historical"' + (file.choice === 'historical' ? ' selected' : '') +
      '>Create/reuse separate historical workout (one session)</option>' +
      '<option value="skip"' + (file.choice === 'skip' ? ' selected' : '') +
      '>Exclude this file</option><optgroup label="Explicitly match existing workout">' +
      options(file.choice) + '</optgroup></select><label class="form-label" for="completed-review-text-' + i +
      '">CSV rows (editable; retain headings)</label><textarea class="field" rows="6" id="completed-review-text-' +
      i + '">' + esc(file.text) + '</textarea></details>').join('') +
    '<label><input type="checkbox" id="completed-review-ack"> I reviewed actual movements, units, notes and completed measurements. Historical templates are not training prescriptions.</label>' +
    '<div class="quick-actions"><button class="btn" data-action="completed-csv-resolve">Preview resolved batch</button>' +
    '<button class="btn secondary" data-action="completed-csv-cancel">Cancel</button></div></div>';
}

function completedCsvPanel(pending, selected, fmt, review, templates) {
  const preview = pending
    ? '<div class="completed-csv-preview" role="status"><strong>Completed-session import preview</strong>' +
      '<p>' + pending.add.length + ' new working set(s) to add · ' + pending.skipped.length +
      ' identical set(s) already saved · dates: ' + pending.days.map(esc).join(', ') + '</p>' +
      (pending.files ? '<details class="volume-explanation" open><summary>' + pending.files.length +
        ' file(s) reviewed</summary>' + pending.files.map(file =>
        '<p>' + esc(file.name) + ' · ' + file.added + ' new · ' + file.skipped +
        ' already saved · ' + file.duplicates + ' batch duplicates</p>').join('') + '</details>' : '') +
      (pending.historical?.length ? '<p class="hint">Historical workouts to create: ' +
        pending.historical.map(t => esc(t.name)).join('; ') + '. Not scheduled or used as prescriptions.</p>' : '') +
      (pending.excluded?.length ? '<p class="hint">Excluded files (untouched): ' +
        pending.excluded.map(esc).join(', ') + '</p>' : '') +
      '<div class="completed-csv-list">' + pending.add.slice(0, 12).map(row =>
        '<div><strong>' + esc(row.date) + '</strong> · ' + esc(row.exerciseName) + ' · set ' + row.set +
        ' · ' + fmt(row.kg) + ' kg × ' + row.reps + ' reps' +
        (row.rpe == null ? '' : ' · RPE ' + fmt(row.rpe)) + '</div>').join('') + '</div>' +
      (pending.add.length > 12 ? '<p class="hint">Showing the first 12 new sets; all validated rows will be added together.</p>' : '') +
      '<button class="btn secondary small-btn" data-action="completed-csv-reopen">Review file identities and notes</button>' +
      (pending.add.length
        ? '<div class="completed-csv-review"><button class="btn secondary small-btn" type="button" ' +
          'data-action="completed-csv-backup">Download pre-import JSON backup</button>' +
          '<label><input type="checkbox" id="completed-import-backup-ack"> I saved a backup of my current workout history.</label></div>' +
          '<div class="quick-actions"><button class="btn" type="button" data-action="completed-csv-apply">Import ' +
          pending.add.length + ' completed set(s)</button>' +
          '<button class="btn secondary" type="button" data-action="completed-csv-cancel">Cancel</button></div>'
        : '<p class="hint">All completed rows already exist; no changes required.</p>' +
          '<button class="btn secondary small-btn" type="button" data-action="completed-csv-cancel">Close</button>') + '</div>'
    : '';
  return '<section class="card completed-csv-card" aria-label="Import completed workout CSV">' +
    '<div class="card-head"><div><h2>Import completed workout CSV</h2><p>Record sets you actually did on a specific date. ' +
    'This is separate from importing a workout template in Plan.</p></div></div>' +
    '<div class="quick-actions"><button class="btn secondary" type="button" data-action="completed-csv-blank" ' +
    (selected ? '' : 'disabled') + '>Download blank session CSV</button>' +
    '<button class="btn" type="button" data-action="completed-csv-pick">Choose completed CSV files</button></div>' +
    '<p class="hint">Choose a workout above to download a dated, exercise-matched worksheet. Fill kg and reps for completed sets, ' +
    'leave unperformed sets blank, then upload up to 20 CSV files here. Conflicts block the whole batch. Existing sets are never overwritten.</p>' +
    resolutionPanel(review, templates) + preview + '</section>';
}

function setFieldsMarkup(ex, current, previous, focusMode, focusSet) {
  const visibleSetIndices = focusMode ? [focusSet] : Array.from({ length: ex.sets }, (_, i) => i);
  return visibleSetIndices.map(i => {
    const old = current.find(l => l.set === i + 1);
    const prior = previous.find(l => l.set === i + 1);
    const target = ex.setTargets?.[i] ?? { min: ex.min, max: ex.max };
    const unit = ex.repUnit === 'seconds_per_side' ? 'seconds per side' : 'reps';
    const completion = focusMode
      ? `<span class="v152-set-status">${old ? 'Saved' : 'New'}</span>`
      : `<input class="tick" type="checkbox" name="done${i}" aria-label="Mark set ${i + 1} complete" ${old ? 'checked' : ''}>`;
    return `<div class="log-grid set-row ${focusMode ? 'v152-focused-row' : ''}">` +
      `<strong class="tiny set-target-label">${i + 1}<small>${target.min}–${target.max}</small></strong>` +
      `<input class="field" inputmode="decimal" type="number" min="0" max="500" step="0.5" name="kg${i}" ` +
      `aria-label="Set ${i + 1} kilograms" value="${esc(old?.kg ?? prior?.kg ?? '')}">` +
      `<input class="field" inputmode="numeric" type="number" min="1" max="100" step="1" name="reps${i}" ` +
      `aria-label="Set ${i + 1} ${unit}" value="${esc(old?.reps ?? prior?.reps ?? '')}">` +
      `<input class="field" inputmode="decimal" type="number" min="1" max="10" step="0.5" name="rpe${i}" ` +
      `aria-label="Set ${i + 1} effort score 1 to 10 (RPE)" value="${esc(old?.rpe ?? '')}">${completion}</div>`;
  }).join('');
}

function focusControls(state, selection, ex, current, previous) {
  const { activeDate, selected, chosenExercise, focusSet } = selection;
  const repeat = repeatLastSessionSet(state, { date: activeDate, templateId: selected, exerciseIndex: chosenExercise, set: focusSet + 1 });
  const repeatButton = repeat
    ? '<div class="v156-repeat"><button class="btn secondary small-btn" type="button" data-action="focus-repeat">' +
      `↻ Copy saved set ${repeat.sourceSet}</button><span class="hint">${esc(repeat.kg)} kg × ${esc(repeat.reps)} reps. ` +
      'Copies only kg/reps; RPE is entered separately. Review before saving.</span></div>'
    : '';
  const effortButtons = QUICK_RPE.map(value =>
    `<button class="btn secondary small-btn" type="button" data-action="quick-rpe" data-quick-rpe="${value}" ` +
    `aria-label="Set effort to ${effortQuickLabel(value)}">${effortQuickLabel(value)}</button>`).join('');
  const quickControls = `<div class="v1512-quick" aria-label="Optional form-only quick entry">
       <div class="v1512-quick-row"><span>Reps</span>` +
    '<button class="btn secondary small-btn" type="button" data-action="quick-reps-minus" aria-label="Decrease reps by one">−1</button>' +
    `<button class="btn secondary small-btn" type="button" data-action="quick-reps-plus" aria-label="Increase reps by one">+1</button></div>
       <div class="v1512-quick-row"><span>Effort</span>${effortButtons}</div>
       <p class="hint">Shortcuts only edit these fields. ` +
    `Review values and press Save this set to record; nothing saves automatically.</p>
     </div>`;
  const selectedOld = current.find(l => l.set === focusSet + 1);
  const selectedPrior = previous.find(l => l.set === focusSet + 1);
  const unit = ex.repUnit === 'seconds_per_side' ? 'seconds/side' : 'reps';
  const history = selectedOld
    ? 'Saved today — values below are editable.'
    : selectedPrior
      ? `Previous: ${esc(selectedPrior.kg)} kg × ${esc(selectedPrior.reps)} ${unit} (${esc(selectedPrior.date)}). Review before saving.`
      : 'No earlier set recorded. Enter actual values before saving.';
  const intro = `<div class="v152-focus-header"><strong>Set ${focusSet + 1} of ${ex.sets}</strong>` +
    `<span>${selectedOld ? 'Editing a saved set' : 'Not logged yet'}</span></div><p class="v152-history">${history}</p>`;
  const navigation = '<div class="v152-set-navigation">' +
    `<button class="btn secondary small-btn" data-focus-set="${focusSet - 1}" type="button" ` +
    `${focusSet === 0 ? 'disabled' : ''}>← Previous set</button>` +
    `<button class="btn secondary small-btn" data-focus-set="${focusSet + 1}" type="button" ` +
    `${focusSet === ex.sets - 1 ? 'disabled' : ''}>Next set →</button></div>` +
    '<p class="hint">Only the displayed set will be saved. Change the values to match what you actually completed; ' +
    'no weights are increased automatically.</p>';
  return { repeatButton, quickControls, intro, navigation, selectedOld };
}

function logForm(ex, current, fields, focus) {
  const feedback = focus ? focus.selectedOld : current[0];
  const headers = '<div class="log-grid"><span class="micro">SET</span><span class="micro">KG</span>' +
    `<span class="micro">${ex.repUnit === 'seconds_per_side' ? 'SEC/SIDE' : 'REPS'}</span>` +
    '<span class="micro">EFFORT</span><span class="micro">✓</span></div>';
  const standardHint = '<p class="hint" style="margin-top:10px">Check the sets you completed. ' +
    'Saving updates existing checked sets for this day, not historical sets. Use 0 kg for unweighted movements.</p>';
  return `<form id="sets-form">${focus?.intro ?? ''}${headers}${fields}` +
    `<p class="fp-effort-help"><strong>How hard did it feel?</strong> ${esc(effortHint)}</p>` +
    `${focus?.repeatButton ?? ''}${focus?.quickControls ?? ''}<div class="divider"></div>` +
    '<div class="metrics-grid"><label><span class="form-label">Rest (seconds)</span>' +
    '<input class="field" type="number" min="0" max="600" inputmode="numeric" name="rest" ' +
    `value="${current[0]?.rest ?? ex.rest}"></label><label><span class="form-label">Tempo (optional)</span>` +
    `<input class="field" name="tempo" maxlength="40" placeholder="e.g. 3-1-1" value="${esc(current[0]?.tempo ?? '')}"></label></div>` +
    '<div class="metrics-grid"><label><span class="form-label">How did this exercise feel?</span>' +
    '<select class="field" name="difficulty"><option value="">Not rated</option>' +
    `<option value="too_easy" ${feedback?.difficulty === 'too_easy' ? 'selected' : ''}>Too easy</option>` +
    `<option value="on_target" ${feedback?.difficulty === 'on_target' ? 'selected' : ''}>On target</option>` +
    `<option value="too_hard" ${feedback?.difficulty === 'too_hard' ? 'selected' : ''}>Too hard</option></select></label>` +
    '<label><span class="form-label">Technique quality</span><select class="field" name="technique">' +
    '<option value="">Not rated</option>' +
    `<option value="controlled" ${feedback?.technique === 'controlled' ? 'selected' : ''}>Controlled</option>` +
    `<option value="unstable" ${feedback?.technique === 'unstable' ? 'selected' : ''}>Unstable</option></select></label></div>` +
    '<p class="hint">Feedback applies to each set you save now. Effort is how hard it felt; leave the score blank if unsure.</p>' +
    '<label><span class="form-label">Session note (optional)</span>' +
    '<input class="field" name="notes" maxlength="250" placeholder="How did this movement feel?" ' +
    `value="${esc(current[0]?.notes ?? '')}"></label><div class="form-actions">` +
    `<button class="btn" type="submit">${focus ? 'Save this set' : 'Save checked sets'}</button>` +
    `<button class="btn secondary" data-rest="${ex.rest}" type="button">Rest ${ex.rest}s · floating timer</button></div>` +
    `${focus ? focus.navigation : standardHint}</form>`;
}

function exerciseMarkup(state, selection, { rangeSummary, isPTReview, today }) {
  const { workout, activeDate, selected, chosenExercise, focusMode, focusSet } = selection;
  const ex = workout.exercises[chosenExercise];
  const matchingExercise = l => l.templateId === selected && l.exerciseIndex === chosenExercise;
  const current = state.logs.filter(l => l.date === activeDate && matchingExercise(l));
  const previous = state.logs.filter(l => l.date < activeDate && matchingExercise(l)).sort((a, b) => b.date.localeCompare(a.date));
  const fields = setFieldsMarkup(ex, current, previous, focusMode, focusSet);
  const focus = focusMode ? focusControls(state, selection, ex, current, previous) : null;
  const exList = workout.exercises.map((e, i) => {
    const done = state.logs.filter(l => l.date === activeDate && l.templateId === selected && l.exerciseIndex === i).length;
    const active = activeSetsLabel(state, selected, i);
    return `<button class="exercise-choice ${i === chosenExercise ? 'active' : ''}" type="button" data-exercise="${i}">` +
      `<div><strong>${i + 1}. ${esc(e.name)}</strong><span>${esc(e.muscle)} · ${e.sets} sets · ${esc(rangeSummary(e))}` +
      `${active ? ' · ' + active : ''}</span></div><b>${done}/${e.sets}</b></button>`;
  }).join('');
  const picker = focusMode
    ? '<details class="v152-exercise-picker">' +
      `<summary>Exercise ${chosenExercise + 1} of ${workout.exercises.length} · Change exercise</summary>${exList}</details>`
    : exList;
  const review = isPTReview(workout)
    ? '<div class="notice warn"><strong>[PT Review] — Not clinically cleared.</strong> ' +
      'Do not treat this template as approval to train or progress loaded lower-body movements. ' +
      'Seek the recommended professional review.</div>'
    : '';
  const displayUnit = ex.repUnit === 'seconds_per_side' ? 'seconds/side' : 'reps';
  const exerciseSelection = { templateId: selected, exerciseIndex: chosenExercise };
  return '<div class="section-label"><h2>Exercises</h2><span>Tap to record</span></div>' +
    '<div class="exercise-layout"><div class="stack codex-exercises" aria-label="Choose exercise">' +
    `${picker}</div><div class="card codex-log-panel"><div class="card-head"><div><div class="eyebrow">LOG YOUR SETS</div>` +
    `<h2 style="margin-top:5px">${esc(ex.name)}</h2><p>${ex.sets} sets · ${esc(rangeSummary(ex))} ${displayUnit} · ${ex.rest}s rest</p>` +
    `</div><span class="badge">${esc(ex.muscle).toUpperCase()}</span></div>
    ${review}
    ${workout.sourceVersion ? `<div class="hint">Source: ${esc(workout.sourceVersion)}</div>` : ''}
    ${workout.equipmentNote ? `<div class="hint"><strong>Equipment:</strong> ${esc(workout.equipmentNote)}</div>` : ''}
    ${ex.sourceNote ? `<div class="notice"><strong>Exercise instructions:</strong> ${esc(ex.sourceNote)}</div>` : ''}
    ${strengthNextSession(state, { date: activeDate, ...exerciseSelection })}
    ${equivalencePanel(state, exerciseSelection)}
    ${clearancePanel(state, { ...exerciseSelection, date: activeDate, today: today() })}
    ${activeSetsPanel(state, exerciseSelection)}
    ${logForm(ex, current, fields, focus)}</div></div>`;
}

function workoutSummary(state, { workout, activeDate, selected, day }) {
  const logged = state.logs.filter(l => l.date === activeDate && l.templateId === selected).length;
  const planned = workout.exercises.reduce((n, e) => n + e.sets, 0);
  const progress = Math.min(100, Math.round(logged / planned * 100));
  return '<section class="codex-session"><div class="codex-session-heading"><div>' +
    `<div class="eyebrow">CURRENT WORKOUT · ${DAY_NAMES[day]}</div><h2>${esc(workout.name)}</h2></div>` +
    `<div class="codex-count"><strong>${logged} / ${planned}</strong><div>sets logged</div></div></div>` +
    `<div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>` +
    '<p class="hint">Saved working sets only. No clinical clearance is implied.</p></section>';
}

function metricsForm(metrics) {
  const fields = [
    ['weight', 'Body weight (kg)', '0.1'],
    ['calories', 'Calories (kcal)', '1'],
    ['protein', 'Protein (g)', '1'],
    ['sleep', 'Sleep (hours)', '0.1'],
    ['recovery', 'Recovery (1–5)', '1'],
  ];
  const inputs = fields.map(([key, label, step]) =>
    `<label><span class="form-label">${label}</span><input class="field" type="number" inputmode="decimal" step="${step}" ` +
    `name="${key}" value="${esc(metrics[key] ?? '')}" placeholder="Not recorded"></label>`).join('');
  return `<section class="card"><form id="metrics-form"><div class="metrics-grid">${inputs}</div>` +
    '<div class="form-actions"><button class="btn secondary" type="submit">Save daily check-in</button></div>' +
    '<p class="hint" style="margin-top:10px">Only enter values you measured. Blank fields are not guessed.</p></form></section>';
}

export function trainView(state, selection, helpers) {
  const { workout, activeDate, selected, day, focusMode, pendingCompletedCsv, pendingCompletedReview } = selection;
  const { fmt, nice, shellHeading, heading } = helpers;
  const options = '<option value="">Select a workout</option>' + state.templates.filter(t => !isHistoricalWorkout(t)).map(t =>
    `<option value="${esc(t.id)}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  const metrics = state.metrics.find(m => m.date === activeDate) || {};
  const exercises = workout ? exerciseMarkup(state, selection, helpers)
    : `<div class="card empty"><strong>${state.templates.length ? 'No workout selected' : 'No templates yet'}</strong>` +
      (state.templates.length
        ? 'Choose any workout above or assign a day in Plan.'
        : 'Go to Dashboard and load the example plan, or import your own CSV in Plan.') + '</div>';
  const mode = workout
    ? '<div class="v152-mode-toggle"><button type="button" class="btn secondary small-btn" data-action="focus-toggle" ' +
      `aria-pressed="${focusMode}">${focusMode ? 'Use standard logging' : 'Try Focus Mode'}</button>` +
      `<span>${focusMode ? 'One set at a time, with editable values' : 'Standard log — multiple sets at once'}</span></div>`
    : '';
  const daySets = state.logs.filter(l => l.date === activeDate).length;
  const title = heading('TRAINING', 'One set at a time', 'Choose an exercise, record your completed sets, then rest before the next one.');
  return `${shellHeading()}${title}
  <div class="card"><div class="two-panels"><label><span class="form-label" style="margin-top:0">Workout date</span>` +
    `<input class="field" type="date" id="active-date" value="${activeDate}"></label>` +
    '<label><span class="form-label" style="margin-top:0">Workout for this date</span>' +
    `<select class="field" id="active-workout">${options}</select></label></div>` +
    `<div class="inline-meta"><span class="dot"></span>${DAY_NAMES[day]} · ${daySets} set(s) saved</div></div>
  ${completedCsvPanel(pendingCompletedCsv, selected, fmt, pendingCompletedReview, state.templates)}
  ${workout ? workoutSummary(state, selection) : ''}
  ${mode}
  ${workout ? strengthWorkoutDay(state, { templateId: selected, date: activeDate }) : ''}
  ${exercises}<div class="section-label"><h2>Daily check-in</h2><span>${nice(activeDate)}</span></div>` +
    `${metricsForm(metrics)}${symptomPanel(activeDate, state, selected)}`;
}
