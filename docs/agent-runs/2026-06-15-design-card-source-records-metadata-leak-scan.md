# Agent Run Record: design card source records metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/design-card-source-records-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the design metadata scanner so raw remote learning card-source record keys cannot appear in design visual artifacts.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- `spec/authority-map.json` assigns runtime hypotheses and boundaries to `spec/runtime-boundaries.json`; repo delivery remains owned by `spec/repo-delivery-contract.json`.
- `spec/runtime-boundaries.json` keeps exact endpoint and payload shape details as implementation hypotheses.
- `infra/cloudbase/mobile-runtime-contract.md` documents the remote learning card-source response shape with `data.card_records`; this is runtime contract evidence, not product truth.
- `spec/harness-architecture.json` places design artifact scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/workspace-boundary.json` keeps the sibling `card make` workspace external; this PR does not read or change external candidate content.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile metadata scanner already rejected `card_records` and `cardRecords`, but the design metadata scanner did not. It now rejects those exact remote card-source record keys in visible text, accessibility text, generated content, or source tokens.
- Added exact keys: `card_records` and `cardRecords`.
- Broad keys such as `cards`, `id`, `label`, `source`, or `data` remain out of scope to avoid false positives in legitimate design copy or HTML structure.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/workspace-boundary.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `spec/evals.json`, `infra/cloudbase/mobile-runtime-contract.md`, `apps/mobile/src/learning/remoteCardSource.ts`, `apps/mobile/src/learning/learningRepository.ts`, `apps/mobile/src/learning/model.ts`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `scripts/check_design_metadata_leaks.mjs`: added exact remote learning card-source record keys to raw metadata detection.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and a temporary design mock negative fixture for card-source record key leakage.
- `docs/agent-runs/2026-06-15-design-card-source-records-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/design-card-source-records-metadata-leak-scan origin/main` -> success.
- Temporary design HTML fixture before the scanner patch -> scanner incorrectly passed.
- `node scripts/check_design_metadata_leaks.mjs` after scanner patch with temporary design HTML fixture -> expected failure on `card-source-records-metadata-visible-leak.html`.
- Removed the temporary design HTML fixture.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_design_card_source_records_pr_body.md --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-design-card-source-records-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_design_card_source_records_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local design metadata scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- Whitespace validation: pass.
- PR body design gate validation: pass.
- Agent review body validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally; PR body validation passed.
- Blocking findings: none.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no accepted design artifact, visual output, screen, copy, reference HTML, or runtime UI changed.

## Card make external workspace impact

- N/A. No sibling external workspace read or content approval action occurred.

## Risks and open questions

- No known blocking risk. The guard is limited to exact record-container keys and avoids broad terms that could be legitimate design copy.

## Follow-up

- Validate the PR body, open a PR, run required checks, and merge after checks are green.
