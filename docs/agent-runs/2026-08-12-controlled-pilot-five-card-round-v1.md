# Agent Run Record: controlled pilot five-card round

## Task summary

- Date: 2026-08-12
- Branch: `infra/controlled-pilot-round-gate-v1`
- PR: `https://github.com/LENKIN233/softbook_cet/pull/498`
- Summary: Implement the controlled-pilot five-card server gate end to end: canonical completion receipt, exact idempotent continuation, persistent CloudBase acknowledgement, strict mobile parsing, and one accepted completion-state action.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`

## Product truth used

- Learning remains a server-selected single-card stream; a five-card boundary is a controlled-pilot gate, not a client counter or a new product dashboard.
- The boundary count is the canonical account-and-track learning projection's positive multiple-of-five `server_sequence`. Daily progress is not round authority.
- While a boundary is unacknowledged, the server exposes no next selection, persists no next cursor, and returns one deterministic receipt with the exact boundary card and ordered review-card IDs.
- Only the exact authenticated continuation command may acknowledge a receipt. Replay is idempotent; account, pilot, content, count, or receipt drift fails closed.
- This repository implementation and every controlled-pilot artifact remain `gate_eligible=false`; they do not approve content or constitute formal launch evidence.

## Implementation hypothesis changed

- Added `pilot-round-completion.v1`, `pilot-round-continue.v1`, and `pilot-round-continue-ack.v1` runtime bindings under `controlled_pilot` only.
- Added `softbook_pilot_round_continuations` as a persistent account/track/count acknowledgement store, including receiver provisioning, preflight identity, and lifecycle-smoke coverage.
- Added exact `POST /v2/learning/round/continue`; the server rederives canonical state instead of trusting the mobile receipt.
- Added strict mobile receipt and acknowledgement parsing, canonical accessible-card/order verification, and account-scope protection around continuation.
- Reused the accepted Learning completion silhouette for one “继续下一轮” action and compact actual Space address; no new visual system or interaction family was introduced.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, runtime contracts, accepted design artifacts, backend/mobile implementation, tests, and current PR/run-record context.
- Generated/dependency/cache/archive read: lockfile-installed mobile and backend dependencies only for validation; no archive was used as product truth.
- External workspace read: the current 120-card handoff was regenerated from the card-make workspace after card-make PR #154. The user subsequently approved the exact `dd2d3975...` version and card-make PR #155 recorded the canonical aggregate review and `controlled-pilot-approval.v1` artifact. No content or audio-QC artifact is copied into this repository.

## Files changed

- `infra/cloudbase/functions/softbook-api/learning-scheduler-v1.js`: derive and enforce the canonical five-card boundary and exact acknowledgement.
- `infra/cloudbase/functions/softbook-api/index.js`: expose the controlled-pilot-only route and persistent memory/CloudBase continuation adapters.
- CloudBase provisioning, deployment-safety, lifecycle and README files: register the continuation collection and operational boundary.
- Controlled-pilot, Learning Session, mobile runtime contracts, and `spec/runtime-boundaries.json`: record repository implementation and remaining undeployed work.
- Mobile Learning model, remote session/repository, `LearningSurface`, and `App.tsx`: strictly consume the receipt and reuse the accepted completion surface.
- Backend and mobile tests: cover boundary authority, formal-runtime isolation, drift, idempotency, cross-instance persistence, strict parsing, canonical order, UI action, and account-scoped continuation.

## Commands run

- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint` in `apps/mobile` -> passed with 0 errors and 25 pre-existing inline-style warnings.
- Focused mobile Jest run for remote session, repository, Learning surface, App, and persistence -> 5 suites / 133 tests passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 244/244 passed, including the cross-instance persistence assertion.
- Focused backend round and API run after `_id` normalization -> 60/60 passed, including separate CloudBase instances and exact replay.
- Full mobile Jest run -> 46 suites / 497 tests passed.
- `python3 scripts/test_learning_scheduler_contract.py` -> 9/9 passed.
- `python3 scripts/validate_harness.py --mode local` -> passed after installing repository hooks in this worktree.
- `python3 scripts/validate_harness.py` -> full harness validation passed before PR creation.
- `git diff --check` -> passed.
- Current real-candidate consumer smoke -> 120 cards, stable 60-card free boundary `012106` / `000007`, 24 audio assets, content version `sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36`; controlled-pilot accepted, production and expiry rejected, learner-visible internal-production phrasing 0, corrected lock and analysis mirrors present.

## Validation results

- Server pauses exactly at an unacknowledged positive multiple of five and does not persist the next cursor.
- Receipt identity is deterministic; exact continuation replay is idempotent; drift and extra fields fail closed.
- Development/production do not expose or apply the controlled-pilot gate.
- CloudBase reads and exact replays remove the database `_id` metadata before business-schema validation and survive separate store instances.
- Mobile rejects conflicting, malformed, inaccessible, duplicate, or reordered receipt content and reloads Learning only after an exact acknowledgement.
- UI completion state has one canonical continuation action and preserves retry/error state without leaking implementation metadata.
- The server-controlled round gate consumes the current regenerated candidate content identity without hard-coding the previous candidate hash; content changes continue to invalidate receipts through the existing content-version binding.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex pre-PR review; protected Agent review pending
- Status: local review passed; remote review pending
- Blocking findings: none locally; protected review and CI have not run on the PR head.

## User-visible UI impact

- Design source: the accepted mobile core surface reset and Learning card rhythm listed above.
- Implementation mapping: the existing `LearningSurface` completion state remains the focal object; the pilot receipt supplies `5/5`, review count, actual library/group/box address, pending/error state, and exactly one continuation action.
- Unimplemented gap: real iOS/Android device evidence remains pending until a receiver-owned controlled-pilot profile and deployment exist.
- Q1: the boundary card's actual library is current, and its existing library tone is the single strong accent.
- Q2: the completion card is focal; result summary and Space address are secondary; surrounding chrome remains tertiary.
- Q3: the screen keeps the canonical Learning completion silhouette and introduces no new card type.
- Q4: no forbidden design pattern, gamification chrome, gradient text, new serif, or self-assess token change is introduced.
- Q5: no new outer layout or fixed-width element was added; the existing safe-area and constrained-viewport containment remain in force. Real-device confirmation is still pending.
- Q6: Learning does not expose module selection; flip remains exactly the existing two self-assess choices (`有把握` / `再回看`).

## Card make external workspace impact

- Card-make PR #154 merged the final learner-facing card corrections. Card-make PR #155 then recorded the user's explicit approval for the exact 120-card `dd2d3975...` controlled-pilot scope. No audio-QC artifact or export payload was produced or modified by this product PR.

## Risks and open questions

- The exact 120-card content version is user-approved in card-make PR #155 and remains bound to `controlled-pilot-approval.v1`; any card change invalidates that identity and requires a new approval.
- The 24 referenced audio assets still need human perceptual QC.
- Receiver-owned `pilot_id`, profile, secrets, entitlement operation, exact 120-hour trial, deletion-worker execution, deployment, and real-device evidence remain pending.
- The base publication PR #497 passed protected product-owner approval and merged as `bb8a7ee`; this PR has been rebased onto that current `main`.

## Follow-up

- Complete PR review and CI for this change; after human audio approval and receiver configuration, build the exact bound bundle from the already approved content, deploy to the independent receiver, grant pilot entitlement, and run real iOS/Android five-card continuation plus private-audio smoke.
