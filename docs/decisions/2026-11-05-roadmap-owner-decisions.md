# FitnessPilot Roadmap — Owner Decisions 1–8 (2026-11-05)

**Status:** DECIDED — recorded for planning. **Implementation pending for every item unless marked Done.**

**Decision owner:** Product owner (user)
**Decision captured:** 2026-11-05 (Asia/Singapore)
**Change type:** Documentation / product decision only. No app code, templates, saved records, backups, PRs or deployments were changed by this note.

## Decisions

| # | Topic | Decision | Roadmap items | State |
|---|---|---|---|---|
| 1 | Sync | No two-way sync. Build a local, passphrase-encrypted backup file covering both the workout store and the separate Food Diary store. The phone is the single logging device; the PC stores verified backups only. | B054–B065, new B110 | Encrypted backup **not implemented** — current exports are plain JSON |
| 2 | V10.3 | V10.3 is the target program and becomes the default for new sessions once imported. V10.1/V10.2 stay archived but selectable. Later changes become V10.4; V10.3 is never edited in place. | B015, B038, B039 | V10.3 **not yet in source** |
| 3 | Locked-screen alarm | No native wrapper. The persistent on-screen alert (B032) is the rest alarm. Web sound when locked/backgrounded is not guaranteed and must not be described as guaranteed. | B002, B032, B035, B036 | Countdown already timestamp-based; device test pending |
| 4 | Open PRs | Close superseded PRs; keep #59 (test fixtures) and #61 (missing-vs-zero food logic) for rebase and review. Implement a new tracking-reset fix for the current `strengthJourneyStartDate` field, preserving templates and assignments. Park `device-merge.js`. | B093, B094, new B111 | **Done:** #6–#9, #57, #60, #62 closed unmerged, branches kept |
| 5 | Keep screen awake | Optional toggle, on only during an active workout, released on finish or leaving the app. Drop if unreliable on the owner's iPhone. | B034 | Pending |
| 6 | RPG / cosmetics | Freeze expansion. Keep existing cosmetic features optional. Measure for 4 weeks (adherence, logging completeness, logging time) before investing further. | B089–B091 | Measurement pending |
| 7 | Exercise matching | Owner-approved equivalence map for same-movement renames only. Genuinely new movements get new exercise IDs. No automatic matching; historical records never rewritten. | B042, B073 | Requires new code: `strength-journey.js` currently keys on `templateId` + `exerciseIndex` |
| 8 | Preview → production | Adopt the release gates below. | B101 | Gates defined; none executed |

## V10.3 programme summary

- Four days: Upper A, Lower A, Upper B, Lower B.
- Upper target: **37 working sets/week** (Upper A 17, Upper B 20), reached gradually. This supersedes the earlier 33-set and 26-set drafts, which remain historical evidence only.
- Changes from the draft: restored lateral-raise and arm sets; lean-in DB lateral raise; DB preacher hammer curl; neutral close-grip pulldown (Upper A) and one-arm pulldown (Upper B), each optionally supersetted with a 2-set press.
- Fallback if sessions run long: remove one set from Upper A's chest-supported lat-bias row and one from Upper B's one-arm DB row (35 sets).
- Lower days: new exercise list is a **future target under [PT Review]**. Current lower sessions continue until each new loaded movement is individually cleared; introduce one at a time. A symptom-free period is not clearance.
- Progression: each function's existing rules stay **unchanged** unless explicitly revised. The two implementations differ:
  - **`manualProgression`** (`manual-progression.js`, per set): no suggestion for PT-review or timed-hold exercises; requires a recorded recovery score ≥ 4 for the day, no concerning symptoms and complete before/after/next-day observations; prior reps within the target range with RPE recorded and ≤ 8. Below the top of the range it offers a same-weight +1 rep candidate; a load review is flagged only after two top-of-range sessions at the same weight with complete observations, and the owner chooses the increment manually.
  - **`recommendNextExercise`** (`strength-journey.js`, whole exercise): no suggestion for PT-review or timed-hold exercises, or when concerning symptoms are recorded; holds if working sets are incomplete, any set has unstable technique or `too_hard` difficulty, RPE is missing or > 8, observations are incomplete, the day's recovery score is missing or < 4, reps fall outside the range without verified low-effort feedback, or sets used different loads. Below the top of the range it suggests +1 rep per set, or up to +2 when every set was marked `too_easy` at RPE ≤ 6. A kilogram target requires two complete, comparable top-of-range sessions and a selected increment (0.5, 1, 2, 2.5 or 4 kg).
  - Neither function fills or saves a set automatically.
- Volume increases only when performance, recovery and symptoms support it — no fixed weekly schedule.

## Release gates (B101)

Feature-specific gates (marked *if*) apply only to releases that contain that feature.

**Baseline — before any logging-UI change (once):**
1. Run B103 (30 synthetic set entries) and record completion time, taps, corrections and missed sets.

**Pre-release — every promotion candidate:**
2. Run native regressions on the exact commit (B095).
3. *If V10.3 is included:* validate imported set totals, exercise identities, units and PT-review flags.
4. *If exercise matching is included:* test renamed-exercise history continuity without altering original records.
5. *If encrypted backup is included:* clean-profile restore with the passphrase typed from memory; wrong-passphrase and corrupted-file rejection; restored records match for both workout and Food Diary stores.
6. *If tracking reset is touched:* verify the journey start date is cleared and templates/assignments survive.
7. *If timer, wake lock, storage or backup code is touched:* verify on a real iPhone.
8. Export a backup of real data (both stores) and confirm it restores in a clean browser profile.
9. Confirm the rollback path and get explicit owner approval.

**Post-release — after promotion:**
10. Confirm the live app shows the new version label on the owner's iPhone (B004) and that a backup export still works.

Rebase and review of the two retained implementation PRs, #59 and #61 (B094), is tracked separately and is not a per-release gate.

## Out of scope

- Two-way sync or automatic cross-device merging (revisit only on explicit request).
- Native app wrapper or guaranteed locked-screen alarm.
- New RPG/cosmetic features before the 4-week measurement.
- Any automatic clearance of lower-body loading.

## Next review trigger

V10.3 import, B110 encrypted-backup design, or the end of the 4-week cosmetic measurement — whichever comes first. Update this note with commit IDs and evidence when implemented.
