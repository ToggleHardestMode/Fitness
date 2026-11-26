import { workoutBackupStatus } from './backup-reminder.js';
import { addDays, bestSets, DAYS, weekdayOf, weeklyStats } from './core.js';
import { dashboardWalkerBanner } from './dashboard-walker.js';
import { foodDiaryChartForInput, readFoodDiaryInput } from './food-diary-chart.js';
import { dashboardMetricSnapshot } from './metric-selectors.js';
import { dashboardInsights, insightsMarkup, weeklyInsightsMarkup } from './dashboard-insights.js';
import { esc } from './html.js';
import { METRIC_FIELDS, weeklyMetricSources } from './metric-breakdown.js';
import { strengthDashboard } from './strength-journey-ui.js';
import { lifetimeTrainingSets, setMilestoneProgress } from './training-analytics.js';
import { trainingAnalyticsPanel } from './training-analytics-ui.js';
import { v102OverlapPanel, v103OverlapPanel } from './v102-overlap-ui.js';
import { setsBarsMarkup } from './volume-bars.js';
import { latestLoggedWeek } from './week-window.js';

function initialCard() {
  return '<section class="hero codex-quest">' +
    '<div class="quest-topline"><span>✦ FITNESSPILOT</span><span class="quest-date">GET STARTED</span></div>' +
    '<h1>Set up your first workout plan.</h1>' +
    '<p class="quest-subtitle">Add reusable workout plans, assign training days, and record the sets you actually complete.</p>' +
    '<div class="quest-facts"><span>Private training journal</span><span>Offline-first</span></div>' +
    '<button class="btn" data-page="plan">Open Plan →</button></section>';
}

function gildedSummary(analysis, nextDay, lifetimeSets, dates, { today, nice, fmt }) {
  const milestone = setMilestoneProgress(lifetimeSets);
  const daysLogged = analysis.days.filter(day => day.completed > 0).length;
  // Off-plan sets are included in the logged total, but not in schedule completion.
  const completion = analysis.planned > 0
    ? `${Math.min(100, Math.round(100 * analysis.assignedCompleted / analysis.planned))}%`
    : '—';
  const nextName = nextDay ? esc(nextDay.t.name) : 'Not scheduled';
  const nextDate = nextDay ? (nextDay.date === today() ? 'Today' : nice(nextDay.date)) : 'Choose days in Plan';
  const milestoneLabel = milestone.earned
    ? `Last milestone reached: ${fmt(milestone.earned)} sets`
    : 'First milestone: 25 saved working sets';
  const progressLabel = 'role="progressbar" aria-label="Progress to next lifetime sets milestone"';
  const progressValues = `aria-valuemin="${milestone.earned}" aria-valuemax="${milestone.next}" aria-valuenow="${lifetimeSets}"`;
  return `<section class="v151-gold-summary" aria-label="Training progress">
    <div class="v151-gold-head"><span>YOUR TRAINING PROGRESS</span><span>Saved sets only</span></div>
    <div class="v151-gold-feature"><span>Total completed sets</span><strong>${fmt(lifetimeSets)}</strong>
      <small>All-time saved working sets, including bodyweight, timed holds and off-plan sessions</small></div>
    <div class="v151-milestone" aria-label="Lifetime set milestone progress">
      <div class="v151-milestone-top"><span>Next milestone <strong>${fmt(milestone.next)} sets</strong></span>` +
    `<span>${fmt(milestone.next-lifetimeSets)} remaining</span></div>
      <div class="v151-milestone-track" ${progressLabel} ${progressValues}>` +
    `<div class="v151-milestone-fill" style="width:${milestone.percent}%"></div></div>
      <small>${milestoneLabel}. No deadline or extra sets required.</small>
    </div>
    <div class="v151-gold-stats">
      <div><span>Selected week</span><strong>${analysis.completed} sets</strong></div>` +
    `<div><span>Planned sets</span><strong>${analysis.planned}</strong></div>
      <div><span>Schedule completion</span><strong>${completion}</strong></div>
      <div><span>Days with logs</span><strong>${daysLogged}</strong></div>
    </div>
    <div class="v151-gold-next"><span>Next scheduled workout</span><strong>${nextName}</strong><small>${nextDate}</small></div>
    <p>Displayed period: ${nice(dates[0])} – ${nice(dates[6])}. Scheduled sets use the current weekday assignments; ` +
    `saved off-plan sets still count toward logged totals. One saved set makes one logged day, not a finished workout.</p>
  </section>`;
}

