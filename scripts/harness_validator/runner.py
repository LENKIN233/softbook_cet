from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from .capability_ast import validate_section_module

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

RESULT_SCHEMA_VERSION = "harness-result.v1"
CATALOG_SCHEMA_VERSION = "harness-catalog.v1"

HARNESS_LAYERS = (
    {
        "id": "bootstrap_layer",
        "sections": ("prelude",),
    },
    {
        "id": "truth_spec_layer",
        "sections": (
            "truth_mirrors",
            "harness_architecture",
            "product_contract_mirrors",
            "visual_language",
        ),
    },
    {
        "id": "workspace_hygiene_layer",
        "sections": ("workspace_boundary",),
    },
    {
        "id": "delivery_governance_layer",
        "sections": ("governance_contracts", "agent_run_record", "delivery_runtime"),
    },
    {
        "id": "design_governance_layer",
        "sections": ("design_governance",),
    },
    {
        "id": "runtime_smoke_layer",
        "sections": (),
    },
)

SECTION_DIR = Path(__file__).resolve().parent / "sections"
ROOT = Path(__file__).resolve().parents[2]
SECTION_WORKER = Path(__file__).resolve().parent / "section_worker.py"
DEFAULT_SECTION_TIMEOUT_SECONDS = 30.0
SECTION_DEPENDENCIES = {
    "delivery_runtime": ("governance_contracts",),
}


@dataclass(frozen=True)
class RunnerOptions:
    mode: str = "full"
    layers: tuple[str, ...] = ()
    sections: tuple[str, ...] = ()
    output_format: str = "text"
    output: Path | None = None
    list_catalog: bool = False
    profile: bool = False


def _iter_sections(layers=HARNESS_LAYERS) -> tuple[str, ...]:
    return tuple(section for layer in layers for section in layer["sections"])


def _section_owners(layers=HARNESS_LAYERS) -> dict[str, str]:
    return {
        section: layer["id"]
        for layer in layers
        for section in layer["sections"]
    }


def build_parser(layers=HARNESS_LAYERS) -> argparse.ArgumentParser:
    layer_ids = tuple(layer["id"] for layer in layers)
    section_ids = _iter_sections(layers)
    parser = argparse.ArgumentParser(
        description="Validate repository Harness contracts with structured diagnostics.",
    )
    parser.add_argument(
        "--mode",
        choices=("local", "full"),
        help="full reads remote GitHub protection; local never runs that guard",
    )
    parser.add_argument(
        "--layer",
        action="append",
        default=[],
        choices=layer_ids,
        help="run a layer; may be repeated",
    )
    parser.add_argument(
        "--section",
        action="append",
        default=[],
        choices=section_ids,
        help="run a section; may be repeated",
    )
    parser.add_argument(
        "--format",
        dest="output_format",
        choices=("text", "json"),
        default="text",
    )
    parser.add_argument("--output", type=Path, help="also write the rendered result")
    parser.add_argument("--list", dest="list_catalog", action="store_true")
    parser.add_argument("--profile", action="store_true")
    parser.add_argument(
        "--skip-remote-guard",
        action="store_true",
        help="compatibility alias for --mode local",
    )
    return parser


def parse_args(
    argv: Sequence[str] | None = None,
    *,
    layers=HARNESS_LAYERS,
) -> RunnerOptions:
    parser = build_parser(layers)
    args = parser.parse_args(argv)

    if args.skip_remote_guard and args.mode == "full":
        parser.error("--skip-remote-guard conflicts with --mode full")
    if args.list_catalog and args.profile:
        parser.error("--profile cannot be combined with --list")

    mode = args.mode or ("local" if args.skip_remote_guard else "full")
    options = RunnerOptions(
        mode=mode,
        layers=tuple(dict.fromkeys(args.layer)),
        sections=tuple(dict.fromkeys(args.section)),
        output_format=args.output_format,
        output=args.output,
        list_catalog=args.list_catalog,
        profile=args.profile,
    )

    if not options.list_catalog:
        try:
            resolve_sections(options, layers=layers)
        except ValueError as exc:
            parser.error(str(exc))

    return options


def resolve_sections(
    options: RunnerOptions,
    *,
    layers=HARNESS_LAYERS,
    section_dependencies=SECTION_DEPENDENCIES,
) -> tuple[str, ...]:
    canonical = _iter_sections(layers)
    if not options.layers and not options.sections:
        return canonical

    selected = set(options.sections)
    selected_layers = set(options.layers)
    for layer in layers:
        if layer["id"] in selected_layers:
            selected.update(layer["sections"])

    if not selected:
        raise ValueError("selection contains no runnable Harness sections")

    if "prelude" not in selected:
        selected.add("prelude")

    pending = list(selected)
    while pending:
        section = pending.pop()
        for dependency in section_dependencies.get(section, ()):
            if dependency not in canonical:
                continue
            if dependency not in selected:
                selected.add(dependency)
                pending.append(dependency)

    return tuple(section for section in canonical if section in selected)


