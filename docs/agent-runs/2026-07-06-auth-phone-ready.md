# Agent Run Record: Auth phone ready state

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-08`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by making the signed-out phone auth state visibly operational after a valid phone number is entered. The shared Auth and Mine phone docks now show a ready status, active field treatment, and active send-code command, with light and dark real app screenshots.

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
- Unauthenticated users cannot start the real Learning flow; the current card, route, and account continuity must be retained until auth completes.
- The mobile app should read as one focused object system, not a form page or a long settings page.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- A valid phone number should create an immediate in-app ready state before SMS is requested.
- The ready state should be visible in the same object dock through the status dot, readiness pill, phone field border/background, and primary send-code button.
- The action copy `发送短码` is clearer than leaving the active state on the generic `获取短码` label.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile reset decision/mock/mapping, `apps/mobile/App.tsx`, App tests, current auth/Mine screenshots, and Maestro auth screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: adds phone-ready state treatment inside the shared `PhoneSmsPanel`.
- `apps/mobile/__tests__/App.test.tsx`: covers the idle `待输入` and valid-phone `可发送` states.
- `apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml`: new real-app screenshot flow for Learning auth phone-ready state.
- `apps/mobile/e2e/maestro/ios-mine-phone-ready-screenshot.yaml`: new real-app screenshot flow for Mine auth phone-ready state.
- `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-light-real-app.png`: real iPhone 17 Pro simulator light Auth ready screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-light-real-app.png`: real iPhone 17 Pro simulator light Mine ready screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-dark-real-app.png`: real iPhone 17 Pro simulator dark Auth ready screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-dark-real-app.png`: real iPhone 17 Pro simulator dark Mine ready screenshot.
- `docs/design/app-screenshots/current-real-app/auth-phone-ready.png`: refreshed current real app light Auth ready screenshot.
- `docs/design/app-screenshots/current-real-app/mine-phone-ready.png`: refreshed current real app light Mine ready screenshot.
- `docs/design/app-screenshots/current-real-app/dark/auth-phone-ready.png`: refreshed current real app dark Auth ready screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine-phone-ready.png`: refreshed current real app dark Mine ready screenshot.
- `docs/agent-runs/2026-07-06-auth-phone-ready.md`: this run record.

## Commands run

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml apps/mobile/e2e/maestro/ios-mine-phone-ready-screenshot.yaml` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testNamePattern="renders correctly|signed-out mine|code-sent"` -> passed, 3 focused tests; pretest visible metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml` -> passed in light mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-light-real-app.png` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-phone-ready-screenshot.yaml` -> passed in light mode after switching keyboard dismissal to the in-surface target.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-light-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml` -> passed in dark mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-dark-real-app.png` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-phone-ready-screenshot.yaml` -> passed in dark mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/*.png docs/design/app-screenshots/current-real-app/auth-phone-ready.png docs/design/app-screenshots/current-real-app/mine-phone-ready.png docs/design/app-screenshots/current-real-app/dark/auth-phone-ready.png docs/design/app-screenshots/current-real-app/dark/mine-phone-ready.png` -> passed, all 1206 x 2622.
- Visual inspection of the four current real app phone-ready screenshots -> passed; no keyboard residue, clipped CTA, overlapping text, or dark contrast issue found.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed after validation.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_phone_ready_pr_body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_phone_ready_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml --changed-file apps/mobile/e2e/maestro/ios-mine-phone-ready-screenshot.yaml --changed-file docs/agent-runs/2026-07-06-auth-phone-ready.md --changed-file docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-light-real-app.png --changed-file docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-light-real-app.png --changed-file docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-dark-real-app.png --changed-file docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-dark-real-app.png --changed-file docs/design/app-screenshots/current-real-app/auth-phone-ready.png --changed-file docs/design/app-screenshots/current-real-app/mine-phone-ready.png --changed-file docs/design/app-screenshots/current-real-app/dark/auth-phone-ready.png --changed-file docs/design/app-screenshots/current-real-app/dark/mine-phone-ready.png` -> passed.

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
- Auth phone-ready screenshot flow: pass in light and dark on iPhone 17 Pro simulator.
- Mine phone-ready screenshot flow: pass in light and dark on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-light-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-light-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/auth-phone-ready-dark-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/mine-phone-ready-dark-real-app.png`
  - `docs/design/app-screenshots/current-real-app/auth-phone-ready.png`
  - `docs/design/app-screenshots/current-real-app/mine-phone-ready.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth-phone-ready.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-phone-ready.png`

## Design review checklist

- Q1 Law of One: The ready signal stays inside the existing auth object dock. It does not create a new card, route, or competing product center.
- Q2 Focal object: The blocked current card or Mine account object remains the first-read object; the phone-ready treatment is attached action state.
- Q3 Silhouette: The Auth and Mine silhouettes remain one-screen object surfaces with floating route chrome. No long-page section stack or nested card-in-card pattern is added.
- Q4 Forbidden patterns: The refreshed screenshots show no visible agent, harness, debug, runtime, repo, fixture, TODO, raw API, or internal metadata language.
- Q5 Layout containment: Real iPhone 17 Pro light and dark simulator screenshots confirm the phone-ready dock fits without horizontal overflow, keyboard residue, clipped button label, tabbar collision, or text overlap.
- Q6 Surface-specific: Learning auth preserves current-card continuity; Mine auth preserves account, learning record, Space position, and membership continuity. This pass does not alter Space hierarchy or flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, screenshot flows, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Entering a valid phone number now visibly changes the auth dock into a ready state.
- The user sees `可发送`, an active phone field, and a `发送短码` primary action before requesting SMS.
- Light and dark current-real-app screenshot evidence has been added for both Learning auth and Mine auth.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: phone auth account rows -> `PhoneSmsPanel`; ready status -> `auth-request-readiness-pill`; phone field -> `auth-phone-field-dock` / `auth-phone-input`; primary action -> `auth-request-code-button`; current screenshot evidence -> `docs/design/app-screenshots/current-real-app/*phone-ready.png`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-06-auth-phone-ready/*-real-app.png` -> `docs/design/app-screenshots/current-real-app/*phone-ready.png` and `docs/design/app-screenshots/current-real-app/dark/*phone-ready.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code handler and keyboard dismissal flows are reused.
- Physical-space source: N/A; Space layout and operation model are unchanged.
- Learning microcopy basis: N/A; this PR does not change Learning card content.
- Unimplemented gap: This pass covers valid-phone ready states in light and dark on iPhone 17 Pro. Remote auth error, tablet containment, small-phone containment, dynamic type, and post-auth transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The ready state displays the local test phone number in screenshot evidence. This is intentional simulator data, not production content.
- Future error-state work should ensure failed SMS request states preserve the same one-screen object grammar.

## Follow-up

- Continue quality passes on remote auth error, tablet/small-phone containment, and post-auth transition state.
