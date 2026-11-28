// Fixture editor uses the existing audited import command and transaction, not a second write path.
import {validateLedger} from './ledger-model.js';
import {dateFromKey} from './core.js';
import {ledgerSourceId,previewLedgerImport} from './ledger-import.js';
import {applyLedgerImportFixture} from './ledger-indexed-prototype.js';
const fail=m=>{throw Error(m);};
const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const text=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max;
const id=(command,kind,n='')=>'editor:'+command+':'+kind+':'+n;
export async function reviewEditorCommand(input,draft){
  const doc=validateLedger(input),d=structuredClone(draft);
  if(!d||!/^[-a-zA-Z0-9]{1,80}$/.test(d.commandId??'')||!['add','correct'].includes(d.mode))
    fail('Invalid editor command.');
  if(!Array.isArray(d.entries)||!d.entries.length||d.entries.length>100)fail('Choose 1–100 draft sets.');
  const entries=d.entries.filter(e=>e.completed===true);
  if(!entries.length)fail('Confirm at least one completed set.');
  const correcting=d.mode==='correct';
  if(correcting&&(entries.length!==1||d.entries.length!==1||!text(d.reason,1000)))fail('Correct one set with an explicit reason.');
  let session=d.sessionId?doc.sessions.find(s=>s.id===d.sessionId):null;
  if(d.sessionId&&!session)fail('Saved session not found.');
  if(!session){
    if(correcting||!text(d.name,120))fail('Choose a new session name.');
    dateFromKey(d.date);
    session={id:id(d.commandId,'session'),date:d.date,name:d.name.trim(),planId:d.planId||null,exercises:[]};
    if(doc.sessions.some(s=>s.id===session.id))fail('Session already exists; reload and review.');
  }
  const plan=doc.configuration.templates.find(t=>t.id===session.planId);
  if(session.planId&&!plan)fail('Unknown session plan.');
  let occurrence=d.occurrenceId?session.exercises.find(e=>e.id===d.occurrenceId):null;
  if(d.occurrenceId&&!occurrence)fail('Saved occurrence not found.');
  let newExercise;
  if(!occurrence){
    if(correcting)fail('Choose a saved occurrence for correction.');
    const identity=d.newExerciseName?{kind:'catalog',exerciseId:id(d.commandId,'movement')}:d.identity;
    if(!identity)fail('Choose the actual movement explicitly.');
    if(d.newExerciseName){
      if(!text(d.newExerciseName,80))fail('New movement name must be 1–80 characters.');
      newExercise={id:identity.exerciseId,name:d.newExerciseName.trim(),muscle:null};
    }
    occurrence={id:id(d.commandId,'occurrence'),identity,plannedIndex:d.plannedIndex??null,
      loadUnit:d.loadUnit,repUnit:d.repUnit,sets:[]};
  }
  const ref=occurrence.identity,actual=ref.kind==='plan'?
    doc.configuration.templates.find(t=>t.id===ref.templateId)?.exercises[ref.exerciseIndex]:
    newExercise??doc.catalog.find(e=>e.id===ref.exerciseId);
  if(!actual)fail('Actual movement not found.');
  if(occurrence.plannedIndex!==null&&!plan?.exercises[occurrence.plannedIndex])fail('Unknown prescribed slot.');
  const header=['date','workout','exercise','set','kg','reps','rpe','notes','completed','kind','load_evidence','reps_evidence',
    'editor_command','editor_session','editor_occurrence','editor_set','editor_reason'];
  const lines=[header.join(',')],decisions=[],numbers=new Set();
  for(const e of entries){
    if(!Number.isInteger(e.number)||e.number<1||e.number>1000||numbers.has(e.number))fail('Choose unique set ordinals from 1–1000.');
    numbers.add(e.number);
    const old=occurrence.sets.find(s=>s.number===e.number);
    if(correcting?!old||old.id!==e.setId:!!old)fail(correcting?'Correction target does not match saved set.':'Set already saved; use correction or another ordinal.');
    if(!['recorded','confirmed','unknown'].includes(e.loadEvidence)||!['recorded','confirmed','unknown'].includes(e.repsEvidence))
      fail('Select actual measurement evidence.');
    if(e.loadEvidence==='unknown'&&String(e.kg??'').trim()!==''||e.repsEvidence==='unknown'&&String(e.reps??'').trim()!=='')
      fail('Unknown measurements must be blank.');
    const kind=old?.kind??e.kind;
    if(!['working','warmup'].includes(kind)||String(e.notes??'').length>250)fail('Invalid set kind or notes.');
    const setId=old?.id??id(d.commandId,'set',e.number);
    lines.push([session.date,session.name,actual.name,e.number,e.kg,e.reps,e.rpe,e.notes,'true',kind,e.loadEvidence,e.repsEvidence,
      d.commandId,session.id,occurrence.id,setId,correcting?d.reason:''].map(cell).join(','));
    decisions.push({row:lines.length,sessionId:session.id,occurrenceId:occurrence.id,setId,
      identity:ref,planId:session.planId,plannedIndex:occurrence.plannedIndex,newSession:!d.sessionId,
      loadUnit:occurrence.loadUnit,repUnit:occurrence.repUnit,completed:true,kind,loadEvidence:e.loadEvidence,repsEvidence:e.repsEvidence,
      ...(correcting?{action:'correct',reason:d.reason.trim()}:{}),...(newExercise&&!decisions.length?{newExercise}:{})});
  }
  const file={name:'editor-'+d.commandId+'.csv',text:lines.join('\n')},sourceId=await ledgerSourceId(file.text);
  for(const choice of decisions)choice.sourceId=sourceId;
  const result=await previewLedgerImport(doc,[file],decisions);
  if(result.unresolved.length)fail(result.unresolved.map(x=>'Record '+x.row+': '+x.reason).join('; '));
  if(correcting&&result.counts.corrected!==1)fail('No measurement change to correct.');
  return {files:[file],decisions,result,sessionId:session.id,occurrenceId:occurrence.id,omitted:d.entries.length-entries.length};
}
export async function saveEditorCommand(db,review,revision,{confirmed=false,abortAfterPut=false}={}){
  if(confirmed!==true)fail('Explicit editor confirmation required.');
  return applyLedgerImportFixture(db,review.files,review.decisions,revision,{confirmed:true,abortAfterPut});
}
