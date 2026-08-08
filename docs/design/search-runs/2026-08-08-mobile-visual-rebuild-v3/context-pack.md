# Mobile Visual Rebuild V3 — Context Pack

> **AP-23 token binding:** `有把握 = confident/mint (#22C58B)`; `再回看 = review/amber (#F5B100)`. Any rendered flip labels in this record inherit this fixed semantic/color mapping.

## Status And Authority

- Lifecycle status: `candidate_exploration`.
- This is a design-only search run. It cannot authorize React Native implementation in the same pull request.
- Only an explicit written product-owner decision may promote a direction. An agent score, reviewer note, rendered screenshot, green local gate, or merged design-only PR is not product-owner acceptance.
- The current React Native application is a behavior prototype and a comparison input, not visual authority.
- The previous Aurora Glass / lilac-canvas mobile reset, the closed orange editorial direction, and the neutral black-white-grey rounded-card treatment are rejected comparison baselines. They must not be copied, lightly recolored, or silently reused as implementation authority.
- Until a new direction is explicitly accepted and separately mapped, the mobile visual baseline remains unresolved.
- This repository consumes existing approved or development fixture payloads for proof. This run does not write, approve, or imply new CET candidate-card content.

## Referenced Authority

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

If these sources conflict, the owner identified by `spec/authority-map.json` wins. This run does not amend product scope, interaction families, content, membership, or platform parity.

## Surface

Mobile core product across iOS phone, Android phone, tablet portrait, and tablet landscape. The search covers Auth, Learning, Space, Statistics, and Mine as one visual/interaction system, with Learning and the Learning ↔ Space relationship receiving first priority. PC Web remains a required release surface at product level but is outside this mobile design-only run.

## Search Objective

Find a recognizably Softbook mobile visual and interaction system that makes a learner feel that credible CET material is a manipulable knowledge object in a living study space. It must be more trustworthy, more distinctive, and easier to operate than the rejected baselines without becoming a generic flashcard app, dashboard, game, or decorative concept render.

The first five-second read must answer, in this order:

1. What CET task am I working on now?
2. What must I do next?
3. What changed after I acted, and where does this card belong?

## Accepted Baseline

There is no currently accepted mobile visual baseline that this run may copy or extend: the product owner rejected the Aurora/lilac reset, the closed orange editorial direction, and the neutral black-white-grey implementation treatment. `spec/product-core.json`, the narrow product-truth clauses in `spec/visual-language.json`, and `docs/design/single-card-ux-contract.md` remain authoritative constraints, while existing renders serve only as failure comparison evidence. Promotion must therefore establish a new exact baseline through explicit product-owner acceptance.

## Product Truth

These claims are not open for visual search:

- The product serves Chinese college students preparing for CET4/6; it is not a generic English-learning or word-only tool.
- Learning is a system-sequenced single-card flow. Module browsing is secondary and must not become the primary path.
- The current card or current interaction object is the focal object. It has one identifiable primary task and one primary action at a time.
- The five core interaction silhouettes remain distinguishable when blurred:
  - `flip`: one large focal card followed by exactly two light self-assessment choices.
  - `multiple_choice`: prompt plus a 2 x 2 option field.
  - `lock`: rows with adjustable slots and visible locked/unlocked progression.
  - `elimination`: a candidate set whose struck-through state is the key affordance.
  - `swipe`: one top card in a deck with left/right directional causality.
- `hint_layer` is an enhancement attached to a core interaction, never a separate card family.
- Flip self-assessment is exactly `有把握` and `再回看`; `再回看` is warm/constructive, never red punishment. Auto-scored interactions do not reuse those self-assessment semantics.
- Audio is an explicit user-triggered content resource, never autoplay and never an independent interaction family.
- Space is a visible physical hierarchy of library → group → box → card. It cannot collapse into a flat list or a favorite/sleep pair.
- Favorite is a tag. Sleep/wake changes a physical zone and learning flow; it does not rewrite knowledge ownership.
- Learning and Space preserve continuity. The learner can understand a card’s address or state without turning Learning into a map dashboard.
- Each CET library has a stable, learnable identity. At most one current-library identity is the dominant accent on a screen; other library identities remain subordinate map/chip cues.
- The top-level order is 学习 / 空间 / 统计 / 我的. Page composition may and must differ by device class.
- iOS and Android have equal mobile priority. Phone and tablet each require dedicated composition; a widened phone layout or fixed sidebar beside phone content is not a tablet design.
- User-facing content must not expose agent, fixture, seed, runtime, mock, debug, API, repo, validator, or other internal language.

