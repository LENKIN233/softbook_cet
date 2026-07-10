# Space Surface Visual Directions v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/briefs/learning-space-worldview.md`
- `docs/design/physical-space/space-model-v1.md`

## Product Truth

Space 是顶层产品能力，不是普通列表页、统计页或收藏夹。每张卡都必须被解释为 `library -> group -> box -> card` 层级里的知识对象。Favorite 是 tag，sleep 是空间状态，二者都不能替代原始知识归属。

本 artifact 不改变 `spec/knowledge-map.json`、`spec/space-operations.json` 或 `spec/box-catalog.json`。

## Why This Exists

现有 `learning-space-phone-frames-v1` 只有一个 Space phone frame，足以证明方向，但不足以像正式设计稿一样支撑 Space RN implementation。这个 artifact 补齐 Creation / Judgment Harness：先给出三个可视方向，再选择一个作为后续实现依据。

Rendered visual proof:

- `docs/design/mocks/space-surface-visual-proof-v1.html`

Accepted proof companion:

- `docs/design/mocks/space-surface-visual-proof-v1.md`

Refined accepted visual baseline:

- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.html`

## Shared Invariants

所有方向都必须保留：

- 至少三层空间关系：library context -> group context -> current box focus -> card objects / states。
- 当前对象必须是 box 或 card，不是操作面板。
- Favorite 必须画成卡片上的 tag state。
- Sleep 必须画成保留原归属的 sleeping zone，不是删除、归档或收藏盒。
- 返回 Learning 必须保留当前空间上下文。
- 当前 library 遵守 Law of One：只有一个 dominant accent。

## Direction A: Shelf Map

### Aesthetic Thesis

把 Space 做成一排可浏览的考试知识书架。library / group 是架层，box 是抽屉，card 是抽屉里的对象。

### First-Read Path

```text
library shelf -> group rail -> current box drawer -> contained cards -> sleep side bay
```

### Strength

空间层级最直观，能明显区别于普通卡片列表。

### Risk

如果 drawer 和 shelf 太强，用户会以为空间是目录管理器，而不是 Learning 当前卡的背景坐标。

### Rejected As Primary Because

它的空间感强，但当前 box 的考试内容权威感不够，容易把用户引向浏览而不是继续学习。

## Direction B: Box Desk

### Aesthetic Thesis

把当前 box 放在一张安静的学习桌面上：上方是 parent context，中央是 current box object，下面是 contained cards 与有限状态操作。

### First-Read Path

```text
library/group breadcrumb -> current box object -> contained cards -> favorite/sleep state -> return to Learning
```

### Strength

当前对象和父层级同时清楚；favorite / sleep 都能作为 card state 出现，不抢走空间归属。

### Risk

如果 card tiles 过多，会退化为普通列表。实现时必须限制密度，让 current box 始终是 first-read object。

### Accepted Direction

Accept Direction B as the Space primary visual direction. It best matches `Addressed Exam Object`: Learning sees the current card; Space sees the box that owns and explains that card.

## Direction C: Operation Dock

### Aesthetic Thesis

把 Space 做成围绕当前卡的操作泊位：inspect、favorite、sleep、wake、return 被压成高效率工具面。

### First-Read Path

```text
current card address -> operation dock -> nearby cards -> return action
```

### Strength

低操作成本，动作很清楚。

### Risk

它太接近工具面板，会弱化 physical-space 产品能力，也容易把 favorite / sleep 当成普通管理动作。

### Rejected As Primary Because

它可以作为状态交互的局部参考，但不能作为 Space surface 的主方向。

## Judgment

Accepted:

- Direction B: Box Desk

Rejected:

- Direction A as primary: too shelf-first; useful for sibling context only.
- Direction C as primary: too operation-first; useful for state affordance only.

## Implementation Guardrails

Future Space RN implementation must map to Direction B:

- top region maps to library/group parent context;
- main region maps to current box focus;
- card region maps to contained card objects and tag/sleep states;
- sleep zone maps to a side or lower spatial zone, never a replacement box;
- return action maps to Learning continuity, not generic navigation.

## Design Review Checklist Answers

Q1: Current library is represented by the anonymous current-library slot in the rendered proof, and the display accent is the only dominant accent. Other library colors are not used as competing accents.

Q2: The focal object is the current box. First-read path is parent context -> current box -> card states -> return chrome.

Q3: Space is not an interaction silhouette surface; its required silhouette is physical hierarchy with current box focus and card-state objects.

Q4: No forbidden patterns are introduced: no gradient text, no gamification chrome, no full-width bottom tabbar replacement, no pure `#000` / `#fff` dependency, no removed self-assess tokens, no serif dependency.

Q5: Rendered directions use phone-frame containment; follow-up RN implementation must preserve safe-area and avoid clipped CTA/nav at phone width.

Q6: Learning/flip-specific self-assess rules are not altered. Space does not expose module selection as the primary Learning path.

## Known Gaps

- This is design-only; no RN implementation is changed.
- Tablet and pc web Space layouts remain governed by `learning-space-platform-layout-v1`.
- The rendered proof covers core states but not every empty/error state.
