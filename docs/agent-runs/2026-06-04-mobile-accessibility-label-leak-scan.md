# Agent run: mobile accessibilityLabel leak scan

- Date: 2026-06-04
- Branch: `infra/mobile-accessibility-label-leak-scan`
- Scope: prove mobile metadata leak scanning covers accessibility label text.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/visual-language.json`

## product_truth

User-visible UI and assistive-technology-readable copy must not expose raw source or harness metadata. Source provenance such as `sourceLabel`, `sourceId`, `source_label`, `source_id`, `cardRecords`, and `card_records` remains implementation metadata, not learner-facing copy.

## implementation_hypothesis

`accessibilityLabel` is assistive-technology-readable copy. The mobile metadata scanner already treats it as a visible/accessibility copy prop, and the harness should keep a direct negative fixture for source metadata passed through it.

## Changes

- Added an `AccessibilityLabelLeak.tsx` scanner fixture that passes `card.sourceLabel` through `accessibilityLabel`.
- Added the expected fixture output path to the harness validator.
- Added `accessibilityLabel` to the scanner coverage snippet assertions.

## Validation

- 2026-06-04: `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- 2026-06-04: `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK

## Notes

- No user-visible UI implementation changed.
- No new design artifact is introduced; this is a guardrail-only harness update.
