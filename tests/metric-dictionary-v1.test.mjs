import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {METRIC_DICTIONARY,metricDefinition} from '../preview-v101/metric-dictionary.js';
import {
  dailyNutritionMetrics,sevenDayWeightMetric,weeklyTrainingMetrics,sevenDayFoodCoverage
} from '../preview-v101/metric-selectors.js';

const day='2026-10-26'; // Monday, Singapore calendar date
const meal=(id,date,kcal,protein,servings=1)=>({
  id,date,name:'Synthetic food',occasion:'meal',servings,kcal,protein,carbs:null,fat:null
});
const food=(entries=[])=>({version:1,entries});
const training=()=>({
  version:1,metrics:[],logs:[],
  templates:[
    {id:'upper',name:'Upper',sourceVersion:'V10.1 Home',exercises:[
      {name:'Bench',muscle:'Chest',sets:2,rest:90},
      {name:'Side Plank',muscle:'Core',sets:1,repUnit:'seconds_per_side',rest:90}
    ]},
    {id:'off',name:'Other',exercises:[{name:'Row',muscle:'Back',sets:1,rest:90}]}
  ],assignments:{0:'upper'}
});
const log=(id,date,templateId,exerciseIndex,set,kg,reps,extra={})=>({
 id,date,templateId,exerciseIndex,set,kg,reps,...extra
});

test('dictionary has distinct versioned definitions, source identities and meaning',()=>{
  const ids=Object.keys(METRIC_DICTIONARY);
  assert.equal(ids.length,10);
  assert.equal(new Set(ids).size,ids.length);
  for(const [id,item] of Object.entries(METRIC_DICTIONARY)){
    assert.equal(item.id,id);
    assert.equal(item.version,1);
    for(const prop of ['source','unit','grain','formula','missing','meaning'])
      assert.ok(typeof item[prop]==='string' && item[prop].length>=(prop==='unit'?1:4),id+': '+prop);
  }
  assert.notEqual(metricDefinition('food.known_kcal.v1').source,
    metricDefinition('checkin.calories_manual.v1').source);
  assert.throws(()=>metricDefinition('calories'),/Unknown metric/);
});

test('manual daily check-in and known food calories are separate, not additive',()=>{
  const s=training();s.metrics.push({date:day,calories:1800,protein:160});
  const d=food([meal('food-0001',day,650,30),meal('food-0002',day,null,null)]);
  const before=structuredClone({s,d});
  const report=dailyNutritionMetrics(s,d,day);
  assert.equal(report.calories.value,650);
  assert.equal(report.calories.knownItems,1);
  assert.equal(report.calories.unknownItems,1);
  assert.equal(report.protein.value,30);
  assert.equal(report.protein.unknownItems,1);
  assert.equal(report.manualCalories.value,1800);
  assert.equal(report.manualProtein.value,160);
  assert.equal(report.nutritionAdherence.value,null);
  assert.equal(report.calories.completeness,'not_verified');
  assert.equal(report.manualCalories.source,'manual_daily_checkin');
  assert.deepEqual({s,d},before);
});

test('servings are multiplied once; known zero is different from null',()=>{
  const s=training();
  const d=food([meal('food-0003',day,0,0,1),
                meal('food-0004',day,200,25,1.5),
                meal('food-0005',day,null,null)]);
  const out=dailyNutritionMetrics(s,d,day);
  assert.equal(out.calories.value,300);
  assert.equal(out.protein.value,37.5);
  assert.equal(out.calories.knownItems,2);
  assert.equal(out.calories.unknownItems,1);
  assert.equal(out.manualCalories.value,null);
  assert.equal(dailyNutritionMetrics(s,food([meal('food-0006',day,0,0)]),day).calories.value,0);
});

test('unlogged and all-unknown days remain null, never a fabricated zero',()=>{
  const s=training();
  const empty=dailyNutritionMetrics(s,food(),day);
  assert.equal(empty.calories.value,null);
  assert.equal(empty.calories.status,'not_logged');
  const unknown=dailyNutritionMetrics(s,food([meal('food-0007',day,null,null)]),day);
  assert.equal(unknown.calories.value,null);
  assert.equal(unknown.calories.status,'all_values_unknown');
  assert.equal(unknown.protein.knownItems,0);
  assert.equal(unknown.nutritionAdherence.value,null);
});

test('manual numeric zero is a real user entry and not a missing value',()=>{
  const s=training();s.metrics=[{date:day,calories:0,protein:0}];
  const r=dailyNutritionMetrics(s,food(),day);
  assert.equal(r.manualCalories.value,0);
  assert.equal(r.manualProtein.value,0);
  assert.equal(r.calories.value,null);
  assert.equal(r.manualCalories.status,'user_entered');
});

test('invalid food backup or duplicate manual date rejects instead of silently miscounting',()=>{
  const s=training();s.metrics=[{date:day,calories:100},{date:day,calories:200}];
  assert.throws(()=>dailyNutritionMetrics(s,food(),day),/Duplicate manual/);
  assert.throws(()=>dailyNutritionMetrics(training(),{version:7,entries:[]},day),/Invalid Food Diary/);
  assert.throws(()=>dailyNutritionMetrics(training(),food(),'2026-02-30'),/Invalid calendar date|valid date/);
});

