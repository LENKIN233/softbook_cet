#!/usr/bin/env python3
"""Validate the fail-closed PC Web v5 state mapping artifact only.

This validator is intentionally standalone. It is not wired into the repository
harness or any delivery/design/release gate.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MAPPING = (
    ROOT
    / "docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5"
    / "pc-web-v5-state-mapping.md"
)
DEFAULT_CONTRACT = (
    ROOT
    / "docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5"
    / "grayscale-ux-state-contract.md"
)

STATE_ID_RE = re.compile(r"^[A-Z][A-Z0-9-]*-\d{2}$")
CONTRACT_STATE_RE = re.compile(
    r"^\|\s*`(?P<id>[A-Z][A-Z0-9-]*-\d{2})\s+(?P<title>[^`]+)`\s*\|"
)
REGISTRY_CODE_RE = re.compile(r"^[AEGT]-[A-Z0-9-]+$")

ALLOWED_RESULTS = {
    "blocked_exact_v5_browser_missing",
    "blocked_pc_web_implementation_missing",
    "blocked_canonical_service_missing",
    "blocked_external_store_missing",
    "blocked_beta_environment_missing",
    "blocked_manual_accessibility_missing",
    "blocked_cross_state_evidence_missing",
}

EXPECTED_RESULT_MEANINGS = {
    "blocked_exact_v5_browser_missing": "A relevant PC Web surface exists or has broad historical evidence, but no exact frozen v5 browser replay proves this row.",
    "blocked_pc_web_implementation_missing": "The required PC Web state or branch is not implemented in the current evidence.",
    "blocked_canonical_service_missing": "The row requires canonical service origin, acknowledgement, durability, reconciliation, or lifecycle truth that local Web state cannot prove.",
    "blocked_external_store_missing": "The row requires a real Web payment/store/provider outcome and canonical entitlement refresh.",
    "blocked_beta_environment_missing": "The row requires receiver-owned grant/revoke/read evidence from the closed-beta environment.",
    "blocked_manual_accessibility_missing": "The row requires exact zoom, keyboard/switch, focus, reduced-motion, or named screen-reader evidence.",
    "blocked_cross_state_evidence_missing": "The forced combination lacks one exact current evidence record spanning all named dimensions.",
}

COMPLETION_BOUNDARY_TEXT = (
    "This mapping is complete as a fail-closed inventory when its dedicated validator passes.",
    "That validator result does not change any architecture, design, delivery, or release gate.",
    "The validator freezes the complete normative document, including status, result meanings, nonpromotion rules, execution requirements, completion text, and any appended prose; changing those bytes requires an explicit digest update and review.",
    "A future row may move away from `blocked_*` only with an exact current browser evidence pointer and any required canonical, provider, receiver, or manual accessibility evidence; such a change requires a separately authorized update to this artifact and its evidence, not an inference from mobile proofs.",
)

ALLOWED_REGIONS = {
    "auth object",
    "auth object -> center workbench",
    "shell / route rail",
    "shell / context rail",
    "center workbench / learning object",
    "center workbench / action plane",
    "center workbench / result slip",
    "center workbench / action plane + result slip",
    "center workbench / daily ledger",
    "center workbench / account object",
    "context rail / attached support",
    "context rail / attached tools",
    "context rail / audio chip",
    "context rail / account status",
    "context rail / account support",
    "space / tree rail",
    "space / current box workbench",
    "space / inspector",
    "space / state rail",
    "space / tree rail + current box workbench",
    "space / tree rail + current box workbench + inspector",
    "origin object / membership interruption",
    "account object / purchase and restore",
    "whole pcw-01 contract",
}

REQUIRED_REGISTRY_CODES = {
    "A-SHELL",
    "A-AUTH",
    "A-LEARN",
    "A-SPACE",
    "A-STATS",
    "A-MINE",
    "A-INPUT",
    "A-VISUAL",
    "E-SHELL",
    "E-AUTH",
    "E-LEARN",
    "E-AUDIO",
    "E-SPACE",
    "E-STATS",
    "E-MINE",
    "E-FUTURE",
    "E-STATUS",
    "E-BROWSER",
    "G-RUNTIME",
    "G-ACCESS",
    "G-AUDIO",
    "T-APP",
    "T-RUNTIME",
}

REQUIRED_MATRIX_IDS = {
    "PW-VIEWPORT-01",
    "PW-VIEWPORT-02",
    "PW-ZOOM-01",
    "PW-KEYBOARD-01",
    "PW-MOUSE-01",
    "PW-FOCUS-01",
    "PW-MOTION-01",
    "PW-SCREENREADER-01",
    "PW-SERVICE-01",
    "PW-COMMERCE-01",
    "PW-BETA-01",
    "PW-AUDIO-01",
}

CONTRACT_STATE_IDENTITY_SHA256 = (
    "34d3ef69cdf7019e6492efc0dd499ffe570908c2756f1fc48f016f8da1492f8f"
)
PC_WEB_MAPPING_IDENTITY_SHA256 = (
    "b356f3d56115c443b2d89496733378b1c44886d16d69ec6a7623038ec9ea479b"
)
PC_WEB_DOCUMENT_SEMANTIC_SHA256 = (
    "0ccdb12d193dd29d4eac8cbfbe3dd308391cb551a2d0e8a6aa34205d6ce8cd73"
)

DOCUMENT_SEMANTIC_MARKER_RE = re.compile(
    r"(?m)^- Frozen PC Web document semantic digest: `[0-9a-f]{64}`\.$"
)

REQUIRED_TEXT = (
    "- Status: `design_only_pc_web_state_mapping`.",
    "Accepted direction: `pcw-01 Focused Workbench`",
    "Scope: all 160 semantic state IDs plus all 13 forced cross-state coverage IDs.",
    "It does not change `state-evidence-ledger.md`, any gate layer, implementation authority, or release readiness.",
    "No row proves canonical service acknowledgement, payment/store behavior, receiver-managed access, deployment, final visual quality, or leadership readiness.",
    f"Frozen contract state ID/title digest: `{CONTRACT_STATE_IDENTITY_SHA256}`.",
    f"Frozen PC Web mapping identity digest: `{PC_WEB_MAPPING_IDENTITY_SHA256}`.",
    f"Frozen PC Web document semantic digest: `{PC_WEB_DOCUMENT_SEMANTIC_SHA256}`.",
    "`1440×900`",
    "`1024`",
    "`200%`",
    "`keyboard-only`",
    "`mouse`",
    "prefers-reduced-motion: reduce",
    "`screen-reader`",
)

FORBIDDEN_COMPOSITION_RE = re.compile(
    r"\b(?:ios|android|mobile|tablet)\b|bottom\s+(?:tab|navigation)|phone[- ]frame",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class MappingRow:
    state_id: str
    title: str
    region: str
    binding: str
    pointers: tuple[str, ...]
    result: str
    next_evidence: str


@dataclass(frozen=True)
class RegistryEntry:
    code: str
    pointer: str
    use: str


@dataclass(frozen=True)
class MatrixRow:
    matrix_id: str
    environment: str
    state_scope: str
    required_operation: str
    required_record: str
    result: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the standalone PC Web v5 state mapping"
    )
    parser.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING)
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="also run in-memory negative mutation tests",
    )
    return parser.parse_args()


def section(text: str, start_heading: str, end_heading: str | None) -> str:
    start_marker = f"## {start_heading}"
    start = text.find(start_marker)
    if start < 0:
        return ""
    body_start = start + len(start_marker)
    if end_heading is None:
        return text[body_start:]
    end = text.find(f"## {end_heading}", body_start)
    if end < 0:
        return ""
    return text[body_start:end]


def strip_code(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value.startswith("`") and value.endswith("`"):
        return value[1:-1]
    return value


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def document_semantic_digest(mapping_text: str) -> str:
    """Freeze every normative byte while avoiding a self-referential digest."""
    normalized = mapping_text.replace("\r\n", "\n")
    normalized, replacements = DOCUMENT_SEMANTIC_MARKER_RE.subn(
        "- Frozen PC Web document semantic digest: `<self>`.", normalized
    )
    if replacements != 1:
        return "invalid-semantic-digest-marker"
    return sha256(normalized)


def parse_contract_states(contract_text: str) -> list[tuple[str, str]]:
    states: list[tuple[str, str]] = []
    for line in contract_text.splitlines():
        match = CONTRACT_STATE_RE.match(line)
        if not match:
            continue
        state_id = match.group("id")
        states.append((state_id, match.group("title").strip()))
    return states


def contract_state_identity_digest(states: list[tuple[str, str]]) -> str:
    return sha256("\n".join(f"{state_id}\x1f{title}" for state_id, title in states))


def parse_mapping_rows(table_section: str) -> tuple[list[MappingRow], list[str]]:
    rows: list[MappingRow] = []
    errors: list[str] = []
    for line_number, line in enumerate(table_section.splitlines(), start=1):
        if not re.match(r"^\|\s*`[A-Z]", line):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 7:
            errors.append(
                f"mapping row at section line {line_number} must have 7 cells; got {len(cells)}"
            )
            continue
        state_id = strip_code(cells[0])
        if not STATE_ID_RE.fullmatch(state_id):
            errors.append(f"invalid mapping state ID: {state_id!r}")
            continue
        pointers = tuple(part.strip() for part in cells[4].split(",") if part.strip())
        rows.append(
            MappingRow(
                state_id=state_id,
                title=cells[1],
                region=strip_code(cells[2]),
                binding=cells[3],
                pointers=pointers,
                result=strip_code(cells[5]),
                next_evidence=cells[6],
            )
        )
    return rows, errors


def parse_registry(
    registry_section: str,
) -> tuple[dict[str, RegistryEntry], list[str]]:
    registry: dict[str, RegistryEntry] = {}
    errors: list[str] = []
    for line in registry_section.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 3 or not REGISTRY_CODE_RE.fullmatch(cells[0]):
            continue
        code, pointer, use = cells[0], strip_code(cells[1]), cells[2]
        if code in registry:
            errors.append(f"duplicate evidence registry code: {code}")
        registry[code] = RegistryEntry(code=code, pointer=pointer, use=use)
    return registry, errors


def parse_result_meanings(result_section: str) -> tuple[dict[str, str], list[str]]:
    meanings: dict[str, str] = {}
    errors: list[str] = []
    for line in result_section.splitlines():
        if not re.match(r"^\|\s*`blocked_", line):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 2:
            errors.append("result-code row must contain exactly Result and Meaning")
            continue
        result = strip_code(cells[0])
        if result in meanings:
            errors.append(f"duplicate result-code definition: {result}")
        meanings[result] = cells[1]
    return meanings, errors


def heading_slugs(text: str) -> set[str]:
    slugs: set[str] = set()
    for line in text.splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)\s*$", line)
        if not match:
            continue
        heading = match.group(1).strip().lower()
        heading = re.sub(r"[^\w\s-]", "", heading, flags=re.UNICODE)
        heading = re.sub(r"[\s-]+", "-", heading).strip("-")
        slugs.add(heading)
    return slugs


def validate_registry_paths(
    registry: dict[str, RegistryEntry], root: Path
) -> list[str]:
    errors: list[str] = []
    resolved_root = root.resolve()
    for code, entry in registry.items():
        pointer = entry.pointer
        path_text, separator, anchor = pointer.partition("#")
        posix_path = PurePosixPath(path_text)
        if (
            not path_text
            or posix_path.is_absolute()
            or "\\" in path_text
            or ".." in posix_path.parts
            or re.match(r"^[A-Za-z]:", path_text)
        ):
            errors.append(
                f"{code} repository pointer must be repository-relative without '..': {pointer}"
            )
            continue
        path = (resolved_root / path_text).resolve()
        try:
            path.relative_to(resolved_root)
        except ValueError:
            errors.append(f"{code} repository pointer escapes repository root: {pointer}")
            continue
        if not path.is_file():
            errors.append(f"{code} points to missing repository file: {path_text}")
            continue
        if separator:
            if path.suffix.lower() != ".md":
                errors.append(f"{code} uses an anchor on a non-Markdown file: {pointer}")
                continue
            if anchor not in heading_slugs(path.read_text(encoding="utf-8")):
                errors.append(f"{code} points to missing Markdown heading: {pointer}")
    return errors


def duplicates(values: list[str]) -> set[str]:
    seen: set[str] = set()
    repeated: set[str] = set()
    for value in values:
        if value in seen:
            repeated.add(value)
        seen.add(value)
    return repeated


def validate_rows(
    rows: list[MappingRow],
    expected: list[tuple[str, str]],
    registry: dict[str, RegistryEntry],
    label: str,
) -> list[str]:
    errors: list[str] = []
    expected_ids = [state_id for state_id, _ in expected]
    expected_titles = dict(expected)
    actual_ids = [row.state_id for row in rows]

    repeated = duplicates(actual_ids)
    if repeated:
        errors.append(f"{label} contains duplicate IDs: {', '.join(sorted(repeated))}")

    missing = sorted(set(expected_ids) - set(actual_ids))
    extra = sorted(set(actual_ids) - set(expected_ids))
    if missing:
        errors.append(f"{label} is missing IDs: {', '.join(missing)}")
    if extra:
        errors.append(f"{label} contains unexpected IDs: {', '.join(extra)}")
    if actual_ids != expected_ids:
        errors.append(f"{label} row order must match grayscale-ux-state-contract.md")

    for row in rows:
        expected_title = expected_titles.get(row.state_id)
        if expected_title is not None and row.title != expected_title:
            errors.append(
                f"{row.state_id} title mismatch: expected {expected_title!r}, got {row.title!r}"
            )
        if row.region not in ALLOWED_REGIONS:
            errors.append(f"{row.state_id} uses unknown pcw-01 region: {row.region!r}")
        if FORBIDDEN_COMPOSITION_RE.search(f"{row.region} {row.binding}"):
            errors.append(
                f"{row.state_id} mapping imports a forbidden non-PC-Web composition term"
            )
        if row.result not in ALLOWED_RESULTS:
            errors.append(f"{row.state_id} uses invalid fail-closed result: {row.result!r}")
        if not row.result.startswith("blocked_"):
            errors.append(f"{row.state_id} must remain blocked without exact evidence")
        if not row.binding.strip():
            errors.append(f"{row.state_id} must have a concrete PC Web behavior binding")
        if not row.next_evidence.strip():
            errors.append(f"{row.state_id} must name required next evidence")
        if not any(pointer.startswith("A-") for pointer in row.pointers):
            errors.append(f"{row.state_id} must cite an accepted pcw-01 authority pointer")
        if not any(pointer.startswith(("E-", "G-", "T-")) for pointer in row.pointers):
            errors.append(f"{row.state_id} must cite implementation, gap, or test context")
        unknown = sorted(set(row.pointers) - set(registry))
        if unknown:
            errors.append(
                f"{row.state_id} cites unknown evidence codes: {', '.join(unknown)}"
            )
    return errors


def parse_execution_matrix(
    matrix_section: str,
) -> tuple[dict[str, MatrixRow], list[str]]:
    rows: dict[str, MatrixRow] = {}
    errors: list[str] = []
    for line in matrix_section.splitlines():
        if not line.startswith("| PW-"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 6:
            errors.append(
                f"execution matrix row {cells[0] if cells else '<unknown>'} must have 6 cells"
            )
            continue
        matrix_id = cells[0]
        if matrix_id in rows:
            errors.append(f"duplicate execution matrix ID: {matrix_id}")
        rows[matrix_id] = MatrixRow(
            matrix_id=matrix_id,
            environment=cells[1],
            state_scope=cells[2],
            required_operation=cells[3],
            required_record=cells[4],
            result=strip_code(cells[5]),
        )
    return rows, errors


def mapping_identity_digest(
    registry: dict[str, RegistryEntry],
    semantic_rows: list[MappingRow],
    cov_rows: list[MappingRow],
    matrix_rows: dict[str, MatrixRow],
) -> str:
    registry_identity = [
        "REGISTRY\x1f" + "\x1f".join((entry.code, entry.pointer, entry.use))
        for entry in registry.values()
    ]
    state_identity = [
        "STATE\x1f"
        + "\x1f".join(
            (
                row.state_id,
                row.title,
                row.region,
                row.binding,
                ",".join(row.pointers),
                row.result,
                row.next_evidence,
            )
        )
        for row in [*semantic_rows, *cov_rows]
    ]
    matrix_identity = [
        "MATRIX\x1f"
        + "\x1f".join(
            (
                row.matrix_id,
                row.environment,
                row.state_scope,
                row.required_operation,
                row.required_record,
                row.result,
            )
        )
        for row in matrix_rows.values()
    ]
    return sha256("\n".join([*registry_identity, *state_identity, *matrix_identity]))


def validate(mapping_text: str, contract_text: str, root: Path = ROOT) -> list[str]:
    errors: list[str] = []

    for required in REQUIRED_TEXT:
        if required not in mapping_text:
            errors.append(f"mapping is missing required boundary or matrix marker: {required}")

    status_lines = re.findall(r"(?m)^- Status: `([^`]+)`\.$", mapping_text)
    if status_lines != ["design_only_pc_web_state_mapping"]:
        errors.append(
            "mapping must declare exactly one design_only_pc_web_state_mapping status"
        )

    result_text = section(mapping_text, "Result codes", "Semantic state mapping")
    result_meanings, result_errors = parse_result_meanings(result_text)
    errors.extend(result_errors)
    if set(result_meanings) != set(EXPECTED_RESULT_MEANINGS):
        errors.append("result-code definitions must exactly match the fail-closed registry")
    for result, expected_meaning in EXPECTED_RESULT_MEANINGS.items():
        actual_meaning = result_meanings.get(result)
        if actual_meaning is not None and actual_meaning != expected_meaning:
            errors.append(f"{result} meaning changed from the fail-closed definition")

    completion_text = section(mapping_text, "Completion rule for this artifact", None)
    for boundary in COMPLETION_BOUNDARY_TEXT:
        if boundary not in completion_text:
            errors.append(f"completion/nonpromotion boundary is missing: {boundary}")

    contract_states = parse_contract_states(contract_text)
    contract_digest = contract_state_identity_digest(contract_states)
    if contract_digest != CONTRACT_STATE_IDENTITY_SHA256:
        errors.append(
            "Contract state ID/title identity changed: "
            f"expected {CONTRACT_STATE_IDENTITY_SHA256}, found {contract_digest}"
        )
    semantic_expected = [item for item in contract_states if not item[0].startswith("COV-")]
    cov_expected = [item for item in contract_states if item[0].startswith("COV-")]
    if len(semantic_expected) != 160:
        errors.append(
            f"source contract must expose exactly 160 semantic IDs; got {len(semantic_expected)}"
        )
    if len(cov_expected) != 13:
        errors.append(f"source contract must expose exactly 13 COV IDs; got {len(cov_expected)}")

    registry_text = section(mapping_text, "Evidence pointer registry", "Result codes")
    registry, registry_errors = parse_registry(registry_text)
    errors.extend(registry_errors)
    missing_codes = sorted(REQUIRED_REGISTRY_CODES - set(registry))
    extra_codes = sorted(set(registry) - REQUIRED_REGISTRY_CODES)
    if missing_codes:
        errors.append(f"evidence registry is missing codes: {', '.join(missing_codes)}")
    if extra_codes:
        errors.append(f"evidence registry has unexpected codes: {', '.join(extra_codes)}")
    errors.extend(validate_registry_paths(registry, root))

    semantic_text = section(mapping_text, "Semantic state mapping", "Forced cross-state mapping")
    semantic_rows, semantic_parse_errors = parse_mapping_rows(semantic_text)
    errors.extend(semantic_parse_errors)
    errors.extend(
        validate_rows(semantic_rows, semantic_expected, registry, "semantic mapping")
    )

    cov_text = section(mapping_text, "Forced cross-state mapping", "PC Web execution matrix")
    cov_rows, cov_parse_errors = parse_mapping_rows(cov_text)
    errors.extend(cov_parse_errors)
    errors.extend(validate_rows(cov_rows, cov_expected, registry, "COV mapping"))
    cov_12 = next((row for row in cov_rows if row.state_id == "COV-12"), None)
    if cov_12 is None or "A-VISUAL" not in cov_12.pointers:
        errors.append("COV-12 must cite A-VISUAL as its metadata-leak authority owner")

    matrix_text = section(mapping_text, "PC Web execution matrix", "Completion rule for this artifact")
    matrix_rows, matrix_errors = parse_execution_matrix(matrix_text)
    errors.extend(matrix_errors)
    missing_matrix = sorted(REQUIRED_MATRIX_IDS - set(matrix_rows))
    extra_matrix = sorted(set(matrix_rows) - REQUIRED_MATRIX_IDS)
    if missing_matrix:
        errors.append(f"execution matrix is missing IDs: {', '.join(missing_matrix)}")
    if extra_matrix:
        errors.append(f"execution matrix has unexpected IDs: {', '.join(extra_matrix)}")
    for matrix_id, row in matrix_rows.items():
        required_fields = {
            "Environment": row.environment,
            "State scope": row.state_scope,
            "Required operation": row.required_operation,
            "Required record": row.required_record,
        }
        for field_name, value in required_fields.items():
            if not value.strip():
                errors.append(f"{matrix_id} {field_name} must not be empty")
        if row.result not in ALLOWED_RESULTS or not row.result.startswith("blocked_"):
            errors.append(
                f"{matrix_id} must use an allowed fail-closed result; got {row.result!r}"
            )

    identity_digest = mapping_identity_digest(
        registry, semantic_rows, cov_rows, matrix_rows
    )
    if identity_digest != PC_WEB_MAPPING_IDENTITY_SHA256:
        errors.append(
            "PC Web mapping identity changed: "
            f"expected {PC_WEB_MAPPING_IDENTITY_SHA256}, found {identity_digest}"
        )

    semantic_digest = document_semantic_digest(mapping_text)
    if semantic_digest != PC_WEB_DOCUMENT_SEMANTIC_SHA256:
        errors.append(
            "PC Web document semantic identity changed: "
            f"expected {PC_WEB_DOCUMENT_SEMANTIC_SHA256}, found {semantic_digest}"
        )

    return errors


def first_table_row(text: str, section_name: str, end_name: str) -> str:
    table = section(text, section_name, end_name)
    for line in table.splitlines():
        if re.match(r"^\|\s*`[A-Z]", line):
            return line
    raise ValueError(f"no mapping row found in {section_name}")


def run_self_tests(mapping_text: str, contract_text: str) -> list[str]:
    failures: list[str] = []
    semantic_row = first_table_row(
        mapping_text, "Semantic state mapping", "Forced cross-state mapping"
    )
    screenreader_row = next(
        line
        for line in mapping_text.splitlines()
        if line.startswith("| PW-SCREENREADER-01 ")
    )
    non_blocked_row = semantic_row.replace(
        "`blocked_exact_v5_browser_missing`",
        "`covered_exact_v5_browser`",
        1,
    )
    semantic_cells = [
        cell.strip() for cell in semantic_row.strip().strip("|").split("|")
    ]
    semantic_cells[2] = "`center workbench / action plane`"
    semantic_cells[3] = "x"
    semantic_cells[4] = "A-LEARN, E-LEARN"
    semantic_cells[6] = "x"
    hollow_semantic_row = "| " + " | ".join(semantic_cells) + " |"

    audio_matrix_row = next(
        line for line in mapping_text.splitlines() if line.startswith("| PW-AUDIO-01 ")
    )
    audio_matrix_cells = [
        cell.strip() for cell in audio_matrix_row.strip().strip("|").split("|")
    ]
    for index in range(1, 5):
        audio_matrix_cells[index] = ""
    hollow_matrix_row = "| " + " | ".join(audio_matrix_cells) + " |"

    substituted_mapping = mapping_text.replace(
        "| `SHELL-01` | Cold launch |", "| `FAKE-01` | Cold launch |", 1
    )
    substituted_contract = contract_text.replace(
        "| `SHELL-01 Cold launch` |", "| `FAKE-01 Cold launch` |", 1
    )

    status_promoted = mapping_text.replace(
        "- Status: `design_only_pc_web_state_mapping`.",
        "- Status: `accepted_release_authority`.",
        1,
    )
    result_meaning_promoted = mapping_text.replace(
        "A relevant PC Web surface exists or has broad historical evidence, but no exact frozen v5 browser replay proves this row.",
        "This row proves PC Web parity and release readiness.",
        1,
    )
    completion_promoted = mapping_text.replace(
        "That validator result does not change any architecture, design, delivery, or release gate.",
        "That validator result passes CP-WEB and release readiness.",
        1,
    )
    release_claim_appended = mapping_text + "\nFormally passes release readiness.\n"
    cov_12_without_visual = mapping_text.replace(
        "A-VISUAL, A-SHELL, A-INPUT, E-FUTURE",
        "A-SHELL, A-INPUT, E-FUTURE",
        1,
    )

    mutations = (
        (
            "missing semantic row",
            mapping_text.replace(f"{semantic_row}\n", "", 1),
            contract_text,
            "semantic mapping is missing IDs",
        ),
        (
            "duplicate semantic row",
            mapping_text.replace(semantic_row, f"{semantic_row}\n{semantic_row}", 1),
            contract_text,
            "semantic mapping contains duplicate IDs",
        ),
        (
            "non-blocked result",
            mapping_text.replace(semantic_row, non_blocked_row, 1),
            contract_text,
            "uses invalid fail-closed result",
        ),
        (
            "unknown evidence code",
            mapping_text.replace("A-AUTH, E-AUTH, E-STATUS", "A-AUTH, Z-UNKNOWN", 1),
            contract_text,
            "cites unknown evidence codes",
        ),
        (
            "copied navigation composition",
            mapping_text.replace("`auth object`", "`bottom navigation`", 1),
            contract_text,
            "forbidden non-PC-Web composition term",
        ),
        (
            "missing execution row",
            mapping_text.replace(f"{screenreader_row}\n", "", 1),
            contract_text,
            "execution matrix is missing IDs",
        ),
        (
            "contract state substitution",
            substituted_mapping,
            substituted_contract,
            "Contract state ID/title identity changed",
        ),
        (
            "semantic hollowing",
            mapping_text.replace(semantic_row, hollow_semantic_row, 1),
            contract_text,
            "PC Web mapping identity changed",
        ),
        (
            "repository pointer escape",
            mapping_text.replace(
                "`docs/design/mapping/pc-web-core-implementation-evidence-v1.md#implemented-surface-mapping`",
                "`../outside-evidence.md`",
                1,
            ),
            contract_text,
            "repository pointer must be repository-relative without '..'",
        ),
        (
            "execution matrix hollowing",
            mapping_text.replace(audio_matrix_row, hollow_matrix_row, 1),
            contract_text,
            "Environment must not be empty",
        ),
        (
            "status promotion",
            status_promoted,
            contract_text,
            "PC Web document semantic identity changed",
        ),
        (
            "result meaning promotion",
            result_meaning_promoted,
            contract_text,
            "meaning changed from the fail-closed definition",
        ),
        (
            "completion promotion",
            completion_promoted,
            contract_text,
            "completion/nonpromotion boundary is missing",
        ),
        (
            "appended release claim",
            release_claim_appended,
            contract_text,
            "PC Web document semantic identity changed",
        ),
        (
            "COV-12 missing visual owner",
            cov_12_without_visual,
            contract_text,
            "COV-12 must cite A-VISUAL",
        ),
    )

    for name, mutant, mutant_contract, expected_error in mutations:
        mutant_errors = validate(mutant, mutant_contract)
        if not any(expected_error in error for error in mutant_errors):
            failures.append(
                f"self-test {name!r} did not produce expected error containing {expected_error!r}"
            )
    return failures


def main() -> None:
    args = parse_args()
    try:
        mapping_text = args.mapping.read_text(encoding="utf-8")
        contract_text = args.contract.read_text(encoding="utf-8")
    except OSError as error:
        print("PC WEB V5 STATE MAPPING VALIDATION FAILED")
        print(f"- {error}")
        raise SystemExit(1) from error

    errors = validate(mapping_text, contract_text)
    if args.self_test and not errors:
        errors.extend(run_self_tests(mapping_text, contract_text))

    if errors:
        print("PC WEB V5 STATE MAPPING VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    semantic_count = len(
        [item for item in parse_contract_states(contract_text) if not item[0].startswith("COV-")]
    )
    cov_count = len(
        [item for item in parse_contract_states(contract_text) if item[0].startswith("COV-")]
    )
    suffix = " + negative self-tests" if args.self_test else ""
    print(f"PC WEB V5 STATE MAPPING OK{suffix}")
    print(f"- semantic IDs: {semantic_count}")
    print(f"- forced COV IDs: {cov_count}")
    print(f"- execution rows: {len(REQUIRED_MATRIX_IDS)}")
    print("- mapping and execution results: fail-closed")


if __name__ == "__main__":
    main()
