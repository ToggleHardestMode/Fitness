import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addSymptomEntry, validateSymptomLogs, symptomGuidance, SYMPTOM_TIMEPOINTS} from '../symptom-journal.js';
const base = () => ({version:1,templates:[{id:'w1',name:'Lower A [PT Review]',day:1,exercises:[{name:'Bridge'}]}],assignments:{},logs:[],metrics:[],reminder:{hour:18,minute:30,lead:0}});
const draft = (changes={}) => ({date:'2026-10-21',timepoint:'before',templateId:'w1',exerciseIndex:null,side:'left',location:'buttock',severity:'3',tingling:true,numbness:false,functionChange:'none',notes:'after walking',...changes});
const withId = id => () => id;

test('A07: all four observation timepoints store separately and back up', () => {
  let s=base();
  for (const [i,k] of Object.keys(SYMPTOM_TIMEPOINTS).entries()) s=addSymptomEntry(s,draft({timepoint:k}),withId('e'+i));
  assert.equal(s.symptomLogs.length,4);
  assert.deepEqual(validateSymptomLogs(JSON.parse(JSON.stringify(s))),undefined);
  assert.equal(s.symptomLogs[2].timepoint,'next_day');
});
test('A09: legacy backup without symptomLogs stays valid and unchanged',()=>{
  const s=base(),before=structuredClone(s);
  assert.equal(validateSymptomLogs(s),undefined);assert.deepEqual(s,before);
  const after=addSymptomEntry(s,draft(),withId('e1'));
  assert.deepEqual(s,before);assert.equal(after.symptomLogs.length,1);assert.equal(after.version,1);
});
test('A07: links to exercise and preserves no symptoms versus no entry',()=>{
  const s=addSymptomEntry(base(),draft({severity:0,side:'none',location:'none',exerciseIndex:0,tingling:false}),withId('e1'));
  assert.deepEqual([s.symptomLogs[0].templateId,s.symptomLogs[0].exerciseIndex,s.symptomLogs[0].severity],['w1',0,0]);
  assert.ok(!Object.hasOwn(base(),'symptomLogs'));
});
test('A09: duplicate scope and ID are stopped, no old data overwritten',()=>{
  const s=addSymptomEntry(base(),draft(),withId('e1'));const before=structuredClone(s);
  assert.throws(()=>addSymptomEntry(s,draft({notes:'changed'}),withId('e2')),/already exists/);
  assert.throws(()=>addSymptomEntry(s,draft({timepoint:'after'}),withId('e1')),/duplicate or invalid symptom IDs/);
  assert.deepEqual(s,before);
});
test('A09: strict invalid fields and dangling exercise links are rejected',()=>{
  for(const update of [{severity:''},{severity:' '},{severity:11},{severity:2.5},{timepoint:'random'},{side:''},{location:''},{functionChange:''},{templateId:'missing'},{exerciseIndex:99},{tingling:'yes'},{notes:'x'.repeat(501)},{date:'2026-02-30'}]){
    assert.throws(()=>addSymptomEntry(base(),draft(update),withId('bad')),undefined,JSON.stringify(update).slice(0,55));
  }
});
test('A13: worsening weakness or walking changes triggers caution, not clearance',()=>{
  const s=addSymptomEntry(base(),draft({functionChange:'new_weakness'}),withId('e1'));
  assert.match(symptomGuidance(s.symptomLogs[0]),/prompt medical assessment/);
  assert.match(symptomGuidance({...s.symptomLogs[0],severity:0,functionChange:'none'}),/does not establish medical clearance/);
  assert.match(symptomGuidance({...s.symptomLogs[0],timepoint:'next_day',severity:7,functionChange:'none'},s.symptomLogs[0]),/Symptoms increased/);
});
test('A09: invalid restored symptom data does not get silently repaired',()=>{
  const s=addSymptomEntry(base(),draft(),withId('e1'));
  for(const mutation of [x=>x.symptomLogs[0].severity=NaN,x=>x.symptomLogs[0].id='',x=>x.symptomLogs[0].templateId='deleted',x=>x.symptomLogs.push({...x.symptomLogs[0],id:'different'})]){
    const bad=structuredClone(s);mutation(bad);assert.throws(()=>validateSymptomLogs(bad));
  }
  assert.equal(s.symptomLogs.length,1);
});
test('A08: standalone module has no network or telemetry functions',()=>{
  const source=readFileSync(new URL('../symptom-journal.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/);
  assert.equal(Object.keys(base()).includes('symptomLogs'),false);
});