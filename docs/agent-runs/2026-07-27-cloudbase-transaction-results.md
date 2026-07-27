# Agent Run Record: CloudBase transaction result compatibility

## Task summary

- Date: 2026-07-27
- Branch: `fix/cloudbase-transaction-results`
- PR: https://github.com/LENKIN233/softbook_cet/pull/449
- Summary: Repair CloudBase v2 transaction reads after the guarded dev deployment proved that `@cloudbase/node-sdk` 4.0.3 wraps `transaction.doc().get()` results as `{list: [document]}`.

## Referenced specs

- `spec/authority-map.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`

## Product truth used

- Login remains required before learning. Membership, learning, scheduling, explicit check-in, and physical-space actions remain server-authoritative.
- A CloudBase dev deployment, canary, smoke, local gate, or GitHub check cannot establish production readiness, formal content approval, or launch approval.

## Implementation hypothesis changed

- CloudBase direct document reads return arrays, while version 4.0.3 transaction document reads return a single-key `{list: [...]}` envelope.
- Runtime stores must unwrap only that measured envelope. Ordinary arrays, ordinary objects, and business documents that own a `list` field must retain their original shape.
- Auth, learning events, membership, check-in, learning-session, and physical-space transaction paths must share the same result adapter so their SDK boundary cannot drift.

## Observed failure and recovery

- PR #448 merged as `5c3a5028b433ebfd375bbcb3a3479eaa9f61baa1`. Its post-merge main workflow `30237100908`, including Release simulator build and unsigned archive, completed successfully before any new cloud write.
- The guarded deployment backed up the old function, published pre-deploy version `4`, uploaded and exactly re-downloaded a 6,124-file package with SHA-256 `13b7fcbb09a2b16d112618c142aabe0f2c60bd3b2abc2fe8fdd35fb46e894dc9`, and passed request-code with HTTP 200.
- The same CET4 smoke failed verify-code with HTTP 503. Automatic rollback restored and exactly verified the 5,437-file package with SHA-256 `f3851b1631b3516e6cf61984de0e891b693ecdececbc8a32f183db2b100ff769`, then published rollback version `5`.
- The restored original `softbook-api` remained `Active/Available`, with online dependency installation disabled and all seventeen required collections present.
- An isolated canary reported `sms_challenge_unavailable`. Direct database reads saw `delivery_status=delivered` immediately and after delay, while a transaction read exposed an object whose only key was `list`.
- The old adapter treated that envelope as the challenge, wrote the prior document under a nested `list`, and then could not see top-level delivery state on verification.
- The final PR-head package retained the measured raw SDK shape but passed immediate request-code, verify-code, refresh rotation, same-session validation, and logout.
- Failed-smoke and canary records were bounded by independent zero baselines and isolated timestamps or keys. Cleanup restored zero identity-bound documents, and the temporary canary function was deleted.
- A canary cleanup defect that derived rate-limit IDs from process start time could cross a ten-minute window. The ignored probe was corrected to delete by its random, exact rate-limit keys before final validation.

## Files changed

- `infra/cloudbase/functions/softbook-api/cloudbase-documents.js`: normalize the measured transaction envelope without unwrapping business documents.
- `infra/cloudbase/functions/softbook-api/auth-v2-store.js`: use the shared adapter for auth transaction reads.
- `infra/cloudbase/functions/softbook-api/learning-events-v2-store.js`: use the shared adapter for canonical learning reads and paged query results.
- `infra/cloudbase/functions/softbook-api/index.js`: use the shared adapter for membership, check-in, learning-session, and physical-space reads.
- `infra/cloudbase/functions/softbook-api/test/cloudbase-documents.test.js`: cover direct, transaction, empty, and business-list result shapes.
- `infra/cloudbase/functions/softbook-api/test/auth-v2.test.js`: model the real transaction envelope across the full auth path.
- `infra/cloudbase/functions/softbook-api/test/learning-events-v2.test.js`: model the real transaction envelope in canonical learning commits.
- `infra/cloudbase/functions/softbook-api/test/softbook-api.test.js`: model the real transaction envelope across membership, session, check-in, and physical-space stores.
- `docs/agent-runs/2026-07-27-cloudbase-transaction-results.md`: preserve deployment, rollback, diagnosis, canary, cleanup, validation, and non-claims.

## Validation

- Complete CloudBase backend suite under Node 22.13.0 -> 137/137 passed.
- `npm audit --audit-level=high` -> 0 known vulnerabilities.
- Final PR-head dry-run package -> 6,125 files / 33,753,610 bytes / SHA-256 `42401383a853d8d331d53671ab1689a1bb631afadf0173a4452de2cbf79a6172`.
- Real final-package canary -> `InstallDependency=FALSE`, node-sdk 4.0.3, js-sdk 3.6.2, request HTTP 200, verify HTTP 200, refresh HTTP 200, refresh token rotated, session ID preserved, logout HTTP 204.
- Post-canary cleanup preflight -> passed; zero auth challenges, rate-limit records, sessions, and other identity-bound documents; only the original `softbook-api` function remained.
- `python3 scripts/validate_harness.py --mode local` -> `HARNESS VALIDATION OK`.
- `scripts/run_local_gates --profile dev` -> 18/18 passed; report `exports/local-gates/cloudbase-transaction-results-dev.json`.
- Changed JavaScript syntax checks and `git diff --check` -> passed.
- Strict PR profile -> pending final-head run.
- GitHub required checks -> pending.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none.
- Review summary: reviewed the failed deployment and exact rollback, live SDK response shapes, every transaction read call site, strict envelope detection, full backend regression suite, final-package immediate auth canary, cleanup evidence, generated-report boundary, and non-claims. No product definition or user-visible UI changed.

## User-visible UI impact

- N/A. No screen, interaction, visual artifact, card content, or product definition changed.

## Card make external workspace impact

- N/A. `/Users/lenkin/programing/card make` was not accessed or changed.

## Remaining boundary

- The original `softbook-api` still runs the verified rollback package. Repository-local v2 remains undeployed.
- This fix must pass strict PR gates and GitHub required checks, merge to `main`, and be followed by a successful post-merge main workflow.
- Only then may the guarded deployment retry. It must prove exact package equality, dual-track backend smoke, immutable versions, rollback readiness, and post-run data state before iOS remote acceptance.
