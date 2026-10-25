import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, STATES, summarize, makeReport } from '../preview-v101/qa-checklist.js';

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
  assert.equal(report.previewVersion,'V15.11.4');
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
