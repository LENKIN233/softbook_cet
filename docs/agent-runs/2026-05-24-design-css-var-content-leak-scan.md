# Agent run: design CSS var generated content leak scan

Date: 2026-05-24

Branch: infra/design-css-var-content-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend design metadata scanning to cover CSS generated text emitted through `content: var(...)`.

## Product truth

Generated CSS content is user-visible copy. If a design proof renders a custom property through `content: var(...)`, the referenced string value belongs in the same leakage boundary as DOM text, accessibility text, direct CSS generated content, and `attr(...)` generated content.

## Implementation hypothesis

The scanner can collect only CSS custom property names referenced by `content: var(...)`, then scan quoted string values assigned to those variables. This closes the generated-content bypass without treating ordinary CSS token variables as user copy.

## Changed files

- `scripts/check_design_metadata_leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-design-css-var-content-leak-scan.md`

## Validation

- `node scripts/check_design_metadata_leaks.mjs` -> PASS: No metadata leaks detected in design visual artifacts.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
