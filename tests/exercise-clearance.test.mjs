import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackup, addWorkouts} from '../preview-v101/core.js';
import {recommendNextExercise} from '../preview-v101/strength-journey.js';
import {manualProgression} from '../preview-v101/manual-progression.js';
import {recordExerciseClearance, revokeExerciseClearance, activeClearance,
  validateExerciseClearances} from '../preview-v101/exercise-clearance.js';
import {clearancePanel} from '../preview-v101/exercise-clearance-ui.js';
import {addExerciseEquivalence} from '../preview-v101/exercise-equivalence.js';
import {resetTrackingData} from '../preview-v101/tracking-reset.js';

const ex = name => ({name, muscle:'Quads', sets:2, min:8, max:12, rest:90});
const ptTemplate = (id, exercises = [ex('Synthetic Lower Move')]) =>
  ({id, name:'Synthetic Lower [PT Review]', day:1, requiresClinicalReview:true, exercises});
const row = (templateId, date, set, kg, reps, rpe = 7, exerciseIndex = 0) =>
  ({id:`${templateId}-${exerciseIndex}-${date}-${set}`, date, templateId, exerciseIndex, set, kg, reps, rpe, rest:90, notes:'', tempo:''});
const observations = (date, templateId, exerciseIndex = 0, overrides = {}) => ['before', 'after', 'next_day'].map(timepoint => ({
  id:`${templateId}-${exerciseIndex}-${date}-${timepoint}`, date, timepoint, templateId, exerciseIndex, severity:0,
  tingling:false, numbness:false, functionChange:'none', location:'none', side:'none', notes:'', ...overrides}));
const clearance = (extra = {}) => ({id:'c1', templateId:'pt', exerciseIndex:0, clearedDate:'2026-10-25', clearedBy:'Synthetic Physio', ...extra});
// Two top-of-range sessions with complete observations, so a load suggestion is possible once cleared.
const build = (clearances) => ({
  version:1, templates:[ptTemplate('pt')], assignments:{},
  logs:['2026-10-30', '2026-11-01'].flatMap(d => [row('pt', d, 1, 12, 12), row('pt', d, 2, 12, 12)]),
  symptomLogs:[...observations('2026-10-30', 'pt'), ...observations('2026-11-01', 'pt')],
  metrics:[{date:'2026-11-03', recovery:5}], reminder:{hour:18, minute:30, lead:0}, progressionStepKg:2,
  ...(clearances ? {exerciseClearances:clearances} : {})
});
const choice = {date:'2026-11-03', templateId:'pt', exerciseIndex:0};
const manualInput = {date:'2026-11-03', templateId:'pt', exerciseIndex:0, set:1};
const manualState = clearances => {
  const state = build(clearances);
  state.logs = [row('pt', '2026-11-01', 1, 20, 9), row('pt', '2026-11-01', 2, 20, 9)];
  return state;
};

test('a cleared exercise progresses under the normal gates in both progression functions', () => {
  const plan = recommendNextExercise(build([clearance()]), choice);
  assert.equal(plan.status, 'load');
  assert.deepEqual(plan.targets, [{set:1, kg:14, reps:8}, {set:2, kg:14, reps:8}]);
  const manual = manualProgression(manualState([clearance()]), manualInput);
  assert.equal(manual.status, 'rep-candidate');
  assert.deepEqual(manual.candidate, {kg:20, reps:10});
});

