# Agent Run Record: Auth error dock

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-09`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by replacing the shared Auth/Mine inline error text with an in-object recovery dock. Remote SMS request and verify failures now render as safe user-facing app states, with light and dark real app screenshots for Auth and Mine.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Phone plus SMS code is the primary login method.
- Unauthenticated users cannot start the real Learning flow; the current card, route, and account continuity must remain visible until auth completes.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, debug, repo path, endpoint, payload, raw remote exception, TODO, or similar internal language.
- Failure states must preserve the same one-screen object grammar as the main app, not become loose diagnostic text.

## Implementation hypothesis changed

- Auth failures should be represented as a recoverable object state attached to the same phone/SMS dock.
- The visible error state should show a clear title, safe status detail, and `可重试` affordance while keeping the current location/account state intact.
- The raw remote error remains mapped through the existing user-facing error sanitizer; the dock adds presentation and recovery semantics without exposing internal names.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile reset decision/mock/mapping, `apps/mobile/App.tsx`, App tests, current auth/Mine screenshots, and Maestro auth screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence. A temporary local 503 HTTP stub under `/tmp` was used only to trigger remote auth request failure in the simulator.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: replaces bare `authState.error` text with `auth-error-dock`, `auth-error-title`, `auth-error-detail`, and `auth-error-retry-pill` inside the shared `PhoneSmsPanel`.
- `apps/mobile/__tests__/App.test.tsx`: asserts request-code and verify-code failures use the recovery dock and do not expose internal remote/runtime/payload language.
- `apps/mobile/e2e/maestro/ios-auth-error-screenshot.yaml`: new real-app screenshot flow for the Auth request-code error state.
- `apps/mobile/e2e/maestro/ios-mine-auth-error-screenshot.yaml`: new real-app screenshot flow for the Mine request-code error state.
- `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-light-real-app.png`: real iPhone 17 Pro simulator light Auth error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-light-real-app.png`: real iPhone 17 Pro simulator light Mine error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-dark-real-app.png`: real iPhone 17 Pro simulator dark Auth error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-dark-real-app.png`: real iPhone 17 Pro simulator dark Mine error screenshot.
- `docs/design/app-screenshots/current-real-app/auth-error.png`: refreshed current real app light Auth error screenshot.
- `docs/design/app-screenshots/current-real-app/mine-auth-error.png`: refreshed current real app light Mine error screenshot.
- `docs/design/app-screenshots/current-real-app/dark/auth-error.png`: refreshed current real app dark Auth error screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png`: refreshed current real app dark Mine error screenshot.
- `docs/agent-runs/2026-07-06-auth-error-dock.md`: this run record.

## Commands run

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx apps/mobile/e2e/maestro/ios-auth-error-screenshot.yaml apps/mobile/e2e/maestro/ios-mine-auth-error-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testNamePattern="remote request-code failure|remote verify-code failure|metadata leakage"` -> passed, 3 focused tests; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `python3 /tmp/softbook_auth_503_stub.py` -> started local 503 HTTP stub on `127.0.0.1:48731` for simulator-only remote auth failure proof.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-maestro-clear-state.yaml && SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_BASE_URL='http://127.0.0.1:48731' xcrun simctl launch --terminate-running-process 9B086605-1D68-40C4-A849-D0DFF42468ED com.softbook.cet && env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-error-screenshot.yaml` -> passed in light mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-light-real-app.png` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-maestro-clear-state.yaml && SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_BASE_URL='http://127.0.0.1:48731' xcrun simctl launch --terminate-running-process 9B086605-1D68-40C4-A849-D0DFF42468ED com.softbook.cet && env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-auth-error-screenshot.yaml` -> passed in light mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-light-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- The same Auth and Mine remote-error screenshot flows above -> passed in dark mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-dark-real-app.png` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-auth-error-dock/*.png docs/design/app-screenshots/current-real-app/auth-error.png docs/design/app-screenshots/current-real-app/mine-auth-error.png docs/design/app-screenshots/current-real-app/dark/auth-error.png docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png` -> passed, all 1206 x 2622.
- Visual inspection of the four current real app auth-error screenshots -> passed; no internal remote/endpoint/payload text, keyboard residue, clipped CTA, tabbar collision, or dark contrast issue found.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-maestro-clear-state.yaml && xcrun simctl launch --terminate-running-process 9B086605-1D68-40C4-A849-D0DFF42468ED com.softbook.cet` -> passed to restore the app from remote-stub mode to local baseline before iOS smoke.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_error_dock_pr_body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_error_dock_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file apps/mobile/e2e/maestro/ios-auth-error-screenshot.yaml --changed-file apps/mobile/e2e/maestro/ios-mine-auth-error-screenshot.yaml --changed-file docs/agent-runs/2026-07-06-auth-error-dock.md --changed-file docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-light-real-app.png --changed-file docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-light-real-app.png --changed-file docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-dark-real-app.png --changed-file docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-dark-real-app.png --changed-file docs/design/app-screenshots/current-real-app/auth-error.png --changed-file docs/design/app-screenshots/current-real-app/mine-auth-error.png --changed-file docs/design/app-screenshots/current-real-app/dark/auth-error.png --changed-file docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png` -> passed.

## Validation results

- Focused App Jest: pass, 3 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Auth error screenshot flow: pass in light and dark on iPhone 17 Pro simulator.
- Mine auth error screenshot flow: pass in light and dark on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-light-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-light-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/auth-error-dark-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/mine-auth-error-dark-real-app.png`
  - `docs/design/app-screenshots/current-real-app/auth-error.png`
  - `docs/design/app-screenshots/current-real-app/mine-auth-error.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth-error.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png`

## Design review checklist

- Q1 Law of One: The failure state stays inside the existing auth object dock. It does not create a new card family, debug banner, or competing product center.
- Q2 Focal object: The blocked current card or Mine account object remains the first-read object; the error dock is attached recovery state.
- Q3 Silhouette: Auth and Mine remain one-screen object surfaces with floating route chrome. The change removes loose text and keeps the recovery state in the object system.
- Q4 Forbidden patterns: The refreshed screenshots show no visible agent, harness, debug, runtime, repo, endpoint, payload, raw remote exception, fixture, TODO, or internal metadata language.
- Q5 Layout containment: Real iPhone 17 Pro light and dark simulator screenshots confirm the error dock fits without horizontal overflow, keyboard residue, clipped button label, tabbar collision, or text overlap.
- Q6 Surface-specific: Learning auth preserves current-card continuity; Mine auth preserves account, learning record, Space position, and membership continuity. This pass does not alter Space hierarchy or flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, screenshot flows, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Auth failures no longer appear as a standalone red text line.
- The app now presents a clear error recovery dock with a title, safe detail text, and `可重试` state.
- Light and dark current-real-app screenshot evidence has been added for both Learning auth and Mine auth failure states.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: phone auth account rows -> `PhoneSmsPanel`; error recovery state -> `auth-error-dock`, `auth-error-title`, `auth-error-detail`, and `auth-error-retry-pill`; current screenshot evidence -> `docs/design/app-screenshots/current-real-app/*auth-error.png`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-06-auth-error-dock/*-real-app.png` -> `docs/design/app-screenshots/current-real-app/*auth-error.png` and `docs/design/app-screenshots/current-real-app/dark/*auth-error.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code and keyboard dismissal handlers are reused.
- Physical-space source: N/A; Space layout and operation model are unchanged.
- Learning microcopy basis: N/A; this PR does not change Learning card content.
- Unimplemented gap: This pass covers remote request-code error states in light and dark on iPhone 17 Pro. Small-phone/tablet containment, dynamic type, verify-code screenshot evidence, and post-auth transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Screenshot proof uses a local 503 stub to exercise remote auth failure. The UI path is the same sanitized error path used by the app's remote repository tests.
- Verify-code error has Jest coverage but not separate screenshot evidence in this pass. A future pass can capture the code-sent failure state if needed.

## Follow-up

- Continue quality passes on verify-code screenshot evidence, tablet/small-phone containment, dynamic type, and post-auth transition state.
