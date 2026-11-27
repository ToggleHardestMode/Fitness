// Fixture-only review engine. Historical rows need owner-provided identities and evidence.
// File hash identifies exact source text, not a semantic workout.
import {validateLedger} from './ledger-model.js';
import {splitCsv} from './completed-workout-csv.js';
import {readImportMeasurement,effectiveMeasurements,ledgerSetIndex,duplicateMeasurement,ledgerSourceId,verifyImportFingerprints} from './ledger-import-evidence.js';
export {ledgerSourceId};
const fail=m=>{throw Error(m);};
const text=(v,max=1000)=>typeof v==='string'&&v.trim()&&v.length<=max;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function previewLedgerImport(input,files,decisions=[]){
  const doc=validateLedger(input),counts={added:0,duplicates:0,corrected:0,skipped:0,unresolved:0};
  await verifyImportFingerprints(doc);
  if(!Array.isArray(files)||!files.length||files.length>20||!Array.isArray(decisions)||decisions.length>2000)
    fail('Choose 1–20 CSV files and at most 2,000 row decisions.');
  const choices=new Map();
  for(const d of decisions){const k=JSON.stringify([d.sourceId,d.row]);if(choices.has(k))fail('Duplicate review decision.');choices.set(k,d);}
  const seen=new Map((doc.imports??[]).map(s=>[s.id,s]));
  const unresolved=[],sources=[],values=effectiveMeasurements(doc),index=ledgerSetIndex(doc);
  let total=0,size=0;
  for(const file of files){
    if(!text(file?.name,255)||typeof file.text!=='string'||(size+=new TextEncoder().encode(file.text).length)>5_000_000)
      fail('Invalid source or batch exceeds 5 MB.');
    const rows=splitCsv(file.text),id=await ledgerSourceId(file.text);
    total+=rows.length;if(total>2000)fail('Batch exceeds 2,000 CSV records.');
    if(seen.has(id)){
      if(seen.get(id).text!==file.text)fail('Source fingerprint collision.');
      counts.duplicates+=rows.length;
      rows.forEach((_,i)=>choices.delete(JSON.stringify([id,i+2])));
      continue;
    }
    const source={id,name:file.name,text:file.text,rows:[]};seen.set(id,source);sources.push(source);
    for(const [i,row] of rows.entries()){
      const line=i+2,key=JSON.stringify([id,line]),explicit=choices.get(key);
      choices.delete(key);
      // Stable-ID CSVs can supply the full identity and evidence directly; historical rows require review.
      const choice=explicit??(row.session_id&&row.occurrence_id&&row.set_id&&row.exercise_id&&row.completed==='true'?
        {sessionId:row.session_id,occurrenceId:row.occurrence_id,setId:row.set_id,
          identity:{kind:'catalog',exerciseId:row.exercise_id},loadUnit:row.load_basis,repUnit:row.rep_basis,
          completed:true}:null);
      try{
        if(!choice)fail('Explicit session, exercise and completion review required.');
        if(choice.action==='skip'){
          if(!text(choice.reason))fail('Skip reason required.');
          source.rows.push({row:line,action:'skip',reason:choice.reason});counts.skipped++;continue;
        }
        if(!['true',''].includes(row.completed??'')||row.completed!=='true'&&choice.completed!==true)
          fail('Completed set not confirmed.');
        if(!text(choice.sessionId)||!text(choice.occurrenceId)||!text(choice.setId))fail('Stable identities required.');
        if(!/^\d+$/.test(row.set)||Number(row.set)<1||Number(row.set)>1000)fail('Invalid set ordinal.');
        const measurement=readImportMeasurement(row,choice),number=Number(row.set);
        const existing=index.get(choice.setId);
        const kind=choice.kind??(row.kind||undefined);
        const audit={row:line,setId:choice.setId,completed:true,after:measurement};
        if(existing){
          if(existing.session.id!==choice.sessionId||existing.occurrence.id!==choice.occurrenceId||
            existing.session.date!==row.date||existing.set.number!==number||
            (choice.identity&&!equal(choice.identity,existing.occurrence.identity))||
            (choice.loadUnit&&choice.loadUnit!==existing.occurrence.loadUnit)||
            (choice.repUnit&&choice.repUnit!==existing.occurrence.repUnit)||
            (kind&&kind!==existing.set.kind))fail('Existing set identity, unit or kind conflict.');
          Object.assign(audit,{sessionId:existing.session.id,occurrenceId:existing.occurrence.id,
            identity:existing.occurrence.identity,loadUnit:existing.occurrence.loadUnit,repUnit:existing.occurrence.repUnit,kind:existing.set.kind});
          const before=values.get(choice.setId);
          if(duplicateMeasurement(before,measurement)){
            source.rows.push({...audit,action:'duplicate'});counts.duplicates++;continue;
          }
          if(choice.action!=='correct'||!text(choice.reason))fail('Conflicting observation; explicit correction and reason required.');
          source.rows.push({...audit,action:'correct',before,reason:choice.reason});values.set(choice.setId,measurement);
          counts.corrected++;continue;
        }
        if(choice.action==='correct')fail('Correction target does not exist.');
        let session=doc.sessions.find(s=>s.id===choice.sessionId);
        if(session&&session.date!==row.date)fail('Session date conflict.');
        if(!session){
          if(choice.newSession!==true&&!row.session_id)fail('Explicit new-session approval required.');
          session={id:choice.sessionId,date:row.date,name:row.workout,origin:'actual',planId:choice.planId??null,exercises:[]};
        }
        let occurrence=session.exercises.find(e=>e.id===choice.occurrenceId);
        if(occurrence){
          if(choice.identity&&!equal(choice.identity,occurrence.identity)||
            choice.loadUnit&&choice.loadUnit!==occurrence.loadUnit||choice.repUnit&&choice.repUnit!==occurrence.repUnit)
            fail('Performed exercise identity or unit conflict.');
        }else{
          if(!choice.identity||!choice.loadUnit||!choice.repUnit)fail('Actual exercise and unit choices required.');
          occurrence={id:choice.occurrenceId,identity:choice.identity,plannedIndex:choice.plannedIndex??null,
            loadUnit:choice.loadUnit,repUnit:choice.repUnit,sets:[]};
        }
        if(occurrence.sets.some(s=>s.number===number))fail('Set ordinal already exists; identify the saved set.');
        // Validate candidate before retaining any row mutation.
        const set={id:choice.setId,number,completed:true,kind:kind??'working',measurement};
        Object.assign(audit,{sessionId:session.id,occurrenceId:occurrence.id,identity:occurrence.identity,
          loadUnit:occurrence.loadUnit,repUnit:occurrence.repUnit,kind:set.kind});
        const candidate=structuredClone(doc),target=candidate.sessions.find(s=>s.id===session.id);
        if(choice.newExercise){
          if(choice.identity?.kind!=='catalog'||choice.newExercise.id!==choice.identity.exerciseId||
            candidate.catalog.some(e=>e.id===choice.newExercise.id))fail('Invalid new catalog identity.');
          candidate.catalog.push(choice.newExercise);
        }
        const nextSession=target??structuredClone(session);
        if(!target)candidate.sessions.push(nextSession);
        let nextOccurrence=nextSession.exercises.find(e=>e.id===occurrence.id);
        if(!nextOccurrence){nextOccurrence=structuredClone(occurrence);nextSession.exercises.push(nextOccurrence);}
        nextOccurrence.sets.push(set);
        // Partial source reconciliation is validated once all rows have been accounted for.
        // Validate shape through a temporary actual-only probe; full document audit follows below.
        validateLedger({version:2,configuration:candidate.configuration,catalog:candidate.catalog,
          sessions:[{...nextSession,origin:'actual',exercises:[{...nextOccurrence,sets:[set]}]}]});
        doc.catalog=candidate.catalog;doc.sessions=candidate.sessions;
        index.set(set.id,{session:nextSession,occurrence:nextOccurrence,set});values.set(set.id,measurement);
        source.rows.push({...audit,action:'add'});counts.added++;
      }catch(error){unresolved.push({sourceId:id,row:line,date:row.date,workout:row.workout,exercise:row.exercise,
        reason:error.message});counts.unresolved++;}
    }
  }
  if(choices.size)fail('Review contains unknown source rows.');
  if(unresolved.length)return {counts,unresolved,changed:false,document:null};
  if(sources.length)doc.imports=[...(doc.imports??[]),...sources];
  return {counts,unresolved,changed:sources.length>0,document:validateLedger(doc)};
}
