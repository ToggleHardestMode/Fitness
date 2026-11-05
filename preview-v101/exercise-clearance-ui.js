import { currentClearance, requiresPtReview, CLEARED_BY_MAX, CLEARANCE_NOTE_MAX } from './exercise-clearance.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Markup only. Recording and revoking happen in app.js after an explicit confirmation dialog.
export function clearancePanel(state, {templateId, exerciseIndex, date, today}) {
  const template = state.templates.find(t => t.id === templateId);
  const exercise = template?.exercises?.[exerciseIndex];
  if (!exercise) return '';
  const records = (state.exerciseClearances || []).filter(item => item.templateId === templateId && item.exerciseIndex === exerciseIndex);
  if (!requiresPtReview(template, exercise) && !records.length) return '';
  const active = currentClearance(state, templateId, exerciseIndex);
  const history = records.filter(item => item.revokedDate !== undefined).map(item =>
    '<li>Cleared by ' + esc(item.clearedBy) + ' on ' + esc(item.clearedDate) + ' · revoked ' + esc(item.revokedDate) + '</li>').join('');
  const current = active ?
    '<p class="notice"><strong>Cleared by ' + esc(active.clearedBy) + ' on ' + esc(active.clearedDate) + '.</strong> ' +
    (active.note ? esc(active.note) + ' ' : '') + 'Recorded by you; FitnessPilot does not verify it. ' +
    (date && active.clearedDate > date ? 'It does not apply to a workout dated before the clearance. ' : '') +
    'All symptom, recovery and effort checks still apply.</p>' +
    '<button class="btn secondary small-btn" type="button" data-action="clearance-revoke" data-clearance-id="' + esc(active.id) + '">Revoke</button>' :
    '<details><summary>Record clinician clearance</summary>' +
    '<p class="hint">Only record a clearance that a clinician has actually given you for this exercise. FitnessPilot does not verify it.</p>' +
    '<label class="form-label" for="clearance-by">Cleared by (name or role)</label>' +
    '<input class="field" id="clearance-by" maxlength="' + CLEARED_BY_MAX + '" autocomplete="off">' +
    '<label class="form-label" for="clearance-date">Date of clearance</label>' +
    '<input class="field" type="date" id="clearance-date" value="' + esc(today || '') + '">' +
    '<label class="form-label" for="clearance-note">Note (optional)</label>' +
    '<input class="field" id="clearance-note" maxlength="' + CLEARANCE_NOTE_MAX + '" autocomplete="off">' +
    '<div class="form-actions"><button class="btn secondary" type="button" data-action="clearance-record">Record clinician clearance</button></div></details>';
  return '<section class="clr-panel" aria-label="Clinician clearance for this exercise">' + current +
    (history ? '<ul class="hint">' + history + '</ul>' : '') + '</section>';
}
