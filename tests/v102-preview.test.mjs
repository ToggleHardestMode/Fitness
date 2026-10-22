import test from 'node:test';
import assert from 'node:assert/strict';
import { V102_CSV, V102_VERSION } from '../preview-v101/v102-data.js';
import { parseWorkouts, addWorkouts, emptyState, validateBackup } from '../preview-v101/core.js';
import { parseV102Coefficients, validateV102Mapping, weeklyV102Overlap, V102_REGIONS } from '../preview-v101/v102-overlap.js';

const ids = () => {let n=0;return ()=>`v102-fixture-${++n}`;};
const templates = () => parseWorkouts(V102_CSV).map(t=>({...t,sourceVersion:V102_VERSION}));
const scheduled = () => {
  const s=addWorkouts(emptyState(),templates(),false,ids()).state;
  s.assignments=Object.fromEntries(s.templates.map(t=>[t.day,t.id]));
  return s;
};

test('V10.2 imported program: four days, 24 rows, 62 sets, notes, PT reviews and seconds/side',()=>{
  const ts=templates();
  assert.deepEqual(ts.map(t=>[t.day,t.exercises.length,t.exercises.reduce((n,e)=>n+e.sets,0)]),
    [[0,6,17],[1,5,13],[3,8,21],[4,5,11]]);
  assert.equal(ts.reduce((n,t)=>n+t.exercises.reduce((m,e)=>m+e.sets,0),0),62);
  assert.ok(ts.every(t=>t.exercises.every(e=>typeof e.sourceNote==='string'&&e.sourceNote)));
  assert.deepEqual(ts.filter(t=>t.requiresClinicalReview).map(t=>t.day),[1,4]);
  assert.equal(ts[3].exercises.find(e=>e.name.includes('Side Plank')).repUnit,'seconds_per_side');
});

test('every coefficient row matches its correct versioned exercise, number of sets and PT status',()=>{
  const map=parseV102Coefficients();
  assert.equal(map.size,24);
  assert.equal(V102_REGIONS.length,13);
  assert.equal(validateV102Mapping(templates(),map),true);
});

test('planned physical sets remain 62, regional direct/indirect totals match V10.2 source',()=>{
  const result=weeklyV102Overlap(scheduled(),'2026-10-19');
  assert.equal(result.physicalPlanned,62);
  assert.equal(result.physicalLogged,0);
  assert.equal(result.unmapped,0);
  const expected={Chest:[10,0],Lats:[8,0],'Upper Back':[2,5],'Front Delts':[2,5],
    'Side Delts':[6,1],'Rear Delts':[2,5],Biceps:[4,5],Triceps:[4,6],
    Quads:[4,0],Hamstrings:[5,0],Glutes:[5,4.5],Calves:[6,0],Core:[4,0]};
  for(const [region,[direct,indirect]] of Object.entries(expected)){
    assert.equal(result.planned[region].direct,direct,region+' direct');
    assert.equal(result.planned[region].indirect,indirect,region+' indirect');
    assert.equal(result.planned[region].equivalents,direct+indirect,region+' estimated total');
  }
});

test('logged sets: ignore duplicates, warm-ups and invalid set positions; include off-plan once',()=>{
  const s=scheduled(),t=s.templates[0];
  s.logs=[
    {date:'2026-10-19',templateId:t.id,exerciseIndex:0,set:1,kg:20,reps:10},
    {date:'2026-10-19',templateId:t.id,exerciseIndex:0,set:1,kg:20,reps:10},
    {date:'2026-10-20',templateId:t.id,exerciseIndex:0,set:2,kg:20,reps:10},
    {date:'2026-10-19',templateId:t.id,exerciseIndex:0,set:3,isWarmup:true},
    {date:'2026-10-19',templateId:t.id,exerciseIndex:0,set:99,kg:20,reps:10}
  ];
  const result=weeklyV102Overlap(s,'2026-10-19');
  assert.equal(result.physicalLogged,2);
  assert.equal(result.logged.Chest.direct,2);
  assert.equal(result.logged['Front Delts'].indirect,1);
  assert.equal(result.logged.Triceps.indirect,1);
  assert.equal(s.logs.length,5);
});

test('opt-in import preserves all prior logs and schedule, skips duplicates, refuses lower auto-assignment',()=>{
  const initial=emptyState();
  initial.metrics.push({date:'2026-10-19',weight:88,calories:null,protein:null,sleep:null,recovery:null});
  const snapshot=structuredClone(initial);
  const added=addWorkouts(initial,templates(),false,ids());
  assert.equal(added.added,4);
  assert.deepEqual(initial,snapshot);
  assert.deepEqual(added.state.assignments,{});
  assert.deepEqual(added.state.logs,[]);
  assert.deepEqual(added.state.metrics,initial.metrics);
  const twice=addWorkouts(added.state,templates(),false,ids());
  assert.equal(twice.added,0);
  assert.equal(twice.skipped,4);
  assert.deepEqual(validateBackup(twice.state),twice.state);
  const assigned=addWorkouts(initial,templates(),true,ids()).state;
  assert.deepEqual(Object.keys(assigned.assignments).sort(),['0','3']);
});

test('invalid coefficients and invalid Monday reject rather than invent doses',()=>{
  assert.throws(()=>weeklyV102Overlap(scheduled(),'2026-10-20'),/Monday/);
  assert.throws(()=>parseV102Coefficients('day,exercise,prescribed_sets\nMon,Bad,2'),/coefficient/i);
});

test('historical V10.1 logs are not retroactively assigned V10.2 overlap coefficients',()=>{
  const state=scheduled();
  state.templates.push({id:'legacy',day:0,name:'Old Program',exercises:[{name:'DB Flat Bench Press',sets:4,muscle:'Chest',min:8,max:12,rest:90}]});
  state.logs.push({date:'2026-10-19',templateId:'legacy',exerciseIndex:0,set:1,kg:20,reps:10});
  const result=weeklyV102Overlap(state,'2026-10-19');
  assert.equal(result.physicalLogged,0);
  assert.equal(result.logged.Chest.direct,0);
});

test('only currently assigned V10.2 sessions contribute to prescribed planned volume',()=>{
  const state=scheduled();
  delete state.assignments[1];delete state.assignments[4];
  const result=weeklyV102Overlap(state,'2026-10-19');
  assert.equal(result.physicalPlanned,38);
  assert.equal(result.planned.Quads.direct,0);
  assert.equal(result.planned.Glutes.equivalents,0);
});
