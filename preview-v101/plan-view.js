import { DAYS, DAY_NAMES } from './core.js';
import { esc } from './html.js';
import { returnStagePanel } from './return-training-ui.js';
import { V101_EQUIPMENT } from './v101-data.js';

function scheduleRows(state) {
  return DAYS.map((_, index) => {
    const assigned = state.assignments[index] || '';
    const options = state.templates.map(t =>
      `<option value="${esc(t.id)}" ${assigned === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    return `<div class="schedule-row"><label for="day${index}">${DAY_NAMES[index]}</label>` +
      `<select class="field" id="day${index}" name="day${index}">` +
      `<option value="">Rest day</option>${options}</select></div>`;
  }).join('');
}

function csvPreview(workouts) {
  if (!workouts) return '';
  const rows = workouts.map(w =>
    `<p><strong>${DAY_NAMES[w.day]} · ${esc(w.name)}</strong> — ${w.exercises.length} exercises</p>`).join('');
  return `<div class="notice"><strong>Import preview ready:</strong> ${workouts.length} workout template(s). ` +
    'This adds templates only; it will not alter the existing schedule or workout logs.' +
    `<div class="preview-list">${rows}</div><div class="quick-actions">` +
    '<button class="btn small-btn" data-action="confirm-csv">Add templates to library</button>' +
    '<button class="btn secondary small-btn" data-action="cancel-csv">Cancel import</button></div></div>';
}

function v103Preview(pending, isPTReview) {
  if (!pending) return '';
  const rows = pending.workouts.map(w => {
    const planned = w.exercises.reduce((n, e) => n + e.sets, 0);
    return `<p><strong>${DAY_NAMES[w.day]} · ${esc(w.name)}</strong> — ${w.exercises.length} exercises, ${planned} sets` +
      `${isPTReview(w) ? ' · [PT Review]' : ''}</p>`;
  }).join('');
  return `<div class="notice" role="status"><strong>V10.3 import ready to confirm:</strong> ${pending.workouts.length} templates. ` +
    'Only new, non-identical templates will be appended; existing assignments and logs are unchanged. ' +
    `<div class="preview-list">${rows}</div><div class="quick-actions">` +
    '<button class="btn" type="button" data-action="v103-apply">Confirm and add V10.3 templates</button>' +
    '<button class="btn secondary" type="button" data-action="v103-cancel">Cancel import</button></div></div>';
}

function exerciseEditor(state, customizing) {
  const editable = customizing && state.templates.find(t => t.id === customizing.id);
  const exercise = editable?.exercises?.[customizing?.index];
  if (!editable || !exercise) return '';
  return `<section class="card stack v157-editor" aria-label="Customize exercise">
    <h3>Create a new version of ${esc(editable.name)}</h3>
    <p class="hint">Editing ${esc(exercise.name)}. The original workout, existing logs and weekly schedule stay unchanged. ` +
    `After saving, assign your new custom workout manually.</p>
    <form id="template-version-form">
      <div class="metrics-grid">
        <label><span class="form-label">Exercise</span>` +
    `<input class="field" name="name" maxlength="80" required value="${esc(exercise.name)}"></label>
        <label><span class="form-label">Primary muscle</span>` +
    `<input class="field" name="muscle" maxlength="40" required value="${esc(exercise.muscle)}"></label>
        <label><span class="form-label">Sets</span>` +
    `<input class="field" name="sets" type="number" min="1" max="10" required value="${exercise.sets}"></label>
        <label><span class="form-label">Minimum reps</span>` +
    `<input class="field" name="min" type="number" min="1" max="100" required value="${exercise.min}"></label>
        <label><span class="form-label">Maximum reps</span>` +
    `<input class="field" name="max" type="number" min="1" max="100" required value="${exercise.max}"></label>
        <label><span class="form-label">Rest (seconds)</span>` +
    `<input class="field" name="rest" type="number" min="0" max="600" required value="${exercise.rest}"></label>
      </div>
      <label><span class="form-label">Exercise instructions (for substitutions, write new instructions)</span>` +
    `<textarea class="field" name="sourceNote" maxlength="500" rows="3">${esc(exercise.sourceNote ?? '')}</textarea></label>
      <p class="hint">PT Review status is preserved. Customized V10.2 routines do not reuse original muscle-overlap estimates. ` +
    `Per-set target exercises retain their target structure.</p>
      <div class="form-actions"><button type="submit" class="btn">Save as new workout version</button>` +
    `<button type="button" class="btn secondary" data-action="cancel-customize">Cancel</button></div>
    </form>
  </section>`;
}

function workoutLibrary(state, { rangeSummary, isPTReview }) {
  if (!state.templates.length) {
    return '<section class="card empty"><strong>No workout templates yet</strong>' +
      'Use the V10.1 import above, or import your own CSV below.</section>';
  }
  return state.templates.map(t => {
    const planned = t.exercises.reduce((n, e) => n + e.sets, 0);
    const scheduled = DAYS.filter((_, i) => state.assignments[i] === t.id).join(', ') || 'Not scheduled';
    const ptSuffix = isPTReview(t) ? ' · PT review required' : '';
    const hint = isPTReview(t)
      ? 'Clinical review is required for this lower-body template. Saving an assignment is not clearance.'
      : 'Select this workout in the schedule above; saved sets are recorded separately.';
    const exercises = t.exercises.map((e, i) =>
      `<li><span>${esc(e.name)}</span><span>${e.sets} × ${esc(rangeSummary(e))} ` +
      '<button type="button" class="btn secondary small-btn v157-edit-button" ' +
      `data-template-edit="${esc(t.id)}" data-exercise-edit="${i}">Customize</button></span></li>`).join('');
    return '<details class="codex-library-entry"><summary><span class="codex-entry-symbol" aria-hidden="true">✦</span>' +
      `<span class="codex-entry-title"><strong>${esc(t.name)}</strong><small>${t.exercises.length} exercises · ${planned} planned sets` +
      `</small><small>${scheduled}${ptSuffix}</small></span><span class="codex-entry-arrow" aria-hidden="true">⌄</span></summary>` +
      `<div class="codex-entry-body"><strong>Exercise loadout</strong><ul>${exercises}</ul><p class="hint">${hint}</p></div></details>`;
  }).join('');
}

export function planView(state, { pendingWorkouts, pendingReturnStage, pendingV103, customizing }, helpers) {
  const { shellHeading, heading, isPTReview } = helpers;
  const intro = heading('PLAN', 'Plan your training',
    'Choose workouts, assign training days, and browse your saved templates. Saved sets remain unchanged.');
  const assignedDays = Object.keys(state.assignments).filter(k => state.assignments[k]).length;
  return `${shellHeading()}${intro}
  <div class="codex-waypoints" aria-label="Planning steps"><div><b>01</b><span>Add a workout to the library</span></div>` +
    `<div><b>02</b><span>Assign it to training days</span></div><div><b>03</b><span>Log real sets in Train</span></div></div>
  <section class="card codex-board"><div class="card-head"><div><div class="eyebrow">WEEKLY SCHEDULE</div>` +
    `<h2>Choose your training days</h2><p>${assignedDays} days assigned · All changes take effect only when you save</p></div></div>` +
    `<form id="schedule-form">${scheduleRows(state)}<div class="form-actions">` +
    `<button class="btn" type="submit">Save weekly schedule</button></div></form></section>
  ${returnStagePanel(state, pendingReturnStage)}
  <div class="section-label"><h2>Current target workout · V10.3</h2><span>Opt-in import</span></div>
  <section class="card stack codex-program" id="v103-import">
    <div class="eyebrow">V10.3 · CANONICAL FOUR-DAY PROGRAM</div><h2>V10.3 Home Upper / Lower</h2>
    <p class="subtle small">4 workouts · 27 exercises · 56 prescribed working sets: ` +
    'Mon Upper A 17, Tue Lower A 10, Thu Upper B 20, Fri Lower B 9. ' +
    `The 37 upper sets are the eventual target, not your automatic return-to-training dose.</p>
    <div class="notice warn"><strong>[PT Review] Tuesday and Friday.</strong> Lower-body workouts are future targets, ` +
    'not clinical clearance. No days are automatically assigned. ' +
    `Use Coverage-First afterwards for one set per eligible upper-body exercise.</div>
    <p class="hint">Includes exact reps, rest periods, original exercise instructions and equipment units: ` +
    `kg per dumbbell, or kg shown on the cable station for pulldowns. No existing templates, schedule or logged sets are replaced.</p>
    <div class="quick-actions"><button class="btn" type="button" data-action="v103-preview">Preview V10.3 import</button>` +
    `<button class="btn secondary" type="button" data-action="v103-csv">Download canonical V10.3 CSV</button></div>
    ${v103Preview(pendingV103, isPTReview)}
  </section>
  <div class="section-label"><h2>Previous workout version · V10.2</h2><span>Still available</span></div>
  <section class="card stack codex-program"><div class="eyebrow">V10.2 · OVERLAP-AWARE</div><h2>Adaptive Recovery UL — V10.2</h2>
  <p class="subtle small">4 workouts · 24 exercises · 62 planned physical working sets (Mon 17 / Tue 13 / Thu 21 / Fri 11). ` +
    'Lat and upper-back emphasis with optional direct + estimated indirect muscle-set reporting. ' +
    `Importing does not change logs or assignments.</p>
  <div class="notice warn"><strong>PT Review applies to Tuesday and Friday.</strong> ` +
    `Lower-body workouts are not cleared or assigned automatically. Missing journal entries never imply clearance.</div>
  <p class="hint">Overlap estimates use approximate 0 / 0.5 / 1 coefficients, ` +
    `not measured growth or additional physical sets. V10.1 remains available below.</p>
  <div class="quick-actions"><button class="btn" type="button" data-action="v102-add">Add V10.2 Home templates</button>` +
    `<button class="btn secondary" type="button" data-action="v102-csv">Download V10.2 CSV</button></div></section>
  <div class="section-label"><h2>Previous workout version · V10.1</h2><span>Still available</span></div>
  <section class="card stack codex-program"><div class="eyebrow">RECOMMENDED PROGRAM</div><h2>Adaptive Recovery UL · V10.1</h2>
  <p class="subtle small">4 optional templates · 24 exercises · 62 prescribed working sets: Mon 17, Tue 13, Thu 21, Fri 11. ` +
    `Importing does not mark any sets completed or change the schedule. Tuesday and Friday are <strong>[PT Review]</strong> ` +
    `and are not medically cleared.</p>
  <div class="notice warn"><strong>Lower-body clinical review required.</strong> Ongoing or delayed radiating leg symptoms mean ` +
    `these lower-body templates must not be automatically activated. A missing symptom entry never implies medical clearance.</div>
  <p class="hint"><strong>Equipment:</strong> ${esc(V101_EQUIPMENT)}</p>
  <div class="quick-actions"><button type="button" class="btn" data-action="v101-add">Add V10.1 Home templates</button>` +
    `<button type="button" class="btn secondary" data-action="v101-csv">Download canonical V10.1 CSV</button></div>
  <p class="hint">After import, you may manually assign suitable sessions in your weekly schedule. ` +
    `Do not assign the lower-body templates without appropriate clinician review.</p></section>
  <div class="section-label"><h2>Workout library</h2><span>${state.templates.length} saved templates</span></div>` +
    '<p class="hint codex-library-help">These are reusable workout templates—not completed workouts. ' +
    'Tap a loadout to inspect its exercises. Assign it to a weekday above, then save completed sets in Train.</p>' +
    '<div class="notice"><strong>Looking for your completed workout CSV?</strong> This page imports workout templates only. ' +
    'To add what you actually did on a past date, open <button class="btn secondary small-btn" type="button" data-page="train">' +
    `Train → Import completed workout CSV</button>.</div>
  <section class="codex-library-grid">${workoutLibrary(state, helpers)}</section>${exerciseEditor(state, customizing)}
  <details class="codex-archive"><summary>Other saved program options <span>Historical & Unified UL</span></summary>` +
    '<div class="codex-archive-body">  <div class="section-label"><h2>Historical training plans</h2></div>' +
    '<section class="card stack"><strong>Recovery-Optimized Upper/Lower · 30 Sep 2026</strong>' +
    '<p class="subtle small">Mon Upper A · Tue Lower A · Thu Upper B · Fri Lower B. ' +
    'Includes top/back-off sets and labelled superset pairs. ' +
    'For Face Pull/Lateral Raise, the third set is optional. Reps listed per arm/leg are per side. ' +
    'Rest is 90 seconds by default unless noted.</p><div class="quick-actions">' +
    '<button class="btn" type="button" data-action="latest-ul">Add my Recovery UL templates</button>' +
    '<button class="btn secondary" type="button" data-action="latest-ul-csv">Download this plan (.csv)</button></div>' +
    '<p class="hint">Adds templates only. Your current weekly schedule and completed workout sets are unchanged. ' +
    `After import, assign the new workouts to weekdays above and save the schedule.</p></section>
  <div class="section-label"><h2>Unified Recovery UL (per-set targets)</h2></div>
  <section class="card stack"><p class="subtle small">Now one Bench Press, one Goblet Squat, and one Incline Press. ` +
    'Each has different rep targets for top and back-off sets. Your older split templates and saved logs stay available.</p>' +
    '<div class="quick-actions"><button class="btn" type="button" data-action="unified-ul">Add Unified Upper/Lower plan</button>' +
    '<button class="btn secondary" type="button" data-action="unified-ul-csv">Download Unified plan (.csv)</button></div>' +
    '<p class="hint">Adding these templates does not change your current workout days. ' +
    `Choose the new Unified workouts in the schedule above, then save.</p></section>
</div></details>
  <div class="section-label"><h2>Import a custom workout</h2><span>CSV file</span></div><section class="card stack">` +
    '<p class="subtle small">In Excel, choose <strong>Save As → CSV UTF-8</strong>. Then select that file here. ' +
    'The original .xlsx file is not imported directly.</p>' +
    '<div class="upload-card"><div class="file-ico">↓</div><div style="flex:1;min-width:140px"><strong>Excel-exported CSV</strong>' +
    '<p class="subtle small">Up to 500 exercises · Max 1 MB</p></div>' +
    `<button class="btn secondary small-btn" data-action="pick-csv">Choose CSV</button></div>${csvPreview(pendingWorkouts)}` +
    '<div class="quick-actions"><button class="btn ghost small-btn" data-action="example-csv">' +
    'Download example CSV →</button></div><p class="hint">Required columns: day, workout, exercise, muscle, sets, rep_min, rep_max. ' +
    'Optional: rest_seconds. Identical imports are skipped; imported templates do not replace completed workouts.</p></section>';
}
