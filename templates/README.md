# FitnessPilot workout templates

**Current canonical workout source:** [V10.2 Home CSV](V10.2_Home_FitnessPilot_Import.csv) (four workouts, 24 exercise entries, **62 planned physical working sets**: Monday 17, Tuesday 13, Thursday 21, Friday 11).

| Source | Purpose |
| --- | --- |
| [V10.2 workout CSV](V10.2_Home_FitnessPilot_Import.csv) | Exercise names, prescribed sets, rep targets, rest and source instructions |
| [V10.2 overlap coefficient CSV](V10.2_Overlap_Coefficients.csv) | Approximate direct/indirect muscle-dose coefficients for training-planning comparisons |
| [V10.2 optimization guide](V10.2_Overlap_Optimization_Guide.md) | Counting method, exercise emphasis and known constraints |
| [Archived workouts](../archive/workouts/README.md) | Historical V10/V10.1 and earlier sources retained for reference |

## Application status

- **Production root** [FitnessPilot](https://togglehardestmode.github.io/Fitness/) is an older separate application.
- **V15.11.1 preview** [FitnessPilot test app](https://togglehardestmode.github.io/Fitness/preview-v101/?v=33) already embeds V10.2 and also retains the V10.1 import option. To add V10.2 in the preview, use **Plan → Add V10.2 Home templates**. Imports are opt-in and do **not** change previously logged sets or auto-assign weekdays.
- The preview preserves exercise `sourceNote`, PT-review status and seconds-per-side holds. The older production parser does **not** preserve all the same metadata.
- A **Custom** workout created with the V15.7+ versioned editor is separate from canonical V10.2; it must not silently reuse the original exercise's overlap coefficients.

**[PT Review]:** Tuesday and Friday lower sessions require physiotherapist review; an app import, symptom form or estimated muscle contribution does **not** constitute clinical clearance. Do not automatically assign or progress them.

**Math:** 62 prescribed sets means 62 physical sets, *not* the sum of regional direct and weighted indirect set equivalents. The coefficients are approximate planning weights and do not measure hypertrophy directly.

**Verification:** GitHub's merged V15.11.1 preview source is confirmed. Live Pages behavior, exported-file recovery, full native repository tests and real-device interactions are not confirmed by the source review. See the [root README](../README.md) and the [preview guide](../preview-v101/README.md).

Do not publish personal logged weights, workout history, backups, private health data, credentials or connected-account details to this public repository.
