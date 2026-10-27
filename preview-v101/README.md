# FitnessPilot V15.20.1 — Nutrition quick links at top of Dashboard (preview only)

**Main preview:** https://togglehardestmode.github.io/Fitness/preview-v101/?v=54

User-requested navigation refinement: the Dashboard now displays visible **Nutrition** and **Cheatsheet** buttons immediately under its top heading, before the character and weekly summary. The actions link directly to `nutrition.html` and `nutrition-cheatsheet.html`. On phones the shortcuts form a two-column row with 48px-minimum tap surfaces; on larger screens a compact horizontal row. Existing lower Dashboard nutrition card and all previous tabs remain unchanged.

**Safety / scope:** Preview only. No changes to workout/food logs, app save/restore, server state, supplements, vitamin references or nutrition targets. Offline cache bumped to V15.20.1 so links point to cached existing pages. No new service-worker resources required.

**Verification:** Source-level checks verify top-of-dashboard placement, two link destinations, 48px buttons, mobile CSS, V15.20.1 page labels and both targets in SW precache. Added `tests/top-nutrition-links.test.mjs`; full checkout `npm test`, actual GitHub Pages and iPhone tap/appearance remain separately unverified until operator acceptance.

**User check:** Open main preview `?v=54`, confirm Nutrition and Cheatsheet appear without scrolling and both open their correct pages. Check return to Dashboard and that the Food Diary and workout data are unchanged. Do not clear site storage to refresh.

---

# FitnessPilot V15.20.0 — FP-39 visual polish + vitamin reference units (preview only)

**Main preview:** https://togglehardestmode.github.io/Fitness/preview-v101/?v=53  
**Nutrition reference / converter:** https://togglehardestmode.github.io/Fitness/preview-v101/nutrition-cheatsheet.html?v=53  
**Food Diary:** https://togglehardestmode.github.io/Fitness/preview-v101/food-diary.html?v=53

**FP-39:** A final, original CSS layer (`fp39-dark-fantasy.css`) refines warm-gold outlines, deep-blue/plum translucent panels, press feedback, keyboard focus, table legibility and 390–420 px mobile spacing. It applies on the preview dashboard, Nutrition Journey, Food Diary and cheatsheet; preserves the existing DOM, avatar elements and all app/storage schemas. No external fonts, copyrighted game images, runtime dependencies or audio behavior changed. Subjective design acceptance and Safari layout remain for the operator.

**Vitamin unit module:** The Nutrition Cheatsheet now has an explicit **Singapore vs International/North American DRI selector** showing 13 vitamin reference amounts for healthy adult men, with source badges and fallback labels where a Singapore vitamin RDA is not published on HealthHub. Source: [Singapore HealthHub](https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/recommended_dietary_allowances), [Canada/US DRI](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html), [unit conversion factors](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html). A separate converter supports mg/µg, vitamin D IU/µg, A source-dependent IU→RAE, E natural/synthetic IU→mg and dietary-context folate→DFE. SG Vitamin A RE and international RAE are **not** blindly converted. Different reference intakes are comparisons, not unit transformations.

**Scope:** Static informational reference only: no food-log micronutrient measurements, no supplements or dosage instructions, no personalized nutrient prescriptions, no R0–R6 automation. User-reported P0 complete, P1 in progress; this source patch does not itself recertify P0 tests. Production root unchanged.

**Suggested operator acceptance:** Open main preview and check legible cards, buttons, focus and no overlapping character at 375px and desktop. Open Cheatsheet → switch SG/International; check D SG 2.5 µg (100 IU) versus international 15 µg (600 IU), A 750 µg RE versus 900 µg RAE; enter 600 vitamin-D IU and confirm 15 µg. Check food diary still saves edits and no browser data is cleared. No full iPhone/source-to-Pages acceptance has been inferred from a GitHub merge.

**Developer QA:** `npm test`; `node scripts/verify-preview-assets.mjs`; test vitamin units; confirm preview cache and JavaScript module graph. Full checkout/native suite and device QA may require a connected development environment.

---

# FitnessPilot V15.19.2 — Daily Food Diary quick-repeat extension (preview only)

