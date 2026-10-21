// Offline, optional soft button sound and short pressed-state animation.
import { SQUISH_SOUND_URL } from './ro-sound-data.js';
const SOUND_KEY = 'fitnesspilot.preview.v101.ui.click-sound.v1';
const PRESS_SELECTOR = 'button, input[type="checkbox"]';
let sound;
let soundOn = false;
let started = false;
const pressed = new Set();

export function isRoSoundEnabled() {
  return soundOn;
}

function saveSoundChoice(enabled) {
  soundOn = enabled;
  try { window.localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* keep in-session choice */ }
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

function playSquish() {
  if (!soundOn) return;
  try {
    if (!sound) {
      sound = new Audio(SQUISH_SOUND_URL);
      sound.preload = 'auto';
      sound.volume = 0.55;
    }
    sound.pause();
    sound.currentTime = 0;
    const attempt = sound.play();
    attempt?.catch?.(() => {}); // iOS may block audio; pressing still works.
  } catch { /* Keep the UI responsive without audio. */ }
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
    if (control && !control.disabled && event.isTrusted) playSquish();
  }, true);
  document.addEventListener('change', event => {
    if (event.target.id === 'ro-click-sound') saveSoundChoice(event.target.checked);
  });
}