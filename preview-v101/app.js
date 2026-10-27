import { weeklyTrainingAnalysis, lifetimeTrainingSets, setMilestoneProgress } from './training-analytics.js';
import { resetTrackingData } from './tracking-reset.js';
import { METRIC_FIELDS, weeklyMetricSources } from './metric-breakdown.js';
import { readFoodDiaryChart } from './food-diary-chart.js';
import { setsBarsMarkup } from './volume-bars.js';
import { trainingAnalyticsPanel } from './training-analytics-ui.js';
import { initRoFeedback, isRoSoundEnabled } from './ro-feedback.js';
import { symptomPanel } from './symptom-ui.js';
import { addSymptomEntry } from './symptom-journal.js';
import { V101_CSV, V101_VERSION, V101_EQUIPMENT } from './v101-data.js';
import { V102_CSV, V102_VERSION, V102_EQUIPMENT } from './v102-data.js';
import { v102OverlapPanel } from './v102-overlap-ui.js';
import { focusEntries, nextPendingSet, nextPendingExercise } from './focus-mode.js';
import { newlyRecordedSets } from './slime-hit.js';
import { WALKER_KEY, validateWalkerFile, validateWalkerDataUrl, dashboardWalkerBanner } from './dashboard-walker.js';
import { applyWalkerFile, checkWalkerImage, readWalkerDataUrl } from './dashboard-walker-apply.js';
import { createWalkerStill } from './walker-still.js';
import { QUICK_RPE, stepReps, chooseRpe } from './focus-quick-entry.js';
import { repeatLastSessionSet } from './quick-repeat.js';
import { createExerciseVersion } from './template-version.js';
import { workoutLogbookHtml, workoutLogbookCsv } from './workout-logbook.js';
import { manualProgressionPanel } from './manual-progression-ui.js';
import { verifyLocalSnapshot, inspectBackupFileText } from './recovery-check.js';
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
let resetBackupReady = false;
let walkerDataUrl=null, pendingWalkerFile=null;
try{
  const savedWalker=localStorage.getItem(WALKER_KEY);
  if(savedWalker)walkerDataUrl=validateWalkerDataUrl(savedWalker);
}catch{/* Cosmetic avatar falls back; workout records stay untouched. */}

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  state = saved ? validateBackup(JSON.parse(saved)) : emptyState();
} catch(error) {
  state = emptyState(); storageError = `Existing saved data could not be read: ${error.message}. This app will not overwrite it. Keep this browser's website data intact while you investigate the problem.`;
}
let page='dashboard', activeDate=today(), chosenTemplate=null, chosenExercise=0, pendingWorkouts=null, pendingBackup=null;
let focusMode=false, focusSet=0, customizing=null;
let timerEnd=null,timerHandle=null, audioContext=null, toastHandle=null;
const SLIME_HIT_SETTING='fitnesspilot.preview.v101.ui.slime-hit.v1';
let slimeHitEnabled=false,slimeHitTimer=null;
try { slimeHitEnabled=localStorage.getItem(SLIME_HIT_SETTING)==='on'; } catch { /* optional visual feedback stays off */ }
function showSlimeHit() {
  if(!slimeHitEnabled) return;
  const host=$('#slime-hit-root');
  if(!host) return;
  const effect=document.createElement('div');
  effect.className='slime-hit-card';
  effect.innerHTML='<img class="slime-hit-art" src="./slime-hit.svg" alt=""><span class="slime-hit-spark" aria-hidden="true">✦</span><span><strong class="slime-hit-title">Slime hit!</strong><small class="slime-hit-note">New working set saved</small></span>';
  clearTimeout(slimeHitTimer);
  host.replaceChildren(effect);
  slimeHitTimer=setTimeout(()=>{if(effect.parentNode===host)effect.remove();},1500);
}
function toast(msg,error=false) {
  const el=$('#toast'); el.textContent=msg; el.classList.toggle('error',error);el.classList.add('on');
  clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('on'),3600);
}
function commit(next,message) {
  if(storageError) throw Error('Saved data is locked because it could not be read. Do not overwrite your existing record.');
  const clean=validateBackup(next);
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(clean));}
  catch(error) {throw Error(`Could not save locally (${error.name}). Check available device storage; the old records were left untouched.`);}
  state=clean; resetBackupReady=false; render(); if(message)toast(message);
}
function tryAction(fn) {try {fn();}catch(error){toast(error.message||'Operation failed.',true);}}
function goto(next) {page=next;render();$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function navMarkup() {return navItems.map(([id,label])=>`<button type="button" class="tab ${page===id?'active':''}" data-page="${id}" aria-label="${label}" aria-current="${page===id?'page':'false'}">${svg(id)}<span>${label}</span></button>`).join('');}
function heading(kicker,title,subtitle='') {return `<div class="screen-intro"><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>`;}
function shellHeading() {return `<div class="header-row"><div class="wordmark"><img src="./assets/icon.svg" alt=""><span>FitnessPilot</span></div><div class="date-pill">${new Date().toLocaleDateString('en-SG',{month:'short',day:'numeric',weekday:'short'})}</div></div>`;}
function initialCard() {return `<section class="hero codex-quest"><div class="quest-topline"><span>✦ FITNESSPILOT</span><span class="quest-date">GET STARTED</span></div><h1>Set up your first workout plan.</h1><p class="quest-subtitle">Add reusable workout plans, assign training days, and record the sets you actually complete.</p><div class="quest-facts"><span>Private training journal</span><span>Offline-first</span></div><button class="btn" data-page="plan">Open Plan →</button></section>`;}
function startWalkerApply(){
  if(!pendingWalkerFile)throw Error('Choose a WebP file first.');
  const file=validateWalkerFile(pendingWalkerFile);
  if(!confirm('Apply this character on this device?'))return;
  applyWalkerFile(file,localStorage,readWalkerDataUrl,checkWalkerImage).then(data=>{
    walkerDataUrl=data;pendingWalkerFile=null;render();
    toast('Walking avatar applied.');
  }).catch(error=>toast(error.message,true));
}
function dashboardAdventurer(){return dashboardWalkerBanner(walkerDataUrl);}

function gildedSummary(analysis, nextDay, lifetimeSets) {
  const milestone = setMilestoneProgress(lifetimeSets);
  const daysLogged = analysis.days.filter(day => day.completed > 0).length;
  // Off-plan sets are included in the logged total, but not in schedule completion.
  const completion = analysis.planned > 0
    ? `${Math.min(100, Math.round(100 * analysis.assignedCompleted / analysis.planned))}%`
    : '—';
  const nextName = nextDay ? esc(nextDay.t.name) : 'Not scheduled';
  const nextDate = nextDay ? (nextDay.date === today() ? 'Today' : nice(nextDay.date)) : 'Choose days in Plan';
  return `<section class="v151-gold-summary" aria-label="Training progress">
    <div class="v151-gold-head"><span>YOUR TRAINING PROGRESS</span><span>Saved sets only</span></div>
    <div class="v151-gold-feature"><span>Total completed sets</span><strong>${fmt(lifetimeSets)}</strong>
      <small>All-time saved working sets, including bodyweight, timed holds and off-plan sessions</small></div>
    <div class="v151-milestone" aria-label="Lifetime set milestone progress">
      <div class="v151-milestone-top"><span>Next milestone <strong>${fmt(milestone.next)} sets</strong></span><span>${fmt(milestone.next-lifetimeSets)} remaining</span></div>
      <div class="v151-milestone-track" role="progressbar" aria-label="Progress to next lifetime sets milestone" aria-valuemin="${milestone.earned}" aria-valuemax="${milestone.next}" aria-valuenow="${lifetimeSets}"><div class="v151-milestone-fill" style="width:${milestone.percent}%"></div></div>
      <small>${milestone.earned ? `Last milestone reached: ${fmt(milestone.earned)} sets` : 'First milestone: 25 saved working sets'}. No deadline or extra sets required.</small>
    </div>
    <div class="v151-gold-stats">
      <div><span>This week</span><strong>${analysis.completed} sets</strong></div><div><span>Planned sets</span><strong>${analysis.planned}</strong></div>
      <div><span>Schedule completion</span><strong>${completion}</strong></div>
      <div><span>Days with logs</span><strong>${daysLogged}</strong></div>
    </div>
    <div class="v151-gold-next"><span>Next scheduled workout</span><strong>${nextName}</strong><small>${nextDate}</small></div>
    <p>Completion uses assigned workout sets logged, not off-plan sets. Recording one set counts as a day with logs, not a finished session. Missing data is not assumed complete.</p>
  </section>`;
}
function inWeekCards(s, analysis) {return `<div class="kpis grid">
  <div class="card"><div class="kpi-label">Days with logs</div><div class="kpi-value">${analysis.days.filter(day=>day.completed>0).length}</div><div class="kpi-bottom">Days with saved working sets; not finished workouts</div></div>
  <div class="card"><div class="kpi-label">Logged sets</div><div class="kpi-value">${analysis.completed}</div><div class="kpi-bottom">Recorded working sets</div></div>
  <div class="card"><div class="kpi-label">Body weight</div><div class="kpi-value">${s.weight==null?'—':fmt(s.weight)} <small>${s.weight==null?'':'kg'}</small></div><div class="kpi-bottom">Weekly recorded average</div></div>
</div>`;}
function dailyAverageRows(s) {
  const sources = weeklyMetricSources(state.metrics, s.dates);
  const rows = METRIC_FIELDS.map(([label, key, unit]) => {
    const count = sources[key].length;
    return `<div class="data-row"><strong>${label}</strong><div><div class="score">${s[key] == null ? 'Not recorded' : `${fmt(s[key])} ${unit}`}</div><small class="hint">${count} recorded ${count === 1 ? 'day' : 'days'}</small></div></div>`;
  }).join('');
  const dates = METRIC_FIELDS.map(([label, key, unit]) => {
    const entries = sources[key];
    return `<div class="checkin-sources"><strong>${label}</strong>${entries.length ? entries.map(({date, value}) => `<div class="data-row"><span>${esc(nice(date))}</span><span>${fmt(value)} ${unit}</span></div>`).join('') : '<p class="hint">No recorded values this week.</p>'}</div>`;
  }).join('');
  return `${rows}<details class="volume-explanation"><summary>Which dates contribute to these averages?</summary><p class="hint">Only recorded dates in the displayed Monday–Sunday week count. Each measurement has its own number of days. Earlier weeks are excluded. To correct an entry, open Train, choose its workout date, and save the daily check-in again.</p>${dates}</details>`;
}
function dashboard() {
  const s=weeklyStats(state,today()), analysis=weeklyTrainingAnalysis(state,s.dates[0]);
  const best=bestSets(state).filter(log=>state.templates.find(t=>t.id===log.templateId)?.exercises[log.exerciseIndex]?.repUnit!=='seconds_per_side').slice(0,4);
  const chart=setsBarsMarkup(analysis.days);
  const breakdown=analysis.volumeEntries.length
    ? analysis.volumeEntries.map(entry=>`<div class="volume-detail-row"><span>${esc(entry.date)} · ${esc(entry.exercise)} · Set ${entry.set}</span><strong>${fmt(entry.kg)} kg × ${fmt(entry.reps)} = ${fmt(entry.contribution)}</strong></div>`).join('')
    : '<p class="hint">No weight-based sets recorded this week. Bodyweight sets at 0 kg contribute zero; timed holds are excluded.</p>';
  const volumeExplanation=`<details class="volume-explanation"><summary>Show calculation · weight × reps (secondary)</summary><p class="hint">Each saved set contributes its entered kg × completed reps. Dumbbell weights are not automatically doubled; totals are not total repetitions.</p>${breakdown}<div class="volume-detail-total"><strong>Weekly total</strong><strong>${fmt(analysis.loadVolume)} kg × reps</strong></div></details>`;
  const days=DAYS.map((d,i)=>{const t=state.templates.find(t=>t.id===state.assignments[i]);return `<div class="day-tile ${t?'active':''}"><strong>${d}</strong><span>${esc(t?.name||'Rest')}</span></div>`;}).join('');
  const nextDay=(()=>{for(let i=0;i<7;i++){const day=weekdayOf(addDays(today(),i));const t=state.templates.find(t=>t.id===state.assignments[day]);if(t)return {date:addDays(today(),i),t};}return null;})();
  return `${shellHeading()}<a class="fp-top-feature-link fp-top-feature-nutrition" href="./nutrition.html" aria-label="Open Nutrition dashboard"><strong>Nutrition</strong><small>Food and weight trends</small></a><a class="fp-top-feature-link fp-top-feature-cheatsheet" href="./nutrition-cheatsheet.html" aria-label="Open Nutrition Cheatsheet"><strong>Cheatsheet</strong><small>Vitamin units and nutrition references</small></a>${dashboardAdventurer()}${gildedSummary(analysis,nextDay,lifetimeTrainingSets(state))}${!state.templates.length?initialCard():`<section class="hero codex-quest"><div class="quest-topline"><span>✦ NEXT WORKOUT</span><span class="quest-date">${nextDay?(nextDay.date===today()?'TODAY':nice(nextDay.date)):'UNASSIGNED'}</span></div><h1>${nextDay?esc(nextDay.t.name):'Your weekly plan is ready to set up.'}</h1><p class="quest-subtitle">${nextDay?'Your next scheduled workout. Only saved working sets count as progress.':'Choose your training days in Plan before heading into the training hall.'}</p><div class="quest-facts">${nextDay?`<span>${nextDay.t.exercises.length} exercises</span><span>${nextDay.t.exercises.reduce((n,e)=>n+e.sets,0)} planned sets</span><span>${isPTReview(nextDay.t)?'PT review required':'Scheduled'}</span>`:'<span>Choose a plan</span><span>Log actual sets</span>'}</div><button class="btn" data-page="${nextDay?'train':'plan'}">${nextDay?'Open Workout →':'Open Plan →'}</button>${nextDay&&isPTReview(nextDay.t)?'<span class="quest-caution">PT Review is not medical clearance.</span>':''}</section>`}
  <div class="section-label"><h2>This week</h2><span>${nice(s.dates[0])} – ${nice(s.dates[6])}</span></div>${inWeekCards(s,analysis)}
  <div class="two-panels" style="margin-top:12px"><section class="card"><div class="card-head"><div><h2>Completed sets by day</h2><p>Working sets logged each day</p></div><span class="badge">7 DAYS</span></div><div class="day-bars" role="img" aria-label="Completed sets by day: ${analysis.days.map((v,i)=>`${DAYS[i]} ${v.completed} sets`).join('; ')}">${chart}</div><div class="inline-meta"><span class="dot"></span>Chart counts unique logged working sets, not finished sessions.</div>${volumeExplanation}</section>
  <section class="card"><div class="card-head"><div><h2>Your training week</h2><p>Workout assignments</p></div><button class="btn ghost small-btn" data-page="plan">Edit plan →</button></div><div class="day-calendar">${days}</div><div class="inline-meta">${analysis.days.filter(d=>d.assignedCompleted>0).length} assigned day(s) with logged sets · ${s.planned} scheduled. This is not a workout-completion score.</div></section></div>
  ${trainingAnalyticsPanel(state,s.dates[0],today())}
  ${v102OverlapPanel(state,s.dates[0])}
  <section class="card" style="margin-top:16px"><div class="card-head"><div><h2>Nutrition & Weight Journey</h2><p>Record meals and derive daily calories/protein/carbs/fat in a separate diary. Existing check-ins are unchanged.</p></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><a class="btn" href="./food-diary.html">Open Food Diary →</a><a class="btn secondary" href="./nutrition.html">Nutrition trends →</a></div></section>
  ${readFoodDiaryChart(localStorage,today())}
  <div class="section-label"><h2>Insights</h2><span>Only real entries</span></div>
  <div class="two-panels"><section class="card"><div class="card-head"><div><h2>Manual daily check-ins</h2><p>Weekly averages · not derived from Food Diary</p></div><button class="btn ghost small-btn" data-page="train">Add →</button></div>${dailyAverageRows(s)}</section>
  <section class="card"><div class="card-head"><div><h2>Strongest sets</h2><p>Heaviest recorded weight by exercise</p></div></div>${best.length?best.map(l=>`<div class="data-row"><div><strong>${esc(l.exerciseName)}</strong><span>${nice(l.date)}</span></div><div class="score tinted">${fmt(l.kg)} kg × ${l.reps}</div></div>`).join(''):'<div class="empty"><strong>No lifts yet</strong>Your best sets will appear after you save them.</div>'}</section></div><p class="footer-hint">Weight for dumbbells is recorded exactly as entered; volume does not automatically double per-hand weights. Bodyweight moves logged at 0 kg count as sets but contribute 0 kg to volume.</p>`;
}
function rangeSummary(exercise) {
  return exercise.setTargets
    ? exercise.setTargets.map(target => `${target.min}–${target.max}`).join(' / ')
    : `${exercise.min}–${exercise.max}`;
}
const v101Templates = () => parseWorkouts(V101_CSV).map(w => ({
  ...w, sourceVersion: V101_VERSION, equipmentNote: V101_EQUIPMENT,
  requiresClinicalReview: !!w.requiresClinicalReview
}));
const V102_ARMS = {
  'Incline DB Supinating Curl (SS1)': 'Biceps',
  'Lying DB Triceps Extension (SS1)': 'Triceps',
  'DB Hammer Curl (SS1)': 'Biceps',
  'Supported DB Overhead Triceps Ext (SS1)': 'Triceps'
};
const v102Templates = () => parseWorkouts(V102_CSV).map(t => ({
  ...t, sourceVersion: V102_VERSION, equipmentNote: V102_EQUIPMENT,
  requiresClinicalReview: !!t.requiresClinicalReview,
  exercises: t.exercises.map(e => ({
    ...e,
    ...(V102_ARMS[e.name] ? {muscleDetail: V102_ARMS[e.name]} : {}),
    ...(e.repUnit === 'seconds_per_side' && e.sourceNote ? {
      sourceNote: e.sourceNote.replace('app cannot store timed holds',
        'record seconds per side; timed holds are excluded from lifting volume')
    } : {})
  }))
}));
function isPTReview(t) { return !!t?.requiresClinicalReview || !!t?.name?.includes('[PT Review]'); }
function selectFocusSet() {
  const exercise=state.templates.find(t=>t.id===chosenTemplate)?.exercises[chosenExercise];
  const next=exercise ? nextPendingSet(state.logs,activeDate,chosenTemplate,chosenExercise,exercise.sets) : -1;
  focusSet=next<0?0:next;
}
function mayLeaveFocusSet() {
  const form=focusMode ? $('#sets-form') : null;
  if(!form)return true;
  const dirty=Array.from(form.querySelectorAll('input')).some(input=>
    input.type==='checkbox' ? input.checked!==input.defaultChecked : input.value!==input.defaultValue
  );
  return !dirty || confirm('Discard your unsaved set changes?');
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
    if(focusMode) focusSet=Math.min(Math.max(0,focusSet),ex.sets-1);
    const visibleSetIndices=focusMode?[focusSet]:Array.from({length:ex.sets},(_,i)=>i);
    const setFields=visibleSetIndices.map(i=>{
      const old=current.find(l=>l.set===i+1), prior=previous.find(l=>l.set===i+1);
      const target=ex.setTargets?.[i] ?? {min:ex.min,max:ex.max};
      return `<div class="log-grid set-row ${focusMode?'v152-focused-row':''}"><strong class="tiny set-target-label">${i+1}<small>${target.min}–${target.max}</small></strong><input class="field" inputmode="decimal" type="number" min="0" max="500" step="0.5" name="kg${i}" aria-label="Set ${i+1} kilograms" value="${esc(old?.kg??prior?.kg??'')}"><input class="field" inputmode="numeric" type="number" min="1" max="100" step="1" name="reps${i}" aria-label="Set ${i+1} ${ex.repUnit==='seconds_per_side'?'seconds per side':'reps'}" value="${esc(old?.reps??prior?.reps??'')}"><input class="field" inputmode="decimal" type="number" min="1" max="10" step="0.5" name="rpe${i}" aria-label="Set ${i+1} RPE" value="${esc(old?.rpe??'')}">${focusMode?`<span class="v152-set-status">${old?'Saved':'New'}</span>`:`<input class="tick" type="checkbox" name="done${i}" aria-label="Mark set ${i+1} complete" ${old?'checked':''}>`}</div>`;
    }).join('');
    const repeatChoice=focusMode?repeatLastSessionSet(state,{date:activeDate,templateId:selected,exerciseIndex:chosenExercise,set:focusSet+1}):null;
    const repeatButton=repeatChoice?`<div class="v156-repeat"><button class="btn secondary small-btn" type="button" data-action="focus-repeat">↻ Copy saved set ${repeatChoice.sourceSet}</button><span class="hint">${esc(repeatChoice.kg)} kg × ${esc(repeatChoice.reps)} reps. Copies only kg/reps; RPE is entered separately. Review before saving.</span></div>`:'';
    const quickControls=focusMode?`<div class="v1512-quick" aria-label="Optional form-only quick entry">
       <div class="v1512-quick-row"><span>Reps</span><button class="btn secondary small-btn" type="button" data-action="quick-reps-minus" aria-label="Decrease reps by one">−1</button><button class="btn secondary small-btn" type="button" data-action="quick-reps-plus" aria-label="Increase reps by one">+1</button></div>
       <div class="v1512-quick-row"><span>RPE</span>${QUICK_RPE.map(value=>`<button class="btn secondary small-btn" type="button" data-action="quick-rpe" data-quick-rpe="${value}" aria-label="Set RPE to ${value}">${value}</button>`).join('')}</div>
       <p class="hint">Shortcuts only edit these fields. Review values and press Save this set to record; nothing saves automatically.</p>
     </div>`:'';
     const selectedOld=current.find(l=>l.set===focusSet+1);
    const selectedPrior=previous.find(l=>l.set===focusSet+1);
    const focusIntro=focusMode?`<div class="v152-focus-header"><strong>Set ${focusSet+1} of ${ex.sets}</strong><span>${selectedOld?'Editing a saved set':'Not logged yet'}</span></div><p class="v152-history">${selectedOld?'Saved today — values below are editable.':selectedPrior?`Previous: ${esc(selectedPrior.kg)} kg × ${esc(selectedPrior.reps)} ${ex.repUnit==='seconds_per_side'?'seconds/side':'reps'} (${esc(selectedPrior.date)}). Review before saving.`:'No earlier set recorded. Enter actual values before saving.'}</p>`:'';
    const focusNavigation=focusMode?`<div class="v152-set-navigation"><button class="btn secondary small-btn" data-focus-set="${focusSet-1}" type="button" ${focusSet===0?'disabled':''}>← Previous set</button><button class="btn secondary small-btn" data-focus-set="${focusSet+1}" type="button" ${focusSet===ex.sets-1?'disabled':''}>Next set →</button></div><p class="hint">Only the displayed set will be saved. Change the values to match what you actually completed; no weights are increased automatically.</p>`:'';
    const exList=workout.exercises.map((e,i)=>{const done=state.logs.filter(l=>l.date===activeDate && l.templateId===selected && l.exerciseIndex===i).length;return `<button class="exercise-choice ${i===chosenExercise?'active':''}" type="button" data-exercise="${i}"><div><strong>${i+1}. ${esc(e.name)}</strong><span>${esc(e.muscle)} · ${e.sets} sets · ${esc(rangeSummary(e))}</span></div><b>${done}/${e.sets}</b></button>`;}).join('');
    exMarkup=`<div class="section-label"><h2>Exercises</h2><span>Tap to record</span></div><div class="exercise-layout"><div class="stack codex-exercises" aria-label="Choose exercise">${focusMode?`<details class="v152-exercise-picker"><summary>Exercise ${chosenExercise+1} of ${workout.exercises.length} · Change exercise</summary>${exList}</details>`:exList}</div><div class="card codex-log-panel"><div class="card-head"><div><div class="eyebrow">LOG YOUR SETS</div><h2 style="margin-top:5px">${esc(ex.name)}</h2><p>${ex.sets} sets · ${esc(rangeSummary(ex))} ${ex.repUnit==='seconds_per_side'?'seconds/side':'reps'} · ${ex.rest}s rest</p></div><span class="badge">${esc(ex.muscle).toUpperCase()}</span></div>
    ${isPTReview(workout)?'<div class="notice warn"><strong>[PT Review] — Not clinically cleared.</strong> Do not treat this template as approval to train or progress loaded lower-body movements. Seek the recommended professional review.</div>':''}
    ${workout.sourceVersion?`<div class="hint">Source: ${esc(workout.sourceVersion)}</div>`:''}
    ${workout.equipmentNote?`<div class="hint"><strong>Equipment:</strong> ${esc(workout.equipmentNote)}</div>`:''}
    ${ex.sourceNote?`<div class="notice"><strong>Exercise instructions:</strong> ${esc(ex.sourceNote)}</div>`:''}
    ${focusMode?manualProgressionPanel(state,{date:activeDate,templateId:selected,exerciseIndex:chosenExercise,set:focusSet+1}):''}
    <form id="sets-form">${focusIntro}<div class="log-grid"><span class="micro">SET</span><span class="micro">KG</span><span class="micro">${ex.repUnit==='seconds_per_side'?'SEC/SIDE':'REPS'}</span><span class="micro">RPE</span><span class="micro">✓</span></div>${setFields}${repeatButton}${quickControls}<div class="divider"></div><div class="metrics-grid"><label><span class="form-label">Rest (seconds)</span><input class="field" type="number" min="0" max="600" inputmode="numeric" name="rest" value="${current[0]?.rest ?? ex.rest}"></label><label><span class="form-label">Tempo (optional)</span><input class="field" name="tempo" maxlength="40" placeholder="e.g. 3-1-1" value="${esc(current[0]?.tempo??'')}"></label></div><label><span class="form-label">Session note (optional)</span><input class="field" name="notes" maxlength="250" placeholder="How did this movement feel?" value="${esc(current[0]?.notes??'')}"></label><div class="form-actions"><button class="btn" type="submit">${focusMode?'Save this set':'Save checked sets'}</button><button class="btn secondary" data-rest="${ex.rest}" type="button">${ex.rest}s rest timer</button></div>${focusNavigation}${focusMode?'':`<p class="hint" style="margin-top:10px">Check the sets you completed. Saving updates existing checked sets for this day, not historical sets. Use 0 kg for unweighted movements.</p>`}</form></div></div>`;
  } else {exMarkup=`<div class="card empty"><strong>${state.templates.length?'No workout selected':'No templates yet'}</strong>${state.templates.length?'Choose any workout above or assign a day in Plan.':'Go to Dashboard and load the example plan, or import your own CSV in Plan.'}</div>`;}
  return `${shellHeading()}${heading('TRAINING','One set at a time','Choose an exercise, record your completed sets, then rest before the next one.')}
  <div class="card"><div class="two-panels"><label><span class="form-label" style="margin-top:0">Workout date</span><input class="field" type="date" id="active-date" value="${activeDate}"></label><label><span class="form-label" style="margin-top:0">Workout for this date</span><select class="field" id="active-workout">${options}</select></label></div><div class="inline-meta"><span class="dot"></span>${DAY_NAMES[day]} · ${state.logs.filter(l=>l.date===activeDate).length} set(s) saved</div></div>
  ${workout?`<section class="codex-session"><div class="codex-session-heading"><div><div class="eyebrow">CURRENT WORKOUT · ${DAY_NAMES[day]}</div><h2>${esc(workout.name)}</h2></div><div class="codex-count"><strong>${state.logs.filter(l=>l.date===activeDate&&l.templateId===selected).length} / ${workout.exercises.reduce((n,e)=>n+e.sets,0)}</strong><div>sets logged</div></div></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,Math.round(state.logs.filter(l=>l.date===activeDate&&l.templateId===selected).length/workout.exercises.reduce((n,e)=>n+e.sets,0)*100))}%"></div></div><p class="hint">Saved working sets only. No clinical clearance is implied.</p></section>`:'' }
  ${workout?`<div class="v152-mode-toggle"><button type="button" class="btn secondary small-btn" data-action="focus-toggle" aria-pressed="${focusMode}">${focusMode?'Use standard logging':'Try Focus Mode'}</button><span>${focusMode?'One set at a time, with editable values':'Standard log — multiple sets at once'}</span></div>`:''}
  ${exMarkup}<div class="section-label"><h2>Daily check-in</h2><span>${nice(activeDate)}</span></div><section class="card"><form id="metrics-form"><div class="metrics-grid">${[['weight','Body weight (kg)','0.1'],['calories','Calories (kcal)','1'],['protein','Protein (g)','1'],['sleep','Sleep (hours)','0.1'],['recovery','Recovery (1–5)','1']].map(([key,label,step])=>`<label><span class="form-label">${label}</span><input class="field" type="number" inputmode="decimal" step="${step}" name="${key}" value="${esc(metrics[key]??'')}" placeholder="Not recorded"></label>`).join('')}</div><div class="form-actions"><button class="btn secondary" type="submit">Save daily check-in</button></div><p class="hint" style="margin-top:10px">Only enter values you measured. Blank fields are not guessed.</p></form></section>${symptomPanel(activeDate,state,selected)}`;
}
function plan() {
  const assigned = i=>state.assignments[i]||'';
  const rows=DAYS.map((d,i)=>`<div class="schedule-row"><label for="day${i}">${DAY_NAMES[i]}</label><select class="field" id="day${i}" name="day${i}"><option value="">Rest day</option>${state.templates.map(t=>`<option value="${esc(t.id)}" ${assigned(i)===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>`).join('');
  const pending=pendingWorkouts?`<div class="notice"><strong>Import preview ready:</strong> ${pendingWorkouts.length} workout template(s). This adds templates only; it will not alter the existing schedule or workout logs.<div class="preview-list">${pendingWorkouts.map(w=>`<p><strong>${DAY_NAMES[w.day]} · ${esc(w.name)}</strong> — ${w.exercises.length} exercises</p>`).join('')}</div><div class="quick-actions"><button class="btn small-btn" data-action="confirm-csv">Add templates to library</button><button class="btn secondary small-btn" data-action="cancel-csv">Cancel import</button></div></div>`:'';
  const editable=customizing && state.templates.find(t=>t.id===customizing.id);
  const exercise=editable?.exercises?.[customizing?.index];
  const editor=editable && exercise?`<section class="card stack v157-editor" aria-label="Customize exercise">
    <h3>Create a new version of ${esc(editable.name)}</h3>
    <p class="hint">Editing ${esc(exercise.name)}. The original workout, existing logs and weekly schedule stay unchanged. After saving, assign your new custom workout manually.</p>
    <form id="template-version-form">
      <div class="metrics-grid">
        <label><span class="form-label">Exercise</span><input class="field" name="name" maxlength="80" required value="${esc(exercise.name)}"></label>
        <label><span class="form-label">Primary muscle</span><input class="field" name="muscle" maxlength="40" required value="${esc(exercise.muscle)}"></label>
        <label><span class="form-label">Sets</span><input class="field" name="sets" type="number" min="1" max="10" required value="${exercise.sets}"></label>
        <label><span class="form-label">Minimum reps</span><input class="field" name="min" type="number" min="1" max="100" required value="${exercise.min}"></label>
        <label><span class="form-label">Maximum reps</span><input class="field" name="max" type="number" min="1" max="100" required value="${exercise.max}"></label>
        <label><span class="form-label">Rest (seconds)</span><input class="field" name="rest" type="number" min="0" max="600" required value="${exercise.rest}"></label>
      </div>
      <label><span class="form-label">Exercise instructions (for substitutions, write new instructions)</span><textarea class="field" name="sourceNote" maxlength="500" rows="3">${esc(exercise.sourceNote??'')}</textarea></label>
      <p class="hint">PT Review status is preserved. Customized V10.2 routines do not reuse original muscle-overlap estimates. Per-set target exercises retain their target structure.</p>
      <div class="form-actions"><button type="submit" class="btn">Save as new workout version</button><button type="button" class="btn secondary" data-action="cancel-customize">Cancel</button></div>
    </form>
  </section>`:'';
  return `${shellHeading()}${heading('PLAN','Plan your training','Choose workouts, assign training days, and browse your saved templates. Saved sets remain unchanged.')}
  <div class="codex-waypoints" aria-label="Planning steps"><div><b>01</b><span>Add a workout to the library</span></div><div><b>02</b><span>Assign it to training days</span></div><div><b>03</b><span>Log real sets in Train</span></div></div>
  <section class="card codex-board"><div class="card-head"><div><div class="eyebrow">WEEKLY SCHEDULE</div><h2>Choose your training days</h2><p>${Object.keys(state.assignments).filter(k=>state.assignments[k]).length} days assigned · All changes take effect only when you save</p></div></div><form id="schedule-form">${rows}<div class="form-actions"><button class="btn" type="submit">Save weekly schedule</button></div></form></section>
  <div class="section-label"><h2>Current recommended workout · V10.2</h2><span>Optional import</span></div>
  <section class="card stack codex-program"><div class="eyebrow">V10.2 · OVERLAP-AWARE</div><h2>Adaptive Recovery UL — V10.2</h2>
  <p class="subtle small">4 workouts · 24 exercises · 62 planned physical working sets (Mon 17 / Tue 13 / Thu 21 / Fri 11). Lat and upper-back emphasis with optional direct + estimated indirect muscle-set reporting. Importing does not change logs or assignments.</p>
  <div class="notice warn"><strong>PT Review applies to Tuesday and Friday.</strong> Lower-body workouts are not cleared or assigned automatically. Missing journal entries never imply clearance.</div>
  <p class="hint">Overlap estimates use approximate 0 / 0.5 / 1 coefficients, not measured growth or additional physical sets. V10.1 remains available below.</p>
  <div class="quick-actions"><button class="btn" type="button" data-action="v102-add">Add V10.2 Home templates</button><button class="btn secondary" type="button" data-action="v102-csv">Download V10.2 CSV</button></div></section>
  <div class="section-label"><h2>Previous workout version · V10.1</h2><span>Still available</span></div>
  <section class="card stack codex-program"><div class="eyebrow">RECOMMENDED PROGRAM</div><h2>Adaptive Recovery UL · V10.1</h2>
  <p class="subtle small">4 optional templates · 24 exercises · 62 prescribed working sets: Mon 17, Tue 13, Thu 21, Fri 11. Importing does not mark any sets completed or change the schedule. Tuesday and Friday are <strong>[PT Review]</strong> and are not medically cleared.</p>
  <div class="notice warn"><strong>Lower-body clinical review required.</strong> Ongoing or delayed radiating leg symptoms mean these lower-body templates must not be automatically activated. A missing symptom entry never implies medical clearance.</div>
  <p class="hint"><strong>Equipment:</strong> ${esc(V101_EQUIPMENT)}</p>
  <div class="quick-actions"><button type="button" class="btn" data-action="v101-add">Add V10.1 Home templates</button><button type="button" class="btn secondary" data-action="v101-csv">Download canonical V10.1 CSV</button></div>
  <p class="hint">After import, you may manually assign suitable sessions in your weekly schedule. Do not assign the lower-body templates without appropriate clinician review.</p></section>
  <div class="section-label"><h2>Workout library</h2><span>${state.templates.length} saved templates</span></div><p class="hint codex-library-help">These are reusable workout templates—not completed workouts. Tap a loadout to inspect its exercises. Assign it to a weekday above, then save completed sets in Train.</p>
  <section class="codex-library-grid">${state.templates.length ? state.templates.map(t=>`<details class="codex-library-entry"><summary><span class="codex-entry-symbol" aria-hidden="true">✦</span><span class="codex-entry-title"><strong>${esc(t.name)}</strong><small>${t.exercises.length} exercises · ${t.exercises.reduce((n,e)=>n+e.sets,0)} planned sets</small><small>${DAYS.filter((d,i)=>state.assignments[i]===t.id).join(', ')||'Not scheduled'}${isPTReview(t)?' · PT review required':''}</small></span><span class="codex-entry-arrow" aria-hidden="true">⌄</span></summary><div class="codex-entry-body"><strong>Exercise loadout</strong><ul>${t.exercises.map((e,i)=>`<li><span>${esc(e.name)}</span><span>${e.sets} × ${esc(rangeSummary(e))} <button type="button" class="btn secondary small-btn v157-edit-button" data-template-edit="${esc(t.id)}" data-exercise-edit="${i}">Customize</button></span></li>`).join('')}</ul><p class="hint">${isPTReview(t)?'Clinical review is required for this lower-body template. Saving an assignment is not clearance.':'Select this workout in the schedule above; saved sets are recorded separately.'}</p></div></details>`).join(''):'<section class="card empty"><strong>No workout templates yet</strong>Use the V10.1 import above, or import your own CSV below.</section>'}</section>${editor}
  <details class="codex-archive"><summary>Other saved program options <span>Historical & Unified UL</span></summary><div class="codex-archive-body">  <div class="section-label"><h2>Historical training plans</h2></div><section class="card stack"><strong>Recovery-Optimized Upper/Lower · 30 Sep 2026</strong><p class="subtle small">Mon Upper A · Tue Lower A · Thu Upper B · Fri Lower B. Includes top/back-off sets and labelled superset pairs. For Face Pull/Lateral Raise, the third set is optional. Reps listed per arm/leg are per side. Rest is 90 seconds by default unless noted.</p><div class="quick-actions"><button class="btn" type="button" data-action="latest-ul">Add my Recovery UL templates</button><button class="btn secondary" type="button" data-action="latest-ul-csv">Download this plan (.csv)</button></div><p class="hint">Adds templates only. Your current weekly schedule and completed workout sets are unchanged. After import, assign the new workouts to weekdays above and save the schedule.</p></section>
  <div class="section-label"><h2>Unified Recovery UL (per-set targets)</h2></div>
  <section class="card stack"><p class="subtle small">Now one Bench Press, one Goblet Squat, and one Incline Press. Each has different rep targets for top and back-off sets. Your older split templates and saved logs stay available.</p><div class="quick-actions"><button class="btn" type="button" data-action="unified-ul">Add Unified Upper/Lower plan</button><button class="btn secondary" type="button" data-action="unified-ul-csv">Download Unified plan (.csv)</button></div><p class="hint">Adding these templates does not change your current workout days. Choose the new Unified workouts in the schedule above, then save.</p></section>
</div></details>
  <div class="section-label"><h2>Import a custom workout</h2><span>CSV file</span></div><section class="card stack"><p class="subtle small">In Excel, choose <strong>Save As → CSV UTF-8</strong>. Then select that file here. The original .xlsx file is not imported directly.</p><div class="upload-card"><div class="file-ico">↓</div><div style="flex:1;min-width:140px"><strong>Excel-exported CSV</strong><p class="subtle small">Up to 500 exercises · Max 1 MB</p></div><button class="btn secondary small-btn" data-action="pick-csv">Choose CSV</button></div>${pending}<div class="quick-actions"><button class="btn ghost small-btn" data-action="example-csv">Download example CSV →</button></div><p class="hint">Required columns: day, workout, exercise, muscle, sets, rep_min, rep_max. Optional: rest_seconds. Identical imports are skipped; imported templates do not replace completed workouts.</p></section>`;
}
function tools() {
  const resetCounts=resetTrackingData(state).counts;
  const reminder=state.reminder, time=`${String(reminder.hour).padStart(2,'0')}:${String(reminder.minute).padStart(2,'0')}`;
  const backupInfo=pendingBackup?`<div class="notice warn"><strong>Backup checked:</strong> ${pendingBackup.templates.length} templates, ${pendingBackup.logs.length} saved sets, ${pendingBackup.metrics.length} daily entries, ${(pendingBackup.symptomLogs??[]).length} symptom observations. <strong>Restore replaces all data currently in this app.</strong><label><span class="form-label">Type REPLACE to confirm</span><input class="field" type="text" id="restore-word" autocomplete="off" placeholder="REPLACE"></label><div class="form-actions"><button class="btn danger" data-action="restore-confirm">Replace with this backup</button><button class="btn secondary" data-action="restore-cancel">Cancel</button></div></div>`:'';
  return `${shellHeading()}${heading('ADVENTURER\'S KIT','Tools & data','Back up your progress first, then customize sounds, rest times and calendar reminders.')}
  <div class="codex-utility-intro"><strong>Keep your journey safe</strong><span>Your logs stay on this device. Download a backup before testing restores or changing devices.</span></div>
  <div class="section-label"><h2>Data vault</h2><span>Local to this browser</span></div><section class="card stack codex-vault"><div class="notice"><strong>Saved on this device only.</strong> Your sets and templates stay in this browser's local storage. They are not sent to us or synced to another device. Clearing website data, deleting the Home Screen app, or switching devices can remove access to them.</div><div class="quick-actions"><button class="btn" data-action="backup-export">Download full backup (.json)</button><button class="btn secondary" data-action="backup-verify">Check saved data integrity</button><button class="btn secondary" data-action="backup-file-check">Check downloaded backup (.json) — no restore</button><button class="btn secondary" data-action="backup-pick">Restore backup</button></div>${backupInfo}<p class="hint">Export a backup after every important training week. Keep the JSON file in iCloud Drive or another place you control. Restoring is destructive, so this app will preview the file and require an explicit confirmation. The saved-data check reads browser storage. The downloaded-backup check reads a chosen file without restoring it; separate-device restore still needs acceptance testing.</p></section>
  <div class="section-label"><h2>Reset tracking records</h2><span>Keep uploaded workouts</span></div>
  <section class="card stack"><div class="notice warn"><strong>Destructive reset — no automatic undo.</strong> Remove saved working sets, daily weight/nutrition/sleep/recovery check-ins and symptom observations from this preview. Preserve all uploaded workout templates, exercise targets, weekday assignments and reminder settings.</div>
    <p class="hint">Preview: ${resetCounts.setsRemoved} saved sets, ${resetCounts.checkinsRemoved} daily check-ins and ${resetCounts.symptomsRemoved} symptom observations would be erased. ${resetCounts.templatesKept} workout templates and ${resetCounts.assignmentsKept} weekday assignments will be kept.</p>
    <p class="hint"><strong>Before resetting:</strong> use Download full backup (.json), then Check downloaded backup (.json) above and select the file you just saved. It must match the current records exactly. Verify that your file is accessible in Files. ${resetBackupReady?'<strong>Current backup file matches.</strong>':'<strong>No matching backup verified yet.</strong>'}</p>
    <label><input type="checkbox" id="tracking-reset-ack"> I saved and checked my full backup, and understand the recorded data will be deleted.</label>
    <label><span class="form-label">Type RESET LOGS to confirm</span><input id="tracking-reset-word" class="field" type="text" autocomplete="off" placeholder="RESET LOGS"></label>
    <div class="form-actions"><button class="btn danger" type="button" data-action="tracking-reset-apply">Reset recorded data (keep workouts)</button></div>
  </section>
  <div class="section-label"><h2>iPhone QA · preview only</h2></div><section class="card stack"><strong>Check this test build before using real records.</strong><p class="hint">Open the manual acceptance checklist in another tab. Mark Pass, Fail or Blocked, then download a JSON report. The checklist does not inspect or change your saved workouts.</p><p><a class="btn secondary" href="./qa.html?v=43" target="_blank" rel="noopener noreferrer">Open iPhone QA checklist</a></p></section>
  <div class="section-label"><h2>Workout logbook</h2><span>Saved set history</span></div>
  <section class="card stack v158-logbook"><div class="card-head"><div><h2>Your training archive</h2><p>Past workout versions and their actual logged sets</p></div><button type="button" class="btn secondary small-btn" data-action="logbook-export">Download full history (.csv)</button></div>
    <p class="hint">All records stay on this device. Downloading CSV creates a local file containing your workout details and notes. It does not change your saved workouts.</p>
    ${workoutLogbookHtml(state)}</section>
  <div class="section-label"><h2>Button sound</h2></div><section class="card codex-sound"><label class="ro-sound-switch"><input type="checkbox" id="ro-click-sound" ${isRoSoundEnabled()?'checked':''}> Slime squish sound</label><p id="ro-sound-status" role="status" class="hint">Switch on to test the sound immediately, then tap any button. Check iPhone volume if it stays silent.</p></section>
  <div class="section-label"><h2>Walking avatar</h2></div><section class="card stack"><p class="hint">Local WebP only (max 600 KB). Walks in place over a translucent stage on Dashboard.</p><div class="form-actions"><button class="btn secondary" data-action="walker-pick">Choose WebP</button><button class="btn" data-action="walker-apply">Apply selected avatar</button><button class="btn ghost" data-action="walker-remove">Remove avatar</button></div><p class="hint" id="walker-status">${walkerDataUrl?'Private WebP saved. If Reduce Motion is enabled, Dashboard shows a still of your character. For walking motion, enable Animation effects in device accessibility settings.':'No private WebP saved; choose one to preview.'}</p></section><div class="section-label"><h2>Slime hit</h2></div><section class="card codex-sound"><label class="ro-sound-switch"><input id="slime-hit-enabled" type="checkbox" ${slimeHitEnabled?'checked':''}> Show slime reaction after new saved sets</label><p class="hint">Silent and optional. No hits for edits or failed saves, and no XP or loot. This cosmetic preview preference is separate from workout JSON backups.</p></section>
  <div class="section-label"><h2>Rest clock</h2><span>Runs while app is open</span></div><section class="card codex-timer"><div id="timer-display" class="rest-timer">${timerRemaining()}</div><p class="subtle small">An optional countdown for time between sets. iPhone may pause it in the background.</p><div class="form-actions"><button class="btn secondary" data-rest="60">1 minute</button><button class="btn secondary" data-rest="90">90 seconds</button><button class="btn secondary" data-rest="120">2 minutes</button><button class="btn ghost" data-action="stop-timer">Stop</button></div></section>
  <div class="section-label"><h2>Calendar reminders</h2><span>Optional</span></div>
  <section class="card codex-reminders"><div class="card-head"><div><h2>Workout reminders</h2><p>Uses your iPhone Calendar — even when FitnessPilot is closed</p></div><span class="badge">CALENDAR</span></div><form id="reminder-form"><div class="metrics-grid"><label><span class="form-label">Workout time</span><input class="field" type="time" name="time" required value="${time}"></label><label><span class="form-label">Alert ahead of time</span><select class="field" name="lead"><option value="0" ${reminder.lead===0?'selected':''}>At workout time</option><option value="5" ${reminder.lead===5?'selected':''}>5 minutes before</option><option value="15" ${reminder.lead===15?'selected':''}>15 minutes before</option><option value="30" ${reminder.lead===30?'selected':''}>30 minutes before</option><option value="60" ${reminder.lead===60?'selected':''}>1 hour before</option></select></label></div><div class="form-actions"><button class="btn" type="submit">Save alert settings</button><button class="btn secondary" type="button" data-action="calendar">Export Calendar reminders (.ics)</button></div></form><p class="hint" style="margin-top:14px">First save your settings, then export the .ics file. Import it into a calendar that supports .ics events and alarms. Some iPhone import paths may require emailing the file to yourself or using a computer calendar. Check the alert in Apple Calendar after import. If you change the schedule, remove previous imported events and export again to avoid duplicate alerts.</p><div class="notice warn"><strong>Not a Clock alarm.</strong> This web app cannot force a loud full-screen ring while closed. Calendar notifications depend on your phone's notification, Focus and Silent settings. Use the iPhone Clock app if an audible alarm is essential.</div></section>
  <p class="app-footer">FitnessPilot Web v1 · No accounts · No analytics · No advertisements</p>`;
}
function timerRemaining(){if(!timerEnd)return '00:00';const n=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function timerTick() {const display=$('#timer-display');if(display)display.textContent=timerRemaining();if(timerEnd && timerEnd<=Date.now()){timerEnd=null;clearInterval(timerHandle);timerHandle=null;try{if(audioContext){const osc=audioContext.createOscillator();const gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);osc.frequency.value=740;gain.gain.value=.15;osc.start();osc.stop(audioContext.currentTime+.35);}}catch{}toast('Rest timer finished. Time for your next set!');}}
function inspectWalkerDisplay(){
  const image=$('.fp-walker-sprite');
  const status=$('#walker-render-status');
  if(!image||!status)return;
  const generic='./adventurer-idle.svg';
  const selected=walkerDataUrl;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  // Exactly one visible <img>. Preload replacement off-DOM; never stack a second body.
  function useAvatar(src,successLabel){
    const probe=new Image();
    const current=()=>image.isConnected && walkerDataUrl===selected;
    probe.onload=()=>{
      if(!current())return;
      image.onload=()=>{if(current())status.textContent=successLabel;};
      image.onerror=()=>{
        if(!current())return;
        image.onload=null;image.onerror=null;
        image.src=generic;
        status.textContent='Personal image could not be displayed; default character shown.';
      };
      image.src=src;
      if(image.complete&&image.naturalWidth>0)status.textContent=successLabel;
    };
    probe.onerror=()=>{
      if(!current())return;
      image.src=generic;
      status.textContent='Personal image could not be displayed; default character shown.';
    };
    probe.src=src;
  }
  if(!selected){
    status.textContent='Default adventurer displayed';
    return;
  }
  if(reduced){
    status.textContent='Reduce Motion: preparing one still frame of your character…';
    createWalkerStill(selected).then(png=>{
      if(!image.isConnected || walkerDataUrl!==selected)return;
      useAvatar(png,'Your character (still frame). Turn on animations to see walking.');
    }).catch(()=>{
      if(!image.isConnected || walkerDataUrl!==selected)return;
      image.src=generic;
      status.textContent='Personal still could not be created; default character shown.';
    });
    return;
  }
  status.textContent='Loading one walking character…';
  useAvatar(selected,'Personal walker loaded: walking in place toward the right.');
}
function render(){const markup=navMarkup();$('.bottom-tabs').innerHTML=markup;$('.desktop-tabs').innerHTML=markup;$('#main').innerHTML=`${storageError?`<div class="error-strip" role="alert">${esc(storageError)}</div>`:''}${page==='dashboard'?dashboard():page==='train'?train():page==='plan'?plan():tools()}`;inspectWalkerDisplay();timerTick();}
function download(filename,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function readCSV(file) {
  if (!file || file.size > 1_000_000) throw Error('Choose a CSV smaller than 1 MB.');
  if (!/\.csv$/i.test(file.name)) throw Error('Choose a .csv file exported from Excel.');
  pendingWorkouts=parseWorkouts(await file.text());render();toast(`Ready to review ${pendingWorkouts.length} workout(s).`);
}
async function readBackup(file) {
  if (!file || file.size > 8_000_000) throw Error('Choose a JSON backup smaller than 8 MB.');
  if (!/\.json$/i.test(file.name)) throw Error('Choose a .json FitnessPilot backup.');
  pendingBackup=null;
  pendingBackup=validateBackup(JSON.parse(await file.text()));render();toast('Backup preview ready. No records replaced.');
}

document.addEventListener('click', event=>{
  const button=event.target.closest('[data-page],[data-exercise],[data-action],[data-rest],[data-focus-set],[data-template-edit]');if(!button)return;
  if(button.dataset.page){
    if(button.dataset.page===page)return;
    if(!mayLeaveFocusSet())return;
    goto(button.dataset.page);return;
  }
  if(button.dataset.exercise!==undefined){
    const next=Number(button.dataset.exercise);
    if(next===chosenExercise)return;
    if(!mayLeaveFocusSet())return;
    chosenExercise=next;selectFocusSet();render();return;
  }
  if(button.dataset.focusSet!==undefined){
    const next=Number(button.dataset.focusSet);
    const ex=state.templates.find(t=>t.id===chosenTemplate)?.exercises[chosenExercise];
    if(Number.isInteger(next)&&ex&&next>=0&&next<ex.sets){
      if(next===focusSet)return;
      if(!mayLeaveFocusSet())return;
      focusSet=next;render();
    }
    return;
  }
  if(button.dataset.templateEdit!==undefined) {
    tryAction(()=>{
      const id=button.dataset.templateEdit,index=Number(button.dataset.exerciseEdit);
      const template=state.templates.find(t=>t.id===id);
      if(!template || !Number.isInteger(index) || !template.exercises[index])throw Error('Choose a saved workout exercise.');
      customizing={id,index};render();
      document.getElementById('template-version-form')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    return;
  }
  if(button.dataset.rest){tryAction(()=>{const seconds=intRange(button.dataset.rest,'Rest',1,600);timerEnd=Date.now()+seconds*1000;clearInterval(timerHandle);timerHandle=setInterval(timerTick,250);
    try{const A=window.AudioContext||window.webkitAudioContext;if(A){audioContext=audioContext||new A();void audioContext.resume();}}catch{}
    timerTick();toast(`Rest timer started: ${seconds} seconds.`);});return;}
  const act=button.dataset.action;
  tryAction(()=>{
    if(act==='cancel-customize'){customizing=null;render();return;}
    if(act==='quick-reps-minus' || act==='quick-reps-plus' || act==='quick-rpe') {
      if(!focusMode)throw Error('Switch to Focus Mode for quick entry.');
      const form=$('#sets-form');
      if(!form)throw Error('The current set form is unavailable.');
      if(act==='quick-rpe') {
        const input=form.elements[`rpe${focusSet}`];
        if(!input)throw Error('The current RPE field is unavailable.');
        input.value=chooseRpe(button.dataset.quickRpe);
      } else {
        const input=form.elements[`reps${focusSet}`];
        if(!input)throw Error('The current reps field is unavailable.');
        input.value=stepReps(input.value,act==='quick-reps-plus'?1:-1);
      }
      return; // No commit; the existing Save this set is still required.
    }
    if(act==='focus-repeat') {
      if(!focusMode)throw Error('Switch to Focus Mode first.');
      const choice=repeatLastSessionSet(state,{date:activeDate,templateId:chosenTemplate,exerciseIndex:chosenExercise,set:focusSet+1});
      if(!choice)throw Error('No eligible earlier saved set to copy.');
      const form=$('#sets-form');
      if(!form)throw Error('The current set form is unavailable.');
      const kg=form.elements[`kg${focusSet}`],reps=form.elements[`reps${focusSet}`];
      if(!kg||!reps)throw Error('Weight/reps fields are unavailable.');
      const edited=kg.value!==kg.defaultValue||reps.value!==reps.defaultValue;
      if(edited&&!confirm('Replace your unsaved weight and reps with the previously saved set?'))return;
      kg.value=String(choice.kg);
      reps.value=String(choice.reps);
      toast(`Copied saved set ${choice.sourceSet}. Check actual weight and reps, enter today's RPE, then save.`);
      return;
    }
    if(act==='focus-toggle') {
      if(!mayLeaveFocusSet())return;
      focusMode=!focusMode;
      if(focusMode) selectFocusSet();
      render();
      return;
    }
    if(act==='v102-add') {
      const result=addWorkouts(state,v102Templates(),false);
      if(result.added)commit(result.state,`Added ${result.added} V10.2 templates. Existing saved sets and schedule are unchanged.`);
      else toast('V10.2 templates already in the test library.');
    }
    if(act==='v102-csv')download('V10.2_Home_FitnessPilot_Import.csv',V102_CSV,'text/csv;charset=utf-8');
    if(act==='v101-add') {
      const out=addWorkouts(state,v101Templates(),false);
      if(out.added)commit(out.state,`Added ${out.added} V10.1 templates. Your schedule and workout history are unchanged.`);
      else toast('V10.1 templates already present. No duplicates added.');
    }
    if(act==='v101-csv')download('V10.1_Home_FitnessPilot_Import.csv',V101_CSV,'text/csv;charset=utf-8');
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
    if(act==='tracking-reset-apply'){
      if(storageError)throw Error('Stored data is locked; do not reset it.');
      if(!resetBackupReady)throw Error('First download and check a matching current backup in Tools.');
      if(!$('#tracking-reset-ack')?.checked)throw Error('Confirm that the backup was saved and checked.');
      if($('#tracking-reset-word')?.value!=='RESET LOGS')throw Error('Type RESET LOGS exactly to confirm.');
      if(localStorage.getItem(STORAGE_KEY)!==JSON.stringify(state))throw Error('Saved data changed since it was loaded. Reload and verify another backup before resetting.');
      const preview=resetTrackingData(state);
      if(!confirm(`Permanently remove ${preview.counts.setsRemoved} recorded sets, ${preview.counts.checkinsRemoved} daily check-ins and ${preview.counts.symptomsRemoved} symptom entries? Keep ${preview.counts.templatesKept} workout templates and weekday assignments? This cannot be undone without a backup.`))return;
      const applied=resetTrackingData(state,{apply:true});
      commit(applied.nextState,'Recorded training and check-in history reset. Workout templates and schedules kept.');
      pendingBackup=null;
      render();
      return;
    }
    if(act==='walker-pick'){$('#walker-file').click();return;}
    if(act==='walker-apply'){startWalkerApply();return;}
    if(act==='walker-remove'){
      if(!walkerDataUrl){toast('No private walking avatar to remove.');return;}
      if(!confirm('Remove the private walking picture? Saved workouts remain unchanged.'))return;
      try{localStorage.removeItem(WALKER_KEY);}
      catch{throw Error('Could not remove the avatar; no changes made.');}
      walkerDataUrl=null;pendingWalkerFile=null;render();toast('Private avatar removed.');
      return;
    }
    if(act==='backup-verify'){
      const report=verifyLocalSnapshot(state,localStorage.getItem(STORAGE_KEY));
      toast(`Saved data checked: ${report.templates} templates, ${report.sets} sets, ${report.symptoms} symptom observations. No data changed.`);
    }
    if(act==='logbook-export'){download(`FitnessPilot-workout-history-${today()}.csv`,workoutLogbookCsv(state),'text/csv;charset=utf-8');toast('Workout logbook CSV prepared. Store this personal file privately.');}
    if(act==='backup-export'){if(storageError)throw Error('Cannot export invalid records safely.');download(`FitnessPilot-PREVIEW-backup-${today()}.json`,JSON.stringify(state,null,2)+'\n','application/json');toast('Backup file prepared. Store it in Files or iCloud Drive.');}
    if(act==='backup-pick')$('#backup-file').click();
    if(act==='backup-file-check')$('#backup-check-file').click();
    if(act==='restore-cancel'){pendingBackup=null;render();}
    if(act==='restore-confirm'){if(!pendingBackup)throw Error('Choose a backup file first.');if($('#restore-word')?.value!=='REPLACE')throw Error('Type REPLACE to confirm.');if(!confirm('Replace ALL current local sets, workouts and check-ins with this backup? Export your existing backup first.'))return;const next=pendingBackup;commit(next,'Backup restored. Previous local data replaced.');pendingBackup=null;render();}
    if(act==='calendar'){download(`FitnessPilot-weekly-reminders-${today()}.ics`,calendarICS(state),'text/calendar;charset=utf-8');toast('Calendar file prepared. Import events into your calendar.');}
    if(act==='stop-timer'){timerEnd=null;clearInterval(timerHandle);timerHandle=null;timerTick();toast('Timer stopped.');}
  });
});

document.addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='walker-file'){
    const file=target.files?.[0];target.value='';
    if(!file)return;
    try{
      pendingWalkerFile=validateWalkerFile(file);
      const status=$('#walker-status');
      if(status)status.textContent='Selected '+file.name+'. Tap Apply selected avatar.';
    }catch(error){pendingWalkerFile=null;toast(error.message,true);}
    return;
  }
  if(target.id==='slime-hit-enabled'){
    try {
      localStorage.setItem(SLIME_HIT_SETTING,target.checked?'on':'off');
      slimeHitEnabled=target.checked;
      toast(slimeHitEnabled?'Slime reaction enabled.':'Slime reaction disabled.');
    } catch {
      target.checked=slimeHitEnabled;
      toast('Could not save slime setting; no change made.',true);
    }
    return;
  }
  if(target.id==='active-date'){
    if(!mayLeaveFocusSet()){target.value=activeDate;return;}
    tryAction(()=>{activeDate=target.value;chosenExercise=0;chosenTemplate=null;focusSet=0;render();});
  }
  if(target.id==='active-workout'){
    if(!mayLeaveFocusSet()){target.value=chosenTemplate||state.assignments[weekdayOf(activeDate)]||'';return;}
    chosenTemplate=target.value;chosenExercise=0;selectFocusSet();render();
  }
  if(target.id==='symptom-template'){
    const tmpl=state.templates.find(t=>t.id===target.value);
    const list=$('#symptom-exercise');
    if(list)list.innerHTML='<option value="">Whole workout / not exercise-specific</option>'+(tmpl?tmpl.exercises.map((e,i)=>`<option value="${i}">${i+1}. ${esc(e.name)}</option>`).join(''):'');
  }
  if(target.id==='csv-file'){const file=target.files?.[0];target.value='';if(file)readCSV(file).catch(e=>toast(e.message,true));}
  if(target.id==='backup-file'){const file=target.files?.[0];target.value='';if(file)readBackup(file).catch(e=>{pendingBackup=null;render();toast(e.message,true);});}
  if(target.id==='backup-check-file'){
    const file=target.files?.[0];target.value='';
    if(file) (async()=>{
      resetBackupReady=false;
      if(file.size>8_000_000 || !/\.json$/i.test(file.name))throw Error('Choose a .json backup smaller than 8 MB.');
      resetBackupReady=false;
      const raw=await file.text();
      const summary=inspectBackupFileText(raw);
      const current=JSON.stringify(state);
      const checked=JSON.stringify(validateBackup(JSON.parse(raw)));
      resetBackupReady=!storageError && checked===current && localStorage.getItem(STORAGE_KEY)===current;
      render();
      toast(resetBackupReady
        ? `Matching full backup verified: ${summary.templates} templates and ${summary.sets} recorded sets. Nothing restored.`
        : `Backup file valid but does not match current browser records. Nothing restored; a matching backup is required to reset.`);

    })().catch(error=>{resetBackupReady=false;render();toast(error.message,true);});
  }
});

