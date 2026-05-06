# Physical Space Model v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Product Truth

Space 是软书的顶层产品能力，不是普通列表页。每张卡都物理存在于 `library -> group -> box -> card` 层级中，Learning 里当前卡也必须能被解释为某个空间位置上的知识对象。

本 artifact 不改变 `spec/knowledge-map.json`、`spec/space-operations.json` 或 `spec/box-catalog.json`。如果知识归属、盒码或操作规则改变，先改 owner spec。

## Spatial Model

### Hierarchy

- Library: CET 能力大类，例如 listening / reading / vocabulary。
- Group: library 内的考试能力簇。
- Box: 可 inspect 的最小空间容器，与 box catalog / knowledge ref 对齐。
- Card: 当前位置上的学习对象，不允许脱离 box 变成孤立收藏物。

### Current Object And Parent Context

Space 首屏必须让用户知道：

- 当前关注的是哪个 box 或 card；
- 它属于哪个 group / library；
- sibling boxes 或 sibling cards 在哪里；
- 如何回到 Learning 继续处理当前或下一张卡。

### Visual Proof Against Flat Drift

合格 Space artifact 或 UI 必须至少表达三层空间关系：

```text
library context
  group context
    current box focus
      card objects / card states
```

只展示 card list、statistics board、favorite box + sleep box，均不合格。

Rendered visual proof for this requirement lives in:

- `docs/design/mocks/space-surface-visual-proof-v1.html`
- `docs/design/mocks/space-surface-visual-proof-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.html`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`

## Allowed Operations

- browse library / group / box hierarchy;
- inspect a box and its contained cards;
- apply or remove favorite tag on a card;
- move supported card into sleep zone;
- wake a sleeping card back into the learning-eligible flow;
- return from Space to Learning with context preserved.

## Disallowed Operations

- arbitrary box reassignment by the user;
- rewriting a card's knowledge ownership;
- treating favorite as a physical box;
- treating sleep as deletion or archival storage;
- flattening all cards into one management list;
- making Space a dashboard of counters instead of a physical map.

## Favorite Tag Semantics

Favorite is a tag state attached to a card object. It can increase visibility or make a card easier to find, but it cannot move the card into a favorite box or replace library / group / box ownership.

## Sleep / Wake State Transition

Sleep is a physical zone that temporarily removes a card from immediate learning pressure without deleting it.

```text
active card in box
  -> user moves to sleep zone
sleeping card remains addressable under original box
  -> user wakes card
active card returns to learning-eligible flow under original box
```

The wake action must preserve original knowledge ownership and avoid implying that the user reorganized the knowledge map.

## Learning To Space Continuity

Learning should expose a compact address aperture:

```text
CET track -> library -> group -> box
```

Space should open as stepping back from the current object to its shelf, not as navigating to an unrelated management page.

## Space To Learning Continuity

Returning to Learning should preserve the user's sense that the card is the same object:

- same current card when the flow context supports it;
- otherwise next eligible card from the same system-sequenced path;
- no module-first detour as the default return path.

## Design Review Checklist Answers

Q1: Current library is the only dominant accent; sibling libraries may appear only as low-weight context.

Q2: Focal object is current box or current card, with parent context visible but secondary.

Q3: Space is not one of the five Learning interaction silhouettes; its required silhouette is hierarchy -> box focus -> card states.

Q4: No forbidden patterns are introduced; this is a prose spatial artifact.

Q5: Not applicable; this artifact contains no rendered phone frame.

Q6: Not a stats/flip surface. It preserves Learning as system-sequenced and does not expose module selection as primary path.
