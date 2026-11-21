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

Measured on 15 November 2026 SGT in the [browser CI run](https://github.com/ToggleHardestMode/Fitness/actions/runs/43697259993)
for [benchmark commit `e856823`](https://github.com/ToggleHardestMode/Fitness/commit/e8568239cdc3a2f5c7e029559b55f97bec9916de).
The app under test was preview V15.26.14 from [main `0b2857d`](https://github.com/ToggleHardestMode/Fitness/commit/0b2857d15eba85f7cb07f4827ccd55ebc438d8ec).

| Mode | Elapsed | Pointer presses | Save submissions | Corrected saved sets | Persisted after reload | Missing / extra / mismatched |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard | 24.906 s | 50 | 10 | 0 | 30/30 | 0 / 0 / 0 |
| Focus | 39.523 s | 30 | 30 | 0 | 30/30 | 0 / 0 / 0 |

A pointer press is a browser pointer-down event after setup. Playwright
fills the numeric fields without pointer events. Corrections count changes
made to already saved rows. CI times vary by runner and browser load.

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
