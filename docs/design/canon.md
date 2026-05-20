# 软书四六级 · Design Canon v2（Aurora Glass）

> 视觉锚点，不是产品真相。真相仍在 `spec/`。本文件与 `docs/design/visual-reference.html` 同生同死；结构化入口见 `spec/visual-language.json`（由 `spec/authority-map.json` 指派为 `visual_language_anchor` 的 owner）。
> 版本差异：v1 走"档案衬线"路线，被判定为"不够现代"；v2 吸收仓库历史 `design-system-v4.html` 的彩色玻璃词汇，推到 VisionOS 级克制与编辑化。

---

## Agent 入口 · 视觉任务强制入口

**你在产出任何视觉稿（mock / screen / component / reference HTML 改动）之前，必须先答完 6 问。产出里不带答案 = 未完成（AP-22）。**

用户可见层零元信息泄露：screen copy、empty/loading/error/paywall/recovery 文案、mock 中的可见标签、HTML proof 中的用户可见文字，都不能出现 agent、harness、spec、validator、metadata、runtime、mock、prototype、seed、fixture、debug、dev、raw exception、API route、repo path 或 TODO 之类内部语义。命中即进入 `docs/design/design-quarantine.md`。

单卡流必须可操作：single-card flow 不是“一屏塞满”，而是一个 current card、一个 primary task、一个主行动区和明确 feedback / recovery / Space continuity。Learning 或核心交互稿必须对齐 `docs/design/single-card-ux-contract.md`。

### 通用 4 问

| # | 问 | 失败信号 |
|---|---|---|
| Q1 | 这屏的"当前 library"是哪一个？强色有且只有这一个吗？ | 同屏出现 ≥2 个学科色作为强色 → VL-AP-01 |
| Q2 | 焦点物是什么？眯眼看，首读路径（焦点→次级→chrome）清晰吗？ | 多个等权元素争抢 → 层级失败 |
| Q3 | 屏幕剪影是否匹配 `visual-language.json#interaction_silhouettes` 里对应交互的形状？不匹配时，指出是哪种交互、为什么要偏差。 | 一个通用卡壳 + 换按钮图标冒充不同交互 → VL-AP-05 / AP-06 |
| Q4 | 是否命中任何 `forbidden_design_patterns`？渐变文字 / 游戏化 chrome（confetti/medal-earned/xp-bar/level-up-toast）/ 贴底全宽 tabbar / 衬线字体 / 已移除的 `--fb-know/--fb-unsure/--fb-prof/--fb-forgot` token？ | 命中即返工 |

### 条件 2 问

| # | 触发条件 | 问 |
|---|---|---|
| Q5 | 任何手机/窄视口渲染 | 布局收敛：目标宽度下无横向溢出、safe-area 被尊重、CTA 与 tabbar 未被剪裁？ |
| Q6 | surface 是 flip / stats / learning | flip 必须恰好 2 档自评（有把握 / 再回看）；stats 必须 tabular-nums；learning 不能把"模块选择"做成主路径。 |

验证器（`scripts/validate_harness.py`）会**机检**其中的一部分（级数、token 一致性、SVG 必带尺寸、保留区内禁用 token）。清单里的其余 = 审稿环节人看。

---

## Do vs Don't · 审美收敛

| Do | Don't |
|---|---|
| Outfit 700–900 实心大字，tracking -0.02 ~ -0.05 | 渐变彩色字 / 衬线 / 霓虹描边（AP-03 / FDP-01/02/06） |
| 浮岛胶囊 tabbar，离底 24–32，玻璃 + 1px 亮边 | 贴底全宽 tabbar（AP-06 / FDP-04） |
| flip 下方两档 pill：mint + amber | 4 档红绿灯自评 / 用红色表达"再回看"（AP-23 / P-25/P-26） |
| 玻璃厚度：blur 40–60 + inset 顶光 + edge rim + 3–4% grain | 纯色卡片 / 方角 / 无光无噪（塑料感） |
| 一屏一强色（当前 library）；其他学科色以小 chip 形式共处 | 两种学科色都做 CTA（VL-AP-01 / P-24） |
| 进度=单根细线 + tabular 数字 | 圆环仪表盘 + 百分比巨字 + XP 条（AP-05 / FDP-03） |

---

## 承重柱（五 + 一）

| # | 公理 | 直接映回 |
|---|---|---|
| ★ | **Law of One** — 一屏一个当前 library，一屏一种强色 | interface_principles · physical_space.library |
| 01 | Aurora 氛围，不是装饰 | interface_principles.quiet |
| 02 | 玻璃有厚度（blur 40–60 + 1px 亮边 + inset 顶光 + 4% grain） | card-as-object |
| 03 | 排印承载权威（尺度 + 紧字距，不用衬线） | desk-authority · modern sans |
| 04 | 交互即轮廓（5 核心交互的屏幕剪影远看可辨） | interaction_contract_status |
| 05 | 空间是彩色地图（七学科色即身份） | must_not_be_reduced_to · AP-02 |

