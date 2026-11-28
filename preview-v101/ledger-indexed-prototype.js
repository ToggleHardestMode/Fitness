// Disposable comparison only. Same canonical document and encrypted recovery codec;
// no live imports, no new live keys, no editing or automatic identity matching.
import {validateLedger} from './ledger-model.js';
import {validateDiary} from './food-diary-core.js';
import {decodeRecoveryBackup,encodeRecoveryBackup,assertRecoveryCapacity} from './ledger-recovery.js';
import {previewLedgerImport} from './ledger-import.js';

const stores=['metadata','sessions','identities'];
const fixtureHandles=new WeakSet();
export function openIndexedLedgerFixture(name,idb=globalThis.indexedDB){
  if(typeof name!=='string'||!/^fitnesspilot-preview-ledger-indexed-fixture-[a-zA-Z0-9-]{1,60}$/.test(name))
    return Promise.reject(Error('Disposable indexed fixture name required.'));
  if(!idb)return Promise.reject(Error('IndexedDB unavailable.'));
  return new Promise((resolve,reject)=>{
    const request=idb.open(name,1);let blocked=false;
    request.onupgradeneeded=()=>{for(const store of stores)request.result.createObjectStore(store);};
    request.onblocked=()=>{blocked=true;reject(Error('Database upgrade blocked.'));};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}
      db.onversionchange=()=>{fixtureHandles.delete(db);db.close();};fixtureHandles.add(db);resolve(db);};
  });
}
function transaction(db,mode,work){
  if(!fixtureHandles.has(db))return Promise.reject(Error('Open a disposable indexed fixture first.'));
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,mode);let result,failure;
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(failure||(tx.error?.name==='ConstraintError'?Error('Duplicate identity key; no commit.'):tx.error)||Error('Transaction aborted; no commit.'));
    const abort=error=>{failure=error;tx.abort();};
    const get=tx.objectStore('metadata').get('ledger');
    get.onsuccess=()=>{try{work(tx,get.result,value=>{result=value;},abort);}catch(e){abort(e);}};
  });
}
function addSession(tx,session,order){
  const ids=tx.objectStore('identities');
  // add, never put: duplicate identity fails the entire transaction.
  ids.add(true,['session',session.id]);
  let count=0;
  for(const e of session.exercises){
    ids.add(true,['occurrence',e.id]);
    for(const set of e.sets){ids.add(true,['set',set.id]);count++;}
  }
  tx.objectStore('sessions').add(session,order);
  return count;
}
function persistMeta(tx,meta,done,abortAfterPut){
  const put=tx.objectStore('metadata').put(meta,'ledger');
  if(abortAfterPut)put.onsuccess=()=>tx.abort();
  done(meta.revision);
}
export function initializeIndexedFixture(db,input,{abortAfterPut=false}={}){
  const doc=validateLedger(input.document),food=validateDiary(input.food);
  assertRecoveryCapacity({document:doc,food});
  return transaction(db,'readwrite',(tx,current,done,abort)=>{
    if(current!==undefined)throw Error('Initialization requires an empty fixture.');
    // A missing metadata row alone does not prove that a target is empty.
    const sessions=tx.objectStore('sessions').count(),ids=tx.objectStore('identities').count();
    let remaining=2;
    function finish(){
      if(--remaining)return;
      try{
        if(sessions.result||ids.result)throw Error('Initialization requires an empty fixture.');
        let sets=0;
        doc.sessions.forEach((session,i)=>{sets+=addSession(tx,session,i);});
        persistMeta(tx,{revision:1,configuration:doc.configuration,catalog:doc.catalog,
          food,sessions:doc.sessions.length,sets,...(doc.imports?{imports:doc.imports}:{})},done,abortAfterPut);
      }catch(e){abort(e);}
    }
    sessions.onsuccess=finish;ids.onsuccess=finish;
  });
}
export function appendIndexedFixture(db,session,expectedRevision,{abortAfterPut=false}={}){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER)
    return Promise.reject(Error('Expected revision required.'));
  // Clone before asynchronous work so the caller cannot change the candidate while queued.
  const candidate=structuredClone(session);
  return transaction(db,'readwrite',(tx,current,done)=>{
    if(!current||current.revision!==expectedRevision)throw Error('Revision conflict; reload and review.');
    if(candidate?.origin!=='actual')throw Error('Only independent actual sessions may be appended.');
    const validated=validateLedger({version:2,configuration:current.configuration,catalog:current.catalog,
      sessions:[candidate]}).sessions[0];
    const added=validated.exercises.reduce((n,e)=>n+e.sets.length,0);
    if(current.sessions>=50000||current.sets+added>100000)throw Error('Ledger capacity exceeded.');
    addSession(tx,validated,current.sessions);
    persistMeta(tx,{...current,revision:current.revision+1,sessions:current.sessions+1,
      sets:current.sets+added},done,abortAfterPut);
  });
}
export function readIndexedFixture(db){
  return transaction(db,'readonly',(tx,meta,done,abort)=>{
    const req=tx.objectStore('sessions').getAll();
    const ids=tx.objectStore('identities').getAllKeys();
    let sessions,identityKeys,remaining=2;
    function finish(){
      if(--remaining)return;
      try{
        if(meta===undefined){
          if(sessions.length||identityKeys.length)throw Error('Incomplete fixture database.');
          done(null);return;
        }
        if(!Number.isSafeInteger(meta.revision)||meta.revision<1)throw Error('Invalid revision.');
        const document=validateLedger({version:2,configuration:meta.configuration,catalog:meta.catalog,sessions,
          ...(meta.imports?{imports:meta.imports}:{})});
        const sets=sessions.reduce((n,s)=>n+s.exercises.reduce((v,e)=>v+e.sets.length,0),0);
        const occurrences=sessions.reduce((n,s)=>n+s.exercises.length,0);
        if(meta.sessions!==sessions.length||meta.sets!==sets||identityKeys.length!==sessions.length+occurrences+sets)
          throw Error('Fixture counts disagree.');
        const keys=new Set(identityKeys.map(k=>JSON.stringify(k)));
        for(const s of sessions){
          if(!keys.delete(JSON.stringify(['session',s.id])))throw Error('Fixture identity keys disagree.');
          for(const e of s.exercises){
            if(!keys.delete(JSON.stringify(['occurrence',e.id])))throw Error('Fixture identity keys disagree.');
            for(const set of e.sets)
              if(!keys.delete(JSON.stringify(['set',set.id])))throw Error('Fixture identity keys disagree.');
          }
        }
        if(keys.size)throw Error('Fixture identity keys disagree.');
        done({revision:meta.revision,document,food:validateDiary(meta.food)});
      }catch(e){abort(e);}
    }
    req.onsuccess=()=>{sessions=req.result;finish();};
    ids.onsuccess=()=>{identityKeys=ids.result;finish();};
  });
}
export async function exportIndexedFixture(db,secret){
  const snapshot=await readIndexedFixture(db);
  if(!snapshot)throw Error('No combined recovery snapshot.');
  return encodeRecoveryBackup(snapshot,secret);
}
export async function restoreIndexedFixture(db,raw,secret,options){
  return initializeIndexedFixture(db,await decodeRecoveryBackup(raw,secret),options);
}

