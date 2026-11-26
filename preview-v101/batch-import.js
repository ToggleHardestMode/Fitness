import {previewCompletedCsv} from './completed-workout-csv.js';
import {previewDailyFoodCsv} from './food-diary-csv.js';

const MAX_FILES = 20;
const limits = {workout: 1_000_000, food: 100_000};

function checkCount(files) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES)
    throw Error('Choose between 1 and 20 CSV files.');
}

export async function readCsvBatch(files, kind) {
  checkCount(files);
  const limit = limits[kind];
  if (!limit) throw Error('Unknown CSV import type.');
  const input = [];
  let bytes = 0;
  for (const file of files) {
    if (!/\.csv$/i.test(file.name) || !file.size || file.size > limit)
      throw Error(file.name + ': choose a nonempty CSV no larger than ' + limit + ' bytes. Nothing imported.');
    bytes += file.size;
    if (bytes > limit * 5) throw Error('Selected files exceed the batch size limit. Nothing imported.');
    try { input.push({name: file.name, text: await file.text()}); }
    catch (error) { throw Error(file.name + ': file could not be read. Nothing imported.'); }
  }
  return input;
}

function reviewFile(file, fn) {
  try { return fn(); }
  catch (error) { throw Error(file.name + ': ' + error.message + ' Entire batch untouched.'); }
}

export function previewWorkoutBatch(state, files) {
  checkCount(files);
  const seen = new Map(), add = [], skipped = [], summaries = [];
  for (const file of files) reviewFile(file, () => {
    const p = previewCompletedCsv(state, file.text);
    const summary = {name: file.name, added: 0, skipped: 0, duplicates: 0};
    for (const [rows, target, field] of [[p.add, add, 'added'], [p.skipped, skipped, 'skipped']]) {
      for (const row of rows) {
        const key = JSON.stringify([row.date, row.templateId, row.exerciseIndex, row.set]);
        const earlier = seen.get(key);
        if (earlier) {
          if (JSON.stringify(row) !== JSON.stringify(earlier.row))
            throw Error('Conflicting set also in ' + earlier.file + ': ' + row.date + ' · ' +
              row.exerciseName + ' · set ' + row.set + '.');
          summary.duplicates++;
          continue;
        }
        seen.set(key, {row, file: file.name});
        target.push(row);
        summary[field]++;
      }
    }
    if (seen.size > 2000) throw Error('Review at most 2,000 distinct working sets per batch.');
    summaries.push(summary);
  });
  return {add, skipped, completed: add.length + skipped.length, files: summaries,
    days: [...new Set([...add, ...skipped].map(row => row.date))].sort()};
}

const foodGroup = row => JSON.stringify([row.date, row.name.toLocaleLowerCase('en'), row.occasion]);

export function previewFoodBatch(diary, files) {
  checkCount(files);
  const groups = new Map(), seenFiles = new Set(), ids = new Set(), dates = new Set();
  const add = [], skipped = [], updates = [], summaries = [];
  let total = 0;
  for (const file of files) reviewFile(file, () => {
    // Identical file bytes are a repeat selection. Different overlapping meal groups
    // are ambiguous: preserve multiplicity within a file, never guess across files.
    if (seenFiles.has(file.text)) {
      summaries.push({name: file.name, duplicate: true});
      return;
    }
    const p = previewDailyFoodCsv(diary, file.text);
    const rows = [...p.add, ...p.skipped, ...p.updates.map(item => item.after)];
    const keys = new Set(rows.map(foodGroup));
    for (const key of keys) {
      if (groups.has(key)) throw Error('Overlapping same-date food group also in ' + groups.get(key) +
        '. Combine that meal group into one CSV and review its intended servings.');
    }
    for (const row of rows) {
      if (ids.has(row.id)) throw Error('Food ID conflict across files.');
      ids.add(row.id);
    }
    for (const key of keys) groups.set(key, file.name);
    seenFiles.add(file.text);
    p.dates.forEach(date => dates.add(date));
    add.push(...p.add); skipped.push(...p.skipped); updates.push(...p.updates);
    total += p.total;
    if (diary.entries.length + add.length > 3000) throw Error('Food Diary would exceed 3,000 entries.');
    summaries.push({name: file.name, added: p.add.length, skipped: p.skipped.length, corrected: p.updates.length});
  });
  return {add, skipped, updates, total, dates: [...dates].sort(), files: summaries};
}
