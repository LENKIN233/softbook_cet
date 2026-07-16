from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Mapping


ROOT = Path(__file__).resolve().parents[2]
EXPORT_ROOT = ROOT / "exports" / "local-gates"
SCHEMA_VERSION = "local-gate-report.v1"
STATUS_VALUES = (
    "passed",
    "passed_with_exception",
    "failed",
    "skipped",
    "deferred",
)
PROFILES = ("dev", "pr", "release")
EXPECTED_PYTHON = (3, 12)
EXPECTED_NODE = "22.13.0"
EXPECTED_RUBY = (3, 3)


@dataclass(frozen=True)
class Options:
    profile: str
    base: str | None = None
    pr: int | None = None
    output: str | None = None
    verbose: bool = False
    fail_fast: bool = False


@dataclass(frozen=True)
class CommandSpec:
    argv: tuple[str, ...]
    cwd: Path = ROOT
    env: Mapping[str, str] = field(default_factory=dict)
    capture_output: bool = False


@dataclass(frozen=True)
class GateSpec:
    id: str
    profiles: frozenset[str]
    timeout_seconds: float
    network: bool
    command_factory: Callable[["RunContext"], CommandSpec] | None = None
    special: str | None = None
    requires_pr_context: bool = False
    stage: int = 10


@dataclass
class CommandResult:
    returncode: int
    duration_ms: int
    output: str = ""
    timed_out: bool = False
    start_error: str | None = None


@dataclass
class GateOutcome:
    status: str
    exit_code: int | None
    findings: list[dict] = field(default_factory=list)
    details: dict = field(default_factory=dict)


@dataclass
class RunContext:
    options: Options
    report_path: Path
    run_root: Path
    logs_dir: Path
    artifacts_dir: Path
    head: str
    branch: str
    before_snapshot: dict
    toolchain: dict = field(default_factory=dict)
    network_isolation: dict | None = None
    pr_context: dict | None = None
    pr_body: str | None = None
    safe_exceptions: list[dict] = field(default_factory=list)
