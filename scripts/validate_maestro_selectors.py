#!/usr/bin/env python3
"""Reject user-facing text selectors in Maestro smoke flows."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FLOW_DIR = ROOT / "apps" / "mobile" / "e2e" / "maestro"
COMMAND_SELECTOR_KEYS = {
    "assertNotVisible",
    "assertVisible",
    "extendedWaitUntil",
    "scrollUntilVisible",
    "tapOn",
}
NESTED_SELECTOR_KEYS = {"element", "visible"}
TEXT_SELECTOR_KEYS = {"text"}
SCALAR_COMMAND_RE = re.compile(
    r"^\s*-\s*(?P<key>[A-Za-z][A-Za-z0-9_]*)\s*:\s*(?P<value>.+?)\s*$"
)
SCALAR_KEY_RE = re.compile(
    r"^\s*(?P<key>[A-Za-z][A-Za-z0-9_]*)\s*:\s*(?P<value>.+?)\s*$"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate that Maestro selectors use stable ids instead of "
            "user-facing visible text."
        )
    )
    parser.add_argument(
        "--file",
        action="append",
        default=[],
        help="Maestro YAML flow to validate. Defaults to apps/mobile/e2e/maestro/*.yaml.",
    )
    return parser.parse_args()


def strip_comment(value: str) -> str:
    quote: str | None = None
    escaped = False
    result: list[str] = []
    for char in value:
        if escaped:
            result.append(char)
            escaped = False
            continue
        if char == "\\":
            result.append(char)
            escaped = True
            continue
        if char in {"'", '"'}:
            if quote is None:
                quote = char
            elif quote == char:
                quote = None
            result.append(char)
            continue
        if char == "#" and quote is None:
            break
        result.append(char)
    return "".join(result).strip()


def is_empty_mapping_start(value: str) -> bool:
    return strip_comment(value) in {"", "|", ">"}


def is_stable_inline_id_selector(value: str) -> bool:
    normalized = strip_comment(value)
    if not (normalized.startswith("{") and normalized.endswith("}")):
        return False
    return re.search(r"\bid\s*:", normalized) is not None and re.search(
        r"\btext\s*:", normalized
    ) is None


def validate_file(path: Path) -> list[str]:
    errors: list[str] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        command_match = SCALAR_COMMAND_RE.match(line)
        if command_match:
            key = command_match.group("key")
            value = command_match.group("value")
            if key in COMMAND_SELECTOR_KEYS and not is_empty_mapping_start(value):
                if not is_stable_inline_id_selector(value):
                    errors.append(
                        f"{path}:{lineno}: {key} must use a stable id selector, "
                        "not visible text"
                    )
            continue

        key_match = SCALAR_KEY_RE.match(line)
        if not key_match:
            continue

        key = key_match.group("key")
        value = key_match.group("value")
        if key in NESTED_SELECTOR_KEYS and not is_empty_mapping_start(value):
            if not is_stable_inline_id_selector(value):
                errors.append(
                    f"{path}:{lineno}: {key} selector must be a mapping with id, "
                    "not visible text"
                )
        elif key in TEXT_SELECTOR_KEYS:
            errors.append(
                f"{path}:{lineno}: text selectors are forbidden in Maestro smoke "
                "flows; use id instead"
            )
    return errors


def default_files() -> list[Path]:
    return sorted(DEFAULT_FLOW_DIR.glob("*.yaml")) + sorted(
        DEFAULT_FLOW_DIR.glob("*.yml")
    )


def main() -> int:
    args = parse_args()
    files = [Path(file) for file in args.file] if args.file else default_files()
    errors: list[str] = []

    if not files:
        errors.append(f"no Maestro YAML flows found under {DEFAULT_FLOW_DIR}")

    for file in files:
        if not file.exists():
            errors.append(f"missing Maestro YAML flow: {file}")
            continue
        errors.extend(validate_file(file))

    if errors:
        print("MAESTRO SELECTOR VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("MAESTRO SELECTOR VALIDATION OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
