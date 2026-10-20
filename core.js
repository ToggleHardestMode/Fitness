// FitnessPilot's data rules. No network calls or browser-specific APIs.
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const STORAGE_KEY = "fitnesspilot.web.v1";
export const emptyState = () => ({ version: 1, templates: [], assignments: {}, logs: [], metrics: [], reminder: { hour: 18, minute: 30, lead: 0 } });

export const STARTER_CSV = `day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds
Mon,Upper A,Dumbbell Bench Press,Chest,3,8,12,120
Mon,Upper A,Chest Supported Row,Back,3,8,12,120
Mon,Upper A,Seated Shoulder Press,Shoulders,3,8,12,90
Mon,Upper A,Lateral Raise,Shoulders,3,12,15,60
Tue,Lower A,Leg Press,Quads,3,8,12,120
Tue,Lower A,Seated Leg Curl,Hamstrings,3,10,15,90
Tue,Lower A,Standing Calf Raise,Calves,3,12,20,60
Thu,Upper B,Incline Dumbbell Press,Chest,3,8,12,120
Thu,Upper B,One Arm Cable Row,Back,3,8,12,120
Thu,Upper B,Triceps Pushdown,Arms,3,10,15,60
Thu,Upper B,Dumbbell Curl,Arms,3,10,15,60
Fri,Lower B,Hack Squat Machine,Quads,3,8,12,120
Fri,Lower B,Leg Extension,Quads,3,12,15,60
Fri,Lower B,Seated Leg Curl,Hamstrings,3,10,15,90
Fri,Lower B,Seated Calf Raise,Calves,3,12,20,60`;

// Recovery-Optimized Upper/Lower routine supplied 30 Sep 2026.
// Unspecified rest durations use this app's 90-second default.
export const RECOVERY_UL_CSV = `day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds,source_note
Mon,Recovery UL — Upper A,Flat Bench Press — Top Set,Chest,1,5,8,90,First heavy top set; barbell or heavy dumbbells
Mon,Recovery UL — Upper A,Flat Bench Press — Back-offs,Chest,2,8,12,90,Two back-off sets after top set
Mon,Recovery UL — Upper A,Chest-Supported DB Row,Back,3,8,12,90,Chest remains supported
Mon,Recovery UL — Upper A,Incline DB Fly,Chest,3,12,15,90,Two-second squeeze at top
Mon,Recovery UL — Upper A,Close-Grip Lat Pulldown,Back,3,10,12,90,Neutral or semi-supinated handle
Mon,Recovery UL — Upper A,Lean-Away DB Lateral Raise,Shoulders,3,15,20,90,Controlled motion
Mon,Recovery UL — Upper A,Incline DB Curl (SS1),Arms,3,10,15,90,Superset with Cable Triceps Pushdown; 60–90s rest after both
Mon,Recovery UL — Upper A,Cable Triceps Pushdown (SS1),Arms,3,10,15,90,Superset with Incline DB Curl
Tue,Recovery UL — Lower A,Heel-Elevated Goblet Squat — Top Set,Quads,1,6,8,90,Heels elevated 2–3 cm; maintain neutral spine
Tue,Recovery UL — Lower A,Heel-Elevated Goblet Squat — Back-offs,Quads,2,10,12,90,Two back-off sets after top set
Tue,Recovery UL — Lower A,DB Reverse Lunge,Quads,3,10,12,90,Reps per leg; maintain upright torso
Tue,Recovery UL — Lower A,Weighted Glute Bridge,Glutes,3,8,12,90,Finish movement with glutes
Tue,Recovery UL — Lower A,Slider Leg Curl,Hamstrings,3,10,15,90,Keep hips high
Tue,Recovery UL — Lower A,Standing Calf Raise (DB),Calves,4,15,20,90,Controlled lowering
Tue,Recovery UL — Lower A,Bird-Dogs,Core,2,8,10,90,Reps per side; low fatigue
Thu,Recovery UL — Upper B,Incline DB Press — Top Set,Chest,1,6,9,90,First heavy top set
Thu,Recovery UL — Upper B,Incline DB Press — Back-offs,Chest,2,10,12,90,Two back-off sets after top set
Thu,Recovery UL — Upper B,Supported Single-Arm DB Row,Back,3,10,15,90,Reps per arm; do not twist torso
Thu,Recovery UL — Upper B,Seated DB Shoulder Press,Shoulders,3,8,12,90,Back-supported bench preferred
Thu,Recovery UL — Upper B,Chest-Supported DB Reverse Fly,Shoulders,3,15,20,90,"Rear delts, chest supported"
Thu,Recovery UL — Upper B,Face Pull (SS1),Shoulders,3,15,20,60,Superset with DB Lateral Raise; third set optional
Thu,Recovery UL — Upper B,DB Lateral Raise (SS1),Shoulders,3,15,20,60,Superset with Face Pull; third set optional; 60s rest after pair
Thu,Recovery UL — Upper B,Hammer Curl (SS2),Arms,3,10,15,90,Superset with Overhead Cable Triceps Extension
Thu,Recovery UL — Upper B,Overhead Cable Triceps Extension (SS2),Arms,3,10,15,90,Superset with Hammer Curl; 60–90s rest after pair
Fri,Recovery UL — Lower B,Bulgarian Split Squat,Quads,3,8,12,90,Reps per leg; upright torso
Fri,Recovery UL — Lower B,Cyclist Goblet Squat,Quads,3,12,15,90,Heels elevated; lighter quad emphasis
Fri,Recovery UL — Lower B,Single-Leg Glute Bridge,Glutes,3,12,15,90,Reps per leg; avoid lumbar overextension
Fri,Recovery UL — Lower B,Lying DB Leg Curl (SS1),Hamstrings,3,10,15,90,Superset with Slider Leg Curl; consider band alternative if unstable
Fri,Recovery UL — Lower B,Slider Leg Curl (SS1),Hamstrings,3,10,15,90,Superset with Lying DB Leg Curl; 60–90s rest after pair
Fri,Recovery UL — Lower B,Seated Calf Raise (DB),Calves,4,15,20,90,Dumbbell on thighs`;

