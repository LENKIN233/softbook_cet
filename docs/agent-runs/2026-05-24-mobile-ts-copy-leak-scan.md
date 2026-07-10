# Agent run: mobile TS copy leak scan

Date: 2026-05-24

Branch: infra/mobile-ts-copy-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend the mobile metadata scanner from JSX-only recursion to TypeScript and TSX copy sources.

## Product truth

User-visible metadata leakage is not limited to rendered JSX files. Mobile UI copy can be assembled in TypeScript constants, mappers, and config objects before it reaches JSX.

Raw card, box, group, library, or track metadata must not enter visible or accessibility copy props through either JSX attributes or object properties.

## Implementation hypothesis

Scanning `.ts` and `.tsx` under the mobile source tree, while excluding declaration files, closes the object-property copy bypass. Expanding the visible/accessibility prop detector from `=` to `[:=]` catches both JSX attributes and TypeScript object properties.

## Changed files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-mobile-ts-copy-leak-scan.md`

## Validation

- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
