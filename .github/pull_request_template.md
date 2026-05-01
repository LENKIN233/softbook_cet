## 当前任务引用的 spec

- `spec/...`

## 变更摘要

- ...

## 验证

- [ ] `python3 scripts/validate_harness.py`
- [ ] `cd apps/mobile && npm run lint -- --quiet`
- [ ] `cd apps/mobile && npm run typecheck`
- [ ] `cd apps/mobile && npm test -- --runInBand --watchAll=false`

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A
- 如改动任何用户可见 UI / screen / component / state / chrome，不允许写 `N/A`；必须引用已接受设计稿、`docs/design/visual-reference.html`、`docs/design/canon.md`、`docs/design/briefs/*.md`、`docs/design/decisions/*.md` 或外部设计文件，并写明实现映射。
- 同一 PR 内新增 / 修改的 design brief 或 decision，只能满足 design-only PR；如果本 PR 也改用户可见 UI，它不能作为已接受设计稿来源。
- Learning / core interaction UI 还必须引用 `docs/design/interaction-motion/*.md`、`docs/design/storyboards/*.md` 或外部动效/交互 artifact；Space UI 还必须引用 `docs/design/physical-space/*.md`、`docs/design/storyboards/*.md` 或外部空间 artifact。
- 用户可见 UI 改动必须回答下方 `Universal Q1-Q4` 与适用的 `Conditional Q5-Q6`，不能保留 `N/A`。

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
- 如无视觉稿 / screen / mock / reference HTML 改动，请显式写 `N/A`。
