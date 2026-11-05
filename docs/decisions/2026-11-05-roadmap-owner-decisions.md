# FitnessPilot Roadmap — Owner Decisions 1–8 (2026-11-05)

**Status:** DECIDED — recorded for planning. **Implementation pending for every item unless marked Done.**

**Decision owner:** Product owner (user)
**Decision captured:** 2026-11-05 (Asia/Singapore)
**Change type:** Documentation / product decision only. No app code, templates, saved records, backups, PRs or deployments were changed by this note.

## Decisions

| # | Topic | Decision | Roadmap items | State |
|---|---|---|---|---|
| 1 | Sync | No two-way sync. Build a local, passphrase-encrypted backup file. The phone is the single logging device; the PC stores verified backups only. | B054–B065, new B110 | Encrypted backup **not implemented** — current exports are plain JSON |
| 2 | V10.3 | V10.3 is the target program and becomes the default for new sessions once imported. V10.1/V10.2 stay archived but selectable. Later changes become V10.4; V10.3 is never edited in place. | B015, B038, B039 | V10.3 **not yet in source** |
| 3 | Locked-screen alarm | No native wrapper. The persistent on-screen alert (B032) is the rest alarm. Web sound when locked/backgrounded is not guaranteed and must not be described as guaranteed. | B002, B032, B035, B036 | Countdown already timestamp-based; device test pending |
| 4 | Open PRs | Close superseded PRs; keep #59 (test fixtures) and #61 (missing-vs-zero food logic) for rebase and review. Port the tracking-reset fix from #62. Park `device-merge.js`. | B093, B094, new B111 | **Done:** #6–#9, #57, #60, #62 closed unmerged, branches kept |
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
- Progression keeps the existing gates in `manual-progression.js`: two recorded top-of-range sessions, RPE ≤ 8 and a recorded recovery score ≥ 4; no automatic load change. Volume increases only when performance, recovery and symptoms support it — no fixed weekly schedule.

## Release gates (B101)

1. Run B103 (30 synthetic set entries) before changing the logging UI.
2. Validate imported V10.3 set totals, exercise identities, units and PT-review flags.
3. Test renamed-exercise history continuity without altering original records.
4. Test encrypted export and clean restore, including wrong-passphrase and corrupted-file rejection.
5. Verify tracking reset clears the journey start date without deleting templates or assignments.
6. Run native regressions; rebase and review PRs #59 and #61.
7. Verify timer, optional wake lock, storage and backup workflow on a real iPhone.
8. Confirm rollback and get explicit owner approval before promotion.
9. Immediately before promotion, export a backup of real data and confirm it restores in a clean browser profile.
10. Confirm the live app shows the new version label on the owner's iPhone (B004).

## Out of scope

- Two-way sync or automatic cross-device merging (revisit only on explicit request).
- Native app wrapper or guaranteed locked-screen alarm.
- New RPG/cosmetic features before the 4-week measurement.
- Any automatic clearance of lower-body loading.

## Next review trigger

V10.3 import, B110 encrypted-backup design, or the end of the 4-week cosmetic measurement — whichever comes first. Update this note with commit IDs and evidence when implemented.
