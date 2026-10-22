import { validateBackup } from './core.js';

// A production backup contains private history; keep only reusable workout templates.
export function templatesFromBackup(value) {
  const verified = validateBackup(value);
  if (!verified.templates.length) throw Error('This backup has no workout templates to import.');
  return verified.templates.map(({ id, ...template }) => {
    const lower = /\b(lower|legs?)\b/i.test(template.name) ||
      template.exercises.some(ex => ['quads', 'hamstrings', 'glutes', 'calves']
        .includes(ex.muscle.toLowerCase()));
    return { ...template, requiresClinicalReview: !!template.requiresClinicalReview || lower };
  });
}
