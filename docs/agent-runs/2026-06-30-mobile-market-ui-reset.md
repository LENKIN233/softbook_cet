# Agent Run Record: Mobile market UI reset

## Task summary

- Date: 2026-06-30
- Branch: `codex/fix/mobile-market-ui-reset`
- PR: pending
- Summary: Continued the user-visible mobile app quality reset toward mainstream app-store product quality. This pass makes Learning, Space, Statistics, and Mine share one app-like shell, tighter one-screen task structure, softer material hierarchy, real interaction states, and refreshed real iOS simulator screenshots.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- The product is a CET4/6 preparation app, not a generic English learning tool or vocabulary list.
- Learning remains a focused single-card flow with a primary current-card task, bounded support actions, feedback, and continuity into Space.
- Space must visualize the physical library -> group -> box -> card hierarchy instead of becoming a flat list or collection page.
- Statistics and Mine are supporting app surfaces; they must not dominate the product with dashboards, counters, or internal runtime state.
- User-visible screens must not expose harness, metadata, repo, mock, runtime, raw id, fixture, debug, or task-local design language.

## Implementation hypothesis changed

- Learning now hides secondary utility actions after the learner has selected a multiple-choice answer, leaving a clean option -> submit path and preventing bottom overlap.
- Learning's main card and location strip use neutral material boundaries; the current library accent is reserved for chips, selected state, progress, and the primary action.
- Space keeps the hierarchy and current-box visual model, but strong blue outlines were lowered to neutral borders so the page reads as an app surface rather than a wireframe.
- Statistics was condensed into a single day object with check-in, review/sync ledger, and practice signal rows instead of a long stacked dashboard.
- Mine keeps the account, progress shortcuts, and membership state in one app-like first viewport with real post-learning values.
- Two reusable screenshot flows were added for Statistics and Mine so the real-app screenshot set covers more than Learning and Space.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile source files, mobile tests, Maestro flows, current real screenshots, and existing agent run records.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro debug output were inspected only as validation evidence, not product truth.
- External workspace read: none. No card content was produced, approved, or modified in `/Users/lenkin/programing/card make`.

## Files changed

- `apps/mobile/App.tsx`: tightens shared phone chrome and bottom navigation behavior for the app-like shell.
- `apps/mobile/src/learning/LearningSurface.tsx`: updates Learning state organization, active tone usage, card density, option layout, and support-action visibility.
- `apps/mobile/src/space/SpaceSurface.tsx`: softens physical-space outlines while preserving hierarchy, current-box deck, and return-to-learning continuity.
- `apps/mobile/src/statistics/StatisticsSurface.tsx`: consolidates statistics into a compact day object with ledger rows and practice signals.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: updates assertions for the new user-facing address aperture copy.
- `apps/mobile/__tests__/App.test.tsx`: updates expectations for the same visible copy and reformatted surrounding test blocks.
- `apps/mobile/e2e/maestro/ios-statistics-screenshot.yaml`: adds a real-app Statistics screenshot flow after two completed cards and check-in.
- `apps/mobile/e2e/maestro/ios-mine-screenshot.yaml`: adds a real-app Mine screenshot flow after two completed cards, one favorite, and check-in.
- `docs/design/app-screenshots/current-real-app/{learning,detail,space,statistics,mine}.png`: refreshed real iOS simulator screenshots.
- `docs/agent-runs/artifacts/2026-06-30-mobile-market-ui-*-simulator.png`: source simulator captures for the refreshed screenshot set.
- `docs/agent-runs/2026-06-30-mobile-market-ui-reset.md`: records this run.

## Commands run

- `npm run typecheck` in `apps/mobile` -> pass.
- `npm run lint -- --quiet` in `apps/mobile` -> pass.
- `npm run metadata-leak-scan` in `apps/mobile` -> pass.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> pass.
- `python3 scripts/validate_maestro_selectors.py` -> pass.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> pass, 26 suites and 159 tests.
- `python3 scripts/validate_harness.py` -> pass.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> pass, 11 tests.
- `git diff --check` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-home-screenshot.yaml` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-learning-detail-screenshot.yaml` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-space-overview-screenshot.yaml` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-statistics-screenshot.yaml` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-mine-screenshot.yaml` in `apps/mobile` -> pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> pass.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot ...` -> pass for Learning, Detail, Space, Statistics, and Mine simulator screenshots.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mobile_market_ui_reset_pr_body.md --changed-file ...` -> pass.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mobile_market_ui_reset_pr_body.md` -> pass.

## Validation results

- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validator: pass.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Harness validator: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Learning, Detail, Space, Statistics, Mine screenshot flows: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Local PR design gate: pass.
- Local agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-06-30-mobile-market-ui-learning-simulator.png`
  - `docs/agent-runs/artifacts/2026-06-30-mobile-market-ui-detail-simulator.png`
  - `docs/agent-runs/artifacts/2026-06-30-mobile-market-ui-space-simulator.png`
  - `docs/agent-runs/artifacts/2026-06-30-mobile-market-ui-statistics-simulator.png`
  - `docs/agent-runs/artifacts/2026-06-30-mobile-market-ui-mine-simulator.png`

## Design review checklist

- Q1 Law of One: Each app screen keeps one dominant semantic accent. Learning uses the current card/library accent for selected state and CTA, Space uses the current space accent as text/status only, and Statistics/Mine stay mostly neutral.
- Q2 Focal object: Learning focuses on the current card and primary submit; Space focuses on the current box; Statistics focuses on the day/check-in object; Mine focuses on account state plus three direct app actions.
- Q3 Silhouette: Learning preserves the prompt + 2x2 choice silhouette; Space remains a physical box/deck model; Statistics is a compact day object; Mine is an account/app-action hub.
- Q4 Forbidden patterns: No visible metadata, harness, mock, runtime, route, fixture, debug, repo, raw id, TODO, red four-state self-assess, or same-PR design authority was introduced.
- Q5 Layout containment: Real simulator screenshots confirm key content and primary actions fit in one phone viewport across Learning, Detail, Space, Statistics, and Mine without incoherent overlap.
- Q6 Surface-specific: AP-22 design review checklist was answered before render with six questions recorded. VL-AP-07 is addressed by binding the implementation to the accepted mobile core reset decision and mapping, not to a same-PR design brief.
- AP-23: Flip self-assess remains exactly two states: `有把握` = mint/confident and `再回看` = amber/review. This run does not introduce four-state or red self-assess UI.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after visual inspection of real simulator screenshots, full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, screenshot flows, and iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning, Space, Statistics, and Mine have visible app-quality changes.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/single-card-ux-contract.md`, `spec/visual-language.json`, and the accepted visual anchor/canon. No same-PR design artifact is used as implementation authority.
- Implementation mapping: Learning current-card flow -> `LearningSurface`; Space physical-box hierarchy -> `SpaceSurface`; Statistics day object -> `StatisticsSurface`; shared phone chrome and Mine/account surfaces -> `App.tsx`.
- Unimplemented gap: This is not a complete product-wide redesign. Remaining quality work should continue on dense secondary states, motion polish, and any future content-imported card variants after they are visible in the real app.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Some diffs are larger than the behavioral delta because Prettier reformatted existing mobile files while editing. The resulting files pass lint and tests, but review should focus on visible state changes and screenshot evidence.
- Statistics and Mine are now app-like one-screen surfaces, but long-term polish should still add finer motion/transition work under accepted interaction artifacts.

## Follow-up

- Continue future passes on remaining secondary states using real simulator screenshots as the quality gate.
- Keep the new Statistics and Mine screenshot flows in regular visual QA so leadership packages do not rely on a single Learning screenshot.
