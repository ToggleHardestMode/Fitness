import { initRoFeedback, isRoSoundEnabled } from './ro-feedback.js';
import { DAYS, DAY_NAMES, STORAGE_KEY, emptyState, STARTER_CSV, parseWorkouts, addWorkouts, recordSets, saveMetrics, weeklyStats, bestSets, dateKey, addDays, weekdayOf, calendarICS, validateBackup, intRange, RECOVERY_UL_CSV, UNIFIED_UL_CSV } from './core.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString('en-SG', {maximumFractionDigits:1});
const today = () => dateKey(new Date());
const nice = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-SG',{day:'numeric',month:'short'});
const icons = {
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  train:'<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  plan:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  tools:'<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const navItems = [['dashboard','Dashboard'],['train','Train'],['plan','Plan'],['tools','Tools']];

let state, storageError = null;
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  state = saved ? validateBackup(JSON.parse(saved)) : emptyState();
} catch(error) {
  state = emptyState(); storageError = `Existing saved data could not be read: ${error.message}. This app will not overwrite it. Keep this browser's website data intact while you investigate the problem.`;
}
let page='dashboard', activeDate=today(), chosenTemplate=null, chosenExercise=0, pendingWorkouts=null, pendingBackup=null;
let timerEnd=null,timerHandle=null, audioContext=null, toastHandle=null;
function toast(msg,error=false) {
  const el=$('#toast'); el.textContent=msg; el.classList.toggle('error',error);el.classList.add('on');
  clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('on'),3600);
}
function commit(next,message) {
  if(storageError) throw Error('Saved data is locked because it could not be read. Do not overwrite your existing record.');
  const clean=validateBackup(next);
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(clean));}
  catch(error) {throw Error(`Could not save locally (${error.name}). Check available device storage; the old records were left untouched.`);}
  state=clean; render(); if(message)toast(message);
}
function tryAction(fn) {try {fn();}catch(error){toast(error.message||'Operation failed.',true);}}
function goto(next) {page=next;render();$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function navMarkup() {return navItems.map(([id,label])=>`<button type="button" class="tab ${page===id?'active':''}" data-page="${id}" aria-label="${label}" aria-current="${page===id?'page':'false'}">${svg(id)}<span>${label}</span></button>`).join('');}
function heading(kicker,title,subtitle='') {return `<div class="screen-intro"><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>`;}
function shellHeading() {return `<div class="header-row"><div class="wordmark"><img src="./assets/icon.svg" alt=""><span>FitnessPilot</span></div><div class="date-pill">${new Date().toLocaleDateString('en-SG',{month:'short',day:'numeric',weekday:'short'})}</div></div>`;}
function initialCard() {return `<div class="hero"><div class="hero-kicker">WELCOME TO FITNESSPILOT</div><h1>Your training, organised.</h1><p>Start with an example four-day Upper/Lower plan, then log actual lifts and watch your progress build.</p><button class="btn" data-action="starter">Use example workout plan →</button></div>`;}
function inWeekCards(s) {return `<div class="kpis grid">
  <div class="card"><div class="kpi-label">Sessions</div><div class="kpi-value">${s.sessions}<small> / ${s.planned || '–'}</small></div><div class="kpi-bottom">This week</div></div>
  <div class="card"><div class="kpi-label">Logged sets</div><div class="kpi-value">${s.sets}</div><div class="kpi-bottom">Working sets saved</div></div>
  <div class="card"><div class="kpi-label">Total volume</div><div class="kpi-value">${fmt(s.volume)} <small>kg</small></div><div class="kpi-bottom">Logged kg × reps</div></div>
  <div class="card"><div class="kpi-label">Body weight</div><div class="kpi-value">${s.weight==null?'—':fmt(s.weight)} <small>${s.weight==null?'':'kg'}</small></div><div class="kpi-bottom">Weekly recorded average</div></div>
</div>`;}
function dashboard() {
  const s=weeklyStats(state,today()), best=bestSets(state).slice(0,4), max=Math.max(...s.data.map(d=>d.volume),1);
  const chart=s.data.map((d,i)=>`<div class="day-slot" title="${DAYS[i]}: ${fmt(d.volume)} kg"><div class="bar ${d.volume===0?'empty':''}" style="height:${Math.max(4,Math.round(d.volume/max*111))}px"></div><span class="bar-label">${DAYS[i]}</span></div>`).join('');
  const days=DAYS.map((d,i)=>{const t=state.templates.find(t=>t.id===state.assignments[i]);return `<div class="day-tile ${t?'active':''}"><strong>${d}</strong><span>${esc(t?.name||'Rest')}</span></div>`;}).join('');
  const nextDay=(()=>{for(let i=0;i<7;i++){const day=weekdayOf(addDays(today(),i));const t=state.templates.find(t=>t.id===state.assignments[day]);if(t)return {date:addDays(today(),i),t};}return null;})();
  return `${shellHeading()}${!state.templates.length?initialCard():`<div class="hero"><div class="hero-kicker">BUILD CONSISTENCY. SEE PROGRESS.</div><h1>One workout at a time.</h1><p>${nextDay?`${nextDay.date===today()?'Today':nice(nextDay.date)} · ${nextDay.t.name} · ${nextDay.t.exercises.length} exercises`:'Set a workout day in your Plan to get started.'}</p><button class="btn" data-page="train">Log a workout →</button></div>`}
  <div class="section-label"><h2>This week</h2><span>${nice(s.dates[0])} – ${nice(s.dates[6])}</span></div>${inWeekCards(s)}
  <div class="two-panels" style="margin-top:12px"><section class="card"><div class="card-head"><div><h2>Training volume</h2><p>See how much you've logged each day</p></div><span class="badge">7 DAYS</span></div><div class="day-bars" role="img" aria-label="Training volume by day: ${s.data.map((v,i)=>`${DAYS[i]} ${fmt(v.volume)} kg`).join('; ')}">${chart}</div><div class="inline-meta"><span class="dot"></span>Volume is based on saved sets only.</div></section>
  <section class="card"><div class="card-head"><div><h2>Your training week</h2><p>Workout assignments</p></div><button class="btn ghost small-btn" data-page="plan">Edit plan →</button></div><div class="day-calendar">${days}</div><div class="progress-track"><div class="progress-fill" style="width:${s.planned?Math.min(100,s.sessions/s.planned*100):0}%"></div></div><div class="inline-meta">${s.sessions} workout day(s) recorded · ${s.planned} planned per week</div></section></div>
  <div class="section-label"><h2>Insights</h2><span>Only real entries</span></div>
  <div class="two-panels"><section class="card"><div class="card-head"><div><h2>Daily check-ins</h2><p>Weekly averages</p></div><button class="btn ghost small-btn" data-page="train">Add →</button></div>${[['Protein',s.protein,'g'],['Calories',s.calories,'kcal'],['Sleep',s.sleep,'h'],['Recovery',s.recovery,'/ 5']].map(([label,value,unit])=>`<div class="data-row"><strong>${label}</strong><div class="score">${value==null?'Not recorded':`${fmt(value)} ${unit}`}</div></div>`).join('')}</section>
  <section class="card"><div class="card-head"><div><h2>Strongest sets</h2><p>Heaviest recorded weight by exercise</p></div></div>${best.length?best.map(l=>`<div class="data-row"><div><strong>${esc(l.exerciseName)}</strong><span>${nice(l.date)}</span></div><div class="score tinted">${fmt(l.kg)} kg × ${l.reps}</div></div>`).join(''):'<div class="empty"><strong>No lifts yet</strong>Your best sets will appear after you save them.</div>'}</section></div><p class="footer-hint">Weight for dumbbells is recorded exactly as entered; volume does not automatically double per-hand weights. Bodyweight moves logged at 0 kg count as sets but contribute 0 kg to volume.</p>`;
}
function rangeSummary(exercise) {
  return exercise.setTargets
    ? exercise.setTargets.map(target => `${target.min}–${target.max}`).join(' / ')
    : `${exercise.min}–${exercise.max}`;
}
function train() {
  const day=weekdayOf(activeDate);
  const selected=chosenTemplate && state.templates.some(t=>t.id===chosenTemplate)?chosenTemplate:(state.assignments[day]||'');
  chosenTemplate=selected;
  const workout=state.templates.find(t=>t.id===selected);
  const options=`<option value="">Select a workout</option>`+state.templates.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.name)}</option>`).join('');
  const metrics=state.metrics.find(m=>m.date===activeDate)||{};
  let exMarkup='';
  if(workout) {
    chosenExercise=Math.min(chosenExercise,workout.exercises.length-1);
    const ex=workout.exercises[chosenExercise], current=state.logs.filter(l=>l.date===activeDate && l.templateId===selected && l.exerciseIndex===chosenExercise);
    const previous=state.logs.filter(l=>l.date<activeDate && l.templateId===selected && l.exerciseIndex===chosenExercise).sort((a,b)=>b.date.localeCompare(a.date));
    const setFields=Array.from({length:ex.sets},(_,i)=>{
      const old=current.find(l=>l.set===i+1), prior=previous.find(l=>l.set===i+1);
      const target=ex.setTargets?.[i] ?? {min:ex.min,max:ex.max};
      return `<div class="log-grid set-row"><strong class="tiny set-target-label">${i+1}<small>${target.min}–${target.max}</small></strong><input class="field" inputmode="decimal" type="number" min="0" max="500" step="0.5" name="kg${i}" aria-label="Set ${i+1} kilograms" value="${esc(old?.kg??prior?.kg??'')}"><input class="field" inputmode="numeric" type="number" min="1" max="100" step="1" name="reps${i}" aria-label="Set ${i+1} reps" value="${esc(old?.reps??prior?.reps??'')}"><input class="field" inputmode="decimal" type="number" min="1" max="10" step="0.5" name="rpe${i}" aria-label="Set ${i+1} RPE" value="${esc(old?.rpe??'')}"><input class="tick" type="checkbox" name="done${i}" aria-label="Mark set ${i+1} complete" ${old?'checked':''}></div>`;
    }).join('');
    const exList=workout.exercises.map((e,i)=>{const done=state.logs.filter(l=>l.date===activeDate && l.templateId===selected && l.exerciseIndex===i).length;return `<button class="exercise-choice ${i===chosenExercise?'active':''}" type="button" data-exercise="${i}"><div><strong>${i+1}. ${esc(e.name)}</strong><span>${esc(e.muscle)} · ${e.sets} sets · ${esc(rangeSummary(e))}</span></div><b>${done}/${e.sets}</b></button>`;}).join('');
    exMarkup=`<div class="section-label"><h2>Exercises</h2><span>Tap to record</span></div><div class="exercise-layout"><div class="stack">${exList}</div><div class="card"><div class="card-head"><div><div class="eyebrow">LOG YOUR SETS</div><h2 style="margin-top:5px">${esc(ex.name)}</h2><p>${ex.sets} sets · ${esc(rangeSummary(ex))} reps · ${ex.rest}s rest</p></div><span class="badge">${esc(ex.muscle).toUpperCase()}</span></div><form id="sets-form"><div class="log-grid"><span class="micro">SET</span><span class="micro">KG</span><span class="micro">REPS</span><span class="micro">RPE</span><span class="micro">✓</span></div>${setFields}<div class="divider"></div><div class="metrics-grid"><label><span class="form-label">Rest (seconds)</span><input class="field" type="number" min="0" max="600" inputmode="numeric" name="rest" value="${current[0]?.rest ?? ex.rest}"></label><label><span class="form-label">Tempo (optional)</span><input class="field" name="tempo" maxlength="40" placeholder="e.g. 3-1-1" value="${esc(current[0]?.tempo??'')}"></label></div><label><span class="form-label">Session note (optional)</span><input class="field" name="notes" maxlength="250" placeholder="How did this movement feel?" value="${esc(current[0]?.notes??'')}"></label><div class="form-actions"><button class="btn" type="submit">Save checked sets</button><button class="btn secondary" data-rest="${ex.rest}" type="button">${ex.rest}s rest timer</button></div><p class="hint" style="margin-top:10px">Check the sets you completed. Saving updates existing checked sets for this day, not historical sets. Use 0 kg for unweighted movements.</p></form></div></div>`;
  } else {exMarkup=`<div class="card empty"><strong>${state.templates.length?'No workout selected':'No templates yet'}</strong>${state.templates.length?'Choose any workout above or assign a day in Plan.':'Go to Dashboard and load the example plan, or import your own CSV in Plan.'}</div>`;}
  return `${shellHeading()}${heading('WORKOUT LOGGER','Train today','Record the work you actually did. Nothing is marked complete until you save it.')}
  <div class="card"><div class="two-panels"><label><span class="form-label" style="margin-top:0">Workout date</span><input class="field" type="date" id="active-date" value="${activeDate}"></label><label><span class="form-label" style="margin-top:0">Workout for this date</span><select class="field" id="active-workout">${options}</select></label></div><div class="inline-meta"><span class="dot"></span>${DAY_NAMES[day]} · ${state.logs.filter(l=>l.date===activeDate).length} set(s) saved</div></div>
  ${exMarkup}<div class="section-label"><h2>Daily check-in</h2><span>${nice(activeDate)}</span></div><section class="card"><form id="metrics-form"><div class="metrics-grid">${[['weight','Body weight (kg)','0.1'],['calories','Calories (kcal)','1'],['protein','Protein (g)','1'],['sleep','Sleep (hours)','0.1'],['recovery','Recovery (1–5)','1']].map(([key,label,step])=>`<label><span class="form-label">${label}</span><input class="field" type="number" inputmode="decimal" step="${step}" name="${key}" value="${esc(metrics[key]??'')}" placeholder="Not recorded"></label>`).join('')}</div><div class="form-actions"><button class="btn secondary" type="submit">Save daily check-in</button></div><p class="hint" style="margin-top:10px">Only enter values you measured. Blank fields are not guessed.</p></form></section>`;
}
function plan() {
  const assigned = i=>state.assignments[i]||'';
  const rows=DAYS.map((d,i)=>`<div class="schedule-row"><label for="day${i}">${DAY_NAMES[i]}</label><select class="field" id="day${i}" name="day${i}"><option value="">Rest day</option>${state.templates.map(t=>`<option value="${esc(t.id)}" ${assigned(i)===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>`).join('');
  const pending=pendingWorkouts?`<div class="notice"><strong>Import preview ready:</strong> ${pendingWorkouts.length} workout template(s). This adds templates only; it will not alter the existing schedule or workout logs.<div class="preview-list">${pendingWorkouts.map(w=>`<p><strong>${DAY_NAMES[w.day]} · ${esc(w.name)}</strong> — ${w.exercises.length} exercises</p>`).join('')}</div><div class="quick-actions"><button class="btn small-btn" data-action="confirm-csv">Add templates to library</button><button class="btn secondary small-btn" data-action="cancel-csv">Cancel import</button></div></div>`:'';
  return `${shellHeading()}${heading('YOUR PROGRAM','Weekly plan','Create your schedule once. Your completed workout history stays intact if the plan changes.')}
  <section class="card"><div class="card-head"><div><h2>Choose your workout days</h2><p>Leave any day as Rest day</p></div></div><form id="schedule-form">${rows}<div class="form-actions"><button class="btn" type="submit">Save weekly schedule</button></div></form></section>
  <div class="section-label"><h2>Your latest training plan</h2></div><section class="card stack"><strong>Recovery-Optimized Upper/Lower · 30 Sep 2026</strong><p class="subtle small">Mon Upper A · Tue Lower A · Thu Upper B · Fri Lower B. Includes top/back-off sets and labelled superset pairs. For Face Pull/Lateral Raise, the third set is optional. Reps listed per arm/leg are per side. Rest is 90 seconds by default unless noted.</p><div class="quick-actions"><button class="btn" type="button" data-action="latest-ul">Add my Recovery UL templates</button><button class="btn secondary" type="button" data-action="latest-ul-csv">Download this plan (.csv)</button></div><p class="hint">Adds templates only. Your current weekly schedule and completed workout sets are unchanged. After import, assign the new workouts to weekdays above and save the schedule.</p></section>
  <div class="section-label"><h2>Unified Recovery UL (per-set targets)</h2></div>
  <section class="card stack"><p class="subtle small">Now one Bench Press, one Goblet Squat, and one Incline Press. Each has different rep targets for top and back-off sets. Your older split templates and saved logs stay available.</p><div class="quick-actions"><button class="btn" type="button" data-action="unified-ul">Add Unified Upper/Lower plan</button><button class="btn secondary" type="button" data-action="unified-ul-csv">Download Unified plan (.csv)</button></div><p class="hint">Adding these templates does not change your current workout days. Choose the new Unified workouts in the schedule above, then save.</p></section>
  <div class="section-label"><h2>Workout library</h2><span>${state.templates.length} saved templates</span></div>
  <section class="card">${state.templates.length?state.templates.map(t=>`<div class="template-row"><div><strong>${esc(t.name)}</strong><small>${DAY_NAMES[t.day]} suggestion · ${t.exercises.length} exercises</small></div><span class="badge">${t.exercises.reduce((s,e)=>s+e.sets,0)} SETS</span></div>`).join(''):'<div class="empty"><strong>No workout templates</strong>Use the starter plan or import a CSV.</div>'}</section>
  <div class="section-label"><h2>Import from Excel</h2></div><section class="card stack"><p class="subtle small">In Excel, choose <strong>Save As → CSV UTF-8</strong>. Then select that file here. The original .xlsx file is not imported directly.</p><div class="upload-card"><div class="file-ico">↓</div><div style="flex:1;min-width:140px"><strong>Excel-exported CSV</strong><p class="subtle small">Up to 500 exercises · Max 1 MB</p></div><button class="btn secondary small-btn" data-action="pick-csv">Choose CSV</button></div>${pending}<div class="quick-actions"><button class="btn ghost small-btn" data-action="example-csv">Download example CSV →</button></div><p class="hint">Required columns: day, workout, exercise, muscle, sets, rep_min, rep_max. Optional: rest_seconds. Identical imports are skipped; imported templates do not replace completed workouts.</p></section>`;
}
function tools() {
  const reminder=state.reminder, time=`${String(reminder.hour).padStart(2,'0')}:${String(reminder.minute).padStart(2,'0')}`;
  const backupInfo=pendingBackup?`<div class="notice warn"><strong>Backup checked:</strong> ${pendingBackup.templates.length} templates, ${pendingBackup.logs.length} saved sets, ${pendingBackup.metrics.length} daily entries. <strong>Restore replaces all data currently in this app.</strong><label><span class="form-label">Type REPLACE to confirm</span><input class="field" type="text" id="restore-word" autocomplete="off" placeholder="REPLACE"></label><div class="form-actions"><button class="btn danger" data-action="restore-confirm">Replace with this backup</button><button class="btn secondary" data-action="restore-cancel">Cancel</button></div></div>`:'';
  return `${shellHeading()}${heading('REMINDERS & DATA','Your tools','Protect your training history, and plan alerts for your workout days.')}
  <section class="card"><div class="card-head"><div><h2>Workout reminders</h2><p>Uses your iPhone Calendar — even when FitnessPilot is closed</p></div><span class="badge">CALENDAR</span></div><form id="reminder-form"><div class="metrics-grid"><label><span class="form-label">Workout time</span><input class="field" type="time" name="time" required value="${time}"></label><label><span class="form-label">Alert ahead of time</span><select class="field" name="lead"><option value="0" ${reminder.lead===0?'selected':''}>At workout time</option><option value="5" ${reminder.lead===5?'selected':''}>5 minutes before</option><option value="15" ${reminder.lead===15?'selected':''}>15 minutes before</option><option value="30" ${reminder.lead===30?'selected':''}>30 minutes before</option><option value="60" ${reminder.lead===60?'selected':''}>1 hour before</option></select></label></div><div class="form-actions"><button class="btn" type="submit">Save alert settings</button><button class="btn secondary" type="button" data-action="calendar">Export Calendar reminders (.ics)</button></div></form><p class="hint" style="margin-top:14px">First save your settings, then export the .ics file. Import it into a calendar that supports .ics events and alarms. Some iPhone import paths may require emailing the file to yourself or using a computer calendar. Check the alert in Apple Calendar after import. If you change the schedule, remove previous imported events and export again to avoid duplicate alerts.</p><div class="notice warn"><strong>Not a Clock alarm.</strong> This web app cannot force a loud full-screen ring while closed. Calendar notifications depend on your phone's notification, Focus and Silent settings. Use the iPhone Clock app if an audible alarm is essential.</div></section>
  <div class="section-label"><h2>Game-style controls</h2></div><section class="card"><label class="ro-sound-switch"><input type="checkbox" id="ro-click-sound" ${isRoSoundEnabled()?'checked':''}> Slime squish sound</label><p class="hint">Sound is off by default and plays only when you tap a control. iPhone Silent Mode and browser restrictions may affect playback.</p></section>
  <div class="section-label"><h2>Rest timer</h2><span>Runs while app is open</span></div><section class="card"><div id="timer-display" class="rest-timer">${timerRemaining()}</div><p class="subtle small">An optional countdown for time between sets. iPhone may pause it in the background.</p><div class="form-actions"><button class="btn secondary" data-rest="60">1 minute</button><button class="btn secondary" data-rest="90">90 seconds</button><button class="btn secondary" data-rest="120">2 minutes</button><button class="btn ghost" data-action="stop-timer">Stop</button></div></section>
  <div class="section-label"><h2>Your data</h2><span>No account needed</span></div><section class="card stack"><div class="notice"><strong>Saved on this device only.</strong> Your sets and templates stay in this browser's local storage. They are not sent to us or synced to another device. Clearing website data, deleting the Home Screen app, or switching devices can remove access to them.</div><div class="quick-actions"><button class="btn" data-action="backup-export">Download full backup (.json)</button><button class="btn secondary" data-action="backup-pick">Restore backup</button></div>${backupInfo}<p class="hint">Export a backup after every important training week. Keep the JSON file in iCloud Drive or another place you control. Restoring is destructive, so this app will preview the file and require an explicit confirmation.</p></section>
  <p class="app-footer">FitnessPilot Web v1 · No accounts · No analytics · No advertisements</p>`;
}
function timerRemaining(){if(!timerEnd)return '00:00';const n=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function timerTick() {const display=$('#timer-display');if(display)display.textContent=timerRemaining();if(timerEnd && timerEnd<=Date.now()){timerEnd=null;clearInterval(timerHandle);timerHandle=null;try{if(audioContext){const osc=audioContext.createOscillator();const gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);osc.frequency.value=740;gain.gain.value=.15;osc.start();osc.stop(audioContext.currentTime+.35);}}catch{}toast('Rest timer finished. Time for your next set!');}}
function render(){const markup=navMarkup();$('.bottom-tabs').innerHTML=markup;$('.desktop-tabs').innerHTML=markup;$('#main').innerHTML=`${storageError?`<div class="error-strip" role="alert">${esc(storageError)}</div>`:''}${page==='dashboard'?dashboard():page==='train'?train():page==='plan'?plan():tools()}`;timerTick();}
function download(filename,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function readCSV(file) {
  if (!file || file.size > 1_000_000) throw Error('Choose a CSV smaller than 1 MB.');
  if (!/\.csv$/i.test(file.name)) throw Error('Choose a .csv file exported from Excel.');
  pendingWorkouts=parseWorkouts(await file.text());render();toast(`Ready to review ${pendingWorkouts.length} workout(s).`);
}
async function readBackup(file) {
  if (!file || file.size > 8_000_000) throw Error('Choose a JSON backup smaller than 8 MB.');
  if (!/\.json$/i.test(file.name)) throw Error('Choose a .json FitnessPilot backup.');
  pendingBackup=validateBackup(JSON.parse(await file.text()));render();toast('Backup preview ready. No records replaced.');
}

document.addEventListener('click', event=>{
  const button=event.target.closest('[data-page],[data-exercise],[data-action],[data-rest]');if(!button)return;
  if(button.dataset.page){goto(button.dataset.page);return;}
  if(button.dataset.exercise!==undefined){chosenExercise=Number(button.dataset.exercise);render();return;}
  if(button.dataset.rest){tryAction(()=>{const seconds=intRange(button.dataset.rest,'Rest',1,600);timerEnd=Date.now()+seconds*1000;clearInterval(timerHandle);timerHandle=setInterval(timerTick,250);
    try{const A=window.AudioContext||window.webkitAudioContext;if(A){audioContext=audioContext||new A();void audioContext.resume();}}catch{}
    timerTick();toast(`Rest timer started: ${seconds} seconds.`);});return;}
  const act=button.dataset.action;
  tryAction(()=>{
    if(act==='starter'){if(!confirm('Add the example four-day workout plan? Existing logs will not change.'))return;const out=addWorkouts(state,parseWorkouts(STARTER_CSV),true);commit(out.state,`Added ${out.added} workout templates.`);}
    if(act==='pick-csv')$('#csv-file').click();
    if(act==='cancel-csv'){pendingWorkouts=null;render();}
    if(act==='confirm-csv'){if(!pendingWorkouts)throw Error('Choose a CSV first.');const out=addWorkouts(state,pendingWorkouts);pendingWorkouts=null;commit(out.state,`Imported ${out.added}; skipped ${out.skipped} identical template(s).`);}
    if(act==='latest-ul'){
      const result=addWorkouts(state,parseWorkouts(RECOVERY_UL_CSV));
      if(result.added)commit(result.state,`Added ${result.added} Recovery UL templates. Assign them in the schedule above.`);
      else toast('Recovery UL templates already in your library. No duplicates added.');
    }
    if(act==='latest-ul-csv')download('Recovery-Optimized-UL.csv',RECOVERY_UL_CSV+'\r\n','text/csv;charset=utf-8');
    if(act==='unified-ul'){
      const result=addWorkouts(state,parseWorkouts(UNIFIED_UL_CSV));
      if(result.added)commit(result.state,`Added ${result.added} Unified UL templates. Assign them in Plan.`);
      else toast('Unified UL templates already added; no duplicates.');
    }
    if(act==='unified-ul-csv')download('Recovery-Optimized-UL-Unified.csv',UNIFIED_UL_CSV+'\r\n','text/csv;charset=utf-8');
    if(act==='example-csv')download('UpperLower-4-Day.csv',STARTER_CSV+'\r\n','text/csv;charset=utf-8');
    if(act==='backup-export'){if(storageError)throw Error('Cannot export invalid records safely.');download(`FitnessPilot-backup-${today()}.json`,JSON.stringify(state,null,2)+'\n','application/json');toast('Backup file prepared. Store it in Files or iCloud Drive.');}
    if(act==='backup-pick')$('#backup-file').click();
    if(act==='restore-cancel'){pendingBackup=null;render();}
    if(act==='restore-confirm'){if(!pendingBackup)throw Error('Choose a backup file first.');if($('#restore-word')?.value!=='REPLACE')throw Error('Type REPLACE to confirm.');if(!confirm('Replace ALL current local sets, workouts and check-ins with this backup? Export your existing backup first.'))return;const next=pendingBackup;commit(next,'Backup restored. Previous local data replaced.');pendingBackup=null;render();}
    if(act==='calendar'){download(`FitnessPilot-weekly-reminders-${today()}.ics`,calendarICS(state),'text/calendar;charset=utf-8');toast('Calendar file prepared. Import events into your calendar.');}
    if(act==='stop-timer'){timerEnd=null;clearInterval(timerHandle);timerHandle=null;timerTick();toast('Timer stopped.');}
  });
});

document.addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='active-date'){tryAction(()=>{activeDate=target.value;chosenExercise=0;chosenTemplate=null;render();});}
  if(target.id==='active-workout'){chosenTemplate=target.value;chosenExercise=0;render();}
  if(target.id==='csv-file'){const file=target.files?.[0];target.value='';if(file)readCSV(file).catch(e=>toast(e.message,true));}
  if(target.id==='backup-file'){const file=target.files?.[0];target.value='';if(file)readBackup(file).catch(e=>toast(e.message,true));}
});

