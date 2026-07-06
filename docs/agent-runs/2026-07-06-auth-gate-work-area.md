# Agent Run Record: Auth gate work area

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-40`
- PR: N/A at record creation
- Summary: Continued the mobile user-visible quality reset by expanding the shared auth gate and Mine signed-out auth state into one-screen object work areas. The selected object/account stays at the top while the SMS verification dock is attached near the bottom, reducing the old short-panel plus blank-page feel without changing auth behavior.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Login is an account/continuity recovery state attached to the selected app object, not a separate onboarding product, debug page, or generic form page.
- Learning auth keeps the current card position visible and returns to the current card after verification.
- Space and Statistics protected route auth gates keep the selected route object visible and return to that route after verification.
- Mine owns account and membership continuity; the signed-out Mine state must remain an account object rather than a settings page or paywall.
- Auth error states are recoverable user states and must not expose raw remote errors, status codes, endpoint names, runtime metadata, or internal implementation language.
- This run does not change SMS request/verify behavior, remote/local auth contracts, membership state, trial/purchase rules, route navigation, Learning scoring, Space state, Statistics state, or card content.

## Implementation hypothesis changed

- The shared `AuthGate` route object and Mine embedded account object now fill the available phone work area.
- The shared `PhoneSmsPanel` becomes the dock that owns the remaining vertical space, while the phone request and code-entry cards keep natural height and attach near the lower part of the object.
- Verify-code recovery gets explicit spacing between the primary retry button and the error dock so the recovery state reads as layered and actionable rather than visually collided.
- Existing copy, selectors, handlers, hidden OTP input, error mapping, local/remote runtime behavior, membership loading, and all auth transitions are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile reset mapping, design canon, current real auth/Mine screenshots, `apps/mobile/App.tsx`, focused App tests, auth/Mine/route-gate Maestro screenshot flows, and iOS smoke flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence. Temporary local HTTP stubs under `/tmp` were used only to trigger request-code and verify-code error states in the real app.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: expands route and Mine auth objects, makes the SMS panel fill the dock area, and adds code-error spacing.
- `apps/mobile/__tests__/App.test.tsx`: locks the one-screen auth object/dock layout in route auth, signed-out Mine, and code-sent Mine states.
- `docs/design/app-screenshots/current-real-app/auth*.png`: refreshed light auth screenshots for signed-out, phone-ready, code-sent, request-code error, verify-code error, Space gate, and Statistics gate.
- `docs/design/app-screenshots/current-real-app/mine-*.png`: refreshed light Mine signed-out, phone-ready, code-sent, request-code error, and verify-code error screenshots.
- `docs/design/app-screenshots/current-real-app/dark/auth*.png`: refreshed dark auth signed-out, phone-ready, code-sent, request-code error, and verify-code error screenshots.
- `docs/design/app-screenshots/current-real-app/dark/mine-*.png`: refreshed dark Mine signed-out, phone-ready, code-sent, request-code error, and verify-code error screenshots.
- `docs/agent-runs/artifacts/2026-07-06-auth-gate-work-area/*.png`: archived 22 real simulator screenshot evidence files.
- `docs/agent-runs/2026-07-06-auth-gate-work-area.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write App.tsx __tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="renders correctly|keeps protected route auth gates|keeps signed-out mine|keeps mine code-sent state"` -> passed; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="shows remote verify-code failure|keeps mine code-sent state|renders correctly"` -> passed; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `npm --prefix apps/mobile run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` -> passed.
- Light screenshot flows passed for `ios-auth-screenshot.yaml`, `ios-auth-phone-ready-screenshot.yaml`, `ios-auth-code-sent-screenshot.yaml`, `ios-auth-space-gate-screenshot.yaml`, `ios-auth-statistics-gate-screenshot.yaml`, `ios-mine-signed-out-screenshot.yaml`, `ios-mine-phone-ready-screenshot.yaml`, and `ios-mine-code-sent-screenshot.yaml`.
- Dark screenshot flows passed for `ios-auth-screenshot.yaml`, `ios-auth-phone-ready-screenshot.yaml`, `ios-auth-code-sent-screenshot.yaml`, `ios-mine-signed-out-screenshot.yaml`, `ios-mine-phone-ready-screenshot.yaml`, and `ios-mine-code-sent-screenshot.yaml`.
- Local request-code 503 stub on `127.0.0.1:48731` plus `ios-auth-error-screenshot.yaml` and `ios-mine-auth-error-screenshot.yaml` -> passed in light and dark.
- Local request-code success plus verify-code 401 stub on `127.0.0.1:48732` plus `ios-auth-verify-error-screenshot.yaml` and `ios-mine-verify-error-screenshot.yaml` -> passed in light and dark.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/auth*.png docs/design/app-screenshots/current-real-app/mine-* docs/design/app-screenshots/current-real-app/dark/auth*.png docs/design/app-screenshots/current-real-app/dark/mine-* docs/agent-runs/artifacts/2026-07-06-auth-gate-work-area/*.png` -> passed, all measured screenshots are 1206 x 2622.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` under light simulator appearance -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook-cet-pr-body-auth-gate-work-area.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook-cet-pr-body-auth-gate-work-area.md --changed-file ...` -> passed.

## Validation results

- Focused auth/Mine Jest: pass.
- Focused verify-code recovery Jest: pass.
- Light auth/Mine/route-gate screenshot flows: pass on iPhone 17 Pro simulator.
- Dark auth/Mine screenshot flows: pass on iPhone 17 Pro simulator.
- Request-code and verify-code error screenshot flows: pass with temporary local stubs in light and dark.
- Real screenshot dimensions: pass, all refreshed current and archived auth/Mine screenshots are 1206 x 2622.
- Whitespace diff check: pass.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- iOS smoke flow: pass on iPhone 17 Pro simulator after restoring local runtime mode.
- Agent review gate: pass.
- PR design gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-auth-gate-work-area/`
  - `docs/design/app-screenshots/current-real-app/auth*.png`
  - `docs/design/app-screenshots/current-real-app/mine-*.png`
  - `docs/design/app-screenshots/current-real-app/dark/auth*.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine-*.png`

## Design review checklist

- Q1 Law of One: Auth gates borrow the selected object identity instead of introducing a separate login brand. Learning auth uses the current card accent; Space and Statistics gates keep route-specific object continuity; Mine stays neutral account-first. No screen adds a second strong subject accent.
- Q2 Focal object: First-read path is route title -> selected card/route/account object -> retained continuity object -> SMS verification dock -> recovery or retry state -> floating tab chrome.
- Q3 Silhouette: The screenshots preserve the accepted mobile reset silhouette: current object/account at top, attached action/recovery dock at bottom, floating capsule navigation. Auth no longer reads as a short web form detached from the app workspace.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, endpoint, payload, raw remote exception, status code, seed, fixture, TODO, gradient text, gamification chrome, streak, XP, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro light and dark screenshots confirm headers, retained objects, phone input, code cells, request-code error, verify-code error, safe area, and floating tab bar fit at 1206 x 2622 without clipped text, horizontal overflow, keyboard residue, CTA collision, or bottom chrome collision.
- Q6 Surface-specific: This pass is auth/account continuity-specific. It preserves Learning's system-sequenced card flow, Space's physical hierarchy, Statistics' tabular behavior, and Mine's account/payment ownership. Flip self-assess remains unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, focused tests, real light/dark screenshot inspection including error states, full mobile gates, CloudBase tests, harness validation, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. The login/account gate now reads as an app-level one-screen object state rather than a short phone form on a mostly empty page.
- Auth request, code-sent, request-code error, and verify-code error states stay attached to the selected card/account object.
- Existing auth, membership, Learning, Space, Statistics, sync, route, and card-content behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`.
- Implementation mapping: auth selected object -> `AuthGate` and `auth-route-object-card`; Mine account object -> `AuthGate` with `mine-profile-card`; SMS dock work area -> `PhoneSmsPanel` and `auth-sms-panel`; request dock -> `auth-request-inline-dock`; code dock -> `auth-code-inline-dock`; verify recovery spacing -> `auth-code-entry-row` and `auth-error-dock`; code surface -> `apps/mobile/App.tsx`.
- Screenshot evidence mapping: archived files in `docs/agent-runs/artifacts/2026-07-06-auth-gate-work-area/` update the corresponding current real app screenshots under `docs/design/app-screenshots/current-real-app/` and `docs/design/app-screenshots/current-real-app/dark/`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing SMS request, SMS verify, resend, retry, hidden OTP input, and route handlers are reused.
- Physical-space source: N/A; this PR does not alter Space UI or physical-space rules. Space gate screenshot was refreshed because the shared auth object layout changed.
- Learning microcopy basis: no visible-copy change. This pass changes auth/Mine layout containment only.
- Unimplemented gap: This pass covers iPhone 17 Pro phone auth and Mine auth states in light/dark for existing screenshot flows. Dark Space/Statistics auth gate screenshots, signed-in auth success, small-phone, tablet, dynamic type, and active-submit filled-code screenshots remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The request-code and verify-code error screenshot proof uses temporary local HTTP stubs to exercise remote failure states. The rendered UI path is the same sanitized error path covered by remote auth tests.
- The layout intentionally uses the SMS panel as a bottom dock inside the current object rather than adding explanatory content to fill the middle. This avoids turning auth into onboarding copy, but smaller-phone and dynamic type still need separate containment evidence.

## Follow-up

- Continue visible-quality coverage on small-phone auth containment, tablet auth containment, dark Space/Statistics auth gates, active-submit filled-code screenshots, and signed-in membership recovery states.
