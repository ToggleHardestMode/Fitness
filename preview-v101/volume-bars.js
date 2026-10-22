// FitnessPilot preview: show only actual logged kg x reps as columns.
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function volumeBarsMarkup(days, format = n => Number(n).toLocaleString('en-SG')) {
  if (!Array.isArray(days) || days.length !== DAY_LABELS.length) {
    throw Error('The training-volume chart requires seven daily records.');
  }
  const volumes = days.map(day =>
    Number.isFinite(day?.loadVolume) && day.loadVolume > 0 ? day.loadVolume : 0);
  const max = Math.max(1, ...volumes);
  return volumes.map((volume, i) => {
    const visual = volume > 0
      ? `<span class="bar" style="height:${Math.max(4, Math.round(volume / max * 111))}px"></span>`
      : '<span class="bar-zero" aria-hidden="true"></span>';
    return `<div class="day-slot" title="${DAY_LABELS[i]}: ${format(volume)} kg·reps">${visual}<span class="bar-label">${DAY_LABELS[i]}</span></div>`;
  }).join('');
}

/** Daily completed working sets, matching weeklyTrainingAnalysis counts. */
export function setsBarsMarkup(days) {
  if (!Array.isArray(days) || days.length !== DAY_LABELS.length) {
    throw Error('The completed-sets chart requires seven daily records.');
  }
  const counts = days.map(day => Number.isSafeInteger(day?.completed) && day.completed > 0 ? day.completed : 0);
  const max = Math.max(1, ...counts);
  return counts.map((count, i) => {
    const visual = count > 0
      ? `<span class="bar" style="height:${Math.max(4, Math.round(count / max * 111))}px"></span>`
      : '<span class="bar-zero" aria-hidden="true"></span>';
    return `<div class="day-slot" title="${DAY_LABELS[i]}: ${count} completed set(s)">${visual}<span class="bar-label">${DAY_LABELS[i]}</span></div>`;
  }).join('');
}
