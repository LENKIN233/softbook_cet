# Agent Run Record: CloudBase missing-document compatibility

## Task summary

- Date: 2026-07-26
- Branch: `fix/cloudbase-document-not-found`
- PR: pending
- Summary: Repair the CloudBase v2 request-code runtime after a complete-package deployment proved that the Node SDK reports an absent document with the structured code `DOCUMENT_NOT_FOUND`.

## Referenced specs

- `spec/authority-map.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/auth-v2-runtime-contract.md`

## Product truth used

- Login remains required before learning, and server state remains canonical for membership, learning progress, scheduling, explicit check-in, and physical-space actions.
- A CloudBase dev deployment, canary, smoke, local gate, or GitHub check cannot establish production readiness, formal content approval, or launch approval.

## Implementation hypothesis changed

- CloudBase absence handling must inspect structured SDK error codes as well as documented message variants.
- Only explicit document-missing codes or document-specific messages may become `null`; missing collections, network failures, and unrelated not-found errors must remain fatal.
- Auth, learning-event, and legacy CloudBase document reads must share one classifier so their runtime behavior cannot drift.

## Observed failure and recovery

- PR #447 merged the real table catalog, deterministic dependency, and complete-package verification fix as `599236eb0109cc75b8c2780c7b16cf600a94f647`; its PR and post-merge required checks passed.
- The approved dev setup created exactly twelve missing allowlisted collections and verified all seventeen. Function configuration changed only `install_dependency` from `TRUE` to `FALSE`; all eight runtime variables were preserved and remotely verified.
- The first deployment attempt stopped before code update when a read-only backup download failed transiently. The same command then succeeded for fresh and existing destinations.
- The retry backed up the old package, published immutable version `2`, uploaded and exactly re-downloaded the 6,123-file package with SHA-256 `baea64587073cdafebacd5ca4e7c666dbd73ad35111abdaca543a79be45a816d`, then failed the CET4 request-code smoke with HTTP 500.
- Automatic rollback restored and exactly verified the 5,437-file backup with SHA-256 `f3851b1631b3516e6cf61984de0e891b693ecdececbc8a32f183db2b100ff769`, then published rollback version `3`. The original `softbook-api` is the only remaining function.
- The restored old v1 request-code endpoint returned HTTP 200 after rollback.
- An exact-package canary isolated the response error code as `DOCUMENT_NOT_FOUND`. The repaired package returned HTTP 200 on the same real request-code path with online dependency installation disabled.
- Canary cleanup removed its challenge and function but initially left two rate-limit documents. The pre-canary independent baseline proved that collection count was zero, so those two test records were removed and a final preflight verified zero auth challenges, zero rate-limit documents, and zero identity-bound documents.
- CloudBase log service remains disabled; it was not enabled because that can change billing state and was unnecessary after the structured canary response isolated the error.

## Files changed

- `infra/cloudbase/functions/softbook-api/cloudbase-errors.js`: provide the single fail-closed structured missing-document classifier.
- `infra/cloudbase/functions/softbook-api/auth-v2-store.js`: use the shared classifier for transactional auth reads.
- `infra/cloudbase/functions/softbook-api/learning-events-v2-store.js`: use the same classifier for canonical learning reads.
- `infra/cloudbase/functions/softbook-api/index.js`: use the same classifier for membership, progress, card-source, and physical-space reads.
- `infra/cloudbase/functions/softbook-api/test/cloudbase-errors.test.js`: cover structured codes, message compatibility, and unrelated fatal errors.
- `infra/cloudbase/functions/softbook-api/test/auth-v2.test.js`: reproduce the real SDK error shape through the full request-code path.
- `docs/agent-runs/2026-07-26-cloudbase-document-not-found.md`: preserve deployment, rollback, canary, cleanup, validation, and non-claims.

## Validation

- Targeted auth and classifier tests -> 18/18 passed, including a full-path negative case that keeps collection absence fatal.
- Complete CloudBase backend suite -> 135/135 passed.
- `npm audit --omit=dev --audit-level=high` -> 0 known vulnerabilities.
- Deterministic dry-run package -> 6,124 files / 33,753,012 bytes / SHA-256 `2343d7bc5e0803dd818d783abdf862373d4cc6a2cf87e1e63ebe197b77c45ddc`.
- Real exact-package canary -> `InstallDependency=FALSE`, node-sdk 4.0.3, js-sdk 3.6.2, request-code HTTP 200, no response error code.
- Post-canary cleanup preflight -> passed; zero auth challenges, zero rate-limit records, and zero identity-bound documents.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- Final `scripts/run_local_gates --profile dev` -> 18/18 passed; report `exports/local-gates/cloudbase-document-not-found-dev-final.json`.
- `git diff --check` -> passed.
- Strict PR profile and GitHub required checks -> pending.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none.
- Review summary: reviewed the failed deployment and exact rollback evidence, live structured SDK error, shared classifier call sites, fail-closed negative cases, complete backend suite, exact-package canary and cleanup, old v1 availability, Harness, local dev gates, generated report boundary, and non-claims. No product definition or user-visible UI changed.

## User-visible UI impact

- N/A. No screen, interaction, visual artifact, card content, or product definition changed.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not accessed or changed.

## Remaining boundary

- This compatibility fix must pass review and all gates, merge to `main`, and be fast-forwarded into a clean local `main`.
- Only then may the guarded v2 deployment retry. It must again prove complete package equality, dual-track backend smoke, immutable versions, exact rollback readiness, and post-run data state before iOS remote acceptance.
- The old application package remains active after verified rollback; repository-local v2 runtime is still not the deployed dev runtime.
