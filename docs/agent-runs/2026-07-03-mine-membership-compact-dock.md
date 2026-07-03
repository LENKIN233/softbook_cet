# Agent Run Record: Mine membership compact dock

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-continuation`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by compacting the logged-in Mine membership trial area. The trial-available state no longer renders three access mini-cards plus a separate action row; it now uses one compact access/action dock inside the membership host card, preserving membership behavior and stable selectors.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine is the account and membership continuity surface. Membership state should be attached to the account object, not presented as a separate marketing section or long-form checkout page.
- Trial starts from the first counted learning entry. This run does not change membership entitlement, purchase, recovery, auth, sync, or protected-route rules.
- Trial access should expose the complete experience value: complete card library, complete physical space, and smarter review/algorithm support.
- The mobile app grammar is current object -> attached state/action -> floating chrome. A one-screen account route should not force unnecessary vertical scanning to understand the next action.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `MembershipHostCard` derives `isTrialAvailable` from `membershipState.stage === 'trial_available'`.
- In the trial-available state, `membership-access-strip` renders a compact dock with short benefit copy, trial action, and direct-purchase action in one row.
- The previous three `membership-access-step` mini-cards remain available for non-trial states, but are not rendered for `trial_available`.
- `MembershipActionGroup` is skipped for `trial_available` because the primary and secondary actions now live inside the compact dock.
- Existing handlers and stable selectors remain in place: `membership-start-trial-button`, `membership-purchase-button`, and `membership-access-strip`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, prior Mine/Auth run records, mobile core reset design artifacts and mapping, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Mine screenshot Maestro flow, strict iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: compresses the Mine trial-available membership access/actions into one compact dock and restores explicit complete-benefit copy in the membership summary.
- `apps/mobile/__tests__/App.test.tsx`: asserts the trial-available Mine membership state uses the compact dock instead of access mini-cards while preserving trial and purchase actions.
- `docs/agent-runs/artifacts/2026-07-03-mine-membership-compact-dock-simulator.png`: real iPhone 17 Pro simulator Mine screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current real app Mine screenshot.
- `docs/agent-runs/2026-07-03-mine-membership-compact-dock.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-03-mine-membership-compact-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-03-mine-membership-compact-dock-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-03-mine-membership-compact-dock-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile full Jest: pass, 26 suites and 163 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Full harness validation: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-mine-membership-compact-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine keeps one account/membership object grammar. The membership trial area is now one attached dock instead of a second cluster of mini-cards and detached actions.
- Q2 Focal object: First-read path is Mine route title -> account object -> status/actions -> membership object -> compact trial dock -> floating chrome.
- Q3 Silhouette: The change preserves the accepted mobile object silhouette and removes the prior membership block silhouette that read like stacked marketing cards inside the account route.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the membership title, complete-benefit copy, compact dock labels, trial/purchase actions, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine preserves account/member continuity and membership trial semantics. The change does not alter Learning sequencing, Space hierarchy, Statistics behavior, protected-route gates, purchase recovery, or flip self-assess semantics.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Mine screenshot flow, strict iOS smoke, typecheck, lint, focused and full Jest, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Logged-in Mine now presents the trial-available membership object as one compact attached action dock.
- The real app screenshot now shows the whole Mine account route as a one-screen flow with profile, route actions, membership, and floating tab chrome visible together.
- Membership behavior and stable interaction selectors are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine membership object -> `apps/mobile/App.tsx` `MembershipHostCard`; trial-available compact access/action dock -> `membership-access-strip`; trial action -> `membership-start-trial-button`; purchase action -> `membership-purchase-button`; screenshot evidence -> current real app Mine screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-mine-membership-compact-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing trial and purchase press handlers are reused.
- Learning microcopy basis: no Learning UI copy changed. Mine membership copy remains account-continuity and complete-experience copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode phone screenshot covers the logged-in trial-available Mine state. Dark mode, tablet containment, and post-purchase/recovery screenshots remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The refactor keeps shared membership handlers and stable test IDs, reducing behavior risk.
- The compact dock is screenshot-verified for iPhone 17 Pro light mode. Smaller phones and tablet layouts should be covered in follow-up quality passes.

## Follow-up

- Continue the user-visible quality reset on dark/tablet containment, post-purchase/recovery Mine membership states, and the next weakest one-screen surface.
