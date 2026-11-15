# FitnessPilot research: barcode scanning and nutrition-label photo extraction

**Research date:** 2026-11-10 (Asia/Singapore)  
**Status:** Research note / proposed feature, **not implemented or approved for release**  
**Product context:** FitnessPilot is a local-first browser-based workout and Food Diary tracker.  
**Scope:** Packaged-food barcode lookup, camera OCR of nutrition information panels, food-data sourcing, Singapore packaging, user verification, privacy and evaluation. No personal food logs or product photographs are included.

**FitnessPilot-specific code audit:** [Source-level implementation and backup compatibility analysis](2026-11-10-food-capture-code-audit.md). This companion checks the actual Food Diary v1 schema, current two-store encrypted backup code, CSP, service worker and relevant tests. **The backup feature exists in source; real-device recovery remains unverified.**

## Executive recommendation

Build **barcode-first, label-photo fallback, user-verified reuse**. Offer two independent, equally visible entry actions: **Scan barcode** and **Scan nutrition label**, plus manual search/entry. A barcode generally identifies a packaged product; it does **not** carry the food's calories or macros. Lookup retrieves nutrition data from a product database. Photo capture is a different path: OCR reads the actual package, then a structured parser maps values to nutrients, units, and serving basis. The user reviews values before adding them to the Food Diary. Confirmed product records can be reused without repeating capture.

**Non-negotiable:** Do not silently convert missing nutrition fields into zero, turn an OCR guess into an asserted fact, or overwrite historical Food Diary totals when external nutrition data changes.

## 1. Market patterns and product gap

| App / approach | Observed pattern from prior research | Implication / verification gap |
| --- | --- | --- |
| Cronometer | Barcode-based lookup, custom foods, and a supported nutrition-label capture workflow associated with missing products; user reports of database errors can be submitted for curation | Useful reference for human verification; confirm exact platform/region availability before claiming feature parity |
| MyFitnessPal | Large food catalogue and barcode search, with database entries requiring scrutiny | Product recognition and food-record accuracy are separate; current plan restrictions may change |
| MyNetDiary | Barcode lookup and product/photo submission pathways | Staff-assisted or region-restricted submissions do not imply instant universal OCR |
| Open Food Facts contributor ecosystem | Allows product images and nutrition information to be contributed and processed | Suitable reference for the lookup + enrichment cycle; assess licensing and API contracts |

**Product hypothesis (untested):** A direct 'Scan nutrition label' option independent of first obtaining a barcode may reduce friction for new products, generic packages or imports. Current consumer app UX and specific plan restrictions should be rechecked during design, not hard-coded from this research.

## 2. Barcode lookup: technical pipeline

1. Capture a still image or live camera feed using browser camera permissions, with a manual barcode-entry fallback.
2. Decode EAN-13, EAN-8, UPC-A or another suitable 1-D barcode format; validate checksum/format where applicable.
3. Search **locally verified foods first**, then a selected external food database by barcode.
4. Display brand, product name, size/variant, nutrition basis, source and last-verification provenance.
5. Require review of nutrients and serving/portion before saving a meal. If no trustworthy match exists, offer label-photo capture or manual entry.
6. Cache only what the selected database licence permits; support offline reuse and clear error handling for no internet, API rejection or no match.

