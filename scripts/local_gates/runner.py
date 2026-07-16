from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

from .catalog import build_catalog, resolved_base, selected_gates
from .checks import (
    collect_toolchain,
    evaluate_dependency_report,
    evaluate_release_platform,
    evaluate_toolchain,
    resolve_pr_context,
)
from .execution import (
    Redactor,
    command_environment,
    command_outcome,
    evaluate_network_isolation,
    execute_command,
    git_output,
    isolate_command,
    network_isolation_prefix,
    relative_path,
    safe_environment_record,
    tracked_snapshot,
    write_log,
)
from .model import (
    EXPORT_ROOT,
    PROFILES,
    ROOT,
    SCHEMA_VERSION,
    STATUS_VALUES,
    CommandResult,
    CommandSpec,
    GateOutcome,
    GateSpec,
    Options,
    RunContext,
)


REPORT_REQUIRED_FIELDS = {
    "schema_version",
    "profile",
    "status",
    "exit_code",
    "complete",
    "head",
    "base",
    "pull_request",
    "toolchain",
    "network_isolation",
    "workspace",
    "safe_exceptions",
    "remote_checks",
    "summary",
    "gates",
    "formal_state_updates",
}


def parse_args(argv: Sequence[str] | None = None) -> Options:
    parser = argparse.ArgumentParser(
        prog="scripts/run_local_gates",
        description="Run local mirrors of repository quality gates.",
        allow_abbrev=False,
    )
    parser.add_argument("--profile", choices=PROFILES, required=True)
    parser.add_argument("--base", help="base ref used for pull-request comparisons")
    parser.add_argument("--pr", type=positive_integer, help="pull request number")
    parser.add_argument("--output", help="report JSON path under exports/local-gates/")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--fail-fast", action="store_true")
    args = parser.parse_args(argv)
    return Options(
        profile=args.profile,
        base=args.base,
        pr=args.pr,
        output=args.output,
        verbose=args.verbose,
        fail_fast=args.fail_fast,
    )


