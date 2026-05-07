#!/usr/bin/env python3
"""Validate Design Evolution Engine search-run structure."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEARCH_ROOT = ROOT / "docs" / "design" / "search-runs"
TEMPLATE_ROOT = SEARCH_ROOT / "templates"

REQUIRED_TEMPLATES = {
    "context-pack.md": (
        "## Product Truth",
        "## Hard Constraints",
        "## Soft Objectives",
        "## Forbidden Drift",
        "## Candidate Budget",
    ),
    "candidate-record.md": (
        "# DesignCandidate Template",
        "## Provenance",
        "## Product Truth Fit",
        "## Focal Object",
        "## First-Read Path",
        "## Interaction Silhouette",
        "## Spatial Model",
        "## State Language",
        "## Motion Causality",
        "## Platform Strategy",
        "## Implementation Mapping",
        "## Known Risks",
        "## Design Review Checklist Answers",
    ),
    "pairwise-review.md": (
        "## Pair",
        "## Reviewer Role",
        "## Winner",
        "## Product Truth",
        "## Task Clarity",
        "## Space Or Interaction Fit",
        "## Visual System Fit",
        "## Implementation Mapping",
        "## Borrowable Fragments",
        "## Rejected Fragments",
    ),
    "fragment-harvest.md": (
        "## Best Focal Object",
        "## Best First-Read Path",
        "## Best State Language",
        "## Best Space Or Interaction Model",
        "## Best Platform Adaptation",
        "## Rejected Failure Patterns",
        "## Synthesis Inputs",
    ),
    "mutation-log.md": (
        "## Failure Signal",
        "## Targeted Mutation",
        "## Expected Improvement",
        "## Risk",
        "## Result",
    ),
    "hard-filter-results.md": (
        "## Filter Scope",
        "## Rejected Candidates",
        "## Surviving Candidates",
        "## Product Truth Violations",
        "## Layout Or Proof Violations",
        "## Notes For Mutation",
    ),
    "promotion-record.md": (
        "## Promoted Artifact",
        "## Winning Candidate",
        "## Baseline Comparison",
        "## Borrowed Fragments",
        "## Rejected Fragments",
        "## Rendered Proof",
        "## Implementation Mapping Expectations",
        "## Unimplemented Gaps",
        "## Failure Sedimentation",
        "## Design Review Checklist Answers",
    ),
}

RUN_REQUIRED_FILES = (
    "context-pack.md",
    "candidate-index.md",
    "hard-filter-results.md",
    "fragment-harvest.md",
    "mutation-log.md",
    "promotion-record.md",
)

CANDIDATE_REQUIRED_SNIPPETS = REQUIRED_TEMPLATES["candidate-record.md"][1:]
PAIRWISE_REQUIRED_SNIPPETS = REQUIRED_TEMPLATES["pairwise-review.md"]
PROMOTION_REQUIRED_SNIPPETS = REQUIRED_TEMPLATES["promotion-record.md"]

PLACEHOLDER_SNIPPETS = (
    "Name the target surface and device class.",
    "Name the accepted artifact this run must beat or extend.",
    "List non-negotiable product truths for this run.",
    "List pass/fail constraints",
    "List weighted but non-authoritative objectives",
    "List accepted artifacts, mapping records, rendered proofs",
    "List tempting but wrong directions",
    "State population size, generation limit, top-k, and human checkpoint rules.",
    "`surface-generation-short-name`",
    "Explain which product truths this candidate preserves and any risk it introduces.",
    "Name the first object the user should notice.",
    "Describe the visual read order.",
    "Name the Learning silhouette or explain the Space hierarchy silhouette.",
    "For Space or Learning-Space continuity, describe library / group / box / card visibility.",
    "Describe favorite, sleep/wake, self-assess, correctness",
    "Describe the operation/state cause behind any motion.",
    "Explain phone, tablet, and pc web implications",
    "Map major regions to existing or future code surfaces",
    "List product, visual, layout, accessibility, and implementation risks.",
    "Product Truth / UX Task / Visual System",
    "Name A, B, or `no winner`.",
    "Which candidate better preserves the product truth?",
    "Which candidate makes the next user action clearer",
    "Which candidate better preserves Space hierarchy",
    "Which candidate better preserves Law of One",
    "Which candidate maps more cleanly to RN/Web",
    "Explain the decision in concrete design terms.",
    "List fragments worth harvesting from either candidate.",
    "List fragments that should not survive to the next generation.",
    "Candidate and reason.",
    "Candidate, usefulness, risk, and rollback condition.",
    "Failures to sediment into rejected docs",
    "List the fragments that must inform the next generation or promoted synthesis.",
    "State source generation and target generation.",
    "Name the observed failure from hard filters",
    "Describe the concrete change requested from the next generator.",
    "Explain which objective should improve and why.",
    "Explain what the mutation might damage.",
    "State whether the mutation improved, regressed, or stayed inconclusive after review.",
    "Name the candidate or synthesis that won.",
    "Explain how the winner beats the accepted baseline",
    "List fragments taken from losing candidates.",
    "List tempting fragments that are intentionally rejected.",
    "Name rendered HTML, screenshots, Figma prototype, or equivalent external proof.",
    "State the regions future RN/Web implementation must map.",
    "List gaps future implementation or design-only PRs must not hide.",
    "List updates to rejected docs, evals, perturbation audit, forbidden patterns, or validator regressions.",
    "List the candidates rejected by hard filters and why.",
    "List the candidates that survived hard filters.",
    "Name any product-truth blocker found during hard filtering.",
    "Name containment, accessibility, rendering, or proof failures.",
    "List failure signals that must drive targeted mutation.",
)

MISSING_VALUES = {"", "n/a", "na", "none", "null", "不适用", "无", "tbd", "todo"}
REQUIRED_Q_IDS = ("Q1", "Q2", "Q3", "Q4", "Q5", "Q6")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_file_contains(errors: list[str], path: Path, snippets: tuple[str, ...]) -> None:
    if not path.exists():
        errors.append(f"missing file: {path.relative_to(ROOT)}")
        return
    text = read_text(path)
    for snippet in snippets:
        if snippet not in text:
            errors.append(f"{path.relative_to(ROOT)} missing required snippet {snippet!r}")


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def reject_template_placeholders(errors: list[str], path: Path, text: str) -> None:
    for snippet in PLACEHOLDER_SNIPPETS:
        if snippet in text:
            errors.append(f"{rel(path)} still contains template placeholder {snippet!r}")


def section_body(text: str, heading: str) -> str | None:
    pattern = rf"(?ms)^{re.escape(heading)}\s*$\n(?P<body>.*?)(?=^##\s+|\Z)"
    match = re.search(pattern, text)
    if not match:
        return None
    return match.group("body").strip()


def has_concrete_text(value: str | None) -> bool:
    if value is None:
        return False
    normalized = re.sub(r"\s+", " ", value).strip()
    if normalized.lower() in MISSING_VALUES:
        return False
    if not normalized:
        return False
    if all(char in "-*:：`# " for char in normalized):
        return False
    return bool(re.search(r"[A-Za-z0-9\u4e00-\u9fff]", normalized))


def check_concrete_sections(errors: list[str], path: Path, text: str, headings: tuple[str, ...]) -> None:
    for heading in headings:
        body = section_body(text, heading)
        if not has_concrete_text(body):
            errors.append(f"{rel(path)} section {heading!r} must contain concrete content")


def line_value(text: str, label: str) -> str | None:
    pattern = rf"(?im)^\s*-\s*{re.escape(label)}\s*:\s*(.+?)\s*$"
    match = re.search(pattern, text)
    if not match:
        return None
    return match.group(1).strip()


def check_line_values(errors: list[str], path: Path, text: str, labels: tuple[str, ...]) -> None:
    for label in labels:
        value = line_value(text, label)
        if not has_concrete_text(value):
            errors.append(f"{rel(path)} line {label!r} must contain a concrete value")


def q_body(text: str, qid: str) -> str | None:
    pattern = rf"(?ms)^{re.escape(qid)}:\s*(?P<body>.*?)(?=^Q[1-6]:|\Z)"
    match = re.search(pattern, text)
    if not match:
        return None
    return match.group("body").strip()


def check_checklist_answers(errors: list[str], path: Path, text: str) -> None:
    for qid in REQUIRED_Q_IDS:
        if not has_concrete_text(q_body(text, qid)):
            errors.append(f"{rel(path)} checklist answer {qid} must contain concrete evidence")


def validate_record(
    errors: list[str],
    path: Path,
    required_snippets: tuple[str, ...],
    concrete_sections: tuple[str, ...],
    line_labels: tuple[str, ...] = (),
    require_checklist: bool = False,
) -> str | None:
    check_file_contains(errors, path, required_snippets)
    if not path.exists():
        return None

    text = read_text(path)
    reject_template_placeholders(errors, path, text)
    check_concrete_sections(errors, path, text, concrete_sections)
    if line_labels:
        check_line_values(errors, path, text, line_labels)
    if require_checklist:
        check_checklist_answers(errors, path, text)
    return text


def check_templates(errors: list[str]) -> None:
    if not SEARCH_ROOT.exists():
        errors.append("missing design search root: docs/design/search-runs")
        return
    if not TEMPLATE_ROOT.exists():
        errors.append("missing design search templates: docs/design/search-runs/templates")
        return
    for filename, snippets in REQUIRED_TEMPLATES.items():
        check_file_contains(errors, TEMPLATE_ROOT / filename, snippets)


def discover_run_dirs(explicit_runs: list[str]) -> list[Path]:
    if explicit_runs:
        return [(ROOT / run).resolve() if not Path(run).is_absolute() else Path(run) for run in explicit_runs]
    if not SEARCH_ROOT.exists():
        return []
    return [
        path
        for path in sorted(SEARCH_ROOT.iterdir())
        if path.is_dir() and path.name != "templates"
    ]


def validate_run(errors: list[str], run_dir: Path) -> None:
    try:
        rel_run = run_dir.relative_to(ROOT)
    except ValueError:
        errors.append(f"search run is outside repository: {run_dir}")
        return

    if not run_dir.exists():
        errors.append(f"missing search run: {rel_run}")
        return
    if not run_dir.is_dir():
        errors.append(f"search run is not a directory: {rel_run}")
        return

    for filename in RUN_REQUIRED_FILES:
        if not (run_dir / filename).exists():
            errors.append(f"{rel_run} missing required file {filename}")

    context_text = validate_record(
        errors,
        run_dir / "context-pack.md",
        REQUIRED_TEMPLATES["context-pack.md"],
        (
            "## Surface",
            "## Accepted Baseline",
            "## Product Truth",
            "## Hard Constraints",
            "## Soft Objectives",
            "## Source Artifacts",
            "## Forbidden Drift",
            "## Candidate Budget",
        ),
    )

    hard_filter_text = validate_record(
        errors,
        run_dir / "hard-filter-results.md",
        REQUIRED_TEMPLATES["hard-filter-results.md"],
        (
            "## Filter Scope",
            "## Rejected Candidates",
            "## Surviving Candidates",
            "## Product Truth Violations",
            "## Layout Or Proof Violations",
            "## Notes For Mutation",
        ),
    )

    validate_record(
        errors,
        run_dir / "fragment-harvest.md",
        REQUIRED_TEMPLATES["fragment-harvest.md"],
        REQUIRED_TEMPLATES["fragment-harvest.md"],
    )

    validate_record(
        errors,
        run_dir / "mutation-log.md",
        REQUIRED_TEMPLATES["mutation-log.md"],
        REQUIRED_TEMPLATES["mutation-log.md"],
    )

    candidates_dir = run_dir / "candidates"
    pairwise_dir = run_dir / "pairwise-reviews"
    candidate_files: list[Path] = []
    if not candidates_dir.is_dir():
        errors.append(f"{rel_run} missing candidates/ directory")
    if not pairwise_dir.is_dir():
        errors.append(f"{rel_run} missing pairwise-reviews/ directory")

    if candidates_dir.is_dir():
        candidate_files = sorted(
            path
            for path in candidates_dir.glob("*.md")
            if path.name.lower() != "readme.md"
        )
        if len(candidate_files) < 8:
            errors.append(f"{rel_run} must contain at least 8 candidate records for a completed core-surface run")
        candidate_index = run_dir / "candidate-index.md"
        candidate_index_text = read_text(candidate_index) if candidate_index.exists() else ""
        for candidate in candidate_files:
            validate_record(
                errors,
                candidate,
                CANDIDATE_REQUIRED_SNIPPETS,
                (
                    "## Candidate ID",
                    "## Product Truth Fit",
                    "## Focal Object",
                    "## First-Read Path",
                    "## Interaction Silhouette",
                    "## Spatial Model",
                    "## State Language",
                    "## Motion Causality",
                    "## Platform Strategy",
                    "## Implementation Mapping",
                    "## Known Risks",
                ),
                ("Tool or model", "Prompt", "Source context pack", "Artifact", "Screenshots"),
                require_checklist=True,
            )
            if candidate.stem not in candidate_index_text:
                errors.append(f"{rel_run}/candidate-index.md must reference candidate {candidate.stem}")

    if pairwise_dir.is_dir():
        pairwise_files = sorted(
            path
            for path in pairwise_dir.glob("*.md")
            if path.name.lower() != "readme.md"
        )
        min_pairwise_reviews = max(0, len(candidate_files) - 1) if candidates_dir.is_dir() else 0
        if len(pairwise_files) < min_pairwise_reviews:
            errors.append(
                f"{rel_run} must contain at least {min_pairwise_reviews} pairwise reviews "
                f"for {len(candidate_files)} candidates"
            )
        for pairwise in pairwise_files:
            validate_record(
                errors,
                pairwise,
                PAIRWISE_REQUIRED_SNIPPETS,
                (
                    "## Reviewer Role",
                    "## Winner",
                    "## Product Truth",
                    "## Task Clarity",
                    "## Space Or Interaction Fit",
                    "## Visual System Fit",
                    "## Implementation Mapping",
                    "## Rationale",
                    "## Borrowable Fragments",
                    "## Rejected Fragments",
                ),
                ("Candidate A", "Candidate B"),
            )

    promotion = run_dir / "promotion-record.md"
    if promotion.exists():
        promotion_text = validate_record(
            errors,
            promotion,
            PROMOTION_REQUIRED_SNIPPETS,
            (
                "## Promoted Artifact",
                "## Winning Candidate",
                "## Baseline Comparison",
                "## Borrowed Fragments",
                "## Rejected Fragments",
                "## Rendered Proof",
                "## Implementation Mapping Expectations",
                "## Unimplemented Gaps",
                "## Failure Sedimentation",
            ),
            require_checklist=True,
        )
        rendered_proof = section_body(promotion_text or "", "## Rendered Proof")
        proof_exists = any(
            (run_dir / proof_name).exists()
            for proof_name in ("rendered-proof.html", "external-prototype.md")
        )
        screenshots_dir = run_dir / "screenshots"
        screenshot_exists = screenshots_dir.is_dir() and any(path.is_file() for path in screenshots_dir.iterdir())
        proof_url = bool(rendered_proof and re.search(r"https?://\S+", rendered_proof))
        if not (proof_exists or screenshot_exists or proof_url):
            errors.append(
                f"{rel_run}/promotion-record.md must be backed by rendered-proof.html, "
                "external-prototype.md, screenshots/, or a concrete prototype URL"
            )

    if context_text is not None and "baseline" not in context_text.lower():
        errors.append(f"{rel_run}/context-pack.md must name an accepted baseline")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--run",
        action="append",
        default=[],
        help="specific search-run directory to validate; may be repeated",
    )
    parser.add_argument(
        "--skip-templates",
        action="store_true",
        help="validate runs only and skip template checks",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    errors: list[str] = []

    if not args.skip_templates:
        check_templates(errors)

    for run_dir in discover_run_dirs(args.run):
        validate_run(errors, run_dir)

    if errors:
        print("DESIGN SEARCH VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("DESIGN SEARCH VALIDATION OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
