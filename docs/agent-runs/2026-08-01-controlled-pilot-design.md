# Agent Run Record: CET4 Controlled Pilot Lifecycle Design

## Task summary

- Date: 2026-08-01
- Branch: `cross/controlled-pilot-design`
- PR: https://github.com/LENKIN233/softbook_cet/pull/473 (stacked against `cross/controlled-pilot-contract`)
- Summary: Produced the separate design-only authority for the dedicated authenticated app entry, fixed CET4 controlled-pilot identity, first-valid-card non-blocking start notice, every-five-confirmed-event completion object, Learning-to-Space continuity, no-payment Mine entitlement states, and the authenticated account-deletion lifecycle.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/interactions.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/single-card-ux-contract.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/physical-space/README.md`

## Product truth used

- `product_truth`: The controlled pilot is fixed to CET4 on iOS and Android. There is no exam-type selector, unavailable CET6 entry, payment, or self-service eligibility grant.
- `product_truth`: The entire four-surface product shell is authenticated-only. Signed-out and unvalidated restoration states show one dedicated phone/SMS login surface; Learning, Space, Statistics, Mine, and their navigation are not visible or reachable.
- `product_truth`: Login and account browsing do not start the trial. The first-valid-card notice exists only after the service has successfully prepared a real Learning Session; entitlement lasts 120 consecutive hours using server-owned timestamps.
- `product_truth`: A round boundary is created only by each new multiple of five server-confirmed Learning or review events. The completion object offers exactly review, Space, and continue, with continue dominant.
- `product_truth`: Space remains a physical library/group/box/card knowledge map. The completed card’s actual location explains its value without a tutorial.
- `product_truth`: The compact completion address belongs only to server `round_completion.space_card_id`, the active-content card at the exact canonical boundary sequence. Client phase grouping and client/device timestamps cannot author that address.
- `product_truth`: Mine displays server-owned entitlement state and explicitly states that the controlled pilot is free and continuation eligibility is operationally granted.
- `product_truth`: Account deletion is submitted only from authenticated Mine. An accepted request queues deletion and revokes all sessions, so the client must leave the product shell immediately while accurately describing cleanup as pending; a rejected request must preserve the account and all local state.

## Implementation hypothesis changed

- Promoted a two-step phone/SMS authentication object before the app shell, an attached pilot slip as the first-card state layer, a restrained confirmed-fifth-event settle transition, a compact completion receipt, a Space address aperture, and account entitlement rows.
- Corrected the earlier implementation hypothesis that allowed the four product destinations to exist while signed out. The dedicated entry state now owns authentication; successful authentication plus required hydration enters Learning.
- Added a future implementation map for the Learning identity, start slip, round boundary, Space link, exact actions, and Mine states.
- Added one bounded account-deletion confirmation sheet, a retained-account request-failure state, and a cleanup-pending notice on the dedicated login boundary. The client does not invent deletion progress or claim completion at request acceptance.
- Added the no-current-selection authority: a valid server `selection: null` without a round receipt is a bounded Learning availability object with optional server-provided next-due time and one refresh action, never a false completion or local restart.
- Bound the completion receipt's review destination to exact ordered server-returned `review_card_ids`; the read-only sequence cannot infer candidates or submit learning events.
- Bound the completion receipt's address aperture to exact server-returned `space_card_id`; this is an authority correction inside the accepted silhouette and introduces no new visual direction.
- Narrowed the design metadata scanner so only the exact required “CET4 受控试点” product identity is allowed; other raw exam-type values remain rejected, with regression coverage.
- No RN component, navigation, API call, entitlement calculation, timer, storage, or deployment was implemented.

## Workspace boundary and read scope

- Active repository truth/source read: the referenced product, account, membership, runtime, visual, interaction, design-harness, mapping, and governance artifacts only.
- Existing accepted phone HTML was inspected through the in-app browser before creating new design authority.
- `/Users/lenkin/programing/card make` was not read or modified in this design stage; the rendered copy is anonymous and not candidate or approved content.
- Temporary browser screenshots were stored only under `/tmp` for local visual inspection and were not committed as release evidence.

## Files changed

- Design decision: `docs/design/decisions/controlled-pilot-lifecycle-decision-v1.md`.
- Interaction/motion authority: `docs/design/interaction-motion/controlled-pilot-lifecycle-v1.md`.
- Rendered design and handoff: `docs/design/mocks/controlled-pilot-lifecycle-v1.html`, its companion Markdown, and `docs/design/mapping/controlled-pilot-lifecycle-implementation-map-v1.md`; the 2026-08-02 correction adds phone and SMS-code frames with no product navigation.
- Design search run: `docs/design/search-runs/2026-08-01-controlled-pilot-lifecycle/` with eight candidates, four survivors, three pairwise reviews, fragment harvest, mutation log, promotion record, candidate proof, and final proof.
- Failure sedimentation: `docs/design/rejected/controlled-pilot-lifecycle-failures-v1.md`.
- Metadata guard: `scripts/check_design_metadata_leaks.mjs` plus `scripts/harness_validator/sections/design_metadata_regressions.py`.
- Durable context: this run record.

## Commands run

- `python3 scripts/validate_design_search_run.py --run docs/design/search-runs/2026-08-01-controlled-pilot-lifecycle` -> passed, `DESIGN SEARCH VALIDATION OK`.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed after removing ambiguous prose collisions and adding the exact pilot identity exception.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- `git diff --check` -> passed.
- 2026-08-02 authentication-entry correction: rendered dedicated phone and SMS-code entry states, updated the decision/motion/mapping/failure artifacts, and verified that neither signed-out frame contains the four-item navigation.
- 2026-08-02 authentication-entry structure check: a read-only Node assertion passed with two signed-out frames containing no `.nav`, five authenticated frames containing `.nav`, and the 393 x 852 phone frame retained.
- 2026-08-03 account-deletion design correction: rendered confirmation, request-failure, and accepted-request states; a read-only Node assertion passed with ten total frames, all signed-out frames free of product navigation, and all required safe copy present.
- 2026-08-03 account-deletion visual inspection: rendered the complete HTML at 1760 x 7200 in headless Chrome and inspected a cropped proof of the three added states. The modal actions remain visible at 393 x 852, the failure keeps Mine behind the sheet, and the accepted state shows no shell or navigation.
- 2026-08-03 `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- 2026-08-03 `git diff --check` -> passed.
- 2026-08-03 no-selection correction -> decision, rendered-state handoff, interaction/motion, and implementation mapping now distinguish scheduler availability from completed Learning. The correction reuses the accepted bounded Learning status silhouette and introduces no new visual direction.
- 2026-08-02 local browser inspection could not open the `file://` artifact because the in-app browser security policy rejected local-file navigation. No bypass was attempted; simulator/device visual evidence remains mandatory in the separate implementation PR.
- `python3 scripts/validate_pr_design_gate.py --base cross/controlled-pilot-contract --head HEAD --body-file /tmp/softbook-controlled-pilot-design-pr.md` -> passed, `PR DESIGN GATE OK`.
- `./scripts/run_local_gates --profile pr --base cross/controlled-pilot-contract --verbose` -> 31/36 checks passed. All harness, design, mobile, backend, dependency-security, evidence, and LFS checks passed. The profile remained failed because `toolchain` has the existing declared local condition, `pr-context` and two review/design checks require a live PR context, and strict repository health detected pre-existing shared-workspace/remote-governance drift (nine worktrees, eighteen topic branches, seventeen branches without upstream, and the remote `android-release` check outside its local expected set). No user worktree or branch was deleted. Report: `exports/local-gates/20260801T085321Z-e71df8f5-pr-62906/report.json`.
- In-app browser baseline inspection: accepted mobile surface loaded at 393-point phone framing with five existing reference states.
- In-app browser candidate inspection: four survivor anchors loaded with no page-level horizontal overflow; rendered screenshot inspected locally.
- In-app browser promoted inspection: five phone states loaded; all had no internal horizontal or vertical overflow, no CET6 text, no page-level horizontal overflow, and all buttons measured 48 points high. Rendered screenshot inspected locally.
- PR-specific design gate passed locally; remote required checks remain pending until PR creation.