test('uncleared, revoked and other-exercise clearances leave the exercise at pt-review', () => {
  assert.equal(recommendNextExercise(build(), choice).status, 'pt-review');
  assert.equal(manualProgression(manualState(), manualInput).status, 'pt-review');
  const revoked = [clearance({revokedDate:'2026-10-31'})];
  assert.equal(recommendNextExercise(build(revoked), choice).status, 'pt-review');
  assert.equal(manualProgression(manualState(revoked), manualInput).status, 'pt-review');
  const other = build([clearance({exerciseIndex:1})]);
  other.templates[0].exercises.push(ex('Another Synthetic Move'));
  assert.equal(recommendNextExercise(other, choice).status, 'pt-review');
  const name = build(); name.templates[0] = {...ptTemplate('pt', [ex('Synthetic Move [PT]')]), requiresClinicalReview:undefined};
  delete name.templates[0].requiresClinicalReview;
  assert.equal(recommendNextExercise(name, choice).status, 'pt-review');
  assert.notEqual(recommendNextExercise({...name, exerciseClearances:[clearance()]}, choice).status, 'pt-review');
});

test('a clearance dated after the workout date does not apply; one dated on it does', () => {
  const later = [clearance({clearedDate:'2026-11-04'})];
  assert.equal(recommendNextExercise(build(later), choice).status, 'pt-review');
  assert.equal(manualProgression(manualState(later), manualInput).status, 'pt-review');
  const same = [clearance({clearedDate:'2026-11-03'})];
  assert.equal(recommendNextExercise(build(same), choice).status, 'load');
  assert.equal(manualProgression(manualState(same), manualInput).status, 'rep-candidate');
  assert.equal(activeClearance(build(later), 'pt', 0, '2026-11-03'), null);
});

test('concerning symptoms still block a cleared exercise', () => {
  const state = build([clearance()]);
  state.symptomLogs = [...observations('2026-10-30', 'pt'), ...observations('2026-11-01', 'pt', 0, {severity:2})];
  assert.equal(recommendNextExercise(state, choice).status, 'symptom-review');
  const manual = manualState([clearance()]);
  manual.symptomLogs = observations('2026-11-01', 'pt', 0, {severity:2});
  const result = manualProgression(manual, manualInput);
  assert.equal(result.candidate, null);
  assert.match(result.reason, /symptoms or functional changes require review/);
});

test('recovery, RPE, technique, observations and set completeness still apply to a cleared exercise', () => {
  const noRecovery = build([clearance()]); noRecovery.metrics = [];
  assert.equal(recommendNextExercise(noRecovery, choice).status, 'hold');
  const hard = build([clearance()]); hard.logs.at(-1).rpe = 9;
  assert.equal(recommendNextExercise(hard, choice).status, 'hold');
  const unstable = build([clearance()]); unstable.logs.at(-1).technique = 'unstable';
  assert.equal(recommendNextExercise(unstable, choice).status, 'hold');
  const missingObs = build([clearance()]); missingObs.symptomLogs = [];
  assert.equal(recommendNextExercise(missingObs, choice).status, 'hold');
  const partial = build([clearance()]); partial.logs.pop();
  assert.match(recommendNextExercise(partial, choice).reason, /incomplete working sets/);
  const noStep = build([clearance()]); delete noStep.progressionStepKg;
  assert.equal(recommendNextExercise(noStep, choice).status, 'hold');
  const lowRecovery = manualState([clearance()]); lowRecovery.metrics = [{date:'2026-11-03', recovery:3}];
  assert.equal(manualProgression(lowRecovery, manualInput).candidate, null);
});

test('an equivalence link does not transfer clearance in either direction', () => {
  const state = build([clearance()]);
  state.templates.push(ptTemplate('pt2', [ex('Synthetic Lower Replacement')]));
  for (const d of ['2026-10-30', '2026-11-01']) state.logs.push(row('pt2', d, 1, 12, 12), row('pt2', d, 2, 12, 12));
  state.symptomLogs.push(...observations('2026-10-30', 'pt2'), ...observations('2026-11-01', 'pt2'));
  const linked = addExerciseEquivalence(state, {from:{templateId:'pt', exerciseIndex:0}, to:{templateId:'pt2', exerciseIndex:0},
    approvedDate:'2026-11-02'}, () => 'link', {confirmed:true});
  assert.equal(recommendNextExercise(linked, {...choice, templateId:'pt2'}).status, 'pt-review');
  assert.equal(manualProgression(linked, {...manualInput, templateId:'pt2'}).status, 'pt-review');
  assert.equal(recommendNextExercise(linked, choice).status, 'load');
  const reverse = {...linked, exerciseClearances:[clearance({id:'c2', templateId:'pt2'})]};
  assert.equal(recommendNextExercise(reverse, choice).status, 'pt-review');
  assert.equal(activeClearance(linked, 'pt2', 0, '2026-11-03'), null);
});

