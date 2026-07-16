from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Mapping, Sequence

from .model import CommandResult, CommandSpec, GateOutcome, ROOT, RunContext


SENSITIVE_KEY_RE = re.compile(
    r"(?i)(?:^|[_-])(?:auth(?:orization)?|cookie|credential|key|pass(?:word|wd)?|secret|session|token)(?:$|[_-])"
)
SENSITIVE_FLAG_RE = re.compile(
    r"(?i)^--?(?:auth(?:orization)?|cookie|credential|key|pass(?:word|wd)?|secret|session|token)(?:=|$)"
)
SENSITIVE_ENV_KEYS = {"PR_BODY"}
NETWORK_ENV_KEYS = {
    "ALL_PROXY",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
    "all_proxy",
    "https_proxy",
    "http_proxy",
    "no_proxy",
}
ASSIGNMENT_RE = re.compile(
    r"(?i)\b(auth(?:orization)?|cookie|credential|api[_-]?key|pass(?:word|wd)?|secret|session|token)"
    r"(\s*[:=]\s*)([^\s,;]+)"
)
BEARER_RE = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
TOKEN_RE = re.compile(
    r"\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|"
    r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b"
)


def redact_assignment(match: re.Match[str]) -> str:
    key, separator, value = match.groups()
    if key == "PASS" and ":" in separator and value in {"No", "OK"}:
        return match.group(0)
    return f"{key}{separator}[REDACTED]"


def is_sensitive_key(key: str) -> bool:
    return key.upper() in SENSITIVE_ENV_KEYS or bool(SENSITIVE_KEY_RE.search(key))


class Redactor:
    def __init__(self, environment: Mapping[str, str] | None = None):
        environment = environment or {}
        secret_values = set()
        for key, value in environment.items():
            if not value or not is_sensitive_key(key):
                continue
            secret_values.add(value)
            if "\n" in value:
                secret_values.update(line for line in value.splitlines() if len(line) >= 4)
        self.secret_values = sorted(secret_values, key=len, reverse=True)

    def text(self, value: str) -> str:
        redacted = value
        for secret in self.secret_values:
            redacted = redacted.replace(secret, "[REDACTED]")
        redacted = BEARER_RE.sub("Bearer [REDACTED]", redacted)
        redacted = TOKEN_RE.sub("[REDACTED]", redacted)
        return ASSIGNMENT_RE.sub(redact_assignment, redacted)

    def arguments(self, arguments: Sequence[str]) -> list[str]:
        safe: list[str] = []
        redact_next = False
        for argument in arguments:
            if redact_next:
                safe.append("[REDACTED]")
                redact_next = False
                continue
            if SENSITIVE_FLAG_RE.match(argument):
                if "=" in argument:
                    safe.append(f"{argument.split('=', 1)[0]}=[REDACTED]")
                else:
                    safe.append(argument)
                    redact_next = True
                continue
            safe.append(self.text(argument))
        return safe


def git_output(arguments: Sequence[str], *, cwd: Path = ROOT) -> str:
    result = subprocess.run(
        ["git", *arguments],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(arguments)} failed")
    return result.stdout.strip()


def tracked_snapshot(*, cwd: Path = ROOT) -> dict:
    head = git_output(["rev-parse", "HEAD"], cwd=cwd)
    status = git_output(
        ["status", "--porcelain=v1", "--untracked-files=no"],
        cwd=cwd,
    )
    unstaged = git_output(["diff", "--binary", "--no-ext-diff"], cwd=cwd)
    staged = git_output(
        ["diff", "--cached", "--binary", "--no-ext-diff"],
        cwd=cwd,
    )
    digest = hashlib.sha256(
        "\0".join((head, status, unstaged, staged)).encode("utf-8")
    ).hexdigest()
    return {
        "head": head,
        "digest": digest,
        "dirty_entries": [line for line in status.splitlines() if line],
    }


def relative_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def safe_environment_record(environment: Mapping[str, str]) -> dict:
    sensitive = sorted(key for key in environment if is_sensitive_key(key))
    return {
        "ci": environment.get("CI", "").lower() in {"1", "true", "yes"},
        "github_actions": environment.get("GITHUB_ACTIONS", "").lower()
        == "true",
        "sensitive_variables_present": sensitive,
        "sensitive_values": "[REDACTED]" if sensitive else None,
    }


def command_environment(*, network_allowed: bool) -> dict[str, str]:
    environment = dict(os.environ)
    if not network_allowed:
        for key in list(environment):
            if is_sensitive_key(key) or key in NETWORK_ENV_KEYS:
                environment.pop(key, None)
        environment["SOFTBOOK_LOCAL_GATES_NETWORK"] = "disabled"
        environment["npm_config_offline"] = "true"
    return environment


def network_isolation_prefix(cwd: Path) -> tuple[str, ...] | None:
    system = platform.system()
    if system == "Darwin" and Path("/usr/bin/sandbox-exec").exists():
        return (
            "/usr/bin/sandbox-exec",
            "-p",
            "(version 1) (allow default) (deny network-outbound)",
        )
    if system == "Linux" and shutil.which("bwrap"):
        return (
            str(shutil.which("bwrap")),
            "--unshare-net",
            "--bind",
            "/",
            "/",
            "--chdir",
            str(cwd),
            "--",
        )
    return None


