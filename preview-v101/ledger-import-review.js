// Standalone fixture review UI. Never imported by the live application.
import {emptyState} from './core.js';
import {migrateLegacyWorkout} from './ledger-model.js';
import {splitCsv} from './completed-workout-csv.js';
import {previewLedgerImport,ledgerSourceId} from './ledger-import.js';
import {effectiveMeasurements} from './ledger-import-evidence.js';
import {openIndexedLedgerFixture,initializeIndexedFixture,readIndexedFixture,applyLedgerImportFixture} from './ledger-indexed-prototype.js';
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fixture=()=>({...emptyState(),templates:[{id:'fixture-plan',name:'Synthetic Upper',day:0,
  requiresClinicalReview:true,exercises:[{name:'Synthetic Press',muscle:'Chest',sets:1,min:8,max:12,rest:90}]}],
  logs:[{id:'fixture-original',date:'2026-01-01',templateId:'fixture-plan',exerciseIndex:0,set:1,kg:10,reps:8,rpe:null}],
  exerciseClearances:[]});
const demo=()=>[{name:'fixture-extra.csv',text:'date,workout,exercise,set,kg,reps,notes\n2026-01-01,Synthetic Upper,Synthetic Press,2,12,8,Extra set\n'},
  {name:'fixture-correction.csv',text:'date,workout,exercise,set,kg,reps,notes\n2026-01-01,Synthetic Upper,Synthetic Press,1,11,8,Reviewed value\n'}];
