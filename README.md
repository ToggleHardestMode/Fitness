# FitnessPilot

FitnessPilot is a local-first workout planner, training log and food diary that runs in your browser. No account or automatic device sync is required. Your records stay in the browser until you explicitly export or restore them.

## Open the app

- [Current preview](https://togglehardestmode.github.io/Fitness/preview-v101/) — see the banner for its actual version.
- [Production (older, separate app)](https://togglehardestmode.github.io/Fitness/).
- [Roadmap](ROADMAP.md) · [Release history](CHANGELOG.md) · [Preview notes](preview-v101/README.md).

The two editions keep separate workout stores. A Safari tab and an installed home-screen app may also keep different local data.

## Install and log

1. Open your chosen edition in Safari and confirm the banner. Use **Share → Add to Home Screen** to install it.
2. In **Plan**, choose or import a workout template and assign training days if needed. Importing never logs sets or automatically grants `[PT Review]` clearance.
3. In **Train**, select the workout and date; enter and save only sets you actually completed.
4. Use **Food Diary** for meals and nutrition entries. Missing entries do not mean zero intake.
5. In **Tools**, export backups regularly and store the files somewhere you control.

## Back up and restore

- Use **Tools → Download full backup (.json)** for workout records. Export Food Diary data separately when needed; a combined encrypted backup is also available where shown in the preview.
- Review a restore before confirming it: restoring can replace existing records. Use a disposable browser profile to rehearse recovery.
- Data does not follow you between devices automatically. Do not clear Safari website data as an update or troubleshooting step: that can remove your working copy.

## Development

The preview app lives in `preview-v101/` (a historical folder name, **not** its current version). The root app is separate and remains in production. Serve the repository over HTTP, not by opening HTML files directly.

Requires Node.js 22 for the checks. The app itself is static HTML, CSS and JavaScript.

```sh
python -m http.server 8000
# Open http://localhost:8000/preview-v101/
npm test
node scripts/verify-preview-assets.mjs
```

See [AGENTS.md](AGENTS.md) before changing the app. Preview source, published Pages content and real iPhone behaviour require separate verification; a passing source check is not device acceptance.
