# FitnessPilot Food Capture — source-level feasibility and integration audit

**Date:** 2026-11-10 (Asia/Singapore)  
**Status:** Read-only code inspection / implementation proposal. **No feature implemented.**  
**Companion research:** [Barcode + nutrition-label capture landscape](2026-11-10-barcode-nutrition-label-capture.md)  
**Repository inspected:** `ToggleHardestMode/Fitness`, `main` (reviewed around base commit `d14ff2be38bd22a6b4226d34e9adefbeffdda069`), preview reported as `V15.26.14` by `preview-v101/index.html`. Specific source files were fetched via the connected GitHub API. This is **source inspection**, not a build, browser-device test, security audit, or claims of running tests.

## Executive decision for a future implementation

**Recommend an incremental, compatibility-first capture adapter:**

1. Independent barcode and nutrition-label photo entry points.
2. Barcode-decoding/OCR output is an **untrusted draft**. A reviewed conversion layer maps into the Food Diary's **existing per-serving four-macro form**, with unknown values preserved as `null`.
3. Do not yet introduce a persistent barcode/verified-food store unless it is included in backup, restore, validator and recovery tests.
4. Keep `preview-v101/` isolated and do not touch production root, existing exercise records or current Food Diary v1 snapshots.
5. Validate iPhone Safari camera capture, offline behaviour, permission denial, external requests and recovery with *synthetic/disposable* data before shipping.

The strongest newly discovered blocker is not image recognition. It is **verified-food persistence and backup compatibility**.

## 1. Observed code and the implications

| Inspected path | Source finding | Consequence |
| --- | --- | --- |
| `preview-v101/food-diary-core.js` | `FOOD_KEY = fitnesspilot.preview.v101.foodDiary.v1`; `EMPTY_DIARY() = {version:1,entries:[]}` | Existing diary is a dedicated v1 store, separate from workout storage. Preserve its storage key and records. |
| `preview-v101/food-diary-core.js` `validateEntry` | Accepts `id,date,name,occasion,servings,kcal,protein,carbs,fat` and returns a new object with **only** those fields; nutrients may be nonnegative numbers or `null`. | Simply attaching `barcode`, `source`, `per100g`, `verification` or OCR metadata to an entry **will silently strip it**. Do not claim provenance survives save. |
| `preview-v101/food-diary-core.js` `totalsForDate` | Totals equal per-serving nutrients multiplied by `servings`; `null` increments per-nutrient unknown count. | OCR normalization must explicitly map source basis into valid **per-serving** values before prefilling the form. Never set absent values to 0. |
| `preview-v101/food-diary.js` `initFoodDiary` | Reads `FOOD_KEY` from browser `localStorage`; form save calls `saveEntry`. | Reuse the validated save flow; capture should prefill fields, **not write a diary entry on scanning**. |
| `preview-v101/food-diary.html` | Four nutrient fields, `servings`, date, and meal/snack/drink type; no camera/barcode or label-upload controls. | A scanner UI is new. Preserve keyboard/manual fallback and current save confirmation. |
| `preview-v101/sg-food-lookup.js` | Offline Singapore named-food reference search with original aliases, sourced portion references and some `null` macros; uses `initSgFoodLookup` to prefill existing form. | This is an **existing adapter pattern** to reuse. It is not a live barcode scanner. Avoid replacing the Singapore food search with US-centric barcodes. |
| `preview-v101/food-diary-csv.js` | Strict 8-column per-serving daily CSV: `date,name,occasion,servings,kcal,protein,carbs,fat`. Supports preview/corrections and explicit confirmation. | Keep current CSV contract stable; captured-food metadata is **not** supported by this CSV and must not be silently added to columns. |
| `preview-v101/food-diary-core.js` `recentFoods/repeatEntryToDate` | A reusable list derives from historical saved meal entries; copies prior nutrient snapshots with fresh meal ID. | Basic repeat is already implemented, but it is **not** a standalone verified-product registry or versioned product source. |
| `preview-v101/encrypted-backup-core.js` | Source implements encrypted backup `fitnesspilot-encrypted-both-v1`, reads `STORAGE_KEY` and `FOOD_KEY` only. `validateBoth` includes workout+food and `restoreBothToEmpty` requires two empty target keys. | A third persistent verified-food key would be **excluded from encrypted backups**. Add no new persistent cache until backup/restore design explicitly covers it. |
| `preview-v101/encrypted-backup-ui.js` | Combined backup UI calls `readBothStores`, encrypts and restores both stores with explicit confirmation. | A v2/v3 backup change would need new UI, validation, compatibility and restore tests; existing encrypted backups must remain recoverable. |
| `preview-v101/food-diary.html` + `preview-v101/index.html` | HTML CSP `connect-src 'self'` and `script-src 'self'`. | Direct requests to Open Food Facts or cloud OCR services **would be blocked by current CSP**. Any external provider needs an explicit host allowlist, actual CORS verification, disclosure and tests. No CDN script injection. |
| `preview-v101/sw.js` | Precache enumerates current local JS/CSS/HTML assets; fetch handler only intercepts same-origin requests. | New scanner/OCR JS and local WASM assets need inclusion in asset graph, cache/version discipline, and offline memory/storage measurement. Remote lookups cannot be treated as offline data. |
| `tests/food-diary.test.mjs` | Asserts null vs zero, per-serving totals, repeat-snapshot copying and JSON restore. | Preserve invariants. |
| `tests/food-diary-csv.test.mjs` | Asserts strict columns, corrections, no hidden data changes, backup acknowledgement and unknown-vs-zero. | New capture UI cannot bypass the confirmation/backup rules for imports. |
| `tests/sg-food-lookup.test.mjs` | Checks aliases, sourced references and unknown values. | Preserve current Singapore food search and assertions. |
| `tests/encrypted-backup.test.mjs` | Source includes synthetic roundtrip, wrong-passphrase, corrupt-file, clean-target restore and rollback tests. | Future store/schema work must extend these regressions; source tests exist, **not executed by this research run**. |
| `tests/offline-preview.test.mjs`, `tests/preview-asset-integrity.test.mjs` | Assert offline service-worker behaviour and asset-list/version integrity. | Extend scoped scanner tests and run native suite once implementation is authorized. |

