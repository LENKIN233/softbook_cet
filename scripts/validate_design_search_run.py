#!/usr/bin/env python3
"""Validate Design Evolution Engine search-run structure."""

from __future__ import annotations

import argparse
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
    "fragment-harvest.md",
    "mutation-log.md",
    "promotion-record.md",
)

CANDIDATE_REQUIRED_SNIPPETS = REQUIRED_TEMPLATES["candidate-record.md"][1:]
PAIRWISE_REQUIRED_SNIPPETS = REQUIRED_TEMPLATES["pairwise-review.md"]
PROMOTION_REQUIRED_SNIPPETS = REQUIRED_TEMPLATES["promotion-record.md"]


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

    candidates_dir = run_dir / "candidates"
    pairwise_dir = run_dir / "pairwise-reviews"
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
        for candidate in candidate_files:
            check_file_contains(errors, candidate, CANDIDATE_REQUIRED_SNIPPETS)

    if pairwise_dir.is_dir():
        pairwise_files = sorted(
            path
            for path in pairwise_dir.glob("*.md")
            if path.name.lower() != "readme.md"
        )
        if not pairwise_files:
            errors.append(f"{rel_run} must contain at least one pairwise review")
        for pairwise in pairwise_files:
            check_file_contains(errors, pairwise, PAIRWISE_REQUIRED_SNIPPETS)

    promotion = run_dir / "promotion-record.md"
    if promotion.exists():
        check_file_contains(errors, promotion, PROMOTION_REQUIRED_SNIPPETS)
        promotion_text = read_text(promotion).lower()
        if "rendered-proof" not in promotion_text and "external-prototype" not in promotion_text and "figma" not in promotion_text:
            errors.append(f"{rel_run}/promotion-record.md must name rendered-proof, external-prototype, or Figma proof")


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
