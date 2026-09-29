# 软书四六级 Design Harness

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/machine-acceptance.json#harness_strategy.experience_acceptance`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`

## 产品与设计边界

用户必须能够读到题目材料、完成当前操作、理解结果并继续学习。
保留单卡任务、五种有实际学习意义的交互、两档轻自评与客观判定的区别，以及卡片在知识空间中的稳定归属。
当前学科、当前卡和返回学习的路径应可辨认；进步反馈不能把完成、自评或签到包装成已经掌握。
产品意图属于产品 spec；验收与设计修订权限统一由 machine-acceptance 拥有。

现有界面和设计稿提供可修订基准。模型可以直接探索实现，也可以先画方案；按任务需要更新相关基准。
普通修复与产品改善不要求先有失败报告、另立设计稿、引用历史 Space 文件或先完成六问。
字体、圆角、导航形态、颜色数值和交互剪影是表现选择；使用一致基准，但允许用更清楚、可操作的方案修订它们。
不要求每轮比较固定数量的候选。`docs/design/search-runs/README.md` 仅在方向探索需要时使用。

## 用户任务与验证

从用户要完成的任务出发，按变更风险选择运行状态、平台和扰动。验证范围和独立审查条件遵循 machine-acceptance，不在本文件另加流程。
有界面变化时观察实际内容、动作和结果；涉及共享体验时说明 Web、iOS、Android 各自覆盖情况。
可以使用不同材料长度、字号、键盘状态、网络或返回路径检验当前假设，不为凑扰动次数重复已经足够的验证。

PR 的普通“验证”段落说明任务、观察到的结果和相关未验证范围，能解释变化的截图、日志或设计链接按需附上。
`validate_pr_design_gate.py` 只检查是否声明验证范围及内容工作区交接；通过不代表 UX 合格。
设计 URL、Q/AP 关键词、`overflow-x: hidden`、特定 CSS 类名或色值出现均不能证明体验。
实际裁切、遮挡和语义误导交给运行观察与模型判断；内容授权、metadata 扫描和数据安全检查保持独立。

### 当前落地范围

`apps/mobile/e2e/experience/reading.yaml` 通过独立 `.experience` Debug 包运行 `reading-cards.json` 指定的两个真实卡库样本：
四选一先读四个选项正文，答错后在结果首层及展开解析中读取正确答案；消除题读取完整原句，打开提示后仍能读取原句。
选项检测以本轮实际出现的“只有字母、正文宽度被挤没”截图作失败校准。
同一 flow 在 Android 上还执行系统 Back，验证解析返回卡面、盒内列表返回概览、
辅助页面返回学习。iOS 会跳过这一平台专有分支，不得据此声称 Android 已实测。

在 macOS 上，对已安装当前 `.experience` Debug app、已启动 Metro 的**专用可清空测试模拟器**执行：

```sh
node scripts/run_experience_acceptance.mjs --device <device-id> --output <new-output-directory>
```

同一流程支持 iOS 和 Android；OCR 使用系统 Vision，不发送图片到外部服务。
该命令会清空指定模拟器内测试应用的数据，禁止对用户日常设备执行。
`index.experience.js` 只在 Debug 下选取这两个已导出的真实卡片，不进入正常本地或 Release 入口。卡库排序变化不会自动更换验收对象，样本类型变化则要求同步修订流程。

runner 先用独立的 420 秒预算安装驱动、清空应用并完成开发测试登录，确认学习卡就绪后，
再复用驱动执行原有 240 秒阅读流程；
任一阶段失败立即停止，不重试。准备日志与阅读截图分目录保留，不能互相充当证据。
CI 外层 20 分钟还覆盖 Metro 冷启动、两次 OCR 编译与收尾。
CI 由独立的 iOS runtime step 自动执行；它不进入纯 `validate_harness.py`。

输出包含运行版本、源码与截图哈希、已知失败样本校准、实际截图和判定。
`--calibrate-only` 仅验证故障样本检测器，永远不等于产品通过。
两项 OCR 可读性通过也不等于整体 UX、正式内容、音频或上线验收通过。

### 使用现有体验工具

上述阅读 runner 是针对已知失败的检查工具，不是每个 UI 任务的固定流程。
选择它时验证真实坏截图会失败、修复后的真实截图会成功，并保留其实际覆盖范围。
允许字体、间距、合理滚动和新的布局；不把 `flex` 值、类名、整张像素快照或 `overflow-x: hidden` 当产品要求。
后续按真实缺陷发现、误报和运行成本增删检查；截图、OCR 和作者说明均不能单独代表学习价值或整体审美。

## Design Quarantine Harness

`docs/design/design-quarantine.md` 的内容与信息泄露边界仍有效。
被隔离的 artifact 不能单靠作者声称成为设计依据；先修复并复验具体失败。
安全、账号隔离、数据完整性与外部事实证据不因设计治理精简而降级。
