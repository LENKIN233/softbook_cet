---
status: active
audience:
  - agent
  - reviewer
scope:
  - Learning user-visible copy
  - PR review evidence
---

# Learning microcopy rules

Learning copy changes must separate product truth from implementation hypothesis. The goal is to prevent subjective wording changes from being treated as harness requirements.

## Required PR evidence

Any PR that changes user-visible Learning UI must fill `Learning microcopy basis` in the PR body.

Accepted basis values:

- `hard leak`: removes raw IDs, source labels, runtime/config wording, harness/design-process metadata, or other internal implementation text from user-visible UI.
- `spec-backed`: directly follows a named product/spec rule, with the relevant spec named in the PR body.
- `design-backed`: directly maps to an accepted design artifact, mock, storyboard, or interaction/motion artifact.
- `product correction`: fixes an already-reviewed product-language regression, such as over-broad metadata stripping or ambiguous adjacent controls.
- `no visible-copy change`: the Learning UI file changed, but rendered user-visible text did not change.

Rejected basis:

- Personal taste, tone polish, or isolated wording preference without one of the accepted bases above.
- Treating a passing scanner or validator as proof that a new phrase is product-correct.
- Claiming a harness requirement when the harness did not actually fail or name the wording.

## Review rules

- Preserve legitimate learner-facing collection names; do not erase names just because they contain broad words like `卡组`.
- Keep adjacent controls semantically distinct. For example, clue/peek and hint controls must not collapse into indistinguishable labels.
- If a previous run record overstates changed files, verification, or test coverage, correct the record in the next repair PR.
- When copy is an implementation hypothesis, say so explicitly and prefer review before merging.
