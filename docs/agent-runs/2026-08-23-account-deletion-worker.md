# Agent Run Record: account deletion worker

## Task summary

- Date: 2026-08-23
- Branch: `infra/account-deletion-worker-v1`
- PR: pending publication
- Summary: Implement the repository and receiver-deployment boundary that
  leases queued account-deletion tasks, erases all current and retained user
  records idempotently, removes the login fence last, and permits clean
  re-registration only after verified completion.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/release-operational-policy.json`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Account deletion must revoke access through server authority and cannot rely
  on a client-only flag.
- While deletion is pending, the durable task blocks login, refresh and every
  protected session read. Removing that task is therefore the final erasure
  step, not an early cleanup convenience.
- Account deletion covers current runtime state and retained phone-keyed
  migration state; it must not delete global content releases or shared IP rate
  limits.
- The active no-tombstone contract permits clean re-registration only after all
  account data and the task are gone.
- Repository tests and deployment plans are not receiver execution, provider
  cleanup, retention-policy evidence, or a completed deletion drill.

## Implementation hypothesis changed

- `account-deletion-task.v1` stores exact account/phone scope, the derived
  phone-only rate key, retry state, and a random claim-bound five-minute lease.
- The worker claims queued or expired-lease tasks, deletes account-keyed Auth,
  Progress, Learning, pilot-round and Space data; phone-filtered SMS challenges
  and retained daily/learning/Space migration records; phone-keyed membership
  plus revision and beta/pilot entitlements; and only the phone rate-limit key.
- Queued and expired-processing tasks are queried separately before merge/sort,
  so older live processing leases cannot hide queued work behind a prefilter
  page.
- Partial failure requeues only the same live lease. A stale worker cannot
  complete or release a task claimed by another worker. Repeated deletion and
  duplicate timer delivery are idempotent.
- The task is removed and re-read last. The public report contains only counts,
  timestamps, full SHA-256 deletion-ID fingerprints and bounded statuses.
- Formal and controlled-pilot receiver deployment build/test one isolated
  artifact, deploy `softbook-api` and the non-HTTP
  `softbook-account-deletion-worker`, create or preserve the exact one-minute
  timer, and reread handler/runtime/timeout/empty-variable-set/trigger metadata
  before success. The worker receives none of the API's auth, SMS, signing, or
  operator secrets.

## Workspace boundary and read scope

- Active truth/source read: the listed specs/contracts; current auth task/store,
  all current CloudBase collection owners, retained migration paths, receiver
  delivery tooling, smoke lifecycle ownership, and worker prototype history.
- Historical branch read: old unmerged worker source was used only as a starting
  comparison. The current implementation adds current sidecar collections,
  retained migration deletion, strict task schema, claim ownership and remote
  deployment reread not present in that prototype.
- Generated/dependency/cache/archive read: backend dependencies installed from
  the tracked lockfile for tests; generated dependencies are not product truth.
- External workspace read: none. Card content, approval and audio-QC workspaces
  are untouched.

## Files changed

- `infra/cloudbase/functions/softbook-api/account-deletion-worker-v1.js`: worker,
  strict task normalization, lease-bound repository operations, full collection
  erasure and PII-free report.
- `infra/cloudbase/functions/softbook-api/auth-v2.js` and `index.js`: exact task
  creation, worker handler/export, and in-memory integration for end-to-end
  re-registration tests.
- Backend tests: collection coverage, shared-IP preservation, expired lease,
  lease loss, partial failure/retry, malformed task fail-closed, CloudBase
  repository behavior, post-deletion registration, and receiver deployment
  handler/timer inspection and idempotency.
- `infra/cloudbase/deliver-release.mjs` and
  `infra/cloudbase/deliver-controlled-pilot.mjs`: two-function deployment,
  exact timer creation/preservation, and remote metadata verification.
- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`,
  `spec/evals.json`, `spec/agent-harness.json`, `AGENTS.md`, and the product
  contract mirror: durable owner, read path, GT-37 and harness protection.
- Auth, controlled-pilot, release-bundle runtime contracts and CloudBase README:
  local implementation and remaining receiver/provider evidence boundaries.
- `docs/agent-runs/2026-08-23-account-deletion-worker.md`: this record.

## Commands run

- Focused worker/Auth/formal-delivery/controlled-pilot-delivery tests -> 39/39
  passed after final queue-starvation and secret-isolation additions.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 293/293 passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/validate_harness.py --mode local` -> passed all 15 local
  sections with `HARNESS VALIDATION OK`.
- Changed JSON parsing, Node/Python syntax and `git diff --check` -> passed.
- `python3 scripts/validate_harness.py --mode full` -> `HARNESS VALIDATION OK`
  with the remote repository guard executed.
- `./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/account-deletion-worker-dev.json` -> final run 24/24
  passed, 0 exceptions, 0 failures. Earlier attempts hit existing 0.1-second
  macOS sandbox process-group timing flakes; both suites and the final aggregate
  rerun passed without code changes.
- Final PR checks: pending publication.

## Validation results

- Exact current collection lists include membership/Space sidecars and retained
  phone-keyed daily/learning/Space migration records.
- Shared IP rate limits and global content are preserved; only the task-bound
  phone rate key is removed.
- Task removal is the final repository call; interruption leaves the task queued
  and retry completes already-partial erasure.
- Lease takeover prevents an older worker from completing or requeueing the
  newer claim; an expired lease is reclaimable.
- In-memory auth integration deletes session/Learning/Membership state and then
  permits a new session for the same phone only after task removal.
- Receiver deployment verifies an exact existing timer without duplicate
  creation and fails closed on handler or cron drift.
- Worker deployment has an empty custom-variable set and fails closed if API
  secrets or any other runtime variables appear on the worker.
- Receiver execution and a real deletion drill: not run and not claimed.

## Binary evidence

- Evidence manifest: N/A. This server/runtime task produces no retained binary,
  screenshot, recording or device evidence.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: Passed.
- Blocking findings: None.
- Review summary: verified exact task fields, queued/expired query separation,
  claim-bound lease ownership, current and retained collection coverage,
  shared-IP/global-content preservation, partial retry, task-last completion,
  clean re-registration, PII-free reporting, secret-free worker deployment,
  idempotent exact trigger preservation, remote metadata reread, contract/eval
  mirrors, full backend regressions, full harness and 24/24 local gates.

## User-visible UI impact

- No screen, component, layout, copy, interaction, motion, navigation or visual
  token changes.
- The existing account-deletion request remains a backend route; this task adds
  no client deletion surface and makes no design-completion claim.

## Card make external workspace impact

- None. No card payload, approval, audit, audio asset or QC record is read,
  created or modified.

## Risks and open questions

- Repository fake-CloudBase coverage and remote function metadata inspection do
  not prove receiver timer delivery, real database isolation, backlog SLO or
  provider-side deletion.
- TTL/retention policy configuration and provider cleanup remain external work.
- A completed receiver deletion drill must prove task lease/retry, full erasure,
  login fence, no-tombstone re-registration and monitoring on one exact release
  cohort before launch readiness can advance.

## Follow-up

- Finish final validation, publish/merge the PR, then run receiver-owned
  preflight/deployment and the formal account-deletion drill when a validated
  profile and secrets exist.
- Continue formal CET4 approval, 301/301 identified-human audio QC, real-device
  private-audio/minimum-version acceptance and release/rollback evidence.
