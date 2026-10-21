import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, STARTER_CSV, UNIFIED_UL_CSV, parseWorkouts, addWorkouts, recordSets, validateBackup } from '../core.js';

const freshIds = prefix => { let n=0;return ()=>prefix+(++n); };
const workouts = () => parseWorkouts(UNIFIED_UL_CSV);

test('Unified program preserves original four training days and 27 entries', () => {
 const p=workouts();
 assert.deepEqual(p.map(x=>x.day),[0,1,3,4]);
 assert.deepEqual(p.map(x=>x.exercises.length),[7,6,8,6]);
 assert.deepEqual(p[0].exercises[0].setTargets,[{min:5,max:8},{min:8,max:12},{min:8,max:12}]);
 assert.deepEqual(p[1].exercises[0].setTargets,[{min:6,max:8},{min:10,max:12},{min:10,max:12}]);
 assert.deepEqual(p[2].exercises[0].setTargets,[{min:6,max:9},{min:10,max:12},{min:10,max:12}]);
 assert.equal(p[2].exercises.find(x=>x.name==='Face Pull (SS1)').rest,60);
 assert.equal(p[2].exercises.find(x=>x.name==='DB Lateral Raise (SS1)').rest,60);
});

test('Invalid optional per-set specifications fail with a clear error', () => {
 const prefix='day,workout,exercise,muscle,sets,rep_min,rep_max,set_targets\nMon,A,B,Chest,3,5,12,';
 assert.throws(()=>parseWorkouts(prefix+'5-8|8-12'),/exactly 3/);
 assert.throws(()=>parseWorkouts(prefix+'5-8|bad|8-12'),/must look like/);
 assert.throws(()=>parseWorkouts(prefix+'5-8|9-8|8-12'),/conflicts/);
 assert.throws(()=>parseWorkouts(prefix+'5-8|8-13|8-12'),/conflicts/);
 assert.throws(()=>parseWorkouts(prefix+'0-8|8-12|8-12'),/between 1 and 100/);
});

test('Ordinary CSV files without per-set targets still work', () => {
 const s=parseWorkouts(STARTER_CSV);
 assert.equal(s.length,4);
 assert.equal(s[0].exercises[0].setTargets,undefined);
});

test('Adding Unified workouts preserves existing schedule, sets, metrics, and older templates',()=>{
 const old=addWorkouts(emptyState(),parseWorkouts(STARTER_CSV),true,freshIds('old-')).state;
 const oldWorkout=old.templates[0];
 const recorded=recordSets(old,{
  date:'2026-10-19',templateId:oldWorkout.id,exerciseIndex:0,
  entries:[{completed:true,kg:24,reps:10,rpe:8,rest:90,notes:'original',tempo:''},{completed:false},{completed:false}]
 },freshIds('log-')).state;
 const snapshot=structuredClone(recorded);
 const result=addWorkouts(recorded,workouts(),false,freshIds('new-'));
 assert.equal(result.added,4);
 assert.deepEqual(result.state.assignments,snapshot.assignments);
 assert.deepEqual(result.state.logs,snapshot.logs);
 assert.deepEqual(result.state.metrics,snapshot.metrics);
 assert.deepEqual(recorded,snapshot);
 assert.equal(result.state.templates[0].exercises[0].name,'Dumbbell Bench Press');
 assert.equal(result.state.templates.length,8);
 validateBackup(result.state);
});

test('Adding the Unified plan twice does not duplicate it',()=>{
 const one=addWorkouts(emptyState(),workouts(),false,freshIds('once-'));
 const two=addWorkouts(one.state,workouts(),false,freshIds('twice-'));
 assert.equal(two.added,0);
 assert.equal(two.skipped,4);
 assert.deepEqual(two.state,one.state);
});

test('Top and back-off sets are recorded as one exercise and survive JSON backup',()=>{
 const s=addWorkouts(emptyState(),workouts(),true,freshIds('unified-')).state;
 const result=recordSets(s,{
  date:'2026-10-19',templateId:s.assignments[0],exerciseIndex:0,
  entries:[
   {completed:true,kg:60,reps:6,rpe:8,rest:90,notes:'top',tempo:''},
   {completed:true,kg:55,reps:10,rpe:7,rest:90,notes:'back-off',tempo:''},
   {completed:true,kg:55,reps:11,rpe:8,rest:90,notes:'back-off',tempo:''}
  ]
 },freshIds('log-'));
 assert.equal(result.saved,3);
 assert.deepEqual(result.state.logs.map(l=>[l.exerciseIndex,l.set,l.reps]),[[0,1,6],[0,2,10],[0,3,11]]);
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(result.state))),result.state);
});

test('Invalid backup per-set counts are rejected without mutating the source',()=>{
 const state=addWorkouts(emptyState(),workouts(),false,freshIds('template-')).state;
 const old=JSON.stringify(state),corrupted=structuredClone(state);
 corrupted.templates[0].exercises[0].setTargets.pop();
 assert.throws(()=>validateBackup(corrupted),/target count/);
 assert.equal(JSON.stringify(state),old);
});