const key=(id,row)=>JSON.stringify([id,row]);
let db,snapshot,files=[],rows=new Map(),choices=new Map(),reviewed=null,busy=false;
const status=t=>{$('status').textContent=t;};
function controls(){
  $('controls').disabled=busy;
  $('preview').disabled=!files.length;
  $('confirm').disabled=!reviewed||reviewed.result.unresolved.length>0||!reviewed.result.changed;
  $('apply').disabled=$('confirm').disabled||!$('confirm').checked;
}
function invalidate(){reviewed=null;$('confirm').checked=false;$('audit').replaceChildren();controls();}
async function run(fn){
  if(busy)return;
  busy=true;controls();status('');
  try{await fn();}catch(e){invalidate();status(e.message??String(e));}
  finally{busy=false;controls();}
}
async function setFiles(next){
  invalidate();files=[];rows.clear();choices.clear();$('exceptions').replaceChildren();
  $('summary').textContent='No review yet.';
  if(next.length>20)throw Error('Choose at most 20 files.');
  let bytes=0,count=0;
  for(const f of next){
    bytes+=new TextEncoder().encode(f.text).length;
    if(bytes>5_000_000)throw Error('Batch exceeds 5 MB.');
    const data=splitCsv(f.text),id=await ledgerSourceId(f.text);
    count+=data.length;if(count>2000)throw Error('Batch exceeds 2,000 rows.');
    data.forEach((row,i)=>rows.set(key(id,i+2),{row,file:f.name}));
  }
  files=next;
  $('sources').textContent=files.length?files.length+' file(s) · '+count+' source rows: '+files.map(f=>f.name).join(', '):'No files selected.';
  if(files.length)await preview();
}
function select(label,options,parent,value){
  const labelNode=el('label',label),input=el('select');
  for(const [v,t] of options){const opt=el('option',t);opt.value=v;input.append(opt);}
  if(value!==undefined)input.value=value;
  labelNode.append(input);parent.append(labelNode);return input;
}
function input(label,parent,value=''){
  const l=el('label',label),n=el('input');n.value=value;l.append(n);parent.append(l);return n;
}
const evidence=[['','Choose evidence'],...['recorded','confirmed','unknown','planned','assumed'].map(x=>[x,x])];
const loadUnits=['unknown','kg_per_dumbbell','kg_total','kg_stack','bodyweight'];
const repUnits=['unknown','reps','reps_per_side','seconds','seconds_per_side'];
const options=items=>[['','Choose'],...items.map(x=>[x,x])];
function exception(problem){
  const k=key(problem.sourceId,problem.row),source=rows.get(k),row=source.row,prior=choices.get(k);
  const card=el('article');card.dataset.row=String(problem.row);card.dataset.source=source.file;
  card.append(el('h3',row.date+' · '+row.exercise+' · set '+row.set),
    el('p',source.file+' · record '+problem.row+' · '+row.workout+' · kg: '+(row.kg||'blank')+' · reps: '+(row.reps||'blank')),
    el('p',problem.reason));
  if(row.notes)card.append(el('p','Source notes: '+row.notes));
  const action=select('Decision',[['','Choose'],['match','Use existing occurrence'],['new','Create new occurrence'],['skip','Skip with reason']],card,prior?.uiAction);
  const reason=input('Reason (required for correction or skip)',card,prior?.reason??'');
  const evidenceFields=el('div');evidenceFields.className='grid';card.append(evidenceFields);
  const load=select('Load evidence',evidence,evidenceFields,prior?.loadEvidence??row.load_evidence??'');
  const reps=select('Repetition evidence',evidence,evidenceFields,prior?.repsEvidence??row.reps_evidence??'');
  const completion=el('label');completion.className='check';const completed=el('input');completed.type='checkbox';
  completed.checked=prior?.completed===true||row.completed==='true';completion.append(completed,document.createTextNode(' Confirm this set was completed'));evidenceFields.append(completion);
  const kind=select('Set kind',[['','Choose'],['working','Working'],['warmup','Warm-up']],evidenceFields,prior?.kind??row.kind??'');
  const existing=el('div'),newFields=el('div');card.append(existing,newFields);
  const targets=snapshot.document.sessions.filter(s=>s.date===row.date).flatMap(s=>s.exercises.map(e=>({s,e})));
  const movement=e=>e.identity.kind==='catalog'?snapshot.document.catalog.find(x=>x.id===e.identity.exerciseId)?.name:
    snapshot.document.configuration.templates.find(x=>x.id===e.identity.templateId)?.exercises[e.identity.exerciseIndex]?.name;
  const target=select('Existing performed occurrence',[['','Choose'],...targets.map(({s,e},i)=>[String(i),s.name+' / '+movement(e)+' / '+e.id])],existing);
  const priorTarget=targets.findIndex(({s,e})=>s.id===prior?.sessionId&&e.id===prior?.occurrenceId);
  if(priorTarget>=0)target.value=String(priorTarget);
  const current=el('p');existing.append(current);
  const correct=el('label');correct.className='check';const correction=el('input');correction.type='checkbox';
  correction.checked=prior?.action==='correct';correct.append(correction,document.createTextNode(' Authorize correction if observation differs'));existing.append(correct);
  function showTarget(){
    const t=target.value===''?null:targets[Number(target.value)],set=t?.e.sets.find(s=>s.number===Number(row.set));
    const accepted=set?effectiveMeasurements(snapshot.document).get(set.id):null;
    current.textContent=t?(set?'Saved observation: '+JSON.stringify(accepted)+' · '+set.kind:'No set at this ordinal; add an extra set.')+' · '+t.e.loadUnit+' / '+t.e.repUnit:'Choose the actual saved occurrence.';
  }
  target.addEventListener('change',showTarget);showTarget();
  const sessions=snapshot.document.sessions.filter(s=>s.date===row.date);
  const session=select('Session',[['','Choose'],...sessions.map(s=>[s.id,s.name+' / '+s.id]),['new','New independent session']],newFields,prior?.uiSession);
  const sessionKey=input('New session key (reuse explicitly for rows in the same session)',newFields,prior?.uiSessionKey??'');
  const occurrenceKey=input('New occurrence key (reuse explicitly for sets of the same movement)',newFields,prior?.uiOccurrenceKey??'');
  const identities=snapshot.document.catalog.map(e=>[e.id,e.name+' / '+e.id]);
  const identity=select('Actual movement',[['','Choose'],...identities,['new','New catalog movement']],newFields,prior?.uiIdentity);
  const name=input('New movement name',newFields,prior?.uiName??'');
  const lu=select('Load basis',options(loadUnits),newFields,prior?.loadUnit??'');
  const ru=select('Repetition basis',options(repUnits),newFields,prior?.repUnit??'');
  const visibility=()=>{
    existing.hidden=action.value!=='match';newFields.hidden=action.value!=='new';
    evidenceFields.hidden=!action.value||action.value==='skip';
    sessionKey.parentElement.hidden=session.value!=='new';name.parentElement.hidden=identity.value!=='new';
  };
  for(const n of [action,session,identity])n.addEventListener('change',visibility);visibility();
  const save=el('button','Save row decision');save.type='button';card.append(save);
  save.addEventListener('click',()=>run(async()=>{
    const d={sourceId:problem.sourceId,row:problem.row,uiAction:action.value,reason:reason.value.trim()};
    if(action.value==='skip'){if(!d.reason)throw Error('Enter a skip reason.');d.action='skip';}
    else{
      if(!action.value||!completed.checked||!load.value||!reps.value||!kind.value)throw Error('Choose action, completion, evidence and set kind.');
      Object.assign(d,{completed:true,loadEvidence:load.value,repsEvidence:reps.value,kind:kind.value});
      if(action.value==='match'){
        if(target.value==='')throw Error('Choose an existing occurrence.');
        const {s,e}=targets[Number(target.value)],set=e.sets.find(x=>x.number===Number(row.set));
        Object.assign(d,{sessionId:s.id,occurrenceId:e.id,setId:set?.id??JSON.stringify(['review-set',e.id,Number(row.set)])});
        if(correction.checked){if(!set||!d.reason)throw Error('Choose an existing set and enter a correction reason.');d.action='correct';}
      }else{
        const sk=sessionKey.value.trim(),ok=occurrenceKey.value.trim(),nm=name.value.trim();
        if(!session.value||!ok||!identity.value||!lu.value||!ru.value||session.value==='new'&&!sk||identity.value==='new'&&!nm)
          throw Error('Choose the session, occurrence key, actual movement and units.');
        const sid=session.value==='new'?JSON.stringify(['review-session',row.date,sk]):session.value;
        const oid=JSON.stringify(['review-occurrence',sid,ok]);
        const eid=identity.value==='new'?JSON.stringify(['review-movement',oid]):identity.value;
        if(session.value==='new'&&snapshot.document.sessions.some(s=>s.id===sid))throw Error('Session key exists; select the saved session.');
        if(identity.value==='new'&&snapshot.document.catalog.some(e=>e.id===eid))throw Error('Movement key exists; select the saved movement.');
        Object.assign(d,{sessionId:sid,occurrenceId:oid,setId:JSON.stringify(['review-set',oid,Number(row.set)]),
          identity:{kind:'catalog',exerciseId:eid},newSession:session.value==='new',loadUnit:lu.value,repUnit:ru.value,
          uiSession:session.value,uiSessionKey:sk,uiOccurrenceKey:ok,uiIdentity:identity.value,uiName:nm});
        if(identity.value==='new')d.newExercise={id:eid,name:nm,muscle:null};
      }
    }
    choices.set(k,d);invalidate();await preview();
  }));
  return card;
}
// Only the first ordered row introducing a new catalog ID supplies its definition.
function orderedChoices(){
  const introduced=new Map(),result=[];
  for(const k of rows.keys()){
    if(!choices.has(k))continue;
    const d=structuredClone(choices.get(k));
    if(d.newExercise){
      const old=introduced.get(d.newExercise.id);
      if(old&&JSON.stringify(old)!==JSON.stringify(d.newExercise))throw Error('Conflicting new movement definitions.');
      if(old)delete d.newExercise;else introduced.set(d.newExercise.id,d.newExercise);
    }
    result.push(d);
  }
  return result;
}
async function preview(){
  invalidate();const decisions=orderedChoices();
  const result=await previewLedgerImport(snapshot.document,files,decisions);
  const c=result.counts;
  $('summary').textContent='Add '+c.added+' · Duplicate '+c.duplicates+' · Correct '+c.corrected+' · Skip '+c.skipped+' · Unresolved '+c.unresolved;
  $('exceptions').replaceChildren(...result.unresolved.map(exception));
  // Resolved manual decisions stay inspectable and can be undone before apply.
  for(const [k,d] of choices){
    if(result.unresolved.some(p=>key(p.sourceId,p.row)===k))continue;
    const row=rows.get(k);const line=el('div');line.className='audit';
    line.append(el('p',row.file+' · record '+d.row+' · reviewed'));
    const undo=el('button','Undo decision');undo.type='button';
    undo.addEventListener('click',()=>run(async()=>{choices.delete(k);await preview();}));line.append(undo);$('exceptions').append(line);
  }
  if(!result.unresolved.length){
    const prior=new Set((snapshot.document.imports??[]).map(s=>s.id));
    for(const s of result.document.imports??[]){
      if(prior.has(s.id))continue;
      const block=el('details');block.open=true;block.append(el('summary',s.name));
      const parsed=splitCsv(s.text);
      for(const e of s.rows){
        const row=parsed[e.row-2],line=el('div');line.className='audit';
        line.append(el('p',e.action.toUpperCase()+' · '+row.date+' · '+row.exercise+' · set '+row.set));
        if(e.before)line.append(el('p','Before: '+JSON.stringify(e.before)));
        if(e.after)line.append(el('p','Accepted: '+JSON.stringify(e.after)));
        if(e.identity)line.append(el('p','Target: '+e.sessionId+' / '+e.occurrenceId+' / '+JSON.stringify(e.identity)+' · '+e.loadUnit+' / '+e.repUnit));
        if(e.reason)line.append(el('p','Reason: '+e.reason));block.append(line);
      }
      $('audit').append(block);
    }
    if(!result.changed)$('audit').append(el('p','All source files already reconciled. Nothing to write.'));
    reviewed={result,decisions,files:structuredClone(files),revision:snapshot.revision};
  }
  controls();
}
function revision(){$('revision').textContent='Fixture revision '+snapshot.revision+' · '+snapshot.document.sessions.length+' sessions · '+(snapshot.document.imports??[]).length+' sources';}
$('demo').addEventListener('click',()=>run(()=>setFiles(demo())));
$('files').addEventListener('change',()=>run(async()=>{
  const selected=[...$('files').files];
  if(selected.length>20||selected.reduce((n,f)=>n+f.size,0)>5_000_000)throw Error('Choose up to 20 files and 5 MB.');
  await setFiles(await Promise.all(selected.map(async f=>({name:f.name,text:await f.text()}))));
}));
$('preview').addEventListener('click',()=>run(preview));
$('confirm').addEventListener('change',controls);
$('apply').addEventListener('click',()=>run(async()=>{
  if(!reviewed||!$('confirm').checked||reviewed.result.unresolved.length)throw Error('Review and confirm first.');
  const batch=reviewed;invalidate();
  const result=await applyLedgerImportFixture(db,batch.files,batch.decisions,batch.revision,{confirmed:true});
  snapshot=await readIndexedFixture(db);revision();choices.clear();await preview();
  status('Committed revision '+result.revision+'. Added '+result.counts.added+', corrected '+result.counts.corrected+'.');
}));
run(async()=>{
  db=await openIndexedLedgerFixture('fitnesspilot-preview-ledger-indexed-fixture-review-ui');
  snapshot=await readIndexedFixture(db);
  if(!snapshot){await initializeIndexedFixture(db,{document:migrateLegacyWorkout(fixture()),food:{version:1,entries:[]}});snapshot=await readIndexedFixture(db);}
  revision();
});
