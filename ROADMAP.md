# FitnessPilot — Master Development Backlog (109 tasks)

Date: 2026-11-03 SGT (reconciled 2026-11-05 SGT)
Sources: FitnessPilot's public source and preview release history, associated pull requests, and a separate internal planning audit. No personal training records or internal conversations are reproduced here.
Status: **planning/inventory only**. No app configuration, saved workout records, backup files, or production behavior are modified by this documentation.

## What the audit established

- Latest preview merged as V15.22.2; PR #67 merged at `9c130eb5d48b32ec42bad8af761ef1b8d7a45980`. Previous compact Strength Journey PR #66 and progress import PRs are also merged. Preview URL: https://togglehardestmode.github.io/Fitness/preview-v101/?v=59.
- Preview source already implements floating rest timer, separate completion overlay, readable quick effort labels, Strength Journey, V10.2 versioned template and recovery tracking, logbook, CSV completed-set import, nutrition/diary features, and download backups. **Implemented in source does not equal verified on iPhone.**
- Nine open public-repo PRs observed; relevant later PRs #62, #61, #60, #59, #57 plus older #9–6. No open issues returned by repository search. Reconcile branch overlap before further merges.
- Current release's 9 focused V8 source-behavior checks passed historically and merged source was read back; latest native whole-repo Node `npm test` and physical iPhone audio/cache/backup acceptance remain unverified.
- The app is static GitHub Pages and keeps private workout data locally. Public GitHub repo is inappropriate for uploading raw private records or embedding access tokens. Cross-device sync remains deferred; manual backup is not sync.
- The most important usability risks are many selectable template versions, a Plan/Train/Library distinction users have struggled with, misleading numeric effort without explanation, and missing end-to-end device acceptance.

## Priority meanings

- **P0:** Must protect current records, safety boundaries and verify releases before any automatic sync or irreversible migration.
- **P1:** Primary daily logging friction, timer usability, program clarity, data semantics, progression gates.
- **P2:** Valuable expansion, reports, nutrition, accessory features and test depth after core workflow works.
- **P3:** Optional RPG/cosmetic/advanced experiments; not prerequisites for effective training.

## P0 — data safety, triage and acceptance

| ID | Work item | Current state |
|---|---|---|
| B001 | Accept V15.22.2 on real iPhone: timer visible in Train, toggles, 90s countdown, overlay legibility, no navigation obstruction | Pending device |
| B002 | Test sound device volume/Silent Mode/foreground/locked/background; document that web sound is not guaranteed | Pending device |
| B003 | Run and record complete native npm test suite on current main commit | Not run latest |
| B004 | Confirm served Pages version, offline install/update and stale-cache behavior on physical device | Pending device |
| B005 | Create disposable backup export->validate->restore on separate empty browser profile, no real data overwrite | Pending |
| B006 | Verify imported backup preserves set records, source notes, program versions, assigned days, feedback and symptom schema | Pending |
| B007 | Ensure completion/undo/export never silently overwrite, duplicate or invent training history | Ongoing invariant |
| B008 | Audit consent/privacy for any training or health-like records before any backend, analytics or syncing feature | Pending |
| B009 | Let users suspend or exclude any exercise that causes a concerning response; do not diagnose symptoms or imply medical clearance | Proposed safety design |
| B010 | Document user-facing stop/hold and symptom-entry prompts for unusual exercise responses, without diagnostic automation | Proposed safety design |

## P1 — make the app understandable in under 30 seconds

| ID | Work item | Current state |
|---|---|---|
| B011 | Provide a single Today / Start workout entry point instead of requiring users to understand Plan vs Library vs Train first | Proposed |
| B012 | Show currently selected program and active version prominently on Train/Today | Proposed |
| B013 | Show assigned day, optional manual workout choice, and clear difference between a plan and a completed session | Proposed |
| B014 | Reduce overlapping templates via safe archive/hide, never delete records or silently merge exercise identity | Proposed |
| B015 | Make choosing V10.2/V10.3/V10.1 opt-in and explain archived, planned and active program statuses | Proposed |
| B016 | One active exercise and one active set, quick weight/reps entry, unmistakable Save action | Partly present Focus Mode; optimize |
| B017 | Improve exercise picker's layout and one-hand access without creating accidental saves | Proposed |
| B018 | Offer Save Set -> Rest -> Next Set flow as a user-selectable shortcut, without starting timers on failed saves | Proposed |
| B019 | Replace RPE/RIR on primary surfaces with Easy/Moderate/Hard/Very Hard and reps-left explanation | Partly implemented V15.22.2 |
| B020 | Prevent historic low or inconsistent numeric RPE values from triggering unjustified load advice; preserve raw value and mark uncertainty | Proposed |
| B021 | Reduce redundant difficulty, effort and technique inputs; progressive disclosure for optional notes | Proposed |
| B022 | Clearly label per-dumbbell kg vs total kg and timed seconds/side vs reps | Proposed |
| B023 | Add prominent Undo recent saved set with record identity and confirmation semantics | Proposed |
| B024 | Make Plan CSV template import vs Train completed-sets CSV import visually distinct | Partly exists; UX pending |
| B025 | Show import preview, duplicate/rejected row outcomes and when a new template is not yet assigned | Partly exists; UX pending |
| B026 | Explain training abbreviations in-context (DB, RPE, RIR, ROM, PT Review, SS1) | Proposed |
| B027 | Audit font legibility on physical 320/390/428px devices; avoid solving complexity by making all text 10px | Pending device |
| B028 | Test timer/widget accessibility (focus, modal semantics, VoiceOver, dynamic type, reduced motion, safe-area occlusion) | Pending device |

