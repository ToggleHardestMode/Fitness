import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarICS, emptyState} from '../preview-v101/core.js';

const icsEvents = text => text.split('BEGIN:VEVENT\r\n').slice(1).map(x => {
  const event = x.split('\r\nEND:VEVENT')[0];
  const field = key => event.match(new RegExp('^'+key+':([^\\r\\n]+)','m'))?.[1];
  return {uid:field('UID'),start:field('DTSTART'),stamp:field('DTSTAMP'),
    summary:field('SUMMARY'),alarm:event.includes('BEGIN:VALARM')};
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
  assert.ok(later.every(x=>x.alarm));
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
  assert.ok(events[0].uid.includes('%0D%0A'));
});

test('calendar requires one valid assignment and rejects invalid reminder time',()=>{
  const state=fixture();
  state.assignments={};
  assert.throws(()=>calendarICS(state),/Assign at least one/);
  state.assignments={0:'upper-a-id'};
  state.reminder={hour:25,minute:30,lead:0};
  assert.throws(()=>calendarICS(state),/Hour/);
});
