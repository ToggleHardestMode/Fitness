# FitnessPilot V10.1 — Test This Iteration First

This is a separate experimental preview, not the production FitnessPilot website. Use **invented records only**. Do not enter personal medical data into a third-party preview.

## Launch on iPhone

1. Open the dedicated StackBlitz branch link given with PR #9 in Safari.
2. Allow the project to load and start `npm run dev`. The terminal should report `FitnessPilot preview: http://0.0.0.0:3000`.
3. Open the **Preview** pane, or tap its **Open in New Tab** icon, to display the actual FitnessPilot interface.
4. If Safari cannot start StackBlitz, report the error screen. StackBlitz WebContainers are beta on iOS; desktop browsers are a fallback.

## Five quick checks (use sample data)

1. **Import:** In **Plan**, tap **Add V10.1 Home templates**. Expect four workouts and 24 exercises in total. Tap Add again; duplicates should be skipped.
2. **Review flags:** Tue/Friday lower templates should say `[PT Review]` and should remain unassigned. Assign **Upper A on Monday** and **Upper B on Thursday** and save (do not assign lower workouts merely to test).
3. **Dashboard:** With no recorded sets, expect **38 scheduled working sets, zero completed**. Arms is combined; unilateral sets are not doubled.
4. **Exercise:** In Train, confirm that Upper A shows exercise notes. Open a lower-day side plank without exercising; the logger must label **seconds/side**, not reps.
5. **Symptom journal/backup:** Record made-up observations for the same date: **before = severity 1, left buttock**; **next morning = severity 3, left foot**. The review should flag worsening and never imply medical clearance. Download a full JSON backup and confirm a `symptomLogs` array exists. Test restoration **only in this disposable preview**.

Also tap the Ragnarok-style buttons and verify the optional sound toggle; navigate among Dashboard, Train, Plan and Tools. Reload once to check whether sample entries remain if the preview keeps its browser storage.

## Release gate

Do not clear production Safari site data, use real health information in this preview, or restore a preview backup to production. Report each check as PASS or FAIL and send screenshots of any problems. **Stop before the next feature batch or merging PRs until the preview is reviewed.**
