import { STORAGE_KEY, emptyState, validateBackup } from './core.js';

export function loadWorkoutState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { state: saved ? validateBackup(JSON.parse(saved)) : emptyState(), storageError: null };
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (error) {
    throw Error(`Could not save locally (${error.name}). Check available device storage; the old records were left untouched.`);
  }
  return clean;
}
