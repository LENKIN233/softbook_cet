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
            "id": "maestro_selector_guard",
            "command": "python3 scripts/validate_maestro_selectors.py",
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
    "涉及用户可见 UI 的分支，必须先引用已接受设计稿 / reference / design brief / direction / decision，再做实现；同一 PR 内新增的 brief / direction / decision 只能满足 design-only PR。",
    "Learning / core interaction UI 分支必须引用 interaction-motion artifact 或 storyboard；Space UI 分支必须引用 physical-space artifact 和 Space visual proof / refinement / shelf-desk baseline；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。",
    "`.github/pull_request_template.md` 要求 PR 描述包含：`当前任务引用的 spec`、`变更摘要`、`验证`、`Agent review`；若涉及用户可见 UI，必须补 `设计稿来源（用户可见 UI 如适用）`、interaction/motion 或 physical-space artifact（如适用）、实现映射、未实现 gap，并回答 `design_review_checklist（如适用）`。",
    "`.github/workflows/pr-gates.yml` 会在指向 `main` 的 PR 上运行 `python3 scripts/validate_pr_design_gate.py --base <base_sha> --head <head_sha>`、`python3 scripts/validate_harness.py --skip-remote-guard`、`python3 scripts/validate_maestro_selectors.py`、`python3 scripts/validate_agent_review.py`、`cd apps/mobile && npm run lint -- --quiet`、`cd apps/mobile && npm run typecheck`、`cd apps/mobile && npm test -- --runInBand --watchAll=false`、`cd infra/cloudbase/functions/softbook-api && npm test`。",
    "merge 的默认前置条件是：agent review 无 blocking finding，PR body 中 `Agent review` 已记录为 passed，且 required gates 全绿。",
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
    "- `.github/workflows/pr-gates.yml`: PR 质量门禁（design artifact gate + harness 校验 + Maestro selector guard + agent review 记录 + mobile quality + backend contract）",
    "- `scripts/validate_agent_review.py`: PR body agent review 记录校验（merge 前必须记录 passed review 且无阻塞问题）",
    "- `scripts/validate_maestro_selectors.py`: Maestro smoke selector 校验（禁止用用户可见文案作为 `tapOn` / `assertVisible` 等 selector）",
    "- `.github/pull_request_template.md`: PR 合同模板（spec / 摘要 / 验证 / 视觉 checklist）",
    "- `docs/design/directions/` / `docs/design/interaction-motion/` / `docs/design/physical-space/` / `docs/design/mocks/` / `docs/design/storyboards/`: 核心方向、交互、动效、空间模型、视觉稿和 storyboard artifact 入口",
    "任何会持久化仓库改动的任务，除非明确要求只做本地修改，否则默认走 topic branch -> commit -> PR -> agent review 记录 -> merge；只有 review / gate / 权限失败时才停在 PR 或 branch handoff。",
    "任何用户可见 UI 改动都必须先引用已接受设计稿 / reference / design brief / direction / decision，并在 PR 中写明设计稿来源、实现映射和未实现设计缺口；同一 PR 内新增的 brief / direction / decision 只能满足 design-only PR。",
    "Learning / core interaction UI 改动还必须引用 interaction-motion artifact 或 storyboard；Space UI 改动还必须引用 physical-space artifact 和 Space visual proof / refinement / shelf-desk baseline；task-local design brief 只能作为探索草稿，不能作为 implementation PR 的正式设计权威。",
]:
    check_contains("README delivery mirror", readme_text, snippet)

gitignore_text = (ROOT / ".gitignore").read_text(encoding="utf-8")
for snippet in ["__pycache__/", "*.py[cod]", ".tmp/"]:
    check_contains("gitignore harness runtime artifacts", gitignore_text, snippet)
