from __future__ import annotations

import json
import os
import platform
import re
import subprocess
from typing import Callable, Mapping, Sequence

from .execution import Redactor, command_outcome, git_output, version_output
from .model import (
    EXPECTED_NODE,
    EXPECTED_PYTHON,
    EXPECTED_RUBY,
    ROOT,
    CommandResult,
    GateOutcome,
    RunContext,
)


def collect_toolchain() -> dict:
    node_raw = version_output(["node", "--version"])
    ruby_raw = version_output(["ruby", "--version"])
    bundle_raw = version_output(["bundle", "--version"])
    lfs_raw = version_output(["git", "lfs", "version"])
    xcode_raw = version_output(["xcodebuild", "-version"])
    node = node_raw.removeprefix("v") if node_raw else None
    ruby_match = re.search(r"ruby\s+(\d+)\.(\d+)\.(\d+)", ruby_raw or "")
    ruby = ".".join(ruby_match.groups()) if ruby_match else None
    return {
        "python": platform.python_version(),
        "node": node,
        "ruby": ruby,
        "bundler": bundle_raw,
        "git_lfs": lfs_raw,
        "xcode": xcode_raw.splitlines() if xcode_raw else None,
        "expected": {
            "python": "3.12.x",
            "node": EXPECTED_NODE,
            "ruby": "3.3.x",
        },
    }


def evaluate_toolchain(context: RunContext) -> GateOutcome:
    toolchain = collect_toolchain()
    context.toolchain = toolchain
    findings: list[dict] = []
    exceptions: list[dict] = []

    python_parts = tuple(int(part) for part in toolchain["python"].split(".")[:2])
    if python_parts != EXPECTED_PYTHON:
        findings.append(
            {
                "type": "toolchain_mismatch",
                "message": f"Python 3.12.x required; found {toolchain['python']}",
            }
        )

    node = toolchain["node"]
    if node is None:
        findings.append({"type": "missing_toolchain", "message": "Node.js is unavailable"})
    elif node != EXPECTED_NODE:
        node_major_match = re.match(r"(\d+)", node)
        node_major = int(node_major_match.group(1)) if node_major_match else 0
        if context.options.profile == "dev" and node_major >= 22:
            exception = {
                "code": "dev_node_version_drift",
                "expected": EXPECTED_NODE,
                "actual": node,
                "scope": "dev_only",
            }
            exceptions.append(exception)
            context.safe_exceptions.append(exception)
        else:
            findings.append(
                {
                    "type": "toolchain_mismatch",
                    "message": f"Node.js {EXPECTED_NODE} required; found {node}",
                }
            )

    if context.options.profile in {"pr", "release"}:
        ruby = toolchain["ruby"]
        ruby_parts = (
            tuple(int(part) for part in ruby.split(".")[:2]) if ruby else None
        )
        if ruby_parts != EXPECTED_RUBY:
            findings.append(
                {
                    "type": "toolchain_mismatch" if ruby else "missing_toolchain",
                    "message": f"Ruby 3.3.x required; found {ruby or 'unavailable'}",
                }
            )

    if findings:
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=findings,
            details={"toolchain": toolchain},
        )
    if exceptions:
        return GateOutcome(
            status="passed_with_exception",
            exit_code=0,
            details={"toolchain": toolchain, "exceptions": exceptions},
        )
    return GateOutcome(
        status="passed",
        exit_code=0,
        details={"toolchain": toolchain},
    )


