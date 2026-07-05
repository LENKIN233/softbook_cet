# Agent Run Record: Auth verify-code error recovery

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-10`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by turning remote SMS verify-code failure into an object-level recovery state. The code-entry dock now enters a warning state, the primary action becomes `重新验证`, and light/dark real-app screenshots cover both Learning auth and Mine auth.

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
- Unauthenticated users cannot start the real Learning flow; current card, route, and account continuity must remain visible until auth completes.
- Verify-code failure is a recoverable user state. It must not become a debug report, a raw remote exception, or detached instructional text.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, endpoint, payload, repo path, TODO, or other internal language.

## Implementation hypothesis changed

- A verify-code failure should act directly on the code-entry object: title, code cells, primary button, and recovery dock should all reflect the same warning/retry state.
- The retry path should stay in place. Users should correct the short code and tap `重新验证` without losing the preserved card/account context.
- Warning action text needs an explicit high-contrast foreground token so the amber retry button remains legible in light and dark modes.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile reset decision/mock/mapping, `apps/mobile/App.tsx`, App tests, current auth/Mine screenshots, and Maestro auth screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence. A temporary local HTTP stub under `/tmp` was used only to trigger remote request-code success plus verify-code failure in the simulator.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: adds `warningText` palette token and makes verify-code failure put the code dock, code cells, and submit button into a warning `重新验证` state.
- `apps/mobile/__tests__/App.test.tsx`: asserts verify-code failure renders `验证码待确认`, `重新验证`, warning frame/button styles, safe recovery dock, and no user-visible metadata leakage.
- `apps/mobile/e2e/maestro/ios-auth-verify-error-screenshot.yaml`: new real-app screenshot flow for Learning auth verify-code failure.
- `apps/mobile/e2e/maestro/ios-mine-verify-error-screenshot.yaml`: new real-app screenshot flow for Mine auth verify-code failure.
- `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/auth-verify-error-light-real-app.png`: real iPhone 17 Pro simulator light Learning auth verify-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/mine-verify-error-light-real-app.png`: real iPhone 17 Pro simulator light Mine auth verify-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/auth-verify-error-dark-real-app.png`: real iPhone 17 Pro simulator dark Learning auth verify-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/mine-verify-error-dark-real-app.png`: real iPhone 17 Pro simulator dark Mine auth verify-code error screenshot.
- `docs/design/app-screenshots/current-real-app/auth-verify-error.png`: current real app light Learning auth verify-code error screenshot.
- `docs/design/app-screenshots/current-real-app/mine-verify-error.png`: current real app light Mine auth verify-code error screenshot.
- `docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png`: current real app dark Learning auth verify-code error screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png`: current real app dark Mine auth verify-code error screenshot.
- `docs/agent-runs/2026-07-06-auth-verify-error.md`: this run record.

## Commands run

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx apps/mobile/e2e/maestro/ios-auth-verify-error-screenshot.yaml apps/mobile/e2e/maestro/ios-mine-verify-error-screenshot.yaml` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- Local Node HTTP stub on `127.0.0.1:48732` -> request-code returns 200; verify-code returns 401 with sanitized user-facing text.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-clear-state.yaml && SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_BASE_URL='http://127.0.0.1:48732' xcrun simctl launch --terminate-running-process 9B086605-1D68-40C4-A849-D0DFF42468ED com.softbook.cet && env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-verify-error-screenshot.yaml` -> passed in light mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-verify-error/auth-verify-error-light-real-app.png` -> passed.
- The same clear, remote launch, and `ios-mine-verify-error-screenshot.yaml` flow -> passed in light mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-verify-error/mine-verify-error-light-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- The same Auth and Mine verify-code screenshot flows above -> passed in dark mode.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-verify-error/auth-verify-error-dark-real-app.png` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-verify-error/mine-verify-error-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-auth-verify-error/*.png docs/design/app-screenshots/current-real-app/auth-verify-error.png docs/design/app-screenshots/current-real-app/mine-verify-error.png docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png` -> passed, all 1206 x 2622.
- Visual inspection of the four current real app verify-error screenshots -> passed; no internal remote/endpoint/payload text, keyboard residue, clipped CTA, tabbar collision, or dark contrast issue found.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-clear-state.yaml && xcrun simctl launch --terminate-running-process 9B086605-1D68-40C4-A849-D0DFF42468ED com.softbook.cet` -> passed to restore the app from remote-stub mode to local baseline before iOS smoke.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' PATH='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Auth verify-code error screenshot flow: pass in light and dark on iPhone 17 Pro simulator.
- Mine verify-code error screenshot flow: pass in light and dark on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/auth-verify-error-light-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/mine-verify-error-light-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/auth-verify-error-dark-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/mine-verify-error-dark-real-app.png`
  - `docs/design/app-screenshots/current-real-app/auth-verify-error.png`
  - `docs/design/app-screenshots/current-real-app/mine-verify-error.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png`

## Design review checklist

- Q1 Law of One: The verify-code failure state remains inside the existing auth object. It does not create a new page, debug banner, separate diagnostic card, or competing interaction family.
- Q2 Focal object: The blocked current card or Mine account object remains the first-read object; the code-entry dock becomes the active recovery object.
- Q3 Silhouette: Auth and Mine remain one-screen object surfaces with floating route chrome. The change strengthens the same single-screen flow instead of adding scroll-first explanation.
- Q4 Forbidden patterns: The refreshed screenshots show no visible agent, harness, debug, runtime, repo, endpoint, payload, raw remote exception, fixture, TODO, or internal metadata language.
- Q5 Layout containment: Real iPhone 17 Pro light and dark screenshots confirm the warning code dock, `重新验证` CTA, and error dock fit without horizontal overflow, keyboard residue, clipped labels, tabbar collision, or text overlap.
- Q6 Surface-specific: Learning auth preserves current-card continuity; Mine auth preserves account, learning record, Space position, and membership continuity. This pass does not alter Space hierarchy or flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, screenshot flows, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Remote verify-code failure now looks like an app recovery state, not a passive error message.
- The code-entry dock shows `验证码待确认`, warning code cells, a high-contrast `重新验证` primary action, and the existing safe recovery dock.
- Light and dark current-real-app screenshot evidence has been added for both Learning auth and Mine auth verify-code failure states.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: phone auth account rows -> `PhoneSmsPanel`; verify-code recovery state -> `auth-code-cells-frame`, `auth-submit-button`, `auth-error-dock`, `auth-error-title`, `auth-error-detail`, and `auth-error-retry-pill`; current screenshot evidence -> `docs/design/app-screenshots/current-real-app/*verify-error.png`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-06-auth-verify-error/*-real-app.png` -> `docs/design/app-screenshots/current-real-app/*verify-error.png` and `docs/design/app-screenshots/current-real-app/dark/*verify-error.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code, change-code, submit-code, and keyboard dismissal handlers are reused.
- Physical-space source: N/A; Space layout and operation model are unchanged.
- Learning microcopy basis: N/A; this PR does not change Learning card content.
- Unimplemented gap: This pass covers verify-code failure in light and dark on iPhone 17 Pro. Small-phone/tablet containment, dynamic type, and post-auth transition motion remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Screenshot proof uses a local HTTP stub to exercise request-code success plus verify-code 401. The UI path is the same sanitized error path used by the app's remote repository tests.
- Warning foreground is intentionally explicit as `warningText` because the amber warning action requires readable dark text in both app themes.

## Follow-up

- Continue quality passes on small-phone/tablet containment, dynamic type, and post-auth transition state.