**Diary page:** https://togglehardestmode.github.io/Fitness/preview-v101/food-diary.html?v=52  
**Main preview:** https://togglehardestmode.github.io/Fitness/preview-v101/?v=52

The existing V15.19.1 food diary already supports local-only meal, snack and drink entry; per-serving calories, protein, carbohydrate and fat; editing and deletion/undo; separate JSON export and empty-diary restore; offline Singapore food lookup; and a separately labelled calorie chart. **New in V15.19.2:** the diary now shows up to eight unique previously recorded meals/snacks/drinks from earlier dates, in most-recent order, with a one-tap **Repeat on this day** button. Repeated events have fresh IDs and copied nutrition/serving snapshots. The old record is not changed; the copied portion is editable.

No new storage key/schema or import migration, no workout or Daily check-in modification, no automatic copying of manual calorie totals and no nutrition target activation. Recent history is derived from the existing separate Food Diary backup data; there is no unbacked-up favourites key. Historical diary backups remain v1 compatible. Previous local days are not deleted.

**Suggested iPhone check (synthetic data only):** Record an example meal on an earlier date; select today's date; check the **Repeat recent saved foods** panel; tap Repeat once, inspect one new food and derived totals; edit its portion and verify the past meal did not change; export JSON; restore it into an empty disposable diary in a separate clean browser context and confirm values. Open Dashboard and Daily check-ins to verify separate totals and unchanged workouts. Never clear real Safari site data just to test.

**Verification boundary:** Added Node test cases for deduplication, chronological filtering, copied snapshots, fresh IDs, null nutrients and backup compatibility. Actual Node runner, published Pages delivery, offline reload, iPhone Safari controls and full backup restore remain distinct gates and must not be inferred from GitHub source/PR alone.

---

# FitnessPilot V15.16 — Batch 3A nutrition and weight preview

**Test URL:** https://togglehardestmode.github.io/Fitness/preview-v101/?v=44
**Read-only Nutrition & Weight Journey:** https://togglehardestmode.github.io/Fitness/preview-v101/nutrition.html?v=44

Batch 3 has been prioritized ahead of the remaining roadmap. This first implementation slice provides an isolated read-only page. It reads existing preview daily metrics from `fitnesspilot.preview.v101.v1`, displays observed calories/protein for the current week and an honest 28-day recorded-weight plot. Optionally select your private Nutrition v1.1 `nutrition_targets.json` file from iPhone Files to compare recorded data with flat or weekday/weekend reference targets. The file and targets live in tab memory only. Nothing writes to saved state or changes targets. If source storage is unreadable, the page does not replace it. Carbs, fats, fibre, waist and physique media are not yet in the persisted schema.

Manual iPhone acceptance: (1) confirm V15.16 banner on Dashboard, (2) open Nutrition & Weight Journey, (3) check that existing Daily check-ins appear, (4) select the private reference JSON, (5) change flat/cycle, (6) confirm missing dates show Not recorded, (7) navigate back and confirm workouts/records unchanged, (8) reload the journey and confirm reference is no longer selected, (9) test with disposable exported data if possible. Do not clear site data to refresh.

Native focused check: `node --test tests/nutrition-journey.test.mjs`. Full suite: `npm test`; source/asset graph: `node scripts/verify-preview-assets.mjs`.

**Not yet implemented:** manual carb/fat/fibre logging and migration, R0–R6 advisory display, nutrition export, strength/waist/photo histories, physical transformation stages. Continue in separate bounded Batch 3 steps following operator device acceptance. No production-root update.

---

# FitnessPilot V15.15.3 — test preview

**Test URL:** https://togglehardestmode.github.io/Fitness/preview-v101/?v=43

The folder is still named `preview-v101` for continuity; the application banner and manifest currently identify **V15.15.2**. It is a separate preview application, **not** the production root upgrade.

## V15.15.3 · One character layer and isolated walking frames

The user reported two overlapping bodies and a backwards-looking walk. The old Dashboard markup used *two* on-screen character images: private WebP and generic fallback. V15.15.3 replaces both with one image element that swaps sources after preload; on reduced motion it displays a private still on the same element. Loading failures keep the original fallback. Only a single image can occupy the translucent platform; no training/storage schema changes.

