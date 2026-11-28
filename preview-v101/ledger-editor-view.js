import {openIndexedLedgerFixture,readIndexedFixture} from './ledger-indexed-prototype.js';
import {effectiveMeasurements} from './ledger-import-evidence.js';
import {reviewEditorCommand,saveEditorCommand} from './ledger-editor.js';
import {requiresPtReview,activeClearance} from './exercise-clearance.js';
const $=id=>document.getElementById(id);
const el=(tag,t)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;return n;};
const options=(n,items,value)=>{n.replaceChildren();for(const [v,t] of items){const o=el('option',t);o.value=v;n.append(o);}if(value!==undefined)n.value=value;};
const units=['unknown','kg_per_dumbbell','kg_total','kg_stack','bodyweight'],reps=['unknown','reps','reps_per_side','seconds','seconds_per_side'];
let db,snapshot,review,busy=false;
const status=t=>{$('status').textContent=t;};
const session=()=>snapshot.document.sessions.find(s=>s.id===$('session').value);
const plan=()=>snapshot.document.configuration.templates.find(t=>t.id===(session()?.planId??(session()?null:$('plan').value)));
const occurrence=()=>session()?.exercises.find(e=>e.id===$('occurrence').value);
const actualName=i=>i.kind==='plan'?snapshot.document.configuration.templates.find(t=>t.id===i.templateId)?.exercises[i.exerciseIndex]?.name:
  snapshot.document.catalog.find(e=>e.id===i.exerciseId)?.name;
const selectedSet=()=>occurrence()?.sets.find(s=>s.id===$('saved-set').value);
function controls(){
  $('editor').disabled=busy||!snapshot;$('reload').disabled=busy;
  $('confirm').disabled=!review;$('save').disabled=!review||!$('confirm').checked;
}
function invalidate(){review=null;$('confirm').checked=false;$('summary').replaceChildren();controls();}
async function run(fn){if(busy)return;busy=true;controls();status('');try{await fn();}catch(e){invalidate();status(e.message??String(e));}finally{busy=false;controls();}}
function field(card,label,kind,value){
  const l=el('label',label),n=el(kind==='select'?'select':'input');n.setAttribute('aria-label',label);
  if(kind==='select')options(n,value);else{n.type=kind;n.value=value??'';}
  l.append(n);card.append(l);return n;
}
function addRow(number,old=null){
  const card=el('article');card.dataset.set=String(number);
  card.append(el('h3','Set '+number));
  const m=old?effectiveMeasurements(snapshot.document).get(old.id):null;
  const ordinal=field(card,'Set number','number',number);ordinal.min='1';ordinal.max='1000';ordinal.readOnly=!!old;
  const kg=field(card,'Actual kg','number',m?.actualKg??'');kg.min='0';kg.max='500';kg.step='any';
  const load=field(card,'Load evidence','select',[['','Choose'],['recorded','Recorded'],['confirmed','Confirmed'],['unknown','Unknown']]);
  const count=field(card,'Actual repetitions or seconds','number',m?.actualReps??'');count.min='1';count.max='1000';
  const evidence=field(card,'Repetition evidence','select',[['','Choose'],['recorded','Recorded'],['confirmed','Confirmed'],['unknown','Unknown']]);
  if(old){load.value=m.actualKg===null?'unknown':'confirmed';evidence.value=m.actualReps===null?'unknown':'confirmed';}
  const rpe=field(card,'RPE (optional)','number',m?.rpe??'');rpe.min='1';rpe.max='10';rpe.step='any';
  const kind=field(card,'Set kind','select',[['working','Working'],['warmup','Warm-up']]);kind.value=old?.kind??'working';kind.disabled=!!old;
  const notes=field(card,'Notes (optional)','text','');notes.maxLength=250;
  const label=el('label');label.className='check';const done=el('input');done.type='checkbox';label.append(done,el('span','Confirm performed set'));card.append(label);
  const remove=el('button','Remove draft set');remove.type='button';remove.hidden=!!old;remove.onclick=()=>{card.remove();invalidate();};card.append(remove);
  card.readEntry=()=>({number:Number(ordinal.value),kg:kg.value,reps:count.value,rpe:rpe.value,notes:notes.value,kind:kind.value,
    loadEvidence:load.value,repsEvidence:evidence.value,completed:done.checked,setId:old?.id});
  $('sets').append(card);
}
function rows(){return [...$('sets').children].map(n=>n.readEntry());}
function nextNumber(){return Math.max(0,...(occurrence()?.sets.map(s=>s.number)??[]),...rows().map(r=>r.number))+1;}
function resetRows(){
  $('sets').replaceChildren();$('reason').value='';const correcting=$('mode').value==='correct';
  $('correction').hidden=!correcting;$('add-set').hidden=correcting;
  options($('saved-set'),(occurrence()?.sets??[]).map(s=>[s.id,'Set '+s.number+' · '+s.kind]));
  if(correcting)showCorrection();else addRow(nextNumber());
}
function showCorrection(){const old=selectedSet();$('sets').replaceChildren();$('before').textContent=old?
  'Accepted before: '+JSON.stringify(effectiveMeasurements(snapshot.document).get(old.id)):'Choose a saved set.';
  if(old)addRow(old.number,old);}