document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;
  tryAction(()=>{
    if(form.id==='schedule-form'){
      const next=structuredClone(state);const assignments={};
      for(let i=0;i<7;i++){const id=form.elements[`day${i}`].value;if(id){if(!state.templates.some(t=>t.id===id))throw Error(`Unknown workout selected for ${DAY_NAMES[i]}.`);assignments[i]=id;}}
      next.assignments=assignments;commit(next,'Weekly schedule saved. Existing logs preserved.');
    }
    if(form.id==='sets-form'){
      if(!chosenTemplate)throw Error('Select a workout first.');const template=state.templates.find(t=>t.id===chosenTemplate);
      const exercise=template?.exercises[chosenExercise];if(!exercise)throw Error('Select a valid exercise.');
      const entries=Array.from({length:exercise.sets},(_,i)=>({completed:form.elements[`done${i}`].checked,kg:form.elements[`kg${i}`].value,reps:form.elements[`reps${i}`].value,rpe:form.elements[`rpe${i}`].value,rest:form.elements.rest.value,notes:form.elements.notes.value,tempo:form.elements.tempo.value}));
      const out=recordSets(state,{date:activeDate,templateId:chosenTemplate,exerciseIndex:chosenExercise,entries});commit(out.state,`${out.saved} set(s) saved for ${exercise.name}.`);
    }
    if(form.id==='metrics-form'){
      const data=Object.fromEntries(['weight','calories','protein','sleep','recovery'].map(k=>[k,form.elements[k].value]));
      commit(saveMetrics(state,activeDate,data),'Daily check-in saved.');
    }
    if(form.id==='reminder-form'){
      const time=form.elements.time.value;if(!/^\d{2}:\d{2}$/.test(time))throw Error('Choose a valid workout time.');const [h,m]=time.split(':');
      const next=structuredClone(state);next.reminder={hour:intRange(h,'Hour',0,23),minute:intRange(m,'Minute',0,59),lead:intRange(form.elements.lead.value,'Alert lead',0,120)};
      commit(next,'Reminder settings saved. Now export Calendar reminders.');
    }
  });
});
render();
if('serviceWorker' in navigator && location.protocol !== 'file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
initRoFeedback();
