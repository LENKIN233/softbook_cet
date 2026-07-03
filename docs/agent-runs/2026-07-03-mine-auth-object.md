# Agent Run Record: Mine auth object

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-7`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping the Mine signed-out and code-sent states into a Mine-specific account verification object. The route now keeps the account/passport grammar used by signed-in Mine, while preserving phone SMS authentication behavior and existing selectors.

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

- Phone SMS is the primary login method, and unauthenticated users cannot start Learning.
- Mine is an account/profile/paywall support surface, not a settings dashboard or product center.
- Account, membership, learning state, and physical-space state are tied to the same authenticated identity.
- This run does not change authentication logic, SMS code readiness, entitlement state, trial/purchase behavior, Learning, Space, Statistics, sync, or membership contracts.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `AuthGate` now has a Mine embedded account variant when `embedded && route.key === 'mine'`.
- Mine signed-out/code-sent states use a passport-style account header, compact status pill, low-weight account ledger, and attached phone verification dock.
- The visible title changes from route-like copy to `登录后管理账号`.
- `PhoneSmsPanel` accepts an `accountDock` visual variant, reusing the existing phone/code inputs and handlers.
- Existing selectors and behavior are preserved: `mine-profile-card`, `auth-mine-account-header`, `auth-retained-ledger`, `auth-retained-ledger-row`, `auth-phone-input`, `auth-request-inline-dock`, `auth-request-code-button`, `auth-code-inline-dock`, `auth-code-input`, and `auth-submit-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/canon.md`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Mine signed-out/code-sent Maestro screenshot flows, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: adds Mine-specific embedded auth account layout and compact phone verification dock while preserving auth behavior.
- `apps/mobile/__tests__/App.test.tsx`: updates the expected Mine auth title copy.
- `docs/agent-runs/artifacts/2026-07-03-mine-auth-object-signed-out-simulator.png`: real iPhone 17 Pro simulator signed-out Mine screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-03-mine-auth-object-code-sent-simulator.png`: real iPhone 17 Pro simulator code-sent Mine screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app signed-out Mine screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app code-sent Mine screenshot.
- `docs/agent-runs/2026-07-03-mine-auth-object.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-mine-signed-out-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-mine-code-sent-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot ../../docs/agent-runs/artifacts/2026-07-03-mine-auth-object-signed-out-simulator.png` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot ../../docs/agent-runs/artifacts/2026-07-03-mine-auth-object-code-sent-simulator.png` in `apps/mobile` -> passed.
- `cp ../../docs/agent-runs/artifacts/2026-07-03-mine-auth-object-signed-out-simulator.png ../../docs/design/app-screenshots/current-real-app/mine-signed-out.png` in `apps/mobile` -> passed.
- `cp ../../docs/agent-runs/artifacts/2026-07-03-mine-auth-object-code-sent-simulator.png ../../docs/design/app-screenshots/current-real-app/mine-code-sent.png` in `apps/mobile` -> passed.
- `sips -g pixelWidth -g pixelHeight ../../docs/agent-runs/artifacts/2026-07-03-mine-auth-object-signed-out-simulator.png ../../docs/agent-runs/artifacts/2026-07-03-mine-auth-object-code-sent-simulator.png ../../docs/design/app-screenshots/current-real-app/mine-signed-out.png ../../docs/design/app-screenshots/current-real-app/mine-code-sent.png` in `apps/mobile` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_auth_object_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file docs/agent-runs/2026-07-03-mine-auth-object.md --changed-file docs/agent-runs/artifacts/2026-07-03-mine-auth-object-signed-out-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-03-mine-auth-object-code-sent-simulator.png --changed-file docs/design/app-screenshots/current-real-app/mine-signed-out.png --changed-file docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_auth_object_pr_body.md` -> passed.

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
- PR design gate: pass.
- Agent review gate: pass.
- Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-mine-auth-object-signed-out-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-mine-auth-object-code-sent-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: Mine auth uses the same neutral account accent and does not introduce competing library colors, reward colors, or paywall-first color.
- Q2 Focal object: First-read path is route title -> Mine account object -> account ledger -> phone verification dock -> floating chrome.
- Q3 Silhouette: Signed-out/code-sent Mine now matches the account support silhouette instead of a standalone form page. Learning, Space, Statistics, and signed-in Mine behavior are not changed.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or paywall-first chrome appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the account header, account ledger, phone input, code input, request/submit controls, and floating tab bar fit without clipped text, awkward one-character title wrapping, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine keeps login/account support subordinate to Learning. Phone SMS login remains the primary login method, and this run does not change Learning sequencing, flip self-assess, Statistics tabular numbers, module role, Space hierarchy, auth behavior, purchase, membership, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Mine auth screenshot flows, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Mine signed-out and code-sent states now read as account verification states inside Mine instead of generic form screens.
- The phone verification path remains clear and uses the same inputs/buttons as before, but the account/membership context is attached with lower visual noise.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: account object -> `apps/mobile/App.tsx` / `AuthGate` Mine embedded branch / `mine-profile-card`; account rows -> `auth-retained-ledger` and `auth-retained-ledger-row`; phone verification dock -> `PhoneSmsPanel` / `auth-request-inline-dock` / `auth-code-inline-dock`; screenshot evidence -> current real app Mine signed-out and code-sent screenshots.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-mine-auth-object-signed-out-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`; `docs/agent-runs/artifacts/2026-07-03-mine-auth-object-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing phone input, request-code, resend, and submit handlers are reused.
- Physical-space source: N/A; this is Mine auth-only and does not change Space.
- Learning microcopy basis: no Learning UI copy changed. Mine auth visible copy remains design-backed account/support copy and spec-backed phone SMS login copy.
- Unimplemented gap: Light-mode phone Mine signed-out and code-sent states are covered. Dark mode, tablet containment, route-gated auth variants after this Mine-specific change, and post-trial/premium Mine variants remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable auth and Mine selectors used by Maestro and App tests, reducing behavior risk.
- Other auth gate route variants intentionally keep their existing layout; follow-up can decide whether they need the same account-object treatment.

## Follow-up

- Continue quality passes on route-gated auth variants, dark/tablet containment, and post-trial/premium Mine variants.
