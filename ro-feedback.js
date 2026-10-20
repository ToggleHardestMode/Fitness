// Optional local "slime squish" feedback for UI controls.
// No downloaded sound assets, permissions, analytics or network requests.
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
  soundOn = enabled;
  try { window.localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* Session-only preference. */ }
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
    const bounce = context.createOscillator();
    const squish = context.createOscillator();
    const bounceGain = context.createGain();
    const squishGain = context.createGain();

    // Quick high-to-low "pewng", followed by a small elastic rebound.
    bounce.type = 'sine';
    bounce.frequency.setValueAtTime(590, at);
    bounce.frequency.exponentialRampToValueAtTime(185, at + 0.075);
    bounce.frequency.exponentialRampToValueAtTime(235, at + 0.115);
    bounce.frequency.exponentialRampToValueAtTime(125, at + 0.22);
    bounceGain.gain.setValueAtTime(0.0001, at);
    bounceGain.gain.exponentialRampToValueAtTime(0.029, at + 0.006);
    bounceGain.gain.exponentialRampToValueAtTime(0.012, at + 0.075);
    bounceGain.gain.exponentialRampToValueAtTime(0.019, at + 0.115);
    bounceGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.245);

    // Quiet low body makes the tail soft rather than a sharp electronic click.
    squish.type = 'triangle';
    squish.frequency.setValueAtTime(150, at);
    squish.frequency.exponentialRampToValueAtTime(80, at + 0.2);
    squishGain.gain.setValueAtTime(0.0001, at);
    squishGain.gain.exponentialRampToValueAtTime(0.008, at + 0.018);
    squishGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);

    bounce.connect(bounceGain);
    bounceGain.connect(context.destination);
    squish.connect(squishGain);
    squishGain.connect(context.destination);
    bounce.start(at);
    bounce.stop(at + 0.25);
    squish.start(at);
    squish.stop(at + 0.225);
  } catch { /* Remain silent if browser audio is unavailable. */ }
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