## Implementation Hypotheses Under Test

These are design propositions, not new product truth. The winning design may refine them if it still passes the hard filters and product-owner review.

- Treat accessibility floors as non-negotiable design quality gates: small text contrast is at least 4.5:1; large text and meaningful non-text UI are at least 3:1 on the final composited surface; interactive targets are at least 44 x 44 logical pixels.
- Separate three color roles:
  - brand identity creates a distinctive, emotionally supportive Softbook atmosphere without prescribing warm paper, cool glass, or any other material family;
  - library identity locates the learner within the knowledge map;
  - semantic feedback communicates result, confidence, warning, and disabled state.
  No role may mechanically substitute for another.
- Use color as an authored system rather than defaulting the product to black, white, and grey. Neutral ink and paper may support content comprehension, but they cannot be the entire brand proposition.
- After an answer, show the result and useful analysis in the same task surface before `下一张` becomes the dominant action. Do not offer `查看解析` and `继续下一张` as equally strong competing exits.
- A wrong phone number can be corrected in one explicit action after a verification code has been requested. Resend, verification error, expired-code, and network-retry states remain recoverable without restarting the app.
- On a phone, the current object plus action zone occupies approximately 55–70% of usable content height, meaningless blank space remains at or below 12%, and the primary action sits within the lower 35% whenever content length permits.
- On a tablet, the useful learning or space workspace occupies at least 70% of the safe viewport and no unexplained blank region occupies more than 20%. Portrait and landscape use different compositions when hierarchy or text measure requires it.
- Visual depth remains legible: at most three simultaneous surface-depth levels, no more than two nested light-card layers, and no universal “everything is a capsule” treatment.
- Primary controls use at least a 48-pixel visual control height where practical; 44 pixels remains the absolute hit-target floor.
- Statistics is a quiet summary and check-in surface, not the product’s control center. Mine owns account, entitlement, privacy, and preferences; it must not duplicate a progress dashboard.
- Phone navigation may remain compact and thumb-reachable, but its material, geometry, and active state must be native-feeling on both iOS and Android. Tablet navigation may relocate if the four-item order and discoverability remain intact.

## Existing Brand Gap

The active repository has a public product name and strong product semantics,
but no approved cross-platform logo, wordmark, brand color token, font asset,
icon family, or motion signature. Current mobile code lets the active collection
accent drive shell, navigation, and primary action, which explains the rejected
“neutral surface plus one subject color” result.

The search must therefore build recognition from the product's own behavior:
one current knowledge object remains locatable and operable as the learner moves
between Learning and Space. A stable mark, geometry, type rhythm, object
causality, and motion signature may express that identity. Merely selecting a
new theme color is insufficient, and a brand signature may not reassign or
visually overpower the stable collection hue families.

## Hard Constraints

- Preserve every item under Product Truth and all P0 gates in `acceptance-rubric.md`.
- Obey Law of One, stable library identity, exact flip self-assessment semantics, five distinct interaction silhouettes, Space hierarchy, and the single-card operability contract.
- Prove containment, contrast, target size, text reflow, screen-reader equivalence, reduce-motion behavior, error recovery, and dedicated tablet composition.
- Keep all output `candidate_exploration`; do not create RN, change global canon, or claim implementation authority in this run.
- Use existing fixture/approved content only and keep internal metadata out of all user-visible proof.

## Soft Objectives

- CET trust and content authority without textbook stiffness.
- A memorable chromatic Softbook identity without decorative color noise.
- Immediate task/action comprehension and low operation cost.
- Tactile card objecthood and legible Space continuity without turning Learning into a map.
- Native confidence on iOS and Android plus genuinely useful tablet composition.
- A system that scales across long content and five interactions without bespoke exceptions or excessive engineering weight.

## Source Artifacts

- Product and platform authority: `spec/requirement-memory.json`, `spec/product-core.json`, `spec/platform-contract.json`, and `spec/interactions.json`.
- Design constraints: product-truth clauses of `spec/visual-language.json`, `docs/design/design-harness.md`, and `docs/design/single-card-ux-contract.md`.
- State proof contract: `ux-state-matrix.md` and `acceptance-rubric.md` in this run; both remain candidate governance, not accepted design authority.
- Existing React Native routes and repository fixture payloads may establish behavior/state inventory only. Existing implementation screenshots and rejected search runs are failure comparisons, never visual sources to reproduce.

