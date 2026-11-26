import {dateFromKey, weekdayOf, intRange, validateBackup, isHistoricalWorkout} from './core.js';
import {splitCsv, previewCompletedCsv} from './completed-workout-csv.js';
import {previewWorkoutBatch} from './batch-import.js';

const norm = s => String(s ?? '').trim().toLocaleLowerCase('en');
const columns = ['date','workout','exercise','set','kg','reps','rpe','template_id','exercise_index','difficulty','technique','notes'];
const csv = rows => [columns.join(','), ...rows.map(row => columns.map(key =>
  '"' + String(row[key] ?? '').replaceAll('"','""') + '"').join(','))].join('\n');
const completed = rows => rows.filter(r => r.kg !== '' || r.reps !== '' ||
  ['rpe','difficulty','technique','notes'].some(k => r[k]));
function historicalId(date, name) {
  let hash = 14695981039346656037n;
  for (const ch of norm(name)) hash = (hash ^ BigInt(ch.codePointAt(0))) * 1099511628211n & 0xffffffffffffffffn;
  return 'historical-' + date + '-' + hash.toString(16).padStart(16,'0');
}

export function inspectWorkoutFiles(state, files) {
  return files.map(file => {
    try {
      const rows = splitCsv(file.text);
      previewCompletedCsv(state, file.text);
      return {...file, choice:'exact', hasNotes:rows.some(r => r.notes)};
    } catch (error) {
      return {...file, choice:'', error:error.message, hasNotes:true};
    }
  });
}

function historicalFile(state, file) {
  const rows = completed(splitCsv(file.text));
  if (!rows.length) throw Error('No measured sets found.');
  const first = rows[0], date = first.date;
  dateFromKey(date);
  if (!first.workout || rows.some(r => r.date !== date || norm(r.workout) !== norm(first.workout)))
    throw Error('Historical import needs one date and one workout per file. Split the file first.');
  const id = historicalId(date, first.workout);
  if (state.logs.some(l => l.date === date && l.templateId !== id))
    throw Error('This date already has sets in a different workout. Resolve against that workout to avoid double counting.');
  const groups = new Map();
  for (const row of rows) {
    if (!row.exercise || !row.kg || !row.reps) throw Error('Every completed row needs an exercise, kg and reps. Missing values cannot be invented.');
    const key = row.exercise_index ? 'index:' + intRange(row.exercise_index,'Exercise index',1,200) : 'name:' + norm(row.exercise);
    const set = intRange(row.set,'Set number',1,10), reps = intRange(row.reps,'Repetitions',1,100);
    if (!groups.has(key)) groups.set(key,{name:row.exercise, muscle:'Unclassified', sets:set,
      min:reps,max:reps,rest:0,sourceNote:'Historical record: observed reps only; rest and muscle classification not recorded.',
      ...(/\(seconds\/side\)/i.test(row.exercise)?{repUnit:'seconds_per_side'}:{}), rows:[]});
    const group = groups.get(key);
    if (norm(group.name) !== norm(row.exercise)) throw Error('Exercise index refers to different movement names. Use distinct indices.');
    group.sets = Math.max(group.sets,set);group.min = Math.min(group.min,reps);group.max = Math.max(group.max,reps);
    group.rows.push(row);
  }
  const exercises = [...groups.values()].map(({rows,...exercise}) => exercise);
  const template = {id,name:date+' · '+first.workout.slice(0,47),day:weekdayOf(date),
    sourceVersion:'Historical import', exercises,
    requiresClinicalReview:/\b(lower|legs?)\b|\[PT\s*Review\]/i.test(first.workout) ||
      exercises.some(e => /\b(squat|deadlift|lunge|split squat|leg press)\b|\[PT\]/i.test(e.name))};
  const existing = state.templates.find(t => t.id === id);
  if (existing && (!isHistoricalWorkout(existing) || JSON.stringify(existing)!==JSON.stringify(template)))
    throw Error('Historical workout already exists with a different structure. Do not create a second identity; review the source file.');
  if (!existing) state.templates.push(template);
  const normalized = [...groups.values()].flatMap((group,index) => group.rows.map(row =>
    ({...row,workout:template.name,exercise:group.name,template_id:id,exercise_index:index+1})));
  return {...file,text:csv(normalized)};
}

function matchedFile(state, file, id) {
  const target = state.templates.find(t => t.id === id && !isHistoricalWorkout(t));
  if (!target) throw Error('Selected workout is no longer available.');
  const rows = completed(splitCsv(file.text)).map(row => {
    const matches = target.exercises.map((ex,i) => ({ex,i})).filter(x => norm(x.ex.name)===norm(row.exercise));
    if (matches.length!==1) throw Error('Exercise "'+row.exercise+'" needs an exact, unique name in the selected workout. Correct the actual movement or choose historical.');
    const {ex,i}=matches[0];
    return {...row,workout:target.name,exercise:ex.name,template_id:target.id,exercise_index:i+1};
  });
  return {...file,text:csv(rows)};
}

export function resolveWorkoutFiles(baseline, reviewed) {
  if (!Array.isArray(reviewed) || !reviewed.length || reviewed.length>20) throw Error('Choose 1–20 files.');
  const state=structuredClone(baseline), selected=[], excluded=[];
  const initialIds=new Set(state.templates.map(t=>t.id));
  let bytes=0;
  for (const file of reviewed) {
    if(file.choice==='skip'){excluded.push(file.name);continue;}
    try {
      if(typeof file.text!=='string' || file.text.length>1_000_000)throw Error('File exceeds the completed CSV size limit.');
      bytes+=file.text.length;if(bytes>5_000_000)throw Error('Batch exceeds size limit.');
      if(file.choice==='exact')selected.push(file);
      else if(file.choice==='historical')selected.push(historicalFile(state,file));
      else if(file.choice?.startsWith('match:'))selected.push(matchedFile(state,file,file.choice.slice(6)));
      else throw Error('Choose a resolution or explicitly exclude the file.');
    } catch(error) {throw Error(file.name+': '+error.message+' Nothing imported.');}
  }
  if(!selected.length)throw Error('No files selected for import.');
  validateBackup(state);
  const preview=previewWorkoutBatch(state,selected);
  // A historical session must never be counted alongside another identity on the same date.
  const byDate=new Map();
  for(const row of [...preview.add,...preview.skipped,...baseline.logs]){
    if(!byDate.has(row.date))byDate.set(row.date,new Set());
    byDate.get(row.date).add(row.templateId);
  }
  for(const row of [...preview.add,...preview.skipped]){
    const ids=byDate.get(row.date);
    if(ids.size>1&&[...ids].some(id=>isHistoricalWorkout(state.templates.find(t=>t.id===id))))
      throw Error(row.date+': historical and other workout identities overlap. Resolve to one identity; nothing imported.');
  }
  return {...preview,historical:state.templates.filter(t=>!initialIds.has(t.id)),excluded};
}
