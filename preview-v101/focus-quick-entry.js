// Form-only shortcuts for Focus Mode; no storage writes or automatic progression.
export const QUICK_RPE = Object.freeze([6, 7, 8, 9]);

export function stepReps(raw, delta) {
  if (delta !== 1 && delta !== -1) throw Error('Repetition adjustment must be +1 or -1.');
  if (!/^\d+$/.test(String(raw))) throw Error('Enter whole-number reps before using +1 or -1.');
  const current = Number(raw);
  if (!Number.isSafeInteger(current) || current < 1 || current > 100)
    throw Error('Repetitions must be between 1 and 100.');
  const next = current + delta;
  if (next < 1 || next > 100) throw Error('Repetitions must stay between 1 and 100.');
  return String(next);
}

export function chooseRpe(value) {
  const candidate = Number(value);
  if (!QUICK_RPE.includes(candidate)) throw Error('Choose one of the displayed RPE values.');
  return String(candidate);
}
