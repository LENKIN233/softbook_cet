#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "spec"
errors = []
SKIP_REMOTE_GUARD = "--skip-remote-guard" in sys.argv


def load(name: str):
    return json.loads((SPEC / name).read_text(encoding="utf-8"))


def check_equal(label, expected, actual):
    if expected != actual:
        errors.append(f"{label}: expected {expected!r}, got {actual!r}")


def check_contains(label, text, expected):
    if expected not in text:
        errors.append(f"{label}: missing exact snippet {expected!r}")


def find_by_id(entries, entry_id):
    for entry in entries:
        if entry["id"] == entry_id:
            return entry

    errors.append(f"missing entry id: {entry_id}")
    return None


def run_command(*args):
    try:
        return subprocess.run(
            args,
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        errors.append(f"missing required command: {args[0]}")
        return None


def run_design_gate_case(body: str, changed_files: list[str]):
    args = [sys.executable, str(ROOT / "scripts" / "validate_pr_design_gate.py")]
    for changed_file in changed_files:
        args.extend(["--changed-file", changed_file])

    return subprocess.run(
        args,
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "PR_BODY": body},
    )


req = load("requirement-memory.json")
auth = load("account-sync-contract.json")
platform = load("platform-contract.json")
product = load("product-core.json")
membership = load("membership.json")
delivery = load("repo-delivery-contract.json")
interactions = load("interactions.json")
manifest = load("doc-manifest.json")
authority = load("authority-map.json")
harness = load("agent-harness.json")
evals = load("evals.json")
perturbation_audit = load("perturbation-audit.json")

literal_source_anchors = {
    "login_gate": "必须登入",
    "primary_login_method": "手机号+验证码",
    "purchase_authority": "web与app购买同权",
    "top_level_navigation": "三端信息架构导航是一致的：学习 空间 统计 我的",
    "audio_presentation_policy": "不自动播放，没有字幕（背面可以有）",
    "default_learning_path": "建议用户按照我们拟定的顺序学习，不建议用户按模块学习",
}


def anchor_texts(*keys):
    return [literal_source_anchors[key] for key in keys]


# Manifest targets exist.
for doc in manifest["active_documents"]:
    rel = doc["path"]
    if not (ROOT / rel).exists():
        errors.append(f"manifest missing active document target: {rel}")

for rel in manifest["active_specs"]:
    if not (ROOT / rel).exists():
        errors.append(f"manifest missing target: {rel}")

# Migration artifacts should not stay active.
for legacy in ["spec/legacy-map.json", "spec/legacy-triage.json"]:
    if legacy in manifest["active_specs"]:
        errors.append(f"legacy artifact still active: {legacy}")

if "spec/repo-delivery-contract.json" not in manifest["active_specs"]:
    errors.append("manifest missing active spec: spec/repo-delivery-contract.json")

# Authority owners must exist.
for domain, meta in authority["domains"].items():
    for key in ["owner", "related_owner"]:
        if key in meta and not (ROOT / meta[key]).exists():
            errors.append(f"authority-map missing {key} target for {domain}: {meta[key]}")
    for mirror in meta.get("mirrors", []):
        if not (ROOT / mirror).exists():
            errors.append(f"authority-map missing mirror target for {domain}: {mirror}")


# Literal source anchors must remain verbatim across raw memory, owner specs, evals, and drift guards.
check_equal(
    "requirement-memory source anchor login_gate",
    literal_source_anchors["login_gate"],
    req["source_anchors"]["authentication"]["login_gate"],
)
check_equal(
    "requirement-memory source anchor primary_login_method",
    literal_source_anchors["primary_login_method"],
    req["source_anchors"]["authentication"]["primary_login_method"],
)
check_equal(
    "requirement-memory source anchor purchase_authority",
    literal_source_anchors["purchase_authority"],
    req["source_anchors"]["commerce"]["purchase_authority"],
)
check_equal(
    "requirement-memory source anchor top_level_navigation",
    literal_source_anchors["top_level_navigation"],
    req["source_anchors"]["navigation"]["top_level_information_architecture"],
)
check_equal(
    "requirement-memory source anchor audio_presentation_policy",
    literal_source_anchors["audio_presentation_policy"],
    req["source_anchors"]["audio"]["presentation_policy"],
)
check_equal(
    "requirement-memory source anchor default_learning_path",
    literal_source_anchors["default_learning_path"],
    req["source_anchors"]["learning_path"]["default_strategy"],
)

