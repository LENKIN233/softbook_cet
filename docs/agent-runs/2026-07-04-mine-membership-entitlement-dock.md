# Agent Run Record: Mine membership entitlement dock

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260704-3`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by refining the logged-in Mine membership area. The membership status is now an inline entitlement state attached to the account object, the trial benefits are shown as compact chips, and purchase remains available without competing with the primary `继续学习` action.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine is the account and paid-entitlement support surface. It must not become a settings center, a promotion page, or the product center.
- Learning remains the strongest next action on the signed-in Mine screen.
- Trial starts at the first counted learning entry. Trial and premium unlock complete card library, complete physical Space, and complete review guidance.
- Free/basic access remains useful, but it is not the complete experience.
- Membership entitlement is shared across release targets and follows the account/sync contract.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `MembershipHostCard` now renders membership state as an inline low-weight chip next to the section title instead of a second large status pill.
- The trial-available section title changes from `完整体验` to `权益状态`, reducing promotion-page feeling while preserving the complete trial explanation.
- The trial benefits now appear as compact `卡库 / 空间 / 回看` chips attached to the dock.
- `直接开通` is visually demoted to a text-weight action; `开始完整试用` remains the explicit trial action.
- Existing behavior and selectors are preserved: `membership-host-card`, `membership-access-strip`, `membership-start-trial-button`, and `membership-purchase-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, `docs/design/canon.md`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Mine Maestro screenshot flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines the signed-in Mine membership entitlement dock and visible membership microcopy while preserving auth, membership, purchase, and sync logic.
- `apps/mobile/__tests__/App.test.tsx`: updates the Mine one-screen assertion from the old promotional title to the new entitlement-state title.
- `docs/agent-runs/artifacts/2026-07-04-mine-membership-entitlement-dock-simulator.png`: real iPhone 17 Pro simulator Mine screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current real app Mine screenshot.
- `docs/agent-runs/2026-07-04-mine-membership-entitlement-dock.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-04-mine-membership-entitlement-dock-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-mine-membership-entitlement-dock-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-04-mine-membership-entitlement-dock-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_membership_entitlement_dock_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file docs/agent-runs/2026-07-04-mine-membership-entitlement-dock.md --changed-file docs/agent-runs/artifacts/2026-07-04-mine-membership-entitlement-dock-simulator.png --changed-file docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_membership_entitlement_dock_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-mine-membership-entitlement-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine stays neutral and account-led. The only high-contrast command is `继续学习`; the membership dock uses the same muted account accent and does not introduce a competing library color.
- Q2 Focal object: First-read path is route title -> account object -> identity/metric ledger -> primary Learning return -> secondary route actions -> inline membership entitlement dock -> floating chrome.
- Q3 Silhouette: Mine remains an account layer with attached membership support. The change does not alter Learning, Detail, Space, or Statistics silhouettes.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or paywall-first chrome appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the account object, identity band, metric ledger, route action rail, entitlement dock, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine keeps account and membership support subordinate to Learning. It does not change Learning sequencing, flip self-assess, Statistics tabular treatment, Space hierarchy, auth, purchase, membership entitlement, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and references the refreshed real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Mine screenshot flow, iOS smoke flow, PR design gate, and Agent review gate.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. The signed-in Mine membership area is quieter and reads as account entitlement support rather than a separate paid-feature panel.
- The primary next user action remains clear: return to Learning.
- Trial and purchase actions remain reachable, but purchase no longer competes visually with `继续学习`.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: account object -> `apps/mobile/App.tsx` / `mine-profile-card`; membership state -> `membership-host-card`; inline status -> `membershipInlineStatus`; compact entitlement dock -> `membership-access-strip`; trial action -> `membership-start-trial-button`; purchase action -> `membership-purchase-button`; screenshot evidence -> current real app Mine screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-04-mine-membership-entitlement-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing route navigation, start-trial, and purchase handlers are reused.
- Physical-space source: N/A; this is Mine-only and does not change Space.
- Learning microcopy basis: no Learning UI copy changed. Mine membership copy uses membership/account product truth and avoids internal implementation terms.
- Unimplemented gap: Light-mode signed-in Mine after learning progress and check-in is covered. Dark mode, tablet containment, signed-out Mine, code-sent Mine, recovery prompt, free-after-trial, and premium Mine variants remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by Maestro and App tests, reducing behavior risk.
- Follow-up screenshot work should cover signed-out/code-sent/premium/free/recovery Mine variants.

## Follow-up

- Continue quality passes on remaining Mine states, auth gate variants, dark mode, and tablet containment.
