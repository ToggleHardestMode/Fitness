// Phase 1: pure versioned session contract. No live v2 reader/writer or automatic migration.
import { dateFromKey, validateBackup } from './core.js';

export const SESSION_DOCUMENT_VERSION = 2;
export function assertLegacyDocument(value) {
  if (value?.version !== 1) throw Error('Unsupported workout document version. This preview cannot write it; keep your records intact.');
}
const fail = message => { throw Error(message); };
const obj = (v,label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype)
    fail(label + ' must be an object.');
};
const str = (v,label,max=140) => {
  if (typeof v !== 'string' || !v.trim() || v.length>max) fail(label + ' is invalid.');
};
const arr = (v,label,max,min=0) => {
  if (!Array.isArray(v) || v.length<min || v.length>max) fail(label + ' has invalid length.');
};
const range = (v,label,min,max,integer=false) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v<min || v>max || (integer&&!Number.isInteger(v)))
    fail(label + ' is invalid.');
};
const nullable = (v,label,min,max,integer=false) => { if(v!==null)range(v,label,min,max,integer); };
const unique = (seen,key,label) => { if(seen.has(key))fail('Duplicate '+label+'.');seen.add(key); };
const key = (...parts) => JSON.stringify(parts);
const loadUnits = ['kg_per_dumbbell','kg_total','kg_stack','bodyweight','unknown'];
const repUnits = ['reps','seconds_per_side'];
const planExercise = (plans,ref) => {
  obj(ref,'Plan exercise identity');
  const plan=plans.get(ref.templateId);
  if (!plan)fail('Missing referenced plan.');
  range(ref.exerciseIndex,'Plan exercise index',0,plan.exercises.length-1,true);
  return plan.exercises[ref.exerciseIndex];
};
// A number is eligible as an actual measurement only if the owner/source recorded
// or explicitly confirmed it. A planned/assumed number stays in source evidence.
function evidence(value,status,label) {
  const allowed=value===null?['unknown','planned','assumed']:['recorded','confirmed'];
  if(!allowed.includes(status))fail(label+' does not agree with the actual measurement.');
}
function observation(o,sourceIds,revision) {
  obj(o,'Observation');
  nullable(o.actualKg,'Actual kg',0,500);
  nullable(o.actualReps,'Actual reps or seconds',1,100,true);
  nullable(o.rpe,'Actual RPE',1,10);
  evidence(o.actualKg,o.loadEvidence,'Load evidence');
  evidence(o.actualReps,o.repsEvidence,'Repetition evidence');
  if(o.technique!==undefined&&!['controlled','unstable'].includes(o.technique))fail('Invalid observed technique.');
  if(o.difficulty!==undefined&&!['too_easy','on_target','too_hard'].includes(o.difficulty))fail('Invalid observed difficulty.');
  if(o.notes!==undefined && (typeof o.notes!=='string'||o.notes.length>4000))fail('Invalid observation notes.');
  if(revision)str(o.correctionReason,'Correction reason',500);
  else if(o.correctionReason!==undefined)fail('Initial observation cannot be a correction.');
  obj(o.source,'Observation source');
  if(o.source.kind==='csv'){
    str(o.source.id,'CSV source identity',256);unique(sourceIds,o.source.id,'CSV source identity');
    str(o.source.file,'CSV filename',255);range(o.source.row,'CSV record number',1,1_000_000,true);
    str(o.source.raw,'Original CSV record',16000);
  } else if(o.source.kind!=='manual')fail('Unknown observation source.');
}