check_equal(
    "account-sync source anchor login_gate",
    literal_source_anchors["login_gate"],
    auth["source_anchors"]["login_gate"],
)
check_equal(
    "account-sync source anchor primary_login_method",
    literal_source_anchors["primary_login_method"],
    auth["source_anchors"]["primary_login_method"],
)
check_equal(
    "account-sync source anchor purchase_authority",
    literal_source_anchors["purchase_authority"],
    auth["source_anchors"]["purchase_authority"],
)
check_equal(
    "platform-contract source anchor top_level_navigation",
    literal_source_anchors["top_level_navigation"],
    platform["source_anchors"]["top_level_information_architecture"],
)
check_equal(
    "interactions source anchor audio_presentation_policy",
    literal_source_anchors["audio_presentation_policy"],
    interactions["source_anchors"]["audio_presentation_policy"],
)
check_equal(
    "product-core source anchor default_learning_path",
    literal_source_anchors["default_learning_path"],
    product["source_anchors"]["default_learning_path"],
)

hr13 = find_by_id(evals["regressions"], "HR-13")
if hr13:
    check_equal(
        "HR-13 must_preserve_source_anchors",
        anchor_texts("login_gate"),
        hr13["must_preserve_source_anchors"],
    )

hr14 = find_by_id(evals["regressions"], "HR-14")
if hr14:
    check_equal(
        "HR-14 must_preserve_source_anchors",
        anchor_texts("primary_login_method", "purchase_authority"),
        hr14["must_preserve_source_anchors"],
    )

hr15 = find_by_id(evals["regressions"], "HR-15")
if hr15:
    check_equal(
        "HR-15 must_preserve_source_anchors",
        anchor_texts("top_level_navigation"),
        hr15["must_preserve_source_anchors"],
    )

hr16 = find_by_id(evals["regressions"], "HR-16")
if hr16:
    check_equal(
        "HR-16 must_preserve_source_anchors",
        anchor_texts("audio_presentation_policy"),
        hr16["must_preserve_source_anchors"],
    )

hr17 = find_by_id(evals["regressions"], "HR-17")
if hr17:
    check_equal(
        "HR-17 must_preserve_source_anchors",
        anchor_texts(
            "login_gate",
            "primary_login_method",
            "purchase_authority",
            "top_level_navigation",
            "audio_presentation_policy",
            "default_learning_path",
        ),
        hr17["must_preserve_source_anchors"],
    )

hr18 = find_by_id(evals["regressions"], "HR-18")
if hr18:
    check_equal(
        "HR-18 must_preserve_source_anchors",
        anchor_texts("default_learning_path"),
        hr18["must_preserve_source_anchors"],
    )

gt08 = find_by_id(evals["golden_tasks"], "GT-08")
if gt08:
    check_equal(
        "GT-08 must_preserve_source_anchors",
        anchor_texts("top_level_navigation"),
        gt08["must_preserve_source_anchors"],
    )

gt09 = find_by_id(evals["golden_tasks"], "GT-09")
if gt09:
    check_equal(
        "GT-09 must_preserve_source_anchors",
        anchor_texts("purchase_authority"),
        gt09["must_preserve_source_anchors"],
    )

gt10 = find_by_id(evals["golden_tasks"], "GT-10")
if gt10:
    check_equal(
        "GT-10 must_preserve_source_anchors",
        anchor_texts("login_gate"),
        gt10["must_preserve_source_anchors"],
    )

gt11 = find_by_id(evals["golden_tasks"], "GT-11")
if gt11:
    check_equal(
        "GT-11 must_preserve_source_anchors",
        anchor_texts("login_gate", "primary_login_method", "purchase_authority"),
        gt11["must_preserve_source_anchors"],
    )

gt12 = find_by_id(evals["golden_tasks"], "GT-12")
if gt12:
    check_equal(
        "GT-12 must_preserve_source_anchors",
        anchor_texts(
            "login_gate",
            "primary_login_method",
            "purchase_authority",
            "top_level_navigation",
            "audio_presentation_policy",
            "default_learning_path",
        ),
        gt12["must_preserve_source_anchors"],
    )

gt13 = find_by_id(evals["golden_tasks"], "GT-13")
if gt13:
    check_equal(
        "GT-13 must_preserve_source_anchors",
        anchor_texts("default_learning_path"),
        gt13["must_preserve_source_anchors"],
    )

p15 = find_by_id(perturbation_audit["perturbations"], "P-15")
if p15:
    check_equal(
        "P-15 must_preserve_source_anchors",
        anchor_texts("purchase_authority"),
        p15["must_preserve_source_anchors"],
    )

p18 = find_by_id(perturbation_audit["perturbations"], "P-18")
if p18:
    check_equal(
        "P-18 must_preserve_source_anchors",
        anchor_texts("login_gate"),
        p18["must_preserve_source_anchors"],
    )

p19 = find_by_id(perturbation_audit["perturbations"], "P-19")
if p19:
    check_equal(
        "P-19 must_preserve_source_anchors",
        anchor_texts("primary_login_method"),
        p19["must_preserve_source_anchors"],
    )

p20 = find_by_id(perturbation_audit["perturbations"], "P-20")
if p20:
    check_equal(
        "P-20 must_preserve_source_anchors",
        anchor_texts("top_level_navigation"),
        p20["must_preserve_source_anchors"],
    )

