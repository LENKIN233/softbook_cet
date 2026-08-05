# Agent Run Record: Mobile Aurora interaction hierarchy

## Task summary

- Date: 2026-08-05
- Branch: `fix/mobile-aurora-interaction-hierarchy`
- PR: `https://github.com/LENKIN233/softbook_cet/pull/480`
- Summary: Replaces the overused black/gray mobile emphasis with the accepted Aurora canvas and one current-library identity color, repairs the Learning flip-card hierarchy, quiets competing Statistics/Mine actions, and removes the Space overlap reproduced at 200% font scale.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`

## Product truth used

- Learning remains one system-sequenced current card; Space keeps the library / group / box / card hierarchy; Statistics and Mine remain supporting surfaces.
- The current library owns the one dominant subject color. Other library colors do not compete on the current screen.
- Flip self-assessment remains exactly two choices: mint `有把握` and amber `再回看`.
- iOS and Android have equal mobile priority, while tablet uses the dedicated sidebar shell.

## Implementation hypothesis changed

- The neutral canvas is no longer implemented as a black/gray visual theme. A warm Aurora-neutral background and translucent or opaque platform-appropriate panels now carry one dynamic current-library accent.
- Primary CTAs, active navigation, address edges, and the current object share that accent. Black remains typography and the accessible foreground on bright identity colors; it is not a theme surface.
- The flip card no longer expands to fill unused viewport height. Its action dock stays attached directly below the task, leaving external Aurora negative space.
- Mine keeps one strong Learning-continuity action; membership purchase is rendered as a quiet accent outline so it does not compete.
- At accessibility font sizes, each route remounts its scroll container at the top. Space removes fixed/absolute overlapping card geometry, stacks contained cards, and places return-to-Learning actions vertically.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs/design artifacts, shared mobile shell, Learning, Space, Statistics, Mine, tests, Maestro flows, and repository delivery scripts.
- Generated/dependency/cache/archive read: mobile `node_modules`, Web/CloudBase `node_modules`, CocoaPods output, Xcode DerivedData, Android emulator state, iOS simulator state, Maestro debug captures, and local screenshots were used only for validation and were not treated as product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or changed.

## Files changed

- `apps/mobile/App.tsx`: dynamic library palette, Aurora background, transparent phone header, quiet Mine membership action, high-contrast accent labels, accessibility route scroll reset, and Space accessibility-layout wiring.
- `apps/mobile/src/learning/LearningSurface.tsx`: intrinsic flip-card height and attached action-dock spacing.
- `apps/mobile/src/space/SpaceSurface.tsx`: 200% font-size containment via stacked cards and vertical continuity action.
- `apps/mobile/src/statistics/StatisticsSurface.tsx`: accessible foreground for the accent check-in action.
- `apps/mobile/__tests__/App.test.tsx`: Aurora/dynamic accent and canonical warning-token expectations.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: intrinsic flip-card/action-dock expectations.
- `apps/mobile/__tests__/SpaceSurface.test.tsx`: accessibility stacking and no-overlap style contract.
- `docs/agent-runs/2026-08-05-mobile-aurora-interaction-hierarchy.md`: this authority, validation, and review record.

## Commands run

- `npm ci` in `apps/mobile`, `apps/web`, and `infra/cloudbase/functions/softbook-api` -> completed with zero reported vulnerabilities.
- `npm test -- --runInBand` in `apps/mobile` -> passed, 45 suites / 437 tests.
- `npm run typecheck`, `npm run lint -- --quiet`, metadata scans, and `git diff --check` -> passed.
- WCAG contrast calculation for black text on all seven library identity colors -> 4.95:1 to 11.17:1, all at or above AA normal-text contrast.
- iOS Debug build/install on iPhone 17 Pro and iPad mini; Android Debug app connected to the exact Metro worktree -> completed.
- Real Maestro current-user flows on iPhone 17 Pro, Android emulator, and iPad mini -> completed all five interaction families, Space browse/favorite/sleep recovery, completion, Statistics check-in, Mine, and cross-route navigation.
- Android system font scale `2.0` and iOS Dynamic Type `accessibility-extra-large` route/accessibility flows -> passed after the Space stacking correction; system settings were restored.
- `./scripts/run_local_gates --profile pr --base origin/main` before dependency/toolchain alignment -> partial only; mobile gates and dependency security passed, while missing Web/CloudBase installs, wrong Node/Ruby, worktree-local hooks, and absent PR context failed. This report is not claimed as green evidence.
- Repository Node 22.13.0, Ruby 3.3.12, and Python 3.12.13 `run_local_gates --profile dev` after dependency/hook alignment -> passed, 24/24 gates.
- `python3 scripts/validate_harness.py --format text` with exact PR context -> `HARNESS VALIDATION OK`.

## Validation results

- Functional: iPhone, Android, and iPad each completed real navigation and interaction flows; no action became unreachable and no flow stopped.
- Visual: normal phone Learning uses one indigo current-library focal color, a bounded intrinsic card, and Aurora negative space. Mine has one strong continuation object. Statistics stays a quiet ledger. iPad uses the coral neutral/account state before login and the dynamic library tone after authentication.
- Accessibility: Android 200% originally reproduced overlapping two-column Space cards. The final version stacks them and the return action; Android and iOS large-text route flows pass without horizontal overflow or clipped navigation.
- Platform: iPad evidence came from a clean CocoaPods install and a newly compiled/installed Debug app, not a stale cached bundle.
- Repository: the complete `dev` local-gate profile passed 24/24 against the worktree; exact PR-context checks remain pending until the branch has an open PR.

## Binary evidence

- Evidence manifest: N/A. Simulator/emulator captures are local development evidence and remain `gate_eligible=false`.
- Archive: N/A.
- Local screenshot references: `/tmp/softbook-aurora-ios-final-learning.png`, `/tmp/softbook-aurora-android-current.png`, `/tmp/softbook-aurora-ipad-installed.png`, and `/tmp/softbook-aurora-android-space-font200-fixed-cta.png`.

## Agent review status

- Reviewer: Codex exact-head UI/UX and implementation review of `65bdd2d927f97bce4c49a80e4c1814a3b7a9c199`.
- Status: passed locally.
- Blocking findings: none in the implemented scope.
- Review summary: the corrected hierarchy follows the accepted current-object grammar and Law of One; the dynamic subject accent carries action/selection continuity, supporting actions are quieter, and large-text layouts remove fixed geometry before rendering rather than hiding overflow.

## User-visible UI impact

- Yes. The mobile product no longer reads as a black/white/gray theme. The shared canvas is Aurora neutral, and the current library supplies the single strong color. Black is limited to readable text and icon foreground where it passes contrast.
- Accepted design source: `docs/design/decisions/mobile-core-surface-reset-v1.md` and `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` current object / action / tool / Space continuity regions.
- Interaction/motion artifact: `docs/design/interaction-motion/learning-core-interactions-v1.md`; interaction state semantics and motion meaning are unchanged.
- Physical-space artifact: `docs/design/physical-space/space-state-baseline-v1.md`; library/group/box/card meaning and favorite/sleep semantics are unchanged.
- Unimplemented design gaps: physical handset evidence, landscape review, production remote-state variants, and release/launch evidence remain outside this change.

## Design review checklist

- Q1 Law of One: one current-library identity color drives CTA, active route, current object, and Aurora atmosphere. Mint/amber appear only for self-assessment semantics.
- Q2 Focal object: Learning reads current card -> attached operation -> secondary tools -> floating chrome. Space reads address -> current box/cards -> return action. Statistics and Mine remain quieter.
- Q3 Silhouette: flip is an intrinsic current-card object; the other four interaction families retain their distinct shapes. Space preserves an opened box and contained objects, becoming a vertical stack only when font size requires it.
- Q4 Forbidden patterns: no gradient title, achievement chrome, full-width rectangular tab bar, serif typography, raw metadata, four-level self-assessment, or red `再回看` is introduced.
- Q5 Containment: iPhone, Android, iPad mini, Android 200%, and iOS accessibility Dynamic Type were rendered and operated. The reproduced Space overlap is absent in the final capture.
- Q6 Surface-specific: Statistics uses tabular/quiet ledger treatment; Learning remains system sequenced; flip remains exactly `有把握` / `再回看`.
- AP-22 / VL-AP-07: all universal and conditional questions are answered above with real native rendering evidence.
- AP-23: `有把握` remains mint and `再回看` remains amber; neither is expanded to four levels or represented with red.

## Card make external workspace impact

- N/A. No candidate card, approval batch, payload, or external content workspace file changed.

## Risks and open questions

- Simulator/emulator validation is not physical-device or launch evidence.
- Web retains its separately accepted PC workbench light/dark system; this patch changes the shared React Native iOS/Android/tablet implementation only.
- Production SMS, CloudBase, payment, private content, and release readiness are unchanged and not claimed.

## Follow-up

- Commit and push the exact implementation head, open a PR with design mapping and checklist evidence, run exact-PR gates and agent review, and merge only after required checks are green.
