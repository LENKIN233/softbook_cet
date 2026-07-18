#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

from context import context_for_layer
from runtime_policy import policy_for_context


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--section-dir", type=Path, required=True)
    parser.add_argument("--section", required=True)
    parser.add_argument("--layer", required=True)
    parser.add_argument("--mode", choices=("local", "full"), required=True)
    return parser.parse_args()


def load_validate(path: Path, section: str):
    module_name = f"softbook_harness_section_{section}_{os.getpid()}"
    module_spec = importlib.util.spec_from_file_location(module_name, path)
    if module_spec is None or module_spec.loader is None:
        raise ImportError(f"unable to load section module: {path}")
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    validate = getattr(module, "validate", None)
    if not callable(validate):
        raise TypeError(f"section module does not export validate(context): {path}")
    return validate


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    section_path = args.section_dir.resolve() / f"{args.section}.py"
    context = context_for_layer(
        layer=args.layer,
        root=root,
        mode=args.mode,
        section=args.section,
    )
    exception = None
    try:
        validate = load_validate(section_path, args.section)
        with policy_for_context(context).enforce():
            validate(context)
    except (Exception, SystemExit) as exc:
        exception = {
            "type": type(exc).__name__,
            "message": str(exc) or type(exc).__name__,
        }

    print(
        json.dumps(
            {
                "errors": [str(error) for error in context.errors],
                "exception": exception,
                "remote_guard_executed": context.remote_guard_executed,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