p21 = find_by_id(perturbation_audit["perturbations"], "P-21")
if p21:
    check_equal(
        "P-21 must_preserve_source_anchors",
        anchor_texts("audio_presentation_policy"),
        p21["must_preserve_source_anchors"],
    )

p22 = find_by_id(perturbation_audit["perturbations"], "P-22")
if p22:
    check_equal(
        "P-22 must_preserve_source_anchors",
        anchor_texts("default_learning_path"),
        p22["must_preserve_source_anchors"],
    )

check_equal(
    "perturbation audit required_literal_source_anchors",
    anchor_texts(
        "login_gate",
        "primary_login_method",
        "purchase_authority",
        "top_level_navigation",
        "audio_presentation_policy",
        "default_learning_path",
    ),
    perturbation_audit["audit_summary"]["restatement_capability_after_perturbation"][
        "required_literal_source_anchors"
    ],
)


# Governance contract must stay explicit across harness, evals, drift guards, and active agent docs.
main_branch_policy = harness["governance"]["main_branch_policy"]
local_guard = harness["governance"]["local_guard"]
remote_guard = harness["governance"]["remote_guard"]
repo_delivery_contract = harness["governance"]["repo_delivery_contract"]
delivery_defaults = delivery["delivery_defaults"]["code_change_tasks"]
pull_request_contract = delivery["pull_request_contract"]
ci_contract = delivery["ci_contract"]

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
        "设计稿来源（用户可见 UI 如适用）",
        "design_review_checklist（如适用）",
    ],
    pull_request_contract["required_body_sections"],
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
check_equal("ci_contract workflow_path", ".github/workflows/pr-gates.yml", ci_contract["workflow_path"])
check_equal(
    "ci_contract pull_request_template_path",
    ".github/pull_request_template.md",
    ci_contract["pull_request_template_path"],
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
            "id": "agent_review_record",
            "command": "python3 scripts/validate_agent_review.py",
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
    ],
    ci_contract["required_pull_request_gates"],
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
    "不要把 task-local design brief 当作 implementation PR 的正式设计权威；它只能作为探索草稿",
    "不要把核心交互 / 小动效当作 UI 完成后的装饰；Learning 或核心交互实现必须先有 interaction/motion artifact 或 storyboard",
    "不要把物理空间当作普通页面 UI；Space 实现必须先有 spatial model / state transition / Learning ↔ Space 连续性 artifact",
    "若任务包含持久化仓库改动，PR 描述必须包含引用 spec、变更摘要、验证、Agent review；若涉及用户可见 UI，必须写明设计稿来源、interaction/motion 或 physical-space artifact（如适用）、实现映射与未实现 gap，并回答 design review checklist；默认在 review + gate 通过后自动收口合并",
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
    "PR 创建后，默认在 agent review 通过、PR body 留下可校验 review 记录、且 required gates 全绿时自动合并到 `main`。",
    "只有当 agent review 有 blocking 结论、required gates 未通过，或权限 / 环境阻止 merge 时，才停在 PR handoff。",
    "如果权限或环境阻止创建 PR，至少要明确交付 branch、commit、验证结果与阻塞原因。",
    "涉及用户可见 UI 的分支，必须先引用已接受设计稿 / reference / design brief / decision，再做实现；同一 PR 内新增的 brief / decision 只能满足 design-only PR。",
    "Learning / core interaction UI 分支必须引用 interaction-motion artifact 或 storyboard；Space UI 分支必须引用 physical-space artifact 和 Space visual proof / refinement；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。",
    "`.github/pull_request_template.md` 要求 PR 描述包含：`当前任务引用的 spec`、`变更摘要`、`验证`、`Agent review`；若涉及用户可见 UI，必须补 `设计稿来源（用户可见 UI 如适用）`、interaction/motion 或 physical-space artifact（如适用）、实现映射、未实现 gap，并回答 `design_review_checklist（如适用）`。",
    "`.github/workflows/pr-gates.yml` 会在指向 `main` 的 PR 上运行 `python3 scripts/validate_pr_design_gate.py --base <base_sha> --head <head_sha>`、`python3 scripts/validate_harness.py --skip-remote-guard`、`python3 scripts/validate_agent_review.py`、`cd apps/mobile && npm run lint -- --quiet`、`cd apps/mobile && npm run typecheck`、`cd apps/mobile && npm test -- --runInBand --watchAll=false`、`cd infra/cloudbase/functions/softbook-api && npm test`。",
    "merge 的默认前置条件是：agent review 无 blocking finding，PR body 中 `Agent review` 已记录为 passed，且 required gates 全绿。",
]:
    check_contains("branching strategy delivery mirror", branching_text, snippet)

