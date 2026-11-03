import test from 'node:test';
import assert from 'node:assert/strict';

class Events {
  listeners=new Map();
  addEventListener(name, fn) {
    if(!this.listeners.has(name))this.listeners.set(name,[]);
    this.listeners.get(name).push(fn);
  }
  fire(name,event) { for(const fn of this.listeners.get(name)||[])fn(event); }
}
const doc=new Events(), win=new Events(), settings=new Map();
win.localStorage={getItem:k=>settings.get(k)??null,setItem:(k,v)=>settings.set(k,v)};
let soundPlays=0;
class FakeAudio {
  constructor(){this.currentTime=0;this.volume=1;}
  pause(){}
  play(){soundPlays++;return Promise.resolve();}
}
globalThis.document=doc;
globalThis.window=win;
globalThis.Audio=FakeAudio;
const {initRoFeedback}=await import('../preview-v101/ro-feedback.js');
initRoFeedback();

function control(inTimer) {
  return {disabled:false,classList:{add(){},remove(){}},
    closest:selector=>selector==='#fp-floating-rest' && inTimer?{}:null};
}
function click(button) {
  doc.fire('click',{target:{closest:()=>button},isTrusted:true});
}

test('optional button audio stays silent for floating rest timer controls',()=>{
  doc.fire('change',{target:{id:'ro-click-sound',checked:true}});
  const before=soundPlays;
  click(control(true));
  assert.equal(soundPlays,before);
  click(control(false));
  assert.equal(soundPlays,before+1);
});
