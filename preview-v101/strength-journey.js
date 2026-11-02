// Strength Journey v1: pure selectors and optional feedback; no network or implicit writes.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayLocal = () => {const d=new Date(),pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const DIFFICULTY = ['easy','target','hard'];
const TECHNIQUE = ['good','uncertain','poor'];
const NEXT_DAY = ['good','symptoms','unknown'];
const isPT = (t,e) => !!t?.requiresClinicalReview ||
  /\[PT Review\]|\blower\b/i.test(t?.name || '') ||
  /\[PT Review\]|\b(squat|deadlift|lunge|rdl|hip hinge|split squat|leg press|leg extension|leg curl|calf raise|glute bridge|hip thrust|hamstring|quadriceps)\b/i.test(e?.name || '') ||
  /\b(quad|hamstring|glute|calf|legs?|lower)\b/i.test(e?.muscle || '');
const concern = r => r.severity !== 0 || r.tingling !== false ||
  r.numbness !== false || r.functionChange !== 'none' || r.location !== 'none';
const scope = (x, t, i) => x.templateId === t && x.exerciseIndex === i;
const key = x => [x.date,x.templateId,x.exerciseIndex,x.set].join('|');

export function verifiedSessions(state, templateId, exerciseIndex) {
  const t=(state.templates || []).find(x => x.id === templateId), e=t?.exercises?.[exerciseIndex];
  if (!e) return [];
  const byDay=new Map(), seen=new Set();
  for (const row of state.logs || []) {
    if (!scope(row,templateId,exerciseIndex) || row.isWarmup === true || row.kind === 'warmup' ||
        !DATE.test(row.date) || !Number.isInteger(row.set) || row.set < 1 || row.set > e.sets ||
        !Number.isFinite(row.kg) || !Number.isInteger(row.reps) || seen.has(key(row))) continue;
    seen.add(key(row));
    if (!byDay.has(row.date)) byDay.set(row.date,[]);
    byDay.get(row.date).push(row);
  }
  return [...byDay].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,rows]) => {
    rows.sort((a,b)=>a.set-b.set);
    return {date, rows, heaviest:Math.max(...rows.map(x=>x.kg)), totalReps:rows.reduce((n,x)=>n+x.reps,0)};
  });
}

export function exerciseChoices(state) {
  const entries=[];
  for (const t of state.templates || []) for (let index=0;index<t.exercises.length;index++) {
    const e=t.exercises[index];
    const count=verifiedSessions(state,t.id,index).length;
    if (count) entries.push({templateId:t.id,exerciseIndex:index,label:e.name+' · '+t.name,
      sessions:count,ptReview:isPT(t,e),timed:e.repUnit==='seconds_per_side'});
  }
  return entries.sort((a,b)=>a.label.localeCompare(b.label));
}

const comparableSnapshot = (rows) => JSON.stringify(rows.map(x =>
  [x.id,x.set,x.kg,x.reps,x.rpe ?? null,x.notes || '',x.tempo || '']));
export function validateStrengthJourneyStarts(state) {
  if (state.strengthJourneyStarts === undefined) return;
  const starts=state.strengthJourneyStarts;
  if (!starts || Array.isArray(starts) || typeof starts!=='object' || Object.keys(starts).length>5000)
    throw Error('Invalid journey restart baselines.');
  for(const [scopeId,start] of Object.entries(starts)){
    const split=scopeId.lastIndexOf('|');
    if(split<=0 || !DATE.test(start)) throw Error('Invalid journey restart date.');
    const templateId=scopeId.slice(0,split),index=Number(scopeId.slice(split+1));
    if(!Number.isInteger(index) || !state.templates.some(t=>t.id===templateId && t.exercises?.[index]))
      throw Error('Journey baseline refers to a missing exercise.');
  }
}