def evaluate_network_isolation(context: RunContext) -> GateOutcome:
    prefix = network_isolation_prefix(ROOT)
    if prefix is None:
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "network_isolation_unavailable",
                    "message": "no supported OS network-isolation mechanism is available",
                }
            ],
        )
    try:
        probe = subprocess.run(
            (*prefix, sys.executable, "-c", "pass"),
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "network_isolation_unavailable",
                    "message": f"network-isolation probe failed: {error}",
                }
            ],
        )
    if probe.returncode != 0:
        return GateOutcome(
            status="failed",
            exit_code=1,
            findings=[
                {
                    "type": "network_isolation_unavailable",
                    "message": "network-isolation mechanism could not start a local process",
                }
            ],
        )
    mechanism = "sandbox-exec" if platform.system() == "Darwin" else "bubblewrap"
    context.network_isolation = {
        "mechanism": mechanism,
        "outbound_network": "denied_for_network_false_gates",
        "probe": "passed",
    }
    return GateOutcome(
        status="passed",
        exit_code=0,
        details={"network_isolation": context.network_isolation},
    )


def isolate_command(context: RunContext, command: CommandSpec) -> CommandSpec:
    prefix = network_isolation_prefix(command.cwd)
    if context.network_isolation is None or prefix is None:
        raise RuntimeError("network isolation is unavailable for a network=false gate")
    return CommandSpec(
        argv=(*prefix, *command.argv),
        cwd=command.cwd,
        env=command.env,
        capture_output=command.capture_output,
    )


def write_log(path: Path, text: str, *, environment: Mapping[str, str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    redactor = Redactor(environment)
    path.write_text(redactor.text(text), encoding="utf-8")


def execute_command(
    command: CommandSpec,
    *,
    timeout_seconds: float,
    log_path: Path,
    verbose: bool,
    ambient_environment: Mapping[str, str] | None = None,
) -> CommandResult:
    ambient = dict(ambient_environment or os.environ)
    environment = {**ambient, **command.env}
    redactor = Redactor(environment)
    safe_arguments = redactor.arguments(command.argv)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    captured: list[str] = []
    started = time.monotonic()

    with log_path.open("w", encoding="utf-8") as log:
        log.write(f"command: {json.dumps(safe_arguments, ensure_ascii=True)}\n")
        log.write(f"cwd: {relative_path(command.cwd)}\n")
        if command.env:
            for key in sorted(command.env):
                value = "[REDACTED]" if is_sensitive_key(key) else redactor.text(command.env[key])
                log.write(f"env: {key}={value}\n")
        log.write("--- output ---\n")
        log.flush()

        try:
            process = subprocess.Popen(
                command.argv,
                cwd=command.cwd,
                env=environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                start_new_session=True,
                bufsize=1,
            )
        except OSError as error:
            message = redactor.text(str(error))
            log.write(f"unable to start command: {message}\n")
            return CommandResult(
                returncode=127,
                duration_ms=int((time.monotonic() - started) * 1000),
                start_error=message,
            )

        def consume_output() -> None:
            assert process.stdout is not None
            for line in iter(process.stdout.readline, ""):
                safe_line = redactor.text(line)
                log.write(safe_line)
                log.flush()
                if command.capture_output:
                    captured.append(safe_line)
                if verbose:
                    print(safe_line, end="", flush=True)
            process.stdout.close()

        reader = threading.Thread(target=consume_output, daemon=True)
        reader.start()
        timed_out = False
        try:
            process.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=2)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()
            log.write(f"\ncommand timed out after {timeout_seconds:g} seconds\n")
        reader.join(timeout=5)
        if reader.is_alive():
            log.write("\noutput reader did not terminate cleanly\n")

    return CommandResult(
        returncode=124 if timed_out else process.returncode,
        duration_ms=int((time.monotonic() - started) * 1000),
        output="".join(captured),
        timed_out=timed_out,
    )


def command_outcome(result: CommandResult) -> GateOutcome:
    if result.start_error:
        return GateOutcome(
            status="failed",
            exit_code=result.returncode,
            findings=[
                {
                    "type": "missing_toolchain",
                    "message": f"command could not start: {result.start_error}",
                }
            ],
        )
    if result.timed_out:
        return GateOutcome(
            status="failed",
            exit_code=result.returncode,
            findings=[
                {
                    "type": "timeout",
                    "message": "gate command exceeded its explicit timeout",
                }
            ],
        )
    if result.returncode != 0:
        return GateOutcome(
            status="failed",
            exit_code=result.returncode,
            findings=[
                {
                    "type": "command_failure",
                    "message": f"gate command exited with code {result.returncode}; see redacted log",
                }
            ],
        )
    return GateOutcome(status="passed", exit_code=0)


def version_output(arguments: Sequence[str]) -> str | None:
    try:
        result = subprocess.run(
            arguments,
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return (result.stdout or result.stderr).strip()
