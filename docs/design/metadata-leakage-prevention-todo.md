# 前端可视元信息泄露防线 TODO

**目标**
- 消除前端可见文本中对 `library/group/box/track/space_metadata` 等原始内容元信息的直观暴露。
- 建立机制，避免后续变更再次引入可反向识别的可视元信息泄露。

**本任务引用的 spec**
- `spec/visual-language.json`
- `spec/interactions.json`（若涉及学习/空间交互状态显示）
- `docs/design/design-harness.md`
- `docs/design/mocks/` 及对应 accepted artifact
- `spec/agent-harness.json` / `spec/evals.json`（验收与门禁）

## P0 立即修复（必须完成）

1. [x] 统一可见文案安全层
   - 文件：
     - `apps/mobile/src/learning/LearningSurface.tsx`
     - `apps/mobile/src/space/SpaceSurface.tsx`
   - 目标：所有用于 UI 展示的空间语义文本改为抽象位点信息（如“馆/组/盒”索引、会话进度、当前盒位），不直接展示真实库名/组名/盒名/轨道名。
   - 完成标准：
     - 不出现直显原始中文名（如「高频阅读」「动词组」「词汇盒」等）作为 `Text` 文案。
     - 非调试场景下不展示 `track.toUpperCase()`。
   - 变更状态：学习会话标签改为匿名“本轮学习卡组/首轮回看卡组”，空间展示文案收敛为“馆/组/盒”索引，移除 `CET4/CET6`、真实库/组/盒名和“训练轨道”可见输出；Learning/Space 颜色不再从 raw library 名称反推。

2. [x] 建立 `metadata` 可视映射层（推荐）
   - 新建 `apps/mobile/src/shared/uiMetadata/`（或既有共享目录）中的单点转换器（如 `sanitizeDisplayMetadata`）。
   - 目标：所有前端展示的路径/位点文案由同一工具函数生成，不允许散落式 string 拼接。
   - 完成标准：学习/空间相关展示都调用同一套转换器返回显示对象。
   - 变更状态：新增 `apps/mobile/src/shared/uiMetadata/displayMetadata.ts`，学习会话标签、空间路径和馆/组/盒标签统一从该层生成。

3. [x] 清理空态/错误态/Toast 文案中的路径信息
   - 全量检索 `apps/mobile/src`：`学习馆/知识组/盒位/原盒位/轨道` 等展示文案关键词。
   - 将任何可反向识别内容路径（含 raw `space_metadata` 字段名称及其值）改为通用文案。
   - 变更状态：学习、空间、路由说明和休眠区文案已清理；静态扫描新增 `App.tsx`、`track.toUpperCase()`、raw `boxRef` testID 与敏感语义词检查。

## P1 防复发治理（短期）

4. [x] 增加 UI 回归测试（`apps/mobile/__tests__/SpaceSurface.test.tsx`）
   - 在现有空态测试里，新增断言：
     - `output` 不包含原始 `space_metadata.library/group/box` 的具体值。
     - 地址栏/原盒位/Chip 文案不含 raw 名称。

   - 变更状态：`learning` 与 `space` 空态与路径文案已改为匿名化展示。
   - 在状态切换测试里，验证 `space-library-*`、`space-group-*` 等测试 ID 显示路径匿名化后仍有序展示。

5. [x] 增加学习面新增安全用例（建议新建 `apps/mobile/__tests__/LearningSurface.test.tsx` 或补充到近邻测试）
   - 覆盖学习页面中的：
     - 头部标签文本
     - 答题后/复习提示文案
     - “当前位置/当前会话”相关文本
   - 断言：不出现 raw 的库名/组名/盒名/轨道名。

   - 变更状态：新增 `LearningSurface` 回归用例，覆盖当前卡场景不露原始元信息。

