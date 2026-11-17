import { createActions } from './actions.js';
import { dateKey } from './core.js';
import { dashboardView } from './dashboard-view.js';
import { esc } from './html.js';
import { planView } from './plan-view.js';
import { initRoFeedback } from './ro-feedback.js';
import { toolsView } from './tools-view.js';
import { trainView } from './train-view.js';

const $ = (selector) => document.querySelector(selector);
const fmt = (n) => Number(n).toLocaleString('en-SG', { maximumFractionDigits: 1 });
const today = () => dateKey(new Date());
const nice = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
const icons = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  train: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  tools:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4' +
    'M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const navItems = [
  ['dashboard', 'Dashboard'],
  ['train', 'Train'],
  ['plan', 'Plan'],
  ['tools', 'Tools']
];

function navMarkup(page) {
  return navItems
    .map(
      ([id, label]) =>
        `<button type="button" class="tab ${page === id ? 'active' : ''}" data-page="${id}" aria-label="${label}" ` +
        `aria-current="${page === id ? 'page' : 'false'}">${svg(id)}<span>${label}</span></button>`
    )
    .join('');
}
function heading(kicker, title, subtitle = '') {
  return `<div class="screen-intro"><div class="eyebrow">${esc(kicker)}</div>` +
    `<h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>`;
}
function shellHeading() {
  const date = new Date().toLocaleDateString('en-SG', { month: 'short', day: 'numeric', weekday: 'short' });
  return '<div class="header-row"><div class="wordmark"><img src="./assets/icon.svg" alt="">' +
    `<span>FitnessPilot</span></div><div class="date-pill">${date}</div></div>`;
}
function rangeSummary(exercise) {
  return exercise.setTargets
    ? exercise.setTargets.map((target) => `${target.min}–${target.max}`).join(' / ')
    : `${exercise.min}–${exercise.max}`;
}
function isPTReview(t) {
  return !!t?.requiresClinicalReview || !!t?.name?.includes('[PT Review]');
}

const views = new Map([
  ['dashboard', dashboardView],
  ['train', trainView],
  ['plan', planView],
  ['tools', toolsView]
]);
const actions = createActions({ render, today, isPTReview });
const helpers = {
  today,
  fmt,
  nice,
  shellHeading,
  heading,
  rangeSummary,
  isPTReview,
  timerRemaining: actions.timerRemaining
};

function render() {
  const { page, state, storageError } = actions;
  const markup = navMarkup(page);
  $('.bottom-tabs').innerHTML = markup;
  $('.desktop-tabs').innerHTML = markup;
  const error = storageError ? `<div class="error-strip" role="alert">${esc(storageError)}</div>` : '';
  const view = views.get(page) ?? toolsView;
  const options = actions.viewOptions();
  const storage = view === trainView || view === planView ? undefined : localStorage;
  $('#main').innerHTML = error + view(state, options, helpers, storage);
  actions.inspectWalkerDisplay();
  actions.updateTimerPage(page);
  if (page === 'tools') void actions.refreshPersistentStorageStatus();
}

render();
if ('serviceWorker' in navigator && location.protocol !== 'file:')
  navigator.serviceWorker.register('./sw.js').catch(() => {});
initRoFeedback();
