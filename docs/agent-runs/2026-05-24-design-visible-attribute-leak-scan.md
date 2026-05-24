# Agent run: design visible attribute leak scan

Date: 2026-05-24

Branch: infra/design-visible-attribute-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Add scanner coverage for user-visible and accessibility-facing attribute copy in design proof artifacts.

## Product truth

Visible design artifacts must not expose implementation, process, repository, or raw metadata wording to learners.

Input placeholders, element values, and accessibility value/description attributes are copy surfaces, not implementation-only metadata.

## Implementation hypothesis

The existing `accessibility text` target can safely expand from `aria-label` / `alt` / `title` to a named set of user-facing attributes without changing app behavior or visual artifacts.

## Changed files

- `scripts/check_design_metadata_leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-design-visible-attribute-leak-scan.md`

## Validation

- `node scripts/check_design_metadata_leaks.mjs` -> PASS: No metadata leaks detected in design visual artifacts.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
