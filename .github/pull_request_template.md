## 当前任务引用的 spec

- `spec/...`

## 变更摘要

- ...

## 验证

- [ ] `python3 scripts/validate_harness.py`
- [ ] `python3 scripts/test_validate_harness_runner.py`
- [ ] `python3 scripts/test_run_local_gates.py`
- [ ] `python3 scripts/test_harness_module_boundaries.py`
- [ ] `node --test scripts/test_check_design_metadata_leaks.mjs`
- [ ] `node --test scripts/test_validate_launch_readiness.mjs && node scripts/validate_launch_readiness.mjs`
- [ ] `node --test scripts/test_validate_agent_run_evidence.mjs && node scripts/validate_agent_run_evidence.mjs --verify-remote`
- [ ] `python3 scripts/validate_maestro_selectors.py`
- [ ] `cd apps/mobile && npm run lint -- --quiet`
- [ ] `cd apps/mobile && npm run typecheck`
- [ ] `cd apps/mobile && npm test -- --runInBand --watchAll=false`
- [ ] `cd infra/cloudbase/functions/softbook-api && npm test`
- [ ] `node scripts/validate_dependency_security.mjs`
- [ ] `cd apps/mobile && bundle exec pod install --project-directory=ios --deployment`
- [ ] `scripts/run_local_gates --profile dev`

## Agent review

- Reviewer: N/A
- Review status: N/A
- Blocking findings: N/A
- Review summary: N/A
- merge 前必须由 agent 把本节更新为 `Review status: Passed`，且 `Blocking findings` 必须明确无阻塞问题；否则 `agent-review` gate 不应通过。

## Agent run record

- Run record: N/A
- PR-bound governance / harness / UI / runtime / card handoff / multi-file refactor work must commit a record under `docs/agent-runs/` and reference it here before merge.

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A
- Learning microcopy basis: N/A
- 如改动任何用户可见 UI / screen / component / state / chrome，不允许写 `N/A`；必须引用已接受设计稿、`docs/design/visual-reference.html`、`docs/design/canon.md`、`docs/design/briefs/*.md`、`docs/design/directions/*.md`、`docs/design/decisions/*.md` 或外部设计文件，并写明实现映射。
- 同一 PR 内新增 / 修改的 design brief、direction 或 decision，只能满足 design-only PR；如果本 PR 也改用户可见 UI，它不能作为已接受设计稿来源。
- Learning / core interaction UI 还必须引用 `docs/design/interaction-motion/*.md`、`docs/design/storyboards/*.md` 或外部动效/交互 artifact；Space UI 还必须引用 `docs/design/physical-space/*.md`、`docs/design/physical-space/space-state-baseline-v1.md`、`docs/design/directions/space-surface-visual-directions-v1.md`、`docs/design/mocks/space-surface-visual-proof-v1.md`、`docs/design/mocks/space-surface-visual-refinement-v1.md`、`docs/design/mocks/space-surface-shelf-desk-v1.md`、`docs/design/mocks/space-state-baseline-v1.html` 或外部空间设计稿。
- 用户可见 UI 改动必须回答下方 `Universal Q1-Q4` 与适用的 `Conditional Q5-Q6`，不能保留 `N/A`。
- `Universal Q1-Q4` 不能只写 `answered`；必须写明 Law of One / current library、focal object / first-read path、interaction silhouette、forbidden pattern 结论。`Conditional Q5-Q6` 必须写明 containment / safe-area 与 flip / stats / learning 规则，或说明具体不适用原因。
- 对于触达用户可见 Learning / Space 的 PR，还需显式补齐 AP-22 与 AP-23 证据，不允许 N/A。
- 对于触达用户可见 Learning UI 的 PR，`Learning microcopy basis` 必须说明可见文案依据：`hard leak`、`spec-backed`、`design-backed`、`product correction`，或明确 `no visible-copy change`；不要把主观文案偏好写成 harness 要求。

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
- AP-22: N/A
- AP-23: N/A
- 如无视觉稿 / screen / mock / reference HTML 改动，请显式写 `N/A`。

## 卡片内容交接（如适用）

- Card content handoff: N/A
- Card content validation: N/A
- 如改动 `apps/mobile/src/learning/localCardRecords.ts`，不能在本仓库内直接生产候选卡片内容或把 dev seed cards 当作正式内容量；必须写明来自同级 `/Users/lenkin/programing/card make` / `external_workspace:/Users/lenkin/programing/card make` 的 handoff，并记录 dry-run import、catalog audit、runtime smoke 或 release content gap delta 等验证证据。