// Keep legacy records, including IDs, versioned plans, links and clearances, verbatim.
export function createSessionDocument(legacy) {
  assertLegacyDocument(legacy);
  return validateSessionDocument({version:SESSION_DOCUMENT_VERSION,legacy,exercises:[],sessions:[]});
}
export function validateSessionDocument(doc) {
  obj(doc,'Session document');
  if(doc.version!==SESSION_DOCUMENT_VERSION)fail('Unsupported session document version.');
  const legacy=validateBackup(doc.legacy);
  arr(doc.exercises,'Exercise catalog',2000);arr(doc.sessions,'Sessions',50000);
  const plans=new Map(legacy.templates.map(t=>[t.id,t]));
  const catalog=new Map();
  for(const e of doc.exercises){
    obj(e,'Catalog exercise');str(e.id,'Exercise ID');str(e.name,'Exercise name',80);
    if(catalog.has(e.id))fail('Duplicate exercise ID.');
    if(e.muscle!==null)str(e.muscle,'Exercise muscle',40);
    if(!repUnits.includes(e.repUnit))fail('Unknown repetition unit.');
    catalog.set(e.id,e);
  }
  const legacyGroups=new Map();
  for(const l of legacy.logs){
    const k=key(l.date,l.templateId);
    if(!legacyGroups.has(k))legacyGroups.set(k,new Map());
    const byExercise=legacyGroups.get(k);
    const index=Number(l.exerciseIndex);
    if(!byExercise.has(index))byExercise.set(index,new Set());
    byExercise.get(index).add(Number(l.set));
  }
  const sessions=new Set(),occurrences=new Set(),sets=new Set(),extensions=new Set(),sourceIds=new Set();
  let setCount=legacy.logs.length,observationCount=0;
  for(const s of doc.sessions){
    obj(s,'Session');str(s.id,'Session ID');unique(sessions,s.id,'session ID');
    dateFromKey(s.date);str(s.name,'Session name',120);
    if(s.planId!==null&&!plans.has(s.planId))fail('Missing session plan.');
    if(typeof s.extendsLegacy!=='boolean')fail('Explicit legacy extension choice required.');
    const legacyKey=key(s.date,s.planId),group=legacyGroups.get(legacyKey);
    if(s.extendsLegacy){
      if(!group)fail('Legacy session to extend does not exist.');
      unique(extensions,legacyKey,'legacy session extension');
    }
    arr(s.exercises,'Performed exercises',200,1);
    const extendedExercises=new Set();
    for(const e of s.exercises){
      obj(e,'Performed exercise');str(e.id,'Occurrence ID');unique(occurrences,e.id,'occurrence ID');
      obj(e.identity,'Exercise identity');
      if(e.identity.kind==='plan')planExercise(plans,e.identity);
      else if(e.identity.kind!=='catalog'||!catalog.has(e.identity.exerciseId))fail('Unknown actual exercise identity.');
      if(!loadUnits.includes(e.loadUnit))fail('Unknown load unit.');
      if(e.plannedExerciseIndex!==null)planExercise(plans,{templateId:s.planId,exerciseIndex:e.plannedExerciseIndex});
      let previous;
      if(e.legacyExerciseIndex!==undefined){
        if(!s.extendsLegacy||!group?.has(e.legacyExerciseIndex)||e.identity.kind!=='plan'||
          e.identity.templateId!==s.planId||e.identity.exerciseIndex!==e.legacyExerciseIndex||
          e.plannedExerciseIndex!==e.legacyExerciseIndex)fail('Invalid explicit legacy exercise extension.');
        // Legacy records do not prove a weight basis. Do not retroactively assign one.
        if(e.loadUnit!=='unknown')fail('Legacy extension must retain unknown load basis.');
        unique(extendedExercises,e.legacyExerciseIndex,'legacy exercise extension');
        previous=group.get(e.legacyExerciseIndex);
      }
      arr(e.sets,'Actual sets',1000,1);
      const ordinals=new Set(previous);
      for(const set of e.sets){
        obj(set,'Actual set');str(set.id,'Set ID');unique(sets,set.id,'set ID');
        range(set.number,'Actual set number',1,1000,true);unique(ordinals,set.number,'set number in occurrence');
        if(set.completed!==true||!['working','warmup'].includes(set.kind))fail('Only explicitly completed sets may be saved.');
        arr(set.observations,'Set observations',100,1);
        if(++setCount>100000)fail('Session document exceeds 100,000 total sets.');
        for(const [index,o] of set.observations.entries()){
          if(++observationCount>200000)fail('Session document exceeds 200,000 observations.');
          observation(o,sourceIds,index>0);
        }
      }
    }
  }
  return structuredClone(doc);
}