**Source-backed correction to earlier research:** The earlier note rightly warned that a future verified-food cache must be backed up, but this audit observed a **combined encrypted two-store backup implementation already in GitHub source**. Do not say the combined backup feature is nonexistent. Whether it has passed **real iPhone export/restore acceptance** remains unverified. Existing documents may contain outdated status statements.

## 2. Concrete integration points (proposed, no code edits)

### A. Lowest-risk read-only capture spike

**New modules only after approval:**
- `preview-v101/barcode-capture.js` — camera/decode interface, normalization of GTIN, check digit and safe state machine; manual barcode input; never writes diaries.
- `preview-v101/nutrition-label-ocr.js` — camera/photo import, crop/rotate, OCR and source-table parsing, memory/time limits; never writes diaries.
- `preview-v101/food-capture-normalize.js` — pure transformations: database/OCR records -> provisional food draft -> *explicitly reviewed* per-serving `{name,occasion,servings,kcal,protein,carbs,fat}`.

**Existing files touched only in a future implementation PR:** `food-diary.html` (two independent capture actions, photo input, editable preview and status), `food-diary.js` (prefill existing form, retain manual Save), `food-diary.css`, `sw.js`, focused tests.

**Minimal spike acceptance:** Taking a photo or decoding a barcode **does not save a meal**. OCR or remote responses cannot overwrite the current manual edit without explicit confirmation. The user must see and approve per-serving quantities, units and missing fields. A successful Save still uses `saveEntry` and the same Food Diary v1 format.

### B. Barcode database phase

- First decode EAN-13/UPC-A/EAN-8 from captured frame. Validate format and checksum; expose human-editable GTIN fallback.
- Check a **backed-up** locally verified catalogue if one eventually exists. Before that, do not invent a local verified catalogue; the existing `recentFoods` can help with manual reuse.
- External lookup candidate: Open Food Facts. Verify API CORS in iOS Safari, schema mappings, request rate limits, legal attribution and appropriate CSP host, *before* deciding to depend on browser fetch.
- Confirm product name, brand, variant, basis and package quantity. A barcode match is evidence of identity, **not** guarantee of accurate current label macros.
- On offline/unmatched/rate-limit/invalid-data errors, offer label-photo and manual entry, preserving an in-progress edit.

### C. Nutrition photo normalization examples (synthetic)

