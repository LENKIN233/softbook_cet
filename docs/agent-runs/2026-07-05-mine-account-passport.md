# Agent Run Record: Mine account passport

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260704-11`
- PR: https://github.com/LENKIN233/softbook_cet/pull/336
- Summary: Continued the user-visible mobile quality reset by reshaping the signed-in Mine screen from a stacked account/settings/entitlement page into a single account passport object. The account phone, today's state, route actions, and membership trial entry now read as one app surface instead of a long explanatory page.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/membership.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine is an account support surface, not the primary learning product, a settings center, or a promotion page.
- Learning remains the strongest next action from signed-in Mine.
- Membership trial starts from the first counted learning entry; trial and premium unlock complete card library, complete physical Space, and complete review guidance.
- Learning state, physical Space state, and membership entitlement remain account-bound sync concerns.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- The signed-in Mine headline now treats the masked phone number as the account object title, with today's learning state as attached status rather than a large slogan.
- The route header and account card use `学习账户` instead of page/category language like `账号与会员`.
- The status strip and action rail were visually lowered so the screen reads as one account object rather than multiple nested dashboard cards.
- `MembershipHostCard` renders the trial-available state as an `权益通行证` dock attached to the account object, with compact complete-card-library / complete-space / smart-review chips and short `开始试用` / `开通` actions.
- Stable behavior and selectors are preserved: `mine-profile-card`, `mine-status-strip`, `mine-action-rail`, `mine-go-learning`, `mine-go-space`, `mine-go-statistics`, `membership-host-card`, `membership-access-strip`, `membership-start-trial-button`, and `membership-purchase-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, current Mine screenshot, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and the Mine Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro output were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines signed-in Mine account composition, route copy, status/action visual hierarchy, and membership trial dock while preserving behavior.
- `apps/mobile/__tests__/App.test.tsx`: updates Mine assertions for the account passport and entitlement-pass copy while preserving selector coverage.
- `docs/agent-runs/artifacts/2026-07-05-mine-account-passport/mine-real-app.png`: real iPhone 17 Pro simulator Mine screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current real app Mine screenshot.
- `docs/agent-runs/2026-07-05-mine-account-passport.md`: this run record.

## Commands run

- `rg -n "softbook_cet|mobile-core|design|Mine|membership" /Users/lenkin/.codex/memories/MEMORY.md` -> relevant prior governance notes found.
- `git status --short --branch` -> branch clean except existing untracked `exports/` before edits.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_maestro_selectors.py --file apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed on iPhone 17 Pro simulator.
- `xcrun simctl io booted screenshot docs/agent-runs/artifacts/2026-07-05-mine-account-passport/mine-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-mine-account-passport/mine-real-app.png docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/App.tsx apps/mobile/__tests__/App.test.tsx docs/agent-runs/2026-07-05-mine-account-passport.md` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-mine-account-passport/mine-real-app.png docs/design/app-screenshots/current-real-app/mine.png` -> passed, both 1206 x 2622.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed on iPhone 17 Pro simulator.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_account_passport_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file docs/agent-runs/2026-07-05-mine-account-passport.md --changed-file docs/agent-runs/artifacts/2026-07-05-mine-account-passport/mine-real-app.png --changed-file docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_account_passport_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full Maestro selector validation: pass.
- Whitespace diff check: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Mine Maestro selector validation: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-mine-account-passport/mine-real-app.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine remains neutral and account-led. The only high-contrast action is `继续学习`; the membership pass uses the account accent and does not introduce a competing library or feedback hue.
- Q2 Focal object: First-read path is route title -> account passport -> identity/today status -> low-weight learning ledger -> route actions -> entitlement pass -> floating chrome.
- Q3 Silhouette: The screen remains a one-screen app surface. It no longer reads as a long account/settings/paywall page with a separate membership explanation section.
- Q4 Forbidden patterns: The refreshed real screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, or paywall-first chrome.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the account passport, identity band, metric ledger, route actions, entitlement pass, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine keeps account and membership support subordinate to Learning. This run does not change Learning sequencing, flip self-assess, Statistics tabular treatment, Space hierarchy, auth, purchase, membership entitlement, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Mine screenshot flow, iOS smoke flow, selector validation, PR design gate, and agent review gate. Pending required remote checks and merge.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Signed-in Mine now presents the account, today's status, route actions, and membership entry as one coherent account passport.
- The primary next user action remains clear: return to Learning.
- Trial and purchase actions remain reachable but visually subordinate to the account object and `继续学习`.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: account object -> `apps/mobile/App.tsx` / `mine-profile-card`; identity/today state -> `mineIdentityBand`; learning ledger -> `mine-status-strip`; route action dock -> `mine-action-rail`; entitlement pass -> `membership-host-card` / `membership-access-strip`; trial action -> `membership-start-trial-button`; purchase action -> `membership-purchase-button`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-mine-account-passport/mine-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Interaction/motion source: no new interaction family or motion implementation was added. Existing route navigation, start-trial, and purchase handlers are reused.
- Physical-space source: N/A; this is Mine-only and does not change Space.
- Unimplemented gap: Dark Mine, tablet containment, recovery prompt, free-after-trial, premium Mine, and other non-default membership states remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Behavior risk is low because stable selectors and membership handlers are preserved.
- Follow-up screenshot work should cover signed-out/code-sent states after this signed-in pass, plus dark mode and membership edge states.

## Follow-up

- Create/update PR, wait for required remote checks, merge if gates pass, and fast-forward `/Users/lenkin/programing/softbook_cet_design_quarantine`.
