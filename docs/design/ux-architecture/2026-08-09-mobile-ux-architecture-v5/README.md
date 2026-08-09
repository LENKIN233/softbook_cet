# Mobile UX Architecture v5

## Decision

- Current status: `architecture_gate_blocked_with_browser_subset_verified`.
- Parent review: exact corrected v4 planning commit `de3bd5c5a23a70e2ca3c165613ea04a2f07da2b1` passed independent scope review as `completed_no_promotion`.
- This directory is design-only. It does not accept a visual system, authorize React Native work, prove native behavior, or establish leadership readiness.
- The corrected browser subset, per-state fail-closed ledger, and exact evidence record now exist. The next visual-search phase remains blocked by uncovered required states, all native evidence, PC Web per-state mapping, independent frozen-hash review, and product-owner acceptance.

The final goal remains one explicitly accepted, mature CET4/6 consumer product that is genuinely usable on iOS, Android, representative tablets, and PC Web. A grayscale artifact is only a way to remove UX ambiguity before visual exploration; it is not the product finish line.

## Authority used

The active chain for this phase is:

`spec/requirement-memory.json` → relevant product owners in `spec/product-core.json`, `spec/platform-contract.json`, `spec/action-surface.json`, `spec/card-system.json`, `spec/interactions.json`, `spec/knowledge-map.json`, `spec/space-operations.json`, and `spec/membership.json` → `spec/visual-language.json` → accepted interaction, Space, audio, and PC Web artifacts → `docs/design/design-harness.md`.

`spec/authority-map.json` decides ownership when terms overlap. Runtime contracts inform implementation hypotheses; they do not silently redefine product truth.

## Product truth versus implementation hypothesis

### Product truth

- Learning is a system-sequenced single-current-card CET4/6 flow.
- `学习 / 空间 / 统计 / 我的` remain the four top-level destinations.
- Authentication precedes Learning; login alone does not consume Trial.
- The first successful authenticated Learning entry starts an available Trial.
- Space owns `library → group → box → card`; favorite is a tag and sleep/wake changes Learning eligibility without deleting progress.
- Flip uses exactly `有把握 / 再回看`; Four-choice, Lock, Elimination, and Swipe are auto-scored families.
- Trial, Free, and Premium retain the membership facts in `spec/membership.json`; closed-beta access is a receiver-controlled overlay and never a client self-grant.
- PC Web remains a separately composed required target.

### Implementation hypothesis

- The current Learning-session runtime proposal establishes successful entry through context validation, selection generation, cursor persistence, and entitlement reconciliation.
- Exact store/restore outcomes, native navigation containers, predictive Back, safe-area APIs, IME behavior, AT focus, audio routing, and device breakpoints remain target-specific implementation work.
- Browser timers and local scenario adapters in these proofs render proposed state transitions only. They are not canonical service, store, native, or deployment evidence.

## Artifact map

- `grayscale-ux-state-contract.md`: 141 semantic states and 13 forced cross-state combinations.
- `platform-architecture.md`: iOS phone, Android phone, iPadOS, and Android tablet composition/behavior contract, with PC Web parity boundaries.
- `grayscale-proofs/`: four physically separate learner documents for representative cross-device browser scenarios.
- `access-profile-proofs/`: physically separate formal-commerce and read-only managed-access learner scenarios.
- `state-evidence-ledger.md`: explicit per-state coverage/result map; absence is a gate failure.
- `browser-evidence.md`: frozen hashes plus exact viewport, interaction, focus, leakage, and reflow observations; browser-only by definition.
- `grayscale-reviewer-matrix.html`: reviewer-only entry point. It is never learner UI.

## Stop boundary

Do not start visual candidates, implementation mapping, or React Native changes from this directory unless all of the following are true:

1. every state ID has an explicit evidence/result row;
2. learner proofs contain no reviewer copy, internal state key, runtime predicate, test/environment language, or hidden profile switch;
3. representative flows preserve correct scoring, pending/accepted truth, exact origin return, focus, and Space ownership;
4. formal commerce and managed read-only access are physically and semantically separate;
5. independent review passes the frozen exact hashes;
6. the product owner explicitly accepts the architecture checkpoint.

Even then, acceptance permits equal-completeness visual exploration only. It does not permit mobile implementation.
