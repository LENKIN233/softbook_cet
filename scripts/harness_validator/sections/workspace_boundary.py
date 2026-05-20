workspace_boundary = load("workspace-boundary.json")

check_equal("workspace boundary version", "vnext-1", workspace_boundary["version"])
check_equal(
    "workspace boundary layer",
    "implementation_hypothesis_with_repo_governance_truth",
    workspace_boundary["layer"],
)

for classification in [
    "active_truth",
    "source",
    "design_authority",
    "runtime_contract",
    "generated",
    "dependency_vendor",
    "cache_or_machine_local",
    "archive",
    "external_workspace",
]:
    if classification not in workspace_boundary["classification"]:
        errors.append(f"workspace boundary missing classification: {classification}")

for blocked_classification in [
    "generated",
    "dependency_vendor",
    "cache_or_machine_local",
    "archive",
    "external_workspace",
]:
    if blocked_classification not in workspace_boundary["agent_read_policy"]["do_not_default_read"]:
        errors.append(f"workspace boundary must block default read for: {blocked_classification}")

if "spec/workspace-boundary.json" not in manifest["active_specs"]:
    errors.append("doc manifest active_specs must include spec/workspace-boundary.json")

workspace_domain = authority["domains"].get("workspace_boundary_and_agent_context")
if not workspace_domain:
    errors.append("authority map must define workspace_boundary_and_agent_context")
else:
    check_equal(
        "workspace boundary owner",
        "spec/workspace-boundary.json",
        workspace_domain.get("owner"),
    )

workspace_read_path = harness["read_paths"].get("workspace_boundary_or_repo_structure", [])
for required_path in [
    "spec/authority-map.json",
    "spec/workspace-boundary.json",
    "spec/agent-harness.json",
    "spec/repo-delivery-contract.json",
    "spec/evals.json",
]:
    if required_path not in workspace_read_path:
        errors.append(f"workspace boundary read path must include {required_path}")

workspace_task = harness["task_briefs"].get("workspace_boundary")
if not workspace_task:
    errors.append("agent harness must define workspace_boundary task brief")
else:
    for output in [
        "active_truth_source_and_contract_scope",
        "excluded_generated_dependency_cache_archive_scope",
        "external_workspace_boundary_if_any",
    ]:
        if output not in workspace_task.get("outputs", []):
            errors.append(f"workspace_boundary task brief missing output: {output}")

for anti_pattern_id in ["AP-35", "AP-36"]:
    if not find_by_id(harness["anti_patterns"], anti_pattern_id):
        errors.append(f"agent harness missing workspace boundary anti-pattern: {anti_pattern_id}")

for regression_id in ["HR-29", "HR-30"]:
    if not find_by_id(evals["regressions"], regression_id):
        errors.append(f"evals missing workspace boundary regression: {regression_id}")

for golden_task_id in ["GT-23"]:
    if not find_by_id(evals["golden_tasks"], golden_task_id):
        errors.append(f"evals missing workspace boundary golden task: {golden_task_id}")

gitignore_text = (ROOT / ".gitignore").read_text(encoding="utf-8")
mobile_gitignore_text = (ROOT / "apps/mobile/.gitignore").read_text(encoding="utf-8")
for snippet in [
    ".DS_Store",
    "__pycache__/",
    "*.py[cod]",
    ".tmp/",
]:
    check_contains("root gitignore workspace boundary", gitignore_text, snippet)

for snippet in [
    "node_modules/",
    "build/",
    "**/Pods/",
    "DerivedData",
    ".metro-health-check*",
]:
    check_contains("mobile gitignore workspace boundary", mobile_gitignore_text, snippet)
