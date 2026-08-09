# Agent Run Record: Mobile visual rebuild v4

## Task summary

- Date: 2026-08-08
- Branch: `cross/mobile-visual-rebuild-v4`
- PR: `https://github.com/LENKIN233/softbook_cet/pull/483` (draft)
- Scope: design-only mobile visual rebuild after explicit product-owner veto;
  no React Native implementation is authorized.
- Current status: `completed_no_promotion`. The first v4 rendered revision was
  independently rejected; the final
  eight-document exact cohort also has no qualified candidate, selected leader,
  accepted design, or RN implementation authority.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/single-card-ux-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`

## Product truth used

- Softbook is a CET4/6 product for Chinese university students, not a generic
  English-learning or vocabulary-selection app.
- Learning is system-sequenced and single-card. One task, one strongest action,
  registered feedback, explanation, recovery, and next-card continuity own the
  first read.
- Flip, four-choice, lock, elimination, and swipe require materially different
  silhouettes. Flip alone uses exactly `有把握` and `再回看`.
- Space preserves library → group → box → card. Favorite is a tag and
  sleep/wake is a reversible physical-zone operation.
- Top-level order is `学习 / 空间 / 统计 / 我的`; Auth is a separate successive
  phone → code gate with recovery.
- Trial/Free/Premium, contextual access limits, purchase/restore on every
  release target, and shared cross-platform entitlement are product truths;
  controlled-pilot grants remain server-audited and cannot be self-granted.
  The formal counted Trial entry is operationally the first successful
  authenticated Learning-session entry after canonical validation, selection
  generation, and cursor persistence; successful login alone does not consume
  Trial.
- Peek/favorite/hint/sleep retain their contracted visibility, while membership
  checks remain background behavior. Audio stays optional, card-owned,
  explicit-play only, and URL-free rather than a sixth interaction family.
- iOS and Android have equal priority. Tablet is a separate composition rather
  than a stretched phone layout.
- Learner artifacts cannot expose reviewer, process, repository, runtime, test,
  or internal-storage language.

## Product truth versus implementation hypothesis

- The statements above are `product_truth`.
- Exact color values, font weights, spacing, radii, surfaces, navigation
  presentation, pane ratios, and the eight candidate compositions are
  `implementation_hypothesis` until one exact rendered learner revision is
  accepted.
- Aurora glass, black selected capsules, lilac/gray shell, Soft Spine hardware,
  navy/rose/lime experimentation, warm editorial styling, universal large
  radii, and one shared skinnable device frame are rejected hypotheses.

## Phase 0 governance result

- The product-owner rejection of v3 and exact `mvr-15` evidence was registered
  in commit `df0cf9d`.
- Existing learner/reviewer SHAs were preserved as rejected historical evidence.
- The rejection commit was pushed to the existing v3 draft branch and also
  became the base of this v4 branch.

## First v4 revision rejection

The initial `candidate-proofs/learner-proofs.html` failed independent review:

- eight CSS skins shared one learner DOM and were not materially different;
- flip announced success before self-assessment and had no operable next card;
- four core interaction families were prose-only;
- Space controls were static;
- Android 1024 × 768 navigation covered the task;
- Auth back/history and successive states were broken;
- multiple accessibility states and earlier browser claims were not bound to
  the exact failing artifact.

The prior provisional-leader and 8.0/10 statements were withdrawn. The old
96/192-case counts are not reused as evidence for the rebuild.

## Files produced

- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/context-pack.md`
- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/ux-architecture.md`
- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/platform-and-color-rules.md`
- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/candidate-blueprints.md`
- eight candidate records and the associated comparison/review records
- separate learner HTML files plus `candidate-proofs/learner-core.css` and
  `candidate-proofs/learner-runtime.js`
- `candidate-proofs/reviewer-gallery.html`, a reviewer-only one-way iframe
  consumer that does not execute inside learner documents
- `visual-history-audit.md`, a diff-grounded review of the complete accessible
  post-cutover mobile visual lineage and active/rejected output families
- `next-synthesis-plan.md`, a proposal-only role, platform, route, motion,
  audio, accessibility, evidence, and stop-gate plan for a new search
- `browser-evidence.md`, the exact browser-only narrow/reflow evidence and its
  native non-claims
- this agent run record

## Validation scope and completion

- Static syntax, candidate-bound evidence, metadata quarantine, design-search
  validator, design-search harness regression, and `git diff --check`.
- Real browser completion of all five interaction loops for all eight exact
  learner files.
- Space browse/favorite/sleep/wake/return and Auth phone/code/error/resend/retry/
  edit/back completion.
- iOS 390 × 844 and Android 390 × 844 terminal checks, plus one bounded real-
  iframe 1024 × 768 containment measurement for mvn-08 Lock only.
- 320px, 200% text, focus order, `aria-current`, disclosure semantics, live
  announcements, target floors, and no-overlap checks. A complete final-
  composite contrast matrix was not established.
- Independent UI/UX review on the exact final files. Any P0/P1 blocks candidate
  advancement; it does not reopen this completed no-promotion run. Only a later
  promotion attempt starts a new synthesis/review lifecycle.

## User-visible UI impact

- Design-only browser artifacts are added; shipped app code is unchanged.
- Learner and reviewer documents are physically separate. The final handoff
  will link learner documents directly and will not default a product owner
  into the reviewer gallery.

## Workspace boundary

- No changes to `apps/mobile`, backend, release evidence, content payloads, or
  `/Users/lenkin/programing/card make`.
- Illustrative task copy is design evidence only and is not formal card-content
  production or approval.

## Stop boundary

No candidate is accepted. Even a fully operable browser proof remains an
implementation hypothesis until the product owner selects an exact learner
revision and its evidence is frozen. Only then may a separate RN change begin.

## Implementation hypothesis changed

- Replaced one shared skinnable learner DOM with eight physically separate
  learner documents and a reviewer-only iframe gallery.
- Added a shared proof runtime for truthful flip, multiple-choice, lock,
  elimination, swipe, Space, and Auth behavior without changing product truth.
- Added real pointer-drag and keyboard-equivalent Swipe behavior, visible local
  validation, semantic correct/incorrect states, and one committed next action.
- Added a browser `speechSynthesis` lifecycle only to prevent a false audio
  affordance in the design proof. It is not a formal content asset or production
  audio implementation.
- Added short-phone corrections across the cohort to remove measured CTA /
  navigation overlap while preserving text and 44px iOS / 48px Android target
  floors. At tablet size, only mvn-08 Lock received a bounded correction and CTA
  measurement; the other candidates have no measured 1024px evidence.
- None of these hypotheses is accepted. Final independent review rejects all
  eight exact candidates and permits only a new synthesis.

## Workspace boundary and read scope

- Read the visual-task authority set listed under `Referenced specs`, the
  relevant design-harness and interaction-motion documents, active visual
  history, and the rejected-v3 lifecycle record.
- Did not use archived visual prose as active truth.
- Did not change `apps/mobile`, native projects, backend/runtime contracts,
  release evidence, card payloads, or the external card-content workspace.

## Files changed

- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/`: context,
  architecture, platform/color rules, eight candidate records, exact learner
  proofs, reviewer gallery, strict/hard-filter/pairwise/no-promotion records,
  fragment harvest, mutation log, exact browser evidence, accessible visual
  history audit, next-synthesis proposal, and external prototype map.
