from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
from contextlib import contextmanager
from pathlib import Path
from types import MappingProxyType
from typing import Any, Sequence


LITERAL_SOURCE_ANCHORS = MappingProxyType(
    {
        "login_gate": "必须登入",
        "primary_login_method": "手机号+验证码",
        "purchase_authority": "web与app购买同权",
        "top_level_navigation": "三端信息架构导航是一致的：学习 空间 统计 我的",
        "audio_presentation_policy": "不自动播放，没有字幕（背面可以有）",
        "default_learning_path": "建议用户按照我们拟定的顺序学习，不建议用户按模块学习",
    }
)
FIXTURE_VALIDATOR_ALLOWLIST = MappingProxyType(
    {
        "mobile_metadata_regressions": frozenset(
            {"apps/mobile/scripts/check-metadata-leaks.mjs"}
        ),
        "design_metadata_regressions": frozenset(
            {"scripts/check_design_metadata_leaks.mjs"}
        ),
        "design_search_regressions": frozenset(
            {"scripts/validate_design_search_run.py"}
        ),
        "agent_review_regressions": frozenset({"scripts/validate_agent_review.py"}),
        "pr_design_gate_regressions": frozenset({"scripts/validate_pr_design_gate.py"}),
    }
)
FIXTURE_MODULE_ALLOWLIST = MappingProxyType(
    {
        "pr_design_gate_regressions": frozenset({"scripts/validate_pr_design_gate.py"}),
    }
)
FIXTURE_SECTION_LAYERS = MappingProxyType(
    {
        "mobile_metadata_regressions": "design_governance_layer",
        "design_metadata_regressions": "design_governance_layer",
        "design_search_regressions": "design_governance_layer",
        "agent_review_regressions": "delivery_governance_layer",
        "pr_design_gate_regressions": "design_governance_layer",
    }
)


class CapabilityError(RuntimeError):
    pass


class ReadOnlyContext:
    __slots__ = ("_errors", "_mode", "_root", "_section")

    def __init__(self, *, root: Path, mode: str, section: str) -> None:
        self._root = root.resolve()
        self._mode = mode
        self._section = section
        self._errors: list[str] = []

    @property
    def root(self) -> Path:
        return self._root

    @property
    def spec(self) -> Path:
        return self._root / "spec"

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def section(self) -> str:
        return self._section

    @property
    def runtime_profile(self) -> str:
        return "read_only"

    @property
    def errors(self) -> list[str]:
        return self._errors

    @property
    def remote_guard_executed(self) -> bool:
        return False

    @property
    def literal_source_anchors(self) -> MappingProxyType[str, str]:
        return LITERAL_SOURCE_ANCHORS

    def anchor_texts(self, *keys: str) -> list[str]:
        return [LITERAL_SOURCE_ANCHORS[key] for key in keys]

    def load(self, name: str) -> Any:
        path = (self.spec / name).resolve()
        if path.parent != self.spec.resolve():
            raise CapabilityError(f"spec path escapes spec root: {name}")
        return json.loads(path.read_text(encoding="utf-8"))

    def check_equal(self, label: str, expected: Any, actual: Any) -> None:
        if expected != actual:
            self._errors.append(f"{label}: expected {expected!r}, got {actual!r}")

    def check_contains(self, label: str, text: str, expected: str) -> None:
        if expected not in text:
            self._errors.append(f"{label}: missing exact snippet {expected!r}")

    def find_by_id(self, entries: Sequence[dict[str, Any]], entry_id: str) -> Any:
        for entry in entries:
            if entry["id"] == entry_id:
                return entry

        self._errors.append(f"missing entry id: {entry_id}")
        return None


