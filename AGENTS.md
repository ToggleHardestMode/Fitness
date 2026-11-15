# AGENTS.md — rules for coding agents in this repository

FitnessPilot is a local-first, no-account workout and food tracker served from GitHub Pages. This repository is **public**. These rules apply to any agent that reads or changes it (ChatGPT with the GitHub connector, Codex, Claude Code, Cursor and similar).

## 1. Scope: preview vs production

| Area | Path | Default rule |
| --- | --- | --- |
| Preview app | `preview-v101/` | Where feature work goes. The folder name is historical; it is **not** the app version. |
| Production app | repo root: `index.html`, `app.js`, `core.js`, `sw.js`, `manifest.webmanifest`, `styles.css`, `ro-*` | **Do not change** unless the owner explicitly approves a production change in the request. |
| Records | `docs/decisions/`, `docs/plans/`, `ROADMAP.md` | Read before changing behaviour. Edit only when the request asks you to; for roadmap status cells see section 9. |
| Tests and CI | `tests/`, `scripts/`, `.github/workflows/` | Add or update tests with the change. Do not weaken an existing test to make it pass. |
| Content | `templates/`, `examples/`, `archive/` | Leave alone unless the request names them. |

## 2. Read before you change behaviour

Before changing how anything behaves, check these and quote what applies:

1. `docs/decisions/*.md` — owner decisions (for example the roadmap owner decisions and calendar-reminders-only).
2. `docs/plans/*.md` — the current transition plan, including clearance rules.
3. `ROADMAP.md` — the numbered backlog and its gates.
4. The tests that assert the behaviour you are about to change.

A test that protects a behaviour is a recorded decision. **The request alone does not override a recorded decision.** If the request conflicts with one:

- first look for a design the record already allows, and propose it;
- otherwise quote the record and the conflicting part of the request, ask the owner, and **stop without changing files**.

Do not assume a behaviour is missing; check the current code first.

## 3. Commands

Requires Node 22 (the version CI uses). No dependencies to install.

```sh
npm test                                  # node --test tests/*.test.mjs
node scripts/verify-preview-assets.mjs    # read-only preview asset and version check
```

CI (`.github/workflows/ci.yml`) runs both on every pull request and on pushes to `main`. Run both before you report a change as done. Report the CI result for the **final** commit of the pull request; if you could not run them, say so plainly instead of implying they passed.

## 4. Preview version bumps

The banner in `preview-v101/index.html` (`FITNESSPILOT Vx.y.z PREVIEW`) is the single source for the preview version. Tests derive the other strings from it. When you bump the version, update together:

- `preview-v101/index.html` — the banner.
- `preview-v101/manifest.webmanifest` — `name` must contain the same `Vx.y.z`.
- `preview-v101/sw.js` — `const CACHE = 'fitnesspilot-preview-v<digits>…'`, where `<digits>` is the version with the `V` and dots removed (V15.26.0 → `v15260`). A suffix after the digits is allowed.

`food-diary.html`, `nutrition.html` and `nutrition-cheatsheet.html` must each keep a `FITNESSPILOT Vx.y.z PREVIEW` banner; it need not match `index.html`.

Any new CSS, JS or SVG that `preview-v101/index.html` loads must be added to the precache list in `preview-v101/sw.js`. Preview modules must not import from outside `preview-v101/`. The verify script checks all of this.

## 5. Data and storage — never break saved records

- Storage keys are fixed: production `fitnesspilot.web.v1`, preview `fitnesspilot.preview.v101.v1`. Do not rename or reuse them, and do not add a migration that drops existing records.
- Keep backups and restore backward-compatible with existing exports.
- Never tell the user to clear Safari or site data to force an update; it can delete their records.
- Keep the offline cache scoped to the preview, and keep existing `[PT Review]` messaging.

## 6. Privacy — this repository is public

Never commit personal workout or food logs, health observations, real backups or exports, credentials, tokens, or identifiers. Use synthetic data in tests and examples. Session notes, handover logs and private records do **not** go in this repository.

## 7. Git workflow

- Work on a new branch with a small, scoped diff. Do not push to `main`.
- Open a pull request; do not merge it, and do not deploy, unless the owner asks in the request.
- Before you start, check open pull requests for overlapping work.
- Do not edit `.github/workflows/` or repository settings unless the request asks for it.
- Do not claim device or GitHub Pages acceptance; merged source does not prove either. Give the owner the preview URL to test on iPhone.

## 8. Done when

- The change sits only in the paths the request allows (normally `preview-v101/` plus tests).
- `npm test` and `node scripts/verify-preview-assets.mjs` pass, or you have said exactly which did not run and why.
- The pull request states what changed, which records you checked, the test result for the final commit, and what still needs testing on a device.

## 9. Working the roadmap

`ROADMAP.md` has an **Agent queue**. When the request is "next roadmap step", or names a step, work this way. `docs/decisions/2026-11-11-roadmap-restructure-permissions.md` is the authority for the permissions used below; if it is not on `main`, stop and tell the owner.

**One step, one pull request.**

1. Take the first row with status Open whose "Needs" column is satisfied, unless the owner names a step. Do not skip ahead.
2. Read the code first. If the step is already done, change only that row and cite the file and test that prove it.
3. Make the smallest change that meets the row's "Done when" cell. Report other problems you notice; do not fix them in the same pull request.
4. Set the row's status to `PR #n` in the same pull request. Use only the roadmap's four status words: Open, PR #n, In source, On device.
5. Stop once the pull request is open. Do not start the next step.

Keep a pull request near 400 changed lines, not counting code that only moved.

**Checks to report**, in addition to section 3:

| Check | Source | Required from |
| --- | --- | --- |
| Browser flows | CI browser job on the final commit | after step 1.2 merges |
| Changed pixels and overflow at 320, 390, 428 px | same CI job | after step 1.3 merges |

Anything that needs the phone is reported as not checked, naming the owner checklist step (O1–O11) that covers it.

**Always needs the owner's answer first**, whatever the step says:

- storage keys, the shape of saved records, backup backward-compatibility;
- `[PT Review]` handling, exercise clearance, symptom gating, recovery scores, and the guards in `recommendNextExercise` and `manualProgression` — when a refactor moves this code, its tests pass unmodified;
- roadmap decisions D1–D4, anything under "Parked", a new dependency or build step, or a looser Content-Security-Policy.

**Replacing a source-text test.** Some tests read a source file and match text in it. The permissions record allows replacing such an assertion with a behaviour test that fails when the same rule is broken. List each one in the pull request: test name, the rule (unchanged), old assertion, new test. If no behaviour test can protect the rule, keep the assertion and update only its path.

**Stage 1.** Extend the existing runner in `qa/seeded-browser/`; do not add a second tool. Show the browser job can fail: break one flow on a scratch commit, quote the red result in the pull request, then drop that commit.

**Stage 2 (restructuring).** The user must see no difference. Move code without improving it on the way. Zero changed pixels is the acceptance test; if pixels change, find the cause. Keep stylesheet rules in the same relative order when merging, because later files currently win. Run these steps one at a time, never alongside another branch that edits `preview-v101/`. Moved code keeps lines to 140 characters or fewer.

**Stage 3 (daily logging).** Each change is optional or obvious, and a save never happens as a side effect.
