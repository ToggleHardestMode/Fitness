import assert from 'node:assert/strict';
import test from 'node:test';

class EventSink {
  listeners = new Map();
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type,list);
  }
  fire(type,event={}) {
    for(const handler of this.listeners.get(type)||[]) handler(event);
  }
}

const doc = new EventSink();
const win = new EventSink();
let countAudio = 0;
const preferences = new Map();
win.localStorage = {
  getItem(key) { return preferences.get(key) ?? null; },
  setItem(key,value) { preferences.set(key,value); },
};
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  createOscillator() {
    countAudio++;
    return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};
  }
  createGain() {return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
}
win.AudioContext=FakeAudioContext;
globalThis.document=doc;
globalThis.window=win;
const { initRoFeedback, isRoSoundEnabled } = await import('../ro-feedback.js');
initRoFeedback();
const original = doc.listeners.get('click').length;
initRoFeedback();
const classes = new Set();
const button = {disabled:false,classList:{add: v=>classes.add(v),remove: v=>classes.delete(v)}};
const event = (props={}) => ({target:{closest:()=>button},isTrusted:true,button:0,...props});

test('Initialization is idempotent and sound starts off', () => {
  assert.equal(doc.listeners.get('click').length,original);
  assert.equal(isRoSoundEnabled(),false);
});
test('Pointer down adds pressed state, release removes it', () => {
  doc.fire('pointerdown', event());
  assert.equal(classes.has('ro-pressed'),true);
  doc.fire('pointerup', event());
  assert.equal(classes.has('ro-pressed'),false);
  doc.fire('pointerdown', event());
  doc.fire('pointercancel',event());
  assert.equal(classes.has('ro-pressed'),false);
});
test('Disabled and secondary mouse buttons do not press', () => {
  button.disabled=true;
  doc.fire('pointerdown',event());
  assert.equal(classes.size,0);
  button.disabled=false;
  doc.fire('pointerdown',event({button:2}));
  assert.equal(classes.size,0);
});
test('Keyboard press state clears on keyup', () => {
  doc.fire('keydown',event({key:'Enter'}));
  assert.equal(classes.has('ro-pressed'),true);
  doc.fire('keyup',event({key:'Enter'}));
  assert.equal(classes.has('ro-pressed'),false);
});
test('Sound is optional, uses local setting, and ignores synthetic clicks', () => {
  doc.fire('click',event());
  assert.equal(countAudio,0);
  doc.fire('change',{target:{id:'ro-click-sound',checked:true}});
  assert.equal(isRoSoundEnabled(),true);
  assert.equal(preferences.get('fitnesspilot.ui.click-sound.v1'),'on');
  doc.fire('click',event({isTrusted:false}));
  assert.equal(countAudio,0);
  doc.fire('click',event());
  assert.equal(countAudio,1);
  doc.fire('change',{target:{id:'ro-click-sound',checked:false}});
  doc.fire('click',event());
  assert.equal(countAudio,1);
});