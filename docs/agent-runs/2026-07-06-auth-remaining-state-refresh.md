# Agent Run Record: Auth remaining state refresh

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-45`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by refreshing the remaining Auth and Mine phone-ready / error / protected-route screenshots from the real iPhone 17 Pro simulator. During visual QA, the verify-code parser failure state was found to leak a raw JSON parser error, so the run also hardens auth error sanitization and adds a regression test.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Protected Learning, Space, and Statistics routes require account confirmation before the user continues.
- Phone plus SMS code is the primary login method, and auth must stay attached to the selected object instead of becoming a diagnostic page.
- The visible app grammar remains current object -> attached state/action -> floating chrome.
- User-visible UI and screenshot artifacts must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, raw exception, parse error, or status-code language.

## Implementation hypothesis changed

- `getUserFacingErrorMessage` now treats JSON parser failures, unexpected characters, syntax errors, and parse-failed wording as internal implementation copy.
- The verify-code submit path now falls back to `验证码暂时没通过。`, so malformed remote responses render as a recoverable auth state instead of `JSON Parse error: Unexpected character...`.
- The App rendered-text metadata guard and metadata leak scanner now include JSON parser failure terms as user-visible leakage.
- Current real-app screenshot evidence for remaining Auth/Mine states now uses fresh simulator captures instead of older layout evidence.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, current auth/Mine screenshots, mobile core reset design decision and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, `apps/mobile/scripts/check-metadata-leaks.mjs`, and Auth/Mine Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots under `docs/agent-runs/artifacts/2026-07-06-auth-remaining-state-refresh/` were inspected as validation evidence. Temporary local HTTP stubs were used only to trigger remote auth failure states.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, candidate card content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: sanitizes auth verify parser failures and uses verify-specific fallback copy.
- `apps/mobile/__tests__/App.test.tsx`: blocks visible JSON parser failure terms and adds verify parser-failure regression coverage.
- `apps/mobile/scripts/check-metadata-leaks.mjs`: extends visible leak detection to JSON parser failure terms.
- `docs/agent-runs/artifacts/2026-07-06-auth-remaining-state-refresh/`: real iPhone 17 Pro simulator evidence for 14 Auth/Mine light and dark states.
- `docs/design/app-screenshots/current-real-app/auth-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/auth-error.png`
- `docs/design/app-screenshots/current-real-app/auth-verify-error.png`
- `docs/design/app-screenshots/current-real-app/auth-space.png`
- `docs/design/app-screenshots/current-real-app/auth-statistics.png`
- `docs/design/app-screenshots/current-real-app/mine-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/mine-auth-error.png`
- `docs/design/app-screenshots/current-real-app/mine-verify-error.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-error.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-phone-ready.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png`
- `docs/agent-runs/2026-07-06-auth-remaining-state-refresh.md`: this run record.

## Commands run

- `npm --prefix apps/mobile run ios -- --simulator "iPhone 17 Pro"` -> passed, installed the app for real simulator screenshot capture.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-phone-ready-screenshot.yaml` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-statistics-gate-screenshot.yaml` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-phone-ready-screenshot.yaml` -> passed.
- Local request-code 503 stub plus `ios-auth-error-screenshot.yaml` and `ios-mine-auth-error-screenshot.yaml` -> passed in light and dark.
- Local verify-code malformed JSON stub plus `ios-auth-verify-error-screenshot.yaml` and `ios-mine-verify-error-screenshot.yaml` -> passed in light and dark.
- `sips -g pixelWidth -g pixelHeight ...` for the refreshed current-real-app screenshots -> passed, all 1206 x 2622.
- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx scripts/check-metadata-leaks.mjs` from `apps/mobile` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx --testNamePattern='sanitizes remote verify-code parser failures|shows remote verify-code failure inside the auth gate'` -> passed after the parser-failure fix.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites / 164 tests. Expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- Post-format `git diff --check`, metadata scans, lint, and focused auth parser tests -> passed.

## Validation results

- Focused auth parser regression: pass.
- Full mobile Jest: pass, 26 suites / 164 tests.
- Backend function tests: pass, 11 tests.
- Whitespace diff check: pass.
- Maestro selector validation: pass.
- Visible text metadata leak scan: pass.
- Design visual artifact metadata leak scan: pass.
- Mobile lint and typecheck: pass.
- Harness with and without remote guard: pass.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Auth/Mine phone-ready, request-code error, verify-code error, protected Space gate, and protected Statistics gate screenshot flows: pass on iPhone 17 Pro simulator.
- Screenshot dimensions: pass, 1206 x 2622.
- Visual inspection: pass for corrected verify-code error states; raw JSON parser copy is no longer visible.

## Design review checklist

- Q1 Law of One: Auth and Mine keep one restrained account/continuity accent and do not introduce competing diagnostic or status colors.
- Q2 Focal object: First-read path remains route title -> current card/account object -> phone/code action stack -> recovery dock -> floating chrome.
- Q3 Silhouette: Refreshed screenshots preserve the one-screen app shell and attached recovery object, not a long web form or page-level error report.
- Q4 Forbidden patterns: The refreshed screenshots and rendered-text guards show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, raw exception, JSON parser copy, status code, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm the phone field, code cells, CTA, error dock, retry pill, protected gate cards, and floating tab bar fit without clipped text, overlap, horizontal overflow, keyboard residue, or bottom chrome collision.
- Q6 Surface-specific: Learning auth remains a current-card continuation recovery state. Mine remains account ownership recovery. Space and Statistics protected gates preserve retained route intent instead of becoming standalone login pages.
- AP-22: The design review checklist is answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Auth/Mine visible text was inspected in real screenshots and guarded in tests; no user-visible internal implementation, remote status-code, parser, or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. The current real-app screenshot package now reflects the latest one-screen auth action stack across remaining Auth/Mine light and dark states.
- Verify-code parser failures no longer leak raw technical exceptions to learners.
- Normal login, protected route gating, Learning, Space, Statistics, Mine, membership, and sync behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: auth object recovery copy -> `getUserFacingErrorMessage`; rendered phone/code states -> `PhoneSmsPanel`; leakage guard -> `USER_VISIBLE_METADATA_PATTERN` and `visibleDesignJargonLeakPattern`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/*auth*.png` and `*mine*.png`.
- Screenshot evidence mapping: every refreshed current-real-app file listed above is copied from the matching real-app artifact in `docs/agent-runs/artifacts/2026-07-06-auth-remaining-state-refresh/`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code, verify-code, retry, route tab, and keyboard dismissal handlers are reused.
- Physical-space source: N/A; Space behavior was not altered, only its protected auth gate screenshot was refreshed.
- Unimplemented gap: This pass covers iPhone 17 Pro light/dark evidence. Smaller phones, tablet, dynamic type, and transition motion remain later evidence passes.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Internal thrown errors and console warnings still retain diagnostic detail for engineering visibility; the change only sanitizes user-facing copy.
- Screenshot proof uses local HTTP stubs to exercise remote failure states. The same sanitized mapper is covered by Jest and real simulator flows.

## Follow-up

- Continue visible-quality passes on remaining non-auth app states, prioritizing smaller-phone containment and any state where screenshot evidence still lags the current implementation.
