import { esc } from './html.js';
import { getExerciseJourney } from './strength-journey.js';
import { metricDefinition } from './metric-dictionary.js';

const within = (date, period) => date >= period.from && date <= period.to;
const eligible = set => set.kg > 0 && Number.isFinite(set.rpe) && set.rpe >= 1 && set.rpe <= 10 &&
  set.technique === 'controlled' && set.difficulty !== 'too_hard';

// Compare only exact saved exercise identities, not similar names or linked archives.
export function comparableExerciseLoads(state, current, previous) {
  const groups = new Map();
  for (const row of state.logs) {
    if (!within(row.date, current) && !within(row.date, previous)) continue;
    if (!groups.has(row.templateId)) groups.set(row.templateId, new Map());
    const exercises = groups.get(row.templateId);
    if (!exercises.has(row.exerciseIndex)) exercises.set(row.exerciseIndex, []);
    exercises.get(row.exerciseIndex).push(row);
  }
  const results = [];
  for (const template of state.templates) {
    const groupsForTemplate = groups.get(template.id);
    if (!groupsForTemplate) continue;
    for (const [index, logs] of groupsForTemplate) {
      const exercise = template.exercises[index];
      if (!exercise || exercise.repUnit === 'seconds_per_side') continue;
      const journey = getExerciseJourney({...state, logs, exerciseEquivalences: []}, template.id, index);
      const latest = period => journey.sessions.filter(s => within(s.date, period)).at(-1);
      const now = latest(current), before = latest(previous);
      if (!now || !before) continue;
      const pairs = [];
      for (const a of now.sets.filter(eligible)) {
        for (const b of before.sets.filter(eligible)) {
          if (a.reps === b.reps && a.rpe === b.rpe && a.set === b.set) pairs.push([a, b]);
        }
      }
      // First matching set number is deterministic; never select based on direction of change.
      const pair = pairs[0];
      if (!pair) continue;
      const [a, b] = pair;
      results.push({templateId: template.id, exerciseIndex: index, name: exercise.name, template: template.name,
        reps: a.reps, rpe: a.rpe, set: a.set, current: {date: now.date, kg: a.kg},
        previous: {date: before.date, kg: b.kg}, change: a.kg - b.kg});
    }
  }
  return results;
}

function nutrientComparison(current, previous, key) {
  const a = current.foodMetrics?.[key], b = previous.foodMetrics?.[key];
  // Even every day containing food is only recording coverage, not confirmed complete intake.
  if (!a || !b || a.knownDays !== current.periodDays || b.knownDays !== previous.periodDays ||
    a.unknownFoods || b.unknownFoods) return null;
  return {id: a.id, current: a.average, previous: b.average, change: a.average - b.average};
}

export function dashboardInsights(state, snapshot, today) {
  if (!snapshot.comparison) return {status: 'future_period'};
  const {current, previous, weightChange} = snapshot.comparison;
  const loads = comparableExerciseLoads(state, current, previous);
  const due = current.training.byDay.filter(d => d.completed > 0 && d.date < today);
  const observed = new Set((state.symptomLogs ?? []).filter(s => s.timepoint === 'next_day').map(s => s.date));
  return {
    status: 'recorded_observations', current: {from: current.from, to: current.to, days: current.periodDays},
    previous: {from: previous.from, to: previous.to, days: previous.periodDays},
    training: {current: current.training.savedSets.value, previous: previous.training.savedSets.value,
      currentDays: current.training.loggedDays.value, previousDays: previous.training.loggedDays.value,
      offPlanSets: current.training.offPlanSets},
    weight: {change: weightChange, current: current.weight.value, previous: previous.weight.value,
      currentCount: current.weight.observations, previousCount: previous.weight.observations},
    loads,
    food: {coverage: current.foodCoverage?.value ?? null, previousCoverage: previous.foodCoverage?.value ?? null,
      nutrients: Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map(key =>
        [key, nutrientComparison(current, previous, key)]))},
    recovery: {current: current.manual.recovery.value, previous: previous.manual.recovery.value,
      currentCount: current.manual.recovery.observations, previousCount: previous.manual.recovery.observations,
      dueDates: due.length, missingNextDayDates: due.filter(d => !observed.has(d.date)).map(d => d.date)}
  };
}

