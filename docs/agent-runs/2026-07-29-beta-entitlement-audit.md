# Agent Run Record: audited beta entitlement

## Task summary

- Date: 2026-07-29
- Branch: `infra/beta-entitlement-audit`
- Summary: Implemented dry-run-first receiver-operator grant/revoke for CET4 closed-beta premium access, with an idempotent audit record and canonical server membership overlay. No CloudBase write, real entitlement grant, payment, deployment, or user-data import was performed.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`

## Product truth used

- Closed-beta users need shared server-authoritative membership access, and payment is not connected in this delivery scope.
- A client must not be able to grant or revoke its own beta access.
- Receiver delivery must remain independent of the personal development environment and must not carry development users or learning data.

## Implementation hypothesis changed

- `beta-entitlement-command.v1` is a strict operator input for one `grant` or `revoke`; exact event replay is idempotent and event-ID mutation fails closed.
- `softbook_beta_entitlements` stores the active grant and append-only audit sequence in one revisioned account document. The base `softbook_memberships` document remains unchanged.
- Canonical membership reads overlay `premium` only while the beta document has valid active evidence. Revoke reveals the current base membership, so it does not downgrade a later non-beta premium state.
- The operator command is dry-run by default. Apply requires Node 22.13.0, a receiver-owned delivery profile, healthy remote preflight, and clean `main` exactly equal to `origin/main`.
- Operator reports contain a truncated SHA-256 account fingerprint and no phone number. Command files contain personal data and are excluded from release artifacts by contract.

## Workspace boundary and read scope

- Active repository scope: membership/runtime/delivery specs, CloudBase membership storage, delivery safety, smoke lifecycle cleanup, metadata guards, and tests.
- `/Users/lenkin/programing/card make` was not modified and no card content or approval state changed.
- No personal CloudBase record, receiver credential, real beta account, audio asset, or release bundle was read or changed.
- Generated gate reports and installed dependencies were validation artifacts only and were not used as product truth.

## Files changed

- `spec/membership.json`, `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`: closed-beta operator, audit, and client boundaries.
- `infra/cloudbase/beta-entitlement-v1.mjs`: strict command validation, canonical hashing, idempotent grant/revoke planning, audit validation, and public redacted reports.
- `infra/cloudbase/manage-beta-entitlement.mjs`: receiver preflight, dry-run/apply write safety, optimistic revision update, and post-write verification.
- `infra/cloudbase/functions/softbook-api/index.js`: canonical CloudBase membership overlay and malformed-evidence fail-closed behavior.
- `infra/cloudbase/deployment-safety.mjs`, `infra/cloudbase/provision-softbook-nosql.mjs`: allowlisted beta-entitlement collection and identity probes.
- `infra/cloudbase/smoke-record-lifecycle.mjs`: exact beta-entitlement discovery, ownership validation, and cleanup.
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`, `infra/cloudbase/README.md`, `AGENTS.md`: operator and runtime documentation.
- Backend, CLI, lifecycle, mobile/design metadata regression tests and scanners.

## Commands run

- `jq empty spec/membership.json spec/account-sync-contract.json spec/runtime-boundaries.json` -> passed.
- `node --check infra/cloudbase/beta-entitlement-v1.mjs` -> passed.
- `node --check infra/cloudbase/manage-beta-entitlement.mjs` -> passed.
- `npm test --prefix infra/cloudbase/functions/softbook-api` -> 179 tests passed.
- `node infra/cloudbase/test-smoke-record-lifecycle.mjs` -> 11 tests passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed, 15/15 selected local sections.
- Mobile lint and typecheck -> passed.
- Mobile Jest -> 43 suites / 399 tests passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API reported zero known vulnerabilities.
- `scripts/run_local_gates --profile dev` -> 19/20 gates passed plus the declared dev-only Node 25.9.0 versus required 22.13.0 safe exception; no failed gate.
- No CloudBase command was run with `--apply`.

## Validation results

- Tests prove strict command fields, phone validation, event collision rejection, exact replay idempotency, matching-grant revoke, audit sequence validation, topic-branch write rejection, post-write verification, and phone-free reports.
- Canonical CloudBase membership tests prove active beta access overlays premium without changing the base membership, later base premium survives beta revoke, and malformed active evidence fails closed.
- Provisioning and blank-baseline checks include `softbook_beta_entitlements`; smoke lifecycle cleanup deletes only exact manifest-owned beta documents.
- Full remote harness completeness remains pending until PR #460 adds and lands the Android required check on `main`.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: passed
- Blocking findings: none in the repository-local beta entitlement scope.
- Review summary: Reviewed authorization boundary, PII redaction, command strictness, audit/active-state consistency, idempotency, revision concurrency guard, base membership preservation, later-premium revoke behavior, invalid-record fail-closed behavior, collection provisioning, blank-environment counts, and smoke cleanup.

## User-visible UI impact

- N/A. No screen, copy, visual state, gesture, accessibility behavior, or payment UI changed.

## Card make external workspace impact

- N/A. No content or approval work occurred in `/Users/lenkin/programing/card make`.

## Risks and open questions

- Repository fixtures verify CloudBase command shapes; a receiver-owned environment has not executed preflight, grant, read-back, revoke, or cleanup.
- The operator-supplied `occurred_at` is audit input bound by the command hash; the receiver must control actor identities and command-file handling operationally.
- Account deletion currently queues deletion work; the eventual production deletion worker must include the beta-entitlement collection, while the existing smoke lifecycle already cleans exact test records.
- Payment and public purchase remain outside this closed-beta scope. This change does not itself hide or redesign any paywall surface.
- #460 still awaits the user's protected-environment approval, and the card-content repository still has GitHub Actions billing failures; those external gates block the dependent PR chain and bulk content remediation.

## Follow-up

- After #460 merges, rebase this branch on `main`, run the complete PR profile including remote required-check validation, and open the PR.
- In the receiver-owned environment, provision the new collection before deploying the runtime, then dry-run and apply lifecycle-owned test grant/revoke commands from clean exact `main`.
- Verify the entitlement on both iOS and Android through login, bootstrap, learning access, restart recovery, and exact cleanup before closed-beta release.
