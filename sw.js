// Offline shell, no background notification or network analytics.
const CACHE = 'fitnesspilot-shell-unified-v7';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './core.js', './ro-feedback.js', './ro-sound-data.js', './ro-theme.css', './ro-unified.css', './manifest.webmanifest', './assets/icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(c => c.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});