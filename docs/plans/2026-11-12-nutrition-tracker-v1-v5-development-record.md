# FitnessPilot nutrition tracker: development and evidence log (v1–v5)

**Recorded:** 2026-11-12  
**Type:** documentation-only handover; not a deployed FitnessPilot feature  
**Status:** historical implementation record, with verification boundaries noted  
**Privacy:** sanitized for this public repository; no personal consumption records, health observations, real CSV exports, or Excel workbooks are included.

## 1. Purpose and scope

This record captures the development work on a **standalone, local Excel nutrition tracker** and its matching **FitnessPilot Food Diary CSV** workflow. It does not claim that Excel features have been implemented in the browser app, merged into main, deployed to Pages, or accepted on any device.

The original work progressed from a single-day calorie log to a versioned Excel workbook supporting daily summaries, planned versus consumed food, 7- and 28-day review, coffee assumptions, missingness controls, entry quality, and limited sodium auditing.

**Sources of this record:** the 2026-11-10 to 2026-11-12 working conversation, the versioned local artifacts generated there, and a read-only artifact/format inspection on 2026-11-12. These are project-history sources, not independent nutrition research. Real personal source files are deliberately excluded from the repo.

## 2. Core import contract

The user selected the exact, stable CSV header:

~~~csv
date,name,occasion,servings,kcal,protein,carbs,fat
2026-11-13,Synthetic meal,lunch,1,500,35,50,15
~~~

The example above is **synthetic** and must never be treated as an actual user meal.

| Field | Intended meaning | Rule |
| --- | --- | --- |
| date | Food-consumption calendar date | ISO YYYY-MM-DD; do not derive from export time |
| name | Recognizable food or drink description | Preserve original meaning; do not silently overwrite history |
| occasion | Meal/snack label | Keep import-compatible free text |
| servings | Quantity consumed | Numeric; may be fractional |
| kcal | Energy **per serving** | Numeric tracking estimate or label value |
| protein | Protein grams **per serving** | Numeric; source quality may vary |
| carbs | Carbohydrate grams **per serving** | Numeric; source quality may vary |
| fat | Fat grams **per serving** | Numeric; source quality may vary |

Daily totals for nutrients use the same rule:

- daily_kcal = sum(servings × kcal) for records on that date
- daily_protein = sum(servings × protein)
- daily_carbs = sum(servings × carbs)
- daily_fat = sum(servings × fat)

A single integer or decimal used for logging is **not** proof of precise intake. Restaurant cooking oil, portion size, sauces, branded-product reformulation and drink preparation are material uncertainties. Actual consumption must be confirmed before entering planned food as consumed.

This eight-column format has **no sodium field**. Any sodium analysis therefore needs a **separately sourced, item-specific lookup**, and its output must be named **known sodium from matched items**, never total daily sodium.

## 3. Development history

| Phase | Delivered in the local conversation | What changed |
| --- | --- | --- |
| Initial logging | Single-day food workbook and template-compatible CSV | Replaced free-text calorie discussion with individual entries and the exact CSV contract; used point estimates and kept unconfirmed dinner out of the consumed log |
| Multi-day consolidation / v1 | Combined Food Diary CSV and early summary workbook | Preserved separate food entries, per-serving units, daily arithmetic and a multi-day rollup |
| Audited edition | Evidence/assumptions and scenario analysis | Rechecked numeric reconciliation; distinguished label-backed inputs from estimates; made coffee preparation a sensitivity variable rather than a silent historical rewrite |
| v2 | Seven-day check-in workbook | Added morning-weight, steps, sleep, hunger, intake/protein comparison, and a chart; corrected an assumptions-sheet reference mismatch |
| v3 | Quality-control workbook | Added 28-day view, weekly scorecard and entry-quality checks; replaced fixed-position coffee/chicken auditing with date- and item-based logic |
| v4 | Reliable-logging workbook | Made the 28-day sheet the single write location for weight/activity; linked seven-day display to it; introduced explicit complete/incomplete food-day designation |
| v5 | Evidence and sodium audit workbook | Added Food Pattern Audit and limited known-sodium totals; added readiness checks to prevent premature weight-loss conclusions |

**Version naming:** v1–v5 here refers to the **standalone Excel tracker**, not the FitnessPilot app preview version or workout program versions V10.3/V10.4. Do not bump app banners, change browser storage keys, or treat spreadsheet version numbers as app releases.

## 4. Changes and rationale

### 4.1 One consumable record format

