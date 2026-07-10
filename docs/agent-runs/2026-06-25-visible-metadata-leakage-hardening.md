# Agent Run Record: visible metadata leakage hardening

## Task summary

- Date: 2026-06-25
- Branch: `fix/visible-metadata-leakage`
- PR: N/A
- Summary: Removed product-facing metadata leaks from the real mobile app screens used for leadership screenshots and hardened the mobile metadata scanner plus harness fixtures so the same class of leakage becomes a blocker.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- `spec/visual-language.json#product_truth.user_visible_metadata_leakage_is_blocker` treats user-visible agent, harness, spec, validator, metadata, runtime, mock, prototype, seed, fixture, debug, dev, raw exception, API route, repo path, or TODO language as delivery blockers.
- `spec/product-core.json` keeps the product centered on an operable single-card learning flow, not a dense dashboard or raw learning-state readout.
- `spec/card-system.json`, `spec/interactions.json`, and `spec/space-operations.json` keep Learning as the current-card task with continuity into Space, while Space shows physical hierarchy and state without exposing raw implementation fields.
- `spec/knowledge-map.json` and `spec/space-operations.json` preserve the library -> box -> card spatial model; this fix anonymizes implementation labels and indexes rather than removing the spatial model.
- `spec/runtime-boundaries.json` keeps runtime state, auth/session details, and sync implementation out of user-visible UI copy.
- `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, and `spec/agent-run-record.json` require PR-bound validation, design gates, agent review, and this committed run record for user-visible UI and harness changes.

## Implementation hypothesis changed

- Learning no longer exposes the current index, total card count, or raw space path in visible text. It now uses user-facing copy such as `当前练习` and `位置已收在知识空间`.
- App chrome no longer displays the masked test phone after login; the authenticated state is rendered as `已登录`.
- Space no longer exposes numbered `馆 / 组 / 盒`, `当前地址`, or `当前学习卡位于` copy. It renders bounded labels such as `主书架`, `当前分区`, `当前卡盒`, and `当前学习卡在这里`.
- Mine and Space summaries no longer expose fixture-style count labels such as `收藏标签 1 张。` or `休眠区 1 张。`.
- `apps/mobile/scripts/check-metadata-leaks.mjs` now treats product-facing fixture state leaks, including masked test login identifiers, `第 X 张 / 共 Y 张`, raw `馆/组/盒` paths, `当前地址`, `当前学习卡位于`, `收藏标签`, `休眠区`, and loading-card indexes as visible metadata leak candidates.
- `scripts/harness_validator/sections/design_governance.py` now creates negative mobile scanner fixtures for masked login text, progress counts, raw space paths, and current-address leakage.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/visual-language.json`, `spec/agent-harness.json`, `spec/repo-delivery-contract.json`, `spec/evals.json`, `apps/mobile/App.tsx`, `apps/mobile/src/learning/LearningSurface.tsx`, `apps/mobile/src/space/SpaceSurface.tsx`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`, and affected Jest tests.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.
- Card make external workspace impact: none; this change only consumes existing app data and does not create, approve, or alter candidate card content.

## Files changed

- `apps/mobile/App.tsx`: removed masked test phone and fixture-style count/address labels from visible shell, Space, and Mine copy.
- `apps/mobile/src/learning/LearningSurface.tsx`: removed numeric progress and raw space address display from Learning.
- `apps/mobile/src/space/SpaceSurface.tsx`: removed raw current-address/path wording and numeric path labels from Space while preserving the physical-space structure.
- `apps/mobile/src/shared/uiMetadata/displayMetadata.ts`: changed space labels from numbered path terms to user-facing relative labels.
- `apps/mobile/scripts/check-metadata-leaks.mjs`: added product-facing metadata leak detection.
- `scripts/harness_validator/sections/design_governance.py`: added temporary negative fixtures proving the scanner rejects this class of leak.
- `apps/mobile/__tests__/App.test.tsx`, `apps/mobile/__tests__/LearningSurface.test.tsx`, `apps/mobile/__tests__/SpaceSurface.test.tsx`, `apps/mobile/__tests__/spaceMetadataDisplay.test.ts`: updated expectations and negative assertions for product-facing metadata leakage.
- `docs/design/app-screenshots/leadership-real-app-v1/{home,detail,space,card-list}.png`: refreshed with real simulator screenshots captured from the app after the leakage fixes.
- `docs/agent-runs/2026-06-25-visible-metadata-leakage-hardening.md`: recorded this run.

## Real app screenshots

- `docs/design/app-screenshots/leadership-real-app-v1/home.png`
- `docs/design/app-screenshots/leadership-real-app-v1/detail.png`
- `docs/design/app-screenshots/leadership-real-app-v1/space.png`
- `docs/design/app-screenshots/leadership-real-app-v1/card-list.png`

All four screenshots are real iOS simulator screenshots from the app, not reconstructed mockups.

## Commands run

- `git switch -c fix/visible-metadata-leakage origin/main` -> success.
- `npm start -- --reset-cache` in `apps/mobile` -> Metro started for simulator verification.
- `npm run ios -- --simulator "iPhone 17 Pro"` in `apps/mobile` -> app installed and launched.
- `maestro test /tmp/softbook-real-app-login.yaml` -> pass; captured `home.png`.
- `maestro test /tmp/softbook-real-app-detail.yaml` -> pass; captured `detail.png`.
- `maestro test /tmp/softbook-real-app-login.yaml /tmp/softbook-real-app-space-first.yaml` -> pass; captured `space.png`.
- `maestro test /tmp/softbook-real-app-card-list-current.yaml` and `/tmp/softbook-real-app-card-list-up.yaml` -> pass; captured `card-list.png`.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/leadership-real-app-v1/*.png` -> all four screenshots are 1206 x 2622.
- `npm run metadata-leak-scan` in `apps/mobile` -> `PASS: No metadata leaks detected in visible text.`
- `npm test -- --watch=false App.test.tsx` in `apps/mobile` -> 42 tests passed.
- `python3 scripts/validate_harness.py` after adding product fixture coverage -> `HARNESS VALIDATION OK`.
- `npm run lint -- --quiet` in `apps/mobile` -> pass.
- `npm run typecheck` in `apps/mobile` -> pass.
- `npm test -- --watch=false` in `apps/mobile` -> 26 suites passed, 155 tests passed.
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_maestro_selectors.py` -> `MAESTRO SELECTOR VALIDATION OK`.
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_visible_metadata_pr_body.md $(git diff --name-only | sed 's#^#--changed-file #')` -> `PR DESIGN GATE OK`.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_visible_metadata_pr_body.md` -> `AGENT REVIEW GATE OK`.

## Validation results

- User-visible metadata leakage scan: pass.
- Product-level negative fixture coverage in harness: pass.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Full mobile Jest: pass.
- Design metadata scan: pass.
- Maestro selector validation: pass.
- Screenshot visual review: pass for the four real simulator screenshots; no masked test phone, progress-count label, raw `馆 / 组 / 盒` path, `当前地址`, `当前学习卡位于`, or fixture count labels are visible.
- PR body design gate: pass.
- Agent review body gate: pass.
- CI validation: pending PR.

## Design review checklist

- Q1 Law of One: Learning keeps the current learning card as the dominant object; Space uses one current spatial accent and demotes secondary structure to supporting labels.
- Q2 Focal object: Learning reads focal card -> action/answer -> continuity aperture; Space reads current box -> contained cards -> sleep/favorite state.
- Q3 Silhouette: Learning keeps the single-card flow silhouette; Space keeps the accepted shelf/desk spatial hierarchy instead of a flat metadata list.
- Q4 Forbidden patterns: No gradient text, gamification chrome, full-width tabbar, pure black/white baseline, removed self-assess tokens, serifs, or visible internal metadata language introduced.
- Q5 Layout containment: Verified on 1206 x 2622 simulator screenshots; no horizontal overflow or clipped primary chrome observed.
- Q6 Surface-specific: Flip/self-assess remains two-state `有把握` / `再回看`; this change does not introduce four-state feedback or module-selection as the learning primary path.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally; PR body design gate and Agent review gate passed.
- Blocking findings: none known after local validation.

## Responsibility note

- Primary cause: development and review judgment failed to treat visible fixture/product metadata as a launch blocker in the previous screenshots.
- Secondary cause: the existing harness focused on raw field names and implementation jargon but did not cover product-facing fixture state such as masked test phone, progress-count labels, and raw numbered space paths.

## Risks and open questions

- The scanner intentionally targets concrete leak classes to avoid blocking legitimate product words such as `卡片`, `收藏`, or `休眠`.
- Further polish may improve composition, but the current blocker addressed here is metadata leakage and leadership-safe real app screenshot fidelity.
