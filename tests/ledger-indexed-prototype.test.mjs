import test from 'node:test';
import assert from 'node:assert/strict';
import {openIndexedLedgerFixture} from '../preview-v101/ledger-indexed-prototype.js';
test('indexed experiment refuses live and snapshot database names without opening them',async()=>{
  for(const name of ['fitnesspilot.preview.v101.v1','fitnesspilot-preview-ledger-fixture-main','']){
    await assert.rejects(openIndexedLedgerFixture(name,{open:()=>assert.fail('Must not open')}),/Disposable/);
  }
  await assert.rejects(openIndexedLedgerFixture('fitnesspilot-preview-ledger-indexed-fixture-main',null),/unavailable/);
});
