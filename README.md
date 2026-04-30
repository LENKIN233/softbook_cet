# 软书四六级

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`

## 当前阶段

- `product_truth`: `v1` 仍然要闭合 `learning / space / statistics / mine` 四个顶层入口，并满足登录先于学习、试用/会员矩阵、日级进度同步和跨端统一 entitlement。
- `implementation_hypothesis`: `main` 上的 `apps/mobile` 已经形成 iOS 优先的本地安全基线：手机号验证码登录门槛、学习/复习、知识地图空间、统计签到、我的页、会员试用/付费墙、日级进度同步都先在本地宿主闭环；下一步优先推进真实账号 / entitlement / sync 合同接线，而不是继续堆新页面。

## 目录

- `spec/`: 活跃产品与合同真相源
- `apps/mobile/`: React Native 移动端工程
- `docs/`: 工程协作约定与流程文档
- `.github/workflows/pr-gates.yml`: PR 质量门禁（harness 校验 + mobile lint + mobile typecheck + mobile test）
- `.github/pull_request_template.md`: PR 合同模板（spec / 摘要 / 验证 / 视觉 checklist）
- `scripts/validate_harness.py`: harness 校验脚本（spec owner 一致性 + main 分支治理护栏）
- `scripts/bootstrap_mobile_ios.sh`: iOS 依赖重装脚本

## iOS 开发基线

当前仓库已经初始化为 React Native 0.85.x 工程，目录在 `apps/mobile`。

### 当前主线已覆盖

- 手机号验证码登录门槛
- 单卡学习主流与 review flow
- 物理空间知识地图与 sleep / favorite 动作
- 统计 / 签到 / 我的页壳层
- 本地会员试用、付费墙、恢复购买提醒
- 日级进度同步 runtime（本地安全默认，可切远端）

## 分支策略

分支策略文档见 [docs/branching-strategy.md](/Users/lenkin/programing/softbook_cet/docs/branching-strategy.md)。
原则是按需求域推进，一次只打磨一个模块，不设长期 `develop` 分支。
clone 或新增 worktree 后先运行 `./scripts/install_git_hooks.sh`，再执行 `python3 scripts/validate_harness.py` 确认本地 hooks 与 GitHub `main` 保护都仍然生效。
任何会持久化仓库改动的任务，除非明确要求只做本地修改，否则默认走 topic branch -> commit -> PR -> agent review -> merge；只有 review / gate / 权限失败时才停在 PR 或 branch handoff。

### 依赖前提

- Node.js `>= 22.11.0`
- Xcode 26+
- `watchman`
- `cocoapods`

### 重装依赖

```bash
./scripts/bootstrap_mobile_ios.sh
```

### 启动开发

```bash
cd apps/mobile
npm start
```

新开一个终端：

```bash
cd apps/mobile
npm run ios
```

### 学习卡源 runtime config

`apps/mobile` 现在会在启动时读取 `src/runtime/appRuntimeConfig.ts`，并把配置注入到全局 runtime。

- 默认配置是本地登录 + 本地卡源 + 本地会员 entitlement + 本地日级同步 + 本地空间状态 + 本地 learning state：

```ts
export const SOFTBOOK_APP_RUNTIME_CONFIG = {
  auth: {
    mode: 'local',
  },
  learningSource: {
    mode: 'local',
  },
  membership: {
    mode: 'local',
  },
  progressSync: {
    mode: 'local',
  },
  spaceState: {
    mode: 'local',
  },
  learningState: {
    mode: 'local',
  },
};
```

- 如果你要切到远端认证 / 卡源 / entitlement / 日级同步 / 空间状态 / learning state，优先用 `createSoftbookRemoteRuntimeConfig`：

```ts
export const SOFTBOOK_APP_RUNTIME_CONFIG = createSoftbookRemoteRuntimeConfig({
  baseUrl: 'https://your-api.example.com',
  apiKey: 'your-dev-key',
  learningTrack: 'cet4',
});
```

不要把真实密钥提交进仓库；提交前请恢复成安全的默认本地配置。

- `auth`：手机号验证码请求 / 校验仓储
- `learningSource`：学习卡源仓储
- `membership`：entitlement 读取、开始试用、开通会员、恢复购买提醒状态更新
- `progressSync`：日级进展同步仓储
- `spaceState`：收藏/休眠等空间状态同步仓储
- `learningState`：逐卡学习作答状态同步仓储

如果 `learningSource.mode === 'remote'`、`membership.mode === 'remote'`、`progressSync.mode === 'remote'`、`spaceState.mode === 'remote'` 或 `learningState.mode === 'remote'`，则 `auth.mode` 也必须是 `remote`，否则 runtime config 解析会直接失败。

如果远端学习卡源请求失败或 payload 不合法，`learningRepository` 会自动回退到本地结构化卡源，保持现有学习 UI 和交互不变。

### 本地会员/付费墙壳层

`apps/mobile` 现在还会在本地壳层里表达会员矩阵：

- 试用不会在注册时偷跑，而是在首个计入入口开始
- 免费态保留基础学习，并把可学习卡量收口到接近一半
- `space` 和 `review` 会被试用/会员权限 gate 住
- “我的”页会承接试用起算、开通会员、恢复购买提醒

当前这些都是本地 entitlement 实现，用于验证产品合同，不代表真实计费服务已经接通。

### 接下来优先做什么

- 继续沿 `cross/*` 的合同分支推进真实账号 / entitlement / daily sync 接线
- 保持一次只推进一个主线分支；新分支开始前先把 `main` 上的 README / 分支文档 / harness 校验同步到当前基线
- 暂不提前开 Android / Web 业务工程，也不提前扩统计或其它外围页面

### 常见恢复

如果 Xcode 报 iOS platform / simulator runtime 缺失，可以先执行：

```bash
xcodebuild -downloadPlatform iOS
```

然后再回到 `apps/mobile` 重跑 `npm run ios`。

## 当前不做

- 不提前搭 Android 开发环境
- 不提前搭 Web 端工程
- 不提前拆业务模块或共享包
