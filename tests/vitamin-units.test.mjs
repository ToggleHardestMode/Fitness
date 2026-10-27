import test from 'node:test';
import assert from 'node:assert/strict';
import {VITAMIN_REFERENCES,referencesFor,convertVitaminUnits} from '../preview-v101/vitamin-units.js';

test('all thirteen vitamins covered, no duplicate labels and correct jurisdictions',()=>{
 assert.equal(VITAMIN_REFERENCES.length,13);
 assert.equal(new Set(VITAMIN_REFERENCES.map(v=>v.id)).size,13);
 const sg=referencesFor('sg'),intl=referencesFor('international');
 assert.equal(sg.find(v=>v.id==='D').amount,'2.5 µg (100 IU)');
 assert.equal(intl.find(v=>v.id==='D').amount,'15 µg (600 IU)');
 assert.equal(sg.find(v=>v.id==='A').amount,'750 µg RE');
 assert.equal(intl.find(v=>v.id==='A').amount,'900 µg RAE');
 assert.match(sg.find(v=>v.id==='B7').provenance,/fallback/);
 assert.match(sg.find(v=>v.id==='B9').note,/not/i);
 assert.throws(()=>referencesFor('bogus'),/reference/);
});
test('mass conversion and Vitamin D IU are reciprocal',()=>{
 assert.equal(convertVitaminUnits(1,'mg-to-mcg').amount,1000);
 assert.equal(convertVitaminUnits(1000,'mcg-to-mg').amount,1);
 assert.equal(convertVitaminUnits(15,'d-mcg-to-iu').amount,600);
 assert.equal(convertVitaminUnits(600,'d-iu-to-mcg').amount,15);
});
test('vitamin A source and E formulation alter equivalent activity',()=>{
 assert.equal(convertVitaminUnits(100,'a-retinol-iu-to-rae').amount,30);
 assert.equal(convertVitaminUnits(100,'a-food-beta-iu-to-rae').amount,5);
 assert.equal(convertVitaminUnits(100,'e-natural-iu-to-mg').amount,67);
 assert.equal(convertVitaminUnits(100,'e-synthetic-iu-to-mg').amount,45);
});
test('folate bioavailability explicitly depends on form/food context',()=>{
 assert.equal(convertVitaminUnits(240,'folic-acid-with-food-to-dfe').amount,400);
 assert.equal(convertVitaminUnits(400,'food-folate-to-dfe').amount,400);
});
test('negative, nonfinite, overlarge amounts and ambiguous conversions blocked',()=>{
 for(const n of [-1,NaN,Infinity,1000001,'600'])assert.throws(()=>convertVitaminUnits(n,'d-mcg-to-iu'),/amount/);
 assert.throws(()=>convertVitaminUnits(600,'a-iu-to-re'),/Unknown or unsafe/);
});
test('rendered data does not mutate canonical reference records',()=>{
 const a=referencesFor('sg');a[0].name='Modified';
 assert.equal(referencesFor('sg')[0].name,'Vitamin A');
});
