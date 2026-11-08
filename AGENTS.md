# AGENTS.md — rules for coding agents in this repository

FitnessPilot is a local-first, no-account workout and food tracker served from GitHub Pages. This repository is **public**. These rules apply to any agent that reads or changes it (ChatGPT with the GitHub connector, Codex, Claude Code, Cursor and similar).

## 1. Scope: preview vs production

| Area | Path | Default rule |
| --- | --- | --- |
| Preview app | `preview-v101/` | Where feature work goes. The folder name is historical; it is **not** the app version. |
| Production app | repo root: `index.html`, `app.js`, `core.js`, `sw.js`, `manifest.webmanifest`, `styles.css`, `ro-*` | **Do not change** unless the owner explicitly approves a production change in the request. |
| Records | `docs/decisions/`, `docs/plans/`, `ROADMAP.md` | Read before changing behaviour. Edit only when the request asks you to. |
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
