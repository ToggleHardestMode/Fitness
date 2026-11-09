// Encrypted both-store backup. All cryptography is local; writes require explicit restore.
import {STORAGE_KEY,emptyState,validateBackup} from './core.js';
import {FOOD_KEY,EMPTY_DIARY,validateDiary} from './food-diary-core.js';
export const FILE_FORMAT='fitnesspilot-encrypted-both-v1';
const ITERATIONS=310000,MAX_FILE=16_000_000;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
function checkPass(secret){
 if(typeof secret!=='string'||secret.length<12||secret.length>256)throw Error('Passphrase must be 12–256 characters.');
 return secret;
}
function engine(c){if(!c?.subtle||typeof c.getRandomValues!=='function')throw Error('Secure Web Crypto is unavailable.');return c;}
function toBase64(bytes){
 bytes=new Uint8Array(bytes);const chunks=[];
 for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
 return btoa(chunks.join(''));
}
function fromBase64(text,size){
 if(typeof text!=='string'||text.length>MAX_FILE||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))
   throw Error('Invalid encrypted backup encoding.');
 const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 if(size && bytes.length!==size)throw Error('Invalid encrypted backup parameters.');
 return bytes;
}
async function derivedKey(secret,salt,c){
 const raw=await c.subtle.importKey('raw',encoder.encode(checkPass(secret)),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},raw,
   {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function validateBoth(doc){
 if(!doc||doc.format!=='fitnesspilot-both-v1')throw Error('Invalid combined backup format.');
 return {workout:validateBackup(doc.workout),food:validateDiary(doc.food)};
}
export function readBothStores(storage){
 let w,f;
 try{w=storage.getItem(STORAGE_KEY);f=storage.getItem(FOOD_KEY);}
 catch{throw Error('Cannot read local records; nothing changed.');}
 try{return{workout:w===null?emptyState():validateBackup(JSON.parse(w)),
             food:f===null?EMPTY_DIARY():validateDiary(JSON.parse(f))};}
 catch{throw Error('Existing workout or Food Diary records are invalid; export stopped.');}
}
export async function encryptBoth(input,secret,cryptoImpl=globalThis.crypto){
 const data=validateBoth({format:'fitnesspilot-both-v1',...input});
 const c=engine(cryptoImpl),salt=c.getRandomValues(new Uint8Array(16)),
   iv=c.getRandomValues(new Uint8Array(12)),key=await derivedKey(secret,salt,c);
 const plain=encoder.encode(JSON.stringify({format:'fitnesspilot-both-v1',...data}));
 if(plain.byteLength>10_000_000)throw Error('Combined records exceed the 10 MB encryption limit.');
 const ciphertext=await c.subtle.encrypt({name:'AES-GCM',iv},key,plain);
 return JSON.stringify({format:FILE_FORMAT,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,
   cipher:'AES-256-GCM',salt:toBase64(salt),iv:toBase64(iv),data:toBase64(ciphertext)})+'\n';
}
export async function decryptBoth(text,secret,cryptoImpl=globalThis.crypto){
 checkPass(secret);
 if(typeof text!=='string'||text.length>MAX_FILE)throw Error('Encrypted backup exceeds the 16 MB limit.');
 let doc;try{doc=JSON.parse(text);}catch{throw Error('Encrypted backup is not valid JSON.');}
 if(!doc||doc.format!==FILE_FORMAT||doc.kdf!=='PBKDF2-SHA256'||
    doc.iterations!==ITERATIONS||doc.cipher!=='AES-256-GCM')
   throw Error('Unknown encrypted backup format.');
 const c=engine(cryptoImpl),salt=fromBase64(doc.salt,16),iv=fromBase64(doc.iv,12),bytes=fromBase64(doc.data);
 if(bytes.length<17||bytes.length>11_000_000)throw Error('Encrypted backup payload size is invalid.');
 const key=await derivedKey(secret,salt,c);
 let plain;try{plain=await c.subtle.decrypt({name:'AES-GCM',iv},key,bytes);}
 catch{throw Error('Wrong passphrase or corrupted encrypted backup.');}
 let decoded;try{decoded=JSON.parse(decoder.decode(plain));}
 catch{throw Error('Decrypted backup contains invalid JSON.');}
 return validateBoth(decoded);
}
// No implicit overwrite. Browser localStorage cannot guarantee atomic two-key commits.
export function restoreBothToEmpty(storage,input,{apply=false,confirmed=false}={}){
 const data=validateBoth({format:'fitnesspilot-both-v1',...input});
 let w,f;try{w=storage.getItem(STORAGE_KEY);f=storage.getItem(FOOD_KEY);}
 catch{throw Error('Cannot inspect target storage; restore stopped.');}
 if(w!==null||f!==null)throw Error('Restore requires a clean browser profile with both stores absent.');
 const counts={templates:data.workout.templates.length,sets:data.workout.logs.length,
   checkins:data.workout.metrics.length,foods:data.food.entries.length};
 if(!apply)return{counts,applied:false};
 if(!confirmed)throw Error('Explicit RESTORE BOTH confirmation is required.');
 try{
   storage.setItem(STORAGE_KEY,JSON.stringify(data.workout));
   storage.setItem(FOOD_KEY,JSON.stringify(data.food));
 }catch{
   try{storage.removeItem(STORAGE_KEY);storage.removeItem(FOOD_KEY);}
   catch{throw Error('Restore interrupted and rollback failed; inspect storage before retrying.');}
   throw Error('Browser rejected the restore; partial writes were rolled back.');
 }
 return{counts,applied:true};
}
