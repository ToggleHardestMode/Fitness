# FitnessPilot 30-set logging baseline (B103)

The baseline uses a disposable localhost Chromium browser and a fictional
workout with ten exercises and three sets each. Each set is 10 kg × 10 reps
at RPE 7. Standard and Focus each start with an empty session and reload
after all 30 sets have been saved.

## Automated baseline

The browser runner reports elapsed time from the first scripted form action
through the last persisted save. It counts trusted pointer presses and any
changes to previously saved rows in that interval. Playwright fills inputs
directly. Its pointer counts and elapsed times describe the scripted sequence.

Measurements on the current checkout will be recorded here after CI.

### Repeat the automated run

With the pinned Playwright and Chromium install from the browser CI job:

```powershell
py .\qa\seeded-browser\train_ui_30.py --repo-root . --output .\B103-train-auto-new
```

Use a new evidence directory each time. Both modes run by default. The same
browser flow is also included in the integrated CI runner.

## Operator protocol

Record the checkout with `git rev-parse HEAD`. Use a new evidence directory
for each mode. Each command opens an isolated browser and seeds the fictional
workout for 2026-11-09. Enter all 30 sets by hand and press Enter in the terminal
after finishing. The report measures time from the first browser interaction to
that terminal confirmation. It records pointer presses, corrections to already
saved sets, and missing, extra or mismatched sets.

```powershell
py .\qa\seeded-browser\benchmark_sets.py --repo-root . --mode standard --output .\B103-standard-evidence
py .\qa\seeded-browser\benchmark_sets.py --repo-root . --mode focus --output .\B103-focus-evidence
```

Human benchmark results are pending for both modes.
