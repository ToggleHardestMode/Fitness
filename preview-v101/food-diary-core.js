// Dedicated preview food diary. Never reads or changes workout/check-in storage.
export const FOOD_KEY = 'fitnesspilot.preview.v101.foodDiary.v1';
export const EMPTY_DIARY = () => ({version:1,entries:[]});
export const NUTRIENTS = ['kcal','protein','carbs','fat'];
const day = value => {
  if(typeof value!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choose a valid date.');
  const d=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Choose a valid date.');
  return value;
};
export function validateEntry(e){
  if(!e||typeof e!=='object'||Array.isArray(e))throw Error('Invalid food entry.');
  if(typeof e.id!=='string'||! /^[A-Za-z0-9-]{8,80}$/.test(e.id))throw Error('Invalid food ID.');
  day(e.date);
  if(typeof e.name!=='string'||!e.name.trim()||e.name.length>80)throw Error('Food name needs 1–80 characters.');
  if(!['meal','snack','drink'].includes(e.occasion))throw Error('Choose meal, snack or drink.');
  if(typeof e.servings!=='number'||!Number.isFinite(e.servings)||e.servings<0.1||e.servings>100)throw Error('Servings must be 0.1–100.');
  for(const k of NUTRIENTS)if(e[k]!==null&&(typeof e[k]!=='number'||!Number.isFinite(e[k])||e[k]<0||e[k]>(k==='kcal'?20000:4000)))throw Error(k+' must be a nonnegative number or left blank.');
  return {id:e.id,date:e.date,name:e.name.trim(),occasion:e.occasion,servings:e.servings,kcal:e.kcal,protein:e.protein,carbs:e.carbs,fat:e.fat};
}
export function validateDiary(doc){
  if(!doc||doc.version!==1||!Array.isArray(doc.entries)||doc.entries.length>3000)throw Error('Invalid Food Diary v1 backup (max 3,000 entries).');
  const ids=new Set();
  const entries=doc.entries.map(e=>{const c=validateEntry(e);if(ids.has(c.id))throw Error('Duplicate food ID in backup.');ids.add(c.id);return c;});
  return {version:1,entries};
}
export function saveEntry(doc,e){
  const d=validateDiary(doc),value=validateEntry(e),i=d.entries.findIndex(x=>x.id===value.id);
  if(i>=0)d.entries[i]=value;
  else{if(d.entries.length===3000)throw Error('Diary full. Export before continuing.');d.entries.push(value);}
  return validateDiary(d);
}
export function deleteEntry(doc,id){
  const d=validateDiary(doc);
  if(!d.entries.some(e=>e.id===id))throw Error('Food entry no longer exists.');
  return {version:1,entries:d.entries.filter(e=>e.id!==id)};
}
export function totalsForDate(doc,date){
  day(date);
  const rows=validateDiary(doc).entries.filter(e=>e.date===date),nutrients={};
  for(const k of NUTRIENTS){const known=rows.filter(e=>e[k]!==null);nutrients[k]={value:known.reduce((a,e)=>a+e[k]*e.servings,0),unknown:rows.length-known.length};}
  return {count:rows.length,nutrients,rows};
}
export function emptyOnlyRestore(current,incoming){
  if(validateDiary(current).entries.length)throw Error('Restore only works with an empty diary; existing entries will not be overwritten.');
  return validateDiary(incoming);
}

/** Recent historical consumed entries are reusable without a separate or unbacked-up favourites store. */
export function recentFoods(doc,selectedDate,limit=8){
  day(selectedDate);
  if(!Number.isInteger(limit)||limit<1||limit>40)throw Error('Invalid recent food limit.');
  const {entries}=validateDiary(doc);
  const seen=new Set(),results=[];
  const ordered=entries.map((entry,index)=>({entry,index}))
    .filter(x=>x.entry.date<selectedDate)
    .sort((a,b)=>b.entry.date.localeCompare(a.entry.date)||b.index-a.index);
  for(const {entry} of ordered){
    const signature=JSON.stringify([entry.name.toLocaleLowerCase(),entry.occasion,entry.servings,...NUTRIENTS.map(k=>entry[k])]);
    if(seen.has(signature))continue;
    seen.add(signature);results.push({...entry});
    if(results.length===limit)break;
  }
  return results;
}
/** Duplicate an existing recorded item onto a selected local date; never replace an existing ID. */
export function repeatEntryToDate(doc,sourceId,targetDate,newId){
  day(targetDate);
  const safe=validateDiary(doc);
  const original=safe.entries.find(e=>e.id===sourceId);
  if(!original)throw Error('Source meal is unavailable.');
  if(safe.entries.some(e=>e.id===newId))throw Error('New meal ID already exists.');
  return saveEntry(safe,{...original,id:newId,date:targetDate});
}
