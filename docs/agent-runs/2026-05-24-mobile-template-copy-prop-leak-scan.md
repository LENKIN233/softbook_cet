# Agent run: mobile template copy prop leak scan

Date: 2026-05-24

Branch: infra/mobile-template-copy-prop-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend the mobile metadata scanner so multiline template literals opened from visible/accessibility copy props cannot carry raw metadata into user-facing UI.

## Product truth

Visible metadata leakage is not limited to plain prop expressions. UI copy is often assembled with template literals, and a template literal can start on the copy prop line while raw metadata appears on a following interpolation line.

Raw card, box, group, library, or track metadata must not enter visible or accessibility copy props through multiline template literals.

## Implementation hypothesis

Reusing the existing short pending-prop window for copy props that open an unclosed template literal closes this bypass without treating ordinary internal template literals as user copy.

## Changed files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-mobile-template-copy-prop-leak-scan.md`

## Validation

- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
