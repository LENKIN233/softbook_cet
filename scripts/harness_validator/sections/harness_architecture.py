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
    manifest = load("doc-manifest.json")
    evals = load("evals.json")

    harness_architecture_spec = load("harness-architecture.json")

    check_equal("harness architecture version", "vnext-3", harness_architecture_spec["version"])
    check_equal("harness architecture layer", "repo_governance_truth", harness_architecture_spec["layer"])

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
        {"delivery_runtime": ["governance_contracts"]},
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
        "harness capability enforcement",
        {
            "implementation": "scripts/harness_validator/capability_ast.py",
            "read_only_profile_forbidden_imports_and_calls": True,
            "legacy_design_remote_commands_forbidden": True,
            "runtime_smoke_sections_forbidden": True,
            "executable_top_level_statements_forbidden": True,
            "validate_context_signature_required": True,
        },
        runner_contract["capability_enforcement"],
    )
    check_equal(
        "harness transitional legacy adapter",
        {
            "section": "design_governance",
            "implementation": "scripts/harness_validator/legacy.py",
            "only_allowed_exec_path": True,
            "removal_gate": "split_design_governance_modules_and_migrate_agent_review_regressions",
        },
        runner_contract["transitional_legacy_adapter"],
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
            "test_remote_guard_aggregation_never_leaks_worker_protocol_fields",
            "test_section_selection_expands_declared_logical_prerequisites",
            "test_json_result_has_stable_schema_and_structured_findings",
            "test_local_mode_is_injected_without_remote_guard_access",
            "test_local_cli_does_not_invoke_gh_and_full_reports_unavailable_github",
            "test_partial_cli_commands_cannot_satisfy_full_pr_validation",
        ]:
            check_contains("Harness runner unit coverage", runner_test_text, snippet)

    legacy_section = runner_contract["transitional_legacy_adapter"]["section"]
    for section in harness_architecture_spec["runner_section_order"]:
        section_file = ROOT / "scripts/harness_validator/sections" / f"{section}.py"
        if not section_file.exists():
            errors.append(f"harness architecture references missing section: {section}")
        elif section != legacy_section:
            check_contains(
                f"Harness section {section} explicit interface",
                section_file.read_text(encoding="utf-8"),
                "def validate(context) -> None:",
            )

    implementation_snippets = {
        "scripts/harness_validator/context.py": [
            "class ReadOnlyContext",
            "class DeliveryContext",
            "section == \"delivery_runtime\"",
            "delivery command is not allowlisted",
        ],
        "scripts/harness_validator/capability_ast.py": [
            "READ_ONLY_SECTIONS",
            "runtime_smoke_layer is delegated to CI",
            "legacy design section invokes forbidden remote command",
            "executable top-level statement is forbidden",
        ],
        "scripts/harness_validator/section_worker.py": [
            "load_validate",
            "validate_legacy_design",
            '"remote_guard_executed": context.remote_guard_executed',
        ],
        "scripts/harness_validator/legacy.py": [
            "def validate_legacy_design",
            "exec(code, env)",
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
            "test_all_migrated_real_sections_have_valid_module_boundaries",
            "test_each_pure_layer_rejects_an_owner_contract_break",
            "test_delivery_layer_rejects_mutating_command_capability",
            "test_design_layer_rejects_remote_command_during_legacy_transition",
            "test_runtime_smoke_layer_rejects_runnable_harness_section",
            "test_executable_top_level_statement_is_rejected",
            "test_validate_signature_rejects_definition_time_execution_hooks",
            "test_read_only_context_exposes_no_command_or_temporary_capability",
            "test_exec_call_exists_only_in_legacy_adapter",
        ]:
            check_contains("Harness module boundary coverage", boundary_test_text, snippet)

    runtime_layer = next(
        (layer for layer in harness_architecture_spec["layers"] if layer["id"] == "runtime_smoke_layer"),
        None,
    )
    if runtime_layer:
        if runtime_layer.get("sections") != []:
            errors.append("runtime_smoke_layer must remain delegated to CI jobs, not validate_harness sections")
        for job in ["backend-contract", "mobile-quality"]:
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
            "section_timeout_isolation",
            "transitional_design_legacy_adapter",
        ]:
            if output not in architecture_task.get("outputs", []):
                errors.append(f"harness_architecture task brief missing output: {output}")

    for anti_pattern_id in ["AP-37", "AP-38"]:
        if not find_by_id(harness["anti_patterns"], anti_pattern_id):
            errors.append(f"agent harness missing harness architecture anti-pattern: {anti_pattern_id}")

    if not find_by_id(harness_architecture_spec["anti_patterns"], "HA-AP-04"):
        errors.append("harness architecture missing partial-result anti-pattern: HA-AP-04")
    if not find_by_id(harness_architecture_spec["anti_patterns"], "HA-AP-05"):
        errors.append("harness architecture missing isolated-module anti-pattern: HA-AP-05")

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
            "declared_transitional_design_legacy_adapter",
        ]:
            if expected not in golden_task["must_include"]:
                errors.append(f"GT-24 missing structured runner expectation: {expected}")

    runner_regression = find_by_id(evals["regressions"], "HR-31")
    if runner_regression:
        for expected in [
            "no_argument_runner_executes_full_remote_validation",
            "local_or_selected_runner_reports_partial_completeness",
            "section_exception_does_not_suppress_later_diagnostics",
            "non_legacy_sections_export_validate_context",
            "each_selected_section_runs_in_an_isolated_worker",
            "section_timeout_is_attributed_and_does_not_suppress_later_diagnostics",
            "design_governance_is_the_only_declared_transitional_legacy_adapter",
        ]:
            if expected not in runner_regression["must_hit"]:
                errors.append(f"HR-31 missing structured runner expectation: {expected}")

    capability_regression = find_by_id(evals["regressions"], "HR-32")
    if capability_regression:
        for expected in [
            "pure_layers_no_subprocess_or_remote_reads",
            "read_only_context_and_ast_capability_enforcement",
            "runtime_tests_stay_in_ci_jobs",
        ]:
            if expected not in capability_regression["must_hit"]:
                errors.append(f"HR-32 missing capability-boundary expectation: {expected}")
