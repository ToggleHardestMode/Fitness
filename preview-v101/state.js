import { STORAGE_KEY, emptyState, validateBackup } from './core.js';
import { assertLegacyDocument } from './session-document.js';

export function loadWorkoutState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved === null ? emptyState() : JSON.parse(saved);
    assertLegacyDocument(parsed);
    return { state: validateBackup(parsed), storageError: null };
  } catch (error) {
    return {
      state: emptyState(),
      storageError: `Existing saved data could not be read: ${error.message}. This app will not overwrite it. ` +
        "Keep this browser's website data intact while you investigate the problem.",
    };
  }
}

export function saveWorkoutState(next, storageError) {
  if (storageError) {
    throw Error('Saved data is locked because it could not be read. Do not overwrite your existing record.');
  }
  const clean = validateBackup(next);
  // Recheck the persisted format even when this tab originally loaded version 1.
  // This is not an atomic cross-tab lock and cannot retrofit older cached builds.
  let persisted;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    persisted = raw === null ? null : JSON.parse(raw);
    if (raw !== null && persisted === null) throw Error('Invalid saved workout document.');
  } catch {
    throw Error('Saved workout data cannot be inspected; nothing was overwritten.');
  }
  if (persisted !== null) assertLegacyDocument(persisted);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (error) {
    throw Error(`Could not save locally (${error.name}). Check available device storage; the old records were left untouched.`);
  }
  return clean;
}
