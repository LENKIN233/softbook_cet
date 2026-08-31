# 软书四六级

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/machine-acceptance.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`
- `spec/visual-language.json`

## 当前阶段

- `product_truth`: 目标是 `2026-09` 尽快上线；产品内部由 model+harness 持续决策，不存在人工、用户或 product-owner 点击 gate。
- `product_truth`: `v1` 仍然要闭合 `learning / space / statistics / mine` 四个顶层入口，并满足登录先于学习、试用/会员矩阵、日级进度同步和跨端统一 entitlement。
- `product_truth`: 所有呈现给用户的 screen / component / state / chrome 必须先有已接受设计稿或等价设计基准，再进入实现；现有 RN UI 只能作为行为原型，不能作为视觉权威。
- `implementation_hypothesis`: `main` 上的 `apps/mobile` 已经形成 iOS 优先的本地安全基线：手机号验证码登录门槛、学习/复习、知识地图空间、统计签到、我的页、会员试用/付费墙、日级进度同步都先在本地宿主闭环；下一步优先推进设计稿基准与真实账号 / entitlement / sync 合同接线，而不是继续堆新页面。

## 目录

- `spec/`: 活跃产品与合同真相源
- `apps/mobile/`: React Native 移动端工程
- `docs/`: 工程协作约定与流程文档
- `.github/workflows/pr-gates.yml`: 按改动路径运行 task-relevant checks；`main` / schedule / `workflow_dispatch` 仍执行全量验证
- PR model review：同一 model+harness 任务对 exact diff 依次执行假设反转与失败投影两轮扰动审查，并在 PR 描述绑定精确 HEAD、diff 摘要、发现与决定；不调用外部模型 API
- `scripts/validate_maestro_selectors.py`: Maestro smoke selector 校验（禁止用用户可见文案作为 `tapOn` / `assertVisible` 等 selector，并要求 id 有 RN `testID` 背书）
- `.github/pull_request_template.md`: 精简 PR 合同模板（spec / 摘要 / 验证 / Model review）
- `scripts/validate_harness.py`: harness 校验脚本（spec owner 一致性 + main 分支治理护栏 + Maestro selector 防回归）
- `scripts/run_local_gates`: 独立本地质量总入口；`dev` 无远端门禁，`pr` 绑定真实 PR，`release` 追加 macOS Release build，报告只写入忽略的 `exports/local-gates/`
- `docs/release/` / `scripts/validate_launch_readiness.mjs`: 上线状态合同与失败关闭证据校验；绿色 CI 不等于外部账户、正式内容或上线批准
- `scripts/bootstrap_mobile_ios.sh`: iOS 依赖重装脚本
- `spec/visual-language.json` / `docs/design/visual-reference.html` / `docs/design/canon.md`: 用户可见 UI 的设计稿与视觉治理入口
- `docs/design/directions/` / `docs/design/interaction-motion/` / `docs/design/physical-space/` / `docs/design/mocks/` / `docs/design/storyboards/`: 核心方向、交互、动效、空间模型、视觉稿和 storyboard artifact 入口

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
任何会持久化仓库改动的任务，除非明确要求只做本地修改，否则默认走 topic branch -> commit -> PR -> 双扰动 exact-diff review -> required checks -> auto-merge；不等待人工或用户批准。
任何用户可见 UI 改动都必须先引用已接受设计稿 / reference / design brief / direction / decision，并在 PR 中写明设计稿来源、实现映射和未实现设计缺口；同一 PR 内新增的 brief / direction / decision 只能满足 design-only PR。
Learning / core interaction UI 改动还必须引用 interaction-motion artifact 或 storyboard；Space UI 改动还必须引用 physical-space artifact 和 Space visual proof / refinement / shelf-desk baseline；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。

### 依赖前提

- Python `3.12.x`
- Node.js：`dev` 兼容 Node 22+ 但会显式报告漂移；`pr` / `release` 固定 `22.13.0`
- Ruby：`pr` / `release` 固定 `3.3.x`
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

- 如果只是做本地 / CI 的远端 smoke，不要修改 tracked `SOFTBOOK_APP_RUNTIME_CONFIG`。启动前注入环境变量即可让 `index.js` 安装远端 profile：

```bash
cd apps/mobile
SOFTBOOK_CET_REMOTE_BASE_URL=https://your-api.example.com \
SOFTBOOK_CET_REMOTE_API_KEY=your-dev-key \
SOFTBOOK_CET_LEARNING_TRACK=cet4 \
npm start
```

如果要分段 smoke，可用逗号分隔的 `SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES` 暂时把某些 surface 留在本地，例如 `spaceState`。若把卡源留在本地，必须同时选择 `accountBootstrap,learningSource,learningState`，避免远端事件引用未经 canonical bootstrap 验证的本地内容版本。

正式 iOS/Android Release 不读取这些环境变量作为运行时权威。接收方使用无秘密的
`delivery-profile.v1` 与公开 Ed25519 keyring 生成一份确定性的
`mobile-release-runtime-profile.v1`，两端嵌入完全相同的 JSON 字节：

```bash
node scripts/build_mobile_release_runtime_profile.mjs \
  --delivery-profile receiver-profile.json \
  --public-keyring content-manifest-public-keyring.json \
  --commit "$(git rev-parse HEAD)" \
  --output mobile-release-runtime-profile.json

SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE=/absolute/path/mobile-release-runtime-profile.json \
  npm --prefix apps/mobile run android:release:signed -- build --state docs/agent-runs/artifacts/android-release.json --apply
```

iOS 必须通过受控构建器暂存同一份公开 profile。构建器以文件锁防止并发，
只在构建窗口内替换 Xcode Resources 使用的仓库 fixture，完成后无论成功或失败都会
恢复 fixture，并从最终 `.app` / `.xcarchive` 重取、逐字节验证 profile：

```bash
/path/to/node-22.13.0 scripts/build_ios_release.mjs simulator \
  --runtime-profile /absolute/path/mobile-release-runtime-profile.json \
  --derived-data /absolute/path/derived-data

/path/to/node-22.13.0 scripts/build_ios_release.mjs archive \
  --runtime-profile /absolute/path/mobile-release-runtime-profile.json \
  --derived-data /absolute/path/derived-data \
  --archive-path /absolute/path/SoftbookCET.xcarchive
```

`archive` 只使用 Xcode 实际可见的签名配置；缺失账号、证书或 provisioning 时会如实失败，
不会把 unsigned simulator 结果写成签名或真机证据。

Web Release 使用单一 fail-closed 构建命令，从同一份 mobile profile 派生公开且无密钥的
`runtime-config.js`。缺失 profile、commit 不匹配或 profile 非 receiver release 时，构建失败：

```bash
SOFTBOOK_WEB_RELEASE_RUNTIME_PROFILE=/absolute/path/mobile-release-runtime-profile.json \
  npm --prefix apps/web run build
```

签名 Release 缺失或无法严格解析该资源时在构建或 App 注册前失败，绝不回退到本地
卡片、状态或 feature override。仓库的 unsigned CI 只允许嵌入
`configuration_class=repository_fixture`、`gate_eligible=false` 的固定测试资源；
`scripts/inspect_mobile_release_runtime_artifact.mjs` 会从 APK、IPA、`.app` 或
`.xcarchive` 中重取并核对唯一资源的原始字节。

- `auth`：手机号验证码请求 / 校验仓储
- `learningSource`：学习卡源仓储
- `membership`：entitlement 读取、开始试用、开通会员、恢复购买提醒状态更新
- `progressSync`：日级进展同步仓储
- `spaceState`：收藏/休眠等空间状态同步仓储
- `learningState`：逐卡学习作答状态同步仓储

如果 `learningSource.mode === 'remote'`、`membership.mode === 'remote'`、`progressSync.mode === 'remote'`、`spaceState.mode === 'remote'` 或 `learningState.mode === 'remote'`，则 `auth.mode` 也必须是 `remote`，否则 runtime config 解析会直接失败。

如果远端学习卡源请求失败或 payload 不合法，`learningRepository` 会自动回退到本地结构化卡源，保持现有学习 UI 和交互不变。

### CET4 受控试点 bundle 装配

卡片候选内容和模型授权仍只发生在同级 `card make` 工作区。收到它导出的 120 卡
runtime payload、两次独立模型授权、scoped audit，以及 24 条音频的逐卡完整模型听审后，
用产品仓库的装配器生成发布器可直接验证的 `controlled-pilot-bundle.v1`：

```bash
node scripts/build_controlled_pilot_bundle.mjs \
  --profile /absolute/path/controlled-pilot-profile.json \
  --pilot-review /absolute/path/controlled-pilot-review.json \
  --approval /absolute/path/controlled-pilot-approval.json \
  --audit /absolute/path/controlled-pilot-audit.json \
  --candidate-payload /absolute/path/card-source.json \
  --asset-root '/absolute/path/card make' \
  --audio-qc-dir '/absolute/path/card make/reviews/audio_qc' \
  --output-dir /absolute/path/cet4-controlled-pilot-bundle \
  --bundle-id cet4-pilot-bundle-001 \
  --release-id cet4-pilot-release-001 \
  --created-at 2026-08-12T12:00:00.000Z \
  --release-at 2026-08-13T00:00:00.000Z
