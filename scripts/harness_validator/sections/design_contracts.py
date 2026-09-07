from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    check_contains = context.check_contains

    design_quarantine_text = (ROOT / "docs/design/design-quarantine.md").read_text(encoding="utf-8")
    for snippet in [
        "Any design artifact that leaks such metadata is not design authority.",
        "accepted_authority",
        "candidate_exploration",
        "quarantined",
        "rejected",
        "agent",
        "harness",
        "validator",
        "runtime contract",
        "raw exception names",
        "Implementation PRs must not consume quarantined artifacts.",
    ]:
        check_contains("design quarantine contract", design_quarantine_text, snippet)

    visual_language_text = (ROOT / "spec/visual-language.json").read_text(encoding="utf-8")
    for snippet in [
        "user_visible_metadata_leakage_is_blocker",
        "single_card_flow_is_operable_focused_flow",
        "VL-AP-10",
        "VL-AP-11",
        "docs/design/design-quarantine.md",
        "docs/design/single-card-ux-contract.md",
    ]:
        check_contains("visual language quarantine and single-card gate", visual_language_text, snippet)

    agent_harness_text = (ROOT / "spec/agent-harness.json").read_text(encoding="utf-8")
    for snippet in [
        "AP-33",
        "AP-34",
        "quarantine_or_repair_any_design_artifact_before_UI_implementation",
        "define_current_card_primary_task_primary_action_feedback_recovery_and_space_continuity_before_visual_implementation",
    ]:
        check_contains("agent harness design quarantine anti-patterns", agent_harness_text, snippet)

    evals_text = (ROOT / "spec/evals.json").read_text(encoding="utf-8")
    for snippet in [
        "HR-27",
        "HR-28",
        "GT-21",
        "GT-22",
        "metadata_leakage_is_delivery_blocker",
        "single_card_flow_is_operable_focused_flow_not_one_screen_cram",
    ]:
        check_contains("evals design quarantine regressions", evals_text, snippet)