function inWeekCards(s, analysis, fmt) {
  const daysLogged = analysis.days.filter(day => day.completed > 0).length;
  return `<div class="kpis grid">
  <div class="card"><div class="kpi-label">Days with logs</div><div class="kpi-value">${daysLogged}</div>` +
    `<div class="kpi-bottom">Days with saved working sets; not finished workouts</div></div>
  <div class="card"><div class="kpi-label">Logged sets</div><div class="kpi-value">${analysis.completed}</div>` +
    `<div class="kpi-bottom">Recorded working sets</div></div>
  <div class="card"><div class="kpi-label">Body weight</div><div class="kpi-value">${s.weight==null?'—':fmt(s.weight)} ` +
    `<small>${s.weight==null?'':'kg'}</small></div><div class="kpi-bottom">Weekly recorded average</div></div>
</div>`;
}

function dailyAverageRows(s, metrics, { nice, fmt }) {
  const sources = weeklyMetricSources(metrics, s.dates);
  const rows = METRIC_FIELDS.map(([label, key, unit]) => {
    const count = sources[key].length;
    return `<div class="data-row"><strong>${label}</strong><div>` +
      `<div class="score">${s[key] == null ? 'Not recorded' : `${fmt(s[key])} ${unit}`}</div>` +
      `<small class="hint">${count} recorded ${count === 1 ? 'day' : 'days'}</small></div></div>`;
  }).join('');
  const dates = METRIC_FIELDS.map(([label, key, unit]) => {
    const entries = sources[key];
    const details = entries.length
      ? entries.map(({ date, value }) =>
        `<div class="data-row"><span>${esc(nice(date))}</span><span>${fmt(value)} ${unit}</span></div>`).join('')
      : '<p class="hint">No recorded values this week.</p>';
    return `<div class="checkin-sources"><strong>${label}</strong>${details}</div>`;
  }).join('');
  return `${rows}<details class="volume-explanation"><summary>Which dates contribute to these averages?</summary>` +
    '<p class="hint">Only recorded dates in the displayed Monday–Sunday week count. Each measurement has its own number of days. ' +
    'Earlier weeks are excluded. To correct an entry, open Train, choose its workout date, and save the daily check-in again.' +
    `</p>${dates}</details>`;
}

function backupReminderCard(storage, today) {
  const backup = workoutBackupStatus(storage, today());
  const hint = backup.due
    ? '<p class="hint">A checked workout backup is due. Export and verify the downloaded JSON in Tools.</p>'
    : '<p class="hint">The checked-file date is a reminder, not proof of recovery on another device.</p>';
  return `<section class="card" style="margin:12px 0" aria-label="Workout backup status">
    <div class="card-head"><div><h2>Workout backup</h2><p>${esc(backup.label)}</p></div>` +
    `<button class="btn secondary small-btn" data-page="tools">Backup tools →</button></div>
    ${hint}
    <p class="hint">Food Diary uses a separate JSON export. Keep both files somewhere safe.</p>
  </section>`;
}

function workoutCard(nextDay, { today, nice, isPTReview }) {
  const date = nextDay ? (nextDay.date === today() ? 'TODAY' : nice(nextDay.date)) : 'UNASSIGNED';
  const title = nextDay ? esc(nextDay.t.name) : 'Your weekly plan is ready to set up.';
  const subtitle = nextDay
    ? 'Your next scheduled workout. Only saved working sets count as progress.'
    : 'Choose your training days in Plan before heading into the training hall.';
  const facts = nextDay
    ? `<span>${nextDay.t.exercises.length} exercises</span>` +
      `<span>${nextDay.t.exercises.reduce((n,e)=>n+e.sets,0)} planned sets</span>` +
      `<span>${isPTReview(nextDay.t) ? 'PT review required' : 'Scheduled'}</span>`
    : '<span>Choose a plan</span><span>Log actual sets</span>';
  const caution = nextDay && isPTReview(nextDay.t) ? '<span class="quest-caution">PT Review is not medical clearance.</span>' : '';
  return '<section class="hero codex-quest">' +
    `<div class="quest-topline"><span>✦ NEXT WORKOUT</span><span class="quest-date">${date}</span></div>` +
    `<h1>${title}</h1><p class="quest-subtitle">${subtitle}</p><div class="quest-facts">${facts}</div>` +
    `<button class="btn" data-page="${nextDay ? 'train' : 'plan'}">${nextDay ? 'Open Workout →' : 'Open Plan →'}</button>` +
    `${caution}</section>`;
}

