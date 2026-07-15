from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from context import LITERAL_SOURCE_ANCHORS


def validate_legacy_design(context, section_path: Path) -> None:
    root = context.root
    spec_dir = root / "spec"
    errors: list[str] = []

    def load(name: str):
        return json.loads((spec_dir / name).read_text(encoding="utf-8"))

    def check_equal(label, expected, actual):
        if expected != actual:
            errors.append(f"{label}: expected {expected!r}, got {actual!r}")

    def check_contains(label, text, expected):
        if expected not in text:
            errors.append(f"{label}: missing exact snippet {expected!r}")

    def find_by_id(entries, entry_id):
        for entry in entries:
            if entry["id"] == entry_id:
                return entry
        errors.append(f"missing entry id: {entry_id}")
        return None

    def run_command(*args):
        try:
            return subprocess.run(
                args,
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            errors.append(f"missing required command: {args[0]}")
            return None

    def run_design_gate_case(body: str, changed_files: list[str]):
        args = [sys.executable, str(root / "scripts" / "validate_pr_design_gate.py")]
        for changed_file in changed_files:
            args.extend(["--changed-file", changed_file])
        return subprocess.run(
            args,
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "PR_BODY": body},
        )

    def load_design_gate_module():
        path = root / "scripts" / "validate_pr_design_gate.py"
        module_spec = importlib.util.spec_from_file_location("validate_pr_design_gate", path)
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        return module

    literal_source_anchors = dict(LITERAL_SOURCE_ANCHORS)

    def anchor_texts(*keys):
        return [literal_source_anchors[key] for key in keys]

    env = {
        "__file__": str(root / "scripts" / "validate_harness.py"),
        "__name__": "__legacy_design_governance__",
        "ROOT": root,
        "SPEC": spec_dir,
        "Path": Path,
        "errors": errors,
        "load": load,
        "check_equal": check_equal,
        "check_contains": check_contains,
        "find_by_id": find_by_id,
        "run_command": run_command,
        "run_design_gate_case": run_design_gate_case,
        "load_design_gate_module": load_design_gate_module,
        "literal_source_anchors": literal_source_anchors,
        "anchor_texts": anchor_texts,
        "os": os,
        "shutil": shutil,
        "subprocess": subprocess,
        "sys": sys,
        "tempfile": tempfile,
    }
    for variable, filename in {
        "req": "requirement-memory.json",
        "auth": "account-sync-contract.json",
        "platform": "platform-contract.json",
        "product": "product-core.json",
        "membership": "membership.json",
        "delivery": "repo-delivery-contract.json",
        "interactions": "interactions.json",
        "manifest": "doc-manifest.json",
        "authority": "authority-map.json",
        "harness": "agent-harness.json",
        "harness_architecture": "harness-architecture.json",
        "agent_run_record": "agent-run-record.json",
        "evals": "evals.json",
        "perturbation_audit": "perturbation-audit.json",
    }.items():
        env[variable] = load(filename)

    code = compile(section_path.read_text(encoding="utf-8"), str(section_path), "exec")
    exec(code, env)
    context.errors.extend(errors)
