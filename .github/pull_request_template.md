## 当前任务引用的 spec

- `spec/...`

## 变更摘要

- Outcome and scope.

## 验证

- `task-relevant command` — Passed

## Model review

```json
{
  "schema_version": "single-task-dual-perturbation-review.v1",
  "head_sha": "<exact-40-character-pr-head-sha>",
  "policy": "spec/machine-acceptance.json",
  "runs": [
    {
      "principal": "agent:codex",
      "model": "gpt-5.6-sol",
      "run_id": "<assumption-inversion-pass-id>",
      "perturbation_id": "assumption_inversion",
      "reviewed_at": "<RFC3339-with-timezone>",
      "capabilities": ["exact_diff_review"],
      "decision": "passed",
      "blocking_findings": []
    },
    {
      "principal": "agent:codex",
      "model": "gpt-5.6-sol",
      "run_id": "<failure-projection-pass-id>",
      "perturbation_id": "failure_projection",
      "reviewed_at": "<RFC3339-with-timezone>",
      "capabilities": ["exact_diff_review"],
      "decision": "passed",
      "blocking_findings": []
    }
  ],
  "status": "passed",
  "summary": "Exact-diff review against the referenced product truth and acceptance criteria."
}
```

<!-- Domain-specific design, content, release, deployment, and external facts
remain enforced by their owning validators. Do not create docs/agent-runs. -->
