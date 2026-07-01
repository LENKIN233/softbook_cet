# Agent Run Record: Auth entry continuation quality pass

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/auth-membership-entry-quality`
- Summary: Continued the user-visible app quality reset by refining the unauthenticated Auth entry into a cleaner current-card continuation surface. This pass removes design/engineering-like "learning object" copy, replaces boxed continuity cards with a compact status rail, removes the embedded SMS form's rectangular panel artifact, and refreshes the real iOS simulator auth screenshot.

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
- The Auth entry must preserve current learning, physical space state, and membership continuity without becoming a generic account landing page.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- The auth gate now uses learner-facing copy: "登录后继续学习" and "这张卡已保留" instead of "确认身份，继续当前卡" and "当前学习对象".
- Continuity states now render as one compact rail with dot markers for card, position, and progress.
- The embedded phone SMS panel uses a transparent attached surface so it no longer creates a rectangular card inside the main card.
- The current real app auth screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Auth quality run record, mobile implementation mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS auth/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines Auth gate copy, continuity rail, embedded SMS panel background, and Auth layout.
- `apps/mobile/__tests__/App.test.tsx`: updates Auth visible-copy assertions.
- `docs/agent-runs/artifacts/2026-07-01-auth-entry-continuation-quality-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: current real app Auth screenshot.
- `docs/agent-runs/2026-07-01-auth-entry-continuation-quality.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-entry-continuation-quality-simulator.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-auth-entry-continuation-quality-simulator.png docs/design/app-screenshots/current-real-app/auth.png` -> passed, both 1206 x 2622.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_entry_continuation_quality_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file docs/design/app-screenshots/current-real-app/auth.png --changed-file docs/agent-runs/artifacts/2026-07-01-auth-entry-continuation-quality-simulator.png --changed-file docs/agent-runs/2026-07-01-auth-entry-continuation-quality.md` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_entry_continuation_quality_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- PR design gate validation: pass.
- Agent review PR body validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Auth screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-auth-entry-continuation-quality-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth.png`

## Design review checklist

- Q1 Law of One: Auth uses the neutral shell accent only and does not introduce competing library or feedback colors.
- Q2 Focal object: The focal object is the retained current-card continuation surface. First-read path is retained card -> login title -> continuity rail -> phone SMS action -> floating chrome.
- Q3 Silhouette: Auth is a support entry state, not a core Learning interaction. It follows the accepted object-and-attached-action silhouette instead of a generic login form.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms no horizontal overflow, no clipped text, no CTA overlap, and no bottom chrome collision.
- Q6 Surface-specific: This is Auth-only. It preserves SMS login semantics and does not alter Learning sequencing, Space hierarchy, Statistics behavior, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Auth screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The unauthenticated Auth entry now reads as a retained-current-card continuation surface rather than a generic login form or design-object explanation.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Implementation mapping: Auth gate -> `apps/mobile/App.tsx`; phone SMS entry -> `PhoneSmsPanel`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/auth.png`.
- Unimplemented gap: This pass verifies light-mode phone output. Dark-mode screenshot, tablet screenshot, and post-code-sent visual state remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence is light-mode iPhone 17 Pro coverage. Behavior is covered by tests and smoke, but dark-mode and tablet visual captures are not included in this pass.

## Follow-up

- Continue real-app quality passes on dark mode, tablet containment, and post-code-sent/authenticated transition states.
