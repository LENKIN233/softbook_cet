# Agent Run Record: Mine action routing quality

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/mine-action-routing-quality`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by reshaping Mine route actions from a three-column table into a primary continuation action plus secondary Space/Statistics actions. This pass keeps Mine as an account object while making the next user action read like an app task flow.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- The mobile app is centered on continuing a CET learning task, not a generic account dashboard.
- Mine supports account, membership, purchase recovery, and route continuity without becoming the product center.
- User-visible UI must keep a clear focal object and primary action, and must not expose agent, harness, metadata, runtime, spec, validator, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- A single screen should avoid table-like route chrome when a stronger primary task path is available.
- User-visible UI changes must map to an accepted design artifact and implementation mapping before delivery.

## Implementation hypothesis changed

- The signed-in Mine route action area now has one full-width primary `继续学习` action and a secondary row for `查看空间` / `今日进展`.
- `mine-go-learning`, `mine-go-space`, and `mine-go-statistics` test IDs and route handlers are preserved.
- The membership trial CTA now has slightly stronger proportional weight than the secondary purchase button.
- A focused App test now asserts the new route action structure with `mine-action-rail` and `mine-secondary-action-row`.
- The current real app Mine screenshot is refreshed from the simulator after the change.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile implementation mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS mine/smoke flows, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: reshapes signed-in Mine route actions into primary/secondary task routing and adjusts membership CTA weight.
- `apps/mobile/__tests__/App.test.tsx`: asserts the Mine action rail has the new primary/secondary structure while preserving route action test IDs.
- `docs/agent-runs/artifacts/2026-07-01-mine-action-routing-quality-simulator.png`: real iOS simulator screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: current real app Mine screenshot.
- `docs/agent-runs/2026-07-01-mine-action-routing-quality.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-mine-action-routing-quality-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-mine-action-routing-quality-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-mine-action-routing-quality-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet && npm run metadata-leak-scan && npm run design-metadata-leak-scan && npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check && python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 162 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-mine-action-routing-quality-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine uses the shell account accent as the only strong route-action accent. The primary continuation action owns the strongest fill, while Space and Statistics remain secondary actions.
- Q2 Focal object: The focal object is the signed-in account/current learning continuity object. First-read path is account status -> today's saved progress -> metrics -> primary continue action -> secondary routes -> membership state.
- Q3 Silhouette: Mine remains an account/member support surface, but the action silhouette changes from a table-like route grid to app task routing with one primary action and two secondary actions.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token was introduced.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms the Mine panel, route actions, membership card, CTAs, and floating navigation fit without horizontal overflow, clipped labels, or clipped primary action.
- Q6 Surface-specific: This is Mine/account UI. It keeps Learning as the primary continuation path and does not turn Mine into statistics, module selection, or a complex settings surface.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Mine screenshot flow, and strict iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Signed-in Mine now presents a clear primary continuation action and secondary route actions instead of an equal-weight three-column route table.
- Design source: `spec/visual-language.json`, `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Interaction/motion source: N/A; this pass changes account route-action hierarchy and no Learning/core interaction motion.
- Learning microcopy basis: no visible Learning-copy change.
- Implementation mapping: account support surface -> `mine-profile-card`; primary continuation action -> `mine-go-learning`; secondary route row -> `mine-secondary-action-row`; Space route -> `mine-go-space`; Statistics route -> `mine-go-statistics`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Unimplemented gap: This pass verifies signed-in Mine in light-mode phone output. Dark mode, tablet output, signed-out Mine, and code-sent Mine have separate existing screenshots but were not re-shot in this pass.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence covers the signed-in Mine route-action state on light-mode iPhone 17 Pro. Other Mine auth states rely on existing screenshots and shared component behavior.

## Follow-up

- Continue real-app quality passes on Statistics report hierarchy, dark mode, tablet containment, and alternate Mine auth-state screenshot coverage.
