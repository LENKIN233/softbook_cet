# Agent run: mobile multiline copy prop leak scan

Date: 2026-05-24

Branch: infra/mobile-multiline-copy-prop-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend the mobile metadata scanner so multiline visible/accessibility copy props cannot carry raw metadata into user-facing UI.

## Product truth

Visible metadata leakage is not limited to copy props whose value appears on the same source line. JSX and TypeScript frequently split prop values across lines.

Raw card, box, group, library, or track metadata must not enter visible or accessibility copy props even when the prop starts on one line and the value appears on a following line.

## Implementation hypothesis

A short pending-prop window keyed from `visibleCopyPropNames` can catch multiline copy prop values without treating the whole file as visible copy context.

## Changed files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-mobile-multiline-copy-prop-leak-scan.md`

## Validation

- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
