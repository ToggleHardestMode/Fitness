// Pure canonical workout ledger. No browser reads, writes, or live activation.
import {validateBackup,dateFromKey} from './core.js';
import {validateImportHistory} from './ledger-import-evidence.js';
const fail = message => { throw Error(message); };
const tuple = (...parts) => JSON.stringify(parts);
const legacySession = row => tuple('legacy-session',row.date,row.templateId);
const legacyOccurrence = row => tuple('legacy-exercise',row.date,row.templateId,Number(row.exerciseIndex));
const legacySet = row => tuple('legacy-set',row.date,row.templateId,Number(row.exerciseIndex),Number(row.set));
const plain = v => v && typeof v==='object' && !Array.isArray(v) && Object.getPrototypeOf(v)===Object.prototype;
const list = (v,max) => Array.isArray(v) && v.length<=max;
const text = (v,max=1000) => typeof v==='string' && v.trim() && v.length<=max;
const integer = (v,min,max) => Number.isSafeInteger(v) && v>=min && v<=max;
const known = (v,min,max,whole=false) => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max && (!whole||Number.isInteger(v));
const number = (v,min,max,whole=false) => {
  if(typeof v!=='number' && (typeof v!=='string'||!v.trim()))return null;
  return known(Number(v),min,max,whole)?Number(v):null;
};
const unique = (seen,id,label) => {if(!text(id)||seen.has(id))fail('Invalid or duplicate '+label+'.');seen.add(id);};
const same = (a,b) => canonicalJSON(a)===canonicalJSON(b);
function canonicalJSON(v){
  if(Array.isArray(v))return '['+v.map(canonicalJSON).join(',')+']';
  if(plain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
const loadUnits=['unknown','kg_per_dumbbell','kg_total','kg_stack','bodyweight'];
const repUnits=['unknown','reps','reps_per_side','seconds','seconds_per_side'];
function legacyMeasurement(row){
  const actualKg=number(row.kg,0,500),actualReps=number(row.reps,1,100,true);
  return {actualKg,actualReps,rpe:number(row.rpe,1,10),
    loadEvidence:actualKg===null?'unknown':'legacy_recorded',
    repsEvidence:actualReps===null?'unknown':'legacy_recorded'};
}
function measure(value,legacy=false){
  if(!plain(value))fail('Measurement is missing.');
  for(const [field,status,lo,hi,whole] of [
    ['actualKg','loadEvidence',0,500,false],['actualReps','repsEvidence',1,1000,true]]){
    const v=value[field],allowed=v===null?['unknown','planned','assumed']:legacy?['legacy_recorded']:['recorded','confirmed'];
    if((v!==null&&!known(v,lo,hi,whole))||!allowed.includes(value[status]))
      fail('Invalid actual measurement or evidence: '+field+'.');
  }
  if(value.rpe!==null&&!known(value.rpe,1,10))fail('Invalid RPE.');
}

// Each original row lives once, alongside its normalized measurement, with its original ID and order.
export function migrateLegacyWorkout(input){
  const old=validateBackup(input),{version,logs,...configuration}=old;
  const plans=new Map(old.templates.map(t=>[t.id,t])),sessions=new Map(),occurrences=new Map();
  logs.forEach((row,order)=>{
    const sid=legacySession(row),oid=legacyOccurrence(row),index=Number(row.exerciseIndex);
    if(!sessions.has(sid))sessions.set(sid,{id:sid,date:row.date,name:plans.get(row.templateId).name,
      planId:row.templateId,origin:'legacy',exercises:[]});
    if(!occurrences.has(oid)){
      const e={id:oid,identity:{kind:'plan',templateId:row.templateId,exerciseIndex:index},
        plannedIndex:index,loadUnit:'unknown',repUnit:plans.get(row.templateId).exercises[index].repUnit||'unknown',sets:[]};
      occurrences.set(oid,e);sessions.get(sid).exercises.push(e);
    }
    occurrences.get(oid).sets.push({id:legacySet(row),number:Number(row.set),completed:true,
      kind:row.isWarmup===true||row.kind==='warmup'?'warmup':'working',
      measurement:legacyMeasurement(row),legacy:{order,record:row}});
  });
  return validateLedger({version:2,configuration,catalog:[],sessions:[...sessions.values()]});
}
function collectLegacy(doc){
  const originals=[];
  for(const s of doc.sessions)for(const e of s.exercises)for(const set of e.sets)
    if(set.legacy)originals.push(set.legacy);
  originals.sort((a,b)=>a.order-b.order);
  if(originals.some((row,i)=>row.order!==i))fail('Missing or duplicate legacy record order.');
  return validateBackup({version:1,...doc.configuration,logs:originals.map(x=>x.record)});
}
function planExercise(plans,ref){
  const p=plans.get(ref.templateId);
  if(!p||!integer(ref.exerciseIndex,0,p.exercises.length-1))fail('Unknown plan exercise.');
  return p.exercises[ref.exerciseIndex];
}
export function validateLedger(doc){
  if(!plain(doc)||doc.version!==2||!plain(doc.configuration)||
     Object.hasOwn(doc.configuration,'version')||Object.hasOwn(doc.configuration,'logs')||
     !list(doc.catalog,2000)||!list(doc.sessions,50000))fail('Invalid ledger document.');
  const cfg=validateBackup({version:1,...doc.configuration,logs:[]});
  const plans=new Map(cfg.templates.map(t=>[t.id,t])),catalog=new Set(),sessions=new Set(),occurrences=new Set(),sets=new Set();
  for(const e of doc.catalog){
    if(!plain(e)||!text(e.name,80)||(e.muscle!==null&&!text(e.muscle,40)))fail('Invalid catalog exercise.');
    unique(catalog,e.id,'catalog identity');
  }
  let count=0;
  for(const s of doc.sessions){
    if(!plain(s)||!text(s.name,120)||!['legacy','actual'].includes(s.origin)||!list(s.exercises,200)||!s.exercises.length||
      (s.planId!==null&&!plans.has(s.planId)))fail('Invalid session.');
    unique(sessions,s.id,'session identity');dateFromKey(s.date);
    for(const e of s.exercises){
      if(!plain(e)||!plain(e.identity)||!loadUnits.includes(e.loadUnit)||!repUnits.includes(e.repUnit)||
        !list(e.sets,1000)||!e.sets.length)fail('Invalid performed exercise.');
      unique(occurrences,e.id,'occurrence identity');
      if(e.identity.kind==='plan')planExercise(plans,e.identity);
      else if(e.identity.kind!=='catalog'||!catalog.has(e.identity.exerciseId))fail('Unknown actual exercise.');
      if(e.plannedIndex!==null)planExercise(plans,{templateId:s.planId,exerciseIndex:e.plannedIndex});
      const ordinals=new Set();
      for(const set of e.sets){
        if(++count>100000||!plain(set)||set.completed!==true||!['working','warmup'].includes(set.kind)||
          !integer(set.number,1,1000)||ordinals.has(set.number))fail('Invalid or duplicate completed set number.');
        ordinals.add(set.number);unique(sets,set.id,'set identity');
        const isLegacy=Object.hasOwn(set,'legacy');
        measure(set.measurement,isLegacy);
        if(isLegacy){
          const raw=set.legacy?.record;
          if(!plain(raw)||!integer(set.legacy.order,0,99999)||s.origin!=='legacy'||
            s.id!==legacySession(raw)||s.date!==raw.date||s.planId!==raw.templateId||
            e.id!==legacyOccurrence(raw)||e.identity.kind!=='plan'||e.identity.templateId!==raw.templateId||
            e.identity.exerciseIndex!==Number(raw.exerciseIndex)||e.plannedIndex!==Number(raw.exerciseIndex)||
            e.loadUnit!=='unknown'||e.repUnit!==(planExercise(plans,e.identity).repUnit||'unknown')||
            set.id!==legacySet(raw)||set.number!==Number(raw.set)||
            set.kind!==(raw.isWarmup===true||raw.kind==='warmup'?'warmup':'working')||
            !same(set.measurement,legacyMeasurement(raw)))fail('Legacy observation differs from its original record.');
        }else if(s.origin!=='actual'&&!doc.imports)fail('Legacy additions require audited import provenance.');
      }
    }
  }
  collectLegacy(doc);
  validateImportHistory(doc);
  return structuredClone(doc);
}
export function recoverLegacyWorkout(doc){return collectLegacy(validateLedger(doc));}
export function legacyHasDiverged(doc,current){
  return !same(recoverLegacyWorkout(doc),validateBackup(current));
}

// Prototype permits only additive independent sessions/catalog entries. Corrections and plan edits
// need separate reviewed commands in a later phase; no silent removal or replacement.
export function validateAppend(previous,next){
  const before=validateLedger(previous),after=validateLedger(next);
  if(!same(before.imports??[],after.imports??[]))fail('Import history requires a reviewed import command.');
  if(!same(before.configuration,after.configuration)||!same(collectLegacy(before),collectLegacy(after)))
    fail('Original configuration or legacy history changed.');
  for(const field of ['catalog','sessions']){
    const byId=new Map(after[field].map(item=>[item.id,item]));
    if(before[field].some(item=>!same(item,byId.get(item.id))))fail('Existing '+field+' cannot be changed or removed in this prototype.');
  }
  return after;
}
export function encodeLedgerBackup(doc){
  return JSON.stringify({format:'fitnesspilot-ledger-prototype-v1',document:validateLedger(doc)});
}
export function decodeLedgerBackup(raw){
  let doc;try{doc=JSON.parse(raw);}catch{fail('Backup is not valid JSON.');}
  if(doc?.version===1)return migrateLegacyWorkout(doc);
  if(doc?.format!=='fitnesspilot-ledger-prototype-v1')fail('Unknown ledger backup format.');
  return validateLedger(doc.document);
}
