# Agent Run Record: mobile auto_scoring leak scan

## Task summary

- Date: 2026-06-12
- Branch: `infra/mobile-auto-scoring-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw `auto_scoring` / `autoScoring` scoring-capability metadata cannot be displayed in user-visible or rendered props.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/visual-language.json`

## Product truth used

- `spec/card-system.json` defines `auto_scoring` as whether the system can score directly.
- `spec/interactions.json` defines which core interactions use automatic scoring.
- `spec/visual-language.json` defines user-visible metadata leakage as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The mobile scanner already rejected many raw card metadata and scoring-data fields. It now also rejects direct `auto_scoring` / `autoScoring` usage when it reaches visible Text, visible/accessibility copy props, or rendered element props.

## Workspace boundary and read scope

- Active truth/source read: `spec/card-system.json`, `spec/interactions.json`, `spec/agent-harness.json`, `spec/visual-language.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added `auto_scoring` and `autoScoring` to raw metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added negative fixtures for auto-scoring Text, visible/accessibility prop, and rendered prop leaks.
- `docs/agent-runs/2026-06-12-mobile-auto-scoring-leak-scan.md`: recorded this harness/governance run.

## Commands run

- Temporary fixture probe before the fix for `card.auto_scoring` and `autoScoring` -> scanner incorrectly passed.
- Simulated scanner run after adding `auto_scoring` / `autoScoring` against current repository -> passed, no existing runtime code hit.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- Temporary fixture probe after the fix -> scanner rejected raw auto-scoring Text, visible/accessibility prop, and rendered prop leaks.
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

- No known blocking risk. The added fields are exact scoring-capability keys, and current runtime usage remains in content contract data rather than visible copy.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
