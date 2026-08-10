from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    load = context.load
    check_equal = context.check_equal
    check_contains = context.check_contains
    find_by_id = context.find_by_id
    authority = load("authority-map.json")
    harness = load("agent-harness.json")
    delivery = load("repo-delivery-contract.json")
    manifest = load("doc-manifest.json")
    evals = load("evals.json")

    harness_architecture_spec = load("harness-architecture.json")

    check_equal("harness architecture version", "vnext-7", harness_architecture_spec["version"])
    check_equal("harness architecture layer", "repo_governance_truth", harness_architecture_spec["layer"])

    batch1_architecture = harness_architecture_spec[
        "mobile_ux_batch1_governance_validation_contract"
    ]
    batch1_delivery = delivery["ci_contract"][
        "mobile_ux_batch1_governance_bootstrap"
    ]
    delivery_runtime_text = (
        ROOT / "scripts/harness_validator/sections/delivery_runtime.py"
    ).read_text(encoding="utf-8")
    active_policy_load_marker = (
        'active_policy = context.load("mobile-ux-batch1-governance.json")'
    )
    check_equal(
        "inactive bootstrap delivery runtime has one active-only PR-B policy load",
        1,
        delivery_runtime_text.count(active_policy_load_marker),
    )
    if (
        active_policy_load_marker in delivery_runtime_text
        and "if active_anchor_shape:" in delivery_runtime_text
        and delivery_runtime_text.index(active_policy_load_marker)
        < delivery_runtime_text.index("if active_anchor_shape:")
    ):
        errors.append(
            "inactive bootstrap delivery runtime loads the PR-B policy before active anchor validation"
        )
    check_equal(
        "mobile UX Batch 1 foundation doc-manifest dynamic transition",
        {
            "base_version_requirement": "vnext-N_with_N_at_least_9",
            "version_transition": "exact_base_vnext_N_to_head_vnext_N_plus_1",
            "active_spec_to_add": "spec/mobile-ux-batch1-governance.json",
            "insert_after": "spec/authority-map.json",
            "all_other_fields_must_equal_bootstrap_base": True,
        },
        batch1_delivery["foundation_state_contract"][
            "doc_manifest_transition"
        ],
    )
    check_equal(
        "mobile UX Batch 1 foundation doc-manifest transition mirror",
        batch1_delivery["foundation_state_contract"]["doc_manifest_transition"],
        batch1_architecture["foundation_state_contract"][
            "doc_manifest_transition"
        ],
    )
    check_equal(
        "mobile UX Batch 1 trusted and essential recovery closure mirror",
        batch1_delivery["trusted_code_closure"],
        batch1_architecture["trusted_code_closure"],
    )
    check_equal(
        "mobile UX Batch 1 trusted recovery closure has eleven paths",
        11,
        len(batch1_architecture["trusted_code_closure"]),
    )
    check_equal(
        "mobile UX Batch 1 trusted code policy mirror",
        batch1_delivery["trusted_code_policy"],
        batch1_architecture["trusted_code_policy"],
    )
    check_equal(
        "mobile UX Batch 1 trusted formal-approval workflow digest",
        "13e67dede95f30de747155552e43b0ef758059bd375612d59eedbe24685d2de2",
        batch1_architecture["trusted_code_policy"][
            "pull_request_target_workflow_raw_sha256"
        ],
    )
    check_equal(
        "mobile UX Batch 1 trusted pull-request gate workflow digest",
        "f1bcaa0b168646b85a21da89102b7a0540c323fe9652719557d68131485ea549",
        batch1_architecture["trusted_code_policy"][
            "pull_request_gate_workflow_raw_sha256"
        ],
    )
    for trusted_workflow_flag in [
        "pull_request_target_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes",
        "proposed_head_workflow_must_equal_trusted_base_mode_length_and_sha256",
        "pull_request_gate_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes",
        "proposed_head_pull_request_gate_workflow_must_equal_trusted_base_mode_length_and_sha256",
        "pull_request_gate_action_uses_must_be_full_commit_pinned",
    ]:
        check_equal(
            "mobile UX Batch 1 trusted workflow fail-closed field "
            + trusted_workflow_flag,
            True,
            batch1_architecture["trusted_code_policy"].get(trusted_workflow_flag),
        )
    check_equal(
        "mobile UX Batch 1 classification and validation scope source",
        "verified_base_to_exact_event_head_git_full_tree_diff",
        batch1_architecture["trusted_code_policy"].get(
            "classification_and_validation_scope_source"
        ),
    )
    check_equal(
        "mobile UX Batch 1 classification and validation rename/copy detection",
        "name_status_z_M_C_find_copies_harder_l0",
        batch1_architecture["trusted_code_policy"].get(
            "classification_and_validation_rename_copy_detection"
        ),
    )
    check_equal(
        "mobile UX Batch 1 live pull-request files usage",
        "current_filename_set_completeness_cross_check_only_against_exact_git_records",
        batch1_architecture["trusted_code_policy"].get(
            "live_pull_request_files_usage"
        ),
    )
    for trusted_classification_flag in [
        "live_pull_request_files_as_classification_or_scope_truth_forbidden",
        "event_head_sha_must_equal_fetched_commit",
        "live_pull_request_file_status_or_previous_filename_semantics_forbidden",
    ]:
        check_equal(
            "mobile UX Batch 1 trusted classification field "
            + trusted_classification_flag,
            True,
            batch1_architecture["trusted_code_policy"].get(
                trusted_classification_flag
            ),
        )
    check_equal(
        "mobile UX Batch 1 stage-separation merge integrity mirror",
        batch1_delivery["stage_separation_merge_integrity_contract"],
        batch1_architecture["stage_separation_merge_integrity_contract"],
    )
    check_equal(
        "mobile UX Batch 1 squash merge first-parent binding",
        {
            "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha": True,
        },
        batch1_architecture["stage_separation_merge_integrity_contract"],
    )
    check_equal(
        "mobile UX Batch 1 protected current-run approval mirror",
        batch1_delivery["protected_current_run_approval_contract"],
        batch1_architecture["protected_current_run_approval_contract"],
    )
    check_equal(
        "mobile UX Batch 1 protected current-run approval contract",
        {
            "current_run_approval_only_first_attempt_supported": True,
            "current_run_approval_comment_contract": "approve <decision_class> PR #<number> head <40sha>",
            "current_run_approval_comment_comparison": "exact_utf8_string_no_trim_case_fold_or_space_normalization",
            "current_run_failure_reapproval_policy": "new_pull_request_event_run_and_new_environment_approval_required_rerun_cannot_reuse_attempt_1_approval",
        },
        batch1_architecture["protected_current_run_approval_contract"],
    )
    check_equal(
        "mobile UX Batch 1 activation current-run failure policy mirror",
        batch1_delivery["activation_current_run_revalidation_failure_policy"],
        batch1_architecture[
            "activation_current_run_revalidation_failure_policy"
        ],
    )
    check_equal(
        "mobile UX Batch 1 activation current-run failure policy",
        "missing_mixed_wrong_attempt_noncanonical_comment_or_unverifiable_fails_closed",
        batch1_architecture[
            "activation_current_run_revalidation_failure_policy"
        ],
    )
    check_equal(
        "mobile UX Batch 1 activation decision-class mirror",
        batch1_delivery["activation_decision_class_contract"],
        batch1_architecture["activation_decision_class_contract"],
    )
    check_equal(
        "mobile UX Batch 1 activation artifact and workflow decision classes",
        {
            "artifact_required_decision_class": "schema_definition",
            "workflow_required_decision_class": "governance_foundation",
        },
        batch1_architecture["activation_decision_class_contract"],
    )
    check_equal(
        "mobile UX Batch 1 recovery contract mirror",
        batch1_delivery["governance_recovery_contract"],
        batch1_architecture["governance_recovery_contract"],
    )
    check_equal(
        "mobile UX Batch 1 recovery states",
        ["inactive_initial", "inactive_bootstrap_installed", "active", "revoked"],
        batch1_architecture["governance_recovery_contract"]["states"],
    )
    check_equal(
        "mobile UX Batch 1 recovery operations",
        {
            "bootstrap_maintenance": "inactive_bootstrap_installed_to_inactive_bootstrap_installed",
            "active_maintenance": "active_to_active",
            "revoked_recovery": "revoked_to_revoked",
            "revoke_active_governance": "active_to_revoked",
            "rebootstrap_same_policy": "revoked_to_active",
        },
        batch1_architecture["governance_recovery_contract"]["operations"],
    )
    check_equal(
        "mobile UX Batch 1 recovery decision classes",
        [
            "governance_maintenance",
            "governance_revocation",
            "governance_rebootstrap",
        ],
        batch1_architecture["governance_recovery_contract"]["decision_classes"],
    )
    check_equal(
        "mobile UX Batch 1 owned anchor projection",
        [
            "authority_map_mobile_ux_batch1_governance_domain",
            "agent_harness_mobile_ux_batch1_read_path",
            "agent_harness_mobile_ux_batch1_governance_policy",
            "agent_harness_mobile_ux_batch1_compaction_anchor_count",
            "doc_manifest_mobile_ux_batch1_policy_count",
            "agents_mobile_ux_batch1_governance_heading_count",
            "agents_mobile_ux_batch1_activation_line_counts",
        ],
        batch1_architecture["governance_recovery_contract"][
            "anchor_owned_projection"
        ],
    )
    check_equal(
        "mobile UX Batch 1 B2 nonclaim mirror",
        batch1_delivery["B2_validation_nonclaim"],
        batch1_architecture["B2_validation_nonclaim"],
    )
    check_equal(
        "mobile UX Batch 1 timeless owned-anchor shape mirror",
        batch1_delivery["timeless_anchor_shape_contract"],
        batch1_architecture["timeless_anchor_shape_contract"],
    )
    check_equal(
        "mobile UX Batch 1 global versions never derive governance state",
        True,
        batch1_architecture["timeless_anchor_shape_contract"][
            "global_versions_must_not_derive_batch1_state"
        ],
    )
    check_equal(
        "mobile UX Batch 1 inactive anchors require trusted lineage to distinguish installed from revoked",
        True,
        batch1_architecture["timeless_anchor_shape_contract"][
            "inactive_installed_vs_revoked_state_requires_trusted_lineage_proof"
        ],
    )
    for inactive_policy_loading_field in [
        "inactive_bootstrap_validation_uses_timeless_tracked_mirrors_without_loading_pr_b_canonical_artifacts",
        "active_policy_equality_loaded_only_when_active_anchor_shape_and_tracked_policy_exist",
    ]:
        check_equal(
            "mobile UX Batch 1 policy loading boundary "
            + inactive_policy_loading_field,
            True,
            batch1_architecture["timeless_anchor_shape_contract"].get(
                inactive_policy_loading_field
            ),
        )
    check_equal(
        "mobile UX Batch 1 caller boolean cannot select authority state",
        False,
        batch1_architecture["timeless_anchor_shape_contract"][
            "caller_boolean_may_select_authority_state"
        ],
    )
    check_equal(
        "mobile UX Batch 1 non-owned anchor bytes may evolve",
        True,
        batch1_architecture["timeless_anchor_shape_contract"][
            "non_batch1_fields_and_bytes_may_evolve"
        ],
    )
    check_equal(
        "mobile UX Batch 1 synthetic anchor transition regressions have no gate effect",
        "none",
        batch1_architecture["timeless_anchor_shape_contract"][
            "synthetic_transition_gate_effect"
        ],
    )
    recovery_contract = batch1_architecture["governance_recovery_contract"]
    check_equal(
        "mobile UX Batch 1 formal-approval workflow absent from v1 maintenance allowlist",
        False,
        ".github/workflows/formal-approval.yml"
        in recovery_contract["maintenance_exact_allowlist_paths"],
    )
    check_equal(
        "mobile UX Batch 1 pull-request gate workflow absent from v1 maintenance allowlist",
        False,
        ".github/workflows/pr-gates.yml"
        in recovery_contract["maintenance_exact_allowlist_paths"],
    )
    check_equal(
        "mobile UX Batch 1 bootstrap-installed kernel snapshots",
        {
            "closure_artifacts_at_bootstrap_merge": "exact_essential_recovery_kernel_paths_tracked_regular_100644_nonempty",
            "closure_artifacts_at_trusted_base": "exact_essential_recovery_kernel_paths_tracked_regular_100644_nonempty",
            "byte_equality_between_snapshots_required": False,
            "later_addition_after_bootstrap_merge_cannot_satisfy_bootstrap_installation": True,
        },
        recovery_contract.get("bootstrap_installed_proof_kernel_snapshots"),
    )
    check_equal(
        "mobile UX Batch 1 bootstrap materialization required base SHA",
        "7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47",
        recovery_contract.get("bootstrap_materialization_required_pull_request_base_sha"),
    )
    check_equal(
        "mobile UX Batch 1 anchor documents transition independently from their own versions",
        "each_base_vnext_N_to_head_vnext_N_plus_1_independently",
        recovery_contract.get("anchor_document_version_transition"),
    )
    check_equal(
        "mobile UX Batch 1 cross-document version parity is not required",
        False,
        recovery_contract.get(
            "cross_document_version_parity_or_fixed_activation_version_required"
        ),
    )
    check_equal(
        "mobile UX Batch 1 lineage enumeration uses complete trusted-base history",
        "complete_trusted_base_git_history_not_current_tree_only",
        recovery_contract.get("lineage_enumeration_source"),
    )
    for recovery_integrity_field in [
        "bootstrap_remote_landing_base_must_equal_required_base_sha",
        "bootstrap_required_base_must_be_direct_first_parent_of_materialization_merge",
        "maintenance_allowlist_payload_without_exact_recovery_pair_forbidden",
        "formal_approval_workflow_maintenance_in_v1_forbidden",
        "pull_request_gate_workflow_maintenance_in_v1_forbidden",
        "all_mobile_ux_batch1_run_records_are_permanently_sensitive_and_add_only",
        "standalone_historical_decision_or_run_record_modify_delete_copy_or_rename_fails_closed",
        "foundation_activation_and_every_recovery_lineage_event_require_unique_add_introduction",
        "every_lineage_event_requires_unique_associated_merged_same_repository_main_pull_request",
        "every_lineage_event_requires_approved_head_tree_equal_merge_tree_and_merge_reachable_from_trusted_base",
        "every_lineage_decision_and_run_record_merge_bytes_must_equal_current_trusted_base_mode_length_and_sha256",
        "historical_recovery_decision_or_run_record_delete_copy_or_rename_invalidates_state",
        "transition_commits_after_terminal_event_must_be_recomputed_and_empty",
        "foundation_lineage_event_must_replay_exact_eight_path_scope_three_immutable_hashes_dynamic_anchor_transition_and_stable_run_record",
        "terminal_lineage_event_must_match_derived_anchor_state",
        "current_run_protected_owner_approval_revalidation_required",
        "full_anchor_file_byte_freeze_after_revocation_forbidden",
        "revoked_state_rejects_mobile_ux_batch1_successor_receipt_execution_and_authority_decision_use",
        "revoked_state_allows_unrelated_generic_sensitive_protected_changes_when_owned_projection_remains_revoked",
        "unrelated_anchor_file_fields_and_lines_may_evolve_via_generic_sensitive_protected_change_when_owned_projection_is_preserved",
    ]:
        check_equal(
            "mobile UX Batch 1 recovery fail-closed field " + recovery_integrity_field,
            True,
            recovery_contract.get(recovery_integrity_field),
        )

    runner_contract = harness_architecture_spec["runner_contract"]
    check_equal("harness runner entrypoint", "scripts/validate_harness.py", runner_contract["entrypoint"])
    check_equal(
        "harness runner implementation",
        "scripts/harness_validator/runner.py",
        runner_contract["implementation"],
    )
    check_equal("harness runner default mode", "full", runner_contract["default_mode"])
    check_equal(
        "harness runner no-argument semantics",
        "run_all_sections_and_require_remote_github_protection_read",
        runner_contract["default_no_argument_semantics"],
    )
    check_equal(
        "harness runner compatibility alias",
        "--mode local",
        runner_contract["compatibility_aliases"]["--skip-remote-guard"],
    )
    check_equal(
        "harness runner logical prerequisites",
        {
            "agent_review_regressions": ["governance_contracts"],
            "delivery_runtime": ["governance_contracts"],
        },
        runner_contract["section_dependencies"],
    )
    check_equal(
        "harness runner selection prerequisite policy",
        "declared_logical_prerequisites_are_added_and_reported_in_selected_sections",
        runner_contract["selection_dependency_policy"],
    )
    check_equal(
        "harness section interface",
        "def validate(context) -> None",
        runner_contract["section_interface"],
    )
    check_equal(
        "harness section worker execution model",
        {
            "isolation": "one_python_worker_process_per_selected_section",
            "default_timeout_seconds": 30,
            "timeout_behavior": "terminate_worker_process_group_record_timeout_finding_and_continue",
            "worker_protocol": "json_errors_exception_and_remote_guard_execution",
        },
        runner_contract["execution_model"],
    )
    check_equal(
        "harness read-only context profile",
        {
            "sections": [
                "prelude",
                "truth_mirrors",
                "harness_architecture",
                "product_contract_mirrors",
                "visual_language",
                "workspace_boundary",
                "governance_contracts",
                "agent_run_record",
                "design_contracts",
            ],
            "capabilities": [
                "read_repository_files",
                "load_specs",
                "record_findings",
            ],
        },
        runner_contract["context_profiles"]["read_only"],
    )
    check_equal(
        "harness delivery context profile",
        {
            "sections": ["delivery_runtime"],
            "capabilities": [
                "allowlisted_git_reads",
                "github_api_get",
                "allowlisted_local_validator",
                "isolated_temporary_directory",
            ],
        },
        runner_contract["context_profiles"]["delivery"],
    )
    check_equal(
        "harness fixture context profile",
        {
            "sections": [
                "mobile_metadata_regressions",
                "design_metadata_regressions",
                "design_search_regressions",
                "agent_review_regressions",
                "pr_design_gate_regressions",
            ],
            "capabilities": [
                "isolated_system_temporary_directory",
                "section_exact_local_validator_allowlist",
                "controlled_fixture_copy_and_removal",
                "pr_body_only_environment_override",
                "no_remote_or_repository_mutation",
            ],
        },
        runner_contract["context_profiles"]["fixture"],
    )
    check_equal(
        "harness capability enforcement",
        {
            "implementations": [
                "scripts/harness_validator/context.py",
                "scripts/harness_validator/capability_ast.py",
                "scripts/harness_validator/runtime_policy.py",
            ],
            "runtime_context_profiles_enforced": True,
            "read_only_profile_forbidden_imports_and_calls": True,
            "read_only_ast_import_allowlist": ["__future__", "json", "re"],
            "read_only_runtime_audit_blocks": [
                "file_write",
                "filesystem_mutation",
                "process_execution",
                "network_access",
                "dynamic_code_execution",
                "non_allowlisted_import",
            ],
            "all_sections_explicit_validate_context": True,
            "direct_process_network_and_temp_imports_forbidden": True,
            "repository_derived_fixture_writes_forbidden": True,
            "exec_calls_forbidden": True,
            "github_api_get_full_mode_only": True,
            "runtime_smoke_sections_forbidden": True,
            "executable_top_level_statements_forbidden": True,
            "validate_context_signature_required": True,
        },
        runner_contract["capability_enforcement"],
    )
    check_equal(
        "harness runner exit codes",
        {"passed": 0, "failed": 1, "invalid_arguments": 2},
        runner_contract["exit_codes"],
    )

    result_contract = runner_contract["result_contract"]
    check_equal("harness result schema", "harness-result.v1", result_contract["schema_version"])
    for required_field in [
        "schema_version",
        "status",
        "exit_code",
        "mode",
        "started_at",
        "duration_ms",
        "completeness",
        "selection",
        "summary",
        "sections",
        "findings",
    ]:
        if required_field not in result_contract["required_top_level_fields"]:
            errors.append(f"harness result contract missing top-level field: {required_field}")
    for required_field in ["layer", "section", "type", "message"]:
        if required_field not in result_contract["required_finding_fields"]:
            errors.append(f"harness result contract missing finding field: {required_field}")
    check_equal(
        "partial Harness result cannot satisfy full validation",
        True,
        result_contract["partial_pass_is_not_full_validation"],
    )
    check_equal(
        "Harness section exceptions are isolated",
        True,
        result_contract["section_exception_isolated"],
    )
    check_equal(
        "Harness section timeouts are isolated",
        True,
        result_contract["section_timeout_isolated"],
    )
    check_equal(
        "Harness capability violations are findings",
        True,
        result_contract["capability_violation_is_finding"],
    )

    local_gate_contract = harness_architecture_spec["local_gate_runner_contract"]
    check_equal(
        "local gate entrypoint",
        "scripts/run_local_gates",
        local_gate_contract["entrypoint"],
    )
    check_equal(
        "local gate implementation",
        "scripts/local_gates/runner.py",
        local_gate_contract["implementation"],
    )
    check_equal(
        "local gate supporting modules",
        [
            "scripts/local_gates/model.py",
            "scripts/local_gates/execution.py",
            "scripts/local_gates/checks.py",
            "scripts/local_gates/catalog.py",
        ],
        local_gate_contract["supporting_modules"],
    )
    check_equal(
        "local gates remain independent from validate_harness",
        True,
        local_gate_contract["independent_from_validate_harness"],
    )
    check_equal(
        "local gate profiles",
        {
            "dev": {
                "network": "forbidden_by_catalog_and_os_enforced_outbound_denial",
                "includes": [
                    "local_harness_and_harness_regressions",
                    "local_gate_runner_regressions",
                    "launch_readiness_contract",
                    "maestro_selector_contract",
                    "mobile_metadata_lint_typecheck_and_jest",
                    "backend_contract_tests",
                ],
            },
            "pr": {
                "extends": "dev",
                "requires_unique_current_pull_request": True,
                "includes": [
                    "full_remote_harness",
                    "real_pull_request_body_gates",
                    "dependency_security_with_visible_exceptions",
                    "strict_local_and_remote_repository_health",
                    "git_lfs_fsck",
                    "remote_agent_evidence_validation",
                ],
            },
            "release": {
                "extends": "pr",
                "platform": "macos_only",
                "includes": [
                    "ruby_and_bundler_preflight",
                    "cocoapods_deployment_lock",
                    "release_simulator_build",
                    "unsigned_release_archive",
                ],
            },
        },
        local_gate_contract["profiles"],
    )
    check_equal(
        "local gate CLI",
        [
            "--profile dev|pr|release",
            "--base <ref>",
            "--pr <number>",
            "--output <path>",
            "--verbose",
            "--fail-fast",
        ],
        local_gate_contract["cli"],
    )
    check_equal(
        "local gate execution contract",
        {
            "collect_all_by_default": True,
            "dependency_staged_parallelism": True,
            "fail_fast_is_diagnostic_only": True,
            "fail_fast_cannot_produce_complete_pass": True,
            "explicit_timeout_per_gate": True,
            "timeout_terminates_process_group": True,
            "timeout_cleanup_sequence": "sigterm_grace_then_unconditional_process_group_sigkill",
            "gate_exception_isolated": True,
            "network_false_gate_requires_os_isolation": True,
            "tracked_worktree_must_be_unchanged": True,
        },
        local_gate_contract["execution"],
    )
    check_equal(
        "local gate toolchains",
        {
            "python": "3.12.x",
            "node": "22.13.0",
            "ruby": "3.3.x",
            "dev_compatible_node_drift": "passed_with_exception",
            "pr_and_release_drift": "failed",
        },
        local_gate_contract["toolchains"],
    )
    check_equal(
        "local gate output policy",
        {
            "root": "exports/local-gates/",
            "root_is_ignored": True,
            "logs_are_redacted": True,
            "arguments_are_redacted": True,
            "environment_values_are_redacted": True,
            "raw_pull_request_body_is_not_persisted": True,
        },
        local_gate_contract["output_policy"],
    )
    local_result_contract = local_gate_contract["result_contract"]
    check_equal(
        "local gate report schema",
        "local-gate-report.v1",
        local_result_contract["schema_version"],
    )
    check_equal(
        "local gate status values",
        ["passed", "passed_with_exception", "failed", "skipped", "deferred"],
        local_result_contract["status_values"],
    )
    for required_field in [
        "schema_version",
        "profile",
        "status",
        "exit_code",
        "complete",
        "head",
        "base",
        "pull_request",
        "toolchain",
        "network_isolation",
        "workspace",
        "safe_exceptions",
        "remote_checks",
        "summary",
        "gates",
        "formal_state_updates",
    ]:
        if required_field not in local_result_contract["required_top_level_fields"]:
            errors.append(f"local gate result contract missing top-level field: {required_field}")
    check_equal(
        "deferred local gates cannot satisfy PR or release",
        True,
        local_result_contract["deferred_cannot_satisfy_pr_or_release"],
    )
    check_equal(
        "dependency exceptions remain visible",
        True,
        local_result_contract[
            "dependency_exception_must_expose_severity_and_vulnerability_counts"
        ],
    )
    check_equal(
        "local gate formal state boundaries",
        {
            "may_update_pull_request_review": False,
            "may_update_content_approval": False,
            "may_update_launch_readiness": False,
            "may_replace_github_required_checks": False,
        },
        local_gate_contract["formal_state_boundaries"],
    )

    local_gate_entrypoint = ROOT / local_gate_contract["entrypoint"]
    local_gate_implementation_paths = [
        ROOT / local_gate_contract["implementation"],
        *(ROOT / path for path in local_gate_contract["supporting_modules"]),
    ]
    local_gate_test = ROOT / "scripts/test_run_local_gates.py"
    for path in [local_gate_entrypoint, *local_gate_implementation_paths, local_gate_test]:
        if not path.exists():
            errors.append(f"missing local gate implementation artifact: {path.relative_to(ROOT)}")
    if local_gate_entrypoint.exists():
        check_contains(
            "local gate executable entrypoint",
            local_gate_entrypoint.read_text(encoding="utf-8"),
            "from local_gates.runner import main",
        )
    if all(path.exists() for path in local_gate_implementation_paths):
        local_gate_text = "\n".join(
            path.read_text(encoding="utf-8") for path in local_gate_implementation_paths
        )
        for snippet in [
            'SCHEMA_VERSION = "local-gate-report.v1"',
            "ThreadPoolExecutor",
            "network_isolation_prefix",
            "os.killpg",
            "resolve_pr_context",
            "evaluate_dependency_report",
            "tracked_snapshot",
            '"formal_state_updates"',
            "validate_report_contract",
            "validate_base_ref",
            'EXPORT_ROOT = ROOT / "exports" / "local-gates"',
        ]:
            check_contains("local gate implementation contract", local_gate_text, snippet)
    if local_gate_test.exists():
        local_gate_test_text = local_gate_test.read_text(encoding="utf-8")
        for snippet in [
            "test_unknown_argument_and_invalid_pr_exit_two",
            "test_dev_profile_has_no_network_gate",
            "test_multiple_gate_failures_are_collected_and_schema_is_stable",
            "test_report_contract_rejects_missing_fields_and_unknown_status",
            "test_base_ref_rejects_option_and_control_character_injection",
            "test_fail_fast_flag_never_produces_complete_pass_even_without_failure",
            "test_gate_exception_is_isolated_from_later_gate",
            "test_timeout_terminates_the_process_group",
            "test_supported_network_isolation_blocks_outbound_socket",
            "test_network_false_gate_defers_when_os_isolation_is_missing",
            "test_network_isolation_preflight_fails_closed_without_supported_mechanism",
            "test_logs_redact_sensitive_arguments_environment_and_output",
            "test_missing_executable_is_a_missing_toolchain_finding",
            "test_remote_unavailable_is_an_attributed_pr_context_finding",
            "test_missing_unique_pr_context_fails_closed",
            "test_pr_context_rejects_malformed_remote_fields_and_stale_base",
            "test_pending_agent_review_and_missing_pr_body_fail_real_pr_gate",
            "test_pr_catalog_delegates_oversized_blob_and_untracked_evidence_failures_to_strict_health",
            "test_dependency_exceptions_remain_visible_in_report_state",
            "test_tracked_snapshot_detects_and_preserves_user_changes",
            "test_local_gate_modules_have_bounded_ownership",
        ]:
            check_contains("local gate runner unit coverage", local_gate_test_text, snippet)

    architecture_mirrors = authority["domains"]["harness_architecture"]["mirrors"]
    for mirror in [
        "scripts/run_local_gates",
        "scripts/local_gates/runner.py",
        "scripts/local_gates/model.py",
        "scripts/local_gates/execution.py",
        "scripts/local_gates/checks.py",
        "scripts/local_gates/catalog.py",
    ]:
        if mirror not in architecture_mirrors:
            errors.append(f"harness architecture authority mirrors missing {mirror}")

    for output in [
        "independent_local_quality_entrypoint",
        "dev_pr_release_gate_profiles",
        "local_gate_report_v1",
        "redacted_ignored_local_gate_outputs",
        "tracked_worktree_integrity_after_local_gates",
    ]:
        if output not in harness["task_briefs"]["harness_architecture"]["outputs"]:
            errors.append(f"agent harness architecture outputs missing {output}")

    delivery_local_feedback = delivery["pull_request_contract"]["local_quality_feedback"]
    check_equal(
        "delivery local gate architecture owner",
        "spec/harness-architecture.json#local_gate_runner_contract",
        delivery_local_feedback["architecture_owner"],
    )
    check_equal(
        "local gates cannot replace GitHub checks",
        False,
        delivery_local_feedback["may_replace_required_github_checks"],
    )
    check_equal(
        "local gates cannot update formal states",
        False,
        delivery_local_feedback[
            "may_update_agent_review_or_formal_approval_or_launch_readiness"
        ],
    )

    gt27 = find_by_id(evals["golden_tasks"], "GT-27")
    if not gt27:
        errors.append("evals must define GT-27 local quality entrypoint coverage")
    else:
        for marker in [
            "dev_profile_has_no_remote_gate",
            "deferred_cannot_satisfy_pr_or_release",
            "tracked_worktree_unchanged",
            "github_required_checks_remain_authoritative",
        ]:
            if marker not in gt27["must_include"]:
                errors.append(f"GT-27 missing local quality marker: {marker}")

    workflow_text = (ROOT / ".github/workflows/pr-gates.yml").read_text(encoding="utf-8")
    check_contains(
        "CI runs local gate runner tests",
        workflow_text,
        "python3 scripts/test_run_local_gates.py",
    )

    if "spec/harness-architecture.json" not in manifest["active_specs"]:
        errors.append("doc manifest active_specs must include spec/harness-architecture.json")

    architecture_domain = authority["domains"].get("harness_architecture")
    if not architecture_domain:
        errors.append("authority map must define harness_architecture")
    else:
        check_equal(
            "harness architecture owner",
            "spec/harness-architecture.json",
            architecture_domain.get("owner"),
        )

    layer_ids = [layer["id"] for layer in harness_architecture_spec["layers"]]
    for required_layer in [
        "bootstrap_layer",
        "truth_spec_layer",
        "workspace_hygiene_layer",
        "delivery_governance_layer",
        "design_governance_layer",
        "runtime_smoke_layer",
    ]:
        if required_layer not in layer_ids:
            errors.append(f"harness architecture missing layer: {required_layer}")

    section_order = []
    section_owners = {}
    for layer in harness_architecture_spec["layers"]:
        for section in layer.get("sections", []):
            section_order.append(section)
            if section in section_owners:
                errors.append(
                    f"harness section {section} assigned to multiple layers: "
                    f"{section_owners[section]} and {layer['id']}"
                )
            section_owners[section] = layer["id"]

    check_equal(
        "harness architecture runner_section_order",
        harness_architecture_spec["runner_section_order"],
        section_order,
    )

    runner_text = (ROOT / "scripts/harness_validator/runner.py").read_text(encoding="utf-8")
    for snippet in [
        "HARNESS_LAYERS",
        "bootstrap_layer",
        "truth_spec_layer",
        "workspace_hygiene_layer",
        "delivery_governance_layer",
        "design_governance_layer",
        "runtime_smoke_layer",
        "_iter_sections",
        "parse_args",
        "resolve_sections",
        "SECTION_DEPENDENCIES",
        "DEFAULT_SECTION_TIMEOUT_SECONDS = 30.0",
        "subprocess.Popen",
        "os.killpg",
        "validate_section_module",
        "run_harness",
        "harness-result.v1",
        "check_failure",
        "exception",
        "HARNESS COMPLETENESS PARTIAL",
        "remote_guard_executed",
    ]:
        check_contains("harness runner layered architecture", runner_text, snippet)

    runner_test_path = ROOT / "scripts/test_validate_harness_runner.py"
    if not runner_test_path.exists():
        errors.append("missing Harness runner unit test: scripts/test_validate_harness_runner.py")
    else:
        runner_test_text = runner_test_path.read_text(encoding="utf-8")
        for snippet in [
            "test_unknown_argument_and_conflicting_remote_modes_exit_two",
            "test_section_exception_does_not_hide_later_diagnostics",
            "test_multiple_module_errors_are_attributed_to_their_section",
            "test_section_error_lists_are_isolated",
            "test_section_timeout_is_attributed_and_later_sections_still_run",
            "test_worker_start_error_is_attributed_for_every_selected_section",
            "test_pure_section_capability_violation_fails_before_execution",
            "test_read_only_worker_runtime_blocks_obfuscated_file_write",
            "test_read_only_worker_runtime_blocks_obfuscated_process_network_and_dynamic_code",
            "test_read_only_runtime_policy_blocks_socket_creation",
            "test_remote_guard_aggregation_never_leaks_worker_protocol_fields",
            "test_section_selection_expands_declared_logical_prerequisites",
            "test_json_result_has_stable_schema_and_structured_findings",
            "test_local_mode_is_injected_without_remote_guard_access",
            "test_local_cli_does_not_invoke_gh_and_full_reports_unavailable_github",
            "test_full_cli_rejects_disabled_repository_auto_merge",
            "test_partial_cli_commands_cannot_satisfy_full_pr_validation",
        ]:
            check_contains("Harness runner unit coverage", runner_test_text, snippet)

    for section in harness_architecture_spec["runner_section_order"]:
        section_file = ROOT / "scripts/harness_validator/sections" / f"{section}.py"
        if not section_file.exists():
            errors.append(f"harness architecture references missing section: {section}")
        else:
            check_contains(
                f"Harness section {section} explicit interface",
                section_file.read_text(encoding="utf-8"),
                "def validate(context) -> None:",
            )

    implementation_snippets = {
        "scripts/harness_validator/context.py": [
            "class ReadOnlyContext",
            "class DeliveryContext",
            "class FixtureContext",
            "section == \"delivery_runtime\"",
            "FIXTURE_SECTION_LAYERS.get(section) == layer",
            "GitHub command cannot execute outside full mode",
            "delivery command is not allowlisted",
            "validator is not allowlisted",
            "path is outside active fixture roots",
        ],
        "scripts/harness_validator/capability_ast.py": [
            "READ_ONLY_SECTIONS",
            "READ_ONLY_ALLOWED_IMPORTS",
            "FIXTURE_SECTION_OWNERS",
            "runtime_smoke_layer is delegated to CI",
            "section imports forbidden direct capability",
            "section mutates a repository-derived path",
            "executable top-level statement is forbidden",
        ],
        "scripts/harness_validator/section_worker.py": [
            "load_validate",
            "policy_for_context(context).enforce()",
            '"remote_guard_executed": context.remote_guard_executed',
        ],
        "scripts/harness_validator/runtime_policy.py": [
            "class ReadOnlyRuntimePolicy",
            "sys.addaudithook",
            "read-only Harness section attempted a file write",
            "read-only Harness section attempted process execution",
            "read-only Harness section attempted network access",
            "read-only Harness section attempted dynamic code execution",
        ],
    }
    for relative_path, snippets in implementation_snippets.items():
        path = ROOT / relative_path
        if not path.exists():
            errors.append(f"missing Harness architecture implementation: {relative_path}")
            continue
        text = path.read_text(encoding="utf-8")
        for snippet in snippets:
            check_contains(f"Harness implementation {relative_path}", text, snippet)

    boundary_test_path = ROOT / "scripts/test_harness_module_boundaries.py"
    if not boundary_test_path.exists():
        errors.append("missing Harness boundary test: scripts/test_harness_module_boundaries.py")
    else:
        boundary_test_text = boundary_test_path.read_text(encoding="utf-8")
        for snippet in [
            "test_all_real_sections_have_valid_explicit_module_boundaries",
            "test_each_owned_layer_rejects_a_known_section_from_another_owner",
            "test_each_pure_layer_rejects_a_direct_capability_break",
            "test_read_only_sections_reject_alternate_file_and_process_imports",
            "test_read_only_static_and_runtime_import_allowlists_match",
            "test_delivery_layer_rejects_mutating_command_capability",
            "test_delivery_context_rejects_github_access_in_local_mode",
            "test_fixture_section_rejects_direct_remote_or_process_capabilities",
            "test_fixture_section_rejects_repository_derived_write",
            "test_fixture_section_rejects_write_without_fixture_provenance",
            "test_fixture_context_uses_system_temp_and_cleans_it",
            "test_fixture_context_rejects_unallowlisted_validator_cwd_and_env",
            "test_context_factory_moves_agent_review_regressions_to_delivery",
            "test_runtime_smoke_layer_rejects_runnable_harness_section",
            "test_executable_top_level_statement_is_rejected",
            "test_validate_signature_rejects_definition_time_execution_hooks",
            "test_read_only_context_exposes_no_command_fixture_or_temp_capability",
            "test_exec_call_does_not_exist_in_harness_runtime",
        ]:
            check_contains("Harness module boundary coverage", boundary_test_text, snippet)

    runtime_layer = next(
        (layer for layer in harness_architecture_spec["layers"] if layer["id"] == "runtime_smoke_layer"),
        None,
    )
    if runtime_layer:
        if runtime_layer.get("sections") != []:
            errors.append("runtime_smoke_layer must remain delegated to CI jobs, not validate_harness sections")
        for job in ["backend-contract", "mobile-quality", "web-quality"]:
            if job not in runtime_layer.get("ci_jobs", []):
                errors.append(f"runtime_smoke_layer missing CI job: {job}")

    architecture_task = harness["task_briefs"].get("harness_architecture")
    if not architecture_task:
        errors.append("agent harness must define harness_architecture task brief")
    else:
        for output in [
            "layer_ownership_map",
            "pure_layer_side_effect_boundary",
            "runtime_smoke_delegation",
            "structured_runner_interface",
            "harness_result_v1",
            "partial_run_completeness",
            "explicit_validate_context_modules",
            "isolated_section_workers",
            "read_only_context_capability_enforcement",
            "read_only_runtime_capability_enforcement",
            "section_timeout_isolation",
            "fixture_context_capability_enforcement",
            "zero_legacy_exec_paths",
        ]:
            if output not in architecture_task.get("outputs", []):
                errors.append(f"harness_architecture task brief missing output: {output}")

    for anti_pattern_id in ["AP-37", "AP-38", "AP-42"]:
        if not find_by_id(harness["anti_patterns"], anti_pattern_id):
            errors.append(f"agent harness missing harness architecture anti-pattern: {anti_pattern_id}")

    if not find_by_id(harness_architecture_spec["anti_patterns"], "HA-AP-04"):
        errors.append("harness architecture missing partial-result anti-pattern: HA-AP-04")
    if not find_by_id(harness_architecture_spec["anti_patterns"], "HA-AP-05"):
        errors.append("harness architecture missing isolated-module anti-pattern: HA-AP-05")
    if not find_by_id(harness_architecture_spec["anti_patterns"], "HA-AP-06"):
        errors.append("harness architecture missing fixture-boundary anti-pattern: HA-AP-06")
    if not find_by_id(harness_architecture_spec["anti_patterns"], "HA-AP-07"):
        errors.append("harness architecture missing runtime-boundary anti-pattern: HA-AP-07")

    for regression_id in ["HR-31", "HR-32"]:
        if not find_by_id(evals["regressions"], regression_id):
            errors.append(f"evals missing harness architecture regression: {regression_id}")

    golden_task = find_by_id(evals["golden_tasks"], "GT-24")
    if not golden_task:
        errors.append("evals missing harness architecture golden task: GT-24")
    else:
        for expected in [
            "structured_runner_interface",
            "harness_result_v1",
            "partial_result_cannot_satisfy_full_validation",
            "section_exception_isolated_with_remaining_diagnostics",
            "explicit_validate_context_modules",
            "isolated_section_worker_processes",
            "section_timeout_isolated_with_remaining_diagnostics",
            "ast_enforced_read_only_capability_boundary",
            "runtime_audit_enforced_read_only_capability_boundary",
            "ast_enforced_fixture_capability_boundary",
            "zero_legacy_exec_paths",
        ]:
            if expected not in golden_task["must_include"]:
                errors.append(f"GT-24 missing structured runner expectation: {expected}")

    runner_regression = find_by_id(evals["regressions"], "HR-31")
    if runner_regression:
        for expected in [
            "no_argument_runner_executes_full_remote_validation",
            "local_or_selected_runner_reports_partial_completeness",
            "section_exception_does_not_suppress_later_diagnostics",
            "all_sections_export_validate_context",
            "each_selected_section_runs_in_an_isolated_worker",
            "section_timeout_is_attributed_and_does_not_suppress_later_diagnostics",
            "agent_review_regressions_belong_to_delivery_governance",
            "zero_legacy_exec_paths",
        ]:
            if expected not in runner_regression["must_hit"]:
                errors.append(f"HR-31 missing structured runner expectation: {expected}")

    capability_regression = find_by_id(evals["regressions"], "HR-32")
    if capability_regression:
        for expected in [
            "pure_layers_no_subprocess_or_remote_reads",
            "read_only_context_and_ast_capability_enforcement",
            "read_only_context_ast_and_runtime_audit_enforcement",
            "fixture_context_exact_validator_and_system_temp_enforcement",
            "runtime_tests_stay_in_ci_jobs",
        ]:
            if expected not in capability_regression["must_hit"]:
                errors.append(f"HR-32 missing capability-boundary expectation: {expected}")
