import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('main Dashboard links to the existing Nutrition guide directly below the heading', () => {
  const app = source('../app.js');
  const start = app.indexOf('function dashboard() {');
  const end = app.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, 'Dashboard renderer exists');
  const dashboard = app.slice(start, end);
  assert.match(dashboard, /\$\{shellHeading\(\)\}<nav class="choice-row" aria-label="Nutrition quick links"><a class="btn secondary" href="\.\/preview-v101\/nutrition-cheatsheet\.html">Nutrition guide<\/a><\/nav>/);
  assert.ok(dashboard.indexOf('Nutrition guide') < dashboard.indexOf('This week'), 'guide precedes weekly overview');
});

test('Nutrition guide destination exists and remains a read-only reference', () => {
  const page = source('../preview-v101/nutrition-cheatsheet.html');
  assert.match(page, /<h1>Nutrition cheatsheet<\/h1>/);
  assert.match(page, /provisional examples, not measured intake/);
});
