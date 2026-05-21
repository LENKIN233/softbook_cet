design_harness_text = (ROOT / "docs/design/design-harness.md").read_text(encoding="utf-8")
for snippet in [
    "### Design Evolution Engine",
    "generate candidate population",
    "pairwise-rank surviving candidates",
    "harvest strongest fragments",
    "targeted mutation",
    "docs/design/search-runs/README.md",
    "### Design Quarantine Harness",
    "docs/design/design-quarantine.md",
    "### Single-Card UX Contract Gate",
    "docs/design/single-card-ux-contract.md",
]:
    check_contains("design harness evolution engine", design_harness_text, snippet)

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

single_card_ux_text = (ROOT / "docs/design/single-card-ux-contract.md").read_text(encoding="utf-8")
for snippet in [
    "Single-card flow means the learner works through one current CET card",
    "It does not mean every control, explanation, statistic, navigation option, and state must fit into one static screen.",
    "current_card",
    "primary_task",
    "primary_action",
    "feedback_state",
    "escape_or_recovery",
    "space_continuity",
    "the current task and primary action are always findable",
]:
    check_contains("single-card UX contract", single_card_ux_text, snippet)

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

design_search_readme = ROOT / "docs/design/search-runs/README.md"
if not design_search_readme.exists():
    errors.append("missing Design Evolution Engine README: docs/design/search-runs/README.md")
else:
    design_search_text = design_search_readme.read_text(encoding="utf-8")
    for snippet in [
        "## Product Truth",
        "## Implementation Hypothesis",
        "## Required Loop",
        "at least 8 materially different candidates",
        "Pairwise Review",
        "Fragment Harvest",
        "Targeted Mutation",
        "Failure Sedimentation",
        "rejects copied templates",
        "candidate-bound visual evidence for every surviving candidate",
        "candidate-bound pairwise visual evidence for both compared candidates",
        "enough pairwise reviews to cover the candidate set",
    ]:
        check_contains("design search README", design_search_text, snippet)

design_search_script = ROOT / "scripts" / "validate_design_search_run.py"
if not design_search_script.exists():
    errors.append("missing design search validator: scripts/validate_design_search_run.py")
