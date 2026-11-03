import test from 'node:test';
import assert from 'node:assert/strict';
import {timeLeftSeconds, restClock, effortHint, effortQuickLabel,
  createFloatingRestTimer} from '../preview-v101/floating-rest.js';

function makeHarness({sound=true}={}) {
  let now=100_000, nextTimer=1, sounds=0, vibrates=0, intervalClears=0;
  const intervals=new Map(), storage=new Map(sound?[]:[['fitnesspilot.preview.v101.ui.rest-sound.v1','off']]);
  class Element {
    listeners=new Map(); hidden=false; textContent=''; innerHTML=''; classSet=new Set();
    classList={toggle:(name,on)=>{if(on)this.classSet.add(name);else this.classSet.delete(name);}};
    attrs=new Map(); dataset={};
    addEventListener(type,listener){this.listeners.set(type,listener);}
    setAttribute(name,value){this.attrs.set(name,value);}
    focus(){this.focused=true;}
    click(event={}){this.listeners.get('click')?.({target:this,...event});}
    change(event={}){this.listeners.get('change')?.({target:this,...event});}
  }
  const controls=new Map();
  const root=new Element();
  root.querySelector=selector=>{
    if(!controls.has(selector))controls.set(selector,new Element());
    return controls.get(selector);
  };
  const doc={hidden:false,body:{appendChild(element){assert.equal(element,root);}},
    createElement:tag=>{assert.equal(tag,'div');return root;},
    listeners:new Map(),addEventListener(type,listener){this.listeners.set(type,listener);}};
  const win={
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    setInterval:callback=>{const id=nextTimer++;intervals.set(id,callback);return id;},
    clearInterval:id=>{intervalClears++;intervals.delete(id);},
    navigator:{vibrate:()=>{vibrates++;}},
    AudioContext:class {
      state='running';currentTime=0;destination={};
      createOscillator(){return {type:'sine',frequency:{value:0},connect(){},
        start(){sounds++;},stop(){}};}
      createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
    }
  };
  const timer=createFloatingRestTimer({doc,win,now:()=>now});
  return {timer,doc,root,byId:id=>root.querySelector('#'+id),
    advance:ms=>{now+=ms;for(const fn of [...intervals.values()])fn();},
    get:()=>({sounds,vibrates,intervalCount:intervals.size,intervalClears,storage})};
}

test('rest clock accepts true elapsed seconds and rounds countdown upward',()=>{
  assert.equal(timeLeftSeconds(100_001,100_000),1);
  assert.equal(timeLeftSeconds(100_001,100_000.5),1);
  assert.equal(timeLeftSeconds(100_000,100_001),0);
  assert.equal(timeLeftSeconds(null,100_000),0);
  assert.equal(restClock(90),'01:30');
  assert.equal(restClock(0),'00:00');
  assert.equal(restClock(600),'10:00');
});
test('timer is accessible on Train and remains visible while navigating',()=>{
  const h=makeHarness();
  assert.equal(h.root.hidden,true);
  h.timer.updatePage('train');
  assert.equal(h.root.hidden,false);
  h.timer.start(90);
  assert.equal(h.byId('fp-rest-fab-clock').textContent,'01:30');
  assert.equal(h.get().intervalCount,1);
  h.timer.updatePage('dashboard');
  assert.equal(h.root.hidden,false);
  h.advance(20_010);
  assert.equal(h.byId('fp-rest-fab-clock').textContent,'01:10');
  assert.equal(h.timer.getRemaining(),70);
  assert.equal(h.get().sounds,0);
});
test('foreground completion sounds three notes once and shows prominent overlay',()=>{
  const h=makeHarness();
  h.timer.updatePage('train');h.timer.start(90);
  h.advance(90_001);
  assert.equal(h.byId('fp-rest-done').hidden,false);
  assert.equal(h.get().intervalCount,0);
  assert.equal(h.get().sounds,3);
  assert.equal(h.get().vibrates,1);
  h.timer.tick();
  assert.equal(h.get().sounds,3);
  h.byId('fp-rest-dismiss').click();
  assert.equal(h.byId('fp-rest-done').hidden,true);
  assert.equal(h.byId('fp-rest-toggle').focused,true);
});
test('background time is measured from wall clock and checked on returning',()=>{
  const h=makeHarness();
  h.timer.start(60);h.doc.hidden=true;
  h.advance(75_000);
  h.doc.hidden=false;h.doc.listeners.get('visibilitychange')();
  assert.equal(h.get().intervalCount,0);
  assert.equal(h.byId('fp-rest-done').hidden,false);
  assert.equal(h.timer.getRemaining(),0);
});
test('timer can restart and stop without duplicate timers or phantom alerts',()=>{
  const h=makeHarness();
  h.timer.start(90);h.advance(2_000);h.timer.start(120);
  assert.equal(h.get().intervalCount,1);
  assert.equal(h.timer.getRemaining(),120);
  h.timer.stop();h.advance(150_000);
  assert.equal(h.get().intervalCount,0);
  assert.equal(h.byId('fp-rest-done').hidden,true);
  assert.equal(h.get().sounds,0);
  for(const value of [0,-1,601,90.5,NaN])assert.throws(()=>h.timer.start(value),/1 and 600/);
});
test('sound option and user-triggered sound test have explicit controls',()=>{
  const h=makeHarness({sound:false});
  h.timer.start(1);h.advance(1_001);
  assert.equal(h.get().sounds,0);
  h.byId('fp-rest-sound').change({target:{checked:true}});
  assert.equal(h.get().storage.get('fitnesspilot.preview.v101.ui.rest-sound.v1'),'on');
  h.byId('fp-rest-test').click();
  assert.equal(h.get().sounds,3);
  assert.match(h.root.innerHTML,/Keep FitnessPilot open/);
});
test('floating panel is controlled by one accessible toggle',()=>{
  const h=makeHarness();h.timer.updatePage('tools');
  h.byId('fp-rest-toggle').click();
  assert.equal(h.byId('fp-rest-panel').hidden,false);
  assert.equal(h.byId('fp-rest-toggle').attrs.get('aria-expanded'),'true');
  h.byId('fp-rest-hide').click();
  assert.equal(h.byId('fp-rest-panel').hidden,true);
});
test('effort shortcuts explain RPE and RIR without changing numeric meaning',()=>{
  assert.equal(effortQuickLabel(6),'Easy (6)');
  assert.equal(effortQuickLabel(7),'Moderate (7)');
  assert.equal(effortQuickLabel(8),'Hard (8)');
  assert.equal(effortQuickLabel(9),'Very hard (9)');
  assert.match(effortHint,/RIR means reps left/);
  assert.match(effortHint,/Leave blank if unsure/);
});