| Source panel | User quantity | Safe proposal before confirmation |
| --- | --- | --- |
| Per 100 g: 240 kcal, 20 g protein; user uses 75 g | One chosen 75 g serving | Per-serving draft: 180 kcal and 15 g protein; other missing nutrients remain `null`. |
| Per serving 30 g: 120 kcal, 6 g protein | User selects 2 servings | Diary form should be 120 kcal and 6 g protein **per serving**, with `servings = 2`; totals multiply to 240 kcal and 12 g protein. |
| Both per 100 g and per 30 g shown | Not selected | **No normalization yet**: ask the user to pick the correct column and amount. |
| kJ only; serving size unclear | Not selected | Convert kJ to kcal using documented unit conversion only when basis is known; retain the source value for review. No fabricated precision. |
| Sodium 350 mg, fat unreadable | One serving | Do not put sodium in a gram-based macro field or set unreadable fat to zero. Four-field diary retains `fat:null`. |

**Important schema gap:** The existing diary only records four macros. The separate nutrition-reference/vitamin UI **does not mean** food-entry fibre, sodium or 13 vitamins are stored for meals. Extending micronutrients is a separately scoped product decision with migration and metric-contract tests.

## 3. Verified-food catalogue: backup-first options (decision deferred)

| Option | Benefit | Risk / gate |
| --- | --- | --- |
| **No persistent catalogue in initial spike** | Safest; scan -> explicit prefill -> existing diary v1 save; older meals remain intact | Barcode/product verification provenance is only ephemeral; **do not label entries as saved verified products** |
| **Separate local catalogue key** | Independent product/version records, GTIN index, verification metadata and future refresh without touching meal snapshots | Requires new encrypted-backup format/validator/UI/restore path **before** enabling persistence; old backups must still import losslessly. Additional quota limits and cross-store recovery tests. |
| **Extend Food Diary schema to version 2** | Single food storage + catalogue may simplify backup scope | Current `validateDiary` strictly accepts v1; CSV, recent food, chart, import/restore and tests need explicit backward-compatible migration. Cannot silently convert backups or drop fields. |

**Recommendation:** Deliver an in-memory prototype first, then compare these catalogue options against how often users need repeated product lookup. Do not decide schema from UI appearance alone. Under no circumstances create a new key that is omitted by every user's backup.

**Snapshot rule:** Food Diary history already stores four per-serving macro values for each recorded meal. Preserve this snapshot. Catalog updates should be opt-in for **future entries**; do not retroactively modify logged meals.

## 4. Security, licensing and privacy gates

- **CSP:** `connect-src 'self'` prevents direct cross-origin calls today; changes must be scoped to reviewed providers, not `connect-src *`, and actual provider CORS must be proven in Safari/PWA. `script-src 'self'` forbids CDN-hosted OCR runtime by default; package local approved assets if needed.
- **Untrusted external data:** Treat product names, serving strings, image URLs and OCR output as untrusted. Use DOM `textContent`, schema validation, size limits and finite-number checks. Refuse malicious/ambiguous GTINs, nonnumeric macros, negative macros and unknown unit mappings.
- **Privacy:** Do not upload packaging photos to cloud OCR by default or send private Food Diary records to a third party. If cloud processing is explicitly enabled, show clear upload disclosures and retention/privacy policy, and maintain a manual/offline path.
- **Licensing:** Verify Open Food Facts data use and derivatives before caching or republishing; confirm each OCR library/runtime licence separately. NutriSight's model card lists CC BY-NC-SA 4.0, so don't conflate the source-code repo's licence with the model weights.
- **Offline:** Precache only approved local assets, measure WASM/worker size and iOS memory; refuse a feature that makes the offline service-worker install unreliable.
- **No user data in GitHub:** Synthetic labels/fixtures only; do not publish real captured food images, food diary exports or backups.

## 5. Recommended test matrix for implementation PRs

