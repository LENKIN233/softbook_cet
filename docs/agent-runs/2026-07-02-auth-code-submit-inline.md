# Agent Run Record: Auth code submit inline

## Task summary

- Date: 2026-07-02
- Branch: `codex/fix/auth-flow-quality-pass`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by tightening the phone verification code-sent state. The submit action now lives inside the verification card instead of appearing as a detached full-width button near the bottom navigation.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Learning remains login-gated when account state is required.
- Mine owns account and membership continuity, but auth must not feel like a standalone form pasted into the app.
- Auth/account copy should preserve the user's current object and return target instead of exposing implementation state.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- Mobile surfaces should use restrained hierarchy, one-screen app-like states, and clear next actions instead of long passive pages.

## Implementation hypothesis changed

- `PhoneSmsPanel` now renders `auth-submit-button` as a compact pill inside the existing `auth-code-sent` slip.
- The previous detached full-width code submit button was removed from the code-sent state.
- Disabled submit now reads `输入验证码`; enabled submit reads `完成登录`; pending submit still reads `正在登录`.
- The shared component change improves both auth-gate code-sent and Mine code-sent screenshots without changing the auth repository or SMS contract.
- Current real app screenshots were refreshed from the iPhone 17 Pro simulator for `auth-code-sent` and `mine-code-sent`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/App.tsx`, auth and Mine Maestro screenshot flows, strict iOS smoke flow, and current real app screenshot evidence.
- Generated/dependency/cache/archive read: simulator screenshots and dimensions were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: moves phone code submit into the verification card and adds compact inline submit styles.
- `docs/agent-runs/artifacts/2026-07-02-auth-code-submit-inline-simulator.png`: real iPhone 17 Pro simulator auth-gate code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-02-mine-code-submit-inline-simulator.png`: real iPhone 17 Pro simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-02-auth-code-submit-inline.md`: this run record.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed.
- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-auth-code-submit-inline-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-auth-code-submit-inline-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-mine-code-submit-inline-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-mine-code-submit-inline-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-auth-code-submit-inline-simulator.png docs/agent-runs/artifacts/2026-07-02-mine-code-submit-inline-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, all `1206 x 2622`.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Auth-gate code-sent screenshot flow: pass on iPhone 17 Pro simulator, iOS 26.5.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator, iOS 26.5.
- Strict iOS smoke: pass on iPhone 17 Pro simulator, iOS 26.5.
- Screenshot dimensions: pass, all `1206 x 2622`.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 162 tests.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-02-auth-code-submit-inline-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-02-mine-code-submit-inline-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: The code-sent card keeps one active object, the verification slip. The submit control no longer competes with the bottom route chrome.
- Q2 Focal object: First-read path is route title or auth object -> account/auth message -> phone input -> code-sent slip -> inline completion action.
- Q3 Silhouette: Both auth-gate and Mine code-sent states now read as compact app states, not a long form plus a detached CTA.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the inline submit row, code input, account object card, and floating tab bar fit without clipped text, overlap, or bottom chrome collision.
- Q6 Surface-specific: Auth preserves return-target continuity and Mine preserves account/member continuity. The change does not add a new interaction family or turn auth into a separate page flow.
- AP-22: The design review checklist six questions are answered here before PR delivery, and pre-render proof is the real iPhone simulator screenshot pair.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, auth and Mine screenshot flows, strict iOS smoke, typecheck, lint, full Jest, metadata scans, selector validation, API tests, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The auth code-sent state is now less form-like and less visually noisy.
- The submit action is directly attached to the verification slip where the user is already entering the code.
- The bottom navigation has more breathing room and no longer has to compete with a detached auth CTA.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: shared phone auth panel -> `apps/mobile/App.tsx`; auth-gate code-sent and Mine code-sent evidence -> refreshed current real app screenshots.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-02-auth-code-submit-inline-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`; `docs/agent-runs/artifacts/2026-07-02-mine-code-submit-inline-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. The inline submit still calls the existing auth submit handler.
- Learning microcopy basis: no visible-copy change in Learning; Auth visible copy changed as a product correction to make the disabled state explicit and remove detached form behavior.
- Unimplemented gap: Light-mode phone auth-code and mine-code-sent states are verified. Dark mode/tablet auth states and remaining auth entry screenshot flows remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The inline action keeps the existing `auth-submit-button` test ID, so smoke coverage continues to protect the login flow.
- The disabled label changes from `完成登录` to `输入验证码`, which is a visible microcopy correction; no repository or runtime state is exposed.

## Follow-up

- Continue quality passes on remaining auth entry screenshots, dark/tablet containment, and the next weakest one-screen route state.