## Required Surface And State Coverage

Every surviving direction must prove a coherent system, not a single hero screen:

- Auth: phone entry, code requested, wrong-number correction, resend cooldown, verification error, and successful continuation.
- Learning: session entry, all five interaction silhouettes, hint layer, explicit audio affordance where present, answer feedback, inline analysis, retry/recovery, and next-card transition.
- Space: hierarchy overview, box inspect, card inspect, favorite tag, sleep/wake, and a one-action route back into the relevant Learning context.
- Statistics: simple daily progress, review signal, and check-in without dashboard overload.
- Mine: account, membership/entitlement, purchase recovery, privacy, and settings without duplicating Statistics.
- Platform: iOS phone, Android phone, tablet portrait, and tablet landscape; default and large accessible type; light and dark appearance where the direction claims both.
- Accessibility: keyboard/switch-compatible alternatives to gestures, VoiceOver/TalkBack order and state announcements, reduced motion, focus recovery, and text reflow.

The detailed behavior matrix is in `ux-state-matrix.md`. Quantitative pass/fail rules are in `acceptance-rubric.md`.

## Candidate Budget

- Population: at least eight materially different visual systems from this same context pack.
- Search budget: at most three generations before the context pack must be reconsidered.
- Shortlist: at most three candidates after P0 hard filtering and independent pairwise review.
- Human checkpoint: product owner sees exact rendered proof before any promotion; no reviewer or agent may infer acceptance from silence.
- Difference must be structural and expressive: type hierarchy, object model, surface material, spatial rhythm, feedback language, navigation treatment, and tablet composition. Palette swaps, corner-radius swaps, or rearranged versions of one CSS system count as one direction.
- At least one direction should lead with content authority, one with spatial objecthood, and one with fast operational rhythm. These are search poles, not mandatory finalists.
- Each candidate must state its aesthetic thesis, focal object, first-read path, interaction silhouette, state language, tablet model, accessibility risk, and what it rejects.
- Use one current-library identity at dominant visual weight. Other library identities may appear only as subordinate map/chip information.
- A candidate may challenge current implementation-hypothesis tokens only by naming why, limiting the change, stating validation, and defining rollback. Product truth remains fixed.
- Every survivor needs candidate-bound rendered proof at the target viewport. A shared proof page must provide a stable candidate-specific anchor.

## Forbidden Drift

A candidate is removed before pairwise review if it:

- looks like a generic flashcard template, SaaS dashboard, finance tracker, children’s game, or landing page;
- repeats Aurora/lilac glass, the closed orange editorial composition, or neutral monochrome cards with only accent-color substitution;
- makes a dashboard, streak, counter, or module selector the Learning focal point;
- hides the primary action, puts two primary decisions in competition, or cannot explain answer → analysis → continuation;
- uses the same blurred silhouette for the five core interactions;
- represents Space as a flat list or favorite/sleep bins;
- stretches phone UI onto tablet or leaves the majority of a tablet viewport unused;
- fails contrast, target-size, reflow, safe-area, or screen-reader semantics;
- relies on a swipe-only, color-only, hover-only, or motion-only instruction;
- uses new/unapproved CET card content as visual decoration or proof;
- leaks internal implementation language into user-visible copy;
- claims acceptance without the explicit product-owner decision required by `acceptance-rubric.md`.

## Comparison Baselines

The run must beat all three failure patterns, but none is implementation authority:

1. Current mobile behavior prototype: useful for route and state inventory, visually generic and compositionally underfilled.
2. Aurora/lilac mobile reset: overly decorative glass/capsule language, weak contrast, and insufficiently distinct candidate search.
3. Closed orange editorial direction: visually authored but explicitly rejected by the product owner and therefore unavailable for promotion or implementation.

## Stop Condition

The search may shortlist when a candidate survives all P0 checks, wins two consecutive independent comparison rounds, and beats the comparison baselines on product fit, first-read clarity, cross-platform composition, accessibility, and distinctiveness. It remains `candidate_exploration` until the product owner explicitly approves the named candidate and proof revision.