def _finding(
    *,
    layer: str,
    section: str,
    finding_type: str,
    message: str,
    exception_type: str | None = None,
) -> dict[str, object]:
    finding: dict[str, object] = {
        "layer": layer,
        "section": section,
        "type": finding_type,
        "message": message,
    }
    if exception_type:
        finding["exception_type"] = exception_type
    return finding


def _run_section(
    section: str,
    layer: str,
    *,
    mode: str,
    section_dir: Path,
    section_timeout_seconds: float,
    worker_path: Path,
    clock=time.perf_counter,
) -> dict[str, object]:
    findings: list[dict[str, object]] = []
    started = clock()
    section_path = section_dir / f"{section}.py"
    boundary_errors = validate_section_module(
        section_path,
        section=section,
        layer=layer,
    )
    for message in boundary_errors:
        findings.append(
            _finding(
                layer=layer,
                section=section,
                finding_type="capability_violation",
                message=message,
            )
        )

    remote_guard_executed = False
    if boundary_errors:
        duration_ms = round((clock() - started) * 1000, 3)
        return {
            "layer": layer,
            "section": section,
            "status": "failed",
            "duration_ms": duration_ms,
            "findings": findings,
            "_remote_guard_executed": False,
        }

    command = [
        sys.executable,
        str(worker_path),
        "--root",
        str(ROOT),
        "--section-dir",
        str(section_dir),
        "--section",
        section,
        "--layer",
        layer,
        "--mode",
        mode,
    ]
    try:
        process = subprocess.Popen(
            command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
    except OSError as exc:
        findings.append(
            _finding(
                layer=layer,
                section=section,
                finding_type="worker_start_error",
                message=str(exc) or type(exc).__name__,
                exception_type=type(exc).__name__,
            )
        )
        return {
            "layer": layer,
            "section": section,
            "status": "failed",
            "duration_ms": round((clock() - started) * 1000, 3),
            "findings": findings,
            "_remote_guard_executed": False,
        }
    try:
        stdout, stderr = process.communicate(timeout=section_timeout_seconds)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        stdout, stderr = process.communicate()
        findings.append(
            _finding(
                layer=layer,
                section=section,
                finding_type="timeout",
                message=f"section exceeded {section_timeout_seconds:g}s timeout",
                exception_type="TimeoutExpired",
            )
        )
    else:
        if process.returncode != 0:
            findings.append(
                _finding(
                    layer=layer,
                    section=section,
                    finding_type="worker_error",
                    message=(stderr.strip() or f"section worker exited {process.returncode}"),
                )
            )
        else:
            try:
                payload = json.loads(stdout)
                errors = payload["errors"]
                exception = payload["exception"]
                remote_guard_executed = bool(payload["remote_guard_executed"])
                if not isinstance(errors, list):
                    raise TypeError("worker errors field must be a list")
                if exception is not None:
                    findings.append(
                        _finding(
                            layer=layer,
                            section=section,
                            finding_type="exception",
                            message=str(exception["message"]),
                            exception_type=str(exception["type"]),
                        )
                    )
                for error in errors:
                    findings.append(
                        _finding(
                            layer=layer,
                            section=section,
                            finding_type="check_failure",
                            message=str(error),
                        )
                    )
            except (json.JSONDecodeError, KeyError, TypeError) as exc:
                findings.append(
                    _finding(
                        layer=layer,
                        section=section,
                        finding_type="worker_protocol_error",
                        message=f"invalid section worker result: {exc}",
                        exception_type=type(exc).__name__,
                    )
                )

    duration_ms = round((clock() - started) * 1000, 3)
    return {
        "layer": layer,
        "section": section,
        "status": "failed" if findings else "passed",
        "duration_ms": duration_ms,
        "findings": findings,
        "_remote_guard_executed": remote_guard_executed,
    }


def run_harness(
    options: RunnerOptions,
    *,
    layers=HARNESS_LAYERS,
    section_dir: Path = SECTION_DIR,
    section_timeout_seconds: float = DEFAULT_SECTION_TIMEOUT_SECONDS,
    worker_path: Path = SECTION_WORKER,
    clock=time.perf_counter,
) -> dict[str, object]:
    started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    started = clock()
    canonical = _iter_sections(layers)
    selected = resolve_sections(options, layers=layers)
    selected_set = set(selected)
    owners = _section_owners(layers)
    section_results: list[dict[str, object]] = []
    findings: list[dict[str, object]] = []
    remote_guard_executed = False
    for section in canonical:
        layer = owners[section]
        if section not in selected_set:
            section_results.append(
                {
                    "layer": layer,
                    "section": section,
                    "status": "skipped",
                    "duration_ms": 0.0,
                    "findings": [],
                }
            )
            continue

        result = _run_section(
            section,
            layer,
            mode=options.mode,
            section_dir=section_dir,
            section_timeout_seconds=section_timeout_seconds,
            worker_path=worker_path,
            clock=clock,
        )
        section_remote_guard_executed = bool(result.pop("_remote_guard_executed"))
        remote_guard_executed = remote_guard_executed or section_remote_guard_executed
        section_results.append(result)
        findings.extend(result["findings"])

    all_sections_selected = selected == canonical
    complete = all_sections_selected and remote_guard_executed
    status = "failed" if findings else "passed"
    duration_ms = round((clock() - started) * 1000, 3)

    return {
        "schema_version": RESULT_SCHEMA_VERSION,
        "status": status,
        "exit_code": 1 if findings else 0,
        "mode": options.mode,
        "started_at": started_at,
        "duration_ms": duration_ms,
        "completeness": {
            "status": "complete" if complete else "partial",
            "complete": complete,
            "all_sections_selected": all_sections_selected,
            "remote_guard_executed": remote_guard_executed,
        },
        "selection": {
            "requested_layers": list(options.layers),
            "requested_sections": list(options.sections),
            "selected_sections": list(selected),
        },
        "summary": {
            "passed": sum(result["status"] == "passed" for result in section_results),
            "failed": sum(result["status"] == "failed" for result in section_results),
            "skipped": sum(result["status"] == "skipped" for result in section_results),
            "findings": len(findings),
        },
        "sections": section_results,
        "findings": findings,
        "profile_requested": options.profile,
    }


def build_catalog(layers=HARNESS_LAYERS) -> dict[str, object]:
    return {
        "schema_version": CATALOG_SCHEMA_VERSION,
        "layers": [
            {
                "id": layer["id"],
                "sections": list(layer["sections"]),
                "runnable": bool(layer["sections"]),
            }
            for layer in layers
        ],
    }


def render_catalog(catalog: dict[str, object], output_format: str) -> str:
    if output_format == "json":
        return json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"

    lines = []
    for layer in catalog["layers"]:
        sections = ", ".join(layer["sections"]) or "(delegated; no runnable sections)"
        lines.append(f"{layer['id']}: {sections}")
    return "\n".join(lines) + "\n"


def render_result(result: dict[str, object], output_format: str, *, profile: bool) -> str:
    if output_format == "json":
        return json.dumps(result, ensure_ascii=False, indent=2) + "\n"

    lines = [
        "HARNESS VALIDATION OK"
        if result["status"] == "passed"
        else "HARNESS VALIDATION FAILED"
    ]
    for finding in result["findings"]:
        lines.append(
            f"- [{finding['layer']}/{finding['section']}/{finding['type']}] "
            f"{finding['message']}"
        )

    completeness = result["completeness"]
    if not completeness["complete"]:
        lines.append(
            "HARNESS COMPLETENESS PARTIAL "
            f"(mode={result['mode']}, selected={len(result['selection']['selected_sections'])})"
        )

    if profile:
        lines.append("HARNESS PROFILE")
        for section in result["sections"]:
            if section["status"] != "skipped":
                lines.append(
                    f"- {section['layer']}/{section['section']}: "
                    f"{section['status']} {section['duration_ms']:.3f}ms"
                )

    return "\n".join(lines) + "\n"


def emit(rendered: str, output: Path | None) -> bool:
    if output is not None:
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(rendered, encoding="utf-8")
        except OSError as exc:
            print(
                f"[runner/output/output_error] unable to write Harness output: {exc}",
                file=sys.stderr,
            )
            return False
    print(rendered, end="")
    return True


def main(argv: Sequence[str] | None = None) -> int:
    options = parse_args(argv)
    if options.list_catalog:
        rendered = render_catalog(build_catalog(), options.output_format)
        return 0 if emit(rendered, options.output) else 1

    result = run_harness(options)
    rendered = render_result(result, options.output_format, profile=options.profile)
    if not emit(rendered, options.output):
        return 1
    return int(result["exit_code"])
