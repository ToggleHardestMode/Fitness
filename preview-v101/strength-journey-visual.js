import {getExerciseJourney, recommendNextExercise} from './strength-journey.js';

// Presentation only. Every point and set comes from persisted completed-workout logs.
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const fmt = number => Number(number).toLocaleString('en-SG', {maximumFractionDigits:2});
const dateLabel = value => new Date(value+'T12:00:00').toLocaleDateString('en-US',
  {month:'short',day:'2-digit'});
const dateLong = value => new Date(value+'T12:00:00').toLocaleDateString('en-SG',
  {day:'numeric',month:'short',year:'numeric'});
const displayDifficulty = value => ({
  too_easy:'Too easy', on_target:'On target', too_hard:'Too hard'
})[value] || '';
const classOfRpe = value => value == null ? 'unknown' :
  value >= 9 ? 'hard' : value >= 7.5 ? 'moderate' : 'steady';
const datePlusOne = value => {
  const [y,m,d] = value.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
};
const safeMode = value => value === 'volume' ? 'volume' : 'load';
const safeRange = value => ['all','recent10','recent3'].includes(value) ? value : 'all';

function startDateForm(state) {
  return '<details class="sj-date-setting"><summary>Restart journey Day 1 <span>Change date</span></summary>' +
    '<form id="strength-start-form">' +
    '<label class="form-label" for="strength-start">Keep workout history; filter the journey from</label>' +
    '<div class="strength-step-row"><input class="field" type="date" id="strength-start" name="start" value="' +
    escapeHtml(state.strengthJourneyStartDate || '') +
    '"><button class="btn secondary" type="submit">Save Day 1</button></div>' +
    '<p class="hint">Blank uses the earliest saved working set. Older records are never deleted.</p></form></details>';
}

function metricCard(title, value, detail, icon) {
  return '<div class="sj-stat"><span class="sj-stat-heading"><span aria-hidden="true">' +
    icon + '</span>' + escapeHtml(title) + '</span><strong>' +
    escapeHtml(value) + '</strong><small>' + escapeHtml(detail) + '</small></div>';
}

