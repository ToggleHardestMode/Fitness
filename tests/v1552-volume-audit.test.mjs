import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weeklyTrainingAnalysis } from '../preview-v101/training-analytics.js';
import { volumeBarsMarkup } from '../preview-v101/volume-bars.js';

const week = '2026-10-19';
const saved = (date, exerciseIndex, set, kg, reps, extras={}) =>
  ({date, templateId:'upper', exerciseIndex, set, kg, reps, ...extras});
const state = () => ({
  templates:[{id:'upper',name:'Upper',day:0,exercises:[
    {name:'Incline Dumbbell Press',muscle:'Chest',sets:3,min:8,max:12,rest:120},
    {name:'Dumbbell Row',muscle:'Back',sets:3,min:8,max:12,rest:120},
    {name:'Modified Side Plank',muscle:'Core',sets:1,min:20,max:30,repUnit:'seconds_per_side',rest:60}
  ]}],
  assignments:{}, metrics:[],
  logs:[
    saved('2026-10-21',0,1,11,12),
    saved('2026-10-21',0,2,11,11),
    saved('2026-10-21',0,3,33,11),
    saved('2026-10-22',1,1,15,10),
    saved('2026-10-22',1,2,15,10),
    saved('2026-10-22',1,3,17,5)
  ]
});

test('six logged sets yield 1,001 kg × reps, not 1,001 repetitions', () => {
  const data=state(), before=JSON.stringify(data);
  const report=weeklyTrainingAnalysis(data,week);
  assert.equal(report.completed,6);
  assert.equal(report.loadVolume,1001);
  assert.deepEqual(report.volumeEntries.map(e=>e.contribution),[132,121,363,150,150,85]);
  assert.equal(report.volumeEntries.reduce((n,e)=>n+e.contribution,0),report.loadVolume);
  assert.equal(report.days[2].loadVolume,616);
  assert.equal(report.days[3].loadVolume,385);
  assert.equal(JSON.stringify(data),before);
});

test('duplicate saved sets do not create extra volume or breakdown rows', () => {
  const data=state();data.logs.push({...data.logs[0],id:'duplicate'});
  const report=weeklyTrainingAnalysis(data,week);
  assert.equal(report.loadVolume,1001);
  assert.equal(report.volumeEntries.length,6);
  assert.equal(report.completed,6);
});

test('timed holds count as sets but not lifting volume', () => {
  const data=state();
  data.logs.push(saved('2026-10-22',2,1,0,30));
  const report=weeklyTrainingAnalysis(data,week);
  assert.equal(report.completed,7);
  assert.equal(report.loadVolume,1001);
  assert.equal(report.volumeEntries.length,6);
  assert.equal(report.timedHolds.length,1);
});

test('zero volume baseline is separate from positive visible columns', () => {
  const report=weeklyTrainingAnalysis(state(),week);
  const html=volumeBarsMarkup(report.days);
  assert.equal((html.match(/class="bar"/g)||[]).length,2);
  assert.equal((html.match(/class="bar-zero"/g)||[]).length,5);
  assert.match(html,/Wed: 616 kg·reps/);
  assert.match(html,/Thu: 385 kg·reps/);
  assert.match(html,/height:111px/);
});

test('preview CSS displays actual volume bars as block elements', () => {
  const css=readFileSync(new URL('../preview-v101/codex.css',import.meta.url),'utf8');
  assert.match(css,/\.day-slot\s+\.bar\s*\{\s*display:\s*block\s*;/);
  const app=readFileSync(new URL('../preview-v101/app.js',import.meta.url),'utf8');
  assert.match(app,/volumeEntries\.map\(entry\s*=>/);
  assert.match(app,/Weight × reps total/);
});
