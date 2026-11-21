import { V102_COEFFICIENTS_CSV, V102_VERSION } from './v102-data.js';
import { isV103OverlapTemplate, V103_COEFFICIENTS_CSV, V103_VERSION } from './v103-data.js';

export const V102_REGIONS = Object.freeze([
  'Chest', 'Lats', 'Upper Back', 'Front Delts', 'Side Delts', 'Rear Delts',
  'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'
]);
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const key = (day, exercise) => `${day}\u0000${exercise}`;
const blank = () => ({ direct: 0, indirect: 0, equivalents: 0 });
const emptyRegions = () => Object.fromEntries(V102_REGIONS.map(region => [region, blank()]));

// The workout parser requires workout-specific columns, so the coefficient CSV
// has its own small, strict RFC-4180 reader (including quoted exercise names).
function parseCoefficientRows(csv) {
  if (typeof csv !== 'string' || csv.length > 1_000_000) throw Error('Invalid coefficient CSV size.');
  const rows = [];
  let row = [], value = '', quoted = false, finishedQuote = false;
  csv = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i+1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; finishedQuote = true; }
      else value += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(value); value = ''; finishedQuote = false;
      if (c !== ',') {
        if (row.some(x => x.trim() !== '')) rows.push(row);
        row = [];
        if (c === '\r' && csv[i+1] === '\n') i++;
      }
    } else if (c === '"' && value === '' && !finishedQuote) { quoted = true; }
    else if (c === '"' || finishedQuote) throw Error('Malformed coefficient CSV quote.');
    else value += c;
  }
  if (quoted) throw Error('Unterminated coefficient CSV quote.');
  if (value || row.length) {
    row.push(value);
    if (row.some(x => x.trim() !== '')) rows.push(row);
  }
  if (rows.length < 2 || rows.length > 501) throw Error('Coefficient CSV must have a header and exercise rows.');
  const header = rows.shift().map(x => x.trim());
  if (new Set(header).size !== header.length) throw Error('Duplicate coefficient CSV header.');
  for (const required of ['day','exercise','prescribed_sets',...V102_REGIONS,'PT_review']) {
    if (!header.includes(required)) throw Error(`Coefficient CSV missing ${required} column.`);
  }
  return rows.map((values,i) => {
    if (values.length !== header.length) throw Error(`Coefficient CSV row ${i+2} has wrong column count.`);
    return Object.fromEntries(header.map((name,j) => [name, values[j].trim()]));
  });
}

function parseCoefficients(csv, version, exerciseCount) {
  const rows = parseCoefficientRows(csv);
  const result = new Map();
  for (const [i, row] of rows.entries()) {
    const rowNo = i + 2;
    const day = row.day;
    const name = row.exercise;
    const sets = Number(row.prescribed_sets);
    if (!DAY.includes(day) || !name || !Number.isInteger(sets) || sets < 1 || sets > 10) {
      throw Error(`${version} coefficient row ${rowNo}: invalid day, exercise or sets.`);
    }
    const weights = {};
    let primary = 0;
    for (const region of V102_REGIONS) {
      const raw = row[region];
      if (!['0', '0.5', '1'].includes(raw)) {
        throw Error(`${version} coefficient row ${rowNo}: invalid ${region} coefficient.`);
      }
      weights[region] = Number(raw);
      if (weights[region] === 1) primary++;
    }
    if (primary !== 1 || !['YES','NO'].includes(row.PT_review)) {
      throw Error(`${version} coefficient row ${rowNo}: expected one primary region and valid PT label.`);
    }
    const id = key(day, name);
    if (result.has(id)) throw Error(`${version} coefficient row ${rowNo}: duplicate exercise.`);
    result.set(id, { sets, weights, ptReview: row.PT_review === 'YES' });
  }
  if (result.size !== exerciseCount) {
    throw Error(`${version} coefficients must describe ${exerciseCount} exercises, got ${result.size}.`);
  }
  return result;
}

export function parseV102Coefficients(csv = V102_COEFFICIENTS_CSV) {
  return parseCoefficients(csv, 'V10.2', 24);
}

export function parseV103Coefficients(csv = V103_COEFFICIENTS_CSV) {
  return parseCoefficients(csv, 'V10.3', 27);
}

