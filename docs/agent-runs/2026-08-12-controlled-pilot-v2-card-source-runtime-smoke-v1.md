# Agent Run Record: controlled pilot v2 card source and candidate runtime smoke v1

## Task summary

- Date: 2026-08-12
- Branch: `module/controlled-pilot-candidate-runtime-smoke-v1`
- PR: `#500`
- Summary: Removed the production mobile card-body dependency on disabled `/v1`, fixed the real five-card event-to-round boundary, and exercised the exact approved CET4 120-card payload through the authenticated learning runtime.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Card candidate production and formal approval remain in the external `card make` workspace; this repository consumes the exact hash-bound approved payload.
- The controlled pilot contains exactly 120 approved CET4 cards with a stable 60-card free prefix and five-card server-owned rounds.
- Audio is attached to cards, not an interaction family. All 24 listening assets still require identified-human perceptual QC before bundle publication.
- Repository smoke is never deployment, device evidence, formal beta evidence or launch evidence and remains `gate_eligible=false`.

## Implementation hypothesis changed

- Added authenticated `GET /v2/learning/card-source` plus session-owned `/v2/membership` reads/mutations and moved the complete mobile remote profile to them. Development `/v1` aliases remain only for migration; non-development runtimes continue to reject every `/v1` route.
- Corrected controlled-pilot round derivation to use the containing account-and-track projection rather than requiring a non-schema `track` field on each stored event.
- Added a fail-closed candidate runtime smoke that binds the exact payload/review/approval/audit and exercises card source, five selected events, round pause/continue, Bootstrap and signed content manifest.

## Workspace boundary and read scope

- Active truth/source read: the listed specs and runtime contracts, backend/mobile implementations and tests.
- External workspace read: `/private/tmp/card-make-audio-review-station.weoJQI` and `/private/tmp/card-make-pilot-approval.1mhOrx` supplied the approved payload, review, approval and audit read-only for the real smoke.
- Generated/dependency/cache/archive read: the ignored exact candidate export was used only as an explicit smoke input. No candidate card or approval was written in this repository.

## Files changed

- `infra/cloudbase/functions/softbook-api/index.js`: authenticated v2 card-source and membership routes.
- `infra/cloudbase/functions/softbook-api/learning-scheduler-v1.js`: event-projection-compatible five-card round derivation.
- `infra/cloudbase/smoke-controlled-pilot-candidate-runtime.mjs`: exact approved-candidate runtime smoke.
- Backend tests: v2 authority, full HTTP event boundary, successful candidate smoke and tamper rejection.
- Mobile card-source and membership repositories plus affected tests: use session-owned v2 routes without client identity bodies.
- Local mock, integration smoke, active specs and runtime docs: align with the v2 production contract and simulation boundary.
- This run record.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed.
- `node --test test/card-source-v2.test.js test/controlled-pilot-round-v1.test.js test/controlled-pilot-candidate-runtime-smoke.test.js test/learning-events-v2.test.js` -> passed, 39/39.
- Targeted mobile repository/config/fallback/persistence suite -> passed, 36/36.
- Exact approved candidate runtime smoke -> passed with 120 cards, 24 audio assets, v2 entitlement/trial start, five accepted cards, round completion/continuation, next selection, Bootstrap projection and Ed25519 manifest signature.
- Full mobile suite -> passed, 46/46 suites and 497/497 tests.
- Full backend suite -> passed, 251/251 tests.
- Mobile TypeScript -> passed.
- Mobile lint -> passed with 0 errors and 25 pre-existing inline-style warnings.
- `python3 scripts/validate_harness.py` -> passed.
- `./scripts/run_local_gates --profile dev` -> `PASSED_WITH_EXCEPTION`, 23/24 passed and 0 failed; the only safe exception was dev-only Node drift (expected 22.13.0, actual 25.9.0).
- `git diff --check` -> passed.

## Exact approved candidate result

- Content version: `sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36`
- Payload SHA-256: `sha256:5f75b4ddd2e3462854d9c5dbdf9543178993356d150e23910966375fbb9feea3`
- Completed cards: `000001`, `001001`, `011301`, `012101`, `020201`
- Review cards in canonical source order: `001001`, `012101`
- Resumed next card: `022001`
- Human audio QC: not verified (0/24 formal records at run time)
- Persistent receiver: not verified
- Real device: not verified
- Gate eligible: false

## Agent review status

- Reviewer: Codex self-review under explicit user authorization
- Status: passed
- Findings resolved during review: the formal mobile profile depended on disabled v1 card-source and membership routes; five-card completion required a schema-external event field; and membership mutation identity handling was tightened so the mobile always sends an empty v2 command body.
- Remaining findings: none within this repository-change scope.

## User-visible UI impact

- No visual layout, copy, interaction silhouette or motion changed. The accepted Learning design remains the source of UI authority; this change only makes its existing remote card/session flow reachable in non-development runtimes.

## Risks and open questions

- The exact 24 audio assets still have zero formal identified-human perceptual QC records; bundle assembly remains correctly blocked.
- No independent receiver CloudBase profile/login/secrets are available, so persistent deployment and private-object download remain unverified.
- iOS/Android real-device learning and audio playback acceptance remain pending.

## Follow-up

- Complete self-review and full gates, then merge this runtime fix.
- After human audio QC is complete, assemble the exact bundle, deploy/publish/verify in an independent receiver environment, and run both-device learning acceptance.
