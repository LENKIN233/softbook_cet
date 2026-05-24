# Agent run: design CSS attr generated content leak scan

Date: 2026-05-24

Branch: infra/design-css-attr-content-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend design metadata scanning to cover CSS generated text emitted through `content: attr(...)`.

## Product truth

Generated CSS content is user-visible copy. If a design proof renders an attribute through `content: attr(...)`, the referenced attribute value belongs in the same leakage boundary as DOM text, accessibility text, and quoted CSS generated content.

## Implementation hypothesis

The existing `generated content` target can safely collect attribute names referenced by CSS `content: attr(...)`, then scan matching HTML/SVG attribute values with the existing leakage rules.

## Changed files

- `scripts/check_design_metadata_leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-design-css-attr-content-leak-scan.md`

## Validation

- `node scripts/check_design_metadata_leaks.mjs` -> PASS: No metadata leaks detected in design visual artifacts.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
