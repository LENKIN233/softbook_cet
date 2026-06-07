# Agent run: mobile rendered-prop metadata leak scan

- Date: 2026-06-07
- Branch: `infra/mobile-accessibility-labelledby-leak-scan`
- Scope: harden mobile metadata leak scanning for rendered/accessibility identity props.

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

Rendered identity props can leak raw metadata through both template strings and direct expressions. `accessibilityLabelledBy` belongs in the same rendered/accessibility identity surface as `testID` and `nativeID`.

## Changes

- Extended the rendered-prop metadata scanner to cover `accessibilityLabelledBy`.
- Extended the same scanner rule to catch direct metadata expressions such as `testID={card.sourceLabel}`, not only template strings.
- Added harness fixtures for direct rendered-prop metadata expressions and `accessibilityLabelledBy` metadata templates.

## Validation

- 2026-06-07: `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- 2026-06-07: `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK

## Notes

- No user-visible UI implementation changed.
- No new design artifact is introduced; this is a guardrail-only scanner/harness update.
