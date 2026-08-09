# Mobile UX Architecture v5

## Decision

- Current status: `architecture_gate_blocked_with_browser_subset_verified`.
- Checkpoint-layering decision: the separate protected decision record
  `docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md` accepts
  the six-layer topology and Batch 1 manifest-preparation boundary. Its exact
  activation head `ac7e124f0385cf100b74a6b24e44ad3b3dad1ec8` passed the
  exact-head validator, protected product-owner review, and aggregate
  `formal-approval` in workflow run `31322774545`. It accepts no execution
  registry or checkpoint manifest, permits no evidence collection, and does
  not open visual exploration.
- Batch 1 preparation: `batch-1/registry-set.v1.json` and its three isolated
  child registries are structurally valid but contain 88 unresolved authority,
  partition, role/resource/cohort inputs. The historical Batch 0 activation is
  only their preparation basis: because this change modifies the protected
  classifier, the current bytes require a fresh exact-head protected
  preparation decision. Schema v1 is intrinsically ineligible for manifest
  freeze, has `gate_effect=none`, and cannot be consumed by evidence, visual,
  implementation, native, or release workflows.
- Parent review: exact corrected v4 planning commit `de3bd5c5a23a70e2ca3c165613ea04a2f07da2b1` passed independent scope review as `completed_no_promotion`.
- Strict-4 exact review: commit `bd3ed0f54350b252f1554872de5a07cd09f97232` historically passed as `pass_exact_architecture_browser_subset`, with P0 `0` and P1 `0`. A later strict-5 real-use replay found that Flip reveal had left focus on `body`; strict-5 corrects and replays that focus path. Independent exact-delta review of commit `d5b9250ad255215830ff21fe7e1651797234b79a` returned `PASS_EXACT_STRICT5_DELTA`, P0 `0`, P1 `0`. Neither verdict extends beyond its browser subset.
- Exact governance/boundary review of correction commit `c447590790e1f0041f7d04f10deb4470a7b290d0` failed with P0 `0`, P1 `3`: an unchecked ledger divider, missing state-to-evidence-section relevance binding, and PC Web's incomplete binding to its semantic source contract. Exact adversarial and boundary/records reviews of correction commit `6950638d52a15aa4ff60597dbeaa376a1ec4f06b` both passed with P0 `0`, P1 `0`; the overall architecture gate remains blocked.
- This directory is design-only. It does not accept a visual system, authorize React Native work, prove native behavior, or establish leadership readiness.
- The corrected browser subset, per-state fail-closed ledger, six-layer checkpoint proposal, protected Batch 0 decision record, and PC Web state mapping now exist. The next visual-search phase remains blocked by uncovered required states, canonical service evidence, PC Web implementation/exact replay, all native evidence, and a later exact architecture decision.

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

- `grayscale-ux-state-contract.md`: 160 semantic states and 13 forced cross-state combinations. Nine rows add the explicit lightweight check-in family; ten more replace compound rows whose two branches require different evidence.
- `platform-architecture.md`: iOS phone, Android phone, iPadOS, and Android tablet composition/behavior contract, with PC Web parity boundaries.
- `grayscale-proofs/`: four physically separate learner documents for representative cross-device browser scenarios.
- `access-profile-proofs/`: physically separate formal-commerce and read-only managed-access learner scenarios.
- `state-evidence-ledger.md`: explicit per-state coverage/result map with column-specific result classes, a frozen state-to-evidence-section policy, source-commit-resolved pointers, validated table structure, semantic integrity digests, and an owner-controlled derived gate boundary; absence is a gate failure.
- `browser-evidence.md`: frozen hashes plus exact viewport, interaction, focus, leakage, and reflow observations; browser-only by definition.
- `checkpoint-contract.md`: six-layer checkpoint contract with owner,
  entry/exit, claim/non-claim, cohort, and fail-closed rules. It has gate effect
  only through an effective protected decision record bound to its exact bytes.
- `checkpoint-layering-decision-proposal.md`: the original decision questions;
  it is not itself an approval record.
- `../../decisions/mobile-ux-checkpoint-layering-decision-v1.md`: protected
  Batch 0 topology decision. Even after activation, it permits only separate
  `CP-BA / CP-CS / CP-WEB` owner/matrix/manifest preparation, forbids evidence
  collection, and keeps `CP-VA` blocked.
- `pc-web-v5-state-mapping.md`: fail-closed mapping of all 160 semantic states and 13 forced combinations to the accepted `pcw-01` Focused Workbench authority and future evidence; its complete semantic source contract, status, result meanings, completion boundary, rows, matrix, and appended prose are integrity-bound.
- `batch-1/`: preparation-only common resource bundle plus isolated `CP-BA`,
  `CP-CS`, and `CP-WEB` registries. The bundle records exact Batch 0 activation
  provenance as historical basis, source and child hashes, 173 source-universe
  obligations, 12 canonical-service scenarios, 12 PC Web rows, and 33 future
  manifest identities. Exact state-to-lane partitioning and every role/resource
  cohort remain unresolved; no personal or workstation inventory is stored.
  It creates no manifest, evidence, checkpoint result, visual authority, or
  execution permission.
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
