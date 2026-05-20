# Learning Surface 3 Directions

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`

## Product Truth

Learning 是产品第一入口。它必须让用户感觉自己被一个懂 CET4/6 的系统带着走，而不是被要求管理模块、计划、统计或卡片位置。

本方向稿只讨论 Learning surface 的设计方向。它不替代 `spec/interactions.json`，也不定义 RN 组件树。

## Implementation Hypothesis

所有方向默认继承 Aurora Glass token、Law of One、当前 library 单强色、5 个 interaction silhouettes、flip 两档自评，以及 `Learning + Space Worldview` 中的“有空间坐标的考试手册”命题。

本文用 `current / 组 1 / coral` 作为示例 current library。真实实现必须按当前卡所属 library 替换身份色。

## Shared Invariants

所有方向都必须保留：

- 一屏一个当前卡作为焦点物。
- 当前位置线索轻量可见，但不把模块选择做成主路径。
- `peek`、`favorite`、`hint_reveal` 是轻量次级入口。
- 系统排序优先，用户只做低负担动作。
- flip 只出现 `有把握 / 再回看` 两档自评。
- AP-23 proof: `有把握` maps to confident/mint, `再回看` maps to review/amber; no red or four-state self-assess is introduced.
- auto-scored interactions 不使用 self-assess feedback 色。
- Space 是当前卡的背景坐标，不是单独的收藏夹或 dashboard。

## Direction A: Editorial Exam Card

### Aesthetic Thesis

把当前卡做成一页高可信考试讲义：排印、层级和留白承载权威感，空间线索像章节索引。

### First-Read Path

```text
library rail -> exam prompt -> primary answer area -> feedback / analysis -> address hint
```

### Focal Object

一张精修讲义页。它比普通 flashcard 更像“考试资料中的一页”，内容密度稍高，但只给当前动作必需的信息。

### Composition Skeleton

```text
┌─────────────────────────────┐
│ current chip · 本轮 · 匿名盒 │
│                             │
│  Prompt / exam context       │
│  Large editorial card body   │
│                             │
│  Interaction-specific area   │
│                             │
│  Peek · Hint · Favorite      │
│  Primary action / feedback   │
│                             │
│  Address: library/group/box  │
└─────────────────────────────┘
```

### Interaction Silhouette library-5

- `flip`: editorial card front/back; bottom 2-pill self-assess remains outside the page body.
- `multiple_choice`: prompt block reads as article excerpt; options remain 2x2 tiles, not a list.
- `lock`: page body becomes an ordered sentence ledger; lock rows sit inside the paper plane.
- `elimination`: candidates appear as editorial annotations with visible strike state.
- `swipe`: page becomes a single movable decision card; side trails are restrained margin cues.

### State Language

- Correct / incorrect is an answer reveal, not emotional reward.
- Review state is amber only for flip self-assess.
- Favorite is a tag dot or pin mark, not a physical destination.
- Sleep entry is hidden from the primary path unless the current context asks for management.

### Strength

Exam trust is strongest. It naturally avoids game chrome and marketing styling.

### Failure Risk

It can become too traditional: good-looking notes, but not enough physical-space differentiation. If address hints feel like breadcrumbs only, this direction loses the product's unique spatial promise.

## Direction B: Knowledge Object

### Aesthetic Thesis

把当前卡做成一个有地址、可翻阅、可揭示、可归档的知识物件。它不是白卡容器，而是空间里被递到眼前的一块可操作材料。

### First-Read Path

```text
current card object -> interaction affordance -> light tools -> address aperture -> next card
```

### Focal Object

一张厚玻璃知识物件。内容平面、操作平面和空间地址以层叠关系存在：内容在正面，hint 像从卡后方露出的薄层，address 像卡边缘的坐标刻痕。

### Composition Skeleton

```text
┌─────────────────────────────┐
│ ambient map fragments        │
│                             │
│      ╭────────────────╮     │
│      │ current object  │     │
│      │ exam content    │     │
│      │ interaction     │     │
│      ╰────────────────╯     │
│       peek hint favorite     │
│                             │
│  address aperture · box      │
│  floating nav capsule        │
└─────────────────────────────┘
```

### Interaction Silhouette library-5

- `flip`: physical flip is literal but restrained; front/back are two material planes, not a magic animation.
- `multiple_choice`: options are inset tiles attached to the object, preserving the 2x2 silhouette.
- `lock`: object becomes a vertical mechanism with lock rows; unlocking reveals analysis behind the surface.
- `elimination`: candidates sit on a removable overlay; strike-through looks like removing interference from the object.
- `swipe`: object is a single top card with visible left/right trail hints.

### State Language

- Current library color appears on one edge, CTA, and selected affordance.
- Address uses low-weight chips; other library colors may appear only as dim map fragments.
- Hint reveal is a physical layer, not a new card type.
- Space entry feels like opening the object's location drawer.

### Strength

This direction carries the product's strongest difference: cards physically exist inside a knowledge map, and the user acts on one object at a time.

### Failure Risk

Material taste can overpower exam content. If glass, shadows, and layer metaphors become the message, the product turns into a visual demo and loses study trust.

## Direction C: Focus Console

### Aesthetic Thesis

把 Learning 做成一个极低负担的行动控制台：当前卡、当前动作、下一步反馈明确，空间只作为轻量 drill-in。

### First-Read Path

```text
current action -> answer / gesture -> result -> next
```

### Focal Object

当前交互任务。卡片内容退后一步，操作效率成为第一读对象。

### Composition Skeleton

```text
┌─────────────────────────────┐
│ current library · progress   │
│                             │
│  compact prompt              │
│  large interaction module    │
│                             │
│  primary CTA / gesture hint  │
│  peek · hint · favorite      │
│                             │
│  tiny address drill-in       │
└─────────────────────────────┘
```

### Interaction Silhouette library-5

- `flip`: efficient card + two-pill row.
- `multiple_choice`: prompt + 2x2 grid dominates.
- `lock`: lock rows dominate.
- `elimination`: candidate strike grid dominates.
- `swipe`: top card and side trails dominate.

### State Language

- Strong feedback and next-step rhythm.
- Address is a tiny secondary drill-in.
- Tools are icon-only where possible.

### Strength

Fastest to understand and easiest to implement across interaction types.

### Failure Risk

It can become an ordinary practice app. If address is only metadata, physical space stops being a core differentiator. If progress and control chrome grow, it drifts toward dashboard learning.

## Comparative Judgment

| Criterion | A Editorial Exam Card | B Knowledge Object | C Focus Console |
|---|---:|---:|---:|
| CET exam trust | 5 | 4 | 3 |
| Physical-space differentiation | 3 | 5 | 2 |
| One-current-card clarity | 4 | 5 | 4 |
| Low operation burden | 4 | 4 | 5 |
| Risk of generic flashcard | 3 | 2 | 4 |
| Risk of visual demo | 2 | 4 | 1 |
| Multi-device adaptability | 4 | 4 | 5 |
| Best as primary direction | maybe | yes | no |

## Direction To Accept

Accept Direction B as the core, but constrain it with:

- A's editorial authority for content typography.
- C's action clarity for interaction modules.

The resulting accepted direction should be named:

```text
Addressed Exam Object
```

## What This Rejects

- A pure lecture-page UI: trustworthy but not spatial enough.
- A pure object UI: distinctive but too self-indulgent.
- A pure console UI: clear but generic.
- Any direction where the first screen asks the user to choose modules.
- Any direction where Space is hidden until the user manually manages cards.

## Design Review Checklist Answers

Q1: Example current library is `current`; coral is the only strong accent. Other library colors are allowed only as low-weight map fragments.

Q2: Focal object differs by direction, but the accepted candidate keeps the current card object as first read, then interaction, then light tools/address.

Q3: Each direction explicitly maps to the 5 canonical silhouettes from `spec/visual-language.json#interaction_silhouettes`.

Q4: No visual output is rendered here, and no forbidden design pattern is introduced.

Q5: Not applicable. No phone frame is rendered in this artifact.

Q6: Learning-specific rule is preserved: no module-selection primary path, and flip has exactly two self-assess options.
