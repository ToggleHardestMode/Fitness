import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarICS, emptyState} from '../preview-v101/core.js';

const icsEvents = text => text.replace(/\r\n[ \t]/g, '').split('BEGIN:VEVENT\r\n').slice(1).map(x => {
  const event = x.split('\r\nEND:VEVENT')[0];
  const field = key => event.match(new RegExp('^'+key+':([^\\r\\n]+)','m'))?.[1];
  return {uid:field('UID'),start:field('DTSTART'),stamp:field('DTSTAMP'),
    summary:field('SUMMARY'),end:field('DTEND'),recurrence:field('RRULE'),
    trigger:field('TRIGGER'),alarm:event.includes('BEGIN:VALARM')};
});
const fixture = () => {
  const state=emptyState();
  state.templates=[
    {id:'upper-a-id',name:'Upper A',day:0,exercises:[]},
    {id:'upper-b-id',name:'Upper B',day:3,exercises:[]}
  ];
  state.assignments={0:'upper-a-id',3:'upper-b-id'};
  return state;
};

test('two exports a day apart retain UID per weekday/workout but update export timestamps',()=>{
  const state=fixture();
  const before=structuredClone(state);
  const a=icsEvents(calendarICS(state,new Date('2026-11-11T09:00:00Z')));
  const b=icsEvents(calendarICS(state,new Date('2026-11-12T09:00:00Z')));
  assert.equal(a.length,2);
  assert.deepEqual(a.map(x=>x.uid),b.map(x=>x.uid));
  assert.equal(new Set(a.map(x=>x.uid)).size,2);
  assert.ok(a.every(x=>x.uid.startsWith('fitnesspilot-')&&x.alarm));
  assert.notDeepEqual(a.map(x=>x.stamp),b.map(x=>x.stamp));
  assert.deepEqual(state,before);
});

test('UID persists across reminder settings, name changes and later exports',()=>{
  const state=fixture();
  const original=icsEvents(calendarICS(state,new Date('2026-11-11T09:00:00Z')));
  state.reminder={hour:8,minute:15,lead:30};
  state.templates[0].name='Upper A (renamed)';
  const later=icsEvents(calendarICS(state,new Date('2026-11-27T14:00:00Z')));
  assert.deepEqual(original.map(x=>x.uid),later.map(x=>x.uid));
  assert.ok(later.every(x=>x.alarm && x.trigger==='-PT30M'));
  assert.notEqual(original[0].summary,later[0].summary);
});

test('a different assigned workout gets a different UID, not an accidental update',()=>{
  const state=fixture();
  const before=icsEvents(calendarICS(state,new Date('2026-11-11T09:00:00Z')));
  state.templates.push({id:'new-upper-id',name:'Other Upper A',day:0,exercises:[]});
  state.assignments[0]='new-upper-id';
  const after=icsEvents(calendarICS(state,new Date('2026-11-11T09:00:00Z')));
  assert.notEqual(before[0].uid,after[0].uid);
  assert.equal(before[1].uid,after[1].uid);
});

test('same template assigned to two weekdays creates two distinct stable events',()=>{
  const state=fixture();
  state.assignments[3]='upper-a-id';
  const a=icsEvents(calendarICS(state,new Date('2026-11-11T09:00:00Z')));
  const b=icsEvents(calendarICS(state,new Date('2026-11-12T09:00:00Z')));
  assert.notEqual(a[0].uid,a[1].uid);
  assert.deepEqual(a.map(x=>x.uid),b.map(x=>x.uid));
});

test('UID encodes template ID instead of permitting forged iCalendar fields',()=>{
  const state=fixture();
  state.templates[0].id='upper\r\nSUMMARY:Injected';
  state.assignments[0]=state.templates[0].id;
  const raw=calendarICS(state,new Date('2026-11-11T09:00:00Z'));
  const events=icsEvents(raw);
  assert.equal(events.length,2);
  assert.equal((raw.match(/\r\nSUMMARY:/g)||[]).length,2);
  assert.ok(events[0].uid.includes('.d..a.'));
});

test('calendar requires one valid assignment and rejects invalid reminder time',()=>{
  const state=fixture();
  state.assignments={};
  assert.throws(()=>calendarICS(state),/Assign at least one/);
  state.assignments={0:'upper-a-id'};
  state.reminder={hour:25,minute:30,lead:0};
  assert.throws(()=>calendarICS(state),/Hour/);
});

test('moving or removing a weekday does not rename any other reminder',()=>{
  const state=fixture();
  const now=new Date(2026,10,11,12);
  const [monday,thursday]=icsEvents(calendarICS(state,now));
  delete state.assignments[0];
  state.assignments[1]='upper-a-id';
  const [tuesday,existingThursday]=icsEvents(calendarICS(state,now));
  assert.notEqual(tuesday.uid,monday.uid);
  assert.equal(existingThursday.uid,thursday.uid);
  delete state.assignments[1];
  assert.deepEqual(icsEvents(calendarICS(state,now)),[thursday]);
  state.assignments[0]='upper-a-id';
  assert.deepEqual(icsEvents(calendarICS(state,now)),[monday,thursday]);
});

test('passing the scheduled minute advances the occurrence while keeping duration and alarm',()=>{
  const state=fixture();
  state.reminder={hour:18,minute:30,lead:0};
  const before=icsEvents(calendarICS(state,new Date(2026,10,16,18,29)))[0];
  const after=icsEvents(calendarICS(state,new Date(2026,10,16,18,30)))[0];
  assert.equal(before.uid,after.uid);
  assert.deepEqual([before.start,before.end],['20261116T183000','20261116T193000']);
  assert.deepEqual([after.start,after.end],['20261123T183000','20261123T193000']);
  assert.equal(after.recurrence,'FREQ=WEEKLY');
  assert.equal(after.trigger,'PT0M');
});

test('long and unusual legacy IDs remain distinct and survive iCalendar line folding',()=>{
  const state=fixture();
  const shared='🗓'.repeat(60);
  state.templates[0].id=shared+'\ud800';
  state.templates[1].id=shared+'.d800.';
  state.assignments={0:state.templates[0].id,1:state.templates[1].id};
  const now=new Date(2026,10,11,12);
  const raw=calendarICS(state,now);
  const [first,second]=icsEvents(raw);
  assert.match(raw,/\r\nUID:[^\r\n]{70}\r\n /);
  assert.ok(raw.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
  assert.ok(first.uid.endsWith('.d800.@local'));
  assert.ok(second.uid.endsWith('.2e.d800.2e.@local'));
  state.assignments={0:state.templates[1].id};
  assert.notEqual(icsEvents(calendarICS(state,now))[0].uid,first.uid);
});

test('all seven assigned weekdays have stable, distinct UIDs across a year boundary',()=>{
  const state=fixture();
  state.assignments=Object.fromEntries(Array.from({length:7},(_,day)=>[day,'upper-a-id']));
  const before=icsEvents(calendarICS(state,new Date(2026,11,31,9))).map(event=>event.uid);
  const after=icsEvents(calendarICS(state,new Date(2027,0,1,9))).map(event=>event.uid);
  assert.equal(new Set(before).size,7);
  assert.deepEqual(after,before);
});
