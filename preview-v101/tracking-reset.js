import { validateBackup } from './core.js';

// Preview is read-only. Application requires explicit apply:true.
export function resetTrackingData(state, { apply = false } = {}) {
  const checked = validateBackup(state);
  const counts = {
    templatesKept: checked.templates.length,
    assignmentsKept: Object.values(checked.assignments).filter(Boolean).length,
    setsRemoved: checked.logs.length,
    checkinsRemoved: checked.metrics.length,
    symptomsRemoved: (checked.symptomLogs ?? []).length
  };
  if (!apply) return { counts, nextState: null };
  const next = {
    ...checked,
    logs: [],
    metrics: [],
    ...(checked.symptomLogs === undefined ? {} : { symptomLogs: [] })
  };
  return { counts, nextState: validateBackup(next) };
}
