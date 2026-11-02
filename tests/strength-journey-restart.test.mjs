import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateBackup} from '../preview-v101/core.js';
import {setJourneyStart,verifiedSessions,nextSessionTarget} from '../preview-v101/strength-journey.js';
import {previewDeviceMerge} from '../preview-v101/device-merge.js';
const make=()=>{const s=emptyState();s.templates=[{id:'t',name:'Upper A',day:0,
 exercises:[{name:'DB Bench',muscle:'Chest',sets:1,min:8,max:12,rest:90}]}];return s;};
const log=(date,kg=10)=>({id:date,date,templateId:'t',exerciseIndex:0,set:1,kg,reps:12,rpe:7});
test('Explicit Day 1 is a saved date, earlier history remains intact',()=>{
 const s=make();s.logs=[log('2025-05-10'),log('2026-10-31')];
 const next=setJourneyStart(s,{templateId:'t',exerciseIndex:0,startDate:'2026-10-31'});
 assert.equal(next.strengthJourneyStarts['t|0'],'2026-10-31');
 assert.equal(verifiedSessions(next,'t',0).length,2);
 assert.equal(nextSessionTarget(next,{templateId:'t',exerciseIndex:0,nextDate:'2026-11-07'}).sourceDate,'2026-10-31');
 assert.deepEqual(validateBackup(next),next);
});
test('Unrecorded restart dates cannot become Day 1',()=>{
 const s=make();s.logs=[log('2026-10-31')];
 assert.throws(()=>setJourneyStart(s,{templateId:'t',exerciseIndex:0,startDate:'2026-10-30'}),/genuinely completed/);
});
test('Different Day 1 choices across devices block merging',()=>{
 const a=make(),b=make();a.logs=b.logs=[log('2025-05-10'),log('2026-10-31')];
 a.strengthJourneyStarts={'t|0':'2025-05-10'};
 b.strengthJourneyStarts={'t|0':'2026-10-31'};
 const out=previewDeviceMerge(a,b);
 assert.equal(out.merged,null);
 assert.ok(out.conflicts.some(c=>c.collection==='strengthJourneyStarts'));
});
test('Legacy backups without strength fields remain valid',()=>{
 const s=make();delete s.strengthFeedback;delete s.strengthJourneyStarts;
 assert.deepEqual(validateBackup(s),s);
});
test('Quads and hamstring movements are excluded even if template has no PT label',()=>{
 const s=make();s.templates[0].exercises[0].name='Leg Extension';
 s.templates[0].exercises[0].muscle='Quads';s.logs=[log('2026-10-31')];
 assert.match(nextSessionTarget(s,{templateId:'t',exerciseIndex:0,nextDate:'2026-11-07'}).reason,/lower-body/);
});