Law of One 可作为单独 PR 检查项：**任何单屏同时出现两种学科色作为强色都要打回**。学科色可以作为小面积 chip/swatch 并列出现（空间地图），但只有"当前 library"的那一个可以驱动 CTA / picked / 分隔 / 重点高亮。

---

## Tokens 摘要

完整渲染见 `docs/design/visual-reference.html`。这里是清单。**加粗号**是 `validate_harness.py` 的 mirror gate 锁定对象（即：改一处必须 3 处同步改，否则验证失败）。

### 身份色（Library · 7）· locked mirror
```
听力 Listening    #5B6DF5   indigo
阅读 Reading      #FF8A3D   coral
选词 Cloze        #22C58B   mint
写作 Writing      #B568F5   violet
翻译 Translation  #18C4E0   cyan
词汇 Vocabulary   #F15B6E   rose
语法 Grammar      #F5B100   amber
```

### 反馈色（Self-Assess · 2）· locked mirror
```
有把握 Confident  #22C58B    — flip 翻面后的两档轻自评，禁用在其他 surface
再回看 Review     #F5B100    — 暖琥珀，不是红色：表示"回来再看一次"，不是"错了/惩罚"
```
对齐 `apps/mobile/src/learning/LearningSurface.tsx`。两档而非四档，因为 `spec/product-core.json` 明确禁止"反复做高成本掌握度判断"——多一档都不叫 light。

### 中性 & 表面
```
page         #F1F0F6         page-tint     #ECEAF4
ink-1        #0B0B14         ink-2         #3A3A4E
ink-3        #7A7A90         ink-4         #ACACBF
glass-100    rgba(255,255,255,.68)
glass-200    rgba(255,255,255,.82)
glass-300    rgba(255,255,255,.94)
glass-edge   rgba(255,255,255,.72)
glass-hair   rgba(11,11,20,.06)
glass-inner  inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 0 rgba(11,11,20,.03)
```

### 夜
```
night        #0B0B12         night-2       #12131C
glass-n-200  rgba(28,28,42,.74)
ink-n-1      #F2F2FA         ink-n-2       #B8B8CE
氛围球亮度   +20%，反馈色饱和 -10%
```

### 排印
```
display    Outfit   700–900   letter-spacing -0.02 ~ -0.05
zh body    Noto Sans SC       400/500/700
en body    Figtree / Inter    (可选)
mono       JetBrains Mono     for numbers & labels (+16% tracking)
numerals   font-variant-numeric: tabular-nums
```

### 圆角 / 间距 / 动效
```
radius     xs 8 · sm 12 · md 16 · lg 22 · xl 28 · 2xl 36 · full 999
spacing    4-base: 4 8 12 16 20 24 32 48 64 96
motion     cubic-bezier(.2,.8,.2,1) · 200–400ms · physical metaphor only
```

### Aurora 氛围（body::before）
3–5 个大直径色球（700–1100px），blur 40px + saturate 1.05，总量透明度 < 22%，当前 library 色占主导。

### Grain（body::after）
SVG turbulence（baseFrequency 0.9, 2 octaves），opacity 0.04，`mix-blend-mode: multiply`。必须有，否则玻璃会"塑料"。

---

## 三层提示词（贴给 agent / 设计师可直接出稿）

### Layer A · Brand Anchor

```
You are designing for 软书四六级 (Softbook CET), an exam-oriented CET4/6
prep product. The aesthetic is "Aurora Glass": soft colored atmosphere,
thick frosted glass surfaces (40–60px blur, 1px bright edge, inset top
highlight, 4% film grain), modern geometric sans display typography
(Outfit, tight tracking), no serif, no gradient text, no rainbow chrome,
no streaks/badges/XP/confetti.

Each library subject has a fixed identity color: listening indigo,
reading coral, cloze mint, writing violet, translation cyan, vocabulary
rose, grammar amber. A screen belongs to ONE current library at a time;
that library's color drives the screen's single strong accent. All other
subject colors may appear at ≤20% alpha only inside space/map views.

Five pillars: aurora-atmosphere, glass-has-thickness, typography-carries-
authority, interaction-is-silhouette, space-is-colored-map. Law of One:
one library, one strong accent, one focal object, per screen. Violating
Law of One invalidates the design.
```

### Layer B · Token Anchor

