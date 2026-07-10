# Agent run: mobile copy key leak scan

Date: 2026-05-24

Branch: infra/mobile-copy-key-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend the mobile metadata scanner so common UI copy object keys cannot carry raw metadata into user-visible or accessibility-facing copy.

## Product truth

Visible metadata leakage is not limited to JSX text nodes or `label` / `text` props. UI copy is often assembled through object keys such as `description`, `message`, `hint`, `caption`, and `body` before rendering.

Raw card, box, group, library, or track metadata must not enter those copy keys.

## Implementation hypothesis

Centralizing mobile copy prop/key names in `visibleCopyPropNames` and reusing that set for raw metadata checks and visible jargon checks closes adjacent object-key bypasses without changing runtime behavior.

## Changed files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-mobile-copy-key-leak-scan.md`

## Validation

- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
