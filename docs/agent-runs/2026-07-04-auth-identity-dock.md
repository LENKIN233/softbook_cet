# Agent Run Record: Auth identity dock

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-4`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping phone/SMS authentication from a form-like block into an identity dock attached to the current protected object. The phone entry and request action now live in one compact dock, and the code-sent state removes the redundant phone field so the OTP entry reads as one app state rather than a validation form.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Authentication is required before learning; guest learning is not supported.
- The primary login method is phone SMS code.
- Auth must preserve the user's current Learning, Space, Statistics, or Mine context and return there after verification.
- Learning remains the strongest product path; auth is a gate attached to the current object, not a standalone form destination.
- Account, physical Space, learning state, and membership entitlement belong to the same account/sync contract.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `PhoneSmsPanel` now places the phone input and request-code command inside one `auth-request-inline-dock`.
- The request-code dock becomes a contained app dock rather than top/bottom divider rows.
- The code-sent state hides the redundant phone input and uses one contained OTP dock with sent-to status, resend, code cells, and submit action.
- Visible microcopy is shortened from instructional form copy to app-state copy: `输入手机号`, `11 位手机号用于接收验证码。`, and `正在向当前手机号发送短码。`.
- Existing behavior and selectors are preserved: `auth-phone-input`, `auth-request-code-button`, `auth-code-input`, `auth-submit-button`, `auth-code-inline-dock`, and `auth-request-inline-dock`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, `docs/design/canon.md`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, auth/Mine Maestro screenshot flows, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines `PhoneSmsPanel` into a compact identity dock for phone and code states while preserving auth behavior.
- `apps/mobile/__tests__/App.test.tsx`: updates auth visual-structure and microcopy assertions.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-simulator.png`: real iPhone 17 Pro simulator auth screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-code-sent-simulator.png`: real iPhone 17 Pro simulator auth code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-space-simulator.png`: real iPhone 17 Pro simulator Space auth gate screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-statistics-simulator.png`: real iPhone 17 Pro simulator Statistics auth gate screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-signed-out-simulator.png`: real iPhone 17 Pro simulator Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-code-sent-simulator.png`: real iPhone 17 Pro simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed current real app Space auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed current real app Statistics auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-04-auth-identity-dock.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-*-simulator.png` -> passed for all six screenshot states.
- `cp docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-*-simulator.png docs/design/app-screenshots/current-real-app/*.png` -> passed for all six refreshed current-real-app screenshots.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-*-simulator.png docs/design/app-screenshots/current-real-app/auth.png docs/design/app-screenshots/current-real-app/auth-code-sent.png docs/design/app-screenshots/current-real-app/auth-space.png docs/design/app-screenshots/current-real-app/auth-statistics.png docs/design/app-screenshots/current-real-app/mine-signed-out.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_identity_dock_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file docs/agent-runs/2026-07-04-auth-identity-dock.md --changed-file docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-code-sent-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-space-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-statistics-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-signed-out-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-code-sent-simulator.png --changed-file docs/design/app-screenshots/current-real-app/auth.png --changed-file docs/design/app-screenshots/current-real-app/auth-code-sent.png --changed-file docs/design/app-screenshots/current-real-app/auth-space.png --changed-file docs/design/app-screenshots/current-real-app/auth-statistics.png --changed-file docs/design/app-screenshots/current-real-app/mine-signed-out.png --changed-file docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_identity_dock_pr_body.md` -> passed.

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
- Auth screenshot flows: pass for auth, auth code-sent, Space auth gate, Statistics auth gate, Mine signed-out, and Mine code-sent.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-code-sent-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-space-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-statistics-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-signed-out-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-code-sent-simulator.png`

## Design review checklist

- Q1 Law of One: Auth surfaces inherit the active route object. Learning auth uses the current-card object, Space auth uses current position, Statistics auth uses the daily object, and Mine auth uses account object. The screenshots keep one neutral route/account accent and do not introduce competing library identity colors.
- Q2 Focal object: First-read path is route/account object -> retained state -> compact identity dock -> floating chrome. The phone and code actions are attached to the retained object rather than presented as separate form sections.
- Q3 Silhouette: Auth remains a gate attached to the current object. The change supports the mobile core reset object grammar and does not alter Learning, Space, Statistics, or Mine primary silhouettes.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Six real iPhone 17 Pro simulator screenshots confirm the retained object, identity dock, OTP cells, route header, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass does not change Learning sequencing, flip self-assess, Statistics tabular treatment, or Space hierarchy. It only changes the auth gate's attached identity operation.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, six auth screenshot flows, iOS smoke flow, PR design gate, and Agent review gate.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Signed-out and code-sent auth states now read as compact app states attached to the current object instead of form-like pages.
- The phone/SMS auth requirement remains explicit and operable.
- The code-sent state removes duplicate phone input, reducing visual noise and vertical weight.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: retained object -> `auth-retained-object-title`, `auth-retained-ledger`; identity request dock -> `auth-request-inline-dock`; phone entry -> `auth-phone-input`; OTP dock -> `auth-code-inline-dock`; OTP input -> `auth-code-input`; request/submit actions -> `auth-request-code-button` and `auth-submit-button`; screenshot evidence -> current real app auth/Mine auth screenshots.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-space-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-auth-statistics-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-statistics.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-signed-out-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-identity-dock-mine-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code and submit-code handlers are reused.
- Physical-space source: N/A; Space auth gate keeps current position semantics but does not change Space behavior.
- Learning microcopy basis: auth copy follows account-sync truth and current-object return behavior; no Learning card content or interaction copy changed.
- Unimplemented gap: Light-mode phone screenshots cover the main signed-out and code-sent auth states across Learning, Space, Statistics, and Mine. Dark mode, tablet containment, auth error visual states, and post-auth transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable Maestro selectors and auth behavior, reducing behavior risk.
- Auth error states should receive a future visual screenshot pass because this pass validates their copy in tests but not as screenshot evidence.

## Follow-up

- Continue quality passes on auth error states, dark mode, tablet containment, and remaining secondary state transitions.
