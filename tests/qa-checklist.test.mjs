import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, STATES, summarize, makeReport, extractBannerVersion } from '../preview-v101/qa-checklist.js';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const banner=read('../preview-v101/index.html').match(/FITNESSPILOT V\d+\.\d+\.\d+ PREVIEW/)[0];
const version=extractBannerVersion(banner);

test('eleven roadmap checks O1–O11 exist', () => {
  assert.equal(CHECKS.length,11);
  assert.deepEqual(CHECKS.map(x=>x.id),Array.from({length:11},(_,i)=>'O'+(i+1)));
  assert.match(CHECKS[4].steps,/throw-away/);
  assert.match(CHECKS[7].steps,/throw-away/);
  assert.match(CHECKS[10].steps,/Step 4.3/);
  assert.equal(new Set(CHECKS.map(c=>c.id)).size, CHECKS.length);
  assert.deepEqual(STATES, ['not-run','pass','fail','blocked']);
  for(const c of CHECKS){
    assert.ok(c.title.length>5 && c.steps.length>25 && c.expected.length>25);
  }
});
test('unset, pass, fail and blocked statuses are independently counted', () => {
  assert.deepEqual(summarize({}), {pass:0, fail:0, blocked:0, 'not-run':11});
  const results={O1:{status:'pass'},O2:{status:'fail'},O8:{status:'blocked'}};
  assert.deepEqual(summarize(results), {pass:1, fail:1, blocked:1, 'not-run':8});
});
test('invalid statuses fail closed instead of becoming a pass', () => {
  assert.throws(()=>summarize({O1:{status:'approved'}}),/Invalid QA status/);
});
test('report exports only canonical test cases without raw workout data', () => {
  const results={O1:{status:'pass',note:'Expected banner appears.'},extra:{status:'pass',secret:'not for export'}};
  const at='2026-10-25T05:10:00.000Z';
  const report=makeReport(results,at,version);
  assert.equal(report.schema,'fitnesspilot-qa-v1');
  assert.equal(report.previewVersion,version);
  assert.equal(report.checkedAt,at);
  assert.equal(report.results.length,11);
  assert.equal(report.results[0].status,'pass');
  assert.equal(report.counts.pass,1);
  assert.ok(!JSON.stringify(report).includes('not for export'));
  assert.ok(!JSON.stringify(report).includes('localStorage'));
});
test('long operator note is bounded and never changes status counts', () => {
  const report=makeReport({O1:{status:'blocked',note:'x'.repeat(1000)}},'t',version);
  assert.equal(report.results[0].note.length,400);
  assert.equal(report.counts.blocked,1);
  assert.equal(report.counts['not-run'],9);
});

test('QA reads the current banner and preserves strict CSP',()=>{
  assert.throws(()=>extractBannerVersion('wrong'),/unavailable/);
  assert.throws(()=>makeReport({},'t',''),/not read/);
  const qa=read('../preview-v101/qa.html');
  assert.match(qa,/sandbox="allow-same-origin"/);
  assert.match(qa,/connect-src 'none'/);
  assert.doesNotMatch(qa,/V15\.15\.3/);
  assert.match(read('../preview-v101/app.js'),/href="\.\/qa\.html"/);
  assert.ok(JSON.parse(read('../preview-v101/manifest.webmanifest')).name.includes(version));
  assert.ok(read('../preview-v101/sw.js').includes('fitnesspilot-preview-'+version.toLowerCase().replaceAll('.','')));
});
