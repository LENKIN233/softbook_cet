#!/usr/bin/env python3
"""Validate PR-body design evidence for user-facing UI and visual output changes."""

import argparse
import json
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
USER_FACING_FILES = {
    "apps/mobile/src/visual/tokens.ts",
    "apps/web/src/visual/tokens.ts",
}
USER_FACING_PREFIXES = (
    "apps/mobile/",
    "apps/web/",
)
CODE_MAPPING_PREFIXES = (
    "apps/mobile/",
    "apps/web/",
)
LEARNING_SURFACE_PREFIXES = (
    "apps/mobile/src/learning/",
    "apps/web/src/learning/",
)
SPACE_SURFACE_PREFIXES = (
    "apps/mobile/src/space/",
    "apps/web/src/space/",
)
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
    "docs/design/search-runs/",
    "docs/design/storyboards/",
)
TEXT_VISUAL_OUTPUT_EXTENSIONS = {
    ".html",
    ".md",
    ".svg",
}
LEGACY_SELF_ASSESS_TOKENS = (
    "--fb-know",
    "--fb-unsure",
    "--fb-prof",
    "--fb-forgot",
)
SIZED_SVG_CLASS_RE = re.compile(
    r'class\s*=\s*"[^"]*\b(sb|tab|ico|icon)\b',
    re.IGNORECASE,
)
NEGATIVE_BLOCK_RE = re.compile(
    r"<!--\s*NEGATIVE\s*-->.*?<!--\s*/NEGATIVE\s*-->",
    re.IGNORECASE | re.DOTALL,
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
    "docs/design/mocks/space-surface-visual-refinement-v1",
    "docs/design/directions/space-surface-visual-directions-v1",
    "http://",
    "https://",
)
MISSING_VALUES = {"", "n/a", "na", "none", "null", "不适用", "无"}
PLACEHOLDER_CHECKLIST_VALUES = {
    "answered",
    "checked",
    "complete",
    "completed",
    "done",
    "ok",
    "pass",
    "passed",
    "yes",
    "已回答",
    "已检查",
    "完成",
    "通过",
}
UNIVERSAL_CHECKLIST_EVIDENCE = (
    (
        "Q1 Law of One / current library",
        (
            "law of one",
            "law_of_one",
            "current library",
            "current_library",
            "当前 library",
            "当前学科",
            "当前库",
            "单强色",
        ),
    ),
    (
        "Q2 focal object / first-read path",
        ("focal", "focal_object", "first-read", "first_read", "first read", "焦点", "焦点物", "首读"),
    ),
    (
        "Q3 interaction silhouette",
        ("silhouette", "interaction_silhouette", "剪影"),
    ),
    (
        "Q4 forbidden design patterns",
        (
            "forbidden",
            "forbidden_design_patterns",
            "forbidden_patterns",
            "forbidden design",
            "禁用",
            "未命中",
            "no forbidden",
        ),
    ),
)
CONDITIONAL_CHECKLIST_EVIDENCE = (
    (
        "Q5 containment or non-applicable reason",
        (
            "q5",
            "phone",
            "viewport",
            "safe-area",
            "safe_area",
            "safe area",
            "containment",
            "overflow",
            "not applicable",
            "不适用",
            "手机",
            "视口",
            "安全区",
            "溢出",
            "收敛",
        ),
    ),
    (
        "Q6 surface-specific rule or non-applicable reason",
        (
            "q6",
            "flip",
            "stats",
            "learning",
            "self-assess",
            "self_assess",
            "tabular",
            "module",
            "not applicable",
            "不适用",
            "翻面",
            "自评",
            "统计",
            "学习",
            "模块",
        ),
    ),
)


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
    if path in USER_FACING_FILES:
        return True
    if not path.startswith(USER_FACING_PREFIXES):
        return False
    return Path(path).suffix.lower() in USER_FACING_EXTENSIONS


def is_visual_output_file(path: str) -> bool:
    if path in VISUAL_OUTPUT_FILES:
        return True
    if path.endswith("/README.md"):
        return False
    if path.startswith("docs/design/search-runs/templates/"):
        return False
    return path.startswith(VISUAL_OUTPUT_PREFIXES)


def strip_negative_blocks(text: str) -> str:
    return NEGATIVE_BLOCK_RE.sub("", text)


def load_visual_language() -> tuple[dict, list[str]]:
    path = ROOT / "spec" / "visual-language.json"
    try:
        return json.loads(path.read_text(encoding="utf-8")), []
    except (OSError, json.JSONDecodeError) as error:
        return {}, [f"unable to load spec/visual-language.json for visual-output scanning: {error}"]


