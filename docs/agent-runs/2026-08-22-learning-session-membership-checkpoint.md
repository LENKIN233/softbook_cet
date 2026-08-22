# Agent Run Record: learning-session membership checkpoint

## Task summary

- Date: 2026-08-22
- Branch: `fix/learning-session-trial-null-guard-v2`
- PR: https://github.com/LENKIN233/softbook_cet/pull/511
- Summary: Prevent a learning-session selection from returning stale Membership
  authority or starting base Trial when a beta/pilot entitlement or base
  membership mutation races cursor acceptance.

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
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`

## Product truth used

- Trial begins only after the first concrete Learning entry is ready and
  counted; an empty or failed selection cannot consume Trial.
- A receiver-issued beta entitlement is canonical premium access layered over
  base membership. Grant/revoke does not rewrite the base Trial clock.
- Membership authority is shared and server-owned. A session response cannot
  use a stale access stage after canonical authority changes.
- Repository tests do not prove receiver deployment, real CloudBase
  concurrency, device behavior, formal content approval, human audio QC, or
  launch readiness.

## Implementation hypothesis changed

- Every resumed, fresh, empty, and controlled-pilot round-completion response
  rechecks one exact Membership checkpoint after cursor acceptance: stage,
  `acknowledged_at`, base membership revision, beta-entitlement revision, and
  pilot-entitlement revision. Drift retries the full canonical read.
- Trial activation conditionally matches both the persisted selection and that
  Membership checkpoint. Its CloudBase transaction reads base membership,
  beta entitlement, and controlled-pilot entitlement before writing base Trial.
- A grant/revoke/purchase racing selection returns no activation; the scheduler
  retries and responds from the newer authority. Malformed entitlement evidence
  fails before a Trial write.
- Selection retry capacity increases from three to five bounded attempts to
  absorb the additional legitimate cursor-plus-membership convergence round.
- The old PR #492 mobile `start_membership_trial` queue is not ported: current
  remote architecture starts Trial only through the authenticated server
  learning-session boundary. Existing empty-selection behavior already leaves
  Trial unconsumed.

## Workspace boundary and read scope

- Active truth/source read: the listed specs and runtime contracts; current
  learning scheduler, Membership/CloudBase stores, beta/pilot overlay helpers,
  focused backend tests, and stale PR #492 for comparison only.
- Generated/dependency/cache/archive read: dependencies installed from tracked
  lockfiles for validation; generated node modules are not product truth.
- External workspace read: none. Card content, approvals, and audio QC in
  `/Users/lenkin/programing/card make` are not modified.

## Files changed

- `infra/cloudbase/functions/softbook-api/learning-scheduler-v1.js`: exact
  Membership checkpoint capture/recheck on every response path and checkpoint-
  bound Trial activation.
- `infra/cloudbase/functions/softbook-api/index.js`: canonical Membership
  projection helper plus memory/CloudBase conditional Trial activation; the
  CloudBase transaction reads base, beta, and pilot authority before mutation.
- Backend tests: same-millisecond revision drift, beta-grant race, strict
  controlled-pilot projection fixture, and selection-valid concurrency ordering.
- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`,
  `spec/evals.json`, and `scripts/harness_validator/sections/product_contract_mirrors.py`:
  durable authority and eval mirrors.
- `infra/cloudbase/learning-session-v1-runtime-contract.md` and
  `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`: local implementation,
  race boundary, and deployment non-claims.
- `docs/agent-runs/2026-08-22-learning-session-membership-checkpoint.md`:
  this record.

## Commands run

- `node --test test/learning-scheduler-v1.test.js test/controlled-pilot-round-v1.test.js`
  -> 22/22 passed.
- `node --test test/learning-scheduler-v1.test.js test/softbook-api.test.js`
  -> 83/83 passed after final source cleanup.
- Focused CloudBase duplicate-race regression repeated five times -> 5/5
  independent runs passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> final run 283/283
  passed.
- `python3 scripts/test_learning_scheduler_contract.py` -> 9/9 passed.
- `python3 scripts/validate_harness.py --mode local` -> passed all 15 local
  sections with `HARNESS VALIDATION OK`.
- `jq empty` for changed specs, `node --check` for changed backend modules, and
  `git diff --check` -> passed.
- `python3 scripts/validate_harness.py --mode full` -> `HARNESS VALIDATION OK`
  with the remote repository guard executed.
- `./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/learning-session-membership-checkpoint-dev.json` ->
  24/24 passed, 0 exceptions, 0 failures.
- Final PR checks: pending publication.

## Validation results

- A base Membership revision changing at the same timestamp after cursor save is
  detected by component revision, retried, and returned as premium without
  starting Trial.
- A beta grant inserted after the selected Membership checkpoint but before
  CloudBase Trial activation causes activation to return `null`; canonical
  premium remains visible and the base Trial document remains absent.
- Empty selection continues to return no card without consuming Trial; no
  client-side Trial queue or local membership authority is introduced.
- Full backend and local contract/harness regressions pass.
- Full remote-aware harness and the 24-gate local dev profile pass.
- Receiver deployment and real concurrency evidence: not run and not claimed.

## Binary evidence

- Evidence manifest: N/A. This server-runtime task creates no retained binary,
  screenshot, recording, or device evidence.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: Passed.
- Blocking findings: None.
- Review summary: verified checkpoint capture/recheck on every scheduler return
  path, selection-plus-membership conditional activation, transactional
  base/beta/pilot read ordering, base Trial non-mutation on a racing beta grant,
  bounded five-attempt convergence, exact contract/eval mirrors, and all final
  regressions. The prior timing-dependent distinct-card concurrency test was
  corrected to preserve one-current-selection authority rather than weakening it.

## User-visible UI impact

- No screen, component, layout, copy, interaction, motion, navigation, or visual
  token changes.
- A stale entitlement may now cause a bounded transparent scheduler retry before
  a session response; no new visible error or upgrade surface is added.

## Card make external workspace impact

- None. No card payload, approval, audit, audio asset, or QC record is read,
  created, or modified.

## Risks and open questions

- Repository fake-CloudBase transactions verify read/write ordering but do not
  prove receiver database isolation or retry behavior under real load.
- Deployment remains pending; `launch-readiness.v1.json` remains `not_ready`
  with no release candidate.
- Formal 1,180-card approval and 301/301 identified-human audio QC remain
  independent missing evidence.

## Follow-up

- Complete full validation, publish and merge the replacement PR, then close
  stale PR #492 as superseded by current-main server authority.
- Continue to receiver-owned preflight/deployment and real device concurrency,
  private-audio, beta-entitlement, and rollback acceptance when external profile,
  credentials, and formal content/QC evidence exist.
