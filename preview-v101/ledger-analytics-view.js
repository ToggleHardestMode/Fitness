// Read only the disposable review fixture. No live app imports or progression calls.
import {openIndexedLedgerFixture,readIndexedFixture} from './ledger-indexed-prototype.js';
import {verifyImportFingerprints} from './ledger-import-evidence.js';
import {dateFromKey,addDays} from './core.js';
import {ledgerAnalytics} from './ledger-analytics.js';
const $=id=>document.getElementById(id);
const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const line=(parent,text)=>parent.append(node('p',text));
const fmt=n=>n===null?'unknown':String(n);
const measurement=m=>fmt(m.actualKg)+' kg × '+fmt(m.actualReps)+' · RPE '+fmt(m.rpe);
let doc,report;
function displayJourney(){
  const out=$('journey');out.replaceChildren();if(!report)return;
  for(const g of report.journey($('movement').value)){
    const card=node('article','');card.append(node('h3',g.date+' · '+g.exercise+(g.linked?' · linked history':'')));
    line(card,'Session '+g.sessionId+' / '+g.occurrenceId+' · '+g.loadUnit+' / '+g.repUnit);
    line(card,g.best?'Top measured set: '+measurement(g.best):'No comparable measured set with known units.');
    for(const r of g.sets)line(card,'Set '+r.number+': '+measurement(r.accepted)+(r.corrected?' · corrected':''));
    out.append(card);
  }
  if(!out.children.length)line(out,'No working observations for this movement.');
}
function render(){
  for(const id of ['dashboard','volume','journey','logbook'])$(id).replaceChildren();
  report=null;report=ledgerAnalytics(doc,$('week').value);
  const {current:w,previous:p}=report;
  line($('dashboard'),'Lifetime working sets: '+report.lifetime);
  line($('dashboard'),'This week: '+w.completed+' working sets · '+w.sessions+' sessions · '+w.loggedDays+' days');
  line($('dashboard'),'Previous week: '+p.completed+' working sets · '+p.sessions+' sessions');
  line($('dashboard'),'Planned slots fulfilled: '+w.matched+' / '+w.planned+' · off-plan sets '+w.offPlan);
  for(const x of report.insights)line($('dashboard'),x.exercise+' · '+x.previous+' → '+x.current+' '+x.loadUnit+' · same reps/RPE/set');
  if(!report.insights.length)line($('dashboard'),'No controlled comparable load pair.');
  for(const [muscle,v] of Object.entries(w.byMuscle))line($('volume'),muscle+': '+v.completed+' completed / '+v.planned+' planned');
  for(const x of w.volume)line($('volume'),x.loadUnit+' × '+x.repUnit+': '+Math.round(x.value*100)/100);
  for(const x of w.timed)line($('volume'),x.unit+': '+x.value);
  line($('volume'),'Missing actual load/reps: '+w.unknownMeasurements+' working sets');
  line($('volume'),'Non-timed sets excluded from load volume: '+w.unclassifiedVolume);
  const old=$('movement').value;$('movement').replaceChildren();
  for(const x of report.movements){const o=node('option',x.name+' · '+x.key);o.value=x.key;$('movement').append(o);}
  if(report.movements.some(x=>x.key===old))$('movement').value=old;
  displayJourney();
  for(const s of report.logbook){
    const card=node('article','');card.append(node('h3',s.date+' · '+s.name));line(card,'Session '+s.id);
    for(const r of s.sets){
      line(card,r.exercise+' · Set '+r.number+' · '+r.kind+' · '+measurement(r.accepted)+' · '+r.loadUnit+' / '+r.repUnit);
      if(r.corrected)line(card,'Original: '+measurement(r.original)+' · Correction: '+r.source.reason);
      if(r.source)line(card,'Source: '+r.source.sourceName+' · record '+r.source.row);
      if(r.notes)line(card,'Notes: '+r.notes);
    }
    $('logbook').append(card);
  }
  if(!report.logbook.length)line($('logbook'),'No logged sessions in this week.');
}
$('movement').addEventListener('change',displayJourney);
$('week').addEventListener('change',()=>{try{render();$('status').textContent='Read-only analytics.';}catch(e){$('status').textContent=e.message;}});
$('refresh').addEventListener('click',async()=>{
  $('refresh').disabled=true;$('week').disabled=true;let db;
  try{
    db=await openIndexedLedgerFixture('fitnesspilot-preview-ledger-indexed-fixture-review-ui');
    const snapshot=await readIndexedFixture(db);
    if(!snapshot)throw Error('No fixture records. Load and review synthetic CSVs on ledger-import-review.html first.');
    await verifyImportFingerprints(snapshot.document);doc=snapshot.document;
    const latest=doc.sessions.map(s=>s.date).sort().at(-1);
    if(!latest)throw Error('No sessions in fixture.');
    $('week').value=addDays(latest,-((dateFromKey(latest).getDay()+6)%7));render();
    $('week').disabled=false;$('status').textContent='Read-only fixture revision '+snapshot.revision;
  }catch(e){doc=null;report=null;for(const id of ['dashboard','volume','journey','logbook','movement'])$(id).replaceChildren();$('status').textContent=e.message;}
  finally{db?.close();$('refresh').disabled=false;}
});
