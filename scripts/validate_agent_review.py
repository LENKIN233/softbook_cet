#!/usr/bin/env python3
"""Validate commit-bound machine review evidence in a pull request body."""

import argparse
import datetime as dt
import json
import os
import re
from pathlib import Path


UNCHECKED = re.compile(r"(?im)^\s*-\s*\[\s\]\s+")
PASSED = re.compile(r"(?i)\b(passed|pass|ok)\b|通过")
SHA = re.compile(r"^[a-f0-9]{40}$")
PRINCIPAL = re.compile(r"^(agent|model|service):[A-Za-z0-9][A-Za-z0-9_.@/-]{1,127}$")
IDENTITY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:._/@-]{2,255}$")
CAPABILITIES = {
    "exact_diff_review",
    "product_policy_review",
    "release_evidence_review",
    "runtime_review",
    "security_review",
    "ci_review",
    "content_handoff_review",
}
REQUIRED_SECTIONS = ("当前任务引用的 spec", "变更摘要", "验证", "Model review")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--body-file")
    parser.add_argument("--body-env", default="PR_BODY")
    parser.add_argument("--expected-head", default=os.environ.get("PR_HEAD_SHA"))
    parser.add_argument(
        "--minimum-runs",
        type=int,
        default=int(os.environ.get("PR_MINIMUM_REVIEW_RUNS", "1")),
    )
    return parser.parse_args()


def read_body(args) -> str:
    if args.body_file:
        return Path(args.body_file).read_text(encoding="utf-8")
    return os.environ.get(args.body_env, "")


def section(body: str, title: str) -> str:
    match = re.search(rf"(?ims)^##\s+{re.escape(title)}\s*$(.*?)(?=^##\s+|\Z)", body)
    return match.group(1).strip() if match else ""


def exact_keys(value, expected: set[str], label: str, errors: list[str]) -> bool:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object")
        return False
    actual = set(value)
    if actual != expected:
        errors.append(f"{label} keys must be exactly {sorted(expected)}")
        return False
    return True


def parse_review_evidence(review: str, errors: list[str]):
    match = re.search(r"(?s)```json\s*(\{.*\})\s*```", review)
    if not match:
        errors.append("Model review must contain one fenced JSON evidence object")
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as error:
        errors.append(f"Model review evidence is invalid JSON: {error.msg}")
        return None


def valid_timestamp(value) -> bool:
    if not isinstance(value, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})",
        value,
    ):
        return False
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is not None
    except ValueError:
        return False


def validate(body: str, *, expected_head: str, minimum_runs: int = 1) -> list[str]:
    errors = []
    if not SHA.fullmatch(expected_head or ""):
        return ["expected head must be a 40-character lowercase Git SHA"]
    if minimum_runs < 1:
        return ["minimum runs must be positive"]
    for title in REQUIRED_SECTIONS:
        if not section(body, title):
            errors.append(f"PR body must include a non-empty '## {title}' section")
    if "spec/" not in section(body, "当前任务引用的 spec"):
        errors.append("PR body must list task-relevant spec paths")
    validation = section(body, "验证")
    if UNCHECKED.search(validation):
        errors.append("Validation must not contain unchecked boxes")
    elif validation and not PASSED.search(validation):
        errors.append("Validation must record at least one passed task-relevant check")

    evidence = parse_review_evidence(section(body, "Model review"), errors)
    if evidence is None:
        return errors
    if not exact_keys(
        evidence,
        {"schema_version", "head_sha", "policy", "runs", "status", "summary"},
        "review evidence",
        errors,
    ):
        return errors
    if evidence["schema_version"] != "pr-model-review.v1":
        errors.append("review evidence schema_version must be pr-model-review.v1")
    if evidence["head_sha"] != expected_head:
        errors.append("review evidence head_sha must match the exact pull request head")
    if evidence["policy"] != "spec/machine-acceptance.json":
        errors.append("review evidence must bind spec/machine-acceptance.json")
    if evidence["status"] != "passed":
        errors.append("review evidence status must be passed")
    if not isinstance(evidence["summary"], str) or not evidence["summary"].strip():
        errors.append("review evidence summary must be non-empty")

    runs = evidence["runs"]
    if not isinstance(runs, list) or len(runs) < minimum_runs:
        errors.append(f"review evidence requires at least {minimum_runs} isolated runs")
        return errors
    run_ids = set()
    for index, run in enumerate(runs):
        label = f"review run {index}"
        if not exact_keys(
            run,
            {
                "principal", "model", "run_id", "reviewed_at", "capabilities",
                "decision", "blocking_findings",
            },
            label,
            errors,
        ):
            continue
        if not PRINCIPAL.fullmatch(str(run["principal"])):
            errors.append(f"{label} principal must identify an agent, model, or service")
        if not IDENTITY.fullmatch(str(run["model"])):
            errors.append(f"{label} model identity is invalid")
        if not IDENTITY.fullmatch(str(run["run_id"])):
            errors.append(f"{label} run_id is invalid")
        elif run["run_id"] in run_ids:
            errors.append("review run_id values must be distinct")
        else:
            run_ids.add(run["run_id"])
        if not valid_timestamp(run["reviewed_at"]):
            errors.append(f"{label} reviewed_at must be a timezone-qualified timestamp")
        capabilities = run["capabilities"]
        if (
            not isinstance(capabilities, list)
            or not capabilities
            or len(capabilities) != len(set(capabilities))
            or any(capability not in CAPABILITIES for capability in capabilities)
            or "exact_diff_review" not in capabilities
        ):
            errors.append(f"{label} capabilities are invalid or omit exact_diff_review")
        if run["decision"] != "passed":
            errors.append(f"{label} decision must be passed")
        if run["blocking_findings"] != []:
            errors.append(f"{label} blocking_findings must be an empty array")
    return errors


def main():
    args = parse_args()
    errors = validate(
        read_body(args),
        expected_head=args.expected_head,
        minimum_runs=args.minimum_runs,
    )
    if errors:
        print("MODEL REVIEW GATE FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("MODEL REVIEW GATE OK")


if __name__ == "__main__":
    main()
