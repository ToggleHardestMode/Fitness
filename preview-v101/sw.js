// Offline shell, no background notification or network analytics.
const CACHE = 'fitnesspilot-preview-v152632-calendar-uid';
const ASSETS = ['./', './index.html', './tokens.css', './base.css', './app.js', './actions.js', './dashboard-view.js', './train-view.js', './plan-view.js', './tools-view.js', './state.js', './html.js', './backup-reminder.js', './encrypted-backup.html', './encrypted-backup.css', './encrypted-backup-ui.js', './encrypted-backup-core.js', './focus-mode.js', './focus-quick-entry.js', './slime-hit.js', './slime-hit.svg', './adventurer-idle.svg', './pages.css', './dashboard-walker.js', './food-diary-chart.js', './components.css', './food-diary.html', './food-diary.css', './food-diary.js', './food-diary-core.js', './food-diary-csv.js', './food-staples.js', './sg-food-lookup.js', './sg-food-references.js', './vitamin-units.js', './vitamin-reference-ui.js', './nutrition.html', './nutrition-cheatsheet.html', './nutrition_targets.json', './nutrition.css', './nutrition-journey.js', './nutrition-reference-cards.js', './dashboard-walker-apply.js', './walker-still.js', './quick-repeat.js', './return-coverage.js', './return-training-ui.js', './template-version.js', './workout-logbook.js', './strength-journey.js', './week-window.js', './exercise-equivalence.js', './active-sets.js', './exercise-clearance.js', './exercise-clearance-ui.js', './active-sets-ui.js', './exercise-equivalence-ui.js', './strength-journey-ui.js', './strength-journey-visual.js', './floating-rest.js', './completed-workout-csv.js', './recovery-check.js', './template-transfer.js', './template-import-ui.js', './core.js', './tracking-reset.js', './v101-data.js', './v102-data.js', './v103-data.js', './v102-overlap.js', './v102-overlap-ui.js', './symptom-journal.js', './symptom-ui.js', './training-analytics.js', './metric-breakdown.js', './training-analytics-ui.js', './volume-bars.js', './ro-feedback.js', './ro-sound-data.js', './theme.css', './manifest.webmanifest', './qa.html', './qa.css', './qa-checklist.js', './assets/icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fitnesspilot-preview-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(c => c.put(event.request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const url = new URL(event.request.url);
    // Versioned preview URLs (?v=24) use the cached shell while offline.
    if (event.request.mode === 'navigate' && url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) {
      return caches.match(new URL('./index.html', self.registration.scope).href);
    }
    return Response.error();
  }));
});