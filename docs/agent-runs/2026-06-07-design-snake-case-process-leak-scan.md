# Agent run: design snake_case process leak scan

- Date: 2026-06-07
- Branch: `infra/design-snake-case-process-leak-scan`
- Scope: harden design visual metadata scanning for snake_case internal process terms.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/visual-language.json`

## product_truth

Design visual artifacts cannot become authority if visible text, accessibility text, or generated content exposes internal process or implementation metadata. This applies to normal prose forms and source-like forms such as snake_case.

## implementation_hypothesis

The design metadata scanner previously used word boundaries for internal process terms. Since `_` is a word character in JavaScript regular expressions, strings such as `runtime_debug_payload`, `agent_review`, and `debug_payload` were not caught even when they appeared in visible or generated design output.

## Changes

- Updated the design scanner's internal process term rule to treat non-alphanumeric characters, including `_`, as separators.
- Added harness fixtures for snake_case process terms in visible text, visible attributes, and CSS generated `attr(...)` content.

## Validation

- 2026-06-07: `node scripts/check_design_metadata_leaks.mjs` -> PASS: No metadata leaks detected in design visual artifacts.
- 2026-06-07: `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK

## Notes

- No user-visible UI implementation changed.
- No new design artifact is introduced; this is a scanner/harness guardrail update.
