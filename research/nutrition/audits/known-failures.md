# Engineering and nutrition audit history

| Version/stage | Detected failure | Disposition |
|---|---|---|
| V2 | Hardcoded meal totals; nutrient audit list not actual intake | superseded by ingredient model, not validated |
| V3 | Missing ingredient calories can become zero downstream | repaired in V4 with fail-closed missing-data flow |
| V4 adversarial audit | Unsupported units (kg treated as g); negative/zero calories, negative protein, negative cost accepted; invalid maintenance -> 0 target | V4 failed |
| V4.1 | 12 targeted mutation/recovery tests reportedly passed | targeted fixes; not universal proof |
| V4.2 | Large workbook recalculation stalled during source-link updates | evidence staging rather than claiming integration |
| V4.3 | Missing added sugar blocked valid kcal/protein; separate nutrient completeness fixed | unknown sugar remains unknown |
| V4.4 | 14-day trend and coach playbook added | target discrepancy remains provisional |
| V4.5 | Cooked kailan yield unknown; four then two unpriced meals | full cost blocked; scenarios not measurement |
| V4.6 | Source IDs matched but many not independently verified; NutriSoy label conflict | retain disagreement |
| V4.7 | Corrected manufacturer yoghurt/sardines; post-export reimport failed | round-trip validation unverified |
| V4.8 | Non-destructive correction overlay; source-note and zero-cost display defects fixed | corrected sidecar values; old worksheets remain |
| V4.9 | Label sensitivity for mackerel/NutriSoy; USDA candidate matching | optional scenarios; exact package unresolved |

## Release checklist
- Regression tests: blank, NaN/text, zero, negative and extreme energy/protein/price values; unsupported units; unknown food IDs; invalid targets; duplicate and missing diary entries.
- Test errors propagate ingredient -> recipe -> scheduled meal -> daily -> dashboard.
- Tests must validate output after save/reimport. No claimed PASS from cached-error scan alone.
- Separate nutrition composition source coverage from micronutrient adequacy and from health assessment.
- Preserve exact notes when historical tests could not complete due to engine memory.
- No fully complete macro/micronutrient audit has been verified.

**Original V4 audit** is preserved in a *private* archive; this public file is a sanitized abstraction.
