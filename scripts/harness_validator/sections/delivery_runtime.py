from __future__ import annotations

import json
from pathlib import Path


def validate(context) -> None:
    """Verify executable delivery boundaries without replaying prose or CI command lists."""

    root = context.root
    errors = context.errors
    check_equal = context.check_equal
    run_command = context.run_command
    harness = context.load("agent-harness.json")
    delivery = context.load("repo-delivery-contract.json")

    main = harness["governance"]["main_branch_policy"]
    local = harness["governance"]["local_guard"]
    remote = harness["governance"]["remote_guard"]

    guard = root / local["guard_script"]
    installer = root / local["install_command"].removeprefix("./")
    for asset in (guard, installer):
        if not asset.exists():
            errors.append(f"governance asset missing: {asset.relative_to(root)}")

    hooks_root = root / local["hooks_path"]
    for hook in local["required_hooks"]:
        path = root / hook["path"]
        if not path.exists():
            errors.append(f"required hook missing: {hook['path']}")
            continue
        text = path.read_text(encoding="utf-8")
        if local["hook_wrapper_root_resolution"] not in text:
            errors.append(f"hook does not resolve shared Git root: {hook['path']}")
        dispatch = f'"$ROOT_DIR/{local["guard_script"]}" {hook["action"]} "$@"'
        if dispatch not in text:
            errors.append(f"hook does not dispatch branch guard: {hook['path']}")
        if hook["action"] == "pre-push" and local["lfs_pre_push_command"] not in text:
            errors.append("pre-push hook must retain Git LFS dispatch")

    git_dir = run_command("git", "rev-parse", "--git-dir")
    if git_dir is None or git_dir.returncode != 0:
        errors.append("repository is not in a Git checkout")
    else:
        configured = run_command(
            "git", "config", "--worktree", "--path", "--get", "core.hooksPath"
        )
        if configured is None or configured.returncode != 0:
            errors.append("core.hooksPath is not configured; run ./scripts/install_git_hooks.sh")
        else:
            check_equal(
                "core.hooksPath",
                hooks_root.resolve(),
                Path(configured.stdout.strip()).resolve(),
            )
        branch = run_command("git", "symbolic-ref", "--quiet", "--short", "HEAD")
        if branch is not None and branch.returncode == 0 and branch.stdout.strip() == main["branch_name"]:
            status = run_command("git", "status", "--porcelain")
            if status is not None and status.stdout.strip():
                errors.append("current checkout is dirty on main; use a topic branch")

    workflow_path = root / delivery["ci_contract"]["workflow_path"]
    if not workflow_path.exists():
        errors.append(f"missing CI workflow: {workflow_path.relative_to(root)}")
    else:
        workflow = workflow_path.read_text(encoding="utf-8")
        for job in (
            "validate-harness:",
            "mobile-quality:",
            "web-quality:",
            "backend-contract:",
            "dependency-security:",
            "repo-health:",
        ):
            if job not in workflow:
                errors.append(f"CI workflow missing required job: {job}")
        if "formal-product-owner-approval" in workflow:
            errors.append("CI workflow must not contain a human product-owner approval gate")

    template = root / delivery["ci_contract"]["pull_request_template_path"]
    if not template.exists():
        errors.append(f"missing pull request template: {template.relative_to(root)}")
    else:
        text = template.read_text(encoding="utf-8")
        for heading in delivery["pull_request_contract"]["required_body_sections"]:
            if f"## {heading}" not in text:
                errors.append(f"pull request template missing heading: {heading}")

    for stale in (
        ".github/workflows/formal-approval.yml",
        "scripts/classify_formal_approval_scope.mjs",
        "scripts/test_classify_formal_approval_scope.mjs",
        "scripts/validate_agent_review.py",
        "scripts/harness_validator/sections/agent_review_regressions.py",
    ):
        if (root / stale).exists():
            errors.append(f"stale human approval artifact remains active: {stale}")

    if context.mode == "local":
        return

    context.mark_remote_guard_executed()
    repository_result = run_command("gh", "api", f"repos/{remote['repository']}")
    if repository_result is None or repository_result.returncode != 0:
        errors.append("unable to read GitHub repository settings")
        return
    try:
        repository = json.loads(repository_result.stdout)
    except json.JSONDecodeError:
        errors.append("GitHub repository settings returned malformed JSON")
        return
    for setting, expected in remote["repository_settings"].items():
        check_equal(f"remote repository setting {setting}", expected, repository.get(setting))

    protection_result = run_command(
        "gh",
        "api",
        f"repos/{remote['repository']}/branches/{remote['protected_branch']}/protection",
    )
    if protection_result is None or protection_result.returncode != 0:
        errors.append("unable to read GitHub branch protection")
        return
    try:
        protection = json.loads(protection_result.stdout)
    except json.JSONDecodeError:
        errors.append("GitHub branch protection returned malformed JSON")
        return

    check_equal(
        "remote allow_force_pushes",
        remote["allow_force_pushes"],
        protection["allow_force_pushes"]["enabled"],
    )
    check_equal(
        "remote allow_deletions",
        remote["allow_deletions"],
        protection["allow_deletions"]["enabled"],
    )
    checks = protection.get("required_status_checks")
    if checks is None:
        errors.append("remote required_status_checks missing")
    else:
        check_equal(
            "remote require_strict_status_checks",
            remote["require_strict_status_checks"],
            checks["strict"],
        )
        check_equal(
            "remote required status checks",
            sorted(remote["required_status_checks"]),
            sorted(checks.get("contexts", [])),
        )
    reviews = protection.get("required_pull_request_reviews")
    check_equal("remote require pull request", remote["require_pull_request"], reviews is not None)
    if reviews is not None:
        check_equal(
            "remote human approval count",
            0,
            reviews.get("required_approving_review_count"),
        )