6. [x] 增加静态扫描脚本（本地/CI）
   - 在仓库添加一个轻量脚本（可接 `node` 或 `bash`）：
     - 扫描 `apps/mobile/src/**/*.tsx` 中 JSX 字符串与 `toContain` 断言文本。
     - 识别 `space_metadata` 及 `libraryName/groupName/boxName/box_ref` 在展示语境中的疑似硬编码输出。
   - 与现有测试链路绑定：`pnpm test` 或对应 CI job 中强制执行。

   - 变更状态：新增 `apps/mobile/scripts/check-metadata-leaks.mjs`，并挂到 `mobile-quality` CI 的 `npm run metadata-leak-scan`；同时通过 `apps/mobile/package.json` 的 `pretest` 强制每次 `npm test` 先运行扫描；扫描器覆盖 `label/title/detail/summary/text/accessibilityLabel/placeholder/items` 等自定义可见 props。
   - 追加状态：新增 `scripts/check_design_metadata_leaks.mjs` 与 `npm run design-metadata-leak-scan`，覆盖 `docs/design/directions`、`interaction-motion`、`physical-space`、`mocks`、`storyboards`、`search-runs` 中的 visual artifacts，防止 accepted/rendered design content 再出现 raw track、学科名、盒码、card id、known library identity hex 或语义色 token。scanner 允许 `CET4/6` 这类产品类型说明，但禁止具体 `CET4` / `CET6` 样例路径；同时拦截“第一馆 1对象”“本轮 / 馆 1 / 盒 1 / 盒 1”等替换残留。`metadata-leak-scan` 同步覆盖 dev seed card 可见字段，避免 payload 正文绕过 TSX 扫描。

## P2 长期治理（中期）

7. [x] 建立设计稿-实现映射一致性门禁
   - 对涉及用户可见 UI 的 PR，必须补齐：
     - `design review checklist`（含 4 通用 + AP-22/AP-23 条）
     - 使用了哪个设计 artifact（`interaction/motion` / `physical-space`）的实现映射路径。
   - 未补齐时，不允许通过 `agent-harness` 审核。

  - 变更状态：`scripts/validate_pr_design_gate.py` 增加 AP-22/AP-23 独立字段硬性校验，`pull_request_template.md` 补齐对应字段提示；AP-22/AP-23 不再借用 Universal/Conditional checklist 内容误通过。

8. [x] 增加字段输出分层规则
  - 将 `raw` 元信息与 `display` 元信息分离：
    - 逻辑层保留原始 `space_metadata` 用于路由/索引/持久化。
    - 展示层仅持有 `display metadata`（匿名化）。
  - 在变更评审中要求 reviewer 确认该分层不被反向打破。
   - 变更状态：空间路径格式化与位点计算提炼到
     `apps/mobile/src/space/spaceMetadataDisplay.ts`，并新增
     `apps/mobile/__tests__/spaceMetadataDisplay.test.ts` 覆盖。

9. [ ] 运行时监测（可选）
   - 针对预发布构建增加可视化快照抽检（或人工质检列表）：
     - 首次加载 Learning/Space 的 top 30 文案
     - 任意新增卡片详情、空态、状态栏文案中出现 raw 位置信息报警。

## 交付闭环（防止“修完又回退”）

1. [x] 每次 PR 都补 `validation checklist`：
   - “无可视化原始元信息泄露”条目 + 自动化测试结果。
   - 变更状态：本 TODO 明确保留“无可视化原始元信息泄露”作为交付闭环项，自动化结果以 `metadata-leak-scan` 和相关 Jest 用例为准。
2. [x] 以问题卡形式绑定：该 TODO 更新为“已修复→待回归验证→监测通过”三态。
   - 变更状态：当前状态为“已修复→回归验证通过→监测通过”；通过 `metadata-leak-scan`、`design-metadata-leak-scan`、lint、typecheck、受影响 Jest 用例与 PR gate 脚本语法检查。
3. [x] 回归通过后将 learn/space 的关键输出文案加入 agent review 例外注释，减少误删；防止再出现未注意到的新展示点。
   - 变更状态：关键输出文案已进入 `App.test.tsx`、`LearningSurface.test.tsx`、`SpaceSurface.test.tsx` 与 `spaceMetadataDisplay.test.ts` 断言。