The user requested a CSV that FitnessPilot could import, not only a custom spreadsheet. All later CSV exports retained the eight-column order. The workbook presents analyses separately, keeping the import contract free of Excel-specific columns.

**Caution:** Import compatibility of a local CSV schema is not proof of an end-to-end import/restore test against a particular deployed browser build. That acceptance remains open.

### 4.2 Per-serving arithmetic and auditable assumptions

Quantity and nutrient columns are kept distinct. If an item has multiple servings, its contribution must be multiplied by servings exactly once. Packaged-food label inputs are preferable to generic estimates when a matching label and portion are known.

Each entry may have a different evidence quality. Suggested categories:

- **Label-backed:** matching product, serving and nutrition panel
- **Estimated:** restaurant or visually estimated portion
- **Assumption-derived:** fixed cup/recipe or an inferred weight
- **Unknown:** no defensible numeric estimate yet

Avoid replacing an unknown with zero or assigning false measurement precision.

### 4.3 Coffee calibration without rewriting historical records

Repeated drinks create systematic uncertainty. The workbook compares a configured baseline per-cup calorie assumption with alternative per-cup assumptions. A scenario analysis changes a projection, **not** the saved consumption history.

The drink's actual condensed/evaporated milk, sugar and serving volume should be measured or otherwise verified before calling an assumed baseline accurate.

### 4.4 Missingness, completeness and weight trends

A date with no food entry is **unlogged**, not zero calories. A date with one meal may still be incomplete; a complete-day flag must be explicitly recorded.

Similarly, no weight measurement means **missing**, not 0 kg or a plateau. The weekly review should differentiate:

1. mean intake among days with entries;
2. mean intake among days the owner marked complete;
3. weight data coverage and measured weekly weight averages.

The working workbook specified a minimum weigh-in count for displaying a weekly average. Treat this as a **workbook rule**, not an evidence-based universal minimum. No automatic calorie adjustment should be triggered solely by a short or incomplete record.

### 4.5 Sodium accounting: known lower bound, not total intake

A manufacturer nutrition panel was used for one packaged item. The Food Pattern Audit computes sodium only where a product-specific per-serving value is available. Restaurant dishes, sauces, broths and other unlabeled items are not automatically assigned sodium = 0.

The resulting number is **known sodium contributed by matched items**, not total sodium and not a comprehensive medical or dietary assessment. Avoid sodium-based conclusions where coverage is incomplete.

### 4.6 Quality gate and control panel

Later versions added checks for missing/non-numeric fields, unclassified foods, suspicious calorie-to-macronutrient disagreements and unresolved assumptions. Data-quality flags are prompts for review, not grounds for silently altering logged values.

The control panel centralizes configurable targets/assumptions instead of repeating hardcoded values throughout sheets. Targets are owner-configurable and are not automatically clinical prescriptions.

## 5. Recorded quality assurance and its limits

**Previously reported during local development** (not a GitHub-native reproducible suite):

- Historical food rows and daily totals were carried through successive versions.
- Temporary future food and weight entries were inserted to exercise formula propagation and then removed.
- Seven-day and 28-day views, complete-day classification, coffee adjustments and limited sodium audits were checked with temporary inputs.
- Earlier iterations identified and corrected misaligned evidence references, fixed-row auditing, dual weight-entry locations, and an unclassified-food counter defect.
- Prior conversational reports said formula-error scans found no matches. These claims are **historical reports**, not independent proof of all spreadsheet formulas.

**Read-only inspection carried out on 2026-11-12:**

- The local v5 XLSX is a valid ZIP/OOXML package and contains ten worksheet XML parts.
- The latest local CSV uses the exact eight field names in the correct order; populated rows have parsable numeric nutrient/serving values.
- Worksheet XML contains formulas and no literal cached spreadsheet-error markers were found in inspected worksheet parts.
- These checks **do not** prove that every formula recomputes correctly in Excel, all charts display properly, all input validations work, or CSV import succeeds in the live app.

**Not run for this documentation record:** a native Excel recalc comparison, full browser import/export acceptance, real-device testing, or an externally audited nutritional-label database. No synthetic test entry was retained as real user data.

### Reproducible synthetic acceptance scenarios for future implementation

