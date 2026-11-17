import { workoutBackupStatus } from './backup-reminder.js';
import { esc } from './html.js';
import { isRoSoundEnabled } from './ro-feedback.js';
import { resetTrackingData } from './tracking-reset.js';
import { workoutLogbookHtml } from './workout-logbook.js';

function backupPreview(backup) {
  if (!backup) return '';
  const symptoms = (backup.symptomLogs ?? []).length;
  return `<div class="notice warn"><strong>Backup checked:</strong> ${backup.templates.length} templates, ` +
    `${backup.logs.length} saved sets, ${backup.metrics.length} daily entries, ${symptoms} symptom observations. ` +
    '<strong>Restore replaces all data currently in this app.</strong>' +
    '<label><span class="form-label">Type REPLACE to confirm</span>' +
    '<input class="field" type="text" id="restore-word" autocomplete="off" placeholder="REPLACE"></label>' +
    '<div class="form-actions"><button class="btn danger" data-action="restore-confirm">Replace with this backup</button>' +
    '<button class="btn secondary" data-action="restore-cancel">Cancel</button></div></div>';
}

function dataVault(backupStatus, pendingBackup, persistenceLabel) {
  return '<section class="card stack codex-vault"><div class="notice"><strong>Saved on this device only.</strong> ' +
    "Your sets and templates stay in this browser's local storage. They are not sent to us or synced to another device. " +
    'Clearing website data, deleting the Home Screen app, or switching devices can remove access to them.</div>' +
    '<div class="quick-actions"><button class="btn" data-action="backup-export">Download full backup (.json)</button>' +
    '<button class="btn secondary" data-action="backup-verify">Check saved data integrity</button>' +
    '<button class="btn secondary" data-action="backup-file-check">Check downloaded backup (.json) — no restore</button>' +
    `<button class="btn secondary" data-action="backup-pick">Restore backup</button></div>${backupPreview(pendingBackup)}` +
    `<p class="hint"><strong>${esc(backupStatus.label)}</strong> Date is recorded automatically when the checked workout JSON file ` +
    'matches current records.</p><div class="quick-actions">' +
    '<button class="btn secondary" data-action="storage-persist">Request persistent storage</button>' +
    '<a class="btn secondary" href="./food-diary.html">Open Food Diary backup →</a>' +
    '<a class="btn secondary" href="./encrypted-backup.html">Encrypted backup (both stores) →</a></div>' +
    `<p class="hint" id="storage-persistence-status" role="status">${esc(persistenceLabel)}</p>` +
    '<p class="hint">Storage persistence is browser-controlled and can be unavailable or denied; it never replaces backups. ' +
    'The workout JSON does not include Food Diary entries: export the Food Diary JSON separately on that page.</p>' +
    '<p class="hint">Export a backup after every important training week. ' +
    'Keep the JSON file in iCloud Drive or another place you control. ' +
    'Restoring is destructive, so this app will preview the file and require an explicit confirmation. ' +
    'The saved-data check reads browser storage. The downloaded-backup check reads a chosen file without restoring it; ' +
    'separate-device restore still needs acceptance testing.</p></section>';
}