| Gate | Minimum positive test | Minimum negative/failure test |
| --- | --- | --- |
| Barcode | Valid EAN/UPC decode and manual GTIN correction | Invalid check digit, duplicate/ambiguous variant, no camera, no network |
| API | Known product maps to correct per-100g/per-serving fields; attribution shown | Empty API, 404, 429, malformed JSON, cross-origin/CSP block, stale responses |
| OCR | Clean per-serving and per-100 g table; user selects basis | Multi-column swap, kJ/kcal mismatch, unreadable values, decimal formatting, glare |
| Draft -> Food Diary | Explicit confirmation prefills form; Save writes correct v1 snapshot | Scan cancels/permission denied -> **zero writes**; OCR error retains existing edit |
| Unknown values | `null` remains unknown while real `0` is preserved | Missing macro never silently becomes 0 or a model-derived guess |
| Repeat + history | Saved entry repeated with fresh ID and old values unchanged | External product correction does not rewrite old meals or import IDs |
| CSV | Current eight columns still import/export and permit corrected entries with review | CSV injection/malformed payload, unknown field, conflicting manual entry |
| New persistence (if approved) | Clean recovery of all stores and legacy backups with passphrase typed manually | Wrong secret, tampered file, quota failure, half-written stores, third store missing |
| PWA | Offline current diary unchanged, asset graph valid, page still loads | Offline scanner failure is recoverable; no service worker cache corruption |
| iPhone | Camera permission, rear focus, photo selection and consistent Save tested | Denial/revocation, Safari reload and Home Screen context, low memory |

**Proposed 60-label Singapore sample** and measurement definitions remain in the parent research note. Treat zero **unflagged** critical errors as a proposed acceptance criterion, not an accuracy claim.

## 6. Sequencing and explicit ownership decisions

1. **Audit decision:** Confirm initial capture is a **draft/prefill convenience**, not autonomous nutrition logging. This follows current manual entry model and avoids schema changes.
2. **Prototype:** One isolated preview branch with independent barcode decode and photo/OCR mock or proof-of-concept, pure normalization tests and manual form prefill. No remote provider assumed until CORS and licensing are checked.
3. **Data quality:** Run Singapore product barcode coverage and label OCR benchmark on licensed/synthetic datasets plus private device samples stored outside public GitHub.
4. **Persisted catalogue:** Only after deciding store format, approval, legacy restore compatibility, encrypted backup change and full recovery tests.
5. **Release:** Native `npm test`, `node scripts/verify-preview-assets.mjs`, scoped code review, actual Pages output and iPhone acceptance; explicit owner approval before merge/deploy.

**Existing overlapping work:** Open PR #61 targets Food Diary missingness/read-only coverage. It is **not a capture implementation**, but check its final diff and pending review before modifying shared Food Diary files. Existing roadmap B076–B084 cover food recovery, Singapore references, missing nutrient handling and missing-vs-zero semantics; do not arbitrarily declare them complete or create conflicting task IDs. The owner decision document on local encrypted backups and controlled releases remains authoritative.

## 7. Audit boundaries and source receipts

Reviewed source files:
- [Food Diary core](../preview-v101/food-diary-core.js)
- [Food Diary UI](../preview-v101/food-diary.js) and [HTML/CSP](../preview-v101/food-diary.html)
- [Singapore food lookup](../preview-v101/sg-food-lookup.js)
- [Food Diary CSV](../preview-v101/food-diary-csv.js)
- [Encrypted combined backup](../preview-v101/encrypted-backup-core.js) and [backup UI](../preview-v101/encrypted-backup-ui.js)
- [Service worker](../preview-v101/sw.js), [preview HTML/CSP](../preview-v101/index.html)
- [Food core tests](../tests/food-diary.test.mjs), [CSV tests](../tests/food-diary-csv.test.mjs), [SG lookup tests](../tests/sg-food-lookup.test.mjs), [encrypted backup tests](../tests/encrypted-backup.test.mjs), [offline tests](../tests/offline-preview.test.mjs), [asset integrity tests](../tests/preview-asset-integrity.test.mjs)
- [Roadmap](../ROADMAP.md), [AGENTS.md](../AGENTS.md), [owner decisions](../docs/decisions/2026-11-05-roadmap-owner-decisions.md)

**Verification completed:** Direct GitHub source retrieval and inspection.  
**Not done:** `npm test`, preview asset script execution, camera/OCR benchmark, live iPhone Safari, API/CORS runtime checks, actual backup restore or release acceptance.

**Bottom line:** Existing code already gives an explicit form-save workflow and sound unknown-vs-zero behaviour. Reuse it. Adding a persistent verified barcode-food catalogue *before* extending the combined-backup contract is the highest-risk avoidable mistake.
