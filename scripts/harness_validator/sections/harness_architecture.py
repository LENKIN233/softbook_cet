harness_architecture_spec = load("harness-architecture.json")

check_equal("harness architecture version", "vnext-1", harness_architecture_spec["version"])
check_equal("harness architecture layer", "repo_governance_truth", harness_architecture_spec["layer"])

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
]:
    check_contains("harness runner layered architecture", runner_text, snippet)

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
    ]:
        if output not in architecture_task.get("outputs", []):
            errors.append(f"harness_architecture task brief missing output: {output}")

for anti_pattern_id in ["AP-37", "AP-38"]:
    if not find_by_id(harness["anti_patterns"], anti_pattern_id):
        errors.append(f"agent harness missing harness architecture anti-pattern: {anti_pattern_id}")

for regression_id in ["HR-31", "HR-32"]:
    if not find_by_id(evals["regressions"], regression_id):
        errors.append(f"evals missing harness architecture regression: {regression_id}")

if not find_by_id(evals["golden_tasks"], "GT-24"):
    errors.append("evals missing harness architecture golden task: GT-24")
