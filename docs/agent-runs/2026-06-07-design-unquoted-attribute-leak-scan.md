# Agent run: design unquoted attribute leak scan

- Date: 2026-06-07
- Branch: `infra/design-unquoted-attribute-leak-scan`
- Scope: harden design visual metadata scanning for unquoted HTML attribute values.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/visual-language.json`

## product_truth

Design visual artifacts cannot become authority if visible text, accessibility text, or generated content exposes internal process or implementation metadata. The leak boundary applies to rendered/accessibility output regardless of whether HTML attributes use quoted or unquoted syntax.

## implementation_hypothesis

The design metadata scanner previously read quoted visible attributes and quoted attributes referenced by CSS generated `attr(...)` content. HTML also permits unquoted attribute values, so those values need the same scanning path.

## Changes

- Extended `visibleAttributeText` to read unquoted visible attribute values.
- Extended `attributeValues` so CSS generated `attr(...)` content reads unquoted source attributes.
- Added harness fixtures for an unquoted visible `placeholder` leak and an unquoted generated `data-caption` leak.

## Validation

- 2026-06-07: `node scripts/check_design_metadata_leaks.mjs` -> PASS: No metadata leaks detected in design visual artifacts.
- 2026-06-07: `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK

## Notes

- No user-visible UI implementation changed.
- No new design artifact is introduced; this is a scanner/harness guardrail update.
