# Agent Run: Learning Primary Action Path

## Scope

- Surface: Learning current-card flow.
- Goal: make the current card operation path readable as study work, not a dense one-screen poster or hidden submit flow.
- Non-goals: no new interaction family, no dashboard, no statistics surface, no module picker, no card payload change, no membership or remote runtime change.

## Referenced Specs And Artifacts

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`

## Product Truth

Learning remains a guided single-card flow. The user should see one current card, understand the next useful study action, get feedback after acting, and retain a quiet Space continuity cue.

## Implementation Hypothesis

The RN Learning surface can improve operability without changing the interaction model by:

- showing a short study-facing cue for the current step;
- keeping auto-scored submit / result feedback immediately after the interaction object;
- keeping peek, hint, favorite, and address as secondary support and continuity.

## Changed Files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-21-learning-primary-action-path.md`

## Validation Plan

- metadata leakage visible-text check;
- harness validation;
- PR design artifact gate with PR body;
- agent review gate with PR body;
- mobile quality through GitHub required checks.

## Design Gate Evidence Fields

- `Design artifact`: `docs/design/mocks/learning-card-rhythm-v1.md` and `docs/design/single-card-ux-contract.md`.
- `Interaction/motion artifact`: `docs/design/interaction-motion/learning-card-rhythm-v1.md`.
- `Implementation mapping`: `docs/design/mapping/learning-space-implementation-map-v1.md` maps `apps/mobile/src/learning/LearningSurface.tsx` current object plane, action plane, tool plane, and address aperture.
- `Unimplemented design gaps`: no tablet or pc web layout redesign; no new motion timing or rendered screenshot; no Space hierarchy, sleep, favorite, membership, or remote runtime change.
- `Universal Q1-Q4`: Law of One / current library, focal first-read path, interaction silhouette, and forbidden_design_patterns evidence are recorded in the PR body.
- `Conditional Q5-Q6`: phone containment and Learning flip self-assess evidence are recorded in the PR body.
- `AP-22`: design review checklist pre-render proof is paired with the metadata leak scan.
- `AP-23`: two-state `有把握` / `再回看` self-assess policy remains unchanged.
