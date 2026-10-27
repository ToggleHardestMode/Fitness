/**
 * Read-only metric selectors v1. All inputs are validated snapshots, never browser storage.
 * Existing authoritative parsers/analytics supply diary totals and training set semantics.
 */
import {totalsForDate,validateDiary} from './food-diary-core.js';
import {weeklyTrainingAnalysis} from './training-analytics.js';
import {metricDefinition} from './metric-dictionary.js';

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
  const report=weeklyTrainingAnalysis(workoutState,monday);
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