// Read-only adapter. Legacy session boundaries are date + template, not inferred timestamps.
// New sessions retain explicitly supplied identities. No name matching, re-keying or unit conversion.
export function readActualSessions(input) {
  const doc=input?.version===1?createSessionDocument(input):validateSessionDocument(input);
  const plans=new Map(doc.legacy.templates.map(t=>[t.id,t]));
  const catalog=new Map(doc.exercises.map(e=>[e.id,e]));
  const output=new Map();
  const recorded=(v,min,max,integer=false)=>{
    if(typeof v!=='number' && (typeof v!=='string'||!v.trim()))return null;
    const n=Number(v);
    return Number.isFinite(n)&&n>=min&&n<=max&&(!integer||Number.isInteger(n))?n:null;
  };
  for(const l of doc.legacy.logs){
    const plan=plans.get(l.templateId),i=Number(l.exerciseIndex),ex=plan.exercises[i];
    const id=key('legacy',l.date,l.templateId);
    if(!output.has(id))output.set(id,{id,date:l.date,name:plan.name,planId:plan.id,legacy:true,exercises:[]});
    const session=output.get(id),occurrenceId=key('legacy',i);
    let occurrence=session.exercises.find(e=>e.id===occurrenceId);
    if(!occurrence){
      occurrence={id:occurrenceId,identity:{kind:'plan',templateId:plan.id,exerciseIndex:i},
        name:ex.name,muscle:ex.muscle,...(ex.muscleDetail?{muscleDetail:ex.muscleDetail}:{}),
        repUnit:ex.repUnit||'reps',loadUnit:'unknown',plannedExerciseIndex:i,sets:[]};
      session.exercises.push(occurrence);
    }
    const actualKg=recorded(l.kg,0,500),actualReps=recorded(l.reps,1,100,true);
    occurrence.sets.push({id:key('legacy',l.id,l.date,l.templateId,i,Number(l.set)),number:Number(l.set),completed:true,
      kind:l.isWarmup===true||l.kind==='warmup'?'warmup':'working',
      observations:[{actualKg,actualReps,rpe:recorded(l.rpe,1,10),
        loadEvidence:actualKg===null?'unknown':'legacy_recorded',
        repsEvidence:actualReps===null?'unknown':'legacy_recorded',
        ...(l.technique?{technique:l.technique}:{}),...(l.difficulty?{difficulty:l.difficulty}:{}),
        ...(typeof l.notes==='string'?{notes:l.notes}:{}),
        source:{kind:'legacy',record:structuredClone(l)}}]});
  }
  for(const s of doc.sessions){
    const id=s.extendsLegacy?key('legacy',s.date,s.planId):key('session',s.id);
    if(!output.has(id))output.set(id,{id,date:s.date,name:s.name,planId:s.planId,legacy:false,exercises:[]});
    const session=output.get(id);
    for(const e of s.exercises){
      const ex=e.identity.kind==='plan'?planExercise(plans,e.identity):catalog.get(e.identity.exerciseId);
      const added=e.sets.map(set=>({...set,id:key('session',set.id)}));
      if(e.legacyExerciseIndex!==undefined){
        session.exercises.find(o=>o.id===key('legacy',e.legacyExerciseIndex)).sets.push(...added);
      }else session.exercises.push({...e,id:key('session',e.id),name:ex.name,muscle:ex.muscle,
        repUnit:ex.repUnit||'reps',sets:added});
    }
  }
  return [...output.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
    .map(s=>({...s,exercises:s.exercises.map(e=>({...e,sets:e.sets.sort((a,b)=>a.number-b.number)}))}));
}
