import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalkerStill } from '../preview-v101/walker-still.js';

const webp='data:image/webp;base64,UklGRgAA';
const png='data:image/png;base64,AAAA';
function imageFactory(fail=false) {
  return () => ({
    naturalWidth:144,naturalHeight:320,
    set src(value) {queueMicrotask(()=>fail?this.onerror():this.onload());}
  });
}
test('Reduce Motion can render private WebP as a single PNG frame',async()=>{
  let drawn=0,canvas;
  const factory=()=>canvas={
    getContext:()=>({drawImage:()=>{drawn++}}),
    toDataURL:()=>png
  };
  assert.equal(await createWalkerStill(webp,imageFactory(),factory),png);
  assert.equal(drawn,1);
  assert.equal(canvas.width,144);
  assert.equal(canvas.height,320);
});
test('invalid local input cannot be used as an image URL',()=>{
  assert.throws(()=>createWalkerStill('javascript:alert(1)'),/Invalid local/);
});
test('decode failure rejects rather than showing an incorrect still',async()=>{
  await assert.rejects(createWalkerStill(webp,imageFactory(true),()=>({})),/cannot be displayed/);
});
test('failed canvas conversion rejects and leaves generic fallback available',async()=>{
  await assert.rejects(createWalkerStill(webp,imageFactory(),()=>({
    getContext:()=>null
  })),/Static preview/);
});