## P1 — timer, notification and audio reliability

| ID | Work item | Current state |
|---|---|---|
| B029 | Finish V15.22.2 manual acceptance for hovering floating timer and translucent finished overlay | Implemented source; device pending |
| B030 | Test Test Sound on real Safari; independently configure rest alert and optional long slime button sound | Partly implemented |
| B031 | Make rest-duration choice easy to edit from current exercise without navigating to Tools | Implemented preview, verify UX |
| B032 | Display end-of-rest alert until acknowledged even when audio was blocked | Implemented source; device pending |
| B033 | Show sound-muted and background-alert limitations visibly but concisely | Implemented source; copy review |
| B034 | Evaluate optional keep-screen-awake feature only with platform support and battery safeguards | Research |
| B035 | Explore OS-managed notifications or optional native wrapper only if real locked-screen alarm is essential | Deferred |
| B036 | Compare timestamp-based countdown vs delayed/background timer behavior on actual iOS | Pending device |
| B037 | Avoid duplicate squish MP3 playback over end-of-rest cue | Implemented source; device pending |

## P1 — workout program and progressive training

| ID | Work item | Current state |
|---|---|---|
| B038 | Finalize V10.3 as new selectable program; preserve V10.2 and earlier versions | Draft pending |
| B039 | Create upper A/B phased working-set templates with exact ranges, rest and optional readiness hold | Draft pending |
| B040 | Keep light Lower A/B main muscular work with selected adjunct trunk/mobility only where tolerated | Draft pending |
| B041 | Retain normal lower lifts as future goals, not automatic instruction to load previously provocative exercises | Draft guard |
| B042 | Make exercise-specific substitutions and versioned templates (e.g., sit-to-stand for squat role) without rewriting history | Versioning exists; mapping pending |
| B043 | Allow skipped/contraindicated/optional exercises without generating a failure or fake completed set | Proposed |
| B044 | Record actual load, reps, rest, effort, technique and exercise-level response only when supplied | Partly exists |
| B045 | Show simple next-session suggestion with why and explicit Accept/Skip; do not auto-enter a planned set | Implemented preview; device pending |
| B046 | Enforce missing next-day/48-hour feedback = unknown rather than recovered | Implemented source; verify |
| B047 | Make training dose advancement repeatable and one-variable-at-a-time; distinguish muscle progress from exercise tolerance | Proposed |
| B048 | Limit loaded squat/hinge progression advice without assessment; retain non-diagnostic boundaries | Existing PT review, refine |
| B049 | Allow deload or repeat-week logic when fatigue or performance warrants, without calendar-forced jumps | Proposed |
| B050 | Separate planned weekly sets from actual sets, and direct vs indirect muscle contributions | Partially implemented |
| B051 | Require explicit user selection and review of exercise tolerance before adding more demanding accessory movements | Proposed |
| B052 | Add exercise instruction cards with plain form cues, alternatives and safety notes rather than excessive jargon | Proposed |

## P1/P2 — calendar reminders and one-way scheduling

| ID | Work item | Current state |
|---|---|---|
| B105 | Stabilize existing one-time .ics workout reminder export with deterministic event UIDs and explicit re-export/duplicate-import behavior; FitnessPilot remains schedule authority | Existing .ics export; UID stability not implemented |
| B106 | Validate calendar-export time zone, recurring dates, duration, alert lead time and privacy-safe event content in Apple/Google/Outlook clients, including real-device acceptance | Pending real calendar-client testing |
| B107 | Consider explicitly authorized one-way Google Calendar publishing or a revocable private subscription feed, with least-privilege access, idempotent updates, disconnect/status and no external writeback to saved workouts | Deferred option; not built; two-way integration KIV |