```

默认只在临时目录装配并执行生产发布器的完整校验；加 `--apply` 才保留输出目录。
缺少或重复音频 QC、非模型 reviewer、复用 run ID、hash/范围漂移都会 fail closed。装配结果始终
`gate_eligible=false`，不能替代正式封闭内测或 launch evidence。

### iOS / CloudBase 远端 smoke

`product_truth`: iOS 端远端运行时必须继续满足登录先于学习、完整试用入口、共享会员 entitlement、日级进展同步、学习状态同步和物理空间状态同步。

`implementation_hypothesis`: 当前 CloudBase dev 环境是 staging runtime，不是最终生产后端；`infra/cloudbase/smoke-ios-runtime.sh` 只验证移动端 REST 合同和 iOS debug runtime profile 注入路径，不会修改 tracked 默认本地配置。

脚本默认用 `SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1` 为合同写入检查生成一次性测试手机号，避免 membership mutation 污染共享测试身份。如果要刻意复用 `SOFTBOOK_CET_TEST_PHONE` 做合同写入检查，可显式设置 `SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=0`。

先跑后端合同和 JS runtime profile 解析：

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
infra/cloudbase/smoke-ios-runtime.sh
```

需要同时验证 iOS Simulator debug 构建、安装和 runtime profile 注入时追加：

```bash
SOFTBOOK_CET_REMOTE_BASE_URL="https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api" \
SOFTBOOK_CET_IOS_LAUNCH=1 \
infra/cloudbase/smoke-ios-runtime.sh
```

启动段会先验证 launch 参数和 bundle ID，再把已启动 Simulator 或 `SOFTBOOK_CET_IOS_SIMULATOR` 精确解析为唯一 UDID；显式 `SOFTBOOK_CET_IOS_DEVICE` 优先。目标、JS runtime profile 测试、debug 构建及已安装 app 查询全部通过后，脚本才执行远端写入 smoke，最后通过 `xcrun simctl launch` 的 `SIMCTL_CHILD_*` 环境变量重新启动 `com.softbook.cet`。脚本完成后自动清理自己创建的 Metro 和隔离 CloudBase 记录，不再等待按键、点击或人工结论。该路径只记录 `automated_simulator_launch_verified=true`；UI 流程和物理真机证据仍为 `false`，`gate_eligible=false`。

完整远端 UI 流程由 harness 运行 `infra/cloudbase/smoke-ios-maestro-runtime.sh`。它自动创建隔离身份并执行登录、学习、空间、同步和统计交互；缺少 Maestro、Java、Simulator 或远端 capability 时直接失败，不回退为人工步骤。模拟器通过只记录 `automated_simulator_ui_evidence_verified=true`；必须由物理设备执行器实际观测后，`automated_real_device_evidence_verified` 才能从 `false` 变为 `true`。

### 本地会员/付费墙壳层

`apps/mobile` 现在还会在本地壳层里表达会员矩阵：

- 试用不会在注册时偷跑，而是在首个计入入口开始
- 免费态保留基础学习，并把可学习卡量收口到接近一半
- `space` 和 `review` 会被试用/会员权限 gate 住
- “我的”页会承接试用起算、开通会员、恢复购买提醒

当前这些都是本地 entitlement 实现，用于验证产品合同，不代表真实计费服务已经接通。

### 接下来优先做什么

- 继续沿 `cross/*` 的合同分支推进 iOS 远端 runtime smoke 与真实账号 / entitlement / daily sync 接线
- 保持 CloudBase backend contract test 进入 PR gate；任何远端 runtime / `/v1/*` 合同改动都不能只跑 mobile gate
- 任何继续呈现给用户的 UI 开发，都先进入设计稿 / visual reference / design brief，再映射到 RN；当前 RN 只作为行为验证壳
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
