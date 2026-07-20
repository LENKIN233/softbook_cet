# Agent Run Record: mobile auth v2 adoption

## Task summary

- Date: 2026-07-20
- Branch: `cross/mobile-auth-v2-adoption`
- PR: pending
- Trigger: Continue the production launch path after the server-backed v2 auth
  foundation merged in PR #429.
- Summary: Migrate the mobile runtime from the legacy `/v1` auth token to the
  challenge-bound `/v2` session contract, persist rotating credentials only in
  secure storage, inject current access credentials into protected requests,
  remove credential-bearing queue persistence, and fail closed when remote
  content is unavailable.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- Phone-code login is required before learning; there is no guest learning
  path.
- Account, learning, physical-space, and membership state are
  server-authoritative and must resume across devices.
- Authentication must be revocable. Logout and authorization rejection must
  remove account-bound local access.
- Bundled development cards cannot substitute for unavailable production
  content.
- Local or CI validation cannot create formal content approval or launch
  readiness.

## Implementation hypothesis changed

- Mobile auth now uses `/v2/auth/request-code`, `/verify-code`, `/refresh`, and
  `/logout`, with phone-bound one-time challenges and a discriminated local or
  remote session model.
- Remote sessions persist the access token, rotating refresh token, expiries,
  session ID, and token type under `auth-session.v2` in Keychain or Keystore.
  The non-sensitive revocation tombstone remains in AsyncStorage.
- `auth-session.v1` is invalidated instead of upgraded because it has no refresh
  credential.
- A session coordinator serializes secure-store transitions, shares concurrent
  refresh demand, persists a complete rotated pair before exposing it, and
  prevents late refresh completion or rejection from changing a replacement
  session.
- Protected repositories use an authenticated fetch wrapper that injects the
  current access token, refreshes once after HTTP 401, and invalidates the
  session after repeated 401 or any 403.
- Mutation payloads and identifiers persist no credentials. Legacy membership
  retry IDs that embedded a token or phone number are normalized during
  hydration; replay receives the current access token only in memory.
- Development `/v1` product-data routes accept active v2 sessions as a bounded
  migration bridge. Production still rejects every `/v1` route with HTTP 410.
- Remote card-source failure uses the existing retry state and never falls back
  to bundled development cards.

## Workspace boundary and read scope

- Active source read: the referenced specs, mobile auth/persistence/runtime
  repositories and tests, CloudBase v2 auth contract, development v1 bridge,
  mock/smoke scripts, metadata guards, and recent Agent run records.
- Generated/dependency/cache read: local gate reports were used only as
  validation output and remain ignored; no generated file was used as product
  truth.
- Remote read: GitHub delivery metadata only after local validation.
- External workspace read: none. `/Users/lenkin/programing/card make` remains
  outside this runtime change.

## Files changed

- `apps/mobile/src/auth/`: v2 challenge/session types, repository endpoints and
  parsing, session coordinator, and authenticated fetch wrapper.
- `apps/mobile/src/persistence/authSessionStore.ts`: secure `auth-session.v2`
  persistence, legacy invalidation, and durable dual-path cleanup.
- `apps/mobile/src/sync/mutationQueue.ts`: credential-free payload hydration,
  legacy ID normalization, detached copies, and nested credential rejection.
- `apps/mobile/App.tsx`: coordinator lifecycle, secure restore/logout,
  authenticated repository injection, challenge-bound login, safe queue IDs,
  and complete local cleanup after remote logout failure.
- `apps/mobile/src/learning/learningRuntimeConfig.ts`: remote card-source errors
  now fail closed.
- Mobile unit/integration tests and Keychain mock: v2 fixtures, refresh races,
  401/403 retry behavior, persistence corruption, logout failures, queue
  migration, and fail-closed content coverage.
- CloudBase function, mock, smoke, and content-gap scripts: active v2 sessions
  can exercise development product routes, refresh rotation, and logout.
- Runtime contracts and metadata guards: document and scan the new auth fields
  without changing product vocabulary or formal approval state.
- `docs/agent-runs/2026-07-20-mobile-auth-v2-adoption.md`: this record.

## Commands run

- `npx tsc --noEmit` in `apps/mobile` -> passed.
- `npm run lint` in `apps/mobile` -> passed with 14 pre-existing inline-style
  warnings and zero errors.
- `npm test -- --runInBand --silent` in `apps/mobile` -> 31/31 suites and
  209/209 tests passed.
- Exact Node 22.13.0 TypeScript and Jest invocations -> passed with 31/31 suites
  and 209/209 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 29/29 passed on the
  system runtime and exact Node 22.13.0.
- `python3 scripts/validate_harness.py --mode local` -> passed with expected
  local-mode partial completeness.
- Mobile and design metadata leak scans -> passed.
- Local mock v2 auth/product smoke on Node 22.13.0 -> request, verify, refresh,
  protected reads/writes, membership mutations, and logout all passed.
- Exact Node 22.13.0 and Ruby 3.3.12
  `scripts/run_local_gates --profile dev` -> 17/17 passed.
- `git diff --check` -> passed.
- Strict PR profile and GitHub required checks -> pending PR creation.

## Validation results

- Access and refresh credentials round-trip only through secure storage; old v1
  sessions and malformed payloads degrade to logged out.
- Concurrent access requests use one refresh operation and one rotating token.
  Late completion or rejection from an old session cannot erase or resurrect a
  replacement session.
- Refresh rejection, repeated 401, and 403 invalidate account-bound state.
  Temporary network failure can retain a still-valid access token for offline
  use.
- Logout attempts server revocation and still clears secure auth, user state,
  and queued mutations when the server is unavailable.
- Persisted mutation payloads and IDs contain no access or refresh credentials,
  including after hydration of the prior token-based membership ID format.
- Remote content failure renders the existing retry state without exposing the
  bundled five-card development source.
- Production `/v1` remains unavailable; the compatibility bridge is covered as
  development-only and revocation-aware.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. No screenshot, audio, report, or binary product artifact is
  created by this runtime change.

## Agent review status

- Reviewer: Codex
- Status: Pending final PR gates
- Blocking findings: None open locally.
- Review summary: Review found and corrected two session-replacement races, a
  split UI/memory logout state after storage failure, and legacy mutation IDs
  that could retain or log a token or phone number. Focused regressions cover
  each correction. Final status remains pending until strict PR validation and
  GitHub required checks run on the published head.

## User-visible UI impact

- No new screen, component, copy, motion, or visual token is introduced.
- Remote content failure now uses the already accepted learning retry state
  instead of silently presenting bundled development cards. This is a runtime
  authority correction using existing UI, not a new design artifact.

## Card make external workspace impact

- N/A. No card payload, source, review, approval, import, or audio state changes.

## Risks and open questions

- Product-data routes still use a development-only `/v1` bridge. Production
  cannot serve the mobile product until canonical `/v2` bootstrap, learning,
  membership, progress, and space interfaces replace it.
- Tencent Cloud SMS, production secrets, device-list/remote-revocation APIs,
  deletion completion workers, and provider cleanup remain unimplemented.
- The current client has no account-deletion UI integration and no production
  payment entitlement flow.
- The strict PR remote profile still needs to run against the real PR context
  before merge.
- This change does not alter formal card approval, audio QC, content completeness,
  or launch-readiness state.

## Follow-up

- Publish the branch, run strict PR gates against the real PR context, complete
  Agent review, and merge only after all required GitHub checks pass.
- Next product slice: replace the development v1 data bridge with a canonical
  `/v2/bootstrap` and server-authoritative product read contract.
