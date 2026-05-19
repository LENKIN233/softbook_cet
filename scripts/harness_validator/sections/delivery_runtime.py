# Governance enforcement must remain wired, not just documented.
guard_script = ROOT / local_guard["guard_script"]
install_script = ROOT / local_guard["install_command"].removeprefix("./")
hooks_path = ROOT / local_guard["hooks_path"]

for asset in [guard_script, install_script]:
    if not asset.exists():
        errors.append(f"governance asset missing: {asset.relative_to(ROOT)}")

if guard_script.exists():
    guard_text = guard_script.read_text(encoding="utf-8")
    for snippet in [
        local_guard["bypass_env"],
        "pre-commit | pre-merge-commit",
        "refs/heads/main",
        "post-checkout)",
        "main is a read-only integration branch in this repository.",
    ]:
        check_contains("guard_main_branch.sh behavior", guard_text, snippet)

if install_script.exists():
    install_text = install_script.read_text(encoding="utf-8")
    check_contains(
        "install hooksPath wiring",
        install_text,
        'git -C "$ROOT_DIR" config core.hooksPath "$HOOKS_DIR"',
    )

for hook in local_guard["required_hooks"]:
    hook_path = ROOT / hook["path"]
    if not hook_path.exists():
        errors.append(f"required hook missing: {hook['path']}")
        continue

    hook_text = hook_path.read_text(encoding="utf-8")
    check_contains(
        f"{hook['path']} root resolution",
        hook_text,
        local_guard["hook_wrapper_root_resolution"],
    )
    check_contains(
        f"{hook['path']} dispatch",
        hook_text,
        f'"$ROOT_DIR/{local_guard["guard_script"]}" {hook["action"]} "$@"',
    )

git_dir = run_command("git", "rev-parse", "--git-dir")
if git_dir is None or git_dir.returncode != 0:
    errors.append("repository is not in a git checkout")
else:
    configured_hooks = run_command("git", "config", "--path", "--get", "core.hooksPath")
    if configured_hooks is None or configured_hooks.returncode != 0:
        errors.append("core.hooksPath is not configured; run ./scripts/install_git_hooks.sh")
    else:
        actual_hooks_path = Path(configured_hooks.stdout.strip()).resolve()
        expected_hooks_path = hooks_path.resolve()
        check_equal("core.hooksPath", expected_hooks_path, actual_hooks_path)

    current_branch = run_command("git", "symbolic-ref", "--quiet", "--short", "HEAD")
    if (
        current_branch is not None
        and current_branch.returncode == 0
        and current_branch.stdout.strip() == main_branch_policy["branch_name"]
    ):
        worktree_status = run_command("git", "status", "--porcelain")
        if worktree_status is not None and worktree_status.stdout.strip():
            errors.append("current checkout is dirty on main; move changes to a topic branch")

if not SKIP_REMOTE_GUARD:
    gh_protection = run_command(
        "gh",
        "api",
        f"repos/{remote_guard['repository']}/branches/{remote_guard['protected_branch']}/protection",
    )
    if gh_protection is None:
        pass
    elif gh_protection.returncode != 0:
        errors.append(
            "unable to read GitHub branch protection for "
            f"{remote_guard['repository']}:{remote_guard['protected_branch']}; "
            "run gh auth login and confirm repo access"
        )
    else:
        protection = json.loads(gh_protection.stdout)
        check_equal(
            "remote allow_force_pushes",
            remote_guard["allow_force_pushes"],
            protection["allow_force_pushes"]["enabled"],
        )
        check_equal(
            "remote allow_deletions",
            remote_guard["allow_deletions"],
            protection["allow_deletions"]["enabled"],
        )

        required_status_checks = protection["required_status_checks"]
        if required_status_checks is None:
            errors.append("remote required_status_checks missing; configure branch protection for required CI gates")
        else:
            check_equal(
                "remote require_strict_status_checks",
                remote_guard["require_strict_status_checks"],
                required_status_checks["strict"],
            )
            actual_contexts = sorted(required_status_checks.get("contexts", []))
            expected_contexts = sorted(remote_guard["required_status_checks"])
            check_equal("remote required_status_checks", expected_contexts, actual_contexts)

        has_pr_requirement = protection["required_pull_request_reviews"] is not None
        check_equal(
            "remote require_pull_request",
            remote_guard["require_pull_request"],
            has_pr_requirement,
        )
        if has_pr_requirement:
            check_equal(
                "remote required_approving_review_count",
                remote_guard["required_approving_review_count"],
                protection["required_pull_request_reviews"]["required_approving_review_count"],
            )

workflow_path = ROOT / ci_contract["workflow_path"]
if not workflow_path.exists():
    errors.append(f"missing CI workflow: {ci_contract['workflow_path']}")
