// Manual volume ramp: how many of an exercise's planned sets the owner is currently doing.
// Optional state; absent means every planned set. Nothing here changes automatically.
const fail = message => { throw new Error(message); };

export const activeSetKey = (templateId, exerciseIndex) => `${templateId}|${exerciseIndex}`;

// Validate without mutating or repairing. Backups from before V15.25 simply omit the field.
export function validateActiveSets(state) {
  const map = state.activeSets;
  if (map === undefined) return;
  if (!map || typeof map !== 'object' || Array.isArray(map)) fail('Backup contains an invalid active-set list.');
  for (const [key, value] of Object.entries(map)) {
    const cut = key.lastIndexOf('|');
    const indexText = key.slice(cut + 1), templateId = key.slice(0, cut);
    if (cut < 1 || !/^(0|[1-9]\d*)$/.test(indexText)) fail('Backup contains an invalid active-set key.');
    const template = state.templates.find(t => t.id === templateId);
    if (!template) fail('Active sets refer to a missing workout.');
    const exercise = template.exercises[Number(indexText)];
    if (!exercise) fail('Active sets refer to a missing exercise.');
    if (!Number.isInteger(value) || value < 1 || value > exercise.sets)
      fail(`Active sets must be a whole number from 1 to the planned ${exercise.sets} for "${exercise.name}".`);
  }
}

// Sets expected in a session: the active count when one is recorded, otherwise the planned count.
export function expectedSetCount(state, templateId, exerciseIndex) {
  const exercise = state.templates?.find(t => t.id === templateId)?.exercises?.[exerciseIndex];
  if (!exercise) return 0;
  const value = state.activeSets?.[activeSetKey(templateId, exerciseIndex)];
  return Number.isInteger(value) && value >= 1 && value <= exercise.sets ? value : exercise.sets;
}

// Owner action only. Setting the full planned count removes the entry; logs are never touched.
export function setActiveSets(state, {templateId, exerciseIndex, count}, options) {
  if (options?.confirmed !== true) fail('Changing active sets needs your explicit confirmation.');
  const exercise = state.templates.find(t => t.id === templateId)?.exercises?.[exerciseIndex];
  if (!exercise || !Number.isInteger(exerciseIndex)) fail('Choose an existing workout exercise.');
  if (!Number.isInteger(count) || count < 1 || count > exercise.sets)
    fail(`Active sets must be a whole number from 1 to ${exercise.sets}.`);
  const next = structuredClone(state);
  const map = {...(next.activeSets || {})};
  if (count === exercise.sets) delete map[activeSetKey(templateId, exerciseIndex)];
  else map[activeSetKey(templateId, exerciseIndex)] = count;
  if (Object.keys(map).length) next.activeSets = map;
  else delete next.activeSets;
  validateActiveSets(next);
  return next;
}
