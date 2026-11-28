import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../preview-v101/core.js';
import {migrateLegacyWorkout,recoverLegacyWorkout} from '../preview-v101/ledger-model.js';
import {previewLedgerImport,ledgerSourceId} from '../preview-v101/ledger-import.js';
import {ledgerAnalytics,identityKey} from '../preview-v101/ledger-analytics.js';
const plan={id:'plan',name:'Synthetic plan [PT Review]',day:0,requiresClinicalReview:true,
  exercises:[{name:'Press',muscle:'Chest',sets:1,min:8,max:12,rest:90}]};
const original=()=>({...emptyState(),templates:[plan],assignments:{0:'plan'},
  logs:[{id:'old',date:'2026-01-05',templateId:'plan',exerciseIndex:0,set:1,kg:10,reps:8,rpe:null}]});
function session(id,date,loadUnit='kg_total',repUnit='reps',kg=20,kind='working',movement='press'){
  return {id,date,name:'Synthetic',planId:null,origin:'actual',exercises:[{id:'occ-'+id,
    identity:{kind:'catalog',exerciseId:movement},plannedIndex:null,loadUnit,repUnit,sets:[{id:'set-'+id,
      number:1,completed:true,kind,measurement:{actualKg:kg,actualReps:8,rpe:7,
        loadEvidence:kg===null?'unknown':'recorded',repsEvidence:'recorded'}}]}]};
}
test('completed counts, independent sessions, unknown measurements, timed and incompatible volume bases',()=>{
  const doc=migrateLegacyWorkout(original());
  doc.catalog.push({id:'press',name:'Press',muscle:'Chest'});
  doc.sessions.push(session('a','2026-01-05'),session('b','2026-01-05','kg_per_dumbbell','reps_per_side',10),
    session('c','2026-01-06','kg_total','seconds',2),session('d','2026-01-06','kg_total','reps',null),
    session('e','2026-01-06','kg_total','reps',99,'warmup'));
  const a=ledgerAnalytics(doc,'2026-01-05');
  assert.equal(a.lifetime,5);assert.equal(a.current.completed,5);assert.equal(a.current.sessions,5);
  assert.equal(a.current.matched,1);assert.equal(a.current.offPlan,4);
  assert.equal(a.current.unknownMeasurements,1);
  assert.deepEqual(a.current.volume.map(x=>x.value),[160,80]);assert.deepEqual(a.current.timed,[{unit:'seconds',value:8}]);
  assert.equal(a.logbook.length,6);assert.equal(a.journey(identityKey({kind:'catalog',exerciseId:'press'})).length,4);
  assert.equal(a.journey(identityKey({kind:'plan',templateId:'plan',exerciseIndex:0})).length,1);
  assert.equal(a.insights.length,0);
});
test('correction and extra set visible, original recoverable, plan fulfilment is bounded',async()=>{
  const old=original(),doc=migrateLegacyWorkout(old),s=doc.sessions[0],e=s.exercises[0];
  const f={name:'synthetic.csv',text:'date,workout,exercise,set,kg,reps\n2026-01-05,Synthetic,Press,1,11,8\n2026-01-05,Synthetic,Press,2,12,8\n'};
  const sourceId=await ledgerSourceId(f.text),base={sourceId,sessionId:s.id,occurrenceId:e.id,completed:true,loadEvidence:'recorded',repsEvidence:'recorded'};
  const result=await previewLedgerImport(doc,[f],[{...base,row:2,setId:e.sets[0].id,action:'correct',reason:'Fixture review'},
    {...base,row:3,setId:'extra'}]);
  const a=ledgerAnalytics(result.document,'2026-01-05');
  assert.equal(a.lifetime,2);assert.equal(a.current.matched,1);assert.equal(a.current.days[0].extraOrSubstituted,1);
  assert.equal(a.logbook[0].sets[0].original.actualKg,10);assert.equal(a.logbook[0].sets[0].accepted.actualKg,11);
  assert.equal(a.current.volume.length,0);assert.deepEqual(recoverLegacyWorkout(result.document),old);
  assert.deepEqual(result.document.configuration,doc.configuration);
});
test('approved plan links display only, same-name catalog remains independent',()=>{
  const old=original();old.templates=[plan,{...plan,id:'next',name:'New plan'}];
  old.exerciseEquivalences=[{id:'link',from:{templateId:'plan',exerciseIndex:0},to:{templateId:'next',exerciseIndex:0},approvedDate:'2026-01-06'}];
  old.logs.push({...old.logs[0],id:'next-log',date:'2026-01-06',templateId:'next'});
  const doc=migrateLegacyWorkout(old),a=ledgerAnalytics(doc,'2026-01-05');
  const journey=a.journey(identityKey({kind:'plan',templateId:'next',exerciseIndex:0}));
  assert.equal(journey.length,2);assert.equal(journey.filter(x=>x.linked).length,1);
  assert.equal(a.lifetime,2);assert.equal(a.insights.length,0);
});
test('controlled comparison requires same explicit identity, basis, reps and RPE and no ambiguous latest day',async()=>{
  const doc=migrateLegacyWorkout(original());doc.catalog.push({id:'press',name:'Press',muscle:'Chest'});
  const header='date,workout,exercise,set,kg,reps,rpe,technique,session_id,occurrence_id,set_id,exercise_id,completed,load_basis,rep_basis,load_evidence,reps_evidence';
  const row=(date,id,kg,basis='kg_total')=>[date,'Synthetic','Press',1,kg,8,7,'controlled',id,'occ-'+id,'set-'+id,'press','true',basis,'reps','recorded','recorded'].join(',');
  const f={name:'controlled.csv',text:[header,row('2026-01-01','prior',10),row('2026-01-05','now',12)].join('\n')};
  const result=await previewLedgerImport(doc,[f]);const a=ledgerAnalytics(result.document,'2026-01-05');
  assert.equal(a.insights.length,1);assert.equal(a.insights[0].change,2);
  const other={name:'ambiguous.csv',text:[header,row('2026-01-05','other',13)].join('\n')};
  const next=await previewLedgerImport(result.document,[other]);
  assert.equal(ledgerAnalytics(next.document,'2026-01-05').insights.length,0);
});

test('approved linked history remains visible before first set in new plan',()=>{
  const old=original();old.templates=[plan,{...plan,id:'next',name:'New plan'}];
  old.exerciseEquivalences=[{id:'link',from:{templateId:'plan',exerciseIndex:0},to:{templateId:'next',exerciseIndex:0},approvedDate:'2026-01-06'}];
  const doc=migrateLegacyWorkout(old),a=ledgerAnalytics(doc,'2026-01-05');
  const key=identityKey({kind:'plan',templateId:'next',exerciseIndex:0});
  assert.ok(a.movements.some(x=>x.key===key));
  assert.equal(a.journey(key).length,1);assert.equal(a.journey(key)[0].linked,true);
  assert.equal(a.lifetime,1);
});
