# Agent Run Record: visible copy source coverage

## task_summary

Extend the mobile visible metadata leakage guard so Space display helper sources are covered by the same scanner and harness fixture as Learning and shared UI metadata sources.

## referenced_specs

- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/evals.json`

## product_truth_used

- `user_visible_metadata_leakage_is_blocker`: user-visible UI must not expose agent, harness, metadata, runtime, mock, prototype, fixture, debug, dev, raw exception, API route, repo path, or TODO language.

## implementation_hypothesis_changed

No product or visual implementation hypothesis changed. This is a harness/source-coverage guardrail change.

## workspace_boundary_and_read_scope

- Worktree: `/Users/lenkin/programing/softbook_cet`
- Branch: `infra/visible-copy-source-coverage`
- Read scope was limited to the metadata leakage scanner, design governance harness section, current visual-language truth, App-level visible leakage guard, Space display helper, a SpaceSurface display snippet, and the agent run record schema.

## files_changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `scripts/harness_validator/sections/design_governance.py`
- `docs/agent-runs/2026-05-24-visible-copy-source-coverage.md`

## commands_run

- `git fetch origin main`
- `git checkout -b infra/visible-copy-source-coverage origin/main`
- `sed -n '1,260p' apps/mobile/scripts/check-metadata-leaks.mjs`
- `sed -n '1,260p' scripts/harness_validator/sections/design_governance.py`
- `sed -n '1,220p' spec/visual-language.json`
- `rg -n "卡组|分组|deck|group|metadata|debug|harness|fixture|schema|agent|artifact|mock|screen|prototype|storyboard|查看提示|收起提示" apps/mobile/src -g '*.ts' -g '*.tsx'`
- `sed -n '1,140p' apps/mobile/src/space/spaceMetadataDisplay.ts`
- `sed -n '680,770p' apps/mobile/src/space/SpaceSurface.tsx`
- `sed -n '1,180p' apps/mobile/__tests__/App.test.tsx`
- `sed -n '1,220p' spec/agent-run-record.json`

## validation_results

Not run in this step. The change adds harness coverage and should be validated by the repository harness and PR checks before merge.

## agent_review_status

Pending. The PR must not be merged until agent review and required gates pass.

## user_visible_ui_impact

None. This does not change rendered UI or copy.

## card_make_external_workspace_impact

None. This does not produce, approve, import, or alter card content payloads from `/Users/lenkin/programing/card make`.

## risks_and_open_questions

- The scanner now treats `src/space/spaceMetadataDisplay.ts` as a visible copy source because it re-exports UI label formatters and builds display path strings.
- Local validation was not run in this step; PR gates should prove the harness path.

## follow_up

- Run the harness and PR checks.
- Merge only after agent review, PR description evidence, and required gates are green.
