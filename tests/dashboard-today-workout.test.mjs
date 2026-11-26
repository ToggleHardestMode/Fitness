import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardHtml } from './dashboard-fixture.mjs';

const day = '2026-10-26';
const t = {id: 'fixture-upper', name: 'Upper <A>', sourceVersion: 'V10.3', exercises: [
  {name: 'Press', muscle: 'Chest', sets: 3, min: 8, max: 12, rest: 90}
]};
const state = {templates: [t], assignments: {0: t.id}};
const todayCard = html => html.match(/<section class="card fp-today"[^>]*>[\s\S]*?<\/section>/)?.[0];

test('Today shortcut targets the assigned workout independently of the historical week selector', () => {
  const html = dashboardHtml(state, {day, selection: {selectedWeekStart: '2026-10-05'}});
  const card = todayCard(html);
  assert.ok(card);
  assert.match(card, /Today · 2026-10-26/);
  assert.match(card, /Upper &lt;A&gt;/);
  assert.match(card, /Program: V10.3/);
  assert.match(card, /data-workout-date="2026-10-26" data-workout-id="fixture-upper"/);
  assert.match(card, /Start workout/);
  assert.match(card, /Choose another workout/);
  assert.doesNotMatch(html, /class="v151-gold-next"/);
  assert.ok(html.indexOf('aria-label="Weekly insights"') < html.indexOf('aria-label="Today and next workout"'));
});

test('rest day names next scheduled date and preserves the option to choose a workout today', () => {
  const card = todayCard(dashboardHtml(state, {day: '2026-10-27'}));
  assert.match(card, /No workout scheduled today · Next: 2026-11-02/);
  assert.match(card, /data-workout-date="2026-11-02"/);
  assert.match(card, /Open next workout/);
  assert.match(card, /Choose workout today/);
});

test('PT Review caution and unassigned/empty Plan fallbacks are retained', () => {
  const pt = {...t, name: 'Lower [PT Review]', requiresClinicalReview: true};
  const reviewed = todayCard(dashboardHtml({...state, templates: [pt]}, {day}));
  assert.match(reviewed, /PT Review is not medical clearance/);
  const unassigned = todayCard(dashboardHtml({...state, assignments: {}}, {day}));
  assert.match(unassigned, /No workout scheduled/);
  assert.match(unassigned, /Open Plan/);
  assert.doesNotMatch(unassigned, /open-scheduled-workout/);
  const empty = todayCard(dashboardHtml({}, {day}));
  assert.match(empty, /Set up your first workout plan/);
  assert.match(empty, /Open Plan/);
});