readme_text = (ROOT / "README.md").read_text(encoding="utf-8")
check_contains(
    "README validate_harness scope",
    readme_text,
    "- `scripts/validate_harness.py`: harness 校验脚本（spec owner 一致性 + main 分支治理护栏）",
)
check_contains(
    "README hook install guidance",
    readme_text,
    "clone 或新增 worktree 后先运行 `./scripts/install_git_hooks.sh`，再执行 `python3 scripts/validate_harness.py` 确认本地 hooks 与 GitHub `main` 保护都仍然生效。",
)
for snippet in [
    "- `spec/repo-delivery-contract.json`",
    "- `spec/visual-language.json`",
    "- `.github/workflows/pr-gates.yml`: PR 质量门禁（design artifact gate + harness 校验 + agent review 记录 + mobile quality + backend contract）",
    "- `scripts/validate_agent_review.py`: PR body agent review 记录校验（merge 前必须记录 passed review 且无阻塞问题）",
    "- `.github/pull_request_template.md`: PR 合同模板（spec / 摘要 / 验证 / 视觉 checklist）",
    "- `docs/design/interaction-motion/` / `docs/design/physical-space/` / `docs/design/mocks/` / `docs/design/storyboards/`: 核心交互、动效、空间模型、视觉稿和 storyboard artifact 入口",
    "任何会持久化仓库改动的任务，除非明确要求只做本地修改，否则默认走 topic branch -> commit -> PR -> agent review 记录 -> merge；只有 review / gate / 权限失败时才停在 PR 或 branch handoff。",
    "任何用户可见 UI 改动都必须先引用已接受设计稿 / reference / design brief / decision，并在 PR 中写明设计稿来源、实现映射和未实现设计缺口；同一 PR 内新增的 brief / decision 只能满足 design-only PR。",
    "Learning / core interaction UI 改动还必须引用 interaction-motion artifact 或 storyboard；Space UI 改动还必须引用 physical-space artifact 和 Space visual proof / refinement；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。",
]:
    check_contains("README delivery mirror", readme_text, snippet)


# Auth / trial / purchase owner: account-sync-contract.
check_equal(
    "login_required",
    auth["authentication"]["login_is_required_before_learning"],
    req["authentication_policy"]["login_is_required_before_learning"],
)
check_equal(
    "guest_learning_before_authentication",
    auth["authentication"]["guest_learning_before_authentication"],
    req["authentication_policy"]["guest_learning_before_authentication"],
)
check_equal(
    "primary_login_method requirement-memory",
    auth["authentication"]["primary_login_method"],
    req["authentication_policy"]["primary_login_method"],
)
check_equal(
    "primary_login_method platform-contract",
    auth["authentication"]["primary_login_method"],
    platform["authentication_policy"]["primary_login_method"],
)
check_equal(
    "trial_start requirement-memory",
    auth["trial_and_purchase"]["trial_starts_when"],
    req["business"]["trial_starts_when"],
)
check_equal(
    "trial_start membership",
    auth["trial_and_purchase"]["trial_starts_when"],
    membership["policy"]["trial_start_trigger"],
)
check_equal(
    "trial_start product-core",
    auth["trial_and_purchase"]["trial_starts_when"],
    product["monetization"]["trial_start_trigger"],
)
check_equal(
    "purchase_recovery requirement-memory",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    req["business"]["purchase_recovery_reminder"],
)
check_equal(
    "purchase_recovery membership",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    membership["policy"]["purchase_recovery_reminder"],
)
check_equal(
    "purchase_recovery platform-contract",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    platform["commerce_surface_policy"]["purchase_recovery_reminder"],
)
check_equal(
    "purchase_recovery product-core",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    product["monetization"]["post_membership_recovery_prompt"],
)
check_equal(
    "web_app_purchase_authority membership",
    auth["trial_and_purchase"]["web_and_app_purchase_authority"],
    membership["policy"]["web_and_app_purchase_authority"],
)
check_equal(
    "web_app_purchase_authority platform-contract",
    auth["trial_and_purchase"]["web_and_app_purchase_authority"],
    platform["commerce_surface_policy"]["web_and_app_purchase_authority"],
)


# Sync owner: account-sync-contract.
check_equal(
    "sync_targets requirement-memory",
    auth["sync_scope"]["must_sync"],
    req["cross_surface_continuity"]["sync_targets"],
)
check_equal(
    "sync_targets product-core",
    auth["sync_scope"]["must_sync"],
    product["multi_surface_strategy"]["continuity_model"]["sync_targets"],
)
check_equal(
    "sync_mode requirement-memory",
    auth["sync_scope"]["target_sync_mode"],
    req["cross_surface_continuity"]["target_sync_mode"],
)
check_equal(
    "sync_mode product-core",
    auth["sync_scope"]["target_sync_mode"],
    product["multi_surface_strategy"]["continuity_model"]["target_sync_mode"],
)


