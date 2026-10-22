import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, STARTER_CSV, parseCSV, parseWorkouts, addWorkouts, recordSets, saveMetrics, weeklyStats, bestSets, weekdayOf, weekDates, dateKey, addDays, validateBackup, calendarICS } from '../core.js';

const starter=()=>addWorkouts(emptyState(),parseWorkouts(STARTER_CSV),true,()=>`t${Math.random().toString().slice(2)}`).state;
const firstSet=(state,date='2026-10-19', kg=20)=>recordSets(state,{date,templateId:state.assignments[0],exerciseIndex:0,entries:[{completed:true,kg,reps:10,rpe:8,rest:120,notes:'Controlled',tempo:'3-1-1'},{completed:false},{completed:false}]},()=> 'set1').state;

test('Four-day starter plan has exact intended assignments',()=>{
 const s=starter(); assert.equal(s.templates.length,4);assert.deepEqual(Object.keys(s.assignments),['0','1','3','4']);assert.equal(s.templates.reduce((n,t)=>n+t.exercises.length,0),15);
});
test('CSV handles Excel BOM, comma and escaped quotation marks',()=>{
 const raw='\uFEFFday,workout,exercise,muscle,sets,rep_min,rep_max\r\nMon,Upper A,"Bench, Dumbbell ""Incline""",Chest,3,8,12\r\n';
 const x=parseWorkouts(raw);assert.equal(x[0].exercises[0].name,'Bench, Dumbbell "Incline"');
});
test('CSV refuses malformed quotes and missing headings',()=>{
 assert.throws(()=>parseCSV('day,workout\n"broken'),/unfinished quoted/);
 assert.throws(()=>parseWorkouts('day,workout\nMon,Upper'),/missing the 'exercise'/);
 assert.throws(()=>parseCSV('day,day\na,b'),/duplicate column/);
});
test('CSV refuses invalid bounds and non-supported weekdays',()=>{
 assert.throws(()=>parseWorkouts('day,workout,exercise,muscle,sets,rep_min,rep_max\nMon,A,B,C,0,8,12'),/sets/);
 assert.throws(()=>parseWorkouts('day,workout,exercise,muscle,sets,rep_min,rep_max\nMon,A,B,C,3,15,12'),/exceed/);
 assert.throws(()=>parseWorkouts('day,workout,exercise,muscle,sets,rep_min,rep_max\nFunday,A,B,C,3,8,12'),/Unknown weekday/);
});
test('Identical template imports skip duplicates and do not alter day assignment',()=>{
 const s=starter(),original=s.assignments[0],o=addWorkouts(s,parseWorkouts(STARTER_CSV));
 assert.equal(o.added,0);assert.equal(o.skipped,4);assert.equal(o.state.assignments[0],original);
});
test('Saving a set is idempotent for same key; updating changes only that set',()=>{
 let s=starter();s=firstSet(s);assert.equal(s.logs.length,1);assert.equal(s.logs[0].kg,20);
 s=firstSet(s,'2026-10-19',22);assert.equal(s.logs.length,1);assert.equal(s.logs[0].kg,22);assert.equal(s.logs[0].notes,'Controlled');
});
test('Saved sessions are retained after changing weekly assignment',()=>{
 let s=firstSet(starter());s.assignments={};
 assert.equal(s.logs.length,1);assert.equal(s.logs[0].exerciseName,'Dumbbell Bench Press');
 assert.equal(weeklyStats(s,'2026-10-19').sessions,1);
});
test('Invalid set causes no mutation',()=>{
 const s=starter(),before=JSON.stringify(s);
 assert.throws(()=>recordSets(s,{date:'2026-10-19',templateId:s.assignments[0],exerciseIndex:0,entries:[{completed:true,kg:-5,reps:10},{},{},]}),/weight/);
 assert.equal(JSON.stringify(s),before);
});
test('Daily check-in updates same date and weekly averages ignore missing days',()=>{
 let s=saveMetrics(starter(),'2026-10-19',{weight:'86',calories:'2200',protein:'150',sleep:'8',recovery:'4'});
 s=saveMetrics(s,'2026-10-19',{weight:'85',calories:'2100',protein:'160',sleep:'7',recovery:'4'});
 assert.equal(s.metrics.length,1);const a=weeklyStats(s,'2026-10-20');assert.equal(a.weight,85);assert.equal(a.protein,160);
});
test('Volume and best set only reflect actual checked sets',()=>{
 const s=firstSet(starter());const w=weeklyStats(s,'2026-10-20');assert.equal(w.volume,200);assert.equal(w.sets,1);assert.equal(w.sessions,1);
 assert.equal(bestSets(s)[0].exerciseName,'Dumbbell Bench Press');
});
test('Calendar weekdays correctly align around Monday and Sunday',()=>{
 assert.equal(weekdayOf('2026-10-19'),0);assert.equal(weekdayOf('2026-10-25'),6);
 assert.equal(addDays('2026-12-31',1),'2027-01-01');
 assert.equal(weekDates('2026-10-25')[0],'2026-10-19');
});
test('Calendar file contains correct number of repeating sessions and alarms',()=>{
 const ics=calendarICS(starter(),new Date(2026,9,20,10,0));
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,4);
 assert.equal((ics.match(/BEGIN:VALARM/g)||[]).length,4);
 assert.equal((ics.match(/RRULE:FREQ=WEEKLY/g)||[]).length,4);
 assert.match(ics,/DTSTART:20261022T183000/); assert.match(ics,/\r\nEND:VCALENDAR\r\n$/);
});
test('Calendar export refuses empty schedule',()=>assert.throws(()=>calendarICS(emptyState()),/Assign at least one/));
test('Backup validates good data and rejects duplicate sets and missing template',()=>{
 const s=firstSet(starter());const backup=validateBackup(s);assert.equal(backup.logs.length,1);
 const dup=structuredClone(s);dup.logs.push(structuredClone(dup.logs[0]));assert.throws(()=>validateBackup(dup),/duplicate sets/);
 const missing=structuredClone(s);missing.templates=[];assert.throws(()=>validateBackup(missing),/missing workout|missing template/);
});
test('Invalid dates are rejected',()=>assert.throws(()=>weekdayOf('2026-02-30'),/Invalid calendar/));