def positive_integer(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive integer") from error
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def validate_base_ref(value: str | None) -> None:
    if value is None:
        return
    if value.startswith("-") or any(character.isspace() or ord(character) < 32 for character in value):
        raise ValueError("--base must be a non-option Git ref without whitespace")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def resolve_output_path(options: Options, head: str) -> tuple[Path, Path]:
    export_root = EXPORT_ROOT.resolve()
    if options.output:
        candidate = Path(options.output).expanduser()
        if not candidate.is_absolute():
            candidate = ROOT / candidate
        report_path = candidate.resolve()
        if report_path.suffix.lower() != ".json":
            raise ValueError("--output must name a .json report")
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        run_id = f"{stamp}-{head[:8]}-{options.profile}-{os.getpid()}"
        report_path = (export_root / run_id / "report.json").resolve()

    try:
        report_path.relative_to(export_root)
    except ValueError as error:
        raise ValueError("--output must remain under exports/local-gates/") from error

    run_root = (
        report_path.parent
        if report_path.name == "report.json"
        else report_path.parent / report_path.stem
    )
    return report_path, run_root


def validate_report_contract(report: dict) -> list[str]:
    errors = []
    missing = sorted(REPORT_REQUIRED_FIELDS - report.keys())
    if missing:
        errors.append(f"missing report fields: {', '.join(missing)}")
    if report.get("schema_version") != SCHEMA_VERSION:
        errors.append("invalid report schema_version")
    if report.get("profile") not in PROFILES:
        errors.append("invalid report profile")
    if report.get("status") not in STATUS_VALUES:
        errors.append("invalid report status")
    if report.get("exit_code") not in (0, 1):
        errors.append("report exit_code must be zero or one")
    if not isinstance(report.get("complete"), bool):
        errors.append("report complete must be boolean")
    gates = report.get("gates")
    if not isinstance(gates, list):
        errors.append("report gates must be a list")
    else:
        for index, gate in enumerate(gates):
            if not isinstance(gate, dict):
                errors.append(f"gate {index} must be an object")
                continue
            if gate.get("status") not in STATUS_VALUES:
                errors.append(f"gate {index} has invalid status")
            for field in (
                "id",
                "status",
                "duration_ms",
                "timeout_seconds",
                "log_path",
                "findings",
                "details",
            ):
                if field not in gate:
                    errors.append(f"gate {index} missing {field}")
    if report.get("formal_state_updates") != {
        "pull_request_review": False,
        "content_approval": False,
        "launch_readiness": False,
    }:
        errors.append("local gate report must keep all formal state updates false")
    return errors


def execute_gate(
    context: RunContext,
    gate: GateSpec,
    log_path: Path,
) -> tuple[GateOutcome, int]:
    started = time.monotonic()
    if gate.requires_pr_context and context.pr_context is None:
        outcome = GateOutcome(
            status="deferred",
            exit_code=None,
            findings=[
                {
                    "type": "missing_pr_context",
                    "message": "gate requires a unique, current pull-request context",
                }
            ],
        )
        write_log(log_path, outcome.findings[0]["message"] + "\n")
        return outcome, int((time.monotonic() - started) * 1000)

    if gate.special == "toolchain":
        outcome = evaluate_toolchain(context)
        write_log(log_path, json.dumps(outcome.details, indent=2, ensure_ascii=True) + "\n")
        return outcome, int((time.monotonic() - started) * 1000)
    if gate.special == "network_isolation":
        outcome = evaluate_network_isolation(context)
        write_log(
            log_path,
            json.dumps(outcome.details or outcome.findings, indent=2, ensure_ascii=True)
            + "\n",
        )
        return outcome, int((time.monotonic() - started) * 1000)
    if gate.special == "pr_context":
        outcome = resolve_pr_context(context)
        safe = {
            "status": outcome.status,
            "findings": outcome.findings,
            "pull_request": outcome.details.get("pull_request"),
        }
        write_log(log_path, json.dumps(safe, indent=2, ensure_ascii=True) + "\n")
        return outcome, int((time.monotonic() - started) * 1000)
    if gate.special == "release_platform":
        outcome = evaluate_release_platform()
        write_log(log_path, json.dumps(outcome.details or outcome.findings, indent=2) + "\n")
        return outcome, int((time.monotonic() - started) * 1000)

    if gate.command_factory is None:
        raise RuntimeError(f"gate {gate.id} has no command or special handler")
    command = gate.command_factory(context)
    if not gate.network:
        if context.network_isolation is None:
            outcome = GateOutcome(
                status="deferred",
                exit_code=None,
                findings=[
                    {
                        "type": "network_isolation_unavailable",
                        "message": "network=false gate deferred because OS isolation is unavailable",
                    }
                ],
            )
            write_log(log_path, outcome.findings[0]["message"] + "\n")
            return outcome, int((time.monotonic() - started) * 1000)
        command = isolate_command(context, command)
    result = execute_command(
        command,
        timeout_seconds=gate.timeout_seconds,
        log_path=log_path,
        verbose=context.options.verbose,
        ambient_environment=command_environment(network_allowed=gate.network),
    )
    if gate.special == "dependency_report":
        outcome = evaluate_dependency_report(result, context)
    else:
        outcome = command_outcome(result)
    return outcome, result.duration_ms


def gate_record(
    gate: GateSpec,
    outcome: GateOutcome,
    *,
    duration_ms: int,
    log_path: Path,
) -> dict:
    if outcome.status not in STATUS_VALUES:
        raise ValueError(f"invalid gate status: {outcome.status}")
    return {
        "id": gate.id,
        "stage": gate.stage,
        "status": outcome.status,
        "required": True,
        "network": gate.network,
        "duration_ms": duration_ms,
        "timeout_seconds": gate.timeout_seconds,
        "exit_code": outcome.exit_code,
        "log_path": relative_path(log_path),
        "findings": outcome.findings,
        "details": outcome.details,
    }


def execute_gate_record(context: RunContext, gate: GateSpec) -> dict:
    log_path = context.logs_dir / f"{gate.id}.log"
    if context.options.verbose:
        print(f"[{gate.id}] starting", flush=True)
    started = time.monotonic()
    try:
        outcome, duration_ms = execute_gate(context, gate, log_path)
    except Exception as error:  # isolate every gate to preserve diagnostics
        safe_traceback = Redactor(os.environ).text(traceback.format_exc())
        write_log(log_path, safe_traceback, environment=os.environ)
        outcome = GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "gate_exception",
                    "message": Redactor(os.environ).text(str(error)),
                }
            ],
        )
        duration_ms = int((time.monotonic() - started) * 1000)
    if context.options.verbose:
        print(f"[{gate.id}] {outcome.status} ({duration_ms} ms)", flush=True)
    return gate_record(gate, outcome, duration_ms=duration_ms, log_path=log_path)


def skipped_gate_record(context: RunContext, gate: GateSpec) -> dict:
    log_path = context.logs_dir / f"{gate.id}.log"
    outcome = GateOutcome(
        status="skipped",
        exit_code=None,
        findings=[
            {
                "type": "fail_fast",
                "message": "gate skipped after an earlier failure in diagnostic fail-fast mode",
            }
        ],
    )
    write_log(log_path, outcome.findings[0]["message"] + "\n")
    return gate_record(gate, outcome, duration_ms=0, log_path=log_path)


