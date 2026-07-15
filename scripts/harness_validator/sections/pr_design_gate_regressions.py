from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    load = context.load

    def run_design_gate_case(body: str, changed_files: list[str]):
        args: list[str] = []
        for changed_file in changed_files:
            args.extend(["--changed-file", changed_file])
        return context.run_validator(
            "scripts/validate_pr_design_gate.py",
            *args,
            env={"PR_BODY": body},
        )

    def load_design_gate_module():
        return context.load_validator_module("scripts/validate_pr_design_gate.py")

    directory_reference_body = """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/decisions/
    - Interaction/motion artifact: docs/design/interaction-motion/
    - Physical space artifact: N/A
    - Implementation mapping: apps/mobile/src/learning/LearningSurface.tsx
    - Unimplemented design gaps: No known gaps.
    - Learning microcopy basis: product correction - fixture confirms concrete accepted artifacts remain sufficient.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
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

    visual_tokens_empty_case = run_design_gate_case("", ["apps/mobile/src/visual/tokens.ts"])
    if visual_tokens_empty_case.returncode == 0:
        errors.append("validate_pr_design_gate.py must treat apps/mobile/src/visual/tokens.ts as design-gated")
    else:
        visual_tokens_empty_output = visual_tokens_empty_case.stdout + visual_tokens_empty_case.stderr
        if "Design artifact" not in visual_tokens_empty_output:
            errors.append("validate_pr_design_gate.py visual token rejection must require design artifact evidence")

    web_ui_empty_case = run_design_gate_case("", ["apps/web/src/App.tsx"])
    if web_ui_empty_case.returncode == 0:
        errors.append("validate_pr_design_gate.py must treat apps/web UI files as design-gated")
    else:
        web_ui_empty_output = web_ui_empty_case.stdout + web_ui_empty_case.stderr
        if "Design artifact" not in web_ui_empty_output:
            errors.append("validate_pr_design_gate.py web UI rejection must require design artifact evidence")

    test_only_tsx_case = run_design_gate_case(
        "",
        [
            "apps/mobile/__tests__/SpaceSurface.test.tsx",
            "apps/mobile/src/space/SpaceSurface.test.tsx",
        ],
    )
    if test_only_tsx_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should not require design evidence for test-only TSX changes: "
            + test_only_tsx_case.stdout
            + test_only_tsx_case.stderr
        )

    card_content_empty_case = run_design_gate_case(
        "",
        ["apps/mobile/src/learning/localCardRecords.ts"],
    )
    if card_content_empty_case.returncode == 0:
        errors.append("validate_pr_design_gate.py must treat repository dev card content as handoff-gated")
    else:
        card_content_empty_output = card_content_empty_case.stdout + card_content_empty_case.stderr
        if "Card content handoff" not in card_content_empty_output:
            errors.append("validate_pr_design_gate.py card content rejection must require handoff evidence")

    card_content_invalid_handoff_case = run_design_gate_case(
        """
    ## 卡片内容交接（如适用）

    - Card content handoff: local softbook_cet edit
    - Card content validation: node infra/cloudbase/import-card-source.mjs --file handoff.json --track cet4
    """,
        ["apps/mobile/src/learning/localCardRecords.ts"],
    )
    if card_content_invalid_handoff_case.returncode == 0:
        errors.append("validate_pr_design_gate.py must reject repository dev card content without card make handoff")
    else:
        card_content_invalid_output = (
            card_content_invalid_handoff_case.stdout + card_content_invalid_handoff_case.stderr
        )
        if "card make" not in card_content_invalid_output:
            errors.append("validate_pr_design_gate.py card content rejection must name the card make boundary")

    card_content_valid_case = run_design_gate_case(
        """
    ## 卡片内容交接（如适用）

    - Card content handoff: external_workspace:/Users/lenkin/programing/card make PR #12 handoff payload.
    - Card content validation: dry-run import with node infra/cloudbase/import-card-source.mjs --file handoff.json --track cet4; catalog_audit_result recorded with node infra/cloudbase/audit-card-sources.mjs.
    """,
        ["apps/mobile/src/learning/localCardRecords.ts"],
    )
    if card_content_valid_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow repository dev card content only with card make handoff evidence: "
            + card_content_valid_case.stdout
            + card_content_valid_case.stderr
        )

    visual_tokens_valid_case = run_design_gate_case(
        """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/visual-reference.html
    - Interaction/motion artifact: N/A
    - Physical space artifact: N/A
    - Implementation mapping: apps/mobile/src/visual/tokens.ts
    - Unimplemented design gaps: No known gaps.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
    """,
        ["apps/mobile/src/visual/tokens.ts"],
    )
    if visual_tokens_valid_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow visual token changes with design evidence: "
            + visual_tokens_valid_case.stdout
            + visual_tokens_valid_case.stderr
        )

    web_ui_valid_case = run_design_gate_case(
        """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/visual-reference.html
    - Interaction/motion artifact: N/A
    - Physical space artifact: N/A
    - Implementation mapping: apps/web/src/App.tsx
    - Unimplemented design gaps: No known gaps.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
    """,
        ["apps/web/src/App.tsx"],
    )
    if web_ui_valid_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow apps/web UI changes with design evidence: "
            + web_ui_valid_case.stdout
            + web_ui_valid_case.stderr
        )

    visual_output_artifact_paths = [
        "docs/design/visual-reference.html",
        "docs/design/interaction-motion/learning-motion-v1.md",
        "docs/design/physical-space/space-model-v1.md",
        "docs/design/mocks/learning-surface-v1.md",
        "docs/design/search-runs/2026-05-07-space/rendered-proof.html",
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

    placeholder_checklist_case = run_design_gate_case(
        """
    ## design_review_checklist（如适用）

    - Universal Q1-Q4: answered
    - Conditional Q5-Q6: answered
    """,
        ["docs/design/mocks/learning-surface-v1.md"],
    )
    if placeholder_checklist_case.returncode == 0:
        errors.append("validate_pr_design_gate.py must reject placeholder-only checklist answers")
    elif "placeholder" not in (placeholder_checklist_case.stdout + placeholder_checklist_case.stderr):
        errors.append("validate_pr_design_gate.py placeholder checklist rejection must explain the problem")

    visual_output_checklist_body = """
    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
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

    design_gate_module = load_design_gate_module()
    bad_visual_output_errors = design_gate_module.scan_visual_output_text(
        "docs/design/mocks/bad-space-mock.html",
        """
    <!doctype html>
    <html>
    <head>
      <style>
        .bad-title { background: linear-gradient(red, blue); color: transparent; }
        .serif-copy { font-family: serif; }
      </style>
    </head>
    <body>
      <div class="phone">有把握 / 再回看</div>
      <svg viewBox="0 0 12 12"><path d="M0 0h12v12H0z"/></svg>
    </body>
    </html>
    """,
        load("visual-language.json"),
    )
    for expected_snippet in [
        "forbidden design pattern",
        "inline <svg> without explicit width and height",
        "有把握=confident/mint",
        "overflow-x containment evidence",
        "narrow-viewport media query",
    ]:
        if not any(expected_snippet in error for error in bad_visual_output_errors):
            errors.append(
                "validate_pr_design_gate.py visual-output scanner missing expected rejection: "
                + expected_snippet
            )

    ui_external_artifact_case = run_design_gate_case(
        """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/decisions/learning-space-direction-decision-v1.md
    - Interaction/motion artifact: https://example.com/softbook/learning-motion
    - Physical space artifact: N/A
    - Implementation mapping: apps/mobile/src/learning/LearningSurface.tsx
    - Unimplemented design gaps: No known gaps.
    - Learning microcopy basis: product correction - fixture keeps directory-reference rejection focused on directory-only evidence.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
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

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
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

    space_visual_directions_case = run_design_gate_case(
        """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/directions/space-surface-visual-directions-v1.md
    - Interaction/motion artifact: N/A
    - Physical space artifact: docs/design/physical-space/space-model-v1.md
    - Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
    - Unimplemented design gaps: No known gaps.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
    """,
        ["apps/mobile/src/space/SpaceSurface.tsx"],
    )
    if space_visual_directions_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow Space UI implementation that names the accepted Space visual directions artifact: "
            + space_visual_directions_case.stdout
            + space_visual_directions_case.stderr
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

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
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

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
    """,
        ["apps/mobile/src/space/SpaceSurface.tsx"],
    )
    if space_visual_refinement_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow Space UI implementation that names the refined Space visual artifact: "
            + space_visual_refinement_case.stdout
            + space_visual_refinement_case.stderr
        )

    space_shelf_desk_case = run_design_gate_case(
        """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/mocks/space-surface-shelf-desk-v1.md
    - Interaction/motion artifact: N/A
    - Physical space artifact: docs/design/physical-space/space-model-v1.md
    - Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
    - Unimplemented design gaps: Loading, empty, remote-error, permission, and paywall Space states remain out of scope.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current box tray and first-read path address shelf -> tray -> cards; Q3 silhouette matches Space physical hierarchy; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment is covered by shelf-desk proof; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
    """,
        ["apps/mobile/src/space/SpaceSurface.tsx"],
    )
    if space_shelf_desk_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow Space UI implementation that names the shelf-desk Space visual artifact: "
            + space_shelf_desk_case.stdout
            + space_shelf_desk_case.stderr
        )

    space_state_baseline_case = run_design_gate_case(
        """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/mocks/space-state-baseline-v1.html
    - Interaction/motion artifact: N/A
    - Physical space artifact: docs/design/physical-space/space-state-baseline-v1.md
    - Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
    - Unimplemented design gaps: Motion for loading, error recovery, and sync merge remains out of scope.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current box tray and first-read path address shelf -> state rail -> tray -> contained objects; Q3 silhouette matches Space physical hierarchy; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment is covered by rendered proof; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
    """,
        ["apps/mobile/src/space/SpaceSurface.tsx"],
    )
    if space_state_baseline_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow Space state UI implementation that names the accepted Space state baseline artifact: "
            + space_state_baseline_case.stdout
            + space_state_baseline_case.stderr
        )

    space_fake_shelf_desk_case = run_design_gate_case(
        """
    ## 设计稿来源（用户可见 UI 如适用）

    - Design artifact: docs/design/mocks/space-surface-shelf-desk-v1-fake.md
    - Interaction/motion artifact: N/A
    - Physical space artifact: docs/design/physical-space/space-model-v1.md
    - Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
    - Unimplemented design gaps: No known gaps.

    ## design_review_checklist（如适用）

    - Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
    - Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
    - AP-22: AP-22 design review checklist was answered before render with six questions recorded.
    - AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
    """,
        ["apps/mobile/src/space/SpaceSurface.tsx"],
    )
    if space_fake_shelf_desk_case.returncode == 0:
        errors.append(
            "validate_pr_design_gate.py must reject prefix-spoofed Space visual proof artifact names"
        )
    elif "Space visual proof" not in (
        space_fake_shelf_desk_case.stdout + space_fake_shelf_desk_case.stderr
    ):
        errors.append(
            "validate_pr_design_gate.py prefix-spoofed Space visual proof rejection must explain the required artifact"
        )
