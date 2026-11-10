// Daily Food Diary CSV import. Mutations are opt-in, confirmed, and append-only.
// Unlike JSON backup restore, CSV can add one explicitly selected day to an existing diary.
import {validateDiary,validateEntry,NUTRIENTS} from './food-diary-core.js';

export const FOOD_CSV_COLUMNS = Object.freeze(['date','name','occasion','servings',...NUTRIENTS]);
const MAX_BYTES = 100_000,MAX_ROWS=100;
const canonical = entry => JSON.stringify([entry.date,entry.name.toLocaleLowerCase('en'),
  entry.occasion,entry.servings,...NUTRIENTS.map(k=>entry[k])]);

function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||
     !Number.isFinite(Date.parse(value+'T12:00:00Z'))||
     new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)
    throw Error('Choose a valid daily import date.');
  return value;
}
function fields(text){
  if(typeof text!=='string'||!text.trim()||text.length>MAX_BYTES)
    throw Error('Daily food CSV must be nonempty and smaller than 100 KB.');
  const rows=[];let row=[],cell='',quoted=false,finished=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){
      if(char==='"'&&text[i+1]==='"'){cell+='"';i++;}
      else if(char==='"'){quoted=false;finished=true;}
      else cell+=char;
    }else if(char===','||char==='\r'||char==='\n'){
      row.push(cell);cell='';finished=false;
      if(char!==','){
        if(row.some(c=>c.trim()))rows.push(row);
        row=[];if(char==='\r'&&text[i+1]==='\n')i++;
      }
    }else if(char==='"'&&!cell&&!finished)quoted=true;
    else if(char==='"'||finished)throw Error('Malformed daily food CSV near character '+(i+1)+'.');
    else cell+=char;
  }
  if(quoted)throw Error('Daily food CSV has an unfinished quote.');
  if(cell!==''||row.length){row.push(cell);if(row.some(c=>c.trim()))rows.push(row);}
  if(rows.length<2)throw Error('CSV needs a header and at least one food row.');
  if(rows.length>MAX_ROWS+1)throw Error('Import at most 100 food entries for one day.');
  const header=rows.shift().map(x=>x.trim().toLowerCase());
  if(new Set(header).size!==header.length||header.length!==FOOD_CSV_COLUMNS.length||
     FOOD_CSV_COLUMNS.some(x=>!header.includes(x)))
    throw Error('Daily CSV columns must be: '+FOOD_CSV_COLUMNS.join(', ')+'.');
  return rows.map((r,i)=>{
    if(r.length!==header.length)throw Error('Daily CSV row '+(i+2)+' has an incorrect number of columns.');
    return Object.fromEntries(header.map((name,j)=>[name,r[j].trim()]));
  });
}
function positive(value,label){
  if(!/^(?:\d+)(?:\.\d+)?$/.test(value))throw Error(label+' must be a positive decimal.');
  return Number(value);
}
function perServing(value,label){
  if(value==='')return null; // Unknown is not zero.
  if(!/^(?:\d+)(?:\.\d+)?$/.test(value))throw Error(label+' must be a nonnegative decimal or blank.');
  return Number(value);
}
// Fixed, non-security fingerprint. Check full row equality on every matching ID.
function stableId(value,ordinal){
  let hash=14695981039346656037n;
  for(const ch of value+'#'+ordinal){
    hash=(hash^BigInt(ch.codePointAt(0)))*1099511628211n & 0xffffffffffffffffn;
  }
  return 'foodcsv-'+hash.toString(16).padStart(16,'0');
}
const sameName=(a,b)=>a.date===b.date&&
  a.name.toLocaleLowerCase('en')===b.name.toLocaleLowerCase('en')&&a.occasion===b.occasion;

export function blankDailyFoodCsv(selectedDate){
  validDate(selectedDate);
  return '\uFEFF'+FOOD_CSV_COLUMNS.join(',')+'\r\n'+selectedDate+',,,,,,,\r\n';
}
export function previewDailyFoodCsv(current,csv,selectedDate){
  const diary=validateDiary(current),date=validDate(selectedDate);
  const rows=fields(csv),existingIds=new Map(diary.entries.map(e=>[e.id,e]));
  const occurrences=new Map(),add=[],skipped=[];
  for(const [index,row] of rows.entries()){
    const line=index+2;
    if(row.date!==date)throw Error('CSV row '+line+': date must match selected day '+date+'. Import one day at a time.');
    const item={date,name:row.name,occasion:row.occasion,servings:positive(row.servings,'Row '+line+' servings'),
      ...Object.fromEntries(NUTRIENTS.map(k=>[k,perServing(row[k],'Row '+line+' '+k)]))};
    // Validate using the exact existing Food Diary shape and nutrition rules.
    const key=canonical(item),nth=(occurrences.get(key)||0)+1;
    occurrences.set(key,nth);
    const entry=validateEntry({...item,id:stableId(key,nth)});
    const old=existingIds.get(entry.id);
    if(old){
      if(canonical(old)!==canonical(entry))throw Error('CSV row '+line+': import ID conflicts with an existing food. Nothing imported.');
      skipped.push(entry);continue;
    }
    // Without stable import IDs, a same-day manual entry is ambiguous. Never double-log silently.
    if(diary.entries.some(e=>sameName(e,entry)))
      throw Error('CSV row '+line+': '+entry.name+' already exists on this day with another ID. Review the existing food before importing.');
    add.push(entry);
  }
  if(diary.entries.length+add.length>3000)throw Error('Food Diary would exceed 3,000 entries.');
  return {date,add,skipped,total:rows.length};
}
export function applyDailyFoodCsv(current,preview,{apply=false,confirmed=false}={}){
  const diary=validateDiary(current);
  if(!preview||!validDate(preview.date)||!Array.isArray(preview.add)||!Array.isArray(preview.skipped))
    throw Error('Preview a valid daily CSV before importing.');
  if(!apply)return {applied:false,added:preview.add.length,skipped:preview.skipped.length};
  if(!confirmed)throw Error('Explicit daily food import confirmation required.');
  const ids=new Set(diary.entries.map(e=>e.id)),newRows=[];
  for(const raw of preview.add){
    const entry=validateEntry(raw);
    if(entry.date!==preview.date||ids.has(entry.id)||diary.entries.some(e=>sameName(e,entry)))
      throw Error('Food Diary changed since preview; review the CSV again. Nothing imported.');
    ids.add(entry.id);newRows.push(entry);
  }
  if(!newRows.length)return {applied:false,added:0,skipped:preview.skipped.length};
  return {applied:true,added:newRows.length,skipped:preview.skipped.length,
    diary:validateDiary({version:1,entries:[...diary.entries,...newRows]})};
}