## Validation results

- Eight materially different directions were recorded; blocking modal, lifecycle dashboard, equal destination doors, and tutorial carousel were hard-filtered.
- The promoted first-card state keeps the knowledge card dominant and the start notice non-blocking with no acknowledgement action.
- The completion proof exposes exactly “回看待复习内容”, “查看所在 Space”, and “继续下一轮”; continue is the only dark primary action.
- Active, expired/free, and operational continuation states are rendered in Mine with server-time language and no purchase action.
- Ten 393 x 852 frames are contained and use one active-library accent; pilot identity remains neutral.
- The corrected proof contains two dedicated signed-out authentication frames with one focal form object and no Learning / Space / Statistics / Mine navigation. Authenticated frames retain the four-item product navigation.
- AP-22/VL-AP-07 is satisfied by separate accepted design, rendered proof, motion authority, and implementation mapping. AP-23 is preserved: no four-level self-assess and no red review state.
- The account-deletion correction separates request acceptance from worker completion, presents irreversible impact before mutation, prevents duplicate submission in the pending state, preserves authenticated state after failure, and removes the entire product shell only after `202` acceptance.
- A null server selection can no longer be designed or implemented as `0/0` completion: the accepted object names availability, displays only a server-provided next-due time when available, and refreshes without inventing progress.
- The completion review action now has a concrete server-owned content source instead of a button-only promise; empty review content receives calm feedback while non-empty content opens in server order.
- The completion Space aperture now has a concrete server-owned boundary card instead of phase- or timestamp-derived client inference; the accepted compact address layout is unchanged.

