import { validateBackup } from './core.js';

/**
 * Read-only browser-storage health check.
 * Proves JSON serialization/validation consistency of the currently saved snapshot.
 * Does NOT test whether a separately downloaded file is recoverable on an iPhone.
 */
export function verifyLocalSnapshot(state, raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw Error('No saved browser snapshot found. Save a sample workout or check-in first.');
  }
  let stored;
  try { stored = JSON.parse(raw); }
  catch { throw Error('Saved browser snapshot is not valid JSON. Do not overwrite it.'); }
  const saved = validateBackup(stored);
  const current = validateBackup(state);
  const serialized = JSON.stringify(saved);
  const checked = validateBackup(JSON.parse(serialized));
  if (JSON.stringify(checked) !== serialized) {
    throw Error('Saved browser snapshot failed its JSON recovery check.');
  }
  if (JSON.stringify(current) !== serialized) {
    throw Error('Browser storage differs from the visible workout data. Avoid overwriting it; export and investigate.');
  }
  return {
    templates: checked.templates.length,
    sets: checked.logs.length,
    checkins: checked.metrics.length,
    symptoms: (checked.symptomLogs ?? []).length,
    assignments: Object.values(checked.assignments).filter(Boolean).length
  };
}
