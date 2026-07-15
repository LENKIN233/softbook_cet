from __future__ import annotations

import json
import subprocess
import sys
import tempfile
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


def context_for_layer(*, layer: str, root: Path, mode: str, section: str):
    if layer == "delivery_governance_layer" and section == "delivery_runtime":
        return DeliveryContext(root=root, mode=mode, section=section)
    return ReadOnlyContext(root=root, mode=mode, section=section)
