# Strength Journey & Adaptive Progression — Development Build Report

Date: 2026-11-02 (Asia/Singapore)
Scope: **Preview development branch only**. No production deployment, personal-log migration, external API credentials or account creation.

## Source and design contract
- Original feature plan: https://github.com/ToggleHardestMode/Prompts/blob/main/projects/FitnessPilot/FEATURES/2026-11-02_LIVE_PROGRESS_AND_FEEDBACK_PLANNER.md
- Existing storage format: fitnesspilot.preview.v101.v1, schema version 1, validated through core.js.
- Existing working-set recording, logbook and PT-review progression guard remain intact.
- Evidence: ACSM 2026 position stand (doi:10.1249/MSS.0000000000003897). Progressive resistance training is supported, but no single progression algorithm has proved universally optimal. Near-failure is not obligatory.
- Cloud candidate security reference: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/auth . **No Supabase integration has been deployed or provisioned.**

## Implemented in preview only
1. Pure selectors for exact-template/exercise logged working sets. History excludes warmups and suggestions, displays actual kg entries and all reps/RPE. An optional verified restart date, selected from genuinely saved dates, controls displayed Day 1 and progression evidence. No cross-version name guessing.
2. Mobile-friendly actual-load SVG chart, tappable completed sessions, per-set details, Day 1 selector, optional feedback and next-session explanation card. Linked from dashboard. No invented baseline and no automatic workout-log writes.
3. Backwards-compatible optional strengthFeedback and strengthJourneyStarts fields, validated and included in full JSON backups. Feedback captures a snapshot of the logged set values and becomes stale after edits. The same calendar day cannot be marked as next-day observed-good.
4. Candidate rules: bounded double progression; all relevant working sets; RPE <= 8; recorded difficulty, controlled technique and observed-good later response; complete symptom observations before/after/next-day; next-session recovery 4–5; two comparable ceiling sessions before load increase; explicit available weights and a maximum 10% load step. [PT Review], detected lower-body loading, timed holds, missing records or concerning symptoms have no automated load increase. Suggestions are never saved as completed workouts.
5. Manual device transfer: two JSON backups can be compared without mutating the current browser. Logical sets, templates, daily metrics, symptom observations, feedback and restart baselines merge when disjoint or identical. Differing records, weekly schedules or reminder settings block output. An empty destination may accept an original snapshot. Deletions never propagate. The user must preserve originals, download the result, and use existing explicit backup restore separately. **This is file transfer, NOT automatic cloud sync.**
6. Existing tracking-reset now clears strength-feedback and restart selections along with underlying workout logs. Merge download refuses files beyond the current 8 MB restore limit.
7. Preview service worker caches the new pages/modules under a fresh cache key. Default branch and deployed application remain untouched.

## Checks actually performed
- **26/26** synthetic cases passed, including compatibility tests for the existing tracking-reset workflow in an isolated JavaScript execution harness with fetched source (removing module declarations and using JSON clone fallback for this sandbox missing native structuredClone). Not equivalent to a Node npm test run or browser validation.
- **8/8** updated JS modules parsed successfully using isolated JavaScript syntax checks.
- A GitHub Actions workflow was added to run the full Node suite and syntax checks. The first run reported **startup_failure**, created **zero jobs**, and ran no tests.
- Not run: complete repo npm test under Node, actual browser DOM/PWA checks, real phone/PC transfer, Supabase RLS testing, accessibility audit, production Pages verification.
- No real user workout or health records were read, copied, imported or committed.

## Outstanding release blockers
1. Authenticated seamless cross-device cloud sync, offline mutation queue, stable entity IDs, server ownership/RLS, conflict UI, recovery testing and security tests. Backend decision still open. No secrets in public repository.
2. Explicit mapping across workout-template versions; current chart deliberately isolates versions.
3. Complete CI and browser QA; full backup/restore; actual two-device acceptance.
4. Larger JSON backups, data-transfer corner cases, and explicit kg-per-hand versus total-weight configuration; units are not inferred.
5. Realistic progression calibration with actual feedback. This feature is not medical clearance.

## Safe review
- Use disposable test-only records; preserve an original backup from each device.
- Confirm graph shows only saved working sets and respects user-selected restart Day 1.
- Confirm missing or concerning delayed response blocks increases, and target cards never populate saved logs.
- Review a two-backup merge for conflicts before attempting restore in a disposable browser.
- Do not merge or deploy before the outstanding release gates pass.

**Status: development candidate / draft PR; not deployed, not automatically synced.**
