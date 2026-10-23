# FitnessPilot V15.10 — test preview

**Test URL:** https://togglehardestmode.github.io/Fitness/preview-v101/?v=31

The folder is still named `preview-v101` for continuity; the application banner and manifest currently identify **V15.10**. It is a separate preview application, **not** the production root upgrade.

## Quick acceptance walkthrough

Use disposable example data and **do not clear browser website data**:

1. Confirm the preview banner shows **V15.10**.
2. Under **Plan**, choose **Add V10.2 Home templates** and verify four sessions/24 exercise entries/62 prescribed weekly sets. An additional **V10.1 Home** import remains available.
3. Confirm that both lower workouts retain **[PT Review]**, and that importing never assigns them to weekdays automatically.
4. Under **Train**, log a sample upper-body set. Verify the gold **Total completed sets** and weekly total rise once, the daily chart updates, and **Next milestone** updates by one. Editing the same set must not add another. Milestones are 25, 50, 100, 250, 500, 1,000 and then every 500; they do not prescribe more training. Weight × reps remains secondary under **Show calculation**. Timed holds count as sets but not kg × reps.
5. Try **Focus Mode** and, on an eligible unsaved next set, **Copy saved set**. It must copy only weight and repetitions; RPE and saving remain explicit.
6. In the **Plan → Workout Library**, select **Customize** and **Save as new workout version** with one safe test change. The original workout and saved history must remain unchanged; the new version should remain unassigned until you choose it.
7. Under **Tools → Workout logbook**, expand a session and confirm it uses the original workout version. **Download full history (.csv)** to a private location; verify the file contains all saved sets, even if only the latest 15 sessions are shown on-screen.
8. In **Tools**, download a JSON backup before changes. **Check saved data integrity** only verifies the current browser snapshot; actual file restore and offline use still require separate testing with disposable records.
9. Confirm existing sound, rest timer, recovery journal, and manually set assignments still work.

If the banner does not show V15.10, verify the link and cache version without clearing local storage. Stop and report unexpected changes to logged records, exercises, assignments or PT warnings.

## Known release boundaries

- The source exists in GitHub and was merged through [PR #28](https://github.com/ToggleHardestMode/Fitness/pull/28). A GitHub merge **does not** prove the latest GitHub Pages response has been fetched by every browser.
- The preview uses localStorage key `fitnesspilot.preview.v101.v1`; the older root production uses `fitnesspilot.web.v1`. Both share a host origin but use separate app data keys.
- Lower-body physiotherapist review remains required. Symptom observations and overlap coefficients are **not** medical clearance.
- No remote sync, live workout upload or guaranteed closed-app notification is implemented.
- Actual iPhone Safari acceptance, exported JSON-file recovery on a second device, offline navigation and complete native `npm test` execution on the current repository remain outstanding.

## Developers

At the repository root, run a local HTTP server:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000/preview-v101/` and then run:

```powershell
npm test
```

The scripted tests are defined in [package.json](../package.json) and include preview source and regression checks. These tests complement—not replace—the manual browser checks above.

For canonical workout data and coefficients, consult the [template documentation](../templates/README.md). For overall installation, backups and the separation between production and preview, consult the [root README](../README.md). Keep private workout logs and personal health history out of the public Git repository.
