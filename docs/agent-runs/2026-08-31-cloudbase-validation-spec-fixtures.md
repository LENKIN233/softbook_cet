# Agent Run Record: CloudBase validation spec fixtures

## Task summary

- Date: 2026-08-31
- Branch: `fix/cloudbase-validation-spec-fixtures`
- PR: pending
- Summary: Repair the guarded CloudBase deployment validation workspace after a real development-environment preflight and deploy dry-run proved that backend security tests require the tracked membership authority in addition to the box catalog.

## Referenced specs

- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/release-operational-policy.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Login, account generation, membership, learning, progress, scheduling, and physical-space state remain server-authoritative.
- The five-card development payload, fixed development SMS code, CloudBase dev deployment, local formal-bundle dry-run, and green repository checks do not establish formal content publication, production SMS, private distribution, real-device operation, or closed-beta launch readiness.
- Runtime card payloads may contain the answer key for local scoring but must reject prompt, model, harness, credential, token, and private-key metadata.

## Implementation hypothesis changed

- The isolated deployment validation workspace must contain every tracked authority fixture used by its backend tests.
- `spec/box-catalog.json` remains required by content tooling; `spec/membership.json` is also required by beta and pilot entitlement path-integrity tests. Both are copied as exact bytes by the same validation-support helper before the backend suite runs.

## Observed failure and recovery

- Read-only CloudBase inspection confirmed environment `test-d2gzcyxr9f7e80972` is `NORMAL` in `ap-shanghai`, with one active `softbook-api` function and one `/softbook-api` HTTP access service.
- Guarded preflight found 23 of 24 required collections and failed only because `softbook_accounts` was absent. The allowlisted idempotent provisioner created that one empty collection and verified 24/24 without modifying existing documents.
- Post-provision preflight passed from clean `main` exactly equal to `origin/main`. It also confirmed zero v2 identity documents, three card-source documents, and audited five-card CET4 and CET6 development payloads.
- The first guarded deployment dry-run performed no CloudBase write. Its isolated backend suite failed because `spec/membership.json` was absent, so tests could neither reject an in-repository tracked command path nor construct hardlink/copy adversarial fixtures.
- The validation support copy now includes the exact tracked box catalog and membership authority. The same full guarded deployment dry-run then completed package construction with all 420 backend tests and the artifact-load smoke passing.

## Files changed

- `infra/cloudbase/manage-softbook-api.mjs`: copy both required spec fixtures through the validation-support workspace builder.
- `infra/cloudbase/functions/softbook-api/test/manage-softbook-api-validation-workspace.test.js`: verify both spec files exist and are byte-identical in an isolated workspace.
- `docs/agent-runs/2026-08-31-cloudbase-validation-spec-fixtures.md`: preserve the observed remote state, failure, fix, validation, and non-claims.

## Validation

- Focused validation-workspace, beta-entitlement, and pilot-entitlement tests under Node 22.13.0 -> 38/38 passed.
- Guarded CloudBase deployment dry-run under Node 22.13.0 -> `status=planned`, no CloudBase deployment write, all remote reads passed, backend tests 420/420 passed, and artifact-load smoke passed.
- Post-provision guarded CloudBase preflight under Node 22.13.0 -> passed with 24/24 required collections and no missing collection.
- `git diff --check` -> passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- GitHub required checks -> pending PR execution.

## Agent review status

- Reviewer: Codex
- Status: Passed.
- Blocking findings: none currently.
- Review scope: validation-workspace completeness, exact fixture copying, entitlement path-integrity regressions, live read-only preflight, collection provisioning boundary, and deployment non-claims.

## User-visible UI impact

- N/A. No screen, interaction, visual artifact, card content, prompt contract, or product behavior changed.

## Card make external workspace impact

- No Card Make files changed in this PR. The already merged Card Make full-track authorization and runtime payload remain separate inputs to the formal release builder.

## Remaining boundary

- The fix must pass review and required checks, merge to `main`, and be fast-forwarded into the clean main worktree before guarded CloudBase deployment apply can run.
- The current remote environment remains development-only: it still uses a fixed development SMS code and development card sources. A successful dev deployment cannot substitute for a receiver-owned formal profile, production SMS, formal content publication, signed private mobile builds, real-device verification, or private distribution evidence.