## P1/P2 — storage, backup and genuine two-device sync

| ID | Work item | Current state |
|---|---|---|
| B053 | Keep offline local working state as source of in-session speed and resilience | Current architecture |
| B054 | Define stable record IDs, created/edited timestamps, schema version, origin-device ID and explicit deletions/tombstones | Sync design needed |
| B055 | Define idempotent two-device merge, duplicate prevention, deterministic conflicts and manual resolution | Sync design needed |
| B056 | Specify how an offline phone and PC reconcile edits to the same set, template, schedule or daily entry | Sync design needed |
| B057 | Decide whether backed-up health-sensitive observations are in scope; minimize data by default | Privacy design needed |
| B058 | Compare managed backend/auth providers vs encrypted private cloud file vs private GitHub snapshots | Research decision |
| B059 | If using GitHub backups, private encrypted files only; never embed tokens in public GitHub Pages JavaScript | Not implemented |
| B060 | Build connection/authentication with revocation, least privilege and no visible/committed secrets | Not implemented |
| B061 | Test lossless export->sync->restore, offline edits, conflicting edits, reconnect and interrupted writes | Not implemented |
| B062 | Show last sync success/failure and local-unsynced counts without falsely implying server success | Not implemented |
| B063 | Preserve downloadable self-contained JSON and CSV exports regardless of remote provider | Current invariant |
| B064 | Add emergency read-only export even when UI partially fails, with validation and operator recovery instructions | Proposed |
| B065 | Measure sync provider cost, limits, retention and maintenance before choosing architecture | Research |

## P2 — charts, analytics and progress history

| ID | Work item | Current state |
|---|---|---|
| B066 | Accept compact Strength Journey against approved visual on physical phone, not an approximate fixture | V15.22.1 source implemented; pending |
| B067 | Verify saved-only Day 1, working-set chart points, max kg, reps and effort provenance with multiple sessions | Source tests done; device pending |
| B068 | Expose data labels/drilldowns for muscle volume and direct/indirect set math | Metric dictionary partially implemented |
| B069 | Wire source-aware metric dictionary to Dashboard and handle stale/missing values explicitly | F-078 partial |
| B070 | Add read-only 7-day weight trend and 28-day graph with recorded daily weigh-ins, moving average, optional targets | F-038 unbuilt |
| B071 | Make 4-week deficit evidence review only after enough dated food/weight data exists, not inferred compliance | F-067 unbuilt |
| B072 | Avoid fake progress from planned sets, duplicate templates, warmups, seconds holds or generated examples | Required invariant |
| B073 | Improve comparison across renamed/versioned exercises using explicit user-approved equivalence map | Proposed |
| B074 | Provide personal bests by exercise and rep range with form/effort context, no automatic promotion of a single anomalous set | Proposed |
| B075 | Separate strength trend, training adherence, bodyweight trend and body composition inference | Proposed |

## P2 — nutrition / food diary

| ID | Work item | Current state |
|---|---|---|
| B076 | End-to-end disposable Food Diary backup import and recovery roundtrip | F-069 pending |
| B077 | Review open PR #61 for read-only seven-day missingness vs recorded-food interpretation | Open PR |
| B078 | Review open PR #59 for synthetic Playwright Food Diary + workout fixtures | Open PR |
| B079 | Accept existing 28-day calorie and macro graphs with unrecorded-vs-zero distinction | Source implemented; device pending |
| B080 | Verify Singapore 40-food search, portion units, corrections and saved-food repeat on real phone | Source implemented; device pending |
| B081 | Verify vitamin Singapore/international reference and unit normalization provenance | Source implemented; device pending |
| B082 | Review separate Nutrition and Cheatsheet actions in open PR #57; avoid duplicating current shortcuts | Open PR |
| B083 | Add clear edited-food audit and missing nutrient handling before advanced nutrition analytics | Proposed |
| B084 | Keep unverified calories and unrecorded meals distinct; never infer complete day from one logged meal | Required invariant |

## P2/P3 — style, game mechanics and accessibility

| ID | Work item | Current state |
|---|---|---|
| B085 | Accept dark-fantasy/Ragnarok look against selected visual while keeping typography readable | Partial source, device pending |
| B086 | Verify optional audio/haptic preferences and accessible labels, not sound-only confirmation | Pending device |
| B087 | Verify walking avatar render/animation reduced-motion fallback and image import on device | Source implemented, past issue |
| B088 | Keep set-save visual slime reaction optional, only after persisted new set, no phantom rewards | Implemented preview; device pending |
| B089 | Consider user-controlled cosmetic Adventure Mode with no pay-to-win/randomized monetization | F-046–F-050 deferred |
| B090 | Consider optional avatar roster and Physique Journey only after core reliability | F-019/F-020/F-062 deferred |
| B091 | Evaluate compact logger versus RPG view with task-time and error-rate comparison | F-051 and research pending |
| B092 | Check color contrast, safe areas, keyboard screen-reader labels and reduced-motion across main pages | Pending QA |

