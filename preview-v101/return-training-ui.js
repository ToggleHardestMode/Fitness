import {DAYS, DAY_NAMES} from './core.js';
import {generateReturnStage, RETURN_STAGES} from './return-training.js';
import {generateOneSetCoverage, isReviewOnlyWorkout} from './return-coverage.js';

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
    const coverage = pending.percent === 'coverage';
    const comparison = coverage ? sources.filter(w => !isReviewOnlyWorkout(w)) : sources;
    const stages = RETURN_STAGES.map(percent => generateReturnStage(comparison, percent));
    const active = coverage ? generateOneSetCoverage(sources) : stages.find(stage => stage.percentage === pending.percent);
    const choiceLabel = coverage ? '1 set per upper exercise' : active.percentage + '%';
    const rows = active.muscles.map(group => `<tr><th scope="row">${esc(group.muscle)}</th>${stages.map(s => {
      const amount = s.muscles.find(m => m.muscle === group.muscle).planned;
      return `<td>${amount}</td>`;
    }).join('')}${coverage ? `<td><strong>${group.planned}</strong></td>` : ''}</tr>`).join('');
    const omissions = active.omitted.map(entry => `<li>${DAY_NAMES[entry.day]} · ${esc(entry.exercise)} (${esc(entry.workout)})</li>`).join('');
    const sessions = active.workouts.map(t => `<li>${DAY_NAMES[t.day]} · ${esc(t.name)}: ${t.exercises.map(ex => `${esc(ex.name)} ${ex.sets} set(s)`).join('; ')}${t.requiresClinicalReview ? ' · [PT Review]' : ''}</li>`).join('');
    return `<div class="return-stage-preview" aria-label="Return-to-training preview">
      <h3>${coverage ? 'Coverage-first vs percentage stages' : 'Stage comparison'} · ${active.full} full-plan working sets</h3>
      <p class="hint">Values are planned direct working sets per week. Whole-set rounding makes some percentages approximate. Warm-ups are not counted, and no workout is logged by this preview.${coverage ? ' Only upper-body workouts without PT Review count here.' : ''}</p>
      <div class="return-stage-scroll"><table class="return-stage-table"><thead><tr><th scope="col">Muscle</th>${RETURN_STAGES.map(p => `<th scope="col">${p}%</th>`).join('')}${coverage ? '<th scope="col">1 each</th>' : ''}</tr></thead>
        <tbody>${rows}<tr class="return-stage-total"><th scope="row">All direct sets</th>${stages.map(s => `<td>${s.planned}</td>`).join('')}${coverage ? `<td><strong>${active.planned}</strong></td>` : ''}</tr></tbody></table></div>
      <p class="hint"><strong>Selected ${choiceLabel}:</strong> ${active.planned} of ${active.full} weekly sets (${active.full ? Math.round(active.planned / active.full * 100) : 0}% achieved), ${active.workouts.length} nonempty workout day(s).</p>
      ${coverage ? `<p class="hint"><strong>PT-review exclusion:</strong> ${active.excluded.length} workout(s), ${active.excluded.reduce((n,w)=>n+w.planned,0)} lower/PT-review sets NOT counted as available training volume.</p>` : ''}
      <p class="hint">This is an optional reconditioning dose, not a required week-2 target. Hold or reduce volume if recovery is poor. Choose comfortable present-day weights with several repetitions in reserve; never assume a calendar week means you are ready to advance.</p>
      <details><summary>Included exercises (${active.workouts.length} workout days)</summary><ul class="return-stage-list">${sessions}</ul></details>
      <details><summary>Omitted exercises (${active.omitted.length})</summary><ul class="return-stage-list">${omissions || '<li>None</li>'}</ul></details>
      <div class="notice warn"><strong>Volume is not clearance.</strong> Lower-body [PT Review] restrictions, clinician guidance and recovery checks remain necessary. Do not increase loads or stages automatically.</div>
      <div class="form-actions"><button class="btn" type="button" data-action="return-stage-save">Add selected ${choiceLabel} templates to library</button><button class="btn secondary" type="button" data-action="return-stage-cancel">Cancel preview</button></div>
      <p class="hint">Adding templates never changes the weekly schedule or completed sets. Assign them manually above when appropriate; use Preview again to hold, repeat or step back to a different stage.</p>
    </div>`;
  })();
  return `<section class="card stack return-stage-panel" id="return-stage-panel" aria-label="Return to training">
    <div class="eyebrow">RETURN TO TRAINING</div><h2>Build up from your full plan</h2>
    <p class="hint">After a long break, preview the original 25%, 50%, 75% or 100% <strong>working-set</strong> stages, or choose <strong>one set per upper-body exercise</strong> to keep every movement. Example: 7 Monday plus 9 Thursday exercises from a 37-set upper plan gives 16/37 sets (43%), not 25%. Neither mode scales past dumbbell weights or automatically advances your plan. Source workouts and saved logs remain unchanged.</p>
    <form id="return-stage-form"><div class="return-stage-selectors">${selectors}</div>
      <label class="return-stage-choice"><span class="form-label">Stage to review and optionally save</span><select class="field" name="returnPercent">${RETURN_STAGES.map(p => `<option value="${p}" ${pending?.percent === p ? 'selected' : ''}>${p}% of direct working sets</option>`).join('')}<option value="coverage" ${pending?.percent === 'coverage' ? 'selected' : ''}>1 set per upper exercise · coverage-first</option></select></label>
      <div class="form-actions"><button class="btn secondary" type="submit">Preview training volumes</button></div>
    </form>${preview}
  </section>`;
}