test('invalid clearance records are rejected without repair', () => {
  const bad = list => ({...build(), exerciseClearances:list});
  assert.throws(() => validateBackup(bad({})), /invalid clearance list/);
  assert.throws(() => validateBackup(bad([null])), /invalid clearance record/);
  assert.throws(() => validateBackup(bad([clearance({templateId:'nope'})])), /missing workout/);
  assert.throws(() => validateBackup(bad([clearance({exerciseIndex:4})])), /missing exercise/);
  assert.throws(() => validateBackup(bad([clearance({clearedDate:'2026-02-30'})])), /calendar date/);
  assert.throws(() => validateBackup(bad([clearance({clearedBy:'  '})])), /must name who cleared/);
  assert.throws(() => validateBackup(bad([clearance({clearedBy:'x'.repeat(81)})])), /1–80 characters/);
  assert.doesNotThrow(() => validateBackup(bad([clearance({clearedBy:'x'.repeat(80), note:'n'.repeat(200)})])));
  assert.throws(() => validateBackup(bad([clearance({note:'n'.repeat(201)})])), /at most 200/);
  assert.throws(() => validateBackup(bad([clearance({revokedDate:'2026-10-24'})])), /cannot be revoked before/);
  assert.throws(() => validateBackup(bad([clearance(), clearance({id:'c2'})])), /only one unrevoked/);
  assert.throws(() => validateBackup(bad([clearance(), clearance({revokedDate:'2026-10-26'})])), /duplicate clearance IDs/);
  assert.doesNotThrow(() => validateBackup(bad([clearance({revokedDate:'2026-10-25'}), clearance({id:'c2', clearedDate:'2026-10-26'})])));
  const original = bad([clearance({clearedBy:''})]), copy = structuredClone(original);
  assert.throws(() => validateExerciseClearances(original));
  assert.deepEqual(original, copy);
});

test('recording and revoking need confirmation, keep history, and never touch logs or the template flag', () => {
  const state = build(), before = structuredClone(state);
  const draft = {templateId:'pt', exerciseIndex:0, clearedDate:'2026-10-25', clearedBy:'  Synthetic Physio ', note:' ok '};
  assert.throws(() => recordExerciseClearance(state, draft), /explicit confirmation/);
  const recorded = recordExerciseClearance(state, draft, () => 'c1', {confirmed:true});
  assert.deepEqual(state, before);
  assert.deepEqual(recorded.exerciseClearances, [{id:'c1', templateId:'pt', exerciseIndex:0, clearedDate:'2026-10-25', clearedBy:'Synthetic Physio', note:'ok'}]);
  assert.deepEqual(recorded.logs, before.logs);
  assert.deepEqual(recorded.symptomLogs, before.symptomLogs);
  assert.deepEqual(recorded.templates, before.templates);
  assert.equal(recorded.templates[0].requiresClinicalReview, true);
  assert.throws(() => recordExerciseClearance(recorded, draft, () => 'c2', {confirmed:true}), /only one unrevoked/);
  assert.throws(() => revokeExerciseClearance(recorded, 'c1', '2026-11-02'), /explicit confirmation/);
  assert.throws(() => revokeExerciseClearance(recorded, 'c1', '2026-10-01', {confirmed:true}), /cannot be revoked before/);
  const revoked = revokeExerciseClearance(recorded, 'c1', '2026-11-02', {confirmed:true});
  assert.equal(revoked.exerciseClearances.length, 1);
  assert.equal(revoked.exerciseClearances[0].revokedDate, '2026-11-02');
  assert.equal(recommendNextExercise(revoked, choice).status, 'pt-review');
  assert.throws(() => revokeExerciseClearance(revoked, 'c1', '2026-11-03', {confirmed:true}), /already revoked/);
  assert.throws(() => revokeExerciseClearance(revoked, 'gone', '2026-11-03', {confirmed:true}), /no longer exists/);
  const again = recordExerciseClearance(revoked, {...draft, clearedDate:'2026-11-02'}, () => 'c3', {confirmed:true});
  assert.equal(again.exerciseClearances.length, 2);
});

