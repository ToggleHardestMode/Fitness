# FitnessPilot roadmap

Reconciled 2026-11-11 against `main` at `d14ff2b` (preview V15.26.14, PR #102). At that commit `npm test` passes 378 of 378 and `node scripts/verify-preview-assets.mjs` passes.

This file is the single place where task status lives. It replaces the 116-row backlog of 2026-11-03. Every old B-number is accounted for in the [ID ledger](#id-ledger); none were renumbered. New items start at B117.

## How to read this

Work is split by who can do it.

- **Agent queue** — code and docs a coding agent can finish and prove with tests. Done top to bottom, one item per pull request.
- **Owner checklist** — things only the owner can do: one iPhone session and four decisions.
- **Parked** — not started unless the owner asks.

Status words, used once per row and nowhere else:

| Word | Meaning |
|---|---|
| Open | Not started |
| PR #n | Pull request open, not merged |
| In source | Merged to `main`; CI passed |
| On device | Owner confirmed it on the iPhone (date given) |

"In source" never implies "On device". That is said here once and not repeated in other documents.

## Rules that always apply

These were backlog rows (B007, B041, B048, B053, B063, B072, B084, B100, B104). They are constraints, not tasks.

1. Saved records are never silently overwritten, duplicated, re-keyed or invented. Planned sets, warm-ups and examples never count as progress.
2. Local storage on the phone is the working copy. Plain JSON and CSV export always stay available.
3. `[PT Review]` exercises get no load suggestion without a clearance the owner recorded. A symptom-free session is not clearance. Nothing is cleared, linked, ramped or progressed automatically.
4. In the Food Diary, unknown is not zero and one logged meal is not a complete day.
5. Small pull requests, exact commit, honest test report. Private notes and real data stay out of this public repository.

## Agent queue

Take the first Open row whose "Needs" column is satisfied. Check the code before starting; if the item is already done, the pull request only updates this row with the evidence.

### Stage 1 — make the record true and build a safety net

| Step | ID | Work | Done when | Needs | Status |
|---|---|---|---|---|---|
| 1.1 | B117, B102 | Cut `README.md` to: what the app is, links, install, backup, development. Remove every hard-coded version number and "historical status" paragraph from the README; point to the banner in the app instead. Move the release notes in `preview-v101/README.md` to `CHANGELOG.md`. | No document other than `CHANGELOG.md` names a preview version. README is under 80 lines. | — | Open |
| 1.2 | B096, B098, B099 | Extend `qa/seeded-browser/` to cover, with synthetic data in disposable browser contexts: save a set in Train and see the rest timer; plain JSON backup restored into a clean context with equal records; encrypted two-store backup restored into a clean context; wrong passphrase and corrupted file rejected; page reload while offline; a cache-name change keeps `localStorage`. Add a second CI job that runs it. | The job is green on the pull request and fails if any flow is broken on purpose (show one such failure in the PR description). | — | Open |
| 1.3 | B124 | Bring in `qa/seeded-browser/mobile_ui.py` from draft pull request #91 (6 views × 3 widths, full-page screenshots plus an overflow and off-screen-control report). Add a comparison to the browser job: capture the pull-request build and `main` in the same run and report changed pixels per screen. Images are CI artifacts only; none are committed. | The job reports changed pixels and overflow per screen. Refactor PRs must report zero changed pixels. | 1.2 | Open |
| 1.4 | B103 | Start from draft pull request #93 (operator-timed 30-set baseline): rebase it, keep its protocol, and add a scripted run that logs 30 synthetic sets through the Train screen. Record taps, corrections and elapsed time in `docs/qa/logging-baseline.md`. | Baseline file exists with the commit it was measured on. | 1.2 | Open |
| 1.5 | B125 | Start from draft pull request #100 (QA checklist rebase). Rewrite `preview-v101/qa-checklist.js` so its checks are exactly steps O1–O11 below. Read the version from the banner instead of the hard-coded `V15.15.3`. | `qa.html` shows the eleven steps and exports the report. | — | Open |

### Stage 2 — make the code cheap to change

No behaviour change in this stage. Every pull request must show zero changed pixels (1.3) and a green browser job (1.2).

| Step | ID | Work | Done when | Needs | Status |
|---|---|---|---|---|---|
| 2.1 | B118 | One shared `html.js` exporting `esc`. Remove the copies in `app.js`, `food-diary-chart.js`, `strength-journey-visual.js`, `exercise-clearance-ui.js`, `exercise-equivalence-ui.js`, `manual-progression-ui.js`, `return-training-ui.js`. The last one does not escape `'`; the shared one must. | One definition; a test covers all five characters. | 1.2 | Open |
| 2.2 | B119 | Split `preview-v101/app.js` (97 KB, lines up to 2,400 characters) into `state.js` (load/save), `dashboard-view.js`, `train-view.js`, `plan-view.js`, `tools-view.js` and `actions.js` (the click handler). One pull request per file moved. Moved code is reformatted to lines of 140 characters or fewer. | `app.js` is under 150 lines and only wires modules together. | 2.1, 1.3 | Open |
| 2.3 | B120 | Merge the 19 stylesheets loaded by `index.html` into `tokens.css`, `base.css`, `components.css`, `pages.css` and `theme.css`. One pull request per target file. | `index.html` loads five stylesheets; no file is named after a version. | 1.3 | Open |
| 2.4 | B121 | 18 test files read source text and match strings. As each module is touched in 2.2 and 2.3, replace those assertions with tests of behaviour that protect the same guarantee. | Each replaced assertion has a `Behaviour change` note (new rule: unchanged) as the permissions record requires. No rule is dropped. | with 2.2, 2.3 | Open |
| 2.5 | B122 | `manual-progression-ui.js` and `metric-selectors.js` are imported only by tests. For each: wire it into the app if a queue item needs it (see 4.4), otherwise delete it with its tests and cache entry. | No module in `preview-v101/` is unused by the app. | 2.2 | Open |

### Stage 3 — faster daily logging

Starts after step 1.4 and after the owner's iPhone session (findings from it go first). Rerun 1.4 at the end and add the comparison to the baseline file.

| Step | ID | Work | Done when | Needs | Status |
|---|---|---|---|---|---|
| 3.1 | B011, B012, B013 | A Today entry on the Dashboard: the assigned workout for today, the program name and version, one "Start workout" button, and a way to pick a different workout. | From a cold open, the first set screen is two taps away. | 1.4, 2.2 | Open |
| 3.2 | B023 | Undo the most recently saved set, with a confirmation that names the set. Removes exactly that record. | Test proves only that record is removed and counters follow. | 2.2 | Open |
| 3.3 | B022 | Label weight as "kg per dumbbell" or "kg total", and time as "seconds per side" or "reps", from the exercise definition. | Labels appear in Train, logbook and CSV header. | 2.2 | Open |
| 3.4 | B016, B018 | Optional "Save → Rest → Next set" flow. The timer starts only after a successful save. Off by default. | Failed save starts no timer (test). | 3.1 | Open |
| 3.5 | B034 | "Keep screen awake during workout" toggle using the Screen Wake Lock API. Held only while a workout is open; released on finish, on leaving, and when the page is hidden. Hidden if the API is missing. | Tests with a fake wake-lock object cover acquire and all three releases. | 2.2 | Open |
| 3.6 | B019, B020, B021, B026 | Effort shown as Easy / Moderate / Hard / Very hard with "reps left" help text; raw RPE kept. Old sets with missing or doubtful RPE are marked uncertain and give no load advice. Tap-to-explain for DB, RPE, RIR, ROM, PT Review, SS1. Optional notes behind a disclosure. | No progression guard is loosened (existing guard tests unchanged). | 2.2 | Open |
| 3.7 | B014, B043 | Hide a template from pickers without deleting it or its history. Mark an exercise as skipped today; a skip is not a set and not a failure. | Hidden templates still appear in logbook and backup. | 2.2 | Open |
| 3.8 | B024, B025 | Make "import a plan (CSV)" and "import completed sets (CSV)" visually distinct. The preview lists added, duplicate and rejected rows, and says the new plan is not yet assigned to a day. | Covered in the browser job. | 2.2 | Open |

### Stage 4 — program and data

| Step | ID | Work | Done when | Needs | Status |
|---|---|---|---|---|---|
| 4.1 | B077, B094 | Pull request #61 (food missing-versus-zero logic) is open as a draft on 2026-11-11. Rebase it onto `main`, run the checks, and report conflicts for owner review. | #61 is rebased with checks reported, or closed by the owner. | — | Open |
| 4.2 | B112 | The Dashboard overlap panel only knows V10.2. Load `templates/V10.3_Overlap_Coefficients.csv` data for V10.3 plans (direct 1, secondary 0.5). Custom exercises get no inherited coefficients. | Weekly dose for a V10.3 fixture matches a hand-worked table in the test. | 2.2 | Open |
| 4.3 | B105 | Calendar export: event UIDs are derived from weekday and workout, not from the export time, so re-importing updates instead of duplicating. | Two exports a day apart give identical UIDs (test). | — | Open |
| 4.4 | B068, B069 | Show the metric dictionary on the Dashboard: each number has a "how is this counted" disclosure with direct and indirect set maths, and missing inputs are shown as missing. | Uses `metric-selectors.js` (ties to 2.5). | 2.2 | Open |
| 4.5 | B064 | A plain `export.html` page with no dependency on `app.js` that downloads the raw contents of both storage keys as one JSON file. | Works in the browser job with `app.js` deleted from the served folder. | 1.2 | Open |
| 4.6 | B113 | Pulldown logging units. | — | Owner decision D2 | Blocked |
| 4.7 | B116 | Scope of a general symptom entry. Current behaviour stays until decided. | — | Owner decision D1 | Blocked |

### Stage 5 — make the preview the app

| Step | ID | Work | Done when | Needs | Status |
|---|---|---|---|---|---|
| 5.1 | B101, B123 | Root `index.html` becomes a short page linking to `preview-v101/`; old root app files move to `archive/root-app/`. The preview URL, storage keys and cache scope do not change. These are production files: the agent lists them and asks, and makes no branch or commit before the owner's explicit production approval. Follow the release gates in `docs/decisions/2026-11-05-roadmap-owner-decisions.md`. | Gate list ticked or marked not applicable in the pull request. | Owner decision D3, production approval, O1–O9 passed | Blocked |

## Owner checklist

### One iPhone session (about 45 minutes)

Use `preview-v101/qa.html` once step 1.5 is merged; until then use this list. Steps marked ◆ use throw-away data in a private tab, never real records.

| Step | Check | Covers |
|---|---|---|
| O1 | Safari and the home-screen app both show the current version banner; real records are still there after the update. | B004 |
| O2 | Log three sets of a real upper-body session. Text is readable and nothing overflows. | B001, B027, B097 |
| O3 | Rest timer floats in Train, counts 90 s, and the finished overlay stays until tapped. Try with ringer on, on silent, and with the screen locked; note what you hear. | B002, B029, B030 |
| O4 | Lower-body workout shows `[PT Review]`; the next-session guide never fills or saves a set. | device check of B045, B046 |
| O5 ◆ | Import V10.3: four workouts, not assigned to days. Link one exercise to its V10.2 history, set active sets below target, record and revoke a clearance. | device check of B038, B073, B114, B115 |
| O6 | Dashboard: Strength Journey, week arrows and "show calculation" agree with what you logged. | B066, B067 |
| O7 | Food Diary: search a local food, repeat a past meal, and check the 28-day chart shows unlogged days as blank, not zero. | device check of B079, B080, B081 |
| O8 ◆ | Encrypted backup: export both stores, restore in a private tab typing the passphrase from memory, confirm a wrong passphrase is refused. | B005, B006, B076 |
| O9 | Airplane mode: the app reopens and a set can be saved. | B004 |
| O10 | Reduce Motion on: avatar is still. VoiceOver reads the Save button and the timer. Slime and sound stay off unless enabled. | B028, B085, B086, B087, B088, B092 |
| O11 | After step 4.3: import the `.ics` into Calendar; right days, time and alert; importing twice makes no duplicates. | B106 |

Write the date and pass/fail for each step under "Device log" below.

### Decisions

| # | Question | Blocks |
|---|---|---|
| D1 | Should a general symptom entry block progression for every exercise that day, or only lower-body and PT-review ones? (B116) | 4.7 |
| D2 | What do you use for pulldowns: cable/plates in kg, or a band? (B113) | 4.6 |
| D3 | Retire the old root app in favour of the preview? (B101) | 5.1 |
| D4 | Cosmetics freeze (B089–B091): keep frozen, or pick a review date? | nothing |

### Device log

*(empty — add `YYYY-MM-DD · step · pass/fail · note`)*

## Parked

Not started unless the owner asks. Listed so nothing is lost.

- **Training logic:** B040 light lower-day template, B047 one-variable-at-a-time advancement, B049 deload or repeat-week, B051 tolerance review before harder accessories, B052 exercise instruction cards, B044 optional per-set detail.
- **Safety copy:** B009 suspend an exercise, B010 stop/hold prompts.
- **Analytics:** B070 weight trend, B071 four-week deficit review, B074 personal bests, B075 separate trend views, B083 edited-food audit.
- **Interface:** B017 exercise picker layout.
- **Sync and backend (owner decided: no sync):** B008, B054, B060, B061, B062, B065.
- **Calendar publishing:** B107.
- **Process tooling:** B108.
- **Cosmetics (frozen):** B089, B090, B091.

## ID ledger

Where every old number went.

| Outcome | IDs |
|---|---|
| In source; no further agent work | B003, B015, B031, B032, B033, B036, B037, B038, B039, B042, B045, B046, B050, B073, B078, B079, B080, B081, B093, B095, B109, B110, B111, B114, B115 |
| Owner iPhone session (O1–O11) | B001, B002, B004, B005, B006, B027, B028, B029, B030, B066, B067, B076, B085, B086, B087, B088, B092, B097, B106 |
| Agent queue | B011, B012, B013, B014, B016, B018, B019, B020, B021, B022, B023, B024, B025, B026, B034, B043, B064, B068, B069, B077, B094, B096, B098, B099, B101, B102, B103, B105, B112, B113, B116 |
| Standing rule | B007, B041, B048, B053, B063, B072, B084, B100, B104 |
| Parked | B008, B009, B010, B017, B040, B044, B047, B049, B051, B052, B054, B060, B061, B062, B065, B070, B071, B074, B075, B083, B089, B090, B091, B107, B108 |
| Closed by owner decision | B035, B055, B056, B057, B058, B059, B082 |
| New in this revision | B117 docs reconcile, B118 shared escape helper, B119 split `app.js`, B120 merge stylesheets, B121 behaviour tests, B122 unused modules, B123 retire root app, B124 screenshot comparison, B125 device checklist page |

Open pull requests on 2026-11-11 that are not queue steps: #95 (V10.4 exercise amendment, draft) and #103 (food barcode/OCR research notes). Both wait for the owner; an agent does not build on them.

Shipped since the last revision without a backlog number: return-to-training stages and coverage-first mode (F-093), Food Diary CSV import, backup reminder with persistent-storage control (#89), seeded browser smoke (#59).

## Fixed limits

- A web page on an iPhone cannot guarantee a sound when Safari is in the background or the phone is locked. The on-screen alert is the alarm; use the Clock app if a sound is essential.
- No native wrapper, no account, no server, no two-way calendar sync.
- No diagnosis and no automatic clearance.

## Records

- [Restructure permissions, 2026-11-11](docs/decisions/2026-11-11-roadmap-restructure-permissions.md) — allows roadmap status edits, README and changelog edits, the browser CI job with screenshot comparison, and replacing source-text tests.
- [Owner decisions 1–8](docs/decisions/2026-11-05-roadmap-owner-decisions.md)
- [Calendar: reminders only](docs/decisions/2026-11-05-calendar-reminders-only.md)
- [V10.3 transition plan](docs/plans/2026-11-05-v10.3-transition-plan.md) — B111, B073, B114, B115 are now in source.
- [Agent rules](AGENTS.md)
