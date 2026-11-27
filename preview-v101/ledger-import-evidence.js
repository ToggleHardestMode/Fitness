// Pure evidence contract shared by import, backup validation and future analytics.
import {splitCsv} from './completed-workout-csv.js';
const fail=m=>{throw Error(m);};
const text=(v,max=1000)=>typeof v==='string'&&v.trim()&&v.length<=max;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=['actualKg','actualReps','rpe','loadEvidence','repsEvidence'];
export function readImportMeasurement(row,choice){
  const numeric=(raw,min,max,whole)=>{
    if(raw===''||raw===undefined)return null;
    if(!/^\d+(?:\.\d+)?$/.test(raw))fail('Invalid numeric CSV measurement.');
    const n=Number(raw);
    if(!Number.isFinite(n)||n<min||n>max||(whole&&!Number.isInteger(n)))fail('Invalid numeric CSV measurement.');
    return n;
  };
  const value=(raw,evidence,min,max,whole)=>{
    const n=numeric(raw,min,max,whole);
    if(['unknown','planned','assumed'].includes(evidence))return null;
    if(!['recorded','confirmed'].includes(evidence)||n===null)fail('Explicit measurement evidence is required.');
    return n;
  };
  const loadEvidence=choice.loadEvidence??row.load_evidence,repsEvidence=choice.repsEvidence??row.reps_evidence;
  return {actualKg:value(row.kg,loadEvidence,0,500,false),actualReps:value(row.reps,repsEvidence,1,1000,true),
    rpe:numeric(row.rpe,1,10,false),loadEvidence,repsEvidence};
}
export function sameMeasurement(a,b){return fields.every(k=>a[k]===b[k]);}
export function ledgerSetIndex(doc){
  const result=new Map();
  for(const session of doc.sessions)for(const occurrence of session.exercises)for(const set of occurrence.sets)
    result.set(set.id,{session,occurrence,set});
  return result;
}
export function effectiveMeasurements(doc){
  const values=new Map([...ledgerSetIndex(doc)].map(([id,x])=>[id,x.set.measurement]));
  for(const source of doc.imports??[])for(const row of source.rows)
    if(row.action==='correct')values.set(row.setId,row.after);
  return values;
}
export function validateImportHistory(doc){
  if(doc.imports===undefined)return;
  if(!Array.isArray(doc.imports)||doc.imports.length>5000)fail('Invalid import source archive.');
  const sets=ledgerSetIndex(doc),values=new Map([...sets].map(([id,x])=>[id,x.set.measurement]));
  const hashes=new Set(),texts=new Set(),added=new Set();let bytes=0;
  for(const source of doc.imports){
    if(!source||!/^sha256:[0-9a-f]{64}$/.test(source.id)||hashes.has(source.id)||texts.has(source.text)||
      !text(source.name,255)||typeof source.text!=='string'||(bytes+=source.text.length)>10_000_000)
      fail('Invalid or duplicate import source.');
    hashes.add(source.id);texts.add(source.text);
    const rows=splitCsv(source.text);
    if(!Array.isArray(source.rows)||source.rows.length!==rows.length)fail('Source rows not reconciled.');
    for(const [i,event] of source.rows.entries()){
      if(!event||event.row!==i+2||!['add','duplicate','correct','skip'].includes(event.action))fail('Invalid import event.');
      if(event.action==='skip'){if(!text(event.reason))fail('Skip reason required.');continue;}
      const target=sets.get(event.setId),row=rows[i];
      if(!target||target.session.date!==row.date||target.set.number!==Number(row.set)||
        (row.completed!=='true'&&event.completed!==true))fail('Invalid import target or completion.');
      const measurement=readImportMeasurement(row,event.after??{});
      if(!sameMeasurement(measurement,event.after??{}))fail('Import measurement does not match source evidence.');
      const current=values.get(event.setId);
      if(event.action==='add'){
        if(target.set.legacy||added.has(event.setId)||!sameMeasurement(target.set.measurement,measurement))
          fail('Invalid imported original observation.');
        added.add(event.setId);
      }else if(event.action==='duplicate'){
        if(!sameMeasurement(current,measurement))fail('Duplicate does not match accepted observation.');
      }else{
        if(!text(event.reason)||!event.before||!sameMeasurement(current,event.before)||
          sameMeasurement(current,measurement))fail('Invalid audited correction.');
        values.set(event.setId,measurement);
      }
    }
  }
  for(const [id,x] of sets)if(x.session.origin==='legacy'&&!x.set.legacy&&!added.has(id))
    fail('Legacy addition lacks source evidence.');
}
