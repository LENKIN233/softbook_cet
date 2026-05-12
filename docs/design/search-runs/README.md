# Design Search Runs

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `docs/design/design-harness.md`

## Product Truth

Design search runs do not replace accepted design artifacts. They are a pre-acceptance optimization layer for core surfaces whose visual or interaction quality is still underdetermined.

User-facing implementation still consumes only accepted artifacts, implementation mapping, and applicable interaction/motion or physical-space proof. A search run may become evidence for a design-only PR, but it cannot authorize same-PR RN or Web implementation.

## Implementation Hypothesis

The Design Evolution Engine improves design content by treating AI output as a search process:

```text
constraints
  -> generate candidate population
  -> hard-filter product and layout violations
  -> pairwise-rank surviving candidates
  -> harvest strongest fragments
  -> apply targeted mutations
  -> repeat until a candidate beats the accepted baseline
  -> promote one accepted artifact
  -> sediment failures back into the harness
```

This is the Creation and Judgment harness before Delivery harness. It exists because PR gates can prove that implementation has design evidence, but they cannot by themselves produce the best design evidence.

## When To Use

Use a design search run for:

- a new core Learning, Space, interaction, motion, or platform surface;
- a major redesign of a user-visible surface;
- a design gap where one artifact is not enough to prove quality;
- an AI-tool comparison that should influence the accepted design baseline.

Do not require a full search run for:

- narrow copy changes;
- bug fixes that only restore an accepted artifact;
- small implementation mapping clarifications;
- visual-output cleanup where the accepted design is already stable.

## Required Loop

1. Objective
   Define hard constraints and soft objectives. Hard constraints include product truth, Law of One, interaction silhouettes, Space physical hierarchy, forbidden patterns, and implementation authority boundaries.

2. Population
   Generate at least 8 materially different candidates for a completed core-surface search run. Candidates may come from Codex HTML, Figma Make, Stitch, v0, external design files, or different prompts/models, but they must consume the same context pack. Every candidate that survives hard filtering must point to rendered visual evidence, a screenshot, an external prototype, or another concrete visual-evidence file; rejected candidates may instead state a concrete no-render rationale.

3. Hard Filter
   Reject candidates that violate product truth, collapse Space into a list/dashboard/favorite box, collapse Learning into a generic flashcard, fail required visual-language checklist items, or cannot be rendered/proved at the target device class.

4. Pairwise Review
   Compare surviving candidates pairwise instead of assigning a single aesthetic score. Each comparison must name the visual evidence used for Candidate A and Candidate B, name the winner, and explain product-truth fit, first-read clarity, Space/interaction fit, implementation mapping, and known risk.

5. Fragment Harvest
   Extract the strongest reusable parts before synthesis: focal object, first-read path, state language, motion causality, platform adaptation, and any risky but useful breakthrough.

6. Targeted Mutation
   Mutate the next generation from named failures, not from vague instructions such as "make it better." Each mutation must state the failure signal and the specific design change.

7. Promotion
   Promote only one candidate or synthesis into an accepted artifact. Promotion must state the winning candidate, borrowed fragments, rejected fragments, rendered proof, mapping expectations, unimplemented gaps, and failure sedimentation.

8. Failure Sedimentation
   Every meaningful failure must be recorded in `docs/design/rejected/`, `spec/evals.json`, `spec/perturbation-audit.json`, `spec/visual-language.json`, or a validator regression when it is likely to recur.

## Run Layout

Completed search runs live under:

```text
docs/design/search-runs/<yyyy-mm-dd>-<surface>/
  context-pack.md
  candidate-index.md
  hard-filter-results.md
  candidates/
    <candidate-id>.md
  candidate-proofs/
    survivor-comparison.html or per-candidate rendered/screenshot proof
  pairwise-reviews/
    <round>-<candidate-a>-vs-<candidate-b>.md
  fragment-harvest.md
  mutation-log.md
  promotion-record.md
  rendered-proof.html or external-prototype.md
  screenshots/
```

The templates in `docs/design/search-runs/templates/` define the required headings for each record.

The validator rejects copied templates and placeholder-only records. A completed run must contain concrete provenance, concrete checklist answers, concrete hard-filter results, visual evidence for every surviving candidate, enough pairwise reviews to cover the candidate set, and promotion proof backed by a rendered file, screenshot set, external prototype record, or URL.

## Baseline Comparison

Every search run must name the accepted baseline it is trying to beat. For Space, the current baseline is:

- `docs/design/mocks/space-surface-visual-refinement-v1.md`

Promotion is not justified unless the winning candidate beats the baseline on product-truth fit and at least one soft objective without regressing layout, accessibility, mapping, or implementation authority.

## Stop Conditions

Stop a run when one of these is true:

- a top candidate wins two consecutive generations and passes hard filters;
- a candidate beats the accepted baseline in at least 70% of relevant pairwise reviews;
- every candidate is hard-filtered, which means the context pack or objective is wrong;
- the run reaches its budget limit, usually 3 generations.

## Design Review Checklist Answers

Q1: A search run must name the current library in its context pack and candidate records. Law of One remains a hard filter, not a subjective preference.

Q2: Every candidate must name its focal object and first-read path before visual review.

Q3: Learning candidates must bind to a canonical interaction silhouette. Space candidates must prove physical hierarchy with current box or card focus.

Q4: Forbidden design patterns are hard-filtered before pairwise review.

Q5: Rendered candidates must include containment evidence for the target viewport. Surviving candidates need concrete visual evidence; hard-filtered candidates may explain why the artifact is not rendered.

Q6: Learning/flip/stats rules remain surface-specific hard constraints; search runs cannot mutate two-level self-assess, tabular stats, or system-sequenced Learning.
