# Agent Run Record: Auth action stack

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-44`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by fixing the signed-out auth gate and Mine account auth states. The retained object and SMS verification action now render as one continuous action stack, and the auth card no longer stretches into a large empty panel.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/visual-reference.html`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Authentication is mandatory before protected learning, space, statistics, and account sync surfaces.
- The primary auth method is phone plus SMS code; unauthenticated offline learning is not allowed.
- Auth must be attached to the selected object or account object, not presented as a disconnected generic login page.
- User-visible UI and screenshot artifacts must not expose internal metadata, agent, harness, repo, runtime, seed, fixture, raw API, TODO, or similar implementation language.
- Single-card flow is a focused, operable one-screen flow, not a long scrolling explanation page.

## Implementation hypothesis changed

- The retained continuity object and `PhoneSmsPanel` now share `auth-gate-action-stack`, so SMS entry/code confirmation sits directly under the object it preserves.
- Route auth and Mine signed-out cards now use natural content height instead of forced full-height cards, removing the previous large empty card body.
- The SMS panel no longer carries `flex: 1` or `justifyContent: flex-end`, preventing the old bottom-docked form layout from returning.
- No authentication rule, repository mode, SMS handler, membership gate, progress sync, or route semantics changed.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, visual canon/checklist, current real app auth and Mine screenshots, `apps/mobile/App.tsx`, mobile App tests, and auth/Mine Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: groups the retained object and SMS panel into a continuous action stack, removes bottom-dock flex behavior, and lets route/Mine auth cards size to content.
- `apps/mobile/__tests__/App.test.tsx`: updates auth/Mine regression tests to assert the action stack and prevent the bottom-docked SMS panel layout from returning.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-real-app.png`: real iPhone 17 Pro light learning auth evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-code-sent-real-app.png`: real iPhone 17 Pro light learning code-sent evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-signed-out-real-app.png`: real iPhone 17 Pro light Mine signed-out evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-code-sent-real-app.png`: real iPhone 17 Pro light Mine code-sent evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-real-app-dark.png`: real iPhone 17 Pro dark learning auth evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-code-sent-real-app-dark.png`: real iPhone 17 Pro dark learning code-sent evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-signed-out-real-app-dark.png`: real iPhone 17 Pro dark Mine signed-out evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-code-sent-real-app-dark.png`: real iPhone 17 Pro dark Mine code-sent evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app light learning auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app light learning code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app light Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app light Mine code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/dark/auth.png`: refreshed current real app dark learning auth screenshot.
- `docs/design/app-screenshots/current-real-app/dark/auth-code-sent.png`: refreshed current real app dark learning code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine-signed-out.png`: refreshed current real app dark Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine-code-sent.png`: refreshed current real app dark Mine code-sent screenshot.
- `docs/agent-runs/2026-07-06-auth-action-stack.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --check apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="renders correctly|keeps protected route auth gates attached|keeps signed-out mine as an account object|keeps mine code-sent state attached"` -> passed; pretest visible metadata leak scan passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `npm --prefix apps/mobile run ios -- --simulator "iPhone 17 Pro"` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` under light simulator appearance -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` under light simulator appearance -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` under light simulator appearance -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` under dark simulator appearance -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` under dark simulator appearance -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` under dark simulator appearance -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` under dark simulator appearance -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-06-auth-action-stack/*.png` -> passed, all 1206 x 2622.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests. Expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` under light simulator appearance -> passed.

## Validation results

- Focused App auth/Mine Jest: pass, 4 selected tests.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Pre-delivery whitespace diff check: pass.
- Light learning auth screenshot flow: pass on iPhone 17 Pro simulator.
- Light learning code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Light Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Light Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Dark learning auth screenshot flow: pass on iPhone 17 Pro simulator.
- Dark learning code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, refreshed screenshots are 1206 x 2622.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Maestro selector validation: pass.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Full mobile Jest: pass, 26 suites and 163 tests. Expected mocked sync warning logs only.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-code-sent-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-signed-out-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-code-sent-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-real-app-dark.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-code-sent-real-app-dark.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-signed-out-real-app-dark.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-code-sent-real-app-dark.png`

## Design review checklist

- Q1 Law of One: Auth and Mine account gates keep one muted account/auth accent. No second library identity color is promoted to a competing strong action color.
- Q2 Focal object: The first-read path is route/account chrome -> auth/account card title -> retained object -> SMS action panel -> floating tab bar. The SMS action is now visually attached to the object it unlocks.
- Q3 Silhouette: The screen keeps the mobile core reset object-card silhouette. This differs from a learning-answer silhouette because auth is an account/object confirmation layer, not an answer interaction.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro light and dark screenshots confirm the auth card, SMS input/code cells, safe area, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass touches auth and Mine account gates only. It does not alter flip self-assess, stats tabular numbers, or the Learning primary task model.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused and full mobile tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, auth/Mine screenshot flows, and iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Protected-route auth and Mine signed-out/code-sent states now read as app object panels instead of explanation pages with bottom-docked forms.
- The user still confirms phone/SMS before protected content; auth semantics and route returns are unchanged.
- The refreshed screenshots are real app screenshots from the iPhone 17 Pro simulator, not separate design mockups.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, `docs/design/visual-reference.html`, and `spec/visual-language.json`.
- Implementation mapping: Account/auth object -> `AuthGate`; retained object -> `auth-continuity-promise`; action stack -> `auth-gate-action-stack`; SMS request/code panel -> `auth-sms-panel`; route auth card -> `auth-route-object-card`; Mine account card -> `mine-profile-card`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-real-app.png` -> `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-code-sent-real-app.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-signed-out-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-code-sent-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/auth.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/auth-code-sent-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/auth-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-signed-out-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/mine-signed-out.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-action-stack/mine-code-sent-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/mine-code-sent.png`
- Interaction/motion source: No new interaction or motion family was added. Existing SMS request/verify handlers and route tab handlers are reused.
- Physical-space source: N/A for this pass. It does not alter Space hierarchy or operations.
- Unimplemented gap: This pass covers iPhone 17 Pro light/dark auth and Mine signed-out/code-sent states. Smaller-phone, tablet, long localized copy, error states, and remote latency states remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify candidate card content, approvals, imports, exports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Auth error and phone-ready variants share the same card structure but were not refreshed in this pass.
- Smaller phone and tablet containment still need a separate evidence pass.

## Follow-up

- Continue visible-quality coverage on auth error/phone-ready states, remote latency/error states, and smaller-phone/tablet containment.
