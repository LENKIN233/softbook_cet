from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors

    agent_review_script = ROOT / "scripts" / "validate_agent_review.py"
    if not agent_review_script.exists():
        errors.append("missing agent review validator: scripts/validate_agent_review.py")
    else:
        invalid_agent_review = context.run_validator(
            "scripts/validate_agent_review.py",
            env={"PR_BODY": ""},
        )
        if invalid_agent_review.returncode == 0:
            errors.append("validate_agent_review.py must reject missing agent review records")

        agent_review_only = context.run_validator(
            "scripts/validate_agent_review.py",
            env={
                "PR_BODY": """
    ## Agent review

    - Reviewer: Codex
    - Review status: Passed
    - Blocking findings: None
    - Review summary: Reviewed changed files.
    """,
            },
        )
        if agent_review_only.returncode == 0:
            errors.append("validate_agent_review.py must reject PR bodies that only contain Agent review")
        elif "当前任务引用的 spec" not in (agent_review_only.stdout + agent_review_only.stderr):
            errors.append("validate_agent_review.py required-section rejection must mention missing spec section")

        unchecked_validation_review = context.run_validator(
            "scripts/validate_agent_review.py",
            env={
                "PR_BODY": """
    ## 当前任务引用的 spec

    - `spec/repo-delivery-contract.json`
    - `spec/agent-harness.json`

    ## 变更摘要

    - Validate PR body review records.

    ## 验证

    - [ ] `python3 scripts/validate_harness.py`

    ## Agent review

    - Reviewer: Codex
    - Review status: Passed
    - Blocking findings: None
    - Review summary: Reviewed changed files.

    ## Agent run record

    - Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: N/A
    - Interaction/motion artifact: N/A
    - Physical space artifact: N/A
    - Implementation mapping: N/A
    - Unimplemented design gaps: N/A

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: N/A
    - Conditional Q5-Q6: N/A
    """,
            },
        )
        if unchecked_validation_review.returncode == 0:
            errors.append("validate_agent_review.py must reject unchecked validation boxes")
        elif "unchecked validation boxes" not in (
            unchecked_validation_review.stdout + unchecked_validation_review.stderr
        ):
            errors.append("validate_agent_review.py unchecked validation rejection must explain the problem")

        skip_remote_only_review = context.run_validator(
            "scripts/validate_agent_review.py",
            env={
                "PR_BODY": """
    ## 当前任务引用的 spec

    - `spec/repo-delivery-contract.json`
    - `spec/agent-harness.json`

    ## 变更摘要

    - Validate PR body review records.

    ## 验证

    - [x] `python3 scripts/validate_harness.py --skip-remote-guard`

    ## Agent review

    - Reviewer: Codex
    - Review status: Passed
    - Blocking findings: None
    - Review summary: Reviewed changed files.

    ## Agent run record

    - Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: N/A
    - Interaction/motion artifact: N/A
    - Physical space artifact: N/A
    - Implementation mapping: N/A
    - Unimplemented design gaps: N/A

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: N/A
    - Conditional Q5-Q6: N/A
    """,
            },
        )
        if skip_remote_only_review.returncode == 0:
            errors.append("validate_agent_review.py must reject PR records that only ran --skip-remote-guard harness")
        elif "full `python3 scripts/validate_harness.py`" not in (
            skip_remote_only_review.stdout + skip_remote_only_review.stderr
        ):
            errors.append("validate_agent_review.py skip-remote rejection must require full harness")

        valid_agent_review = context.run_validator(
            "scripts/validate_agent_review.py",
            env={
                "PR_BODY": """
    ## 当前任务引用的 spec

    - `spec/repo-delivery-contract.json`
    - `spec/agent-harness.json`

    ## 变更摘要

    - Validate PR body review records.

    ## 验证

    - [x] `python3 scripts/validate_harness.py`
    - [x] `python3 scripts/validate_agent_review.py`

    ## Agent review

    - Reviewer: Codex
    - Review status: Passed
    - Blocking findings: None
    - Review summary: Reviewed changed files, specs, validation, and found no blocking issues.

    ## Agent run record

    - Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: N/A
    - Interaction/motion artifact: N/A
    - Physical space artifact: N/A
    - Implementation mapping: N/A
    - Unimplemented design gaps: N/A

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: N/A
    - Conditional Q5-Q6: N/A
    """,
            },
        )
        if valid_agent_review.returncode != 0:
            errors.append("validate_agent_review.py must accept a passed review with no blocking findings")