def run(options: Options, *, catalog: Iterable[GateSpec] | None = None) -> dict:
    validate_base_ref(options.base)
    started_at = utc_now()
    started = time.monotonic()
    head = git_output(["rev-parse", "HEAD"])
    branch = git_output(["branch", "--show-current"])
    before_snapshot = tracked_snapshot()
    report_path, run_root = resolve_output_path(options, head)
    logs_dir = run_root / "logs"
    artifacts_dir = run_root / "artifacts"
    logs_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    context = RunContext(
        options=options,
        report_path=report_path,
        run_root=run_root,
        logs_dir=logs_dir,
        artifacts_dir=artifacts_dir,
        head=head,
        branch=branch,
        before_snapshot=before_snapshot,
    )

    records: list[dict] = []
    gates = selected_gates(options.profile, catalog)
    if options.fail_fast or options.verbose:
        stopped = False
        for gate in gates:
            if stopped:
                records.append(skipped_gate_record(context, gate))
                continue
            record = execute_gate_record(context, gate)
            records.append(record)
            if options.fail_fast and record["status"] == "failed":
                stopped = True
    else:
        for stage in sorted({gate.stage for gate in gates}):
            stage_gates = tuple(gate for gate in gates if gate.stage == stage)
            if len(stage_gates) == 1:
                records.append(execute_gate_record(context, stage_gates[0]))
                continue
            with ThreadPoolExecutor(max_workers=min(4, len(stage_gates))) as executor:
                futures = [
                    executor.submit(execute_gate_record, context, gate)
                    for gate in stage_gates
                ]
                records.extend(future.result() for future in futures)

    integrity_log = logs_dir / "tracked-worktree-integrity.log"
    try:
        after_snapshot = tracked_snapshot()
        unchanged = before_snapshot == after_snapshot
        integrity_outcome = GateOutcome(
            status="passed" if unchanged else "failed",
            exit_code=0 if unchanged else 1,
            findings=[]
            if unchanged
            else [
                {
                    "type": "tracked_worktree_changed",
                    "message": "tracked worktree or index changed while local gates were running",
                }
            ],
            details={"before": before_snapshot, "after": after_snapshot},
        )
    except Exception as error:
        after_snapshot = None
        unchanged = False
        integrity_outcome = GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "workspace_snapshot_failure",
                    "message": Redactor(os.environ).text(str(error)),
                }
            ],
        )
    write_log(
        integrity_log,
        json.dumps(
            {
                "unchanged": unchanged,
                "before": before_snapshot,
                "after": after_snapshot,
                "findings": integrity_outcome.findings,
            },
            indent=2,
            ensure_ascii=True,
        )
        + "\n",
    )
    integrity_spec = GateSpec(
        "tracked-worktree-integrity",
        frozenset(PROFILES),
        30,
        False,
        special="integrity",
    )
    records.append(
        gate_record(
            integrity_spec,
            integrity_outcome,
            duration_ms=0,
            log_path=integrity_log,
        )
    )

    counts = {status: 0 for status in STATUS_VALUES}
    for record in records:
        counts[record["status"]] += 1
    complete = (
        not options.fail_fast
        and counts["skipped"] == 0
        and counts["deferred"] == 0
    )
    if counts["failed"]:
        status = "failed"
        exit_code = 1
    elif options.fail_fast or counts["skipped"] or counts["deferred"]:
        status = "deferred"
        exit_code = 1
    elif counts["passed_with_exception"]:
        status = "passed_with_exception"
        exit_code = 0
    else:
        status = "passed"
        exit_code = 0

    remote_checks = [
        {"id": record["id"], "status": record["status"]}
        for record in records
        if record["network"]
    ]
    result = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": utc_now(),
        "started_at": started_at,
        "duration_ms": int((time.monotonic() - started) * 1000),
        "profile": options.profile,
        "status": status,
        "exit_code": exit_code,
        "complete": complete,
        "fail_fast": options.fail_fast,
        "execution": {
            "parallel": not options.fail_fast and not options.verbose,
            "max_parallel_gates": 4,
            "dependency_stages": True,
        },
        "head": head,
        "base": resolved_base(context) if options.profile != "dev" else options.base,
        "pull_request": context.pr_context,
        "toolchain": context.toolchain,
        "network_isolation": context.network_isolation,
        "invocation": {
            "arguments": Redactor(os.environ).arguments(sys.argv[1:]),
            "environment": safe_environment_record(os.environ),
        },
        "workspace": {
            "before": before_snapshot,
            "after": after_snapshot,
            "tracked_worktree_unchanged": unchanged,
        },
        "safe_exceptions": context.safe_exceptions,
        "remote_checks": remote_checks,
        "logs_directory": relative_path(logs_dir),
        "artifacts_directory": relative_path(artifacts_dir),
        "summary": {"total": len(records), **counts},
        "gates": records,
        "formal_state_updates": {
            "pull_request_review": False,
            "content_approval": False,
            "launch_readiness": False,
        },
    }
    contract_errors = validate_report_contract(result)
    if contract_errors:
        raise RuntimeError("; ".join(contract_errors))
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    result["report_path"] = relative_path(report_path)
    return result


def main(argv: Sequence[str] | None = None) -> int:
    try:
        options = parse_args(argv)
        result = run(options)
    except ValueError as error:
        print(f"LOCAL GATES ARGUMENT ERROR: {error}", file=sys.stderr)
        return 2
    except Exception as error:
        print(
            f"LOCAL GATES RUNNER FAILED: {Redactor(os.environ).text(str(error))}",
            file=sys.stderr,
        )
        return 1

    print(
        f"LOCAL GATES {result['status'].upper()} "
        f"({result['summary']['passed']}/{result['summary']['total']} passed; "
        f"report: {result['report_path']})"
    )
    return int(result["exit_code"])
