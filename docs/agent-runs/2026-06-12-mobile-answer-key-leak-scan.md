# Agent Run Record: mobile answer_key leak scan

## Task summary

- Date: 2026-06-12
- Branch: `infra/mobile-answer-key-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw `answer_key` / `answerKey` and known auto-scoring answer-key child fields cannot be displayed in user-visible or rendered props.

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

- `spec/card-system.json` defines `answer_key` as scoring data required for auto-scoring interactions.
- `spec/interactions.json` defines answer-key child fields such as `correct_option`, `lock_pattern`, `correct_items`, and `correct_state`.
- `spec/visual-language.json` defines user-visible metadata leakage as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The mobile scanner already rejected many raw card metadata fields. It now also rejects direct `answer_key` / `answerKey` usage and known answer-key child fields when they reach visible Text, visible/accessibility copy props, or rendered element props.

## Workspace boundary and read scope

- Active truth/source read: `spec/card-system.json`, `spec/interactions.json`, `spec/agent-harness.json`, `spec/visual-language.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/src/learning/LearningSurface.tsx`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added `answer_key`, `answerKey`, and known answer-key child keys to raw metadata field-name detection.
- `scripts/harness_validator/sections/design_governance.py`: added negative fixtures for answer-key object access, camelCase access, destructured child keys, and rendered prop leaks.
- `docs/agent-runs/2026-06-12-mobile-answer-key-leak-scan.md`: recorded this harness/governance run.

## Commands run

- Temporary fixture probe before the fix for `card.answer_key.correct_option` and `answerKey.correctOption` -> scanner incorrectly passed.
- Simulated scanner run after adding the answer-key field family against current repository -> passed, no existing runtime code hit.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- Temporary fixture probe after the fix -> scanner rejected raw answer-key Text, visible/accessibility prop, destructured child key, and rendered prop leaks.
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

- No known blocking risk. The added fields are exact scoring-data keys, and current runtime usage remains in interaction scoring logic rather than visible copy.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