function chartMarkup(sessions, key) {
  const isRep=key==='reps';
  const isVolume=key==='volume';
  const values=sessions.map(session => isVolume
    ? session.sets.reduce((total,set)=>total+set.kg*set.reps,0)
    : session[isRep?'reps':'kg']);
  if(!values.length) return '<div class="sj-chart-empty">Nothing plotted yet. Completed working sets will appear here.</div>';
  const first=Math.min(...values),last=Math.max(...values);
  const spread=last-first;
  const pad=Math.max(spread*.22,last*.11,1);
  const unit=isRep?'reps':isVolume?'kg × reps':'kg';
  const lower=Math.max(0,Math.floor((first-pad)/2)*2);
  const upper=Math.max(lower+2,Math.ceil((last+pad)/2)*2);
  // Small coordinate space keeps chart labels legible at 390px viewport width.
  const left=34,right=376,top=24,bottom=111;
  const x = i => values.length===1 ? (left+right)/2 : left+(right-left)*i/(values.length-1);
  const y = value => bottom-(value-lower)/(upper-lower)*(bottom-top);
  const coords=values.map((value,index)=>[Number(x(index).toFixed(2)),Number(y(value).toFixed(2))]);
  const polyline=coords.map(point=>point.join(',')).join(' ');
  const fill=coords.length>1?'M'+coords[0].join(' ')+' L'+coords.slice(1).map(point=>point.join(' ')).join(' L')+
    ' L'+coords.at(-1)[0]+' '+bottom+' L'+coords[0][0]+' '+bottom+' Z':'';
  const id=isRep?'reps':isVolume?'volume':'load';
  const tickValues=Array.from({length:5},(_,i)=>lower+(upper-lower)*i/4);
  const grids=tickValues.map(value=>'<line x1="'+left+'" x2="'+right+'" y1="'+y(value).toFixed(2)+
    '" y2="'+y(value).toFixed(2)+'" class="sj-svg-grid"/><text class="sj-svg-axis" x="29" y="'+
    (y(value)+4).toFixed(2)+'" text-anchor="end">'+fmt(Number(value.toFixed(2)))+'</text>').join('');
  const nth=Math.max(1,Math.ceil(sessions.length/9));
  const dateIndices=sessions.map((_,i)=>i).filter(i=>i===0||i===sessions.length-1||i%nth===0);
  const dateTicks=dateIndices.map(i=>'<text class="sj-svg-date" x="'+x(i).toFixed(2)+'" y="128" text-anchor="'+
    (i===0 && sessions.length>1?'start':i===sessions.length-1 && sessions.length>1?'end':'middle')+'">'+
    escapeHtml(dateLabel(sessions[i].date))+'</text><text class="sj-svg-day" x="'+
    x(i).toFixed(2)+'" y="141" text-anchor="'+
    (i===0 && sessions.length>1?'start':i===sessions.length-1 && sessions.length>1?'end':'middle')+
    '">Day '+(i+1)+'</text>').join('');
  const annotate=sessions.length<=9;
  const markers=coords.map(([cx,cy],i)=>{
    const session=sessions[i];
    const tag=annotate||i===0||i===coords.length-1;
    const metricValue=values[i];
    const title=escapeHtml(session.date+' · '+fmt(session.kg)+' kg × '+session.reps+
      ' reps · '+(session.rpe==null?'RPE not recorded':'RPE '+fmt(session.rpe))+
      (isVolume?' · total '+fmt(metricValue)+' kg × reps':''));
    return '<circle class="sj-svg-dot" cx="'+cx+'" cy="'+cy+'" r="5.3"><title>'+title+'</title></circle>'+
      (tag?'<text class="sj-svg-value" x="'+cx+'" y="'+Math.max(13,cy-10).toFixed(2)+
        '" text-anchor="middle">'+fmt(metricValue)+'</text>':'');
  }).join('');
  const aria='Actual '+unit+' across '+sessions.length+' recorded exercise session'+(sessions.length===1?'':'s');
  return '<svg class="sj-svg-chart sj-svg-'+id+'" viewBox="0 0 410 151" role="img" aria-label="'+
    escapeHtml(aria)+'"><defs><linearGradient id="sj-gradient-'+id+
    '" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="'+
    (isRep?'#ab6bf3':'#f3bb5e')+'" stop-opacity=".26"/><stop offset="100%" stop-color="'+
    (isRep?'#ab6bf3':'#f3bb5e')+'" stop-opacity=".015"/></linearGradient></defs>'+
    grids+'<line class="sj-svg-baseline" x1="'+left+'" x2="'+right+'" y1="'+bottom+'" y2="'+bottom+'"/>'+
    (fill?'<path class="sj-svg-area" fill="url(#sj-gradient-'+id+')" d="'+fill+'"/>':'')+
    (coords.length>1?'<polyline class="sj-svg-line" points="'+polyline+'"/>':'')+
    markers+dateTicks+'</svg>'+
    (sessions.length===1?'<p class="sj-chart-note">First recorded session. Your trend starts when you log another workout.</p>':'');
}

function statusMetric(sessions) {
  if(sessions.length===1)return 'Baseline recorded';
  const first=sessions[0],last=sessions.at(-1);
  if(last.kg>first.kg)return 'Higher logged load';
  if(last.kg<first.kg)return 'Lower logged load';
  return 'Same logged load';
}

function lastSessionsMarkup(sessions) {
  if(!sessions.length)return '<p class="sj-muted">Log your first working set to start the comparison.</p>';
  return '<div class="sj-recent-list">'+sessions.slice(-3).reverse().map(session=>
    '<div class="sj-recent-row"><span>'+escapeHtml(dateLabel(session.date))+
    '</span><strong>'+fmt(session.kg)+' kg</strong><span>'+session.reps+' reps</span>'+
    '<span class="sj-rpe sj-rpe-'+classOfRpe(session.rpe)+'">'+
      (session.rpe == null?'RPE —':fmt(session.rpe))+'</span></div>').join('')+'</div>';
}

