import assert from 'node:assert/strict';
import test from 'node:test';
import { SQUISH_SOUND_URL } from '../ro-sound-data.js';

class EventSink {
  listeners = new Map();
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  fire(type, event = {}) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
}

const doc = new EventSink();
const win = new EventSink();
const preferences = new Map();
let playCount = 0;
let pauseCount = 0;
let audioCreated = 0;
let lastAudio;
win.localStorage = {
  getItem(key) { return preferences.get(key) ?? null; },
  setItem(key, value) { preferences.set(key, value); },
};
class FakeAudio {
  constructor(src) { this.src = src; this.currentTime = 5; audioCreated++; lastAudio = this; }
  pause() { pauseCount++; }
  play() { playCount++; return Promise.resolve(); }
}
globalThis.document = doc;
globalThis.window = win;
globalThis.Audio = FakeAudio;
const { initRoFeedback, isRoSoundEnabled } = await import('../ro-feedback.js');
initRoFeedback();
const original = doc.listeners.get('click').length;
initRoFeedback();
const classes = new Set();
const button = { disabled: false, classList: { add: v => classes.add(v), remove: v => classes.delete(v) } };
const event = (props = {}) => ({ target: { closest: () => button }, isTrusted: true, button: 0, ...props });

test('Initialization is idempotent, sound starts off', () => {
  assert.equal(doc.listeners.get('click').length, original);
  assert.equal(isRoSoundEnabled(), false);
});
test('Pressed state clears on release, cancellation and keyboard', () => {
  doc.fire('pointerdown', event());
  assert.equal(classes.has('ro-pressed'), true);
  doc.fire('pointerup', event());
  assert.equal(classes.size, 0);
  doc.fire('pointerdown', event());
  doc.fire('pointercancel', event());
  assert.equal(classes.size, 0);
  doc.fire('keydown', event({ key: 'Enter' }));
  assert.equal(classes.has('ro-pressed'), true);
  doc.fire('keyup', event({ key: 'Enter' }));
  assert.equal(classes.size, 0);
});
test('Disabled buttons and secondary mouse button are ignored', () => {
  button.disabled = true;
  doc.fire('pointerdown', event());
  assert.equal(classes.size, 0);
  button.disabled = false;
  doc.fire('pointerdown', event({ button: 2 }));
  assert.equal(classes.size, 0);
});
test('Embedded sound is a nonempty MP3 with the expected header', () => {
  assert.match(SQUISH_SOUND_URL, /^data:audio\/mpeg;base64,/);
  const bytes = Buffer.from(SQUISH_SOUND_URL.split(',')[1], 'base64');
  assert.ok(bytes.length > 1000);
  assert.equal(bytes.subarray(0, 3).toString(), 'ID3');
});
test('Sound off by default, enabled with checkbox and saved locally', () => {
  doc.fire('click', event());
  assert.equal(playCount, 0);
  doc.fire('change', { target: { id: 'ro-click-sound', checked: true } });
  assert.equal(isRoSoundEnabled(), true);
  assert.equal(preferences.get('fitnesspilot.ui.click-sound.v1'), 'on');
});
test('Real clicks use sample at moderate volume, synthetic clicks ignored', () => {
  doc.fire('click', event({ isTrusted: false }));
  assert.equal(playCount, 0);
  doc.fire('click', event());
  assert.equal(playCount, 1);
  assert.equal(audioCreated, 1);
  assert.equal(lastAudio.src, SQUISH_SOUND_URL);
  assert.equal(lastAudio.volume, 0.55);
  assert.equal(lastAudio.currentTime, 0);
  assert.equal(pauseCount, 1);
});
test('Rapid taps restart same sample rather than stacking, off stops sound', () => {
  doc.fire('click', event());
  doc.fire('click', event());
  assert.equal(playCount, 3);
  assert.equal(audioCreated, 1);
  doc.fire('change', { target: { id: 'ro-click-sound', checked: false } });
  doc.fire('click', event());
  assert.equal(playCount, 3);
});