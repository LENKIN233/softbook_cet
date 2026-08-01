# Agent Run Record: Frontend flow acceptance correction

## Task summary

- Date: 2026-08-01
- Branch: `fix/frontend-flow-acceptance`
- PR: https://github.com/LENKIN233/softbook_cet/pull/471
- Summary: Correct the Web learning/session/Space/account flow and the mobile signed-out/trial-entry semantics after the prior product flow was rejected as non-standard and unacceptable.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`
- `docs/design/mocks/pc-web-core-surfaces-v1.html`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`

## Product truth used

- Learning remains a system-sequenced single-card flow and must end or enter review explicitly rather than silently wrapping to the first card.
- Flip has exactly two self-assessment choices: mint `有把握` and amber `再回看`.
- Space is the real `library -> group -> box -> card` position system; favorite is a tag and sleep remains inside the owning box.
- The membership trial starts on the first counted entry, not from a later manual upsell button.
- Authentication must not claim exact continuity before canonical or persisted account state has been read.

## Implementation hypothesis changed

- Web Space now groups validated card `space_metadata` into the visible hierarchy instead of formatting placeholder indices.
- Web Learning has explicit learning/review/completed phases, immediate flip resolution, and a bounded review deck.
- Web development CSP uses the Vite-generated nonce path so development styles load without allowing arbitrary inline styles.
- Mobile automatically invokes the existing idempotent membership start path after authenticated persistence hydration and, for remote mode, after canonical account state is writable.

## Workspace boundary and read scope

- Active truth/source read: the specs and accepted design artifacts listed above, plus affected Web/mobile implementation and tests.
- Generated/dependency/cache/archive read: `apps/mobile/node_modules` only to diagnose and repair the local simulator bundler dependency/watch state; no generated content was treated as product truth.
- External workspace read: none. No card payload or formal content was produced or changed.

## Files changed

- `apps/web/src/App.tsx`: correct navigation, trial entry, learning completion/review, immediate flip result, real Space hierarchy, and honest account controls.
- `apps/web/src/styles.css`: style the real hierarchy, completion object, policy disclosure, and disabled controls.
- `apps/web/index.html`: add nonce-bound development style policy and WebSocket development connection support.
- `apps/web/vite.config.ts`: provide the CSP nonce used by Vite-injected styles.
- `apps/web/src/App.test.tsx`: cover canonical navigation, immediate flip, real box ownership, automatic trial, unavailable controls, and non-looping session completion.
- `apps/mobile/App.tsx`: neutral signed-out continuity copy and automatic first-entry trial start.
- `apps/mobile/__tests__/App.test.tsx`: update acceptance assertions and cover local/remote automatic trial behavior including queued server acknowledgement.
- `apps/mobile/e2e/maestro/ios-smoke.yaml`: remove obsolete manual trial action.
- `apps/mobile/e2e/maestro/ios-remote-smoke.yaml`: remove obsolete manual trial action.
- `apps/mobile/e2e/maestro/ios-space-overview-screenshot.yaml`: wait for automatic unlock instead of tapping a trial button.
- `apps/mobile/e2e/maestro/ios-space-browse-screenshot.yaml`: wait for automatic unlock instead of tapping a trial button.
- `docs/design/mapping/pc-web-core-implementation-evidence-v1.md`: record corrected implementation evidence and remaining production gaps.
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`: record the scoped auth/trial correction evidence.
- `docs/agent-runs/2026-08-01-frontend-flow-acceptance.md`: this run record.

## Commands run

- `./scripts/install_git_hooks.sh` -> passed.
- `cd apps/web && npm run typecheck && npm run lint && npm test && npm run build` -> passed.
- `cd apps/mobile && npm ci` -> restored the local dependency tree without lockfile changes.
- `cd apps/mobile && npm run typecheck && npm run lint -- --quiet && npm test -- --runInBand --watchAll=false` -> passed, 45 suites / 435 tests.
- `watchman watch-del ... && watchman watch-project ...` -> repaired stale simulator file visibility after npm install.
- In-app browser flow -> passed Auth, immediate flip, five interaction sequence, explicit completion/review, real Space ownership, automatic trial, and disabled account controls.
- iOS simulator render -> passed corrected signed-out Learning auth object at the target phone frame.
- `maestro test e2e/maestro/ios-smoke.yaml` -> not run because this machine has no Java runtime; Jest and manual simulator evidence remain available, and this limitation does not count as a passing Maestro run.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:/opt/homebrew/opt/ruby@3.3/bin:$PATH ./scripts/run_local_gates --profile pr --base origin/main --pr 471 --fail-fast` -> 32/36 passed before the strict local repository-health check failed. The failure is workspace/governance state, not a product-test failure: 9 existing worktrees, 16 existing topic branches reported without upstreams, and local required-check expectations not recognizing `android-release`. No user worktrees or branches were deleted to manufacture a pass.