The private replacement file `FitnessPilot_walk_v3_clean.webp` is provided directly to the operator and **not** committed to GitHub. It is assembled from the supplied right-facing sprite sheet: one largest connected human silhouette per frame, eight aligned frames with no horizontal mirroring or inter-frame compositing, 125ms per frame, WebP below the app's 600KB cap. Source poses remain limited for a fully articulated opposite-leg gait; subjective perception still requires review.

**Acceptance:** Confirm V15.15.3 in Safari, inspect default single character, download replacement WebP privately, Tools → Walking avatar → Choose WebP → Apply, and return to Dashboard. Confirm no second body, fixed location, and visible rightward-facing movement. Reduce Motion must show one still, never stack images. Existing workout records are untouched.

## V15.15.2 · Show your avatar even with Reduce Motion

User-supplied screenshot establishes the selected avatar was saved but device `prefers-reduced-motion: reduce` caused the app to replace it with the **generic** static adventurer by design. New behavior: when Reduce Motion is active and a private WebP is present, capture one personal WebP frame to a temporary in-memory PNG using Canvas and display it on the stationary stage. Nothing is uploaded or added to workout or avatar storage. When Reduce Motion is off, the six-frame walk plays as before. If conversion fails, retain the generic fallback with an explicit message.

Windows: Settings → Accessibility → Visual effects → Animation effects → On to allow walking. iPhone: Settings → Accessibility → Motion → Reduce Motion → Off. No browser cache/site-data clearing or reimport is needed just for the motion preference.

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

**New:** [Open the QA checklist](https://togglehardestmode.github.io/Fitness/preview-v101/qa.html?v=43) from Tools. It contains ten operator-scored checks (Pass / Fail / Blocked / Not run), retains answers in page memory only and exports a structured JSON report on explicit button press. It does not read or mutate workout records or transmit the report. Reloading loses unsaved checklist marks. Do not test restoration over your real records; mark Blocked if no empty disposable browser context is available.

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

## Read-only metric dictionary v1 — preview source, no UI activation

**Status:** Calculation contract and selectors only. `metric-dictionary.js` documents 10 versioned KPI definitions (food kcal/protein, manual kcal/protein, observed 7-day weight, weekly saved sets, kg×reps, scheduled working-set progress, food-logging coverage and explicitly unavailable nutrition adherence). `metric-selectors.js` computes them from caller-provided workout and Food Diary snapshots. It **does not import browser storage**, write records, update dates, change nutrition targets, activate diet rules or render any new UI.

The selectors reuse existing `food-diary-core.js` quantity/nutrient validation and `training-analytics.js` working-set/hold/warm-up/off-plan counting. `dailyNutritionMetrics(workoutState,diary,date)` displays manual daily check-ins and meal-derived known totals as **separate** values, never adds them; reports null for no known-value meals and retains unknown-food counts. `sevenDayWeightMetric(workoutState,endDate)` divides by **actual measured readings** and supplies dates/count. `weeklyTrainingMetrics(workoutState,anchorDate)` returns true counted saved sets, conditional kg×reps (null if all sets are timed holds), and scheduled-set progress (null when no plan). `sevenDayFoodCoverage(diary,endDate)` measures recording presence, not completed nutrition tracking or calorie-target adherence.

**Test inventory:** `tests/metric-dictionary-v1.test.mjs` has 15 adversarial cases spanning exact data contracts, nullable values, independent sources, per-serving maths, date inclusion, weight sample count, dedup/warm-ups, timed holds/off-plan, null denominator, and pure read-only operation. On 28 Oct 2026, all 15 passed in an isolated V8 test harness constructed from fetched exact GitHub source; this is **not** a claim that native repository-wide `node --test` / `npm test` ran. Full native suite and browser/iPhone integration remain separate release gates.

**Next approved scope, separately:** Integrate these read-only selectors into actual Dashboard/Nutrition views behind correct source labels and drilldowns; do not combine `metrics.calories` and Food Diary values, automatically declare nutritional adherence, rewrite stored records, add storage migrations, or promote to production merely because this registry is available.

