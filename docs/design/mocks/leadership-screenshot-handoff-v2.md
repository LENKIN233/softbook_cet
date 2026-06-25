# Leadership Screenshot Handoff v2

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
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`

## Target Surface

- Surface: Learning and Space leadership screenshot handoff.
- Device class: phone.
- Frame: `393 x 852`.
- Rendered asset: `docs/design/mocks/leadership-screenshot-handoff-v2.html`.
- Generated screenshot assets:
  - `docs/design/mocks/leadership-screenshot-handoff-v2/board.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v2/home.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v2/card-list.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v2/detail.png`
  - `docs/design/mocks/leadership-screenshot-handoff-v2/space.png`

## Product Truth

Learning remains a system-sequenced single-card flow. The first screen is the active current-card task, not a marketing page, module picker, or statistics dashboard.

Space remains a top-level physical hierarchy. The list screenshot is deliberately an opened current box with contained card objects, because a flat card list would damage the product definition.

Favorite remains a card tag. Sleep remains a physical state under the owning box and does not become a second container.

## Implementation Hypothesis

This v2 artifact supersedes `leadership-screenshot-handoff-v1` for leadership-facing screenshots. The v1 artifact proved coverage but read too much like a flat high-fidelity wireframe: gray surfaces, generic cards, and weak physical ownership.

The v2 direction uses a shared "exam desk / opened box / paper card" system:

- 首页: current-card task as the first-read object.
- 卡片列表: opened box tray with contained paper cards, tag state, and sleep alcove.
- 学习详情: completed card plus attached explanation slip.
- 知识空间: shelf context, opened current box, contained card objects, sleep alcove, and return continuity.

It does not add product operations, approved card content, runtime behavior, or RN implementation.

## First-Read Paths

1. 首页
   - current learning chip -> address shelf -> current card -> 2x2 option silhouette -> primary action.

2. 卡片列表
   - current address -> opened box lid -> contained card stack -> tag state -> sleep alcove.

3. 学习详情
   - completed card -> selected answer -> explanation slip -> next-card continuation.

4. 知识空间
   - parent shelf -> opened current box -> contained cards -> sleep alcove -> return to Learning.

## Quality Bar

The screenshot set is judged against the design harness thesis: "让考试资料拥有空间感，让知识卡成为可操作物，让学习推进像翻阅一本有生命的备考书。"

Rejected v1 traits:

- flat gray panel hierarchy;
- generic vertical list impression;
- weak physical ownership between cards and box;
- insufficient distinction between Learning and Space silhouettes.

Accepted v2 traits:

- paper-card materiality with ruled surfaces and visible thickness;
- single strong current-library display accent;
- card-list rendered as box ownership, not a generic list;
- Space rendered as shelf and tray hierarchy, not collection management.

## Ready-To-Send Copy

```text
这是软书四六级当前关键页面截图：包含首页、卡片列表、学习详情和知识空间。卡片列表被放在“当前盒”里呈现，不是普通词表；卡片能看到所属位置、收藏、回看、休眠和返回学习的连续关系。
```

## Known Boundaries

- This is a rendered screenshot handoff, not RN or Web implementation evidence.
- The visible question text is demonstration copy for visual handoff only and is not approved release card content.
- Tablet and pc web screenshots remain governed by `docs/design/decisions/learning-space-platform-layout-v1.md`.
- A later accepted Learning or Space visual baseline should replace this artifact rather than patching screenshots ad hoc.

## Design Review Checklist Answers

Q1: Law of One is preserved. The anonymous current-library display accent is the only strong accent for chips, active box, primary actions, and current-card emphasis. Mint and amber appear only as state feedback families.

Q2: Focal object and first-read path are explicit. 首页 focuses on the current card; 卡片列表 focuses on the opened current box; 学习详情 focuses on the completed card and explanation slip; 知识空间 focuses on the current box inside the shelf hierarchy.

Q3: Interaction silhouettes remain distinguishable. 首页 uses prompt top plus 2x2 multiple-choice grid; 卡片列表 and 知识空间 use physical hierarchy with parent context, box, contained cards, tag state, sleep alcove, and return continuity; 学习详情 uses resolved-card explanation rhythm.

Q4: No forbidden design patterns are introduced: no gradient text, gamification chrome, full-width bottom tabbar, removed self-assess tokens, serif dependency, raw internal identifiers, repo paths, or process wording in user-visible HTML.

Q5: The rendered phones are fixed to `393 x 852`. The HTML sets `overflow-x: hidden`, includes responsive `@media` containment, and keeps buttons, navigation capsules, trays, and card text inside the phone frame.

Q6: Learning does not expose module selection as the primary path. Stats are not made primary. Flip self-assess is not shown in this handoff, so the two-level self-assess rule remains unchanged.
