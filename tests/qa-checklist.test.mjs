import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHECKS, STATES, summarize, makeReport, PREVIEW_VERSION } from '../preview-v101/qa-checklist.js';

test('ten unique bounded iPhone acceptance checks exist', () => {
  assert.equal(CHECKS.length, 10);
  assert.equal(new Set(CHECKS.map(c=>c.id)).size, CHECKS.length);
  assert.deepEqual(STATES, ['not-run','pass','fail','blocked']);
  for(const c of CHECKS){
    assert.ok(c.title.length>5 && c.steps.length>25 && c.expected.length>25);
  }
});
test('unset, pass, fail and blocked statuses are independently counted', () => {
  assert.deepEqual(summarize({}), {pass:0, fail:0, blocked:0, 'not-run':10});
  const results={version:{status:'pass'},plan:{status:'fail'},restore:{status:'blocked'}};
  assert.deepEqual(summarize(results), {pass:1, fail:1, blocked:1, 'not-run':7});
});
test('invalid statuses fail closed instead of becoming a pass', () => {
  assert.throws(()=>summarize({version:{status:'approved'}}),/Invalid QA status/);
});
test('report exports only canonical test cases without raw workout data', () => {
  const results={version:{status:'pass',note:'Expected banner appears.'},extra:{status:'pass',secret:'not for export'}};
  const at='2026-10-25T05:10:00.000Z';
  const report=makeReport(results,at);
  assert.equal(report.schema,'fitnesspilot-qa-v1');
  assert.equal(report.previewVersion,'V15.26.7');
  assert.equal(report.checkedAt,at);
  assert.equal(report.results.length,10);
  assert.equal(report.results[0].status,'pass');
  assert.equal(report.counts.pass,1);
  assert.ok(!JSON.stringify(report).includes('not for export'));
  assert.ok(!JSON.stringify(report).includes('localStorage'));
});
test('long operator note is bounded and never changes status counts', () => {
  const report=makeReport({version:{status:'blocked',note:'x'.repeat(1000)}},'t');
  assert.equal(report.results[0].note.length,400);
  assert.equal(report.counts.blocked,1);
  assert.equal(report.counts['not-run'],9);
});

test('current iPhone acceptance includes timer obstruction and defers offline migration', () => {
  const ids = CHECKS.map(c => c.id);
  assert.ok(ids.includes('timer'));
  assert.ok(!ids.includes('offline'));
  assert.match(CHECKS.find(c => c.id === 'timer').steps, /Train.*Tools/i);
  assert.match(CHECKS.find(c => c.id === 'timer').expected, /B098.*deferred/i);
  assert.match(CHECKS.find(c => c.id === 'restore').steps, /disposable/i);
});

test('QA labels and links match the current preview version and cache namespace', () => {
  const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const index = read('../preview-v101/index.html');
  const qa = read('../preview-v101/qa.html');
  const app = read('../preview-v101/app.js');
  const serviceWorker = read('../preview-v101/sw.js');
  const manifest = JSON.parse(read('../preview-v101/manifest.webmanifest'));
  const match = index.match(/FITNESSPILOT (V\d+\.\d+\.\d+) PREVIEW/);
  assert.ok(match, 'Main preview banner is missing a version.');
  assert.equal(PREVIEW_VERSION, match[1]);
  const tag = PREVIEW_VERSION.replace(/\D/g, '');
  assert.ok(qa.includes('FITNESSPILOT · ' + PREVIEW_VERSION + ' PREVIEW'));
  assert.ok(qa.includes('./?v=' + tag));
  assert.ok(app.includes('./qa.html?v=' + tag));
  assert.ok(serviceWorker.includes('fitnesspilot-preview-v' + tag + '-'));
  assert.ok(manifest.name.includes(PREVIEW_VERSION));
});
