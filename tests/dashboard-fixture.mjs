import { emptyState } from '../preview-v101/core.js';
import { dashboardView } from '../preview-v101/dashboard-view.js';

export function dashboardHtml(state = {}, { day = '2026-10-19', selection = {}, storage = {} } = {}) {
  return dashboardView(
    { ...emptyState(), ...state },
    { walkerDataUrl: null, ...selection },
    {
      today: () => day,
      fmt: n => Number(n).toLocaleString('en-SG', { maximumFractionDigits: 1 }),
      nice: date => date,
      shellHeading: () => '<div class="header-row">FitnessPilot</div>',
      isPTReview: t => !!t?.requiresClinicalReview || !!t?.name?.includes('[PT Review]'),
    },
    { getItem: key => storage[key] ?? null }
  );
}
