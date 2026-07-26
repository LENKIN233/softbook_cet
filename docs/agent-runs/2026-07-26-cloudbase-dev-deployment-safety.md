# Agent Run Record: CloudBase dev deployment safety

## Task summary

- Date: 2026-07-26
- Branch: `infra/cloudbase-dev-deploy-safety`
- PR: pending
- Summary: Replace the direct force-deploy path with an allowlisted, dry-run-by-default CloudBase dev manager that proves preflight state, protects runtime secrets, creates exact backup/deployment manifests, verifies live smoke, and automatically restores code or configuration after failed writes.

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

- Login remains required before learning, server state remains canonical for membership, learning progress, scheduling, explicit check-in, and physical-space actions, and remote content failure must fail closed.
- A successful CloudBase dev deployment or smoke run is not production readiness, formal card approval, a GitHub required check, or launch approval.

## Implementation hypothesis changed

- The repository now has one guarded manager for the allowlisted CloudBase dev environment with read-only preflight, secure runtime configuration, clean artifact construction, immutable version publication, source/package manifest verification, dual-track live smoke, and automatic code/config restoration.
- Repository-local v2 backend and mobile binding remain `implemented_locally_not_deployed` until a later merged-main deployment and remote acceptance record proves otherwise.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, the referenced specs and runtime contracts, `infra/cloudbase/README.md`, `infra/cloudbase/cloudbaserc.json`, existing CloudBase scripts, backend source/tests, CI/backend gate wiring, and current repository state.
- Generated/dependency/cache/archive read: ignored `exports/cloudbase-deployments/` reports and artifacts were inspected only to verify permissions, redaction, manifests, and dry-run behavior; installed backend/mobile dependencies were used for tests and formatting.
- External workspace read: none; `/Users/lenkin/programing/card make` was not accessed.

## Files changed

- `infra/cloudbase/deployment-safety.mjs`: pure target, toolchain, metadata, runtime-secret, collection-probe, manifest, version-identification, comparison, and redaction contracts.
- `infra/cloudbase/manage-softbook-api.mjs`: `preflight`, `configure`, `deploy`, and `rollback` orchestration with explicit apply gates and ignored reports.
- `infra/cloudbase/deploy-softbook-api.sh`: compatibility wrapper that delegates to guarded dry-run deployment.
- `infra/cloudbase/provision-softbook-nosql.mjs`: collection provisioning is target-locked and dry-run unless `--apply` is explicit; apply also requires Node 22.13.0 and clean current `main`.
- `infra/cloudbase/cloudbaserc.json`: remove tracked runtime values that could overwrite secrets and update the dev-only description.
- `infra/cloudbase/functions/softbook-api/test/deployment-safety.test.js`: negative and contract tests for environment/toolchain locking, redaction, secret strength/stability, collection probes, repository state, full/source manifests, immutable version identity, artifact filtering, argument semantics, and dry-run provisioning.
- `infra/cloudbase/README.md`: document preflight, secure configuration, artifact validation, apply, automatic restoration, manual rollback, and non-claims.
- `docs/agent-runs/2026-07-26-cloudbase-dev-deployment-safety.md`: durable task evidence.

## Commands run

- `node --check infra/cloudbase/deployment-safety.mjs` -> passed.
- `node --check infra/cloudbase/manage-softbook-api.mjs` -> passed.
- `bash -n infra/cloudbase/deploy-softbook-api.sh` -> passed.
- `cd infra/cloudbase/functions/softbook-api && node --test test/deployment-safety.test.js` -> 17/17 passed under Node 22.13.0.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> 125/125 passed under Node 22.13.0.
- `cd infra/cloudbase/functions/softbook-api && npm audit --omit=dev --audit-level=high` -> 0 known vulnerabilities.
- `node infra/cloudbase/manage-softbook-api.mjs preflight` -> failed closed as expected because the stale remote has no explicit v2 runtime values or strong auth secrets; environment, function, collections, versions, routes, and both card sources were read successfully without a cloud write.
- `node infra/cloudbase/manage-softbook-api.mjs configure` -> planned eight managed variable names, including two generated secret names, without recording values and without a cloud write.
- `tcb fn code download softbook-api exports/cloudbase-deployments/download-shape-check --json` -> read-only download proved that the remote package is written directly to the requested directory.
- Two consecutive Node 22.13.0 `node infra/cloudbase/manage-softbook-api.mjs deploy` dry-runs -> clean install, full backend tests, artifact load, and source manifest passed; both produced the same 6,123-file/33,752,668-byte package SHA-256 `baea64587073cdafebacd5ca4e7c666dbd73ad35111abdaca543a79be45a816d`.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/test_learning_scheduler_contract.py` -> 9/9 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `PATH=<Node 22.13.0> scripts/run_local_gates --profile dev` -> 18/18 passed; final report `exports/local-gates/20260726T044541Z-cf7df2da-dev-28897/report.json`.
- `rg` scans of generated reports/logs for phone, bearer token, JSON token/secret fields, and auth-secret assignments -> no matches.
- `git diff --check`, Node syntax checks, and `bash -n infra/cloudbase/deploy-softbook-api.sh` -> passed.

## Validation results

- Target locking rejects any environment, function, or base URL outside the one documented CloudBase dev target.
- Runtime reports expose only variable names and boolean strength/distinctness results; sensitive CloudBase command output is never written.
- Missing/weak stable secrets cannot be regenerated after identity-bound v2 documents exist.
- Source deployment comparison excludes platform-installed dependencies, while backup/rollback integrity uses a full package manifest including dependencies and symbolic links.
- Deployment artifacts exclude npm command shims, contain no symbolic links or machine-absolute paths, and persist a deterministic full package manifest as a mode-`0600` ignored artifact.
- Every version publication must be resolved to exactly one newly added immutable version ID with a unique run description before the operation can continue.
- Configuration and code writes both have automatic restoration paths with exact post-restore verification.
- All generated reports/logs observed were mode `0600`; sensitive scans were clean and the tracked worktree remained unchanged by every dry-run.
- Harness and the complete local `dev` profile are green. Agent review, PR-profile remote checks, and GitHub required checks remain pending.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none
- Review scope: staged deployment manager, pure safety contracts, provisioning wrapper, configuration boundary, tests, documentation, and generated-evidence behavior.

## User-visible UI impact

- N/A. No user-visible UI, interaction, design artifact, card content, or runtime product behavior changes in this PR.

## Card make external workspace impact

- N/A. The external content workspace was not accessed or changed.

## Risks and open questions

- CloudBase write behavior is intentionally not exercised from this topic branch. `configure --apply` and `deploy --apply` must run only after this PR is merged and local clean `main` equals `origin/main`.
- Immutable version publication, automatic configuration restoration, automatic code restoration, and live write smoke are implemented and unit/local-dry-run verified but cannot be end-to-end proven until the merged-main dev deployment is explicitly applied.
- The first secure configuration will create stable dev auth secrets because read-only probes prove there are currently zero identity-bound v2 documents. Later secret loss or weakness will fail closed and require an explicit migration decision.
- Production CloudBase Run, PostgreSQL, real SMS, signed content, payments, formal content approval, and release readiness remain outside this dev deployment slice.

## Follow-up

- Complete local review/gates, open and merge the tooling PR, fast-forward clean `main`, apply secure dev configuration, deploy the exact artifact, and record backend plus iOS remote acceptance before changing any deployment-status claim.