## Validation results

- Web typecheck, lint, 11 tests, production build, and development/production boundary scan passed.
- Mobile typecheck, lint, metadata leak scan, dependency compatibility check, and all 435 Jest tests passed.
- Browser DOM and visual inspection confirmed that the selected `转折关系` box contains only its two owned cards and that the session completes after card 5.
- iOS simulator visual inspection confirmed neutral first-time/returning auth copy and contained phone layout.
- Full repository harness passed.
- Local development gates completed with 23/24 checks passed and one documented safe exception: the machine runs Node `25.9.0` while the repository pins `22.13.0`. The development profile therefore reported `deferred`; the product tests and validators themselves passed.
- PR body Agent review and design gates passed locally. GitHub `design-artifact-gate`, `validate-harness`, `agent-review`, `mobile-quality`, `web-quality`, `backend-contract`, `dependency-security`, `repo-health`, `evidence-archive`, and `formal-approval` passed on the first pushed head; iOS/Android release jobs were still running when this record was updated.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. Local screenshots were inspected but not committed as ordinary Git content.

## Agent review status

- Reviewer: Codex
- Status: passed
- Blocking findings: none
- Review summary: reviewed the complete diff against the cited product, interaction, membership, Space, visual-language, and runtime contracts. The review corrected one final review-deck loop before sign-off; no unresolved blocking findings remain in the repository change.

## User-visible UI impact

- Web users now get a standard session end/review flow, real hierarchical Space browsing, Chinese route labels, immediate flip self-assessment, automatic trial entry, and honest unavailable account controls.
- Signed-out mobile users no longer receive false claims that a learning/space/statistics position already exists; authenticated first entry starts the trial automatically.

## Design review checklist

- Q1 — accent ownership: Learning keeps the current card as the dominant coral object; Space gives the selected path one dominant state while sibling hierarchy stays neutral; the account gate remains neutral. No screen introduces competing library accents.
- Q2 — focal-object hierarchy: the current card, selected card box, session-complete object, and account object remain the focal objects. Attached result/state follows the focal object and route chrome remains subordinate.
- Q3 — product silhouette: all five Learning interaction silhouettes remain intact; Space still reads `library -> group -> box -> card`; completion is a terminal Learning state, not a dashboard or replacement route.
- Q4 — visual prohibitions: no gradient text, gamified score ring, full-width desktop tab bar, pure black/white field, serif editorial treatment, or four-state self-assessment was introduced.
- Q5 — containment: the corrected Web flow was inspected at `1280 x 720` and the mobile auth object on an iPhone 17 simulator. No horizontal overflow, clipped primary action, or covered navigation was observed. `1024px`/`200%` desktop zoom remains a release-evidence gap, not a claimed pass.
- Q6 — interaction constraints: Flip still exposes exactly two choices, `有把握` in mint and `再回看` in amber, and now resolves immediately. Statistics remains a quiet ledger and Learning does not add a module picker.
- AP-22 / VL-AP-07: browser and simulator inspection covered hierarchy, state colors, containment, disabled controls, and explicit terminal states; the remaining production gaps are recorded in the implementation mappings.
- AP-23: automated Web acceptance proves exactly two self-assessment choices and the removal of the redundant confirmation step; mobile retains the same two-state contract.

## Card make external workspace impact

- N/A. No card content, card source, or approval payload changed.

## Risks and open questions

- Production Web remote authentication, canonical bootstrap, sync, payment/restore/deletion, audio, and hosting headers remain explicit release gaps.
- The local machine lacks a Java runtime, so the updated Maestro smoke YAML could not be executed here; selector validation and CI must still pass.

## Follow-up

- Run repository harness, open the PR, record Agent review, wait for required checks, and merge only after all blockers are clear.
