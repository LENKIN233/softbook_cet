# Agent Run Record: Mobile authenticated request deadlines

## Task summary

- Date: 2026-07-23
- Branch: `module/mobile-auth-request-deadlines`
- PR: pending
- Summary: Bound mobile remote authentication and authenticated protected
  fetch pipelines to 15 seconds, cancel requests and refreshes from replaced
  sessions, and preserve distinct retry semantics for timeout versus explicit
  cancellation. This record does not claim deployment, scheduling, formal
  content approval, or launch readiness.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`

## Product truth used

- Login remains required before learning and canonical account state remains
  server-authoritative.
- A timeout or cancellation never grants access, acknowledges a learning event,
  or changes formal content or product approval state.
- Durable learning events remain byte-equivalent until strict server
  acknowledgement. Daily progress and physical-space mutations retain their
  separate authorities.
- Local green results cannot become GitHub required checks, formal approval, or
  launch evidence.

## Implementation hypothesis changed

- Remote request-code, verify-code, refresh, and logout operations use one
  15-second deadline that includes response validation and parsing.
- Access-token acquisition, the first protected fetch, at most one forced
  refresh, and one retry share one 15-second observable deadline.
- The auth coordinator publishes logical session-scope changes. Replacing,
  invalidating, or restoring a session aborts the old session's in-flight token
  refresh; protected requests also abort when their captured scope changes.
- Timeout is retryable and increments retained outbox or generic queue retry
  state. Caller cancellation and session replacement retain exact queued data
  without incrementing retry state and cannot invalidate the replacement.
- Terminal 401/403 cleanup runs after the bounded request unsubscribes, so the
  request's own invalidation is not misclassified as external session
  replacement.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, auth/session/request runtime,
  learning-event and generic mutation replay, their tests, Harness mirrors, and
  the preceding mobile learning-events run record.
- Generated/dependency/cache/archive read: installed mobile dependencies and
  ignored local reports are validation inputs only and were not treated as
  product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  read or changed because this runtime resilience slice neither produces nor
  approves card content.

## Files changed

- `apps/mobile/src/runtime/remoteRequest.ts`: add the shared deadline,
  cancellation-source composition, stable lifecycle error classification, and
  cleanup isolation.
- `apps/mobile/src/auth/authRepository.ts`: bound all remote auth calls and pass
  AbortSignal through fetch and response parsing.
- `apps/mobile/src/auth/authSessionCoordinator.ts`: publish session scope and
  abort refresh work owned by invalidated or replaced sessions.
- `apps/mobile/src/auth/authenticatedFetch.ts`: apply one protected-request
  deadline across token acquisition, request, refresh, and retry; combine caller
  and session cancellation without credential crossover.
- Learning-event and generic mutation replay: keep timeout retryable while
  surfacing cancellation without mutating retry state.
- Mobile tests: cover hung token lookup, fetch, refresh and response parsing;
  caller/session abort; terminal authorization cleanup; exact queue semantics;
  and App logout/relogin while the old fetch never settles.
- Owner contracts, runtime mirror, evals, Harness mirror, and contract tests:
  make the deadline and cancellation behavior machine-verifiable.
- `docs/agent-runs/2026-07-23-mobile-auth-request-deadlines.md`: this record.

## Commands run

- Initial system-Node focused baseline: 4 suites and 30 tests passed. This was
  orientation only because system Node 25.9.0 differs from CI.
- The first hooks command was run from `apps/mobile` and failed to find the
  repository-level script. `./scripts/install_git_hooks.sh` was rerun from the
  repository root and installed `.githooks`; the failed attempt is not passing
  evidence.
- Exact Node 22.13.0 focused typecheck and six request/auth/queue suites passed,
  reaching 64 focused tests after the review regression additions. The App
  permanent-hang integration selection separately passed both account-switch
  cases without resolving the old fetch.
- Initial lint found one unused test parameter and five asynchronous assertion
  warnings; the first focused contract run also found one wrapped exact snippet,
  and the first selected Harness command used a hyphenated invalid section ID.
  All were corrected and rerun; none of those initial runs is treated as a pass.
- Review found that terminal 401/403 cleanup could trigger its own scope
  subscription and be misclassified as session replacement. Cleanup was moved
  outside the bounded subscription and a real-coordinator regression was added.
- Exact Node 22.13.0 full mobile `npm run lint` passed with 14 pre-existing
  inline-style warnings and zero errors.
- Exact Node 22.13.0 full mobile `npm run typecheck` passed.
- Exact Node 22.13.0 full mobile `npm test -- --runInBand` passed 37/37 suites
  and 309/309 tests.
- `python3 scripts/test_learning_events_contract.py` passed 13/13 tests.
- `python3 scripts/validate_harness.py --mode local --section
  product_contract_mirrors` passed with expected partial completeness.
- Exact Python 3.12.13 full local Harness passed all 15 selected local sections
  with expected partial completeness and no finding.
- Exact Python 3.12.13, Node 22.13.0, and Ruby 3.3.12
  `./scripts/run_local_gates --profile dev --output
  exports/local-gates/mobile-auth-request-deadlines-dev-final.json` passed 18/18
  with no exception, skipped or deferred result and unchanged tracked state.

## Validation results

- Focused and full mobile validation listed above passed.
- Full local Harness and exact-toolchain dev profile passed as listed above.
- Strict PR profile: pending unique pushed PR context.
- GitHub required checks: pending commit and PR.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. No screenshot, audio, generated report, or binary product
  artifact is tracked by this runtime-only change.

## Agent review status

- Reviewer: Codex
- Status: Passed for local implementation review; GitHub Agent review pending
- Blocking findings: none open. Review found and fixed a terminal-authorization
  self-cancellation race, cleanup-outcome masking risk, and a contract claim
  that was too broad for a refresh shared by same-session callers.

## User-visible UI impact

- No layout, copy, component, motion, interaction family, navigation, or visual
  token changed. Existing retry and login-expiry surfaces receive the same
  user-facing fallback copy for transport failures.

## Card make external workspace impact

- None. No payload, candidate PR, approval record, card, source, or audio asset
  changed.

## Risks and open questions

- This repository-local mobile policy is not production deployment or real
  device staging proof.
- The protected fetch deadline covers token acquisition and the fetch promise;
  domain repositories continue to own schema parsing after the response. Remote
  auth parsing is explicitly inside its deadline.
- A timed-out caller stops observing a shared refresh, while the refresh remains
  independently bounded and may still complete for the same valid session.
- Server scheduling, signed content publication, payments, Web parity, formal
  content approval, and launch gates remain pending.

## Follow-up

- Complete full Harness, exact-toolchain dev/PR gates, Agent review, and GitHub
  required checks before merge.
- After merge, start the server scheduler/FSRS boundary only from the new clean
  `origin/main`; do not treat this request policy as scheduler completion.
