# FitnessPilot — roadmap restructure: owner permissions (2026-11-11)

**Status:** DECIDED when merged to `main` by the owner. Until then it is a proposal and authorises nothing.

**Decision owner:** Product owner (user)
**Change type:** Documentation / process decision only. No app code, templates, saved records or deployments are changed by this note.

## Why this record exists

The roadmap of 2026-11-11 asks agents to restructure `preview-v101/` without changing behaviour. Four things that work needs are restricted by `AGENTS.md` or by tests that act as recorded decisions. A request cannot lift those restrictions; this record does.

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Roadmap | `ROADMAP.md` as reconciled on 2026-11-11 replaces the 116-row backlog. An agent updates the status cell of the row it is working on, in the same pull request as the work. Other roadmap edits need a request. |
| 2 | README and changelog | An agent may edit `README.md` and create or extend `CHANGELOG.md` when a roadmap step calls for it. Files under `docs/decisions/` and `docs/plans/` are dated records and are not rewritten; changes to them are dated amendments. |
| 3 | CI | For roadmap steps 1.2 and 1.3 only, an agent may add one browser job to `.github/workflows/ci.yml`. The existing job is not changed. |
| 4 | Source-text tests | A test assertion that reads a source file and matches text in it may be replaced by a test of behaviour that protects the same rule. Conditions below. |
| 5 | Restructuring | Roadmap stage 2 (shared escape helper, splitting `app.js`, merging stylesheets, removing unused modules) is authorised as a no-behaviour-change refactor of `preview-v101/`. Each pull request bumps the preview version as `AGENTS.md` section 4 requires. |
| 6 | Screenshot comparison | The browser job may compare screenshots of a pull request against `main` and report changed pixels. Stage 2 pull requests must show zero. Images are CI artifacts and are never committed. A CI result is not served-page or device acceptance. This amends the 2026-11-09 screenshot standard, which said no automatic screenshot diff gates are added. |

## Conditions for decision 4

- The replacement must fail when the rule is broken. A replacement that only mirrors the implementation is not acceptable.
- The pull request carries a `Behaviour change` note for each replaced assertion: test name, old rule, new rule (`unchanged`), authority (this record). Every changed test file is named in the summary.
- If no behaviour test can protect the rule, the source-text assertion stays and only its file path is updated.
- A rule is never dropped. Tests that already exercise behaviour — progression guards, `[PT Review]` and clearance handling, symptom gating, backup and Food Diary validation, tracking reset — are not covered by this decision and must pass unmodified.

## Not granted

- Any change to the production root app (`index.html`, `app.js`, `core.js`, `sw.js`, `manifest.webmanifest`, `styles.css`, `ro-*`). Roadmap step 5.1 still needs the owner's explicit production approval.
- Any change to storage keys, the shape of saved records, or backup backward-compatibility.
- Any change to safety gates or progression rules.
- Roadmap decisions D1–D4, which remain open.

## Next review trigger

Completion of roadmap stage 2, or the first pull request where a rule cannot be protected by a behaviour test.
