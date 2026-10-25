# FitnessPilot V15.15.1 — test preview

**Test URL:** https://togglehardestmode.github.io/Fitness/preview-v101/?v=41

The folder is still named `preview-v101` for continuity; the application banner and manifest currently identify **V15.14**. It is a separate preview application, **not** the production root upgrade.

## V15.15.1 · Visible fallback and WebP verification

Fixes operator-reported **blank walking character after Apply**. The prior Apply verified a WebP file's data-URL shape but did not verify that the browser could decode it. V15.15.1 decodes the selected WebP before saving the cosmetic preference, always paints the existing generic adventurer behind the private image, reveals the private image only when it loads, and displays an on-Dashboard status line (loaded / cannot display / Reduce Motion). No record, template or storage-key changes.

On Safari, confirm V15.15.1 banner, Dashboard status and default adventurer visible. Tools → Walking avatar → Choose WebP → Apply; return to Dashboard and read the visible load status. If it says "cannot be displayed", do not clear Safari data; retain the fallback and inspect the file's format. Reduced Motion always displays the static default.

## V15.15 · Walking-in-place character on translucent Dashboard platform

On Dashboard the decorative character stays at one fixed right-side position and loops in place on a translucent platform. It does not walk across the screen. The original V15.14 character is the fallback until the operator imports their own WebP.

Privacy-first import: download the 6-frame animated WebP supplied privately in chat to iPhone Files. Open **Tools → Walking avatar → Choose WebP**, select the file (max 600 KB), then tap **Apply selected avatar** and accept the confirmation. The WebP is saved under the separate `fitnesspilot.preview.v101.ui.walker.v1` localStorage preference on that device. It does not modify the workout-state key, upload the image, include personal art in GitHub, or embed the avatar in workout backups. **Remove avatar** explicitly deletes only this preference. Browser website-data clearing deletes it too.

The character is decorative with `pointer-events:none`. Under iOS Reduce Motion the static public illustration replaces the moving WebP. Check Safari support for animated WebP and the top banner's narrow-screen layout; neither is yet accepted on-device. No changes to training analytics, PT Review, sound, slime-hit feedback or production-root.

## V15.14 · Animated adventurer on the Dashboard

An **original moustached fantasy adventurer** now idles at the top-right of a compact Dashboard banner, above saved-set analytics. The animation is visual-only (gentle float and occasional blink), not an exercise reward, physique prediction or medical signal. Artwork is an internal SVG; no external images, added third-party scripts, account, server or personal data writes.

Small iPhone layouts keep the character within the banner so progress cards remain readable; `prefers-reduced-motion` stops both the outer motion and eyes. The artwork does not intercept taps or appear on Train, Plan or Tools. Existing V15.13 optional post-save slime remains a separate feature.

**Acceptance:** Open the V15.14 preview in Safari; inspect the character at the top of Dashboard and legibility of the first progress card. Visit Train, Plan and Tools to ensure no banner. Enable iOS Reduce Motion and reopen the preview; the idle motion and blink should stop. No test workout data is required.

## V15.13 · Optional slime save reaction

**Tools → Slime hit feedback** provides an off-by-default, visual-only animation. It uses a new, original soft blue slime illustration; existing Ragnarok-style button audio is separate. After a valid **new working set** persists successfully, the slime visibly squishes once. Editing the same slot does not repeat the effect, and failed writes cannot trigger it. Bulk saves show one animation per successful submission. No gameplay currency, targets, XP, loot, health bars, pressure, or changes to workouts are included.

The independent visual preference is stored in a preview-only local setting (not part of full workout JSON exports); no new workout schema or storage-key migration. Motion is disabled under `prefers-reduced-motion`. On-device preview check: verify the banner, enable the option in Tools, record a genuinely intended new set, edit it and confirm there is no second hit. In an isolated disposable context, also test save failure and preference off. Do not generate fake workouts in real training history.

## V15.12 · Faster Focus Mode set entry

Focus Mode now includes **−1 / +1 rep** buttons and **RPE 6 / 7 / 8 / 9** quick choices beside the editable numeric fields. Buttons only update unsaved input values. Manual typing still supports other RPE values and weights. No new saves, auto weight progression, exercise changes or RPG rewards are triggered. Blank or out-of-range repetition values produce a visible error instead of filling automatically. All existing Focus Mode dirty-form prompts, save validation, next-unsaved-set navigation and `[PT Review]` limitations remain unchanged.

**On-device check:** Open Train, select a workout/date and Focus Mode. For an existing or previous-value rep input, tap +1 then −1. Tap RPE 8, then navigate away: if the form differs from its loaded values, discarding must ask for confirmation. Return and explicitly save. The saved set count should rise only once; editing it should not create another log. Compare the effort required over 30 sets and record errors, not just tap count. Test without creating fake personal training data.

## V15.11.4 · Clear tracking history, keep uploaded workouts

In **Tools → Data vault**, download **Full backup (.json)** and ensure the file is saved in Files/iCloud Drive. Select that same file with **Check downloaded backup (.json) — no restore**. Only an exact match to the currently stored data unlocks reset.

