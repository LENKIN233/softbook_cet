#!/usr/bin/env python3
"""Check references in optional design-comparison bundles, not design quality.

Existing bundle filenames and CLI remain supported. No population size, search
lifecycle, style vocabulary, promotion, or separate implementation PR is required.
Only comparisons and decisions actually recorded are checked for coherent claims.
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import quote, unquote, urlsplit, urlunsplit

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SEARCH_ROOT = ROOT / "docs/design/search-runs"
CANDIDATE_LIKE_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9_.-]*-\d+\b")
URL_RE = re.compile(r"https?://[^\s`'\"),;<>]+", re.IGNORECASE)
FILE_RE = re.compile(r"[^\s`\"\'<>(),;]+\.(?:html|svg|png|jpg|jpeg|webp|md)(?:[?#][^\s`\"\'<>(),;]*)?", re.IGNORECASE)
REFERENCE_SUFFIXES = {".html", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".md"}
MISSING_VALUES = {"", "n/a", "na", "none", "null", "tbd", "todo", "不适用", "无"}


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return f"<fixture>/{path.name}"


def section_body(text: str, heading: str) -> str | None:
    match = re.search(rf"(?ms)^{re.escape(heading)}\s*$\n(.*?)(?=^##\s+|\Z)", text)
    return match.group(1).strip() if match else None


def line_value(text: str, label: str) -> str | None:
    match = re.search(rf"(?im)^\s*-?\s*{re.escape(label)}\s*:\s*(.+?)\s*$", text)
    return match.group(1).strip() if match else None


def has_concrete_text(value: str | None) -> bool:
    value = re.sub(r"<!--.*?-->", "", value or "", flags=re.DOTALL).strip()
    return value.lower() not in MISSING_VALUES and bool(re.search(r"[A-Za-z0-9\u4e00-\u9fff]", value))


def known_refs(value: str | None, candidates: set[str]) -> set[str]:
    return {key for key in candidates if re.search(rf"(?<![\w.-]){re.escape(key)}(?![\w.-])", value or "")}


def unknown_refs(value: str | None, candidates: set[str]) -> set[str]:
    return set(CANDIDATE_LIKE_RE.findall(value or "")) - candidates


def is_evidence_reference(value: str) -> bool:
    try:
        parts = urlsplit(value)
        return parts.scheme in {"http", "https"} or Path(unquote(parts.path)).suffix.lower() in REFERENCE_SUFFIXES
    except ValueError:
        return False


def markdown_destination(value: str) -> str:
    value = value.strip()
    if value.startswith("<") and ">" in value:
        value = value[1:value.index(">")]
    else:
        value = re.sub(r"\s+[\"'][^\"']*[\"']\s*$", "", value).strip()
    return re.sub(r"\\([\\`()\[\]<>])", r"\1", value)


def evidence_refs(value: str | None, *, record_text: str | None = None) -> set[str]:
    """Read Markdown destinations and code spans before scanning plain refs.

    Keep the complete filename and fragment, including Unicode and spaces; never
    reinterpret part of a formatted reference as a second local filename.
    Reference definitions can live outside the evidence section in the record.
    """
    text = value or ""
    refs = set()
    definition_re = re.compile(r"(?m)^ {0,3}\[([^]\n]+)\]:[ \t]*(.+)$")
    normalize_label = lambda label: re.sub(r"\s+", " ", label).strip().casefold()
    definitions = {
        normalize_label(match.group(1)): markdown_destination(match.group(2))
        for match in definition_re.finditer(record_text if record_text is not None else text)
    }
    text = definition_re.sub(" ", text)

    # Match the outer link delimiter while retaining balanced parentheses in its
    # destination. Angle destinations and escaped parentheses are also valid.
    parts = []
    cursor = 0
    for match in re.finditer(r"!?\[[^]\n]*\]\(", text):
        if match.start() < cursor:
            continue
        depth, angle, escaped = 1, False, False
        for end in range(match.end(), len(text)):
            char = text[end]
            if escaped:
                escaped = False
                continue
            if char == "\\":
                escaped = True
            elif char == "<":
                angle = True
            elif char == ">":
                angle = False
            elif not angle and char == "(":
                depth += 1
            elif not angle and char == ")":
                depth -= 1
                if depth == 0:
                    target = markdown_destination(text[match.end():end])
                    if is_evidence_reference(target):
                        refs.add(target)
                    parts.extend((text[cursor:match.start()], " "))
                    cursor = end + 1
                    break
            elif char == "\n":
                break
    text = "".join(parts) + text[cursor:]

    def reference_link(match):
        label = match.group(2) or match.group(1)
        target = definitions.get(normalize_label(label))
        if target and is_evidence_reference(target):
            refs.add(target)
        return " "

    text = re.sub(r"!?\[([^]\n]+)\](?:\[([^]\n]*)\])?", reference_link, text)

    def delimited(match):
        target = match.group(1).strip()
        if is_evidence_reference(target):
            refs.add(target)
        return " "

    text = re.sub(r"`([^`\n]+)`", delimited, text)
    text = re.sub(r"<([^>\n]+)>", delimited, text)
    for line in text.splitlines():
        for part in re.split(r"\s+and\s+|[,;；，]", line):
            raw = re.sub(r"^\s*[-*]\s+", "", part).strip().rstrip("。.")
            # A whole line/field may be an unquoted filename with spaces.
            path_at_start = "/" not in raw or bool(re.match(r"^(?:[./]|[^/\s:]+/|https?://)", raw))
            if raw and path_at_start and is_evidence_reference(raw) and not re.search(r"\s(?:in|for|from|is|and)\s", raw):
                refs.add(raw)
            else:
                urls = set(URL_RE.findall(raw))
                refs.update(urls)
                refs.update(FILE_RE.findall(URL_RE.sub("", raw)))
    return refs


def canonical_ref(run_dir: Path, ref: str, record: Path) -> str:
    parts = urlsplit(ref)
    if parts.scheme in {"http", "https"}:
        return ref
    filename = unquote(parts.path)
    if filename.startswith("docs/"):
        path = ROOT / filename
    elif filename.startswith(("../", "./")):
        path = record.parent / filename
    else:
        path = run_dir / filename
    base = urlsplit(path.resolve().as_uri())
    return urlunsplit((base.scheme, base.netloc, base.path, parts.query, quote(unquote(parts.fragment), safe="")))


class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.anchors = set()

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {"id", "name"} and value is not None:
                self.anchors.add(value)

    handle_startendtag = handle_starttag


def checked_evidence(errors: list[str], record: Path, run_dir: Path, value: str | None) -> set[str]:
    refs = set()
    record_text = record.read_text(encoding="utf-8")
    for ref in evidence_refs(value, record_text=record_text):
        canonical = canonical_ref(run_dir, ref, record)
        parts = urlsplit(canonical)
        if parts.scheme == "file":
            path = Path(unquote(parts.path))
            if not path.is_file():
                errors.append(f"{rel(record)} references missing evidence: {ref}")
                continue
            if parts.fragment and path.suffix.lower() in {".html", ".svg"}:
                parser = AnchorParser()
                parser.feed(path.read_text(encoding="utf-8"))
                if unquote(parts.fragment) not in parser.anchors:
                    errors.append(f"{rel(record)} references missing evidence anchor: {ref}")
                    continue
            elif parts.fragment:
                # A fragment on an image/prose file is not a verified distinct
                # candidate view. Preserve file/query identity for binding.
                canonical = urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))
        refs.add(canonical)
    return refs


def without_fragment(ref: str) -> str:
    parts = urlsplit(ref)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))


def bound_evidence(evidence: set[str], candidate: str, proofs: dict[str, set[str]]) -> set[str]:
    declared = proofs[candidate]
    bound = evidence & declared
    # An entire uniquely owned HTML file covers its declared candidate anchor.
    # A shared file needs the exact candidate fragment, and query state remains
    # part of identity. Parent directory names never bind candidate evidence.
    for actual in evidence:
        for expected in declared:
            if without_fragment(actual) != without_fragment(expected):
                continue
            if urlsplit(actual).fragment and urlsplit(expected).fragment:
                continue
            owners = {key for key, refs in proofs.items() if any(without_fragment(ref) == without_fragment(actual) for ref in refs)}
            if owners == {candidate}:
                bound.add(actual)
    return bound


def candidate_evidence(text: str) -> str:
    return "\n".join(filter(None, (
        line_value(text, "Artifact"), line_value(text, "Screenshots"), section_body(text, "## Visual Evidence"),
    )))


def primary_candidate(value: str | None, candidates: set[str]) -> str | None:
    # Winning Candidate names one selected design. Later borrowed fragments do
    # not change that identity, and cannot rescue an unknown primary selection.
    clause = re.split(r"\.\s|[;。；\n]|\bborrow(?:s|ed|ing)?\b|借用|吸取", value or "", maxsplit=1, flags=re.IGNORECASE)[0]
    explicit = re.match(r"^\s*[`'\"]?([\w]+(?:[-.][\w]+)+)", clause)
    if explicit:
        return explicit.group(1)
    refs = known_refs(clause, candidates)
    return min(refs, key=clause.find) if refs else None


def is_system_fixture_run(run_dir: Path) -> bool:
    try:
        relative = run_dir.resolve().relative_to(Path(tempfile.gettempdir()).resolve())
    except ValueError:
        return False
    return bool(relative.parts and relative.parts[0].startswith("softbook-"))


def validate_run(errors: list[str], run_dir: Path, *, allow_external_fixture: bool = False) -> None:
    run_dir = run_dir.resolve()
    if ROOT not in run_dir.parents and (not allow_external_fixture or not is_system_fixture_run(run_dir)):
        errors.append(f"search run is outside repository: {run_dir}")
        return
    if not run_dir.is_dir():
        errors.append(f"missing search run: {rel(run_dir)}")
        return
    context = run_dir / "context-pack.md"
    if not context.is_file() or not has_concrete_text(context.read_text(encoding="utf-8")):
        errors.append(f"{rel(run_dir)} needs a context-pack.md stating the task and comparison scope")

    records = {}
    proofs = {}
    for path in sorted((run_dir / "candidates").glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        text = path.read_text(encoding="utf-8")
        candidate = path.stem
        declared = section_body(text, "## Candidate ID")
        if declared and declared.strip("`'\"") != candidate:
            errors.append(f"{rel(path)} Candidate ID must match filename stem {candidate!r}")
        if not has_concrete_text(text):
            errors.append(f"{rel(path)} candidate record is empty")
        records[candidate] = text
        proofs[candidate] = checked_evidence(errors, path, run_dir, candidate_evidence(text))
        source_context = line_value(text, "Source context pack")
        if source_context:
            checked_evidence(errors, path, run_dir, source_context)
    candidates = set(records)
    if not candidates:
        errors.append(f"{rel(run_dir)} needs at least one candidate record; there is no fixed population quota")

    rejected = set()
    hard_filter = run_dir / "hard-filter-results.md"
    if hard_filter.is_file():
        text = hard_filter.read_text(encoding="utf-8")
        surviving_body = section_body(text, "## Surviving Candidates")
        rejected_body = section_body(text, "## Rejected Candidates")
        surviving = known_refs(surviving_body, candidates)
        rejected = known_refs(rejected_body, candidates)
        unknown = unknown_refs(surviving_body, candidates) | unknown_refs(rejected_body, candidates)
        if unknown:
            errors.append(f"{rel(hard_filter)} references unknown candidates: {', '.join(sorted(unknown))}")
        if surviving & rejected:
            errors.append(f"{rel(hard_filter)} cannot mark the same candidate surviving and rejected")

    for path in sorted((run_dir / "pairwise-reviews").glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        text = path.read_text(encoding="utf-8")
        pair = []
        for label in ("Candidate A", "Candidate B"):
            value = line_value(text, label)
            refs = known_refs(value, candidates)
            if len(refs) != 1 or unknown_refs(value, candidates):
                errors.append(f"{rel(path)} {label} must name one known candidate")
            else:
                pair.append(next(iter(refs)))
        if len(pair) != 2:
            continue
        if pair[0] == pair[1]:
            errors.append(f"{rel(path)} must compare two different candidates")
        evidence = checked_evidence(errors, path, run_dir, section_body(text, "## Visual Evidence"))
        if not evidence:
            errors.append(f"{rel(path)} claimed comparison is missing visual evidence")
        bound = {}
        for candidate in pair:
            bound[candidate] = bound_evidence(evidence, candidate, proofs)
            if not bound[candidate]:
                errors.append(f"{rel(path)} visual evidence does not match compared candidate {candidate}")
        if bound[pair[0]] and bound[pair[1]] and bound[pair[0]] == bound[pair[1]]:
            errors.append(f"{rel(path)} shared evidence must distinguish both candidates with separate files or anchors")
        winner = section_body(text, "## Winner")
        winner_refs = known_refs(winner, candidates)
        decision = (winner or "").strip().lower().strip("`'\"")
        if decision in {"a", "candidate a"}:
            winner_refs = {pair[0]}
        elif decision in {"b", "candidate b"}:
            winner_refs = {pair[1]}
        inconclusive = re.search(r"no winner|inconclusive|undecided|no preference|\btie\b|无胜者|无法判断|未决|暂不选择|无明显优劣|持平", decision)
        if not has_concrete_text(winner):
            errors.append(f"{rel(path)} comparison needs a decision, including an inconclusive result when appropriate")
        elif unknown_refs(winner, candidates) or (winner_refs and not winner_refs <= set(pair)) or (not winner_refs and not inconclusive):
            errors.append(f"{rel(path)} winner must be one of the compared candidates or an inconclusive decision")
        if not has_concrete_text(section_body(text, "## Rationale")):
            errors.append(f"{rel(path)} comparison needs its observed rationale and relevant limits")

    promotion = run_dir / "promotion-record.md"
    if promotion.is_file():
        text = promotion.read_text(encoding="utf-8")
        winning = section_body(text, "## Winning Candidate")
        selected = primary_candidate(winning, candidates)
        if selected not in candidates or unknown_refs(winning, candidates):
            errors.append(f"{rel(promotion)} selection must name an existing candidate")
        if selected in rejected:
            errors.append(f"{rel(promotion)} selection cannot claim a rejected candidate passed")
        promoted_proof = checked_evidence(errors, promotion, run_dir, section_body(text, "## Rendered Proof"))
        if not promoted_proof:
            errors.append(f"{rel(promotion)} claimed rendered result is missing referenced evidence")
        if selected in candidates:
            if not bound_evidence(promoted_proof, selected, proofs):
                errors.append(f"{rel(promotion)} rendered evidence does not match selected candidate {selected}")
        decision = section_body(text, "## Baseline Comparison") or section_body(text, "## Rationale")
        if not has_concrete_text(decision):
            errors.append(f"{rel(promotion)} selection needs its task-relevant rationale; no fixed baseline is required")


def discover_run_dirs(explicit_runs: list[str]) -> list[Path]:
    if explicit_runs:
        return [(ROOT / path).resolve() for path in explicit_runs]
    if not SEARCH_ROOT.is_dir():
        return []
    return [path for path in sorted(SEARCH_ROOT.iterdir()) if path.is_dir() and path.name != "templates"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="append", default=[], help="optional recorded bundle to check; may be repeated")
    parser.add_argument("--skip-templates", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--allow-external-fixture", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    errors = []
    for run_dir in discover_run_dirs(args.run):
        validate_run(errors, run_dir, allow_external_fixture=args.allow_external_fixture)
    if errors:
        print("DESIGN COMPARISON RECORD FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print("DESIGN COMPARISON RECORD OK — reference integrity only, not a product-quality verdict")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
