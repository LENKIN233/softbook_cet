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

    agent_run_record = load("agent-run-record.json")

    check_equal("agent run record version", "vnext-1", agent_run_record["version"])
    check_equal("agent run record layer", "repo_governance_truth", agent_run_record["layer"])

    if "spec/agent-run-record.json" not in manifest["active_specs"]:
        errors.append("doc manifest active_specs must include spec/agent-run-record.json")

    for doc_path in [
        "docs/agent-runs/README.md",
        "docs/agent-runs/TEMPLATE.md",
    ]:
        if not any(doc["path"] == doc_path for doc in manifest["active_documents"]):
            errors.append(f"doc manifest active_documents must include {doc_path}")
        if not (ROOT / doc_path).exists():
            errors.append(f"agent run record document missing: {doc_path}")

    run_record_domain = authority["domains"].get("agent_run_records")
    if not run_record_domain:
        errors.append("authority map must define agent_run_records")
    else:
        check_equal(
            "agent run records owner",
            "spec/agent-run-record.json",
            run_record_domain.get("owner"),
        )

    if "Agent run record" not in delivery["pull_request_contract"]["required_body_sections"]:
        errors.append("repo delivery contract must require an Agent run record PR section")

    readme_text = (ROOT / "docs/agent-runs/README.md").read_text(encoding="utf-8")
    template_text = (ROOT / "docs/agent-runs/TEMPLATE.md").read_text(encoding="utf-8")
    for snippet in [
        "docs/agent-runs/YYYY-MM-DD-<short-slug>.md",
        "## Agent run record",
        "- Run record: docs/agent-runs/YYYY-MM-DD-<short-slug>.md",
        "Do not include hidden chain-of-thought",
    ]:
        check_contains("agent run records README", readme_text, snippet)

    for heading in [
        "## Task summary",
        "## Referenced specs",
        "## Product truth used",
        "## Implementation hypothesis changed",
        "## Workspace boundary and read scope",
        "## Files changed",
        "## Commands run",
        "## Validation results",
        "## Agent review status",
        "## User-visible UI impact",
        "## Card make external workspace impact",
        "## Risks and open questions",
        "## Follow-up",
    ]:
        check_contains("agent run record template heading", template_text, heading)

    pr_template_text = (ROOT / ".github/pull_request_template.md").read_text(encoding="utf-8")
    for snippet in [
        "## Agent run record",
        "- Run record: N/A",
        "docs/agent-runs/",
    ]:
        check_contains("PR template agent run record section", pr_template_text, snippet)

    agent_review_text = (ROOT / "scripts/validate_agent_review.py").read_text(encoding="utf-8")
    for snippet in [
        '"Agent run record"',
        'line_value(body, "Run record")',
        'docs/agent-runs/',
        "PR body must reference a committed agent run record",
    ]:
        check_contains("agent review run record gate", agent_review_text, snippet)

    run_record_read_path = harness["read_paths"].get("agent_run_record_or_context_handoff", [])
    for required_path in [
        "spec/authority-map.json",
        "spec/agent-run-record.json",
        "spec/workspace-boundary.json",
        "spec/harness-architecture.json",
        "spec/agent-harness.json",
        "spec/repo-delivery-contract.json",
        "spec/evals.json",
    ]:
        if required_path not in run_record_read_path:
            errors.append(f"agent run record read path must include {required_path}")

    run_record_task = harness["task_briefs"].get("agent_run_record")
    if not run_record_task:
        errors.append("agent harness must define agent_run_record task brief")
    else:
        for output in [
            "referenced_specs",
            "workspace_boundary_and_read_scope",
            "validation_results",
            "risks_and_follow_up",
        ]:
            if output not in run_record_task.get("outputs", []):
                errors.append(f"agent_run_record task brief missing output: {output}")

    for anti_pattern_id in ["AP-39", "AP-40"]:
        if not find_by_id(harness["anti_patterns"], anti_pattern_id):
            errors.append(f"agent harness missing agent run record anti-pattern: {anti_pattern_id}")

    for regression_id in ["HR-33", "HR-34"]:
        if not find_by_id(evals["regressions"], regression_id):
            errors.append(f"evals missing agent run record regression: {regression_id}")

    if not find_by_id(evals["golden_tasks"], "GT-25"):
        errors.append("evals missing agent run record golden task: GT-25")
