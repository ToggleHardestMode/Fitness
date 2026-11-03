import {dateFromKey, intRange, numRange, recordSets, validateBackup} from './core.js';

// Completed workout data, not reusable Plan templates. No state changes until Apply.
const REQUIRED = ['date','workout','exercise','set','kg','reps'];
const FIELDS = [...REQUIRED,'rpe','template_id','exercise_index','difficulty','technique','notes'];
const MAX_SIZE = 1_000_000;
const clean = value => String(value ?? '').trim();
const equalName = (a,b) => clean(a).toLocaleLowerCase('en') === clean(b).toLocaleLowerCase('en');
const keyFor = (date,id,index,set) => [date,id,index,set].join('|');
const csvCell = value => {
  let text=String(value ?? '');
  if (/^\s*[=+@-]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
};

function splitCsv(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_SIZE)
    throw Error('Choose a nonempty completed-workout CSV smaller than 1 MB.');
  const rows=[]; let row=[],field='',quoted=false,finished=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted){
      if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(c==='"') {quoted=false;finished=true;}
      else field+=c;
    }else if(c===','||c==='\r'||c==='\n'){
      row.push(field);field='';finished=false;
      if(c!==','){
        if(row.some(v=>v.trim()!==''))rows.push(row);
        row=[];
        if(c==='\r'&&text[i+1]==='\n')i++;
      }
    }else if(c==='"'&&field===''&&!finished){quoted=true;}
    else if(c==='"'||finished)throw Error('Malformed completed-workout CSV near character '+(i+1)+'.');
    else field+=c;
  }
  if(quoted)throw Error('Completed-workout CSV has an unterminated quoted cell.');
  if(row.length||field!==''){
    row.push(field);
    if(row.some(v=>v.trim()!==''))rows.push(row);
  }
  if(rows.length<2)throw Error('CSV must contain a header and completed set rows.');
  if(rows.length>501)throw Error('Import at most 500 CSV data rows at a time.');
  const headings=rows.shift().map(h=>clean(h).toLowerCase());
  if(new Set(headings).size!==headings.length)throw Error('CSV has duplicate column headings.');
  for(const heading of REQUIRED)if(!headings.includes(heading))
    throw Error("Completed-workout CSV is missing '"+heading+"'. Use Download blank session CSV in Train. The Plan template CSV is a different format.");
  return rows.map((cells,index)=>{
    if(cells.length!==headings.length)throw Error('CSV data row '+(index+2)+' has '+cells.length+' cells; expected '+headings.length+'.');
    return Object.fromEntries(headings.map((name,i)=>[name,clean(cells[i])]));
  });
}

function resolve(state,row,line) {
  const found = row.template_id
    ? state.templates.filter(t=>t.id===row.template_id)
    : state.templates.filter(t=>equalName(t.name,row.workout));
  if(found.length!==1)throw Error("CSV row "+line+": workout '"+row.workout+"' "+(found.length?'is ambiguous':'is not in your library')+". Import its template separately first.");
  const template=found[0];
  if(!equalName(template.name,row.workout))throw Error('CSV row '+line+': workout name does not match its template_id.');
  const positions=template.exercises.map((exercise,index)=>({exercise,index}))
    .filter(item=>equalName(item.exercise.name,row.exercise));
  let index;
  if(row.exercise_index) {
    index=intRange(row.exercise_index,'CSV row '+line+' exercise_index',1,template.exercises.length)-1;
    if(!equalName(template.exercises[index].name,row.exercise))
      throw Error('CSV row '+line+': exercise name and exercise_index disagree.');
  } else if(positions.length===1) index=positions[0].index;
  else throw Error("CSV row "+line+": exercise '"+row.exercise+"' is "+(positions.length?'ambiguous':'not in this workout')+". Download this workout's CSV for its exact exercise_index.");
  const exercise=template.exercises[index];
  const set=intRange(row.set,'CSV row '+line+' set',1,exercise.sets);
  return {template,exercise,index,set};
}

function matchesExisting(old,entry,supplied) {
  if(old.kg!==entry.kg||old.reps!==entry.reps)return false;
  for(const name of ['rpe','difficulty','technique','notes'])
    if(supplied[name]!==undefined && supplied[name]!=='' &&
       clean(old[name]??'')!==clean(entry[name]??''))return false;
  return true;
}

