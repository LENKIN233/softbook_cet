# Leadership Screenshot Handoff v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `spec/harness-architecture.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `docs/design/design-harness.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Target Surface

- Surface: Learning and Space handoff screenshots.
- Device class: phone.
- Frame: `393 x 852`.
- Rendered asset: `docs/design/mocks/leadership-screenshot-handoff-v1.html`.
- Generated screenshot assets:
  - `docs/design/mocks/leadership-screenshot-handoff-v1/board.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v1/home.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v1/card-list.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v1/detail.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v1/space.png`
- Export targets:
  - home screenshot: first-entry Learning summary.
  - card-list screenshot: box-contained card list.
  - detail screenshot: completed card explanation.
  - space screenshot: physical Space overview.

## Product Truth

Learning remains a system-sequenced single-card flow. The handoff uses the Learning entry as the first screen rather than creating a separate marketing home page.

Space remains a top-level physical hierarchy. The card-list screenshot is intentionally represented as cards contained by the current box, not as a flat list or a standalone word page.

Favorite remains a tag on a card object. Sleep remains a physical state under the owning box and affects the learning flow without becoming a separate container.

## Implementation Hypothesis

This artifact is a leadership-ready screenshot board derived from accepted visual and mapping artifacts:

- `docs/design/mocks/learning-space-phone-frames-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

It does not add product operations, card content, runtime behavior, or RN implementation. It packages the already accepted Learning / Space visual language into a small set of screenshot views that can be sent without additional explanation.

## Screenshot Set

1. 首页
   - Purpose: show the default entry is current-card learning.
   - First-read path: current learning chip -> current card task -> option grid -> tools -> address -> nav.
   - Risk avoided: a marketing splash or module picker.

2. 卡片列表
   - Purpose: answer the requested list view while preserving product truth.
   - First-read path: current box -> sibling boxes -> contained cards -> favorite/review tags -> sleep zone.
   - Risk avoided: a flat word list, a favorites box, or a sleep-only archive.

3. 学习详情
   - Purpose: show that a completed card produces useful exam-facing explanation.
   - First-read path: completed card -> answer comparison -> explanation -> misconception -> continuation.
   - Risk avoided: a dense result dashboard or raw source/detail labels.

4. 知识空间
   - Purpose: show the physical Space differentiator.
   - First-read path: address -> current box -> box contents -> state -> return to Learning.
   - Risk avoided: reducing Space to statistics or collection management.

## Ready-To-Send Copy

可以发这句话作为截图说明：

```text
这是软书四六级当前的界面方向截图：包含首页、卡片列表、学习详情和知识空间。卡片列表不是普通词表，而是当前知识盒里的卡片内容，能看到卡片位置、收藏、回看和休眠状态；学习页仍然保持系统顺序的单卡练习。
```

## Known Boundaries

- This is a rendered screenshot handoff, not a replacement for RN implementation evidence.
- The card prompts are demonstration copy for visual handoff only and are not repository-approved release card content.
- Tablet and pc web screenshots remain governed by `docs/design/decisions/learning-space-platform-layout-v1.md`.
- The artifact should be regenerated if a later accepted Learning or Space visual baseline supersedes the current one.

## Design Review Checklist Answers

Q1: Current library is represented by a neutral current-library slot. The display accent is the single strong accent for chips, active card, current box, and primary actions. Mint and amber appear only as state feedback families.

Q2: The focal object is explicit per screenshot: 首页 focuses on current card learning; 卡片列表 focuses on current box contents; 学习详情 focuses on the completed card explanation; 知识空间 focuses on the current box in physical Space. Each first-read path is listed above.

Q3: 首页 uses the multiple-choice silhouette: prompt top plus 2x2 option grid. 卡片列表 and 知识空间 use the Space hierarchy silhouette: parent context, current box, contained card objects, card state, and return continuity. 学习详情 uses the resolved-card explanation rhythm rather than a new interaction family.

Q4: No forbidden design patterns are introduced: no gradient text, gamification chrome, full-width bottom tabbar, removed self-assess tokens, serif dependency, raw internal identifiers, repo paths, or process wording in user-visible HTML.

Q5: The rendered phones are fixed to `393 x 852`. The board uses responsive wrapping, no horizontal overflow at narrow viewport, and all CTAs/nav capsules remain inside the phone frame.

Q6: Learning does not expose module selection as the primary path. The screenshot set does not add stats as a primary surface. Flip self-assess is not shown in this handoff, so the two-level self-assess rule is not altered.
