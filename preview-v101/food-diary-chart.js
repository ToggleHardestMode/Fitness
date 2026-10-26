import { FOOD_KEY, validateDiary } from './food-diary-core.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => value.toLocaleString('en-SG', { maximumFractionDigits: 1 });
function shiftDay(key, offset) {
  const d = new Date(`${key}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== key) {
    throw Error('Invalid chart date.');
  }
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Observed food entries only. This never reads or changes the manual daily check-in.
export function diaryCalorieHistory(rawDiary, endDate, days = 28) {
  if (!Number.isInteger(days) || days < 7 || days > 90) throw Error('Invalid chart window.');
  const diary = validateDiary(rawDiary);
  const dates = Array.from({ length: days }, (_, i) => shiftDay(endDate, i - days + 1));
  const byDate = new Map(dates.map(date => [date, { date, foods: 0, known: 0, unknown: 0, kcal: 0 }]));
  for (const food of diary.entries) {
    const day = byDate.get(food.date);
    if (!day) continue;
    day.foods += 1;
    if (food.kcal === null) day.unknown += 1;
    else { day.known += 1; day.kcal += food.kcal * food.servings; }
  }
  const entries = dates.map(date => byDate.get(date));
  const recordedDays = entries.filter(d => d.foods > 0).length;
  const numericDays = entries.filter(d => d.known > 0).length;
  return { entries, recordedDays, numericDays, incompleteDays: entries.filter(d => d.unknown > 0).length };
}

export function foodDiaryChartMarkup(report) {
  if (!report.recordedDays) return `<section class="card fd-chart-panel" aria-label="Food Diary calories"><div class="card-head"><div><h2>Food Diary · Daily calories</h2><p>Last 28 days · separate from manual check-ins</p></div></div><p class="hint">No Food Diary entries in the last 28 days. Manual Daily check-ins are shown separately below.</p><a class="btn secondary" href="./food-diary.html">Open Food Diary →</a></section>`;

  const rows = report.entries;
  const scale = Math.max(500, Math.ceil(Math.max(...rows.map(d => d.known ? d.kcal : 0)) / 500) * 500);
  const left = 54, step = 23, width = 14, baseline = 172, plotHeight = 136;
  const ticks = [0, 0.5, 1].map(f => {
    const y = baseline - f * plotHeight;
    return `<line x1="${left - 6}" y1="${y}" x2="707" y2="${y}" stroke="#b49b79" stroke-opacity=".25"/><text x="${left - 12}" y="${y + 4}" text-anchor="end" fill="#cbbda9" font-size="12">${fmt(scale * f)}</text>`;
  }).join('');
  const bars = rows.map((d, i) => {
    const x = left + i * step;
    const caption = `${d.date}: ${d.foods ? (d.known ? `${fmt(d.kcal)} recorded kcal from ${d.known} food(s)` : 'calories unknown') : 'no diary entries'}${d.unknown ? `, ${d.unknown} food(s) with unknown calories` : ''}. Not confirmed full-day intake.`;
    let mark = '';
    if (d.known) {
      const height = d.kcal === 0 ? 0 : Math.max(2, d.kcal / scale * plotHeight);
      mark = height
        ? `<rect x="${x}" y="${baseline - height}" width="${width}" height="${height}" rx="3" fill="${d.unknown ? '#b59367' : '#e9c789'}"/>`
        : `<circle cx="${x + width / 2}" cy="${baseline}" r="3.5" fill="#e9c789"/>`;
    } else if (d.unknown) mark = `<text x="${x + width / 2}" y="${baseline - 8}" text-anchor="middle" fill="#e9c789" font-size="15">?</text>`;
    const label = i % 7 === 0 || i === rows.length - 1
      ? `<text x="${x}" y="${baseline + 19}" text-anchor="middle" fill="#d1c3ad" font-size="12">${d.date.slice(5)}</text>` : '';
    return `<g><title>${escapeHtml(caption)}</title>${mark}${label}</g>`;
  }).join('');
  const recent = [...rows].reverse().find(d => d.known > 0);
  const latest = recent ? `${fmt(recent.kcal)} kcal · ${recent.date}` : 'No calorie values';
  const table = rows.map(d => `<tr><th scope="row">${d.date}</th><td>${d.known ? `${fmt(d.kcal)} kcal` : d.foods ? 'Unknown' : 'Not logged'}</td><td>${d.unknown ? `${d.unknown} unknown-calorie food(s)` : d.foods ? `${d.foods} food(s) recorded` : 'No entry'}</td></tr>`).join('');
  return `<section class="card fd-chart-panel" aria-label="Food Diary daily calories"><div class="card-head"><div><h2>Food Diary · Daily calories</h2><p>Last 28 days · sums from logged meals only</p></div><a class="btn secondary" href="./food-diary.html">Open diary →</a></div>
  <div class="fd-chart-summary"><span><strong>${report.recordedDays}/28</strong> days with food entries</span><span><strong>${report.numericDays}/28</strong> days with calories</span><span><strong>${escapeHtml(latest)}</strong> latest recorded</span></div>
  <div class="fd-chart-scroll" tabindex="0" role="region" aria-label="Scrollable 28-day Food Diary calorie bar chart"><svg class="fd-chart-svg" viewBox="0 0 720 205" role="img" aria-label="28-day chart of calories derived from Food Diary entries. Gaps are unlogged days, question marks are days with unknown calories; faded bars have incomplete calorie values.">${ticks}${bars}</svg></div>
  <p class="hint fd-chart-note">Gold = recorded food calories · dimmed = some foods have unknown calories · gap = no entry (not zero). A recorded total may still omit meals. This chart <strong>does not include</strong> the separate manual Daily check-ins.</p>
  <details class="volume-explanation"><summary>View all 28 daily calorie values</summary><div class="fd-chart-table-scroll"><table><thead><tr><th>Date</th><th>Recorded kcal</th><th>Coverage</th></tr></thead><tbody>${table}</tbody></table></div></details></section>`;
}

export function readFoodDiaryChart(storage, endDate) {
  try {
    const value = storage.getItem(FOOD_KEY);
    return foodDiaryChartMarkup(diaryCalorieHistory(value ? JSON.parse(value) : { version: 1, entries: [] }, endDate));
  } catch (error) {
    return `<section class="card fd-chart-panel" role="alert"><h2>Food Diary · Daily calories</h2><p>Food Diary data could not be read (${escapeHtml(error.message)}). No records were changed. Export or recover your original data before making changes.</p></section>`;
  }
}
