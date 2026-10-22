import { weeklyV102Overlap, V102_REGIONS } from './v102-overlap.js';

const value = number => Number(number.toFixed(1)).toLocaleString('en-SG', {maximumFractionDigits:1});

export function v102OverlapPanel(state, monday) {
  const report = weeklyV102Overlap(state, monday);
  const exists = (state.templates || []).some(t => t.sourceVersion === 'V10.2 Home Overlap');
  if (!exists) return '';
  const rows = V102_REGIONS.map(region => {
    const p = report.planned[region], l = report.logged[region];
    return `<tr><th scope="row">${region}</th><td>${value(p.direct)}</td><td>${value(p.indirect)}</td><td>${value(p.equivalents)}</td><td>${value(l.direct)}</td><td>${value(l.indirect)}</td><td>${value(l.equivalents)}</td></tr>`;
  }).join('');
  return `<section class="card v102-overlap">
    <div class="section-label"><h2>V10.2 muscle overlap</h2><span>Estimated equivalents</span></div>
    <p class="hint">${report.physicalPlanned} physical sets planned · ${report.physicalLogged} distinct sets logged for V10.2 workouts this week. Off-plan V10.2 sets count as logged, not planned.</p>
    <div class="v102-overlap-scroll"><table><thead><tr><th rowspan="2" scope="col">Region</th><th colspan="3" scope="colgroup">Planned</th><th colspan="3" scope="colgroup">Logged</th></tr><tr><th>Direct</th><th>Indirect</th><th>Est.</th><th>Direct</th><th>Indirect</th><th>Est.</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">One completed workout set is counted only once. Indirect equivalents are approximate coaching weights (0.5 for selected assisting regions), not additional physical sets, measured growth or clearance for lower-body exercise.${report.unmapped ? ` ${report.unmapped} unmapped set(s) were excluded rather than guessed.` : ''}</p>
  </section>`;
}
