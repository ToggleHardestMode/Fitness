/* Disposable, operator-scored iPhone acceptance checklist. No workout-storage access. */
export const CHECKS = Object.freeze([
  {id:"O1",title:"Safari and Home Screen version and records",steps:"Open Safari and the Home Screen app. Check their version banners after the update and confirm that saved records are still there. Do not clear website data.",expected:"The preview banner is current in each edition and existing records remain intact."},
  {id:"O2",title:"Three completed upper-body sets and layout",steps:"During an actual upper-body session, record three real completed sets; check text legibility, buttons and horizontal overflow at normal phone width.",expected:"All three sets save correctly, text remains readable and no buttons become unreachable."},
  {id:"O3",title:"Floating 90-second rest timer",steps:"Start the 90-second floating rest timer in Train, change screens, wait for the completed overlay and dismiss it. Test with ringer on, silent and screen locked; note the audio response.",expected:"The countdown remains across views and the finished overlay persists until tapped. Sound while locked is not guaranteed."},
  {id:"O4",title:"Lower-body PT Review and next-session safety",steps:"Open a lower-body workout and its next-session guide without recording clearance or adding a loaded exercise.",expected:"[PT Review] remains visible and guidance never fills or saves a set automatically."},
  {id:"O5",title:"V10.3 import, links, active sets and clearance (throw-away)",steps:"In a private throw-away browser tab with fictional records, import V10.3 (four workouts), link one exercise to its V10.2 history, set active sets below target, record then revoke fictional clinician clearance. Never add fake clinical clearance to real records.",expected:"Four imported workouts are unassigned to days; history linking and active sets require explicit actions; revoking clearance restores restrictions without changing historical sets."},
  {id:"O6",title:"Strength Journey, week arrows and Show calculation",steps:"On Dashboard, inspect Strength Journey, use the week arrows and open Show calculation. Compare the numbers with saved sets.",expected:"Calculated values and weekly views agree with saved working sets, not planned sets."},
  {id:"O7",title:"Food Diary search, repeat and empty days",steps:"Search a local food, repeat a previously saved meal and inspect the 28-day Food Diary chart.",expected:"The repeat action is explicit and unlogged dates are shown as blank, not zero."},
  {id:"O8",title:"Encrypted both-store backup recovery (throw-away)",steps:"Using fictional records in a throw-away private browser context, export both stores with encryption. In another empty context try a wrong passphrase, then type the correct passphrase from memory and restore. Never restore over real records.",expected:"Wrong passphrase is refused without writes; the restored workout and Food Diary records match the originals."},
  {id:"O9",title:"Airplane mode and offline save",steps:"After loading the app online and checking your backup, enter Airplane Mode. Reopen the cached app, save a legitimately completed set or use a fictional set in a disposable profile.",expected:"The app reopens offline, permits saving, and preserves previously logged records."},
  {id:"O10",title:"Reduce Motion, VoiceOver and optional feedback",steps:"Turn on Reduce Motion; check the avatar remains still. Use VoiceOver on Save and timer controls. Verify slime and sound are off unless explicitly enabled.",expected:"No unwanted animation; usable VoiceOver labels; feedback remains opt-in."},
  {id:"O11",title:"Calendar reminder import after step 4.3",steps:"After roadmap Step 4.3 merges, import an exported .ics reminder file into Calendar twice; verify weekdays, time and alert. Until then mark Blocked.",expected:"Events have correct dates, start times and alerts; duplicate imports do not duplicate events."}
]);
export const STATES = Object.freeze(['not-run','pass','fail','blocked']);
export function extractBannerVersion(text) {
  const m=typeof text==='string'&&text.match(/FITNESSPILOT (V\d+\.\d+\.\d+) PREVIEW/);
  if(!m)throw Error('Current preview version unavailable from the main app banner.');
  return m[1];
}
export function summarize(responses) {
  const counts={pass:0,fail:0,blocked:0,'not-run':0};
  for(const check of CHECKS){
    const result=responses[check.id]?.status ?? 'not-run';
    if(!STATES.includes(result))throw Error('Invalid QA status for '+check.id);
    counts[result]++;
  }
  return counts;
}
export function makeReport(responses, at, version) {
  if(typeof version!=='string'||!/^V\d+\.\d+\.\d+$/.test(version))
    throw Error('Preview version not read from the main banner.');
  const counts=summarize(responses);
  return {
    schema:'fitnesspilot-qa-v1',
    previewVersion:version,
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
  const frame=document.querySelector('#preview-banner-source');
  const versionLabel=document.querySelector('#preview-version');
  let currentVersion='';
  function updateVersion(){
    try {
      currentVersion=extractBannerVersion(frame.contentDocument?.querySelector('.preview-banner')?.textContent);
      versionLabel.textContent=currentVersion+' · main app banner';
      document.title='FitnessPilot '+currentVersion+' · iPhone QA';
    }catch(error){
      currentVersion='';
      versionLabel.textContent='Version unavailable: '+(error.message||error);
    }
  }
  frame.addEventListener('load',updateVersion);
  if(frame.contentDocument?.readyState==='complete')updateVersion();
  function refresh(){
    const c=summarize(responses);
    countsEl.textContent=`${c.pass} Pass · ${c.fail} Fail · ${c.blocked} Blocked · ${c['not-run']} Not run`;
  }
  for(const check of CHECKS){
    const article=document.createElement('article');article.className='check';
    const header=document.createElement('h2');header.textContent=check.id+' · '+check.title;article.append(header);
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
      const data=JSON.stringify(makeReport(responses,new Date().toISOString(),currentVersion),null,2);
      const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download='fitnesspilot-'+currentVersion.toLowerCase().replaceAll('.','')+'-qa.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      feedback.textContent='Report download requested. Check Files/Downloads; no app records were changed.';
    }catch(err){feedback.textContent='Export failed: '+String(err.message||err);}
  });
  refresh();
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',mount);