# Platform owner: platform-contract.
platform_release_targets = [
    key for key, enabled in platform["release_targets"].items() if enabled
]
check_equal(
    "release_targets requirement-memory",
    platform_release_targets,
    req["platform_requirements"]["release_targets"],
)
check_equal(
    "release_targets product-core.multi_surface_strategy",
    platform_release_targets,
    product["multi_surface_strategy"]["release_targets"],
)
check_equal(
    "release_targets product-core.technical_constraints",
    platform_release_targets,
    product["technical_constraints"]["release_targets"],
)
check_equal(
    "priority_order requirement-memory",
    platform["design_strategy"]["mobile_priority"],
    req["platform_requirements"]["priority_order"],
)
check_equal(
    "priority_order product-core",
    platform["design_strategy"]["mobile_priority"],
    product["multi_surface_strategy"]["priority_order"],
)
check_equal(
    "nav_order requirement-memory",
    platform["navigation_contract"]["order"],
    req["page_and_spec_needs"]["top_level_navigation_is_consistent_across_surfaces"],
)
check_equal(
    "nav_order product-core",
    platform["navigation_contract"]["order"],
    product["surface_navigation"]["consistent_top_level_nav_order"],
)
check_equal(
    "learning_entry_requirement-memory",
    platform["entry_priority_by_surface"]["learning_flow_is_most_important_entry_on_all_release_targets"],
    req["platform_requirements"]["learning_flow_is_most_important_entry_on_all_release_targets"],
)
check_equal(
    "space_entry_requirement-memory",
    platform["entry_priority_by_surface"]["physical_space_is_top_level_entry_on_all_release_targets"],
    req["platform_requirements"]["physical_space_is_top_level_entry_on_all_release_targets"],
)


# Audio owner: interactions.
check_equal(
    "audio_autoplay requirement-memory",
    interactions["audio_binding_policy"]["auto_play"],
    req["audio_role"]["auto_play"],
)
check_equal(
    "audio_autoplay product-core",
    interactions["audio_binding_policy"]["auto_play"],
    product["audio_product_role"]["auto_play"],
)
check_equal(
    "front_side_subtitles requirement-memory",
    interactions["audio_binding_policy"]["front_side_subtitles"],
    req["audio_role"]["front_side_subtitles"],
)
check_equal(
    "front_side_subtitles product-core",
    interactions["audio_binding_policy"]["front_side_subtitles"],
    product["audio_product_role"]["front_side_subtitles"],
)
check_equal(
    "back_text_or_transcript requirement-memory",
    interactions["audio_binding_policy"]["back_side_text_or_transcript_may_exist"],
    req["audio_role"]["back_side_text_or_transcript_may_exist"],
)
check_equal(
    "back_text_or_transcript product-core",
    interactions["audio_binding_policy"]["back_side_text_or_transcript_may_exist"],
    product["audio_product_role"]["back_side_text_or_transcript_may_exist"],
)


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
        'git -C "$ROOT_DIR" config core.hooksPath "$HOOKS_DIR"',
    )

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

git_dir = run_command("git", "rev-parse", "--git-dir")
if git_dir is None or git_dir.returncode != 0:
    errors.append("repository is not in a git checkout")
else:
    configured_hooks = run_command("git", "config", "--path", "--get", "core.hooksPath")
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
        "python3 scripts/validate_agent_review.py",
        "python3 scripts/validate_pr_design_gate.py --base",
        "backend-contract:",
        "cache-dependency-path: infra/cloudbase/functions/softbook-api/package-lock.json",
        "working-directory: infra/cloudbase/functions/softbook-api",
        "./scripts/install_git_hooks.sh",
        "python3 scripts/validate_harness.py --skip-remote-guard",
        "npm ci",
        "npm run lint -- --quiet",
        "npm run typecheck",
        "npm test -- --runInBand --watchAll=false",
        'node-version: "22.11.0"',
    ]:
        check_contains("PR workflow gate", workflow_text, snippet)

pr_template_path = ROOT / ci_contract["pull_request_template_path"]
if not pr_template_path.exists():
    errors.append(f"missing pull request template: {ci_contract['pull_request_template_path']}")
else:
    pr_template_text = pr_template_path.read_text(encoding="utf-8")
    for heading in pull_request_contract["required_body_sections"]:
        check_contains("PR template heading", pr_template_text, f"## {heading}")
    for snippet in [
        "- [ ] `cd infra/cloudbase/functions/softbook-api && npm test`",
        "## Agent review",
        "- Review status: N/A",
        "agent-review` gate",
        "- Interaction/motion artifact: N/A",
        "- Physical space artifact: N/A",
        "用户可见 UI 改动必须回答下方 `Universal Q1-Q4` 与适用的 `Conditional Q5-Q6`，不能保留 `N/A`。",
    ]:
        check_contains("PR template design gate fields", pr_template_text, snippet)

agent_review_script = ROOT / "scripts" / "validate_agent_review.py"
if not agent_review_script.exists():
    errors.append("missing agent review validator: scripts/validate_agent_review.py")
