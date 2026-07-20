# Agent Run Record: production auth v2 foundation

## Task summary

- Date: 2026-07-20
- Branch: `module/production-auth-v2-foundation`
- PR: https://github.com/LENKIN233/softbook_cet/pull/429
- Trigger: Continue the product launch path after repository and Harness health
  work; the active backend still used a fixed SMS code and a 30-day stateless
  development token.
- Summary: Add a server-backed `/v2` authentication foundation with persistent
  SMS challenges, abuse limits, short-lived access tokens, rotating refresh
  tokens, revocation, and queued account deletion while preserving the current
  `/v1` development client contract.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Phone-code login is required before learning; there is no guest learning
  path.
- Account, learning, physical-space, and membership state are
  server-authoritative and must resume across devices.
- Authentication must be revocable, logout must clear access, and account
  deletion must be available in the product.
- Local tests and green CI cannot create formal content approval or launch
  readiness.

## Implementation hypothesis changed

- Added `/v2/auth/request-code`, `/v2/auth/verify-code`,
  `/v2/auth/refresh`, `/v2/auth/logout`, and `/v2/account/deletion` as the
  current server migration interface.
- SMS challenges are one-time, expire after five minutes, lock after five bad
  attempts, and use persistent per-phone and per-IP ten-minute limits.
- Access tokens expire after 15 minutes. Refresh tokens expire after 30 days,
  rotate on every use, and revoke the session when any cryptographically valid
  older rotation is replayed.
- Raw SMS codes and refresh tokens are never persisted. Rate-limit and account
  lookup keys use a separate HMAC index secret so signing-key rotation does not
  break durable account references.
- Production mode disables `/v1` and refuses weak/missing secrets, memory
  storage, the development SMS provider, or request-code calls without a
  trusted gateway source IP.
- Account deletion is currently a durable queued task plus immediate
  account-wide session revocation. It is not yet completed data erasure.

## Workspace boundary and read scope

- Active source read: the referenced specs, launch-readiness manifest,
  CloudBase function/store/tests, runtime handoff, provisioning script, and
  recent Agent run record format.
- Generated/dependency/cache read: none used as product truth.
- Remote read: none required for implementation; GitHub delivery is performed
  after local validation.
- External workspace read: none. `/Users/lenkin/programing/card make` remains
  outside this backend-only change.

## Files changed

- `infra/cloudbase/functions/softbook-api/auth-v2.js`: v2 authentication
  service, token handling, and production configuration checks.
- `infra/cloudbase/functions/softbook-api/auth-v2-store.js`: memory and
  CloudBase atomic auth-state adapters.
- `infra/cloudbase/functions/softbook-api/index.js`: versioned routes, trusted
  gateway IP extraction, production v1 shutdown, and store integration.
- `infra/cloudbase/functions/softbook-api/test/auth-v2.test.js`: positive,
  negative, expiry, replay, persistence, deletion, and fail-closed tests.
- `infra/cloudbase/provision-softbook-nosql.mjs`: provision auth challenge,
  rate-limit, session, and deletion collections.
- `infra/cloudbase/auth-v2-runtime-contract.md`: implementation contract and
  explicit production gaps.
- `infra/cloudbase/mobile-runtime-contract.md`: record that mobile remains on
  `/v1` pending a separate migration.
- `infra/cloudbase/README.md`: expose the v2 foundation and development
  configuration.
- `docs/agent-runs/2026-07-20-production-auth-v2-foundation.md`: this record.

## Commands run

- `node --check auth-v2.js && node --check index.js` -> passed.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> 26/26 tests
  passed after the final security corrections; the original 15 `/v1` tests
  remain green.
- `npx --yes node@22.13.0 --test test/*.test.js` in the backend function ->
  26/26 passed on the exact CI Node version.
- `git diff --check` -> passed.
- `scripts/run_local_gates --profile dev --verbose` ->
  `passed_with_exception`, 16/17 passed and 0 failed. The only exception is the
  allowed development-only Node 25.9.0 drift from CI Node 22.13.0; the focused
  backend suite was separately rerun on exact Node 22.13.0.
- Strict PR profile and GitHub required checks -> pending PR creation.

## Validation results

- Challenge responses and persisted records do not expose SMS codes.
- Refresh-token storage contains only SHA-256 hashes; valid older rotations are
  detectable without retaining raw token history.
- A saturated IP no longer consumes a victim phone's request quota.
- HMAC-keyed rate/account indexes do not expose enumerable bare phone hashes.
- Account deletion is idempotent, revokes all account sessions, and blocks new
  session creation in the same persistence boundary.
- Separate CloudBase function instances can verify a challenge and rotate the
  resulting session through shared persistent state.
- Production construction and request handling fail closed for the tested
  unsafe configurations.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. No screenshot, audio, report, or binary product artifact is
  created by this backend change.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None after correction.
- Review summary: Initial review found and fixed phone-quota consumption after
  IP rejection, enumerable account/rate indexes, signing-key coupling for
  durable account indexes, and a deletion/login race. Focused regression tests
  now cover each corrected boundary. Remaining production dependencies are
  explicitly blocked rather than represented as completed.

## User-visible UI impact

- N/A. No screen, copy, interaction, motion, accessibility behavior, or design
  authority changes.

## Card make external workspace impact

- N/A. No card payload, source, review, approval, import, or audio state changes.

## Risks and open questions

- No Tencent Cloud SMS adapter is wired, so production mode cannot start through
  environment configuration alone yet.
- Signing-key key-ring rotation is not implemented; changing the current token
  secret invalidates existing sessions even though durable account indexes
  remain stable.
- CloudBase TTL policies, least-privilege collection rules, deletion worker,
  provider cleanup, and deletion completion evidence remain outstanding.
- Device metadata is stored, but device-list and remote-device-revocation APIs
  are not implemented.
- Mobile still stores and consumes the `/v1` auth token. Secure refresh-token
  storage and `/v2` adoption are the next client slice.
- `production-auth-and-account-deletion` in launch readiness remains `blocked`;
  this local implementation does not add evidence to that gate.

## Follow-up

- Run the complete local `dev` profile, create the PR, run the strict `pr`
  profile and required GitHub checks, then merge only after all delivery gates
  pass.
- Next product PR: migrate mobile auth persistence and repositories to the v2
  challenge/session contract without enabling production fallback.