function context(){
  const e=occurrence(),p=plan(),slot=e?.plannedIndex??($('slot').value===''?null:Number($('slot').value));
  let ref=e?.identity;
  if(!ref&&$('movement').value&&$('movement').value!=='new')ref=JSON.parse($('movement').value);
  const t=ref?.kind==='plan'?snapshot.document.configuration.templates.find(t=>t.id===ref.templateId):null;
  const ex=t?.exercises[ref?.exerciseIndex],prescribed=p?.exercises[slot];
  const protectedSlot=requiresPtReview(p,prescribed),protectedActual=requiresPtReview(t,ex);
  const date=session()?.date??$('date').value;
  const cleared=protectedActual&&date&&activeClearance(snapshot.document.configuration,t.id,ref.exerciseIndex,date);
  $('context').textContent=(prescribed?'Prescribed: '+prescribed.name+' · '+prescribed.sets+' sets. ':'')+
    (e?'Saved basis: '+e.loadUnit+' / '+e.repUnit+'. ':'')+
    (protectedSlot||protectedActual?'[PT Review] · '+(cleared?'Actual plan identity has recorded clearance. ':'No clearance inferred. '):'')+
    'Recording is retrospective only; no advice or clearance transfers to substitutions.';
}
function refreshOccurrence(){
  const e=occurrence();$('new-occurrence').hidden=!!e;
  if(!e)$('mode').value='add';$('mode').disabled=!e;resetRows();context();invalidate();
}
function refreshTargets(){
  const s=session(),p=plan();$('new-session').hidden=!!s;
  options($('occurrence'),[['','New performed occurrence'],...(s?.exercises??[]).map(e=>[e.id,actualName(e.identity)+' / '+e.id])]);
  options($('slot'),[['','No prescribed slot'],...(p?.exercises??[]).map((e,i)=>[String(i),e.name+' · '+e.sets+' prescribed'])]);
  const movements=snapshot.document.configuration.templates.flatMap(t=>t.exercises.map((e,i)=>
    [JSON.stringify({kind:'plan',templateId:t.id,exerciseIndex:i}),t.name+' / '+e.name]));
  options($('movement'),[['','Choose actual movement'],...movements,...snapshot.document.catalog.map(e=>
    [JSON.stringify({kind:'catalog',exerciseId:e.id}),e.name+' / '+e.id]),['new','New catalog movement']]);
  refreshOccurrence();
}
function populate(preferred=''){
  $('revision').textContent='Fixture revision '+snapshot.revision;
  options($('session'),[['','New independent session'],...snapshot.document.sessions.map(s=>[s.id,s.date+' / '+s.name+' / '+s.id])],preferred);
  options($('plan'),[['','Independent / no plan'],...snapshot.document.configuration.templates.map(t=>[t.id,t.name])]);
  options($('load-unit'),[['','Choose'],...units.map(x=>[x,x])]);options($('rep-unit'),[['','Choose'],...reps.map(x=>[x,x])]);
  $('date').value='2026-01-01';$('name').value='';$('new-name').value='';refreshTargets();
}
$('editor').addEventListener('input',invalidate);$('editor').addEventListener('change',invalidate);
$('session').onchange=refreshTargets;$('plan').onchange=refreshTargets;$('occurrence').onchange=refreshOccurrence;
$('slot').onchange=context;$('movement').onchange=context;$('date').onchange=context;
$('mode').onchange=()=>{resetRows();invalidate();};$('saved-set').onchange=()=>{showCorrection();invalidate();};
$('add-set').onclick=()=>{if(rows().length>=100){status('Maximum 100 draft sets.');return;}addRow(nextNumber());invalidate();};
$('reload').onclick=()=>run(async()=>{
  invalidate();snapshot=null;db?.close();db=await openIndexedLedgerFixture('fitnesspilot-preview-ledger-indexed-fixture-review-ui');
  snapshot=await readIndexedFixture(db);
  if(!snapshot)throw Error('Initialize synthetic records in ledger-import-review.html first.');
  populate();status('Loaded fixture.');
});
$('review').onclick=()=>run(async()=>{
  invalidate();const move=$('movement').value;
  const d={commandId:crypto.randomUUID(),mode:$('mode').value,sessionId:$('session').value,occurrenceId:$('occurrence').value,
    date:$('date').value,name:$('name').value,planId:$('plan').value,plannedIndex:$('slot').value===''?null:Number($('slot').value),
    identity:move&&move!=='new'?JSON.parse(move):null,newExerciseName:move==='new'?$('new-name').value:null,
    loadUnit:$('load-unit').value,repUnit:$('rep-unit').value,reason:$('reason').value,entries:rows()};
  if(!occurrence()&&move==='new'&&!d.newExerciseName.trim())throw Error('Enter a new movement name.');
  const result=await reviewEditorCommand(snapshot.document,d);
  review={...result,revision:snapshot.revision};
  const counts=result.result.counts;$('summary').append(el('p','Add '+counts.added+' · Correct '+counts.corrected+' · Unchecked '+result.omitted));
  const source=result.result.document.imports.at(-1);
  for(const e of source.rows){const p=el('p',e.action+' · '+e.setId+' · '+JSON.stringify(e.after)+(e.before?' · Before '+JSON.stringify(e.before)+' · '+e.reason:''));$('summary').append(p);}
});
$('confirm').onchange=controls;
// Confirmation is not a draft edit. Stop its bubbling invalidation.
$('confirm').addEventListener('input',e=>e.stopPropagation());
$('confirm').addEventListener('change',e=>e.stopPropagation());
$('save').onclick=()=>run(async()=>{
  if(!review||!$('confirm').checked)throw Error('Review and confirm first.');
  const approved=review;invalidate();const result=await saveEditorCommand(db,approved,approved.revision,{confirmed:true});
  snapshot=await readIndexedFixture(db);populate(approved.sessionId);status('Committed revision '+result.revision+'.');
});
