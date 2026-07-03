# Agent Run Record: Auth gate ledger unification

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-3`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by unifying logged-out and code-sent auth gates around a retained-object ledger. The route auth gates and signed-out Mine now share the same current-object grammar instead of mixing retained-object cards, Mine avatar chrome, account identity bands, and a second embedded phone form.

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
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Login is required before protected app state is entered; the primary login method is phone number plus verification code.
- Auth should preserve the selected route context and return target, not reset the user into a generic login page.
- Mine is the account object surface. Signed-out Mine should still read as account and membership state, not as a duplicate standalone form page.
- The mobile app grammar remains current object -> attached state/action -> floating chrome.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `AuthGate` now supports embedded rendering so Mine can reuse the same route-aware auth gate object.
- Retained route/account state in `AuthGate` now renders as low-weight ledger rows instead of three mini cards.
- Signed-out and code-sent Mine uses embedded `AuthGate` with `mine-profile-card` on the shared auth card, removing the second unauthenticated Mine header, identity band, and separate `PhoneSmsPanel` branch.
- `auth-gate-keyboard-dismiss-target` now calls `Keyboard.dismiss`, giving the embedded auth gate a stable non-keyboard tap target.
- The Mine code-sent screenshot flow uses that stable target before requesting a verification code.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset design artifacts and mapping, current real app auth/Mine/Space/Statistics screenshots, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and auth/Mine Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: adds embedded `AuthGate`, switches retained auth state to ledger rows, embeds Mine signed-out/code-sent states in the shared auth gate, and makes the gate summary dismiss the keyboard.
- `apps/mobile/__tests__/App.test.tsx`: updates signed-out Mine expectations to the shared account auth gate and retained ledger.
- `apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml`: uses the stable auth gate keyboard-dismiss target before requesting a code.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed real app Learning auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed real app Learning code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/auth-space.png`: refreshed real app Space auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`: refreshed real app Statistics auth gate screenshot.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed real app Mine code-sent screenshot.
- `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-auth-simulator.png`: real simulator evidence for Learning auth gate.
- `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-auth-code-sent-simulator.png`: real simulator evidence for Learning code-sent state.
- `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-space-simulator.png`: real simulator evidence for Space auth gate.
- `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-statistics-simulator.png`: real simulator evidence for Statistics auth gate.
- `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-mine-signed-out-simulator.png`: real simulator evidence for Mine signed-out state.
- `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-mine-code-sent-simulator.png`: real simulator evidence for Mine code-sent state.
- `docs/agent-runs/2026-07-03-auth-gate-ledger-unification.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot <artifact>` -> passed for all six auth/Mine screenshot artifacts.
- `sips -g pixelWidth -g pixelHeight <six current screenshots and six artifacts>` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Six auth/Mine screenshot flows: pass on iPhone 17 Pro simulator after the Mine code-sent flow was updated to use the stable auth gate keyboard-dismiss target.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Maestro selector validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Full harness validation: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-auth-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-auth-code-sent-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-space-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-statistics-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-mine-signed-out-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-mine-code-sent-simulator.png`

## Design review checklist

- Q1 Law of One: Auth gates keep one quiet app/account accent for retained state, verification status, and phone verification dock; no competing promotional or achievement color is introduced.
- Q2 Focal object: Protected routes now read as selected object/account -> retained ledger -> phone verification dock -> floating chrome.
- Q3 Silhouette: Auth and Mine signed-out states now share a single retained-object silhouette instead of mini-card clusters plus duplicate account/form blocks.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm auth, code-sent, Space gate, Statistics gate, Mine signed-out, and Mine code-sent states fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Auth still enforces phone plus verification code. Mine remains an account object surface, and Learning/Space/Statistics preserve their route-specific return targets.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, six screenshot flows, strict iOS smoke, focused and full Jest, typecheck, lint, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Logged-out and code-sent states across Learning, Space, Statistics, and Mine now use the same retained-object ledger grammar.
- Mine signed-out no longer has a separate avatar/account-band/form composition; it is a route-aware account auth gate.
- Phone verification behavior, auth repository mode, code request/submit behavior, membership entitlement, sync, Learning progression, Space state, and Statistics behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: shared route/account auth object -> `AuthGate` in `apps/mobile/App.tsx`; retained state rows -> `authRetainedLedger`; Mine signed-out/code-sent account object -> embedded `AuthGate` with `mine-profile-card`; stable keyboard dismissal target -> `auth-gate-keyboard-dismiss-target`.
- Screenshot evidence mapping: six `docs/agent-runs/artifacts/2026-07-03-auth-gate-ledger-*-simulator.png` files -> six refreshed `docs/design/app-screenshots/current-real-app/*.png` auth/Mine screenshots.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing phone verification request/submit handlers are reused.
- Physical-space source: N/A; Space auth gate return target is preserved, but Space physical model is not changed.
- Unimplemented gap: Light-mode phone screenshots cover common logged-out and code-sent auth gates. Dark mode, tablet containment, remote auth error screenshots, and small-phone auth screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot flow change relies on the new auth gate dismiss target; App tests and Maestro flows cover the intended element.
- Smaller phones and dark mode should still be covered in follow-up quality passes.

## Follow-up

- Continue user-visible quality passes on dark/tablet containment, smaller-phone screenshots, and remaining route states not yet represented by current real-app screenshots.
