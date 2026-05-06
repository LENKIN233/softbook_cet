#!/usr/bin/env python3
"""Validate PR-body design evidence for user-facing UI and visual output changes."""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
USER_FACING_EXTENSIONS = {
    ".tsx",
    ".jsx",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".svg",
}
DESIGN_ARTIFACT_PREFIXES = (
    "docs/design/briefs/",
    "docs/design/decisions/",
    "docs/design/interaction-motion/",
    "docs/design/physical-space/",
    "docs/design/mocks/",
    "docs/design/storyboards/",
)
VISUAL_OUTPUT_FILES = {
    "docs/design/visual-reference.html",
}
VISUAL_OUTPUT_PREFIXES = (
    "docs/design/interaction-motion/",
    "docs/design/physical-space/",
    "docs/design/mocks/",
    "docs/design/storyboards/",
)
CONCRETE_DOC_ARTIFACT_RE = re.compile(
    r"(docs/design/(?:visual-reference\.html|canon\.md|"
    r"(?:briefs|decisions|interaction-motion|physical-space|mocks|storyboards)/"
    r"[^\s`),#]+\.(?:md|html|png|jpg|jpeg|webp|svg)))",
    re.IGNORECASE,
)
ACCEPTED_SOURCE_MARKERS = (
    "docs/design/visual-reference.html",
    "docs/design/canon.md",
    "docs/design/briefs/",
    "docs/design/decisions/",
    "docs/design/interaction-motion/",
    "docs/design/physical-space/",
    "docs/design/mocks/",
    "docs/design/storyboards/",
    "http://",
    "https://",
)
SURFACE_SPECIFIC_SOURCE_MARKERS = (
    "docs/design/decisions/",
    "docs/design/mocks/",
    "docs/design/storyboards/",
    "http://",
    "https://",
)
INTERACTION_MOTION_SOURCE_MARKERS = (
    "docs/design/interaction-motion/",
    "docs/design/storyboards/",
    "http://",
    "https://",
)
PHYSICAL_SPACE_SOURCE_MARKERS = (
    "docs/design/physical-space/",
    "docs/design/storyboards/",
    "http://",
    "https://",
)
SPACE_VISUAL_PROOF_SOURCE_MARKERS = (
    "docs/design/mocks/space-surface-visual-proof-v1",
    "docs/design/directions/space-surface-visual-directions-v1",
    "http://",
    "https://",
)
MISSING_VALUES = {"", "n/a", "na", "none", "null", "不适用", "无"}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", help="base git ref or SHA for changed-file detection")
    parser.add_argument("--head", help="head git ref or SHA for changed-file detection")
    parser.add_argument("--body-file", help="file containing the pull request body")
    parser.add_argument(
        "--body-env",
        default="PR_BODY",
        help="environment variable containing the pull request body",
    )
    parser.add_argument(
        "--changed-file",
        action="append",
        default=[],
        help="changed file path; may be repeated for local tests",
    )
    return parser.parse_args()


