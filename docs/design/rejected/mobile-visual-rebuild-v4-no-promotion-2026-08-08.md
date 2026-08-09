# Mobile Visual Rebuild V4 — No-Promotion Failure Sedimentation

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `docs/design/design-harness.md`
- `docs/design/design-quarantine.md`

## Lifecycle And Source

- Lifecycle: `rejected_search_evidence`.
- Source run:
  `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/`.
- Exact verdict:
  `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/strict-review.md`.
- Promotion decision:
  `docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/promotion-record.md`.
- Result: all eight exact candidates failed advancement. `mvn-08` is only the
  narrow relative comparison winner and diagnostic evidence that tablet
  adaptation needs a stronger test. It is not a reusable structure input,
  shortlist, accepted design, baseline, or implementation authority.

This file is the durable failure sink required by the design-search harness.
Merging it may preserve rejected evidence; it cannot promote a candidate or
authorize React Native work.

## Product Truth Versus Rejected Hypotheses

`product_truth` remains unchanged: system-sequenced single-card Learning, five
materially different interaction families, exactly two Flip judgements,
library → group → box → card Space containment, reversible sleep/wake, favorite
as a tag, successive Auth, equal iOS/Android priority, and dedicated tablet
composition.

The eight palettes, Unicode navigation marks, sheets, rails, pane ratios,
breakpoints, icon treatments, and platform skins are rejected
`implementation_hypothesis`. Their browser operability does not convert them
into accepted visual language.

## Durable Failure Patterns

| Failure pattern | Trigger signal | Reuse boundary |
| --- | --- | --- |
| Generic glyph navigation | Navigation relies on text glyphs such as `▤`, `⌂`, `▥`, or `○` instead of a coherent platform icon family. | Do not ship or promote. A later proof must pair SF Symbols and Material equivalents with labeled selected, pressed, focus, and Android ripple states. |
| Cosmetic platform adaptation | iOS and Android differ mainly in font, radius, or spacing while back behavior, navigation feedback, safe area, IME, and pressed behavior remain unproved. | Do not call the result cross-platform complete. Require platform-specific state and real-device evidence. |
| Palette assembled from prototype roles | Current-library coral/brick, purple-gray or blue system surfaces, and semantic colors compete or feel like unrelated experiments. | None of the v4 exact palettes may be inherited as authority. A new synthesis must rebuild the palette as one system and keep mint/amber/red semantic roles bounded. |
| Dark brick-red treated as friendly current-library emphasis | The same low-lightness brick family drives current object and CTA across otherwise different candidates, making action feel dated, destructive, or enterprise-like. | Preserve only the stable coral hue-family meaning. Redraw tone/chroma and on-color; do not inherit v4 values or white-on-bright-color without contrast proof. |
| Library and Flip semantic hues collide | 选词填空馆 identity shares mint with `有把握`, while 语法馆 identity shares amber with `再回看`. | Prove distinct tone/chroma, labels, icons, control shapes, and locations. Color alone cannot carry either meaning; later accepted authority must reconcile the token source. |
| Route chrome contamination | A Learning workspace title, current-library label, or progress remains visible on Space, Statistics, or Mine. | Each top-level route requires its own goal and context. Learning chrome must end at the Learning route. |
| Rounded-container proliferation | Header, task, action, result, address, and support regions each receive equal cards, sheets, or pills. | Permit one focal container per screen; prefer spacing, type hierarchy, and dividers for support information. Three nested rounded layers block advancement. |
| Relative winner presented as a selected design | One candidate wins pairwise comparison even though shared P1 findings remain. | Pairwise rank is comparison provenance only. Advancement requires a separate exact hard-filter pass, independent review, and explicit product-owner acceptance. |
| Stretched or unfinished tablet | A phone composition merely widens, creates oversized action regions, or leaves major empty panes; only one candidate has a plausible master-detail shell. | Do not let one candidate's tablet result stand in for the cohort. Prove all five interactions plus Space, Auth, Statistics, and Mine at the required tablet sizes. |
| Browser TTS treated as formal audio | `speechSynthesis` makes a proof button truthful but supplies no approved asset, private-resource delivery, cache, or native lifecycle. | Browser TTS is design-proof behavior only. It cannot satisfy the content-manifest or native playback contract. |
| Representative path presented as complete depth | One Space library can reach group → box → card while sibling libraries are static, or Auth shows only the happy path. | Do not claim product completeness. Prove every required library entry and Auth pending, countdown, offline, failure, retry, edit, and policy-link states. |
| State replacement without causal motion | Flip, route, result, or Space changes appear instantly and only the final state is drawn. | Do not defer motion as decoration. Add accepted causal and reduced-motion storyboards before implementation. |
| Technical PASS presented as visual quality | Overflow, contrast, metadata, and interaction checks pass while composition, color, iconography, platform feel, or product identity remain weak. | Technical gates close defects; they do not constitute UI/UX acceptance or leadership readiness. |

## Rejected Candidate Boundaries

- `mvn-01`: do not reuse the generic shell, glyph navigation, text scale,
  density, or geometry. Its tested 2 × 2 state is evidence only.
- `mvn-02`: do not reuse the clipped/weak Space rail or low-emphasis action
  hierarchy.
- `mvn-03`: do not revive the already-vetoed rail/spine premise.
- `mvn-04`: do not reuse the dated peach-brown palette or nested-sheet stack.
- `mvn-05`: do not reuse the phone action sheet or its oversized tablet
  composition. Thumb reach remains a requirement, not a fragment.
- `mvn-06`: do not reuse the form-like block system as a product direction.
- `mvn-07`: do not treat its weak Learning shell or Space composition as
  accepted. Legible ownership remains a requirement, not a fragment.
- `mvn-08`: do not call the enterprise-like workspace, purple-gray/brick
  palette, glyph icons, or empty lower pane a winning design. Conditional
  tablet context must be re-derived without tracing its master-detail shell.

## Next Synthesis Entry Criteria

A new run starts from product and platform requirements, not named v4
candidates. It must re-derive and then prove:

- one mature palette and one platform-quality icon grammar;
- all five Learning silhouettes and causal/reduced motion;
- complete Auth recovery and all-library Space depth;
- formal audio boundaries;
- iOS phone, Android phone, iPadOS, and Android tablet compositions, plus
  semantic/capability parity with the separately accepted PC Web direction;
- native large text, safe area, IME, VoiceOver/TalkBack, and physical-device
  evidence;
- independent UI/UX advancement review and explicit product-owner acceptance.

Until those conditions are met, the v4 run remains completed no-promotion
evidence and cannot be cited by an implementation mapping.
