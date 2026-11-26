import { esc } from './html.js';
import { resetTrackingData } from './tracking-reset.js';
import { addSymptomEntry } from './symptom-journal.js';
import { V101_CSV, V101_VERSION, V101_EQUIPMENT } from './v101-data.js';
import { V102_CSV, V102_VERSION, V102_EQUIPMENT } from './v102-data.js';
import { V103_CSV, v103Templates } from './v103-data.js';
import { focusEntries, nextPendingSet, nextPendingExercise } from './focus-mode.js';
import { newlyRecordedSets } from './slime-hit.js';
import { WALKER_KEY, validateWalkerFile, validateWalkerDataUrl } from './dashboard-walker.js';
import { applyWalkerFile, checkWalkerImage, readWalkerDataUrl } from './dashboard-walker-apply.js';
import { createWalkerStill } from './walker-still.js';
import { stepReps, chooseRpe } from './focus-quick-entry.js';
import { createFloatingRestTimer, restClock } from './floating-rest.js';
import { repeatLastSessionSet } from './quick-repeat.js';
import { createExerciseVersion } from './template-version.js';
import { generateOneSetCoverage } from './return-coverage.js';
import { workoutLogbookCsv } from './workout-logbook.js';
import { mondayOf, shiftWeek, latestLoggedWeek } from './week-window.js';
import { setActiveSets } from './active-sets.js';
import { recordExerciseClearance, revokeExerciseClearance } from './exercise-clearance.js';
import { addExerciseEquivalence, removeExerciseEquivalence, linkCandidates } from './exercise-equivalence.js';
import { readCsvBatch } from './batch-import.js';
import { inspectWorkoutFiles, resolveWorkoutFiles } from './workout-import-review.js';
import { applyCompletedCsv, blankCompletedCsv } from './completed-workout-csv.js';
import { verifyLocalSnapshot, inspectBackupFileText } from './recovery-check.js';
import {
  markWorkoutBackupChecked,
  persistentStorageStatus,
  requestPersistentStorage
} from './backup-reminder.js';
import { loadWorkoutState, saveWorkoutState } from './state.js';
import {
  DAYS,
  DAY_NAMES,
  STORAGE_KEY,
  emptyState,
  isHistoricalWorkout,
  STARTER_CSV,
  parseWorkouts,
  addWorkouts,
  recordSets,
  saveMetrics,
  dateFromKey,
  weekdayOf,
  calendarICS,
  validateBackup,
  intRange,
  RECOVERY_UL_CSV,
  UNIFIED_UL_CSV
} from './core.js';

