# FitnessPilot Calendar Integration — Scope Decision (2026-11-05)

**Status:** DECIDED — reminders only; two-way calendar-to-FitnessPilot rescheduling **KIV / deferred until explicit user request**.

**Decision owner:** Product owner (user)
**Decision captured:** 2026-11-05 (Asia/Singapore)
**Change type:** Documentation / product decision only. **No implementation, deployment, calendar write, or live sync was performed.**

## Decision

Build toward **one-way workout scheduling and reminders**, with FitnessPilot as the authoritative source of scheduled workouts and saved training history.

- FitnessPilot → calendar: show planned sessions and reminders (the chosen near-term use case).
- Calendar → FitnessPilot: **DO NOT** use event edits, cancellations, moves, or calendar attendance to reschedule a FitnessPilot plan, alter workout templates, or record completed sessions.
- Completed workout data must be recorded in FitnessPilot, not inferred from event presence or elapsed time.
- Do not upload or expose private recovery, symptom, injury or detailed set logs to a calendar feed by default.

## Near-term scope, when implementation is explicitly requested

1. Preserve and improve the existing one-time ICS recurring-reminder export.
2. Prevent duplicate imports where feasible; assign deterministic event identities and make re-import semantics explicit. Existing `calendarICS` currently derives the event UID partly from `now.getTime()`; repeated exports therefore get different IDs.
3. Handle time zones (Asia/Singapore as an initial target), recurrence, duration, notification lead time and daylight-saving behavior as applicable.
4. Optionally enable a **one-way** Google Calendar event publisher with explicit user authorization, a dedicated calendar where feasible, idempotent create/update/delete, and a visible disconnect/sync-status path.
5. If adding a hosted ICS subscription for Apple/Google/Outlook, do not publish it unless a secure, revocable schedule store and privacy approach exist. A one-time ICS download is not live sync.
6. Verify event output against real calendar clients without changing FitnessPilot's stored logs; distinguish source-level tests from real iPhone/device acceptance.

The user chose the **reminder-only** behavior as the product direction, not a blanket authorization to make code changes or create events now.

## Explicitly deferred — KIV

**Two-way Calendar ↔ FitnessPilot scheduling** is out of scope. Examples:

- Moving a Google Calendar event automatically changes the FitnessPilot workout date/time.
- Cancelling a calendar appointment automatically skips or deletes a FitnessPilot session.
- Editing external recurring series/exceptions writes back to FitnessPilot.
- Multi-device bidirectional reconciliation, provider webhooks, and conflict-resolution logic.

**Activation gate:** Reconsider or implement these behaviors **only after the user explicitly asks for them in a future iteration**. Do not quietly bundle them into reminder/export work, refactors, or an automatic feature roadmap promotion.

## Rationale / implementation boundaries

- Reminder-only integration meets the stated current need while minimizing auth, recurrence, conflict, privacy, offline, and sync complexity.
- A static GitHub Pages app with local browser storage has no automatically accessible server-side schedule state. A continuously updated external subscription feed would require additional infrastructure or a secure publication mechanism.
- FitnessPilot logs and workout-plan history remain authoritative and should never be silently inferred or rewritten by calendar state.

## Verified repository references at decision time

- `preview-v101/index.html`: preview banner identified **V15.22.2** in the inspected source.
- `preview-v101/app.js`: Tools UI exposes **Export Calendar reminders (.ics)**; the action downloads a file rather than calling a calendar provider.
- `preview-v101/core.js`: `calendarICS()` exports recurring `VEVENT` entries and `VALARM`; the `UID` incorporates the export timestamp.
- `ROADMAP.md`: local-first storage and safe future synchronization are covered by **B053–B065**.

## Next review trigger

User explicitly requests calendar implementation or asks to reactivate two-way calendar editing. When that occurs, inspect the latest repo/branch state, confirm desired provider/behavior, test on actual calendar clients, and update this decision log with implementation evidence and commit IDs.

**Evidence classification:** Repository-code inspection for current behavior; future architecture, complexity, and acceptance gates are recommendations, not claims of deployed functionality.