else:
    workflow_text = workflow_path.read_text(encoding="utf-8")
    for snippet in [
        "pull_request:",
        "- main",
        "design-artifact-gate:",
        "agent-review:",
        "python3 scripts/validate_agent_review.py",
        "python3 scripts/validate_pr_design_gate.py --base",
        "backend-contract:",
        "cache-dependency-path: infra/cloudbase/functions/softbook-api/package-lock.json",
        "working-directory: infra/cloudbase/functions/softbook-api",
        "./scripts/install_git_hooks.sh",
        "python3 scripts/validate_harness.py --skip-remote-guard",
        "python3 scripts/validate_maestro_selectors.py",
        "npm ci",
        "npm run lint -- --quiet",
        "npm run typecheck",
        "npm test -- --runInBand --watchAll=false",
        'node-version: "22.11.0"',
    ]:
        check_contains("PR workflow gate", workflow_text, snippet)

pr_template_path = ROOT / ci_contract["pull_request_template_path"]
if not pr_template_path.exists():
    errors.append(f"missing pull request template: {ci_contract['pull_request_template_path']}")
else:
    pr_template_text = pr_template_path.read_text(encoding="utf-8")
    for heading in pull_request_contract["required_body_sections"]:
        check_contains("PR template heading", pr_template_text, f"## {heading}")
    for snippet in [
        "- [ ] `python3 scripts/validate_maestro_selectors.py`",
        "- [ ] `cd infra/cloudbase/functions/softbook-api && npm test`",
        "## Agent review",
        "- Review status: N/A",
        "agent-review` gate",
        "- Interaction/motion artifact: N/A",
        "- Physical space artifact: N/A",
        "design brief、direction 或 decision",
        "docs/design/directions/*.md",
        "docs/design/directions/space-surface-visual-directions-v1.md",
        "docs/design/mocks/space-surface-shelf-desk-v1.md",
        "docs/design/mocks/space-state-baseline-v1.html",
        "用户可见 UI 改动必须回答下方 `Universal Q1-Q4` 与适用的 `Conditional Q5-Q6`，不能保留 `N/A`。",
        "`Universal Q1-Q4` 不能只写 `answered`",
        "## 卡片内容交接（如适用）",
        "- Card content handoff: N/A",
        "- Card content validation: N/A",
        "external_workspace:/Users/lenkin/programing/card make",
        "dry-run import、catalog audit、runtime smoke 或 release content gap delta",
    ]:
        check_contains("PR template design gate fields", pr_template_text, snippet)

maestro_selector_script = ROOT / "scripts" / "validate_maestro_selectors.py"
if not maestro_selector_script.exists():
    errors.append("missing Maestro selector validator: scripts/validate_maestro_selectors.py")
else:
    current_result = run_command(sys.executable, str(maestro_selector_script))
    if current_result is None or current_result.returncode != 0:
        errors.append(
            "validate_maestro_selectors.py must pass current Maestro flows: "
            + (current_result.stderr or current_result.stdout if current_result else "")
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        bad_flow = tmp / "bad.yaml"
        good_flow = tmp / "good.yaml"
        bad_flow.write_text(
            """appId: com.softbook.cet
---
- tapOn: "学习前先登录"
- assertVisible: "今日已签到"
- extendedWaitUntil:
    visible: "取消收藏"
- scrollUntilVisible:
    element:
      text: "继续"
- assertVisible:
    id: missing-code-testid
- tapOn: { id: missing-inline-testid }
""",
            encoding="utf-8",
        )
        good_flow.write_text(
            """appId: com.softbook.cet
---
- tapOn:
    id: auth-submit-button
- assertVisible: { id: statistics-checkin-complete-label }
- extendedWaitUntil:
    visible:
      id: "auth-phone-input"
- inputText: "2468"
""",
            encoding="utf-8",
        )

        bad_result = run_command(sys.executable, str(maestro_selector_script), "--file", str(bad_flow))
        if bad_result is None or bad_result.returncode == 0:
            errors.append("validate_maestro_selectors.py must reject visible text selectors and missing testIDs")
        else:
            for snippet in [
                "tapOn must use a stable id selector",
                "text selectors are forbidden",
                "is not backed by a React Native testID",
            ]:
                if snippet not in bad_result.stdout:
                    errors.append(
                        "validate_maestro_selectors.py selector regression missing expected rejection: "
                        + snippet
                    )

        good_result = run_command(sys.executable, str(maestro_selector_script), "--file", str(good_flow))
        if good_result is None or good_result.returncode != 0:
            errors.append(
                "validate_maestro_selectors.py must allow id selectors and inputText values: "
                + (good_result.stderr or good_result.stdout if good_result else "")
            )
