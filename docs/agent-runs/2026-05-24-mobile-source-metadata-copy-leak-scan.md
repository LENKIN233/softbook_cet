# Agent run: mobile source metadata copy leak scan

Date: 2026-05-24

Branch: infra/mobile-source-metadata-copy-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Extend the mobile metadata scanner so content-source metadata fields cannot enter visible or accessibility copy props.

## Product truth

User-visible copy must stay anonymous and must not expose source provenance fields such as `source_label`, `source_id`, or `card_records`.

## Implementation hypothesis

The existing copy-prop scanner already limits raw metadata checks to visible/accessibility copy contexts. Extending its raw metadata expression vocabulary to content-source fields closes the adjacent provenance leak without scanning unrelated internal code as user copy.

## Changed files

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-mobile-source-metadata-copy-leak-scan.md`

## Validation

- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
