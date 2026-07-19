from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    check_equal = context.check_equal
    check_contains = context.check_contains
    find_by_id = context.find_by_id
    run_command = context.run_command
    SKIP_REMOTE_GUARD = context.mode == "local"
    harness = context.load("agent-harness.json")
    delivery = context.load("repo-delivery-contract.json")
    main_branch_policy = harness["governance"]["main_branch_policy"]
    local_guard = harness["governance"]["local_guard"]
    remote_guard = harness["governance"]["remote_guard"]
    pull_request_contract = delivery["pull_request_contract"]
    ci_contract = delivery["ci_contract"]
    formal_approval_gate = ci_contract["formal_approval_gate"]
    remote_repository_health = ci_contract["remote_repository_health"]
    evals = context.load("evals.json")

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
            'git -C "$ROOT_DIR" config --worktree core.hooksPath "$HOOKS_DIR"',
        )
        check_contains(
            "install worktree config extension",
            install_text,
            'git -C "$ROOT_DIR" config extensions.worktreeConfig true',
        )
        check_contains("install Git LFS filters", install_text, local_guard["lfs_install_command"])

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
        if hook["action"] == "pre-push":
            check_contains(
                f"{hook['path']} Git LFS dispatch",
                hook_text,
                local_guard["lfs_pre_push_command"],
            )

    git_dir = run_command("git", "rev-parse", "--git-dir")
    if git_dir is None or git_dir.returncode != 0:
        errors.append("repository is not in a git checkout")
    else:
        configured_hooks = run_command("git", "config", "--worktree", "--path", "--get", "core.hooksPath")
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
        context.mark_remote_guard_executed()
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

        gh_environment = run_command(
            "gh",
            "api",
            f"repos/{remote_guard['repository']}/environments/{formal_approval_gate['environment']}",
        )
        if gh_environment is None:
            pass
        elif gh_environment.returncode != 0:
            errors.append(
                "unable to read protected formal approval environment for "
                f"{remote_guard['repository']}:{formal_approval_gate['environment']}; "
                "confirm the environment exists and gh can read repository settings"
            )
        else:
            try:
                environment = json.loads(gh_environment.stdout)
            except json.JSONDecodeError:
                errors.append("formal approval environment returned malformed JSON")
            else:
                check_equal(
                    "formal approval environment name",
                    formal_approval_gate["environment"],
                    environment.get("name"),
                )
                check_equal(
                    "formal approval administrator bypass",
                    formal_approval_gate["administrators_can_bypass"],
                    environment.get("can_admins_bypass"),
                )
                reviewer_rules = [
                    rule
                    for rule in environment.get("protection_rules", [])
                    if rule.get("type") == "required_reviewers"
                ]
                if len(reviewer_rules) != 1:
                    errors.append(
                        "formal approval environment must have exactly one required_reviewers rule"
                    )
                else:
                    reviewer_rule = reviewer_rules[0]
                    check_equal(
                        "formal approval prevent_self_review",
                        formal_approval_gate["prevent_self_review"],
                        reviewer_rule.get("prevent_self_review"),
                    )
                    reviewer_entries = reviewer_rule.get("reviewers", [])
                    if not isinstance(reviewer_entries, list):
                        reviewer_entries = []
                    normalized_reviewers = [
                        {
                            "type": entry.get("type") if isinstance(entry, dict) else None,
                            "login": (
                                (entry.get("reviewer") or {}).get("login")
                                if isinstance(entry, dict)
                                else None
                            ),
                            "slug": (
                                (entry.get("reviewer") or {}).get("slug")
                                if isinstance(entry, dict)
                                else None
                            ),
                        }
                        for entry in reviewer_entries
                    ]
                    expected_login = formal_approval_gate["required_reviewer"].removeprefix(
                        "github:"
                    )
                    check_equal(
                        "formal approval required reviewer entries",
                        [{"type": "User", "login": expected_login, "slug": None}],
                        normalized_reviewers,
                    )

    mobile_gemfile_path = ROOT / "apps/mobile/Gemfile"
    mobile_gemfile_lock_path = ROOT / "apps/mobile/Gemfile.lock"
    if not mobile_gemfile_path.exists():
        errors.append("missing mobile Ruby dependency manifest: apps/mobile/Gemfile")
    else:
        mobile_gemfile_text = mobile_gemfile_path.read_text(encoding="utf-8")
        ruby_contract = re.search(
            r'^\s*ruby\s+"~> 3\.3\.0"\s*$',
            mobile_gemfile_text,
            re.MULTILINE,
        )
        if ruby_contract is None:
            errors.append('mobile Ruby toolchain contract must declare ruby "~> 3.3.0"')
    if not mobile_gemfile_lock_path.exists():
        errors.append("missing mobile Ruby dependency lock: apps/mobile/Gemfile.lock")
    else:
        mobile_gemfile_lock_text = mobile_gemfile_lock_path.read_text(encoding="utf-8")
        if re.search(
            r"^RUBY VERSION\n\s+ruby 3\.3\.\d+(?:p\d+)?$",
            mobile_gemfile_lock_text,
            re.MULTILINE,
        ) is None:
            errors.append("mobile Ruby lock toolchain must record a Ruby 3.3.x version")

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
            'gh api "repos/$GH_REPO/pulls/$PR_NUMBER" --jq .body',
            'python3 scripts/validate_agent_review.py --body-file "$RUNNER_TEMP/pr-body.md"',
            "python3 scripts/validate_pr_design_gate.py --base",
            "backend-contract:",
            "cache-dependency-path: infra/cloudbase/functions/softbook-api/package-lock.json",
            "working-directory: infra/cloudbase/functions/softbook-api",
            "./scripts/install_git_hooks.sh",
            "python3 scripts/test_validate_harness_runner.py",
            "python3 scripts/test_run_local_gates.py",
            "python3 scripts/test_harness_module_boundaries.py",
            "node --test scripts/test_check_design_metadata_leaks.mjs",
            "node --test scripts/test_classify_formal_approval_scope.mjs",
            "python3 scripts/validate_harness.py --skip-remote-guard",
            "node --test scripts/test_validate_launch_readiness.mjs",
            "node scripts/validate_launch_readiness.mjs",
            "node --test scripts/test_validate_agent_run_evidence.mjs",
            "node scripts/validate_agent_run_evidence.mjs --verify-remote",
            "- name: Test repository health validator",
            "- name: Reject untrusted remote health ref",
            "- name: Validate trusted remote repository health",
            "- name: Validate changed repository health",
            "github.ref != 'refs/heads/main'",
            "github.ref == 'refs/heads/main'",
            "REPO_HEALTH_TOKEN: ${{ secrets.REPO_HEALTH_TOKEN }}",
            'if [ -z "$REPO_HEALTH_TOKEN" ]; then',
            'GH_TOKEN="$REPO_HEALTH_TOKEN" node scripts/report_repo_health.mjs --full-tree --remote --strict',
            "python3 scripts/validate_maestro_selectors.py",
            "npm ci",
            "npm run lint -- --quiet",
            "npm run typecheck",
            "npm test -- --runInBand --watchAll=false",
            'node-version: "22.13.0"',
            'python-version: "3.12"',
            "uses: ruby/setup-ruby@",
            'ruby-version: "3.3"',
            'bundler: "Gemfile.lock"',
            "- name: Verify Ruby dependency lock",
            "git diff --exit-code -- Gemfile.lock",
        ]:
            check_contains("PR workflow gate", workflow_text, snippet)
        repo_health_job = workflow_text.split("  repo-health:", 1)[-1].split(
            "  evidence-archive:", 1
        )[0]
        if 'GH_TOKEN: ${{ github.token }}' in repo_health_job:
            errors.append("remote repository health must not fall back to github.token")
        secret_expression = "REPO_HEALTH_TOKEN: ${{ secrets.REPO_HEALTH_TOKEN }}"
        if repo_health_job.count(secret_expression) != 1:
            errors.append(
                "remote repository health secret must appear exactly once in repo-health"
            )
        trusted_step_marker = "      - name: Validate trusted remote repository health"
        if repo_health_job.count(trusted_step_marker) != 1:
            errors.append("repo-health must have exactly one trusted remote validation step")
        else:
            trusted_step_tail = repo_health_job.split(trusted_step_marker, 1)[1]
            trusted_step = trusted_step_marker + trusted_step_tail.split(
                "\n      - name:", 1
            )[0]
            if secret_expression not in trusted_step:
                errors.append("remote repository health secret escaped the trusted step")
            without_trusted_step = repo_health_job.replace(trusted_step, "", 1)
            if "REPO_HEALTH_TOKEN" in without_trusted_step:
                errors.append("untrusted repo-health step can reference REPO_HEALTH_TOKEN")
            if "${{ secrets." in without_trusted_step:
                errors.append("untrusted repo-health step can access a repository secret")
            for snippet in [
                "github.event_name == 'schedule'",
                "github.event_name == 'workflow_dispatch'",
                f"github.ref == '{remote_repository_health['trusted_ref']}'",
            ]:
                check_contains("trusted remote repository health step", trusted_step, snippet)
        reject_step_marker = "      - name: Reject untrusted remote health ref"
        if repo_health_job.count(reject_step_marker) != 1:
            errors.append("repo-health must have exactly one untrusted-ref rejection step")
        else:
            reject_step_tail = repo_health_job.split(reject_step_marker, 1)[1]
            reject_step = reject_step_marker + reject_step_tail.split(
                "\n      - name:", 1
            )[0]
            for snippet in [
                "github.event_name == 'schedule'",
                "github.event_name == 'workflow_dispatch'",
                f"github.ref != '{remote_repository_health['trusted_ref']}'",
                "exit 1",
            ]:
                check_contains("untrusted remote health rejection step", reject_step, snippet)
        changed_step_marker = "      - name: Validate changed repository health"
        if repo_health_job.count(changed_step_marker) != 1:
            errors.append("repo-health must have exactly one uncredentialed changed-tree step")
        else:
            changed_step_tail = repo_health_job.split(changed_step_marker, 1)[1]
            changed_step = changed_step_marker + changed_step_tail.split(
                "\n      - name:", 1
            )[0]
            for snippet in [
                "github.event_name != 'schedule'",
                "github.event_name != 'workflow_dispatch'",
                "node scripts/report_repo_health.mjs --base",
            ]:
                check_contains("changed repository health step", changed_step, snippet)
        check_equal(
            "remote repository health credential",
            "REPO_HEALTH_TOKEN",
            remote_repository_health["actions_secret"],
        )
        check_equal(
            "remote repository health trusted ref",
            "refs/heads/main",
            remote_repository_health["trusted_ref"],
        )
        check_equal(
            "remote repository health secret exposure",
            "trusted_ref_remote_step_only",
            remote_repository_health["secret_exposure_policy"],
        )
        check_equal(
            "remote repository health untrusted ref policy",
            "fail_closed_without_secret",
            remote_repository_health["untrusted_remote_ref_policy"],
        )

    formal_workflow_path = ROOT / formal_approval_gate["workflow_path"]
    formal_classifier_path = ROOT / formal_approval_gate["scope_classifier_path"]
    formal_classifier_test_path = ROOT / formal_approval_gate["scope_classifier_test_path"]
    for path in [formal_workflow_path, formal_classifier_path, formal_classifier_test_path]:
        if not path.exists():
            errors.append(f"missing formal approval artifact: {path.relative_to(ROOT)}")
    if formal_workflow_path.exists():
        formal_workflow_text = formal_workflow_path.read_text(encoding="utf-8")
        for snippet in [
            "pull_request_target:",
            "ref: ${{ github.event.pull_request.base.sha }}",
            "persist-credentials: false",
            ".changed_files",
            "--paginate --slurp",
            "--expected-count",
            "name: formal-product-owner-approval",
            "name: formal-approval",
        ]:
            check_contains("formal approval trusted workflow", formal_workflow_text, snippet)
    if formal_classifier_path.exists():
        formal_classifier_text = formal_classifier_path.read_text(encoding="utf-8")
        for snippet in [
            "formal-approval-scope.v1",
            "docs/agent-runs/evidence/",
            "docs/release/",
            "security/reports/",
            ".github/workflows/",
            "changed_paths.length === 0",
        ]:
            check_contains("formal approval scope classifier", formal_classifier_text, snippet)
    if formal_classifier_test_path.exists():
        formal_classifier_test_text = formal_classifier_test_path.read_text(encoding="utf-8")
        for snippet in [
            "empty and malformed changed-file input fails closed",
            "GitHub file input fails closed when API pagination is truncated",
            "GitHub file input rejects the API safety limit",
            "renamed sensitive paths remain sensitive through previous filenames",
            "approval workflow classifies with trusted base code before protected approval",
        ]:
            check_contains("formal approval regression coverage", formal_classifier_test_text, snippet)

    formal_approval_regression = find_by_id(evals["regressions"], "HR-36")
    if formal_approval_regression:
        for marker in [
            "verified_by_is_metadata_only",
            "trusted_default_branch_scope_classifier",
            "protected_github_environment_approval",
            "formal_approval_required_status_check",
            "sensitive_governance_paths_fail_closed",
            "environment_configuration_verified_remotely",
            "administrator_bypass_disabled",
            "remote_health_secret_trusted_ref_only",
        ]:
            if marker not in formal_approval_regression["must_hit"]:
                errors.append(f"HR-36 missing formal approval marker: {marker}")

    pr_template_path = ROOT / ci_contract["pull_request_template_path"]
    if not pr_template_path.exists():
        errors.append(f"missing pull request template: {ci_contract['pull_request_template_path']}")
    else:
        pr_template_text = pr_template_path.read_text(encoding="utf-8")
        for heading in pull_request_contract["required_body_sections"]:
            check_contains("PR template heading", pr_template_text, f"## {heading}")
        for snippet in [
            "- [ ] `python3 scripts/test_validate_harness_runner.py`",
            "- [ ] `python3 scripts/test_run_local_gates.py`",
            "- [ ] `python3 scripts/test_harness_module_boundaries.py`",
            "- [ ] `node --test scripts/test_check_design_metadata_leaks.mjs`",
            "- [ ] `node --test scripts/test_classify_formal_approval_scope.mjs`",
            "- [ ] `python3 scripts/validate_maestro_selectors.py`",
            "- [ ] `node --test scripts/test_validate_launch_readiness.mjs && node scripts/validate_launch_readiness.mjs`",
            "- [ ] `node --test scripts/test_validate_agent_run_evidence.mjs && node scripts/validate_agent_run_evidence.mjs --verify-remote`",
            "- [ ] `cd infra/cloudbase/functions/softbook-api && npm test`",
            "- [ ] `scripts/run_local_gates --profile dev`",
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

        with context.temporary_directory() as tmpdir:
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
                    "scrollUntilVisible is forbidden in one-screen smoke flows",
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
