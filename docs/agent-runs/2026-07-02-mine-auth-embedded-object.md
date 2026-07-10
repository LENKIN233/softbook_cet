# Agent Run Record: Mine auth embedded object

## Task summary

- Date: 2026-07-02
- Branch: `codex/fix/mobile-quality-next-pass`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by embedding Mine signed-out SMS verification into the Mine account object. Mine no longer renders an account card followed by a second standalone auth form card; the phone verification layer now lives inside `mine-profile-card` for both initial request and code-sent states.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine is the account and membership continuity surface. Signed-out Mine should still be a coherent account object, not a standalone onboarding page.
- Auth is an attached gate for the current product object. On Mine, the current object is the account/passport object.
- SMS verification remains the account-auth mechanism. This run does not change auth repository behavior, code validation, membership entitlement, runtime sync, or protected-route access rules.
- The mobile app grammar is current object -> attached state/action -> floating chrome. It should avoid a page made of unrelated stacked form cards.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `MineSurface` renders `PhoneSmsPanel` inside `mineProfilePanel` when the user is not authenticated.
- The embedded panel removes the standalone auth card border/shadow and keeps request/code-sent states as layers inside the Mine account object.
- Existing auth test IDs and handlers are preserved: `auth-phone-input`, `auth-request-code-button`, `auth-code-inline-dock`, `auth-code-input`, and `auth-submit-button`.
- App tests now assert that Mine signed-out request and code-sent auth controls are descendants of `mine-profile-card`.
- Real Mine signed-out and Mine code-sent screenshots were refreshed from the iPhone 17 Pro simulator.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Mine/Auth run records, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Mine Maestro screenshot flows, strict iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: moves signed-out Mine `PhoneSmsPanel` into `mineProfilePanel` with `embedded` enabled.
- `apps/mobile/__tests__/App.test.tsx`: asserts Mine signed-out request and code-sent auth controls are nested inside `mine-profile-card`.
- `docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-signed-out-simulator.png`: real iPhone 17 Pro simulator Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-code-sent-simulator.png`: real iPhone 17 Pro simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-02-mine-auth-embedded-object.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-signed-out-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-signed-out-simulator.png docs/design/app-screenshots/current-real-app/mine-signed-out.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-code-sent-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-code-sent-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-signed-out-simulator.png docs/design/app-screenshots/current-real-app/mine-signed-out.png docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-code-sent-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-signed-out-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-code-sent-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: Mine signed-out and code-sent states now keep one account object grammar. The verification layer no longer introduces a second card system below the account card.
- Q2 Focal object: First-read path is Mine route title -> account/passport object -> identity band -> embedded phone verification -> floating chrome.
- Q3 Silhouette: The change preserves the accepted mobile object silhouette and removes the previous stacked object plus standalone auth form silhouette from signed-out Mine.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the account header, identity band, embedded phone field, request/code dock, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine preserves account/member continuity and SMS verification. The change does not alter Learning sequencing, Space hierarchy, Statistics behavior, membership access, protected-route gates, or flip self-assess semantics.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Mine screenshot flows, strict iOS smoke, typecheck, lint, focused and full Jest, metadata scans, selector validation, API tests, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Mine signed-out now reads like one account object with attached SMS verification instead of a page assembled from an account card plus a separate form card.
- The same object unification applies to the Mine code-sent verification state.
- The auth behavior and stable test IDs remain unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object -> `apps/mobile/App.tsx` `MineSurface`; shared phone verification panel -> `PhoneSmsPanel`; embedded auth state -> `mine-profile-card` descendant; screenshot evidence -> current real app Mine screenshots.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-signed-out-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`; `docs/agent-runs/artifacts/2026-07-02-mine-auth-embedded-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. The request and submit actions still call existing Auth handlers.
- Learning microcopy basis: no Learning UI copy changed. Mine auth copy remains account-continuity copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone screenshots cover Mine signed-out and code-sent states. Dark mode, tablet containment, and input-ready Mine request screenshot evidence remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The refactor keeps shared Auth handlers and stable test IDs, reducing behavior risk.
- The code-sent state is screenshot-verified after embedding; enabled submit behavior remains covered by App tests and strict iOS smoke.

## Follow-up

- Continue quality passes on dark/tablet containment, input-ready auth screenshots, and the next weakest one-screen surface.
