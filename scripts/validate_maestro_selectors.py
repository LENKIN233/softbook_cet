#!/usr/bin/env python3
"""Validate Maestro smoke selectors against stable React Native test ids."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FLOW_DIR = ROOT / "apps" / "mobile" / "e2e" / "maestro"
TEST_ID_SOURCE_GLOBS = (
    "apps/mobile/App.tsx",
    "apps/mobile/src/**/*.tsx",
)
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
ID_KEY_RE = re.compile(r"^\s*id\s*:\s*['\"](?P<id>[^'\"]+)['\"]")
INLINE_ID_RE = re.compile(r"\bid\s*:\s*['\"](?P<id>[^'\"]+)['\"]")
TEST_ID_LITERAL_RE = re.compile(r"testID\s*=\s*['\"](?P<id>[^'\"]+)['\"]")
STRING_LITERAL_RE = re.compile(r"['\"](?P<id>[a-z][a-z0-9_-]+)['\"]")
TEMPLATE_LITERAL_RE = re.compile(r"`(?P<template>[^`]*\$\{[^`]+)`", re.DOTALL)
TEMPLATE_EXPR_RE = re.compile(r"\$\{[^}]+\}")


IdReference = tuple[Path, int, str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate that Maestro selectors use stable ids instead of "
            "user-facing visible text, and that each id is backed by a "
            "React Native testID."
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


def source_files() -> list[Path]:
    files: list[Path] = []
    for pattern in TEST_ID_SOURCE_GLOBS:
        path = ROOT / pattern
        if path.exists():
            files.append(path)
        else:
            files.extend(sorted(ROOT.glob(pattern)))
    return sorted(set(files))


def template_to_regex(template: str) -> re.Pattern[str]:
    parts: list[str] = []
    last = 0
    for match in TEMPLATE_EXPR_RE.finditer(template):
        parts.append(re.escape(template[last : match.start()]))
        parts.append(r"[A-Za-z0-9_-]+")
        last = match.end()
    parts.append(re.escape(template[last:]))
    return re.compile("^" + "".join(parts) + "$")


def collect_supported_test_ids() -> tuple[set[str], list[re.Pattern[str]]]:
    exact_ids: set[str] = set()
    pattern_ids: list[re.Pattern[str]] = []

    for file in source_files():
        text = file.read_text(encoding="utf-8")
        exact_ids.update(match.group("id") for match in TEST_ID_LITERAL_RE.finditer(text))

        lines = text.splitlines()
        for index, line in enumerate(lines):
            if "testID={" not in line and "labelTestID={" not in line:
                continue

            window = "\n".join(lines[index : index + 8])
            exact_ids.update(
                match.group("id") for match in STRING_LITERAL_RE.finditer(window)
            )
            for template_match in TEMPLATE_LITERAL_RE.finditer(window):
                template = re.sub(r"\s+", "", template_match.group("template"))
                if "-" in template:
                    pattern_ids.append(template_to_regex(template))

    return exact_ids, pattern_ids


def collect_id_references(path: Path) -> list[IdReference]:
    references: list[IdReference] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        id_match = ID_KEY_RE.match(line)
        if id_match:
            references.append((path, lineno, id_match.group("id")))
            continue

        inline_id_match = INLINE_ID_RE.search(line)
        if inline_id_match:
            references.append((path, lineno, inline_id_match.group("id")))
    return references


def is_supported_test_id(
    selector_id: str,
    exact_ids: set[str],
    pattern_ids: list[re.Pattern[str]],
) -> bool:
    return selector_id in exact_ids or any(
        pattern.fullmatch(selector_id) for pattern in pattern_ids
    )


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


def validate_id_coverage(files: list[Path]) -> list[str]:
    errors: list[str] = []
    exact_ids, pattern_ids = collect_supported_test_ids()

    for file in files:
        for path, lineno, selector_id in collect_id_references(file):
            if not is_supported_test_id(selector_id, exact_ids, pattern_ids):
                errors.append(
                    f"{path}:{lineno}: id {selector_id!r} is not backed by a "
                    "React Native testID literal or template"
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

    existing_files = [file for file in files if file.exists()]
    errors.extend(validate_id_coverage(existing_files))

    if errors:
        print("MAESTRO SELECTOR VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("MAESTRO SELECTOR VALIDATION OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
