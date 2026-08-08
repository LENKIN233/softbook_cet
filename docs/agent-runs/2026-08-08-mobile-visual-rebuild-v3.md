# Agent Run Record: Mobile visual rebuild v3

## Task summary

- Date: 2026-08-08
- Branch: `cross/mobile-visual-rebuild-v3`
- PR: `https://github.com/LENKIN233/softbook_cet/pull/482` (draft)
- Summary: Freeze the product-owner-rejected mobile visual directions, run a
  design-only search for materially different mobile systems, record the Phase
  1 strict-review failure, and correct the exact `mvr-15` code-native proof in
  Phase 2 without changing React Native.

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
- `spec/membership.json`
- `spec/visual-language.json`
- `spec/doc-manifest.json`
- `spec/agent-run-record.json`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/storyboards/learning-space-motion-prototype-v1.md`

## Product truth used

- Learning remains a system-sequenced, operable single-card flow with exactly one focal object and one primary action.
- The five core interaction silhouettes remain distinguishable; flip keeps exactly two self-assess choices: `有把握` and `再回看`.
- Space remains the visible `library -> group -> box -> card` physical hierarchy, with favorite as a tag and sleep as a physical zone.
- Learning and Space preserve object continuity, and iOS and Android remain equal-priority release targets with a dedicated tablet composition.
- Library identities remain stable and Law of One limits a screen to one dominant current-library accent.
- Auth remains a dedicated gate until canonical account hydration completes;
  Mine exposes account and unified membership truth without starting a trial by
  page view.

## Implementation hypothesis changed

- Aurora glass, lilac canvas, VisionOS capsule chrome, oversized universal radii, fixed neutral-heavy palette, and the closed orange editorial direction are treated as rejected implementation hypotheses rather than product truth.
- The replacement visual system remains `candidate_exploration` until independent review and explicit product-owner acceptance. This design-only branch does not authorize React Native implementation.
- Governance is split into two non-substitutable gates: Phase A accepts an exact
  code-native design proof after semantic/keyboard/focus/live-state review,
  platform composition hypotheses, representative-user testing, independent
  review, and an exact product-owner decision; Phase B later validates a
  separate RN implementation on real platforms and assistive technology.
  Product-owner design acceptance is not merge or release approval.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs and design artifacts above;
  current `apps/mobile/src/learning/localCardRecords.ts` only as behavior and
  development-fixture context, never as visual authority or formal content
  approval.
- Generated read: early generated composition sketches were visually inspected
  during exploration, then excluded from ordinary Git and from the durable
  evidence set because they contained non-fixture copy and cannot satisfy
  P0-08. Dependency trees were rebuilt only to run locked local gates; cache and
  archive content were not used as semantic context.
- External workspace read: none. The sibling `/Users/lenkin/programing/card make`
  workspace was not read or changed. Existing repository development card
  fixtures are reused only as design-proof display text and are not counted or
  promoted as formally approved cards.

## Files changed

- `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v3/**`: complete
  design-search context, rubric, UX matrix, 15 candidate records, rendered
  proofs, rejection evidence, pairwise reviews, conditional shortlist record,
  and code-native `mvr-15` proof.
- `docs/design/rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`
  and related lifecycle/index files: freeze Aurora/lilac/capsule and closed
  orange editorial directions as rejected hypotheses.
- `spec/doc-manifest.json`: register only the durable product-owner veto record;
  no `mvr-15` candidate or design-search artifact is promoted to accepted
  authority.
- `scripts/check_design_metadata_leaks.mjs` and
  `scripts/test_check_design_metadata_leaks.mjs`: cover canonical user-visible
  labels while retaining quarantine enforcement.
- Historical mobile/PC-web mock and candidate-proof files plus their decision,
  mapping, rejection, and index records: quarantine revoked mobile authority
  and correct canonical user-visible labels without making those artifacts
  current design authority.
- `docs/agent-runs/2026-08-08-mobile-visual-rebuild-v3.md`: this durable run record.

## Commands run

- `./scripts/install_git_hooks.sh` -> hooks installed for the repository before design work.
- `python3 -m http.server 4173 --bind 127.0.0.1` -> local design-proof rendering server started.
- Phase 1 browser baseline -> **FAIL**: choice truth/continuation and result return
  were broken; bottom navigation was full-width; Statistics/Mine routes were
  dead; focus/base type/audio clock and non-color identity were incomplete; and
  lock, elimination, swipe, Auth, membership, and full auxiliary-surface states
  were absent.
- Phase 2 browser-operated review -> exercised truthful correct/incorrect choice,
  next-card progression, result -> Space -> result return, bounded live routes,
  all five fixture-bound silhouettes, audio idle/loading/playing/pause/error/
  retry, Statistics/check-in, Mine/membership, Auth recovery/hydration, and
  type/platform controls against the served HTML. The exercised recovery set
  includes P0-17 evaluation/assessment/favorite/sleep-wake pending, error,
  retry, and preserved-committed-truth states; Auth phone-invalid, code-expired,
  resending, cooldown, request-network-error, and verify-network-error states;
  focus and route-live recovery; Lock/Elimination post-result CTA handoff; and
  Swipe below-threshold, past-threshold, cancel, keyboard, and reduced-motion
  button-alternative paths. A final semantic correction prevents dedicated Auth
  from announcing the previously visited hall; it now announces `身份认证` while
  the product header and navigation remain hidden.
- Frozen proof digest -> `shasum -a 256 .../mvr-15-soft-spine.html` returned
  `98c1b28c6cf87d85bd92fe637a8789f59975bae83907246497294d1f72f87471`.
- Proof-frame count -> `rg -o 'class="proof-card' ... | wc -l` returned `29`.
- Platform-frame audit -> iOS and Android each include exact 320, 360, 393,
  and 430 px frames.
- Browser 100% and 200% audit -> all 29 named frames had zero horizontal
  overflow and zero visible interactive controls below 44 x 44; required primary
  or recovery actions remained reachable in the audited compositions.
- Statistics composition audit -> the 393 x 852 reference frame measured 11.8%
  unexplained blank area.
- Radius audit -> product UI converges on 8 px controls, 12 px surfaces, 20 px
  focal objects, and pills; device shells, iOS IME top corners, keycaps, and
  circular icons remain named hardware or graphic exceptions.
- First `./scripts/run_local_gates --profile pr --base origin/main` -> non-green:
  22/36 passed, 12 failed, and 2 deferred. The failures were attributable to
  unpinned local Node 25/Ruby 2.6, missing or broken mobile/web/backend dependency
  trees, absent open-PR context, the current dependency-security report's 10
  mobile high advisories, and sandbox repo-health worktree detection. They are
  environment/dependency/security/PR-context/repo-health findings, not defects in
  the design proof and not evidence of a green PR gate.
- After selecting Node 22.13.0 and Ruby 3.3.12 and rebuilding the locked mobile,
  web, and backend dependency trees,
  `./scripts/run_local_gates --profile dev --base origin/main` -> 24/24 passed.
  Its ignored, local-only report is
  `exports/local-gates/20260808T101825Z-7960ebd2-dev-812/report.json`; it does
  not replace the strict PR profile, which must be rerun with open-PR context.
- `node --test scripts/test_check_design_metadata_leaks.mjs` -> final result
  recorded below.
- `node scripts/check_design_metadata_leaks.mjs` -> final result recorded below.
- `python3 scripts/validate_design_search_run.py --run docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v3` -> final result recorded below.
- `python3 scripts/validate_harness.py --section design_search_regressions` -> final result recorded below.
- `git diff --check` -> final result recorded below.
- Initial `gh auth status` failed because the stored `LENKIN233` token was
  invalid. A final recheck succeeded with the active `LENKIN233` account and
  `repo` / `workflow` scopes, so publication is no longer auth-blocked.
- GitHub App PR creation returned `403 Resource not accessible by integration`;
  authenticated `gh pr create` was used as the permitted fallback and created
  draft PR `#482` against `main`.

## Validation results

- Design-search structure validation: passed for the complete run.
- Metadata quarantine test suite: passed.
- Metadata quarantine validation: passed; no raw production metadata was added
  to user-visible proof pixels.
- Harness design-search regression validation: passed.
- Diff hygiene check: passed.
- Real browser composition/state audit: completed for the explicitly claimed
  Phase 2 code-native proof scope across 29 frames at 100% and 200%, including
  the 44 x 44 target floor and 11.8% Statistics blank-area observation. This is
  not native runtime, assistive-technology, or representative-user evidence.
- Early generated-sketch review contributed only exploratory composition
  feedback. Those sketches were excluded from ordinary Git and from the durable
  evidence set after their generated English copy was found outside repository
  fixture sources.
- Phase 1 strict code-native review: failed on the recorded baseline defects.
- Phase 2 corrective HTML review: those observed HTML-scope defects were
  repaired, and current proof now covers five silhouettes, live Statistics and
  Mine routes, dedicated Auth, membership, truthful audio states, P0-17
  pending/error/retry/preserved-truth states, expanded Auth recovery, focus and
  route-live recovery, Lock/Elimination CTA handoff, and Swipe gesture,
  keyboard, and reduced-motion alternatives. Independent metadata tests,
  metadata scanning, design-search validation, harness validation, and diff
  hygiene pass. Independent final code-native review passed every
  implementation- and browser-verifiable Phase A P0/P1 item on frozen SHA
  `98c1b28c…`; none of these results substitutes for required representative-
  person studies or exact product-owner acceptance, and none confers promotion,
  implementation authority, or release readiness.
- Local dev gates: 24/24 passed only after the pinned runtime and locked
  dependency rebuild described above. The earlier strict PR-profile result
  remains 22/36 passed, 12 failed, and 2 deferred and is not green; it must be
  rerun when open-PR context is available.

## Binary evidence

- Evidence manifest: N/A for the candidate branch; ordinary Git stores the
  inspectable HTML proof. The frozen `mvr-15` HTML proof SHA-256 is
  `98c1b28c6cf87d85bd92fe637a8789f59975bae83907246497294d1f72f87471`.
  Generated pre-code sketches are deliberately absent from ordinary Git and do
  not count as evidence.
- Archive: N/A.

## Agent review status

- Reviewer coverage: independent design-search, strict UI/UX/accessibility,
  platform composition, semantic/keyboard/focus/live, state recovery, and final
  code-native proof review. The final reviewer did not author the proof.
- Status: Phase 2 passes the independent technical Phase A review for every
  implementation- and browser-verifiable P0/P1 item. `mvr-15` remains a
  conditional shortlist candidate, not accepted or promoted authority.
- Final technical observations: all 29 frames passed at 100%, 130%, 160%, and
  200% with zero horizontal overflow, control-text clipping, navigation escape,
  or visible target below 44 x 44; tablet workspace utilization was 72.4%–96.5%;
  all 191 visible controls were named; contrast, roles/states, keyboard,
  reduced-motion, focus/live recovery, async preservation, and console checks
  passed. Auth announces `身份认证` without leaking the previous hall.
- Blocking formal Phase A findings: `P0-01`, `P0-04`, `P1-01`, `P1-03`, and
  `P1-07` require representative-person studies; `P0-10` requires an exact
  product-owner decision. No self-review or green validator may substitute for
  those gates.
- Deferred Phase B findings: React Native was not changed. Real iOS, Android,
  tablet, safe area/IME/back, VoiceOver/TalkBack, native async/persistence, and
  release validation belong to a separate implementation PR after design
  acceptance; they are not prerequisites that force RN work before Phase A.

## User-visible UI impact

- Design-only. This branch can freeze rejected authority and propose a replacement direction, but it makes no user-visible React Native change.

## Card make external workspace impact

- N/A. No candidate card content is created or approved in this repository.

## Risks and open questions

- The 29-frame code proof closes the recorded Phase 1 defects only within its
  deterministic browser state, 100/130/160/200% width/type, contrast/focus, target,
  exact dual-platform width matrix, Statistics, Auth/membership, audio, P0-17
  recovery, CTA-handoff, gesture/equivalent-input, radius-system, and
  five-silhouette hypotheses. It may still fail native safe areas, IME/back,
  dynamic type, screen-reader, long-content, network, or persistence behavior.
- The local 24/24 dev profile is useful repository feedback but is not a
  substitute for a green strict PR profile; the earlier strict result and its
  environment/dependency/security/PR-context/repo-health boundary remain
  explicit until rerun with an open PR.
- Product-owner acceptance is intentionally unresolved; no agent may self-promote a candidate to implementation authority.
- Prototype-only P2 constraints: the displayed 45-second verification-code
  resend state is time-compressed for testability, and `#557BBE` is restricted
  to non-text graphics because it does not meet 4.5:1 as small body text.
- GitHub authentication is restored; the design-only branch is committed,
  pushed, and attached to draft PR `#482`.

## Follow-up

- Run representative-user first-read/task/result testing on the exact proof,
  complete the Phase A evidence record, and present the exact `mvr-15` HTML
  revision to the product owner. Only after an explicit acceptance that names
  the candidate and commit may a separate implementation branch and PR begin
  for iOS, Android, and tablet React Native work plus real-device testing.
- Rerun the strict PR profile with open-PR context and complete repository
  review before any merge decision.
