import { STORAGE_KEY, validateBackup, weekDates, dateKey } from './core.js';

const isoDay = key => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw Error('Invalid ISO date.');
  const date = new Date(`${key}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw Error('Invalid calendar date.');
  return date;
};
const plusDays = (key, days) => {
  const date = isoDay(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const mondayToSunday = key => weekDates(key);
const number = (n, label, min, max) => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw Error(`Invalid ${label} in nutrition reference.`);
  return n;
};

export function readTargets(json) {
  if (!json || json.schema_version !== 1 || json.reference_revision !== '1.1' || json.status !== 'reference_only_not_activated_in_fitnesspilot') {
    throw Error('Choose the unchanged Nutrition v1.1 reference JSON. No settings were applied.');
  }
  const flat = json.daily_flat;
  const days = json.calorie_cycling?.days;
  const protein = number(flat?.protein_g?.value, 'flat protein', 1, 600);
  const result = {
    flat: { calories: number(flat?.calories_kcal?.value, 'flat calories', 500, 10000), protein },
    weekday: { calories: number(days?.weekday?.target_kcal_rounded, 'weekday calories', 500, 10000), protein: number(days?.weekday?.protein_g, 'weekday protein', 1, 600) },
    weekend: { calories: number(days?.weekend?.target_kcal_rounded, 'weekend calories', 500, 10000), protein: number(days?.weekend?.protein_g, 'weekend protein', 1, 600) }
  };
  if (json.adjustment_rules_R0_to_R6?.activate_automatically !== false) throw Error('Reference must keep automatic adjustments disabled.');
  return result;
}

export function weekComparison(metrics, anchor, targets, mode = 'flat') {
  if (!['flat', 'cycle'].includes(mode)) throw Error('Unknown target display mode.');
  const dates = mondayToSunday(anchor);
  const lookup = new Map(metrics.filter(x => dates.includes(x.date)).map(x => [x.date, x]));
  const days = dates.map(date => {
    const weekday = isoDay(date).getUTCDay();
    const plan = !targets ? null : mode === 'flat' ? targets.flat : (weekday === 0 || weekday === 6 ? targets.weekend : targets.weekday);
    const record = lookup.get(date) || {};
    const observed = key => typeof record[key] === 'number' && Number.isFinite(record[key]) ? record[key] : null;
    return { date, calories: observed('calories'), protein: observed('protein'), targetCalories: plan?.calories ?? null, targetProtein: plan?.protein ?? null };
  });
  const mean = key => {
    const values = days.map(x => x[key]).filter(x => x !== null);
    return { value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, count: values.length };
  };
  return { dates, days, calories: mean('calories'), protein: mean('protein'), selectedMode: mode };
}

export function weightJourney(metrics, anchor, days = 28) {
  if (!Number.isInteger(days) || days < 7 || days > 366) throw Error('Invalid weight timeline length.');
  isoDay(anchor);
  const from = plusDays(anchor, -days + 1);
  const weights = new Map(metrics.filter(m => m.date >= from && m.date <= anchor && typeof m.weight === 'number' && Number.isFinite(m.weight)).map(m => [m.date, m.weight]));
  const allDates = Array.from({ length: days }, (_, i) => plusDays(from, i));
  const points = allDates.map((date, i) => {
    const observed = weights.get(date) ?? null;
    const last7 = allDates.slice(Math.max(0, i - 6), i + 1).map(d => weights.get(d)).filter(v => v !== undefined);
    return { date, weight: observed, rolling7: last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : null, count7: last7.length };
  });
  const average = start => {
    const vals = points.slice(start, start + 7).map(p => p.weight).filter(v => v !== null);
    return { value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, count: vals.length };
  };
  const current = average(days - 7), previous = average(days - 14);
  return { points, current, previous, change: current.count >= 2 && previous.count >= 2 ? current.value - previous.value : null };
}

const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n === null ? 'Not recorded' : Number(n).toLocaleString('en-SG', { maximumFractionDigits: 1 });
const targetsText = (actual, target, unit) => actual === null ? 'Not recorded' : `${fmt(actual)} ${unit}${target === null ? '' : ` · ${actual >= target ? '+' : ''}${fmt(actual - target)} vs reference`}`;

function weightChart(report) {
  const measured = report.points.map((p, i) => ({ ...p, i })).filter(p => p.weight !== null);
  if (!measured.length) return '<p class="hint">No weights recorded for the last 28 days.</p>';
  const vals = measured.map(p => p.weight);
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const x = i => 18 + i * 9.85, y = n => 125 - 100 * ((n - min) / (max - min));
  const circles = measured.map(p => `<circle cx="${x(p.i).toFixed(2)}" cy="${y(p.weight).toFixed(2)}" r="3.2"><title>${safe(p.date)}: ${fmt(p.weight)} kg</title></circle>`).join('');
  return `<svg class="nj-plot" viewBox="0 0 320 148" role="img" aria-label="Recorded body weights for the last 28 days; missing dates are not connected"><path d="M18 125H302" stroke="currentColor" opacity=".3"/><g fill="#f0c883">${circles}</g></svg>`;
}

export function renderJourney(metrics, anchor, targets, mode) {
  const compare = weekComparison(metrics, anchor, targets, mode);
  const weight = weightJourney(metrics, anchor);
  const calories = compare.calories.count ? `${fmt(compare.calories.value)} kcal / ${compare.calories.count} recorded day(s)` : 'Not recorded';
  const protein = compare.protein.count ? `${fmt(compare.protein.value)} g / ${compare.protein.count} recorded day(s)` : 'Not recorded';
  const changes = weight.change === null ? 'Insufficient readings to compare two weeks' : `${weight.change > 0 ? '+' : ''}${fmt(weight.change)} kg compared with previous 7 days`;
  return `<div class="nj-grid"><section class="nj-panel"><h2>Nutrition this week</h2>
    <p class="hint">${safe(compare.dates[0])}–${safe(compare.dates[6])} · Recorded days only · ${targets ? `${mode === 'cycle' ? 'Weekday/weekend' : 'Flat daily'} reference` : 'No reference file selected'}</p>
    <div class="nj-stats"><div><small>Calories · recorded average</small><strong>${calories}</strong></div><div><small>Protein · recorded average</small><strong>${protein}</strong></div></div>
    <div class="nj-table-scroll"><table><thead><tr><th>Date</th><th>Calories</th><th>Protein</th></tr></thead><tbody>${compare.days.map(row => `<tr><td>${safe(row.date)}</td><td>${targetsText(row.calories, row.targetCalories, 'kcal')}</td><td>${targetsText(row.protein, row.targetProtein, 'g')}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Differences are descriptive, not advice to eat more or less. Missing logs are unknown, not zero. R0–R6 are never executed.</p>
    <p class="hint">Carbohydrates, fat, fibre, vitamins and minerals are not recorded in the current FitnessPilot daily-check-in schema.</p></section>
    <section class="nj-panel"><h2>Weight Journey · 28 days</h2><p class="hint">Dots show only actual weigh-ins. No interpolated missing measurements or forecast.</p>
      ${weightChart(weight)}<div class="nj-stats"><div><small>Last 7-day recorded average</small><strong>${weight.current.value === null ? 'Not recorded' : `${fmt(weight.current.value)} kg`}</strong></div>
      <div><small>Observed trend</small><strong>${safe(changes)}</strong></div></div>
      <p class="hint">Latest 7 days: ${weight.current.count} recorded · previous 7 days: ${weight.previous.count} recorded. Fewer than two readings in either week makes the comparison unavailable.</p></section></div>`;
}

export function initJourney(documentRef = document, storage = localStorage) {
  const result = documentRef.getElementById('journey-results');
  const status = documentRef.getElementById('journey-status');
  const selection = documentRef.getElementById('nutrition-reference');
  const mode = documentRef.getElementById('nutrition-mode');
  let targets = null;
  let state;
  try {
    const stored = storage.getItem(STORAGE_KEY);
    state = stored ? validateBackup(JSON.parse(stored)) : { metrics: [] };
  } catch (error) {
    result.textContent = 'Existing preview data could not be read. Nothing was changed.';
    status.textContent = error.message;
    selection.disabled = true;
    return;
  }
  const refresh = () => { result.innerHTML = renderJourney(state.metrics, dateKey(new Date()), targets, mode.value); };
  mode.addEventListener('change', refresh);
  selection.addEventListener('change', async () => {
    const file = selection.files?.[0];
    if (!file) return;
    targets = null;
    status.textContent = 'Reference not loaded.';
    try {
      if (file.size > 100_000) throw Error('Nutrition reference must be under 100 KB.');
      targets = readTargets(JSON.parse(await file.text()));
      status.textContent = 'Nutrition v1.1 reference loaded into this page only. Provisional, not activated or saved.';
    } catch (error) { status.textContent = error.message; }
    selection.value = '';
    refresh();
  });
  refresh();
}

if (typeof document !== 'undefined' && document.getElementById('journey-results')) initJourney();