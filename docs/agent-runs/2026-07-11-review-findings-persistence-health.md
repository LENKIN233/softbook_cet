# Agent Run Record: Persistence And Repository Health Review Fixes

## Task summary

- Date: 2026-07-11
- Branch: `fix/review-findings-persistence`
- PR: https://github.com/LENKIN233/softbook_cet/pull/404
- Summary: Resolve the post-cutover review findings around restored-session authorization, durable logout, server-authoritative space state, and transient Git blob auditing.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- Authentication remains required before learning.
- Membership entitlement and physical-space state synchronize with server authority.
- Offline mutations may be queued, but reconnect must reconcile with canonical server state.

## Implementation hypothesis changed

- Remote repositories preserve HTTP status in `RemoteHttpError`; 401 and 403 never fall back to cached authority and revoke the restored session.
- Logout writes a non-sensitive AsyncStorage tombstone before Keychain cleanup. The tombstone blocks credential restoration until a new secure session is saved.
- `user-state.v2` preserves the timestamp of each explicit favorite or sleep action. Legacy v1 entries migrate with an epoch timestamp.
- Mobile restoration reads account-level canonical space state before sending cached state. Server and client merge per card by action timestamp, with server state winning ties.
- The backend stores one canonical space-state document per account, migrates legacy daily documents, and returns canonical state after reads and writes.
- Repository health audits every blob introduced by the PR commit range, including blobs removed again before the final tree.

## Workspace boundary and read scope

- Active truth/source read: runtime persistence, membership, learning, space and sync repositories; CloudBase API; current tests; repository health workflow and scripts.
- Generated/dependency/cache/archive read: installed lockfile dependencies only for local tests; no generated artifact was committed.
- External workspace read: `/Users/lenkin/programing/card make` governance scripts and queue contracts only for the parallel tooling fix.

## Files changed

- `apps/mobile/src/persistence/`: durable auth revocation and versioned user-state migration.
- `apps/mobile/src/runtime/remoteHttpError.ts`: typed remote authorization failures.
- `apps/mobile/src/{learning,membership,space,sync}/`: authorization propagation and canonical space reconciliation.
- `apps/mobile/App.tsx`: restored-session validation, awaited logout, canonical hydration, and replay refresh wiring.
- `infra/cloudbase/functions/softbook-api/`: account-level canonical space-state read, merge, migration, and tests.
- `scripts/report_repo_health.mjs` and `scripts/test_report_repo_health.mjs`: commit-range blob audit and transient-blob regression.
- `.github/workflows/pr-gates.yml`: run the repository-health regression and provide authenticated weekly GitHub inspection.
- `spec/account-sync-contract.json` and `spec/runtime-boundaries.json`: updated implementation hypotheses.

## Commands run

- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed during implementation; final rerun recorded below.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 13 tests.
- `node scripts/test_report_repo_health.mjs` -> passed; introduced-and-deleted 2 MiB blob was rejected.
- `git diff --check` -> passed.

## Validation results

- Authorization, tombstone, user-state migration, canonical space merge, offline replay, and App restoration regressions: passed.
- Backend memory and CloudBase-compatible canonical/migration tests: passed.
- Full local harness, mobile quality, backend contract, repository health, and evidence validation: passed.
- GitHub required checks: pending.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.
- No screenshot, recording, generated report, or other binary evidence is committed.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none

## User-visible UI impact

- None. Existing screens, copy, controls, navigation, and visual treatment are unchanged.
- Design source and design review checklist: not applicable to this runtime and governance-only behavior fix.

## Card make external workspace impact

- A separate tooling-only branch strengthens candidate queue and repository-health validation.
- No card JSON, audio, candidate PR content, or `reviews/approved_batches/` record is changed.

## Risks and open questions

- CloudBase merge remains a read-merge-write operation; transaction-level conflict control can be added if production concurrency evidence requires it.
- Existing npm audit findings are unchanged and remain separate dependency-remediation work.

## Follow-up

- Merge only after all required GitHub checks pass.
