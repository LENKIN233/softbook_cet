from __future__ import annotations

import re


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    check_equal = context.check_equal
    check_contains = context.check_contains
    find_by_id = context.find_by_id
    harness = context.load("agent-harness.json")
    authority_map = context.load("authority-map.json")
    harness_architecture = context.load("harness-architecture.json")
    delivery = context.load("repo-delivery-contract.json")
    evals = context.load("evals.json")
    doc_manifest = context.load("doc-manifest.json")
    perturbation_audit = context.load("perturbation-audit.json")
    workflow_text = (ROOT / ".github/workflows/pr-gates.yml").read_text(
        encoding="utf-8"
    )
    local_gate_catalog_text = (
        ROOT / "scripts/local_gates/catalog.py"
    ).read_text(encoding="utf-8")
    agent_entrypoint_text = (ROOT / "AGENTS.md").read_text(encoding="utf-8")

    # Governance contract must stay explicit across harness, evals, drift guards, and active agent docs.
    main_branch_policy = harness["governance"]["main_branch_policy"]
    local_guard = harness["governance"]["local_guard"]
    remote_guard = harness["governance"]["remote_guard"]
    repo_delivery_contract = harness["governance"]["repo_delivery_contract"]
    external_content_workspace = harness["governance"]["external_content_workspace"]
    delivery_defaults = delivery["delivery_defaults"]["code_change_tasks"]
    pull_request_contract = delivery["pull_request_contract"]
    card_content_handoff_gate = pull_request_contract["card_content_handoff_gate"]
    ci_contract = delivery["ci_contract"]
    formal_approval_gate = ci_contract["formal_approval_gate"]
    batch1_governance_bootstrap = ci_contract[
        "mobile_ux_batch1_governance_bootstrap"
    ]
    batch1_governance_validation = harness_architecture[
        "mobile_ux_batch1_governance_validation_contract"
    ]
    batch1_activation_paths = [
        "AGENTS.md",
        "docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md",
        "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md",
        "spec/agent-harness.json",
        "spec/authority-map.json",
        "spec/doc-manifest.json",
        "spec/mobile-ux-batch1-governance.json",
        "spec/mobile-ux-batch1-resolved-requirement.schema.json",
    ]
    batch1_agent_entrypoint_snippets = [
        "- `spec/mobile-ux-batch1-governance.json`（仅在 Mobile UX Batch 1 治理、受保护决策、R0 / D1 / B2 / F3 或对应回执任务中读取；只拥有仓库治理机制，全部产品、视觉、实现、原生、发布与领导验收权限仍为 false）",
        "- Mobile UX Batch 1 治理 / 受保护决策：`authority-map -> mobile-ux-batch1-governance -> agent-harness -> repo-delivery-contract -> harness-architecture -> evals`",
        "- 不要把 Mobile UX Batch 1 governance foundation、R0 / D1 / B2 / F3 intent、receipt 或 successor validation 当作产品、视觉、实现、原生、发布或领导验收权限；严格以 `spec/mobile-ux-batch1-governance.json` 的 16 维 authority 与 distinct-PR stage separation 为准",
        "- 不要从待审批 PR head 加载或执行 formal-approval classifier、governance validator、GitHub evidence reader 或 successor validator；head 只能作为不受信 Git 数据读取，校验代码必须来自精确 verified base SHA",
        "- 不要在同一 PR 混合 governance foundation、Batch 1 subject、decision intent、approval receipt 或 execution manifest；没有专用授权 class 时 execution manifest 一律 fail closed",
    ]
    batch1_agent_governance_heading = "## Mobile UX Batch 1 治理"
    batch1_authority_keys = [
        "freeze",
        "reservation_activation",
        "manifest_creation",
        "provision",
        "execution",
        "evidence",
        "data_manifest_population",
        "aggregation",
        "promotion",
        "architecture_acceptance",
        "checkpoint_coverage",
        "visual",
        "implementation",
        "native",
        "release",
        "leadership_readiness",
    ]
    batch1_decision_classes = [
        "ordinary",
        "generic_sensitive",
        "governance_foundation",
        "batch1_subject_change",
        "legacy_receipt_migration_intent",
        "cohort_designation_intent",
        "manifest_freeze_intent",
        "receipt_materialization",
        "governance_maintenance",
        "governance_revocation",
        "governance_rebootstrap",
    ]
    batch1_trusted_code_closure = [
        ".github/workflows/formal-approval.yml",
        ".github/workflows/pr-gates.yml",
        "scripts/classify_formal_approval_scope.mjs",
        "scripts/lib/strict_json.mjs",
        "scripts/lib/mobile_ux_batch1_github_event_reader.mjs",
        "scripts/lib/mobile_ux_batch1_governance_contract.mjs",
        "scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs",
        "scripts/lib/mobile_ux_batch1_successor_contract.mjs",
        "scripts/validate_mobile_ux_batch1_governance.mjs",
        "scripts/validate_mobile_ux_batch1_successor.mjs",
        "spec/mobile-ux-batch1-governance-recovery-decision.schema.json",
    ]
    batch1_trusted_code_policy = {
        "trusted_code_closure_paths": batch1_trusted_code_closure,
        "pull_request_target_base_checkout_required": True,
        "workflow_classifier_and_validator_must_be_loaded_from_verified_base_sha": True,
        "workflow_classifier_and_validator_base_blob_modes_and_raw_sha256_must_be_recomputed": True,
        "decision_head_artifacts_may_be_read_as_untrusted_data_only": True,
        "decision_head_code_execution_forbidden": True,
        "intent_or_receipt_supplied_trusted_base_forbidden": True,
        "trusted_base_must_be_ancestor_of_approval_target_head": True,
        "missing_or_unverifiable_trusted_base_blob_fails_closed": True,
        "pull_request_target_action_uses_must_be_full_commit_pinned": True,
        "pull_request_target_permissions_must_be_exact_read_only": True,
        "pull_request_target_job_and_step_structure_must_match_trusted_contract": True,
        "pull_request_target_workflow_raw_sha256": "13e67dede95f30de747155552e43b0ef758059bd375612d59eedbe24685d2de2",
        "pull_request_target_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes": True,
        "proposed_head_workflow_must_equal_trusted_base_mode_length_and_sha256": True,
        "pull_request_gate_workflow_raw_sha256": "176669820888a9f4d109740a447175ab3ef99c1dc351642f3a665266867c81a0",
        "pull_request_gate_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes": True,
        "proposed_head_pull_request_gate_workflow_must_equal_trusted_base_mode_length_and_sha256": True,
        "pull_request_gate_action_uses_must_be_full_commit_pinned": True,
        "classification_and_validation_scope_source": "verified_base_to_exact_event_head_git_full_tree_diff",
        "classification_and_validation_rename_copy_detection": "name_status_z_M_C_find_copies_harder_l0",
        "live_pull_request_files_as_classification_or_scope_truth_forbidden": True,
        "live_pull_request_file_status_or_previous_filename_semantics_forbidden": True,
        "event_head_sha_must_equal_fetched_commit": True,
        "live_pull_request_files_usage": "current_filename_set_completeness_cross_check_only_against_exact_git_records",
    }
    batch1_stage_separation_merge_integrity_contract = {
        "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha": True,
    }
    batch1_protected_current_run_approval_contract = {
        "current_run_approval_only_first_attempt_supported": True,
        "current_run_approval_comment_contract": "approve <decision_class> PR #<number> head <40sha>",
        "current_run_approval_comment_comparison": "exact_utf8_string_no_trim_case_fold_or_space_normalization",
        "current_run_failure_reapproval_policy": "new_pull_request_event_run_and_new_environment_approval_required_rerun_cannot_reuse_attempt_1_approval",
    }
    batch1_activation_current_run_revalidation_failure_policy = (
        "missing_mixed_wrong_attempt_noncanonical_comment_or_unverifiable_fails_closed"
    )
    batch1_activation_decision_class_contract = {
        "artifact_required_decision_class": "schema_definition",
        "workflow_required_decision_class": "governance_foundation",
    }
    batch1_maintenance_allowlist_paths = [
        "scripts/classify_formal_approval_scope.mjs",
        "scripts/lib/strict_json.mjs",
        "scripts/lib/mobile_ux_batch1_github_event_reader.mjs",
        "scripts/lib/mobile_ux_batch1_governance_contract.mjs",
        "scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs",
        "scripts/lib/mobile_ux_batch1_successor_contract.mjs",
        "scripts/validate_mobile_ux_batch1_governance.mjs",
        "scripts/validate_mobile_ux_batch1_successor.mjs",
        "scripts/test_classify_formal_approval_scope.mjs",
        "scripts/test_mobile_ux_batch1_github_event_reader.mjs",
        "scripts/test_mobile_ux_batch1_governance_contract.mjs",
        "scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs",
        "scripts/test_mobile_ux_batch1_successor_contract.mjs",
        "scripts/test_validate_mobile_ux_batch1_governance.mjs",
        "scripts/harness_validator/sections/governance_contracts.py",
        "scripts/harness_validator/sections/delivery_runtime.py",
        "scripts/harness_validator/sections/harness_architecture.py",
        "spec/mobile-ux-batch1-governance-recovery-decision.schema.json",
        "spec/repo-delivery-contract.json",
        "spec/harness-architecture.json",
        "spec/evals.json",
    ]
    batch1_recovery_contract = {
        "schema_version": "mobile-ux-batch1-governance-recovery.v1",
        "decision_schema_path": "spec/mobile-ux-batch1-governance-recovery-decision.schema.json",
        "decision_schema_status": "trusted_kernel_data_contract_after_pr_a_merge",
        "states": [
            "inactive_initial",
            "inactive_bootstrap_installed",
            "active",
            "revoked",
        ],
        "state_derivation_source": "verified_trusted_base_git_and_remote_materialization_lineage_only",
        "caller_boolean_or_head_supplied_state_forbidden": True,
        "bootstrap_materialization_required_pull_request_base_sha": "b423d8ffb9271f0618229605797e708919eebdea",
        "bootstrap_remote_landing_base_must_equal_required_base_sha": True,
        "bootstrap_required_base_must_be_direct_first_parent_of_materialization_merge": True,
        "anchor_integrity_scope": "mobile_ux_batch1_owned_projection_only",
        "anchor_document_version_transition": "each_base_vnext_N_to_head_vnext_N_plus_1_independently",
        "cross_document_version_parity_or_fixed_activation_version_required": False,
        "anchor_owned_projection": [
            "authority_map_mobile_ux_batch1_governance_domain",
            "agent_harness_mobile_ux_batch1_read_path",
            "agent_harness_mobile_ux_batch1_governance_policy",
            "agent_harness_mobile_ux_batch1_compaction_anchor_count",
            "doc_manifest_mobile_ux_batch1_policy_count",
            "agents_mobile_ux_batch1_governance_heading_count",
            "agents_mobile_ux_batch1_activation_line_counts",
        ],
        "operations": {
            "bootstrap_maintenance": "inactive_bootstrap_installed_to_inactive_bootstrap_installed",
            "active_maintenance": "active_to_active",
            "revoked_recovery": "revoked_to_revoked",
            "revoke_active_governance": "active_to_revoked",
            "rebootstrap_same_policy": "revoked_to_active",
        },
        "decision_classes": [
            "governance_maintenance",
            "governance_revocation",
            "governance_rebootstrap",
        ],
        "dynamic_decision_path_contract": "docs/design/decisions/mobile-ux-batch1-governance-{maintenance|revocation|rebootstrap}-v1/pr-{pull_request}-{slug}.json",
        "dynamic_run_record_path_contract": "docs/agent-runs/{date}-mobile-ux-batch1-governance-{maintenance|revocation|rebootstrap}-pr-{pull_request}-{slug}.md",
        "decision_and_matching_run_record_must_be_new_tracked_regular_100644_nonempty_files": True,
        "all_mobile_ux_batch1_run_records_are_permanently_sensitive_and_add_only": True,
        "standalone_historical_decision_or_run_record_modify_delete_copy_or_rename_fails_closed": True,
        "changed_artifacts_bind_every_changed_path_except_decision_itself": True,
        "decision_artifact_binding_source": "current_run_exact_approved_head",
        "maintenance_requires_at_least_one_explicitly_allowlisted_payload": True,
        "maintenance_allowlist_payload_without_exact_recovery_pair_forbidden": True,
        "maintenance_exact_allowlist_paths": batch1_maintenance_allowlist_paths,
        "maintenance_fixture_prefix": "scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/",
        "recovery_maintenance_may_not_change_mobile_ux_batch1_anchor_projection_policy_product_ui_subject_intent_receipt_or_execution_manifest": True,
        "essential_recovery_kernel_paths": batch1_trusted_code_closure,
        "bootstrap_installed_proof_kernel_snapshots": {
            "closure_artifacts_at_bootstrap_merge": "exact_essential_recovery_kernel_paths_tracked_regular_100644_nonempty",
            "closure_artifacts_at_trusted_base": "exact_essential_recovery_kernel_paths_tracked_regular_100644_nonempty",
            "byte_equality_between_snapshots_required": False,
            "later_addition_after_bootstrap_merge_cannot_satisfy_bootstrap_installation": True,
        },
        "essential_kernel_head_requirement": "tracked_regular_100644_non_symlink_nonempty",
        "formal_approval_workflow_head_structure_must_match_trusted_contract": True,
        "formal_approval_workflow_maintenance_in_v1_forbidden": True,
        "pull_request_gate_workflow_maintenance_in_v1_forbidden": True,
        "foundation_activation_and_every_recovery_lineage_event_require_unique_add_introduction": True,
        "full_anchor_file_byte_freeze_after_revocation_forbidden": True,
        "every_lineage_event_requires_unique_associated_merged_same_repository_main_pull_request": True,
        "every_lineage_event_requires_approved_head_tree_equal_merge_tree_and_merge_reachable_from_trusted_base": True,
        "every_lineage_decision_and_run_record_merge_bytes_must_equal_current_trusted_base_mode_length_and_sha256": True,
        "lineage_enumeration_source": "complete_trusted_base_git_history_not_current_tree_only",
        "historical_recovery_decision_or_run_record_delete_copy_or_rename_invalidates_state": True,
        "transition_commits_after_terminal_event_must_be_recomputed_and_empty": True,
        "foundation_lineage_event_must_replay_exact_eight_path_scope_three_immutable_hashes_dynamic_anchor_transition_and_stable_run_record": True,
        "lineage_order": "foundation_then_zero_or_more_revocation_rebootstrap_pairs",
        "terminal_lineage_event_must_match_derived_anchor_state": True,
        "revoked_state_rejects_mobile_ux_batch1_successor_receipt_execution_and_authority_decision_use": True,
        "revoked_state_allows_unrelated_generic_sensitive_protected_changes_when_owned_projection_remains_revoked": True,
        "unrelated_anchor_file_fields_and_lines_may_evolve_via_generic_sensitive_protected_change_when_owned_projection_is_preserved": True,
        "rebootstrap_policy_mode": "reuse_exact_verified_revoked_policy_only",
        "versioned_replacement_policy_in_v1_forbidden": True,
        "current_run_protected_owner_approval_revalidation_required": True,
        "current_run_nonempty_scope_comment_required": True,
        "all_sixteen_authority_dimensions_false": True,
        "trusted_base_envelope_validation_proves": "identity_current_run_exact_scope_artifact_binding_kernel_survival_and_lineage_only",
        "trusted_base_envelope_validation_does_not_prove": "head_code_semantics_safety_or_future_operability",
        "independent_agent_review_exact_head_protected_owner_approval_and_protected_merge_required": True,
        "candidate_code_becomes_future_trusted_base_only_after_protected_merge": True,
        "external_audited_break_glass_when_kernel_cannot_execute": "required_and_not_implemented_by_repository_code",
    }
    batch1_timeless_anchor_shape_contract = {
        "global_version_requirements": {
            "authority_map": "vnext-N_with_N_at_least_4",
            "agent_harness": "vnext-N_with_N_at_least_23",
            "doc_manifest": "vnext-N_with_N_at_least_9",
        },
        "global_versions_may_evolve_independently_for_unrelated_domains": True,
        "global_versions_must_not_derive_batch1_state": True,
        "bootstrap_or_revoked_inactive_shape": "exact_batch1_owned_anchors_absent",
        "active_shape": "exact_batch1_owned_anchors_present",
        "active_activation_record_variants": "fixed_foundation_or_canonical_dynamic_rebootstrap_decision_path",
        "active_domain_and_agent_harness_activation_records_must_match": True,
        "latest_verified_activation_record_requires_trusted_lineage": True,
        "inactive_installed_vs_revoked_state_requires_trusted_lineage_proof": True,
        "inactive_bootstrap_validation_uses_timeless_tracked_mirrors_without_loading_pr_b_canonical_artifacts": True,
        "active_policy_equality_loaded_only_when_active_anchor_shape_and_tracked_policy_exist": True,
        "non_batch1_fields_and_bytes_may_evolve": True,
        "caller_boolean_may_select_authority_state": False,
        "partial_mixed_or_misaligned_shape_policy": "fail_closed",
        "formal_state_and_lineage_owner": "trusted_base_mobile_ux_batch1_governance_validator",
        "recovery_transition_global_version_behavior": "each_anchor_document_bumps_once_from_its_own_base_without_cross_document_alignment",
        "synthetic_transition_regressions": [
            "explicit_base_to_head_active_to_revoked_bumps_each_anchor_document_version_once_and_removes_only_batch1_owned_anchors",
            "explicit_base_to_head_revoked_to_active_bumps_each_anchor_document_version_once_and_restores_only_batch1_owned_anchors_with_canonical_dynamic_rebootstrap_record",
        ],
        "synthetic_transition_gate_effect": "none",
    }
    batch1_b2_validation_nonclaim = {
        "verification_scope": "descriptor_and_tracked_hash_binding_only",
        "build_recipe_executed_by_validator": False,
        "build_output_rebuilt_by_validator": False,
        "build_reproducibility_proven": False,
        "hermetic_replay_proven": False,
        "gate_effect": "none",
        "authority": "all_sixteen_dimensions_false",
    }
    batch1_recovery_nonclaims = [
        "no_product_authority",
        "no_visual_authority",
        "no_implementation_authority",
        "no_native_authority",
        "no_release_authority",
        "no_leadership_readiness_authority",
        "head_artifacts_are_untrusted_data_only",
        "trusted_base_validation_does_not_prove_head_code_semantics_safety_or_future_operability",
        "independent_agent_review_and_exact_head_protected_owner_approval_are_required",
        "candidate_code_becomes_a_trust_base_only_after_protected_merge",
    ]
    batch1_foundation_state_contract = {
        "inactive_when": "exact_authority_owner_key_absent",
        "active_when": "exact_authority_owner_and_all_activation_artifacts_validate",
        "active_authority": "governance_foundation_only_zero_downstream_authority",
        "activation_pull_request_exact_changed_paths": batch1_activation_paths,
        "doc_manifest_transition": {
            "base_version_requirement": "vnext-N_with_N_at_least_9",
            "version_transition": "exact_base_vnext_N_to_head_vnext_N_plus_1",
            "active_spec_to_add": "spec/mobile-ux-batch1-governance.json",
            "insert_after": "spec/authority-map.json",
            "all_other_fields_must_equal_bootstrap_base": True,
        },
        "active_agent_entrypoint_and_harness_mirrors_required": True,
        "active_agent_entrypoint_required_snippets": batch1_agent_entrypoint_snippets,
        "proposal_artifacts_without_exact_authority_owner_grant_authority": False,
        "repo_delivery_harness_architecture_and_evals_are_timeless": True,
        "unknown_partial_or_extra_state_policy": "fail_closed",
    }
    batch1_authority_owner = {
        "owner": "spec/mobile-ux-batch1-governance.json",
        "protected_activation_record": "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md",
        "status": "active_repo_governance_truth",
        "mirrors": [
            "AGENTS.md",
            "spec/agent-harness.json",
            "spec/doc-manifest.json",
            "spec/repo-delivery-contract.json",
            "spec/harness-architecture.json",
            "spec/evals.json",
        ],
        "implementation_surfaces": [
            ".github/workflows/formal-approval.yml",
            "scripts/classify_formal_approval_scope.mjs",
            "scripts/validate_mobile_ux_batch1_governance.mjs",
        ],
        "notes": "Owns only the protected Mobile UX Batch 1 repository-governance mechanics and zero-authority staged decision chain; product, visual, implementation, native, release, and leadership-readiness truth remain with their existing owners.",
    }
    batch1_agent_read_path = [
        "spec/authority-map.json",
        "spec/mobile-ux-batch1-governance.json",
        "spec/agent-harness.json",
        "spec/repo-delivery-contract.json",
        "spec/harness-architecture.json",
        "spec/evals.json",
    ]
    batch1_agent_governance_mirror = {
        "owner": "spec/mobile-ux-batch1-governance.json",
        "activation_decision": "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md",
        "status_source": "spec/authority-map.json#domains/mobile_ux_batch1_governance",
        "scope_classifier": "scripts/classify_formal_approval_scope.mjs",
        "validator": "scripts/validate_mobile_ux_batch1_governance.mjs",
        "failure_policy": "unknown_missing_mixed_expired_or_unverifiable_state_fails_closed",
        "authority_boundary": "no_product_visual_implementation_native_release_or_leadership_readiness_authority",
    }
    remote_repository_health = ci_contract["remote_repository_health"]
    required_repository_settings = {
        "default_branch": "main",
        "allow_auto_merge": True,
        "delete_branch_on_merge": True,
        "allow_squash_merge": True,
        "allow_merge_commit": False,
        "allow_rebase_merge": False,
    }

    def vnext_number(value, minimum, label):
        match = re.fullmatch(r"vnext-([1-9][0-9]*)", value or "")
        if not match:
            errors.append(f"{label} must use canonical vnext-N syntax")
            return None
        number = int(match.group(1))
        if number < minimum:
            errors.append(f"{label} must not regress below vnext-{minimum}")
        return number

    def bump_vnext_version(value, minimum, label):
        number = vnext_number(value, minimum, label)
        return f"vnext-{number + 1}" if number is not None else None

    def canonical_active_activation_record(value):
        if value == "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md":
            return True
        return bool(
            re.fullmatch(
                r"docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/pr-[1-9][0-9]*-[a-z0-9]+(?:-[a-z0-9]+)*\.json",
                value or "",
            )
        )

    def authority_owner_for_activation(activation_record):
        return {
            **batch1_authority_owner,
            "protected_activation_record": activation_record,
        }

    def agent_governance_mirror_for_activation(activation_record):
        return {
            **batch1_agent_governance_mirror,
            "activation_decision": activation_record,
        }

    def batch1_anchor_shape(authority_value, harness_value, manifest_value, agents_text):
        domain = authority_value.get("domains", {}).get(
            "mobile_ux_batch1_governance"
        )
        read_path = harness_value.get("read_paths", {}).get(
            "mobile_ux_batch1_governance"
        )
        governance_mirror = harness_value.get("governance", {}).get(
            "mobile_ux_batch1_governance_policy"
        )
        activation_record = (
            domain.get("protected_activation_record")
            if isinstance(domain, dict)
            else None
        )
        compaction = harness_value.get("compaction_keep")
        compaction_count = (
            compaction.count("mobile_ux_batch1_governance_state")
            if isinstance(compaction, list)
            else -1
        )
        active_specs = manifest_value.get("active_specs")
        active_spec_count = (
            active_specs.count("spec/mobile-ux-batch1-governance.json")
            if isinstance(active_specs, list)
            else -1
        )
        governance_specs = (
            [
                value
                for value in active_specs
                if value == "spec/mobile-ux-batch1-governance.json"
                or value.startswith("spec/mobile-ux-batch1-governance-epochs/")
            ]
            if isinstance(active_specs, list)
            else []
        )
        agent_lines = agents_text.splitlines()
        snippet_counts = [
            agent_lines.count(snippet) for snippet in batch1_agent_entrypoint_snippets
        ]
        governance_heading_count = agent_lines.count(
            batch1_agent_governance_heading
        )
        policy_agent_lines = [
            line
            for line in agent_lines
            if re.match(
                r"^- `spec/mobile-ux-batch1-governance(?:\.json|-epochs/)",
                line,
            )
            or (
                line.startswith("- 不要把 Mobile UX Batch 1 governance foundation")
                and "`spec/mobile-ux-batch1-governance" in line
            )
        ]
        exact_active = (
            canonical_active_activation_record(activation_record)
            and domain == authority_owner_for_activation(activation_record)
            and read_path == batch1_agent_read_path
            and governance_mirror
            == agent_governance_mirror_for_activation(activation_record)
            and compaction_count == 1
            and active_spec_count == 1
            and governance_specs == ["spec/mobile-ux-batch1-governance.json"]
            and governance_heading_count in {0, 1}
            and snippet_counts == [1] * len(batch1_agent_entrypoint_snippets)
            and len(policy_agent_lines) == 2
        )
        if exact_active:
            return "active"
        exact_absent = (
            domain is None
            and read_path is None
            and governance_mirror is None
            and compaction_count == 0
            and active_spec_count == 0
            and governance_specs == []
            and governance_heading_count == 0
            and snippet_counts == [0] * len(batch1_agent_entrypoint_snippets)
            and policy_agent_lines == []
        )
        if exact_absent:
            return "anchors_absent_requires_trusted_lineage"
        return "partial_or_inconsistent"

    def revoke_owned_anchor_projection(
        authority_value, harness_value, manifest_value, agents_text
    ):
        domains = dict(authority_value["domains"])
        domains.pop("mobile_ux_batch1_governance", None)
        read_paths = dict(harness_value["read_paths"])
        read_paths.pop("mobile_ux_batch1_governance", None)
        governance = dict(harness_value["governance"])
        governance.pop("mobile_ux_batch1_governance_policy", None)
        return (
            {
                **authority_value,
                "version": bump_vnext_version(
                    authority_value["version"], 4, "synthetic authority-map version"
                ),
                "domains": domains,
            },
            {
                **harness_value,
                "version": bump_vnext_version(
                    harness_value["version"], 23, "synthetic agent-harness version"
                ),
                "read_paths": read_paths,
                "governance": governance,
                "compaction_keep": [
                    value
                    for value in harness_value["compaction_keep"]
                    if value != "mobile_ux_batch1_governance_state"
                ],
            },
            {
                **manifest_value,
                "version": bump_vnext_version(
                    manifest_value["version"], 9, "synthetic doc-manifest version"
                ),
                "active_specs": [
                    value
                    for value in manifest_value["active_specs"]
                    if value != "spec/mobile-ux-batch1-governance.json"
                ],
            },
            "\n".join(
                line
                for line in agents_text.splitlines()
                if line not in batch1_agent_entrypoint_snippets
                and line != batch1_agent_governance_heading
            ),
        )

    def restore_owned_anchor_projection(
        authority_value,
        harness_value,
        manifest_value,
        agents_text,
        activation_record,
    ):
        return (
            {
                **authority_value,
                "version": bump_vnext_version(
                    authority_value["version"], 4, "synthetic authority-map version"
                ),
                "domains": {
                    **authority_value["domains"],
                    "mobile_ux_batch1_governance": authority_owner_for_activation(
                        activation_record
                    ),
                },
            },
            {
                **harness_value,
                "version": bump_vnext_version(
                    harness_value["version"], 23, "synthetic agent-harness version"
                ),
                "read_paths": {
                    **harness_value["read_paths"],
                    "mobile_ux_batch1_governance": batch1_agent_read_path,
                },
                "governance": {
                    **harness_value["governance"],
                    "mobile_ux_batch1_governance_policy": agent_governance_mirror_for_activation(
                        activation_record
                    ),
                },
                "compaction_keep": [
                    *harness_value["compaction_keep"],
                    "mobile_ux_batch1_governance_state",
                ],
            },
            {
                **manifest_value,
                "version": bump_vnext_version(
                    manifest_value["version"], 9, "synthetic doc-manifest version"
                ),
                "active_specs": [
                    *manifest_value["active_specs"],
                    "spec/mobile-ux-batch1-governance.json",
                ],
            },
            "\n".join(
                [
                    *agents_text.splitlines(),
                    batch1_agent_governance_heading,
                    *batch1_agent_entrypoint_snippets,
                ]
            ),
        )

    vnext_number(authority_map.get("version"), 4, "authority-map version")
    vnext_number(harness.get("version"), 23, "agent-harness version")
    vnext_number(doc_manifest.get("version"), 9, "doc-manifest version")
    check_equal(
        "foundation doc-manifest transition accepts the minimum baseline",
        "vnext-10",
        bump_vnext_version("vnext-9", 9, "synthetic foundation doc-manifest version"),
    )
    check_equal(
        "foundation doc-manifest transition derives N plus one from a later baseline",
        "vnext-38",
        bump_vnext_version("vnext-37", 9, "synthetic foundation doc-manifest version"),
    )

    current_batch1_anchor_shape = batch1_anchor_shape(
        authority_map,
        harness,
        doc_manifest,
        agent_entrypoint_text,
    )
    if current_batch1_anchor_shape == "partial_or_inconsistent":
        errors.append(
            "Mobile UX Batch 1 owned anchors are partial or inconsistent; fail closed"
        )

    synthetic_active = (
        {
            "version": "vnext-80",
            "domains": {
                "unrelated_domain": {"owner": "spec/unrelated.json"},
                "mobile_ux_batch1_governance": batch1_authority_owner,
            },
        },
        {
            "version": "vnext-91",
            "read_paths": {
                "unrelated_domain": ["spec/unrelated.json"],
                "mobile_ux_batch1_governance": batch1_agent_read_path,
            },
            "governance": {
                "unrelated_policy": {"owner": "spec/unrelated.json"},
                "mobile_ux_batch1_governance_policy": batch1_agent_governance_mirror,
            },
            "compaction_keep": [
                "unrelated_state",
                "mobile_ux_batch1_governance_state",
            ],
        },
        {
            "version": "vnext-37",
            "active_specs": [
                "spec/unrelated.json",
                "spec/mobile-ux-batch1-governance.json",
            ],
        },
        "\n".join(
            [
                "unrelated AGENTS line",
                batch1_agent_governance_heading,
                *batch1_agent_entrypoint_snippets,
            ]
        ),
    )
    check_equal(
        "synthetic active Batch 1 owned anchor projection",
        "active",
        batch1_anchor_shape(*synthetic_active),
    )
    synthetic_revoked = revoke_owned_anchor_projection(*synthetic_active)
    check_equal(
        "synthetic single-step active to revoked owned anchor projection",
        "anchors_absent_requires_trusted_lineage",
        batch1_anchor_shape(*synthetic_revoked),
    )
    check_equal(
        "synthetic revocation removes the owned AGENTS governance heading",
        False,
        batch1_agent_governance_heading in synthetic_revoked[3].splitlines(),
    )
    check_equal(
        "synthetic revocation bumps authority-map version once from its own base",
        "vnext-81",
        synthetic_revoked[0]["version"],
    )
    check_equal(
        "synthetic revocation bumps agent-harness version once from its own base",
        "vnext-92",
        synthetic_revoked[1]["version"],
    )
    check_equal(
        "synthetic revocation bumps doc-manifest version once from its own base",
        "vnext-38",
        synthetic_revoked[2]["version"],
    )
    check_equal(
        "synthetic revocation preserves unrelated authority-map domain",
        {"owner": "spec/unrelated.json"},
        synthetic_revoked[0]["domains"].get("unrelated_domain"),
    )
    check_equal(
        "synthetic revocation preserves unrelated agent-harness governance",
        {"owner": "spec/unrelated.json"},
        synthetic_revoked[1]["governance"].get("unrelated_policy"),
    )
    check_equal(
        "synthetic revocation preserves unrelated doc-manifest active spec",
        True,
        "spec/unrelated.json" in synthetic_revoked[2]["active_specs"],
    )
    check_equal(
        "synthetic revocation preserves unrelated AGENTS line",
        True,
        "unrelated AGENTS line" in synthetic_revoked[3].splitlines(),
    )
    synthetic_rebootstrap_record = (
        "docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/"
        "pr-731-recover-kernel.json"
    )
    synthetic_rebootstrapped = restore_owned_anchor_projection(
        *synthetic_revoked,
        synthetic_rebootstrap_record,
    )
    check_equal(
        "synthetic single-step revoked to active owned anchor projection",
        "active",
        batch1_anchor_shape(*synthetic_rebootstrapped),
    )
    check_equal(
        "synthetic rebootstrap restores exactly one owned AGENTS governance heading",
        1,
        synthetic_rebootstrapped[3].splitlines().count(
            batch1_agent_governance_heading
        ),
    )
    check_equal(
        "synthetic rebootstrap uses the canonical dynamic activation record in both mirrors",
        synthetic_rebootstrap_record,
        synthetic_rebootstrapped[1]["governance"][
            "mobile_ux_batch1_governance_policy"
        ]["activation_decision"],
    )
    check_equal(
        "synthetic rebootstrap bumps authority-map version once from its own revoked base",
        "vnext-82",
        synthetic_rebootstrapped[0]["version"],
    )
    check_equal(
        "synthetic rebootstrap bumps agent-harness version once from its own revoked base",
        "vnext-93",
        synthetic_rebootstrapped[1]["version"],
    )
    check_equal(
        "synthetic rebootstrap bumps doc-manifest version once from its own revoked base",
        "vnext-39",
        synthetic_rebootstrapped[2]["version"],
    )
    synthetic_mismatched_rebootstrap_harness = {
        **synthetic_rebootstrapped[1],
        "governance": {
            **synthetic_rebootstrapped[1]["governance"],
            "mobile_ux_batch1_governance_policy": agent_governance_mirror_for_activation(
                "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md"
            ),
        },
    }
    check_equal(
        "synthetic mismatched rebootstrap activation records fail closed",
        "partial_or_inconsistent",
        batch1_anchor_shape(
            synthetic_rebootstrapped[0],
            synthetic_mismatched_rebootstrap_harness,
            synthetic_rebootstrapped[2],
            synthetic_rebootstrapped[3],
        ),
    )
    synthetic_invalid_rebootstrap_authority = {
        **synthetic_rebootstrapped[0],
        "domains": {
            **synthetic_rebootstrapped[0]["domains"],
            "mobile_ux_batch1_governance": authority_owner_for_activation(
                "docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/invalid.json"
            ),
        },
    }
    check_equal(
        "synthetic noncanonical rebootstrap activation record fails closed",
        "partial_or_inconsistent",
        batch1_anchor_shape(
            synthetic_invalid_rebootstrap_authority,
            synthetic_rebootstrapped[1],
            synthetic_rebootstrapped[2],
            synthetic_rebootstrapped[3],
        ),
    )

    check_equal("main_branch_policy.branch_name", "main", main_branch_policy["branch_name"])
    check_equal(
        "main_branch_policy.role",
        "read_only_integration_branch",
        main_branch_policy["role"],
    )
    check_equal(
        "main_branch_policy.allowed_topic_branch_prefixes",
        ["infra/", "shell/", "module/", "cross/", "fix/"],
        main_branch_policy["allowed_topic_branch_prefixes"],
    )
    check_equal(
        "remote_guard repository_settings",
        required_repository_settings,
        remote_guard["repository_settings"],
    )
    check_equal(
        "repo_delivery_or_pull_request read path",
        [
            "spec/authority-map.json",
            "spec/agent-harness.json",
            "spec/repo-delivery-contract.json",
            "spec/evals.json",
        ],
        harness["read_paths"]["repo_delivery_or_pull_request"],
    )
    check_equal(
        "card_content_handoff read path",
        [
            "spec/requirement-memory.json",
            "spec/authority-map.json",
            "spec/product-core.json",
            "spec/card-system.json",
            "spec/box-catalog.json",
            "spec/runtime-boundaries.json",
            "spec/agent-harness.json",
            "infra/cloudbase/mobile-runtime-contract.md",
        ],
        harness["read_paths"]["card_content_handoff"],
    )
    card_content_handoff = harness["task_briefs"]["card_content_handoff"]
    check_equal(
        "card_content_handoff inputs",
        [
            "spec/requirement-memory.json",
            "spec/product-core.json",
            "spec/card-system.json",
            "spec/box-catalog.json",
            "spec/runtime-boundaries.json",
            "infra/cloudbase/mobile-runtime-contract.md",
            "external_workspace:/Users/lenkin/programing/card make",
        ],
        card_content_handoff["inputs"],
    )
    check_equal(
        "card_content_handoff outputs",
        [
            "upstream_workspace_reference",
            "export_contract_or_payload_path",
            "dry_run_import_result",
            "catalog_audit_result",
            "runtime_smoke_result",
            "release_content_gap_delta",
        ],
        card_content_handoff["outputs"],
    )
    check_equal(
        "card_content_handoff stop_when",
        "softbook_cet_has_only_received_validated_card_payloads_from_card_make_and_has_not_produced_or_approved_card_content_itself",
        card_content_handoff["stop_when"],
    )
    check_equal(
        "card_content_handoff blocked_when",
        "the_task_requires_generating_candidate_card_content_or_marking_content_approved_inside_softbook_cet",
        card_content_handoff["blocked_when"],
    )
    check_equal("external_content_workspace.name", "card make", external_content_workspace["name"])
    check_equal(
        "external_content_workspace.absolute_path",
        "/Users/lenkin/programing/card make",
        external_content_workspace["absolute_path"],
    )
    check_equal(
        "external_content_workspace.sibling_path_from_repo",
        "../card make",
        external_content_workspace["sibling_path_from_repo"],
    )
    check_equal(
        "external_content_workspace.role",
        "upstream_candidate_card_content_production_workspace",
        external_content_workspace["role"],
    )
    check_equal(
        "external_content_workspace.softbook_cet_role",
        "card_payload_consumer_importer_auditor_and_runtime_validator",
        external_content_workspace["softbook_cet_role"],
    )
    check_equal(
        "external_content_workspace.handoff_contract",
        "infra/cloudbase/mobile-runtime-contract.md",
        external_content_workspace["handoff_contract"],
    )
    check_equal(
        "external_content_workspace.catalog_authority",
        "spec/box-catalog.json",
        external_content_workspace["catalog_authority"],
    )
    check_equal(
        "external_content_workspace.approval_boundary",
        "candidate_or_approved_content_status_lives_in_card_make_not_softbook_cet",
        external_content_workspace["approval_boundary"],
    )
    check_equal(
        "external_content_workspace.forbidden_in_softbook_cet",
        [
            "generating_candidate_card_content",
            "marking_card_batches_as_approved",
            "using_softbook_cet_dev_seed_cards_as_release_content_quantity",
        ],
        external_content_workspace["forbidden_in_softbook_cet"],
    )
    check_equal(
        "external_content_workspace.allowed_in_softbook_cet",
        [
            "dry_run_import_card_payloads",
            "apply_imports_after_explicit_or_existing_validated_handoff",
            "audit_cloudbase_card_sources",
            "run_runtime_smoke_against_imported_payloads",
            "report_release_content_gap_delta",
        ],
        external_content_workspace["allowed_in_softbook_cet"],
    )
    ap32 = find_by_id(harness["anti_patterns"], "AP-32")
    if ap32:
        check_equal(
            "AP-32 name",
            "produce_or_approve_card_content_inside_softbook_cet",
            ap32["name"],
        )
        check_equal(
            "AP-32 correction",
            "use_the_sibling_card_make_workspace_for_candidate_content_production_and_approval_then_import_validate_and_smoke_in_softbook_cet",
            ap32["correction"],
        )
    check_equal(
        "repo_delivery_contract owner",
        "spec/repo-delivery-contract.json",
        repo_delivery_contract["owner"],
    )
    check_equal(
        "repo_delivery_contract default_behavior",
        "code-changing tasks default to topic branch -> commit -> pull request -> recorded agent review -> merge unless the user explicitly requests local-only delivery",
        repo_delivery_contract["default_behavior"],
    )
    check_equal(
        "repo_delivery_contract merge_policy",
        "merge to main defaults to automatic merge after a recorded clean agent review and required gates are green",
        repo_delivery_contract["merge_policy"],
    )
    check_equal(
        "repo_delivery_contract design_gate_policy",
        "user-facing UI changes require accepted design artifacts, checklist answers, implementation mapping, and capability-specific interaction/motion or physical-space evidence when the change touches those systems",
        repo_delivery_contract["design_gate_policy"],
    )
    recovery_schema_path = (
        ROOT / "spec/mobile-ux-batch1-governance-recovery-decision.schema.json"
    )
    if not recovery_schema_path.is_file() or recovery_schema_path.is_symlink():
        errors.append(
            "mobile UX Batch 1 recovery decision schema must be a regular non-symlink file"
        )
    else:
        recovery_schema = context.load(
            "mobile-ux-batch1-governance-recovery-decision.schema.json"
        )
        check_equal(
            "mobile UX Batch 1 recovery schema identity",
            {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "repo://spec/mobile-ux-batch1-governance-recovery-decision.schema.json",
                "title": "Mobile UX Batch 1 governance recovery decision",
                "type": "object",
                "additionalProperties": False,
            },
            {
                key: recovery_schema.get(key)
                for key in [
                    "$schema",
                    "$id",
                    "title",
                    "type",
                    "additionalProperties",
                ]
            },
        )
        check_equal(
            "mobile UX Batch 1 recovery schema decision classes",
            {"enum": batch1_recovery_contract["decision_classes"]},
            recovery_schema.get("properties", {}).get("decision_class"),
        )
        check_equal(
            "mobile UX Batch 1 recovery schema operations",
            {"enum": list(batch1_recovery_contract["operations"])},
            recovery_schema.get("properties", {}).get("operation"),
        )
        check_equal(
            "mobile UX Batch 1 recovery schema fixed nonclaims",
            {
                "type": "array",
                "minItems": 10,
                "maxItems": 10,
                "prefixItems": [
                    {"const": value} for value in batch1_recovery_nonclaims
                ],
                "items": False,
            },
            recovery_schema.get("properties", {}).get("non_claims"),
        )

    batch1_domain_key = "mobile_ux_batch1_governance"
    batch1_agent_mirror_key = "mobile_ux_batch1_governance_policy"
    batch1_agent_read_path_present = batch1_domain_key in harness["read_paths"]
    batch1_agent_mirror_present = batch1_agent_mirror_key in harness["governance"]
    if current_batch1_anchor_shape == "anchors_absent_requires_trusted_lineage":
        if batch1_agent_read_path_present or batch1_agent_mirror_present:
            errors.append(
                "Mobile UX Batch 1 anchor-absent shape has an authority-bearing Agent mirror"
            )
    elif current_batch1_anchor_shape == "active":
        active_activation_record = authority_map["domains"][batch1_domain_key][
            "protected_activation_record"
        ]
        check_equal(
            "mobile UX Batch 1 exact authority owner",
            authority_owner_for_activation(active_activation_record),
            authority_map["domains"][batch1_domain_key],
        )
        if not batch1_agent_read_path_present or not batch1_agent_mirror_present:
            errors.append(
                "mobile UX Batch 1 active foundation is missing its exact Agent mirrors"
            )
        else:
            check_equal(
                "mobile UX Batch 1 active Agent read path",
                batch1_agent_read_path,
                harness["read_paths"][batch1_domain_key],
            )
            check_equal(
                "mobile UX Batch 1 active Agent governance mirror",
                agent_governance_mirror_for_activation(active_activation_record),
                harness["governance"][batch1_agent_mirror_key],
            )
            check_equal(
                "mobile UX Batch 1 active Agent compaction marker",
                1,
                harness.get("compaction_keep", []).count(
                    "mobile_ux_batch1_governance_state"
                ),
            )

        for relative_path in batch1_activation_paths:
            activation_path = ROOT / relative_path
            if (
                not activation_path.exists()
                or not activation_path.is_file()
                or activation_path.is_symlink()
            ):
                errors.append(
                    "mobile UX Batch 1 active foundation requires a regular non-symlink artifact: "
                    + relative_path
                )

        active_activation_path = ROOT / active_activation_record
        if (
            not active_activation_path.exists()
            or not active_activation_path.is_file()
            or active_activation_path.is_symlink()
        ):
            errors.append(
                "mobile UX Batch 1 active activation record must be a regular non-symlink artifact: "
                + active_activation_record
            )

        for snippet in batch1_agent_entrypoint_snippets:
            check_contains(
                "mobile UX Batch 1 active Agent entrypoint",
                agent_entrypoint_text,
                snippet,
            )

        if "spec/mobile-ux-batch1-resolved-requirement.schema.json" in doc_manifest.get(
            "active_specs", []
        ):
            errors.append(
                "mobile UX Batch 1 protected resolved-requirement schema must not become an active truth spec"
            )

        policy_path = ROOT / "spec/mobile-ux-batch1-governance.json"
        schema_path = ROOT / "spec/mobile-ux-batch1-resolved-requirement.schema.json"
        decision_path = (
            ROOT
            / "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md"
        )
        if policy_path.is_file() and not policy_path.is_symlink():
            batch1_policy = context.load("mobile-ux-batch1-governance.json")
            check_equal(
                "mobile UX Batch 1 policy exact top-level keys",
                [
                    "activation_contract",
                    "artifact_paths",
                    "authority_note",
                    "bootstrap_trust_transition",
                    "canonical_authority",
                    "canonical_authority_keys",
                    "classification",
                    "cohort_privacy_policy",
                    "decision_validity_policy",
                    "fail_closed_rules",
                    "foundation_authority",
                    "foundation_non_claims",
                    "governance_id",
                    "governance_recovery_contract",
                    "invalidation_condition_registry",
                    "layer",
                    "legacy_preparation_receipt_migration_contract",
                    "protected_approval_event_contract",
                    "purpose",
                    "reference_batch1_schema_subject",
                    "resolved_requirement_schema_contract",
                    "schema_version",
                    "stage_separation_policy",
                    "status",
                    "trusted_code_policy",
                ],
                sorted(batch1_policy),
            )
            check_equal(
                "mobile UX Batch 1 policy identity",
                {
                    "schema_version": "mobile-ux-batch1-governance-foundation.v1",
                    "governance_id": "mobile-ux-batch1-governance-foundation-v1",
                    "layer": "repo_governance_truth",
                    "classification": "implementation_hypothesis",
                    "status": "foundation_requires_protected_approval_and_merge",
                },
                {
                    key: batch1_policy.get(key)
                    for key in [
                        "schema_version",
                        "governance_id",
                        "layer",
                        "classification",
                        "status",
                    ]
                },
            )
            check_equal(
                "mobile UX Batch 1 canonical protected identity",
                {
                    "repository": {
                        "full_name": "LENKIN233/softbook_cet",
                        "repository_id": 1216764160,
                        "canonical_origin_identity": "github.com/LENKIN233/softbook_cet",
                        "protected_base_ref": "refs/heads/main",
                    },
                    "workflow": {
                        "path": ".github/workflows/formal-approval.yml",
                        "workflow_id": 315520763,
                        "trusted_code_source": "verified_pull_request_base_sha",
                        "required_conclusion": "success",
                    },
                    "environment": {
                        "id": 18348068326,
                        "name": "formal-product-owner-approval",
                        "administrator_bypass_allowed": False,
                    },
                    "decision_owner": {
                        "login": "LENKIN233",
                        "database_id": 113219944,
                        "immutable_id": "github:LENKIN233#113219944",
                    },
                    "identity_match_policy": "repository_id_full_name_origin_workflow_id_path_environment_id_name_and_owner_immutable_id_must_all_match",
                    "fork_or_repository_name_only_substitution_forbidden": True,
                },
                batch1_policy.get("canonical_authority"),
            )
            check_equal(
                "mobile UX Batch 1 activation contract",
                {
                    "decision_artifact_path": "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md",
                    "required_decision_class": "schema_definition",
                    "required_workflow_decision_class": "governance_foundation",
                    "required_pull_request_base_ref": "refs/heads/main",
                    "required_trusted_base_contains_merged_bootstrap": True,
                    "trusted_code_closure_changes_in_activation_pull_request_forbidden": True,
                    "protected_approval_required": True,
                    "formal_status_requires_trusted_current_run_approval_revalidation": True,
                    "current_run_approval_revalidation_source": "verified_pull_request_base_sha",
                    "current_run_approval_revalidation_failure_policy": batch1_activation_current_run_revalidation_failure_policy,
                    "activation_approval_evidence_mode": "trusted_current_run_gate_not_repository_receipt",
                    "post_merge_active_state_revalidation": "exact_activation_bytes_on_protected_main_without_remote_approval_event_replay",
                    "post_merge_remote_activation_event_replay_claimed": False,
                    "merge_to_protected_main_required": True,
                    "approval_without_merge_has_gate_effect": "none",
                    "merge_without_exact_protected_approval_has_gate_effect": "none",
                    "activation_requires_exact_decision_and_spec_bytes_in_approved_head": True,
                    "activation_requires_merged_bytes_to_equal_approved_bytes": True,
                    "activation_requires_merge_commit_reachable_from_protected_main": True,
                    "status_after_all_activation_requirements": "active_repo_governance_truth",
                    "gate_effect_after_activation": "mobile_ux_batch1_governance_foundation_only",
                    "does_not_activate_any_successor_stage": True,
                },
                batch1_policy.get("activation_contract"),
            )
            check_equal(
                "mobile UX Batch 1 two-stage bootstrap transition",
                {
                    "trusted_validator_bootstrap_pull_request_base_sha": "b423d8ffb9271f0618229605797e708919eebdea",
                    "trusted_validator_absent_from_bootstrap_base": True,
                    "pr_a_trusted_validator_merge_required": True,
                    "pr_a_is_governed_by_existing_base_formal_approval_workflow_only": True,
                    "pr_a_self_validation_or_retroactive_base_validation_claim_forbidden": True,
                    "pr_a_grants_no_activation_authority": True,
                    "pr_b_activation_base_must_contain_pr_a_trusted_validator": True,
                    "pr_b_activation_base_state_must_be": "inactive_bootstrap_installed",
                    "pr_b_activation_requires_live_bootstrap_materialization_proof": True,
                    "bootstrap_materialization_commit_must_be_derived_from_fixed_run_record_unique_add_introduction": True,
                    "bootstrap_materialization_pull_request_must_be_uniquely_resolved_from_commit": True,
                    "bootstrap_head_tree_must_equal_merge_tree": True,
                    "bootstrap_run_record_merge_and_current_base_bytes_must_match": True,
                    "pr_b_must_execute_classifier_and_validator_from_verified_base": True,
                    "pr_b_exact_activation_scope_required": True,
                    "pr_b_requires_exact_protected_environment_approval_independent_agent_review_green_required_gates_and_merge": True,
                    "activated_validator_applies_only_to_later_pull_requests_whose_verified_base_contains_both_merged_stages": True,
                    "two_stage_transition_grants_no_successor_or_product_authority": True,
                },
                batch1_policy.get("bootstrap_trust_transition"),
            )
            check_equal(
                "mobile UX Batch 1 protected current-run approval contract",
                batch1_protected_current_run_approval_contract,
                {
                    key: batch1_policy.get(
                        "protected_approval_event_contract", {}
                    ).get(key)
                    for key in batch1_protected_current_run_approval_contract
                },
            )
            check_equal(
                "mobile UX Batch 1 protected approval review selection",
                {
                    "endpoint": "repos/{repository}/actions/runs/{workflow_run_id}/approvals",
                    "selection_rule": "exactly_one_review_matching_required_environment_and_owner",
                    "required_state": "approved",
                    "required_environment_count": 1,
                    "required_environment_id": 18348068326,
                    "required_environment_name": "formal-product-owner-approval",
                    "required_reviewer_immutable_id": "github:LENKIN233#113219944",
                    "non_empty_scope_comment_required": True,
                    "whitespace_only_scope_comment_forbidden": True,
                    "zero_or_multiple_matching_reviews_fail_closed": True,
                    "provider_approval_id_not_required": True,
                    "provider_decided_at_not_required": True,
                },
                batch1_policy.get("protected_approval_event_contract", {}).get(
                    "approval_review_selection"
                ),
            )
            all_false_authority = {key: False for key in batch1_authority_keys}
            check_equal(
                "mobile UX Batch 1 zero foundation authority",
                all_false_authority,
                batch1_policy.get("foundation_authority"),
            )
            check_equal(
                "mobile UX Batch 1 trusted code policy",
                batch1_trusted_code_policy,
                batch1_policy.get("trusted_code_policy"),
            )
            check_equal(
                "mobile UX Batch 1 timeless recovery contract",
                batch1_recovery_contract,
                batch1_policy.get("governance_recovery_contract"),
            )
            check_equal(
                "mobile UX Batch 1 legacy three-PR materialization boundary",
                True,
                batch1_policy.get(
                    "legacy_preparation_receipt_migration_contract", {}
                ).get(
                    "migration_intent_migration_receipt_and_preparation_receipt_pull_requests_must_all_differ"
                ),
            )
            check_equal(
                "mobile UX Batch 1 non-gate provenance and F3 freshness boundary",
                {
                    "remote_or_human_source_event_truth_proven_at_R0_B2_or_F3": False,
                    "remote_or_human_provenance_gate_eligible": False,
                    "F3_receipt_materialization_and_every_later_use_revalidate_all_provenance_expiry_against_latest_provider_observation": True,
                    "F3_receipt_materialization_and_every_later_use_require_execution_windows_not_started_or_expired": True,
                    "future_provision_execution_and_evidence_require_independent_remote_source_event_revalidation": True,
                },
                {
                    key: batch1_policy.get(
                        "resolved_requirement_schema_contract", {}
                    ).get(key)
                    for key in [
                        "remote_or_human_source_event_truth_proven_at_R0_B2_or_F3",
                        "remote_or_human_provenance_gate_eligible",
                        "F3_receipt_materialization_and_every_later_use_revalidate_all_provenance_expiry_against_latest_provider_observation",
                        "F3_receipt_materialization_and_every_later_use_require_execution_windows_not_started_or_expired",
                        "future_provision_execution_and_evidence_require_independent_remote_source_event_revalidation",
                    ]
                },
            )
            check_equal(
                "mobile UX Batch 1 B2 descriptor and tracked-hash nonclaim",
                {
                    "B2_build_verification_scope": batch1_b2_validation_nonclaim[
                        "verification_scope"
                    ],
                    "B2_build_recipe_executed_by_validator": False,
                    "B2_build_output_rebuilt_by_validator": False,
                    "B2_build_reproducibility_proven": False,
                    "B2_hermetic_replay_proven": False,
                },
                {
                    key: batch1_policy.get(
                        "resolved_requirement_schema_contract", {}
                    ).get(key)
                    for key in [
                        "B2_build_verification_scope",
                        "B2_build_recipe_executed_by_validator",
                        "B2_build_output_rebuilt_by_validator",
                        "B2_build_reproducibility_proven",
                        "B2_hermetic_replay_proven",
                    ]
                },
            )
            check_equal(
                "mobile UX Batch 1 exact active stage separation",
                batch1_activation_paths,
                batch1_policy.get("stage_separation_policy", {}).get(
                    "activation_pull_request_exact_changed_paths"
                ),
            )
            check_equal(
                "mobile UX Batch 1 stage separation exact keys",
                [
                    "activation_pull_request_exact_changed_paths",
                    "approval_target_head_must_equal_final_merged_pull_request_head",
                    "approval_target_pull_request_must_be_remotely_merged_before_receipt_materialization",
                    "approved_head_tree_must_equal_squash_merge_commit_tree",
                    "foundation_pull_request_forbidden_paths",
                    "foundation_pull_request_must_not_contain_D1_or_F3_intent",
                    "foundation_pull_request_must_not_contain_R0_bytes_or_value_resolutions",
                    "foundation_pull_request_must_not_contain_any_approval_receipt",
                    "foundation_pull_request_must_not_modify_reference_batch1_schema_subject",
                    "mode",
                    "one_new_decision_class_or_post_event_materialization_stage_per_pull_request",
                    "parent_receipt_materialization_pull_request_must_resolve_to_remote_merge_and_unique_local_introduction_commit",
                    "parent_tuple_must_record_parent_receipt_materialization_pull_request",
                    "receipt_cannot_approve_itself",
                    "receipt_materialization_commit_must_descend_from_verified_squash_merge_commit",
                    "receipt_materialization_pull_request_must_differ_from_approval_target_pull_request",
                    "receipt_materialization_pull_request_must_equal_current_pull_request",
                    "receipt_must_be_absent_from_its_approval_target_head",
                    "receipt_must_record_approval_target_and_materialization_pull_requests",
                    "trusted_staged_same_pull_request_path_allowed",
                    "verified_squash_merge_commit_must_be_ancestor_of_trusted_receipt_base",
                    "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha",
                ],
                sorted(batch1_policy.get("stage_separation_policy", {})),
            )
            check_equal(
                "mobile UX Batch 1 distinct PR staging",
                {
                    "mode": "distinct_pr_only",
                    "trusted_staged_same_pull_request_path_allowed": False,
                    "one_new_decision_class_or_post_event_materialization_stage_per_pull_request": True,
                    "receipt_must_be_absent_from_its_approval_target_head": True,
                    "receipt_must_record_approval_target_and_materialization_pull_requests": True,
                    "receipt_materialization_pull_request_must_equal_current_pull_request": True,
                    "receipt_materialization_pull_request_must_differ_from_approval_target_pull_request": True,
                    "parent_tuple_must_record_parent_receipt_materialization_pull_request": True,
                    "parent_receipt_materialization_pull_request_must_resolve_to_remote_merge_and_unique_local_introduction_commit": True,
                    "approval_target_pull_request_must_be_remotely_merged_before_receipt_materialization": True,
                    "approval_target_head_must_equal_final_merged_pull_request_head": True,
                    "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha": True,
                    "verified_squash_merge_commit_must_be_ancestor_of_trusted_receipt_base": True,
                    "approved_head_tree_must_equal_squash_merge_commit_tree": True,
                    "receipt_materialization_commit_must_descend_from_verified_squash_merge_commit": True,
                    "receipt_cannot_approve_itself": True,
                },
                {
                    key: batch1_policy.get("stage_separation_policy", {}).get(key)
                    for key in [
                        "mode",
                        "trusted_staged_same_pull_request_path_allowed",
                        "one_new_decision_class_or_post_event_materialization_stage_per_pull_request",
                        "receipt_must_be_absent_from_its_approval_target_head",
                        "receipt_must_record_approval_target_and_materialization_pull_requests",
                        "receipt_materialization_pull_request_must_equal_current_pull_request",
                        "receipt_materialization_pull_request_must_differ_from_approval_target_pull_request",
                        "parent_tuple_must_record_parent_receipt_materialization_pull_request",
                        "parent_receipt_materialization_pull_request_must_resolve_to_remote_merge_and_unique_local_introduction_commit",
                        "approval_target_pull_request_must_be_remotely_merged_before_receipt_materialization",
                        "approval_target_head_must_equal_final_merged_pull_request_head",
                        "verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha",
                        "verified_squash_merge_commit_must_be_ancestor_of_trusted_receipt_base",
                        "approved_head_tree_must_equal_squash_merge_commit_tree",
                        "receipt_materialization_commit_must_descend_from_verified_squash_merge_commit",
                        "receipt_cannot_approve_itself",
                    ]
                },
            )
            check_equal(
                "mobile UX Batch 1 policy artifact identities",
                {
                    "governance_foundation_spec": "spec/mobile-ux-batch1-governance.json",
                    "governance_foundation_decision": "docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md",
                    "resolved_requirement_schema": "spec/mobile-ux-batch1-resolved-requirement.schema.json",
                },
                {
                    key: batch1_policy.get("artifact_paths", {}).get(key)
                    for key in [
                        "governance_foundation_spec",
                        "governance_foundation_decision",
                        "resolved_requirement_schema",
                    ]
                },
            )

        if schema_path.is_file() and not schema_path.is_symlink():
            batch1_schema = context.load(
                "mobile-ux-batch1-resolved-requirement.schema.json"
            )
            check_equal(
                "mobile UX Batch 1 resolved requirement schema top-level keys",
                [
                    "$defs",
                    "$id",
                    "$schema",
                    "additionalProperties",
                    "description",
                    "properties",
                    "required",
                    "title",
                    "type",
                ],
                sorted(batch1_schema),
            )
            check_equal(
                "mobile UX Batch 1 resolved requirement schema identity",
                {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://softbook.invalid/schema/mobile-ux-batch1-resolved-requirement.v1.json",
                    "title": "Mobile UX Batch 1 resolved requirement record",
                    "type": "object",
                    "additionalProperties": False,
                },
                {
                    key: batch1_schema.get(key)
                    for key in [
                        "$schema",
                        "$id",
                        "title",
                        "type",
                        "additionalProperties",
                    ]
                },
            )
            check_equal(
                "mobile UX Batch 1 resolved requirement zero authority",
                {
                    "type": "object",
                    "additionalProperties": False,
                    "required": batch1_authority_keys,
                    "properties": {
                        key: {"const": False} for key in batch1_authority_keys
                    },
                },
                batch1_schema.get("$defs", {}).get("allFalseAuthority"),
            )
            check_equal(
                "mobile UX Batch 1 resolved requirement authority reference",
                {"$ref": "#/$defs/allFalseAuthority"},
                batch1_schema.get("properties", {}).get("authority"),
            )
            check_equal(
                "mobile UX Batch 1 resolved requirement fixed status",
                {"const": "typed_value_resolved"},
                batch1_schema.get("properties", {}).get("status"),
            )

        if decision_path.is_file() and not decision_path.is_symlink():
            decision_text = decision_path.read_text(encoding="utf-8")
            decision_parts = decision_text.split("---", 2)
            decision_frontmatter = {}
            if len(decision_parts) != 3 or decision_parts[0] != "":
                errors.append(
                    "mobile UX Batch 1 governance decision must have one leading exact frontmatter block"
                )
            else:
                for line in decision_parts[1].strip().splitlines():
                    key, separator, value = line.partition(":")
                    key = key.strip()
                    if not separator or not key or key in decision_frontmatter:
                        errors.append(
                            "mobile UX Batch 1 governance decision has malformed or duplicate frontmatter"
                        )
                        continue
                    decision_frontmatter[key] = value.strip()
                check_equal(
                    "mobile UX Batch 1 governance decision identity",
                    {
                        "status": "foundation_requires_protected_approval_and_merge",
                        "classification": "implementation_hypothesis",
                        "authority": "repo_governance_truth_after_activation_only",
                        "decision_id": "mobile-ux-batch1-governance-foundation-v1",
                        "decision_class": "schema_definition",
                        "decision_owner": "github:LENKIN233#113219944",
                        "approval_subject_repository": "LENKIN233/softbook_cet",
                        "approval_subject_repository_id": "1216764160",
                        "activation_authority": "formal-product-owner-approval",
                        "gate_effect": "none_before_activation_governance_foundation_only_after_activation",
                    },
                    decision_frontmatter,
                )
            for snippet in [
                "## Two-stage bootstrap and activation transition",
                "PR-A has no\nfoundation activation or successor authority",
                "This record belongs to the later PR-B.",
                "The only supported staging mode is `distinct_pr_only`.",
                "Every one is `false` for this foundation.",
            ]:
                check_contains(
                    "mobile UX Batch 1 governance decision",
                    decision_text,
                    snippet,
                )

    formal_approval_regression = find_by_id(evals["regressions"], "HR-36")
    if formal_approval_regression:
        check_equal(
            "HR-36 timeless Mobile UX Batch 1 governance state",
            [
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
            ],
            formal_approval_regression["must_hit"],
        )

    check_equal(
        "mobile UX Batch 1 governance validation architecture",
        {
            "contract_mirror_section": "governance_contracts",
            "runtime_wiring_section": "delivery_runtime",
            "scope_classifier_schema_version": "formal-approval-scope.v2",
            "trusted_execution_source": "verified_pull_request_base_sha",
            "decision_head_policy": "untrusted_data_only_never_execute_head_code",
            "trusted_code_policy": batch1_trusted_code_policy,
            "stage_separation_merge_integrity_contract": batch1_stage_separation_merge_integrity_contract,
            "protected_current_run_approval_contract": batch1_protected_current_run_approval_contract,
            "activation_current_run_revalidation_failure_policy": batch1_activation_current_run_revalidation_failure_policy,
            "activation_decision_class_contract": batch1_activation_decision_class_contract,
            "required_pr_ci_job": "validate-harness",
            "trusted_code_closure": batch1_trusted_code_closure,
            "syntax_check_paths": [
                "scripts/classify_formal_approval_scope.mjs",
                "scripts/lib/mobile_ux_batch1_governance_contract.mjs",
                "scripts/lib/mobile_ux_batch1_github_event_reader.mjs",
                "scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs",
                "scripts/lib/mobile_ux_batch1_successor_contract.mjs",
                "scripts/validate_mobile_ux_batch1_governance.mjs",
                "scripts/validate_mobile_ux_batch1_successor.mjs",
            ],
            "governance_contract_regression_command": "node --test scripts/test_mobile_ux_batch1_governance_contract.mjs",
            "github_event_reader_regression_command": "node --test scripts/test_mobile_ux_batch1_github_event_reader.mjs",
            "governance_recovery_contract_regression_command": "node --test scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs",
            "governance_validator_regression_command": "node --test scripts/test_validate_mobile_ux_batch1_governance.mjs",
            "successor_validator_regression_command": "node --test scripts/test_mobile_ux_batch1_successor_contract.mjs",
            "failure_policy": "unknown_missing_mixed_or_unverifiable_governance_state_fails_closed",
            "bootstrap_status": "trusted_validation_code_installed",
            "bootstrap_authority": "none",
            "foundation_activation_source": "spec/authority-map.json#domains/mobile_ux_batch1_governance",
            "foundation_state_contract": batch1_foundation_state_contract,
            "governance_recovery_contract": batch1_recovery_contract,
            "timeless_anchor_shape_contract": batch1_timeless_anchor_shape_contract,
            "B2_validation_nonclaim": batch1_b2_validation_nonclaim,
            "runtime_product_semantics_owned_here": False,
        },
        batch1_governance_validation,
    )
    check_equal(
        "repo_delivery default_strategy",
        "topic_branch_commit_pull_request_agent_review_auto_merge",
        delivery_defaults["default_strategy"],
    )
    check_equal("repo_delivery topic_branch_required", True, delivery_defaults["topic_branch_required"])
    check_equal(
        "repo_delivery allowed_topic_branch_prefixes",
        main_branch_policy["allowed_topic_branch_prefixes"],
        delivery_defaults["allowed_topic_branch_prefixes"],
    )
    check_equal(
        "repo_delivery local_only_requires_explicit_user_instruction",
        True,
        delivery_defaults["local_only_requires_explicit_user_instruction"],
    )
    check_equal(
        "repo_delivery pull_request_required_unless_local_only",
        True,
        delivery_defaults["pull_request_required_unless_local_only"],
    )
    check_equal(
        "repo_delivery agent_review_required_before_merge",
        True,
        delivery_defaults["agent_review_required_before_merge"],
    )
    check_equal(
        "repo_delivery agent_review_record_required_before_merge",
        True,
        delivery_defaults["agent_review_record_required_before_merge"],
    )
    check_equal(
        "repo_delivery auto_merge_after_agent_review_and_green_gates",
        True,
        delivery_defaults["auto_merge_after_agent_review_and_green_gates"],
    )
    check_equal(
        "repo_delivery merge_blockers",
        [
            "blocking_review_findings",
            "agent_review_record_missing_or_blocking",
            "required_gates_not_green",
            "pull_request_or_merge_permission_failure",
        ],
        delivery_defaults["merge_blockers"],
    )
    check_equal(
        "repo_delivery if_pull_request_cannot_be_created",
        "handoff_branch_commit_validation_and_blocker",
        delivery_defaults["if_pull_request_cannot_be_created"],
    )
    check_equal("pull_request_contract target_branch", "main", pull_request_contract["target_branch"])
    check_equal(
        "pull_request_contract default_action",
        "open_or_update_pull_request_then_review_and_merge_when_green",
        pull_request_contract["default_action"],
    )
    check_equal(
        "pull_request_contract required_body_sections",
        [
            "当前任务引用的 spec",
            "变更摘要",
            "验证",
            "Agent review",
            "Agent run record",
            "设计稿来源（用户可见 UI 如适用）",
            "design_review_checklist（如适用）",
        ],
        pull_request_contract["required_body_sections"],
    )
    check_equal(
        "pull_request_contract validation_record_policy",
        {
            "full_harness_required_command": "python3 scripts/validate_harness.py",
            "skip_remote_guard_is_ci_only": True,
            "skip_remote_guard_only_record_is_merge_blocker": True,
        },
        pull_request_contract["validation_record_policy"],
    )
    check_equal(
        "pull_request_contract agent_run_record_policy required_before_merge",
        True,
        pull_request_contract["agent_run_record_policy"]["required_before_merge"],
    )
    check_equal(
        "pull_request_contract agent_run_record_policy storage",
        "docs/agent-runs/",
        pull_request_contract["agent_run_record_policy"]["storage"],
    )
    check_equal(
        "pull_request_contract agent_run_record_policy pr_body_field",
        "Run record",
        pull_request_contract["agent_run_record_policy"]["pr_body_field"],
    )

    post_merge_local_sync_policy = pull_request_contract["post_merge_local_sync_policy"]
    check_equal(
        "post_merge_local_sync_policy remote authority",
        True,
        post_merge_local_sync_policy["remote_merge_state_is_authoritative"],
    )
    check_equal(
        "post_merge_local_sync_policy clean local main",
        "fast_forward_local_main_worktree_to_origin_main",
        post_merge_local_sync_policy["if_local_main_worktree_exists_and_is_clean"],
    )
    check_equal(
        "post_merge_local_sync_policy worktree lock",
        "not_remote_merge_failure_when_github_pr_state_is_MERGED",
        post_merge_local_sync_policy["local_worktree_lock_error_after_merge"],
    )

    check_equal(
        "pull_request_contract visual_output_rule",
        "if_visual_output_changes_exist_the_pull_request_must_answer_the_design_review_checklist",
        pull_request_contract["visual_output_rule"],
    )
    check_equal(
        "pull_request_contract user_facing_ui_design_gate applies_when",
        "pull_request_changes_user_facing_UI_or_visual_state",
        pull_request_contract["user_facing_ui_design_gate"]["applies_when"],
    )
    check_equal(
        "pull_request_contract user_facing_ui_design_gate required_before_implementation",
        True,
        pull_request_contract["user_facing_ui_design_gate"]["required_before_implementation"],
    )
    check_equal(
        "pull_request_contract user_facing_ui_design_gate existing_code_is_not_design_authority",
        True,
        pull_request_contract["user_facing_ui_design_gate"]["existing_code_is_not_design_authority"],
    )
    check_equal(
        "pull_request_contract user_facing_ui_design_gate accepted_sources",
        [
            "docs/design/visual-reference.html",
            "docs/design/canon.md",
            "docs/design/briefs/*.md",
            "docs/design/directions/*.md",
            "docs/design/decisions/*.md",
            "docs/design/interaction-motion/*.md",
            "docs/design/physical-space/*.md",
            "docs/design/mocks/*.md",
            "docs/design/storyboards/*.md",
            "linked_external_design_file",
        ],
        pull_request_contract["user_facing_ui_design_gate"]["accepted_sources"],
    )
    check_equal(
        "pull_request_contract same_pull_request_design_artifact_rule",
        "design brief, direction, or decision added in the same PR may satisfy design-only work, but cannot satisfy an implementation PR that also changes user-facing UI",
        pull_request_contract["user_facing_ui_design_gate"]["same_pull_request_design_artifact_rule"],
    )
    check_equal(
        "pull_request_contract task_local_design_brief_rule",
        "task-local design briefs may guide exploration but are not accepted implementation authority",
        pull_request_contract["user_facing_ui_design_gate"]["task_local_design_brief_rule"],
    )
    check_equal(
        "pull_request_contract pull_request_must_state",
        [
            "design_artifact_source",
            "interaction_motion_artifact_if_core_interaction_changes",
            "physical_space_artifact_if_space_changes",
            "implementation_mapping",
            "unimplemented_design_gaps_if_any",
            "design_review_checklist_answers",
        ],
        pull_request_contract["user_facing_ui_design_gate"]["pull_request_must_state"],
    )
    check_equal(
        "pull_request_contract core_product_capability_design_gate",
        {
            "learning_or_space_ui_requires_surface_specific_artifact": True,
            "core_interaction_ui_requires_interaction_motion_artifact": True,
            "space_ui_requires_physical_space_artifact": True,
            "space_ui_requires_space_visual_proof_artifact": True,
            "core_surface_quality_requires_rendered_mock_or_storyboard_before_full_visual_completion": True,
        },
        pull_request_contract["user_facing_ui_design_gate"]["core_product_capability_design_gate"],
    )
    check_equal(
        "pull_request_contract card_content_handoff_gate applies_when",
        "pull_request_changes_repository_dev_card_content_or_card_payload_seed",
        card_content_handoff_gate["applies_when"],
    )
    check_equal(
        "pull_request_contract card_content_handoff_gate direct_content_production_without_external_handoff",
        "delivery_blocker",
        card_content_handoff_gate["direct_content_production_without_external_handoff"],
    )
    check_equal(
        "pull_request_contract card_content_handoff_gate watched_files",
        ["apps/mobile/src/learning/localCardRecords.ts"],
        card_content_handoff_gate["watched_files"],
    )
    check_equal(
        "pull_request_contract card_content_handoff_gate accepted_handoff_sources",
        [
            "external_workspace:/Users/lenkin/programing/card make",
            "/Users/lenkin/programing/card make",
            "../card make",
        ],
        card_content_handoff_gate["accepted_handoff_sources"],
    )
    check_equal(
        "pull_request_contract card_content_handoff_gate pull_request_must_state",
        [
            "card_make_handoff_source",
            "dry_run_import_result_or_catalog_audit_result_or_runtime_smoke_result_or_release_content_gap_delta",
        ],
        card_content_handoff_gate["pull_request_must_state"],
    )
    check_equal(
        "pull_request_contract card_content_handoff_gate accepted_validation_evidence",
        [
            "dry_run_import_result",
            "catalog_audit_result",
            "runtime_smoke_result",
            "release_content_gap_delta",
            "infra/cloudbase/import-card-source.mjs",
            "infra/cloudbase/audit-card-sources.mjs",
            "infra/cloudbase/smoke-softbook-api.mjs",
            "scripts/report_release_content_gap.mjs",
        ],
        card_content_handoff_gate["accepted_validation_evidence"],
    )
    check_equal("ci_contract workflow_path", ".github/workflows/pr-gates.yml", ci_contract["workflow_path"])
    check_equal(
        "ci_contract pull_request_template_path",
        ".github/pull_request_template.md",
        ci_contract["pull_request_template_path"],
    )
    check_equal(
        "ci_contract formal_approval_gate",
        {
            "workflow_path": ".github/workflows/formal-approval.yml",
            "scope_classifier_path": "scripts/classify_formal_approval_scope.mjs",
            "scope_classifier_test_path": "scripts/test_classify_formal_approval_scope.mjs",
            "scope_classifier_schema_version": "formal-approval-scope.v2",
            "scope_classifier_outputs": [
                "sensitive",
                "decision_class",
                "trusted_validation_required",
                "classification_error",
            ],
            "decision_classes": batch1_decision_classes,
            "trusted_code_source": "verified_pull_request_base_sha",
            "trusted_validation_policy": {
                "classifier_and_validator_source": "verified_pull_request_base_sha",
                "base_blob_integrity": "recompute_git_mode_and_raw_sha256",
                "head_artifact_policy": "untrusted_data_only",
                "head_code_execution": "forbidden",
                "trusted_base_ancestry": "must_be_ancestor_of_approval_target_head",
                "missing_or_unverifiable": "fail_closed",
            },
            "required_status_check": "formal-approval",
            "environment": "formal-product-owner-approval",
            "required_reviewer": "github:LENKIN233",
            "administrators_can_bypass": False,
            "prevent_self_review": False,
            "sensitive_scope_policy": "fail_closed",
        },
        formal_approval_gate,
    )
    check_equal(
        "ci_contract mobile UX Batch 1 governance bootstrap",
        {
            "governance_contract_module": "scripts/lib/mobile_ux_batch1_governance_contract.mjs",
            "governance_contract_test": "scripts/test_mobile_ux_batch1_governance_contract.mjs",
            "governance_recovery_contract_module": "scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs",
            "governance_recovery_contract_test": "scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs",
            "governance_recovery_decision_schema": "spec/mobile-ux-batch1-governance-recovery-decision.schema.json",
            "github_event_reader_module": "scripts/lib/mobile_ux_batch1_github_event_reader.mjs",
            "github_event_reader_test": "scripts/test_mobile_ux_batch1_github_event_reader.mjs",
            "governance_validator": "scripts/validate_mobile_ux_batch1_governance.mjs",
            "governance_validator_test": "scripts/test_validate_mobile_ux_batch1_governance.mjs",
            "successor_contract_module": "scripts/lib/mobile_ux_batch1_successor_contract.mjs",
            "successor_validator": "scripts/validate_mobile_ux_batch1_successor.mjs",
            "successor_validator_test": "scripts/test_mobile_ux_batch1_successor_contract.mjs",
            "trusted_code_closure": batch1_trusted_code_closure,
            "syntax_check_paths": [
                "scripts/classify_formal_approval_scope.mjs",
                "scripts/lib/mobile_ux_batch1_governance_contract.mjs",
                "scripts/lib/mobile_ux_batch1_github_event_reader.mjs",
                "scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs",
                "scripts/lib/mobile_ux_batch1_successor_contract.mjs",
                "scripts/validate_mobile_ux_batch1_governance.mjs",
                "scripts/validate_mobile_ux_batch1_successor.mjs",
            ],
            "regression_commands": [
                "node --test scripts/test_mobile_ux_batch1_governance_contract.mjs",
                "node --test scripts/test_mobile_ux_batch1_github_event_reader.mjs",
                "node --test scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs",
                "node --test scripts/test_validate_mobile_ux_batch1_governance.mjs",
                "node --test scripts/test_mobile_ux_batch1_successor_contract.mjs",
            ],
            "workflow_execution_policy": "trusted_base_classifier_and_validator_only_head_artifacts_are_untrusted_data",
            "trusted_code_policy": batch1_trusted_code_policy,
            "stage_separation_merge_integrity_contract": batch1_stage_separation_merge_integrity_contract,
            "protected_current_run_approval_contract": batch1_protected_current_run_approval_contract,
            "activation_current_run_revalidation_failure_policy": batch1_activation_current_run_revalidation_failure_policy,
            "activation_decision_class_contract": batch1_activation_decision_class_contract,
            "bootstrap_status": "trusted_validation_code_installed",
            "bootstrap_authority": "none",
            "foundation_activation_source": "spec/authority-map.json#domains/mobile_ux_batch1_governance",
            "foundation_state_contract": batch1_foundation_state_contract,
            "governance_recovery_contract": batch1_recovery_contract,
            "timeless_anchor_shape_contract": batch1_timeless_anchor_shape_contract,
            "B2_validation_nonclaim": batch1_b2_validation_nonclaim,
        },
        batch1_governance_bootstrap,
    )
    if formal_approval_gate["required_status_check"] not in remote_guard["required_status_checks"]:
        errors.append("formal approval status is not required by remote branch protection contract")
    check_equal(
        "ci_contract remote_repository_health",
        {
            "workflow_job": "repo-health",
            "triggers": ["schedule", "workflow_dispatch"],
            "actions_secret": "REPO_HEALTH_TOKEN",
            "credential_type": "fine_grained_personal_access_token",
            "repository_scope": "LENKIN233/softbook_cet",
            "trusted_ref": "refs/heads/main",
            "secret_exposure_policy": "trusted_ref_remote_step_only",
            "untrusted_remote_ref_policy": "fail_closed_without_secret",
            "required_repository_permissions": [
                "Administration: read",
                "Actions: read",
            ],
            "required_repository_settings": required_repository_settings,
            "github_token_fallback_allowed": False,
            "missing_credential_policy": "fail_closed_with_explicit_diagnostic",
        },
        remote_repository_health,
    )
    check_equal(
        "ci_contract required_pull_request_gates",
        [
            {
                "id": "design_artifact_gate",
                "command": "python3 scripts/validate_pr_design_gate.py --base <base_sha> --head <head_sha>",
            },
            {
                "id": "validate_harness",
                "command": "python3 scripts/validate_harness.py --skip-remote-guard",
            },
            {
                "id": "mobile_ux_batch1_governance_regressions",
                "command": "node --check scripts/classify_formal_approval_scope.mjs && node --check scripts/lib/mobile_ux_batch1_governance_contract.mjs && node --check scripts/lib/mobile_ux_batch1_github_event_reader.mjs && node --check scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs && node --check scripts/lib/mobile_ux_batch1_successor_contract.mjs && node --check scripts/validate_mobile_ux_batch1_governance.mjs && node --check scripts/validate_mobile_ux_batch1_successor.mjs && node --test scripts/test_classify_formal_approval_scope.mjs scripts/test_mobile_ux_batch1_governance_contract.mjs scripts/test_mobile_ux_batch1_github_event_reader.mjs scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs scripts/test_validate_mobile_ux_batch1_governance.mjs scripts/test_mobile_ux_batch1_successor_contract.mjs",
            },
            {
                "id": "learning_events_contract_regressions",
                "command": "python3 scripts/test_learning_events_contract.py",
            },
            {
                "id": "launch_readiness_governance",
                "command": "node --test scripts/test_validate_launch_readiness.mjs && node scripts/validate_launch_readiness.mjs",
            },
            {
                "id": "maestro_selector_guard",
                "command": "python3 scripts/validate_maestro_selectors.py",
            },
            {
                "id": "agent_review_record",
                "command": "gh api repos/<repo>/pulls/<pr> --jq .body > <temp> && python3 scripts/validate_agent_review.py --body-file <temp>",
            },
            {
                "id": "mobile_lint",
                "command": "cd apps/mobile && npm run lint -- --quiet",
            },
            {
                "id": "mobile_typecheck",
                "command": "cd apps/mobile && npm run typecheck",
            },
            {
                "id": "mobile_test",
                "command": "cd apps/mobile && npm test -- --runInBand --watchAll=false",
            },
            {
                "id": "backend_contract_test",
                "command": "cd infra/cloudbase/functions/softbook-api && npm test",
            },
            {
                "id": "dependency_security",
                "command": "node scripts/validate_dependency_security.mjs",
            },
            {
                "id": "ios_release",
                "command": "cd apps/mobile && bundle install && git diff --exit-code -- Gemfile.lock && bundle exec pod install --project-directory=ios --deployment && xcodebuild Release simulator build and unsigned archive",
            },
            {
                "id": "android_release",
                "command": "cd apps/mobile && JDK 17 npm run android:release:unsigned && verify app-release-unsigned.apk exists",
            },
            {
                "id": "repository_health",
                "command": "node scripts/report_repo_health.mjs --base <base_sha> --strict",
            },
            {
                "id": "agent_run_evidence_archive",
                "command": "node --test scripts/test_validate_agent_run_evidence.mjs && node scripts/validate_agent_run_evidence.mjs --verify-remote",
            },
            {
                "id": "formal_product_owner_approval",
                "command": "trusted base classifier v2 -> trusted base decision validator when required -> protected GitHub Environment -> formal-approval status",
            },
        ],
        ci_contract["required_pull_request_gates"],
    )
    check_contains(
        "learning-events contract GitHub gate",
        workflow_text,
        "python3 scripts/test_learning_events_contract.py",
    )
    check_contains(
        "learning-events contract local gate",
        local_gate_catalog_text,
        '"learning-events-contract-tests"',
    )

    ap20 = find_by_id(harness["anti_patterns"], "AP-20")
    if ap20:
        check_equal("AP-20 name", "treat_main_as_normal_development_branch", ap20["name"])
        check_equal(
            "AP-20 correction",
            "main_is_read_only_integration_branch_and_topic_branches_are_required",
            ap20["correction"],
        )

    ap24 = find_by_id(harness["anti_patterns"], "AP-24")
    if ap24:
        check_equal(
            "AP-24 name",
            "treat_local_dirty_worktree_as_default_delivery_for_code_changes",
            ap24["name"],
        )
        check_equal(
            "AP-24 correction",
            "code_changes_default_to_topic_branch_commit_pull_request_unless_local_only_is_explicitly_requested",
            ap24["correction"],
        )

    ap25 = find_by_id(harness["anti_patterns"], "AP-25")
    if ap25:
        check_equal(
            "AP-25 name",
            "leave_reviewed_green_pull_request_waiting_for_explicit_merge_instruction",
            ap25["name"],
        )
        check_equal(
            "AP-25 correction",
            "open_or_update_pull_request_then_merge_after_clean_agent_review_and_green_required_gates",
            ap25["correction"],
        )

    ap26 = find_by_id(harness["anti_patterns"], "AP-26")
    if ap26:
        check_equal(
            "AP-26 name",
            "implement_user_facing_UI_directly_from_RN_or_agent_taste_without_design_artifact",
            ap26["name"],
        )
        check_equal(
            "AP-26 correction",
            "treat_existing_RN_as_behavior_prototype_and_require_accepted_design_artifact_before_user_facing_implementation",
            ap26["correction"],
        )

    ap27 = find_by_id(harness["anti_patterns"], "AP-27")
    if ap27:
        check_equal(
            "AP-27 name",
            "treat_interaction_motion_as_component_animation_afterthought",
            ap27["name"],
        )
        check_equal(
            "AP-27 correction",
            "design_core_interaction_operation_feedback_failure_and_motion_artifacts_before_implementation",
            ap27["correction"],
        )

    ap28 = find_by_id(harness["anti_patterns"], "AP-28")
    if ap28:
        check_equal(
            "AP-28 name",
            "treat_physical_space_as_surface_UI_without_spatial_model",
            ap28["name"],
        )
        check_equal(
            "AP-28 correction",
            "design_library_group_box_card_spatial_model_state_transitions_and_learning_space_continuity",
            ap28["correction"],
        )

    ap29 = find_by_id(harness["anti_patterns"], "AP-29")
    if ap29:
        check_equal(
            "AP-29 name",
            "use_task_local_design_brief_as_implementation_authority",
            ap29["name"],
        )
        check_equal(
            "AP-29 correction",
            "task_local_briefs_are_exploration_only_and_implementation_consumes_preexisting_accepted_artifacts",
            ap29["correction"],
        )

    ap31 = find_by_id(harness["anti_patterns"], "AP-31")
    if ap31:
        check_equal(
            "AP-31 name",
            "promote_first_generation_AI_design_without_search_or_pairwise_review",
            ap31["name"],
        )
        check_equal(
            "AP-31 correction",
            "run_design_evolution_with_context_pack_candidate_population_hard_filters_pairwise_review_fragment_harvest_targeted_mutation_and_promotion_record_before_acceptance",
            ap31["correction"],
        )

    design_search_read_path = harness["read_paths"].get("design_search_or_core_surface_optimization", [])
    for required in [
        "spec/visual-language.json",
        "docs/design/design-harness.md",
        "docs/design/search-runs/README.md",
        "accepted_baseline_artifact",
    ]:
        if required not in design_search_read_path:
            errors.append(f"agent-harness design_search read path missing {required}")

    design_search_task = harness["task_briefs"].get("design_search")
    if not design_search_task:
        errors.append("agent-harness missing design_search task brief")
    else:
        check_equal(
            "design_search outputs",
            [
                "context_pack",
                "candidate_population_with_provenance",
                "surviving_candidate_visual_evidence",
                "hard_filter_results",
                "pairwise_reviews",
                "fragment_harvest",
                "targeted_mutation_log",
                "promotion_record_or_no_promotion_reason",
                "failure_sedimentation_targets",
            ],
            design_search_task["outputs"],
        )

    hr19 = find_by_id(evals["regressions"], "HR-19")
    if hr19:
        check_equal(
            "HR-19 fail_signal",
            "allows_direct_main_development_or_treats_protection_as_doc_only",
            hr19["fail_signal"],
        )
        check_equal(
            "HR-19 must_hit",
            [
                "main_read_only_integration_branch",
                "topic_branch_required",
                "local_hooks_installed",
                "github_branch_protection",
            ],
            hr19["must_hit"],
        )

    gt14 = find_by_id(evals["golden_tasks"], "GT-14")
    if gt14:
        check_equal("GT-14 task", "定义 main 分支治理", gt14["task"])
        check_equal(
            "GT-14 must_include",
            [
                "main_read_only_integration_branch",
                "topic_branch_required",
                "local_hooks_installed",
                "github_branch_protection",
            ],
            gt14["must_include"],
        )

    hr23 = find_by_id(evals["regressions"], "HR-23")
    if hr23:
        check_equal(
            "HR-23 fail_signal",
            "keeps_code_changes_local_by_default_or_leaves_reviewed_green_pr_waiting_for_explicit_merge_instruction",
            hr23["fail_signal"],
        )
        check_equal(
            "HR-23 must_hit",
            [
                "topic_branch_default",
                "pull_request_default_unless_local_only",
                "handoff_branch_commit_validation_when_pr_blocked",
                "agent_review_before_merge",
                "agent_review_record_gate_before_merge",
                "auto_merge_after_clean_review_and_green_gates",
                "repository_auto_merge_setting_guarded",
            ],
            hr23["must_hit"],
        )

    gt17 = find_by_id(evals["golden_tasks"], "GT-17")
    if gt17:
        check_equal("GT-17 task", "定义代码交付与 PR 规则", gt17["task"])
        check_equal(
            "GT-17 must_include",
            [
                "topic_branch_commit_pull_request_agent_review_auto_merge_default",
                "local_only_must_be_explicit",
                "pull_request_body_contains_specs_summary_validation",
                "agent_review_before_merge",
                "agent_review_record_checked_by_required_gate",
                "merge_only_blocks_on_review_gate_or_permission_failure",
                "repository_auto_merge_must_be_enabled",
            ],
            gt17["must_include"],
        )

    hr24 = find_by_id(evals["regressions"], "HR-24")
    if hr24:
        check_equal(
            "HR-24 fail_signal",
            "starts_RN_or_CSS_implementation_without_design_artifact_source",
            hr24["fail_signal"],
        )
        check_equal(
            "HR-24 must_hit",
            [
                "design_artifact_required_before_implementation",
                "existing_RN_is_behavior_prototype_not_visual_authority",
                "design_source_named_in_PR",
                "implementation_maps_to_accepted_design",
            ],
            hr24["must_hit"],
        )

    hr25 = find_by_id(evals["regressions"], "HR-25")
    if hr25:
        check_equal(
            "HR-25 fail_signal",
            "treats_design_as_generic_UI_or_skips_interaction_motion_physical_space_evidence",
            hr25["fail_signal"],
        )
        check_equal(
            "HR-25 must_hit",
            [
                "surface_specific_accepted_artifact",
                "interaction_motion_artifact_for_learning_or_core_interaction_change",
                "physical_space_artifact_for_space_change",
                "design_review_checklist_answers",
                "implementation_mapping_and_unimplemented_gaps",
            ],
            hr25["must_hit"],
        )

    hr26 = find_by_id(evals["regressions"], "HR-26")
    if hr26:
        check_equal(
            "HR-26 fail_signal",
            "promotes_first_generation_AI_output_without_candidate_population_pairwise_review_fragment_harvest_or_mutation_log",
            hr26["fail_signal"],
        )
        check_equal(
            "HR-26 must_hit",
            [
                "design_evolution_engine_required_for_core_surface_optimization",
                "context_pack_shared_by_candidates",
                "candidate_population_with_provenance",
                "surviving_candidate_visual_evidence",
                "hard_filters_before_review",
                "non_empty_run_records_not_templates",
                "pairwise_review_not_single_aesthetic_score",
                "pairwise_visual_evidence_for_compared_candidates",
                "pairwise_coverage_for_candidate_population",
                "fragment_harvest_and_targeted_mutation",
                "promotion_record_before_accepted_artifact",
                "rendered_or_external_prototype_proof_required",
            ],
            hr26["must_hit"],
        )

    gt18 = find_by_id(evals["golden_tasks"], "GT-18")
    if gt18:
        check_equal("GT-18 task", "实现用户可见 UI", gt18["task"])
        check_equal(
            "GT-18 must_include",
            [
                "accepted_design_artifact_before_implementation",
                "design_source_and_mapping_in_PR",
                "visual_language_checklist_answered",
                "existing_RN_not_used_as_design_authority",
                "unimplemented_design_gaps_declared",
            ],
            gt18["must_include"],
        )

    gt19 = find_by_id(evals["golden_tasks"], "GT-19")
    if gt19:
        check_equal("GT-19 task", "定义软书设计体系", gt19["task"])
        check_equal(
            "GT-19 must_include",
            [
                "product_capability_systems_not_generic_UI_taxonomy",
                "learning_progression_system",
                "card_content_expression_system",
                "interaction_motion_system",
                "physical_space_system",
                "surface_experience_as_carrier",
                "visual_language_as_style_governance_not_product_owner",
                "artifact_lifecycle_to_rendered_mock_storyboard_mapping",
            ],
            gt19["must_include"],
        )

    gt20 = find_by_id(evals["golden_tasks"], "GT-20")
    if gt20:
        check_equal("GT-20 task", "定义 AI 如何迭代出更符合需求的核心设计内容", gt20["task"])
        check_equal(
            "GT-20 must_include",
            [
                "constraints_define_search_boundary",
                "candidate_population_not_single_output",
                "surviving_candidate_visual_evidence",
                "hard_filter_product_truth_and_layout_violations",
                "reject_placeholder_only_search_run_records",
                "pairwise_rank_surviving_candidates",
                "pairwise_visual_evidence_for_compared_candidates",
                "pairwise_coverage_scales_with_candidate_count",
                "fragment_harvest_before_synthesis",
                "targeted_mutation_from_named_failures",
                "promotion_record_with_rendered_proof",
                "failure_sedimentation_back_to_harness",
            ],
            gt20["must_include"],
        )

    p23 = find_by_id(perturbation_audit["perturbations"], "P-23")
    if p23:
        check_equal(
            "P-23 change",
            "Treat direct development or direct push on main as normal workflow",
            p23["change"],
        )
        check_equal(
            "P-23 guarded_by",
            ["spec/agent-harness.json", "spec/evals.json"],
            p23["guarded_by"],
        )

    p29 = find_by_id(perturbation_audit["perturbations"], "P-29")
    if p29:
        check_equal(
            "P-29 change",
            "Treat local dirty working tree as acceptable default delivery for code-changing tasks",
            p29["change"],
        )
        check_equal(
            "P-29 guarded_by",
            ["spec/repo-delivery-contract.json", "spec/agent-harness.json", "spec/evals.json"],
            p29["guarded_by"],
        )

    p30 = find_by_id(perturbation_audit["perturbations"], "P-30")
    if p30:
        check_equal(
            "P-30 change",
            "Leave a reviewed green pull request waiting for explicit user merge instruction",
            p30["change"],
        )
        check_equal(
            "P-30 guarded_by",
            ["spec/repo-delivery-contract.json", "spec/agent-harness.json", "spec/evals.json"],
            p30["guarded_by"],
        )

    p31 = find_by_id(perturbation_audit["perturbations"], "P-31")
    if p31:
        check_equal(
            "P-31 change",
            "Merge a pull request before agent review finishes or while required gates are red",
            p31["change"],
        )
        check_equal(
            "P-31 guarded_by",
            ["spec/repo-delivery-contract.json", "spec/agent-harness.json", "spec/evals.json"],
            p31["guarded_by"],
        )

    p32 = find_by_id(perturbation_audit["perturbations"], "P-32")
    if p32:
        check_equal(
            "P-32 change",
            "Implement user-facing UI directly from RN code or agent taste without an accepted design artifact",
            p32["change"],
        )
        check_equal(
            "P-32 guarded_by",
            ["spec/visual-language.json", "spec/repo-delivery-contract.json", "spec/agent-harness.json", "spec/evals.json"],
            p32["guarded_by"],
        )

    p33 = find_by_id(perturbation_audit["perturbations"], "P-33")
    if p33:
        check_equal(
            "P-33 change",
            "Use a task-local design brief as the authority for the same implementation PR",
            p33["change"],
        )
        check_equal(
            "P-33 guarded_by",
            ["spec/repo-delivery-contract.json", "spec/visual-language.json", "scripts/validate_pr_design_gate.py"],
            p33["guarded_by"],
        )

    p34 = find_by_id(perturbation_audit["perturbations"], "P-34")
    if p34:
        check_equal(
            "P-34 change",
            "Treat core interaction motion as decorative animation added after UI implementation",
            p34["change"],
        )
        check_equal(
            "P-34 guarded_by",
            ["spec/interactions.json", "spec/agent-harness.json", "spec/evals.json"],
            p34["guarded_by"],
        )

    p35 = find_by_id(perturbation_audit["perturbations"], "P-35")
    if p35:
        check_equal(
            "P-35 change",
            "Treat physical space as a normal page UI without a spatial model or state transitions",
            p35["change"],
        )
        check_equal(
            "P-35 guarded_by",
            ["spec/knowledge-map.json", "spec/space-operations.json", "spec/agent-harness.json", "spec/evals.json"],
            p35["guarded_by"],
        )

    p36 = find_by_id(perturbation_audit["perturbations"], "P-36")
    if p36:
        check_equal(
            "P-36 change",
            "Treat agent review as an unrecorded convention outside required PR gates",
            p36["change"],
        )
        check_equal(
            "P-36 guarded_by",
            ["spec/repo-delivery-contract.json", "spec/agent-harness.json", "spec/evals.json", "scripts/validate_agent_review.py"],
            p36["guarded_by"],
        )

    p37 = find_by_id(perturbation_audit["perturbations"], "P-37")
    if p37:
        check_equal(
            "P-37 change",
            "Promote the first AI-generated core-surface design as accepted without search, pairwise review, fragment harvest, targeted mutation, or promotion evidence",
            p37["change"],
        )
        check_equal(
            "P-37 guarded_by",
            ["docs/design/design-harness.md", "docs/design/search-runs/README.md", "spec/agent-harness.json", "spec/evals.json", "scripts/validate_design_search_run.py"],
            p37["guarded_by"],
        )

    p38 = find_by_id(perturbation_audit["perturbations"], "P-38")
    if p38:
        check_equal(
            "P-38 change",
            "Let a design search run pass with copied templates, one pairwise review, surviving candidates without visual evidence, pairwise reviews without visual evidence, or a promotion record that only names proof text without proof artifacts",
            p38["change"],
        )
        check_equal(
            "P-38 guarded_by",
            ["docs/design/search-runs/README.md", "scripts/validate_design_search_run.py", "scripts/validate_harness.py"],
            p38["guarded_by"],
        )

    agents_text = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for snippet in [
        "`main` 是只读集成分支，不要直接在 `main` 上开发、提交、合并或推送",
        "开发前先切到 `infra/*`、`shell/*`、`module/*`、`cross/*` 或 `fix/*`",
        "clone 或新增 worktree 后先运行 `./scripts/install_git_hooks.sh`",
        "若发现本地 hooks 或 GitHub `main` 保护漂移，先修治理再继续功能开发",
        "任何会持久化仓库改动的任务，除非用户明确要求只做本地修改，否则默认在 topic branch 上完成提交、开/更新指向 `main` 的 PR，并在 agent review 通过、PR 描述记录 passed review 且 required gates 全绿后自动合并",
        "未完成 agent review、PR 描述未记录 passed review、required gates 未全绿，或权限/环境阻止 merge 时，不要提前合并到 `main`",
        "如果权限或环境阻止创建 PR，必须明确交付 branch、commit、验证结果与阻塞原因",
        "不要直接用 RN 代码、截图或 agent 个人审美定义用户可见设计；任何呈现给用户的 screen / component / state / chrome 都必须先有已接受设计稿或等价设计基准，再进入实现",
        "不要用同一 PR 内新增 / 修改的 design brief、direction 或 decision 为同一 PR 的用户可见 UI 实现背书；同 PR 设计稿只适用于 design-only PR",
        "不要把 task-local design brief 当作 implementation PR 的正式设计权威；它只能作为探索草稿",
        "不要把核心交互 / 小动效当作 UI 完成后的装饰；Learning 或核心交互实现必须先有 interaction/motion artifact 或 storyboard",
        "不要把物理空间当作普通页面 UI；Space 实现必须先有 spatial model / state transition / Learning ↔ Space 连续性 artifact",
        "不要把 `scripts/run_local_gates` 的本地报告当作 GitHub required checks、Agent review、正式内容批准或 launch readiness",
        "同级外部内容工作区：`/Users/lenkin/programing/card make`（卡片候选内容生产与审批边界；本仓库只消费其导出的卡片 payload）",
        "卡片内容交接：`requirement-memory -> product-core -> card-system -> box-catalog -> runtime-boundaries -> agent-harness -> infra/cloudbase/mobile-runtime-contract.md -> /Users/lenkin/programing/card make`",
        "不要在 `softbook_cet` 内生产候选卡片内容、批准卡片批次或把 dev seed cards 当作正式内容量；候选内容生产和审批发生在同级 `/Users/lenkin/programing/card make`，本仓库只接收其导出的 payload、dry-run/import、audit、runtime smoke 和报告 coverage delta",
        "若任务包含持久化仓库改动，PR 描述必须包含引用 spec、变更摘要、验证、Agent review 与 Agent run record；若涉及用户可见 UI，必须写明设计稿来源、interaction/motion 或 physical-space artifact（如适用）、实现映射与未实现 gap，并回答 design review checklist；默认在 review + gate 通过后自动收口合并",
    ]:
        check_contains("AGENTS governance mirror", agents_text, snippet)

    branching_text = (ROOT / "docs/branching-strategy.md").read_text(encoding="utf-8")
    check_contains("branching strategy references evals", branching_text, "- `spec/evals.json`")
    check_contains(
        "branching strategy references repo-delivery-contract",
        branching_text,
        "- `spec/repo-delivery-contract.json`",
    )
    check_contains(
        "branching strategy validate_harness mention",
        branching_text,
        "`python3 scripts/validate_harness.py` 会同时检查 hooksPath、hook wrapper 分发、以及 GitHub 上 `main` 的 branch protection 是否仍然符合 harness 合同。",
    )
    for snippet in [
        "会持久化 repo 改动的任务默认走 `topic branch -> commit -> PR(main)`。",
        "若用户明确要求只做本地修改，才允许停在本地 handoff，不开 PR。",
        "PR 创建后，默认在 agent review 通过、PR body 留下可校验 review 记录与 `docs/agent-runs/*.md` 运行记录引用、且 required gates 全绿时自动合并到 `main`。",
        "GitHub 仓库必须启用 auto-merge，并在合并后自动删除 topic branch；远端健康检查与完整 Harness 都会失败关闭配置漂移。",
        "只有当 agent review 有 blocking 结论、required gates 未通过，或权限 / 环境阻止 merge 时，才停在 PR handoff。",
        "如果权限或环境阻止创建 PR，至少要明确交付 branch、commit、验证结果与阻塞原因。",
        "涉及用户可见 UI 的分支，必须先引用已接受设计稿 / reference / design brief / direction / decision，再做实现；同一 PR 内新增的 brief / direction / decision 只能满足 design-only PR。",
        "Learning / core interaction UI 分支必须引用 interaction-motion artifact 或 storyboard；Space UI 分支必须引用 physical-space artifact 和 Space visual proof / refinement / shelf-desk baseline；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。",
        "`.github/pull_request_template.md` 要求 PR 描述包含：`当前任务引用的 spec`、`变更摘要`、`验证`、`Agent review`、`Agent run record`；若涉及用户可见 UI，必须补 `设计稿来源（用户可见 UI 如适用）`、interaction/motion 或 physical-space artifact（如适用）、实现映射、未实现 gap，并回答 `design_review_checklist（如适用）`。",
        "`.github/workflows/pr-gates.yml` 会在指向 `main` 的 PR 上运行 `python3 scripts/validate_pr_design_gate.py --base <base_sha> --head <head_sha>`、`python3 scripts/test_validate_harness_runner.py`、`python3 scripts/test_learning_events_contract.py`、`python3 scripts/test_run_local_gates.py`、`python3 scripts/test_harness_module_boundaries.py`、`node --test scripts/test_check_design_metadata_leaks.mjs`、`python3 scripts/validate_harness.py --skip-remote-guard`、`python3 scripts/validate_maestro_selectors.py`、`python3 scripts/validate_agent_review.py`、`cd apps/mobile && npm run lint -- --quiet`、`cd apps/mobile && npm run typecheck`、`cd apps/mobile && npm test -- --runInBand --watchAll=false`、`cd infra/cloudbase/functions/softbook-api && npm test`。",
        "merge 的默认前置条件是：agent review 无 blocking finding，PR body 中 `Agent review` 已记录为 passed，`Agent run record` 已引用 `docs/agent-runs/*.md`，且 required gates 全绿。",
    ]:
        check_contains("branching strategy delivery mirror", branching_text, snippet)

    readme_text = (ROOT / "README.md").read_text(encoding="utf-8")
    check_contains(
        "README validate_harness scope",
        readme_text,
        "- `scripts/validate_harness.py`: harness 校验脚本（spec owner 一致性 + main 分支治理护栏 + Maestro selector 防回归）",
    )
    check_contains(
        "README hook install guidance",
        readme_text,
        "clone 或新增 worktree 后先运行 `./scripts/install_git_hooks.sh`，再执行 `python3 scripts/validate_harness.py` 确认本地 hooks 与 GitHub `main` 保护都仍然生效。",
    )
    for snippet in [
        "- `spec/repo-delivery-contract.json`",
        "- `spec/visual-language.json`",
        "- `.github/workflows/pr-gates.yml`: PR 质量门禁（design artifact gate + harness/learning-events contract 回归 + Maestro selector guard + agent review / agent run record 记录 + mobile quality + backend contract）",
        "- `scripts/validate_agent_review.py`: PR body agent review 与 agent run record 记录校验（merge 前必须记录 passed review、无阻塞问题，并引用 `docs/agent-runs/*.md`）",
        "- `scripts/validate_maestro_selectors.py`: Maestro smoke selector 校验（禁止用用户可见文案作为 `tapOn` / `assertVisible` 等 selector，并要求 id 有 RN `testID` 背书）",
        "- `.github/pull_request_template.md`: PR 合同模板（spec / 摘要 / 验证 / agent run record / 视觉 checklist）",
        "- `docs/design/directions/` / `docs/design/interaction-motion/` / `docs/design/physical-space/` / `docs/design/mocks/` / `docs/design/storyboards/`: 核心方向、交互、动效、空间模型、视觉稿和 storyboard artifact 入口",
        "任何会持久化仓库改动的任务，除非明确要求只做本地修改，否则默认走 topic branch -> commit -> PR -> agent review 记录 + agent run record -> merge；只有 review / gate / 权限失败时才停在 PR 或 branch handoff。",
        "任何用户可见 UI 改动都必须先引用已接受设计稿 / reference / design brief / direction / decision，并在 PR 中写明设计稿来源、实现映射和未实现设计缺口；同一 PR 内新增的 brief / direction / decision 只能满足 design-only PR。",
        "Learning / core interaction UI 改动还必须引用 interaction-motion artifact 或 storyboard；Space UI 改动还必须引用 physical-space artifact 和 Space visual proof / refinement / shelf-desk baseline；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。",
    ]:
        check_contains("README delivery mirror", readme_text, snippet)

    gitignore_text = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for snippet in ["__pycache__/", "*.py[cod]", ".tmp/"]:
        check_contains("gitignore harness runtime artifacts", gitignore_text, snippet)

    # Agent run record PR template snippets: ## Agent run record | - Run record: N/A | docs/agent-runs/
