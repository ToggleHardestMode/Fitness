import {STORAGE_KEY,validateBackup,emptyState} from './core.js';
import {previewDeviceMerge} from './device-merge.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snapshot=()=>{const raw=localStorage.getItem(STORAGE_KEY);return validateBackup(raw?JSON.parse(raw):emptyState())};
const save=(name,obj)=>{const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000)};
let result=null,localJSON=null;
$('download-local').addEventListener('click',()=>{try{save('FitnessPilot-this-device-original-backup.json',snapshot());$('transfer-status').textContent='This-device backup prepared.';}catch(e){$('transfer-status').textContent=e.message;}});
$('other-backup').addEventListener('change',async e=>{
 result=null;localJSON=null;$('download-merge').disabled=true;$('ack').checked=false;
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 try{
  if(file.size>8_000_000 || !/\.json$/i.test(file.name))throw Error('Choose a FitnessPilot JSON backup smaller than 8 MB.');
  localJSON=JSON.stringify(snapshot());
  const remote=validateBackup(JSON.parse(await file.text()));
  result=previewDeviceMerge(JSON.parse(localJSON),remote);
  const list=Object.entries(result.summary).map(([k,v])=>'<li>'+esc(k)+': this device '+v.onThisDevice+', imported '+v.onImport+', '+v.added+' non-conflicting new records</li>').join('');
  $('preview').innerHTML='<h3>'+ (result.safe?'No conflicts found':'Merge blocked: '+result.conflicts.length+' conflicts')+'</h3><ul>'+list+'</ul>'+
   (result.conflicts.length?'<h3>Review conflicts before proceeding</h3><ul>'+
     result.conflicts.slice(0,50).map(c=>'<li><strong>'+esc(c.collection)+': '+esc(c.key)+'</strong> · '+esc(c.reason)+'</li>').join('')+
     '</ul><p>Keep both originals. No merged file is available until conflicts are resolved.</p>':
     '<p class="help">This is a union of records. Deletions do not propagate; old records absent from one device are retained.</p>');
  $('download-merge').disabled=!result.safe;
  $('transfer-status').textContent='Preview complete. Your current browser data was not changed.';
 }catch(error){$('preview').textContent='Unable to preview: '+error.message;$('transfer-status').textContent='No changes made.';}
});
$('download-merge').addEventListener('click',()=>{
 try{
  if(!result?.safe||!result.merged)throw Error('No safe merge result is available.');
  if(!$('ack').checked)throw Error('Preserve both original backups and check the acknowledgement.');
  if(JSON.stringify(snapshot())!==localJSON)throw Error('This device changed since the preview. Re-import and review the merge.');
  save('FitnessPilot-manually-merged-backup.json',result.merged);
  $('transfer-status').textContent='Merged backup file prepared. No restore was performed. Use Tools to inspect and restore explicitly.';
 }catch(error){$('transfer-status').textContent=error.message;}
});
