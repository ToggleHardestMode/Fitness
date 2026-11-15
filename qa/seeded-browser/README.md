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
- The food-only runner blocks service workers. The integrated runner allows them only in its disposable offline scenario; neither runner touches the owner's browser profile or live site cache.
- A failing assertion aborts the test. There are no automatic retries after unexpected mutation or input mismatch.

The Python Playwright package and managed Chromium must be installed locally. `npm test` remains the existing native FitnessPilot suite; the browser runner supplements it rather than replacing it.

## B096 integrated preview smoke (online and offline workflows)

Run the same setup shown above, then use:

    py .\qa\seeded-browser\integrated.py --repo-root .

Optional: add --headed or --chromium PATH. The new runner reuses the exact
synthetic fixture and disposable local Chromium contexts from this PR.

It checks Plan saved assignments, CSV preview/import, Train saved sets and
duplicate prevention, rest timer across pages, downloaded workout JSON and
checked-file workflow, then encrypted both-store export, invalid passphrase
and ciphertext rejection, and clean-profile recovery with record comparison.

The integrated runner also restores the downloaded plain workout JSON into a
separate empty browser context. Its dedicated offline scenario allows a real
service worker in another disposable context, reloads the cached app with the
network disabled, and serves a changed cache name **from memory** before
verifying that neither local storage key changed. No source file is rewritten.

The CI `browser` job runs this same local-only runner using managed Chromium.
For a local repeat, use the existing `integrated.py --repo-root .` command.
A browser CI pass does not prove Safari, sound audibility, or real device data
recovery. Do not clear phone/browser website data. No repository files change.
