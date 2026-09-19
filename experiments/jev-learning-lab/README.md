# Jev 学习算法实验环境

产品接入版位于同一分支的服务端和移动端/Web 共用事件链路，配置与发布顺序见
[`learning-session-v1-runtime-contract.md`](../../infra/cloudbase/learning-session-v1-runtime-contract.md#next-update-jev-advisor)。
本目录保留独立的合成数据原型，产品运行时不导入这里的 fixture 或实验实现。

这是软书四六级的**本地算法原型**：FSRS 计算复习时间，Jev 根据具体错误作答识别可能需要加强的技能，代码在允许的候选卡中排序。默认仅记录建议。它没有连接正式用户、数据库、CloudBase 或发布流程。

基于仓库 `6b8d56e924ae0d5d6d1fe815e76229ad2a0e092c`，使用独立分支 `module/jev-learning-lab`。现有工作区的未提交修改没有带入本实验。实验仅保留在本地，没有修改产品主学习流程。

## 运行

需要 Node.js 22 或更高版本；已在 Node.js 24.15.0 验证。

```sh
cd /Users/lenkin/programing/softbook_cet_jev_lab/experiments/jev-learning-lab
npm ci --ignore-scripts
npm test
npm run demo
npm run eval -- --mode=rerank
npm start
```

- `demo`：默认 `shadow`，显示原选卡、模型建议、最终选卡、FSRS 状态和原因。
- `eval`：运行 12 个合成场景，报告写入忽略目录 `reports/`。
- `--mode=rerank`：只在实验快照里采用建议；不写入任何学习数据。
- `start`：仅监听 `127.0.0.1:4319`，可通过 `JEV_LAB_PORT` 修改端口。
- 所有默认命令使用 **fixture 脚本响应**。它是接口替身，不是 Jev、本地模型或模型准确率证据。

测试 API：

```sh
curl http://127.0.0.1:4319/health
curl http://127.0.0.1:4319/scenarios
curl http://127.0.0.1:4319/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"contrast","provider":"fixture","mode":"rerank"}'
```

HTTP 接口只接受内置场景 ID，不接收任意用户数据或 API 密钥。跨站 Origin 和不匹配的 Host 被拒绝。

## 接通真实 Jev

1. 在这个目录把 `.env.example` 复制为 `.env.local`，本地填写 `TYPESAFE_API_KEY`，或通过进程环境变量提供。不要把密钥放进请求正文、Git 或聊天。
2. 执行 `npm run live`。该命令使用真实 API 和 `shadow` 模式；成功响应记录实际 token 数、耗时和费用。
3. 服务启动后也可用 `{"scenario":"contrast","provider":"jev","mode":"shadow"}`。修改环境文件后需重启服务。

真实接口固定为 `https://api.typesafe.ai/v1/systemone`，模型固定为 `jev-1.13.0`，防止 alias 更新后悄悄改变结果。单请求超时 4 秒，每个 provider 实例最多 20 次请求，不自动重试，不跟随重定向。请求体限制 60 KB，响应限制 128 KB。限流、认证失败、超时或异常响应均回到原调度。

一次完整 live eval 最多 10 次请求，仅发送本实验的合成英文题目和错误作答。缺少密钥时命令退出码为 2，报告为 `incomplete`，不会把成功回退解释为模型联调成功。

真实评估包含 6 个单独编写的语义检查样本，期望标签不进入模型请求；这只是很小的合成诊断集，尚未覆盖完整 CET 题型、中文解释或真实学生分布。更不能证明学习效果。

## 算法

1. 验证测试快照的学段、内容版本、访问资格、时间和事件唯一性。冲突重放、未来事件和乱序事件直接拒绝。
2. 用 `ts-fsrs@5.4.1`、默认参数、`enable_fuzz: false` 重放事件，沿用产品映射：需要复习 →Again，借助提示/偷看后通过 →Hard，独立通过 →Good。Jev 不修改 FSRS 的难度、稳定性或到期时间。
3. 有效当前卡优先继续；其次是最早到期复习卡；没有到期复习才选新卡。Jev 只能调整**同一最早到期时刻**的卡片，或前 8 张新卡。未来复习、休眠卡和不可访问卡不会进入候选集。
4. 每张卡只使用最近一次作答，最多取近 30 天的 12 张卡。只有错误选项、正确答案、题目和解释齐全的错误作答才交给 Jev。只有“对错/提示”时直接回退；后来已答对的卡不继续贡献旧错因。
5. 每条作答是一个独立 Choice 问题，多个问题共用一次请求。技能范围来自该测试卡的标签，并显式保留 `insufficient_evidence`。不判断粗心、动机或学生未来记忆概率。
6. 选择概率至少 0.8 且 confidence 至少 0.75 的标签才记入支持证据。至少两张不同卡指向同一技能，才生成该技能的补弱权重。
7. 单条证据权重为 `probability × confidence × 2^(-ageDays / 14)`，同一技能求和；候选卡按它覆盖技能的权重之和排序，相同分数沿用原顺序。这个分数是**待校准的启发式排序值**，不是概率、掌握度或预期学习收益。
8. `shadow` 返回建议但最终仍选原卡；只有显式 `rerank` 才在实验结果中采用建议。两种模式都不持久化或修改快照。

阈值、窗口、候选数量、技能标签和排序公式是实验假设，集中在 `src/policy.mjs`。目前不做个体 FSRS 参数训练，也不生成新卡或教学解释。

## 与现有产品的边界

现有 `LearningEventV2` 保存了结果、提示和偷看，但没有持久化具体错误选项。前端瞬时状态有 `selectedOptionId` 等字段，不能将它们视为已存在的服务端诊断证据。因此本实验引入独立的合成 `evidence` 数据，**没有静默修改正式事件协议**。

若以后接入产品，需要给相关交互设计版本化的证据采集，并从受信任内容版本解析题目、答案和技能标签；不能信任客户端自报的标准答案或允许选卡列表。需在模型调用结束后重新检查用户权限、休眠状态、内容版本和 session revision，再按原服务端事务保存 selection。本实验快照没有这些并发事务能力，不能直接替换 `GET /v2/learning/session`。

复习时间计算通过直接调用本仓库现有 `advanceSchedulerEntry` 做逐字段对照。实验尚未实现生产的序列零迁移、会员试用启动、服务端重放事务及跨设备一致性，它们继续由原服务端负责。

所有题目均为人工构造的程序测试 fixture，不属于正式卡片内容，也不计入内容数量或内容授权。

## 验证与成本

测试覆盖正常补弱、证据不足、到期优先、同到期排序、休眠与权限、已有选卡、低置信度、超时、恢复答对、混合错因，以及畸形响应、事件冲突、上下文变更和局部 HTTP API。`test/production-compat.test.mjs` 在子进程里直接加载原服务端调度函数，仅临时指定依赖搜索路径，不改动原文件。

报告分别记录调度约束、真实 API 联调、小样本分类结果与实际学习效果。fixture 场景通过只证明连接和回退；`learningEffectVerified` 始终为 false。

费用按成功响应的 `usage.input_tokens × 0.042 / 1,000,000` 美元计算，输出免费。失败请求可能已被处理而没有返回用量，报告不把这一部分宣称为零费用。API 调用次数上限不是账户总预算，重启进程会重置。

后续应先扩充不同题型、歧义、对抗文本和中文解释的独立样本，再比较固定学习时长下的延迟回忆和同类新题表现。当前没有真实学生结果或效果提升结论。

官方接口与价格核对日期：2026-09-19。

- [模型、价格与语言支持](https://docs.typesafe.ai/models)
- [API 请求与响应](https://docs.typesafe.ai/api)
- [模型已知限制](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
