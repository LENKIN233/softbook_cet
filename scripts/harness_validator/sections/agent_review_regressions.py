from __future__ import annotations

import json


def validate(context) -> None:
    root = context.root
    errors = context.errors
    head = "a" * 40

    def body(evidence, validation_record):
        return f"""
## 当前任务引用的 spec
- `spec/machine-acceptance.json`
## 变更摘要
- machine review regression
## 验证
- {validation_record}
## Model review
```json
{json.dumps(evidence)}
```
"""

    def run_evidence(head_sha, duplicate, blocking):
        run_ids = ["review:first", "review:first" if duplicate else "review:second"]
        runs = []
        for index, run_id in enumerate(run_ids):
            runs.append({
                "principal": f"agent:codex-{index}",
                "model": "gpt-5.6-sol",
                "run_id": run_id,
                "reviewed_at": "2026-08-23T17:00:00+08:00",
                "capabilities": ["exact_diff_review"],
                "decision": "passed",
                "blocking_findings": ["blocking"] if blocking and index == 0 else [],
            })
        return {
            "schema_version": "pr-model-review.v1",
            "head_sha": head_sha,
            "policy": "spec/machine-acceptance.json",
            "runs": runs,
            "status": "passed",
            "summary": "Two isolated exact-diff reviews passed.",
        }
    if not (root / "scripts/validate_agent_review.py").exists():
        errors.append("missing model review validator")
        return

    def run(pr_body):
        return context.run_validator(
            "scripts/validate_agent_review.py",
            "--expected-head",
            head,
            "--minimum-runs",
            "2",
            env={"PR_BODY": pr_body},
        )

    if run("").returncode == 0:
        errors.append("model review validator must reject an empty body")
    default_validation = "`python3 scripts/validate_harness.py` — Passed"
    if run(body(run_evidence("b" * 40, False, False), default_validation)).returncode == 0:
        errors.append("model review validator must reject a stale head binding")
    if run(body(run_evidence(head, True, False), default_validation)).returncode == 0:
        errors.append("model review validator must reject duplicate run IDs")
    if run(body(run_evidence(head, False, True), default_validation)).returncode == 0:
        errors.append("model review validator must reject blocking findings")
    if run(body(run_evidence(head, False, False), "[ ] unchecked")).returncode == 0:
        errors.append("model review validator must reject unchecked validation")
    if run(body(run_evidence(head, False, False), default_validation)).returncode != 0:
        errors.append("model review validator must accept bound independent passed runs")
