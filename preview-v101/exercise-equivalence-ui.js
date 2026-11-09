import { linkCandidates } from './exercise-equivalence.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const label = (state, ref) => {
  const template = state.templates.find(t => t.id === ref.templateId);
  const exercise = template?.exercises?.[ref.exerciseIndex];
  return exercise ? `${exercise.name} · ${template.name}` : 'Unknown exercise';
};

// Markup only. Linking and unlinking happen in app.js after an explicit confirmation dialog.
export function equivalencePanel(state, {templateId, exerciseIndex}) {
  const here = state.templates.find(t => t.id === templateId)?.exercises?.[exerciseIndex];
  if (!here) return '';
  const links = (state.exerciseEquivalences || []).filter(link =>
    (link.to.templateId === templateId && link.to.exerciseIndex === exerciseIndex) ||
    (link.from.templateId === templateId && link.from.exerciseIndex === exerciseIndex));
  const list = links.length ? '<ul class="eq-links">' + links.map(link =>
    '<li><span>' + esc(label(state, link.from)) + ' → ' + esc(label(state, link.to)) +
    ' <small>linked ' + esc(link.approvedDate) + (link.note ? ' · ' + esc(link.note) : '') + '</small></span>' +
    '<button class="btn secondary small-btn" type="button" data-action="equivalence-unlink" data-link-id="' +
    esc(link.id) + '">Unlink</button></li>').join('') + '</ul>' : '';
  const candidates = linkCandidates(state, templateId, exerciseIndex);
  const options = candidates.map(c => '<option value="' + state.templates.findIndex(t => t.id === c.templateId) + ':' +
    c.exerciseIndex + '">' + esc(c.exerciseName + ' · ' + c.templateName + (c.sameName ? ' (same name)' : '')) + '</option>').join('');
  const form = candidates.length ? '<label class="form-label" for="equivalence-candidate">Link earlier history</label>' +
    '<div class="strength-step-row"><select class="field" id="equivalence-candidate"><option value="">Choose an earlier exercise</option>' +
    options + '</select><button class="btn secondary" type="button" data-action="equivalence-link">Link earlier history</button></div>' :
    '<p class="hint">No other workout has an exercise that can be linked here.</p>';
  return '<section class="eq-panel" aria-label="Linked exercise history"><h3>Earlier history</h3>' + list + form +
    '<p class="hint">A link only shows the earlier exercise on the Strength Journey chart and as a starting-weight reference. ' +
    'Progression suggestions still use only this exercise\'s own sessions. No saved sets are changed, and nothing is linked automatically.</p></section>';
}
