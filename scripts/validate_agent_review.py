#!/usr/bin/env python3
"""Validate that a PR body contains a merge-ready agent review record."""

import argparse
import os
import re
import sys
from pathlib import Path


MISSING_VALUES = {"", "n/a", "na", "none", "null", "不适用", "无"}
BLOCKING_MISSING_VALUES = {"", "n/a", "na", "null", "不适用"}


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


def is_missing(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() in MISSING_VALUES


def is_blocking_missing(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() in BLOCKING_MISSING_VALUES


def validate(body: str) -> list[str]:
    errors = []

    if not re.search(r"(?im)^##\s+Agent review\s*$", body):
        errors.append("PR body must include an '## Agent review' section")

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