function resetPanel(counts, backupReady) {
  const restart = counts.restartDateCleared
    ? 'The Strength Journey start date would be cleared. ' : 'No Strength Journey start date is set. ';
  const match = backupReady ? '<strong>Current backup file matches.</strong>' : '<strong>No matching backup verified yet.</strong>';
  return '<section class="card stack"><div class="notice warn"><strong>Destructive reset — no automatic undo.</strong> ' +
    'Remove saved working sets, daily weight/nutrition/sleep/recovery check-ins and symptom observations from this preview. ' +
    'The Strength Journey start date is also cleared. Preserve all uploaded workout templates, exercise targets, ' +
    `weekday assignments and reminder settings.</div>
    <p class="hint">Preview: ${counts.setsRemoved} saved sets, ${counts.checkinsRemoved} daily check-ins and ` +
    `${counts.symptomsRemoved} symptom observations would be erased. ${restart}${counts.templatesKept} workout templates and ` +
    `${counts.assignmentsKept} weekday assignments will be kept.</p>
    <p class="hint"><strong>Before resetting:</strong> use Download full backup (.json), then Check downloaded backup (.json) above ` +
    'and select the file you just saved. It must match the current records exactly. ' +
    `Verify that your file is accessible in Files. ${match}</p>
    <label><input type="checkbox" id="tracking-reset-ack"> I saved and checked my full backup, ` +
    `and understand the recorded data will be deleted.</label>
    <label><span class="form-label">Type RESET LOGS to confirm</span><input id="tracking-reset-word" class="field" type="text" ` +
    `autocomplete="off" placeholder="RESET LOGS"></label>
    <div class="form-actions"><button class="btn danger" type="button" data-action="tracking-reset-apply">` +
    `Reset recorded data (keep workouts)</button></div>
  </section>`;
}

function calendarPanel(reminder) {
  const time = `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`;
  return '<section class="card codex-reminders"><div class="card-head"><div><h2>Workout reminders</h2>' +
    '<p>Uses your iPhone Calendar — even when FitnessPilot is closed</p></div><span class="badge">CALENDAR</span></div>' +
    '<form id="reminder-form"><div class="metrics-grid"><label><span class="form-label">Workout time</span>' +
    `<input class="field" type="time" name="time" required value="${time}"></label>` +
    '<label><span class="form-label">Alert ahead of time</span><select class="field" name="lead">' +
    `<option value="0" ${reminder.lead === 0 ? 'selected' : ''}>At workout time</option>` +
    `<option value="5" ${reminder.lead === 5 ? 'selected' : ''}>5 minutes before</option>` +
    `<option value="15" ${reminder.lead === 15 ? 'selected' : ''}>15 minutes before</option>` +
    `<option value="30" ${reminder.lead === 30 ? 'selected' : ''}>30 minutes before</option>` +
    `<option value="60" ${reminder.lead === 60 ? 'selected' : ''}>1 hour before</option></select></label></div>` +
    '<div class="form-actions"><button class="btn" type="submit">Save alert settings</button>' +
    '<button class="btn secondary" type="button" data-action="calendar">Export Calendar reminders (.ics)</button></div></form>' +
    '<p class="hint" style="margin-top:14px">First save your settings, then export the .ics file. ' +
    'Import it into a calendar that supports .ics events and alarms. Some iPhone import paths may require emailing the file to yourself ' +
    'or using a computer calendar. Check the alert in Apple Calendar after import. If you change the schedule, remove previous imported ' +
    'events and export again to avoid duplicate alerts.</p><div class="notice warn"><strong>Not a Clock alarm.</strong> ' +
    "This web app cannot force a loud full-screen ring while closed. Calendar notifications depend on your phone's notification, " +
    'Focus and Silent settings. Use the iPhone Clock app if an audible alarm is essential.</div></section>';
}

