import { expectedSetCount } from './active-sets.js';

// Short label for the exercise list; empty unless the active count is below the plan.
export function activeSetsLabel(state, templateId, exerciseIndex) {
  const exercise = state.templates.find(t => t.id === templateId)?.exercises?.[exerciseIndex];
  if (!exercise) return '';
  const active = expectedSetCount(state, templateId, exerciseIndex);
  return active < exercise.sets ? `Doing ${active} of ${exercise.sets} planned sets` : '';
}

// Markup only. The change happens in app.js after an explicit confirmation dialog.
export function activeSetsPanel(state, {templateId, exerciseIndex}) {
  const exercise = state.templates.find(t => t.id === templateId)?.exercises?.[exerciseIndex];
  if (!exercise || exercise.sets < 2) return '';
  const active = expectedSetCount(state, templateId, exerciseIndex);
  const label = activeSetsLabel(state, templateId, exerciseIndex);
  const options = Array.from({length:exercise.sets}, (_, i) => i + 1).map(n =>
    '<option value="' + n + '"' + (n === active ? ' selected' : '') + '>' + n + ' of ' + exercise.sets + '</option>').join('');
  return '<section class="as-panel" aria-label="Active sets">' +
    (label ? '<p class="notice"><strong>' + label + '.</strong> Next-session targets compare against this count.</p>' : '') +
    '<details><summary>Change active sets</summary><label class="form-label" for="active-sets-count">Sets I am doing now</label>' +
    '<div class="strength-step-row"><select class="field" id="active-sets-count">' + options +
    '</select><button class="btn secondary" type="button" data-action="active-sets-change">Save active sets</button></div>' +
    '<p class="hint">Use this to build up volume gradually. You change it yourself; the app never raises or lowers it. ' +
    'Saved sets are not changed, and sets above this count are ignored for progression suggestions.</p></details></section>';
}
