// Optional local sound and a short pressed-state animation for UI controls.
// No external audio files, permissions, analytics or network requests.
const SOUND_KEY = 'fitnesspilot.ui.click-sound.v1';
const PRESS_SELECTOR = 'button, input[type="checkbox"]';
let context;
let soundOn = false;
let started = false;
const pressed = new Set();

export function isRoSoundEnabled() {
  return soundOn;
}

function saveSoundChoice(enabled) {
  // If storage is unavailable, keep the current session's preference.
  soundOn = enabled;
  try { window.localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* no stored preference */ }
}

function clearPressed() {
  for (const button of pressed) button.classList.remove('ro-pressed');
  pressed.clear();
}

function press(button) {
  if (!button || button.disabled) return;
  clearPressed();
  button.classList.add('ro-pressed');
  pressed.add(button);
}

function playClick() {
  if (!soundOn) return;
  const AudioClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioClass) return;
  try {
    if (!context) context = new AudioClass();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const at = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, at);
    osc.frequency.exponentialRampToValueAtTime(490, at + 0.065);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.018, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.085);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(at);
    osc.stop(at + 0.09);
  } catch { /* Silent fallback if iOS does not allow audio. */ }
}

export function initRoFeedback() {
  if (started) return;
  started = true;
  try { soundOn = window.localStorage.getItem(SOUND_KEY) === 'on'; } catch { soundOn = false; }
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    press(event.target.closest?.(PRESS_SELECTOR));
  }, true);
  document.addEventListener('pointerup', clearPressed, true);
  document.addEventListener('pointercancel', clearPressed, true);
  document.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') press(event.target.closest?.(PRESS_SELECTOR));
  }, true);
  document.addEventListener('keyup', clearPressed, true);
  window.addEventListener('blur', clearPressed);
  document.addEventListener('click', event => {
    const control = event.target.closest?.(PRESS_SELECTOR);
    if (control && !control.disabled && event.isTrusted) playClick();
  }, true);
  document.addEventListener('change', event => {
    if (event.target.id === 'ro-click-sound') saveSoundChoice(event.target.checked);
  });
}