- `docs/design/search-runs/README.md`: v4 run lifecycle entry.
- `docs/design/rejected/mobile-visual-rebuild-v4-no-promotion-2026-08-08.md`:
  durable recurring-failure sedimentation and forbidden-reuse boundaries.
- `scripts/check_design_metadata_leaks.mjs`: structural learner-root support
  without allowing comments, scripts, styles, or strings to impersonate the
  boundary.
- `scripts/test_check_design_metadata_leaks.mjs`: learner/reviewer boundary
  regression coverage.
- `docs/agent-runs/2026-08-08-mobile-visual-rebuild-v4.md`: this record.

## Commands run

- `git log --all`, path-scoped visual history, and `git show`/content diffs for
  the complete accessible post-cutover mobile visual lineage
- `node --check .../candidate-proofs/learner-runtime.js`
- `node --test scripts/test_check_design_metadata_leaks.mjs`
- `node scripts/check_design_metadata_leaks.mjs`
- `python3 scripts/validate_design_search_run.py --run ... --skip-templates`
- `python3 scripts/validate_harness.py --section design_search_regressions`
- `git diff --check`
- Real in-app-browser interaction, layout, accessibility-state, and
  leakage checks against cache-busted exact learner URLs.

## Validation results

- Runtime syntax: passed.
- Metadata scanner regression: 31 / 31 passed, including structural learner-root
  and reviewer-audience impersonation failures for comments, scripts, styles,
  attributes, nested markers, duplicate attributes, missing audience, and
  duplicate bodies.
