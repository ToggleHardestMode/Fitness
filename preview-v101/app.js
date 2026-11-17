import { esc } from './html.js';
import { dashboardView } from './dashboard-view.js';
import { trainView } from './train-view.js';
import { resetTrackingData } from './tracking-reset.js';
import { initRoFeedback, isRoSoundEnabled } from './ro-feedback.js';
import { addSymptomEntry } from './symptom-journal.js';
import { V101_CSV, V101_VERSION, V101_EQUIPMENT } from './v101-data.js';
import { V102_CSV, V102_VERSION, V102_EQUIPMENT } from './v102-data.js';
import {V103_CSV, v103Templates} from './v103-data.js';
import { focusEntries, nextPendingSet, nextPendingExercise } from './focus-mode.js';
import { newlyRecordedSets } from './slime-hit.js';
import { WALKER_KEY, validateWalkerFile, validateWalkerDataUrl } from './dashboard-walker.js';
import { applyWalkerFile, checkWalkerImage, readWalkerDataUrl } from './dashboard-walker-apply.js';
import { createWalkerStill } from './walker-still.js';
import { stepReps, chooseRpe } from './focus-quick-entry.js';
import { createFloatingRestTimer, restClock } from './floating-rest.js';
import { repeatLastSessionSet } from './quick-repeat.js';
import { createExerciseVersion } from './template-version.js';
import {generateOneSetCoverage} from './return-coverage.js';
import { returnStagePanel } from './return-training-ui.js';
import { workoutLogbookHtml, workoutLogbookCsv } from './workout-logbook.js';
import { mondayOf, shiftWeek, latestLoggedWeek } from './week-window.js';
import { setActiveSets } from './active-sets.js';
import { recordExerciseClearance, revokeExerciseClearance } from './exercise-clearance.js';
import { addExerciseEquivalence, removeExerciseEquivalence, linkCandidates } from './exercise-equivalence.js';
import {previewCompletedCsv, applyCompletedCsv, blankCompletedCsv} from './completed-workout-csv.js';
import { verifyLocalSnapshot, inspectBackupFileText } from './recovery-check.js';
import { workoutBackupStatus, markWorkoutBackupChecked, persistentStorageStatus, requestPersistentStorage } from './backup-reminder.js';
import { loadWorkoutState, saveWorkoutState } from './state.js';
import { DAYS, DAY_NAMES, STORAGE_KEY, emptyState, STARTER_CSV, parseWorkouts, addWorkouts, recordSets, saveMetrics, dateKey, dateFromKey, weekdayOf, calendarICS, validateBackup, intRange, RECOVERY_UL_CSV, UNIFIED_UL_CSV } from './core.js';

const $ = selector => document.querySelector(selector);
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

let resetBackupReady = false;
let storagePersistenceStatusLabel='Checking browser storage…', storagePersistenceRequestPending=false;
let walkerDataUrl=null, pendingWalkerFile=null;
try{
  const savedWalker=localStorage.getItem(WALKER_KEY);
  if(savedWalker)walkerDataUrl=validateWalkerDataUrl(savedWalker);
}catch{/* Cosmetic avatar falls back; workout records stay untouched. */}