else:
    invalid_agent_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "PR_BODY": ""},
    )
    if invalid_agent_review.returncode == 0:
        errors.append("validate_agent_review.py must reject missing agent review records")
    valid_agent_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files, specs, validation, and found no blocking issues.
""",
        },
    )
    if valid_agent_review.returncode != 0:
        errors.append("validate_agent_review.py must accept a passed review with no blocking findings")

directory_reference_body = """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/decisions/
- Interaction/motion artifact: docs/design/interaction-motion/
- Physical space artifact: N/A
- Implementation mapping: apps/mobile/src/learning/LearningSurface.tsx
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: answered
- Conditional Q5-Q6: answered
"""
directory_reference_case = run_design_gate_case(
    directory_reference_body,
    [
        "apps/mobile/src/learning/LearningSurface.tsx",
        "docs/design/decisions/new-learning-direction.md",
        "docs/design/interaction-motion/new-learning-motion.md",
    ],
)
if directory_reference_case.returncode == 0:
    errors.append("validate_pr_design_gate.py must reject directory-only design artifact references")
else:
    directory_reference_output = directory_reference_case.stdout + directory_reference_case.stderr
    if "not only a directory" not in directory_reference_output:
        errors.append("validate_pr_design_gate.py directory-only rejection must explain the concrete file requirement")

visual_output_artifact_paths = [
    "docs/design/visual-reference.html",
    "docs/design/interaction-motion/learning-motion-v1.md",
    "docs/design/physical-space/space-model-v1.md",
    "docs/design/mocks/learning-surface-v1.md",
    "docs/design/storyboards/learning-flow-v1.md",
]
for visual_output_path in visual_output_artifact_paths:
    visual_output_empty_case = run_design_gate_case("", [visual_output_path])
    if visual_output_empty_case.returncode == 0:
        errors.append(
            f"validate_pr_design_gate.py must require checklist answers for visual output artifact: {visual_output_path}"
        )
    else:
        visual_output_empty = visual_output_empty_case.stdout + visual_output_empty_case.stderr
        for snippet in ["Universal Q1-Q4", "Conditional Q5-Q6"]:
            if snippet not in visual_output_empty:
                errors.append(
                    f"validate_pr_design_gate.py visual-output rejection missing {snippet}: {visual_output_path}"
                )

visual_output_checklist_body = """
## design_review_checklist（如适用）

- Universal Q1-Q4: answered
- Conditional Q5-Q6: answered
"""
for visual_output_path in visual_output_artifact_paths:
    visual_output_checklist_case = run_design_gate_case(
        visual_output_checklist_body,
        [visual_output_path],
    )
    if visual_output_checklist_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow design-only visual artifacts when checklist answers are present: "
            + visual_output_path
            + "\n"
            + visual_output_checklist_case.stdout
            + visual_output_checklist_case.stderr
        )

ui_external_artifact_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/decisions/learning-space-direction-decision-v1.md
- Interaction/motion artifact: https://example.com/softbook/learning-motion
- Physical space artifact: N/A
- Implementation mapping: apps/mobile/src/learning/LearningSurface.tsx
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: answered
- Conditional Q5-Q6: answered
""",
    ["apps/mobile/src/learning/LearningSurface.tsx"],
)
if ui_external_artifact_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow concrete preexisting artifacts or external URLs: "
        + ui_external_artifact_case.stdout
        + ui_external_artifact_case.stderr
    )

space_missing_visual_proof_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/decisions/learning-space-direction-decision-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: answered
- Conditional Q5-Q6: answered
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_missing_visual_proof_case.returncode == 0:
    errors.append(
        "validate_pr_design_gate.py must reject Space UI implementation without the Space visual proof artifact"
    )
elif "Space visual proof" not in (
    space_missing_visual_proof_case.stdout + space_missing_visual_proof_case.stderr
):
    errors.append(
        "validate_pr_design_gate.py Space visual proof rejection must explain the required artifact"
    )

space_visual_proof_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/mocks/space-surface-visual-proof-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: answered
- Conditional Q5-Q6: answered
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_visual_proof_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow Space UI implementation that names the Space visual proof artifact: "
        + space_visual_proof_case.stdout
        + space_visual_proof_case.stderr
    )

space_visual_refinement_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/mocks/space-surface-visual-refinement-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: answered
- Conditional Q5-Q6: answered
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_visual_refinement_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow Space UI implementation that names the refined Space visual artifact: "
        + space_visual_refinement_case.stdout
        + space_visual_refinement_case.stderr
    )

	# ─────────────────────────────────────────────────────────────
# Visual language / design harness gates.
# These keep spec/visual-language.json, docs/design/canon.md and
# docs/design/visual-reference.html from drifting apart, and catch
# the exact anti-patterns that slipped past review last round
# (4-level self-assess drift, sizeless inline SVGs, legacy tokens).
# ─────────────────────────────────────────────────────────────
import re