**PWA candidate:** [ZXing browser](https://github.com/zxing-js/browser) supports webcam/video/image barcode decoding and is a reasonable spike for the existing vanilla JavaScript preview. The native-browser BarcodeDetector API may be a progressive enhancement where supported, **not** the sole compatibility path. **Native-only alternatives:** [Google ML Kit barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning) and Apple native Vision/VisionKit APIs, if the product later changes architecture.

**Implementation caution:** Camera access, rear-camera selection, focus, torch controls, permission denial, iOS Safari/PWA behaviour and landscape/low-light conditions all need real-device validation. Do not introduce a native wrapper merely for scanning without a separate owner decision.

## 3. Nutrition-label photo capture: technical pipeline

1. Independently open 'Scan nutrition label'; allow camera photo **and** existing photo upload.
2. Provide cropping, rotation, retake and image-quality cues; avoid keeping photographs longer than needed.
3. OCR recognizes text *and* positional coordinates (text alone often loses table-column meaning).
4. The parser identifies column headings, nutrient rows, units, serving size, servings per package and basis: per serving, per 100 g, per 100 mL, or prepared/reconstituted.
5. Normalize values with traceability to source cells. Preserve raw text alongside parsed fields until confirmation.
6. Validate units, numerical formatting, impossible/contradictory associations, and missing key values. Mark uncertain fields for manual resolution.
7. Show side-by-side source image (locally, where privacy allows) and editable parsed values. Save **only user-confirmed** values as a verified food.
8. For a logged meal, snapshot the chosen nutrition values and portion. Future database edits must not mutate already-recorded consumption.

**Critical error cases:** two nutrient columns; kcal versus kJ; grams versus milligrams; liquid versus solid basis; dry versus as-prepared powder; decimal points/commas; 'less than' marks; nested rows for sugars, saturated fat, fibre and sodium; partially obscured tables; text mixing multiple languages. Never infer a missing value as zero.

### Candidate OCR technologies

| Technology | Reason to investigate | Key limitation |
| --- | --- | --- |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Open source browser-based local OCR; no compulsory photo upload | Text recognition is not nutrition-table interpretation |
| [Google ML Kit text recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2) | On-device processing for native mobile integrations | PWA integration is not direct |
| [Google Cloud Vision OCR](https://cloud.google.com/vision/docs/ocr) | Cloud OCR returning text/location data | Network, privacy, API keys, usage billing, parsing still needed |
| [Azure Document Intelligence](https://learn.microsoft.com/azure/ai-services/document-intelligence/overview) | Form/table structure extraction | Paid cloud dependency; extraction must be benchmarked |
| General-purpose vision-language models | Flexible fallback for difficult/nonstandard panels | May guess or hallucinate values; require field-level verification |
| [NutriSight](https://github.com/DRG4FOOD/nutrisight) | Nutrition-specific OCR + layout analysis + extraction | Resource footprint, deployment, separate component licences and locale accuracy |

**NutriSight evidence:** The [Open Food Facts nutrition-extractor model card](https://huggingface.co/openfoodfacts/nutrition-extractor) describes a LayoutLMv3-based extractor using an image, OCR tokens and their 2D positions. Its developers report **precision 0.9545, recall 0.9647 and F1 0.9596** on the stated evaluation set. These are **self-reported model evaluation metrics**, not end-to-end Singapore field accuracy or an independent benchmark. The model card identifies the model licence as **CC BY-NC-SA 4.0** (non-commercial restriction). The reference repository's MIT label must **not** be misread as the model's licence. Do not embed or commercially deploy the model without checking component-specific licensing/permissions.

**Initial preference, conditional on measured testing:** Tesseract.js + a deterministic nutrient/column parser in a limited PWA spike; try server-based OCR or other models only when observed extraction errors justify cost and privacy tradeoffs.

## 4. Food data: provenance, coverage and constraints

| Source | Potential role | Important limitation / risk |
| --- | --- | --- |
| **FitnessPilot user-verified local food store** | First-choice lookup for previously confirmed products, same GTIN + variant | Only as reliable as actual label verification; version and provenance needed |
| [Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) | Primary candidate for packaged-food barcode lookup | Community data may be missing, outdated or inaccurate; review ODbL/attribution/share-alike obligations |
| [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) | Generic-food fallback and secondary nutritional data | US-oriented branded-food coverage; API key and rate-limits; not necessarily same Singapore product |
| [FatSecret Platform API](https://platform.fatsecret.com/) | Possible licensed alternative to evaluate later | Feature availability, commercial terms and region coverage require vendor confirmation |

**Open Food Facts documented as of research date:** API v3 is recommended for new product integrations; read product queries are limited to **15 requests/minute/IP**, search to **10 requests/minute/IP**. Structured search coverage differs by v2/v3 endpoint; do not assume full-text search is available directly under v3. Plan caching and retries and review current licence plus image rights before mixing or republishing records.

**USDA documented as of research date:** FoodData Central API requires a key; its data is public domain/CC0 and its API guide describes default rate limits. Never commit a key to the public GitHub repo.

**Coverage gap:** Neither Open Food Facts nor the other listed databases has been benchmarked on a representative Singapore retail barcode sample for this research. Treat 'good Singapore coverage' as **unverified** until measured.

## 5. Singapore packaging and nutrition logic

Singapore HPB's [Nutrition Labelling and Claims guidance](https://www.hpb.gov.sg/healthy-living/food-and-beverage/nutrition-labelling-and-claims/) explicitly describes nutrition declaration per **100 g / 100 mL and/or per serving**. Its [nutrition labelling handbook](https://www.hpb.gov.sg/docs/default-source/default-document-library/a-handbook-on-nutrition-labelling_august-2022ddc1696545e548569e9e3f0bfd5b27df.pdf?sfvrsn=a72421ec_0) also illustrates prepared/reconstituted columns. These are distinct consumption bases.

**Parser requirements:**
- Retain the source basis, quantity and unit for every nutrient; do not collapse two source columns until the user selects the intended one.
- Normalize kcal/kJ explicitly; preserve original source values and rounding. Avoid converting labels' kJ into an invented 'exact' calorie number.
- Handle sodium in mg; do not interchange sodium with salt without an explicitly specified conversion and source.
- Keep unknown/unreadable/not-provided **distinct from measured zero**.
- Scale the chosen verified per-100-g, per-100-mL or per-serving values to user-selected consumption, recording quantity and method.
- Check matching package variant, flavour and size; identical-looking products can contain different formulation or serving sizes.

## 6. Proposed Smart Food Capture UX (not implemented)

**Entry:** Food Diary → Add Food → (A) Scan barcode / (B) Scan nutrition label / (C) Search or enter manually.

**Barcode path:** Scan → lookup local verified food → otherwise search external source → verify name/variant/nutrients → specify quantity → save diary entry. If unmatched, show 'Photograph the label' instead of a dead end.

**Photo path:** Photo/camera → crop → extract → show source + editable table → require review of energy, protein, carbs, fat, units, serving basis and missing values → confirm → optionally attach barcode/product name → save as reusable verified food and optionally log a meal.

**Data design suggestion, not an agreed schema:**
- Food identity: internal food ID, optional barcode, brand, name, flavour/variant, package description, verification timestamp.
- Nutrition facts: amount + unit + source basis + whether present, unknown or manually corrected; optional additional nutrients.
- Provenance: source type (verified local label, unverified external database, OCR draft, manual), provider/version, original transcription reference and user confirmation metadata.
- Meal snapshot: food ID, name at logging time, chosen quantity and basis, nutrient values used for that particular entry and log timestamp.
- Preserve existing Food Diary storage keys, backups, CSV exports and unknown-versus-zero semantics. Any future change requires compatibility tests and existing decision review.

**Privacy:** Process images locally by default. If cloud OCR is offered later, make external upload explicit, document retention and privacy, avoid sensitive metadata, and provide a non-cloud/manual fallback. This public repository must contain only synthetic test data and packaging samples whose rights permit reuse. Do not publish real personal Food Diary exports.

## 7. Proposed staged implementation (not authorized by this note)

1. **Discovery + data contract:** inspect existing preview food-store functions, import/export, service worker, Food Diary UI, existing tests, relevant decisions and open PRs. Confirm licenses and exact iPhone targets.
2. **Barcode PWA spike:** decode 1-D retail barcodes via browser, handle permissions, fallback manual entry; lookup local verified foods and selected remote database.
3. **Label-photo spike:** add photo/crop controls and local OCR with deterministic row/column parsing; retain unknowns and require confirmation.
4. **Quality and reuse:** local verified food registry, source metadata, product-variant checks, portion calculations, fixed historical snapshots, backup/export compatibility.
5. **Optional harder cases:** alternate OCR engine or layout-aware extraction for cases demonstrated to fail; run cost/privacy/licensing review first.
6. **Only after acceptance:** decide whether to integrate into the preview release workflow; no production deployment is implied.

## 8. Evaluation protocol and acceptance gates

**Initial proposed sample (60 labels):**
- 20 Singapore supermarket products with standard panels.
- 20 imports with different label languages/layouts.
- 20 difficult samples (small type, glare, curved packaging, multi-column panels).

**Measure separately:**
- Barcode decode rate (conditioned on scannable images).
- Lookup hit rate and **correct product variant** rate.
- OCR character/word accuracy where ground-truth transcriptions exist.
- **All-critical-fields-correct rate**: calories, protein, carbs, fat, units, and correct nutrition basis simultaneously.
- Unknown/missing value precision and count of *unflagged critical* errors.
- End-to-end median/p95 capture and confirmation time, taps, user corrections and failure/cancellation rate.
- Offline, no-permission, denied-camera, API-limit, stale cached food, PWA backgrounding and iOS Safari device tests.
- Validation of logged meal snapshot and subsequent updates, duplicate barcode handling, CSV/JSON backups and restoration.

**Suggested release gate (proposal, not claim of measured performance):** zero **unflagged** critical nutrient or serving-basis mistakes in the acceptance sample. Fail closed: low-confidence fields require user confirmation. Extend the sample before declaring general accuracy.

## 9. Evidence ledger and limitations

| ID | Claim | Status | Supporting origin |
| --- | --- | --- | --- |
| E1 | Browser webcam/video-based barcode decoding exists | Verified project documentation; device performance not tested | ZXing browser README |
| E2 | Barcode decoding does not itself supply a product's macro database record | Established system distinction | Barcode SDK docs + food database API docs |
| E3 | Open Food Facts product lookup API v3 recommended; rate limits published | Verified provider documentation as of research | OFF API docs |
| E4 | USDA food API is accessible using a key; data CC0 | Verified provider documentation | USDA API guide |
| E5 | Singapore panels may be per serving, per 100g/100mL and prepared basis | Verified regulator guidance | HPB nutrition labelling guidance and handbook |
| E6 | NutriSight uses OCR/layout for table extraction and reports F1 0.9596 | Self-reported model documentation; **not** Singapore benchmark | NutriSight repo + model card |
| E7 | NutriSight nutrition-extractor model carries CC BY-NC-SA 4.0 licence | Verified model-card declaration; independent legal review not conducted | Hugging Face model card |
| E8 | The proposed PWA scanner + OCR would be acceptably accurate/fast on the owner's phone | **Not tested** | Future benchmark required |
| E9 | Open Food Facts coverage of specific Singapore groceries is sufficient | **Unknown** | Future barcode test required |
| E10 | Direct independent 'Scan nutrition label' improves usage | **Hypothesis** | Future usability tests required |

**Evidence scope:** This note consolidates the 2026-11-10 General Researcher findings and selective primary-source checks. It is **not** a comprehensive independent test of vendor apps, pricing, all licensing obligations, Singapore coverage or actual FitnessPilot code. Claims about subscription tiers and app features can change.

## 10. Source register (primary/traceable)

- ZXing browser project and camera scanning: https://github.com/zxing-js/browser
- Google ML Kit barcode scanning: https://developers.google.com/ml-kit/vision/barcode-scanning
- Open Food Facts API guide and rate limits: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- USDA FoodData Central API guide and CC0: https://fdc.nal.usda.gov/api-guide/
- NutriSight reference project and OCR/layout pipeline: https://github.com/DRG4FOOD/nutrisight
- NutriSight model card, self-reported evaluation metrics and model licence: https://huggingface.co/openfoodfacts/nutrition-extractor
- Open Food Facts Robotoff backend: https://github.com/openfoodfacts/robotoff
- HPB nutrition labelling and claims: https://www.hpb.gov.sg/healthy-living/food-and-beverage/nutrition-labelling-and-claims/
- HPB Handbook on Nutrition Labelling: https://www.hpb.gov.sg/docs/default-source/default-document-library/a-handbook-on-nutrition-labelling_august-2022ddc1696545e548569e9e3f0bfd5b27df.pdf?sfvrsn=a72421ec_0
- Cronometer food-database reporting and checks: https://support.cronometer.com/hc/en-us/articles/360021237511-Mobile-Report-an-Issue
- Tesseract.js: https://github.com/naptha/tesseract.js
- Google Cloud Vision OCR: https://cloud.google.com/vision/docs/ocr
- Azure Document Intelligence: https://learn.microsoft.com/azure/ai-services/document-intelligence/overview
- FatSecret Platform API: https://platform.fatsecret.com/

## Repository and decision boundaries

- The repository currently had **no research/ directory on main** before this new note.
- Research logging is documentation only. **Do not** modify app code, ROADMAP.md, decisions, saved data, tests or production assets as a side effect.
- Follow [AGENTS.md](../AGENTS.md): branch + PR; no direct push to main; no merge without owner approval.
- The existing owner decision document is [docs/decisions/2026-11-05-roadmap-owner-decisions.md](../docs/decisions/2026-11-05-roadmap-owner-decisions.md). Its local-backup/privacy/release policies remain in force.
- Existing nutrition roadmap items (including unknown-versus-zero semantics and real-phone food-search tests) should be reviewed **before** any implementation or new backlog IDs. This note adds no roadmap task or owner decision.

**Bottom line:** Build the reliable capture/verification loop before any "AI-calorie-recognition" branding. Data provenance, correct serving basis and stable historical records are more important than an impressive OCR demo.
