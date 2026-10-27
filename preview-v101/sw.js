// Offline shell, no background notification or network analytics.
const CACHE = 'fitnesspilot-preview-v15200-fantasy-vitamin-v52';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './focus-mode.js', './focus-quick-entry.js', './slime-hit.js', './slime-hit.svg', './slime-hit.css', './adventurer-idle.svg', './dashboard-adventurer.css', './dashboard-walker.js', './food-diary-chart.js', './food-diary-chart.css', './food-diary.html', './food-diary.css', './food-diary.js', './food-diary-core.js', './sg-food-lookup.js', './sg-food-references.js', './fp39-dark-fantasy.css', './vitamin-units.js', './vitamin-reference-ui.js', './nutrition.html', './nutrition-cheatsheet.html', './nutrition_targets.json', './nutrition.css', './nutrition-journey.js', './nutrition-reference-cards.js', './dashboard-walker-apply.js', './walker-still.js', './dashboard-walker.css', './quick-repeat.js', './template-version.js', './workout-logbook.js', './manual-progression.js', './manual-progression-ui.js', './recovery-check.js', './v154-progression.css', './template-transfer.js', './template-import-ui.js', './v152-focus.css', './v1512-quick.css', './core.js', './tracking-reset.js', './v101-data.js', './v102-data.js', './v102-overlap.js', './v102-overlap-ui.js', './v102-overlap.css', './symptom-journal.js', './symptom-ui.js', './training-analytics.js', './metric-breakdown.js', './training-analytics-ui.js', './volume-bars.js', './ro-feedback.js', './ro-sound-data.js', './ro-theme.css', './ro-unified.css', './codex.css', './manifest.webmanifest', './qa.html', './qa.css', './qa-checklist.js', './assets/icon.svg'];
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