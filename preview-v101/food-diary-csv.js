// One-day CSV import: review additions and corrections to previously CSV-imported foods.
// Manual food entries and the empty-only JSON restore remain protected.
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
const groupKey = entry => JSON.stringify([entry.date,entry.name.toLocaleLowerCase('en'),entry.occasion]);
const isCsvOwned = entry => entry.id.startsWith('foodcsv-');

// Preview is entirely read-only. Only uniquely matched, CSV-owned food rows
// can be corrected; the original ID survives so history stays stable.
export function previewDailyFoodCsv(current,csv,selectedDate){
  const diary=validateDiary(current),date=validDate(selectedDate);
  const rows=fields(csv),occurrences=new Map(),groups=new Map();
  for(const [index,row] of rows.entries()){
    const line=index+2;
    if(row.date!==date)throw Error('CSV row '+line+': date must match selected day '+date+'. Import one day at a time.');
    const item={date,name:row.name,occasion:row.occasion,servings:positive(row.servings,'Row '+line+' servings'),
      ...Object.fromEntries(NUTRIENTS.map(k=>[k,perServing(row[k],'Row '+line+' '+k)]))};
    const key=canonical(item),nth=(occurrences.get(key)||0)+1;
    occurrences.set(key,nth);
    const entry=validateEntry({...item,id:stableId(key,nth)}),g=groupKey(entry);
    if(!groups.has(g))groups.set(g,[]);
    groups.get(g).push(entry);
  }
  const add=[],skipped=[],updates=[],existingIds=new Map(diary.entries.map(e=>[e.id,e]));
  for(const group of groups.values()){
    const original=diary.entries.filter(e=>sameName(e,group[0]));
    if(original.some(e=>!isCsvOwned(e)))
      throw Error('Food '+group[0].name+' already exists on this day as a manual entry. Review it before importing.');
    const used=new Set(),unmatched=[];
    for(const entry of group){
      // Match exact content first, including entries whose IDs were retained
      // after an earlier explicitly confirmed correction.
      const found=original.find(e=>!used.has(e.id)&&e.id===entry.id&&canonical(e)===canonical(entry))||
        original.find(e=>!used.has(e.id)&&canonical(e)===canonical(entry));
      if(found){used.add(found.id);skipped.push(found);}
      else unmatched.push(entry);
    }
    const remaining=original.filter(e=>!used.has(e.id));
    if(!remaining.length) {
      // All existing versions are present unchanged: extra CSV rows are new.
      add.push(...unmatched);
    }else if(remaining.length===1&&unmatched.length===1){
      const before=remaining[0],after=validateEntry({...unmatched[0],id:before.id});
      updates.push({before,after});
    }else if(unmatched.length) {
      throw Error('Food '+group[0].name+' has ambiguous repeated entries. Review or edit them individually; nothing imported.');
    }
    // Existing rows absent from this CSV remain untouched.
  }
  const occupied=new Set(existingIds.keys());
  for(const item of add){
    if(occupied.has(item.id))
      throw Error('Food import ID already exists with different data. Nothing imported.');
    occupied.add(item.id);
  }
  if(diary.entries.length+add.length>3000)throw Error('Food Diary would exceed 3,000 entries.');
  return {date,add,skipped,updates,total:rows.length};
}

export function applyDailyFoodCsv(current,preview,{apply=false,confirmed=false}={}){
  const diary=validateDiary(current);
  if(!preview||!validDate(preview.date)||!Array.isArray(preview.add)||
     !Array.isArray(preview.skipped)||!Array.isArray(preview.updates))
    throw Error('Preview a valid daily CSV before importing.');
  const changed=preview.updates.length;
  const result={applied:false,added:preview.add.length,skipped:preview.skipped.length,
    ...(changed?{updated:changed}:{})};
  if(!apply)return result;
  if(!confirmed)throw Error('Explicit daily food import confirmation required.');

  const byId=new Map(diary.entries.map(e=>[e.id,e])),replaced=new Map(),added=[],handled=new Set();
  const stale=()=>{throw Error('Food Diary changed since preview; review the CSV again. Nothing imported.');};
  for(const item of preview.skipped){
    const expected=validateEntry(item),saved=byId.get(expected.id);
    if(!saved||JSON.stringify(saved)!==JSON.stringify(expected)||handled.has(expected.id))stale();
    handled.add(expected.id);
  }
  for(const item of preview.updates){
    if(!item||!item.before||!item.after)stale();
    const before=validateEntry(item.before),after=validateEntry(item.after);
    const original=byId.get(before.id);
    if(!isCsvOwned(before)||after.id!==before.id||!sameName(before,after)||
       canonical(before)===canonical(after)||!original||
       JSON.stringify(original)!==JSON.stringify(before)||handled.has(before.id)||
       diary.entries.some(e=>sameName(e,before)&&!isCsvOwned(e)))stale();
    handled.add(before.id);replaced.set(before.id,after);
  }
  for(const row of preview.add){
    const entry=validateEntry(row);
    if(entry.date!==preview.date||byId.has(entry.id)||handled.has(entry.id)||
       diary.entries.some(e=>sameName(e,entry)&&!isCsvOwned(e)))stale();
    handled.add(entry.id);added.push(entry);
  }
  if(!added.length&&!replaced.size)return {applied:false,added:0,skipped:preview.skipped.length};
  return {applied:true,added:added.length,skipped:preview.skipped.length,
    ...(replaced.size?{updated:replaced.size}:{}),
    diary:validateDiary({version:1,entries:[
      ...diary.entries.map(e=>replaced.get(e.id)||e),...added
    ]})};
}
