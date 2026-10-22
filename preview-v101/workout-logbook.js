// Read-only historical workout logbook. Uses the exact template ID saved with each set,
// so a later custom template or weekly schedule edit cannot relabel older sessions.
const isWorking = log => log.isWarmup !== true && log.kind !== 'warmup';
const safeText = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number(value).toLocaleString('en-SG',{maximumFractionDigits:1});

export function workoutLogbook(state, limit = 15) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('Logbook limit must be 1–100.');
  const templates = new Map((state.templates || []).map(t => [t.id,t]));
  const sessions = new Map(), seen = new Set();
  for (const log of state.logs || []) {
    const template = templates.get(log.templateId);
    const exercise = template?.exercises?.[log.exerciseIndex];
    if (!template || !exercise || !Number.isInteger(log.set) ||
        log.set < 1 || log.set > exercise.sets) continue;
    const id = `${log.date}|\u0000${log.templateId}`;
    const key = `${id}|\u0000${log.exerciseIndex}|\u0000${log.set}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!sessions.has(id)) sessions.set(id,{
      date:log.date, templateId:template.id, workout:template.name,
      version:template.sourceVersion || 'Legacy', items:[], workingSets:0, volume:0
    });
    const item = {
      exercise:exercise.name, exerciseIndex:log.exerciseIndex, set:log.set,
      kg:log.kg, reps:log.reps, rpe:log.rpe, notes:log.notes || '',
      unit:exercise.repUnit === 'seconds_per_side' ? 'seconds/side' : 'reps',
      warmup:!isWorking(log)
    };
    sessions.get(id).items.push(item);
    if (!item.warmup) {
      sessions.get(id).workingSets++;
      if (item.unit === 'reps' && Number.isFinite(log.kg) && Number.isFinite(log.reps))
        sessions.get(id).volume += log.kg * log.reps;
    }
  }
  const all = [...sessions.values()].sort((a,b)=>b.date.localeCompare(a.date) ||
    a.workout.localeCompare(b.workout) || a.templateId.localeCompare(b.templateId));
  for (const session of all)
    session.items.sort((a,b)=>a.exerciseIndex-b.exerciseIndex || a.set-b.set);
  return {sessions:all.slice(0,limit), totalSessions:all.length, totalSets:all.reduce((n,s)=>n+s.workingSets,0)};
}

export function workoutLogbookHtml(state) {
  const report=workoutLogbook(state);
  if (!report.totalSessions) return '<p class="hint">No workout sets saved yet. Your training history will appear here after a logged session.</p>';
  const rows=report.sessions.map(session=>{
    const cells=session.items.map(item=>{
      const count=`${number(item.kg)} kg × ${number(item.reps)} ${item.unit}`;
      return `<li><span>${safeText(item.exercise)} · Set ${item.set}${item.warmup?' (warm-up)':''}</span><span>${safeText(count)}${item.rpe == null?'':` · RPE ${safeText(item.rpe)}`}</span>${item.notes?`<small>${safeText(item.notes)}</small>`:''}</li>`;
    }).join('');
    return `<details class="v158-session"><summary><span><strong>${safeText(session.date)}</strong> · ${safeText(session.workout)}<small>${safeText(session.version)} · ${session.workingSets} working sets · ${number(session.volume)} kg × reps</small></span><span aria-hidden="true">⌄</span></summary><ul>${cells}</ul></details>`;
  }).join('');
  return `<p class="hint">Showing ${report.sessions.length} of ${report.totalSessions} recorded workout sessions (${report.totalSets} working sets total). Existing template IDs are preserved. Current weekly assignments do not rewrite past sessions.</p>${rows}<p class="hint">Timed holds and warm-up sets do not contribute to kg × reps volume. Download CSV for the full history.</p>`;
}

const csvValue = value => {
  let text=String(value ?? '');
  // Prevent spreadsheet formula execution when text columns open in Excel.
  if (/^[\s]*[=+@-]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
};

export function workoutLogbookCsv(state) {
  const {sessions}=workoutLogbook(state,100);
  // The UI limits to 15, but CSV exports *all* history, including >100 sessions.
  // Paginate batches to avoid dropping older records.
  const lines=[['Date','Workout','Source version','Exercise','Set','Weight kg',
    'Reps or seconds per side','Unit','RPE','Working set','Notes'].map(csvValue).join(',')];
  // Enumerate without a 100-session cap by reusing the complete indexed source logs:
  const templates=new Map((state.templates || []).map(t=>[t.id,t]));
  const seen=new Set(),items=[];
  for(const log of state.logs || []) {
    const t=templates.get(log.templateId),ex=t?.exercises?.[log.exerciseIndex];
    if(!t||!ex||!Number.isInteger(log.set)||log.set<1||log.set>ex.sets)continue;
    const key=`${log.date}|\u0000${log.templateId}|\u0000${log.exerciseIndex}|\u0000${log.set}`;
    if(seen.has(key))continue;
    seen.add(key);
    items.push({log,t,ex});
  }
  items.sort((a,b)=>b.log.date.localeCompare(a.log.date) ||
    a.t.name.localeCompare(b.t.name) || a.log.exerciseIndex-b.log.exerciseIndex || a.log.set-b.log.set);
  for(const {log,t,ex} of items) {
    lines.push([
      log.date,t.name,t.sourceVersion||'Legacy',ex.name,log.set,log.kg,log.reps,
      ex.repUnit==='seconds_per_side'?'seconds/side':'reps',log.rpe,
      isWorking(log)?'Yes':'No',log.notes||''
    ].map(csvValue).join(','));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
