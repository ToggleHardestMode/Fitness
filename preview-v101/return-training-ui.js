import {DAYS, DAY_NAMES} from './core.js';
import {generateOneSetCoverage} from './return-coverage.js';

const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// All options are explicit; an unscheduled lower-body source can still be selected for review.
export function returnStagePanel(state, pending = null) {
  const selected = pending?.ids || DAYS.map((_,day) => state.assignments[day] || '');
  const selectors = DAYS.map((day, index) => {
    const choices = state.templates.filter(t => t.day === index && !t.returnStagePercent);
    return `<label><span class="form-label">${DAY_NAMES[index]}</span><select class="field" name="returnDay${index}">
      <option value="">No source workout</option>
      ${choices.map(t => `<option value="${esc(t.id)}" ${selected[index] === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    </select></label>`;
  }).join('');
  const preview = (() => {
    if (!pending) return '';
    const sources = pending.ids.filter(Boolean).map(id => state.templates.find(t => t.id === id));
    const active = generateOneSetCoverage(sources);
    const rows = active.muscles.map(m => '<tr><th scope="row">' + esc(m.muscle) + '</th><td>' + m.full + '</td><td>' + m.planned + '</td></tr>').join('');
    const sessions = active.workouts.map(t => `<li>${DAY_NAMES[t.day]} · ${esc(t.name)}: ${t.exercises.map(ex => `${esc(ex.name)} ${ex.sets} set(s)`).join('; ')}${t.requiresClinicalReview ? ' · [PT Review]' : ''}</li>`).join('');
    return `<div class="return-stage-preview" aria-label="Coverage-First preview">
      <h3>Coverage-First · ${active.full} eligible full-plan working sets</h3>
      <p class="hint">One working set per eligible upper-body exercise. Warm-ups are not included. Previewing never logs a workout.</p>
      <div class="return-stage-scroll"><table class="return-stage-table">
        <thead><tr><th scope="col">Muscle</th><th scope="col">Original sets</th><th scope="col">Coverage-First sets</th></tr></thead>
        <tbody>${rows}<tr class="return-stage-total"><th scope="row">All direct sets</th><td>${active.full}</td><td>${active.planned}</td></tr></tbody>
      </table></div>
      <p class="hint"><strong>Coverage-First:</strong> ${active.planned} of ${active.full} eligible upper-body sets (${active.percentage}% of original volume), ${active.workouts.length} workout day(s). The percentage is descriptive, not a selectable stage.</p>
      <details><summary>Included exercises (${active.planned} working sets)</summary><ul class="return-stage-list">${sessions}</ul></details>
      <details><summary>Excluded PT-review / lower-body workouts (${active.excluded.length})</summary><ul class="return-stage-list">${active.excluded.map(w => `<li>${DAY_NAMES[w.day]} · ${esc(w.workout)} (${w.planned} sets)</li>`).join('') || '<li>None</li>'}</ul></details>
      <p class="hint"><strong>PT-review exclusion:</strong> ${active.excluded.reduce((n,w)=>n+w.planned,0)} prescribed sets are NOT counted as available upper-body training.</p>
      <div class="notice warn"><strong>Volume is not clearance.</strong> Lower-body [PT Review] restrictions remain. Progress only according to performance, recovery, symptoms and clinician guidance. No automatic load or volume changes.</div>
      <div class="form-actions"><button class="btn" type="button" data-action="return-stage-save">Add Coverage-First templates to library</button><button class="btn secondary" type="button" data-action="return-stage-cancel">Cancel preview</button></div>
      <p class="hint">Adding templates does not change source plans, assigned days or completed logs. Assign new workouts manually. This is not a mandatory week-by-week progression.</p>
    </div>`;
  })();
  return `<section class="card stack return-stage-panel" id="return-stage-panel" aria-label="Return to training">
    <div class="eyebrow">RETURN TO TRAINING</div><h2>Coverage-First · one set per exercise</h2>
    <p class="hint">Return to training with one working set per eligible upper-body exercise. For seven Monday and nine Thursday movements across 37 upper-body sets, this is 16/37 (43%). The achieved percentage varies with your source plan. PT-review / lower-body workouts are excluded; original workouts and completed logs remain unchanged.</p>
    <form id="return-stage-form"><div class="return-stage-selectors">${selectors}</div>
      <div class="form-actions"><button class="btn secondary" type="submit">Preview Coverage-First plan</button></div>
    </form>${preview}
  </section>`;
}