export function fail(message) { throw Error(message); }
export function weekdayOf(dateKey) {
  const date = dateFromKey(dateKey);
  return (date.getDay() + 6) % 7;
}
export function dateFromKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) fail("Invalid date. Use YYYY-MM-DD.");
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) fail("Invalid calendar date: " + key);
  return date;
}
export function dateKey(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function addDays(key, amount) {
  const d = dateFromKey(key); d.setDate(d.getDate() + amount); return dateKey(d);
}
export function weekDates(key) {
  const monday = addDays(key, -weekdayOf(key));
  return DAYS.map((_, i) => addDays(monday, i));
}

export function parseCSV(text) {
  if (typeof text !== "string" || text.length > 1_000_000) fail("CSV must be smaller than 1 MB.");
  text = text.replace(/^\uFEFF/, "");
  let rows = [], row = [], field = "", quoted = false, finishedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; finishedQuote = true; }
      else { field += c; }
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ""; finishedQuote = false;
      if (c !== ',') {
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (c === '"' && field === "" && !finishedQuote) { quoted = true; }
    else if (c === '"' || finishedQuote) { fail(`Malformed CSV near character ${i + 1}.`); }
    else { field += c; }
  }
  if (quoted) fail("Malformed CSV: unfinished quoted cell.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some(v => v.trim() !== "")) rows.push(row);
  }
  if (!rows.length) fail("CSV has no rows.");
  const header = rows.shift().map(h => h.trim().toLowerCase());
  if (new Set(header).size !== header.length) fail("CSV has duplicate column headings.");
  for (const h of ["day", "workout", "exercise", "muscle", "sets", "rep_min", "rep_max"]) {
    if (!header.includes(h)) fail(`CSV is missing the '${h}' column.`);
  }
  if (!rows.length) fail("CSV contains no exercises.");
  if (rows.length > 500) fail("CSV can contain at most 500 exercises.");
  return rows.map((values, i) => {
    if (values.length !== header.length) fail(`CSV row ${i + 2} has ${values.length} columns; expected ${header.length}.`);
    return Object.fromEntries(header.map((h, n) => [h, values[n].trim()]));
  });
}
function limited(value, label, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${label} must be 1–${max} characters.`);
  return value.trim();
}
export function intRange(raw, label, min, max) {
  const s = String(raw);
  if (!/^\d+$/.test(s)) fail(`${label} must be a whole number.`);
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}.`);
  return n;
}
export function numRange(raw, label, min, max) {
  if (typeof raw === "string" && !raw.trim()) fail(`${label} is required.`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}.`);
  return n;
}
const dayIndex = raw => {
  const d = DAYS.findIndex((d, i) => [d.toLowerCase(), DAY_NAMES[i].toLowerCase()].includes(String(raw).toLowerCase()));
  if (d < 0) fail(`Unknown weekday '${raw}'. Use Mon through Sun.`);
  return d;
};
export function parseWorkouts(csv) {
  const rows = parseCSV(csv);
  const groups = new Map();
  for (const [i, r] of rows.entries()) {
    const day = dayIndex(r.day), name = limited(r.workout, `Row ${i + 2}: workout`, 60);
    const key = `${day}|${name.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { day, name, exercises: [] });
    const sets = intRange(r.sets, `Row ${i + 2}: sets`, 1, 10);
    const min = intRange(r.rep_min, `Row ${i + 2}: minimum reps`, 1, 100);
    const max = intRange(r.rep_max, `Row ${i + 2}: maximum reps`, 1, 100);
    if (min > max) fail(`Row ${i + 2}: minimum reps exceed maximum reps.`);
    groups.get(key).exercises.push({ name: limited(r.exercise, `Row ${i + 2}: exercise`, 80), muscle: limited(r.muscle, `Row ${i + 2}: muscle`, 40), sets, min, max, rest: intRange((r.rest_seconds === undefined || r.rest_seconds === "" ? "90" : r.rest_seconds), `Row ${i + 2}: rest seconds`, 0, 600) });
  }
  return [...groups.values()];
}
const signature = t => JSON.stringify([t.day, t.name.toLowerCase(), t.exercises.map(e => [e.name.toLowerCase(), e.muscle.toLowerCase(), e.sets, e.min, e.max, e.rest])]);
export function addWorkouts(state, workouts, makeAssignments = false, makeId = () => globalThis.crypto?.randomUUID?.() || `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  const next = structuredClone(state);
  const existing = new Set(next.templates.map(signature));
  let added = 0, skipped = 0;
  for (const workout of workouts) {
    const key = signature(workout);
    if (existing.has(key)) { skipped++; continue; }
    existing.add(key);
    const template = { ...structuredClone(workout), id: makeId() };
    next.templates.push(template);
    if (makeAssignments && !(String(workout.day) in next.assignments)) next.assignments[workout.day] = template.id;
    added++;
  }
  return { state: next, added, skipped };
}
export function recordSets(state, { date, templateId, exerciseIndex, entries }, makeId = () => globalThis.crypto?.randomUUID?.() || `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  dateFromKey(date);
  const template = state.templates.find(t => t.id === templateId);
  if (!template) fail("The selected workout no longer exists.");
  const exercise = template.exercises[exerciseIndex];
  if (!exercise) fail("The selected exercise no longer exists.");
  if (!Array.isArray(entries) || entries.length !== exercise.sets) fail("The exercise's set count does not match the plan.");
  const next = structuredClone(state);
  let saved = 0;
  entries.forEach((e, i) => {
    const existingIndex = next.logs.findIndex(l => l.date === date && l.templateId === templateId && l.exerciseIndex === exerciseIndex && l.set === i + 1);
    if (!e.completed) return;
    const kg = numRange(e.kg, `Set ${i+1} weight`, 0, 500);
    const reps = intRange(e.reps, `Set ${i+1} reps`, 1, 100);
    const rpe = e.rpe === "" || e.rpe == null ? null : numRange(e.rpe, `Set ${i+1} RPE`, 1, 10);
    const rest = intRange(e.rest ?? exercise.rest, `Set ${i+1} rest`, 0, 600);
    const notes = String(e.notes ?? "").trim(), tempo = String(e.tempo ?? "").trim();
    if (notes.length > 250 || tempo.length > 40) fail("Notes or tempo are too long.");
    const log = { id: existingIndex >= 0 ? next.logs[existingIndex].id : makeId(), date, templateId, exerciseIndex, exerciseName: exercise.name, muscle: exercise.muscle, set: i + 1, kg, reps, rpe, rest, notes, tempo };
    if (existingIndex >= 0) next.logs[existingIndex] = log;
    else next.logs.push(log);
    saved++;
  });
  if (!saved) fail("Tick at least one set before saving.");
  return { state: next, saved };
}
export function saveMetrics(state, date, values) {
  dateFromKey(date);
  const parseOptional = (raw, label, min, max, whole = false) => raw === "" || raw == null ? null : (whole ? intRange(raw, label, min, max) : numRange(raw, label, min, max));
  const metric = { date, weight: parseOptional(values.weight, "Body weight", 1, 400), calories: parseOptional(values.calories, "Calories", 0, 15000, true), protein: parseOptional(values.protein, "Protein", 0, 600, true), sleep: parseOptional(values.sleep, "Sleep", 0, 24), recovery: parseOptional(values.recovery, "Recovery", 1, 5, true) };
  if (Object.values(metric).slice(1).every(v => v === null)) fail("Enter at least one daily measurement.");
  const next = structuredClone(state);
  const index = next.metrics.findIndex(m => m.date === date);
  if (index < 0) next.metrics.push(metric); else next.metrics[index] = metric;
  return next;
}
export function weeklyStats(state, anchorDate) {
  const dates = weekDates(anchorDate), inWeek = new Set(dates);
  const logs = state.logs.filter(l => inWeek.has(l.date));
  const sessions = new Set(logs.map(l => l.date));
  const data = dates.map(date => ({ date, volume: Math.round(logs.filter(l => l.date === date).reduce((s,l)=>s+l.kg*l.reps,0)), sets: logs.filter(l => l.date === date).length }));
  const volume = logs.reduce((s,l)=>s+l.kg*l.reps,0);
  const weekdaysPlanned = Object.values(state.assignments).filter(id => state.templates.some(t => t.id === id)).length;
  const checkins = state.metrics.filter(m => inWeek.has(m.date));
  const average = key => { const v = checkins.map(m => m[key]).filter(v => typeof v === "number"); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  return { dates, sessions: sessions.size, planned: weekdaysPlanned, sets: logs.length, volume, data, weight: average("weight"), protein: average("protein"), calories: average("calories"), sleep: average("sleep"), recovery: average("recovery") };
}
export function bestSets(state) {
  const map = new Map();
  for (const l of state.logs) {
    const old = map.get(l.exerciseName);
    if (!old || l.kg > old.kg || (l.kg === old.kg && l.reps > old.reps)) map.set(l.exerciseName, l);
  }
  return [...map.values()].sort((a,b)=>b.kg-a.kg || a.exerciseName.localeCompare(b.exerciseName));
}
export function validateBackup(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.templates) || !Array.isArray(value.logs) || !Array.isArray(value.metrics) || !value.assignments || typeof value.assignments !== "object") fail("Not a compatible FitnessPilot backup.");
  if (value.templates.length > 500 || value.logs.length > 100000 || value.metrics.length > 50000) fail("Backup exceeds supported size.");
  const tids = new Set();
  for (const t of value.templates) {
    limited(t.id, "Template ID", 140); limited(t.name, "Workout name", 60);
    intRange(t.day, "Workout weekday", 0, 6);
    if (tids.has(t.id)) fail("Backup has duplicate template IDs.");
    tids.add(t.id);
    if (!Array.isArray(t.exercises) || !t.exercises.length || t.exercises.length > 200) fail("Backup contains an invalid exercise list.");
    t.exercises.forEach(e => { limited(e.name, "Exercise name", 80); limited(e.muscle, "Muscle", 40); intRange(e.sets, "Sets", 1, 10); intRange(e.min, "Minimum reps", 1, 100); intRange(e.max, "Maximum reps", 1, 100); intRange(e.rest, "Rest seconds", 0, 600); if(e.min > e.max) fail("Backup contains inverted rep ranges."); });
  }
  for (const [d,tid] of Object.entries(value.assignments)) { intRange(d, "Assigned weekday", 0, 6); if (tid !== null && !tids.has(tid)) fail("Backup assigns a missing workout."); }
  const logKeys = new Set();
  for (const l of value.logs) {
    limited(l.id, "Log ID", 140);dateFromKey(l.date); const t=value.templates.find(t=>t.id===l.templateId);
    if (!t) fail("Backup contains a log for a missing workout.");
    intRange(l.exerciseIndex,"Exercise number",0,t.exercises.length-1);intRange(l.set,"Set number",1,t.exercises[l.exerciseIndex].sets);numRange(l.kg,"Kilograms",0,500);intRange(l.reps,"Reps",1,100);
    if (l.rpe != null) numRange(l.rpe,"RPE",1,10);
    if (l.rest != null) intRange(l.rest,"Rest",0,600);
    if (l.notes != null && (typeof l.notes !== "string" || l.notes.length > 250)) fail("Backup has invalid notes.");
    if (l.tempo != null && (typeof l.tempo !== "string" || l.tempo.length > 40)) fail("Backup has invalid tempo.");
    const k=`${l.date}|${l.templateId}|${l.exerciseIndex}|${l.set}`;
    if (logKeys.has(k)) fail("Backup contains duplicate sets.");logKeys.add(k);
  }
  const metricDays=new Set();
  for(const m of value.metrics) { dateFromKey(m.date);if(metricDays.has(m.date))fail("Backup contains duplicate check-in dates.");metricDays.add(m.date);
    for(const [key,min,max,whole] of [["weight",1,400,false],["calories",0,15000,true],["protein",0,600,true],["sleep",0,24,false],["recovery",1,5,true]])if(m[key] != null)(whole?intRange(m[key],key,min,max):numRange(m[key],key,min,max));
  }
  const rem=value.reminder;
  if(!rem) fail("Backup lacks reminder settings.");
  intRange(rem.hour,"Reminder hour",0,23);intRange(rem.minute,"Reminder minute",0,59);intRange(rem.lead,"Reminder lead",0,120);
  return structuredClone(value);
}
function icsDate(d) { const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`; }
function icsEscape(s) {return String(s).replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/[,;]/g,m=>"\\"+m);}
export function calendarICS(state, now = new Date()) {
  const { hour,minute,lead }=state.reminder;
  intRange(hour,"Hour",0,23);intRange(minute,"Minute",0,59);intRange(lead,"Lead",0,120);
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//FitnessPilot//Local Fitness Calendar//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:FitnessPilot Workouts"];
  const stamp=now.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  let count=0;
  for(let day=0;day<7;day++) {
    const t=state.templates.find(t=>t.id===state.assignments[day]); if(!t)continue;
    const next=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour,minute,0);
    next.setDate(next.getDate()+(day-((now.getDay()+6)%7)+7)%7);
    if(next <= now)next.setDate(next.getDate()+7);
    const end=new Date(next);end.setHours(end.getHours()+1);
    const name=icsEscape(`${t.name} · FitnessPilot`);
    lines.push("BEGIN:VEVENT",`UID:fitnesspilot-${day}-${count}-${now.getTime()}@local`,`DTSTAMP:${stamp}`,`DTSTART:${icsDate(next)}`,`DTEND:${icsDate(end)}`,`SUMMARY:${name}`,"RRULE:FREQ=WEEKLY",`DESCRIPTION:${icsEscape("Open FitnessPilot and log your workout.")}`,"BEGIN:VALARM","ACTION:DISPLAY",`TRIGGER:${lead===0?"PT0M":`-PT${lead}M`}`,"DESCRIPTION:Time to train","END:VALARM","END:VEVENT"); count++;
  }
  lines.push("END:VCALENDAR");
  if(!count)fail("Assign at least one workout day before exporting calendar reminders.");
  return lines.join("\r\n")+"\r\n";
}