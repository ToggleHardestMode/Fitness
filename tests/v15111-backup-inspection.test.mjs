import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../preview-v101/core.js';
import { inspectBackupFileText } from '../preview-v101/recovery-check.js';
import { readFileSync } from 'node:fs';

test('valid empty exported backup is inspected without restoring',()=>{
  const data=emptyState();
  assert.deepEqual(inspectBackupFileText(JSON.stringify(data)),{
    templates:0,sets:0,checkins:0,symptoms:0,assignments:0
  });
});
test('bad JSON and incompatible backups fail',()=>{
  assert.throws(()=>inspectBackupFileText('{bad'),/not valid JSON/);
  assert.throws(()=>inspectBackupFileText('{}'),/compatible FitnessPilot backup/);
});
test('inspector never changes the input object',()=>{
  const data=emptyState(), before=JSON.stringify(data);
  inspectBackupFileText(before);
  assert.equal(JSON.stringify(data),before);
});
test('file check handler never invokes restore or commit',()=>{
  const source=readFileSync(new URL('../preview-v101/app.js',import.meta.url),'utf8');
  const start=source.indexOf("if(target.id==='backup-check-file')");
  const end=source.indexOf("\n});",start);
  assert.ok(start>0&&end>start);
  const block=source.slice(start,end);
  assert.match(block,/inspectBackupFileText\(await file\.text\(\)\)/);
  assert.doesNotMatch(block,/\bcommit\(|\blocalStorage\.|pendingBackup\s*=/);
});
