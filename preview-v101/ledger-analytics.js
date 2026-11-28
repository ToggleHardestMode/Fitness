// Read-only canonical analytics. Deliberately not consumed by progression or the live UI.
import {validateLedger} from './ledger-model.js';
import {effectiveMeasurements} from './ledger-import-evidence.js';
import {splitCsv} from './completed-workout-csv.js';
import {dateFromKey,addDays} from './core.js';
import {directMuscle,weeklyTrainingAnalysis,setMilestoneProgress} from './training-analytics.js';
import {linkedSources} from './exercise-equivalence.js';
export const identityKey=i=>JSON.stringify(i.kind==='plan'?['plan',i.templateId,i.exerciseIndex]:['catalog',i.exerciseId]);
const unitKey=r=>JSON.stringify([r.loadUnit,r.repUnit]);
const working=r=>r.kind==='working';
const measured=r=>r.accepted.actualKg!==null&&r.accepted.actualReps!==null;
const repetition=r=>['reps','reps_per_side'].includes(r.repUnit);
const knownBasis=r=>['kg_per_dumbbell','kg_total','kg_stack'].includes(r.loadUnit)&&repetition(r);
const within=(r,from,to)=>r.date>=from&&r.date<=to;
const sort=(a,b)=>a.date.localeCompare(b.date)||a.sessionId.localeCompare(b.sessionId)||a.occurrenceId.localeCompare(b.occurrenceId)||a.number-b.number;
export function ledgerObservations(input){
  const doc=validateLedger(input),values=effectiveMeasurements(doc),evidence=new Map();
  for(const source of doc.imports??[]){
    const rows=splitCsv(source.text);
    for(const event of source.rows)if(['add','correct'].includes(event.action))
      evidence.set(event.setId,{sourceId:source.id,sourceName:source.name,row:event.row,action:event.action,
        reason:event.reason??null,raw:rows[event.row-2]});
  }
  const plans=new Map(doc.configuration.templates.map(t=>[t.id,t])),catalog=new Map(doc.catalog.map(e=>[e.id,e]));
  const rows=[];
  for(const s of doc.sessions)for(const e of s.exercises){
    const plan=e.identity.kind==='plan'?plans.get(e.identity.templateId):null;
    const movement=plan?plan.exercises[e.identity.exerciseIndex]:catalog.get(e.identity.exerciseId);
    const muscle=(plan?directMuscle(plan,movement):movement.muscle)||'Unknown';
    for(const set of e.sets){
      const source=evidence.get(set.id)??null,raw=source?.raw??set.legacy?.record??{};
      rows.push({id:set.id,sessionId:s.id,occurrenceId:e.id,date:s.date,sessionName:s.name,planId:s.planId,
        identity:e.identity,key:identityKey(e.identity),exercise:movement.name,muscle,plannedIndex:e.plannedIndex,
        number:set.number,kind:set.kind,loadUnit:e.loadUnit,repUnit:e.repUnit,original:set.measurement,
        accepted:values.get(set.id),source,corrected:source?.action==='correct',
        technique:raw.technique??'',difficulty:raw.difficulty??'',notes:raw.notes??''});
    }
  }
  rows.sort(sort);
  const movements=new Map(rows.map(r=>[r.key,{key:r.key,name:r.exercise,identity:r.identity}]));
  // A newly approved plan rename may have linked history before its first recorded set.
  const include=(identity,name)=>{
    const key=identityKey(identity);
    if(!movements.has(key))movements.set(key,{key,name,identity});
  };
  for(const t of doc.configuration.templates)t.exercises.forEach((e,exerciseIndex)=>
    include({kind:'plan',templateId:t.id,exerciseIndex},e.name));
  for(const e of doc.catalog)include({kind:'catalog',exerciseId:e.id},e.name);
  return {configuration:doc.configuration,rows,movements:[...movements.values()]};
}
function week(model,monday){
  if(dateFromKey(monday).getDay()!==1)throw Error('Choose a Monday for the training week.');
  const plan=weeklyTrainingAnalysis({...model.configuration,logs:[]},monday);
  const days=plan.days.map(d=>({...d,matched:0,extraOrSubstituted:0}));
  const byDate=new Map(days.map(d=>[d.date,d])),templates=new Map(model.configuration.templates.map(t=>[t.id,t]));
  const muscle=new Map(Object.entries(plan.byMuscle).map(([k,v])=>[k,{...v}]));
  const slots=new Set(),sessions=new Set(),volume=new Map(),timed=new Map();
  let completed=0,unknownMeasurements=0,unclassifiedVolume=0,offPlan=0;
  for(const r of model.rows){
    const day=byDate.get(r.date);if(!day||!working(r))continue;
    completed++;day.completed++;sessions.add(r.sessionId);
    if(!muscle.has(r.muscle))muscle.set(r.muscle,{planned:0,completed:0});
    muscle.get(r.muscle).completed++;
    if(day.templateId!==null&&r.planId===day.templateId){
      day.assignedCompleted++;
      const ex=templates.get(day.templateId)?.exercises[r.plannedIndex];
      const slot=JSON.stringify([r.date,r.plannedIndex,r.number]);
      if(ex&&r.identity.kind==='plan'&&r.identity.templateId===day.templateId&&
        r.identity.exerciseIndex===r.plannedIndex&&r.number<=ex.sets&&!slots.has(slot)){
        slots.add(slot);day.matched++;
      }else day.extraOrSubstituted++;
    }else{offPlan++;day.offPlan++;}
    if(!measured(r))unknownMeasurements++;
    if(['seconds','seconds_per_side'].includes(r.repUnit)){
      if(r.accepted.actualReps!==null)timed.set(r.repUnit,(timed.get(r.repUnit)??0)+r.accepted.actualReps);
    }else if(measured(r)&&knownBasis(r)){
      const k=unitKey(r);volume.set(k,(volume.get(k)??0)+r.accepted.actualKg*r.accepted.actualReps);
    }else unclassifiedVolume++;
  }
  for(const d of days)d.status=d.planned?d.matched===d.planned?'all_slots_logged':d.matched?'partial':d.completed?'other_work_logged':'not_logged':
    d.completed?'off_plan_logged':'not_scheduled';
  return {from:monday,to:addDays(monday,6),planned:plan.planned,completed,matched:slots.size,offPlan,
    sessions:sessions.size,loggedDays:days.filter(d=>d.completed).length,days,byMuscle:Object.fromEntries(muscle),
    unknownMeasurements,unclassifiedVolume,volume:[...volume].map(([k,value])=>{const [loadUnit,repUnit]=JSON.parse(k);return {loadUnit,repUnit,value};}),
    timed:[...timed].map(([unit,value])=>({unit,value}))};
}
function journey(model,key){
  const exact=model.movements.find(r=>r.key===key);
  if(!exact)return [];
  const linked=new Set(exact.identity.kind==='plan'?linkedSources(model.configuration,exact.identity.templateId,exact.identity.exerciseIndex)
    .map(i=>identityKey({kind:'plan',...i})):[]);
  const groups=new Map(),start=model.configuration.strengthJourneyStartDate;
  for(const r of model.rows){
    if(!working(r)||(start&&r.date<start)||(r.key!==key&&!linked.has(r.key)))continue;
    if(!groups.has(r.occurrenceId))groups.set(r.occurrenceId,{date:r.date,sessionId:r.sessionId,occurrenceId:r.occurrenceId,
      exercise:r.exercise,linked:r.key!==key,loadUnit:r.loadUnit,repUnit:r.repUnit,sets:[]});
    groups.get(r.occurrenceId).sets.push(r);
  }
  return [...groups.values()].map(g=>{
    const best=g.sets.filter(r=>measured(r)&&knownBasis(r)).sort((a,b)=>b.accepted.actualKg-a.accepted.actualKg||
      b.accepted.actualReps-a.accepted.actualReps||a.number-b.number)[0]??null;
    return {...g,best:best?.accepted??null};
  });
}
function logbook(model,from,to){
  const groups=new Map();
  for(const r of model.rows){
    if(!within(r,from,to))continue;
    if(!groups.has(r.sessionId))groups.set(r.sessionId,{id:r.sessionId,date:r.date,name:r.sessionName,sets:[]});
    groups.get(r.sessionId).sets.push(r);
  }
  return [...groups.values()].reverse();
}
function comparable(model,current,previous){
  const start=model.configuration.strengthJourneyStartDate;
  const groups=new Map();
  for(const r of model.rows){
    if(!working(r)||!knownBasis(r)||(start&&r.date<start))continue;
    const k=JSON.stringify([r.key,r.loadUnit,r.repUnit]);
    if(!groups.has(k))groups.set(k,[]);
    groups.get(k).push(r);
  }
  const result=[];
  for(const rows of groups.values()){
    const latest=period=>{
      const found=rows.filter(r=>within(r,period.from,period.to));
      if(!found.length)return [];
      const day=found.at(-1).date,all=found.filter(r=>r.date===day);
      // No time/order inference when more than one occurrence exists on the latest date.
      return new Set(all.map(r=>r.occurrenceId)).size===1?all:[];
    };
    const eligible=r=>measured(r)&&r.accepted.actualKg>0&&r.accepted.rpe!==null&&
      r.technique==='controlled'&&r.difficulty!=='too_hard';
    const now=latest(current).filter(eligible),before=latest(previous).filter(eligible);
    const match=now.flatMap(a=>before.filter(b=>a.number===b.number&&a.accepted.actualReps===b.accepted.actualReps&&
      a.accepted.rpe===b.accepted.rpe).map(b=>[a,b]))[0];
    if(match){const [a,b]=match;result.push({key:a.key,exercise:a.exercise,loadUnit:a.loadUnit,repUnit:a.repUnit,
      current:a.accepted.actualKg,previous:b.accepted.actualKg,change:a.accepted.actualKg-b.accepted.actualKg,
      reps:a.accepted.actualReps,rpe:a.accepted.rpe,number:a.number,currentDate:a.date,previousDate:b.date});}
  }
  return result;
}
export function ledgerAnalytics(input,monday){
  const model=ledgerObservations(input),current=week(model,monday),previous=week(model,addDays(monday,-7));
  const lifetime=model.rows.filter(working).length;
  return {lifetime,milestone:setMilestoneProgress(lifetime),current,previous,movements:model.movements,
    insights:comparable(model,current,previous),journey:key=>journey(model,key),
    logbook:logbook(model,current.from,current.to)};
}
