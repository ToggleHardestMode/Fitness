// Single source for the current preview version: the index.html banner.
// Tests derive every other expected version string (manifest, cache name) from it.
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../preview-v101/',import.meta.url);
export const read=filename=>readFileSync(new URL(filename,root),'utf8');
export function previewVersion(){
  const m=read('index.html').match(/FITNESSPILOT (V\d+\.\d+\.\d+) PREVIEW/);
  if(!m)throw new Error('index.html banner lacks a version');
  return m[1];
}
export const cacheVersionToken=version=>'v'+version.slice(1).replaceAll('.','');
export const cacheName=()=>read('sw.js').match(/const CACHE = '(fitnesspilot-preview-[^']+)';/)?.[1];
// Every asset index.html references plus every relative module reachable from its scripts.
export function loadedAssets(){
  const found=new Set(),queue=[];
  const add=file=>{if(!found.has(file)){found.add(file);if(file.endsWith('.js'))queue.push(file);}};
  for(const m of read('index.html').matchAll(/(?:href|src)="\.\/([^"?#]+\.(?:css|js|svg))"/g))add(m[1]);
  while(queue.length){
    const file=queue.shift();
    if(!existsSync(new URL(file,root)))continue;
    for(const m of read(file).matchAll(/(?:from\s+|import\s*\(?\s*)['"]\.\/([^'"]+\.js)['"]/g))add(m[1]);
  }
  return [...found];
}
