from __future__ import annotations

import hashlib
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
    authority_map = context.load("authority-map.json")
    doc_manifest = context.load("doc-manifest.json")
    delivery = context.load("repo-delivery-contract.json")
    main_branch_policy = harness["governance"]["main_branch_policy"]
    local_guard = harness["governance"]["local_guard"]
    remote_guard = harness["governance"]["remote_guard"]
    pull_request_contract = delivery["pull_request_contract"]
    ci_contract = delivery["ci_contract"]
    formal_approval_gate = ci_contract["formal_approval_gate"]
    batch1_governance_bootstrap = ci_contract[
        "mobile_ux_batch1_governance_bootstrap"
    ]
    trusted_code_policy = batch1_governance_bootstrap["trusted_code_policy"]
    recovery_contract = batch1_governance_bootstrap[
        "governance_recovery_contract"
    ]
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
        gh_repository = run_command(
            "gh",
            "api",
            f"repos/{remote_guard['repository']}",
        )
        if gh_repository is None:
            pass
        elif gh_repository.returncode != 0:
            errors.append(
                "unable to read GitHub repository settings for "
                f"{remote_guard['repository']}; run gh auth login and confirm "
                "Administration read access"
            )
        else:
            try:
                repository = json.loads(gh_repository.stdout)
            except json.JSONDecodeError:
                errors.append("GitHub repository settings returned malformed JSON")
            else:
                if not isinstance(repository, dict):
                    errors.append("GitHub repository settings must be a JSON object")
                else:
                    for setting, expected in remote_guard["repository_settings"].items():
                        check_equal(
                            f"remote repository setting {setting}",
                            expected,
                            repository.get(setting),
                        )

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
        pull_request_gate_workflow_raw_sha256 = hashlib.sha256(
            workflow_path.read_bytes()
        ).hexdigest()
        check_equal(
            "active-state pull-request gate workflow raw SHA-256 recomputed from repository bytes",
            trusted_code_policy["pull_request_gate_workflow_raw_sha256"],
            pull_request_gate_workflow_raw_sha256,
        )
        for pull_request_gate_policy_flag in [
            "pull_request_gate_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes",
            "proposed_head_pull_request_gate_workflow_must_equal_trusted_base_mode_length_and_sha256",
            "pull_request_gate_action_uses_must_be_full_commit_pinned",
        ]:
            check_equal(
                "active-state pull-request gate workflow fail-closed field "
                + pull_request_gate_policy_flag,
                True,
                trusted_code_policy.get(pull_request_gate_policy_flag),
            )
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
            "node --check scripts/classify_formal_approval_scope.mjs",
            "node --check scripts/lib/mobile_ux_batch1_governance_contract.mjs",
            "node --check scripts/lib/mobile_ux_batch1_github_event_reader.mjs",
            "node --check scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs",
            "node --check scripts/lib/mobile_ux_batch1_successor_contract.mjs",
            "node --check scripts/validate_mobile_ux_batch1_governance.mjs",
            "node --check scripts/validate_mobile_ux_batch1_successor.mjs",
            "node --test scripts/test_classify_formal_approval_scope.mjs",
            "node --test scripts/test_mobile_ux_batch1_governance_contract.mjs",
            "node --test scripts/test_mobile_ux_batch1_github_event_reader.mjs",
            "node --test scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs",
            "node --test scripts/test_validate_mobile_ux_batch1_governance.mjs",
            "node --test scripts/test_mobile_ux_batch1_successor_contract.mjs",
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
    batch1_governance_paths = [
        ROOT / batch1_governance_bootstrap[key]
        for key in [
            "governance_contract_module",
            "governance_contract_test",
            "governance_recovery_contract_module",
            "governance_recovery_contract_test",
            "governance_recovery_decision_schema",
            "github_event_reader_module",
            "github_event_reader_test",
            "governance_validator",
            "governance_validator_test",
            "successor_contract_module",
            "successor_validator",
            "successor_validator_test",
        ]
    ]
    for path in [
        formal_workflow_path,
        formal_classifier_path,
        formal_classifier_test_path,
        *batch1_governance_paths,
    ]:
        if not path.exists():
            errors.append(f"missing formal approval artifact: {path.relative_to(ROOT)}")
    if formal_workflow_path.exists():
        formal_workflow_raw_sha256 = hashlib.sha256(
            formal_workflow_path.read_bytes()
        ).hexdigest()
        check_equal(
            "active-state trusted code policy exact keys",
            sorted(
                [
                    "decision_head_artifacts_may_be_read_as_untrusted_data_only",
                    "decision_head_code_execution_forbidden",
                    "intent_or_receipt_supplied_trusted_base_forbidden",
                    "event_head_sha_must_equal_fetched_commit",
                    "classification_and_validation_rename_copy_detection",
                    "classification_and_validation_scope_source",
                    "live_pull_request_file_status_or_previous_filename_semantics_forbidden",
                    "live_pull_request_files_as_classification_or_scope_truth_forbidden",
                    "live_pull_request_files_usage",
                    "missing_or_unverifiable_trusted_base_blob_fails_closed",
                    "proposed_head_workflow_must_equal_trusted_base_mode_length_and_sha256",
                    "proposed_head_pull_request_gate_workflow_must_equal_trusted_base_mode_length_and_sha256",
                    "pull_request_gate_action_uses_must_be_full_commit_pinned",
                    "pull_request_gate_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes",
                    "pull_request_gate_workflow_raw_sha256",
                    "pull_request_target_action_uses_must_be_full_commit_pinned",
                    "pull_request_target_base_checkout_required",
                    "pull_request_target_job_and_step_structure_must_match_trusted_contract",
                    "pull_request_target_permissions_must_be_exact_read_only",
                    "pull_request_target_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes",
                    "pull_request_target_workflow_raw_sha256",
                    "trusted_base_must_be_ancestor_of_approval_target_head",
                    "trusted_code_closure_paths",
                    "workflow_classifier_and_validator_base_blob_modes_and_raw_sha256_must_be_recomputed",
                    "workflow_classifier_and_validator_must_be_loaded_from_verified_base_sha",
                ]
            ),
            sorted(trusted_code_policy),
        )
        check_equal(
            "active-state trusted code policy delivery mirror",
            trusted_code_policy,
            batch1_governance_bootstrap["trusted_code_policy"],
        )
        check_equal(
            "active-state formal-approval workflow raw SHA-256 recomputed from repository bytes",
            trusted_code_policy["pull_request_target_workflow_raw_sha256"],
            formal_workflow_raw_sha256,
        )
        check_equal(
            "active-state recovery maintenance allowlist mirror",
            recovery_contract["maintenance_exact_allowlist_paths"],
            batch1_governance_bootstrap["governance_recovery_contract"][
                "maintenance_exact_allowlist_paths"
            ],
        )
        if ".github/workflows/formal-approval.yml" in recovery_contract[
            "maintenance_exact_allowlist_paths"
        ]:
            errors.append(
                "formal-approval workflow must be absent from the v1 recovery maintenance allowlist"
            )
        if ".github/workflows/pr-gates.yml" in recovery_contract[
            "maintenance_exact_allowlist_paths"
        ]:
            errors.append(
                "pull-request gate workflow must be absent from the v1 recovery maintenance allowlist"
            )
        check_equal(
            "formal-approval workflow maintenance is forbidden in recovery v1",
            True,
            recovery_contract.get(
                "formal_approval_workflow_maintenance_in_v1_forbidden"
            ),
        )
        check_equal(
            "pull-request gate workflow maintenance is forbidden in recovery v1",
            True,
            recovery_contract.get(
                "pull_request_gate_workflow_maintenance_in_v1_forbidden"
            ),
        )
        check_equal(
            "verified squash merge exact first-parent policy mirror",
            True,
            batch1_governance_bootstrap[
                "stage_separation_merge_integrity_contract"
            ].get(
                "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha"
            ),
        )
        formal_workflow_text = formal_workflow_path.read_text(encoding="utf-8")
        for snippet in [
            "pull_request_target:",
            "actions: read",
            "deployments: read",
            "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7",
            "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7",
            "ref: ${{ github.event.pull_request.base.sha }}",
            "fetch-depth: 0",
            "persist-credentials: false",
            "name: Set up trusted Node.js runtime",
            'node-version: "22.13.0"',
            ".changed_files",
            "--paginate --slurp",
            "--expected-count",
            "decision_class: ${{ steps.scope.outputs.decision_class }}",
            "trusted_validation_required: ${{ steps.scope.outputs.trusted_validation_required }}",
            "classification_error: ${{ steps.scope.outputs.classification_error }}",
            "Fail closed on classification errors",
            "formal-approval-trusted-validation",
            "Fetch untrusted head as data only",
            'git fetch --no-tags origin "refs/pull/$PR_NUMBER/head"',
            "test \"$(git rev-parse HEAD)\" = \"$EXPECTED_BASE_SHA\"",
            "node scripts/validate_mobile_ux_batch1_governance.mjs validate-pr",
            "node scripts/validate_mobile_ux_batch1_governance.mjs verify-current-run-approval",
            '--workflow-run-id "$GITHUB_RUN_ID"',
            '--workflow-run-attempt "$GITHUB_RUN_ATTEMPT"',
            "needs.trusted_validation.result == 'success'",
            "name: formal-product-owner-approval",
            "name: formal-approval",
        ]:
            check_contains("formal approval trusted workflow", formal_workflow_text, snippet)
        if formal_workflow_text.count("fetch-depth: 0") != 3:
            errors.append(
                "formal approval classifier, trusted validator, and protected owner verifier must fetch full base history"
            )
        if formal_workflow_text.count("name: Set up trusted Node.js runtime") != 3:
            errors.append(
                "formal approval classifier, trusted validator, and protected owner verifier must pin the trusted Node.js runtime"
            )
        trusted_validation_marker = "  trusted_validation:"
        if formal_workflow_text.count(trusted_validation_marker) != 1:
            errors.append("formal approval workflow must define one trusted_validation job")
        else:
            trusted_validation_job = formal_workflow_text.split(
                trusted_validation_marker, 1
            )[1].split("\n  automatic:", 1)[0]
            for forbidden in [
                "ref: ${{ github.event.pull_request.head.sha }}",
                "git checkout $EXPECTED_HEAD_SHA",
                'git checkout "$EXPECTED_HEAD_SHA"',
            ]:
                if forbidden in trusted_validation_job:
                    errors.append(
                        "formal approval trusted validation executes or checks out head code: "
                        + forbidden
                    )
    active_policy_path = ROOT / "spec/mobile-ux-batch1-governance.json"
    active_policy_status = run_command("git", "status", "--porcelain")
    active_policy_is_untracked = (
        active_policy_status is not None
        and active_policy_status.returncode == 0
        and any(
            line == "?? spec/mobile-ux-batch1-governance.json"
            for line in active_policy_status.stdout.splitlines()
        )
    )
    active_anchor_shape = (
        "mobile_ux_batch1_governance" in authority_map.get("domains", {})
        and "mobile_ux_batch1_governance" in harness.get("read_paths", {})
        and "mobile_ux_batch1_governance_policy"
        in harness.get("governance", {})
        and doc_manifest.get("active_specs", []).count(
            "spec/mobile-ux-batch1-governance.json"
        )
        == 1
    )
    if active_anchor_shape:
        if (
            not active_policy_path.is_file()
            or active_policy_path.is_symlink()
            or active_policy_is_untracked
        ):
            errors.append(
                "active Mobile UX Batch 1 anchors require a tracked regular policy artifact"
            )
        else:
            active_policy = context.load("mobile-ux-batch1-governance.json")
            check_equal(
                "active-state trusted code policy equals timeless tracked mirror",
                trusted_code_policy,
                active_policy.get("trusted_code_policy"),
            )
            check_equal(
                "active-state recovery policy equals timeless tracked mirror",
                recovery_contract,
                active_policy.get("governance_recovery_contract"),
            )
            check_equal(
                "active-state squash first-parent policy equals timeless tracked mirror",
                batch1_governance_bootstrap[
                    "stage_separation_merge_integrity_contract"
                ][
                    "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha"
                ],
                active_policy.get("stage_separation_policy", {}).get(
                    "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha"
                ),
            )
            check_equal(
                "active-state protected current-run approval contract equals timeless tracked mirror",
                batch1_governance_bootstrap[
                    "protected_current_run_approval_contract"
                ],
                {
                    key: active_policy.get(
                        "protected_approval_event_contract", {}
                    ).get(key)
                    for key in batch1_governance_bootstrap[
                        "protected_current_run_approval_contract"
                    ]
                },
            )
            check_equal(
                "active-state activation revalidation failure policy equals timeless tracked mirror",
                batch1_governance_bootstrap[
                    "activation_current_run_revalidation_failure_policy"
                ],
                active_policy.get("activation_contract", {}).get(
                    "current_run_approval_revalidation_failure_policy"
                ),
            )
            check_equal(
                "active-state activation decision classes equal timeless tracked mirror",
                batch1_governance_bootstrap[
                    "activation_decision_class_contract"
                ],
                {
                    "artifact_required_decision_class": active_policy.get(
                        "activation_contract", {}
                    ).get("required_decision_class"),
                    "workflow_required_decision_class": active_policy.get(
                        "activation_contract", {}
                    ).get("required_workflow_decision_class"),
                },
            )
    if formal_classifier_path.exists():
        formal_classifier_text = formal_classifier_path.read_text(encoding="utf-8")
        for snippet in [
            "formal-approval-scope.v2",
            "decision_class",
            "trusted_validation_required",
            "classification_error",
            "governance_foundation",
            "batch1_subject_change",
            "legacy_receipt_migration_intent",
            "cohort_designation_intent",
            "manifest_freeze_intent",
            "receipt_materialization",
            "RECOVERY_DECISION_CLASSES",
            "parseRecoveryDecisionPath",
            "parseRecoveryRunRecordPath",
            "--name-status",
            "--find-copies-harder",
            "cat-file",
            "spec/mobile-ux-batch1-governance.json",
            "spec/mobile-ux-batch1-resolved-requirement.schema.json",
            "spec/mobile-ux-batch1-governance-recovery-decision.schema.json",
            "scripts/validate_mobile_ux_batch1_governance.mjs",
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
            "governance foundation changes are distinguished from generic sensitivity",
            "canonical recovery decision and run-record pairs select each exact protected class",
            "exact Git classification is bound to the event head and includes both sides of rename and copy records",
            "recovery path identity, cardinality, scope, and class mixing fail closed",
            "every unknown mobile-ux-batch1 decision path is sensitive and invalid",
            "mixed authority-bearing intent classes fail closed",
            "multiple receipts and any intent plus receipt fail closed",
        ]:
            check_contains("formal approval regression coverage", formal_classifier_test_text, snippet)

    batch1_recovery_contract_path = ROOT / batch1_governance_bootstrap[
        "governance_recovery_contract_module"
    ]
    if batch1_recovery_contract_path.exists():
        batch1_recovery_contract_text = batch1_recovery_contract_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "mobile-ux-batch1-governance-recovery-decision.v1",
            "RECOVERY_DECISION_CLASSES",
            "inactive_initial",
            "inactive_bootstrap_installed",
            "active",
            "revoked",
            "bootstrap_maintenance",
            "active_maintenance",
            "revoked_recovery",
            "revoke_active_governance",
            "rebootstrap_same_policy",
            "ESSENTIAL_RECOVERY_KERNEL_PATHS",
            "closure_artifacts_at_bootstrap_merge",
            "closure_artifacts_at_trusted_base",
            "validateBootstrapInstalledProof",
            "validateVerifiedRevocationProof",
            "validateRecoveryDecision",
            "deriveGovernanceState",
            "decision and run-record bytes must remain equal to merge bytes",
            "bootstrap run-record bytes must remain equal to their materialization merge bytes",
        ]:
            check_contains(
                "mobile UX Batch 1 governance recovery contract",
                batch1_recovery_contract_text,
                snippet,
            )
        for trusted_code_path in batch1_governance_bootstrap["trusted_code_closure"]:
            check_contains(
                "mobile UX Batch 1 essential recovery kernel",
                batch1_recovery_contract_text,
                trusted_code_path,
            )

    batch1_recovery_test_path = ROOT / batch1_governance_bootstrap[
        "governance_recovery_contract_test"
    ]
    if batch1_recovery_test_path.exists():
        batch1_recovery_test_text = batch1_recovery_test_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "bootstrap-installed proof binds every nonempty essential base artifact and ancestry fact",
            "closure_artifacts_at_bootstrap_merge",
            "closure_artifacts_at_trusted_base",
            "verified revocation proof binds exact decision bytes, remote merge, ancestry, and Batch 1-owned revoked projections",
            "bootstrap-installed maintenance is a protected positive transition",
            "revoked recovery requires a verified merged revocation context",
            "same-policy rebootstrap changes only anchors plus run record",
            "decision self is excluded while every other changed path including run record is bound",
            "initial inactive, unverified bootstrap, and wrong-state transitions fail closed",
            "inactive anchors require trusted lineage proof and cannot be selected by a boolean",
        ]:
            check_contains(
                "mobile UX Batch 1 governance recovery regressions",
                batch1_recovery_test_text,
                snippet,
            )

    batch1_governance_contract_path = ROOT / batch1_governance_bootstrap[
        "governance_contract_module"
    ]
    if batch1_governance_contract_path.exists():
        batch1_governance_contract_text = batch1_governance_contract_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "mobile-ux-batch1-governance-contract.v1",
            "validateGovernancePolicy",
            "validatePrivacyAttestation",
            "projectGitHubApprovalEvent",
            "validateDecisionIntent",
            "validateApprovalReceipt",
            "evaluateReceiptValidity",
            "validateReceiptMaterializationDecision",
        ]:
            check_contains(
                "mobile UX Batch 1 governance contract",
                batch1_governance_contract_text,
                snippet,
            )

    batch1_governance_test_path = ROOT / batch1_governance_bootstrap[
        "governance_contract_test"
    ]
    if batch1_governance_test_path.exists():
        batch1_governance_test_text = batch1_governance_test_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "governance policy fixes 7/30/14 day ceilings below provider retention",
            "approval target is the historical workflow head, not a mutable current PR head",
            "decision intent validation requires trusted observed HEAD artifact records",
            "approval receipt binds intent, event, parent, authority, TTL, and instance digest",
            "receipt materialization schema is authority-free and path-bound",
        ]:
            check_contains(
                "mobile UX Batch 1 governance regression coverage",
                batch1_governance_test_text,
                snippet,
            )

    batch1_event_reader_path = ROOT / batch1_governance_bootstrap[
        "github_event_reader_module"
    ]
    if batch1_event_reader_path.exists():
        batch1_event_reader_text = batch1_event_reader_path.read_text(encoding="utf-8")
        for snippet in [
            "readVerifiedGitHubApprovalEvent",
            "workflowRun.event !== 'pull_request_target'",
            "environment.can_admins_bypass !== false",
            "current-run approval v1 supports only workflow run attempt 1",
            "review.comment !== requiredComment",
            "GitHub API record is no longer resolvable",
            "GitHub API response is paginated or truncated",
        ]:
            check_contains(
                "mobile UX Batch 1 GitHub event reader",
                batch1_event_reader_text,
                snippet,
            )

    batch1_event_reader_test_path = ROOT / batch1_governance_bootstrap[
        "github_event_reader_test"
    ]
    if batch1_event_reader_test_path.exists():
        batch1_event_reader_test_text = batch1_event_reader_test_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "historical approval remains verifiable after the live pull-request head advances",
            "approval review rejection fails closed",
            "missing exact waiting status and environment bypass drift fail closed",
            "GitHub HTTP reader rejects pagination and missing provider time",
            "attempt 2 cannot reuse the attempt 1 approved review",
            "canonical subject scope rejects",
        ]:
            check_contains(
                "mobile UX Batch 1 GitHub event reader regressions",
                batch1_event_reader_test_text,
                snippet,
            )

    batch1_governance_validator_path = ROOT / batch1_governance_bootstrap[
        "governance_validator"
    ]
    if batch1_governance_validator_path.exists():
        batch1_governance_validator_text = batch1_governance_validator_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "validatePullRequest",
            "TRUSTED_CODE_CLOSURE",
            "ESSENTIAL_RECOVERY_KERNEL_PATHS",
            "...ESSENTIAL_RECOVERY_KERNEL_PATHS",
            "validateTrustedCodeClosure",
            "validateTrustedCodeClosure(root, options.baseSha)",
            "trusted validator must execute from the exact checked-out base SHA",
            "trusted code worktree path must be a regular non-symlink file",
            "trusted code worktree bytes differ from base blob",
            "assertAncestor(root, options.baseSha, options.headSha, 'trusted base ancestry')",
            "exactGitChangedFileView",
            "readExactGitChangedRecords(root, baseSha, headSha)",
            "export function exactGitClassificationPaths",
            "const changedPaths = exactGitClassificationPaths(",
            "exactGitClassificationPaths(root, localParentSha, mergeCommitSha),",
            "assertSameStringSet",
            "classifyFormalApprovalScope(\n    exactGitView.classificationPaths",
            "validateFoundation(root, options.headSha, exactGitView.classificationPaths",
            "classification failed closed",
            "decision class mismatch",
            "validate-pr may only be invoked for a trusted-validation-required class",
            "must be one exact tracked 100644 non-symlink blob",
            "grants no product, visual, implementation, native, release, or leadership-readiness authority",
        ]:
            check_contains(
                "mobile UX Batch 1 trusted governance validator",
                batch1_governance_validator_text,
                snippet,
            )
        if "actualChangedPaths" in batch1_governance_validator_text:
            errors.append(
                "mobile UX Batch 1 trusted governance validator must not retain "
                "the pre-exact-Git actualChangedPaths view"
            )
    batch1_governance_validator_test_path = ROOT / batch1_governance_bootstrap[
        "governance_validator_test"
    ]
    if batch1_governance_validator_test_path.exists():
        batch1_governance_validator_test_text = (
            batch1_governance_validator_test_path.read_text(encoding="utf-8")
        )
        for snippet in [
            "decision class mismatch and incomplete GitHub file enumeration fail closed",
            "live Files API rename metadata cannot replace exact event-head Git classification truth",
            "historical replay classification paths retain both sides of exact Git renames and copies",
            "worktree validator bytes must equal the exact trusted base blobs",
            "CLI interface matches the protected workflow contract",
        ]:
            check_contains(
                "mobile UX Batch 1 trusted governance validator regressions",
                batch1_governance_validator_test_text,
                snippet,
            )

    batch1_successor_contract_path = ROOT / batch1_governance_bootstrap[
        "successor_contract_module"
    ]
    if batch1_successor_contract_path.exists():
        batch1_successor_contract_text = batch1_successor_contract_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "descriptor_and_tracked_hash_binding_only",
            "build_recipe_executed: false",
            "build_output_rebuilt: false",
            "build_reproducibility_proven: false",
            "hermetic_replay_proven: false",
        ]:
            check_contains(
                "mobile UX Batch 1 B2 descriptor and tracked-hash nonclaim",
                batch1_successor_contract_text,
                snippet,
            )

    batch1_successor_path = ROOT / batch1_governance_bootstrap["successor_validator"]
    if batch1_successor_path.exists():
        batch1_successor_text = batch1_successor_path.read_text(encoding="utf-8")
        for snippet in [
            "validateSuccessorFromGit",
            "assertAncestor",
            "must be one exact 100644 non-symlink blob",
            "validateR0Transition",
            "validateB2Transition",
        ]:
            check_contains(
                "mobile UX Batch 1 successor validator",
                batch1_successor_text,
                snippet,
            )

    batch1_successor_test_path = ROOT / batch1_governance_bootstrap[
        "successor_validator_test"
    ]
    if batch1_successor_test_path.exists():
        batch1_successor_test_text = batch1_successor_test_path.read_text(
            encoding="utf-8"
        )
        for snippet in [
            "valid R0 resolves exactly 136 and leaves the fixed nine pending",
            "R0 rejects stale value digests, PII, unbound provenance, and overlong validity",
            "valid B2 preserves all 136 R0 records and derives the nine-value DAG",
            "B2 rejects malformed windows, non-private pseudonyms, and output-in-source recursion",
        ]:
            check_contains(
                "mobile UX Batch 1 successor regression coverage",
                batch1_successor_test_text,
                snippet,
            )

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
            "classifier_v2_decision_class_and_validation_outputs",
            "trusted_validation_required_for_sensitive_scope",
            "trusted_base_classifier_and_validator_only",
            "decision_head_artifacts_are_untrusted_data_only",
            "decision_head_code_execution_forbidden",
            "unknown_or_mixed_batch1_decisions_fail_closed",
            "batch1_governance_activation_is_derived_from_exact_authority_owner_and_artifacts",
            "batch1_governance_regressions_required_in_pr_ci",
            "recovery_decision_classes_are_protected_and_fail_closed",
            "four_governance_states_are_derived_from_trusted_base_and_remote_lineage",
            "five_recovery_operations_are_exact_state_bound_transitions",
            "revoked_state_blocks_non_recovery_successor_receipt_and_execution_use",
            "permanent_governance_run_records_and_lineage_bytes_match_unique_merged_introductions",
            "essential_recovery_kernel_is_eleven_trusted_paths",
            "current_run_protected_owner_revalidation_is_required_for_recovery",
            "B2_proves_descriptor_and_tracked_hash_binding_only",
            "pull_request_target_workflow_raw_sha256_is_recomputed_from_real_repository_bytes",
            "pull_request_target_workflow_all_values_and_nested_mappings_match_exact_closed_bytes",
            "proposed_head_workflow_matches_trusted_base_mode_length_and_sha256",
            "formal_approval_workflow_is_absent_from_recovery_maintenance_allowlist",
            "formal_approval_workflow_maintenance_in_v1_is_forbidden",
            "verified_squash_merge_commit_has_exactly_one_parent_equal_to_pull_request_base_sha",
            "pull_request_gate_workflow_raw_sha256_is_recomputed_from_real_repository_bytes",
            "pull_request_gate_workflow_all_values_and_nested_mappings_match_exact_closed_bytes",
            "proposed_head_pull_request_gate_workflow_matches_trusted_base_mode_length_and_sha256",
            "pull_request_gate_action_uses_are_full_commit_pinned",
            "pull_request_gate_workflow_is_absent_from_recovery_maintenance_allowlist",
            "pull_request_gate_workflow_maintenance_in_v1_is_forbidden",
            "inactive_bootstrap_clean_checkout_does_not_load_four_pr_b_canonical_artifacts",
            "classification_and_validation_scope_use_verified_base_to_exact_event_head_full_tree_git_diff",
            "classification_and_validation_use_nul_delimited_rename_and_copy_detection",
            "live_pull_request_files_are_forbidden_as_classification_or_scope_truth",
            "live_pull_request_file_status_and_previous_filename_semantics_are_forbidden",
            "event_head_sha_equals_the_fetched_commit",
            "live_pull_request_files_are_used_only_for_current_filename_completeness_cross_check_against_exact_git_records",
            "maintenance_allowlist_payload_requires_an_exact_recovery_decision_and_run_record_pair",
            "current_run_approval_supports_only_first_workflow_attempt",
            "current_run_approval_comment_binds_exact_decision_class_pull_request_and_head",
            "current_run_approval_comment_comparison_is_exact_utf8_without_normalization",
            "failed_current_run_requires_a_new_event_run_and_environment_approval",
            "activation_revalidation_wrong_attempt_or_noncanonical_comment_fails_closed",
            "activation_artifact_schema_definition_is_distinct_from_workflow_governance_foundation_class",
            "bootstrap_materialization_required_pull_request_base_sha_is_fixed",
            "bootstrap_remote_landing_base_equals_required_base_sha",
            "bootstrap_required_base_is_direct_first_parent_of_materialization_merge",
            "anchor_document_versions_transition_independently_from_each_base_vnext_N_to_head_vnext_N_plus_1",
            "cross_document_version_parity_or_fixed_activation_version_is_not_required",
            "lineage_enumeration_uses_complete_trusted_base_git_history_not_current_tree_only",
            "historical_recovery_decision_or_run_record_delete_copy_or_rename_invalidates_state",
            "transition_commits_after_terminal_event_are_recomputed_and_empty",
            "foundation_lineage_event_replays_exact_eight_path_scope_three_immutable_hashes_dynamic_anchor_transition_and_stable_run_record",
            "owned_projection_binds_agents_mobile_ux_batch1_governance_heading_count",
            "foundation_doc_manifest_transition_uses_dynamic_base_vnext_N_to_head_vnext_N_plus_1_with_minimum_base_vnext_9",
            "bootstrap_installed_proof_binds_exact_merge_and_current_eleven_path_kernel_snapshots_allows_byte_evolution_and_rejects_later_additions",
            "timeless_harness_accepts_exact_bootstrap_active_and_revoked_owned_anchor_shapes_without_global_version_state_inference",
            "synthetic_single_step_revocation_and_rebootstrap_transitions_are_regressed",
            "synthetic_recovery_transitions_bump_each_anchor_document_version_once_from_its_own_base_without_cross_document_alignment",
            "revoked_owned_projection_allows_unrelated_generic_sensitive_anchor_evolution",
            "rebootstrap_active_projection_requires_matching_canonical_dynamic_activation_record",
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
