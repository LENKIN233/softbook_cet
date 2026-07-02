# Agent Run Record: Auth code inline dock

## Task summary

- Date: 2026-07-02
- Branch: `codex/fix/mobile-secondary-state-quality`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by removing the nested card treatment from the SMS code-sent state. The verification status, resend action, code input, submit action, and return cue now form a lightweight inline dock inside the existing Auth/Mine object instead of a bordered card inside a card.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Auth is an attached gate for the current product object, not a standalone account page or a web-form flow.
- Mine owns account and membership continuity, but its signed-out and code-sent states must still inherit the same mobile object grammar.
- The shared app grammar is current object -> attached state/action -> floating chrome. It should avoid visible cards nested inside other cards.
- SMS verification remains the account-auth mechanism. This run does not change auth repository behavior, SMS code validation, membership entitlement, or runtime sync contracts.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `PhoneSmsPanel` replaces the previous `authCodeSentSlip` bordered rounded container with `authCodeInlineDock`, a separator-based inline verification dock.
- The code input and `auth-submit-button` now share one row, reducing vertical form stack and keeping the completion action attached to the code entry.
- The `auth-code-inline-dock` test ID and App test assert the dock uses top/bottom separators and no overall border radius or full card border.
- The shared component refreshes both `auth-code-sent` and `mine-code-sent` real app screenshots.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Auth run records, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Auth/Mine Maestro screenshot flows, strict iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: replaces the code-sent nested card with an inline verification dock while preserving Auth handlers and stable submit/request test IDs.
- `apps/mobile/__tests__/App.test.tsx`: asserts the code-sent dock no longer renders as a rounded bordered card.
- `docs/agent-runs/artifacts/2026-07-02-auth-code-inline-dock-simulator.png`: real iPhone 17 Pro simulator auth-gate code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-02-mine-code-inline-dock-simulator.png`: real iPhone 17 Pro simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-02-auth-code-inline-dock.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-auth-code-inline-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-auth-code-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-auth-code-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed, both 1206 x 2622.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-02-mine-code-inline-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-02-mine-code-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-02-mine-code-inline-dock-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Auth code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-02-auth-code-inline-dock-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-02-mine-code-inline-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: The Auth and Mine code-sent states keep one neutral object grammar. The verification dock does not introduce a second card palette or competing primary object.
- Q2 Focal object: Auth first-read path is route title -> retained current object -> phone verification -> inline code dock -> floating chrome. Mine first-read path is account object -> phone verification -> inline code dock -> floating chrome.
- Q3 Silhouette: The change preserves the accepted mobile object silhouette and removes the prior card-inside-card treatment from the verification state.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the phone field, code status, resend, code input, inline submit action, return cue, and floating tab bar fit without clipped text, overlap, or bottom chrome collision.
- Q6 Surface-specific: Auth preserves SMS login and return-target continuity; Mine preserves account/member continuity. The change does not alter Learning sequencing, Space hierarchy, Statistics behavior, membership access, or flip self-assess semantics.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, auth and Mine screenshot flows, strict iOS smoke, typecheck, lint, full Jest, metadata scans, selector validation, harness validation, API tests, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The SMS code-sent state now reads more like an inline app interaction than a nested form card.
- The code input and disabled/enabled submit action are visually connected in one row.
- The same improvement applies to the Learning-route Auth gate and Mine signed-out code-sent state.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: shared phone auth panel -> `apps/mobile/App.tsx`; auth-gate code-sent and Mine code-sent evidence -> refreshed current real app screenshots.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-02-auth-code-inline-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`; `docs/agent-runs/artifacts/2026-07-02-mine-code-inline-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. The inline submit still calls the existing auth submit handler.
- Learning microcopy basis: no visible-copy change in Learning. Auth copy remains study-facing account verification copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone auth-code and mine-code-sent states are verified. Dark mode/tablet auth states, route-specific protected Auth screenshots, and input-filled enabled-submit screenshot evidence remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The inline action keeps the existing `auth-submit-button`, `auth-request-code-button`, and `auth-code-input` test IDs, so screenshot flows and smoke coverage continue to protect login behavior.
- The screenshot evidence covers disabled code-submit state after requesting SMS. Enabled submit behavior is covered by App tests and strict iOS smoke, but not by a separate screenshot capture.

## Follow-up

- Continue quality passes on remaining route-specific Auth gates, enabled-submit screenshot evidence, dark/tablet containment, and the next weakest one-screen surface.
