# B122 amendment — 2026-11-19

The owner approved moving the dormant manual progression panel and its engine to `tests/support/`. Remove both modules from the preview's service-worker precache. Keep the implementations and all existing progression, clearance, symptom and exercise-equivalence assertions. Update import paths for the move.

For B122, the preview no longer contains or precaches either manual progression module. Keep `metric-selectors.js` and its `metric-dictionary.js` dependency in place for the Dashboard work in roadmap step 4.4, which will wire them into the app. This is a scoped amendment to B122's unused-module acceptance criterion and preserves the [restructure decision](2026-11-11-roadmap-restructure-permissions.md).
