# 本地真实卡库

本地 Mobile / Web 直接消费 card make 导出的真实候选内容，不再加载示例或把四级
示例改名为六级。远端配置仍只接受远端账户、选题和签名 manifest；失败时不回退本地。

Web 本地入口为 `http://127.0.0.1:4173/`（四级）与
`http://127.0.0.1:4173/?track=cet6`（六级）。该参数仅用于开发入口，不能覆盖
远端配置的轨道。Mobile 沿用 `SOFTBOOK_APP_RUNTIME_CONFIG.learningTrack` 选择轨道。

当前固定内容为 CET4 1180 卡 / 108 盒 / 301 音频，CET6 1234 卡 / 110 盒 /
328 音频。源仓库 commit、导出 payload SHA-256 和 content version 记录在
`infra/cloudbase/functions/softbook-api/card-content/provenance.json`。源工作区的内容
审查状态保持原样；本地接入和技术检查不构成正式内容授权或学习效果证明。

`scripts/build_card_make_runtime_payload.mjs --payload-mode full-track-candidate`
消费外部固定 checkout 和对应技术音频审计，产生每轨 payload 与音频。
随后运行 `node scripts/install_bundled_card_library.mjs <handoff-directory> <upstream-commit>`。
交接目录包含 `cet4/`、`cet6/`，各自有 `bundled-card-make-v1-<track>-card-source.json`
和 `audio/`。安装器先验证完整范围及全部音频字节，再生成共享 JSON 分片、客户端索引、
来源记录和原生音频资源。音频由 Git LFS 保存，构建前需 `git lfs pull`。

移动端打包 `apps/mobile/assets/card-audio`；Web 开发服务器提供同一份文件。
两端播放前核对字节数和 SHA-256。随包资源不是临时下载授权，不伪造签名 manifest，
也不放宽远端 HTTPS、签名或授权校验。仍由用户点击播放，后台、换题或离开学习页停止
迟到播放。听力原文只在作答后展示。

本地学习顺序覆盖整轨，保留既有会员访问边界；它不把“遍历整轨”宣称为服务端 FSRS。
移动端新本地卡库使用独立的游标和空间存储键，避免相同卡号继承示例状态。
Web 学习会话目前仍在当前页面内，不宣称刷新恢复或跨设备同步。

后端不再自动植入示例：缺少导入内容时返回 `card_source_missing`。测试用例必须显式
注入自己的交互 fixture。生产和云端内容仍通过原有发布/导入合同接入。
