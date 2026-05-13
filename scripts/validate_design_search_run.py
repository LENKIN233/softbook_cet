#!/usr/bin/env python3
"""Validate Design Evolution Engine search-run structure."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

from validate_pr_design_gate import scan_visual_output_files


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
        "## Visual Evidence",
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
    "Name the rendered proof, screenshot, external prototype, or candidate visual-evidence file used to compare Candidate A and Candidate B.",
    "Name the candidate-bound rendered proof, screenshot, external prototype, or candidate visual-evidence file used to compare Candidate A and Candidate B.",
    "rendered HTML / screenshot / external prototype URL / visual evidence path, or prose-only artifact for hard-filtered candidates.",
    "rendered evidence path for surviving candidates, or `No-render rationale: ...` for hard-filtered rejected candidates.",
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
CANDIDATE_LIKE_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9_.-]*-\d+\b")
VISUAL_EVIDENCE_RE = re.compile(
    r"(?P<ref>(?:docs/|[A-Za-z0-9_.-]+/|\.{1,2}/)?[A-Za-z0-9_./-]+\."
    r"(?:html|svg|png|jpg|jpeg|webp|md)(?:#[A-Za-z0-9_.-]+)?)",
    re.IGNORECASE,
)
EVIDENCE_URL_RE = re.compile(r"https?://[^\s`'\"),;<>]+", re.IGNORECASE)
NO_RENDER_RATIONALE_RE = re.compile(r"(?:No-render rationale|no-render rationale|不渲染理由)\s*[:：]\s*\S")


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


def normalize_id(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"\s+", " ", value).strip().strip("`'\"")
    match = CANDIDATE_LIKE_RE.search(normalized)
    if match:
        return match.group(0)
    if re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]*", normalized):
        return normalized
    return None


def candidate_id_from_record(text: str) -> str | None:
    return normalize_id(section_body(text, "## Candidate ID"))


def candidate_like_refs(text: str | None) -> set[str]:
    if not text:
        return set()
    return set(CANDIDATE_LIKE_RE.findall(text))


def known_candidate_refs(text: str | None, candidate_ids: set[str]) -> set[str]:
    if not text:
        return set()
    return {candidate_id for candidate_id in candidate_ids if re.search(rf"\b{re.escape(candidate_id)}\b", text)}


def unknown_candidate_refs(text: str | None, candidate_ids: set[str]) -> set[str]:
    return candidate_like_refs(text) - candidate_ids


def single_known_candidate_ref(
    errors: list[str],
    path: Path,
    label: str,
    value: str | None,
    candidate_ids: set[str],
) -> str | None:
    known_refs = known_candidate_refs(value, candidate_ids)
    unknown_refs = unknown_candidate_refs(value, candidate_ids)
    if unknown_refs:
        errors.append(f"{rel(path)} line {label!r} references unknown candidate id(s): {', '.join(sorted(unknown_refs))}")
    if len(known_refs) != 1:
        errors.append(f"{rel(path)} line {label!r} must reference exactly one known candidate id")
        return None
    return next(iter(known_refs))


def source_context_value(text: str) -> str | None:
    return line_value(text, "Source context pack")


def normalized_source_context(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip().strip("`'\"")


def strip_ref_anchor(value: str) -> str:
    return value.split("#", 1)[0].strip().strip("<>`'\".,;:)）")


def strip_ref_punctuation(value: str) -> str:
    return value.strip().strip("<>`'\".,;:)）")


def is_url_ref(ref: str) -> bool:
    return bool(re.match(r"https?://", ref, re.IGNORECASE))


def resolve_evidence_path(run_dir: Path, ref: str) -> Path:
    clean_ref = strip_ref_anchor(ref)
    if clean_ref.startswith("docs/"):
        return ROOT / clean_ref
    return run_dir / clean_ref


def evidence_refs(value: str | None) -> set[str]:
    if not value:
        return set()
    refs = {strip_ref_punctuation(match.group("url")) for match in EVIDENCE_URL_RE.finditer(value)}
    refs.update(strip_ref_punctuation(match.group("ref")) for match in VISUAL_EVIDENCE_RE.finditer(value))
    return refs


def evidence_path_refs(value: str | None, run_dir: Path) -> set[str]:
    refs = set()
    for ref in evidence_refs(value):
        if is_url_ref(ref):
            continue
        path = resolve_evidence_path(run_dir, ref)
        if path.exists():
            refs.add(rel(path))
    return refs


def has_visual_evidence(value: str | None, run_dir: Path) -> bool:
    if not value:
        return False
    if EVIDENCE_URL_RE.search(value):
        return True
    return bool(evidence_path_refs(value, run_dir))


def ref_binds_candidate(ref: str, candidate_id: str) -> bool:
    return bool(re.search(rf"(?<![A-Za-z0-9_.-]){re.escape(candidate_id)}(?![A-Za-z0-9_.-])", ref))


def bound_visual_evidence_refs(value: str | None, run_dir: Path, candidate_id: str) -> set[str]:
    refs = set()
    for ref in evidence_refs(value):
        if not ref_binds_candidate(ref, candidate_id):
            continue
        if is_url_ref(ref) or resolve_evidence_path(run_dir, ref).exists():
            refs.add(ref)
    return refs


def has_bound_visual_evidence(value: str | None, run_dir: Path, candidate_id: str) -> bool:
    return bool(bound_visual_evidence_refs(value, run_dir, candidate_id))


def has_no_render_rationale(value: str | None) -> bool:
    return bool(value and NO_RENDER_RATIONALE_RE.search(value))


def connected_components(nodes: set[str], edges: list[tuple[str, str]]) -> int:
    if not nodes:
        return 0
    graph = {node: set() for node in nodes}
    for left, right in edges:
        if left in graph and right in graph:
            graph[left].add(right)
            graph[right].add(left)
    unseen = set(nodes)
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            current = stack.pop()
            for neighbor in graph[current]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
    return components


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
    candidate_source_contexts: dict[str, str] = {}
    candidate_texts: dict[str, str] = {}
    candidate_paths: dict[str, Path] = {}
    candidate_ids: set[str] = set()
    surviving_candidates: set[str] = set()
    rejected_candidates: set[str] = set()
    pairwise_participants: set[str] = set()
    pairwise_edges: list[tuple[str, str]] = []
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
            candidate_text = read_text(candidate)
            candidate_id = candidate_id_from_record(candidate_text)
            if not candidate_id:
                errors.append(f"{rel(candidate)} must state a concrete Candidate ID")
                candidate_id = candidate.stem
            if candidate_id != candidate.stem:
                errors.append(f"{rel(candidate)} Candidate ID must match filename stem {candidate.stem!r}")
            if candidate_id in candidate_ids:
                errors.append(f"{rel_run} duplicate candidate id: {candidate_id}")
            candidate_ids.add(candidate_id)
            candidate_texts[candidate_id] = candidate_text
            candidate_paths[candidate_id] = candidate
            source_context = normalized_source_context(source_context_value(candidate_text))
            candidate_source_contexts[candidate_id] = source_context
            if candidate_id not in candidate_index_text:
                errors.append(f"{rel_run}/candidate-index.md must reference candidate {candidate_id}")

        concrete_contexts = {
            candidate_id: source_context
            for candidate_id, source_context in candidate_source_contexts.items()
            if source_context
        }
        unique_contexts = set(concrete_contexts.values())
        if len(unique_contexts) > 1:
            errors.append(
                f"{rel_run} candidate records must all use the same Source context pack; got "
                + ", ".join(f"{candidate_id}={context}" for candidate_id, context in sorted(concrete_contexts.items()))
            )
        if unique_contexts and not all("context-pack.md" in context for context in unique_contexts):
            errors.append(f"{rel_run} candidate Source context pack must reference context-pack.md")

    if hard_filter_text is not None and candidate_ids:
        surviving_body = section_body(hard_filter_text, "## Surviving Candidates")
        rejected_body = section_body(hard_filter_text, "## Rejected Candidates")
        surviving_candidates = known_candidate_refs(surviving_body, candidate_ids)
        rejected_candidates = known_candidate_refs(rejected_body, candidate_ids)
        for section_name, body in (
            ("Surviving Candidates", surviving_body),
            ("Rejected Candidates", rejected_body),
            ("Product Truth Violations", section_body(hard_filter_text, "## Product Truth Violations")),
            ("Layout Or Proof Violations", section_body(hard_filter_text, "## Layout Or Proof Violations")),
            ("Notes For Mutation", section_body(hard_filter_text, "## Notes For Mutation")),
        ):
            unknown_refs = unknown_candidate_refs(body, candidate_ids)
            if unknown_refs:
                errors.append(
                    f"{rel_run}/hard-filter-results.md section {section_name!r} references unknown candidate id(s): "
                    + ", ".join(sorted(unknown_refs))
                )
        if not surviving_candidates:
            errors.append(f"{rel_run}/hard-filter-results.md must list at least one surviving known candidate")
        overlapping_candidates = surviving_candidates & rejected_candidates
        if overlapping_candidates:
            errors.append(
                f"{rel_run}/hard-filter-results.md lists candidate(s) as both rejected and surviving: "
                + ", ".join(sorted(overlapping_candidates))
            )
        unfiltered_candidates = candidate_ids - surviving_candidates - rejected_candidates
        if unfiltered_candidates:
            errors.append(
                f"{rel_run}/hard-filter-results.md must classify every candidate as rejected or surviving; missing "
                + ", ".join(sorted(unfiltered_candidates))
            )
        for candidate_id in sorted(surviving_candidates):
            candidate_text = candidate_texts.get(candidate_id, "")
            visual_evidence = "\n".join(
                value
                for value in [
                    line_value(candidate_text, "Artifact"),
                    line_value(candidate_text, "Screenshots"),
                ]
                if value
            )
            if not has_bound_visual_evidence(visual_evidence, run_dir, candidate_id):
                errors.append(
                    f"{rel(candidate_paths[candidate_id])} surviving candidate must reference "
                    "candidate-bound rendered HTML, screenshot, external prototype URL, or another existing visual evidence file"
                )
            evidence_paths = sorted(evidence_path_refs(visual_evidence, run_dir))
            errors.extend(scan_visual_output_files(evidence_paths))
        for candidate_id in sorted(rejected_candidates):
            candidate_text = candidate_texts.get(candidate_id, "")
            visual_evidence = "\n".join(
                value
                for value in [
                    line_value(candidate_text, "Artifact"),
                    line_value(candidate_text, "Screenshots"),
                ]
                if value
            )
            if not has_visual_evidence(visual_evidence, run_dir) and not has_no_render_rationale(visual_evidence):
                errors.append(
                    f"{rel(candidate_paths[candidate_id])} rejected candidate must reference visual evidence "
                    "or state a concrete No-render rationale"
                )

    if pairwise_dir.is_dir():
        pairwise_files = sorted(
            path
            for path in pairwise_dir.glob("*.md")
            if path.name.lower() != "readme.md"
        )
        pairwise_candidate_set = surviving_candidates if surviving_candidates else candidate_ids
        min_pairwise_reviews = max(0, len(pairwise_candidate_set) - 1)
        if len(pairwise_files) < min_pairwise_reviews:
            errors.append(
                f"{rel_run} must contain at least {min_pairwise_reviews} pairwise reviews "
                f"for {len(pairwise_candidate_set)} surviving candidates"
            )
        for pairwise in pairwise_files:
            pairwise_text = validate_record(
                errors,
                pairwise,
                PAIRWISE_REQUIRED_SNIPPETS,
                (
                    "## Reviewer Role",
                    "## Winner",
                    "## Visual Evidence",
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
            pairwise_text = pairwise_text or ""
            candidate_a = single_known_candidate_ref(
                errors,
                pairwise,
                "Candidate A",
                line_value(pairwise_text, "Candidate A"),
                candidate_ids,
            )
            candidate_b = single_known_candidate_ref(
                errors,
                pairwise,
                "Candidate B",
                line_value(pairwise_text, "Candidate B"),
                candidate_ids,
            )
            if candidate_a and candidate_b:
                if candidate_a == candidate_b:
                    errors.append(f"{rel(pairwise)} must compare two different candidates")
                pairwise_participants.update([candidate_a, candidate_b])
                pairwise_edges.append((candidate_a, candidate_b))
                non_survivors = {candidate_a, candidate_b} - pairwise_candidate_set
                if non_survivors:
                    errors.append(
                        f"{rel(pairwise)} compares candidate(s) that did not survive hard filtering: "
                        + ", ".join(sorted(non_survivors))
                    )
                visual_evidence_body = section_body(pairwise_text, "## Visual Evidence")
                if not visual_evidence_body:
                    errors.append(f"{rel(pairwise)} must include visual evidence for the compared candidates")
                else:
                    missing_evidence_refs = [
                        candidate_id
                        for candidate_id in (candidate_a, candidate_b)
                        if not has_bound_visual_evidence(visual_evidence_body, run_dir, candidate_id)
                    ]
                    if missing_evidence_refs:
                        errors.append(
                            f"{rel(pairwise)} visual evidence must include candidate-bound evidence for compared candidate id(s): "
                            + ", ".join(missing_evidence_refs)
                        )
                    if not has_visual_evidence(visual_evidence_body, run_dir):
                        errors.append(
                            f"{rel(pairwise)} visual evidence must reference rendered HTML, screenshot, "
                            "external prototype URL, or another existing visual evidence file"
                        )
                    errors.extend(scan_visual_output_files(sorted(evidence_path_refs(visual_evidence_body, run_dir))))
            winner_body = section_body(pairwise_text, "## Winner")
            winner_refs = known_candidate_refs(winner_body, candidate_ids)
            winner_unknown_refs = unknown_candidate_refs(winner_body, candidate_ids)
            if winner_unknown_refs:
                errors.append(f"{rel(pairwise)} winner references unknown candidate id(s): {', '.join(sorted(winner_unknown_refs))}")
            normalized_winner = normalized_source_context(winner_body).lower()
            if normalized_winner in {"a", "candidate a"} and candidate_a:
                winner_refs = {candidate_a}
            elif normalized_winner in {"b", "candidate b"} and candidate_b:
                winner_refs = {candidate_b}
            elif "no winner" in normalized_winner:
                winner_refs = set()
            elif winner_refs and not winner_refs <= {candidate_a, candidate_b}:
                errors.append(f"{rel(pairwise)} winner must be Candidate A, Candidate B, no winner, or one compared candidate id")

        missing_pairwise_candidates = pairwise_candidate_set - pairwise_participants
        if missing_pairwise_candidates:
            errors.append(
                f"{rel_run} pairwise reviews must include every surviving candidate; missing "
                + ", ".join(sorted(missing_pairwise_candidates))
            )
        if pairwise_candidate_set and connected_components(pairwise_candidate_set, pairwise_edges) > 1:
            errors.append(f"{rel_run} pairwise reviews must form one connected comparison graph across surviving candidates")

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
        text_proofs = [
            str((run_dir / proof_name).relative_to(ROOT))
            for proof_name in ("rendered-proof.html", "external-prototype.md")
            if (run_dir / proof_name).exists()
        ]
        errors.extend(scan_visual_output_files(text_proofs))

        winning_body = section_body(promotion_text or "", "## Winning Candidate")
        winning_refs = known_candidate_refs(winning_body, candidate_ids)
        winning_unknown_refs = unknown_candidate_refs(winning_body, candidate_ids)
        if winning_unknown_refs:
            errors.append(
                f"{rel_run}/promotion-record.md section 'Winning Candidate' references unknown candidate id(s): "
                + ", ".join(sorted(winning_unknown_refs))
            )
        if candidate_ids and not winning_refs:
            errors.append(f"{rel_run}/promotion-record.md section 'Winning Candidate' must reference at least one known candidate id")
        invalid_winning_refs = winning_refs - surviving_candidates if surviving_candidates else set()
        if invalid_winning_refs:
            errors.append(
                f"{rel_run}/promotion-record.md winner must be a surviving hard-filter candidate; got "
                + ", ".join(sorted(invalid_winning_refs))
            )
        unreviewed_winning_refs = winning_refs - pairwise_participants if pairwise_participants else winning_refs
        if unreviewed_winning_refs:
            errors.append(
                f"{rel_run}/promotion-record.md winner must appear in pairwise reviews; missing "
                + ", ".join(sorted(unreviewed_winning_refs))
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