function progressSummary(sessions) {
  if(!sessions.length)return '<p class="sj-muted">No completed workouts recorded for this exercise.</p>';
  const first=sessions[0],latest=sessions.at(-1);
  const percent=sessions.length>1 && first.kg>0 ? Math.round((latest.kg/first.kg-1)*100) : null;
  const badge=percent===null?'':(percent>0?'+':'')+percent+'%';
  return '<div class="sj-summary-rows"><div><span>Logged load</span><strong>'+fmt(first.kg)+
    ' → '+fmt(latest.kg)+' kg</strong>'+(percent===null?'':'<em class="'+
    (percent>0?'positive':percent<0?'negative':'neutral')+'">'+escapeHtml(badge)+'</em>')+
    '</div><div><span>Latest reps (best load)</span><strong>'+latest.reps+
    '</strong></div><div><span>Observed trend</span><strong>'+escapeHtml(statusMetric(sessions))+
    '</strong></div></div><p class="sj-footnote">Entered load trend only; not a muscle-growth estimate.</p>';
}

function sessionHistoryMarkup(sessions,range,templateName) {
  const visible=range==='recent3'?sessions.slice(-3):range==='recent10'?sessions.slice(-10):sessions;
  return '<div class="sj-history-list">'+visible.slice().reverse().map((session,i)=>{
    const number=sessions.indexOf(session)+1;
    const feedback=[...new Set(session.sets.map(row=>displayDifficulty(row.difficulty)).filter(Boolean))].join(', ') || 'Not rated';
    const rpe=session.rpe==null?'RPE —':'RPE '+fmt(session.rpe);
    const sets=session.sets.map(set=>
      '<div class="sj-set-line"><span>Set '+set.set+'</span><strong>'+fmt(set.kg)+' kg × '+
      set.reps+' reps</strong><span>'+ (set.rpe==null?'RPE —':'RPE '+fmt(set.rpe))+
      '</span><span>'+escapeHtml(displayDifficulty(set.difficulty)||'No feedback')+
      (set.technique?' · '+escapeHtml(set.technique):'')+'</span></div>').join('');
    return '<details class="sj-history-row"><summary>'+
      '<span class="sj-history-date">'+escapeHtml(dateLabel(session.date))+'<small>Day '+number+
      '</small></span><span class="sj-history-main"><strong>'+fmt(session.kg)+' kg × '+
      session.reps+' reps</strong><small>'+escapeHtml(templateName)+' · '+session.sets.length+
      ' set'+(session.sets.length===1?'':'s')+'</small></span><span class="sj-rpe sj-rpe-'+
      classOfRpe(session.rpe)+'">'+escapeHtml(rpe)+'</span><span class="sj-history-feedback">'+escapeHtml(feedback)+'</span><span class="sj-chevron" aria-hidden="true">⌄</span>'+
      '</summary><div class="sj-session-expanded"><p>'+escapeHtml(dateLong(session.date))+
      ' · '+escapeHtml(feedback)+'</p>'+sets+'</div></details>';
  }).join('')+'</div>'+
    '<p class="sj-footnote">Showing '+visible.length+' of '+sessions.length+
    ' saved exercise sessions · tap a row to inspect its recorded sets.</p>';
}

