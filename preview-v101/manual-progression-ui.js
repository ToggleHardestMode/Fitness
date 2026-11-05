import { manualProgression } from './manual-progression.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function manualProgressionPanel(state, selection) {
  const result = manualProgression(state, selection);
  const history = result.history ?
    `<p class="hint">Last comparable set: ${esc(result.history.kg)} kg × ${esc(result.history.reps)} reps on ${esc(result.history.date)}${result.history.rpe == null ? ' · effort not recorded' : ` · RPE ${esc(result.history.rpe)}`}</p>` : '';
  const reference = result.reference ?
    `<p class="hint">Linked earlier history (reference only): ${esc(result.reference.exerciseName)} · ${esc(result.reference.kg)} kg × ${esc(result.reference.reps)} reps on ${esc(result.reference.date)}. Not a target.</p>` : '';
  const candidate = result.candidate ?
    `<p class="v154-candidate"><strong>Optional next target:</strong> ${esc(result.candidate.kg)} kg × ${esc(result.candidate.reps)} reps</p>` : '';
  return `<section class="v154-progression" aria-label="Manual progression review">
    <strong>Progression review</strong>
    ${history}${reference}${candidate}
    <p class="hint">${esc(result.reason)}</p>
    <p class="hint">Suggested values are never filled in or saved for you. Review actual effort, technique and symptoms before deciding. This is not clinical clearance.</p>
  </section>`;
}
