/**
 * Read-only metric selectors v1. All inputs are validated snapshots, never browser storage.
 * Existing authoritative parsers/analytics supply diary totals and training set semantics.
 */
import {NUTRIENTS,totalsForDate,validateDiary} from './food-diary-core.js';
import {weeklyTrainingAnalysis} from './training-analytics.js';
import {metricDefinition} from './metric-dictionary.js';
import {METRIC_FIELDS,weeklyMetricSources} from './metric-breakdown.js';

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Expected a local YYYY-MM-DD date.');
  const date = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw Error('Invalid calendar date.');
  return date;
}
function offsetDay(key, step) {
  const date = isoDate(key);
  date.setUTCDate(date.getUTCDate()+step);
  return date.toISOString().slice(0,10);
}
function metric(id,value,extra={}) { return {id,unit:metricDefinition(id).unit,value,...extra}; }
function checkState(state) {
  if (!state || !Array.isArray(state.metrics) || !Array.isArray(state.logs) ||
      !Array.isArray(state.templates) || !state.assignments || typeof state.assignments !== 'object') {
    throw Error('Expected an existing validated FitnessPilot workout snapshot.');
  }
}
/** The two calorie/protein sources must remain separate: never coalesce or add them. */
export function dailyNutritionMetrics(workoutState,rawDiary,date) {
  checkState(workoutState); isoDate(date);
  const day = totalsForDate(rawDiary,date);
  const matches=workoutState.metrics.filter(x=>x.date===date);
  if(matches.length>1) throw Error('Duplicate manual check-in date.');
  const manual=matches[0]??{};
  function manualMetric(field,id) {
    const value=manual[field];
    if(value!=null&&(typeof value!=='number'||!Number.isFinite(value)||value<0)) throw Error('Invalid manual check-in value.');
    return metric(id,value??null,{source:'manual_daily_checkin',status:value==null?'not_recorded':'user_entered'});
  }
  function foodMetric(field,id) {
    const {value,unknown}=day.nutrients[field];
    const known=day.count-unknown;
    return metric(id,known?value:null,{
      source:'food_diary',knownItems:known,unknownItems:unknown,
      status:day.count===0?'not_logged':known===0?'all_values_unknown':'known_recorded_subtotal',
      completeness:'not_verified'
    });
  }
  return {
    date,foodEntries:day.count,
    calories:foodMetric('kcal','food.known_kcal.v1'),
    protein:foodMetric('protein','food.known_protein_g.v1'),
    manualCalories:manualMetric('calories','checkin.calories_manual.v1'),
    manualProtein:manualMetric('protein','checkin.protein_manual.v1'),
    nutritionAdherence:metric('food.complete_day_adherence.v0',null,{
      status:'unavailable',reason:'Food Diary v1 has no complete-day verification or approved target adherence contract.'
    })
  };
}
/** Averaging observed check-ins is not interpolation, and does not imply fat loss. */
export function sevenDayWeightMetric(workoutState,endDate) {
  checkState(workoutState);isoDate(endDate);
  const start=offsetDay(endDate,-6);
  const samples=workoutState.metrics.filter(m=>m.date>=start&&m.date<=endDate&&
    typeof m.weight==='number'&&Number.isFinite(m.weight)&&m.weight>=1&&m.weight<=400)
    .map(m=>({date:m.date,kg:m.weight})).sort((a,b)=>a.date.localeCompare(b.date));
  if(new Set(samples.map(x=>x.date)).size!==samples.length)throw Error('Duplicate weight check-in date.');
  const value=samples.length?samples.reduce((total,m)=>total+m.kg,0)/samples.length:null;
  return metric('weight.mean_7d.v1',value,{
    source:'manual_daily_checkin',from:start,to:endDate,observations:samples.length,
    periodDays:7,records:samples,status:samples.length?'recorded_average':'not_recorded',
    warning:'Measured weight average, not a fat-mass or calorie-deficit measurement.'
  });
}
/** Delegate single-set counting to existing authoritative weekly training analytics. */
export function weeklyTrainingMetrics(workoutState,anchorDate) {
  checkState(workoutState);
  const d=isoDate(anchorDate);
  const monday=offsetDay(anchorDate,-((d.getUTCDay()+6)%7));
  return trainingMetricsFromReport(weeklyTrainingAnalysis(workoutState,monday));
}

