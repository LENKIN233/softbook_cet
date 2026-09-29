from __future__ import annotations


def validate(context) -> None:
    """Optional comparison records scale to the task; claimed evidence stays bound."""
    history = context.run_validator("scripts/validate_design_search_run.py")
    if history.returncode != 0:
        context.errors.append("historical design bundles should remain readable: " + history.stdout + history.stderr)

    with context.temporary_directory(prefix="design-comparison-regressions-") as fixture_root:
        def write(path, text):
            destination = context.fixture_path(path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(context.normalize_fixture_text(text).strip() + "\n", encoding="utf-8")

        def make_run(name, candidates=2, compare=True):
            run = fixture_root / name
            write(run / "context-pack.md", "Compare ways to return to the current learning card at narrow width. Preserve card ownership and answer state.")
            for index in range(1, candidates + 1):
                write(run / "candidates" / f"candidate-{index}.md", f"""
                    ## Candidate ID
                    candidate-{index}
                    ## Provenance
                    - Source context pack: ../context-pack.md
                    - Artifact: proofs/option-{index}.html

                    This option keeps current-card location visible before returning.
                """)
                write(run / "proofs" / f"option-{index}.html", f'<main>Option {index}<button>Return to current card</button></main>')
            if compare:
                write(run / "pairwise-reviews" / "choice.md", """
                    ## Pair
                    - Candidate A: candidate-1
                    - Candidate B: candidate-2
                    ## Winner
                    candidate-2
                    ## Visual Evidence
                    proofs/option-1.html and proofs/option-2.html
                    ## Rationale
                    The second layout keeps the current card visible. This local comparison does not prove native-device behavior.
                """)
            return run

        def expect(run, allowed, message=None):
            result = context.run_validator("scripts/validate_design_search_run.py", "--allow-external-fixture", "--run", str(run))
            output = result.stdout + result.stderr
            if (result.returncode == 0) != allowed:
                context.errors.append(f"unexpected optional-comparison result for {run.name}: " + output)
            if message and message not in output:
                context.errors.append(f"comparison result for {run.name} must explain {message!r}: " + output)

        # Old gate rejected this legitimate two-option comparison for having
        # fewer than eight candidates, no full lifecycle and no six-question ritual.
        small = make_run("two-option-comparison")
        expect(small, True, "reference integrity only, not a product-quality verdict")
        expect(make_run("single-observed-alternative", candidates=1, compare=False), True)
        expect(make_run("uncompared-draft-retained", candidates=3), True)

        missing = make_run("missing-evidence")
        missing_proof = context.fixture_path(missing / "proofs/option-2.html")
        missing_proof.unlink()
        expect(missing, False, "references missing evidence")

        mismatched = make_run("mismatched-pair-evidence")
        review = context.fixture_path(mismatched / "pairwise-reviews/choice.md")
        review.write_text(review.read_text(encoding="utf-8").replace("proofs/option-2.html", "proofs/option-1.html"), encoding="utf-8")
        expect(mismatched, False, "visual evidence does not match compared candidate candidate-2")

        copied = make_run("borrowed-candidate-proof")
        candidate = context.fixture_path(copied / "candidates/candidate-2.md")
        candidate.write_text(candidate.read_text(encoding="utf-8").replace("proofs/option-2.html", "proofs/option-1.html"), encoding="utf-8")
        expect(copied, False, "shared evidence must distinguish both candidates")

        missing_anchor = make_run("missing-anchor")
        anchor_review = context.fixture_path(missing_anchor / "pairwise-reviews/choice.md")
        anchor_review.write_text(anchor_review.read_text(encoding="utf-8").replace("proofs/option-2.html", "proofs/option-2.html#not-present"), encoding="utf-8")
        expect(missing_anchor, False, "references missing evidence anchor")

        unknown_winner = make_run("unknown-comparison-winner")
        winner_review = context.fixture_path(unknown_winner / "pairwise-reviews/choice.md")
        winner_review.write_text(winner_review.read_text(encoding="utf-8").replace("## Winner\ncandidate-2", "## Winner\nunknown-option"), encoding="utf-8")
        expect(unknown_winner, False, "winner must be one of the compared candidates")

        unknown = make_run("unknown-selected-candidate")
        write(unknown / "promotion-record.md", """
            ## Winning Candidate
            candidate-99
            ## Rendered Proof
            proofs/option-2.html
            ## Rationale
            This selection cannot be tied to any existing candidate.
        """)
        expect(unknown, False, "selection must name an existing candidate")

        unknown_primary = make_run("unknown-primary-with-known-borrowed-fragment")
        write(unknown_primary / "promotion-record.md", """
            ## Winning Candidate
            unknown-option wins. It borrows the return action from candidate-1.
            ## Rendered Proof
            proofs/option-1.html
            ## Rationale
            A known borrowed fragment cannot make an unknown primary candidate valid.
        """)
        expect(unknown_primary, False, "selection must name an existing candidate")

        wrong_selection_proof = make_run("wrong-selection-proof")
        write(wrong_selection_proof / "promotion-record.md", """
            ## Winning Candidate
            candidate-1
            ## Rendered Proof
            proofs/option-2.html
            ## Rationale
            The selected candidate must have its own declared evidence.
        """)
        expect(wrong_selection_proof, False, "rendered evidence does not match selected candidate candidate-1")

        named_directory = make_run("candidate-2", candidates=3)
        named_review = context.fixture_path(named_directory / "pairwise-reviews/choice.md")
        named_review.write_text(named_review.read_text(encoding="utf-8").replace("proofs/option-2.html", "proofs/option-3.html"), encoding="utf-8")
        expect(named_directory, False, "visual evidence does not match compared candidate candidate-2")

        # Equivalent filename and HTML-anchor syntax must not change validation.
        # Local URI decoding preserves the whole path and fragment.
        for name, filenames, references, markup in [
            ("balanced-parentheses", ("option(wide).html", "option(narrow).html"), ("[wide](proofs/option(wide).html)", "[narrow](proofs/option(narrow).html)"), ("<main>Wide</main>", "<main>Narrow</main>")),
            ("unicode-filenames", ("方案甲.html", "方案乙.html"), ("[甲](proofs/方案甲.html)", "[乙](proofs/方案乙.html)"), ("<main>甲</main>", "<main>乙</main>")),
            ("space-filenames", ("option one.html", "option two.html"), ("[first](<proofs/option one.html>)", "[second](<proofs/option two.html>)"), ("<main>One</main>", "<main>Two</main>")),
            ("encoded-filenames", ("option one.html", "option two.html"), ("[first](proofs/option%20one.html)", "[second](proofs/option%20two.html)"), ("<main>One</main>", "<main>Two</main>")),
            ("unicode-anchors", ("first.html", "second.html"), ("proofs/first.html#方案甲", "proofs/second.html#方案乙"), ('<main id="方案甲">One</main>', '<main id="方案乙">Two</main>')),
            ("html-id-syntax", ("first.html", "second.html"), ("proofs/first.html#first", "proofs/second.html#second"), ('<main ID="first">One</main>', '<main id=second>Two</main>')),
            ("query-and-encoded-anchor", ("first.html", "second.html"), ("proofs/first.html?mode=wide#%E7%94%B2", "proofs/second.html?mode=wide#%E4%B9%99"), ('<main id="甲">One</main>', '<main id="乙">Two</main>')),
        ]:
            variation = make_run(name)
            variation_review = context.fixture_path(variation / "pairwise-reviews/choice.md")
            review_text = variation_review.read_text(encoding="utf-8")
            for index in (1, 2):
                write(variation / "proofs" / filenames[index - 1], markup[index - 1])
                variation_candidate = context.fixture_path(variation / "candidates" / f"candidate-{index}.md")
                old_ref = f"proofs/option-{index}.html"
                variation_candidate.write_text(variation_candidate.read_text(encoding="utf-8").replace(old_ref, references[index - 1]), encoding="utf-8")
                review_text = review_text.replace(old_ref, references[index - 1])
            variation_review.write_text(review_text, encoding="utf-8")
            expect(variation, True)
            if name == "balanced-parentheses":
                missing_parenthesized = context.fixture_path(variation / "proofs" / filenames[1])
                missing_parenthesized.unlink()
                expect(variation, False, "references missing evidence")

        reference_style = make_run("reference-style-with-record-level-definitions")
        reference_review = context.fixture_path(reference_style / "pairwise-reviews/choice.md")
        reference_text = reference_review.read_text(encoding="utf-8")
        definitions = []
        for index in (1, 2):
            old_ref = f"proofs/option-{index}.html"
            reference_candidate = context.fixture_path(reference_style / "candidates" / f"candidate-{index}.md")
            definition = f"[proof-{index}]: {old_ref}"
            reference_candidate.write_text(
                reference_candidate.read_text(encoding="utf-8").replace(old_ref, f"[capture][proof-{index}]")
                + "\n## References\n" + definition + "\n", encoding="utf-8",
            )
            reference_text = reference_text.replace(old_ref, f"[capture][proof-{index}]")
            definitions.append(definition)
        reference_review.write_text(reference_text + "\n## References\n" + "\n".join(definitions) + "\n", encoding="utf-8")
        expect(reference_style, True)
        missing_referenced = context.fixture_path(reference_style / "proofs/option-2.html")
        missing_referenced.unlink()
        expect(reference_style, False, "references missing evidence")

        unicode_missing = make_run("missing-unicode-anchor")
        unicode_review = context.fixture_path(unicode_missing / "pairwise-reviews/choice.md")
        unicode_review.write_text(unicode_review.read_text(encoding="utf-8").replace("proofs/option-2.html", "proofs/option-2.html#不存在"), encoding="utf-8")
        expect(unicode_missing, False, "references missing evidence anchor")

        selected = make_run("selection-with-missing-proof")
        write(selected / "promotion-record.md", """
            ## Winning Candidate
            candidate-2
            ## Rendered Proof
            proofs/not-rendered.html
            ## Rationale
            Selected for current-card visibility; rendering is not actually present.
        """)
        expect(selected, False, "references missing evidence")
