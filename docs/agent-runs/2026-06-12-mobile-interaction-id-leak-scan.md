# Agent Run Record: mobile interaction_id leak scan

## Task summary

- Date: 2026-06-12
- Branch: `infra/mobile-interaction-id-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw `interaction_id` / `interactionId` metadata cannot be displayed directly, while preserving the allowed `INTERACTION_LABELS[...]` display mapping.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/card-system.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/visual-language.json`

## Product truth used

- `spec/card-system.json` defines `interaction_id` as a required card interaction contract field.
- `spec/visual-language.json` defines user-visible metadata leakage as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The mobile scanner already rejected many raw card metadata fields. It now also rejects direct `interaction_id` / `interactionId` usage in visible Text, visible/accessibility copy props, and rendered element props.
- `INTERACTION_LABELS[card.interaction_id]` remains allowed because it is the explicit display-label mapping from raw interaction contract id to user-facing interaction copy.

## Workspace boundary and read scope

- Active truth/source read: `spec/card-system.json`, `spec/agent-harness.json`, `spec/visual-language.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/src/learning/model.ts`, `apps/mobile/src/learning/LearningSurface.tsx`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added `interaction_id` and `interactionId` to raw metadata field-name detection; added an allowlist transform for `INTERACTION_LABELS[...]` display lookups before metadata-expression checks.
- `scripts/harness_validator/sections/design_governance.py`: added negative fixtures for raw `interaction_id` / `interactionId` leaks and no-leak fixtures for `INTERACTION_LABELS[...]` display lookups.
- `docs/agent-runs/2026-06-12-mobile-interaction-id-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- Temporary fixture probe before the fix for `card.interaction_id` in Text and `interactionId` in accessibility copy -> scanner incorrectly passed.
- Simulated direct addition of `interaction_id` / `interactionId` -> exposed false positives on existing `INTERACTION_LABELS[currentCard.interaction_id]` display mappings.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- Temporary fixture probe after the fix -> scanner rejected raw Text, visible/accessibility prop, and rendered prop leaks, and did not report `INTERACTION_LABELS[...]` no-leak fixtures.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`

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

- No known blocking risk. The new allowlist is scoped to the established `INTERACTION_LABELS[...]` mapping and the raw-field detection remains exact-key based.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
