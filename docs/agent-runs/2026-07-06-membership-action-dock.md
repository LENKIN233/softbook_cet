# 2026-07-06 Membership Action Dock

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/visual-reference.html`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product Truth

- Mine is the account and membership ownership surface. It supports learning and Space continuity; it must not become a generic settings hub, marketing page, or diagnostic panel.
- Trial and purchase access are shared membership states across surfaces. Trial starts from the first counted learning entry, and purchase must stay interoperable across iOS, Android, and web.
- User-visible UI must not expose agent, harness, spec, runtime, metadata, debug, repo, seed, fixture, raw API, raw exception, TODO, or design-process vocabulary.

## Implementation Hypothesis

- The Mine entitlement strip should render both membership actions as clear operable controls. `开始试用` remains the primary filled capsule; `开会员` becomes a visible secondary capsule with border, light fill, and stable touch height instead of a transparent text link.
- Button color, border alpha, and 32px minimum height are implementation details. Membership state, purchase behavior, repository mode, and copy semantics are unchanged.

## 变更摘要

- `apps/mobile/App.tsx`
  - Changes `membership-purchase-button` from a transparent text-like link into a secondary ghost capsule.
  - Keeps the primary trial button and purchase handlers unchanged.
  - Slightly increases compact action minimum width and height to keep both actions tappable and visually balanced.
- `apps/mobile/__tests__/App.test.tsx`
  - Locks the Mine membership purchase action against regressing to a transparent text control.
- `docs/design/app-screenshots/current-real-app/mine.png`
- `docs/design/app-screenshots/current-real-app/dark/mine.png`
  - Updated from the real iOS simulator app after the UI change.

## 真实截图

- Light: `docs/design/app-screenshots/current-real-app/mine.png`
- Dark: `docs/design/app-screenshots/current-real-app/dark/mine.png`

## 验证

- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="mine page keeps profile status and route actions in one screen after login|can unlock gated space after remote purchase|keeps remote purchase failure copy user-facing"` from `apps/mobile` -> passed; pretest metadata leak scan passed.
- `npm start -- --reset-cache` from `apps/mobile` -> started Metro for simulator validation.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed in light and dark.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/mine.png` -> saved light Mine screenshot.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/mine.png` -> saved dark Mine screenshot.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests; expected mocked sync warning logs only.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test -e SOFTBOOK_CET_MAESTRO_PHONE=13800138000 -e SOFTBOOK_CET_MAESTRO_CODE=2468 apps/mobile/e2e/maestro/ios-remote-smoke.yaml` after a temp `clearState` launch flow -> passed.

## Validation Notes

- An initial `ios-remote-smoke.yaml` run failed before app reset because the simulator was still on the previously logged-in Mine screen.
- A second run failed because this Maestro CLI requires `test -e KEY=value`; shell environment variables were not substituted into `${...}`.
- The final reset plus `-e` run passed the full login, Space trial, learning interactions, Statistics, and Mine path.

## Design Source And Mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/visual-reference.html`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object and entitlement strip -> `MembershipHostCard`; primary membership action -> `membership-start-trial-button`; secondary membership action -> `membership-purchase-button`; screenshot evidence -> current real app Mine light/dark screenshots.
- Interaction/motion source: N/A. This run does not add a new interaction family or motion behavior; existing press handlers and disabled states are reused.
- Physical-space source: N/A. No Space model or box-state behavior changed.

## Design Review Checklist

- Q1 Law of One: Mine stays a neutral account surface. The membership strip uses the existing restrained account accent and does not introduce competing library colors.
- Q2 Focal object: The account card remains the focal object. The first-read path is account identity -> today state -> route dock -> membership entitlement actions -> floating tabbar.
- Q3 Silhouette: The screen still matches the accepted mobile-core one-screen Mine account-object silhouette, not a settings list, marketing page, paywall takeover, or long scrolling page.
- Q4 Forbidden patterns: Real light/dark screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, raw exception, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or transparent pseudo-action text.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the account card, entitlement strip, primary/secondary membership buttons, and bottom floating tabbar fit without clipped text, overlap, horizontal overflow, or safe-area collision.
- Q6 Surface-specific: Mine is not stats/learning/flip. This run does not alter Statistics tabular treatment, Learning sequencing, module selection, or flip self-assess.
- AP-22: This checklist is answered before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess; the canonical two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Satisfied by this checklist and by real light/dark app screenshots.

## Agent Review

- Reviewer: Codex
- Review status: passed
- Blocking findings: none
- Review summary: The change is scoped to Mine membership action affordance. It preserves membership state and purchase behavior while making the secondary action visibly tappable in the real app.

## 用户可见影响

- Yes. Signed-in Mine now presents `开会员` as an operable secondary button, aligned with `开始试用`, instead of a low-affordance transparent text action.
- No auth, learning, Space, statistics, membership mutation, repository, or sync behavior changed.

## Card Make 外部工作区影响

- N/A. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or exported payloads.

## 未实现 Gap

- This PR does not claim the full app is finished.
- Smaller phone widths, tablet screenshots, and dynamic type containment remain follow-up evidence.
- Other surfaces still need continued mainline app-quality review after this Mine membership action cleanup.
