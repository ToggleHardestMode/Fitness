import test from 'node:test';
import assert from 'node:assert/strict';
import { WALKER_KEY, MAX_WALKER_BYTES, validateWalkerFile, validateWalkerDataUrl, dashboardWalkerBanner } from '../preview-v101/dashboard-walker.js';

test('private avatar has its own bounded storage key, distinct from workout data', () => {
  assert.match(WALKER_KEY,/ui\.walker/);
  assert.equal(MAX_WALKER_BYTES,600_000);
  assert.ok(!WALKER_KEY.includes('.web.v1'));
});

test('only bounded WebP uploads are allowed',()=>{
  const good={name:'walk.webp',type:'image/webp',size:70_000};
  assert.equal(validateWalkerFile(good),good);
  for(const f of [{...good,name:'walk.svg'},{...good,type:'image/svg+xml'},{...good,size:0},{...good,size:700_000},null])
    assert.throws(()=>validateWalkerFile(f),/animated \.webp/);
});

test('validate and embed a safe local WebP data URL without markup injection',()=>{
  const safe='data:image/webp;base64,UklGRgAA';
  assert.equal(validateWalkerDataUrl(safe),safe);
  const html=dashboardWalkerBanner(safe);
  assert.match(html,/fp-walker-platform/);
  assert.match(html,/fp-walker-stage/);
  assert.match(html,/fp-walker-sprite/);
  assert.match(html,/Walking in place/);
  assert.match(html,/UklGRgAA/);
  for (const evil of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','data:image/webp;base64,UklGR" onerror="evil', 'data:image/webp;base64,notWebp'])
    assert.throws(()=>dashboardWalkerBanner(evil),/Invalid local walking/);
});

test('no imported avatar uses existing public generic illustration instead',()=>{
  const html=dashboardWalkerBanner();
  assert.match(html,/\.\/adventurer-idle\.svg/);
  assert.match(html,/open Tools and import the WebP/);
});
