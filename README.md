# FitnessPilot — local-first workout tracker

FitnessPilot is a browser-based, no-account workout tracker hosted on GitHub Pages. The public repository contains **application source and example routines only**, not your private workout history.

## Open the app

| Edition | Link | What it is |
| --- | --- | --- |
| **Production (older app)** | [Open FitnessPilot](https://togglehardestmode.github.io/Fitness/) | Existing root application, kept separate from experimental features |
| **V15.11.1 test preview** | [Open the V15.11.1 preview](https://togglehardestmode.github.io/Fitness/preview-v101/?v=33) | Most recent GitHub **source** version; preview-only workout features, not a production upgrade |

**Release status (23 October 2026):** V15.11.1 preview keeps the lifetime milestones and logbook, fixes a Days with logs counter mismatch and adds synthetic backup-integrity regressions. GitHub source publication does **not** prove Pages delivery or device acceptance. Check for the **V15.11.1** banner; production root remains an older separate app.

Both editions are served from the same web origin but use different browser-storage keys:

- Production: `fitnesspilot.web.v1`
- Preview: `fitnesspilot.preview.v101.v1`

The preview folder's historic name `preview-v101` is intentional; it does **not** mean the preview is still at app version V10.1. Do not clear Safari website data to force an update, because doing so can remove saved records.

## Install and start on iPhone

1. Open the edition you want in **Safari** and confirm its version, especially for the preview.
2. Use Safari's **Share → Add to Home Screen** (labels depend on iOS). A separate installed web-app storage context can behave differently; do not assume workout history is automatically shared with a Safari tab.
3. In **Plan**, add a template (the current preview recommends **V10.2 Home**), then separately choose weekdays if you want a schedule.
4. In **Train**, choose the workout and date, enter your actual weight, repetitions and effort, and **Save** the completed sets.
5. In **Tools**, export a full JSON backup regularly and save it somewhere you control.

Workout templates are **not** automatically assigned, completed or medically cleared when imported. Exercise history and weekly assignments are distinct.

## V15.11.1 preview feature guide

These features are implemented in `preview-v101/`. Their presence in GitHub is verified; individual device behavior still requires testing.

| Area | Available in the V15.11.1 preview |
| --- | --- |
| **Plan** | Optional **V10.2 Home** 4-day workout import, earlier **V10.1 Home** templates, CSV template import, seven-day scheduling |
| **Workout editor** | **Customize** an exercise and **Save as new workout version**; original template IDs and saved historical sets are preserved; new version is not scheduled automatically |
| **Train** | Standard logging, Focus Mode, saved-set references, explicit **Copy saved set** for eligible upper-body sets, RPE entry, rest timer |
| **Dashboard** | **Consistent saved-working-set day counts**, lifetime completed working sets and a read-only next milestone (25, 50, 100, 250, 500, 1,000, then each 500), daily saved set chart, logged/planned weekly totals, secondary expandable kg × reps calculation, and **13-region V10.2** direct/estimated indirect overlap |
| **Recovery** | Before/after/next-day symptom journal and **[PT Review]** warning for lower-body sessions; no automatic clinical clearance or loading progression |
| **Progression review** | Read-only comparison with prior sets; any suggested target is optional and is **never** auto-filled or saved |
| **Tools** | Full JSON export/guarded restore, local-data integrity check, calendar reminder export, **Workout Logbook**, full-history CSV export, sound preference |

The logbook displays the **latest 15 historical sessions** in the preview and lets you **Download full history (.csv)** with all valid historical saved sets. It refers to the workout template version used when the set was logged; it does not rewrite history to match the current schedule. The CSV contains workout details and notes, so keep it private.

The Ragnarok-inspired soft UI, gold styling and click-feedback sound remain part of the preview. Browser audio and service-worker offline behavior are device-dependent and must be checked in Safari.

### V10.2 exercise plan and overlap numbers

The canonical [V10.2 workout CSV](templates/V10.2_Home_FitnessPilot_Import.csv) contains **4 workouts, 24 exercise entries and 62 planned physical weekly sets**:

| Day | Workout | Prescribed sets |
| --- | --- | ---: |
| Monday | Upper A | 17 |
| Tuesday | Lower A **[PT Review]** | 13 |
| Thursday | Upper B | 21 |
| Friday | Lower B **[PT Review]** | 11 |

[Muscle-overlap coefficients](templates/V10.2_Overlap_Coefficients.csv) and the [optimization guide](templates/V10.2_Overlap_Optimization_Guide.md) are training-planning sources. Estimated indirect muscle-set equivalents are **not additional physically completed sets** or scientific measurements of muscle growth. They cannot establish medical clearance; the lower-body routines must remain clinician-dependent.

Older versioned sources are retained under [archive/workouts](archive/workouts/README.md). Template editing creates a separate custom version; custom exercises must not inherit unverified canonical V10.2 coefficient assumptions.

### What does “kg × reps” mean?

The displayed external-load volume is **the sum of entered weight × repetitions for saved working sets**, not a count of repetitions or a measure of muscle growth. A set of 11 kg × 12 reps contributes 132 kg × reps. Dumbbell weights are **not** automatically doubled for two hands. Time-based holds count as working sets but do not contribute to kg × reps. Open **Show calculation** on the Dashboard to audit set contributions.

## Back up and restore safely

- **Tools → Download full backup (.json)** saves the app's templates, workouts and related stored data for the selected browser edition.
- **Tools → Check saved data integrity** checks the current browser snapshot read-only; it does **not** prove that an exported file can be recovered on another device.
- **Tools → Restore backup** previews the JSON and requires an explicit **REPLACE** confirmation. **Restoring replaces current preview records**. Back up first and test restore only with disposable data.
- Root production and preview have separate storage keys; transferring or switching devices requires deliberate export/import. There is **no automatic cross-device synchronization**.
- The web app uses a service worker for offline caching, but real iPhone offline navigation, background audio, exported-file recovery and Pages-served content are **not yet confirmed**. Do not use “clear website data” as a troubleshooting shortcut.

## Development and testing

The code is plain HTML/CSS/JavaScript ES modules; no npm packages are required to use the site. To run a local HTTP server from a repository checkout:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000/` for production or `http://localhost:8000/preview-v101/` for the preview. Do not double-click the HTML file because module loading and service-worker behavior require a local server or HTTPS.

For automated checks, install Node.js and run from the repo root:

```powershell
npm test
```

The test command is `node --test tests/*.test.mjs` ([package.json](package.json)). The repository contains source-based regression checks for historical templates, volume calculations, workout editing, recovery, Focus Mode and logbook export.

**Verification boundary:** Earlier changes were checked using synthetic V8 fixtures and GitHub source read-backs; a complete native test run on the current full GitHub checkout, live GitHub Pages HTTP check, and physical iPhone acceptance have **not** been established by those checks. Do not treat a green documentation check as proof of device behavior.

## Project status and deferred ideas

- **Current preview source:** V15.11.1; production remains a separate older application. Native full-suite, iPhone and real downloaded-file recovery acceptance are outstanding.
- **Pending release QA:** Native full test suite on a complete checkout, real Safari/iPhone walkthrough, offline test and export/restore using disposable data.
- **KIV (not built):** Illustrated **Weight Trend Journey** chart with daily weigh-ins, a prominent 7-day trend, goal trajectory and milestone annotations; separate SATNA experiment.
- **Future work:** Measured 30-set logging speed/error benchmark and optional UX improvements based on real device use.

Public repo documentation is intentionally limited to product and technical behavior. Private development notes, personal training records and health observations belong **outside** this repository.
