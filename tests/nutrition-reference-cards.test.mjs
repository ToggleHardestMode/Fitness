import test from 'node:test';
import assert from 'node:assert/strict';
import { targetsText, referenceCardMarkup } from '../preview-v101/nutrition-reference-cards.js';
import { readTargets, renderJourney } from '../preview-v101/nutrition-journey.js';
import { readFileSync } from 'node:fs';
const publicSample=JSON.parse(readFileSync(new URL('../preview-v101/nutrition_targets.json', import.meta.url),'utf8'));
const t=readTargets(publicSample);
test('public JSON target parses and stays non-automatic',()=>{
  assert.equal(publicSample.adjustment_rules_R0_to_R6.activate_automatically,false);
  assert.equal(t.flat.calories,2250); assert.equal(t.weekday.calories,2050); assert.equal(t.weekend.calories,2750);
});
test('target cards appear with zero recorded calories',()=>{
  assert.match(renderJourney([], '2026-10-26', t, 'flat'),/2,250 kcal/);
  assert.match(renderJourney([], '2026-10-26', t, 'flat'),/No recorded nutrition check-ins/);
});
test('cycling mode displays both day types',()=>{
  const output=referenceCardMarkup(t,'cycle');
  assert.match(output,/2,050 kcal/); assert.match(output,/2,750 kcal/);
});
test('missing data, real zero and positive deviation are distinct',()=>{
  assert.match(targetsText(null,2250,'kcal'),/Not recorded · reference 2,250 kcal/);
  assert.match(targetsText(0,2250,'kcal'),/0 kcal/);
  assert.match(targetsText(2300,2250,'kcal'),/\+50 kcal/);
});
test('invalid target values and unknown mode rejected',()=>{
  assert.throws(()=>referenceCardMarkup({flat:{calories:NaN,protein:0}},'flat'),/Invalid nutrition/);
  assert.throws(()=>referenceCardMarkup(t,'unknown'),/Unknown nutrition/);
});