def run_git_changed_files(base: str, head: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", base, head],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        raise SystemExit("unable to calculate changed files for design gate")

    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def read_body(args) -> str:
    if args.body_file:
        return Path(args.body_file).read_text(encoding="utf-8")
    return os.environ.get(args.body_env, "")


def is_user_facing_ui_file(path: str) -> bool:
    if not path.startswith("apps/mobile/"):
        return False
    return Path(path).suffix.lower() in USER_FACING_EXTENSIONS


def is_visual_output_file(path: str) -> bool:
    if path in VISUAL_OUTPUT_FILES:
        return True
    if path.endswith("/README.md"):
        return False
    return path.startswith(VISUAL_OUTPUT_PREFIXES)


def line_value(body: str, label: str) -> str | None:
    # Accept the repository template form: "- Design artifact: ...".
    pattern = rf"(?im)^\s*-?\s*{re.escape(label)}\s*:\s*(.+?)\s*$"
    match = re.search(pattern, body)
    if not match:
        return None
    return match.group(1).strip()


def is_missing(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() in MISSING_VALUES


def referenced_same_pr_design_artifact(value: str, changed_files: list[str]) -> list[str]:
    referenced_paths = set(extract_doc_artifact_paths(value))
    referenced = []
    for path in changed_files:
        if not path.startswith(DESIGN_ARTIFACT_PREFIXES):
            continue
        if path in referenced_paths:
            referenced.append(path)
    return referenced


def extract_doc_artifact_paths(value: str) -> list[str]:
    return [match.group(1) for match in CONCRETE_DOC_ARTIFACT_RE.finditer(value)]


def has_external_url(value: str) -> bool:
    return bool(re.search(r"https?://\S+", value))


def has_concrete_source(value: str, markers: tuple[str, ...]) -> bool:
    if has_external_url(value):
        return True
    return any(
        path.startswith(marker) or path == marker
        for path in extract_doc_artifact_paths(value)
        for marker in markers
    )


def has_directory_reference_without_file(value: str, markers: tuple[str, ...]) -> bool:
    concrete_paths = extract_doc_artifact_paths(value)
    for marker in markers:
        if marker in {"http://", "https://"}:
            continue
        if marker in value and not any(path.startswith(marker) or path == marker for path in concrete_paths):
            return True
    return False


def validate(body: str, changed_files: list[str]) -> list[str]:
    errors = []
    ui_files = [path for path in changed_files if is_user_facing_ui_file(path)]
    visual_output_files = [path for path in changed_files if is_visual_output_file(path)]
    if not ui_files and not visual_output_files:
        return errors

    design_artifact = line_value(body, "Design artifact")
    implementation_mapping = line_value(body, "Implementation mapping")
    unimplemented_gaps = line_value(body, "Unimplemented design gaps")
    interaction_motion_artifact = line_value(body, "Interaction/motion artifact")
    physical_space_artifact = line_value(body, "Physical space artifact")
    universal_checklist = line_value(body, "Universal Q1-Q4")
    conditional_checklist = line_value(body, "Conditional Q5-Q6")
    learning_or_space_files = [
        path
        for path in ui_files
        if path.startswith("apps/mobile/src/learning/")
        or path.startswith("apps/mobile/src/space/")
    ]
    learning_files = [path for path in ui_files if path.startswith("apps/mobile/src/learning/")]
    space_files = [path for path in ui_files if path.startswith("apps/mobile/src/space/")]

    if ui_files:
        if is_missing(design_artifact):
            errors.append(
                "user-facing UI files changed, but PR body does not name a non-N/A Design artifact"
            )
        elif "*" in design_artifact or "task_local_design_brief" in design_artifact:
            errors.append(
                "Design artifact must name a concrete accepted artifact or external URL, not a wildcard or task-local placeholder"
            )
        elif has_directory_reference_without_file(design_artifact, ACCEPTED_SOURCE_MARKERS):
            errors.append(
                "Design artifact must name a concrete accepted artifact file or external URL, not only a directory"
            )
        elif not has_concrete_source(design_artifact, ACCEPTED_SOURCE_MARKERS):
            errors.append(
                "Design artifact must name docs/design/visual-reference.html, docs/design/canon.md, "
                "a concrete docs/design artifact file, or a linked external design file"
            )
        else:
            same_pr_artifacts = referenced_same_pr_design_artifact(design_artifact, changed_files)
            if same_pr_artifacts:
                errors.append(
                    "same-PR design artifact cannot satisfy an implementation PR design gate: "
                    + ", ".join(same_pr_artifacts)
                )
            if learning_or_space_files and not has_concrete_source(design_artifact, SURFACE_SPECIFIC_SOURCE_MARKERS):
                errors.append(
                    "Learning/Space UI changes require a surface-specific accepted decision, mock, storyboard, "
                    "or linked external design file; global visual anchors alone are not enough"
                )

        if is_missing(implementation_mapping):
            errors.append(
                "user-facing UI files changed, but PR body does not name a non-N/A Implementation mapping"
            )
        elif "docs/design/mapping/" not in implementation_mapping and "apps/mobile/" not in implementation_mapping:
            errors.append(
                "Implementation mapping must name a docs/design/mapping artifact or the mapped apps/mobile code surface"
            )

        if is_missing(unimplemented_gaps):
            errors.append(
                "user-facing UI files changed, but PR body does not state non-N/A Unimplemented design gaps"
            )

    checklist_subject = "user-facing UI or visual output files"
    if is_missing(universal_checklist):
        errors.append(f"{checklist_subject} changed, but PR body does not answer Universal Q1-Q4")

    if is_missing(conditional_checklist):
        errors.append(f"{checklist_subject} changed, but PR body does not answer Conditional Q5-Q6")

    if learning_files:
        if is_missing(interaction_motion_artifact):
            errors.append(
                "Learning/core interaction UI changed, but PR body does not name a non-N/A Interaction/motion artifact"
            )
        elif has_directory_reference_without_file(interaction_motion_artifact, INTERACTION_MOTION_SOURCE_MARKERS):
            errors.append(
                "Interaction/motion artifact must name a concrete artifact file or external URL, not only a directory"
            )
        elif not has_concrete_source(interaction_motion_artifact, INTERACTION_MOTION_SOURCE_MARKERS):
            errors.append(
                "Interaction/motion artifact must name docs/design/interaction-motion, docs/design/storyboards, "
                "or a linked external design file"
            )
        else:
            same_pr_artifacts = referenced_same_pr_design_artifact(interaction_motion_artifact, changed_files)
            if same_pr_artifacts:
                errors.append(
                    "same-PR interaction/motion artifact cannot satisfy an implementation PR design gate: "
                    + ", ".join(same_pr_artifacts)
                )

    if space_files:
        if is_missing(physical_space_artifact):
            errors.append(
                "Space UI changed, but PR body does not name a non-N/A Physical space artifact"
            )
        elif has_directory_reference_without_file(physical_space_artifact, PHYSICAL_SPACE_SOURCE_MARKERS):
            errors.append(
                "Physical space artifact must name a concrete artifact file or external URL, not only a directory"
            )
        elif not has_concrete_source(physical_space_artifact, PHYSICAL_SPACE_SOURCE_MARKERS):
            errors.append(
                "Physical space artifact must name docs/design/physical-space, docs/design/storyboards, "
                "or a linked external design file"
            )
        else:
            same_pr_artifacts = referenced_same_pr_design_artifact(physical_space_artifact, changed_files)
            if same_pr_artifacts:
                errors.append(
                    "same-PR physical-space artifact cannot satisfy an implementation PR design gate: "
                    + ", ".join(same_pr_artifacts)
                )

        space_design_sources = "\n".join(
            value
            for value in [design_artifact, physical_space_artifact]
            if value is not None
        )
        if not has_concrete_source(
            space_design_sources,
            SPACE_VISUAL_PROOF_SOURCE_MARKERS,
        ):
            errors.append(
                "Space UI changed, but PR body does not name the Space visual proof "
                "docs/design/mocks/space-surface-visual-proof-v1.md/html, "
                "docs/design/directions/space-surface-visual-directions-v1.md, "
                "or a linked external design file"
            )

    return errors


def main():
    args = parse_args()
    changed_files = list(args.changed_file)
    if args.base and args.head:
        changed_files.extend(run_git_changed_files(args.base, args.head))
    changed_files = sorted(set(changed_files))
    body = read_body(args)

    errors = validate(body, changed_files)
    if errors:
        print("PR DESIGN GATE FAILED")
        print("Design-gated changed files:")
        for path in changed_files:
            if is_user_facing_ui_file(path) or is_visual_output_file(path):
                print(f"- {path}")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PR DESIGN GATE OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