else:
    fixture_parent = ROOT / ".tmp" / "harness-validator"
    fixture_parent.mkdir(parents=True, exist_ok=True)

    design_search_validation = subprocess.run(
        [sys.executable, str(design_search_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if design_search_validation.returncode != 0:
        errors.append(
            "validate_design_search_run.py must pass repository templates: "
            + (design_search_validation.stdout + design_search_validation.stderr).strip()
        )

    with tempfile.TemporaryDirectory(
        prefix="design-search-template-",
        dir=fixture_parent,
    ) as tmp_dir:
        tmp_run = Path(tmp_dir) / "empty-template-regression"
        (tmp_run / "candidates").mkdir(parents=True)
        (tmp_run / "pairwise-reviews").mkdir()
        for filename in [
            "context-pack.md",
            "hard-filter-results.md",
            "fragment-harvest.md",
            "mutation-log.md",
            "promotion-record.md",
        ]:
            shutil.copyfile(ROOT / "docs/design/search-runs/templates" / filename, tmp_run / filename)
        (tmp_run / "candidate-index.md").write_text("# Candidate Index\n", encoding="utf-8")
        for index in range(1, 9):
            shutil.copyfile(
                ROOT / "docs/design/search-runs/templates/candidate-record.md",
                tmp_run / "candidates" / f"candidate-{index}.md",
            )
        shutil.copyfile(
            ROOT / "docs/design/search-runs/templates/pairwise-review.md",
            tmp_run / "pairwise-reviews/round-1-candidate-1-vs-candidate-2.md",
        )
        template_only_run = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(tmp_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if template_only_run.returncode == 0:
            errors.append("validate_design_search_run.py must reject copied-template search runs")
        else:
            template_regression_output = template_only_run.stdout + template_only_run.stderr
            for snippet in [
                "template placeholder",
                "pairwise reviews must include every surviving candidate",
                "must be backed by rendered-proof.html, external-prototype.md, screenshots/, or a concrete prototype URL",
            ]:
                if snippet not in template_regression_output:
                    errors.append(f"validate_design_search_run.py template regression missing expected rejection: {snippet}")

    def write_design_search_fixture(
        run_dir: Path,
        *,
        source_contexts: dict[int, str] | None = None,
        surviving: list[int] | None = None,
        rejected: list[int] | None = None,
        pairwise_pairs: list[tuple[int, int]] | None = None,
        winning_candidate: str = "candidate-1",
    ) -> None:
        if run_dir.exists():
            shutil.rmtree(run_dir)
        (run_dir / "candidates").mkdir(parents=True)
        (run_dir / "pairwise-reviews").mkdir()
        (run_dir / "candidate-proofs").mkdir()
        surviving = surviving or list(range(1, 9))
        rejected = rejected or []
        pairwise_pairs = pairwise_pairs or [(index, index + 1) for index in range(1, len(surviving))]
        source_contexts = source_contexts or {}

        def write(path: Path, text: str) -> None:
            path.write_text(text.strip() + "\n", encoding="utf-8")

        write(
            run_dir / "context-pack.md",
            """
# Context Pack

## Surface
Space surface validator regression.

## Accepted Baseline
Baseline: docs/design/mocks/space-surface-visual-refinement-v1.md.

## Product Truth
CET cards, interactions, and physical space remain product truth.

## Hard Constraints
Law of One, Space hierarchy, and implementation authority boundaries.

## Soft Objectives
Low-burden first read and stronger current box focus.

## Source Artifacts
Active baseline, visual-language, and physical-space artifacts.

## Forbidden Drift
No generic dashboard or flat list.

## Candidate Budget
Eight candidates, one generation, human checkpoint.
            """,
        )
        write(run_dir / "candidate-index.md", "# Candidate Index\n\n" + "\n".join(f"- candidate-{index}" for index in range(1, 9)))
        write(
            run_dir / "hard-filter-results.md",
            f"""
# Hard Filter Results

## Filter Scope
Generation one Space candidates against baseline and hard filters.

## Rejected Candidates
{', '.join(f'candidate-{index}' for index in rejected) if rejected else 'No candidates rejected.'}

## Surviving Candidates
{', '.join(f'candidate-{index}' for index in surviving)}

## Product Truth Violations
Rejected candidates weaken hierarchy; survivors keep product truth.

## Layout Or Proof Violations
Rejected candidates lack proof; survivors preserve containment.

## Notes For Mutation
Strengthen physical object address and reduce dashboard density.
            """,
        )
        write(
            run_dir / "fragment-harvest.md",
            """
# Fragment Harvest

## Best Focal Object
candidate-1 keeps the current box as the focal object.

## Best First-Read Path
candidate-2 gives card address before actions.

## Best State Language
candidate-3 handles sleep and wake as gentle states.

## Best Space Or Interaction Model
candidate-4 keeps library group box card hierarchy visible.

## Best Platform Adaptation
candidate-5 has phone and tablet hierarchy options.

## Rejected Failure Patterns
candidate-8 dashboard density is rejected.

## Synthesis Inputs
Use current box, address strip, and restrained actions.
            """,
        )
        write(
            run_dir / "mutation-log.md",
            """
# Mutation Log

## Failure Signal
candidate-8 collapses current box into dashboard density.

## Targeted Mutation
Make current box a physical desk object with parent context.

## Expected Improvement
The next generation should improve hierarchy recognition.

## Risk
The object treatment might become decorative.

## Result
Mutation improved hierarchy but needs containment review.
            """,
        )
        write(
            run_dir / "promotion-record.md",
            f"""
# Promotion Record

## Promoted Artifact
Probe artifact would update a Space visual mock.

## Winning Candidate
{winning_candidate}

## Baseline Comparison
{winning_candidate} beats baseline on first-read current box focus without regressing authority.

## Borrowed Fragments
Address strip from candidate-2 and state chip from candidate-3.

## Rejected Fragments
Dashboard metrics from candidate-8 are rejected.

## Rendered Proof
rendered-proof.html in this run proves the layout.

## Implementation Mapping Expectations
Future RN mapping must keep box desk, address, and operations separate.

## Unimplemented Gaps
No RN implementation authority is granted by this probe.

## Failure Sedimentation
Add dashboard-density failure to rejected notes if this were real.

## Design Review Checklist Answers
Q1: Current library is named and Law of One is kept.
Q2: Current box is focal object; address then operations is the read path.
Q3: Space hierarchy uses library group box card and no flat list.
Q4: No forbidden dashboard or two-box collapse is approved.
Q5: Containment is backed by rendered proof for target viewport.
Q6: Learning rules are not changed in this Space probe.
            """,
        )
        write(run_dir / "rendered-proof.html", "<!doctype html><title>probe</title><main>Concrete proof</main>")
        write(
            run_dir / "candidate-proofs/survivor-comparison.html",
            "<!doctype html><title>candidate proof</title><main>candidate-1 candidate-2 candidate-3 candidate-4 candidate-5 candidate-6 candidate-7 candidate-8</main>",
        )

        for index in range(1, 9):
            source_context = source_contexts.get(index, "context-pack.md")
            write(
                run_dir / "candidates" / f"candidate-{index}.md",
                f"""
# Candidate {index}

## Candidate ID
candidate-{index}

## Provenance
- Tool or model: probe-model
- Prompt: concrete prompt for candidate {index}
- Source context pack: {source_context}
- Artifact: candidate-proofs/survivor-comparison.html#candidate-{index}
- Screenshots: candidate-proofs/survivor-comparison.html#candidate-{index}

## Product Truth Fit
candidate-{index} preserves CET cards, interactions, and physical-space hierarchy.

## Focal Object
The current box object is primary for candidate-{index}.

## First-Read Path
Read box address, card state, then allowed action.

## Interaction Silhouette
Space hierarchy silhouette with library group box card visibility.

## Spatial Model
Library, group, box, and card are all named with current card address.

## State Language
Favorite tag, sleep, wake, and review state remain distinct.

## Motion Causality
Motion follows state change only and is not decorative.

## Platform Strategy
Phone is bounded target; tablet and pc web implications are named.

## Implementation Mapping
Regions map to future Space surface without granting implementation authority.

## Known Risks
Risk is density, containment, and over-decoration.

## Design Review Checklist Answers
Q1: Current library is vocabulary; Law of One is kept.
Q2: Current box is focal object and first-read path is explicit.
Q3: Space hierarchy silhouette is preserved.
Q4: Forbidden patterns are rejected.
Q5: Target viewport containment is claimed by proof.
Q6: Learning and flip rules are not changed.
                """,
            )

        for index, (candidate_a, candidate_b) in enumerate(pairwise_pairs, start=1):
            write(
                run_dir / "pairwise-reviews" / f"round-{index}-candidate-{candidate_a}-vs-candidate-{candidate_b}.md",
                f"""
# Pairwise Review {index}

## Pair
- Candidate A: candidate-{candidate_a}
- Candidate B: candidate-{candidate_b}

## Reviewer Role
Product Truth reviewer for probe {index}.

## Winner
candidate-{candidate_a}

## Visual Evidence
Compared candidate-{candidate_a} and candidate-{candidate_b} in candidate-proofs/survivor-comparison.html#candidate-{candidate_a} and candidate-proofs/survivor-comparison.html#candidate-{candidate_b}.

## Product Truth
candidate-{candidate_a} better preserves the product truth for current box focus.

## Task Clarity
candidate-{candidate_a} makes the next action clearer.

## Space Or Interaction Fit
candidate-{candidate_a} preserves the Space hierarchy better.

## Visual System Fit
candidate-{candidate_a} keeps Law of One and clear state language.

## Implementation Mapping
candidate-{candidate_a} maps cleanly without inventing code authority.

## Rationale
The decision is concrete enough for this validator probe.

## Borrowable Fragments
Address strip can be borrowed from candidate-{candidate_b}.

## Rejected Fragments
Weak dashboard density should be rejected.
                """,
            )

    with tempfile.TemporaryDirectory(
        prefix="design-search-regressions-",
        dir=fixture_parent,
    ) as tmp_dir:
        regression_root = Path(tmp_dir)
        coverage_run = regression_root / "pairwise-coverage-regression"
        promotion_run = regression_root / "promotion-consistency-regression"
        visual_evidence_run = regression_root / "candidate-visual-evidence-regression"
        borrowed_evidence_run = regression_root / "borrowed-visual-evidence-regression"

        write_design_search_fixture(
            coverage_run,
            pairwise_pairs=[(1, 2)] * 7,
            winning_candidate="candidate-1",
        )
        coverage_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(coverage_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if coverage_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject pairwise reviews that do not cover every surviving candidate")
        else:
            coverage_output = coverage_case.stdout + coverage_case.stderr
            for snippet in [
                "pairwise reviews must include every surviving candidate",
                "connected comparison graph",
            ]:
                if snippet not in coverage_output:
                    errors.append(f"validate_design_search_run.py pairwise coverage regression missing expected rejection: {snippet}")

        write_design_search_fixture(
            promotion_run,
            source_contexts={index: ("context-pack-a.md" if index % 2 else "context-pack-b.md") for index in range(1, 9)},
            surviving=list(range(1, 8)),
            rejected=[8],
            pairwise_pairs=[(index, index + 1) for index in range(1, 7)],
            winning_candidate="candidate-99",
        )
        promotion_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(promotion_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if promotion_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject promotion records that do not bind to known surviving reviewed candidates")
        else:
            promotion_output = promotion_case.stdout + promotion_case.stderr
            for snippet in [
                "candidate records must all use the same Source context pack",
                "candidate Source context pack must reference context-pack.md",
                "references unknown candidate id(s): candidate-99",
                "must reference at least one known candidate id",
            ]:
                if snippet not in promotion_output:
                    errors.append(f"validate_design_search_run.py promotion consistency regression missing expected rejection: {snippet}")

        write_design_search_fixture(
            visual_evidence_run,
            surviving=list(range(1, 8)),
            rejected=[8],
            pairwise_pairs=[(index, index + 1) for index in range(1, 7)],
            winning_candidate="candidate-1",
        )
        candidate_three = visual_evidence_run / "candidates/candidate-3.md"
        candidate_three.write_text(
            candidate_three.read_text(encoding="utf-8")
            .replace("- Artifact: candidate-proofs/survivor-comparison.html#candidate-3", "- Artifact: prose-only candidate record")
            .replace("- Screenshots: candidate-proofs/survivor-comparison.html#candidate-3", "- Screenshots: visual evidence omitted"),
            encoding="utf-8",
        )
        pairwise_two = visual_evidence_run / "pairwise-reviews/round-2-candidate-2-vs-candidate-3.md"
        pairwise_two.write_text(
            pairwise_two.read_text(encoding="utf-8").replace(
                "## Visual Evidence\nCompared candidate-2 and candidate-3 in candidate-proofs/survivor-comparison.html#candidate-2 and candidate-proofs/survivor-comparison.html#candidate-3.\n",
                "## Visual Evidence\nPairwise review relied on prose only.\n",
            ),
            encoding="utf-8",
        )
        visual_evidence_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(visual_evidence_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if visual_evidence_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject surviving candidates or pairwise reviews without visual evidence")
        else:
            visual_evidence_output = visual_evidence_case.stdout + visual_evidence_case.stderr
            for snippet in [
                "surviving candidate must reference candidate-bound rendered HTML",
                "visual evidence must include candidate-bound evidence for compared candidate id(s)",
                "visual evidence must reference rendered HTML",
            ]:
                if snippet not in visual_evidence_output:
                    errors.append(f"validate_design_search_run.py visual evidence regression missing expected rejection: {snippet}")

        write_design_search_fixture(
            borrowed_evidence_run,
            pairwise_pairs=[(index, index + 1) for index in range(1, 8)],
            winning_candidate="candidate-1",
        )
        candidate_two = borrowed_evidence_run / "candidates/candidate-2.md"
        candidate_two.write_text(
            candidate_two.read_text(encoding="utf-8")
            .replace("candidate-proofs/survivor-comparison.html#candidate-2", "candidate-proofs/survivor-comparison.html#candidate-1"),
            encoding="utf-8",
        )
        pairwise_one = borrowed_evidence_run / "pairwise-reviews/round-1-candidate-1-vs-candidate-2.md"
        pairwise_one.write_text(
            pairwise_one.read_text(encoding="utf-8").replace(
                "candidate-proofs/survivor-comparison.html#candidate-2",
                "candidate-proofs/survivor-comparison.html#candidate-1",
            ),
            encoding="utf-8",
        )
        borrowed_evidence_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(borrowed_evidence_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if borrowed_evidence_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject borrowed visual evidence that is not bound to the candidate under review")
        else:
            borrowed_evidence_output = borrowed_evidence_case.stdout + borrowed_evidence_case.stderr
            for snippet in [
                "surviving candidate must reference candidate-bound rendered HTML",
                "visual evidence must include candidate-bound evidence for compared candidate id(s)",
            ]:
                if snippet not in borrowed_evidence_output:
                    errors.append(f"validate_design_search_run.py borrowed evidence regression missing expected rejection: {snippet}")

    for cleanup_dir in [fixture_parent, fixture_parent.parent]:
        try:
            cleanup_dir.rmdir()
        except OSError:
            pass

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

    agent_review_only = subprocess.run(
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
- Review summary: Reviewed changed files.
""",
        },
    )
    if agent_review_only.returncode == 0:
        errors.append("validate_agent_review.py must reject PR bodies that only contain Agent review")
    elif "当前任务引用的 spec" not in (agent_review_only.stdout + agent_review_only.stderr):
        errors.append("validate_agent_review.py required-section rejection must mention missing spec section")

    unchecked_validation_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## 当前任务引用的 spec

- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`

## 变更摘要

- Validate PR body review records.

## 验证

- [ ] `python3 scripts/validate_harness.py`

## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files.

## Agent run record

- Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
""",
        },
    )
    if unchecked_validation_review.returncode == 0:
        errors.append("validate_agent_review.py must reject unchecked validation boxes")
    elif "unchecked validation boxes" not in (
        unchecked_validation_review.stdout + unchecked_validation_review.stderr
    ):
        errors.append("validate_agent_review.py unchecked validation rejection must explain the problem")

    skip_remote_only_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## 当前任务引用的 spec

- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`

## 变更摘要

- Validate PR body review records.

## 验证

- [x] `python3 scripts/validate_harness.py --skip-remote-guard`

## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files.

## Agent run record

- Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
""",
        },
    )
    if skip_remote_only_review.returncode == 0:
        errors.append("validate_agent_review.py must reject PR records that only ran --skip-remote-guard harness")
    elif "full `python3 scripts/validate_harness.py`" not in (
        skip_remote_only_review.stdout + skip_remote_only_review.stderr
    ):
        errors.append("validate_agent_review.py skip-remote rejection must require full harness")

    valid_agent_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## 当前任务引用的 spec

- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`

## 变更摘要

- Validate PR body review records.

## 验证

- [x] `python3 scripts/validate_harness.py`
- [x] `python3 scripts/validate_agent_review.py`

## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files, specs, validation, and found no blocking issues.

## Agent run record

- Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
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