vl_path = SPEC / "visual-language.json"
canon_path = ROOT / "docs" / "design" / "canon.md"
vref_path = ROOT / "docs" / "design" / "visual-reference.html"
storyboard_html_path = ROOT / "docs" / "design" / "storyboards" / "learning-space-motion-prototype-v1.html"
storyboard_md_path = ROOT / "docs" / "design" / "storyboards" / "learning-space-motion-prototype-v1.md"

if not vl_path.exists():
    errors.append("missing spec/visual-language.json")
elif not canon_path.exists():
    errors.append("missing docs/design/canon.md")
elif not vref_path.exists():
    errors.append("missing docs/design/visual-reference.html")
elif not storyboard_html_path.exists():
    errors.append("missing docs/design/storyboards/learning-space-motion-prototype-v1.html")
elif not storyboard_md_path.exists():
    errors.append("missing docs/design/storyboards/learning-space-motion-prototype-v1.md")
else:
    vl = json.loads(vl_path.read_text(encoding="utf-8"))
    canon_text = canon_path.read_text(encoding="utf-8")
    vref_text = vref_path.read_text(encoding="utf-8")
    storyboard_html = storyboard_html_path.read_text(encoding="utf-8")
    storyboard_md = storyboard_md_path.read_text(encoding="utf-8")

    # 1. Library identity must have exactly the 7 required libraries with
    #    matching keys between product_truth and implementation_hypothesis.
    required_libs = {"listening", "reading", "cloze", "writing", "translation", "vocabulary", "grammar"}
    lib_hex = vl["implementation_hypothesis"]["palette"]["library_identity_hex_defaults"]
    if set(lib_hex.keys()) != required_libs:
        errors.append(
            f"visual-language.json library_identity_hex_defaults keys {sorted(lib_hex.keys())} "
            f"must equal {sorted(required_libs)}"
        )

    # 2. Self-assess must be exactly 2 levels with named keys — catches
    #    the exact drift we just fixed (4-level 掌握/知道/不确定/忘了).
    sa_hex = vl["implementation_hypothesis"]["palette"]["self_assess_hex_defaults"]
    sa_keys = {k for k in sa_hex.keys() if not k.startswith("_")}
    if sa_keys != {"confident", "review"}:
        errors.append(
            f"visual-language.json self_assess_hex_defaults must be exactly "
            f"{{'confident','review'}}, got {sorted(sa_keys)}"
        )

    # 2b. Accepted motion storyboard must not render flip self-assess
    #     as the current library accent. It should prove AP-23 directly.
    storyboard_lower = storyboard_html.lower()
    for snippet in [
        f"--confident: {sa_hex['confident'].lower()}",
        f"--review: {sa_hex['review'].lower()}",
        'class="pill confident"',
        'class="pill review"',
        "@media (prefers-reduced-motion: reduce)",
        "front / back crossfade",
        'class="reduced-actions"',
    ]:
        if snippet not in storyboard_lower:
            errors.append(
                "learning-space-motion-prototype-v1.html missing storyboard proof snippet: "
                + snippet
            )
    for snippet in [
        "`有把握` = mint",
        "`再回看` = amber",
        "explicit fallback states",
    ]:
        if snippet not in storyboard_md:
            errors.append(
                "learning-space-motion-prototype-v1.md missing storyboard proof snippet: "
                + snippet
            )

    # 3. Mirror gate: the 7 library hexes + 2 self-assess hexes must appear
    #    verbatim in canon.md. This is the small product_truth subset —
    #    other tokens (neutrals, glass, typography) stay tunable.
    locked_hexes = list(lib_hex.values()) + [sa_hex[k] for k in sa_keys]
    canon_upper = canon_text.upper()
    for h in locked_hexes:
        if h.upper() not in canon_upper:
            errors.append(f"canon.md missing locked token hex {h} (visual-language.json)")

    # 4. Removed self-assess CSS vars must not reappear in the rendered anchor.
    #    (--fb-prof / --fb-forgot were renamed to --ok / --err; --fb-know / --fb-unsure removed.)
    legacy_vars = ["--fb-know", "--fb-unsure", "--fb-prof", "--fb-forgot"]
    for tok in legacy_vars:
        # POSITIVE-region scoping: allow tokens inside an explicit NEGATIVE block.
        scrubbed = re.sub(
            r"<!--\s*NEGATIVE\s*-->.*?<!--\s*/NEGATIVE\s*-->",
            "",
            vref_text,
            flags=re.DOTALL,
        )
        if tok in scrubbed:
            errors.append(
                f"visual-reference.html still references removed token {tok}; "
                "either delete the usage or move it into a <!-- NEGATIVE --> block"
            )

    # 5. Inline <svg> elements in the positive region must have explicit
    #    width/height OR a sized parent class (.sb / .tab / .ico sized via selector).
    #    Catches the exact 'SVG ate the row' bug that shipped last turn.
    positive_html = re.sub(
        r"<!--\s*NEGATIVE\s*-->.*?<!--\s*/NEGATIVE\s*-->",
        "",
        vref_text,
        flags=re.DOTALL,
    )
    svg_tags = re.findall(r"<svg\b[^>]*>", positive_html)
    for tag in svg_tags:
        # Skip svgs that declare explicit dimensions.
        if re.search(r'\bwidth\s*=', tag) and re.search(r'\bheight\s*=', tag):
            continue
        # Skip svgs carrying a class whose CSS rule sets width/height.
        # Known sized classes: sb, tab, ico (.sb svg / .tab svg / svg.ico all set explicit dimensions).
        if re.search(r'class\s*=\s*"[^"]*\b(sb|tab|ico)\b', tag):
            continue
        errors.append(
            f"visual-reference.html has an <svg> without width/height and no sized parent class: {tag[:80]}…"
        )

    # 6. Forbidden design patterns: restricted to POSITIVE regions only.
    #    NEGATIVE/Don't-gallery blocks are exempt by design.
    for rule in vl.get("implementation_hypothesis", {}).get("forbidden_design_patterns", {}).get("tokens", []):
        if re.search(rule["pattern"], positive_html, flags=re.IGNORECASE):
            errors.append(
                f"visual-reference.html POSITIVE region hits forbidden pattern "
                f"{rule['id']} ({rule['reason']}): /{rule['pattern']}/"
            )

    # 7. Interaction silhouettes must cover exactly the 5 core interactions.
    required_silhouettes = {"flip", "multiple_choice", "lock", "elimination", "swipe"}
    sil = vl.get("implementation_hypothesis", {}).get("interaction_silhouettes", {})
    sil_keys = {k for k in sil.keys() if not k.startswith("_")}
    if sil_keys != required_silhouettes:
        errors.append(
            f"visual-language.json interaction_silhouettes must cover exactly "
            f"{sorted(required_silhouettes)}, got {sorted(sil_keys)}"
        )

    # 8. Design review checklist must expose both universal and conditional groups.
    chk = vl.get("implementation_hypothesis", {}).get("design_review_checklist", {})
    if not chk.get("universal") or not chk.get("conditional"):
        errors.append("visual-language.json design_review_checklist missing universal or conditional groups")

    # 9. User-facing UI must not be implemented directly from current RN code
    #    or taste; it needs a design artifact before implementation.
    ui_gate_truth = vl.get("product_truth", {}).get("user_facing_ui_requires_design_artifact", {})
    if ui_gate_truth.get("violation_is") != "delivery_blocker":
        errors.append("visual-language.json user_facing_ui_requires_design_artifact must be a delivery_blocker")
    accepted_artifacts = ui_gate_truth.get("accepted_artifacts", [])
    for artifact in [
        "docs/design/visual-reference.html",
        "docs/design/canon.md",
        "docs/design/interaction-motion/*.md",
        "docs/design/physical-space/*.md",
        "docs/design/mocks/*.md",
        "docs/design/storyboards/*.md",
        "linked_external_design_file",
    ]:
        if artifact not in accepted_artifacts:
            errors.append(f"visual-language.json user_facing_ui_requires_design_artifact missing accepted artifact {artifact}")
    if "task_local_design_brief_answering_design_review_checklist" in accepted_artifacts:
        errors.append("visual-language.json must not accept task-local design briefs as implementation authority")

    ui_gate_impl = vl.get("implementation_hypothesis", {}).get("design_artifact_gate", {})
    impl_accepted_artifacts = ui_gate_impl.get("accepted_artifacts", [])
    if "task_local_design_brief_answering_design_review_checklist" in impl_accepted_artifacts:
        errors.append("visual-language.json design_artifact_gate must not accept task-local design briefs as implementation authority")
    check_equal(
        "visual-language design_artifact_gate required_before",
        "implementation_that_changes_user_facing_UI",
        ui_gate_impl.get("required_before"),
    )
    check_equal(
        "visual-language design_artifact_gate pull_request_must_state",
        "design_artifact_source_implementation_mapping_and_design_review_checklist",
        ui_gate_impl.get("pull_request_must_state"),
    )
    if "task_local_design_brief_for_implementation_pr" not in ui_gate_impl.get("not_accepted_as_design_authority", []):
        errors.append("visual-language.json design_artifact_gate must reject task-local briefs as implementation authority")

    vl_ap09 = find_by_id(vl.get("anti_patterns", []), "VL-AP-09")
    if vl_ap09:
        check_equal(
            "VL-AP-09 name",
            "implementing_user_facing_UI_without_design_artifact",
            vl_ap09["name"],
        )
        check_equal(
            "VL-AP-09 correction",
            "create_or_reference_accepted_design_artifact_before_RN_or_other_user_facing_implementation",
            vl_ap09["correction"],
        )


if errors:
    print("HARNESS VALIDATION FAILED")
    for err in errors:
        print(f"- {err}")
    sys.exit(1)

print("HARNESS VALIDATION OK")