test('seven-day weight uses only actual check-ins, correct inclusive window and count',()=>{
  const s=training();
  s.metrics=[
    {date:'2026-10-21',weight:200},  // outside 7d range ending Oct 28
    {date:'2026-10-22',weight:90},
    {date:'2026-10-25',weight:88},
    {date:'2026-10-28',weight:89}
  ];
  const before=structuredClone(s);
  const r=sevenDayWeightMetric(s,'2026-10-28');
  assert.equal(r.from,'2026-10-22');
  assert.equal(r.observations,3);
  assert.equal(r.value,89);
  assert.deepEqual(r.records.map(v=>v.date),['2026-10-22','2026-10-25','2026-10-28']);
  assert.deepEqual(s,before);
});

test('no weight samples means null; repeated check-in date fails rather than doubles',()=>{
  assert.equal(sevenDayWeightMetric(training(),'2026-10-28').value,null);
  const s=training();s.metrics=[{date:day,weight:90},{date:day,weight:89}];
  assert.throws(()=>sevenDayWeightMetric(s,'2026-10-28'),/Duplicate weight/);
});

test('training uses canonical counted sets, excludes holds and preserves off-plan logic',()=>{
  const s=training();
  s.logs=[
    log('a','2026-10-26','upper',0,1,40,10),
    log('b','2026-10-26','upper',0,2,50,8),
    log('c','2026-10-26','upper',1,1,0,30),
    log('d','2026-10-27','off',0,1,0,10)
  ];
  const before=structuredClone(s);
  const r=weeklyTrainingMetrics(s,'2026-10-28');
  assert.equal(r.weekStart,'2026-10-26');
  assert.equal(r.weekEnd,'2026-11-01');
  assert.equal(r.savedSets.value,4);
  assert.equal(r.savedSets.offPlanSets,1);
  assert.equal(r.loadVolume.value,800);
  assert.equal(r.loadVolume.weightBasedSets,3);
  assert.equal(r.loadVolume.timedHoldSets,1);
  assert.equal(r.assignedPlanProgress.value,100);
  assert.equal(r.assignedPlanProgress.plannedSets,3);
  assert.equal(r.assignedPlanProgress.assignedSavedSets,3);
  assert.deepEqual(s,before);
});

test('warmups and duplicate set keys are not counted as two working sets',()=>{
  const s=training();
  s.logs=[
    log('s1',day,'upper',0,1,50,10),
    log('s2',day,'upper',0,1,50,10),
    log('s3',day,'upper',0,2,20,8,{isWarmup:true})
  ];
  const r=weeklyTrainingMetrics(s,day);
  assert.equal(r.savedSets.value,1);
  assert.equal(r.loadVolume.value,500);
  assert.equal(r.assignedPlanProgress.assignedSavedSets,1);
});

test('timed-hold-only week has saved work but no numeric load volume',()=>{
  const s=training();
  s.logs=[log('a',day,'upper',1,1,0,30)];
  const r=weeklyTrainingMetrics(s,day);
  assert.equal(r.savedSets.value,1);
  assert.equal(r.loadVolume.value,null);
  assert.equal(r.loadVolume.timedHoldSets,1);
  assert.equal(r.assignedPlanProgress.value,33);
});

test('with no assigned plan, scheduled progress stays unavailable but saved off-plan work counts',()=>{
  const s=training();
  s.assignments={};
  s.logs=[log('a',day,'upper',0,1,25,8)];
  const r=weeklyTrainingMetrics(s,day);
  assert.equal(r.savedSets.value,1);
  assert.equal(r.loadVolume.value,200);
  assert.equal(r.assignedPlanProgress.value,null);
  assert.equal(r.assignedPlanProgress.status,'no_assigned_plan');
});

test('food-log coverage is 7 calendar days, never a nutrition adherence percentage',()=>{
  const entries=[
    meal('food-0100','2026-10-22',100,20),
    meal('food-0101','2026-10-22',null,null),
    meal('food-0102','2026-10-25',null,null),
    meal('food-0103','2026-10-29',999,30)
  ];
  const d=food(entries),original=structuredClone(d);
  const r=sevenDayFoodCoverage(d,'2026-10-28');
  assert.equal(r.from,'2026-10-22');
  assert.equal(r.value,2);
  assert.equal(r.periodDays,7);
  assert.equal(r.numericDays,1);
  assert.equal(r.daysWithUnknownKcal,2);
  assert.equal(r.nutritionAdherence,null);
  assert.equal(r.completeness,'not_verified');
  assert.deepEqual(d,original);
});

test('no logged days means zero coverage, not zero food intake',()=>{
  const r=sevenDayFoodCoverage(food(),'2026-10-28');
  assert.equal(r.value,0);
  assert.equal(r.numericDays,0);
  assert.ok(r.days.every(d=>d.entries===0));
});

test('read-only implementation does not touch browser storage or enable diet automation',()=>{
  const src=readFileSync(new URL('../preview-v101/metric-selectors.js',import.meta.url),'utf8');
  const registry=readFileSync(new URL('../preview-v101/metric-dictionary.js',import.meta.url),'utf8');
  assert.doesNotMatch(src+registry,/\b(?:localStorage|sessionStorage)\s*\.|\b(?:setItem|removeItem|updateState)\s*\(|activate_automatically\s*:\s*true/);
  assert.match(src,/weeklyTrainingAnalysis\(/);
  assert.match(src,/totalsForDate\(/);
});
