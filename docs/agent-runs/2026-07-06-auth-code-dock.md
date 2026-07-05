# Agent Run Record: Auth code dock

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-05`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by refactoring the SMS code-sent state into a stable OTP action dock. The state now keeps the sent-code header, return-context hint, full-width code cells, and submit action inside one bounded object across Learning auth and Mine account auth, in light and dark mode.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/account-sync-contract.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/visual-reference.html`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Phone plus SMS code is the primary login method.
- Authentication is required before protected learning, space, membership, and sync continuity can proceed.
- Auth gates must remain attached to the current object or Mine account object, not become a generic standalone form page.
- Mine supports account continuity and route actions; it is not the product center.
- User-visible auth UI must not expose raw card ids, source metadata, agent/harness/spec/debug/runtime terms, internal remote error vocabulary, or implementation language.

## Implementation hypothesis changed

- The code-sent state now reads as one OTP action dock: sent-code header -> return-context hint -> full-width code cells -> submit action.
- Mine no longer squeezes OTP cells and submit action into one horizontal row.
- Account dock OTP cells use readable dimensions while preserving one-screen containment.
- The submit action stays inside the same bordered OTP dock, with a stable dock height to avoid overlap or visual spill.
- Existing auth behavior, request-code/submit-code handlers, `auth-code-input`, `auth-submit-button`, and Maestro flows are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset design and mapping, current real app auth screenshots, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and Auth/Mine Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines the SMS code-sent dock layout, moves the return-context hint above the OTP cells, restores readable account OTP cell sizing, and keeps the submit action inside a stable bounded dock.
- `apps/mobile/__tests__/App.test.tsx`: adds assertions that the Mine code-sent state remains a column dock with a full-width account submit action.
- `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/auth-code-sent-real-app.png`: real iPhone 17 Pro simulator light Learning auth code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/mine-code-sent-real-app.png`: real iPhone 17 Pro simulator light Mine code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/auth-code-sent-dark-real-app.png`: real iPhone 17 Pro simulator dark Learning auth code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/mine-code-sent-dark-real-app.png`: real iPhone 17 Pro simulator dark Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app light Learning auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app light Mine code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/dark/auth-code-sent.png`: added current real app dark Learning auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine-code-sent.png`: added current real app dark Mine code-sent screenshot.
- `docs/agent-runs/2026-07-06-auth-code-dock.md`: this run record.

## Commands run

- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --runTestsByPath __tests__/App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` in light appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-code-dock/auth-code-sent-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` in light appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-code-dock/mine-code-sent-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` in dark appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-code-dock/auth-code-sent-dark-real-app.png` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` in dark appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-auth-code-dock/mine-code-sent-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` -> passed, all four real simulator evidence screenshots are 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Auth code-sent light screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent light screenshot flow: pass on iPhone 17 Pro simulator.
- Auth code-sent dark screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent dark screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, four evidence screenshots are 1206 x 2622.
- Whitespace diff check: pass.
- Selector and metadata-leak gates: pass.
- Full local gates: pass.
- iOS smoke flow: pass.

## Design review checklist

- Q1 Law of One: The OTP dock uses the current account/auth accent as the single active signal for sent-code dot and active OTP cell. Resend and submit remain quiet attached actions.
- Q2 Focal object: First-read path is route chrome -> protected object/account object -> OTP dock -> code cells -> submit action. The SMS step no longer reads as an unrelated form block.
- Q3 Silhouette: The code-sent state now has a bounded OTP action silhouette, not a squeezed horizontal form row or bottom-spilling button.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm the code-sent header, return hint, OTP cells, submit button, profile/auth card, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning auth remains attached to the current card context, and Mine auth remains attached to the account object; neither becomes a generic login page or product-center dashboard.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Auth and Mine visible text was inspected in real screenshots; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. SMS code-sent surfaces now present as one complete OTP action dock in Learning auth and Mine auth.
- The change fixes the prior Mine state where OTP cells and `输入验证码` were squeezed horizontally.
- The change also prevents code-sent helper text and submit action from overlapping or escaping the bounded object.
- Learning progression, review, statistics, space operations, auth semantics, membership, purchase, sync, and card content are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, `docs/design/visual-reference.html`, and `spec/visual-language.json`.
- Implementation mapping: sent-code header -> `auth-code-sent-title`; OTP input object -> `auth-code-input` inside `authCodeCellsFrame`; action dock -> `auth-code-inline-dock`; submit action -> `auth-submit-button`; Mine account object -> `mine-profile-card`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/auth-code-sent-real-app.png` -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/mine-code-sent-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/auth-code-sent-dark-real-app.png` -> `docs/design/app-screenshots/current-real-app/dark/auth-code-sent.png`
  - `docs/agent-runs/artifacts/2026-07-06-auth-code-dock/mine-code-sent-dark-real-app.png` -> `docs/design/app-screenshots/current-real-app/dark/mine-code-sent.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code, resend, code entry, submit, and route handlers are reused.
- Physical-space source: N/A; this run does not alter Space semantics.
- Learning microcopy basis: no visible-copy change in Learning card content. Auth helper placement changed while preserving the same return-context copy.
- Unimplemented gap: Smaller-phone containment, tablet auth containment, long localized return-target stress, filled-code submit-active screenshots, and remote failure visual states remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The OTP dock now has a stable minimum height to preserve containment. Smaller phones and long-copy variants should be covered in follow-up passes.
- Existing stable selectors were preserved and checked by Jest and Maestro.

## Follow-up

- Continue visible-quality coverage with smaller-phone auth, tablet auth, filled-code active-submit states, remote auth failure states, and remaining protected-route auth gates.