| ID | Synthetic scenario | Required behavior |
| --- | --- | --- |
| N01 | One synthetic serving | Daily calories and macros equal per-serving input |
| N02 | Fractional or multiple servings | Exactly one multiplication by servings |
| N03 | No entries on a date | Missing/blank, never 0-consumed |
| N04 | One meal with incomplete flag | Excluded from complete-day average |
| N05 | Mark previously incomplete date complete | Complete-day denominator updates |
| N06 | Change coffee scenario amount | Scenario changes; historical raw rows do not |
| N07 | Insert a new recognized food anywhere | Summary follows entry, not fixed row number |
| N08 | Insert an unclassified item | Entry-quality counter catches it |
| N09 | Sodium for one known-label item | Uses serving multiplier, says partial/known sodium |
| N10 | Unknown sodium in other foods | Unknown remains unknown; never implies total = known |
| N11 | No morning weights | Trend remains blank, no 0 kg datapoints |
| N12 | New synthetic weight in 28-day entry point | Seven-day view mirrors it once |
| N13 | Clear a temporary test entry | All derived summaries return to baseline |
| N14 | Export CSV | Exactly eight columns and stable per-serving semantics |
| N15 | Corrupt or nonnumeric nutrient field | Flag invalid rather than silently coercing |
| N16 | Fewer than sufficient complete days/weights | No inferred deficit, plateau, or prescriptive adjustment |

These scenarios are **acceptance specifications**, not a claim that a committed automated suite has passed.

## 6. Known limits and open risks

1. **Measurement error dominates formula precision.** Eating-place portions, cooking methods and drinks have uncertain energy content.
2. **Energy versus macro consistency:** 4/4/9 kcal-per-gram checks are approximate; fibre, rounding and labeling conventions can make a valid label differ.
3. **Date semantics:** Late-night food must be attributed to the local consumption date, not blindly to file creation/export time.
4. **Conflicting assumptions:** When an item's actual serving weight becomes known, record an explicit correction rather than silently rewriting older estimates.
5. **Sodium coverage:** Partial matched items cannot establish whole-day salt consumption.
6. **Weekly inference:** Short intake windows and water-weight fluctuations do not establish maintenance calories or fat-loss rate.
7. **Formula portability:** Validate Excel's automatic recalculation and data validation separately from OOXML structural checks.
8. **Growing data range:** Verify that inserts beyond preformatted rows are included in every SUMIFS, count, chart and quality gate.
9. **CSV import:** Verify the actual Food Diary on the current preview, including per-serving values, fractional servings and missing/invalid data handling.
10. **Avoid duplicate systems:** Before integrating, compare with the live preview Food Diary and existing roadmap work.

## 7. Relationship to existing FitnessPilot work

The standalone Excel tracker is **not** a replacement for the app's local-first storage and food diary.

- [ROADMAP.md](../../ROADMAP.md) states the authoritative safeguards: never invent saved progress; missing is not zero; incomplete food days do not count as complete.
- [AGENTS.md](../../AGENTS.md) prohibits public commits of real food/workout data and requires branch/PR workflow.
- Open PR [#61](https://github.com/ToggleHardestMode/Fitness/pull/61) concerns Food Diary missingness; coordinate rather than duplicate it.
- Open PR [#103](https://github.com/ToggleHardestMode/Fitness/pull/103) concerns nutrition barcode/label research; reuse verified provenance if an integration is eventually proposed.
- Open PR [#111](https://github.com/ToggleHardestMode/Fitness/pull/111) addresses long-term maintenance research; it is adjacent but separate.

This record does not alter any roadmap task status, accept any unmerged proposal, or authorize a production release.

## 8. Suggested next actions (not implemented here)

**P0: Measurement and provenance**

- Establish repeatable serving measurements for frequently logged drinks and food.
- Keep a source/measurement/confidence tag outside the eight-column import format; define a separate metadata link if needed.
- Require explicit complete-day confirmation and actual morning weights before interpreting a calorie deficit.

**P1: Regression specification**

- Convert N01–N16 into synthetic tests in a future scoped PR, observing existing Food Diary behavior and owner decisions.
- Add CSV round-trip acceptance using disposable browser storage.
- Check exact per-serving semantics and both empty and incomplete dates.

**P2: Integration design, owner approval required**

- Determine whether the Excel dashboard should remain an offline companion or become a read-only import/export analysis inside the app.
- Preserve fixed browser storage keys, backup compatibility and the existing local-first design.
- Defer weight-loss recommendations until data sufficiency, provenance and owner-selected policy are defined.

## 9. Privacy and custody

Personal meal logs and Excel exports created in the working conversation are **private working artifacts**. They have **not** been committed to this public repository. Real food descriptions, daily totals, weight observations, location details, and images are intentionally absent here. Any later request to publish those records should explicitly acknowledge the public exposure and repository privacy rule.

**Change scope of this PR:** a dated, sanitized project-development document only. No application source, templates, tests, stored records, deployments or roadmap statuses are changed.