- Learner metadata quarantine: passed; no visible candidate/reviewer/process
  language or quarantined real storage labels were detected.
- Accessible visual-history audit: completed from root history cutover through
  `origin/main@7960ebd`, the controlled-pilot contract/design/mobile side refs,
  rejected editorial/v3 branches, and the v4 output family. No current or
  historical mobile visual package qualifies as replacement authority.
- Next-synthesis proposal: independently challenged against the exact v4
  outputs and platform/product constraints. Its color, icon, material, route,
  tablet, motion, audio, accessibility, user-test, and rejection gates remain
  proposal-only and create no design or implementation authority.
- All five Learning families have operable question → commit → result → next
  loops; Swipe pointer drag and keyboard direction are independently verified.
- Representative Space browse → group → box → card → favorite → sleep → wake →
  Learning and Auth phone → code → error → resend/edit/back → success paths are
  operable in all eight exact documents.
- Final 390 × 844 iOS and Android checks: no horizontal overflow and no primary
  CTA / bottom-navigation overlap; four-choice remains 2 × 2 and active control
  floors remain 44px / 48px.
- 320 × 844 with browser 200% text: 80/80 initial-state frames passed across
  eight candidates, iOS/Android hypotheses, and five Learning interactions;
  `innerWidth = clientWidth = scrollWidth = 320`, minimum targets were 44px
  iOS / 48px Android, and no controls escaped or clipped. Exact reproduction
  and measured fields: `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/browser-evidence.md#narrow-200-final`.
  This does not substitute for native OS text scaling or assistive-technology
  evidence.
- 1024 × 768 mvn-08 Lock: CTA is visible at y=671–719 on iOS and y=689–737 on
  Android; other tablet candidates remain below product-grade visual quality.
- The exact browser run did not bind a complete final-composite contrast matrix.
  Native safe-area, IME, VoiceOver/TalkBack, formal audio, and physical-device
  evidence remain open.
- Design-search validator: passed.
- Design-search harness regression: passed (`HARNESS COMPLETENESS PARTIAL` is
  the expected report for the selected two-section validation scope, not a
  failure).
- Final `git diff --check`: passed.

### Local PR profile snapshot

- The first `./scripts/run_local_gates --profile pr --base origin/main --pr 483
  --verbose` snapshot completed all 36 gates against HEAD `df0cf9d` plus tracked
  edits: 31 passed and 5 failed. It did not include the then-untracked v4
  artifact cohort in the commit diff and is not final-scope validation. Exact
  ignored local report:
  `exports/local-gates/20260808T173927Z-df0cf9d0-pr-65068/report.json`.
- After all 49 files were committed and the structured remote PR body was
  published, the same command ran against substantive exact HEAD `4e0780a`:
  33 of 36 gates passed. Exact ignored local report:
  `exports/local-gates/20260808T182942Z-4e0780aa-pr-37934/report.json`.
  `pr-design-gate`, `agent-review`, complete full harness, design-scanner tests
  (31/31), design metadata scan, mobile lint/typecheck/Jest (45 suites / 437
  tests), Web lint/typecheck/Vitest/build, backend tests (206), evidence, and
  repository health regression tests all passed on that committed cohort.
- In the first snapshot, `pr-design-gate` and `agent-review` failed because it
  consumed the old one-paragraph draft PR body. The replacement structured PR
  body was published and both gates passed in the exact committed-cohort run.
- The three remaining exact-scope failures are not evidence that this design is
  promotable and remain
  explicit repository/environment blockers: local Node 25.9.0 versus required
  22.13.0 and Ruby 2.6.10 versus required 3.3.x; ten pre-existing high mobile
  dependency findings across `image-size` and `js-yaml`; and
  `repo-health-strict` losing Git worktree context while invoking
  `git status --porcelain`.
- This local report is development evidence only. It is not a GitHub required
  check, product-owner approval, native-device proof, or launch evidence.

## Binary evidence

No binary screenshot is committed as design authority. Evidence is bound to the
exact tracked learner HTML/CSS/JS artifacts and reproducible cache-busted browser
states. Reviewer-gallery screenshots are inspection aids only.

## Agent review status

- First shared-DOM revision: independently rejected.
- Final exact eight-document cohort: independently reviewed; **no candidate
  qualifies**.
- `mvn-08` is only the narrow final pairwise result. It is not a reusable
  ingredient, promoted candidate, accepted artifact, shortlist entry, tablet
  seed, or implementation authority.