def scan_visual_output_text(
    path: str,
    text: str,
    visual_language: dict,
) -> list[str]:
    errors = []
    positive_text = strip_negative_blocks(text)
    positive_lower = positive_text.lower()

    for token in LEGACY_SELF_ASSESS_TOKENS:
        if token in positive_text:
            errors.append(
                f"{path} references removed self-assess token {token}; "
                "visual artifacts must use confident/review only"
            )

    forbidden_rules = (
        visual_language.get("implementation_hypothesis", {})
        .get("forbidden_design_patterns", {})
        .get("tokens", [])
    )
    for rule in forbidden_rules:
        pattern = rule.get("pattern")
        if not pattern:
            continue
        effective_pattern = (
            r"font-family:[^;]*(?<!sans-)serif"
            if rule.get("id") == "FDP-06"
            else pattern
        )
        if re.search(effective_pattern, positive_text, flags=re.IGNORECASE):
            errors.append(
                f"{path} hits forbidden design pattern {rule.get('id', 'unknown')} "
                f"({rule.get('reason', 'no reason recorded')}): /{pattern}/"
            )

    suffix = Path(path).suffix.lower()
    if suffix in {".html", ".svg"}:
        for tag in re.findall(r"<svg\b[^>]*>", positive_text, flags=re.IGNORECASE):
            if re.search(r"\bwidth\s*=", tag) and re.search(r"\bheight\s*=", tag):
                continue
            if SIZED_SVG_CLASS_RE.search(tag):
                continue
            errors.append(
                f"{path} has an inline <svg> without explicit width and height: {tag[:80]}..."
            )

    self_assess_labels_present = "有把握" in positive_text or "再回看" in positive_text
    if self_assess_labels_present:
        self_assess_hex = (
            visual_language.get("implementation_hypothesis", {})
            .get("palette", {})
            .get("self_assess_hex_defaults", {})
        )
        confident_hex = str(self_assess_hex.get("confident", "#22C58B")).lower()
        review_hex = str(self_assess_hex.get("review", "#F5B100")).lower()
        confident_evidence = any(
            snippet in positive_lower
            for snippet in [confident_hex, "--confident", "mint", "有把握 = mint"]
        )
        review_evidence = any(
            snippet in positive_lower
            for snippet in [review_hex, "--review", "amber", "再回看 = amber"]
        )
        if not confident_evidence or not review_evidence:
            errors.append(
                f"{path} renders flip self-assess labels without proving "
                "有把握=confident/mint and 再回看=review/amber"
            )

    constrained_phone_frame = suffix == ".html" and path.startswith(
        ("docs/design/mocks/", "docs/design/storyboards/")
    ) and any(snippet in positive_lower for snippet in ["phone", "393", "viewport"])
    if constrained_phone_frame:
        if "overflow-x: hidden" not in positive_lower:
            errors.append(
                f"{path} is a constrained phone/viewport visual output but lacks "
                "overflow-x containment evidence"
            )
        if "@media" not in positive_lower:
            errors.append(
                f"{path} is a constrained phone/viewport visual output but lacks "
                "a narrow-viewport media query"
            )

    return errors


def scan_visual_output_files(paths: list[str]) -> list[str]:
    text_paths = [
        path
        for path in paths
        if Path(path).suffix.lower() in TEXT_VISUAL_OUTPUT_EXTENSIONS
        and (ROOT / path).exists()
    ]
    if not text_paths:
        return []

    visual_language, errors = load_visual_language()
    if errors:
        return errors

    for path in text_paths:
        errors.extend(
            scan_visual_output_text(
                path,
                (ROOT / path).read_text(encoding="utf-8"),
                visual_language,
            )
        )

    return errors


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


def normalized_line_value(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def is_placeholder_checklist_value(value: str) -> bool:
    normalized = normalized_line_value(value)
    collapsed = re.sub(r"[\s,.;:，。；：!！]+", "", normalized)
    return normalized in PLACEHOLDER_CHECKLIST_VALUES or collapsed in PLACEHOLDER_CHECKLIST_VALUES


def validate_checklist_evidence(
    label: str,
    value: str | None,
    evidence_groups: tuple[tuple[str, tuple[str, ...]], ...],
) -> list[str]:
    if is_missing(value):
        return [f"user-facing UI or visual output files changed, but PR body does not answer {label}"]

    if is_placeholder_checklist_value(value):
        return [
            f"{label} must include concrete checklist evidence, not only a placeholder like {value!r}"
        ]

    normalized = normalized_line_value(value or "")
    errors = []
    for evidence_label, snippets in evidence_groups:
        if not any(snippet in normalized for snippet in snippets):
            errors.append(f"{label} must mention concrete evidence for {evidence_label}")
    return errors


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
        if path.startswith(LEARNING_SURFACE_PREFIXES)
        or path.startswith(SPACE_SURFACE_PREFIXES)
    ]
    learning_files = [path for path in ui_files if path.startswith(LEARNING_SURFACE_PREFIXES)]
    space_files = [path for path in ui_files if path.startswith(SPACE_SURFACE_PREFIXES)]

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
        elif "docs/design/mapping/" not in implementation_mapping and not any(
            prefix in implementation_mapping for prefix in CODE_MAPPING_PREFIXES
        ):
            errors.append(
                "Implementation mapping must name a docs/design/mapping artifact or the mapped apps/mobile or apps/web code surface"
            )

        if is_missing(unimplemented_gaps):
            errors.append(
                "user-facing UI files changed, but PR body does not state non-N/A Unimplemented design gaps"
            )

    errors.extend(
        validate_checklist_evidence(
            "Universal Q1-Q4",
            universal_checklist,
            UNIVERSAL_CHECKLIST_EVIDENCE,
        )
    )
    errors.extend(
        validate_checklist_evidence(
            "Conditional Q5-Q6",
            conditional_checklist,
            CONDITIONAL_CHECKLIST_EVIDENCE,
        )
    )

    errors.extend(scan_visual_output_files(visual_output_files))

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
                "docs/design/mocks/space-surface-visual-refinement-v1.md/html, "
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