document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;
  tryAction(()=>{
    if(form.id==='template-version-form'){
      if(!customizing)throw Error('Select a saved exercise to customize first.');
      const changes=Object.fromEntries(['name','muscle','sets','min','max','rest','sourceNote']
        .map(key=>[key,form.elements[key].value]));
      const out=createExerciseVersion(state,customizing.id,customizing.index,changes);
      if(!confirm(`Add "${out.template.name}" as a NEW workout? Your original, schedules, and logged sets remain unchanged.`))return;
      commit(out.state,`Custom workout "${out.template.name}" added. Assign it in Plan when ready.`);
      customizing=null;
      return;
    }
    if(form.id==='schedule-form'){
      const next=structuredClone(state);const assignments={};
      for(let i=0;i<7;i++){const id=form.elements[`day${i}`].value;if(id){if(!state.templates.some(t=>t.id===id))throw Error(`Unknown workout selected for ${DAY_NAMES[i]}.`);assignments[i]=id;}}
      const newlyAssignedPT=Object.entries(assignments).some(([day,id])=>
        state.assignments[day]!==id && isPTReview(state.templates.find(t=>t.id===id))
      );
      if(newlyAssignedPT && !confirm('This workout is marked [PT Review] and is NOT clinically cleared. Assigning it is only scheduling, not medical approval. Continue?'))return;
      next.assignments=assignments;commit(next,'Weekly schedule saved. Existing logs preserved.');
    }
    if(form.id==='sets-form'){
      if(!chosenTemplate)throw Error('Select a workout first.');const template=state.templates.find(t=>t.id===chosenTemplate);
      const exercise=template?.exercises[chosenExercise];if(!exercise)throw Error('Select a valid exercise.');
      const shared={rest:form.elements.rest.value,notes:form.elements.notes.value,tempo:form.elements.tempo.value};
      const entries=focusMode
        ? focusEntries(exercise.sets,focusSet,{...shared,kg:form.elements[`kg${focusSet}`].value,reps:form.elements[`reps${focusSet}`].value,rpe:form.elements[`rpe${focusSet}`].value})
        : Array.from({length:exercise.sets},(_,i)=>({...shared,completed:form.elements[`done${i}`].checked,kg:form.elements[`kg${i}`].value,reps:form.elements[`reps${i}`].value,rpe:form.elements[`rpe${i}`].value}));
      const out=recordSets(state,{date:activeDate,templateId:chosenTemplate,exerciseIndex:chosenExercise,entries});
      const freshSets=newlyRecordedSets(state,out.state,{date:activeDate,templateId:chosenTemplate,exerciseIndex:chosenExercise});
      let following=null;
      if(focusMode) {
        const nextSet=nextPendingSet(out.state.logs,activeDate,chosenTemplate,chosenExercise,exercise.sets,focusSet);
        if(nextSet>=0) following={exercise:chosenExercise,set:nextSet};
        else {
          const nextExercise=nextPendingExercise(out.state.logs,activeDate,chosenTemplate,template.exercises,chosenExercise);
          if(nextExercise>=0) {
            following={exercise:nextExercise,
              set:nextPendingSet(out.state.logs,activeDate,chosenTemplate,nextExercise,template.exercises[nextExercise].sets)};
          }
        }
      }
      // Navigate only after localStorage has accepted the saved record.
      commit(out.state,`${out.saved} set(s) saved for ${exercise.name}.`);
      if(following){chosenExercise=following.exercise;focusSet=following.set;render();}
      if(freshSets>0)showSlimeHit();
    }
    if(form.id==='symptom-form'){
      const draft={
        date:activeDate, timepoint:form.elements.timepoint.value,
        templateId:form.elements.templateId.value||null,
        exerciseIndex:form.elements.exerciseIndex.value===''?null:Number(form.elements.exerciseIndex.value),
        side:form.elements.side.value,location:form.elements.location.value,
        severity:form.elements.severity.value,tingling:form.elements.tingling.checked,
        numbness:form.elements.numbness.checked,functionChange:form.elements.functionChange.value,
        notes:form.elements.notes.value
      };
      commit(addSymptomEntry(state,draft),'Symptom observation saved locally and included in full backups.');
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
