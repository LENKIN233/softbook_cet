# Agent Run Record: CloudBase SDK security upgrade

## Task summary

- Date: 2026-07-17
- Branch: `infra/cloudbase-sdk-security`
- PR: `#408`
- Summary: Refresh the existing CloudBase SDK Dependabot change onto current `main`, remove the temporary `lodash.set` high-severity advisory exception, and pin the backend tests to the CloudBase database surface used by Softbook.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Login remains required before learning and phone SMS remains the primary login method.
- Server canonical state remains authoritative for membership and synchronized account state.
- This dependency update does not claim production authentication, live Tencent Cloud deployment, or launch readiness.

## Implementation hypothesis changed

- The CloudBase function runtime dependency moves from `@cloudbase/node-sdk` 3.18.4 to 4.0.3.
- The backend contract now verifies the SDK entry points used by this repository: `init`, `SYMBOL_CURRENT_ENV`, `database`, `collection`, and `runTransaction`.
- `GHSA-P6MC-M468-83GW` is removed from the dependency exception policy because the upgraded resolved dependency graph no longer contains `lodash.set` or any production audit finding.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, CloudBase function implementation and tests, dependency audit policy and validator, PR #408 metadata, and current `main` delivery configuration.
- Generated/dependency/cache/archive read: installed backend dependencies were inspected only to verify the declared SDK API and run the package audit/tests. No archive truth was used.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or edited.

## Files changed

- `infra/cloudbase/functions/softbook-api/package.json` and `package-lock.json`: upgrade `@cloudbase/node-sdk` to 4.0.3, remove the obsolete `lodash.unset` override, and resolve the dependency graph without either standalone package.
- `infra/cloudbase/functions/softbook-api/test/softbook-api.test.js`: add a no-network compatibility regression for the CloudBase SDK database APIs used by the runtime.
- `security/dependency-audit-policy.json`: remove the resolved high-severity advisory exception.
- `docs/agent-runs/2026-07-17-cloudbase-sdk-security.md`: record scope, validation, review, and remaining live-environment risk.

## Commands run

- `npm ci` in `infra/cloudbase/functions/softbook-api` -> installed 78 packages; npm reported 0 vulnerabilities.
- Direct SDK surface probe -> confirmed CloudBase SDK 4.0.3 exposes `init`, `SYMBOL_CURRENT_ENV`, `database`, `collection`, and `runTransaction` without network access.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 15 tests passed, including the new installed-SDK compatibility test and existing transaction/canonical-state regressions.
- `npm ls --all` in `infra/cloudbase/functions/softbook-api` -> dependency tree resolved successfully; only declared optional native helpers were absent.
- `node scripts/test_validate_dependency_security.mjs` -> policy negative fixtures passed.
- `node scripts/validate_dependency_security.mjs` -> passed; mobile and CloudBase API each reported 0 production vulnerabilities and no advisory exceptions.
- `scripts/run_local_gates --profile dev --output exports/local-gates/cloudbase-sdk-security-dev.json` -> complete `passed_with_exception`; 16/17 gates passed, with only the explicit dev Node 25.9.0 versus 22.13.0 drift, and tracked worktree state remained unchanged.
- `python3 scripts/validate_harness.py` -> complete remote Harness passed.

## Validation results

- Before this change, the CloudBase target reported 3 high vulnerability instances under `GHSA-P6MC-M468-83GW`, accepted only by a time-limited policy exception.
- After this change, both audited production targets report zero vulnerabilities and `allowed_advisories` is empty.
- Existing fake-database tests continue to cover document persistence, legacy space migration, transaction serialization, simultaneous writes, and card-source validation.
- Local quality orchestration did not update PR review, content approval, or launch readiness formal state.
- Live CloudBase deployment compatibility is not claimed by local tests and remains blocked on verified Tencent Cloud production/staging access.

## Agent review status

- Reviewer: Codex
- Status: Pending
- Blocking findings: Review will be completed after the complete diff and local/remote gates are available.

## User-visible UI impact

- N/A. No screen, copy, component, interaction, navigation, or visual artifact changed.

## Card make external workspace impact

- N/A. No candidate content, audio, review, approval, or import payload changed.

## Risks and open questions

- The SDK update is a semver-major change. Local tests prove only the API surface and repository-owned behavior; a staging deployment with real CloudBase credentials is still required before production use.
- Production authentication still uses the existing development implementation and is not made production-ready by this dependency upgrade.
- `docs/release/launch-readiness.v1.json` correctly remains `not_ready`.

## Follow-up

- Run full local Harness and PR gates, complete Agent review, update PR #408, and merge only after all required GitHub checks pass on the reviewed head.
