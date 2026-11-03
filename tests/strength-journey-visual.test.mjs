import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStrengthJourney} from '../preview-v101/strength-journey-visual.js';

const base = () => ({
  version:1,templates:[{id:'upper',name:'Upper A',day:0,exercises:[{
    name:'Flat Dumbbell Bench Press',muscle:'Chest',sets:2,min:8,max:12,rest:90
  }]}],logs:[],metrics:[],symptomLogs:[],assignments:{},reminder:{hour:18,minute:30,lead:0},
  progressionStepKg:2
});
const sessions = (number) => Array.from({length:number},(_,i)=>{
  const date=new Date(Date.UTC(2026,10,2+i*3)).toISOString().slice(0,10);
  return [1,2].map(set=>({
    id:date+'-'+set,date,templateId:'upper',exerciseIndex:0,set,
    kg:12+2*Math.floor(i/2),reps:10+i%3,rpe:i%2?8:7,notes:'',rest:90
  }));
}).flat();
const markup = (state, options = {}) => renderStrengthJourney(state,0,{
  today:'2026-12-01', ...options
});

test('no workout templates renders an honest first-action screen',()=>{
  const html=markup({...base(),templates:[]});
  assert.match(html,/Your strength journey starts here/);
  assert.doesNotMatch(html,/2026-11-02/);
});
test('zero saved sets renders empty chart without fake progress',()=>{
  const html=markup(base());
  assert.match(html,/data-session-count="0"/);
  assert.match(html,/Nothing plotted yet/);
  assert.match(html,/No completed workouts recorded/);
  assert.match(html,/Not cleared/);
});
test('one saved session plots exactly one point per graph and no fake change',()=>{
  const state={...base(),logs:sessions(1)};
  const html=markup(state);
  assert.match(html,/data-session-count="1"/);
  assert.match(html,/First recorded session/);
  assert.match(html,/More sessions needed/);
  assert.match(html,/Nov 02/);
  assert.equal((html.match(/sj-svg-dot/g)||[]).length,2);
  assert.doesNotMatch(html,/\+50%/);
});
test('three logged sessions display comparison, last-three and full history',()=>{
  const html=markup({...base(),logs:sessions(3)});
  assert.match(html,/data-session-count="3"/);
  assert.match(html,/Progress summary/);
  assert.match(html,/Last 3 sessions/);
  assert.equal((html.match(/class="sj-history-row"/g)||[]).length,3);
  assert.match(html,/RPE 7/);
});
test('nine real session groups show two charts and five summary tiles',()=>{
  const html=markup({...base(),logs:sessions(9)});
  assert.match(html,/data-session-count="9"/);
  assert.equal((html.match(/class="sj-stat"/g)||[]).length,5);
  assert.equal((html.match(/class="sj-svg-chart/g)||[]).length,2);
  assert.equal((html.match(/class="sj-history-row"/g)||[]).length,9);
  assert.match(html,/Current best/);
  assert.match(html,/Session history/);
});
test('history filter limits only the history list and retains all chart points',()=>{
  const html=markup({...base(),logs:sessions(9)},{range:'recent3'});
  assert.equal((html.match(/class="sj-history-row"/g)||[]).length,3);
  assert.equal((html.match(/class="sj-svg-dot"/g)||[]).length,18);
  assert.match(html,/Showing 3 of 9/);
});
test('volume graph is computed from actual saved kg times repetitions',()=>{
  const html=markup({...base(),logs:sessions(1)},{metric:'volume'});
  assert.match(html,/Sum of kg × reps across saved sets/);
  assert.match(html,/class="sj-svg-chart sj-svg-volume"/);
  assert.match(html,/total 240 kg × reps/);
});
test('one logged exercise and another workout version never combine counts',()=>{
  const state=base();state.logs=sessions(3);
  state.templates.push({...structuredClone(state.templates[0]),id:'upper-v2',name:'Upper A custom'});
  const html=markup(state);
  assert.match(html,/data-session-count="3"/);
  assert.match(html,/Upper A custom/);
  assert.match(html,/Workout versions stay separate/);
});
test('explicit restart date filters rendered history without erasing source logs',()=>{
  const state=base();state.logs=sessions(9);state.strengthJourneyStartDate='2026-11-20';
  const html=markup(state);
  assert.match(html,/data-session-count="3"/);
  assert.equal(state.logs.length,18);
  assert.doesNotMatch(html,/class="sj-history-row"[\s\S]*Nov 02/);
});
test('missing RPE and follow-up do not become positive safety feedback',()=>{
  const state=base();state.logs=sessions(1).map(row=>({...row,rpe:null}));
  const html=markup(state);
  assert.match(html,/RPE —/);
  assert.match(html,/Not cleared/);
  assert.doesNotMatch(html,/Recovery acceptable/);
  assert.match(html,/Effort was missing or above RPE 8/);
});
test('PT review is an explicit not-cleared status on recommendation card',()=>{
  const state=base();state.logs=sessions(2);state.templates[0].requiresClinicalReview=true;
  const html=markup(state);
  assert.match(html,/PT review required/);
  assert.match(html,/Not cleared/);
  assert.doesNotMatch(html,/Weight progression candidate/);
});
test('suitable recovery evidence permits a candidate but never invents chart points',()=>{
  const state=base();state.logs=sessions(2).map(row=>({...row,kg:12,reps:12,rpe:7}));
  state.symptomLogs=['2026-11-02','2026-11-05'].flatMap(date=>
    ['before','after','next_day'].map(timepoint=>({
      id:date+timepoint,date,timepoint,templateId:'upper',exerciseIndex:0,
      severity:0,tingling:false,numbness:false,location:'none',functionChange:'none'
    })));
  state.metrics=[{date:'2026-12-01',recovery:5}];
  const html=markup(state);
  assert.match(html,/Weight progression candidate/);
  assert.match(html,/14 kg/);
  const plot=html.slice(html.indexOf('class="sj-chart-panel"'),html.indexOf('class="sj-comparison-grid"'));
  assert.doesNotMatch(plot,/14 kg/);
  assert.equal((plot.match(/sj-svg-dot/g)||[]).length,4);
});
test('dangerous exercise text is escaped in headings and selector',()=>{
  const state=base();state.logs=sessions(1);
  state.templates[0].exercises[0].name='<img src=x onerror=alert(1)>';
  const html=markup(state);
  assert.match(html,/&lt;img/);
  assert.doesNotMatch(html,/<img src=x/);
});
test('zero kg bodyweight entries do not cause invalid percentages',()=>{
  const state=base();state.logs=sessions(3).map(row=>({...row,kg:0}));
  const html=markup(state);
  assert.doesNotMatch(html,/NaN|Infinity/);
  assert.match(html,/0 kg/);
});
test('history and chart selectors and Train navigation are real controls',()=>{
  const html=markup({...base(),logs:sessions(9)});
  assert.match(html,/id="strength-metric"/);
  assert.match(html,/id="strength-history-filter"/);
  assert.match(html,/id="strength-exercise"/);
  assert.match(html,/data-page="train"/);
});


test('compact metrics abbreviate display only, while preserving full Day 1 in saved state',()=>{
  const data=base();
  data.logs=sessions(1);
  const html=markup(data);
  assert.match(html,/Journey Day 1/);
  assert.match(html,/Nov 02/);
  assert.match(html,/2026/);
  assert.match(html,/Current best/);
  assert.equal(data.logs[0].date,'2026-11-02');
  assert.equal((html.match(/class="sj-stat"/g)||[]).length,5);
});

test('nine-session compact charts keep every real data point and readable-date labels',()=>{
  const data=base();data.logs=sessions(9);
  const html=markup(data);
  assert.equal((html.match(/class="sj-svg-dot"/g)||[]).length,18);
  assert.match(html,/viewBox="0 0 410 151"/);
  assert.match(html,/Nov 02/);
  assert.match(html,/Nov 26/);
});

test('compact session rows show recorded difficulty without opening a row',()=>{
  const data=base();data.logs=sessions(1).map(row=>({...row,difficulty:'too_easy'}));
  const html=markup(data);
  const summary=html.slice(html.indexOf('<summary>',html.indexOf('sj-history-row')));
  assert.match(summary,/sj-history-feedback/);
  assert.match(summary,/Too easy/);
  assert.doesNotMatch(html,/<img src=x onerror/);
});