## P2 — code maintenance and release hygiene

| ID | Work item | Current state |
|---|---|---|
| B093 | Rebase/close superseded open PRs instead of merging overlapping branches blindly (#62/#60/#57 and older #6–9) | Open PR triage |
| B094 | Review independent worker PR #61 and browser fixture PR #59 against latest source and owner | Open PR triage |
| B095 | Run full npm test and dependency-free Node regression on exact merged main revision | Pending current revision |
| B096 | Add integrated browser smoke for Train/Timer/Plan/Import/Backup/Offline with disposable fixtures | Pending |
| B097 | Test 320/390/428px viewport on live served Pages including full CSS cascade | Pending device/browser |
| B098 | Test service worker upgrades, old caches and localStorage persistence over preview versions | Pending |
| B099 | Verify source/test/asset consistency and no preview-only imports leaking into production root | Pending |
| B100 | Keep small PRs with exact SHA, reported synthetic versus live checks, and device acceptance | Required workflow |
| B101 | Maintain explicit preview->production promotion checklist; never silently deploy or clear storage | Current policy |
| B102 | Retire stale/contradictory labels and old documentation while preserving historical audit records | Pending cleanup |
| B103 | Benchmark 30 synthetic set entries for completion time, tap count, corrections and missed sets | F-024 captured |
| B104 | Keep separate private research notes, QA evidence, and change decisions, with verified commits | Existing policy |
| B108 | Pilot independent, sanitized failure-event capture and private coverage reconciliation for FitnessPilot coding/QA failures; link observed events to regression receipts without putting raw chats or private logs in this public repository | Proposed Fitness integration; reusable tooling exists separately, no genuine Fitness ledger verified |
| B109 | Add and verify a narrow Fitness CI workflow for native Node regressions and read-only integrity checks on relevant changes, preserving real-device acceptance as a separate gate | Proposed; no workflow on current main, Actions availability unverified |

## Suggested implementation order

1. **Acceptance + data safety:** Verify V15.22.2 on a real device (B001–B008), and preserve existing backups; document app safety behavior (B009–B010).
2. **Minimal day-to-day workflow:** Implement selected program clarity, Today screen and effortless explicit set save (B011–B028); measure real time to log a session.
3. **Finalize V10.3:** Confirm proposed exercise variations and training parameters independently of automated medical clearance; never rewrite historical workout logs (B038–B052).
4. **Close reliability gap:** Finish native regressions, physical Safari/Pages/offline and export/restore checks; review open PR overlap (B093–B104).
5. **Do sync safely:** Provider, auth, secure storage, encrypted/restricted data and merge conflicts (B053–B065). Never begin by uploading unencrypted backups to public repo.
6. **Expand from real data:** Weight Journey, source-aware metric dictionary, food diary evidence review and carefully chosen cosmetics (B066–B092).

## Known blockers and non-goals

- A web page on iPhone cannot guarantee a timely audible alarm when Safari is backgrounded, screen locked or audio restricted. Use an OS alarm if that guarantee is essential; a user-visible overlay is the app's fallback when foreground.
- No clinical diagnosis or automatic clearance for neurologically provocative movements based on a symptom-free workout or an app-generated 48-hour score.
- No fake workout logs, invented strength progression, hidden overwrites, automatic cross-device merge or destructive archive/delete of current templates.
- This is an exhaustive **known-work inventory from accessible artifacts**, not a claim of every possible future idea or that all open PR content is safe to merge.

## Evidence links

- [One-way calendar reminders scope decision, 5 November 2026](docs/decisions/2026-11-05-calendar-reminders-only.md) — code change not authorized; two-way sync remains deferred.
- [V15.22.2 PR #67](https://github.com/ToggleHardestMode/Fitness/pull/67)
- [V15.22.1 compact Strength Journey PR #66](https://github.com/ToggleHardestMode/Fitness/pull/66)
- [Completed-set CSV import PR #64](https://github.com/ToggleHardestMode/Fitness/pull/64)
- [V15.22.2 rest timer and effort source PR #67](https://github.com/ToggleHardestMode/Fitness/pull/67)
- Historical planning decisions and QA evidence are retained separately from this public, implementation-facing backlog.
