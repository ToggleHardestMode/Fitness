# FitnessPilot workout templates

**Current target for manual import:** [V10.3 Home CSV](V10.3_Home_FitnessPilot_Import.csv) (four workouts, 27 exercise entries, **56 planned physical working sets**: Monday 17, Tuesday 10, Thursday 20, Friday 9). The older V10.2 templates remain available and are still embedded in the preview.

| Source | Purpose |
| --- | --- |
| [V10.3 Jeff Nippard tier annotations](V10.3_Jeff_Nippard_Tiers.csv) | **Research-only sidecar.** Tiers/match quality for the approved V10.3's 27 exercise entries; original V10.3 import is unchanged. |
| [V10.4 Jeff Nippard tier annotations](V10.4_Jeff_Nippard_Tiers.csv) | **Research-only sidecar.** Same audit for 27 V10.4 draft entries; does not activate V10.4. |
| [Jeff Nippard tier annotation methodology](Jeff_Nippard_Tier_Annotation_Method.md) | Provenance, exact vs approximate mapping, unranked movements and safety limitations |
| [V10.4 proposed workout CSV](V10.4_Home_FitnessPilot_Import.csv) | **Research candidate only (2026-11-09).** 27 entries / 49 physical sets (Mon 14, Tue 10 PT, Thu 16, Fri 9 PT). Not approved as default; not embedded in app; original V10.3 retained. |
| [V10.4 overlap coefficient CSV](V10.4_Overlap_Coefficients.csv) | Planning coefficients aligned to V10.4 exercise names and set counts; no runtime wiring |
| [V10.4 research change log](V10.4_Amendment_Review.md) | Exact exercise and dose changes, PT gates, evidence, limitations and validation |
| [V10.3 workout CSV](V10.3_Home_FitnessPilot_Import.csv) | **Target program (owner decision 2026-11-05).** 27 exercise entries, 56 physical sets: Upper A 17, Lower A 10, Upper B 20, Lower B 9. Not yet embedded in the app |
| [V10.3 overlap coefficient CSV](V10.3_Overlap_Coefficients.csv) | Per-exercise direct (1) / secondary (0.5) muscle contributions for V10.3 (B112) |
| [V10.2 workout CSV](V10.2_Home_FitnessPilot_Import.csv) | Exercise names, prescribed sets, rep targets, rest and source instructions |
| [V10.2 overlap coefficient CSV](V10.2_Overlap_Coefficients.csv) | Approximate direct/indirect muscle-dose coefficients for training-planning comparisons |
| [V10.2 optimization guide](V10.2_Overlap_Optimization_Guide.md) | Counting method, exercise emphasis and known constraints |
| [Archived workouts](../archive/workouts/README.md) | Historical V10/V10.1 and earlier sources retained for reference |

## V10.3 notes

- Import through the preview's **Plan** CSV import as a new versioned template; it must not replace or rewrite V10.2 history.
- Upper days are final. Lower days are **future targets under [PT Review]**; keep current lower sessions until each new loaded movement is individually cleared.
- The two loaded RDL variations from the V10.3 draft are **deliberately excluded** while deferred pending assessment; add them as a new version (V10.4) if cleared.
- `equipment` column: dumbbells are logged as **kg per dumbbell**; pulldowns as **kg shown on the cable stack**.
- Unilateral exercises (one-arm row, one-arm pulldown, lean-in raise, preacher hammer curl, split squats, single-leg hip thrust): **one set = both sides**, counted once.
- Supersets: arms are paired (SS1). Pressing with the pulldown is an *optional* pairing noted in each exercise's source note; straight sets are equally valid.
- Exercise names that are unchanged from V10.2 are kept identical, so an approved equivalence map (B073) can link their history. Renamed or new movements need new IDs.
- **Equipment:** Two pulldown exercises require access to a cable station; dumbbells and a bench alone are insufficient. Do not log a cable-stack weight for a substituted dumbbell exercise.
- **Exercise holds:** Core accessories are optional targets and should be skipped if not well tolerated; no exercise here authorizes training through concerning symptoms.

## Application status

- **Production root** [FitnessPilot](https://togglehardestmode.github.io/Fitness/) is an older separate application.
- **V15.22.2 preview** [FitnessPilot test app](https://togglehardestmode.github.io/Fitness/preview-v101/?v=59) still embeds V10.2 and retains V10.1 imports. To add V10.3, use **Plan → Import CSV** and select `V10.3_Home_FitnessPilot_Import.csv`. This adds four workout templates to the library; it neither changes logged sets nor assigns your weekdays. The app's parser retains per-exercise `equipment` metadata, but the current Train view does not display that field directly; the exercise notes also explain the relevant units.
- The preview preserves exercise `sourceNote`, PT-review status and seconds-per-side holds. The older production parser does **not** preserve all the same metadata.
- A **Custom** workout created with the V15.7+ versioned editor is separate from canonical V10.2; it must not silently reuse the original exercise's overlap coefficients.

**[PT Review]:** Tuesday and Friday lower sessions require physiotherapist review; an app import, symptom form or estimated muscle contribution does **not** constitute clinical clearance. Do not automatically assign or progress them.

**Math:** 62 prescribed sets means 62 physical sets, *not* the sum of regional direct and weighted indirect set equivalents. The coefficients are approximate planning weights and do not measure hypertrophy directly.

**Verification:** GitHub's merged V15.11.1 preview source is confirmed. Live Pages behavior, exported-file recovery, full native repository tests and real-device interactions are not confirmed by the source review. See the [root README](../README.md) and the [preview guide](../preview-v101/README.md).

Do not publish personal logged weights, workout history, backups, private health data, credentials or connected-account details to this public repository.