export function toolsView(state, options, { shellHeading, heading, today, timerRemaining }, storage) {
  const { pendingBackup, resetBackupReady, storagePersistenceStatusLabel, walkerDataUrl, slimeHitEnabled } = options;
  const resetCounts = resetTrackingData(state).counts;
  const backupStatus = workoutBackupStatus(storage, today());
  const avatarStatus = walkerDataUrl
    ? 'Private WebP saved. If Reduce Motion is enabled, Dashboard shows a still of your character. ' +
      'For walking motion, enable Animation effects in device accessibility settings.'
    : 'No private WebP saved; choose one to preview.';
  const intro = heading("ADVENTURER'S KIT", 'Tools & data',
    'Back up your progress first, then customize sounds, rest times and calendar reminders.');
  return `${shellHeading()}${intro}
  <div class="codex-utility-intro"><strong>Keep your journey safe</strong>` +
    `<span>Your logs stay on this device. Download a backup before testing restores or changing devices.</span></div>
  <div class="section-label"><h2>Data vault</h2><span>Local to this browser</span></div>` +
    `${dataVault(backupStatus, pendingBackup, storagePersistenceStatusLabel)}
  <div class="section-label"><h2>Reset tracking records</h2><span>Keep uploaded workouts</span></div>
  ${resetPanel(resetCounts, resetBackupReady)}
  <div class="section-label"><h2>iPhone QA · preview only</h2></div>` +
    '<section class="card stack"><strong>Check this test build before using real records.</strong>' +
    '<p class="hint">Open the manual acceptance checklist in another tab. Mark Pass, Fail, Blocked or Not run, ' +
    'then download a JSON report. The checklist does not inspect or change your saved workouts.</p>' +
    `<p><a class="btn secondary" href="./qa.html" target="_blank" rel="noopener noreferrer">Open iPhone QA checklist</a></p></section>
  <div class="section-label"><h2>Workout logbook</h2><span>Saved set history</span></div>
  <section class="card stack v158-logbook"><div class="card-head"><div><h2>Your training archive</h2>` +
    '<p>Past workout versions and their actual logged sets</p></div>' +
    `<button type="button" class="btn secondary small-btn" data-action="logbook-export">Download full history (.csv)</button></div>
    <p class="hint">All records stay on this device. Downloading CSV creates a local file containing your workout details and notes. ` +
    `It does not change your saved workouts.</p>
    ${workoutLogbookHtml(state)}</section>
  <div class="section-label"><h2>Button sound</h2></div><section class="card codex-sound"><label class="ro-sound-switch">` +
    `<input type="checkbox" id="ro-click-sound" ${isRoSoundEnabled() ? 'checked' : ''}> Slime squish sound</label>` +
    '<p id="ro-sound-status" role="status" class="hint">Switch on to test the sound immediately, then tap any button. ' +
    `Check iPhone volume if it stays silent.</p></section>
  <div class="section-label"><h2>Walking avatar</h2></div><section class="card stack">` +
    '<p class="hint">Local WebP only (max 600 KB). Walks in place over a translucent stage on Dashboard.</p>' +
    '<div class="form-actions"><button class="btn secondary" data-action="walker-pick">Choose WebP</button>' +
    '<button class="btn" data-action="walker-apply">Apply selected avatar</button>' +
    '<button class="btn ghost" data-action="walker-remove">Remove avatar</button></div>' +
    `<p class="hint" id="walker-status">${avatarStatus}</p></section><div class="section-label"><h2>Slime hit</h2></div>` +
    '<section class="card codex-sound"><label class="ro-sound-switch">' +
    `<input id="slime-hit-enabled" type="checkbox" ${slimeHitEnabled ? 'checked' : ''}> Show slime reaction after new saved sets</label>` +
    '<p class="hint">Silent and optional. No hits for edits or failed saves, and no XP or loot. ' +
    `This cosmetic preview preference is separate from workout JSON backups.</p></section>
  <div class="section-label"><h2>Rest clock</h2><span>Runs while app is open</span></div>` +
    `<section class="card codex-timer"><div id="timer-display" class="rest-timer">${timerRemaining()}</div>` +
    '<p class="subtle small">An optional countdown for time between sets. iPhone may pause it in the background.</p>' +
    '<div class="form-actions"><button class="btn secondary" data-rest="60">1 minute</button>' +
    '<button class="btn secondary" data-rest="90">90 seconds</button><button class="btn secondary" data-rest="120">2 minutes</button>' +
    `<button class="btn ghost" data-action="stop-timer">Stop</button></div></section>
  <div class="section-label"><h2>Calendar reminders</h2><span>Optional</span></div>
  ${calendarPanel(state.reminder)}
  <p class="app-footer">FitnessPilot Web v1 · No accounts · No analytics · No advertisements</p>`;
}
