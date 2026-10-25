/* Disposable, operator-scored iPhone acceptance checklist. No workout-storage access. */
export const CHECKS = Object.freeze([
  {id:'version',title:'Preview version, navigation and averages',steps:'Open the app link in Safari. Confirm V15.13 in the banner, open Dashboard, Plan, Train and Tools. Under Dashboard Insights, expand the daily-average source dates.',expected:'Version and tabs are correct, and each recorded weekly average shows contributing dates and day count.'},
  {id:'plan',title:'V10.2 workout templates',steps:'In a disposable test-only browser context, import V10.2 Home in Plan and inspect the four workout templates.',expected:'4 workouts, 24 exercise entries, 62 planned physical sets; both lower workouts display [PT Review] and are not auto-assigned.'},
  {id:'set',title:'Saved-set counter and edit',steps:'In disposable data, opt in to Slime hit feedback in Tools, save a new upper-body set, then edit that saved set.',expected:'Lifetime and weekly completed counts rise by one on save and stay unchanged after editing the same set.'},
  {id:'focus',title:'Focus Mode unsaved changes',steps:'In an upper-body Focus Mode set, change reps with +1/-1 and tap an RPE choice; try leaving without saving, then deliberately save.',expected:'Shortcuts edit inputs only; unsaved edits prompt on navigation, and next-set navigation happens only after a successful save.'},
  {id:'repeat',title:'Copy prior set',steps:'For a second eligible upper-body set, use Copy saved set and inspect its inputs before saving.',expected:'Only weight and reps are copied; RPE and saved/completed state are not automatically copied.'},
  {id:'safety',title:'Recovery and lower-day gates',steps:'Open a lower-body workout and its check-in area. Do not perform a clinical test or increase resistance for this checklist.',expected:'[PT Review] is visible; missing recovery observations never grant clearance or automatic weight progression.'},
  {id:'backup',title:'Downloaded backup inspection',steps:'With disposable data, download a JSON backup, choose Check downloaded backup (.json) — no restore, and inspect the reset tracking data preview without applying it.',expected:'File counts are shown without replacing any template, log, metric or symptom record.'},
  {id:'restore',title:'Independent backup recovery (disposable only)',steps:'Only in a separate empty disposable preview storage context, try restoring the disposable backup after confirming its source.',expected:'Explicit REPLACE confirmation precedes restore; recovered dummy counts match. If no isolated context, mark Blocked; never restore over real records.'},
  {id:'offline',title:'Offline shell and sound',steps:'While online, load the preview. Test the opt-in slime sound and rest timer separately, then try an offline reopen if safe.',expected:'Audio has visible controls, timer functions while open, and an already-cached preview reopens offline without wiping records.'},
  {id:'history',title:'Historical workout logbook',steps:'In disposable data, expand Workout logbook and download full history (.csv).',expected:'Historical sessions retain their saved workout version; CSV contains all saved sets, not only the 15 visible sessions.'}
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
    previewVersion:'V15.13',
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
      anchor.href=url;anchor.download='fitnesspilot-v1513-qa.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      feedback.textContent='Report download requested. Check Files/Downloads; no app records were changed.';
    }catch(err){feedback.textContent='Export failed: '+String(err.message||err);}
  });
  refresh();
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',mount);