function recommendationMarkup(state,journey,today) {
  const latest=journey.sessions.at(-1);
  const date=latest && latest.date>=today?datePlusOne(latest.date):today;
  const plan=recommendNextExercise(state,{templateId:journey.template.id,
    exerciseIndex:journey.template.exercises.indexOf(journey.exercise),date});
  const candidate=plan.status==='load'||plan.status==='rep';
  const rows=plan.targets;
  const sameLoad=rows.length>0 && rows.every(row=>row.kg===rows[0].kg);
  const repRange=rows.length>0 ? (Math.min(...rows.map(row=>row.reps))===
    Math.max(...rows.map(row=>row.reps))?String(rows[0].reps):
    Math.min(...rows.map(row=>row.reps))+'–'+Math.max(...rows.map(row=>row.reps))):'—';
  const primary=candidate && sameLoad ? fmt(rows[0].kg)+' kg' : candidate ? 'Per set' : 'Not cleared';
  const target=candidate ? rows.length+' × '+repRange : 'Review first';
  const status=candidate ? plan.status==='load'?'Weight progression candidate':'Rep progression candidate':
    plan.status==='pt-review'?'PT review required':
    plan.status==='symptom-review'?'Symptom review required':'Hold / review';
  const detail=candidate?'<div class="sj-candidate-sets">'+rows.map(row=>
    '<span>Set '+row.set+': '+fmt(row.kg)+' kg × '+row.reps+'</span>').join('')+'</div>':
    '<p class="sj-muted">Previous weights are reference only. There is no approved load increase.</p>';
  return '<section class="sj-next-panel" aria-label="Optional next-session recommendation">'+
    '<div class="sj-panel-title"><h3>✧ Next-session recommendation</h3><span class="sj-recommend-status">'+
    escapeHtml(status)+'</span></div><div class="sj-next-summary"><div><small>'+
    (candidate?'Suggested recorded load':'Suggested load')+'</small><strong>'+
    escapeHtml(primary)+'</strong></div><div><small>Set × rep target</small><strong>'+
    escapeHtml(target)+'</strong></div></div>'+detail+
    '<p class="sj-recommend-why"><strong>Why: </strong>'+escapeHtml(plan.reason)+'</p>'+
    '<div class="sj-next-footer"><small>For '+escapeHtml(date)+' · recorded kg units; per hand or total is not inferred. '+
    'Suggestions never count as completed sets.</small>'+
    '<button class="btn secondary" type="button" data-page="train">Open Train →</button></div></section>';
}