function trainingMetricsFromReport(report) {
  const monday=report.days[0].date;
  const eligibleCount=report.volumeEntries.length;
  return {
    weekStart:monday,weekEnd:offsetDay(monday,6),
    savedSets:metric('train.saved_working_sets_week.v1',report.completed,{
      source:'working_set_logs',offPlanSets:report.offPlan,
      status:report.completed?'recorded':'no_saved_sets'
    }),
    loadVolume:metric('train.kg_reps_week.v1',eligibleCount?report.loadVolume:null,{
      source:'working_set_logs',weightBasedSets:eligibleCount,
      timedHoldSets:report.timedHolds.length,status:eligibleCount?'recorded':'not_applicable',
      contributors:report.volumeEntries
    }),
    assignedPlanProgress:metric('train.assigned_plan_progress_week.v1',
      report.planned?Math.min(100,Math.round(report.assignedCompleted/report.planned*100)):null,{
        source:'scheduled_plan_and_working_set_logs',plannedSets:report.planned,
        assignedSavedSets:report.assignedCompleted,offPlanSets:report.offPlan,
        status:report.planned?'recorded_plan_set_progress':'no_assigned_plan',
        warning:'Not a completed-session or recovery-clearance percentage.'
      })
  };
}
/** Logging coverage is deliberately not nutrition target adherence. */
export function sevenDayFoodCoverage(rawDiary,endDate) {
  isoDate(endDate);
  const {entries}=validateDiary(rawDiary);
  const dates=Array.from({length:7},(_,i)=>offsetDay(endDate,i-6));
  const inRange=new Set(dates);
  const byDate=new Map(dates.map(date=>[date,{date,entries:0,knownKcal:0,unknownKcal:0}]));
  for(const entry of entries){
    if(!inRange.has(entry.date))continue;
    const d=byDate.get(entry.date);d.entries++;
    if(entry.kcal===null)d.unknownKcal++;else d.knownKcal++;
  }
  const days=[...byDate.values()];
  const value=days.filter(d=>d.entries>0).length;
  return metric('food.entry_coverage_week.v1',value,{
    from:dates[0],to:endDate,periodDays:7,
    numericDays:days.filter(d=>d.knownKcal>0).length,
    daysWithUnknownKcal:days.filter(d=>d.unknownKcal>0).length,
    days,source:'food_diary',status:'recording_coverage_only',
    completeness:'not_verified',nutritionAdherence:null
  });
}

// The same period math serves the chart and future Insights. Never impute a missing food.
const FOOD_WEEK_IDS = Object.freeze({
  kcal: 'food.recorded_kcal_week.v1', protein: 'food.recorded_protein_week.v1',
  carbs: 'food.recorded_carbs_week.v1', fat: 'food.recorded_fat_week.v1'
});
function foodPeriod(entries, dates) {
  const inPeriod = new Set(dates);
  const rows = entries.filter(e => inPeriod.has(e.date));
  const nutrients = Object.fromEntries(NUTRIENTS.map(key => {
    const known = rows.filter(e => e[key] !== null);
    const knownDays = new Set(known.map(e => e.date)).size;
    const total = known.length ? known.reduce((sum, e) => sum + e[key] * e.servings, 0) : null;
    return [key, {total, average: knownDays ? total / knownDays : null, knownDays, unknownFoods: rows.length - known.length}];
  }));
  return {start: dates[0], end: dates.at(-1), recordedDays: new Set(rows.map(e => e.date)).size,
    foodCount: rows.length, nutrients};
}

export function selectedWeekFoodSummary(rawDiary, monday) {
  if (isoDate(monday).getUTCDay() !== 1) throw Error('Selected week must start on Monday.');
  const dates = Array.from({length: 7}, (_, i) => offsetDay(monday, i));
  return foodPeriod(validateDiary(rawDiary).entries, dates);
}

