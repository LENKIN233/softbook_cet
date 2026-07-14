from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

RESULT_SCHEMA_VERSION = "harness-result.v1"
CATALOG_SCHEMA_VERSION = "harness-catalog.v1"

# Sections still run in one shared environment to preserve the legacy top-level
# validator semantics. Explicit validate(context) modules replace this in PR 2.
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


def _execute_section(
    section: str,
    env: dict[str, object],
    *,
    section_dir: Path = SECTION_DIR,
) -> None:
    section_path = section_dir / f"{section}.py"
    code = compile(section_path.read_text(encoding="utf-8"), str(section_path), "exec")
    exec(code, env)


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
    env: dict[str, object],
    *,
    section_dir: Path,
    clock=time.perf_counter,
) -> dict[str, object]:
    existing_errors = env.get("errors")
    before_count = len(existing_errors) if isinstance(existing_errors, list) else 0
    findings: list[dict[str, object]] = []
    started = clock()

    try:
        _execute_section(section, env, section_dir=section_dir)
    except (Exception, SystemExit) as exc:
        findings.append(
            _finding(
                layer=layer,
                section=section,
                finding_type="exception",
                message=str(exc) or type(exc).__name__,
                exception_type=type(exc).__name__,
            )
        )

    duration_ms = round((clock() - started) * 1000, 3)
    current_errors = env.get("errors")
    if isinstance(current_errors, list):
        for error in current_errors[before_count:]:
            findings.append(
                _finding(
                    layer=layer,
                    section=section,
                    finding_type="check_failure",
                    message=str(error),
                )
            )
    else:
        findings.append(
            _finding(
                layer=layer,
                section=section,
                finding_type="invalid_error_collection",
                message="section must preserve the shared errors list",
            )
        )
        env["errors"] = []

    return {
        "layer": layer,
        "section": section,
        "status": "failed" if findings else "passed",
        "duration_ms": duration_ms,
        "findings": findings,
    }


def run_harness(
    options: RunnerOptions,
    *,
    layers=HARNESS_LAYERS,
    section_dir: Path = SECTION_DIR,
    clock=time.perf_counter,
) -> dict[str, object]:
    started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    started = clock()
    canonical = _iter_sections(layers)
    selected = resolve_sections(options, layers=layers)
    selected_set = set(selected)
    owners = _section_owners(layers)
    env: dict[str, object] = {
        "__file__": str(Path(__file__).resolve().parents[1] / "validate_harness.py"),
        "__name__": "__validate_harness_runtime__",
        "errors": [],
        "HARNESS_SKIP_REMOTE_GUARD": options.mode == "local",
        "HARNESS_REMOTE_GUARD_EXECUTED": False,
    }

    section_results: list[dict[str, object]] = []
    findings: list[dict[str, object]] = []
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
            env,
            section_dir=section_dir,
            clock=clock,
        )
        section_results.append(result)
        findings.extend(result["findings"])

    all_sections_selected = selected == canonical
    remote_guard_executed = bool(env.get("HARNESS_REMOTE_GUARD_EXECUTED", False))
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
