# Mobile Core Surface Reset Decision v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `spec/perturbation-audit.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

## Product Truth

软书四六级的手机端核心不是页面集合，而是一个系统带着用户处理当前 CET 知识卡的 app。Learning must remain a system-sequenced single-card flow; Space must preserve library / group / box / card hierarchy; Statistics and Mine must support the flow without becoming the product center.

## Implementation Hypothesis

Current RN screens are behavior prototypes and real-app evidence. They are not visual authority. Future RN implementation should consume this decision, the rendered proof, and the mapping record after this design-only PR is accepted.

## Decision

Adopt the `msr-01` Study Object Rail synthesis from `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/`.

The app grammar is:

1. Current object: one visible card or account/space object is the focal point.
2. Attached layer: action, answer detail, or account state attaches to the object instead of becoming a separate long page.
3. Space address: current library / group / box / card stays visible as compact context.
4. Floating chrome: Learning / Space / Statistics / Mine remain accessible without becoming a full-width bottom bar.

## Why This Beats The Current App

- It turns Learning and Detail into two states of one object instead of two different pages.
- It solves one-screen flow by moving additional information into attached slips and address apertures rather than vertical sections.
- It preserves Space as physical hierarchy while keeping Learning primary.
- It gives Statistics and Mine a quieter role that still inherits the same object grammar.

## Rejected Directions

- Timeline-first study management.
- Dashboard-first overview.
- Carousel-first Space browsing.
- Result-report-first detail.

These are recorded in `docs/design/rejected/mobile-core-surface-reset-failures-v1.md`.

## Design Artifact Source

- Search run: `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/`
- Rendered proof: `docs/design/mocks/mobile-core-surface-reset-v1.html`
- Future mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Single-Card UX Contract Answers

- Current card: the current-library card is always the primary object in Learning and Detail.
- Primary task: answer or continue the current card.
- Primary action: selected interaction control or continue-next-card CTA.
- Secondary actions: hint, peek, favorite, and Space address remain attached and lower weight.
- Feedback state: answer detail appears as an attached slip.
- Recovery: result slip can support review or continue without becoming a report page.
- Learning to Space continuity: address shelf shows where the card lives and how to return to Space.

## Design Review Checklist Answers

Q1: Current library is the active library in the proof. Coral is the only strong accent driving CTA, active option, answer slip edge, and current Space object.

Q2: Focal object is the current card in Learning and Detail, the current box in Space, the daily ledger object in Statistics, and the account card in Mine. First-read path stays object -> attached state -> chrome.

Q3: Learning uses the current-card silhouette; Detail is a resolved state of that silhouette. Space keeps visible library / group / box / card hierarchy instead of a flat list.

Q4: The decision rejects forbidden patterns: no gradient title, no achievement chrome, no full-width bottom tabbar, no serif typography, and no removed self-assess tokens.

Q5: Phone target is 393px. The proof uses contained frames, safe spacing, and a floating capsule that does not cover CTA or content.

Q6: Learning does not make module selection the main path. Statistics uses tabular number treatment in the proof. Flip remains exactly two choices, 有把握 = #22C58B mint and 再回看 = #F5B100 amber, when that interaction is rendered.

## Status

Accepted for design-only planning after search-run validation. This file does not authorize same-PR RN implementation.
