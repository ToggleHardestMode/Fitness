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

## B097: Mobile viewport and complete CSS smoke

Use the same Python Playwright/Chromium installation as B096. From a disposable
checkout of the B097 PR branch, capture Dashboard, Train, Plan, Tools, Food Diary
and the Encrypted Backup Vault at **320, 390 and 428 CSS pixels** (18 images).

    py .\qa\seeded-browser\mobile_ui.py --repo-root . --target local --output ..\B097-local-evidence
    py .\qa\seeded-browser\mobile_ui.py --repo-root . --target pages --output ..\B097-pages-evidence

Use **new, different output paths** for repeat runs. The runner refuses to
overwrite an existing evidence directory. Each output folder contains 18
full-page screenshots and a report.json summarizing computed full-CSS
document overflow, clipped controls, small touch targets, mobile navigation
overlap, accessible critical controls and JavaScript errors. A nonzero exit
signals a failure; inspect the PNGs before interpreting a PASS as visual
acceptance. Small touch-target measurements are warnings, not automatic failures.

The Pages mode uses only
https://togglehardestmode.github.io/Fitness/preview-v101/
and loads *synthetic* workout and Food Diary fixtures in **new, disposable
Chromium contexts**. It never opens your regular browser profile, reads
your real localStorage or overwrites saved records. The localhost mode
serves source via 127.0.0.1 on an ephemeral port. Both modes **block
service workers**; B098 offline/upgrade testing remains KIV, not passed.
No app files, storage keys, GitHub source or external server data are
changed by running this inspector. Captured images use fictional data.

### B097: Intercepted mobile navigation diagnosis (2026-11-09)

The first owner-run local and served-Pages attempts both returned `FAIL`
before screenshots, because Playwright clicked the **already-active Dashboard
tab** and an SVG training chart intercepted that touch click. This was both
an unnecessary test action and possible evidence of a real stacked-element
mobile issue. The revised runner **captures Dashboard first**, tests the
active tab's click actionability without actually activating it, and reports
any intercepted touch target as a `problems` entry. If another tab's touch
click is blocked, it uses keyboard Enter **only for diagnostic navigation**
and keeps the blocking touch failure in the final JSON and exit code.
It never uses `force=True` or suppresses a UI failure to claim PASS.

For the earlier `--single-branch` clone, `git switch --track` may fail
even after the explicit fetch. To inspect the new PR head without altering
tracking configuration, run `git fetch origin qa/b097-mobile-viewport-20261109`
then `git switch --detach FETCH_HEAD`. Inspect `git status --short` before
switching and preserve modified tracked files; untracked `__pycache__` is
generated by Python. Use **new** evidence directories for every rerun.

