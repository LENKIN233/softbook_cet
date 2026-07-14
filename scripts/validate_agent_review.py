#!/usr/bin/env python3
"""Validate that a PR body contains a merge-ready agent review record."""

import argparse
import os
import re
import sys
from pathlib import Path


MISSING_VALUES = {"", "n/a", "na", "none", "null", "不适用", "无"}
BLOCKING_MISSING_VALUES = {"", "n/a", "na", "null", "不适用"}
UNCHECKED_CHECKBOX_RE = re.compile(r"(?im)^\s*-\s*\[\s\]\s+")
CHECKED_OR_PASSED_RECORD_RE = re.compile(
    r"(?im)(\[[xX]\]|`[^`]+`\s*(?:passed|pass|ok|通过)|(?:passed|pass|ok|通过)\s*`[^`]+`)"
)
FULL_HARNESS_COMMAND_RE = re.compile(
    r"`python3\s+scripts/validate_harness\.py"
    r"(?![^`]*(?:"
    r"--skip-remote-guard|"
    r"--mode(?:=|\s+)local\b|"
    r"--layer(?:=|\s+)|"
    r"--section(?:=|\s+)|"
    r"--list\b|"
    r"--help\b|"
    r"-h(?:\s|`)"
    r"))"
    r"[^`]*`"
)
CHECKED_BOX_RE = re.compile(r"\[[xX]\]")
PASS_BEFORE_COMMAND_RE = re.compile(
    r"(?i)(?:(?:passed|pass|ok)\b|通过)\s*(?:[-:]\s*)?$"
)
PASS_AFTER_COMMAND_RE = re.compile(
    r"(?i)^\s*(?:[-:]\s*)?(?:(?:passed|pass|ok)\b|通过)"
)
REQUIRED_SECTIONS = (
    "当前任务引用的 spec",
    "变更摘要",
    "验证",
    "Agent review",
    "Agent run record",
    "设计稿来源（用户可见 UI 如适用）",
    "design_review_checklist（如适用）",
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--body-file", help="file containing the pull request body")
    parser.add_argument(
        "--body-env",
        default="PR_BODY",
        help="environment variable containing the pull request body",
    )
    return parser.parse_args()


def read_body(args) -> str:
    if args.body_file:
        return Path(args.body_file).read_text(encoding="utf-8")
    return os.environ.get(args.body_env, "")


def line_value(body: str, label: str) -> str | None:
    pattern = rf"(?im)^\s*-?\s*{re.escape(label)}\s*:\s*(.+?)\s*$"
    match = re.search(pattern, body)
    if not match:
        return None
    return match.group(1).strip()


def has_section(body: str, title: str) -> bool:
    return bool(re.search(rf"(?im)^##\s+{re.escape(title)}\s*$", body))


def section_body(body: str, title: str) -> str:
    pattern = rf"(?ims)^##\s+{re.escape(title)}\s*$(.*?)(?=^##\s+|\Z)"
    match = re.search(pattern, body)
    if not match:
        return ""
    return match.group(1).strip()


def has_meaningful_content(value: str) -> bool:
    stripped_lines = [
        line.strip()
        for line in value.splitlines()
        if line.strip() and line.strip() not in {"- ...", "..."}
    ]
    if not stripped_lines:
        return False
    return any(line.lower() not in MISSING_VALUES for line in stripped_lines)


def is_missing(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() in MISSING_VALUES


def is_blocking_missing(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() in BLOCKING_MISSING_VALUES


def has_completed_full_harness_record(validation_section: str) -> bool:
    for line in validation_section.splitlines():
        command = FULL_HARNESS_COMMAND_RE.search(line)
        if not command:
            continue

        before = line[: command.start()]
        after = line[command.end() :]
        if (
            CHECKED_BOX_RE.search(before)
            or PASS_BEFORE_COMMAND_RE.search(before)
            or PASS_AFTER_COMMAND_RE.search(after)
        ):
            return True
    return False


def validate(body: str) -> list[str]:
    errors = []

    for section in REQUIRED_SECTIONS:
        if not has_section(body, section):
            errors.append(f"PR body must include a '## {section}' section")

    spec_section = section_body(body, "当前任务引用的 spec")
    if not has_meaningful_content(spec_section) or "spec/" not in spec_section:
        errors.append("PR body must list the task-relevant spec paths")

    summary_section = section_body(body, "变更摘要")
    if not has_meaningful_content(summary_section):
        errors.append("PR body must include a non-empty change summary")

    validation_section = section_body(body, "验证")
    if not has_meaningful_content(validation_section):
        errors.append("PR body must include validation records")
    elif UNCHECKED_CHECKBOX_RE.search(validation_section):
        errors.append(
            "PR body validation section must not contain unchecked validation boxes before merge"
        )
    elif not CHECKED_OR_PASSED_RECORD_RE.search(validation_section):
        errors.append(
            "PR body validation section must include checked or explicitly passed command records"
        )
    elif not has_completed_full_harness_record(validation_section):
        errors.append(
            "PR body validation section must record full `python3 scripts/validate_harness.py`; local, selected, listed, or CI --skip-remote-guard runs are partial"
        )

    reviewer = line_value(body, "Reviewer")
    review_status = line_value(body, "Review status")
    blocking_findings = line_value(body, "Blocking findings")
    review_summary = line_value(body, "Review summary")

    if is_missing(reviewer):
        errors.append("Agent review must name a non-N/A Reviewer")

    if is_missing(review_status):
        errors.append("Agent review must state a non-N/A Review status")
    elif review_status.strip().lower() not in {"passed", "pass", "通过"}:
        errors.append(
            "Agent review status must be Passed/通过 before merge; blocking or pending reviews must not pass the gate"
        )

    if is_blocking_missing(blocking_findings):
        errors.append("Agent review must state Blocking findings")
    elif blocking_findings.strip().lower() not in {
        "none",
        "no blocking findings",
        "无",
        "无阻塞问题",
    }:
        errors.append("Agent review must state no blocking findings before merge")

    if is_missing(review_summary):
        errors.append("Agent review must include a non-N/A Review summary")

    run_record = line_value(body, "Run record")
    if is_missing(run_record):
        errors.append("Agent run record must state Run record")
    elif "docs/agent-runs/" not in run_record or ".md" not in run_record:
        errors.append("PR body must reference a committed agent run record under docs/agent-runs/")

    return errors


def main():
    errors = validate(read_body(parse_args()))

    if errors:
        print("AGENT REVIEW GATE FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("AGENT REVIEW GATE OK")


if __name__ == "__main__":
    main()