/** Recompute a reviewed batch from the verified snapshot; revision is checked again inside the write transaction. */
export async function applyLedgerImportFixture(db,files,decisions,expectedRevision,{confirmed=false,abortAfterPut=false}={}){
  if(confirmed!==true)throw Error('Explicit import confirmation required.');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision>=Number.MAX_SAFE_INTEGER)
    throw Error('Expected revision required.');
  const inputs=structuredClone({files,decisions});
  const current=await readIndexedFixture(db);
  if(!current||current.revision!==expectedRevision)throw Error('Revision conflict; review again.');
  const result=await previewLedgerImport(current.document,inputs.files,inputs.decisions);
  if(result.unresolved.length)throw Error('Resolve all import rows before applying.');
  // The editor shares this path. A candidate that cannot be exported must not be committed.
  // Revision is checked again below, so a concurrent writer cannot invalidate this preflight.
  if(result.changed)assertRecoveryCapacity({document:result.document,food:current.food});
  return transaction(db,'readwrite',(tx,meta,done)=>{
    if(!meta||meta.revision!==expectedRevision)throw Error('Revision conflict; review again.');
    if(!result.changed){done({revision:expectedRevision,counts:result.counts});return;}
    const before=new Map(current.document.sessions.map((s,i)=>[s.id,{session:s,index:i}]));
    const ids=tx.objectStore('identities'),sessions=tx.objectStore('sessions');
    let total=meta.sets;
    for(const [i,session] of result.document.sessions.entries()){
      const old=before.get(session.id);
      if(!old){total+=addSession(tx,session,i);continue;}
      if(JSON.stringify(old.session)===JSON.stringify(session))continue;
      const prior=new Map(old.session.exercises.map(e=>[e.id,new Set(e.sets.map(s=>s.id))]));
      for(const e of session.exercises){
        if(!prior.has(e.id))ids.add(true,['occurrence',e.id]);
        for(const set of e.sets)if(!prior.get(e.id)?.has(set.id)){ids.add(true,['set',set.id]);total++;}
      }
      sessions.put(session,old.index);
    }
    const revision=expectedRevision+1;
    persistMeta(tx,{...meta,revision,catalog:result.document.catalog,imports:result.document.imports,
      sessions:result.document.sessions.length,sets:total},()=>done({revision,counts:result.counts}),abortAfterPut);
  });
}
