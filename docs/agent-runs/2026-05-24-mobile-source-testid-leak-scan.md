# Agent run: mobile source testID leak scan

Date: 2026-05-24

Branch: infra/mobile-source-testid-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend the mobile metadata scanner so content-source metadata fields cannot be embedded in rendered element `testID` template props.

## Product truth

User-visible copy must stay anonymous, and rendered element props should not carry raw provenance metadata such as `sourceLabel`, `source_label`, or `card_records`.

## Implementation hypothesis

The scanner already rejects raw space metadata embedded in `testID` template props. Extending that rendered-prop rule to the same source metadata field family closes the adjacent provenance leak.

## Changed files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-mobile-source-testid-leak-scan.md`

## Validation

- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
