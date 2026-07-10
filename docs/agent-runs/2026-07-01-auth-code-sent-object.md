# Agent Run Record: Auth code-sent object

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/auth-code-sent-object`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by reshaping the SMS code-sent Auth state into the same retained current-card object grammar. This pass removes the second bottom request-code action, keeps resend attached to the code-sent slip, and refreshes real iOS simulator screenshot evidence for the code-sent state.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Authentication is required before personalized Learning, Space, Statistics, and Mine state can be exposed.
- The primary login method is phone SMS code.
- Auth is an attached gate for the current product object, not a standalone account landing page.
- The shared mobile grammar is current object -> attached state/action -> quiet chrome.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- `AuthGate` now reflects `code_sent` as `验证码已发` in the retained-object badge while preserving the current-card continuity object.
- `PhoneSmsPanel` now renders `验证码已发送`, the masked phone number, resend, code input, and return-to-current-card copy inside one attached code-sent slip.
- The resend action moves from the lower primary action row into the code-sent slip header, removing the previous second bottom action that could be hidden by the floating tab chrome.
- The initial request-code state keeps the primary `请求验证码` action and hint, so the first-step Auth flow remains clear.
- App tests now assert the code-sent slip, masked phone number, resend action, and current-card return copy.
- A dedicated Maestro screenshot flow now captures the code-sent state using stable id selectors.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Auth run record, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS auth/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: reshapes the SMS code-sent state into a compact attached slip and adds stable Maestro id coverage.
- `apps/mobile/__tests__/App.test.tsx`: adds assertions for the code-sent Auth object and resend state.
- `apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml`: adds the real-device screenshot flow for the code-sent Auth state.
- `docs/agent-runs/artifacts/2026-07-01-auth-code-sent-object-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: current real app code-sent Auth screenshot.
- `docs/agent-runs/2026-07-01-auth-code-sent-object.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx e2e/maestro/ios-auth-code-sent-screenshot.yaml` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-code-sent-object-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-code-sent-object-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_code_sent_object_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml --changed-file docs/design/app-screenshots/current-real-app/auth-code-sent.png --changed-file docs/agent-runs/artifacts/2026-07-01-auth-code-sent-object-simulator.png --changed-file docs/agent-runs/2026-07-01-auth-code-sent-object.md` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_code_sent_object_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- PR design gate: pass.
- Agent review body gate: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Auth code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-auth-code-sent-object-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`

## Design review checklist

- Q1 Law of One: Auth keeps the shared neutral shell and object grammar. The code-sent slip uses the same panel, border, type, and accent logic instead of a separate login palette.
- Q2 Focal object: The first-read path is route title -> retained current-card gate -> code-sent badge -> phone verification slip -> complete-login action -> floating chrome.
- Q3 Silhouette: The state is now an attached slip inside the current-card Auth gate, not a second page, report, or stacked form flow.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms code-sent title, masked phone, resend, code input, and complete-login CTA are visible in one screen without the prior bottom action being hidden by floating chrome.
- Q6 Surface-specific: This is Auth-only. It preserves SMS login semantics and does not alter Learning sequencing, Space hierarchy, Statistics behavior, Mine membership behavior, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, code-sent screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The SMS code-sent Auth state now reads as an attached verification state for the retained current card.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Auth gate -> `apps/mobile/App.tsx`; code-sent state -> `PhoneSmsPanel`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png`.
- Unimplemented gap: Initial Auth gate remains covered by `docs/design/app-screenshots/current-real-app/auth.png`. This pass covers the light-mode phone code-sent state; dark mode, tablet screenshot evidence, and route-specific Auth gate screenshots for Space/Statistics/Mine remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the Learning-route code-sent Auth gate on light-mode iPhone 17 Pro. Route-specific Auth states are covered structurally by shared component logic but do not yet have separate screenshot evidence.

## Follow-up

- Continue real-app quality passes on dark mode, tablet containment, route-specific Auth gates, and remaining high-impact one-screen surfaces.
