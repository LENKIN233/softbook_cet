# Agent run: design CSS generated content leak scan

Date: 2026-05-24

Branch: infra/design-css-content-leak-scan

## Referenced specs

- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Scope

Add a durable guardrail for user-visible text emitted through CSS generated content in design proof artifacts.

## Product truth

Visible design artifacts must not leak implementation, process, repository, or raw metadata wording to learners.

CSS pseudo-element text from `content: "..."` is still user-visible copy, so it belongs in the same visual leakage boundary as DOM text and accessibility text.

## Implementation hypothesis

The existing design metadata scanner already covers rendered HTML/SVG text and accessibility attributes. Extending it to extract quoted CSS `content` strings, with CSS escape decoding, closes the generated-content bypass without introducing a full CSS parser.

## Changed files

- `scripts/check_design_metadata_leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-design-css-content-leak-scan.md`

## Validation

- `node scripts/check_design_metadata_leaks.mjs` -> PASS: No metadata leaks detected in design visual artifacts.
- `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK
