harness_architecture_spec = load("harness-architecture.json")

check_equal("harness architecture version", "vnext-2", harness_architecture_spec["version"])
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
    "harness runner section dependencies",
    {"delivery_runtime": ["governance_contracts"]},
    runner_contract["section_dependencies"],
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
    "run_harness",
    "harness-result.v1",
    "check_failure",
    "exception",
    "HARNESS COMPLETENESS PARTIAL",
    "HARNESS_REMOTE_GUARD_EXECUTED",
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
        "test_multiple_legacy_errors_are_attributed_to_their_section",
        "test_replaced_or_mutated_error_collection_cannot_hide_findings",
        "test_section_selection_expands_declared_shared_environment_dependencies",
        "test_json_result_has_stable_schema_and_structured_findings",
        "test_local_mode_is_injected_without_remote_guard_access",
        "test_local_cli_does_not_invoke_gh_and_full_reports_unavailable_github",
        "test_partial_cli_commands_cannot_satisfy_full_pr_validation",
    ]:
        check_contains("Harness runner unit coverage", runner_test_text, snippet)

for section in harness_architecture_spec["runner_section_order"]:
    section_file = ROOT / "scripts/harness_validator/sections" / f"{section}.py"
    if not section_file.exists():
        errors.append(f"harness architecture references missing section: {section}")

pure_forbidden_snippets = [
    "run_command(",
    "subprocess.",
    "tempfile.",
    "TemporaryDirectory",
    "gh api",
    "git ",
]
for section in harness_architecture_spec["pure_sections"]:
    if section == "harness_architecture":
        continue
    section_file = ROOT / "scripts/harness_validator/sections" / f"{section}.py"
    if not section_file.exists():
        continue
    section_text = section_file.read_text(encoding="utf-8")
    for forbidden in pure_forbidden_snippets:
        if forbidden in section_text:
            errors.append(f"pure harness section {section} must not contain side-effect marker: {forbidden}")

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
    ]:
        if output not in architecture_task.get("outputs", []):
            errors.append(f"harness_architecture task brief missing output: {output}")

for anti_pattern_id in ["AP-37", "AP-38"]:
    if not find_by_id(harness["anti_patterns"], anti_pattern_id):
        errors.append(f"agent harness missing harness architecture anti-pattern: {anti_pattern_id}")

if not find_by_id(harness_architecture_spec["anti_patterns"], "HA-AP-04"):
    errors.append("harness architecture missing partial-result anti-pattern: HA-AP-04")

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
    ]:
        if expected not in golden_task["must_include"]:
            errors.append(f"GT-24 missing structured runner expectation: {expected}")

runner_regression = find_by_id(evals["regressions"], "HR-31")
if runner_regression:
    for expected in [
        "no_argument_runner_executes_full_remote_validation",
        "local_or_selected_runner_reports_partial_completeness",
        "section_exception_does_not_suppress_later_diagnostics",
    ]:
        if expected not in runner_regression["must_hit"]:
            errors.append(f"HR-31 missing structured runner expectation: {expected}")
