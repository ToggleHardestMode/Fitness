# Jeff Nippard tier annotations for FitnessPilot V10.3 and V10.4

Date: 2026-11-09. **Research-only sidecars; not app-import files.**

## Source and scope
- Core original tier-list videos: [Chest](https://www.youtube.com/watch?v=fGm-ef-4PVk), [Back](https://www.youtube.com/watch?v=jLvqKgW-_G8), [Shoulders](https://www.youtube.com/watch?v=SgyUoY0IZ7A), [Biceps](https://www.youtube.com/watch?v=GNO4OtYoCYk), [Triceps](https://www.youtube.com/watch?v=OpRMRhr0Ycc), [Quads](https://www.youtube.com/watch?v=kIXcoivzGf8), [Glutes](https://www.youtube.com/watch?v=3ryh7PNhz3E).
- Fan transcriptions used for cross-checking: https://hackmd.io/ntziN77XRjSn4ESlUGQ9CA and https://www.reddit.com/r/JeffNippard/comments/1ow5r0h/compilation_of_jeff_nippards_1_favorite_exercises/
- Original video transcripts inspected for back, shoulder and glute rankings where obtainable (via https://rosetta.to/u/jeffnippard/). Other letter grades are reported in a community transcription of his original tier-list videos; not all source-video ranking frames were independently checked.
- **The fan-maintained Google Sheets workbook cited in the chat could not be read directly.** Do not claim a byte-by-byte match to that workbook.
- Nippard's tiers are subjective hypertrophy exercise evaluations, **not** measures of expected muscle gain, objective scientific classifications, medical safety rankings, or exercise-clearance decisions.
- Rankings from earlier videos (2024–2025) are not necessarily 2026 coaching recommendations. These sidecars document the inspected rankings, not a new 2026 official list.

## Sidecar file schema
`V10.3_Jeff_Nippard_Tiers.csv` and `V10.4_Jeff_Nippard_Tiers.csv` each contain **27 entries**, aligned in the exact original workout CSV order. Columns retain version, day, workout, exercise and sets, then add Nippard tier, match-quality, ranked comparator, original video or secondary-source URL, additional source, explanatory note and PT-review flag.

Rank or label interpretations:
- `S`, `A`, `B`: a grade from his exercise-ranking content. All grades must be read with `match_quality`.
- `S (quads); A (glutes)`: context-specific ratings from **different videos**; not a contradictory single tier.
- `Favorite; no letter`: book favorite reported by a fan compilation, **not an S-tier grade**.
- `Unranked`: no unambiguous grade for that precise variation in checked material. If the notes mention a related exercise's tier, **do not transfer it**.
- `direct_match`: same named movement and similar execution.
- `same_exercise_family`: graded parent movement; exact personal variation not separately rated.
- `closest_ranked_variation`: meaningful variation exists, so grade is indicative only.
- `not_directly_graded`: no supported single tier; left unranked.
- `book_favorite_no_tier`: top choice in a book list, not a video grade.

## Important disputed or contextual assignments
- Neutral-grip lat pulldown: original back-video transcript calls it **S**; a fan compilation marks **S+**. We use original transcript **S**.
- Bench-supported one-arm DB row: **A** follows the one-arm dumbbell row category, despite a *different* chest-supported row family getting **S**.
- Chest-supported reverse DB fly: **B** is borrowed from the bent-over reverse DB fly; support may improve stability, but Jeff did not separately rank this exact variation.
- Supported DB overhead triceps extension: **Unranked** until unilateral vs bilateral form is specified. The closest one-arm DB overhead extension is rated **A**, while a DB French press is rated **B**.
- DB hip thrust: bilateral DB-specific grade not established; **barbell B / machine A** are listed only as related exercises.
- Standing DB calf raise: listed as Nippard's calf favorite from *The Muscle Ladder* via a fan compilation; **no letter grade**.
- PT-review moves retain their PT-review status regardless of letter grade; hypertrophy tier is not an injury-safety score.

## Validation, immutability and integration
- V10.3 original workouts must remain byte-for-byte unchanged; V10.4 candidate workout file also remains unchanged.
- Do **not** append tier fields to workout import CSV: the FitnessPilot CSV parser expects the existing workout schema. Sidecars do not change history, IDs, programmed sets or release defaults.
- Never infer an unknown tier from a different variation, or from a machine-only recommendation.
- Sidecars are documentation only, not a production feature or a clinician-approved progression system.
- A user-facing app integration, if desired later, must validate lookups by version + day + exercise and explicitly distinguish unranked/approximate matches.

## Sources and audit limitations
Source links in each row identify the relevant ranking video, not an independently verified proof that the exact variant appeared in every video. Tiers are Nippard's opinions expressed in coaching content; their scientific support varies. This audit verified list consistency with the original two FitnessPilot workout files, not physiologic efficacy or clinical safety.
