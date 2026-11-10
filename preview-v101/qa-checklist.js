/* Disposable, operator-scored iPhone acceptance checklist. No workout-storage access. */
export const PREVIEW_VERSION = 'V15.26.12';
export const CHECKS = Object.freeze([
  {"id":"version","title":"Current version, tabs and mobile layout","steps":"Open FitnessPilot V15.26.12 Preview in iPhone Safari. Navigate Dashboard, Train, Plan and Tools; also open Food Diary and the Encrypted Backup Vault from their links. Scroll each screen and try navigation controls without submitting, importing or deleting records.","expected":"The version banner shows V15.26.12. Tabs and links work; no horizontal clipping or inaccessible buttons on the phone. The existing records remain unchanged."},
  {"id":"plan","title":"V10.3 program visibility and PT review","steps":"Open Plan. If V10.3 is already available, inspect Upper A, Lower A, Upper B and Lower B and existing weekday assignments without saving changes. If not yet imported, mark Blocked; do not import fictional workouts into personal data.","expected":"The imported program is identifiable as V10.3; older versioned plans remain selectable if present. Lower-body exercises marked [PT Review] still show their review status. Merely opening Plan changes no records."},
  {"id":"set","title":"Saved-set counter and edit (disposable only)","steps":"Only in a separate disposable profile with fictional records, save one upper-body set and then edit it. If no disposable profile is available, mark Blocked; never fabricate a set in your real history.","expected":"One new set increments the saved count by one; updating it changes the existing record without creating a second set. Optional slime feedback does not affect saving."},
  {"id":"focus","title":"Focus Mode requires explicit saving","steps":"With fictional records in a disposable profile, select Focus Mode, adjust repetitions and an RPE quick choice, attempt navigation without saving, then explicitly save. If no isolated profile is available, mark Blocked.","expected":"Quick controls change form fields only. Unsaved changes trigger a leave/discard prompt; progression to the next set follows a successful explicit Save this set."},
  {"id":"repeat","title":"Copy previous set without silent completion","steps":"In a disposable profile that has a previous saved session, use Copy saved set. Check the fields before deliberately saving; if no suitable fictional prior session exists, mark Blocked.","expected":"Only prior kilograms and repetitions are offered for copying. RPE is entered separately; copying does not record a completed set."},
  {"id":"safety","title":"PT-review and recovery safeguards","steps":"Open an available lower-body template. Inspect its [PT Review] and next-session guidance without recording new symptoms, approving clearance or increasing loaded movement resistance.","expected":"[PT Review] is visible where required. Unrecorded recovery or symptom observations are not treated as clinical clearance or permission to increase loading."},
  {"id":"backup","title":"Non-destructive workout backup check","steps":"In Tools download a workout JSON backup and use Check downloaded backup (.json) — no restore. Verify the app displays a matching-backup confirmation. Do not use any Restore or Reset action.","expected":"Checking a matching downloaded file leaves workout templates, sets, daily check-ins and Food Diary records unchanged; it does not restore or delete anything."},
  {"id":"restore","title":"Encrypted two-store recovery (disposable only)","steps":"Only in a separate empty disposable browser context with fictional records, export the encrypted both-store file, try an incorrect passphrase and tampered file, then restore using the correct passphrase in an empty context. Compare both stores after reload. Otherwise mark Blocked; do not test replacement over your live profile.","expected":"Incorrect passphrase and corrupted file reject without writes. Correct recovery restores the exact fictional workout and Food Diary records and both survive reload."},
  {"id":"timer","title":"Floating Rest timer and obstructed buttons","steps":"In Train start a 60-second floating Rest timer. While it runs, switch to Tools and back. Scroll near Train completed-workout CSV controls and Tools controls; check each is tappable without importing a file. After countdown check the completion overlay and bottom navigation. Do not test offline updates.","expected":"The countdown remains usable across Train and Tools. Neither the timer chip nor completion overlay prevents tapping nearby controls or navigation at the actual phone width. Offline upgrade B098 remains deferred."},
  {"id":"history","title":"Historical workout logbook","steps":"If existing sessions are present, inspect Tools → Workout logbook and download full history (.csv) without importing or deleting anything. If there are no sessions, mark Blocked.","expected":"Sessions retain their recorded template/program version. The CSV includes the full saved history, not merely the most recent on-screen entries."}
]);
export const STATES = Object.freeze(['not-run','pass','fail','blocked']);
export function summarize(responses) {
  const counts={pass:0,fail:0,blocked:0,'not-run':0};
  for(const check of CHECKS){
    const result=responses[check.id]?.status ?? 'not-run';
    if(!STATES.includes(result))throw Error('Invalid QA status for '+check.id);
    counts[result]++;
  }
  return counts;
}
export function makeReport(responses, at) {
  const counts=summarize(responses);
  return {
    schema:'fitnesspilot-qa-v1',
    previewVersion:PREVIEW_VERSION,
    checkedAt:at,
    results:CHECKS.map(check=>({
      id:check.id,
      title:check.title,
      status:responses[check.id]?.status ?? 'not-run',
      note:String(responses[check.id]?.note ?? '').slice(0,400)
    })),
    counts,
    note:'Manual operator observations only. No workout/health data, browser identifiers or site storage included.'
  };
}
function mount() {
  const list=document.querySelector('#checks');
  const countsEl=document.querySelector('#counts');
  const feedback=document.querySelector('#export-status');
  const button=document.querySelector('#download-report');
  if(!list||!countsEl||!feedback||!button)return;
  const responses=Object.create(null);
  function refresh(){
    const c=summarize(responses);
    countsEl.textContent=`${c.pass} Pass · ${c.fail} Fail · ${c.blocked} Blocked · ${c['not-run']} Not run`;
  }
  for(const check of CHECKS){
    const article=document.createElement('article');article.className='check';
    const header=document.createElement('h2');header.textContent=check.title;article.append(header);
    const steps=document.createElement('p');steps.textContent=check.steps;article.append(steps);
    const expected=document.createElement('p');expected.className='expected';expected.textContent='Expected: '+check.expected;article.append(expected);
    const label=document.createElement('label');label.textContent='Result ';
    const select=document.createElement('select');select.setAttribute('aria-label',check.title+' result');
    for(const status of STATES){const option=document.createElement('option');option.value=status;option.textContent=status==='not-run'?'Not run':status[0].toUpperCase()+status.slice(1);select.append(option);}
    select.addEventListener('change',()=>{responses[check.id]={...responses[check.id],status:select.value};refresh();});
    label.append(select);article.append(label);
    const note=document.createElement('textarea');note.rows=2;note.maxLength=400;note.placeholder='Optional observation; do not enter personal workout or health information';note.setAttribute('aria-label',check.title+' note');
    note.addEventListener('input',()=>{responses[check.id]={...responses[check.id],note:note.value};});
    article.append(note);list.append(article);
  }
  button.addEventListener('click',()=>{
    try{
      const data=JSON.stringify(makeReport(responses,new Date().toISOString()),null,2);
      const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download='fitnesspilot-v152612-qa.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      feedback.textContent='Report download requested. Check Files/Downloads; no app records were changed.';
    }catch(err){feedback.textContent='Export failed: '+String(err.message||err);}
  });
  refresh();
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',mount);