let { state, storageError } = loadWorkoutState();
let page='dashboard', activeDate=today(), chosenTemplate=null, chosenExercise=0, pendingWorkouts=null, pendingBackup=null;
let focusMode=false, focusSet=0, customizing=null, pendingReturnStage=null, pendingV103=null;
let strengthJourneyIndex=0;
let selectedWeekStart=null; // UI-only; null always follows the current week.
let strengthViewMetric='load', strengthHistoryFilter='all';
let pendingCompletedCsv=null, pendingCompletedSnapshot=null;
let toastHandle=null;
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
  state = saveWorkoutState(next, storageError);
  resetBackupReady=false; pendingReturnStage=null; pendingV103=null; render(); if(message)toast(message);
}
function tryAction(fn) {try {fn();}catch(error){toast(error.message||'Operation failed.',true);}}
function goto(next) {page=next;render();$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function navMarkup() {return navItems.map(([id,label])=>`<button type="button" class="tab ${page===id?'active':''}" data-page="${id}" aria-label="${label}" aria-current="${page===id?'page':'false'}">${svg(id)}<span>${label}</span></button>`).join('');}
function heading(kicker,title,subtitle='') {return `<div class="screen-intro"><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>`;}
function shellHeading() {return `<div class="header-row"><div class="wordmark"><img src="./assets/icon.svg" alt=""><span>FitnessPilot</span></div><div class="date-pill">${new Date().toLocaleDateString('en-SG',{month:'short',day:'numeric',weekday:'short'})}</div></div>`;}
function startWalkerApply(){
  if(!pendingWalkerFile)throw Error('Choose a WebP file first.');
  const file=validateWalkerFile(pendingWalkerFile);
  if(!confirm('Apply this character on this device?'))return;
  applyWalkerFile(file,localStorage,readWalkerDataUrl,checkWalkerImage).then(data=>{
    walkerDataUrl=data;pendingWalkerFile=null;render();
    toast('Walking avatar applied.');
  }).catch(error=>toast(error.message,true));
}
function dashboard() {
  return dashboardView(
    state, { selectedWeekStart, strengthJourneyIndex, strengthViewMetric, strengthHistoryFilter, walkerDataUrl },
    { today, fmt, nice, shellHeading, isPTReview }, localStorage
  );
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
  const dirty=Array.from(form.querySelectorAll('input,select')).some(input=>
    input.type==='checkbox' ? input.checked!==input.defaultChecked :
    input.tagName==='SELECT'
      ? input.value !== (input.querySelector('option[selected]')?.value ?? input.options[0]?.value ?? '')
      : input.value!==input.defaultValue
  );
  return !dirty || confirm('Discard your unsaved set changes?');
}
function train() {
  const day = weekdayOf(activeDate);
  const selected = chosenTemplate && state.templates.some(t => t.id === chosenTemplate)
    ? chosenTemplate : (state.assignments[day] || '');
  chosenTemplate = selected;
  const workout = state.templates.find(t => t.id === selected);
  if (workout) {
    chosenExercise = Math.min(chosenExercise, workout.exercises.length - 1);
    if (focusMode) {
      focusSet = Math.min(Math.max(0, focusSet), workout.exercises[chosenExercise].sets - 1);
    }
  }
  return trainView(
    state, { activeDate, day, selected, workout, chosenExercise, focusMode, focusSet, pendingCompletedCsv },
    { fmt, today, nice, shellHeading, heading, rangeSummary, isPTReview }
  );
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
  ${returnStagePanel(state,pendingReturnStage)}
  <div class="section-label"><h2>Current target workout · V10.3</h2><span>Opt-in import</span></div>
  <section class="card stack codex-program" id="v103-import">
    <div class="eyebrow">V10.3 · CANONICAL FOUR-DAY PROGRAM</div><h2>V10.3 Home Upper / Lower</h2>
    <p class="subtle small">4 workouts · 27 exercises · 56 prescribed working sets: Mon Upper A 17, Tue Lower A 10, Thu Upper B 20, Fri Lower B 9. The 37 upper sets are the eventual target, not your automatic return-to-training dose.</p>
    <div class="notice warn"><strong>[PT Review] Tuesday and Friday.</strong> Lower-body workouts are future targets, not clinical clearance. No days are automatically assigned. Use Coverage-First afterwards for one set per eligible upper-body exercise.</div>
    <p class="hint">Includes exact reps, rest periods, original exercise instructions and equipment units: kg per dumbbell, or kg shown on the cable station for pulldowns. No existing templates, schedule or logged sets are replaced.</p>
    <div class="quick-actions"><button class="btn" type="button" data-action="v103-preview">Preview V10.3 import</button><button class="btn secondary" type="button" data-action="v103-csv">Download canonical V10.3 CSV</button></div>
    ${pendingV103 ? `<div class="notice" role="status"><strong>V10.3 import ready to confirm:</strong> ${pendingV103.workouts.length} templates. Only new, non-identical templates will be appended; existing assignments and logs are unchanged. <div class="preview-list">${pendingV103.workouts.map(w => `<p><strong>${DAY_NAMES[w.day]} · ${esc(w.name)}</strong> — ${w.exercises.length} exercises, ${w.exercises.reduce((n,e)=>n+e.sets,0)} sets${isPTReview(w)?' · [PT Review]':''}</p>`).join('')}</div><div class="quick-actions"><button class="btn" type="button" data-action="v103-apply">Confirm and add V10.3 templates</button><button class="btn secondary" type="button" data-action="v103-cancel">Cancel import</button></div></div>` : ''}
  </section>
  <div class="section-label"><h2>Previous workout version · V10.2</h2><span>Still available</span></div>
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
  <div class="section-label"><h2>Workout library</h2><span>${state.templates.length} saved templates</span></div><p class="hint codex-library-help">These are reusable workout templates—not completed workouts. Tap a loadout to inspect its exercises. Assign it to a weekday above, then save completed sets in Train.</p><div class="notice"><strong>Looking for your completed workout CSV?</strong> This page imports workout templates only. To add what you actually did on a past date, open <button class="btn secondary small-btn" type="button" data-page="train">Train → Import completed workout CSV</button>.</div>
  <section class="codex-library-grid">${state.templates.length ? state.templates.map(t=>`<details class="codex-library-entry"><summary><span class="codex-entry-symbol" aria-hidden="true">✦</span><span class="codex-entry-title"><strong>${esc(t.name)}</strong><small>${t.exercises.length} exercises · ${t.exercises.reduce((n,e)=>n+e.sets,0)} planned sets</small><small>${DAYS.filter((d,i)=>state.assignments[i]===t.id).join(', ')||'Not scheduled'}${isPTReview(t)?' · PT review required':''}</small></span><span class="codex-entry-arrow" aria-hidden="true">⌄</span></summary><div class="codex-entry-body"><strong>Exercise loadout</strong><ul>${t.exercises.map((e,i)=>`<li><span>${esc(e.name)}</span><span>${e.sets} × ${esc(rangeSummary(e))} <button type="button" class="btn secondary small-btn v157-edit-button" data-template-edit="${esc(t.id)}" data-exercise-edit="${i}">Customize</button></span></li>`).join('')}</ul><p class="hint">${isPTReview(t)?'Clinical review is required for this lower-body template. Saving an assignment is not clearance.':'Select this workout in the schedule above; saved sets are recorded separately.'}</p></div></details>`).join(''):'<section class="card empty"><strong>No workout templates yet</strong>Use the V10.1 import above, or import your own CSV below.</section>'}</section>${editor}
  <details class="codex-archive"><summary>Other saved program options <span>Historical & Unified UL</span></summary><div class="codex-archive-body">  <div class="section-label"><h2>Historical training plans</h2></div><section class="card stack"><strong>Recovery-Optimized Upper/Lower · 30 Sep 2026</strong><p class="subtle small">Mon Upper A · Tue Lower A · Thu Upper B · Fri Lower B. Includes top/back-off sets and labelled superset pairs. For Face Pull/Lateral Raise, the third set is optional. Reps listed per arm/leg are per side. Rest is 90 seconds by default unless noted.</p><div class="quick-actions"><button class="btn" type="button" data-action="latest-ul">Add my Recovery UL templates</button><button class="btn secondary" type="button" data-action="latest-ul-csv">Download this plan (.csv)</button></div><p class="hint">Adds templates only. Your current weekly schedule and completed workout sets are unchanged. After import, assign the new workouts to weekdays above and save the schedule.</p></section>
  <div class="section-label"><h2>Unified Recovery UL (per-set targets)</h2></div>
  <section class="card stack"><p class="subtle small">Now one Bench Press, one Goblet Squat, and one Incline Press. Each has different rep targets for top and back-off sets. Your older split templates and saved logs stay available.</p><div class="quick-actions"><button class="btn" type="button" data-action="unified-ul">Add Unified Upper/Lower plan</button><button class="btn secondary" type="button" data-action="unified-ul-csv">Download Unified plan (.csv)</button></div><p class="hint">Adding these templates does not change your current workout days. Choose the new Unified workouts in the schedule above, then save.</p></section>
</div></details>
  <div class="section-label"><h2>Import a custom workout</h2><span>CSV file</span></div><section class="card stack"><p class="subtle small">In Excel, choose <strong>Save As → CSV UTF-8</strong>. Then select that file here. The original .xlsx file is not imported directly.</p><div class="upload-card"><div class="file-ico">↓</div><div style="flex:1;min-width:140px"><strong>Excel-exported CSV</strong><p class="subtle small">Up to 500 exercises · Max 1 MB</p></div><button class="btn secondary small-btn" data-action="pick-csv">Choose CSV</button></div>${pending}<div class="quick-actions"><button class="btn ghost small-btn" data-action="example-csv">Download example CSV →</button></div><p class="hint">Required columns: day, workout, exercise, muscle, sets, rep_min, rep_max. Optional: rest_seconds. Identical imports are skipped; imported templates do not replace completed workouts.</p></section>`;
}
function tools() {
  const resetCounts=resetTrackingData(state).counts;
  const backupStatus=workoutBackupStatus(localStorage,today());
  const reminder=state.reminder, time=`${String(reminder.hour).padStart(2,'0')}:${String(reminder.minute).padStart(2,'0')}`;
  const backupInfo=pendingBackup?`<div class="notice warn"><strong>Backup checked:</strong> ${pendingBackup.templates.length} templates, ${pendingBackup.logs.length} saved sets, ${pendingBackup.metrics.length} daily entries, ${(pendingBackup.symptomLogs??[]).length} symptom observations. <strong>Restore replaces all data currently in this app.</strong><label><span class="form-label">Type REPLACE to confirm</span><input class="field" type="text" id="restore-word" autocomplete="off" placeholder="REPLACE"></label><div class="form-actions"><button class="btn danger" data-action="restore-confirm">Replace with this backup</button><button class="btn secondary" data-action="restore-cancel">Cancel</button></div></div>`:'';
  return `${shellHeading()}${heading('ADVENTURER\'S KIT','Tools & data','Back up your progress first, then customize sounds, rest times and calendar reminders.')}
  <div class="codex-utility-intro"><strong>Keep your journey safe</strong><span>Your logs stay on this device. Download a backup before testing restores or changing devices.</span></div>
  <div class="section-label"><h2>Data vault</h2><span>Local to this browser</span></div><section class="card stack codex-vault"><div class="notice"><strong>Saved on this device only.</strong> Your sets and templates stay in this browser's local storage. They are not sent to us or synced to another device. Clearing website data, deleting the Home Screen app, or switching devices can remove access to them.</div><div class="quick-actions"><button class="btn" data-action="backup-export">Download full backup (.json)</button><button class="btn secondary" data-action="backup-verify">Check saved data integrity</button><button class="btn secondary" data-action="backup-file-check">Check downloaded backup (.json) — no restore</button><button class="btn secondary" data-action="backup-pick">Restore backup</button></div>${backupInfo}<p class="hint"><strong>${esc(backupStatus.label)}</strong> Date is recorded automatically when the checked workout JSON file matches current records.</p><div class="quick-actions"><button class="btn secondary" data-action="storage-persist">Request persistent storage</button><a class="btn secondary" href="./food-diary.html">Open Food Diary backup →</a><a class="btn secondary" href="./encrypted-backup.html">Encrypted backup (both stores) →</a></div><p class="hint" id="storage-persistence-status" role="status">${esc(storagePersistenceStatusLabel)}</p><p class="hint">Storage persistence is browser-controlled and can be unavailable or denied; it never replaces backups. The workout JSON does not include Food Diary entries: export the Food Diary JSON separately on that page.</p><p class="hint">Export a backup after every important training week. Keep the JSON file in iCloud Drive or another place you control. Restoring is destructive, so this app will preview the file and require an explicit confirmation. The saved-data check reads browser storage. The downloaded-backup check reads a chosen file without restoring it; separate-device restore still needs acceptance testing.</p></section>
  <div class="section-label"><h2>Reset tracking records</h2><span>Keep uploaded workouts</span></div>
  <section class="card stack"><div class="notice warn"><strong>Destructive reset — no automatic undo.</strong> Remove saved working sets, daily weight/nutrition/sleep/recovery check-ins and symptom observations from this preview. The Strength Journey start date is also cleared. Preserve all uploaded workout templates, exercise targets, weekday assignments and reminder settings.</div>
    <p class="hint">Preview: ${resetCounts.setsRemoved} saved sets, ${resetCounts.checkinsRemoved} daily check-ins and ${resetCounts.symptomsRemoved} symptom observations would be erased. ${resetCounts.restartDateCleared?'The Strength Journey start date would be cleared. ':'No Strength Journey start date is set. '}${resetCounts.templatesKept} workout templates and ${resetCounts.assignmentsKept} weekday assignments will be kept.</p>
    <p class="hint"><strong>Before resetting:</strong> use Download full backup (.json), then Check downloaded backup (.json) above and select the file you just saved. It must match the current records exactly. Verify that your file is accessible in Files. ${resetBackupReady?'<strong>Current backup file matches.</strong>':'<strong>No matching backup verified yet.</strong>'}</p>
    <label><input type="checkbox" id="tracking-reset-ack"> I saved and checked my full backup, and understand the recorded data will be deleted.</label>
    <label><span class="form-label">Type RESET LOGS to confirm</span><input id="tracking-reset-word" class="field" type="text" autocomplete="off" placeholder="RESET LOGS"></label>
    <div class="form-actions"><button class="btn danger" type="button" data-action="tracking-reset-apply">Reset recorded data (keep workouts)</button></div>
  </section>
  <div class="section-label"><h2>iPhone QA · preview only</h2></div><section class="card stack"><strong>Check this test build before using real records.</strong><p class="hint">Open the manual acceptance checklist in another tab. Mark Pass, Fail, Blocked or Not run, then download a JSON report. The checklist does not inspect or change your saved workouts.</p><p><a class="btn secondary" href="./qa.html" target="_blank" rel="noopener noreferrer">Open iPhone QA checklist</a></p></section>
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
function timerRemaining(){ return restClock(floatingRest.getRemaining()); }
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
async function refreshPersistentStorageStatus() {
  const result=await persistentStorageStatus(navigator.storage);
  const labels={
    granted:'Persistent storage: Granted by this browser.',
    'not-granted':'Persistent storage: Not granted.',
    unsupported:'Persistent storage status: Not supported by this browser.',
    failed:'Persistent storage status: Could not be checked.'
  };
  storagePersistenceStatusLabel=labels[result];
  const status=$('#storage-persistence-status');
  if(status)status.textContent=storagePersistenceStatusLabel;
}
function render(){const markup=navMarkup();$('.bottom-tabs').innerHTML=markup;$('.desktop-tabs').innerHTML=markup;$('#main').innerHTML=`${storageError?`<div class="error-strip" role="alert">${esc(storageError)}</div>`:''}${page==='dashboard'?dashboard():page==='train'?train():page==='plan'?plan():tools()}`;inspectWalkerDisplay();floatingRest.updatePage(page);if(page==='tools')void refreshPersistentStorageStatus();}
function download(filename,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function readCompletedCsv(file) {
  if(!file||file.size>1_000_000||!/\.csv$/i.test(file.name))
    throw Error('Choose a completed-workout .csv file smaller than 1 MB.');
  const csv=await file.text();
  if(storageError)throw Error('Saved workout history is locked; CSV import is disabled.');
  const original=localStorage.getItem(STORAGE_KEY);
  const parsed=previewCompletedCsv(state,csv);
  pendingCompletedCsv=parsed;pendingCompletedSnapshot=original;
  render();toast('Completed workout review ready. Nothing saved yet.');
}
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
  if(button.dataset.rest){tryAction(()=>{const seconds=intRange(button.dataset.rest,'Rest',1,600);
    floatingRest.start(seconds);toast(`Rest timer started: ${seconds} seconds.`);});return;}
  const act=button.dataset.action;
  tryAction(()=>{
    if(['week-prev','week-next','week-current','week-latest'].includes(act)) {
      if(act==='week-current') selectedWeekStart=null;
      else if(act==='week-latest') {
        const recent=latestLoggedWeek(state);
        if(!recent) throw Error('No saved working sets found in this preview yet.');
        selectedWeekStart=recent;
      } else selectedWeekStart=shiftWeek(selectedWeekStart||mondayOf(today()),act==='week-prev'?-1:1);
      render();return;
    }
    if(act==='return-stage-cancel'){pendingReturnStage=null;render();return;}
    if(act==='return-stage-save'){
      if(storageError)throw Error('Saved data is locked; return-to-training templates cannot be added.');
      const pending=pendingReturnStage;
      if(!pending)throw Error('Preview a Coverage-First plan first.');
      if(localStorage.getItem(STORAGE_KEY)!==pending.snapshot){pendingReturnStage=null;render();throw Error('Saved data changed since your preview. Review the stage again.');}
      const sources=pending.ids.filter(Boolean).map(id=>state.templates.find(t=>t.id===id));
      const selected=generateOneSetCoverage(sources);
      const out=addWorkouts(state,selected.workouts,false);
      if(!out.added){toast('These return-to-training templates are already in your library. Nothing changed.');return;}
      const stageName=`Coverage-First, one set per upper exercise (${selected.percentage}% of eligible upper-body sets)`;
      if(!confirm(`Add ${out.added} NEW ${stageName} workout templates? The original workouts, schedule and completed sets remain unchanged. No stage or load advances automatically.`))return;
      pendingReturnStage=null;
      commit(out.state,`Added ${out.added} return-to-training templates: ${stageName}. Assign days manually in Plan.`);
      return;
    }
    if(act==='cancel-customize'){customizing=null;render();return;}
    if(act==='equivalence-link'){
      const choice=$('#equivalence-candidate')?.value||'';
      const [tIndex,eIndex]=choice.split(':').map(Number);
      const earlier=state.templates[tIndex];
      if(!choice||!earlier||!Number.isInteger(eIndex)||!earlier.exercises[eIndex])throw Error('Choose an earlier exercise to link.');
      const here=state.templates.find(t=>t.id===chosenTemplate)?.exercises[chosenExercise];
      if(!here)throw Error('Choose an exercise first.');
      if(!linkCandidates(state,chosenTemplate,chosenExercise).some(c=>c.templateId===earlier.id&&c.exerciseIndex===eIndex))throw Error('That exercise cannot be linked here.');
      if(!confirm(`Link "${earlier.exercises[eIndex].name}" (${earlier.name}) as earlier history of "${here.name}"? Its sets will appear on this exercise's Strength Journey chart and as a starting-weight reference only. Progression still uses only this exercise's own sessions. No saved sets are changed.`))return;
      commit(addExerciseEquivalence(state,{from:{templateId:earlier.id,exerciseIndex:eIndex},to:{templateId:chosenTemplate,exerciseIndex:chosenExercise},approvedDate:today()},undefined,{confirmed:true}),'Earlier history linked. No saved sets were changed.');
      return;
    }
    if(act==='active-sets-change'){
      const here=state.templates.find(t=>t.id===chosenTemplate)?.exercises[chosenExercise];
      if(!here)throw Error('Choose an exercise first.');
      const count=intRange($('#active-sets-count')?.value,'Active sets',1,here.sets);
      if(!confirm(`Do ${count} of ${here.sets} planned sets of "${here.name}" for now? You are setting this yourself; the app never changes it. Saved sets stay exactly as they are, and next-session targets will compare against ${count} set(s).`))return;
      commit(setActiveSets(state,{templateId:chosenTemplate,exerciseIndex:chosenExercise,count},{confirmed:true}),`Active sets saved: ${count} of ${here.sets}. No saved sets were changed.`);
      return;
    }
    if(act==='clearance-record'){
      const here=state.templates.find(t=>t.id===chosenTemplate)?.exercises[chosenExercise];
      if(!here)throw Error('Choose an exercise first.');
      const clearedBy=$('#clearance-by')?.value??'',clearedDate=$('#clearance-date')?.value??'',note=$('#clearance-note')?.value??'';
      dateFromKey(clearedDate);
      if(clearedDate>today())throw Error('Clearance date cannot be in the future.');
      if(!clearedBy.trim())throw Error('Enter who gave the clearance.');
      if(!confirm(`You are recording a clearance that a clinician (${clearedBy.trim()}) gave you on ${clearedDate} for "${here.name}". FitnessPilot does not verify this and it is not medical advice. Progression suggestions for this exercise will then follow the normal symptom, recovery and effort checks. Record it?`))return;
      commit(recordExerciseClearance(state,{templateId:chosenTemplate,exerciseIndex:chosenExercise,clearedDate,clearedBy,note},undefined,{confirmed:true}),'Clearance recorded as given by a clinician. Not verified by the app. No saved sets were changed.');
      return;
    }
    if(act==='clearance-revoke'){
      const id=button.dataset.clearanceId;
      if(!confirm('Revoke this clearance? The exercise returns to [PT Review] reference-only status. The record stays visible as revoked; no saved sets are changed.'))return;
      commit(revokeExerciseClearance(state,id,today(),{confirmed:true}),'Clearance revoked. No saved sets were changed.');
      return;
    }
    if(act==='equivalence-unlink'){
      const id=button.dataset.linkId;
      if(!confirm('Remove this link? Only the link is removed; all saved sets stay exactly as they are.'))return;
      commit(removeExerciseEquivalence(state,id,{confirmed:true}),'Link removed. No saved sets were changed.');
      return;
    }
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
    if(act==='v103-preview'){
      if(storageError)throw Error('Saved data is locked. V10.3 import preview cannot continue.');
      pendingV103={workouts:v103Templates(),snapshot:localStorage.getItem(STORAGE_KEY)};
      render();
      document.getElementById('v103-import')?.scrollIntoView({block:'start'});
      return;
    }
    if(act==='v103-apply'){
      if(storageError)throw Error('Saved data is locked. Cannot import V10.3.');
      const pending=pendingV103;
      if(!pending)throw Error('Preview the V10.3 import before confirming.');
      if(localStorage.getItem(STORAGE_KEY)!==pending.snapshot){
        pendingV103=null;render();
        throw Error('Saved workout data changed after your V10.3 preview. Preview it again.');
      }
      const out=addWorkouts(state,pending.workouts,false);
      if(!out.added){pendingV103=null;render();toast('V10.3 templates are already in your library. Nothing changed.');return;}
      if(!confirm(`Add ${out.added} V10.3 workout templates and skip ${out.skipped} existing? This will NOT assign days, clear PT review or modify completed workouts.`))return;
      commit(out.state,`Added ${out.added} V10.3 templates; skipped ${out.skipped} already present. Assign eligible days manually in Plan.`);
      return;
    }
    if(act==='v103-cancel'){pendingV103=null;render();return;}
    if(act==='v103-csv'){download('V10.3_Home_FitnessPilot_Import.csv',V103_CSV,'text/csv;charset=utf-8');return;}
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
    if(act==='completed-csv-blank'){
      if(!chosenTemplate)throw Error('Select a workout in Train first.');
      download('FitnessPilot-completed-session-'+activeDate+'.csv',blankCompletedCsv(state,activeDate,chosenTemplate),'text/csv;charset=utf-8');
      toast('Blank completed-session CSV downloaded. Fill actual kg/reps, then import it here.');
      return;
    }
    if(act==='completed-csv-pick'){$('#completed-workout-file').click();return;}
    if(act==='completed-csv-backup'){
      if(storageError)throw Error('Saved data is locked. Cannot back up before import.');
      download('FitnessPilot-PREVIEW-before-session-import-'+today()+'.json',JSON.stringify(state,null,2)+'\n','application/json');
      toast('Backup prepared. Verify it is saved before ticking confirmation.');
      return;
    }
    if(act==='completed-csv-cancel'){pendingCompletedCsv=null;pendingCompletedSnapshot=null;render();return;}
    if(act==='completed-csv-apply'){
      if(storageError)throw Error('Saved data is locked. Import refused.');
      if(!pendingCompletedCsv||!pendingCompletedCsv.add.length)throw Error('Preview a CSV with new completed sets first.');
      if(!$('#completed-import-backup-ack')?.checked)throw Error('Save and acknowledge a current JSON backup before applying.');
      if(localStorage.getItem(STORAGE_KEY)!==pendingCompletedSnapshot){
        pendingCompletedCsv=null;pendingCompletedSnapshot=null;render();
        throw Error('Workout history changed since CSV preview. Choose the CSV again and recheck.');
      }
      if(!confirm('Add '+pendingCompletedCsv.add.length+' actual completed sets to your saved history? No existing sets will be replaced.'))return;
      const count=pendingCompletedCsv.add.length;
      const next=applyCompletedCsv(state,pendingCompletedCsv);
      commit(next,'Imported '+count+' completed working sets; saved history preserved.');
      pendingCompletedCsv=null;pendingCompletedSnapshot=null;render();
      return;
    }
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
      if(!confirm(`Permanently remove ${preview.counts.setsRemoved} recorded sets, ${preview.counts.checkinsRemoved} daily check-ins and ${preview.counts.symptomsRemoved} symptom entries${preview.counts.restartDateCleared?' and clear the Strength Journey start date':''}? Keep ${preview.counts.templatesKept} workout templates and weekday assignments? This cannot be undone without a backup.`))return;
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
    if(act==='backup-export'){
      if(storageError)throw Error('Cannot export invalid records safely.');
      resetBackupReady=false;
      download(`FitnessPilot-PREVIEW-backup-${today()}.json`,JSON.stringify(state,null,2)+'\n','application/json');
      render();
      toast('Workout JSON prepared. Save the file, then use Check downloaded backup (.json).');
      return;
    }
    if(act==='storage-persist'){
      if(storagePersistenceRequestPending)return;
      storagePersistenceRequestPending=true;
      button.disabled=true;
      requestPersistentStorage(navigator.storage).then(async result=>{
        await refreshPersistentStorageStatus();
        const messages={
          granted:'Browser granted persistent storage. Keep downloading backups.',
          denied:'Browser declined persistent storage. You can request again later.',
          unsupported:'This browser does not support persistent storage requests. Keep downloading backups.',
          failed:'Browser storage request failed. You can request again later.'
        };
        toast(messages[result],result==='failed');
      }).catch(()=>toast('Persistent storage request could not be completed.',true))
        .finally(()=>{storagePersistenceRequestPending=false;if(button.isConnected)button.disabled=false;});
      return;
    }
    if(act==='backup-pick')$('#backup-file').click();
    if(act==='backup-file-check')$('#backup-check-file').click();
    if(act==='restore-cancel'){pendingBackup=null;render();}
    if(act==='restore-confirm'){if(!pendingBackup)throw Error('Choose a backup file first.');if($('#restore-word')?.value!=='REPLACE')throw Error('Type REPLACE to confirm.');if(!confirm('Replace ALL current local sets, workouts and check-ins with this backup? Export your existing backup first.'))return;const next=pendingBackup;commit(next,'Backup restored. Previous local data replaced.');pendingBackup=null;render();}
    if(act==='calendar'){download(`FitnessPilot-weekly-reminders-${today()}.ics`,calendarICS(state),'text/calendar;charset=utf-8');toast('Calendar file prepared. Import events into your calendar.');}
    if(act==='stop-timer'){floatingRest.stop();toast('Timer stopped.');}
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
  if(target.id==='strength-metric'){
    if(!['load','volume'].includes(target.value)){toast('Choose a valid chart measurement.',true);return;}
    strengthViewMetric=target.value;render();return;
  }
  if(target.id==='strength-history-filter'){
    if(!['all','recent10','recent3'].includes(target.value)){toast('Choose a valid history filter.',true);return;}
    strengthHistoryFilter=target.value;render();return;
  }
  if(target.id==='strength-exercise'){
    const index=Number(target.value);
    if(!Number.isInteger(index)||index<0)throw Error('Choose a valid strength exercise.');
    strengthJourneyIndex=index;render();return;
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
  if(target.id==='completed-workout-file'){
    const file=target.files?.[0];target.value='';
    if(file)readCompletedCsv(file).catch(error=>{
      pendingCompletedCsv=null;pendingCompletedSnapshot=null;render();toast(error.message,true);
    });
    return;
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
      if(resetBackupReady) {
        try { markWorkoutBackupChecked(localStorage,today()); }
        catch(error) {
          render();
          toast(`Backup matches, but ${error.message}`,true);
          return;
        }
      }
      render();
      toast(resetBackupReady
        ? `Matching workout backup verified: ${summary.templates} templates and ${summary.sets} recorded sets. Checked date recorded as today; nothing restored.`
        : 'Backup file valid but does not match current browser records. Nothing restored; a matching backup is required to reset.');

    })().catch(error=>{resetBackupReady=false;render();toast(error.message,true);});
  }
});

document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;
  tryAction(()=>{
    if(form.id==='strength-start-form'){
      const start=form.elements.start.value;
      if(start){
        dateFromKey(start);
        if(start>today())throw Error('Day 1 cannot be in the future.');
      }
      const next=structuredClone(state);
      if(start)next.strengthJourneyStartDate=start;
      else delete next.strengthJourneyStartDate;
      strengthJourneyIndex=0;
      commit(next,start?'Journey start date saved. Your earlier workout history remains intact.':'Journey start reset to first saved session. History unchanged.');
      return;
    }
    if(form.id==='strength-step-form'){
      const raw=form.elements.step.value;
      const value=raw===''?null:Number(raw);
      if(value!==null&&![0.5,1,2,2.5,4].includes(value))throw Error('Choose a supported available dumbbell increment.');
      const next=structuredClone(state);
      if(value===null)delete next.progressionStepKg;
      else next.progressionStepKg=value;
      commit(next,value===null?'Dumbbell increment cleared.':'Available dumbbell increment saved. Actual workout sets remain unchanged.');
      return;
    }
    if(form.id==='return-stage-form'){
      if(storageError)throw Error('Saved data is locked. Return-to-training preview cannot use unreadable records.');
      const ids=DAYS.map((_,i)=>form.elements[`returnDay${i}`].value);
      const sources=ids.filter(Boolean).map((id)=>state.templates.find(t=>t.id===id));
      if(!sources.length)throw Error('Choose at least one source workout from your library.');
      if(sources.some(t=>!t || t.returnStagePercent))throw Error('Choose existing source workouts, not a generated return stage.');
      generateOneSetCoverage(sources); // Read-only validation before recording a preview.
      pendingReturnStage={ids,snapshot:localStorage.getItem(STORAGE_KEY)};
      render();
      document.getElementById('return-stage-panel')?.scrollIntoView({block:'start'});
      return;
    }
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
      const shared={rest:form.elements.rest.value,notes:form.elements.notes.value,tempo:form.elements.tempo.value,difficulty:form.elements.difficulty.value,technique:form.elements.technique.value};
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
const floatingRest = createFloatingRestTimer();
render();
if('serviceWorker' in navigator && location.protocol !== 'file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
initRoFeedback();
