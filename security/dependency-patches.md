# 移动端依赖修复

移动端原始 `npm audit` 包含开发、可选和 peer 依赖，不保留告警例外。

`sprintf-js` 已从依赖图移除：将唯一引入链 `js-yaml 3 → argparse 1` 的
`argparse` 更新到 2.0.1。它保留旧 API 兼容层。回归直接执行旧 YAML CLI
的读取、转换、帮助、版本和错误路径，并用 `load-nyc-config` 读取 YAML 配置。

`braces` 的 npm 正式发布仍为 3.0.3。本仓库使用
[公开修复 fork 的固定提交](https://github.com/Im-Fran/braces/tree/11568474fd2d330d4a56a3aba63f8f90030ba15e)，
其 3.0.4 包在解析阶段限制嵌套深度。这是 fork 版本，不是上游正式修复声明。
已审查的运行时代码差异为解析深度限制、未配对引号处理和范围集合的有效性修正；
依赖仍为 `fill-range`，没有新增安装生命周期脚本。

锁文件固定完整提交的下载地址及 SHA-512。安装和安全检查还通过
`scripts/normalize_mobile_dependency_mitigations.mjs` 核对运行时源文件、包元数据
及许可证的精确哈希，继续为接受调用方 AST 的三个递归 walker 加上深度防护。
替换下载来源、修改解析器、遗漏补丁或篡改安装文件均会失败。

回归入口为 `scripts/test_mobile_dependency_mitigations.mjs`。它验证原始 walker
在受限栈中的失败、字符串与 AST 深度防护、允许深度边界，以及正常范围、转义、
嵌套和多扩展名展开。移动端测试和原生构建验证实际工具链兼容性。

今后恢复官方发布或更换 fork 时，须重新审查来源和差异、更新锁文件与源文件哈希，
并重跑这些行为检查；不能只修改版本号或删除审计结果来消除告警。
