# Agent run: mobile accessibility copy leak scan

Date: 2026-05-24

Branch: infra/mobile-accessibility-copy-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend the mobile metadata scanner so screen-reader-facing copy props cannot carry raw metadata into user-accessible UI.

## Product truth

User-visible metadata leakage includes both text that is visually rendered and text exposed through accessibility copy.

Raw card, box, group, library, or track metadata must not be passed directly into user-facing copy props.

## Implementation hypothesis

The existing mobile metadata scanner already treats `accessibilityLabel` as a visible/accessibility prop. Extending the same guard to `accessibilityHint` and `accessibilityValue` closes the adjacent React Native screen-reader copy surface without changing runtime behavior.

## Changed files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-mobile-accessibility-copy-leak-scan.md`

## Validation

- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
