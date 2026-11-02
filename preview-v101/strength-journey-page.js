import {STORAGE_KEY,validateBackup} from './core.js';
import {exerciseChoices,verifiedSessions,saveStrengthFeedback,nextSessionTarget,setJourneyStart} from './strength-journey.js';
const root=document.getElementById('journey-content'),status=document.getElementById('journey-status');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v).toLocaleString('en-SG',{maximumFractionDigits:2});
const localDate=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());};
let selected='', chosenDate='', nextDate=localDate(), available='', verifiedUnit=false;
const read=()=>{const saved=localStorage.getItem(STORAGE_KEY);return validateBackup(saved?JSON.parse(saved):{version:1,templates:[],assignments:{},logs:[],metrics:[],reminder:{hour:18,minute:30,lead:0}})};
function paint(sessions) {
  if(!sessions.length)return '<p>No verified completed sets yet.</p>';
  const W=760,H=270,L=58,R=22,T=24,B=45;
  const max=Math.max(1,...sessions.map(s=>s.heaviest))*1.12;
  const x=i=>L+(sessions.length===1?(W-L-R)/2:i*(W-L-R)/(sessions.length-1));
  const y=v=>H-B-v/max*(H-T-B);
  const points=sessions.map((s,i)=>x(i).toFixed(1)+','+y(s.heaviest).toFixed(1)).join(' ');
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Actual heaviest working set in kilograms per recorded session from '+esc(sessions[0].date)+' to '+esc(sessions.at(-1).date)+'">' +
    '<line class="chart-axis" x1="'+L+'" y1="'+(H-B)+'" x2="'+(W-R)+'" y2="'+(H-B)+'"/>' +
    '<line class="chart-axis" x1="'+L+'" y1="'+T+'" x2="'+L+'" y2="'+(H-B)+'"/>'+
    '<text class="chart-label" x="'+L+'" y="14">kg entered · not necessarily per hand</text>'+
    '<text class="chart-label" x="'+L+'" y="'+(H-10)+'">'+esc(sessions[0].date)+'</text>'+
    '<text class="chart-label" text-anchor="end" x="'+(W-R)+'" y="'+(H-10)+'">'+esc(sessions.at(-1).date)+'</text>'+
    '<text class="chart-label" text-anchor="end" x="'+(L-8)+'" y="'+(H-B)+'">0</text>'+
    '<text class="chart-label" text-anchor="end" x="'+(L-8)+'" y="'+(T+5)+'">'+fmt(max)+'</text>'+
    (sessions.length>1?'<polyline class="chart-line" points="'+points+'"/>':'')+
    sessions.map((s,i)=>'<circle class="chart-point" data-session-date="'+esc(s.date)+'" role="button" tabindex="0" aria-label="'+esc(s.date+' '+fmt(s.heaviest)+' kilograms, open details')+'" cx="'+x(i)+'" cy="'+y(s.heaviest)+'" r="7"><title>'+esc(s.date+' · '+fmt(s.heaviest)+' kg · '+s.rows.length+' sets')+'</title></circle>').join('')+
    '</svg><p class="help">Each point is the heaviest <em>actually completed</em> working set on that date. Select a point for the exact sets. Different loads within a session are visible below.</p>';
}
function render(){
  let state;try{state=read()}catch(e){root.innerHTML='<div class="card warn">Saved workout data is unreadable. No changes made. Do not clear browser storage: '+esc(e.message)+'</div>';return;}
  const options=exerciseChoices(state);
  if(!options.length){root.innerHTML='<div class="card">No completed workout sets were found in this browser. Your phone and PC currently have separate local storage. Open the original device to export a full JSON backup; this preview will not invent your Day 1 results.</div>';return;}
  if(!options.some(o=>o.templateId+'|'+o.exerciseIndex===selected))selected=options[0].templateId+'|'+options[0].exerciseIndex;
  const [id,indexText]=selected.split('|'), index=Number(indexText),e=state.templates.find(t=>t.id===id)?.exercises[index];
  const sessions=verifiedSessions(state,id,index);
  const savedStart=state.strengthJourneyStarts?.[selected];
  const startDate=sessions.some(s=>s.date===savedStart)?savedStart:sessions[0].date;
  const visibleSessions=sessions.filter(s=>s.date>=startDate);
  if(!visibleSessions.some(x=>x.date===chosenDate))chosenDate=visibleSessions.at(-1).date;
  const oldest=visibleSessions[0],last=visibleSessions.at(-1);
  const parsed=available.trim()?available.split(',').map(v=>Number(v.trim())):[];
  const calc=nextSessionTarget(state,{templateId:id,exerciseIndex:index,nextDate,incrementsKg:verifiedUnit?parsed:[],journeyStartDate:startDate});
  const notice=calc.candidate
    ? calc.candidate.map(v=>'Set '+v.set+': '+fmt(v.kg)+' kg × '+v.reps+' reps').join(' · ')
    : 'No automatic increase recommended';
  const noteUnit=e.repUnit==='seconds_per_side'?'seconds/side':'reps';
  const selectedSession=sessions.find(x=>x.date===chosenDate);
  const prior=(state.strengthFeedback||[]).find(f=>f.date===chosenDate&&f.templateId===id&&f.exerciseIndex===index);
  root.innerHTML='<section class="card"><label>Exercise / exact saved template<select id="journey-exercise">'+
    options.map(o=>'<option value="'+esc(o.templateId+'|'+o.exerciseIndex)+'" '+((o.templateId+'|'+o.exerciseIndex)===selected?'selected':'')+'>'+esc(o.label)+'</option>').join('')+
    '</select></label><label>Verified restart Day 1<select id="journey-start-date">'+sessions.map(s=>'<option value="'+esc(s.date)+'" '+(s.date===startDate?'selected':'')+'>'+esc(s.date)+'</option>').join('')+'</select></label><p class="help">The earliest recorded session is selected by default. If earlier logs predate your restart, choose the actual completed restart date. This setting is included in JSON backups.</p><p class="help">Different workout versions are intentionally separate. There is no automatic exercise-name merging.</p>'+
    '<div class="grid"><div class="stat"><span>Day 1 · first saved session</span><strong>'+esc(oldest.date)+'</strong></div>'+
    '<div class="stat"><span>Last saved session</span><strong>'+esc(last.date)+'</strong></div>'+
    '<div class="stat"><span>Verified sessions since Day 1</span><strong>'+visibleSessions.length+'</strong></div>'+
    '<div class="stat"><span>Latest max set (kg logged)</span><strong>'+fmt(last.heaviest)+'</strong></div></div></section>'+
    '<section class="card"><h2>'+esc(e.name)+'</h2>'+paint(visibleSessions)+
    '<div class="sessions">'+visibleSessions.map(s=>'<details class="session" '+(s.date===chosenDate?'open':'')+' id="session-'+esc(s.date)+'"><summary>'+esc(s.date)+' · '+fmt(s.heaviest)+' kg top completed set · '+s.rows.length+' sets</summary><ul>'+
      s.rows.map(r=>'<li>Set '+r.set+': '+fmt(r.kg)+' kg × '+r.reps+' '+noteUnit+' · '+(r.rpe==null?'RPE not recorded':'RPE '+fmt(r.rpe))+(r.notes?' · '+esc(r.notes):'')+'</li>').join('')+
    '</ul></details>').join('')+'</div></section>'+
    '<section class="card recommend"><h2>Next-session recommendation</h2><div class="inline"><label>Target date<input id="journey-next-date" type="date" value="'+esc(nextDate)+'"></label>'+
    '<label>Confirmed available weights (kg; comma-separated)<input id="journey-increments" value="'+esc(available)+'" placeholder="e.g. 10,12,14,16"></label></div>'+
    '<label><span><input id="journey-verify-unit" type="checkbox" style="width:auto" '+(verifiedUnit?'checked':'')+'> I confirm those weights use the same kg unit as my saved sets</span></label>'+
    '<p class="help">Enter actual achievable dumbbell weights; a 10% single-step ceiling applies. No default increments or per-hand units are assumed.</p>'+
    '<p><strong>'+esc(notice)+'</strong></p><p>'+esc(calc.reason)+'</p><small>Ruleset '+esc(calc.ruleset)+' · Source '+esc(calc.sourceDate||'none')+' · Not automatically applied or recorded</small></section>'+
    '<section class="card"><h2>Record performance feedback</h2><p class="help">Optional feedback on a completed workout. Next-day response means a genuinely observed later check-in. It is not medical clearance. Existing symptom journal observations remain mandatory for suggested increases.</p>'+
    '<form id="journey-feedback"><label>Completed session<select name="date" id="journey-feedback-date">'+visibleSessions.map(s=>'<option value="'+s.date+'" '+(s.date===chosenDate?'selected':'')+'>'+s.date+'</option>').join('')+'</select></label>'+
    '<div class="grid"><label>Difficulty<select name="difficulty">'+[['','Choose…'],['easy','Too easy'],['target','On target'],['hard','Too hard']].map(([v,l])=>'<option value="'+v+'" '+(prior?.difficulty===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
    '<label>Technique<select name="technique">'+[['','Choose…'],['good','Controlled'],['uncertain','Uncertain'],['poor','Compromised']].map(([v,l])=>'<option value="'+v+'" '+(prior?.technique===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
    '<label>Next-day response<select name="nextDay">'+[['unknown','Unknown / not yet checked'],['good','Observed acceptable'],['symptoms','Concerning / worse']].map(([v,l])=>'<option value="'+v+'" '+((prior?.nextDay||'unknown')===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label></div>'+
    '<label>Notes (optional)<textarea name="note" maxlength="250" rows="2">'+esc(prior?.note||'')+'</textarea></label><button type="submit">Save feedback locally</button></form>'+
    '<p class="help">Feedback is stored inside the FitnessPilot JSON backup. A later set edit makes earlier feedback stale until re-reviewed.</p></section>';
}
root.addEventListener('change',e=>{
 if(e.target.id==='journey-exercise'){selected=e.target.value;chosenDate='';render();}
 if(e.target.id==='journey-start-date'){
  try{const [templateId,exerciseIndex]=selected.split('|');
   const saved=setJourneyStart(read(),{templateId,exerciseIndex:Number(exerciseIndex),startDate:e.target.value});
   localStorage.setItem(STORAGE_KEY,JSON.stringify(validateBackup(saved)));
   chosenDate='';status.textContent='Verified Day 1 changed; earlier records were preserved.';render();
  }catch(error){status.textContent=error.message;render();}
 }
 if(e.target.id==='journey-next-date'){nextDate=e.target.value;render();}
 if(e.target.id==='journey-increments'){available=e.target.value;render();}
 if(e.target.id==='journey-verify-unit'){verifiedUnit=e.target.checked;render();}
 if(e.target.id==='journey-feedback-date'){chosenDate=e.target.value;render();}
});
root.addEventListener('click',e=>{const p=e.target.closest('[data-session-date]');if(p){chosenDate=p.dataset.sessionDate;render();document.getElementById('session-'+chosenDate)?.scrollIntoView({block:'nearest'});}});
root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-session-date]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
root.addEventListener('submit',e=>{
 if(e.target.id!=='journey-feedback')return;
 e.preventDefault();
 try{
   const form=e.target, [templateId,exIdx]=selected.split('|');
   // Re-read live storage to preserve updates made on the Train tab.
   const live=read();
   const next=saveStrengthFeedback(live,{date:form.elements.date.value,templateId,exerciseIndex:Number(exIdx),
     difficulty:form.elements.difficulty.value,technique:form.elements.technique.value,
     nextDay:form.elements.nextDay.value,note:form.elements.note.value});
   localStorage.setItem(STORAGE_KEY,JSON.stringify(validateBackup(next)));
   status.textContent='Feedback saved locally. Download a fresh full JSON backup in Tools.';
   chosenDate=form.elements.date.value;render();
 }catch(error){status.textContent='No changes saved: '+error.message;}
});
render();
