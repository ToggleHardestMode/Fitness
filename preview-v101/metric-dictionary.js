/**
 * Metric semantics registry, V1. Read-only documentation for pure selectors.
 * No localStorage access; no target activation, schema migration or user data.
 * Denominators and source identities must remain explicit in any future UI.
 */
const definitions = [
  {
    id: 'food.known_kcal.v1', label: 'Known recorded food calories', unit: 'kcal',
    grain: 'consumed food entry → local calendar day', source: 'foodDiary.entries',
    formula: 'sum(entry.kcal * entry.servings) for known kcal values',
    missing: 'null if no known-value food; unknown item count always separate',
    meaning: 'known recorded subtotal, not independently verified daily intake'
  },
  {
    id: 'food.known_protein_g.v1', label: 'Known recorded food protein', unit: 'g',
    grain: 'consumed food entry → local calendar day', source: 'foodDiary.entries',
    formula: 'sum(entry.protein * entry.servings) for known protein values',
    missing: 'null if no known protein; unknown count separate from zero',
    meaning: 'known recorded subtotal, not actual total protein consumption'
  },
  {
    id: 'checkin.calories_manual.v1', label: 'Manual daily calories', unit: 'kcal',
    grain: 'one manual check-in per local date', source: 'workoutState.metrics.calories',
    formula: 'observed user-entered daily aggregate, no item summation',
    missing: 'null for no check-in or missing calorie field',
    meaning: 'self-reported manual entry; NEVER add to food.known_kcal.v1'
  },
  {
    id: 'checkin.protein_manual.v1', label: 'Manual daily protein', unit: 'g',
    grain: 'one manual check-in per local date', source: 'workoutState.metrics.protein',
    formula: 'observed user-entered daily aggregate, no item summation',
    missing: 'null for no check-in or missing protein field',
    meaning: 'self-reported manual entry; NEVER add to food.known_protein_g.v1'
  },
  {
    id: 'weight.mean_7d.v1', label: 'Seven-day recorded average body weight', unit: 'kg',
    grain: 'one measured weight check-in per local date', source: 'workoutState.metrics.weight',
    formula: 'sum(valid weight kg) / count(valid check-ins) over seven inclusive calendar dates',
    missing: 'null when no measured weight; count is valid measurements, not seven by default',
    meaning: 'average of recorded body weight; not fat mass or body-fat change'
  },
  {
    id: 'train.saved_working_sets_week.v1', label: 'Saved working sets', unit: 'sets',
    grain: 'unique saved working set → Monday–Sunday local week', source: 'workoutState.logs/templates',
    formula: 'count unique valid working sets, including off-plan work',
    missing: 'zero = no eligible saved sets; warm-ups excluded',
    meaning: 'recorded work, not sessions completed or growth'
  },
  {
    id: 'train.kg_reps_week.v1', label: 'Recorded training load volume', unit: 'kg·reps',
    grain: 'eligible saved weight-based working set → Monday–Sunday local week',
    source: 'workoutState.logs/templates',
    formula: 'sum(entered kg * reps), each eligible set once',
    missing: 'null if no weight-based recorded sets; 0 is valid for entered 0 kg',
    meaning: 'training load arithmetic, not tonnage for timed holds or muscle gain'
  },
  {
    id: 'train.assigned_plan_progress_week.v1', label: 'Recorded assigned set progress', unit: '%',
    grain: 'assigned plan set → Monday–Sunday local week', source: 'workoutState.assignments/templates/logs',
    formula: 'min(100, round(100 * assigned saved working sets / planned working sets))',
    missing: 'null when planned working sets = 0',
    meaning: 'scheduled working-set progress, not completed training sessions'
  },
  {
    id: 'food.entry_coverage_week.v1', label: 'Days containing food entries', unit: 'days',
    grain: 'local calendar day → selected seven-day window', source: 'foodDiary.entries',
    formula: 'count unique dates with at least one saved food entry / 7 days',
    missing: 'no records means no entries; never infer no food eaten',
    meaning: 'logging coverage, not complete nutritional adherence'
  },
  {
    id: 'food.complete_day_adherence.v0', label: 'Complete-day nutrition adherence', unit: '%',
    grain: 'self-attested complete day with approved target', source: 'not collected in food diary v1',
    formula: 'UNAVAILABLE until explicit day-completeness, target selection and provenance policy exist',
    missing: 'always null under current storage contract',
    meaning: 'not an existing FitnessPilot feature; do not derive from a recorded calorie subtotal'
  }
];
export const METRIC_DICTIONARY_VERSION = 1;
export const METRIC_DICTIONARY = Object.freeze(Object.fromEntries(definitions.map(({id,...rest}) =>
  [id,Object.freeze({id,...rest,version:1})]
)));
export function metricDefinition(id) {
  const definition = METRIC_DICTIONARY[id];
  if (!definition) throw Error('Unknown metric ID.');
  return definition;
}
