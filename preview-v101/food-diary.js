import {FOOD_KEY,EMPTY_DIARY,NUTRIENTS,validateDiary,saveEntry,deleteEntry,totalsForDate,emptyOnlyRestore,recentFoods,repeatEntryToDate} from './food-diary-core.js';
import { initSgFoodLookup } from './sg-food-lookup.js';
import { LABELLED_PROTEIN_PIECE } from './food-staples.js';
import {blankDailyFoodCsv,previewDailyFoodCsv,applyDailyFoodCsv} from './food-diary-csv.js';
const $=id=>document.getElementById(id);
const number=value=>Number(value).toLocaleString('en-SG',{maximumFractionDigits:1});
const numeric=value=>value===''?null:Number(value);
const localDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const span=(label,cls='')=>{const e=document.createElement('span');e.textContent=label;e.className=cls;return e;};
const button=(label,handler)=>{const e=document.createElement('button');e.type='button';e.className='btn secondary fd-small';e.textContent=label;e.addEventListener('click',handler);return e;};

export function initFoodDiary(storage=localStorage){
  const status=$('fd-status'),form=$('fd-form'),date=$('fd-date');
  let diary,undo=null,pendingCsv=null;
  try{const saved=storage.getItem(FOOD_KEY);diary=saved?validateDiary(JSON.parse(saved)):EMPTY_DIARY();}
  catch(error){
    status.textContent='Saved Food Diary could not be read: '+error.message+'. Nothing was overwritten. Keep website data intact.';
    for(const id of ['fd-save','fd-import','fd-date','fd-export','fd-csv-file','fd-csv-template'])$(id).disabled=true;
    return;
  }
  date.value=localDate();
  const inform=(message,error=false)=>{status.textContent=message;status.classList.toggle('fd-error',error);};
  function saveDownload(filename,contents,type){
    const blob=new Blob([contents],{type});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function exportFoodBackup(filename='fitnesspilot-food-diary-v1.json'){
    saveDownload(filename,JSON.stringify(validateDiary(diary),null,2)+'\n','application/json');
  }
  function renderCsvPreview(){
    const host=$('fd-csv-preview');host.replaceChildren();host.hidden=!pendingCsv;
    if(!pendingCsv)return;
    const {preview}=pendingCsv;
    const count=document.createElement('p');
    count.textContent='Daily CSV preview for '+preview.date+': '+preview.add.length+
      ' new food(s), '+preview.skipped.length+' already imported. No data has been saved.';
    host.append(count);
    const list=document.createElement('ul');list.className='fd-csv-preview-list';
    for(const entry of [...preview.add,...preview.skipped]){
      const li=document.createElement('li');
      li.textContent=entry.name+' · '+entry.occasion+' · '+entry.servings+' serving(s) · '+
        (entry.kcal===null?'unknown calories':number(entry.kcal*entry.servings)+' kcal')+
        (preview.skipped.includes(entry)?' (already imported)':'');
      list.append(li);
    }
    host.append(list);
    if(preview.add.length){
      const backup=button('Download pre-import Food Diary backup',()=>{
        try{
          exportFoodBackup('fitnesspilot-food-diary-before-csv-'+preview.date+'.json');
          pendingCsv.backupDownloaded=true;renderCsvPreview();
          inform('Pre-import backup prepared. Save it to Files, then check the acknowledgement.');
        }catch(error){inform(error.message,true);}
      });
      host.append(backup);
      const label=document.createElement('label');label.className='fd-csv-confirm';
      const acknowledge=document.createElement('input');acknowledge.type='checkbox';
      acknowledge.disabled=!pendingCsv.backupDownloaded;
      label.append(acknowledge,span('I saved the Food Diary JSON backup before importing.'));
      host.append(label);
      const apply=button('Import '+preview.add.length+' food(s)',()=>{
        try{
          if(!pendingCsv?.backupDownloaded||!acknowledge.checked)
            throw Error('Download and acknowledge a Food Diary JSON backup before importing.');
          if(date.value!==preview.date)throw Error('Selected day changed; preview the CSV again.');
          if(!confirm('Import '+preview.add.length+' food(s) on '+preview.date+
              '? Existing food entries and workout records will not be overwritten.'))return;
          // Recheck AFTER the modal: another tab may have changed localStorage.
          if(storage.getItem(FOOD_KEY)!==pendingCsv.snapshot){
            pendingCsv=null;renderCsvPreview();
            throw Error('Food Diary changed since CSV preview. Choose the file again; nothing imported.');
          }
          const out=applyDailyFoodCsv(diary,preview,{apply:true,confirmed:true});
          persist(out.diary);undo=null;reset();render();
          inform('Imported '+out.added+' food(s) on '+preview.date+
                 '; '+out.skipped+' already present. Original diary entries preserved.');
        }catch(error){inform(error.message,true);}
      });
      apply.className='btn';host.append(apply);
    }else{
      const p=document.createElement('p');p.className='hint';
      p.textContent='All rows already exist in the diary. Nothing to import.';
      host.append(p);
    }
    host.append(button('Cancel CSV preview',()=>{pendingCsv=null;renderCsvPreview();inform('Daily CSV import canceled. No data changed.');}));
  }

  function persist(next){
    const valid=validateDiary(next);
    try{storage.setItem(FOOD_KEY,JSON.stringify(valid));}
    catch(error){throw Error('Cannot save Food Diary ('+(error.name||'storage error')+'). Existing data was not replaced.');}
    diary=valid;pendingCsv=null;renderCsvPreview();
  }
  function reset(){
    form.reset();$('fd-id').value='';$('fd-save').textContent='Save food';
  }
  function renderRecent(){
    const host=$('fd-recent');host.replaceChildren();
    const matches=recentFoods(diary,date.value,8);
    if(!matches.length){
      const p=document.createElement('p');p.className='hint';
      p.textContent='No earlier meals available yet. Save foods normally; they will appear here on following days.';
      host.append(p);return;
    }
    for(const food of matches){
      const article=document.createElement('article');article.className='fd-recent-entry';
      const summary=document.createElement('div');summary.className='fd-recent-desc';
      const title=document.createElement('strong');title.textContent=food.name;
      const sub=span(food.date+' · '+number(food.servings)+' serving(s) · '+(food.kcal===null?'unknown calories':number(food.kcal*food.servings)+' kcal'),'fd-detail');
      summary.append(title,sub);
      article.append(summary,button('Repeat on this day',()=>{
        try{
          persist(repeatEntryToDate(diary,food.id,date.value,crypto.randomUUID()));
          undo=null;reset();render();inform('Copied the saved food and its previous portion. Edit if today’s serving differed.');
        }catch(error){inform(error.message,true);}
      }));
      host.append(article);
    }
  }
  function render(){
    renderRecent();
    const data=totalsForDate(diary,date.value);
    $('fd-count').textContent=data.count+' food/drink '+(data.count===1?'entry':'entries');
    for(const key of NUTRIENTS){
      const t=data.nutrients[key];
      $('fd-total-'+key).textContent=!data.count?'Not recorded':(t.unknown?'≥ ':'')+number(t.value)+' '+(key==='kcal'?'kcal':'g')+(t.unknown?' · '+t.unknown+' unknown':'');
    }
    const list=$('fd-list');list.replaceChildren();
    if(!data.count){const p=document.createElement('p');p.className='hint';p.textContent='No foods recorded for this day. This does not mean zero food was eaten.';list.append(p);}
    for(const entry of data.rows){
      const article=document.createElement('article');article.className='fd-entry';
      const head=document.createElement('div');head.className='fd-entry-main';
      const title=document.createElement('strong');title.textContent=entry.name;head.append(title);
      head.append(span(entry.occasion+' · '+number(entry.servings)+' serving(s)','fd-detail'));
      const values=document.createElement('div');values.className='fd-detail';
      values.textContent=NUTRIENTS.map(k=>(k==='kcal'?'Energy':k)+': '+(entry[k]===null?'unknown':number(entry[k]*entry.servings)+' '+(k==='kcal'?'kcal':'g'))).join(' · ');
      const actions=document.createElement('div');actions.className='fd-actions';
      actions.append(button('Edit',()=>{
        $('fd-id').value=entry.id;date.value=entry.date;$('fd-name').value=entry.name;
        $('fd-occasion').value=entry.occasion;$('fd-servings').value=entry.servings;
        for(const k of NUTRIENTS)$('fd-'+k).value=entry[k]===null?'':entry[k];
        $('fd-save').textContent='Save changes';form.scrollIntoView({behavior:'smooth',block:'start'});
      }));
      actions.append(button('Repeat today',()=>{
        try{persist(saveEntry(diary,{...entry,id:crypto.randomUUID(),date:date.value}));undo=null;render();inform('Repeated entry saved for selected date.');}
        catch(error){inform(error.message,true);}
      }));
      actions.append(button('Delete',()=>{
        if(!confirm('Delete “'+entry.name+'” from '+entry.date+'?'))return;
        try{persist(deleteEntry(diary,entry.id));undo=entry;reset();render();inform('Deleted. Undo delete is available until your next change.');}
        catch(error){inform(error.message,true);}
      }));
      article.append(head,values,actions);list.append(article);
    }
    $('fd-undo').hidden=!undo;
  }
  date.addEventListener('change',()=>{
    try{totalsForDate(diary,date.value);pendingCsv=null;renderCsvPreview();reset();render();inform('Showing selected day.');}
    catch(error){inform(error.message,true);}
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const entry={id:$('fd-id').value||crypto.randomUUID(),date:date.value,name:$('fd-name').value,
        occasion:$('fd-occasion').value,servings:Number($('fd-servings').value)};
      for(const k of NUTRIENTS)entry[k]=numeric($('fd-'+k).value);
      persist(saveEntry(diary,entry));undo=null;reset();render();inform('Food saved locally. Nutrient totals recalculated.');
    }catch(error){inform(error.message,true);}
  });
  $('fd-cancel').addEventListener('click',()=>{reset();inform('Edit canceled.');});
  $('fd-undo').addEventListener('click',()=>{
    if(!undo)return;
    try{persist(saveEntry(diary,undo));date.value=undo.date;undo=null;reset();render();inform('Deleted entry restored.');}
    catch(error){inform(error.message,true);}
  });
  $('fd-csv-template').addEventListener('click',()=>{
    try{
      const selected=date.value;
      saveDownload('FitnessPilot-daily-food-'+selected+'.csv',blankDailyFoodCsv(selected),'text/csv;charset=utf-8');
      inform('Blank daily CSV prepared for '+selected+'. Enter values per serving; leave unknown nutrients blank.');
    }catch(error){inform(error.message,true);}
  });
  $('fd-csv-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    pendingCsv=null;renderCsvPreview();
    try{
      if(file.size>100000||!/\.csv$/i.test(file.name))
        throw Error('Choose a daily food .csv file smaller than 100 KB.');
      const selected=date.value,raw=storage.getItem(FOOD_KEY);
      const preview=previewDailyFoodCsv(diary,await file.text(),selected);
      if(date.value!==selected||storage.getItem(FOOD_KEY)!==raw)
        throw Error('Selected date or Food Diary changed while reading the CSV. Choose it again.');
      pendingCsv={preview,snapshot:raw,backupDownloaded:false};
      renderCsvPreview();
      inform('Daily CSV preview ready. Review the items; nothing was imported yet.');
    }catch(error){inform(error.message,true);}
  });
  $('fd-export').addEventListener('click',()=>{
    try{exportFoodBackup();inform('Food Diary backup prepared. Save the file to Files.');}
    catch(error){inform(error.message,true);}
  });
  $('fd-import').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
      if(file.size>1000000)throw Error('Food Diary backup must be under 1 MB.');
      const imported=emptyOnlyRestore(diary,JSON.parse(await file.text()));
      if(!confirm('Restore '+imported.entries.length+' entries into the empty Food Diary? Existing workouts will not be changed.'))return;
      persist(imported);undo=null;reset();render();inform('Diary restored from backup.');
    }catch(error){inform(error.message,true);}
  });
  function prefillStaple(servings){
    reset();
    $('fd-name').value=LABELLED_PROTEIN_PIECE.name;
    $('fd-occasion').value=LABELLED_PROTEIN_PIECE.occasion;
    $('fd-servings').value=servings;
    for(const key of NUTRIENTS)$('fd-'+key).value=LABELLED_PROTEIN_PIECE[key];
    form.scrollIntoView({behavior:'smooth',block:'start'});
    inform((servings===3?'Three':'Six')+' pieces prefilled. Review and tap Save food to record this day. Nothing was saved yet.');
  }
  $('fd-staple-six').addEventListener('click',()=>prefillStaple(6));
  $('fd-staple-three').addEventListener('click',()=>prefillStaple(3));
  reset();render();renderCsvPreview();initSgFoodLookup();inform('Food Diary is saved only in this preview browser. Export a backup regularly.');
}
if(typeof document!=='undefined'&&document.getElementById('fd-form'))initFoodDiary();
