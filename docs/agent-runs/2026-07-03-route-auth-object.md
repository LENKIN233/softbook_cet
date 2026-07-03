# Agent Run Record: Route auth object

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-8`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by compacting Learning, Space, and Statistics route auth gates into route-owned retained objects with an attached phone verification dock. The protected routes now keep their current object context on screen instead of reading like standalone long-form login pages.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Phone SMS is the primary login method for entering protected app state.
- Unauthenticated route gates should preserve the selected route context and return target instead of resetting the user into a generic login page.
- Learning is the core card-flow surface; Space and Statistics are route-specific support surfaces tied to the same authenticated identity.
- Account, membership, Learning state, Space state, and Statistics state are tied to the same authenticated identity.
- This run does not change authentication logic, SMS readiness, entitlement state, trial or purchase behavior, Learning, Space, Statistics, sync, or membership contracts.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `AuthGate` now distinguishes non-Mine embedded route gates with `isRouteObjectGate`.
- Learning, Space, and Statistics auth gates use a compact route-object layout with less vertical padding and a smaller title scale.
- The retained object ledger now shares the compact row grammar already used by Mine, so protected route gates read as one current object plus retained state.
- `PhoneSmsPanel` accepts a `routeDock` variant and shares the compact dock behavior with account auth while keeping route dock top and bottom dividers.
- Existing auth behavior and selectors are preserved: `auth-phone-input`, `auth-request-inline-dock`, `auth-request-code-button`, `auth-code-inline-dock`, `auth-code-input`, `auth-submit-button`, `auth-retained-ledger`, and `auth-retained-ledger-row`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, current real app auth screenshots, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, auth route Maestro screenshot flows, and iOS smoke flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: adds compact route-auth object styling and a route dock variant for the embedded phone SMS panel.
- `docs/agent-runs/artifacts/2026-07-03-route-auth-object-learning-simulator.png`: real iPhone 17 Pro simulator Learning auth screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-03-route-auth-object-code-sent-simulator.png`: real iPhone 17 Pro simulator Learning code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-03-route-auth-object-space-simulator.png`: real iPhone 17 Pro simulator Space auth screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-03-route-auth-object-statistics-simulator.png`: real iPhone 17 Pro simulator Statistics auth screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app Learning auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app Learning code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed current real app Space auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed current real app Statistics auth screenshot.
- `docs/agent-runs/2026-07-03-route-auth-object.md`: this run record.

## Commands run

- `npx prettier --write App.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-auth-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-auth-code-sent-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-auth-space-gate-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot <artifact>` -> passed for all four route auth screenshot artifacts.
- `cp docs/agent-runs/artifacts/2026-07-03-route-auth-object-*-simulator.png docs/design/app-screenshots/current-real-app/*.png` -> passed for all four current real app route auth screenshots.
- `sips -g pixelWidth -g pixelHeight <four route auth artifacts and four current screenshots>` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_route_auth_object_pr_body.md --changed-file apps/mobile/App.tsx --changed-file docs/agent-runs/2026-07-03-route-auth-object.md --changed-file docs/agent-runs/artifacts/2026-07-03-route-auth-object-learning-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-route-auth-object-code-sent-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-route-auth-object-space-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-route-auth-object-statistics-simulator.png --changed-file docs/design/app-screenshots/current-real-app/auth.png --changed-file docs/design/app-screenshots/current-real-app/auth-code-sent.png --changed-file docs/design/app-screenshots/current-real-app/auth-space.png --changed-file docs/design/app-screenshots/current-real-app/auth-statistics.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_route_auth_object_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Four route-auth screenshot flows: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-route-auth-object-learning-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-route-auth-object-code-sent-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-route-auth-object-space-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-route-auth-object-statistics-simulator.png`

## Design review checklist

- Q1 Law of One: Route auth gates keep one quiet retained-object accent and reuse the same app/account verification grammar; no competing achievement, paywall, or decorative color layer is introduced.
- Q2 Focal object: First-read path is route title -> retained route object -> phone verification dock -> floating chrome.
- Q3 Silhouette: Learning, Space, and Statistics auth gates now match the one-screen route-object silhouette instead of a long standalone login page.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or paywall-first chrome appears in refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the route title, retained object, ledger values, phone input, code input, request/resend/submit controls, and floating tab bar fit without clipped text, awkward one-character title wrapping, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Phone SMS remains the only login method touched here. Learning, Space, and Statistics keep their route-specific return targets, and this run does not alter Learning sequencing, flip self-assess, Statistics numbers, Space hierarchy, membership, purchase, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, four screenshot flows, strict iOS smoke, focused and full Jest, typecheck, lint, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Learning, Space, and Statistics logged-out/code-sent auth gates now read as route-owned retained objects with attached phone verification.
- The route context remains visible and the phone verification path is still clear, but the screen no longer behaves like a generic long-form page.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: route auth object -> `apps/mobile/App.tsx` / `AuthGate` / `isRouteObjectGate`; retained object -> `authRetainedLedger` and compact ledger row styles; phone verification dock -> `PhoneSmsPanel` / `routeDock` / `auth-request-inline-dock` / `auth-code-inline-dock`; screenshot evidence -> current real app auth, auth-code-sent, auth-space, and auth-statistics screenshots.
- Screenshot evidence mapping: four `docs/agent-runs/artifacts/2026-07-03-route-auth-object-*-simulator.png` files -> four refreshed `docs/design/app-screenshots/current-real-app/auth*.png` screenshots.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing phone input, request-code, resend, and submit handlers are reused.
- Physical-space source: N/A; this run preserves the Space return target and does not change Space physical model or operations.
- Unimplemented gap: Light-mode phone route auth and code-sent states are covered. Dark mode, tablet containment, small-phone containment, remote auth error states, and post-trial/premium Mine variants remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The implementation intentionally keeps auth behavior stable and changes only embedded visual density and dock styling.
- Smaller phones and dark mode should still be covered in follow-up quality passes.

## Follow-up

- Continue user-visible quality passes on dark/tablet/small-phone containment, remote auth error states, and remaining account/membership variants not yet represented by current real-app screenshots.
