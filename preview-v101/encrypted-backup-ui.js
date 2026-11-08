import {readBothStores,encryptBoth,decryptBoth,restoreBothToEmpty} from './encrypted-backup-core.js';
const $=id=>document.getElementById(id);
const inform=(message,error=false)=>{const el=$('vault-status');el.textContent=message;el.style.borderColor=error?'#ef9b8d':'#75623f';};
async function busy(button,fn){
 button.disabled=true;
 try{await fn();}catch(error){inform(error?.message||'Backup operation failed.',true);}
 finally{button.disabled=false;}
}
function saveFile(text){
 const blob=new Blob([text],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='FitnessPilot-both-stores-encrypted-v1.json';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('export-button').addEventListener('click',()=>busy($('export-button'),async()=>{
 const secret=$('export-pass').value,repeat=$('export-confirm').value;
 $('export-pass').value='';$('export-confirm').value='';
 if(secret!==repeat)throw Error('Passphrases do not match. Nothing exported.');
 const stores=readBothStores(localStorage);
 const backup=await encryptBoth(stores,secret);
 saveFile(backup);
 inform('Encrypted file prepared. Confirm it was saved to Files. Keep a recovery copy of the passphrase off your phone. No records were changed.');
}));
$('restore-button').addEventListener('click',()=>busy($('restore-button'),async()=>{
 const file=$('restore-file').files?.[0],secret=$('restore-pass').value,word=$('restore-word').value;
 $('restore-pass').value='';$('restore-word').value='';
 if(!file||file.size>16_000_000||file.size<40)throw Error('Choose a valid encrypted JSON file under 16 MB.');
 if(word!=='RESTORE BOTH')throw Error('Type RESTORE BOTH exactly. No records changed.');
 const stores=await decryptBoth(await file.text(),secret);
 const preview=restoreBothToEmpty(localStorage,stores).counts;
 if(!confirm('Restore '+preview.templates+' templates, '+preview.sets+' sets, '+
    preview.checkins+' check-ins and '+preview.foods+
    ' Food Diary entries into this EMPTY browser profile?'))return;
 restoreBothToEmpty(localStorage,stores,{apply:true,confirmed:true});
 $('restore-file').value='';
 inform('Both stores restored. Reopen FitnessPilot and Food Diary and compare saved records with the original device.');
}));
