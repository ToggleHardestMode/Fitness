// Native IndexedDB proof of concept. Imported only by disposable tests, never by the live app.
// A single validated snapshot and its revision commit in one transaction. Sharding/indexes
// are deliberately deferred until real size/performance tests justify them.
import {validateLedger,validateAppend,decodeLedgerBackup,encodeLedgerBackup} from './ledger-model.js';
import {validateDiary} from './food-diary-core.js';
import {decodeRecoveryBackup,encodeRecoveryBackup} from './ledger-recovery.js';
const STORE='snapshot',KEY='workout';
const prefix='fitnesspilot-preview-ledger-fixture-';
export function openLedgerPrototype(name,idb=globalThis.indexedDB){
  if(typeof name!=='string'||!name.startsWith(prefix)||!/^[-a-zA-Z0-9]+$/.test(name)||name.length>120)
    return Promise.reject(Error('A disposable fixture database name is required.'));
  if(!idb)return Promise.reject(Error('IndexedDB is unavailable.'));
  return new Promise((resolve,reject)=>{
    const request=idb.open(name,1);let blocked=false;
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onblocked=()=>{blocked=true;reject(Error('Database upgrade blocked by an open connection.'));};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      if(blocked){db.close();return;}
      db.onversionchange=()=>db.close();
      resolve(db);
    };
  });
}
function checked(value){
  if(value===undefined)return null;
  if(!Number.isSafeInteger(value.revision)||value.revision<1)throw Error('Invalid stored revision.');
  return {revision:value.revision,document:validateLedger(value.document),
    ...(Object.hasOwn(value,'food')?{food:validateDiary(value.food)}:{})};
}
function transact(db,mode,action){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
    let result,failure;
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(failure||tx.error||Error('Transaction aborted; no commit.'));
    const get=store.get(KEY);
    get.onsuccess=()=>{
      try{result=action(checked(get.result),store,tx);}
      catch(error){failure=error;tx.abort();}
    };
  });
}
export function readLedgerPrototype(db){return transact(db,'readonly',current=>current);}
export function commitLedgerPrototype(db,document,expectedRevision,{abortAfterPut=false}={}){
  // Revision 0 means empty target. Never replace an existing database on restore.
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)
    return Promise.reject(Error('An expected revision is required.'));
  const candidate=validateLedger(document);
  return transact(db,'readwrite',(current,store,tx)=>{
    if((current?.revision||0)!==expectedRevision)throw Error('Revision conflict; reload and review.');
    const next={revision:expectedRevision+1,document:current?validateAppend(current.document,candidate):candidate,
      ...(current&&Object.hasOwn(current,'food')?{food:current.food}:{})};
    const put=store.put(next,KEY);
    // Fault injection only for this fixture-scoped prototype: abort after the put succeeds.
    if(abortAfterPut)put.onsuccess=()=>tx.abort();
    return next;
  });
}
export async function exportLedgerPrototype(db){
  const snapshot=await readLedgerPrototype(db);
  if(!snapshot)throw Error('No committed ledger to export.');
  return encodeLedgerBackup(snapshot.document);
}
export function restoreLedgerPrototype(db,raw,options){
  return commitLedgerPrototype(db,decodeLedgerBackup(raw),0,options);
}

/** Combined recovery is staged entirely inside a disposable database, never split across live stores. */
export async function restoreCombinedPrototype(db,raw,secret,{abortAfterPut=false}={}){
  const data=await decodeRecoveryBackup(raw,secret);
  return transact(db,'readwrite',(current,store,tx)=>{
    if(current)throw Error('Combined recovery requires an empty fixture database.');
    const next={revision:1,document:data.document,food:data.food};
    const put=store.put(next,KEY);
    if(abortAfterPut)put.onsuccess=()=>tx.abort();
    return next;
  });
}
export async function exportCombinedPrototype(db,secret){
  const snapshot=await readLedgerPrototype(db);
  if(!snapshot||!Object.hasOwn(snapshot,'food'))throw Error('No complete combined recovery snapshot.');
  return encodeRecoveryBackup(snapshot,secret);
}