export function createActions({ render, today, isPTReview }) {
  const $ = (selector) => document.querySelector(selector);

  let resetBackupReady = false;
  let storagePersistenceStatusLabel = 'Checking browser storage…',
    storagePersistenceRequestPending = false;
  let walkerDataUrl = null,
    pendingWalkerFile = null;
  try {
    const savedWalker = localStorage.getItem(WALKER_KEY);
    if (savedWalker) walkerDataUrl = validateWalkerDataUrl(savedWalker);
  } catch {
    /* Cosmetic avatar falls back; workout records stay untouched. */
  }

  let { state, storageError } = loadWorkoutState();
  let page = 'dashboard',
    activeDate = today(),
    chosenTemplate = null,
    chosenExercise = 0,
    pendingWorkouts = null,
    pendingBackup = null;
  let focusMode = false,
    focusSet = 0,
    customizing = null,
    pendingReturnStage = null,
    pendingV103 = null;
  let strengthJourneyIndex = 0;
  let selectedWeekStart = null; // UI-only; null always follows the current week.
  let strengthViewMetric = 'load',
    strengthHistoryFilter = 'all';
  let pendingCompletedCsv = null,
    pendingCompletedSnapshot = null;
  let completedRead = 0, pendingCompletedReview = null, completedReviewInput = null;
  let toastHandle = null;
  const SLIME_HIT_SETTING = 'fitnesspilot.preview.v101.ui.slime-hit.v1';
  let slimeHitEnabled = false,
    slimeHitTimer = null;
  try {
    slimeHitEnabled = localStorage.getItem(SLIME_HIT_SETTING) === 'on';
  } catch {
    /* optional visual feedback stays off */
  }
  function showSlimeHit() {
    if (!slimeHitEnabled) return;
    const host = $('#slime-hit-root');
    if (!host) return;
    const effect = document.createElement('div');
    effect.className = 'slime-hit-card';
    effect.innerHTML =
      '<img class="slime-hit-art" src="./slime-hit.svg" alt=""><span class="slime-hit-spark" aria-hidden="true">✦</span>' +
        '<span><strong class="slime-hit-title">Slime hit!</strong><small class="slime-hit-note">New working set saved</small></span>';
    clearTimeout(slimeHitTimer);
    host.replaceChildren(effect);
    slimeHitTimer = setTimeout(() => {
      if (effect.parentNode === host) effect.remove();
    }, 1500);
  }
  function toast(msg, error = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', error);
    el.classList.add('on');
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => el.classList.remove('on'), 3600);
  }
  function commit(next, message) {
    state = saveWorkoutState(next, storageError);
    resetBackupReady = false;
    pendingReturnStage = null;
    pendingV103 = null;
    render();
    if (message) toast(message);
  }
  function tryAction(fn) {
    try {
      fn();
    } catch (error) {
      toast(error.message || 'Operation failed.', true);
    }
  }
  function goto(next) {
    page = next;
    render();
    $('#main').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function startWalkerApply() {
    if (!pendingWalkerFile) throw Error('Choose a WebP file first.');
    const file = validateWalkerFile(pendingWalkerFile);
    if (!confirm('Apply this character on this device?')) return;
    applyWalkerFile(file, localStorage, readWalkerDataUrl, checkWalkerImage)
      .then((data) => {
        walkerDataUrl = data;
        pendingWalkerFile = null;
        render();
        toast('Walking avatar applied.');
      })
      .catch((error) => toast(error.message, true));
  }

  const v101Templates = () =>
    parseWorkouts(V101_CSV).map((w) => ({
      ...w,
      sourceVersion: V101_VERSION,
      equipmentNote: V101_EQUIPMENT,
      requiresClinicalReview: !!w.requiresClinicalReview
    }));
  const V102_ARMS = {
    'Incline DB Supinating Curl (SS1)': 'Biceps',
    'Lying DB Triceps Extension (SS1)': 'Triceps',
    'DB Hammer Curl (SS1)': 'Biceps',
    'Supported DB Overhead Triceps Ext (SS1)': 'Triceps'
  };
  const v102Templates = () =>
    parseWorkouts(V102_CSV).map((t) => ({
      ...t,
      sourceVersion: V102_VERSION,
      equipmentNote: V102_EQUIPMENT,
      requiresClinicalReview: !!t.requiresClinicalReview,
      exercises: t.exercises.map((e) => ({
        ...e,
        ...(V102_ARMS[e.name] ? { muscleDetail: V102_ARMS[e.name] } : {}),
        ...(e.repUnit === 'seconds_per_side' && e.sourceNote
          ? {
              sourceNote: e.sourceNote.replace(
                'app cannot store timed holds',
                'record seconds per side; timed holds are excluded from lifting volume'
              )
            }
          : {})
      }))
    }));

  function selectFocusSet() {
    const exercise = state.templates.find((t) => t.id === chosenTemplate)?.exercises[chosenExercise];
    const next = exercise
      ? nextPendingSet(state.logs, activeDate, chosenTemplate, chosenExercise, exercise.sets)
      : -1;
    focusSet = next < 0 ? 0 : next;
  }
  function mayLeaveFocusSet() {
    const form = focusMode ? $('#sets-form') : null;
    if (!form) return true;
    const dirty = Array.from(form.querySelectorAll('input,select')).some((input) =>
      input.type === 'checkbox'
        ? input.checked !== input.defaultChecked
        : input.tagName === 'SELECT'
          ? input.value !== (input.querySelector('option[selected]')?.value ?? input.options[0]?.value ?? '')
          : input.value !== input.defaultValue
    );
    return !dirty || confirm('Discard your unsaved set changes?');
  }

  function trainOptions() {
    const day = weekdayOf(activeDate);
    const selected =
      chosenTemplate && state.templates.some((t) => t.id === chosenTemplate && !isHistoricalWorkout(t))
        ? chosenTemplate
        : state.assignments[day] || '';
    chosenTemplate = selected;
    const workout = state.templates.find((t) => t.id === selected);
    if (workout) {
      chosenExercise = Math.min(chosenExercise, workout.exercises.length - 1);
      if (focusMode) {
        focusSet = Math.min(Math.max(0, focusSet), workout.exercises[chosenExercise].sets - 1);
      }
    }
    return { activeDate, day, selected, workout, chosenExercise, focusMode, focusSet, pendingCompletedCsv, pendingCompletedReview };
  }

  function viewOptions() {
    if (page === 'dashboard') {
      return {
        selectedWeekStart,
        strengthJourneyIndex,
        strengthViewMetric,
        strengthHistoryFilter,
        walkerDataUrl
      };
    }
    if (page === 'train') return trainOptions();
    if (page === 'plan') return { pendingWorkouts, pendingReturnStage, pendingV103, customizing };
    return { pendingBackup, resetBackupReady, storagePersistenceStatusLabel, walkerDataUrl, slimeHitEnabled };
  }

  function timerRemaining() {
    return restClock(floatingRest.getRemaining());
  }
  function inspectWalkerDisplay() {
    const image = $('.fp-walker-sprite');
    const status = $('#walker-render-status');
    if (!image || !status) return;
    const generic = './adventurer-idle.svg';
    const selected = walkerDataUrl;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    // Exactly one visible <img>. Preload replacement off-DOM; never stack a second body.
    function useAvatar(src, successLabel) {
      const probe = new Image();
      const current = () => image.isConnected && walkerDataUrl === selected;
      probe.onload = () => {
        if (!current()) return;
        image.onload = () => {
          if (current()) status.textContent = successLabel;
        };
        image.onerror = () => {
          if (!current()) return;
          image.onload = null;
          image.onerror = null;
          image.src = generic;
          status.textContent = 'Personal image could not be displayed; default character shown.';
        };
        image.src = src;
        if (image.complete && image.naturalWidth > 0) status.textContent = successLabel;
      };
      probe.onerror = () => {
        if (!current()) return;
        image.src = generic;
        status.textContent = 'Personal image could not be displayed; default character shown.';
      };
      probe.src = src;
    }
    if (!selected) {
      status.textContent = 'Default adventurer displayed';
      return;
    }
    if (reduced) {
      status.textContent = 'Reduce Motion: preparing one still frame of your character…';
      createWalkerStill(selected)
        .then((png) => {
          if (!image.isConnected || walkerDataUrl !== selected) return;
          useAvatar(png, 'Your character (still frame). Turn on animations to see walking.');
        })
        .catch(() => {
          if (!image.isConnected || walkerDataUrl !== selected) return;
          image.src = generic;
          status.textContent = 'Personal still could not be created; default character shown.';
        });
      return;
    }
    status.textContent = 'Loading one walking character…';
    useAvatar(selected, 'Personal walker loaded: walking in place toward the right.');
  }
  async function refreshPersistentStorageStatus() {
    const result = await persistentStorageStatus(navigator.storage);
    const labels = {
      granted: 'Persistent storage: Granted by this browser.',
      'not-granted': 'Persistent storage: Not granted.',
      unsupported: 'Persistent storage status: Not supported by this browser.',
      failed: 'Persistent storage status: Could not be checked.'
    };
    storagePersistenceStatusLabel = labels[result];
    const status = $('#storage-persistence-status');
    if (status) status.textContent = storagePersistenceStatusLabel;
  }

  function download(filename, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function readCompletedCsv(files) {
    const read = ++completedRead;
    pendingCompletedReview = null;
    completedReviewInput = null;
    pendingCompletedCsv = null;
    pendingCompletedSnapshot = null;
    render();
    try {
      if (storageError) throw Error('Saved workout history is locked; CSV import is disabled.');
      const original = localStorage.getItem(STORAGE_KEY);
      const baseline = original === null ? emptyState() : validateBackup(JSON.parse(original));
      if (JSON.stringify(baseline) !== JSON.stringify(state))
        throw Error('Workout history changed in another tab. Reload before importing.');
      const input = await readCsvBatch(files, 'workout');
      if (read !== completedRead) return;
      if (localStorage.getItem(STORAGE_KEY) !== original)
        throw Error('Workout history changed while reading files. Reload and choose them again.');
      pendingCompletedSnapshot = original;
      const review = inspectWorkoutFiles(baseline, input);
      pendingCompletedReview = review;
      completedReviewInput = review;
      if (review.every(file => file.choice === 'exact' && !file.hasNotes)) {
        try {
          pendingCompletedCsv = resolveWorkoutFiles(baseline, review);
          pendingCompletedReview = null;
        } catch (error) { toast(error.message, true); }
      }
      render();
      toast(pendingCompletedReview ? 'Review file identities and notes before importing.' :
        'Completed workout review ready. Nothing saved yet.');
    } catch (error) {
      if (read !== completedRead) return;
      pendingCompletedCsv = null;
      pendingCompletedSnapshot = null;
      render();
      toast(error.message, true);
    }
  }
  async function readCSV(file) {
    if (!file || file.size > 1_000_000) throw Error('Choose a CSV smaller than 1 MB.');
    if (!/\.csv$/i.test(file.name)) throw Error('Choose a .csv file exported from Excel.');
    pendingWorkouts = parseWorkouts(await file.text());
    render();
    toast(`Ready to review ${pendingWorkouts.length} workout(s).`);
  }
  async function readBackup(file) {
    if (!file || file.size > 8_000_000) throw Error('Choose a JSON backup smaller than 8 MB.');
    if (!/\.json$/i.test(file.name)) throw Error('Choose a .json FitnessPilot backup.');
    pendingBackup = null;
    pendingBackup = validateBackup(JSON.parse(await file.text()));
    render();
    toast('Backup preview ready. No records replaced.');
  }

  function handleClick(event) {
    const button = event.target.closest(
      '[data-page],[data-exercise],[data-action],[data-rest],[data-focus-set],[data-template-edit]'
    );
    if (!button) return;
    if (button.dataset.page) {
      if (button.dataset.page === page) return;
      if (!mayLeaveFocusSet()) return;
      goto(button.dataset.page);
      return;
    }
    if (button.dataset.exercise !== undefined) {
      const next = Number(button.dataset.exercise);
      if (next === chosenExercise) return;
      if (!mayLeaveFocusSet()) return;
      chosenExercise = next;
      selectFocusSet();
      render();
      return;
    }
    if (button.dataset.focusSet !== undefined) {
      const next = Number(button.dataset.focusSet);
      const ex = state.templates.find((t) => t.id === chosenTemplate)?.exercises[chosenExercise];
      if (Number.isInteger(next) && ex && next >= 0 && next < ex.sets) {
        if (next === focusSet) return;
        if (!mayLeaveFocusSet()) return;
        focusSet = next;
        render();
      }
      return;
    }
    if (button.dataset.templateEdit !== undefined) {
      tryAction(() => {
        const id = button.dataset.templateEdit,
          index = Number(button.dataset.exerciseEdit);
        const template = state.templates.find((t) => t.id === id);
        if (!template || !Number.isInteger(index) || !template.exercises[index])
          throw Error('Choose a saved workout exercise.');
        customizing = { id, index };
        render();
        document
          .getElementById('template-version-form')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    if (button.dataset.rest) {
      tryAction(() => {
        const seconds = intRange(button.dataset.rest, 'Rest', 1, 600);
        floatingRest.start(seconds);
        toast(`Rest timer started: ${seconds} seconds.`);
      });
      return;
    }
    const act = button.dataset.action;
    tryAction(() => {
      if (act === 'open-scheduled-workout' || act === 'open-today-workout') {
        if (page !== 'dashboard' || !mayLeaveFocusSet()) return;
        const scheduled = act === 'open-scheduled-workout';
        const date = scheduled ? button.dataset.workoutDate : today();
        dateFromKey(date);
        const id = scheduled ? button.dataset.workoutId : state.assignments[weekdayOf(date)] || '';
        if (scheduled && (date < today() || state.assignments[weekdayOf(date)] !== id ||
          !state.templates.some(t => t.id === id))) throw Error('Workout assignment changed. Open Dashboard again.');
        activeDate = date;
        chosenTemplate = id || null;
        chosenExercise = 0;
        focusSet = 0;
        if (chosenTemplate) selectFocusSet();
        goto('train');
        if (!scheduled) $('#active-workout')?.focus();
        return;
      }
      if (['week-prev', 'week-next', 'week-current', 'week-latest'].includes(act)) {
        if (act === 'week-current') selectedWeekStart = null;
        else if (act === 'week-latest') {
          const recent = latestLoggedWeek(state);
          if (!recent) throw Error('No saved working sets found in this preview yet.');
          selectedWeekStart = recent;
        } else
          selectedWeekStart = shiftWeek(selectedWeekStart || mondayOf(today()), act === 'week-prev' ? -1 : 1);
        render();
        return;
      }
      if (act === 'return-stage-cancel') {
        pendingReturnStage = null;
        render();
        return;
      }
      if (act === 'return-stage-save') {
        if (storageError) throw Error('Saved data is locked; return-to-training templates cannot be added.');
        const pending = pendingReturnStage;
        if (!pending) throw Error('Preview a Coverage-First plan first.');
        if (localStorage.getItem(STORAGE_KEY) !== pending.snapshot) {
          pendingReturnStage = null;
          render();
          throw Error('Saved data changed since your preview. Review the stage again.');
        }
        const sources = pending.ids.filter(Boolean).map((id) => state.templates.find((t) => t.id === id));
        const selected = generateOneSetCoverage(sources);
        const out = addWorkouts(state, selected.workouts, false);
        if (!out.added) {
          toast('These return-to-training templates are already in your library. Nothing changed.');
          return;
        }
        const stageName = `Coverage-First, one set per upper exercise (${selected.percentage}% of eligible upper-body sets)`;
        if (
          !confirm(
            `Add ${out.added} NEW ${stageName} workout templates? The original workouts, schedule and completed sets remain unchanged. ` +
              `No stage or load advances automatically.`
          )
        )
          return;
        pendingReturnStage = null;
        commit(
          out.state,
          `Added ${out.added} return-to-training templates: ${stageName}. Assign days manually in Plan.`
        );
        return;
      }
      if (act === 'cancel-customize') {
        customizing = null;
        render();
        return;
      }
      if (act === 'equivalence-link') {
        const choice = $('#equivalence-candidate')?.value || '';
        const [tIndex, eIndex] = choice.split(':').map(Number);
        const earlier = state.templates[tIndex];
        if (!choice || !earlier || !Number.isInteger(eIndex) || !earlier.exercises[eIndex])
          throw Error('Choose an earlier exercise to link.');
        const here = state.templates.find((t) => t.id === chosenTemplate)?.exercises[chosenExercise];
        if (!here) throw Error('Choose an exercise first.');
        if (
          !linkCandidates(state, chosenTemplate, chosenExercise).some(
            (c) => c.templateId === earlier.id && c.exerciseIndex === eIndex
          )
        )
          throw Error('That exercise cannot be linked here.');
        if (
          !confirm(
            `Link "${earlier.exercises[eIndex].name}" (${earlier.name}) as earlier history of "${here.name}"? ` +
              `Its sets will appear on this exercise's Strength Journey chart and as a starting-weight reference only. ` +
              `Progression still uses only this exercise's own sessions. No saved sets are changed.`
          )
        )
          return;
        commit(
          addExerciseEquivalence(
            state,
            {
              from: { templateId: earlier.id, exerciseIndex: eIndex },
              to: { templateId: chosenTemplate, exerciseIndex: chosenExercise },
              approvedDate: today()
            },
            undefined,
            { confirmed: true }
          ),
          'Earlier history linked. No saved sets were changed.'
        );
        return;
      }
      if (act === 'active-sets-change') {
        const here = state.templates.find((t) => t.id === chosenTemplate)?.exercises[chosenExercise];
        if (!here) throw Error('Choose an exercise first.');
        const count = intRange($('#active-sets-count')?.value, 'Active sets', 1, here.sets);
        if (
          !confirm(
            `Do ${count} of ${here.sets} planned sets of "${here.name}" for now? ` +
              `You are setting this yourself; the app never changes it. ` +
              `Saved sets stay exactly as they are, and next-session targets will compare against ${count} set(s).`
          )
        )
          return;
        commit(
          setActiveSets(
            state,
            { templateId: chosenTemplate, exerciseIndex: chosenExercise, count },
            { confirmed: true }
          ),
          `Active sets saved: ${count} of ${here.sets}. No saved sets were changed.`
        );
        return;
      }
      if (act === 'clearance-record') {
        const here = state.templates.find((t) => t.id === chosenTemplate)?.exercises[chosenExercise];
        if (!here) throw Error('Choose an exercise first.');
        const clearedBy = $('#clearance-by')?.value ?? '',
          clearedDate = $('#clearance-date')?.value ?? '',
          note = $('#clearance-note')?.value ?? '';
        dateFromKey(clearedDate);
        if (clearedDate > today()) throw Error('Clearance date cannot be in the future.');
        if (!clearedBy.trim()) throw Error('Enter who gave the clearance.');
        if (
          !confirm(
            `You are recording a clearance that a clinician (${clearedBy.trim()}) gave you on ${clearedDate} ` +
              `for "${here.name}". FitnessPilot does not verify this and it is not medical advice. ` +
              `Progression suggestions for this exercise will then follow the normal symptom, recovery and effort checks. Record it?`
          )
        )
          return;
        commit(
          recordExerciseClearance(
            state,
            { templateId: chosenTemplate, exerciseIndex: chosenExercise, clearedDate, clearedBy, note },
            undefined,
            { confirmed: true }
          ),
          'Clearance recorded as given by a clinician. Not verified by the app. No saved sets were changed.'
        );
        return;
      }
      if (act === 'clearance-revoke') {
        const id = button.dataset.clearanceId;
        if (
          !confirm(
            'Revoke this clearance? The exercise returns to [PT Review] reference-only status. ' +
              'The record stays visible as revoked; no saved sets are changed.'
          )
        )
          return;
        commit(
          revokeExerciseClearance(state, id, today(), { confirmed: true }),
          'Clearance revoked. No saved sets were changed.'
        );
        return;
      }
      if (act === 'equivalence-unlink') {
        const id = button.dataset.linkId;
        if (!confirm('Remove this link? Only the link is removed; all saved sets stay exactly as they are.'))
          return;
        commit(
          removeExerciseEquivalence(state, id, { confirmed: true }),
          'Link removed. No saved sets were changed.'
        );
        return;
      }
      if (act === 'quick-reps-minus' || act === 'quick-reps-plus' || act === 'quick-rpe') {
        if (!focusMode) throw Error('Switch to Focus Mode for quick entry.');
        const form = $('#sets-form');
        if (!form) throw Error('The current set form is unavailable.');
        if (act === 'quick-rpe') {
          const input = form.elements[`rpe${focusSet}`];
          if (!input) throw Error('The current RPE field is unavailable.');
          input.value = chooseRpe(button.dataset.quickRpe);
        } else {
          const input = form.elements[`reps${focusSet}`];
          if (!input) throw Error('The current reps field is unavailable.');
          input.value = stepReps(input.value, act === 'quick-reps-plus' ? 1 : -1);
        }
        return; // No commit; the existing Save this set is still required.
      }
      if (act === 'focus-repeat') {
        if (!focusMode) throw Error('Switch to Focus Mode first.');
        const choice = repeatLastSessionSet(state, {
          date: activeDate,
          templateId: chosenTemplate,
          exerciseIndex: chosenExercise,
          set: focusSet + 1
        });
        if (!choice) throw Error('No eligible earlier saved set to copy.');
        const form = $('#sets-form');
        if (!form) throw Error('The current set form is unavailable.');
        const kg = form.elements[`kg${focusSet}`],
          reps = form.elements[`reps${focusSet}`];
        if (!kg || !reps) throw Error('Weight/reps fields are unavailable.');
        const edited = kg.value !== kg.defaultValue || reps.value !== reps.defaultValue;
        if (edited && !confirm('Replace your unsaved weight and reps with the previously saved set?')) return;
        kg.value = String(choice.kg);
        reps.value = String(choice.reps);
        toast(
          `Copied saved set ${choice.sourceSet}. Check actual weight and reps, enter today's RPE, then save.`
        );
        return;
      }
      if (act === 'focus-toggle') {
        if (!mayLeaveFocusSet()) return;
        focusMode = !focusMode;
        if (focusMode) selectFocusSet();
        render();
        return;
      }
      if (act === 'v103-preview') {
        if (storageError) throw Error('Saved data is locked. V10.3 import preview cannot continue.');
        pendingV103 = { workouts: v103Templates(), snapshot: localStorage.getItem(STORAGE_KEY) };
        render();
        document.getElementById('v103-import')?.scrollIntoView({ block: 'start' });
        return;
      }
      if (act === 'v103-apply') {
        if (storageError) throw Error('Saved data is locked. Cannot import V10.3.');
        const pending = pendingV103;
        if (!pending) throw Error('Preview the V10.3 import before confirming.');
        if (localStorage.getItem(STORAGE_KEY) !== pending.snapshot) {
          pendingV103 = null;
          render();
          throw Error('Saved workout data changed after your V10.3 preview. Preview it again.');
        }
        const out = addWorkouts(state, pending.workouts, false);
        if (!out.added) {
          pendingV103 = null;
          render();
          toast('V10.3 templates are already in your library. Nothing changed.');
          return;
        }
        if (
          !confirm(
            `Add ${out.added} V10.3 workout templates and skip ${out.skipped} existing? ` +
              `This will NOT assign days, clear PT review or modify completed workouts.`
          )
        )
          return;
        commit(
          out.state,
          `Added ${out.added} V10.3 templates; skipped ${out.skipped} already present. Assign eligible days manually in Plan.`
        );
        return;
      }
      if (act === 'v103-cancel') {
        pendingV103 = null;
        render();
        return;
      }
      if (act === 'v103-csv') {
        download('V10.3_Home_FitnessPilot_Import.csv', V103_CSV, 'text/csv;charset=utf-8');
        return;
      }
      if (act === 'v102-add') {
        const result = addWorkouts(state, v102Templates(), false);
        if (result.added)
          commit(
            result.state,
            `Added ${result.added} V10.2 templates. Existing saved sets and schedule are unchanged.`
          );
        else toast('V10.2 templates already in the test library.');
      }
      if (act === 'v102-csv')
        download('V10.2_Home_FitnessPilot_Import.csv', V102_CSV, 'text/csv;charset=utf-8');
      if (act === 'v101-add') {
        const out = addWorkouts(state, v101Templates(), false);
        if (out.added)
          commit(
            out.state,
            `Added ${out.added} V10.1 templates. Your schedule and workout history are unchanged.`
          );
        else toast('V10.1 templates already present. No duplicates added.');
      }
      if (act === 'v101-csv')
        download('V10.1_Home_FitnessPilot_Import.csv', V101_CSV, 'text/csv;charset=utf-8');
      if (act === 'starter') {
        if (!confirm('Add the example four-day workout plan? Existing logs will not change.')) return;
        const out = addWorkouts(state, parseWorkouts(STARTER_CSV), true);
        commit(out.state, `Added ${out.added} workout templates.`);
      }
      if (act === 'completed-csv-blank') {
        if (!chosenTemplate) throw Error('Select a workout in Train first.');
        download(
          'FitnessPilot-completed-session-' + activeDate + '.csv',
          blankCompletedCsv(state, activeDate, chosenTemplate),
          'text/csv;charset=utf-8'
        );
        toast('Blank completed-session CSV downloaded. Fill actual kg/reps, then import it here.');
        return;
      }
      if (act === 'completed-csv-pick') {
        $('#completed-workout-file').click();
        return;
      }
      if (act === 'completed-csv-backup') {
        if (storageError) throw Error('Saved data is locked. Cannot back up before import.');
        download(
          'FitnessPilot-PREVIEW-before-session-import-' + today() + '.json',
          JSON.stringify(state, null, 2) + '\n',
          'application/json'
        );
        toast('Backup prepared. Verify it is saved before ticking confirmation.');
        return;
      }
      if (act === 'completed-csv-cancel') {
        completedRead++;
        pendingCompletedReview = null;
        completedReviewInput = null;
        pendingCompletedCsv = null;
        pendingCompletedSnapshot = null;
        render();
        return;
      }
      if (act === 'completed-csv-reopen') {
        if (!completedReviewInput || localStorage.getItem(STORAGE_KEY) !== pendingCompletedSnapshot)
          throw Error('Choose the files again; saved history may have changed.');
        pendingCompletedReview = completedReviewInput;
        pendingCompletedCsv = null;
        render();
        return;
      }
      if (act === 'completed-csv-resolve') {
        if (storageError || !pendingCompletedReview) throw Error('Choose completed CSV files first.');
        if (localStorage.getItem(STORAGE_KEY) !== pendingCompletedSnapshot)
          throw Error('Workout history changed. Reload before reviewing the files.');
        const reviewed = pendingCompletedReview.map((file, i) => ({
          ...file, choice: $('#completed-review-choice-' + i).value,
          text: $('#completed-review-text-' + i).value
        }));
        if (!$('#completed-review-ack')?.checked)
          throw Error('Confirm the actual exercise names, notes and measurements first.');
        const baseline = pendingCompletedSnapshot === null ? emptyState() : validateBackup(JSON.parse(pendingCompletedSnapshot));
        pendingCompletedCsv = resolveWorkoutFiles(baseline, reviewed);
        completedReviewInput = reviewed;
        pendingCompletedReview = null;
        render();
        toast('Resolved batch ready. Nothing saved yet.');
        return;
      }
      if (act === 'completed-csv-apply') {
        if (storageError) throw Error('Saved data is locked. Import refused.');
        if (!pendingCompletedCsv || !pendingCompletedCsv.add.length)
          throw Error('Preview a CSV with new completed sets first.');
        if (!$('#completed-import-backup-ack')?.checked)
          throw Error('Save and acknowledge a current JSON backup before applying.');
        if (localStorage.getItem(STORAGE_KEY) !== pendingCompletedSnapshot) {
          pendingCompletedCsv = null;
          pendingCompletedSnapshot = null;
          render();
          throw Error('Workout history changed since CSV preview. Choose the CSV again and recheck.');
        }
        if (
          !confirm(
            'Add ' +
              pendingCompletedCsv.add.length +
              ' actual completed sets and ' + (pendingCompletedCsv.historical?.length || 0) +
              ' historical workout(s)? No existing sets or plans will be replaced.'
          )
        )
          return;
        if (localStorage.getItem(STORAGE_KEY) !== pendingCompletedSnapshot) {
          pendingCompletedCsv = null;
          pendingCompletedSnapshot = null;
          render();
          throw Error('Workout history changed during confirmation. Reload and review the files again.');
        }
        const count = pendingCompletedCsv.add.length;
        const baseline = pendingCompletedSnapshot === null ? emptyState() : validateBackup(JSON.parse(pendingCompletedSnapshot));
        baseline.templates.push(...(pendingCompletedCsv.historical || []));
        const next = applyCompletedCsv(validateBackup(baseline), pendingCompletedCsv);
        commit(next, 'Imported ' + count + ' completed working sets; saved history preserved.');
        pendingCompletedCsv = null;
        pendingCompletedSnapshot = null;
        completedReviewInput = null;
        render();
        return;
      }
      if (act === 'pick-csv') $('#csv-file').click();
      if (act === 'cancel-csv') {
        pendingWorkouts = null;
        render();
      }
      if (act === 'confirm-csv') {
        if (!pendingWorkouts) throw Error('Choose a CSV first.');
        const out = addWorkouts(state, pendingWorkouts);
        pendingWorkouts = null;
        commit(out.state, `Imported ${out.added}; skipped ${out.skipped} identical template(s).`);
      }
      if (act === 'latest-ul') {
        const result = addWorkouts(state, parseWorkouts(RECOVERY_UL_CSV));
        if (result.added)
          commit(
            result.state,
            `Added ${result.added} Recovery UL templates. Assign them in the schedule above.`
          );
        else toast('Recovery UL templates already in your library. No duplicates added.');
      }
      if (act === 'latest-ul-csv')
        download('Recovery-Optimized-UL.csv', RECOVERY_UL_CSV + '\r\n', 'text/csv;charset=utf-8');
      if (act === 'unified-ul') {
        const result = addWorkouts(state, parseWorkouts(UNIFIED_UL_CSV));
        if (result.added)
          commit(result.state, `Added ${result.added} Unified UL templates. Assign them in Plan.`);
        else toast('Unified UL templates already added; no duplicates.');
      }
      if (act === 'unified-ul-csv')
        download('Recovery-Optimized-UL-Unified.csv', UNIFIED_UL_CSV + '\r\n', 'text/csv;charset=utf-8');
      if (act === 'example-csv')
        download('UpperLower-4-Day.csv', STARTER_CSV + '\r\n', 'text/csv;charset=utf-8');
      if (act === 'tracking-reset-apply') {
        if (storageError) throw Error('Stored data is locked; do not reset it.');
        if (!resetBackupReady) throw Error('First download and check a matching current backup in Tools.');
        if (!$('#tracking-reset-ack')?.checked) throw Error('Confirm that the backup was saved and checked.');
        if ($('#tracking-reset-word')?.value !== 'RESET LOGS')
          throw Error('Type RESET LOGS exactly to confirm.');
        if (localStorage.getItem(STORAGE_KEY) !== JSON.stringify(state))
          throw Error(
            'Saved data changed since it was loaded. Reload and verify another backup before resetting.'
          );
        const preview = resetTrackingData(state);
        if (
          !confirm(
            `Permanently remove ${preview.counts.setsRemoved} recorded sets, ${preview.counts.checkinsRemoved} daily check-ins and ` +
              `${preview.counts.symptomsRemoved} symptom entries` +
              `${preview.counts.restartDateCleared ? ' and clear the Strength Journey start date' : ''}? ` +
              `Keep ${preview.counts.templatesKept} workout templates and weekday assignments? This cannot be undone without a backup.`
          )
        )
          return;
        const applied = resetTrackingData(state, { apply: true });
        commit(
          applied.nextState,
          'Recorded training and check-in history reset. Workout templates and schedules kept.'
        );
        pendingBackup = null;
        render();
        return;
      }
      if (act === 'walker-pick') {
        $('#walker-file').click();
        return;
      }
      if (act === 'walker-apply') {
        startWalkerApply();
        return;
      }
      if (act === 'walker-remove') {
        if (!walkerDataUrl) {
          toast('No private walking avatar to remove.');
          return;
        }
        if (!confirm('Remove the private walking picture? Saved workouts remain unchanged.')) return;
        try {
          localStorage.removeItem(WALKER_KEY);
        } catch {
          throw Error('Could not remove the avatar; no changes made.');
        }
        walkerDataUrl = null;
        pendingWalkerFile = null;
        render();
        toast('Private avatar removed.');
        return;
      }
      if (act === 'backup-verify') {
        const report = verifyLocalSnapshot(state, localStorage.getItem(STORAGE_KEY));
        toast(
          `Saved data checked: ${report.templates} templates, ${report.sets} sets, ${report.symptoms} symptom observations. ` +
            `No data changed.`
        );
      }
      if (act === 'logbook-export') {
        download(
          `FitnessPilot-workout-history-${today()}.csv`,
          workoutLogbookCsv(state),
          'text/csv;charset=utf-8'
        );
        toast('Workout logbook CSV prepared. Store this personal file privately.');
      }
      if (act === 'backup-export') {
        if (storageError) throw Error('Cannot export invalid records safely.');
        resetBackupReady = false;
        download(
          `FitnessPilot-PREVIEW-backup-${today()}.json`,
          JSON.stringify(state, null, 2) + '\n',
          'application/json'
        );
        render();
        toast('Workout JSON prepared. Save the file, then use Check downloaded backup (.json).');
        return;
      }
      if (act === 'storage-persist') {
        if (storagePersistenceRequestPending) return;
        storagePersistenceRequestPending = true;
        button.disabled = true;
        requestPersistentStorage(navigator.storage)
          .then(async (result) => {
            await refreshPersistentStorageStatus();
            const messages = {
              granted: 'Browser granted persistent storage. Keep downloading backups.',
              denied: 'Browser declined persistent storage. You can request again later.',
              unsupported:
                'This browser does not support persistent storage requests. Keep downloading backups.',
              failed: 'Browser storage request failed. You can request again later.'
            };
            toast(messages[result], result === 'failed');
          })
          .catch(() => toast('Persistent storage request could not be completed.', true))
          .finally(() => {
            storagePersistenceRequestPending = false;
            if (button.isConnected) button.disabled = false;
          });
        return;
      }
      if (act === 'backup-pick') $('#backup-file').click();
      if (act === 'backup-file-check') $('#backup-check-file').click();
      if (act === 'restore-cancel') {
        pendingBackup = null;
        render();
      }
      if (act === 'restore-confirm') {
        if (!pendingBackup) throw Error('Choose a backup file first.');
        if ($('#restore-word')?.value !== 'REPLACE') throw Error('Type REPLACE to confirm.');
        if (
          !confirm(
            'Replace ALL current local sets, workouts and check-ins with this backup? Export your existing backup first.'
          )
        )
          return;
        const next = pendingBackup;
        commit(next, 'Backup restored. Previous local data replaced.');
        pendingBackup = null;
        render();
      }
      if (act === 'calendar') {
        download(
          `FitnessPilot-weekly-reminders-${today()}.ics`,
          calendarICS(state),
          'text/calendar;charset=utf-8'
        );
        toast('Calendar file prepared. Import events into your calendar.');
      }
      if (act === 'stop-timer') {
        floatingRest.stop();
        toast('Timer stopped.');
      }
    });
  }
  function handleChange(event) {
    const target = event.target;
    if (target.id === 'walker-file') {
      const file = target.files?.[0];
      target.value = '';
      if (!file) return;
      try {
        pendingWalkerFile = validateWalkerFile(file);
        const status = $('#walker-status');
        if (status) status.textContent = 'Selected ' + file.name + '. Tap Apply selected avatar.';
      } catch (error) {
        pendingWalkerFile = null;
        toast(error.message, true);
      }
      return;
    }
    if (target.id === 'slime-hit-enabled') {
      try {
        localStorage.setItem(SLIME_HIT_SETTING, target.checked ? 'on' : 'off');
        slimeHitEnabled = target.checked;
        toast(slimeHitEnabled ? 'Slime reaction enabled.' : 'Slime reaction disabled.');
      } catch {
        target.checked = slimeHitEnabled;
        toast('Could not save slime setting; no change made.', true);
      }
      return;
    }
    if (target.id === 'strength-metric') {
      if (!['load', 'volume'].includes(target.value)) {
        toast('Choose a valid chart measurement.', true);
        return;
      }
      strengthViewMetric = target.value;
      render();
      return;
    }
    if (target.id === 'strength-history-filter') {
      if (!['all', 'recent10', 'recent3'].includes(target.value)) {
        toast('Choose a valid history filter.', true);
        return;
      }
      strengthHistoryFilter = target.value;
      render();
      return;
    }
    if (target.id === 'strength-exercise') {
      const index = Number(target.value);
      if (!Number.isInteger(index) || index < 0) throw Error('Choose a valid strength exercise.');
      strengthJourneyIndex = index;
      render();
      return;
    }
    if (target.id === 'active-date') {
      if (!mayLeaveFocusSet()) {
        target.value = activeDate;
        return;
      }
      tryAction(() => {
        activeDate = target.value;
        chosenExercise = 0;
        chosenTemplate = null;
        focusSet = 0;
        render();
      });
    }
    if (target.id === 'active-workout') {
      if (!mayLeaveFocusSet()) {
        target.value = chosenTemplate || state.assignments[weekdayOf(activeDate)] || '';
        return;
      }
      chosenTemplate = target.value;
      chosenExercise = 0;
      selectFocusSet();
      render();
    }
    if (target.id === 'symptom-template') {
      const tmpl = state.templates.find((t) => t.id === target.value);
      const list = $('#symptom-exercise');
      if (list)
        list.innerHTML =
          '<option value="">Whole workout / not exercise-specific</option>' +
          (tmpl
            ? tmpl.exercises.map((e, i) => `<option value="${i}">${i + 1}. ${esc(e.name)}</option>`).join('')
            : '');
    }
    if (target.id === 'completed-workout-file') {
      const files = Array.from(target.files || []);
      target.value = '';
      if (files.length) readCompletedCsv(files);
      return;
    }
    if (target.id === 'csv-file') {
      const file = target.files?.[0];
      target.value = '';
      if (file) readCSV(file).catch((e) => toast(e.message, true));
    }
    if (target.id === 'backup-file') {
      const file = target.files?.[0];
      target.value = '';
      if (file)
        readBackup(file).catch((e) => {
          pendingBackup = null;
          render();
          toast(e.message, true);
        });
    }
    if (target.id === 'backup-check-file') {
      const file = target.files?.[0];
      target.value = '';
      if (file)
        (async () => {
          resetBackupReady = false;
          if (file.size > 8_000_000 || !/\.json$/i.test(file.name))
            throw Error('Choose a .json backup smaller than 8 MB.');
          resetBackupReady = false;
          const raw = await file.text();
          const summary = inspectBackupFileText(raw);
          const current = JSON.stringify(state);
          const checked = JSON.stringify(validateBackup(JSON.parse(raw)));
          resetBackupReady =
            !storageError && checked === current && localStorage.getItem(STORAGE_KEY) === current;
          if (resetBackupReady) {
            try {
              markWorkoutBackupChecked(localStorage, today());
            } catch (error) {
              render();
              toast(`Backup matches, but ${error.message}`, true);
              return;
            }
          }
          render();
          toast(
            resetBackupReady
              ? `Matching workout backup verified: ${summary.templates} templates and ${summary.sets} recorded sets. ` +
                `Checked date recorded as today; nothing restored.`
              : 'Backup file valid but does not match current browser records. Nothing restored; a matching backup is required to reset.'
          );
        })().catch((error) => {
          resetBackupReady = false;
          render();
          toast(error.message, true);
        });
    }
  }
  function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    tryAction(() => {
      if (form.id === 'strength-start-form') {
        const start = form.elements.start.value;
        if (start) {
          dateFromKey(start);
          if (start > today()) throw Error('Day 1 cannot be in the future.');
        }
        const next = structuredClone(state);
        if (start) next.strengthJourneyStartDate = start;
        else delete next.strengthJourneyStartDate;
        strengthJourneyIndex = 0;
        commit(
          next,
          start
            ? 'Journey start date saved. Your earlier workout history remains intact.'
            : 'Journey start reset to first saved session. History unchanged.'
        );
        return;
      }
      if (form.id === 'strength-step-form') {
        const raw = form.elements.step.value;
        const value = raw === '' ? null : Number(raw);
        if (value !== null && ![0.5, 1, 2, 2.5, 4].includes(value))
          throw Error('Choose a supported available dumbbell increment.');
        const next = structuredClone(state);
        if (value === null) delete next.progressionStepKg;
        else next.progressionStepKg = value;
        commit(
          next,
          value === null
            ? 'Dumbbell increment cleared.'
            : 'Available dumbbell increment saved. Actual workout sets remain unchanged.'
        );
        return;
      }
      if (form.id === 'return-stage-form') {
        if (storageError)
          throw Error('Saved data is locked. Return-to-training preview cannot use unreadable records.');
        const ids = DAYS.map((_, i) => form.elements[`returnDay${i}`].value);
        const sources = ids.filter(Boolean).map((id) => state.templates.find((t) => t.id === id));
        if (!sources.length) throw Error('Choose at least one source workout from your library.');
        if (sources.some((t) => !t || t.returnStagePercent))
          throw Error('Choose existing source workouts, not a generated return stage.');
        generateOneSetCoverage(sources); // Read-only validation before recording a preview.
        pendingReturnStage = { ids, snapshot: localStorage.getItem(STORAGE_KEY) };
        render();
        document.getElementById('return-stage-panel')?.scrollIntoView({ block: 'start' });
        return;
      }
      if (form.id === 'template-version-form') {
        if (!customizing) throw Error('Select a saved exercise to customize first.');
        const changes = Object.fromEntries(
          ['name', 'muscle', 'sets', 'min', 'max', 'rest', 'sourceNote'].map((key) => [
            key,
            form.elements[key].value
          ])
        );
        const out = createExerciseVersion(state, customizing.id, customizing.index, changes);
        if (
          !confirm(
            `Add "${out.template.name}" as a NEW workout? Your original, schedules, and logged sets remain unchanged.`
          )
        )
          return;
        commit(out.state, `Custom workout "${out.template.name}" added. Assign it in Plan when ready.`);
        customizing = null;
        return;
      }
      if (form.id === 'schedule-form') {
        const next = structuredClone(state);
        const assignments = {};
        for (let i = 0; i < 7; i++) {
          const id = form.elements[`day${i}`].value;
          if (id) {
            if (!state.templates.some((t) => t.id === id && !isHistoricalWorkout(t)))
              throw Error(`Unknown workout selected for ${DAY_NAMES[i]}.`);
            assignments[i] = id;
          }
        }
        const newlyAssignedPT = Object.entries(assignments).some(
          ([day, id]) => state.assignments[day] !== id && isPTReview(state.templates.find((t) => t.id === id))
        );
        if (
          newlyAssignedPT &&
          !confirm(
            'This workout is marked [PT Review] and is NOT clinically cleared. ' +
              'Assigning it is only scheduling, not medical approval. Continue?'
          )
        )
          return;
        next.assignments = assignments;
        commit(next, 'Weekly schedule saved. Existing logs preserved.');
      }
      if (form.id === 'sets-form') {
        if (!chosenTemplate) throw Error('Select a workout first.');
        const template = state.templates.find((t) => t.id === chosenTemplate);
        const exercise = template?.exercises[chosenExercise];
        if (!exercise) throw Error('Select a valid exercise.');
        const shared = {
          rest: form.elements.rest.value,
          notes: form.elements.notes.value,
          tempo: form.elements.tempo.value,
          difficulty: form.elements.difficulty.value,
          technique: form.elements.technique.value
        };
        const entries = focusMode
          ? focusEntries(exercise.sets, focusSet, {
              ...shared,
              kg: form.elements[`kg${focusSet}`].value,
              reps: form.elements[`reps${focusSet}`].value,
              rpe: form.elements[`rpe${focusSet}`].value
            })
          : Array.from({ length: exercise.sets }, (_, i) => ({
              ...shared,
              completed: form.elements[`done${i}`].checked,
              kg: form.elements[`kg${i}`].value,
              reps: form.elements[`reps${i}`].value,
              rpe: form.elements[`rpe${i}`].value
            }));
        const out = recordSets(state, {
          date: activeDate,
          templateId: chosenTemplate,
          exerciseIndex: chosenExercise,
          entries
        });
        const freshSets = newlyRecordedSets(state, out.state, {
          date: activeDate,
          templateId: chosenTemplate,
          exerciseIndex: chosenExercise
        });
        let following = null;
        if (focusMode) {
          const nextSet = nextPendingSet(
            out.state.logs,
            activeDate,
            chosenTemplate,
            chosenExercise,
            exercise.sets,
            focusSet
          );
          if (nextSet >= 0) following = { exercise: chosenExercise, set: nextSet };
          else {
            const nextExercise = nextPendingExercise(
              out.state.logs,
              activeDate,
              chosenTemplate,
              template.exercises,
              chosenExercise
            );
            if (nextExercise >= 0) {
              following = {
                exercise: nextExercise,
                set: nextPendingSet(
                  out.state.logs,
                  activeDate,
                  chosenTemplate,
                  nextExercise,
                  template.exercises[nextExercise].sets
                )
              };
            }
          }
        }
        // Navigate only after localStorage has accepted the saved record.
        commit(out.state, `${out.saved} set(s) saved for ${exercise.name}.`);
        if (following) {
          chosenExercise = following.exercise;
          focusSet = following.set;
          render();
        }
        if (freshSets > 0) showSlimeHit();
      }
      if (form.id === 'symptom-form') {
        const draft = {
          date: activeDate,
          timepoint: form.elements.timepoint.value,
          templateId: form.elements.templateId.value || null,
          exerciseIndex:
            form.elements.exerciseIndex.value === '' ? null : Number(form.elements.exerciseIndex.value),
          side: form.elements.side.value,
          location: form.elements.location.value,
          severity: form.elements.severity.value,
          tingling: form.elements.tingling.checked,
          numbness: form.elements.numbness.checked,
          functionChange: form.elements.functionChange.value,
          notes: form.elements.notes.value
        };
        commit(
          addSymptomEntry(state, draft),
          'Symptom observation saved locally and included in full backups.'
        );
      }
      if (form.id === 'metrics-form') {
        const data = Object.fromEntries(
          ['weight', 'calories', 'protein', 'sleep', 'recovery'].map((k) => [k, form.elements[k].value])
        );
        commit(saveMetrics(state, activeDate, data), 'Daily check-in saved.');
      }
      if (form.id === 'reminder-form') {
        const time = form.elements.time.value;
        if (!/^\d{2}:\d{2}$/.test(time)) throw Error('Choose a valid workout time.');
        const [h, m] = time.split(':');
        const next = structuredClone(state);
        next.reminder = {
          hour: intRange(h, 'Hour', 0, 23),
          minute: intRange(m, 'Minute', 0, 59),
          lead: intRange(form.elements.lead.value, 'Alert lead', 0, 120)
        };
        commit(next, 'Reminder settings saved. Now export Calendar reminders.');
      }
    });
  }

  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  const floatingRest = createFloatingRestTimer();

  return {
    get state() {
      return state;
    },
    get page() {
      return page;
    },
    storageError,
    viewOptions,
    inspectWalkerDisplay,
    refreshPersistentStorageStatus,
    updateTimerPage: (page) => floatingRest.updatePage(page),
    timerRemaining
  };
}
