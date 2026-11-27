// Fixture-only combined backup codec. Existing live encryption and restore paths remain unchanged.
import {decryptBoth,FILE_FORMAT} from './encrypted-backup-core.js';
import {migrateLegacyWorkout,validateLedger} from './ledger-model.js';
import {validateDiary} from './food-diary-core.js';
import {verifyImportFingerprints} from './ledger-import-evidence.js';

export const RECOVERY_FORMAT='fitnesspilot-encrypted-ledger-fixture-v1';
const ITERATIONS=310000,MAX_PLAIN=10_000_000,MAX_FILE=16_000_000;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const aad=encoder.encode(RECOVERY_FORMAT);
function passphrase(secret){
  if(typeof secret!=='string'||secret.length<12||secret.length>256)throw Error('Passphrase must be 12–256 characters.');
}
function engine(c){
  if(!c?.subtle||typeof c.getRandomValues!=='function')throw Error('Secure Web Crypto is unavailable.');
  return c;
}
function b64(bytes){
  const parts=[];
  for(let i=0;i<bytes.length;i+=16384)parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
  return btoa(parts.join(''));
}
function unb64(s,min,max){
  if(typeof s!=='string'||s.length>MAX_FILE||s.length%4||
    /[^A-Za-z0-9+/=]/.test(s)||/=/.test(s.slice(0,-2)))throw Error('Invalid backup encoding.');
  let v;
  try{v=Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));}
  catch{throw Error('Invalid backup encoding.');}
  if(v.length<min||v.length>max||b64(v)!==s)throw Error('Invalid backup payload size or encoding.');
  return v;
}
async function derive(secret,salt,c){
  const base=await c.subtle.importKey('raw',encoder.encode(secret),'PBKDF2',false,['deriveKey']);
  return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},base,
    {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function checked(input){
  return {document:validateLedger(input?.document),food:validateDiary(input?.food)};
}
export async function encodeRecoveryBackup(input,secret,cryptoImpl=globalThis.crypto){
  passphrase(secret);
  const data=checked(input),c=engine(cryptoImpl);
  await verifyImportFingerprints(data.document,c);
  const plain=encoder.encode(JSON.stringify(data));
  if(plain.byteLength>MAX_PLAIN)throw Error('Combined records exceed the 10 MB prototype encryption limit.');
  const salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
  const key=await derive(secret,salt,c);
  const encrypted=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,plain);
  return JSON.stringify({format:RECOVERY_FORMAT,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',
    salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(encrypted))})+'\n';
}
export async function decodeRecoveryBackup(raw,secret,cryptoImpl=globalThis.crypto){
  passphrase(secret);
  if(typeof raw!=='string'||raw.length>MAX_FILE)throw Error('Encrypted backup exceeds the 16 MB limit.');
  let outer;
  try{outer=JSON.parse(raw);}catch{throw Error('Encrypted backup is not valid JSON.');}
  if(outer?.format===FILE_FORMAT){
    const old=await decryptBoth(raw,secret,cryptoImpl);
    return {document:migrateLegacyWorkout(old.workout),food:old.food};
  }
  if(outer?.format!==RECOVERY_FORMAT||outer.kdf!=='PBKDF2-SHA256'||
    outer.iterations!==ITERATIONS||outer.cipher!=='AES-256-GCM')throw Error('Unknown encrypted recovery format.');
  const salt=unb64(outer.salt,16,16),iv=unb64(outer.iv,12,12),bytes=unb64(outer.data,17,MAX_PLAIN+16);
  const c=engine(cryptoImpl),key=await derive(secret,salt,c);
  let decrypted;
  try{decrypted=await c.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,bytes);}
  catch{throw Error('Wrong passphrase or corrupted encrypted backup.');}
  let data;
  try{data=JSON.parse(decoder.decode(decrypted));}
  catch{throw Error('Decrypted backup contains invalid JSON.');}
  const result=checked(data);
  await verifyImportFingerprints(result.document,c);
  return result;
}
