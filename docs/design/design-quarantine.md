# Softbook CET Design Quarantine

## Product Truth

Softbook CET user-facing design must not expose internal process, agent, harness,
validator, spec, runtime, mock, seed, or implementation terminology to learners.
Any design artifact that leaks such metadata is not design authority.

This rule applies before visual taste review. A beautiful artifact with metadata
leakage is still rejected.

## Implementation Hypothesis

Design work can pass through four states:

- `accepted_authority`: approved design authority that implementation may consume.
- `candidate_exploration`: useful exploration, not implementation authority.
- `quarantined`: blocked from implementation until repaired and re-reviewed.
- `rejected`: intentionally preserved failure record.

Existing documents are not automatically trusted because they live under
`docs/design/`. Their authority comes from manifest status, accepted lifecycle
evidence, and passing this quarantine gate.

An explicit product-owner veto moves the named artifact and its dependent proof,
mapping, and promotion record to `rejected`. A later candidate, branch, internal
ranking, or self-review cannot reverse that state. Re-entry requires explicit
product-owner acceptance of the exact replacement artifact.

## Quarantine Triggers

A design artifact must be quarantined when it contains any user-visible copy or
visual label that names internal machinery:

- `agent`
- `harness`
- `spec`
- `validator`
- `metadata`
- `runtime contract`
- `mock`
- `prototype`
- `seed`
- `fixture`
- `test data`
- `debug`
- `dev`
- raw exception names
- API route names
- repository paths
- implementation TODO labels shown as product copy

Contextual exceptions are allowed only inside clearly marked reviewer-only
sections. They must never appear in screen chrome, card content, empty states,
error states, loading states, paywall states, onboarding, or rendered mock copy.

## Learner And Reviewer Boundary

A publishable learner preview must declare `data-audience="learner"` on its
document body and mark the copied or templated application root with
`data-learner-surface`. Declaring learner audience without a learner-surface
marker fails closed; omission is not an exception to scanning.

A reviewer harness must declare `data-audience="reviewer"`. Reviewer-only
notes, controls, generated CSS content, and scripts may remain outside the
marked learner surface, but the embedded learner template itself is scanned as
user-visible copy. Unmarked mixed learner/reviewer documents fail closed.

The learner route must be self-contained with respect to review machinery. It
must not fetch, import, parse, clone, or execute a reviewer harness or its
scripts and styles. If a reviewer harness embeds the learner surface, parity
must be protected by a single-source build or an automated equivalence check;
the allowed dependency direction is reviewer evidence consuming a learner
artifact or shared build source, never a learner route consuming reviewer
evidence.

The quarantine scanner covers learner-visible markup, accessibility
attributes, CSS-generated strings, and inline dynamic copy. A reviewer-shell
exception applies only when the reviewer audience is explicit; it does not
weaken scanning of the marked learner template or any independent learner
preview.

## Canonical Public Library Labels

`spec/knowledge-map.json` owns the canonical library names. In learner-facing
UI, and only with the public `馆` suffix, these seven labels are product copy
rather than metadata leakage:

- `听力馆`
- `仔细阅读馆`
- `选词填空馆`
- `写作馆`
- `翻译馆`
- `词汇馆`
- `语法馆`

This exception is intentionally narrow. A standalone canonical library name,
any real group or box label, numeric card/box references, metadata fields, and
English storage labels remain quarantined. The scanner masks only the seven
exact public forms before applying the existing raw-label rules; it does not
weaken group, box, id, or process-term protection.

## Audit Scope

The quarantine gate applies to:

- `docs/design/visual-reference.html`
- `docs/design/canon.md`
- `docs/design/briefs/**`
- `docs/design/directions/**`
- `docs/design/decisions/**`
- `docs/design/interaction-motion/**`
- `docs/design/physical-space/**`
- `docs/design/mocks/**`
- `docs/design/storyboards/**`
- `docs/design/search-runs/**`
- PR body descriptions of user-facing UI
- implementation mapping files

The gate also applies to generated screenshots or external design files when
they are used as accepted proof.

## Required Review Questions

Before a design artifact can be accepted, the reviewer must answer:

- Does any user-visible string contain internal process or engineering language?
- Are loading, empty, error, permission, paywall, and recovery states free of
  internal vocabulary?
- Does the artifact distinguish reviewer notes from user-visible copy?
- If the artifact was AI-generated, are prompt or tool traces absent from the
  user-visible layer?
- If any metadata-like term remains, is it clearly outside user-visible content?

## Repair Rule

Repair is not a find-and-replace exercise. If metadata leakage appears, the
artifact must be reviewed for the underlying framing error: the design may be
explaining the system to the team instead of helping the learner complete a CET
task.

After repair, the artifact returns to `candidate_exploration` until a reviewer
re-accepts it.

## Delivery Rule

Implementation PRs must not consume quarantined artifacts. If the only available
artifact for a UI change is quarantined, the correct next step is a design-only
repair PR, not RN implementation.