export function insightsMarkup(report, fmt) {
  if (report.status === 'future_period') return '<section class="card" aria-label="Recorded insights"><p>No elapsed dates to compare in this selected week.</p></section>';
  const {current, previous, training, weight, loads, food, recovery} = report;
  const signed = n => (n > 0 ? '+' : '') + fmt(n);
  const paragraph = (title, body) => '<p><strong>' + esc(title) + '</strong> · ' + esc(body) + '</p>';
  const trainingText = training.current + ' vs ' + training.previous + ' saved working sets (' +
    signed(training.current - training.previous) + '); ' + training.currentDays + ' vs ' +
    training.previousDays + ' logged training dates. ' + training.offPlanSets + ' current off-plan sets.';
  const weightText = weight.change === null ? 'At least two recorded weigh-ins in each period are needed to compare.' :
    fmt(weight.current) + ' vs ' + fmt(weight.previous) + ' kg (' + signed(weight.change) + ' kg). ' +
    weight.currentCount + ' vs ' + weight.previousCount + ' readings; not a measure of fat change.';
  const loadText = row => row.name + ' (' + row.template + '): ' + fmt(row.previous.kg) + ' → ' +
    fmt(row.current.kg) + ' kg (' + signed(row.change) + ' kg), set ' + row.set + ', ' +
    row.reps + ' reps, RPE ' + row.rpe + '; ' + row.previous.date + ' → ' + row.current.date + '.';
  const foodText = food.coverage === null ? 'Food Diary unavailable.' :
    food.coverage + '/' + current.days + ' days with entries vs ' + food.previousCoverage + '/' +
    previous.days + '. Coverage is not confirmed full-day intake.';
  const nutrition = Object.entries(food.nutrients).map(([key, value]) => {
    const names = {kcal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat'};
    if (value === null) return paragraph(names[key], 'Insufficient known values for a like-period recorded average comparison.');
    const unit = metricDefinition(value.id).unit;
    return paragraph(names[key], fmt(value.current) + ' vs ' + fmt(value.previous) + ' ' + unit +
      '/day (' + signed(value.change) + '); recorded foods only.');
  }).join('');
  const recoveryText = recovery.currentCount >= 2 && recovery.previousCount >= 2
    ? fmt(recovery.current) + ' vs ' + fmt(recovery.previous) + ' / 5 recorded average (' +
      recovery.currentCount + ' vs ' + recovery.previousCount + ' entries).'
    : 'At least two recovery scores per period are needed to compare.';
  const higher = loads.filter(row => row.change > 0);
  const combined = weight.change !== null && weight.change < 0 && higher.length
    ? paragraph('Lower recorded weight with higher matched exercise load',
      higher.length + ' exercise(s) had a higher recorded load under matched conditions. This is not proof of muscle gain or clearance.')
    : '';
  return '<section class="card" aria-label="Recorded insights"><h2>Recorded observations</h2>' +
    '<p class="hint">' + esc(current.from + ' – ' + current.to + ' compared with ' + previous.from + ' – ' + previous.to) +
    '. Matched calendar weekdays; today may be incomplete.</p>' + paragraph('Training', trainingText) +
    paragraph('Body weight', weightText) + combined +
    paragraph('Exercise performance', loads.length ? loads.length + ' exact exercise comparison(s). No combined strength score.' :
      'No matching recorded sets with the same reps, RPE, set number and controlled technique.') +
    (loads.length ? '<details class="volume-explanation"><summary>Matched exercise evidence</summary>' +
      loads.map(row => paragraph('Recorded load', loadText(row))).join('') + '</details>' : '') +
    paragraph('Food coverage', foodText) +
    '<details class="volume-explanation"><summary>Recorded nutrient comparisons</summary>' + nutrition + '</details>' +
    paragraph('Recovery check-ins', recoveryText) +
    paragraph('Next-day observations', recovery.missingNextDayDates.length + ' of ' + recovery.dueDates +
      ' elapsed training dates lack any next-day observation.' + (recovery.missingNextDayDates.length ?
      ' Dates: ' + recovery.missingNextDayDates.join(', ') + '.' : '')) +
    '<p class="hint">Recorded observations only. Missing meals or workouts may change these comparisons. No causal conclusions, nutritional targets or loading recommendations.</p></section>';
}

// At-a-glance presentation only; no new metric or progression calculations.
export function weeklyInsightsMarkup(snapshot, report, fmt) {
  if (report.status === 'future_period') return '<section class="card fp-intelligence" aria-label="Weekly insights">' +
    '<h2>Weekly insights</h2><p>No elapsed dates in this selected week. Future records are not used for comparisons.</p></section>';
  const {current, previous} = snapshot.comparison;
  const {training, weight, loads, food, recovery} = report;
  const signed = n => (n > 0 ? '+' : '') + fmt(n);
  const tile = (label, value, unit, note) => '<div class="fp-intelligence-tile"><span>' + esc(label) +
    '</span><strong>' + esc(value) + (unit ? ' <small>' + esc(unit) + '</small>' : '') +
    '</strong><span>' + esc(note) + '</span></div>';
  const countChange = (now, before) => signed(now - before) + ' vs prior period (' + fmt(before) + ')';
  const trainingTiles = tile('Working sets', fmt(training.current), 'sets', countChange(training.current, training.previous)) +
    tile('Training dates', fmt(training.currentDays), '/' + current.periodDays + ' days',
      countChange(training.currentDays, training.previousDays)) +
    tile('Recorded body weight', weight.current === null ? 'Not recorded' : fmt(weight.current), weight.current === null ? '' : 'kg',
      weight.currentCount + ' readings · ' + (weight.change === null ? 'comparison unavailable' : signed(weight.change) + ' kg vs prior')) +
    tile('Matched exercise loads', loads.length ? fmt(loads.length) : 'No matches', loads.length ? 'exercises' : '',
      loads.length ? loads.filter(row => row.change > 0).length + ' higher · ' +
        loads.filter(row => row.change === 0).length + ' equal · ' + loads.filter(row => row.change < 0).length + ' lower' :
        'Same reps, RPE, set and controlled technique required');
  const macros = ['kcal', 'protein', 'carbs', 'fat'].map(key => {
    const label = {kcal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat'}[key];
    const m = current.foodMetrics?.[key], compared = food.nutrients[key];
    if (!m) return tile(label, 'Unavailable', '', 'Food Diary could not be read');
    if (m.average === null) return tile(label, m.status === 'not_logged' ? 'Not logged' : 'Unknown', '',
      m.knownDays + '/' + current.periodDays + ' dates with values');
    const note = m.knownDays + '/' + current.periodDays + ' dates with values · ' +
      (m.unknownFoods ? m.unknownFoods + ' unknown item(s)' : compared ? signed(compared.change) + ' vs prior' : 'comparison unavailable');
    return tile(label, fmt(m.average), m.unit + '/day', note);
  }).join('');
  const evidence = (label, known, total, note) => {
    const ratio = total ? Math.round(known / total * 100) : 0;
    const bar = total ? '<div class="fp-evidence-track" aria-hidden="true"><span style="width:' +
      ratio + '%"></span></div>' : '';
    return '<div class="fp-evidence-row"><strong>' + esc(label) + '</strong><span>' +
      esc(total ? known + '/' + total : 'None due') + '</span>' + bar +
      '<small>' + esc(note) + '</small></div>';
  };
  const recoveryKnown = recovery.dueDates - recovery.missingNextDayDates.length;
  const coverage = food.coverage === null ? '<p class="hint">Food Diary unavailable.</p>' :
    evidence('Food diary dates', food.coverage, current.periodDays, 'Recording coverage only; meals may be missing.');
  const lowerWeightHigherLoad = weight.change !== null && weight.change < 0 && loads.some(row => row.change > 0);
  const combined = lowerWeightHigherLoad ? '<p><strong>Lower recorded weight with higher matched load.</strong> ' +
    'Not proof of muscle gain or clearance.</p>' : '';
  return '<section class="card fp-intelligence" aria-label="Weekly insights"><h2>Weekly insights</h2>' +
    '<p class="hint">' + esc(current.from + ' – ' + current.to + ' vs ' + previous.from + ' – ' + previous.to) +
    '. Matched weekdays; today may be incomplete.</p><div class="fp-intelligence-grid">' + trainingTiles + '</div>' +
    '<h3>Recorded food · average on known dates</h3><div class="fp-intelligence-grid">' + macros + '</div>' +
    '<h3>Evidence coverage</h3>' + coverage +
    evidence('Weigh-ins', weight.currentCount, current.periodDays, 'Measured dates; not a fat-mass measurement.') +
    evidence('Next-day observations', recoveryKnown, recovery.dueDates, 'Any observation per elapsed training date; not clearance.') +
    combined + '<p class="hint">Only recorded values. See detailed observations and calculation sources below.</p></section>';
}
