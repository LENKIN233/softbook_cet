# 软书四六级 Design Harness

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/machine-acceptance.json#harness_strategy.experience_acceptance`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`

## Product Truth

用户必须能够读到题目材料、完成当前操作、理解结果并继续学习。
产品意图属于产品 spec；验收与设计修订权限统一由 machine-acceptance 拥有。
设计稿是可修订基准，不是运行事实。

## Implementation Hypothesis

从现有视觉语言和设计基准出发，运行真实任务，依据观察修订设计与实现。
普通修复可以在同一 PR 修改基准和实现，不要求先合并一份设计文档。
重大方向变化可以选择比较多个候选；普通修复不要求候选数量、搜索代数或额外晋级记录。
`docs/design/search-runs/README.md` 保留为选择开展方向探索时的工具，不是普通修复门槛。

## 用户任务驱动的验收

1. 先描述用户要完成什么，不规定组件结构或内部样式。
2. 在受影响的平台运行任务，捕获操作前、反馈后和返回状态。
3. 模型先看实际页面和任务，再看实现理由；具体程序见 machine-acceptance。
4. 有问题就修订并重跑对应任务；未运行的平台、内容或外部能力明确标为未验证。
5. PR 记录发现、修复与执行产物；截图、OCR、操作日志由工具生成并保留为 artifact。

### 当前落地范围

`apps/mobile/e2e/experience/reading.yaml` 运行两个真实开发内容样本：
四选一答错后读取正确答案；消除题读取完整原句，打开提示后仍能读取原句。

在 macOS 上，对已安装当前 Debug app、已启动 Metro 的**专用可清空测试模拟器**执行：

```sh
node scripts/run_experience_acceptance.mjs --device <device-id> --output <new-output-directory>
```

同一流程支持 iOS 和 Android；OCR 使用系统 Vision，不发送图片到外部服务。
该命令会清空指定模拟器内测试应用的数据，禁止对用户日常设备执行。
CI 由独立的 iOS runtime step 自动执行；它不进入纯 `validate_harness.py`。

输出包含运行版本、源码与截图哈希、已知失败样本校准、实际截图和判定。
`--calibrate-only` 仅验证故障样本检测器，永远不等于产品通过。
两项 OCR 可读性通过也不等于整体 UX、正式内容、音频或上线验收通过。

### 模型体验审查任务

对本轮 UI 变更，启动隔离上下文的 reviewer，先只提供用户任务、截图目录与运行条件。
不要提供作者的设计理由、既有通过结论或建议发现的问题。
让 reviewer 写下观察后再提供代码，核对原因。它不需要不同模型提供商。
审查结论必须说明具体状态、用户影响和证据；不能仅给审美分数。

### 判断验收是否有效

真实坏截图必须失败，修复后的真实截图必须成功。
允许字体、间距和合理滚动变化；不把某个 `flex` 值或整张像素快照当产品要求。
这批验收替换了 design_contracts 的设计流程/UX 句子存在性检查，以及解析页布局样式锁定断言。
后续按发现率、误报和运行成本扩展，不以规则数量衡量进展。

## Design Quarantine Harness

`docs/design/design-quarantine.md` 的内容与信息泄露边界仍有效。
被隔离的 artifact 不能单靠作者声称成为设计依据；先修复并复验具体失败。
安全、账号隔离、数据完整性与外部事实证据不因设计治理精简而降级。
