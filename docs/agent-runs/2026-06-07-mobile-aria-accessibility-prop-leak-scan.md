# Agent run: mobile aria accessibility prop leak scan

- Date: 2026-06-07
- Branch: `infra/mobile-aria-accessibility-prop-leak-scan`
- Scope: harden mobile metadata leak scanning for React Native ARIA accessibility aliases.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/visual-language.json`

## product_truth

User-visible UI, assistive-technology-readable copy, and user-reachable rendered props must not expose raw source or harness metadata. Source provenance such as `sourceLabel`, `sourceId`, `source_label`, `source_id`, `cardRecords`, and `card_records` remains implementation metadata, not learner-facing copy or rendered identity.

## implementation_hypothesis

React Native ARIA aliases can leak the same metadata as their `accessibility*` counterparts. `aria-valuetext` is assistive-readable text, and `aria-labelledby` is a rendered accessibility relationship prop that can embed raw source metadata in the same way as `accessibilityLabelledBy`.

## Changes

- Added `aria-label` and `aria-valuetext` to the scanner's visible/accessibility copy prop surface.
- Added `aria-labelledby` to the scanner's rendered-prop metadata guard.
- Added harness fixtures for `aria-valuetext={card.sourceLabel}` and an `aria-labelledby` template containing `card.sourceLabel`.

## Validation

- 2026-06-07: `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- 2026-06-07: `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK

## Notes

- No user-visible UI implementation changed.
- No new design artifact is introduced; this is a guardrail-only scanner/harness update.
