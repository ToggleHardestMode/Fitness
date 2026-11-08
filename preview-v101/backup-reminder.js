// Backup tracking is device-local metadata, separate from workout and Food Diary records.
export const WORKOUT_BACKUP_DATE_KEY = 'fitnesspilot.preview.v101.workoutBackupChecked.v1';
const PERSISTENCE_ATTEMPT_KEY = 'fitnesspilot.preview.v101.persistenceAttempt.v1';
const DAY_MS = 86400000;

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms / DAY_MS : null;
}

export function workoutBackupStatus(storage, currentDay) {
  const today = dayNumber(currentDay);
  if (today === null) throw Error('Invalid current backup date.');
  let saved;
  try { saved = storage.getItem(WORKOUT_BACKUP_DATE_KEY); }
  catch { return {due:true, days:null, label:'Workout backup date unavailable on this device.'}; }
  const last = dayNumber(saved);
  if (last === null || last > today) return {due:true, days:null, label:'No checked workout backup date on this device.'};
  const days = today - last;
  const when = days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return {due:days >= 7, days, label:`Last checked workout backup: ${when}.`};
}

export function markWorkoutBackupChecked(storage, currentDay) {
  if (dayNumber(currentDay) === null) throw Error('Invalid current backup date.');
  try { storage.setItem(WORKOUT_BACKUP_DATE_KEY, currentDay); }
  catch { throw Error('Could not save the workout backup date; workout records were not changed.'); }
}

export async function requestPersistentStorageOnce(storage, manager) {
  if (typeof manager?.persist !== 'function') return 'unsupported';
  try {
    if (storage.getItem(PERSISTENCE_ATTEMPT_KEY) === 'attempted') return 'already-requested';
    storage.setItem(PERSISTENCE_ATTEMPT_KEY, 'attempted');
  } catch { return 'unavailable'; }
  try { return (await manager.persist()) ? 'granted' : 'denied'; }
  catch { return 'failed'; }
}
