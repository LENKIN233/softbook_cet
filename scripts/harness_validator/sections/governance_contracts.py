from __future__ import annotations


def validate(context) -> None:
    """Check high-signal governance invariants without mirroring prose or eval answers."""

    root = context.root
    errors = context.errors
    load = context.load
    check_equal = context.check_equal

    authority = load("authority-map.json")
    manifest = load("doc-manifest.json")
    acceptance = load("machine-acceptance.json")
    harness = load("agent-harness.json")
    delivery = load("repo-delivery-contract.json")

    acceptance_domain = authority["domains"].get("machine_owned_product_acceptance")
    if not acceptance_domain:
        errors.append("authority map must define machine_owned_product_acceptance")
    else:
        check_equal(
            "machine acceptance owner",
            "spec/machine-acceptance.json",
            acceptance_domain.get("owner"),
        )
    if "spec/machine-acceptance.json" not in manifest["active_specs"]:
        errors.append("doc manifest must include spec/machine-acceptance.json")

    check_equal("machine acceptance version", "machine-acceptance.v1", acceptance["version"])
    check_equal("machine acceptance target", "2026-09", acceptance["target_release"])
    for field in (
        "standing_authorization",
        "human_review_required",
        "user_review_required",
        "product_owner_click_required",
    ):
        expected = field == "standing_authorization"
        check_equal(
            f"machine acceptance authority.{field}",
            expected,
            acceptance["authority"].get(field),
        )
    check_equal(
        "machine acceptance model first",
        True,
        acceptance["harness_strategy"].get("model_first"),
    )
    check_equal(
        "machine acceptance measured static guards",
        True,
        acceptance["harness_strategy"].get(
            "new_static_guard_requires_a_reproduced_failure_and_regression_eval"
        ),
    )
    check_equal(
        "machine acceptance no new run records",
        True,
        acceptance["harness_strategy"].get(
            "ordinary_pull_requests_do_not_require_tracked_agent_run_records"
        ),
    )
    check_equal(
        "external facts stay observable",
        True,
        acceptance["external_fact_boundary"].get(
            "provider_legal_account_and_distribution_state_must_be_observed"
        ),
    )

    main = harness["governance"]["main_branch_policy"]
    check_equal("main branch", "main", main["branch_name"])
    check_equal("main role", "read_only_integration_branch", main["role"])
    check_equal(
        "topic branch prefixes",
        ["infra/", "shell/", "module/", "cross/", "fix/"],
        main["allowed_topic_branch_prefixes"],
    )

    remote = harness["governance"]["remote_guard"]
    required_checks = remote["required_status_checks"]
    if len(required_checks) != len(set(required_checks)):
        errors.append("remote required status checks must be unique")
    if "formal-approval" in required_checks:
        errors.append("remote guard must not require a human formal-approval check")
    for check in (
        "trusted-model-review",
        "validate-harness",
        "design-artifact-gate",
        "mobile-quality",
        "web-quality",
        "backend-contract",
        "dependency-security",
        "repo-health",
    ):
        if check not in required_checks:
            errors.append(f"remote guard missing required check: {check}")

    defaults = delivery["delivery_defaults"]["code_change_tasks"]
    check_equal("topic branch required", True, defaults["topic_branch_required"])
    check_equal("pull request required", True, defaults["pull_request_required_unless_local_only"])
    check_equal("model review required", True, defaults["model_review_required_before_merge"])
    check_equal(
        "human approval not required",
        False,
        defaults["human_or_user_approval_required_before_merge"],
    )
    check_equal(
        "tracked run record not required",
        False,
        defaults["tracked_agent_run_record_required_before_merge"],
    )
    check_equal(
        "auto merge after model review",
        True,
        defaults["auto_merge_after_model_review_and_green_gates"],
    )

    pull_request = delivery["pull_request_contract"]
    check_equal(
        "lean PR sections",
        ["当前任务引用的 spec", "变更摘要", "验证", "Model review"],
        pull_request["required_body_sections"],
    )
    check_equal(
        "agent run archive is optional",
        False,
        pull_request["agent_run_record_policy"]["required_before_merge"],
    )
    machine = delivery["ci_contract"].get("machine_acceptance")
    if not machine:
        errors.append("delivery contract must define machine_acceptance")
    else:
        check_equal(
            "machine acceptance owner wiring",
            "spec/machine-acceptance.json",
            machine.get("owner"),
        )
        check_equal(
            "machine acceptance human environment",
            None,
            machine.get("human_or_user_environment"),
        )
        check_equal(
            "machine acceptance trusted status",
            "trusted-model-review",
            machine.get("required_status_check"),
        )
        check_equal(
            "author-editable PR body is not authority",
            False,
            machine.get("author_editable_pr_body_is_authority"),
        )

    external = harness["governance"]["external_content_workspace"]
    check_equal("external card workspace", "card make", external["name"])
    check_equal(
        "external card workspace role",
        "upstream_candidate_card_content_production_workspace",
        external["role"],
    )
    check_equal(
        "softbook card role",
        "card_payload_consumer_importer_auditor_and_runtime_validator",
        external["softbook_cet_role"],
    )

    pr_template = (root / ".github/pull_request_template.md").read_text(encoding="utf-8")
    for heading in (
        "## 当前任务引用的 spec",
        "## 变更摘要",
        "## 验证",
        "## Model review",
    ):
        if heading not in pr_template:
            errors.append(f"PR template missing {heading}")
    for stale in ("## Agent run record", "formal-product-owner-approval"):
        if stale in pr_template:
            errors.append(f"PR template contains stale gate: {stale}")

    review_validator = (root / "scripts/validate_agent_review.py").read_text(
        encoding="utf-8"
    )
    for token in ("pr-model-review.v1", "expected_head", "minimum_runs"):
        if token not in review_validator:
            errors.append(f"model review validator missing semantic token: {token}")
    if "docs/agent-runs/" in review_validator:
        errors.append("model review validator must not require tracked run records")

    workflow = (root / ".github/workflows/pr-gates.yml").read_text(encoding="utf-8")
    for token in (
        "validate-harness",
        "design-artifact-gate",
        "mobile-quality",
        "web-quality",
        "backend-contract",
        "dependency-security",
        "repo-health",
    ):
        if token not in workflow:
            errors.append(f"PR workflow missing required job: {token}")
    for artifact in (
        "scripts/guard_agent_run_archive.mjs",
        "scripts/test_guard_agent_run_archive.mjs",
    ):
        if not (root / artifact).exists():
            errors.append(f"missing frozen agent-run archive guard: {artifact}")
    if "node scripts/guard_agent_run_archive.mjs" not in workflow:
        errors.append("PR workflow must protect frozen agent-run Markdown records")
    if "node --test scripts/test_build_android_signed_release.mjs" not in workflow:
        errors.append("PR workflow must run signed Android release evidence regressions")
    if "node --test scripts/test_model_acceptance_contract.mjs" not in workflow:
        errors.append("PR workflow must run model-owned acceptance regressions")

    trusted_workflow_path = root / ".github/workflows/trusted-model-review.yml"
    if not trusted_workflow_path.is_file():
        errors.append("missing trusted OpenAI Codex Action review workflow")
    else:
        trusted_workflow = trusted_workflow_path.read_text(encoding="utf-8")
        for token in (
            "pull_request_target:",
            "secrets.OPENAI_API_KEY",
            "openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e",
            'permission-profile: ":read-only"',
            'codex-version: "0.149.0"',
            "github.event.pull_request.base.sha",
            "github.event.pull_request.head.sha",
            "scripts/trusted_model_review.py",
        ):
            if token not in trusted_workflow:
                errors.append(f"trusted model workflow missing security token: {token}")

    agents = (root / "AGENTS.md").read_text(encoding="utf-8")
    for token in (
        "`spec/machine-acceptance.json`",
        "产品内部不存在人工或用户审核 gate",
        "新增静态 guard 必须先有可复现失败与代表性 eval",
        "不再要求新增 `docs/agent-runs/*.md`",
    ):
        if token not in agents:
            errors.append(f"AGENTS missing machine-owned governance rule: {token}")