## Agent review status

- Reviewer: Codex
- Status: Passed.
- Blocking findings: none.
- Review summary: Reviewed the committed diff for product-truth separation, dedicated authenticated entry, Law of One, first-valid-card semantics, exact completion actions, Space continuity, entitlement honesty, accessibility layout, metadata leakage, design-only boundary, and future implementation mapping. Confirmed that signed-out proof has no product navigation or route-level login duplication; authenticated proof retains one fixed pilot identity, no CET6 entry, no client-owned eligibility logic, no payment action, exactly the three approved completion destinations, a 48-point minimum action height, and no contained-frame overflow.

## User-visible UI impact

- This PR changes design authority and rendered design evidence only. It now explicitly removes signed-out product navigation and repeated per-route login cards from the accepted model; it does not change the currently running mobile UI.
- A later separate implementation PR must consume this decision, motion contract, and implementation map and provide iOS/Android evidence for every state.

## Card make external workspace impact

- None. No candidate content, card approval, audio QC, or payload export was created or modified.
- The existing ten development cards remain development-only and are not represented as the planned 120 approved CET4 pilot cards.

## Risks and open questions

- Dynamic type, screen reader, weak network, offline replay, cross-device reconciliation, account-deletion worker completion/re-registration, and real-device reduced-motion behavior require later implementation evidence.
- Mobile implementation PR #475 now consumes the dedicated entry boundary and removes signed-out product routes; it must additionally consume this account-deletion design before pilot use.
- Exact card copy density must be rechecked against the approved external 120-card payload when it exists.
- Receiver-device evidence must still prove the server-authoritative first-card, fifth-event, entitlement, and account-deletion boundaries end to end.
- PR #472 remains blocked on the protected formal product-owner approval workflow; this stacked design PR must not be merged ahead of its contract base.

## Follow-up

- Commit and open a stacked design-only PR against `cross/controlled-pilot-contract`.
- Run Agent review, PR design gate, and required checks; retarget to `main` after PR #472 merges.
- Implement backend timestamp, pilot publisher, entitlement, deletion cleanup, and deployment tooling only after the contract and design authorities are accepted.
- Implement iOS and Android wiring in a separate later PR with device evidence.