- No v4 candidate or named combination supplies the next synthesis skeleton.
  Only candidate-independent requirements—reachable phone action, legible Space
  ownership, conditional tablet context, and readable four-choice/body rhythm—
  carry forward; their geometry must be derived again.
- The next-synthesis proposal was separately challenged against all eight
  outputs and active platform/product contracts. It now requires a later
  population of at least eight materially different, equally complete systems
  without preselecting blue, coral, geometry, navigation treatment, or motion;
  requires platform icon families instead of Unicode glyphs; removes permanent
  empty tablet panes; and blocks route-chrome and semantic-copy leakage. A
  follow-up audit removed the expanded blue example so no candidate receives
  extra detail before the grayscale gate.

### 2026-08-09 final-goal preservation re-review

Before opening the proposed grayscale UX-architecture phase, the previous step
was reviewed again against the final goal: one explicitly accepted mature CET
mobile design, followed by real iOS/Android/tablet implementation and current PC
Web parity evidence. The re-review found four ways the record could bias or
truncate that goal despite its correct no-promotion verdict:

1. several documents still described mvn-05 + mvn-07 + mvn-08, with mvn-01
   tuning, as a primary or reusable skeleton;
2. an expanded “unselected” blue candidate gave one future direction concrete
   color and geometry before the other seven;
3. Trial timing was incorrectly framed as pilot-only even though the formal
   owner and Learning-session runtime already define the counted entry after
   canonical validation, selection generation, and cursor persistence; and
4. the plan covered mobile variants without explicitly preserving semantic and
   capability parity with the separately accepted PC Web direction.

The record now removes all named-candidate geometry, order, ratio, color, and
composition inputs; keeps only candidate-independent product/platform tests;
starts the next phase with a neutral grayscale state contract; corrects the
formal Trial trigger and treats successful login alone as insufficient; and
adds PC Web parity as a final-target boundary. A final phrase scan also removed
residual references to mvn-08 as a tablet “input” or “structural seed,” two
pairwise “ingredient” labels, one “synthesis-input” label, and the context pack's
permission to inherit editorial, shelf-desk, answer-slip, or ledger structures.
Runtime validation/selection/cursor predicates remain internal and are not
future learner copy.

These corrections do not accept a design, create a visual direction, or
authorize RN. They make the completed failure record safe as constraint and
provenance input for a separately reviewed design-only phase.

Re-review validation on the corrected working cohort:

- `git diff --check`: passed;
- `node --test scripts/test_check_design_metadata_leaks.mjs`: 31/31 passed;
- `node scripts/check_design_metadata_leaks.mjs`: passed;
- `python3 scripts/validate_design_search_run.py`: passed; and
- `python3 scripts/validate_harness.py`: passed.

Independent reviewer `visual_commit_audit` then re-reviewed the corrected exact
working cohort. Status: **Passed**, with no P0/P1, for the
`completed_no_promotion` record only. The reviewer confirmed that historical
composition/order/metaphor and every mvn fragment remain diagnostic provenance,
the Trial runtime predicate cannot become learner copy, and the lifecycle still
creates no accepted design, promotion, or RN authority. The reviewer modified
no files.

## Card make external workspace impact

None. `/Users/lenkin/programing/card make` was not read or modified, and no
candidate card batch, approval, formal content volume, or production audio asset
was created in this repository.

## Risks and open questions

- No unified mature palette or platform-quality icon family is accepted.
- iOS/Android differentiation remains too cosmetic; ripple/pressed and native
  navigation behavior require a new design artifact and real-device proof.
- Causal motion, reduced-motion behavior, complete Auth/Space pending-error-
  retry flows, full-library deep links, and product-grade tablet composition are
  unresolved.
- Browser TTS is not approved content audio; formal asset, cache, privacy, and
  native playback evidence remains absent.
- Product-owner selection of a replacement is unresolved. The PR may merge only
  as an accurate no-promotion failure record after its own review and required
  gates pass; whether or not that record merges, no RN change may cite this run
  as implementation authority.

## Follow-up

Follow `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/next-synthesis-plan.md`
as a proposal for a new exact search rather than polishing one failed candidate.
Start with the complete grayscale state architecture; redraw semantic color,
platform navigation/icons, and route-specific chrome; complete motion, recovery,
formal audio, all-library, tablet, native accessibility, and representative-user
evidence; then request explicit product-owner acceptance before any RN mapping or
implementation.