class DeliveryContext(ReadOnlyContext):
    __slots__ = ("_remote_guard_executed",)

    def __init__(self, *, root: Path, mode: str, section: str) -> None:
        super().__init__(root=root, mode=mode, section=section)
        self._remote_guard_executed = False

    @property
    def remote_guard_executed(self) -> bool:
        return self._remote_guard_executed

    @property
    def runtime_profile(self) -> str:
        return "delivery"

    def mark_remote_guard_executed(self) -> None:
        if self.mode != "full":
            raise CapabilityError("remote guard cannot execute outside full mode")
        self._remote_guard_executed = True

    def temporary_directory(self):
        return tempfile.TemporaryDirectory(prefix="softbook-harness-delivery-")

    def run_command(self, *args: str):
        self._validate_read_command(args)
        try:
            return subprocess.run(
                args,
                cwd=self.root,
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            self.errors.append(f"missing required command: {args[0]}")
            return None

    def _validate_read_command(self, args: Sequence[str]) -> None:
        if not args:
            raise CapabilityError("empty command is not allowed")

        executable = args[0]
        if executable == "git":
            allowed_git_commands = {
                ("git", "rev-parse", "--git-dir"),
                ("git", "config", "--worktree", "--path", "--get", "core.hooksPath"),
                ("git", "symbolic-ref", "--quiet", "--short", "HEAD"),
                ("git", "status", "--porcelain"),
            }
            if tuple(args) not in allowed_git_commands:
                raise CapabilityError(f"delivery Git command is not read-only: {args!r}")
            return

        if executable == "gh":
            if self.mode != "full":
                raise CapabilityError("GitHub command cannot execute outside full mode")
            mutating_flags = {"--method", "-X", "--input", "-f", "-F"}
            if len(args) != 3 or args[1] != "api" or mutating_flags.intersection(args):
                raise CapabilityError(f"delivery GitHub command is not a simple GET: {args!r}")
            return

        if Path(executable).resolve() == Path(sys.executable).resolve():
            if len(args) < 2:
                raise CapabilityError("delivery Python command must name a validator")
            script = Path(args[1]).resolve()
            allowed = (self.root / "scripts" / "validate_maestro_selectors.py").resolve()
            if script != allowed:
                raise CapabilityError(f"delivery Python validator is not allowlisted: {script}")
            return

        raise CapabilityError(f"delivery command is not allowlisted: {args!r}")


class FixtureContext(ReadOnlyContext):
    __slots__ = ("_fixture_roots",)

    def __init__(self, *, root: Path, mode: str, section: str) -> None:
        super().__init__(root=root, mode=mode, section=section)
        self._fixture_roots: set[Path] = set()

    @property
    def runtime_profile(self) -> str:
        return "fixture"

    @contextmanager
    def temporary_directory(self, *, prefix: str):
        safe_prefix = "".join(character for character in prefix if character.isalnum() or character in "-_")
        if not safe_prefix:
            raise CapabilityError("fixture prefix must contain a safe character")

        with tempfile.TemporaryDirectory(prefix=f"softbook-{safe_prefix}-") as tmpdir:
            fixture_root = Path(tmpdir).resolve()
            self._fixture_roots.add(fixture_root)
            try:
                yield fixture_root
            finally:
                self._fixture_roots.discard(fixture_root)

    def run_validator(
        self,
        relative_script: str,
        *args: str,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
    ):
        script = self._validate_script(relative_script, FIXTURE_VALIDATOR_ALLOWLIST)
        resolved_cwd = self.root if cwd is None else Path(cwd).resolve()
        if resolved_cwd != self.root and not self._is_fixture_path(resolved_cwd):
            raise CapabilityError(f"validator cwd is outside repository and fixture roots: {resolved_cwd}")

        overrides = {
            key: self.normalize_fixture_text(value) if key == "PR_BODY" else value
            for key, value in (env or {}).items()
        }
        unexpected_env = set(overrides) - {"PR_BODY"}
        if unexpected_env:
            raise CapabilityError(
                f"validator environment contains non-allowlisted keys: {sorted(unexpected_env)!r}"
            )

        command = ["node", str(script)] if script.suffix == ".mjs" else [sys.executable, str(script)]
        command.extend(str(argument) for argument in args)
        try:
            return subprocess.run(
                command,
                cwd=resolved_cwd,
                capture_output=True,
                text=True,
                check=False,
                env={**os.environ, **overrides},
            )
        except FileNotFoundError as exc:
            raise CapabilityError(f"missing validator runtime: {command[0]}") from exc

    def normalize_fixture_text(self, value: str) -> str:
        return textwrap.dedent(value)

    def fixture_path(self, path: Path) -> Path:
        return self._require_fixture_path(path)

    def load_validator_module(self, relative_script: str):
        script = self._validate_script(relative_script, FIXTURE_MODULE_ALLOWLIST)
        module_name = f"softbook_fixture_{self.section}_{os.getpid()}"
        module_spec = importlib.util.spec_from_file_location(module_name, script)
        if module_spec is None or module_spec.loader is None:
            raise CapabilityError(f"unable to load validator module: {relative_script}")
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        return module

    def copy_fixture_file(self, source: Path, destination: Path) -> None:
        destination = self._require_fixture_path(destination)
        source = Path(source).resolve()
        if source != self.root and self.root not in source.parents:
            raise CapabilityError(f"fixture copy source is outside repository: {source}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)

    def remove_fixture_tree(self, path: Path) -> None:
        shutil.rmtree(self._require_fixture_path(path))

    def _validate_script(self, relative_script: str, allowlist) -> Path:
        allowed = allowlist.get(self.section, frozenset())
        if relative_script not in allowed:
            raise CapabilityError(
                f"validator is not allowlisted for {self.section}: {relative_script}"
            )
        script = (self.root / relative_script).resolve()
        if self.root not in script.parents or not script.is_file():
            raise CapabilityError(f"allowlisted validator is missing or outside repository: {script}")
        return script

    def _is_fixture_path(self, path: Path) -> bool:
        return any(path == fixture_root or fixture_root in path.parents for fixture_root in self._fixture_roots)

    def _require_fixture_path(self, path: Path) -> Path:
        resolved = Path(path).resolve()
        if not self._is_fixture_path(resolved):
            raise CapabilityError(f"path is outside active fixture roots: {resolved}")
        return resolved


def context_for_layer(*, layer: str, root: Path, mode: str, section: str):
    if layer == "delivery_governance_layer" and section == "delivery_runtime":
        return DeliveryContext(root=root, mode=mode, section=section)
    if FIXTURE_SECTION_LAYERS.get(section) == layer:
        return FixtureContext(root=root, mode=mode, section=section)
    return ReadOnlyContext(root=root, mode=mode, section=section)