function weightForDates(state, dates) {
  const allowed = new Set(dates);
  const records = state.metrics.filter(m => allowed.has(m.date) &&
    typeof m.weight === 'number' && Number.isFinite(m.weight) && m.weight >= 1 && m.weight <= 400)
    .map(m => ({date: m.date, kg: m.weight})).sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(records.map(m => m.date)).size !== records.length) throw Error('Duplicate weight check-in date.');
  const value = records.length ? records.reduce((sum, m) => sum + m.kg, 0) / records.length : null;
  return metric('weight.mean_week.v1', value, {source: 'manual_daily_checkin', observations: records.length,
    records, status: records.length ? 'recorded_average' : 'not_recorded'});
}

function manualForDates(state, dates) {
  const sources = weeklyMetricSources(state.metrics, dates);
  return Object.fromEntries(METRIC_FIELDS.map(([, key]) => {
    const records = sources[key];
    const value = records.length ? records.reduce((sum, m) => sum + m.value, 0) / records.length : null;
    const ids = {calories: 'checkin.calories_mean_week.v1', protein: 'checkin.protein_mean_week.v1',
      sleep: 'checkin.sleep_mean_week.v1', recovery: 'checkin.recovery_mean_week.v1'};
    return [key, metric(ids[key], value, {source: 'manual_daily_checkin', observations: records.length,
      records, status: records.length ? 'recorded_average' : 'not_recorded'})];
  }));
}

function periodSnapshot(state, diary, report, dates) {
  const inPeriod = new Set(dates);
  const days = report.days.filter(d => inPeriod.has(d.date));
  const sum = key => days.reduce((n, d) => n + d[key], 0);
  const food = diary === null ? null : foodPeriod(diary.entries, dates);
  return {
    from: dates[0], to: dates.at(-1), periodDays: dates.length,
    training: {
      savedSets: metric('train.saved_working_sets_week.v1', sum('completed'), {source: 'working_set_logs'}),
      loggedDays: metric('train.logged_days_week.v1', days.filter(d => d.completed > 0).length,
        {source: 'working_set_logs'}),
      assignedSets: sum('assignedCompleted'), plannedSets: sum('planned'), offPlanSets: sum('offPlan'),
      byDay: days.map(d => ({...d}))
    },
    food, foodCoverage: food === null ? null : metric('food.entry_coverage_period.v1', food.recordedDays, {
      source: 'food_diary', periodDays: dates.length, completeness: 'not_verified', nutritionAdherence: null}),
    foodMetrics: food === null ? null : Object.fromEntries(NUTRIENTS.map(key => {
      const n = food.nutrients[key];
      return [key, metric(FOOD_WEEK_IDS[key], n.total, {...n, source: 'food_diary',
        status: !food.foodCount ? 'not_logged' : n.total === null ? 'all_values_unknown' : 'known_recorded_subtotal',
        completeness: 'not_verified'})];
    })),
    weight: weightForDates(state, dates), manual: manualForDates(state, dates)
  };
}

/** Full selected week plus a same-elapsed-weekday comparison; null diary means unavailable, not empty. */
export function dashboardMetricSnapshot(state, rawDiary, anchorDate, today) {
  checkState(state);
  const anchor = isoDate(anchorDate);
  isoDate(today);
  const monday = offsetDay(anchorDate, -((anchor.getUTCDay() + 6) % 7));
  const dates = Array.from({length: 7}, (_, i) => offsetDay(monday, i));
  const diary = rawDiary === null ? null : validateDiary(rawDiary);
  const report = weeklyTrainingAnalysis(state, monday);
  const selected = periodSnapshot(state, diary, report, dates);
  const elapsed = dates.filter(date => date <= today);
  let comparison = null;
  if (elapsed.length) {
    const previousDates = elapsed.map(date => offsetDay(date, -7));
    const previousReport = weeklyTrainingAnalysis(state, previousDates[0]);
    const current = periodSnapshot(state, diary, report, elapsed);
    const previous = periodSnapshot(state, diary, previousReport, previousDates);
    comparison = {current, previous,
      weightChange: current.weight.observations >= 2 && previous.weight.observations >= 2
        ? current.weight.value - previous.weight.value : null};
  }
  return {selected, comparison, trainingReport: report, trainingMetrics: trainingMetricsFromReport(report)};
}