export function setJourneyStart(state,{templateId,exerciseIndex,startDate}){
  if(!verifiedSessions(state,templateId,exerciseIndex).some(s=>s.date===startDate))
    throw Error('Day 1 must be a genuinely completed session date.');
  const next=structuredClone(state);
  next.strengthJourneyStarts ||= {};
  next.strengthJourneyStarts[templateId+'|'+exerciseIndex]=startDate;
  validateStrengthJourneyStarts(next);
  return next;
}

export function validateStrengthFeedback(state) {
  if (state.strengthFeedback === undefined) return;
  const arr=state.strengthFeedback, seen=new Set();
  if (!Array.isArray(arr) || arr.length > 100000) throw Error('Invalid strength feedback history.');
  for (const f of arr) {
    if (!f || !DATE.test(f.date) || typeof f.templateId!=='string' ||
        !Number.isInteger(f.exerciseIndex) || !DIFFICULTY.includes(f.difficulty) ||
        !TECHNIQUE.includes(f.technique) || !NEXT_DAY.includes(f.nextDay) ||
        typeof f.setSnapshot !== 'string' || f.setSnapshot.length > 10000) throw Error('Invalid strength feedback entry.');
    const t=state.templates.find(x=>x.id===f.templateId);
    if (!t?.exercises?.[f.exerciseIndex]) throw Error('Feedback refers to a missing workout.');
    const id=[f.date,f.templateId,f.exerciseIndex].join('|');
    if(seen.has(id)) throw Error('Duplicate strength feedback.');
    seen.add(id);
    if (f.note !== undefined && (typeof f.note !== 'string' || f.note.length > 250)) throw Error('Invalid feedback note.');
  }
}

export function saveStrengthFeedback(state, draft) {
  const t=state.templates.find(x=>x.id===draft.templateId);
  if (!t?.exercises?.[draft.exerciseIndex] || !DATE.test(draft.date)) throw Error('Choose a recorded exercise and valid date.');
  if (!DIFFICULTY.includes(draft.difficulty) || !TECHNIQUE.includes(draft.technique) ||
      !NEXT_DAY.includes(draft.nextDay)) throw Error('Select difficulty, technique and next-day response.');
  const session=verifiedSessions(state,draft.templateId,draft.exerciseIndex).find(x=>x.date===draft.date);
  if (!session) throw Error('Feedback must reference a completed session, not a planned load.');
  if(draft.nextDay==='good' && draft.date>=todayLocal()) throw Error('Next-day response cannot be marked good until a later local calendar day.');
  const note=String(draft.note || '').trim();
  if(note.length>250) throw Error('Feedback note too long.');
  const next=structuredClone(state);
  next.strengthFeedback ||= [];
  const row={date:draft.date,templateId:draft.templateId,exerciseIndex:draft.exerciseIndex,
    difficulty:draft.difficulty,technique:draft.technique,nextDay:draft.nextDay,
    note,setSnapshot:comparableSnapshot(session.rows)};
  const index=next.strengthFeedback.findIndex(x=>x.date===row.date && scope(x,row.templateId,row.exerciseIndex));
  if(index>=0) next.strengthFeedback[index]=row; else next.strengthFeedback.push(row);
  validateStrengthFeedback(next);
  return next;
}

function clearedRecord(state,session,templateId,exerciseIndex) {
  const rows=(state.symptomLogs || []).filter(x=>x.date===session.date &&
    (x.templateId===null || (x.templateId===templateId &&
      (x.exerciseIndex===null || x.exerciseIndex===exerciseIndex))));
  if (!['before','after','next_day'].every(tp=>rows.some(x=>x.timepoint===tp)))
    return {ok:false,reason:'Before/after/next-day symptom observations are incomplete.'};
  if (rows.some(concern)) return {ok:false,reason:'Symptoms or functional changes were recorded.'};
  const f=(state.strengthFeedback||[]).find(x=>x.date===session.date &&
    scope(x,templateId,exerciseIndex));
  if(!f) return {ok:false,reason:'Effort, technique and next-day feedback are not yet recorded.'};
  if(f.setSnapshot!==comparableSnapshot(session.rows))
    return {ok:false,reason:'A completed set changed after feedback; review it again.'};
  if(f.technique!=='good' || f.nextDay!=='good' || f.difficulty==='hard')
    return {ok:false,reason:'Technique, difficulty or delayed response calls for holding progression.'};
  if(session.rows.some(x=>x.rpe===null || !Number.isFinite(x.rpe) || x.rpe>8))
    return {ok:false,reason:'RPE is unrecorded or exceeds 8 on a working set.'};
  return {ok:true,reason:'All recorded feedback gates met; not medical clearance.'};
}

