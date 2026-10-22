import { parseCSV } from './core.js';
import { V102_COEFFICIENTS_CSV, V102_VERSION } from './v102-data.js';

export const V102_REGIONS = Object.freeze([
  'Chest', 'Lats', 'Upper Back', 'Front Delts', 'Side Delts', 'Rear Delts',
  'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'
]);
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const key = (day, exercise) => `${day}\u0000${exercise}`;
const blank = () => ({ direct: 0, indirect: 0, equivalents: 0 });
const emptyRegions = () => Object.fromEntries(V102_REGIONS.map(region => [region, blank()]));

export function parseV102Coefficients(csv = V102_COEFFICIENTS_CSV) {
  const rows = parseCSV(csv);
  const result = new Map();
  for (const [i, row] of rows.entries()) {
    const rowNo = i + 2;
    const day = row.day;
    const name = row.exercise;
    const sets = Number(row.prescribed_sets);
    if (!DAY.includes(day) || !name || !Number.isInteger(sets) || sets < 1 || sets > 10) {
      throw Error(`V10.2 coefficient row ${rowNo}: invalid day, exercise or sets.`);
    }
    const weights = {};
    let primary = 0;
    for (const region of V102_REGIONS) {
      const raw = row[region];
      if (!['0', '0.5', '1'].includes(raw)) {
        throw Error(`V10.2 coefficient row ${rowNo}: invalid ${region} coefficient.`);
      }
      weights[region] = Number(raw);
      if (weights[region] === 1) primary++;
    }
    if (primary !== 1 || !['YES','NO'].includes(row.PT_review)) {
      throw Error(`V10.2 coefficient row ${rowNo}: expected one primary region and valid PT label.`);
    }
    const id = key(day, name);
    if (result.has(id)) throw Error(`V10.2 coefficient row ${rowNo}: duplicate exercise.`);
    result.set(id, { sets, weights, ptReview: row.PT_review === 'YES' });
  }
  if (result.size !== 24) throw Error(`V10.2 coefficients must describe 24 exercises, got ${result.size}.`);
  return result;
}

export function validateV102Mapping(templates, coefficients = parseV102Coefficients()) {
  const observed = new Set();
  const workouts = templates.filter(t => t.sourceVersion === V102_VERSION);
  if (workouts.length !== 4) throw Error('V10.2 source must provide four versioned workouts.');
  for (const template of workouts) {
    const day = DAY[template.day];
    for (const exercise of template.exercises) {
      const id = key(day, exercise.name);
      const entry = coefficients.get(id);
      if (!entry || entry.sets !== exercise.sets || observed.has(id)) {
        throw Error(`V10.2 mapping mismatch: ${day} / ${exercise.name}.`);
      }
      if (entry.ptReview !== !!template.requiresClinicalReview) {
        throw Error(`V10.2 clinical-label mismatch: ${day} / ${exercise.name}.`);
      }
      observed.add(id);
    }
  }
  if (observed.size !== coefficients.size) throw Error('V10.2 coefficient table has unmatched entries.');
  return true;
}

function add(regions, weights, number) {
  for (const region of V102_REGIONS) {
    const weight = weights[region];
    if (weight === 1) regions[region].direct += number;
    else if (weight === 0.5) regions[region].indirect += number * weight;
  }
}

/** Per-region planning estimates, not additional physical working sets. */
export function weeklyV102Overlap(state, weekMonday, coefficients = parseV102Coefficients()) {
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
  const templates = new Map((state.templates || []).map(t => [t.id, t]));
  const planned = emptyRegions(), logged = emptyRegions();
  let physicalPlanned = 0, physicalLogged = 0, unmapped = 0;
  // Planned counts follow the actual scheduled templates, never library membership alone.
  for (let i = 0; i < dates.length; i++) {
    const template = templates.get(state.assignments?.[i]);
    if (!template || template.sourceVersion !== V102_VERSION) continue;
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
    if (!template || template.sourceVersion !== V102_VERSION) continue;
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
