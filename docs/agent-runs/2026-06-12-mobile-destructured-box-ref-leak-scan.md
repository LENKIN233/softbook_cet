# Agent Run Record: mobile destructured box_ref leak scan

## Task summary

- Date: 2026-06-12
- Branch: `infra/mobile-destructured-box-ref-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so destructured `box_ref` variables cannot be displayed in Text or visible/accessibility copy props.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/visual-language.json`

## Product truth used

- `spec/visual-language.json` defines user-visible metadata leakage as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The mobile scanner already rejected direct `boxRef` and `space_metadata.box_ref` access. It now also rejects a destructured snake_case `box_ref` variable when it reaches visible Text or visible/accessibility copy props.

## Workspace boundary and read scope

- Active truth/source read: `spec/authority-map.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `spec/visual-language.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added `box_ref` to raw metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added negative fixtures and snippet assertions for destructured `box_ref` leaks.
- `docs/agent-runs/2026-06-12-mobile-destructured-box-ref-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- Temporary fixture probe before the fix for `<Text>{box_ref}</Text>` and `accessibilityHint={box_ref}` -> scanner incorrectly passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- Temporary fixture probe after the fix for destructured `box_ref` in Text and accessibility props -> scanner failed as expected and reported the fixture files.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.

## Validation results

- Local mobile scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: pending PR agent review.
- Status: pending.
- Blocking findings: none known locally.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no screen, runtime UI, copy, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- No known blocking risk. The added field is the exact raw metadata key `box_ref`, not broad terms such as `box`, `group`, or `library`.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