test('the template keeps requiresClinicalReview so automatic weekday assignment still rejects it', () => {
  const state = recordExerciseClearance(build(), {templateId:'pt', exerciseIndex:0, clearedDate:'2026-10-25', clearedBy:'Synthetic Physio'}, () => 'c1', {confirmed:true});
  const added = addWorkouts({...state, templates:[], assignments:{}, logs:[], symptomLogs:[], exerciseClearances:undefined},
    [{day:2, name:'Synthetic Lower [PT Review]', requiresClinicalReview:true, exercises:[ex('Synthetic Move')]}], true, () => 'fresh');
  assert.deepEqual(added.state.assignments, {});
  assert.equal(state.templates[0].requiresClinicalReview, true);
});

test('Train panel shows who cleared it and when, with Revoke; uncleared PT exercises offer recording', () => {
  const cleared = clearancePanel(build([clearance({clearedBy:'<b>Synthetic</b>'})]), {templateId:'pt', exerciseIndex:0, date:'2026-11-03', today:'2026-11-03'});
  assert.match(cleared, /Cleared by &lt;b&gt;Synthetic&lt;\/b&gt; on 2026-10-25/);
  assert.match(cleared, /does not verify it/);
  assert.match(cleared, /data-action="clearance-revoke" data-clearance-id="c1"/);
  assert.doesNotMatch(cleared, /clearance-record/);
  const early = clearancePanel(build([clearance({clearedDate:'2026-11-04'})]), {templateId:'pt', exerciseIndex:0, date:'2026-11-03', today:'2026-11-03'});
  assert.match(early, /does not apply to a workout dated before the clearance/);
  const open = clearancePanel(build(), {templateId:'pt', exerciseIndex:0, date:'2026-11-03', today:'2026-11-03'});
  assert.match(open, /Record clinician clearance/);
  assert.match(open, /data-action="clearance-record"/);
  assert.match(open, /value="2026-11-03"/);
  const history = clearancePanel(build([clearance({revokedDate:'2026-10-31'})]), {templateId:'pt', exerciseIndex:0, date:'2026-11-03', today:'2026-11-03'});
  assert.match(history, /revoked 2026-10-31/);
  assert.match(history, /Record clinician clearance/);
  const plain = build(); plain.templates[0] = {id:'pt', name:'Synthetic Upper', day:0, exercises:[ex('Synthetic Press')]};
  assert.equal(clearancePanel(plain, {templateId:'pt', exerciseIndex:0, date:'2026-11-03', today:'2026-11-03'}), '');
});

test('backup round-trips with clearances; an old backup without the field validates unchanged', () => {
  const state = build([clearance({note:'synthetic note'}), clearance({id:'c0', clearedDate:'2026-09-01', revokedDate:'2026-09-30'})]);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))), state);
  const old = build();
  const checked = validateBackup(old);
  assert.equal(Object.hasOwn(checked, 'exerciseClearances'), false);
  assert.deepEqual(checked, old);
});

test('reset keeps clearances because they are configuration, not tracking records', () => {
  const state = build([clearance()]);
  const {nextState} = resetTrackingData(state, {apply:true});
  assert.deepEqual(nextState.exerciseClearances, state.exerciseClearances);
  assert.deepEqual(nextState.logs, []);
});