Scroll to **Reset tracking records**. Review the counts, tick acknowledgement, type `RESET LOGS`, press **Reset recorded data (keep workouts)** and accept the final confirmation. This permanently clears saved working-set logs, daily check-ins and symptom journal observations in the preview. It does not clear locally saved workout templates, exercise instructions/targets, weekly assignments or reminders. No mutation occurs when viewing the preview, downloading, or checking a backup. No browser site-data clearing is required.

If the backup does not match, the session changed after validation, or current storage changed in another tab, reset is blocked. Restore of the backup is a separate full-replacement operation; no automatic rollback. Test on disposable records before using real data; current iPhone implementation remains unverified.

## V15.11.3 · Weekly averages audit (read-only)

The Dashboard's Daily check-ins section now shows how many dates contributed to each weekly average. Expand **Which dates contribute to these averages?** to inspect saved values by date for protein, calories, sleep, and recovery. This is a transparency fix: averages still use recorded values from the current Monday–Sunday week, and existing saved measurements are neither reset nor migrated. To correct a mistaken entry, open **Train**, select that date, change its check-in and save. Do not delete Safari site storage to fix a number. Physical Safari and actual saved-data checks are pending.

## V15.11.2 · iPhone acceptance companion

**New:** [Open the QA checklist](https://togglehardestmode.github.io/Fitness/preview-v101/qa.html?v=41) from Tools. It contains ten operator-scored checks (Pass / Fail / Blocked / Not run), retains answers in page memory only and exports a structured JSON report on explicit button press. It does not read or mutate workout records or transmit the report. Reloading loses unsaved checklist marks. Do not test restoration over your real records; mark Blocked if no empty disposable browser context is available.

Workout and training behavior remains unchanged; V15.13 adds only a read-only breakdown of recorded daily inputs alongside the existing QA checklist. This is a proposed public Pages URL from the GitHub preview source; live served and on-device acceptance are still pending.

## Quick acceptance walkthrough

Use disposable example data and **do not clear browser website data**:

1. Confirm the preview banner shows **V15.13**.
2. Under **Plan**, choose **Add V10.2 Home templates** and verify four sessions/24 exercise entries/62 prescribed weekly sets. An additional **V10.1 Home** import remains available.
3. Confirm that both lower workouts retain **[PT Review]**, and that importing never assigns them to weekdays automatically.
4. Under **Train**, log a sample upper-body set. Verify the gold **Total completed sets** and weekly total rise once, the daily chart updates, and **Next milestone** updates by one. Editing the same set must not add another. Milestones are 25, 50, 100, 250, 500, 1,000 and then every 500; they do not prescribe more training. Weight × reps remains secondary under **Show calculation**. Timed holds count as sets but not kg × reps.
5. Verify both **Days with logs** counters show dates with saved valid working sets; a warm-up-only day must not count. Then try **Focus Mode** and, on an eligible unsaved next set, **Copy saved set**. It must copy only weight and repetitions; RPE and saving remain explicit.
6. In the **Plan → Workout Library**, select **Customize** and **Save as new workout version** with one safe test change. The original workout and saved history must remain unchanged; the new version should remain unassigned until you choose it.
7. Under **Tools → Workout logbook**, expand a session and confirm it uses the original workout version. **Download full history (.csv)** to a private location; verify the file contains all saved sets, even if only the latest 15 sessions are shown on-screen.
8. In **Tools**, download a JSON backup before changes. Select **Check downloaded backup (.json) — no restore** to validate the selected file and see set/template counts without changing any saved data. **Check saved data integrity** only verifies the current browser snapshot; actual file restore and offline use still require separate testing with disposable records.
9. Confirm existing sound, rest timer, recovery journal, and manually set assignments still work.

If the banner does not show V15.13, verify the link and cache version without clearing local storage. Stop and report unexpected changes to logged records, exercises, assignments or PT warnings.

## Known release boundaries

- The historical logbook was merged through [PR #28](https://github.com/ToggleHardestMode/Fitness/pull/28). V15.13 also enforces valid weekly set numbers and aligns both Dashboard day counters with saved working sets. A GitHub merge **does not** prove the latest GitHub Pages response has been fetched by every browser.
- The preview uses localStorage key `fitnesspilot.preview.v101.v1`; the older root production uses `fitnesspilot.web.v1`. Both share a host origin but use separate app data keys.
- Lower-body physiotherapist review remains required. Symptom observations and overlap coefficients are **not** medical clearance.
- No remote sync, live workout upload or guaranteed closed-app notification is implemented.
- Actual iPhone Safari acceptance, exported JSON-file recovery on a second device, offline navigation and complete native `npm test` execution on the current repository remain outstanding. Synthetic JSON serialization and browser-snapshot checks do **not** prove a real downloaded backup can be restored.

## Developers

At the repository root, run a local HTTP server:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000/preview-v101/` and then run:

```powershell
npm test
```

The scripted tests are defined in [package.json](../package.json) and include preview source and regression checks. These tests complement—not replace—the manual browser checks above.

For canonical workout data and coefficients, consult the [template documentation](../templates/README.md). For overall installation, backups and the separation between production and preview, consult the [root README](../README.md). Keep private workout logs and personal health history out of the public Git repository.
