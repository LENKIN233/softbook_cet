# Agent Run Record: Auth gate object flow

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-6`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by reshaping signed-out Auth, protected route gates, and Mine signed-out/code-sent states into a larger one-screen account object flow. This pass removes the horizontal OTP squeeze, makes phone/code actions full-width attached operations, and refreshes six real iPhone simulator screenshots.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Authentication is required before learning; guest learning is not supported.
- The primary login method is phone SMS code.
- Account, learning state, physical Space position, and membership entitlement must remain unified.
- Auth is a gate attached to the current Learning, Space, Statistics, or Mine object, not a standalone generic login page.
- Statistics and Mine support the learning flow without becoming dashboard-first surfaces.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `AuthGate` now centers the account/route object in the available viewport and gives route/Mine gates a larger one-screen footprint.
- Compact retained-state rows become bordered status capsules instead of table-like text rows.
- `PhoneSmsPanel` stacks the phone field and request-code CTA vertically so it reads as a mobile app action, not a web form row.
- The OTP state stacks code cells and submit CTA vertically, with fixed-size cells and stronger empty-cell affordance.
- Disabled request/submit buttons now use accent-soft treatment instead of white/grey inactive form styling.
- Existing behavior and selectors are preserved: `auth-phone-input`, `auth-request-code-button`, `auth-code-input`, `auth-submit-button`, `auth-code-inline-dock`, `auth-request-inline-dock`, and route tabs.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, `docs/design/design-harness.md`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Auth/Mine Maestro screenshot flows, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines Auth/Mine gate layout, phone/code action structure, OTP cell sizing, and attached state capsules.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-simulator.png`: real iPhone 17 Pro simulator auth screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-code-sent-simulator.png`: real iPhone 17 Pro simulator auth code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-space-simulator.png`: real iPhone 17 Pro simulator Space auth gate screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-statistics-simulator.png`: real iPhone 17 Pro simulator Statistics auth gate screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-mine-signed-out-simulator.png`: real iPhone 17 Pro simulator Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-mine-code-sent-simulator.png`: real iPhone 17 Pro simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed current real app Space auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed current real app Statistics auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-05-auth-gate-object-flow.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/App.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-auth-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-auth-code-sent-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-auth-space-gate-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-mine-signed-out-screenshot.yaml` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-mine-code-sent-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-*-simulator.png` -> passed for all six screenshot states.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-*-simulator.png docs/design/app-screenshots/current-real-app/auth.png docs/design/app-screenshots/current-real-app/auth-code-sent.png docs/design/app-screenshots/current-real-app/auth-space.png docs/design/app-screenshots/current-real-app/auth-statistics.png docs/design/app-screenshots/current-real-app/mine-signed-out.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Auth screenshot flows: pass for auth, auth code-sent, Space auth gate, Statistics auth gate, Mine signed-out, and Mine code-sent.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-code-sent-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-space-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-statistics-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-mine-signed-out-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-mine-code-sent-simulator.png`

## Design review checklist

- Q1 Law of One: Auth surfaces inherit the active route object. Learning auth uses the current-card object, Space auth uses current position, Statistics auth uses the daily object, and Mine auth uses account object. The screenshots keep one quiet route/account accent and do not introduce competing library identity colors.
- Q2 Focal object: First-read path is route/account object -> retained state -> attached phone/code action -> floating chrome. The code entry is now an app operation attached to the object instead of a squeezed validation row.
- Q3 Silhouette: Auth remains a gate attached to the current object. The change supports the mobile core reset object grammar and does not alter Learning, Space, Statistics, or Mine primary silhouettes.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Six real iPhone 17 Pro simulator screenshots confirm route headers, retained object, status capsules, phone input, OTP cells, primary buttons, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass does not change Learning sequencing, flip self-assess, Statistics tabular treatment, or Space hierarchy. It only changes the auth gate's attached identity operation.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, six auth screenshot flows, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Signed-out Auth, protected route gates, and Mine signed-out/code-sent states now read as one-screen app objects instead of form-like screens.
- The phone/SMS auth requirement remains explicit and operable.
- Protected route gates remain attached to the selected Learning, Space, or Statistics object.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: retained object -> `auth-retained-object-title`, `auth-retained-ledger`; route/account state capsules -> `auth-retained-ledger-row`; phone request dock -> `auth-request-inline-dock`; phone entry -> `auth-phone-input`; OTP dock -> `auth-code-inline-dock`; OTP input -> `auth-code-input`; request/submit actions -> `auth-request-code-button` and `auth-submit-button`; screenshot evidence -> current real app auth/Mine auth screenshots.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-space-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-space.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-auth-statistics-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-statistics.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-mine-signed-out-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-object-flow-mine-code-sent-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code and submit-code handlers are reused.
- Physical-space source: N/A; Space auth gate keeps current position semantics but does not change Space behavior.
- Learning microcopy basis: auth copy follows account-sync truth and current-object return behavior; no Learning card content or interaction copy changed.
- Unimplemented gap: Light-mode phone screenshots cover the main signed-out and code-sent auth states across Learning, Space, Statistics, and Mine. Dark mode, tablet containment, auth error visual states, and post-auth transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable Maestro selectors and auth behavior, reducing behavior risk.
- Auth error states still need a visual screenshot pass because this run validates their copy in tests but not as screenshot evidence.

## Follow-up

- Continue quality passes on auth error states, dark mode, tablet containment, and secondary state transitions.
