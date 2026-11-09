import { validateBackup } from './core.js';

// Preview is read-only. Application requires explicit apply:true.
export function resetTrackingData(state, { apply = false } = {}) {
  const checked = validateBackup(state);
  const counts = {
    templatesKept: checked.templates.length,
    assignmentsKept: Object.values(checked.assignments).filter(Boolean).length,
    setsRemoved: checked.logs.length,
    checkinsRemoved: checked.metrics.length,
    symptomsRemoved: (checked.symptomLogs ?? []).length,
    restartDateCleared: checked.strengthJourneyStartDate === undefined ? 0 : 1
  };
  if (!apply) return { counts, nextState: null };
  // The journey start date belongs to the records being erased; configuration is kept.
  const { strengthJourneyStartDate: _cleared, ...kept } = checked;
  const next = {
    ...kept,
    logs: [],
    metrics: [],
    ...(checked.symptomLogs === undefined ? {} : { symptomLogs: [] })
  };
  return { counts, nextState: validateBackup(next) };
}
