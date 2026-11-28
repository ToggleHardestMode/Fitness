import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../preview-v101/core.js';
import {migrateLegacyWorkout,recoverLegacyWorkout} from '../preview-v101/ledger-model.js';
import {reviewEditorCommand,saveEditorCommand} from '../preview-v101/ledger-editor.js';
import {effectiveMeasurements} from '../preview-v101/ledger-import-evidence.js';
const original=()=>({...emptyState(),templates:[{id:'plan',name:'Synthetic [PT Review]',day:0,requiresClinicalReview:true,
 exercises:[{name:'Press',muscle:'Chest',sets:1,min:8,max:12,rest:90}]}],
 logs:[{id:'original',date:'2026-01-01',templateId:'plan',exerciseIndex:0,set:1,kg:10,reps:8,rpe:null}]});
const entry=(number,extra={})=>({number,completed:true,kg:'12',reps:'8',rpe:'',kind:'working',loadEvidence:'recorded',repsEvidence:'recorded',...extra});
test('independent same-day substitution and extra sets preserve prescription and omit unfinished drafts',async()=>{
 const old=original(),doc=migrateLegacyWorkout(old);
 const d={commandId:'one',mode:'add',name:'Independent',date:'2026-01-01',planId:'plan',plannedIndex:0,newExerciseName:'Different press',
  loadUnit:'kg_total',repUnit:'reps',entries:[entry(1),entry(2),entry(3,{completed:false,kg:'bad'})]};
 const r=await reviewEditorCommand(doc,d),next=r.result.document;
 assert.equal(r.omitted,1);assert.equal(r.result.counts.added,2);assert.equal(next.sessions.length,2);
 assert.equal(next.sessions[1].exercises[0].identity.kind,'catalog');
 assert.equal(next.sessions[1].exercises[0].plannedIndex,0);
 assert.deepEqual(recoverLegacyWorkout(next),old);assert.deepEqual(next.configuration,doc.configuration);
 assert.equal(next.imports[0].name,'editor-one.csv');
});
test('additional saved sets and audited correction do not rewrite originals',async()=>{
 const old=original(),doc=migrateLegacyWorkout(old),s=doc.sessions[0],e=s.exercises[0];
 const base={sessionId:s.id,occurrenceId:e.id};
 const add=await reviewEditorCommand(doc,{...base,commandId:'extra',mode:'add',entries:[entry(2)]});
 const next=add.result.document;
 await assert.rejects(reviewEditorCommand(next,{...base,commandId:'overwrite',mode:'add',entries:[entry(1)]}),/already saved/);
 const draft={...base,commandId:'fix',mode:'correct',reason:'Reviewed measurement',entries:[entry(1,{setId:e.sets[0].id,kg:'11'})]};
 const fixed=await reviewEditorCommand(next,draft);
 assert.equal(effectiveMeasurements(fixed.result.document).get(e.sets[0].id).actualKg,11);
 assert.equal(fixed.result.document.sessions[0].exercises[0].sets[0].measurement.actualKg,10);
 assert.deepEqual(recoverLegacyWorkout(fixed.result.document),old);
 await assert.rejects(reviewEditorCommand(next,{...draft,reason:''}),/reason/);
 await assert.rejects(saveEditorCommand(null,fixed,1),/confirmation/);
});
test('unknown values stay null; no completion or invalid ordinals are refused',async()=>{
 const doc=migrateLegacyWorkout(original()),s=doc.sessions[0],e=s.exercises[0];
 const draft={commandId:'unknown',mode:'add',sessionId:s.id,occurrenceId:e.id,entries:[entry(2,{kg:'',loadEvidence:'unknown'})]};
 const r=await reviewEditorCommand(doc,draft);
 assert.equal(r.result.document.sessions[0].exercises[0].sets[1].measurement.actualKg,null);
 await assert.rejects(reviewEditorCommand(doc,{...draft,entries:[entry(2,{completed:false})]}),/completed/);
 await assert.rejects(reviewEditorCommand(doc,{...draft,entries:[entry(2),entry(2)]}),/unique/);
 await assert.rejects(reviewEditorCommand(doc,{...draft,entries:[entry(2,{loadEvidence:'unknown'})]}),/blank/);
});