function validateMapping(templates, coefficients, sourceVersion, label) {
  const observed = new Set();
  const workouts = templates.filter(t => t.sourceVersion === sourceVersion);
  if (workouts.length !== 4) throw Error(`${label} source must provide four versioned workouts.`);
  for (const template of workouts) {
    const day = DAY[template.day];
    for (const exercise of template.exercises) {
      const id = key(day, exercise.name);
      const entry = coefficients.get(id);
      if (!entry || entry.sets !== exercise.sets || observed.has(id)) {
        throw Error(`${label} mapping mismatch: ${day} / ${exercise.name}.`);
      }
      if (entry.ptReview !== !!template.requiresClinicalReview) {
        throw Error(`${label} clinical-label mismatch: ${day} / ${exercise.name}.`);
      }
      observed.add(id);
    }
  }
  if (observed.size !== coefficients.size) throw Error(`${label} coefficient table has unmatched entries.`);
  return true;
}

export function validateV102Mapping(templates, coefficients = parseV102Coefficients()) {
  return validateMapping(templates, coefficients, V102_VERSION, 'V10.2');
}

export function validateV103Mapping(templates, coefficients = parseV103Coefficients()) {
  return validateMapping(templates, coefficients, V103_VERSION, 'V10.3');
}

function add(regions, weights, number) {
  for (const region of V102_REGIONS) {
    const weight = weights[region];
    if (weight === 1) regions[region].direct += number;
    else if (weight === 0.5) regions[region].indirect += number * weight;
  }
}

/** Per-region planning estimates, not additional physical working sets. */
function weeklyOverlap(state, weekMonday, matchesTemplate, coefficients) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekMonday)) throw Error('Week start must be YYYY-MM-DD.');
  const base = new Date(`${weekMonday}T12:00:00Z`);
  if (Number.isNaN(base.getTime()) || base.toISOString().slice(0, 10) !== weekMonday || base.getUTCDay() !== 1) {
    throw Error('Week start must be a valid Monday.');
  }
  const dates = Array.from({length: 7}, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0,10);
  });
  const datesSet = new Set(dates);
  const templates = new Map((state.templates || []).filter(matchesTemplate).map(t => [t.id, t]));
  const planned = emptyRegions(), logged = emptyRegions();
  let physicalPlanned = 0, physicalLogged = 0, unmapped = 0;
  // Planned counts follow the actual scheduled templates, never library membership alone.
  for (let i = 0; i < dates.length; i++) {
    const template = templates.get(state.assignments?.[i]);
    if (!template) continue;
    for (const exercise of template.exercises) {
      const entry = coefficients.get(key(DAY[template.day], exercise.name));
      if (!entry || entry.sets !== exercise.sets) {unmapped += exercise.sets;continue;}
      add(planned, entry.weights, exercise.sets);
      physicalPlanned += exercise.sets;
    }
  }
  const seen = new Set();
  for (const log of (state.logs || [])) {
    if (!datesSet.has(log.date) || log.isWarmup === true || log.kind === 'warmup') continue;
    const template = templates.get(log.templateId);
    if (!template) continue;
    const exercise = template.exercises?.[log.exerciseIndex];
    if (!exercise || !Number.isInteger(log.set) || log.set < 1 || log.set > exercise.sets) continue;
    const unique = `${log.date}|${log.templateId}|${log.exerciseIndex}|${log.set}`;
    if (seen.has(unique)) continue;
    seen.add(unique);
    const entry = coefficients.get(key(DAY[template.day], exercise.name));
    if (!entry || entry.sets !== exercise.sets) {unmapped++;continue;}
    add(logged, entry.weights, 1);
    physicalLogged++;
  }
  for (const group of [planned, logged]) {
    for (const region of V102_REGIONS) {
      group[region].equivalents = group[region].direct + group[region].indirect;
    }
  }
  return {planned, logged, physicalPlanned, physicalLogged, unmapped,
    note: 'Indirect coefficients are approximate planning weights. Count physical working sets once; no medical clearance implied.'};
}

export const isV102OverlapTemplate = template => template.sourceVersion === V102_VERSION;

export function weeklyV102Overlap(state, monday, coefficients = parseV102Coefficients()) {
  return weeklyOverlap(state, monday, isV102OverlapTemplate, coefficients);
}

export function weeklyV103Overlap(state, monday, coefficients = parseV103Coefficients()) {
  return weeklyOverlap(state, monday, isV103OverlapTemplate, coefficients);
}
