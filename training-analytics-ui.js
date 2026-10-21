import { weeklyTrainingAnalysis, recoveryReview } from './training-analytics.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const STATUS = {
  not_scheduled: 'Not scheduled', not_logged: 'No assigned sets recorded',
  partial: 'Some assigned sets logged', all_sets_logged: 'All assigned sets logged',
  off_plan_logged: 'Only off-plan sets logged'
};

export function trainingAnalyticsPanel(state, monday, today) {
  const report = weeklyTrainingAnalysis(state, monday);
  const categories = Object.entries(report.byMuscle).sort(([a],[b])=>a.localeCompare(b));
  const reviewDay = [...report.days].reverse().find(day => {
    if (day.date > today) return false;
    const assigned = state.templates.find(t => t.id === day.templateId);
    const flagged = t => t && (t.requiresClinicalReview || t.name.includes('[PT Review]'));
    return flagged(assigned) || (state.logs ?? []).some(log =>
      log.date === day.date && flagged(state.templates.find(t => t.id === log.templateId))) ||
      (state.symptomLogs ?? []).some(entry => entry.date === day.date);
  });
  // Include general observations as well as exercise-linked ones on the same workout date.
  const review = reviewDay && recoveryReview(state, reviewDay.date, today);
  const note = review
    ? `<div class="notice warn"><strong>${esc(reviewDay.date)} · ${esc(review.level.replaceAll('_',' '))}</strong><p>${esc(review.message)}</p></div>`
    : '<p class="hint">No symptom entry or [PT Review] session identified this week. Recovery status is unknown, not medically cleared.</p>';
  return `<div class="section-label"><h2>Training accounting</h2><span>Logged does not mean cleared</span></div>
    <section class="card"><div class="card-head"><div><h2>Scheduled vs recorded</h2>
    <p>Based on your current weekday assignments</p></div></div>
    <div class="kpis grid">
      <div><div class="kpi-label">Scheduled sets</div><div class="kpi-value">${report.planned}</div></div>
      <div><div class="kpi-label">Recorded sets</div><div class="kpi-value">${report.completed}</div></div>
      <div><div class="kpi-label">On-schedule sets</div><div class="kpi-value">${report.assignedCompleted}</div></div>
      <div><div class="kpi-label">Off-plan sets</div><div class="kpi-value">${report.offPlan}</div></div>
    </div>
    <p class="hint">Counts are saved working sets, not finished workout sessions. An imported template without assigned days adds zero scheduled sets. Timed holds count as sets, not lifting repetitions.</p>
    <div class="section-label"><h2>Direct muscle-group sets</h2><span>Scheduled / Recorded</span></div>
    ${categories.length ? categories.map(([muscle,counts])=>
      `<div class="data-row"><strong>${esc(muscle)}${muscle==='Arms'?' (combined)':''}</strong><div class="score">${counts.planned} / ${counts.completed}</div></div>`).join('')
      : '<p class="hint">No planned or recorded sets for this week.</p>'}
    <p class="hint">Direct category labels only; arms are not split into biceps/triceps. No indirect set credits, no doubling for unilateral work. Old logs without a warm-up marker are treated as working sets.</p>
    <div class="section-label"><h2>Daily set status</h2></div>
    ${report.days.map(d=>`<div class="data-row"><strong>${DAY_NAMES[d.day]}</strong><div class="score">${d.assignedCompleted}/${d.planned} assigned · ${esc(STATUS[d.status])}${d.offPlan?` · ${d.offPlan} off-plan`:''}</div></div>`).join('')}
    ${report.timedHolds.length?`<p class="hint">Timed holds: ${report.timedHolds.map(h=>`${esc(h.exercise)} ${h.secondsPerSide}s/side (${esc(h.date)})`).join('; ')}. Excluded from kg × repetitions.</p>`:''}
    </section>
    <div class="section-label"><h2>Recovery response</h2><span>Decision support, not medical approval</span></div>
    <section class="card">${note}<p class="hint">Do not increase lower-body loading automatically. A missing next-day journal entry is unknown, never a green signal. The original [PT Review] requirement remains.</p></section>`;
}