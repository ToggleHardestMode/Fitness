import assert from 'node:assert/strict';
import test from 'node:test';

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
const oscillators = [];
const gains = [];
win.localStorage = {
  getItem(key) { return preferences.get(key) ?? null; },
  setItem(key, value) { preferences.set(key, value); },
};
function parameter() {
  const changes = [];
  return {
    changes,
    setValueAtTime(value, when) { changes.push({ op: 'set', value, when }); },
    exponentialRampToValueAtTime(value, when) { changes.push({ op: 'ramp', value, when }); },
  };
}
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  createOscillator() {
    const osc = { type: '', frequency: parameter(), connect() {}, start(at) { this.started = at; }, stop(at) { this.stopped = at; } };
    oscillators.push(osc);
    return osc;
  }
  createGain() {
    const gain = { gain: parameter(), connect() {} };
    gains.push(gain);
    return gain;
  }
}
win.AudioContext = FakeAudioContext;
globalThis.document = doc;
globalThis.window = win;
const { initRoFeedback, isRoSoundEnabled } = await import('../ro-feedback.js');
initRoFeedback();
const original = doc.listeners.get('click').length;
initRoFeedback();
const classes = new Set();
const button = { disabled: false, classList: { add: v => classes.add(v), remove: v => classes.delete(v) } };
const event = (props = {}) => ({ target: { closest: () => button }, isTrusted: true, button: 0, ...props });

test('initialization is idempotent and sound starts off', () => {
  assert.equal(doc.listeners.get('click').length, original);
  assert.equal(isRoSoundEnabled(), false);
});
test('pointer press appears, then disappears on release or cancel', () => {
  doc.fire('pointerdown', event());
  assert.equal(classes.has('ro-pressed'), true);
  doc.fire('pointerup', event());
  assert.equal(classes.has('ro-pressed'), false);
  doc.fire('pointerdown', event());
  doc.fire('pointercancel', event());
  assert.equal(classes.has('ro-pressed'), false);
});
test('disabled and secondary mouse buttons do not press', () => {
  button.disabled = true;
  doc.fire('pointerdown', event());
  assert.equal(classes.size, 0);
  button.disabled = false;
  doc.fire('pointerdown', event({ button: 2 }));
  assert.equal(classes.size, 0);
});
test('keyboard press state clears on keyup', () => {
  doc.fire('keydown', event({ key: 'Enter' }));
  assert.equal(classes.has('ro-pressed'), true);
  doc.fire('keyup', event({ key: 'Enter' }));
  assert.equal(classes.has('ro-pressed'), false);
});
test('slime feedback is opt-in and ignores synthetic clicks', () => {
  doc.fire('click', event());
  assert.equal(oscillators.length, 0);
  doc.fire('change', { target: { id: 'ro-click-sound', checked: true } });
  assert.equal(isRoSoundEnabled(), true);
  assert.equal(preferences.get('fitnesspilot.ui.click-sound.v1'), 'on');
  doc.fire('click', event({ isTrusted: false }));
  assert.equal(oscillators.length, 0);
  doc.fire('click', event());
  assert.equal(oscillators.length, 2);
  doc.fire('change', { target: { id: 'ro-click-sound', checked: false } });
  doc.fire('click', event());
  assert.equal(oscillators.length, 2);
});
test('sound glides, rebounds and ends quietly within 250 ms', () => {
  assert.equal(oscillators[0].type, 'sine');
  assert.equal(oscillators[1].type, 'triangle');
  assert.equal(oscillators[0].frequency.changes.length, 4);
  const notes = oscillators[0].frequency.changes.map(x => x.value);
  assert.deepEqual(notes, [590, 185, 235, 125]);
  assert.equal(oscillators[0].stopped, 0.25);
  assert.equal(oscillators[1].stopped, 0.225);
  assert.ok(gains.every(x => x.gain.changes.at(-1).value <= 0.0001));
  assert.ok(gains.every(x => Math.max(...x.gain.changes.map(y => y.value)) <= 0.03));
});