export function dashboardView(state, selection, helpers, storage) {
  const { selectedWeekStart, strengthJourneyIndex, strengthViewMetric, strengthHistoryFilter, walkerDataUrl } = selection;
  const { today, fmt, nice, shellHeading } = helpers;
  const baseStats = weeklyStats(state, selectedWeekStart || today());
  const foodInput = readFoodDiaryInput(storage);
  const snapshot = dashboardMetricSnapshot(state, foodInput.diary, baseStats.dates[0], today());
  const s = {...baseStats, weight: snapshot.selected.weight.value,
    ...Object.fromEntries(Object.entries(snapshot.selected.manual).map(([key, entry]) => [key, entry.value]))};
  const analysis = snapshot.trainingReport;
  const insights = dashboardInsights(state, snapshot, today());
  const latestWeek = latestLoggedWeek(state);
  const outsideWeek = Math.max(0, lifetimeTrainingSets(state) - analysis.completed);
  const loggedDays = analysis.days.filter(day => day.completed > 0).length;
  const earlierHint = analysis.completed === 0 && outsideWeek > 0
    ? `<p class="hint fp-week-hint">No sets in this selected week, but ${outsideWeek} saved set(s) exist in other weeks. ` +
      'Tap <strong>Latest logged week</strong> to find them.</p>'
    : analysis.completed === 0
      ? '<p class="hint fp-week-hint">No sets logged for these dates in this preview. Imported templates are plans, ' +
        'not completed sets; the production app uses separate browser storage.</p>'
      : `<p class="hint fp-week-hint">${analysis.completed} saved set(s) on ${loggedDays} date(s) in this week.` +
        (outsideWeek ? ` ${outsideWeek} other saved set(s) are outside this week.` : '') + '</p>';
  const best = bestSets(state)
    .filter(log => state.templates.find(t => t.id === log.templateId)?.exercises[log.exerciseIndex]?.repUnit !== 'seconds_per_side')
    .slice(0, 4);
  const chart = setsBarsMarkup(analysis.days);
  const breakdown = analysis.volumeEntries.length
    ? analysis.volumeEntries.map(entry =>
      `<div class="volume-detail-row"><span>${esc(entry.date)} · ${esc(entry.exercise)} · Set ${entry.set}</span>` +
      `<strong>${fmt(entry.kg)} kg × ${fmt(entry.reps)} = ${fmt(entry.contribution)}</strong></div>`).join('')
    : '<p class="hint">No weight-based sets recorded this week. Bodyweight sets at 0 kg contribute zero; timed holds are excluded.</p>';
  const volumeExplanation = '<details class="volume-explanation"><summary>Show calculation · weight × reps (secondary)</summary>' +
    '<p class="hint">Each saved set contributes its entered kg × completed reps. Dumbbell weights are not automatically doubled; ' +
    `totals are not total repetitions.</p>${breakdown}<div class="volume-detail-total">` +
    `<strong>Weekly total</strong><strong>${fmt(analysis.loadVolume)} kg × reps</strong></div></details>`;
  const days = DAYS.map((day, index) => {
    const template = state.templates.find(t => t.id === state.assignments[index]);
    return `<div class="day-tile ${template ? 'active' : ''}"><strong>${day}</strong>` +
      `<span>${esc(template?.name || 'Rest')}</span></div>`;
  }).join('');
  const nextDay = (() => {
    for (let i = 0; i < 7; i++) {
      const day = weekdayOf(addDays(today(), i));
      const t = state.templates.find(t => t.id === state.assignments[day]);
      if (t) return { date: addDays(today(), i), t };
    }
    return null;
  })();
  const bestRows = best.length
    ? best.map(l => `<div class="data-row"><div><strong>${esc(l.exerciseName)}</strong><span>${nice(l.date)}</span></div>` +
      `<div class="score tinted">${fmt(l.kg)} kg × ${l.reps}</div></div>`).join('')
    : '<div class="empty"><strong>No lifts yet</strong>Your best sets will appear after you save them.</div>';
  const chartLabel = analysis.days.map((v, i) => `${DAYS[i]} ${v.completed} sets`).join('; ');
  const daysAssigned = analysis.days.filter(d => d.assignedCompleted > 0).length;

  return `${shellHeading()}<nav class="fp-top-nutrition" aria-label="Nutrition quick links">` +
    '<a class="btn fp-top-nutrition-link" href="./nutrition.html">Nutrition</a>' +
    '<a class="btn fp-top-nutrition-link" href="./food-diary.html">Food Diary</a>' +
    '<a class="btn secondary fp-top-nutrition-link" href="./nutrition-cheatsheet.html">Cheatsheet</a></nav>' +
    `  <div class="section-label"><h2>Selected training week</h2><span>${nice(s.dates[0])} – ${nice(s.dates[6])}</span></div>
  <div class="fp-week-actions" role="group" aria-label="Choose training week">` +
    '<button type="button" class="btn secondary small-btn" data-action="week-prev">← Previous week</button>' +
    '<button type="button" class="btn secondary small-btn" data-action="week-current">Current week</button>' +
    `<button type="button" class="btn secondary small-btn" data-action="week-latest" ${latestWeek?'':'disabled'}>` +
    'Latest logged week</button>' +
    `<button type="button" class="btn secondary small-btn" data-action="week-next">Next week →</button></div>
  ${weeklyInsightsMarkup(snapshot, insights, fmt)}` +
    `${backupReminderCard(storage, today)}` +
    `${strengthDashboard(state, strengthJourneyIndex, { today: today(), metric: strengthViewMetric, range: strengthHistoryFilter })}` +
    `${dashboardWalkerBanner(walkerDataUrl)}${gildedSummary(analysis, nextDay, lifetimeTrainingSets(state), s.dates, helpers)}` +
    `${!state.templates.length ? initialCard() : workoutCard(nextDay, helpers)}
  ${earlierHint}${inWeekCards(s, analysis, fmt)}
  <div class="two-panels" style="margin-top:12px"><section class="card"><div class="card-head">` +
    '<div><h2>Completed sets by day</h2><p>Working sets logged each day</p></div><span class="badge">7 DAYS</span></div>' +
    `<div class="day-bars" role="img" aria-label="Completed sets by day: ${chartLabel}">${chart}</div>` +
    '<div class="inline-meta"><span class="dot"></span>Chart counts unique logged working sets, not finished sessions.</div>' +
    `${volumeExplanation}</section>
  <section class="card"><div class="card-head"><div><h2>Your assigned workout days</h2>` +
    '<p>Current weekday assignments (not a historical snapshot)</p></div>' +
    `<button class="btn ghost small-btn" data-page="plan">Edit plan →</button></div><div class="day-calendar">${days}</div>` +
    `<div class="inline-meta">${daysAssigned} assigned day(s) with logged sets · ${s.planned} scheduled. ` +
    `This is not a workout-completion score.</div></section></div>
  ${trainingAnalyticsPanel(state, s.dates[0], today())}
  ${v102OverlapPanel(state, s.dates[0])}${v103OverlapPanel(state, s.dates[0])}
  <section class="card" style="margin-top:16px"><div class="card-head"><div><h2>Nutrition & Weight Journey</h2>` +
    '<p>Record meals and derive daily calories/protein/carbs/fat in a separate diary. Existing check-ins are unchanged.</p></div></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><a class="btn" href="./food-diary.html">Open Food Diary →</a>' +
    `<a class="btn secondary" href="./nutrition.html">Nutrition trends →</a></div></section>
  ${foodDiaryChartForInput(foodInput, today(), snapshot.selected.food)}
  <div class="section-label"><h2>Insights</h2><span>Only real entries</span></div>
  ${insightsMarkup(insights, fmt)}
  <div class="two-panels"><section class="card"><div class="card-head"><div><h2>Manual daily check-ins</h2>` +
    '<p>Weekly averages · not derived from Food Diary</p></div><button class="btn ghost small-btn" data-page="train">Add →</button>' +
    `</div>${dailyAverageRows(s, state.metrics, helpers)}</section>
  <section class="card"><div class="card-head"><div><h2>Strongest sets</h2><p>Heaviest recorded weight by exercise</p></div></div>` +
    `${bestRows}</section></div><p class="footer-hint">Weight for dumbbells is recorded exactly as entered; ` +
    'volume does not automatically double per-hand weights. ' +
    'Bodyweight moves logged at 0 kg count as sets but contribute 0 kg to volume.</p>';
}
