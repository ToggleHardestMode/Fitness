// Preview-only floating rest timer. No workout history mutations or network requests.
export function timeLeftSeconds(end, now) {
  if (!Number.isFinite(end) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((end - now) / 1000));
}
export function restClock(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' +
    String(value % 60).padStart(2, '0');
}
export const effortHint = 'Effort = how hard the set felt. 6 = easy (~4 clean reps left); 7 = moderate (~3 left); 8 = hard (~2 left); 9 = very hard (~1 left); 10 = no clean reps left. RIR means reps left. Leave blank if unsure.';
export function effortQuickLabel(value) {
  return ({6:'Easy (6)',7:'Moderate (7)',8:'Hard (8)',9:'Very hard (9)'})[value] || String(value);
}

export function createFloatingRestTimer({doc = document, win = window, now = Date.now} = {}) {
  const KEY = 'fitnesspilot.preview.v101.ui.rest-sound.v1';
  let soundEnabled = true;
  try { soundEnabled = win.localStorage.getItem(KEY) !== 'off'; } catch {}
  let end = null, handle = null, finished = false, open = false, page = 'dashboard', ctx = null;
  const root = doc.createElement('div');
  root.id = 'fp-floating-rest';
  root.className = 'fp-floating-rest';
  root.innerHTML = `
    <button type="button" class="fp-rest-fab" id="fp-rest-toggle" aria-expanded="false"
      aria-controls="fp-rest-panel" aria-label="Open rest timer"><span aria-hidden="true">⏱</span>
      <span class="fp-rest-fab-text">Rest timer</span><strong id="fp-rest-fab-clock">00:00</strong></button>
    <section id="fp-rest-panel" class="fp-rest-panel" hidden aria-label="Rest timer controls">
      <div class="fp-rest-head"><strong>Rest timer</strong><button type="button" id="fp-rest-hide"
        aria-label="Close timer controls">×</button></div>
      <div class="fp-rest-count" id="fp-rest-count" role="timer">00:00</div>
      <div class="fp-rest-actions">
        <button type="button" data-rest-seconds="60">1 min</button>
        <button type="button" data-rest-seconds="90">90 sec</button>
        <button type="button" data-rest-seconds="120">2 min</button>
        <button type="button" id="fp-rest-stop">Stop</button>
      </div>
      <div class="fp-rest-sound-row"><label><input type="checkbox" id="fp-rest-sound"
        ${soundEnabled ? 'checked' : ''}> Audible finish</label>
        <button type="button" id="fp-rest-test">Test sound</button></div>
      <p class="fp-rest-note" id="fp-rest-note">Keep FitnessPilot open and visible for an audible alert.
        iPhone Silent Mode, browser restrictions, and a locked screen can prevent web audio.
        For guaranteed alerts when locked, use the iPhone Clock app.</p>
    </section>
    <div class="fp-rest-done" id="fp-rest-done" hidden>
      <div class="fp-rest-done-card" role="alertdialog" aria-label="Rest timer finished" aria-modal="true">
        <span class="fp-rest-spark" aria-hidden="true">✦</span>
        <strong>Rest complete</strong>
        <span>Ready for your next set?</span>
        <button type="button" id="fp-rest-dismiss">Got it</button>
      </div>
    </div>`;
  doc.body.appendChild(root);
  const byId = id => root.querySelector('#' + id);
  const fab = byId('fp-rest-toggle'), panel = byId('fp-rest-panel');
  const done = byId('fp-rest-done'), note = byId('fp-rest-note');
  function getContext() {
    try {
      const AudioContext = win.AudioContext || win.webkitAudioContext;
      if (!AudioContext) return null;
      if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
      if (ctx.state !== 'running') void ctx.resume().catch(() => {
        note.textContent = 'Sound blocked. Keep the page visible and tap Test sound again.';
      });
      return ctx;
    } catch { return null; }
  }
  function playCue() {
    if (!soundEnabled) return false;
    const context = getContext();
    if (!context || context.state !== 'running') {
      note.textContent = 'Sound unavailable. Keep FitnessPilot visible, then tap Test sound.';
      return false;
    }
    // Three short scheduled notes, rather than waiting for a decoded MP3.
    try {
      const start = context.currentTime + .015;
      [880, 1047, 880].forEach((hz, i) => {
        const osc = context.createOscillator(), gain = context.createGain();
        const t = start + i * .20;
        osc.type = 'sine'; osc.frequency.value = hz;
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.exponentialRampToValueAtTime(.28, t + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, t + .17);
        osc.connect(gain); gain.connect(context.destination);
        osc.start(t); osc.stop(t + .18);
      });
      return true;
    } catch { return false; }
  }
  function stopInterval() {
    if (handle != null) win.clearInterval(handle);
    handle = null;
  }
  function sync() {
    const seconds = end == null ? 0 : timeLeftSeconds(end, now());
    const value = restClock(seconds);
    byId('fp-rest-fab-clock').textContent = value;
    byId('fp-rest-count').textContent = value;
    byId('fp-rest-fab-clock').hidden = end === null;
    fab.classList.toggle('running', end !== null);
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    done.hidden = !finished;
    root.hidden = page !== 'train' && page !== 'tools' && end == null && !finished;
  }
  function tick() {
    if (end != null && timeLeftSeconds(end, now()) === 0) {
      end = null;
      stopInterval();
      finished = true;
      open = false;
      playCue();
      try { win.navigator?.vibrate?.([140, 80, 140]); } catch {}
    }
    sync();
  }
  function start(seconds) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600)
      throw Error('Rest timer must be between 1 and 600 seconds.');
    // Called directly from a user click: unlock iOS audio before countdown.
    if (soundEnabled) getContext();
    end = now() + seconds * 1000;
    finished = false; open = false;
    stopInterval();
    handle = win.setInterval(tick, 200);
    sync();
  }
  function stop() {
    end = null; finished = false; open = false;
    stopInterval(); sync();
  }
  function updatePage(next) { page = next; sync(); }
  fab.addEventListener('click', () => { open = !open; sync(); });
  byId('fp-rest-hide').addEventListener('click', () => { open = false; sync(); });
  byId('fp-rest-stop').addEventListener('click', stop);
  byId('fp-rest-dismiss').addEventListener('click', () => { finished = false; sync(); fab.focus(); });
  byId('fp-rest-test').addEventListener('click', () => {
    const ok = playCue();
    note.textContent = ok ?
      'Test played. If silent, check iPhone volume and Silent Mode.' :
      'Sound was blocked. Try again with FitnessPilot open in the foreground.';
  });
  byId('fp-rest-sound').addEventListener('change', event => {
    soundEnabled = event.target.checked;
    try { win.localStorage.setItem(KEY, soundEnabled ? 'on' : 'off'); } catch {}
    if (soundEnabled) {
      getContext();
      note.textContent = 'Sound enabled. Tap Test sound to verify this device.';
    }
  });
  root.addEventListener('click', event => {
    const seconds = event.target.closest('[data-rest-seconds]')?.dataset.restSeconds;
    if (seconds) start(Number(seconds));
  });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) tick(); });
  sync();
  return { start, stop, tick, updatePage, getRemaining: () => end == null ? 0 : timeLeftSeconds(end, now()) };
}
