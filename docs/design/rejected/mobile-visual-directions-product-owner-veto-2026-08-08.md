# Mobile Visual Directions Product-Owner Veto — 2026-08-08

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/doc-manifest.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`
- `docs/design/single-card-ux-contract.md`

## Lifecycle

- Status: `rejected`
- Decision owner: product owner
- Effective date: 2026-08-08
- Scope: mobile phone and tablet visual direction for iOS and Android
- Replacement status: none accepted

This is an active rejection record, not a new visual direction. It records the
product owner's repeated rejection of the rendered mobile result and prevents a
future agent from treating an attractive historical artifact, a closed branch,
or an implementation screenshot as accepted mobile design authority.

## Product Truth Retained

The veto does not change these product truths:

- Learning is a system-sequenced, operable single-card flow with one current CET
  task, one identifiable primary action, bounded secondary actions, feedback,
  recovery, and Learning to Space continuity.
- The five interaction families keep distinguishable silhouettes.
- Flip self-assess remains exactly `有把握` in mint and `再回看` in amber.
- Space must visibly preserve library / group / box / card hierarchy; favorite is
  a tag and sleep is a physical state or zone, not a substitute top-level box.
- iOS and Android share the product hierarchy, while tablet requires a dedicated
  composition rather than a widened phone frame.
- User-facing implementation requires a separately accepted design artifact and
  implementation mapping before RN changes can claim visual completion.

## Rejected Implementation Hypotheses

### Mobile Core Surface Reset v1 / Aurora implementation

The following artifacts are historical evidence only and are explicitly
rejected as mobile implementation authority:

- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/`

The product owner rejected the resulting visual quality after real iOS and
Android use. The direction's neutral rounded panels, frosted Aurora atmosphere,
large capsules, black/white/gray perceived theme, mechanically applied accent,
weak current-card scale, and phone-first composition did not establish a
recognizable or trustworthy Softbook CET product. Its eight candidates also
shared one visual system and mainly varied information arrangement, so they do
not count as eight materially different visual directions for the replacement
search.

### Closed orange editorial proposal

The warm orange editorial proposal on branch `cross/mobile-ux-redesign-v2` is
also rejected and must not be revived as the replacement direction:

- Pull request: `#481`, closed, not merged, no submitted reviews
- Head commit: `5d182b2`
- Candidate decision on that branch:
  `docs/design/decisions/mobile-editorial-study-object-v2.md`
- Candidate proof on that branch:
  `docs/design/mocks/mobile-editorial-study-object-v2.html`
- Candidate search run on that branch:
  `docs/design/search-runs/2026-08-07-mobile-editorial-reset/`

That branch correctly labelled itself as awaiting explicit product-owner
acceptance. Acceptance did not occur. Closing the PR and the subsequent explicit
product-owner visual rejection leave it non-authoritative; warm paper, deep plum
ink, orange/coral margins, and its editorial card grammar may be studied as
failure evidence but not copied into the next implementation.

## Authority Consequence

No mobile implementation or review may cite either rejected direction as its
accepted design source. In particular:

- do not continue by polishing the v1 RN result;
- do not restore Aurora blobs, universal frosted panels, oversized capsules, or
  the orange editorial card as the mobile product identity;
- do not promote either proof through a self-authored review or a PR-body claim;
- do not treat the still-active global visual canon as permission to bypass this
  more specific mobile veto.

`spec/visual-language.json`, `docs/design/canon.md`, and
`docs/design/visual-reference.html` remain active global implementation-
hypothesis anchors until a separately accepted design-only change replaces
them. This record deliberately does not rewrite that global canon. The practical
result is a fail-closed mobile boundary: no new visual implementation is
authorized until a replacement direction is accepted.

## Replacement Search Boundary

`docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v3/` is
`candidate_exploration` only. Its existence, rendered HTML, internal ranking, or
agent recommendation does not equal approval.

A replacement can become mobile design authority only after all of the
following are true:

1. At least eight materially different visual systems are shown, not one shared
   theme with eight information architectures.
2. The selected candidate proves complete critical states, the five Learning
   silhouettes, Space hierarchy, authentication recovery, and quiet supporting
   routes.
3. Phone evidence covers iOS and Android containment; tablet evidence shows
   independent portrait and landscape composition.
4. Final composited contrast, accessible text scaling, touch targets, focus and
   selected semantics, reduce-motion behavior, and overflow are independently
   reviewed.
5. An independent reviewer records a strict pass with named gaps.
6. The product owner explicitly accepts the exact rendered candidate.
7. Only a later, separate implementation PR consumes the accepted artifact and
   mapping.

Until then, the correct lifecycle label is `candidate_exploration`, and the
correct implementation decision is `blocked_by_missing_accepted_mobile_design`.

## Reuse Rule

Product truths and documented failure lessons may be reused. Palette, material,
shape, navigation chrome, radius, typography, and compositional choices from the
two rejected directions may not be reused as a package or described as the
Softbook mobile identity without a new search result and explicit product-owner
acceptance.
