// Read-only nutrition summary helpers. Never write to storage.
const number = n => Number(n).toLocaleString('en-SG', {maximumFractionDigits: 1});
export function targetsText(actual, target, unit) {
  if (actual === null) return target === null ? 'Not recorded' : `Not recorded · reference ${number(target)} ${unit}`;
  if (target === null) return `${number(actual)} ${unit}`;
  const delta = actual - target;
  return `${number(actual)} ${unit} · reference ${number(target)} ${unit} · ${delta > 0 ? '+' : ''}${number(delta)} ${unit}`;
}
export function referenceCardMarkup(targets, mode) {
  if (!targets) return '<section class="nj-panel" aria-label="Nutrition target summary"><h2>Reference targets</h2><p class="hint">No targets loaded. Tap “Load public example” or select a JSON file. This does not create food logs.</p></section>';
  if (mode !== 'flat' && mode !== 'cycle') throw Error('Unknown nutrition display mode.');
  const options = mode === 'flat' ? [['Daily reference', targets.flat]] : [['Monday–Friday', targets.weekday], ['Saturday–Sunday', targets.weekend]];
  for (const [, t] of options) if (!t || !Number.isFinite(t.calories) || !Number.isFinite(t.protein)) throw Error('Invalid nutrition reference values.');
  const cards = options.map(([label, t]) => `<div class="nj-reference-card"><small>${label}</small><strong>${number(t.calories)} kcal</strong><span>${number(t.protein)} g protein</span></div>`).join('');
  return `<section class="nj-panel" aria-label="Nutrition target summary"><h2>Reference targets loaded</h2><p class="hint">Reference calories and protein are shown even when no meals are recorded. These are illustrative, not activated or saved.</p><div class="nj-reference-cards">${cards}</div><p class="hint">To record actual intake, use Train → Daily check-in in the preview. Targets remain only in this tab.</p></section>`;
}
