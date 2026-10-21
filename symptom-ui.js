import { SYMPTOM_TIMEPOINTS, SYMPTOM_SIDES, SYMPTOM_LOCATIONS, FUNCTION_CHANGES, symptomGuidance } from './symptom-journal.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options = (choices, title) => `<option value="">Choose ${title}</option>${Object.entries(choices).map(([value,label])=>`<option value="${value}">${esc(label)}</option>`).join('')}`;

export function symptomPanel(date, state, selectedTemplate) {
  const template = state.templates.find(t => t.id === selectedTemplate);
  const entries = (state.symptomLogs ?? []).filter(s => s.date === date);
  const sessionOptions = `<option value="">General / no workout selected</option>` +
    state.templates.map(t=>`<option value="${esc(t.id)}" ${t.id===selectedTemplate?'selected':''}>${esc(t.name)}</option>`).join('');
  const prior = entries.length ? entries.map(e => {
    const t = state.templates.find(t => t.id === e.templateId);
    const exercise = e.exerciseIndex === null ? '' : ` · ${t?.exercises[e.exerciseIndex]?.name ?? 'Unknown exercise'}`;
    const baseline = entries.find(x=>x.timepoint==='before' && x.templateId===e.templateId && x.exerciseIndex===e.exerciseIndex);
    return `<div class="data-row"><div><strong>${esc(SYMPTOM_TIMEPOINTS[e.timepoint])}</strong><small>${esc(t?.name ?? 'General')}${esc(exercise)} · ${esc(SYMPTOM_SIDES[e.side])} · ${esc(SYMPTOM_LOCATIONS[e.location])}</small></div><div><strong>${e.severity}/10</strong><small>${esc(FUNCTION_CHANGES[e.functionChange])}${e.tingling?' · tingling':''}${e.numbness?' · numbness':''}</small></div></div>${e.notes?`<p class="hint">${esc(e.notes)}</p>`:''}<p class="hint">${esc(symptomGuidance(e,baseline))}</p>`;
  }).join('') : '<p class="hint">No symptom observations saved for this workout date. Status unknown—not symptom-free or medically cleared.</p>';
  return `<div class="section-label"><h2>Symptom response journal</h2><span>Optional · Private on this device</span></div>
    <section class="card"><div class="notice warn"><strong>[PT Review] remains required for lower-body templates.</strong> This journal records observations; it never approves a movement or increases loads. New saddle numbness, bladder/bowel problems, or rapidly worsening weakness require urgent medical evaluation.</div>
    <p class="hint">Entries are attached to the selected <strong>workout date</strong>, including next-day/48-hour follow-up. Select each observation time explicitly. If an entry already exists for that scope and time, no data is overwritten.</p>
    <form id="symptom-form" class="stack">
      <div class="metrics-grid">
        <label><span class="form-label">When did you check?</span><select required class="field" name="timepoint">${options(SYMPTOM_TIMEPOINTS,'time')}</select></label>
        <label><span class="form-label">Workout (optional)</span><select class="field" name="templateId" id="symptom-template">${sessionOptions}</select></label>
        <label><span class="form-label">Exercise (optional)</span><select class="field" name="exerciseIndex" id="symptom-exercise"><option value="">Whole workout / not exercise-specific</option>${template?template.exercises.map((e,i)=>`<option value="${i}">${i+1}. ${esc(e.name)}</option>`).join(''):''}</select></label>
        <label><span class="form-label">Leg side</span><select required class="field" name="side">${options(SYMPTOM_SIDES,'side')}</select></label>
        <label><span class="form-label">Farthest location noticed</span><select required class="field" name="location">${options(SYMPTOM_LOCATIONS,'location')}</select></label>
        <label><span class="form-label">Severity (0–10)</span><input required class="field" name="severity" type="number" min="0" max="10" step="1" inputmode="numeric" placeholder="Enter 0 only if observed"></label>
        <label><span class="form-label">Walking or strength change</span><select required class="field" name="functionChange">${options(FUNCTION_CHANGES,'change')}</select></label>
      </div>
      <div class="quick-actions"><label><input type="checkbox" name="tingling"> Tingling</label><label><input type="checkbox" name="numbness"> Numbness</label></div>
      <label><span class="form-label">Optional notes</span><textarea class="field" name="notes" maxlength="500" rows="2" placeholder="What changed? Where did it spread?"></textarea></label>
      <div class="form-actions"><button class="btn" type="submit">Save symptom observation</button></div>
    </form><div class="section-label"><h2>Saved observations</h2><span>${entries.length} for this date</span></div>${prior}</section>`;
}