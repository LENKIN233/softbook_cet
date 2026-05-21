from __future__ import annotations

import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

# Sections run in one shared environment to preserve the legacy top-level
# validator semantics while making layer ownership explicit. Runtime smoke
# remains delegated to CI jobs; validate_harness.py checks its wiring.
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


def _iter_sections() -> tuple[str, ...]:
    return tuple(
        section
        for layer in HARNESS_LAYERS
        for section in layer["sections"]
    )


def _execute_section(section: str, env: dict[str, object]) -> None:
    section_path = Path(__file__).resolve().parent / "sections" / f"{section}.py"
    code = compile(section_path.read_text(encoding="utf-8"), str(section_path), "exec")
    exec(code, env)


def main() -> int:
    script_path = Path(__file__).resolve().parents[1] / "validate_harness.py"
    env: dict[str, object] = {
        "__file__": str(script_path),
        "__name__": "__validate_harness_runtime__",
    }

    for section in _iter_sections():
        _execute_section(section, env)

    errors = env.get("errors", [])
    if errors:
        print("HARNESS VALIDATION FAILED")
        for err in errors:
            print(f"- {err}")
        return 1

    print("HARNESS VALIDATION OK")
    return 0
