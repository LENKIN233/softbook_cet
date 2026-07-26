# Agent Run Record: CloudBase deployment determinism and real catalog

## Task summary

- Date: 2026-07-26
- Branch: `fix/cloudbase-deployment-determinism`
- PR: https://github.com/LENKIN233/softbook_cet/pull/447
- Summary: Repair the guarded CloudBase dev deployment after the first v2 apply proved that zero-count probes did not establish collection existence and CloudBase online dependency installation did not preserve the lockfile-resolved package.

## Referenced specs

- `spec/authority-map.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`

## Product truth used

- Login remains required before learning, and server state remains canonical for membership, learning progress, scheduling, explicit check-in, and physical-space actions.
- A CloudBase dev configuration, deployment, smoke, or local gate result cannot establish production readiness, formal content approval, GitHub required-check status, or launch approval.

## Implementation hypothesis changed

- Required NoSQL collection existence must come from the CloudBase table catalog. A successful zero-count command is not collection-existence evidence.
- Provisioning must call allowlisted `CreateTable` operations only for missing tables, remain idempotent, avoid placeholder documents, and verify the complete post-write catalog.
- The function must use `installDependency: false`; the guarded artifact already contains the clean `npm ci` dependency tree, and remote verification and rollback must compare the complete package rather than source files alone.

## Observed failure and recovery

- Runtime configuration apply from merged `main` `d03c1fbed774ddfb75a128d9d57d720fda77425c` passed and independently read back all eight managed variables without recording secret values.
- Deployment run `exports/cloudbase-deployments/deploy-2026-07-26T083708651Z-d03c1fbed774/report.json` uploaded and source-verified the v2 implementation, then the CET4 write smoke failed because `/v2/auth/request-code` returned 500.
- Automatic rollback uploaded the saved package. Application source outside `node_modules` matched the backup exactly and the restored v1 endpoint returned 200, but the report correctly remained `rollback_failed` because CloudBase had reinstalled dependencies and the complete package no longer matched.
- The deployment artifact contained `@cloudbase/node-sdk 4.0.3` and `@cloudbase/js-sdk 3.6.2`; CloudBase online installation replaced the latter with `3.6.4`.
- A temporary `softbook-api-canary` with online installation disabled preserved the exact locked versions and returned `DATABASE_COLLECTION_NOT_EXIST`, excluding dependency drift as the immediate request failure.
- Direct FlexDB `ListTables` evidence showed only five actual tables: card sources, memberships, daily progress, learning states, and space states. Twelve required v2 tables were absent even though the previous count-based preflight reported all seventeen present.
- A second read-only call verified that the documented public CloudBase `tcb/2018-06-08` `DescribeTables` endpoint returns the same five-table catalog, so the implementation no longer depends on the older internal FlexDB service endpoint.
- The canary function and probe documents were removed. Only the original `softbook-api` function remains, active and available on the restored old application source.

## Files changed

- `infra/cloudbase/deployment-safety.mjs`: require bundled dependencies, inspect the real table catalog, build target-locked public CloudBase table commands, and derive collection health from catalog membership.
- `infra/cloudbase/manage-softbook-api.mjs`: consume the real catalog in every preflight, configure the function with online installation disabled, and compare complete deployed and restored packages.
- `infra/cloudbase/provision-softbook-nosql.mjs`: replace placeholder upserts with idempotent `DescribeTables` and allowlisted `CreateTable` operations plus post-write verification.
- `infra/cloudbase/cloudbaserc.json`: set `installDependency: false`.
- `infra/cloudbase/functions/softbook-api/test/deployment-safety.test.js`: add negative coverage for zero-count false positives, missing or online-installed dependencies, catalog truncation, table allowlisting, and complete-package verification.
- `infra/cloudbase/README.md`: document real-catalog provisioning and lockfile-resolved package deployment.
- `docs/agent-runs/2026-07-26-cloudbase-deployment-determinism.md`: preserve failure, recovery, validation, and non-claims.

## Validation

- Targeted deployment-safety tests -> 23/23 passed.
- Full CloudBase backend suite -> 131/131 passed.
- `npm audit --omit=dev --audit-level=high` -> 0 known vulnerabilities.
- Read-only fixed preflight -> failed closed with the exact twelve missing collections and `InstallDependency=TRUE`; original report `exports/cloudbase-deployments/preflight-2026-07-26T085955965Z-d03c1fbed774/report.json`.
- Public API readback -> documented CloudBase `DescribeTables` returned the same five-table catalog. The guarded manager then failed closed on the same twelve missing collections and `InstallDependency=TRUE`; report `exports/cloudbase-deployments/preflight-public-api-pr447-v2/report.json`.
- Provisioning dry-run -> listed all seventeen required collections and confirmed no remote read or write.
- Deterministic deployment dry-run -> built 6,123 files / 33,752,668 bytes with SHA-256 `baea64587073cdafebacd5ca4e7c666dbd73ad35111abdaca543a79be45a816d`; report `exports/cloudbase-deployments/deploy-2026-07-26T090452722Z-d03c1fbed774/report.json`. The report remained `planned` and listed every remote prerequisite as a warning.
- Learning-events contract tests -> 17/17 passed.
- Learning-scheduler contract tests -> 9/9 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- Final pre-PR `scripts/run_local_gates --profile dev` -> 18/18 passed; report `exports/local-gates/cloudbase-deployment-determinism-dev-pre-pr.json`.
- Initial strict PR profile -> failed closed only on the intentionally pending Agent review template, local Ruby 4.0 path, and missing topic-branch fetch refspec; 27/30 gates passed. Ruby 3.3 and the exact topic refspec are available for the final rerun.
- Final strict PR profile and GitHub required checks -> pending.
- `git diff --check` -> passed.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none.
- Review summary: reviewed the real failure and rollback evidence, public CloudBase catalog API contract and readback, target/table allowlisting, partial-apply recovery, deterministic dependency configuration, complete package verification for deploy and rollback, redaction boundary, regression coverage, documentation, and generated-report non-claims. No product behavior or cloud write is part of the PR.

## User-visible UI impact

- N/A. No screen, interaction, visual artifact, card content, or product behavior changed.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not accessed or changed.

## Remaining boundary

- This change must pass the final strict PR profile and GitHub required checks, merge to `main`, and be fast-forwarded into a clean local `main`.
- Only then may the approved dev cloud writes run in order: create missing tables, apply deterministic function configuration, verify preflight, deploy the complete v2 package, run dual-track backend smoke, and run iOS remote Maestro acceptance.
- Repository-local v2 runtime remains not deployed; launch readiness remains false.