```
Libraries: listen #5B6DF5 · read #FF8A3D · cloze #22C58B · write #B568F5
· trans #18C4E0 · vocab #F15B6E · grammar #F5B100
Feedback: confident #22C58B · review #F5B100 （仅 flip）
Neutrals: ink-1 #0B0B14 · ink-2 #3A3A4E · ink-3 #7A7A90 · ink-4 #ACACBF
           page #F1F0F6 · night #0B0B12
Glass: blur 40–60px + saturate(1.2–1.3) + 1px edge rgba(255,255,255,.72)
       + inset 0 1px 0 rgba(255,255,255,.85) + 4% SVG-turbulence grain.
Radii: card 22–28 · pill 999 · button 14–16.
Display: Outfit 700–900, tracking -0.02 ~ -0.05, sizes 28 / 44 / 72 / 96.
Body: Noto Sans SC 400/500. Numbers: Outfit 800 tabular or JetBrains Mono.
Motion: cubic-bezier(.2,.8,.2,1), 240–360ms, physical metaphor only.
Shadow light: 0 20px 48px rgba(11,11,20,.10) + 0 4px 12px rgba(11,11,20,.05).
Shadow night: none — use 1px bright edge for layering.
```

### Layer C · Per-Screen Template

```
Design the <SURFACE> surface for <phone | tablet | pc_web>.
Current library: <listen|read|cloze|write|trans|vocab|grammar>.
Apply Layers A + B.

Output these four items ONLY:
  1. page_goal        — one sentence, user-centered
  2. information_goal — what must be visible
  3. key_actions      — ranked list, ≤4
  4. misunderstanding_risks — ≥3 concrete regression paths

Then produce a silhouette sketch (SVG or ASCII) showing:
  - focal point location
  - glass surface hierarchy (back / mid / front)
  - where the single strong accent lives
  - tabbar position

Do NOT produce: component trees, ms-level animation timings, microcopy
scripts, marketing copy, pixel constants.

Reject your own output if: (a) two subject colors act as strong accents
on the same screen, (b) there is a gradient title, (c) there is a streak
or XP element, (d) there is no grain on glass.
```

### 单屏填空表

| surface | page_goal | key_actions | misunderstanding_risks（摘要） |
|---|---|---|---|
| learning | 用户只需要推进这一张 | primary_interaction / peek / favorite / hint | 做成仪表盘；暴露算法；peek 被删；让用户自己选模块 |
| space | 用户看到七学科地图与当前位置 | browse / 放入-取出 sleep / favorite | 退化成两盒；favorite 画成物理盒；允许任意拖拽改盒 |
| statistics | 今日连续性被轻记录，不被打扰 | 签到 | 做成趋势大盘；做成成就徽章；做 streak 礼花 |
| mine | 账户与付费归属在此，不侵入学习 | 开通 / 恢复 / 退出 | 变成设置中心；付费墙当主画面 |
| paywall | 用户理解"此刻为什么被拦" | 开通 / 试用 / 恢复 | 写成促销；遮挡免费态；没给出为什么必须付费 |

---

## 六问自查（交付前必跑）

1. 这屏的"当前 library"是哪一个？强色有没有且只有这一个？
2. 玻璃上是否有 grain？（没 grain 会塑料）
3. 氛围球（aurora）有没有出现？身后色是否与当前学科对得上？
4. 有没有出现：渐变文字 / 衬线 / streak / 徽章 / XP / 礼花 / 粒子 / 波形？任一出现即重做。
5. tabbar 是胶囊浮岛玻璃，还是贴底全宽？贴底即重做。
6. 数字是 tabular-nums 吗？非等宽数字在统计页会跳动。

---

## 与 harness 的边界

harness 明令 `design` 任务只能输出 page_goal / information_goal / key_actions / misunderstanding_risks 四项，且 `do_not_define_as_product_truth` 包括 microcopy / 动效毫秒 / 组件树 / 状态矩阵。

因此：
- 本 canon 与 `visual-reference.html` **可以**：定义 token 取值、五公理、per-surface 目标、提示词模板、组件词汇。
- **不可以**：以组件规范身份进入 `spec/`，以状态机身份进入代码，以文案脚本身份落在 app 里。
- 落位：`session-state/files/`。不进仓库 `spec/`、不进 `docs/`，除非用户显式要求。

---

## 版本律

- v2 以 product-core v0.4.0 · interactions v0.2.0 · platform-contract v0.3.0 · `design-system-v4.html` 中的学科/反馈色语义为锚。
- 任何 spec 变更若改动 `primary_user_feeling` / `secondary_user_feeling` / `physical_space` / `interaction_contract_status` / `ui_requires_dedicated_design`，canon 重做一轮。
- 学科色与反馈色的语义（哪个学科对应哪个色 / 两档自评的语义）改动会让 canon 失效——这一层是**产品身份**而非视觉偏好。
- 色号可微调（±5 明度/饱和），比例、公理、身份映射不可调。