export function renderStrengthJourney(state, selectedIndex=0, settings={}) {
  const options={today:settings.today || new Date().toLocaleDateString('en-CA'),
    metric:safeMode(settings.metric),range:safeRange(settings.range)};
  const choices=[];
  for(const template of state.templates || []){
    template.exercises.forEach((exercise,exerciseIndex)=>{
      if(exercise.repUnit==='seconds_per_side')return;
      choices.push({template,exercise,exerciseIndex,
        journey:getExerciseJourney(state,template.id,exerciseIndex)});
    });
  }
  choices.sort((a,b)=>Number(Boolean(b.journey.sessions.length))-Number(Boolean(a.journey.sessions.length)));
  if(!choices.length)return '<section class="sj-journey sj-empty" aria-label="Strength Journey">'+
    '<div class="sj-kicker">✦ Strength Journey</div><h2>Your strength journey starts here</h2>'+
    '<p>Add a workout template in Plan, then log completed working sets in Train. No sample progress is shown.</p>'+
    startDateForm(state)+'<button class="btn secondary" data-page="plan">Open Plan →</button></section>';
  const index=Number.isInteger(selectedIndex)&&selectedIndex>=0&&selectedIndex<choices.length?selectedIndex:0;
  const {template,exercise,journey}=choices[index];
  const sessions=journey.sessions,latest=sessions.at(-1);
  const best= sessions.flatMap(row=>row.sets).reduce((candidate,row)=>
    !candidate || row.reps>candidate.reps ||
    row.reps===candidate.reps && row.kg>candidate.kg ? row : candidate,null);
  const loadChange=sessions.length>1 ?
    (journey.calibrated.loadChange>0?'+':'')+fmt(journey.calibrated.loadChange)+' kg':'—';
  const exerciseItems=choices.map(({template:t,exercise:e},i)=>
    '<option value="'+i+'"'+(i===index?' selected':'')+'>'+
    escapeHtml(e.name+' · '+t.name)+'</option>').join('');
  return '<section class="sj-journey" aria-label="Strength Journey" data-session-count="'+sessions.length+'">'+
    '<div class="sj-kicker"><span aria-hidden="true">✦</span> Strength Journey <span class="sj-kicker-tail">Saved working sets only</span></div>'+
    '<div class="sj-hero"><div class="sj-hero-symbol" aria-hidden="true">⚒</div><div class="sj-hero-text">'+
    '<h2>'+escapeHtml(exercise.name)+'</h2><p>'+escapeHtml(template.name)+' · '+
    escapeHtml(exercise.muscle||'Exercise')+'</p></div></div>'+
    '<label class="sj-switch" for="strength-exercise"><span>⇄ Change Exercise</span>'+
    '<select class="field" id="strength-exercise" aria-label="Choose exercise and workout version">'+
    exerciseItems+'</select></label>'+
    '<div class="sj-metrics">'+
    metricCard('Journey Day 1',journey.day1?dateLabel(journey.day1):'—',
      journey.day1?journey.day1.slice(0,4):'Not established','▣')+
    metricCard('Exercise sessions',sessions.length,'Completed dates','▤')+
    metricCard('Load change',loadChange,sessions.length>1?
      fmt(sessions[0].kg)+' → '+fmt(latest.kg)+' kg':'More sessions needed','↗')+
    metricCard('Rep best',best?best.reps+' reps':'—',best?fmt(best.kg)+' kg logged':'No records','▥')+
    metricCard('Current best',latest?fmt(latest.kg)+' kg':'—',
      latest?'× '+latest.reps+' reps · '+dateLabel(latest.date):'No records','✦')+'</div>'+
    '<section class="sj-chart-panel"><div class="sj-panel-title"><h3>⚒ Load progression</h3>'+
    '<label class="sj-view-choice"><span class="sr-only">Chart measurement</span>'+
    '<select id="strength-metric" class="field" aria-label="Load graph measurement">'+
    '<option value="load"'+(options.metric==='load'?' selected':'')+'>Load (kg)</option>'+
    '<option value="volume"'+(options.metric==='volume'?' selected':'')+'>Volume (kg × reps)</option>'+
    '</select></label></div><p class="sj-chart-subtitle">'+
    (options.metric==='volume'?'Sum of kg × reps across saved sets, per session':
    'Heaviest saved working-set load per exercise session')+'</p>'+
    chartMarkup(sessions,options.metric==='volume'?'volume':'kg')+
    '<div class="sj-chart-divider"></div><div class="sj-panel-title"><h3>⌄ Repetition trend</h3>'+
    '<span class="sj-small-note">Reps on heaviest set</span></div>'+
    chartMarkup(sessions,'reps')+
    '<p class="sj-footnote">Every point represents an actual saved exercise session. Planned and suggested loads are excluded. Values are kg exactly as entered.</p>'+
    '</section>'+
    '<div class="sj-comparison-grid"><section class="sj-subpanel"><div class="sj-panel-title"><h3>◎ Progress summary</h3><span>'+sessions.length+' sessions</span></div>'+
    progressSummary(sessions)+'</section><section class="sj-subpanel"><div class="sj-panel-title"><h3>▥ Last 3 sessions</h3></div>'+
    lastSessionsMarkup(sessions)+'</section></div>'+
    '<section class="sj-history"><div class="sj-panel-title"><h3>▤ Session history</h3>'+
    '<label class="sj-history-filter"><span class="sr-only">Session history range</span>'+
    '<select class="field" id="strength-history-filter" aria-label="Session history range">'+
    '<option value="all"'+(options.range==='all'?' selected':'')+'>All sessions</option>'+
    '<option value="recent10"'+(options.range==='recent10'?' selected':'')+'>Latest 10</option>'+
    '<option value="recent3"'+(options.range==='recent3'?' selected':'')+'>Latest 3</option>'+
    '</select></label></div>'+
    sessionHistoryMarkup(sessions,options.range,template.name)+'</section>'+
    recommendationMarkup(state,journey,options.today)+
    '<div class="sj-bottom-note"><span>Calibration: '+escapeHtml(journey.calibrated.evidence)+
    ' · '+journey.calibrated.ratedSets+'/'+journey.calibrated.totalSets+
    ' sets with RPE.</span><span>Workout versions stay separate.</span></div>'+
    startDateForm(state)+'</section>';
}