def capture_json_command(
    arguments: Sequence[str],
    *,
    timeout_seconds: float = 30,
    environment: Mapping[str, str] | None = None,
) -> dict | list:
    try:
        result = subprocess.run(
            arguments,
            cwd=ROOT,
            env={**os.environ, **(environment or {})},
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except OSError as error:
        raise RuntimeError(f"remote command unavailable: {error}") from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("remote command timed out") from error
    if result.returncode != 0:
        safe_error = Redactor(os.environ).text(result.stderr.strip())
        raise RuntimeError(safe_error or f"remote command exited {result.returncode}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError("remote command returned invalid JSON") from error


def resolve_pr_context(
    context: RunContext,
    *,
    capture: Callable[..., dict | list] = capture_json_command,
) -> GateOutcome:
    try:
        if context.options.pr is None:
            candidates = capture(
                [
                    "gh",
                    "pr",
                    "list",
                    "--head",
                    context.branch,
                    "--base",
                    "main",
                    "--state",
                    "open",
                    "--limit",
                    "20",
                    "--json",
                    "number",
                ]
            )
            if (
                not isinstance(candidates, list)
                or len(candidates) != 1
                or not isinstance(candidates[0], dict)
                or not isinstance(candidates[0].get("number"), int)
            ):
                count = len(candidates) if isinstance(candidates, list) else 0
                return GateOutcome(
                    status="failed",
                    exit_code=1,
                    findings=[
                        {
                            "type": "pr_context_ambiguous",
                            "message": f"expected exactly one open PR for {context.branch}; found {count}",
                        }
                    ],
                )
            pr_number = candidates[0]["number"]
        else:
            pr_number = context.options.pr

        pr = capture(
            [
                "gh",
                "pr",
                "view",
                str(pr_number),
                "--json",
                "number,url,state,isDraft,body,baseRefName,baseRefOid,headRefName,headRefOid",
            ]
        )
    except RuntimeError as error:
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[{"type": "remote_unavailable", "message": str(error)}],
        )

    if not isinstance(pr, dict):
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "remote_response_invalid",
                    "message": "pull-request lookup did not return an object",
                }
            ],
        )

    required_fields = {
        "number": int,
        "url": str,
        "state": str,
        "isDraft": bool,
        "baseRefName": str,
        "baseRefOid": str,
        "headRefName": str,
        "headRefOid": str,
    }
    invalid_fields = [
        field
        for field, expected_type in required_fields.items()
        if not isinstance(pr.get(field), expected_type)
    ]
    invalid_sha_fields = [
        field
        for field in ("baseRefOid", "headRefOid")
        if field not in invalid_fields
        and not re.fullmatch(r"[0-9a-fA-F]{40}", pr[field])
    ]
    if invalid_fields or invalid_sha_fields:
        invalid = sorted(set((*invalid_fields, *invalid_sha_fields)))
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "remote_response_invalid",
                    "message": f"pull-request lookup has invalid fields: {', '.join(invalid)}",
                }
            ],
        )

    findings = []
    if pr["number"] != pr_number:
        findings.append(
            {
                "type": "pr_context_invalid",
                "message": "pull-request lookup returned an unexpected number",
            }
        )
    if pr.get("state") != "OPEN":
        findings.append({"type": "pr_context_invalid", "message": "pull request is not open"})
    if pr.get("baseRefName") != "main":
        findings.append(
            {"type": "pr_context_invalid", "message": "pull request does not target main"}
        )
    if pr.get("headRefName") != context.branch:
        findings.append(
            {
                "type": "pr_context_invalid",
                "message": "pull request head does not match the current branch",
            }
        )
    if pr.get("headRefOid") != context.head:
        findings.append(
            {
                "type": "pr_context_stale",
                "message": "pull request head SHA does not match local HEAD",
            }
        )

    base_ref = context.options.base or pr.get("baseRefOid")
    try:
        resolved_base = git_output(
            ["rev-parse", "--verify", "--end-of-options", f"{base_ref}^{{commit}}"]
        )
    except RuntimeError:
        findings.append(
            {
                "type": "base_ref_unavailable",
                "message": f"base ref cannot be resolved locally: {base_ref}",
            }
        )
        resolved_base = None
    if resolved_base is not None and resolved_base != pr["baseRefOid"]:
        findings.append(
            {
                "type": "base_ref_stale",
                "message": "resolved base ref does not match the pull request base SHA",
            }
        )

    if findings:
        return GateOutcome(status="failed", exit_code=1, findings=findings)

    context.pr_body = pr.get("body") or ""
    context.pr_context = {
        "number": pr["number"],
        "url": pr["url"],
        "is_draft": bool(pr.get("isDraft")),
        "base_ref": pr["baseRefName"],
        "base_sha": resolved_base,
        "head_ref": pr["headRefName"],
        "head_sha": pr["headRefOid"],
    }
    return GateOutcome(
        status="passed",
        exit_code=0,
        details={"pull_request": context.pr_context},
    )


def evaluate_dependency_report(result: CommandResult, context: RunContext) -> GateOutcome:
    base = command_outcome(result)
    if base.status != "passed":
        return base
    try:
        report = json.loads(result.output)
    except json.JSONDecodeError:
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "invalid_dependency_report",
                    "message": "dependency validator did not emit valid JSON",
                }
            ],
        )

    exceptions = []
    for target in report.get("targets", []):
        for advisory in target.get("advisories", []):
            exception = {
                "code": "dependency_advisory_exception",
                "target": target.get("id"),
                "advisory": advisory.get("id"),
                "package": advisory.get("package"),
                "severity": advisory.get("severity"),
                "vulnerabilities": target.get("vulnerabilities"),
            }
            exceptions.append(exception)
            context.safe_exceptions.append(exception)

    details = {
        "schema_version": report.get("schema_version"),
        "targets": [
            {
                "id": target.get("id"),
                "ok": target.get("ok"),
                "vulnerabilities": target.get("vulnerabilities"),
                "advisory_count": len(target.get("advisories", [])),
            }
            for target in report.get("targets", [])
        ],
        "exceptions": exceptions,
    }
    if exceptions:
        return GateOutcome(
            status="passed_with_exception",
            exit_code=0,
            details=details,
        )
    return GateOutcome(status="passed", exit_code=0, details=details)


def evaluate_release_platform() -> GateOutcome:
    if platform.system() != "Darwin":
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "unsupported_platform",
                    "message": "release profile is supported only on macOS",
                }
            ],
        )
    return GateOutcome(status="passed", exit_code=0, details={"platform": "macOS"})