export function nextSessionTarget(state, {templateId,exerciseIndex,nextDate,incrementsKg=[],journeyStartDate=null}) {
  const t=state.templates.find(x=>x.id===templateId),e=t?.exercises?.[exerciseIndex];
  if(!e || !DATE.test(nextDate)) throw Error('Choose a valid exercise and next date.');
  const start=journeyStartDate || state.strengthJourneyStarts?.[templateId+'|'+exerciseIndex] || null;
  const all=verifiedSessions(state,templateId,exerciseIndex).filter(s=>s.date<nextDate && (!start||s.date>=start));
  const latest=all.at(-1),previous=all.at(-2);
  const base={status:'hold',candidate:null,sourceDate:latest?.date||null,ruleset:'strength-journey-v1'};
  if(!latest)return {...base,reason:'No verified earlier session. Log actual completed sets first.'};
  if(isPT(t,e))return {...base,reason:'[PT Review] / lower-body loading: no automatic progression.'};
  if(e.repUnit==='seconds_per_side')return {...base,reason:'Timed holds are excluded from kilogram progression.'};
  if(latest.rows.length!==e.sets)return {...base,reason:'Not all prescribed working sets were recorded.'};
  const recovery=(state.metrics||[]).find(m=>m.date===nextDate)?.recovery;
  if(!Number.isInteger(recovery) || recovery<4)
    return {...base,reason:'Next-session recovery score of 4–5 is required; unknown is not clearance.'};
  const check=clearedRecord(state,latest,templateId,exerciseIndex);
  if(!check.ok)return {...base,reason:check.reason};
  const targets=latest.rows.map(row=>e.setTargets?.[row.set-1] || {min:e.min,max:e.max});
  if(latest.rows.some((row,i)=>row.reps < targets[i].min || row.reps > targets[i].max))
    return {...base,reason:'A working set was outside its prescribed rep range.'};
  const upper=latest.rows.every((row,i)=>row.reps===targets[i].max);
  if(!upper){
    return {...base,status:'reps',candidate:latest.rows.map((row,i)=>({
      set:row.set,kg:row.kg,reps:Math.min(row.reps+1,targets[i].max)
    })),reason:'Optional same-weight +1 rep per unfinished set; all feedback and recovery gates passed. Not saved.'};
  }
  if(!previous || previous.rows.length!==e.sets ||
      !clearedRecord(state,previous,templateId,exerciseIndex).ok ||
      !previous.rows.every((row,i)=>row.set===latest.rows[i].set &&
        row.kg===latest.rows[i].kg && row.reps===(e.setTargets?.[row.set-1]||{max:e.max}).max))
    return {...base,reason:'Repeat the rep ceiling on a second fully observed session before load review.'};
  const increments=Array.isArray(incrementsKg) ? [...new Set(incrementsKg)].sort((a,b)=>a-b) : [];
  if(!increments.length || increments.some(x=>!Number.isFinite(x)||x<=0||x>500))
    return {...base,reason:'Confirmed achievable kilogram increments are required for a load target.'};
  const proposed=latest.rows.map((row,i)=>{
    const up=increments.find(x=>x>row.kg);
    return up && up<=row.kg*1.10 ? {set:row.set,kg:up,reps:targets[i].min} : null;
  });
  if(proposed.some(x=>!x))return {...base,reason:'No small enough available increment (max 10% per set); hold for manual review.'};
  return {...base,status:'load',candidate:proposed,
    reason:'Two comparable sessions reached every rep ceiling, effort and delayed feedback passed, and only confirmed increments were used. Optional, not saved.'};
}
