---
authority: agent_run_record
audience:
  - agent
status: active
task: all_cards_formal_runtime
branch: cross/all-cards-usable-v1
---
# 2026-08-17 全量卡片正式运行时接线

## 目标

把完整 CET4/CET6 内容从候选工作区接入正式产品运行时和正式交付校验链，保持既有质量、批准和音频 QC 门槛，不再由 120/60 受控试点范围定义完整产品容量。

## 引用权威

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`
- `/Users/lenkin/programing/card make/AGENTS.md`
- `/Users/lenkin/programing/card make/spec/audio-generation-contract.json`
- `/Users/lenkin/programing/card make/spec/review-workflow.json`

## 权威边界

`product_truth`：

- 完整产品同时服务 CET4 与 CET6。
- 初始封闭内测仍可只启用 CET4；正式 production profile 必须完整启用 CET4、CET6。
- CET4 正式门槛保持 1,180 张、108 盒、301 条音频，不通过删减音频降低门槛。
- CET6 正式门槛为 1,234 张、110 盒、328 条音频。
- 每条轨道分别需要精确绑定当前 corpus 的 `full_track_final` 批准和完整正式音频 QC。

`implementation_hypothesis`：

- `full-track-candidate` 只证明完整候选内容可以进入 release-bundle 兼容的运行时 schema。
- 移动端完整候选验收使用模拟 manifest，仅验证解析、交互完成、代表性 UI、音频绑定和可见元数据防泄漏。
- 候选验收始终 `gate_eligible=false`，不声称签名 manifest、人工音频 QC、持久接收方环境或真机证据。

## 变更

- `scripts/build_card_make_runtime_payload.mjs`
  - 新增 `full-track-candidate` 模式；
  - 精确校验 CET4 1,180/108/301 与 CET6 1,234/110/328；
  - 要求五类核心交互齐全且完整消费技术审计中的音频资产；
  - 运行时音频桥接按技术审计合同接受不超过 50 ms 的探测时长差，不再错误要求毫秒级完全相等。
- `infra/cloudbase/release-delivery-v1.mjs`
  - 正式 bundle 改为按轨道策略校验；
  - `closed_beta` profile 精确启用 `cet4`；
  - `production` profile 精确启用 `cet4,cet6`；
  - bundle track 必须出现在 profile 中；
  - audio manifest、QC index、卡片、盒和音频计数全部按轨道 fail closed。
- `infra/cloudbase/manage-beta-entitlement.mjs`
  - beta entitlement 明确拒绝 production profile。
- `infra/cloudbase/cloudbase-receiver-adapter.mjs`
  - 正式回滚按保留版本自身 `track` 验证，不再把 CET6 保留版本错误按 CET4 解析；
  - 增加 CET6 首次激活、后继激活、保留与回滚的接收方回归覆盖。
- `scripts/run_full_track_candidate_mobile_acceptance.mjs` 与共享移动验收
  - 对完整轨道逐卡验证远端解析和可完成性；
  - 对五类交互分别执行代表性 UI 完成；
  - 对所有声明音频验证卡片到 manifest 资产的一一绑定；
  - 保留签名、人工 QC、持久接收方和真机边界为 false。

## 真实候选验收

内容源：

- CET4：`card make` draft PR #182（head `791fa6561fe9aa6055d26732a3284505fff5ec3c`）加 `050101` 音频恢复 PR #186（head `12654d04804e7e0a92a5a39af4e09dedd0e20b88`）。两条分支已于 2026-08-20 重放到包含粗粒度音频信号诊断的最新 `card-make/main`，运行时 payload 内容版本保持不变。
- CET6：`card make` draft PR #184 加 `162001`–`162008` 音频补齐、一致性与双探测器时长修正 PR #185（head `f1a693bf07d9270bd4ae7a9b712a6560d2201e50`）。

结果：

- CET4：1,180 张、108 盒、301 条音频，content version `sha256:11ec57318728e0a812918dbe2cc353b20c7a53348f93ec9659813cf2e0f9bc68`。
- CET6：1,234 张、110 盒、328 条音频，content version `sha256:f1378490ae34afa70b3de4b5bbde28fcadd1bc2d8651267f2718cff42a8b6cc1`。
- 合计：2,414 张、218 盒、629 条音频。
- 两条轨道均为 `all_cards_parseable=true`、`all_audio_cards_bound=true`、`all_cards_learning_completable=true`。
- 两条轨道均覆盖 `flip`、`multiple_choice`、`lock`、`elimination`、`swipe`，各完成 5 个代表性 UI 流程，并精确验证所选代表卡中的 2 个音频控件。
- CET6 `1620` 的 8 条新音频已消除 235–245 WPM 的两个语速离群点和约 5 dB 的盒内音量跳变；修正后为 157–202 估算 WPM、平均电平 -21.8 至 -21.1 dB、峰值 -8.5 至 -7.3 dB，完整 CET6 技术音频审计保持 328/328、0 错误。
- 同一组 8 条音频的声明时长已放在 `afinfo` 与 `ffprobe` 结果中点；两种探测器分别执行完整 328 条审计均为 0 时长绑定错误，避免 macOS 通过而 Linux 超出 50 ms 合同阈值。
- 使用 `mlx-community/whisper-small.en-mlx` 对 629 条候选音频执行了独立 speech-to-bound-transcript 一致性扫描：CET4 301/301、CET6 328/328 均完成。按标准化 word error rate 大于 20% 的保守阈值初筛出 19 条，逐条复核均为数字文字/阿拉伯数字表示差异，或连读、弱读、音标讲解卡中的刻意发音记法差异；未发现整句错绑、错读为另一张卡或语义内容缺失。该扫描仅是机器辅助一致性排查，不创建或替代人工听感 QC。
- 2026-08-20 使用上述当前 CET4 heads 和新增粗粒度音频信号规则重新生成相同 source identity：content version 仍为 `sha256:11ec57318728e0a812918dbe2cc353b20c7a53348f93ec9659813cf2e0f9bc68`，candidate payload SHA-256 为 `sha256:742b84c2dab1f4ce05b4982b19cf20ea4b1314e88123ef40e2e20b8f7278d936`；1,180/301 移动验收再次通过，且 `signed_manifest_verified=false`、`human_audio_qc_verified=false`、`persistent_receiver_verified=false`、`real_device_verified=false`、`gate_eligible=false`。

## 验证

- `node scripts/test_build_card_make_runtime_payload.mjs`：passed。
- `node --test infra/cloudbase/functions/softbook-api/test/release-delivery-v1.test.js infra/cloudbase/functions/softbook-api/test/manage-beta-entitlement.test.js infra/cloudbase/functions/softbook-api/test/audio-bundle-candidate-mobile-acceptance-runner.test.js`：19/19 passed。
- `node --test infra/cloudbase/functions/softbook-api/test/cloudbase-receiver-adapter.test.js`：包含 CET6 retained-release 回滚 passed。
- `npm run typecheck`（`apps/mobile`）：passed。
- `node scripts/run_full_track_candidate_mobile_acceptance.mjs ...cet4...`：1,180/301 passed。
- 2026-08-20 current-head CET4 revalidation：`card-make` PR #182/#186 重放后 301/301 音频通过路径、哈希、大小、解码、时长、transcript presence、语速、平均电平、峰值和轨道相对电平检查；随后以原 source identity 重建并运行完整移动验收，1,180/301 passed，content version 与 2026-08-17 记录精确相同。
- `node scripts/run_full_track_candidate_mobile_acceptance.mjs ...cet6...`：在 PR #185 归一化后的真实候选上重新验证，1,234/328 passed，`all_cards_parseable=true`、`all_audio_cards_bound=true`、`all_cards_learning_completable=true`。
- 独立 ASR 一致性扫描：CET4 301/301、CET6 328/328 完成；19 条高 WER 初筛项逐条复核后为 0 条语义错绑或内容缺失，formal audio QC 仍为 false。
- `./scripts/run_local_gates --profile dev --base origin/main ...`：23/24 passed，1 项 `dev_node_version_drift` 为已登记开发环境例外（期望 Node 22.13.0，当前 Node 24.15.0），0 failed。

## Agent review

Passed for track policy, exact count enforcement, profile/track binding, audio manifest/QC index binding, CET6 retained-release rollback, 50 ms technical-audit duration contract alignment, complete-card mobile parsing, five-interaction completion, representative UI rendering, audio-control binding, and visible runtime metadata leak guard.

No formal approval or launch claim is made. The implementation deliberately preserves the remaining external evidence requirements.

## 剩余边界

- `card make` 当前候选内容 PR 和两条音频补丁 PR 尚未成为正式批准批次。
- 629 条音频尚无完整人工听感 QC 记录；技术审计不能替代该记录。
- 未生成可发布正式 bundle，因为当前不存在与精确候选 corpus 绑定的两条 `full_track_final` 批准和完整 QC index。
- 未向接收方 CloudBase 写入、未部署、未创建 launch approval 或真机证据。
