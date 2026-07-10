# Agent Run Record: Auth identity capsule compression

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-10`
- PR: https://github.com/LENKIN233/softbook_cet/pull/335
- Summary: Continued the mobile quality reset by reshaping signed-out Auth and Mine gates from form-like stacked pages into compact identity capsules attached to the current learning, space, statistics, or account object. The run refreshes all affected real simulator screenshots for Auth, Auth code-sent, Space gate, Statistics gate, Mine signed-out, and Mine code-sent states.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Login is required before learning; guest learning before authentication is not allowed.
- Primary login method remains phone + SMS code.
- Learning state, physical space state, and membership entitlement remain account-bound sync concerns.
- Mine is an account object supporting the learning flow, not a separate settings center.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- Auth gates now treat verification as an identity capsule attached to the current object, rather than a separate phone form section.
- All protected route gates use the compact object grammar: current object, retained state rail, inline phone/code action, and floating app chrome.
- Mine signed-out and code-sent states use the same identity capsule vocabulary as route gates, so account verification feels like one app flow instead of a settings/login page.
- The vertical retained-state accent was reduced to a small status dot to avoid reference-line or wireframe-like visuals.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, current real app screenshots, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and affected Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro output were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: compresses Auth/Mine signed-out and code-sent UI into identity capsules and attached input/code docks while preserving auth behavior and selectors.
- `apps/mobile/__tests__/App.test.tsx`: updates expectations to the new account-object and return-continuity language.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-simulator.png`: real iPhone 17 Pro simulator Auth screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-code-sent-simulator.png`: real Auth code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-space-simulator.png`: real Space gate screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-statistics-simulator.png`: real Statistics gate screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-mine-signed-out-simulator.png`: real Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-mine-code-sent-simulator.png`: real Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app Auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app Auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed current real app Space gate screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed current real app Statistics gate screenshot.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-04-auth-identity-capsule-compression.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `xcrun simctl io booted screenshot ...` for all six affected states -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-*.png docs/design/app-screenshots/current-real-app/...` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/{auth.png,auth-code-sent.png,auth-space.png,auth-statistics.png,mine-signed-out.png,mine-code-sent.png}` -> passed, each 1206 x 2622.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_identity_capsule_pr_body.md ...` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_identity_capsule_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Maestro selector validation for four directly touched auth/mine screenshot flows: pass.
- Auth/Mine/Space/Statistics gated screenshot flows: pass on iPhone 17 Pro simulator.
- Mobile lint: pass.
- Design artifact metadata leak scan: pass.
- Full Maestro selector validation: pass.
- Whitespace diff check: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-code-sent-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-space-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-statistics-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-mine-signed-out-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-mine-code-sent-simulator.png`

## Design review checklist

- Q1 Law of One: Auth/Mine gates stay neutral, using the route/account accent only as low-weight state dots and labels. No feedback hue is introduced.
- Q2 Focal object: Auth focuses on the retained current card/space/statistics object; Mine focuses on the account object. First-read path is object -> retained state -> attached phone/code capsule -> floating chrome.
- Q3 Silhouette: The signed-out and code-sent states remain one-screen app states rather than separate login pages, stacked settings forms, or vertical article/report pages.
- Q4 Forbidden patterns: The refreshed real screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, module-selection copy, or complex dashboard language.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots at 1206 x 2622 confirm route headers, account/current-object card, phone/code dock, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning remains system-sequenced and login-gated; Space gate preserves library/group/box/card position continuity; Statistics gate stays supporting, not dashboard-primary; Mine remains account support. Flip self-assess is not changed.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, six affected screenshot flows, iOS smoke flow, Maestro selector validation, PR design gate, and agent review gate.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Signed-out Auth, Auth code-sent, Space gate, Statistics gate, Mine signed-out, and Mine code-sent states now present account verification as a compact app state attached to the current object.
- Existing stable selectors are preserved: `auth-phone-input`, `auth-request-code-button`, `auth-code-input`, `auth-submit-button`, `auth-gate-title`, `auth-retained-object-title`, `mine-profile-card`, and `auth-code-sent-title`.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: account object -> `AuthGate` Mine branch / `mine-profile-card`; retained state -> `auth-retained-object-title` and `auth-retained-ledger`; verification action -> `PhoneSmsPanel` request/code docks; protected route object -> `AuthGate` route branch.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-space-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-auth-statistics-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-statistics.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-mine-signed-out-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-capsule-mine-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
- Interaction/motion source: no new motion implementation was added.
- Physical-space source: Space gated state preserves position continuity but does not change `SpaceSurface`.
- Unimplemented gap: Signed-in Mine, dark Mine, and full remote error visual states still deserve a later quality pass.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because auth repository behavior and stable selectors are preserved.
- The new compact Auth gate improves one-screen containment but still uses the current neutral visual system; a future pass can add more distinctive identity object material if accepted design artifacts evolve.

## Follow-up

- Create PR, wait for required remote checks, and merge if gates pass.
