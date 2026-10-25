import { WALKER_KEY, validateWalkerFile, validateWalkerDataUrl } from './dashboard-walker.js';

// Called only from an explicit Apply button; no workout state is involved.
export async function applyWalkerFile(file, storage, readFile, decodeImage) {
  validateWalkerFile(file);
  const raw = await readFile(file);
  const data = validateWalkerDataUrl(raw);
  await decodeImage(data);
  storage.setItem(WALKER_KEY, data);
  return data;
}

export function readWalkerDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('The chosen WebP could not be read.'));
    reader.readAsDataURL(file);
  });
}