export function previewCompletedCsv(state,text) {
  const rows=splitCsv(text);
  const existing=new Map(state.logs.map(l=>[keyFor(l.date,l.templateId,l.exerciseIndex,l.set),l]));
  const seen=new Set(),add=[],skipped=[];
  for(let i=0;i<rows.length;i++) {
    const row=rows[i],line=i+2;
    if(row.kg==='' && row.reps==='' && !['rpe','difficulty','technique','notes']
        .some(name=>row[name]!==undefined&&row[name]!==''))continue;
    if(row.kg===''||row.reps==='')throw Error('CSV row '+line+': both kg and reps are required for a completed set.');
    dateFromKey(row.date);
    const {template,exercise,index,set}=resolve(state,row,line);
    const key=keyFor(row.date,template.id,index,set);
    if(seen.has(key))throw Error('CSV row '+line+': the same dated workout, exercise and set appears twice. Nothing imported.');
    seen.add(key);
    const kg=numRange(row.kg,'CSV row '+line+' kilograms',0,500);
    const reps=intRange(row.reps,'CSV row '+line+' repetitions',1,100);
    const rpe=row.rpe?numRange(row.rpe,'CSV row '+line+' RPE',1,10):null;
    const difficulty=row.difficulty||'';
    const technique=row.technique||'';
    const notes=row.notes||'';
    if(!['','too_easy','on_target','too_hard'].includes(difficulty))
      throw Error('CSV row '+line+': difficulty must be too_easy, on_target or too_hard.');
    if(!['','controlled','unstable'].includes(technique))
      throw Error('CSV row '+line+': technique must be controlled or unstable.');
    if(notes.length>250)throw Error('CSV row '+line+': notes exceed 250 characters.');
    const entry={date:row.date,templateId:template.id,exerciseIndex:index,
      set,kg,reps,rpe,difficulty,technique,notes,exerciseName:exercise.name,
      workoutName:template.name};
    const previous=existing.get(key);
    if(previous) {
      if(!matchesExisting(previous,entry,row))
        throw Error('CSV row '+line+': saved set conflicts with an existing record on '+row.date+' ('+template.name+', '+exercise.name+', set '+set+'). Nothing imported or overwritten.');
      skipped.push(entry);
    } else add.push(entry);
  }
  if(!add.length&&!skipped.length)throw Error('No completed sets found. Fill in kg and reps for at least one row.');
  return {add,skipped,completed:add.length+skipped.length,
    days:[...new Set([...add,...skipped].map(r=>r.date))].sort()};
}

export function applyCompletedCsv(state,preview,makeId) {
  if(!preview||!Array.isArray(preview.add)||!preview.add.length)
    throw Error('No new completed sets to import.');
  let result=structuredClone(state);
  const grouped=new Map();
  for(const row of preview.add){
    const k=[row.date,row.templateId,row.exerciseIndex].join('|');
    if(!grouped.has(k))grouped.set(k,[]);
    grouped.get(k).push(row);
  }
  for(const group of grouped.values()){
    const first=group[0];
    const exercise=result.templates.find(t=>t.id===first.templateId)?.exercises[first.exerciseIndex];
    if(!exercise)throw Error('Workout changed since import preview; nothing imported.');
    const entries=Array.from({length:exercise.sets},()=>({completed:false}));
    for(const row of group){
      entries[row.set-1]={completed:true,kg:row.kg,reps:row.reps,
        rpe:row.rpe ?? '',rest:exercise.rest,notes:row.notes,
        difficulty:row.difficulty,technique:row.technique};
    }
    result=recordSets(result,{date:first.date,templateId:first.templateId,
      exerciseIndex:first.exerciseIndex,entries},makeId).state;
  }
  return validateBackup(result);
}

export function blankCompletedCsv(state,date,templateId) {
  dateFromKey(date);
  const template=state.templates.find(t=>t.id===templateId);
  if(!template)throw Error('Choose a workout in Train to download its completed-set CSV.');
  const lines=[FIELDS.map(csvCell).join(',')];
  template.exercises.forEach((exercise,index)=>{
    for(let set=1;set<=exercise.sets;set++){
      const row={date,workout:template.name,exercise:exercise.name,set,
        template_id:template.id,exercise_index:index+1};
      lines.push(FIELDS.map(h=>csvCell(row[h]??'')).join(','));
    }
  });
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
