#!/usr/bin/env python3
"""Check that a UI PR declares its validation scope, never judge UX from prose.

The retained command name is used by CI. Product quality is assessed from the
running task under machine-acceptance; a design URL or CSS spelling is not proof.
Metadata scans and content authorization remain independent checks.
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
USER_FACING_EXTENSIONS = {
    ".tsx", ".jsx", ".css", ".scss", ".sass", ".less", ".html",
    ".png", ".jpg", ".jpeg", ".webp", ".svg",
}
USER_FACING_PREFIXES = ("apps/mobile/", "apps/web/")
NON_USER_FACING_TEST_PATH_MARKERS = (
    "/__mocks__/", "/__tests__/", "/acceptance/", "/e2e/",
)
NON_USER_FACING_TEST_SUFFIXES = (".spec.jsx", ".spec.tsx", ".test.jsx", ".test.tsx")
VISUAL_OUTPUT_FILES = {"docs/design/visual-reference.html"}
VISUAL_OUTPUT_PREFIXES = (
    "docs/design/directions/", "docs/design/interaction-motion/",
    "docs/design/physical-space/", "docs/design/mocks/",
    "docs/design/search-runs/", "docs/design/storyboards/",
)
CARD_CONTENT_HANDOFF_FILES = {"apps/mobile/src/learning/localCardRecords.ts"}
CARD_CONTENT_HANDOFF_MARKERS = (
    "card make", "/Users/lenkin/programing/card make",
    "external_workspace:/Users/lenkin/programing/card make", "../card make",
)
CARD_CONTENT_VALIDATION_MARKERS = (
    "dry-run", "dry_run_import_result", "catalog_audit_result",
    "runtime_smoke_result", "release_content_gap_delta", "import-card-source.mjs",
    "audit-card-sources.mjs", "smoke-softbook-api.mjs", "report_release_content_gap.mjs",
)
MISSING_VALUES = {"", "n/a", "na", "none", "null", "不适用", "无"}
PLACEHOLDER_VALUES = MISSING_VALUES | {
    "passed", "pass", "ok", "done", "checked", "completed", "todo", "tbd",
    "通过", "完成", "已检查", "待补充",
}
VALIDATION_LABEL = re.compile(
    r"验证|测试|体验|\b(?:validation|verification|testing|tests?|experience)\b",
    re.IGNORECASE,
)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", help="base git ref or SHA for changed-file detection")
    parser.add_argument("--head", help="head git ref or SHA for changed-file detection")
    parser.add_argument("--body-file", help="file containing the pull request body")
    parser.add_argument("--body-env", default="PR_BODY")
    parser.add_argument("--changed-file", action="append", default=[])
    return parser.parse_args()


def run_git_changed_files(base: str, head: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", base, head], cwd=ROOT,
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        raise SystemExit("unable to calculate changed files for experience record")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def read_body(args) -> str:
    if args.body_file:
        return Path(args.body_file).read_text(encoding="utf-8")
    return os.environ.get(args.body_env, "")


def is_test_or_fixture_path(path: str) -> bool:
    lower_path = path.lower()
    return (
        any(marker in lower_path for marker in NON_USER_FACING_TEST_PATH_MARKERS)
        or lower_path.endswith(NON_USER_FACING_TEST_SUFFIXES)
    )


def is_user_facing_ui_file(path: str) -> bool:
    if not path.startswith(USER_FACING_PREFIXES) or is_test_or_fixture_path(path):
        return False
    return (
        Path(path).suffix.lower() in USER_FACING_EXTENSIONS
        or ("/src/visual/" in path and path.endswith(".ts"))
    )


def is_visual_output_file(path: str) -> bool:
    if path in VISUAL_OUTPUT_FILES:
        return True
    if path.endswith("/README.md") or path.startswith("docs/design/search-runs/templates/"):
        return False
    return path.startswith(VISUAL_OUTPUT_PREFIXES)


def is_card_content_handoff_file(path: str) -> bool:
    return path in CARD_CONTENT_HANDOFF_FILES


def line_value(body: str, label: str) -> str | None:
    pattern = rf"(?im)^\s*-?\s*{re.escape(label)}\s*:\s*(.+?)\s*$"
    match = re.search(pattern, body)
    return match.group(1).strip() if match else None


def is_missing(value: str | None) -> bool:
    return value is None or value.strip().lower() in MISSING_VALUES


def validation_declarations(body: str) -> list[str]:
    """Read ordinary Markdown validation sections or labelled lines.

    Wording and platform coverage remain model review decisions. Nested headings
    and fenced commands are allowed; headings inside a code example are not PR
    sections, and hidden template comments are not a declaration.
    """
    body = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
    declarations = []
    section_level = None
    fence = None
    lines = body.splitlines()
    skip_line = None
    for index, line in enumerate(lines):
        if index == skip_line:
            continue
        fence_match = re.match(r"^\s*(`{3,}|~{3,})", line)
        if fence_match:
            marker = fence_match.group(1)
            if fence is None:
                fence = marker
            elif marker[0] == fence[0] and len(marker) >= len(fence):
                fence = None
            continue
        heading = None if fence else re.match(r"^\s*(#{1,6})\s+(.+?)\s*#*\s*$", line)
        setext = (
            not fence
            and not heading
            and line.strip()
            and index + 1 < len(lines)
            and re.fullmatch(r" {0,3}(=+|-+)\s*", lines[index + 1])
        )
        if setext:
            level = 1 if setext.group(1).startswith("=") else 2
            heading_text = line.strip()
            skip_line = index + 1
        if heading:
            level = len(heading.group(1))
            heading_text = heading.group(2)
        if heading or setext:
            if section_level is not None and level <= section_level:
                section_level = None
            if VALIDATION_LABEL.search(heading_text):
                section_level = level
            continue
        if section_level is not None:
            declarations.append(line)
        elif not fence:
            labelled = re.match(r"^\s*(?:[-*]\s*)?([^:：]+)[:：]\s*(.+)$", line)
            if labelled and VALIDATION_LABEL.search(labelled.group(1)):
                declarations.append(labelled.group(2))
    return declarations


def has_validation_declaration(body: str) -> bool:
    for line in validation_declarations(body):
        if re.fullmatch(r"\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})", line):
            continue
        value = re.sub(r"^\s*(?:[-*+]\s*|\d+[.)]\s*)?(?:\[[ xX]\]\s*)?", "", line)
        value = value.strip(" \t`*_.!。！:：;").lower()
        labelled_link = re.fullmatch(r"\[([^\]]*)\]\([^)]+\)", value)
        if labelled_link:
            value = labelled_link.group(1).strip(" \t`*_.!。！:：;")
        reference_only = re.fullmatch(r"(?:https?://\S+|docs/design/\S+)", value)
        if value not in PLACEHOLDER_VALUES and not reference_only:
            return True
    return False


def validate(body: str, changed_files: list[str]) -> list[str]:
    errors = []
    visible_change = any(
        is_user_facing_ui_file(path) or is_visual_output_file(path)
        for path in changed_files
    )
    if visible_change and not has_validation_declaration(body):
        errors.append(
            "UI or visual output changed: use the 验证 / Validation section to state "
            "the task checked, observed result and relevant unverified scope. "
            "An explicit limitation is valid; generic pass or a design URL alone is not. "
            "This checks a declaration, not UX acceptance."
        )

    if any(is_card_content_handoff_file(path) for path in changed_files):
        handoff = line_value(body, "Card content handoff")
        validation = line_value(body, "Card content validation")
        if is_missing(handoff) or not any(
            marker.lower() in (handoff or "").lower() for marker in CARD_CONTENT_HANDOFF_MARKERS
        ):
            errors.append("Card content handoff must name the sibling card make workspace.")
        if is_missing(validation) or not any(
            marker.lower() in (validation or "").lower() for marker in CARD_CONTENT_VALIDATION_MARKERS
        ):
            errors.append(
                "Card content validation must identify import, catalog audit, runtime smoke "
                "or release gap validation; this record does not grant content authorization."
            )
    return errors


def main():
    args = parse_args()
    changed_files = list(args.changed_file)
    if args.base and args.head:
        changed_files.extend(run_git_changed_files(args.base, args.head))
    errors = validate(read_body(args), sorted(set(changed_files)))
    if errors:
        print("PR EXPERIENCE RECORD INCOMPLETE")
        for error in errors:
            print(f"- {error}")
        return 1
    print("PR EXPERIENCE RECORD OK — declaration only, not UX acceptance")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
