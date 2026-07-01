# Agent Run Record: Mine code-sent object

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/mine-code-sent-object`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by making the Mine account object reflect the SMS code-sent state. This pass changes Mine's account status from static `待登录 / 手机验证码` to `验证码已发 / 输入验证码`, adds regression coverage, and captures real iOS simulator screenshot evidence for the Mine code-sent state.

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

- Phone SMS code is the primary authentication method.
- Account sync covers learning state, physical space state, and membership entitlement.
- Mine supports the flow as a quiet account and membership surface; it should expose account state without becoming a standalone login page.
- The shared mobile grammar is current object -> attached state/action -> quiet chrome.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `MineSurface` now derives `hasSentCode` from `authState.stage === 'code_sent'`.
- While the code is sent but not verified, Mine's account pill reads `验证码已发` instead of `待登录`.
- The Mine identity band's action state reads `输入验证码` instead of the static `手机验证码`.
- Existing `PhoneSmsPanel` code-sent slip continues to show the masked phone number, resend action, code input, and `完成后回到我的。`.
- App tests now assert that Mine code-sent state remains attached to the account object.
- A dedicated Maestro screenshot flow captures Mine code-sent using stable id selectors.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Mine/Auth run records, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS Mine/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: updates Mine account object state for `code_sent`.
- `apps/mobile/__tests__/App.test.tsx`: adds regression coverage for Mine code-sent account-object state.
- `apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml`: adds real-device screenshot flow for Mine code-sent.
- `docs/agent-runs/artifacts/2026-07-01-mine-code-sent-object-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-01-mine-code-sent-object.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx e2e/maestro/ios-mine-code-sent-screenshot.yaml` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-mine-code-sent-object-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-mine-code-sent-object-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-mine-code-sent-object-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, both 1206 x 2622.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_code_sent_object_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml --changed-file docs/agent-runs/2026-07-01-mine-code-sent-object.md --changed-file docs/agent-runs/artifacts/2026-07-01-mine-code-sent-object-simulator.png --changed-file docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_code_sent_object_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 162 tests.
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
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-mine-code-sent-object-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: Mine keeps the shared neutral shell and single shell accent. The code-sent state does not introduce a separate login palette.
- Q2 Focal object: The focal object remains the account object. First-read path is route context -> account state -> sync scope -> SMS code slip -> floating chrome.
- Q3 Silhouette: Mine code-sent now reads as an account object with an attached verification state, not a disconnected form.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms account state, code-sent slip, input, resend, complete-login CTA, and floating nav are visible without collision.
- Q6 Surface-specific: This is Mine-only. It preserves phone SMS semantics and does not alter Learning sequence, Space hierarchy behavior, Statistics check-in behavior, membership entitlement rules, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Mine code-sent screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Mine now reflects the SMS code-sent state in its account object, and the current real app evidence includes this state.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object -> `MineSurface` in `apps/mobile/App.tsx`; code-sent action -> `PhoneSmsPanel`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Unimplemented gap: Dark mode and tablet screenshot evidence remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers light-mode iPhone 17 Pro Mine code-sent. Dark mode and tablet containment are still unverified.

## Follow-up

- Continue real-app quality passes on dark mode, tablet containment, and remaining one-screen edge states.
