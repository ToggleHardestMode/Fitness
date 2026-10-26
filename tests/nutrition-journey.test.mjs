import test from 'node:test';
import assert from 'node:assert/strict';
import {readTargets,weekComparison,weightJourney,renderJourney,initJourney} from '../preview-v101/nutrition-journey.js';

const ref={
  schema_version:1,reference_revision:'1.1',status:'reference_only_not_activated_in_fitnesspilot',
  daily_flat:{calories_kcal:{value:2100},protein_g:{value:120}},
  calorie_cycling:{days:{weekday:{target_kcal_rounded:2000,protein_g:120},weekend:{target_kcal_rounded:2400,protein_g:120}}},
  adjustment_rules_R0_to_R6:{activate_automatically:false}
};
test('v1.1 read-only reference accepts valid values and rejects activation',()=>{
  const t=readTargets(ref);
  assert.equal(t.flat.calories,2100);
  assert.equal(t.weekend.calories,2400);
  assert.throws(()=>readTargets({...ref,adjustment_rules_R0_to_R6:{activate_automatically:true}}),/disabled/);
  assert.throws(()=>readTargets({...ref,status:'activated'}),/unchanged/);
});
test('calendar cycles weekend budgets and keeps unknown days null',()=>{
  const t=readTargets(ref);
  const records=[{date:'2026-10-26',calories:0,protein:160},{date:'2026-11-01',calories:2800}];
  const flat=weekComparison(records,'2026-10-28',t);
  assert.equal(flat.days[0].calories,0);
  assert.equal(flat.days[1].calories,null);
  assert.equal(flat.calories.count,2);
  assert.equal(flat.protein.count,1);
  const cycle=weekComparison(records,'2026-10-28',t,'cycle');
  assert.equal(cycle.days[0].targetCalories,2000);
  assert.equal(cycle.days[6].targetCalories,2400);
});
test('weight trend compares actual recorded weeks without filling missing dates',()=>{
  const records=[{date:'2026-10-16',weight:90},{date:'2026-10-17',weight:88},
    {date:'2026-10-24',weight:87},{date:'2026-10-26',weight:86}];
  const trend=weightJourney(records,'2026-10-26');
  assert.equal(trend.previous.value,89);
  assert.equal(trend.current.value,86.5);
  assert.equal(trend.change,-2.5);
  assert.equal(trend.points.find(p=>p.date==='2026-10-25').weight,null);
  assert.equal(weightJourney([{date:'2026-10-26',weight:86}],'2026-10-26').change,null);
});
test('rendered dashboard identifies missing values and unavailable macro fields',()=>{
  const html=renderJourney([{date:'2026-10-26',calories:0,weight:90}],'2026-10-26',readTargets(ref),'cycle');
  assert.match(html,/Not recorded/);
  assert.match(html,/0 kcal/);
  assert.match(html,/Carbohydrates, fat, fibre/);
});
test('unreadable current storage remains unmodified',()=>{
  let writes=0;
  const els={'journey-results':{textContent:''},'journey-status':{textContent:''},
    'nutrition-reference':{disabled:false},'nutrition-mode':{value:'flat'}};
  initJourney({getElementById:id=>els[id]},{getItem:()=>'{broken',setItem:()=>writes++});
  assert.equal(writes,0);
  assert.match(els['journey-results'].textContent,/could not be read/);
});
