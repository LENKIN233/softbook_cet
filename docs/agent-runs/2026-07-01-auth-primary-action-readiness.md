# Agent Run Record: Auth primary action readiness

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/auth-entry-primary-action`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by aligning the Auth SMS primary actions with real input readiness. This pass prevents empty phone or empty code states from rendering as fully active primary actions, refreshes the real iOS simulator Auth screenshots, and keeps the one-screen continuation surface intact.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
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
- Auth must preserve the current learning card, physical-space state, and membership continuity without becoming a generic account landing page.
- User-visible controls should reflect whether the next action is actually available; disabled empty-input states must not look like active primary completion states.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `PhoneSmsPanel` now computes request-code and submit-code readiness from shared phone/SMS helper predicates.
- Empty phone and empty code states disable the matching `Pressable` and demote the visual treatment to the panel-strong surface with muted label text.
- Valid phone input restores the request-code action to the active primary visual state.
- The current real app Auth and Auth code-sent screenshots are refreshed from the iOS simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Auth quality run records, mobile implementation mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS auth/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: aligns Auth request-code and submit-code disabled state and visual readiness with phone/code validity.
- `apps/mobile/__tests__/App.test.tsx`: covers request-code disabled/enabled readiness and empty-code submit disabled readiness.
- `docs/agent-runs/artifacts/2026-07-01-auth-primary-action-readiness-simulator.png`: real iOS simulator Auth entry screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-01-auth-code-submit-readiness-simulator.png`: real iOS simulator Auth code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: current real app Auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: current real app Auth code-sent screenshot.
- `docs/agent-runs/2026-07-01-auth-primary-action-readiness.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-primary-action-readiness-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-primary-action-readiness-simulator.png docs/design/app-screenshots/current-real-app/auth.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-auth-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-auth-code-submit-readiness-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-auth-code-submit-readiness-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-auth-primary-action-readiness-simulator.png docs/design/app-screenshots/current-real-app/auth.png docs/agent-runs/artifacts/2026-07-01-auth-code-submit-readiness-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed, all 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_primary_action_readiness_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file docs/design/app-screenshots/current-real-app/auth.png --changed-file docs/design/app-screenshots/current-real-app/auth-code-sent.png --changed-file docs/agent-runs/artifacts/2026-07-01-auth-primary-action-readiness-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-01-auth-code-submit-readiness-simulator.png --changed-file docs/agent-runs/2026-07-01-auth-primary-action-readiness.md` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_primary_action_readiness_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 162 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- PR design gate validation: pass.
- Agent review PR body validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Auth screenshot flow: pass on iPhone 17 Pro simulator.
- Auth code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-auth-primary-action-readiness-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-01-auth-code-submit-readiness-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`

## Design review checklist

- Q1 Law of One: Auth still uses the neutral shell/accent system as the single strong semantic accent. Empty-input actions are visually demoted instead of competing with active primary actions.
- Q2 Focal object: The focal object remains the retained current-card continuation surface. First-read path is retained card -> login title -> current card status -> phone SMS entry -> readiness-aware action -> floating chrome.
- Q3 Silhouette: Auth remains an attached support state inside the accepted one-screen object silhouette; this pass changes readiness state only and does not introduce another page or card stack.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm both Auth entry and Auth code-sent states fit without horizontal overflow, clipped labels, primary action overlap, or bottom chrome collision.
- Q6 Surface-specific: This is Auth-only. It preserves SMS login semantics and does not alter Learning sequencing, Space hierarchy, Statistics behavior, membership rules, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Auth screenshot flows, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Empty Auth actions no longer look like ready primary actions, which makes the SMS flow behave more like a mainstream mobile app form while preserving the current-card continuation design.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `spec/visual-language.json`.
- Interaction/motion source: N/A; this pass changes form readiness and visual state, not a Learning/core interaction motion.
- Learning microcopy basis: no visible Learning-copy change.
- Implementation mapping: Auth gate -> `apps/mobile/App.tsx`; phone SMS entry -> `PhoneSmsPanel`; disabled request/submit readiness -> shared phone/SMS predicates; screenshot evidence -> `docs/design/app-screenshots/current-real-app/auth.png` and `docs/design/app-screenshots/current-real-app/auth-code-sent.png`.
- Unimplemented gap: This pass verifies light-mode phone Auth entry and code-sent states. Dark-mode screenshot, tablet screenshot, and authenticated account state remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers light-mode iPhone 17 Pro Auth entry and code-sent states. Behavior is covered by tests and smoke, but dark-mode and tablet visual captures are not included in this pass.

## Follow-up

- Continue real-app quality passes on dark mode, tablet containment, authenticated account state, and any remaining route-specific empty/pending action states.
