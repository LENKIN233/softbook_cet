from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    check_contains = context.check_contains

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
        design_search_validation = context.run_validator(
            "scripts/validate_design_search_run.py"
        )
        if design_search_validation.returncode != 0:
            errors.append(
                "validate_design_search_run.py must pass repository templates: "
                + (design_search_validation.stdout + design_search_validation.stderr).strip()
            )

        with context.temporary_directory(prefix="design-search-template") as tmp_dir:
            tmp_run = tmp_dir / "empty-template-regression"
            (tmp_run / "candidates").mkdir(parents=True)
            (tmp_run / "pairwise-reviews").mkdir()
            for filename in [
                "context-pack.md",
                "hard-filter-results.md",
                "fragment-harvest.md",
                "mutation-log.md",
                "promotion-record.md",
            ]:
                context.copy_fixture_file(ROOT / "docs/design/search-runs/templates" / filename, tmp_run / filename)
            (tmp_run / "candidate-index.md").write_text("# Candidate Index\n", encoding="utf-8")
            for index in range(1, 9):
                context.copy_fixture_file(
                    ROOT / "docs/design/search-runs/templates/candidate-record.md",
                    tmp_run / "candidates" / f"candidate-{index}.md",
                )
            context.copy_fixture_file(
                ROOT / "docs/design/search-runs/templates/pairwise-review.md",
                tmp_run / "pairwise-reviews/round-1-candidate-1-vs-candidate-2.md",
            )
            template_only_run = context.run_validator(
                "scripts/validate_design_search_run.py",
                "--allow-external-fixture",
                "--run",
                str(tmp_run)
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
            run_dir = context.fixture_path(run_dir)
            if run_dir.exists():
                context.remove_fixture_tree(run_dir)
            (run_dir / "candidates").mkdir(parents=True)
            (run_dir / "pairwise-reviews").mkdir()
            (run_dir / "candidate-proofs").mkdir()
            surviving = surviving or list(range(1, 9))
            rejected = rejected or []
            pairwise_pairs = pairwise_pairs or [(index, index + 1) for index in range(1, len(surviving))]
            source_contexts = source_contexts or {}

            def write(path: Path, text: str) -> None:
                path = context.fixture_path(path)
                path.write_text(
                    context.normalize_fixture_text(text).strip() + "\n",
                    encoding="utf-8",
                )

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

        with context.temporary_directory(prefix="design-search-regressions") as regression_root:
            coverage_run = regression_root / "pairwise-coverage-regression"
            promotion_run = regression_root / "promotion-consistency-regression"
            visual_evidence_run = regression_root / "candidate-visual-evidence-regression"
            borrowed_evidence_run = regression_root / "borrowed-visual-evidence-regression"

            write_design_search_fixture(
                coverage_run,
                pairwise_pairs=[(1, 2)] * 7,
                winning_candidate="candidate-1",
            )
            coverage_case = context.run_validator(
                "scripts/validate_design_search_run.py",
                "--allow-external-fixture",
                "--run",
                str(coverage_run)
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
            promotion_case = context.run_validator(
                "scripts/validate_design_search_run.py",
                "--allow-external-fixture",
                "--run",
                str(promotion_run)
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
            visual_evidence_case = context.run_validator(
                "scripts/validate_design_search_run.py",
                "--allow-external-fixture",
                "--run",
                str(visual_evidence_run)
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
            borrowed_evidence_case = context.run_validator(
                "scripts/validate_design_search_run.py",
                "--allow-external-fixture",
                "--run",
                str(borrowed_evidence_run)
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
