from __future__ import annotations

import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

# Sections run in one shared environment to preserve the legacy top-level
# validator semantics while making each responsibility easier to review.
SECTION_ORDER = (
    "prelude",
    "truth_mirrors",
    "workspace_boundary",
    "governance_contracts",
    "product_contract_mirrors",
    "delivery_runtime",
    "design_governance",
    "visual_language",
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

    for section in SECTION_ORDER:
        _execute_section(section, env)

    errors = env.get("errors", [])
    if errors:
        print("HARNESS VALIDATION FAILED")
        for err in errors:
            print(f"- {err}")
        return 1

    print("HARNESS VALIDATION OK")
    return 0
