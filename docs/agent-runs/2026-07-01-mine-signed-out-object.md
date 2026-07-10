# Agent Run Record: Mine signed-out object

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/mine-signed-out-object`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by reshaping the signed-out Mine surface into an account object. This pass removes Learning-gate copy from Mine, fixes a visible truncation in the identity band, makes the Mine phone verification CTA full width, and adds real iOS simulator screenshot evidence for the signed-out Mine state.

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
- Membership entitlement is shared across release targets.
- Mine supports the flow as a quiet account and membership surface; it is not the product center and must not masquerade as Learning.
- The shared mobile grammar is current object -> attached state/action -> quiet chrome.
- User-facing UI must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- Signed-out Mine now presents `登录后管理我的` with account/sync copy instead of `确认身份继续学`.
- The signed-out identity band now uses short fields: `身份 / 待验证`, `同步 / 学习/空间/会员`, and `手机验证码`, removing the prior visible truncation.
- The Mine phone verification panel now says `手机号验证` and `验证后回到我的，查看记录、空间和会员。`.
- `PhoneSmsPanel` now accepts `fullWidthRequestButton`, allowing Mine to use a full-width request-code CTA without changing compact standalone behavior elsewhere.
- App tests now assert that signed-out Mine remains an account object and does not regress to Learning gate copy.
- A dedicated Maestro screenshot flow captures the signed-out Mine state using stable id selectors.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Mine run records, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS mine/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: reshapes signed-out Mine copy and adds `PhoneSmsPanel.fullWidthRequestButton`.
- `apps/mobile/__tests__/App.test.tsx`: adds regression coverage for signed-out Mine account-object copy.
- `apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml`: adds real-device screenshot flow for signed-out Mine.
- `docs/agent-runs/artifacts/2026-07-01-mine-signed-out-object-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: current real app signed-out Mine screenshot.
- `docs/agent-runs/2026-07-01-mine-signed-out-object.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx e2e/maestro/ios-mine-signed-out-screenshot.yaml` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 46 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-mine-signed-out-object-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-mine-signed-out-object-simulator.png docs/design/app-screenshots/current-real-app/mine-signed-out.png` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 161 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-mine-signed-out-object-simulator.png docs/design/app-screenshots/current-real-app/mine-signed-out.png` -> passed, both 1206 x 2622.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_signed_out_object_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml --changed-file docs/agent-runs/2026-07-01-mine-signed-out-object.md --changed-file docs/agent-runs/artifacts/2026-07-01-mine-signed-out-object-simulator.png --changed-file docs/design/app-screenshots/current-real-app/mine-signed-out.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_signed_out_object_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 46 tests.
- Mobile full Jest: pass, 26 suites and 161 tests.
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
- Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-mine-signed-out-object-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`

## Design review checklist

- Q1 Law of One: Mine keeps the shared neutral shell and single shell accent. The signed-out account state does not introduce a separate sales or account palette.
- Q2 Focal object: The focal object is the account object. First-read path is route context -> account object -> sync scope -> phone verification action -> floating chrome.
- Q3 Silhouette: Signed-out Mine now reads as an account object with attached SMS action, not a Learning gate or a generic login page.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms no clipped identity text, no CTA truncation, a full-width request-code action, and no bottom chrome collision.
- Q6 Surface-specific: This is Mine-only. It preserves phone SMS semantics and does not alter Learning sequence, Space hierarchy behavior, Statistics check-in behavior, membership entitlement rules, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Mine signed-out screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Signed-out Mine now presents account and sync scope clearly, avoids visible truncation, and uses a full-width verification CTA.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object -> `MineSurface` in `apps/mobile/App.tsx`; phone verification action -> `PhoneSmsPanel`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`.
- Unimplemented gap: Dark mode, tablet screenshot evidence, and Mine signed-out code-sent screenshot remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers light-mode iPhone 17 Pro signed-out Mine. The shared `PhoneSmsPanel` code path is tested, but Mine-specific code-sent state does not yet have separate screenshot evidence.

## Follow-up

- Continue real-app quality passes on Mine code-sent state, dark mode, tablet containment, and remaining one-screen edge states.
