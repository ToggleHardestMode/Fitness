// Deterministic, fail-closed merge preview for two manual JSON backups.
// No cloud sync, no implicit deletes and no localStorage writes.
import {validateBackup} from './core.js';
const canonical = x => JSON.stringify(x,(k,v)=>v && !Array.isArray(v) && typeof v==='object' ?
  Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
const entries={
  templates:x=>x.id,
  logs:x=>[x.date,x.templateId,x.exerciseIndex,x.set].join('|'),
  metrics:x=>x.date,
  symptomLogs:x=>[x.date,x.timepoint,x.templateId,x.exerciseIndex].join('|'),
  strengthFeedback:x=>[x.date,x.templateId,x.exerciseIndex].join('|')
};
export function previewDeviceMerge(localInput,remoteInput){
  const local=validateBackup(localInput), remote=validateBackup(remoteInput), output=structuredClone(local);
  const conflicts=[],summary={};
  for(const [field,identity] of Object.entries(entries)){
    const a=local[field]||[],b=remote[field]||[],byId=new Map(a.map(x=>[identity(x),x]));
    let added=0;
    for(const item of b){
      const k=identity(item),existing=byId.get(k);
      if(!existing){byId.set(k,item);added++;}
      else if(canonical(existing)!==canonical(item))
        conflicts.push({collection:field,key:k,reason:'Both devices edited the same logical record differently.'});
    }
    // Different keys cannot reuse an ID, or downstream edits would be ambiguous.
    if(field==='logs'||field==='symptomLogs'){
      const idSet=new Map();
      for(const [k,item] of byId){
        if(typeof item.id!=='string')continue;
        if(idSet.has(item.id)&&idSet.get(item.id)!==k)
          conflicts.push({collection:field,key:k,reason:'The same record ID belongs to different logical entries.'});
        idSet.set(item.id,k);
      }
    }
    output[field]=[...byId.values()];
    summary[field]={onThisDevice:a.length,onImport:b.length,added};
  }
  const mergedStarts={...(local.strengthJourneyStarts||{})};
  let startsAdded=0;
  for(const [id,date] of Object.entries(remote.strengthJourneyStarts||{})){
    if(Object.hasOwn(mergedStarts,id) && mergedStarts[id]!==date)
      conflicts.push({collection:'strengthJourneyStarts',key:id,reason:'Both devices chose different restart dates.'});
    else if(!Object.hasOwn(mergedStarts,id)){mergedStarts[id]=date;startsAdded++;}
  }
  output.strengthJourneyStarts=mergedStarts;
  summary.strengthJourneyStarts={onThisDevice:Object.keys(local.strengthJourneyStarts||{}).length,
    onImport:Object.keys(remote.strengthJourneyStarts||{}).length,added:startsAdded};
  const blankLocal = local.templates.length===0 && local.logs.length===0 && local.metrics.length===0 &&
    (local.symptomLogs||[]).length===0 && (local.strengthFeedback||[]).length===0;
  if(blankLocal){output.assignments=structuredClone(remote.assignments);output.reminder=structuredClone(remote.reminder);}
  else if(canonical(local.assignments)!==canonical(remote.assignments))
    conflicts.push({collection:'assignments',key:'weekly-schedule',reason:'Different weekly schedules require an explicit choice.'});
  if(!blankLocal && canonical(local.reminder)!==canonical(remote.reminder))
    conflicts.push({collection:'reminder',key:'reminder-settings',reason:'Different reminder settings require an explicit choice.'});
  if(conflicts.length)return {safe:false,conflicts,summary,merged:null};
  try{
    return {safe:true,conflicts:[],summary,merged:validateBackup(output)};
  }catch(e){
    return {safe:false,conflicts:[{collection:'validation',key:'whole-backup',reason:e.message}],summary,merged:null};
  }
}
