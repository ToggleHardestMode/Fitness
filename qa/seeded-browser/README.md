# FitnessPilot — seeded browser QA

Standalone Python + Playwright test runner for a **local checkout of the real FitnessPilot source**. Runs a localhost static server and two disposable Chromium browser contexts. It never opens or changes the operator's existing Brave/Safari profile, GitHub Pages, personal Food Diary or workout data.

## Windows run

```powershell
py -m pip install playwright
py -m playwright install chromium
py .\qa\seeded-browser\fixture.py
py .\qa\seeded-browser\verify.py --repo-root .
```

Optional: add `--headed` to view the isolated test browser. For a system Chromium executable that is Playwright-compatible, pass `--chromium "C:\Path\To\chrome.exe"` (the managed Playwright browser is recommended).

## Expected fixture and checks

The deterministic synthetic fixture has **60 diary entries across 28 days**, **28 workout check-ins**, one saved set and a synthetic training plan. On 2026-10-28, it expects 3 recorded entries, **at least 600 kcal / 40 g protein / 80 g carbs / 10 g fat** and **one unknown nutrient entry**. A recorded zero-calorie drink remains distinct from unknown.

The Playwright flow loads this fixture into one **new disposable context** on localhost, checks visible daily totals, copies a historical food, verifies old records and workout storage have not changed, downloads the actual page's JSON backup, rejects restore into the nonempty diary, and restores the downloaded backup in a **second new context**. It checks the diary persists after page reload while the workout store is preserved.

This does **not** yet test the full Dashboard, symptom UI, vitamin conversions, workouts editor, offline mode, Brave extension or physical iPhone Safari. Those require separate suites and are not implied by a passing Food Diary flow.

## Safeguards

- `--repo-root` is mandatory and must contain the exact FitnessPilot source file structure and expected native Node test command. There is no default filesystem target, wildcard discovery or production URL mode.
- Playwright contexts are new, isolated and disposable. The server binds only to `127.0.0.1` on an assigned port, never to a shared production origin.
- The fixture data is fictional and versioned; it does not read any user's browser storage or contain health information.
- The test does not overwrite repository files, existing backups, source data or existing output reports.
- The runner uses `service_workers='block'` to avoid caching real preview assets during the first local seeded browser checks. Offline/service-worker acceptance needs a separate test.
- A failing assertion aborts the test. There are no automatic retries after unexpected mutation or input mismatch.

The Python Playwright package and managed Chromium must be installed locally. `npm test` remains the existing native FitnessPilot suite; the browser runner supplements it rather than replacing it.

## B096 integrated preview smoke (online workflows only)

Run the same setup shown above, then use:

    py .\qa\seeded-browser\integrated.py --repo-root .

Optional: add --headed or --chromium PATH. The new runner reuses the exact
synthetic fixture and disposable local Chromium contexts from this PR.

It checks Plan saved assignments, CSV preview/import, Train saved sets and
duplicate prevention, rest timer across pages, downloaded workout JSON and
checked-file workflow, then encrypted both-store export, invalid passphrase
and ciphertext rejection, and clean-profile recovery with record comparison.

Both runners block service workers and bind ONLY to 127.0.0.1.
Offline, service-worker upgrades, iPhone Safari, and sound audibility are
NOT tested. Offline B098 is explicitly KIV and cannot be treated as passed.
Do not clear any phone or browser website data. No repository files change.

## B103 automated Train UI regression (synthetic, not a human benchmark)

Use the [committed B103 synthetic 30-set reference](fixtures/b103_30_complete.json)
without manually typing anything. The runner opens a disposable localhost server and
two **fresh** Playwright Chromium contexts. For each of Standard and Focus Mode it
seeds only the workout template with **zero** saved sets, enters 10 kg / 10 reps /
RPE 7 through the real Train form, saves 30 sets (10 clicks to save 3 sets in
Standard, 30 clicks to save one set in Focus), and checks incremental
`localStorage` persistence, complete fixture identity/values, and survival
across a full page reload.

On a Windows checkout of **draft PR #93**, install Playwright/Chromium once,
then run:

```powershell
py -m pip install playwright
py -m playwright install chromium
py .\qa\seeded-browser\train_ui_30.py --repo-root . --output .\B103-train-ui-evidence-new
```

Use a **new output folder** on every run. Optional `--mode standard` or
`--mode focus` runs only one mode; default runs both. The command writes
`report.json` with PASS/FAIL and individual results and exits nonzero on
failure. It **does not** run against GitHub Pages, open your normal browser
profile, change real localStorage or workout history, or turn on the offline
B098 service worker. Do not restore this fixture into your personal phone.

**Verification status when authored:** Python synthetic reference regression
checks PASS, but full actual Chromium UI navigation was **not verified in the
author's sandbox** because browser navigation returned
`ERR_BLOCKED_BY_ADMINISTRATOR`. Run it on your Windows machine to establish
real browser evidence. Automated clicks do **not** measure a human's time or
tap count: the B103 human usability baseline is still a separate gate.
