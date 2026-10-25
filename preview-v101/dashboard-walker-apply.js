import { WALKER_KEY, validateWalkerFile, validateWalkerDataUrl } from './dashboard-walker.js';

// Called only from an explicit Apply button; no workout state is involved.
export async function applyWalkerFile(file, storage, readFile) {
  validateWalkerFile(file);
  const raw = await readFile(file);
  const data = validateWalkerDataUrl(raw);
  storage.setItem(WALKER_KEY, data);
  return data;
}
