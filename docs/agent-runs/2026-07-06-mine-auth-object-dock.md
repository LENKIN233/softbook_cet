# Agent Run Record: Mine auth object dock

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-02`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by refining the signed-out Mine and shared auth gate states. Mine now presents SMS login as an account-continuity object with records, space, and entitlement retained, while the phone/code controls are attached as a compact dock instead of reading as a separate form page.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Authentication is required before learning starts, and phone SMS code remains the primary login method.
- Mine is account/profile/membership support. It must not become a settings dashboard, a paywall-first screen, or the product center.
- Account, learning state, physical space state, and membership entitlement must be presented as one continuity story where appropriate.
- Learning, Space, and Statistics auth gates must remain attached to the selected object and return target rather than becoming generic login pages.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `AuthGate` Mine copy now treats signed-out state as account continuity: records retained, space retained, entitlement pending or verifying.
- `PhoneSmsPanel` places the dock status above the input/action row so the user first sees the task object, then the operation.
- Mine SMS request/code-sent docks keep the same stable selectors but use tighter spacing and lower-weight retained-state chips.
- Protected Learning/Space/Statistics gate states inherit the shared dock order; behavior and route return targets are unchanged.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, design harness, canon, prior Mine auth run records, current real app screenshots, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines Mine auth continuity copy, shared SMS dock order, Mine dock spacing, and account retained-state chips while preserving selectors and auth behavior.
- `apps/mobile/__tests__/App.test.tsx`: updates Mine signed-out assertions to the new account-continuity language.
- `docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-learning-real-app.png`: real iPhone 17 Pro simulator Learning auth gate evidence.
- `docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-code-sent-real-app.png`: real iPhone 17 Pro simulator Learning code-sent auth gate evidence.
- `docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-space-real-app.png`: real iPhone 17 Pro simulator Space auth gate evidence.
- `docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-statistics-real-app.png`: real iPhone 17 Pro simulator Statistics auth gate evidence.
- `docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/mine-signed-out-real-app.png`: real iPhone 17 Pro simulator Mine signed-out evidence.
- `docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/mine-code-sent-real-app.png`: real iPhone 17 Pro simulator Mine code-sent evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed current real app screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed current real app screenshot.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app screenshot.
- `docs/agent-runs/2026-07-06-mine-auth-object-dock.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `mkdir -p docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/mine-signed-out-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/mine-code-sent-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-learning-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-code-sent-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-space-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/auth-statistics-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-06-mine-auth-object-dock/*.png docs/design/app-screenshots/current-real-app/...` -> passed through explicit per-file copies.
- `sips -g pixelWidth -g pixelHeight ...` -> passed, all artifact and current screenshot files are 1206 x 2622.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `env JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_auth_object_dock_pr_body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_auth_object_dock_pr_body.md --changed-file ...` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Whitespace diff check: pass.
- Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Learning auth screenshot flow: pass on iPhone 17 Pro simulator.
- Learning auth code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Space auth gate screenshot flow: pass on iPhone 17 Pro simulator.
- Statistics auth gate screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, all evidence and current screenshots are 1206 x 2622.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Harness validation with remote guard skipped: pass.
- Maestro selector validation: pass.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.

## Design review checklist

- Q1 Law of One: Mine auth uses the neutral account accent only. It does not introduce a second library color, feedback color, reward color, or paywall-first palette.
- Q2 Focal object: Mine signed-out first-read path is route title -> account object -> retained record/space/entitlement chips -> SMS dock -> floating chrome. Learning, Space, and Statistics gates keep their selected object as the focal object.
- Q3 Silhouette: Mine auth reads as an account object with an attached SMS dock, not a separate login form page. Learning, Space, and Statistics gates remain object gates rather than generic authentication pages.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or paywall-first chrome appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm account gate, SMS input/code docks, retained-state chips, route headers, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine keeps account and membership support subordinate to Learning. The pass does not alter Learning sequencing, flip self-assess, Statistics tabular number treatment, Space hierarchy, auth semantics, purchase, membership, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Auth/Mine visible text was inspected in real screenshots; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed local code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, auth/Mine screenshot flows, iOS smoke flow, and PR body gates.
- Blocking findings: none.

## User-visible UI impact

- Yes. Mine signed-out and code-sent states now read as app-level account continuity instead of a stacked form card.
- Learning, Space, and Statistics auth gates inherit a clearer dock order: task/state first, phone/code operation second.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object -> `AuthGate` with `cardTestID="mine-profile-card"`; retained account chips -> `auth-retained-ledger` and `auth-retained-ledger-row`; SMS request dock -> `auth-request-inline-dock`, `auth-phone-input`, `auth-request-code-button`; SMS code dock -> `auth-code-inline-dock`, `auth-code-input`, `auth-submit-button`; protected route gates -> shared `AuthGate` route object states; screenshot evidence -> refreshed current real app auth and Mine screenshots.
- Screenshot evidence mapping:
  - `auth-learning-real-app.png` -> `docs/design/app-screenshots/current-real-app/auth.png`
  - `auth-code-sent-real-app.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `auth-space-real-app.png` -> `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `auth-statistics-real-app.png` -> `docs/design/app-screenshots/current-real-app/auth-statistics.png`
  - `mine-signed-out-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `mine-code-sent-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added.
- Physical-space source: N/A; Space auth gate preserves the existing object gate and does not alter Space hierarchy.
- Learning microcopy basis: no card content, candidate content, or Learning interaction explanation changed. Shared auth return text remains based on the existing route return target.
- Unimplemented gap: This pass covers light-mode phone auth/Mine gate states. Dark-mode auth/Mine gates, tablet containment, and signed-in Mine variants remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- `PhoneSmsPanel` is shared, so broad screenshots were refreshed for Learning, Space, Statistics, and Mine auth gates.
- Auth gates still intentionally remain access gates, not full learning/content surfaces. Future passes can refine vertical placement and dark/tablet containment.

## Follow-up

- Open PR, wait for required checks, merge, and fast-forward `/Users/lenkin/programing/softbook_cet_design_quarantine`.
