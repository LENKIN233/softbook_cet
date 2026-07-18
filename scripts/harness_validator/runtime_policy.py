from __future__ import annotations

import os
import sys
from contextlib import contextmanager


READ_ONLY_ALLOWED_IMPORTS = frozenset({"__future__", "json", "re"})
FILESYSTEM_MUTATION_EVENTS = frozenset(
    {
        "os.chmod",
        "os.chown",
        "os.link",
        "os.mkdir",
        "os.remove",
        "os.rename",
        "os.rmdir",
        "os.symlink",
        "os.truncate",
        "os.unlink",
        "shutil.copyfile",
        "shutil.copymode",
        "shutil.copystat",
        "shutil.move",
        "shutil.rmtree",
    }
)
PROCESS_EVENTS = frozenset(
    {
        "os.exec",
        "os.fork",
        "os.forkpty",
        "os.posix_spawn",
        "os.spawn",
        "os.system",
        "pty.spawn",
        "subprocess.Popen",
    }
)
DYNAMIC_CODE_EVENTS = frozenset({"compile", "exec"})
WRITE_OPEN_FLAGS = (
    os.O_APPEND
    | os.O_CREAT
    | os.O_RDWR
    | os.O_TRUNC
    | os.O_WRONLY
)


class RuntimeCapabilityError(RuntimeError):
    pass


class ReadOnlyRuntimePolicy:
    def __init__(self) -> None:
        self._active = False
        sys.addaudithook(self._audit)

    @contextmanager
    def enforce(self):
        self._active = True
        try:
            yield
        finally:
            self._active = False

    def _audit(self, event: str, args: tuple[object, ...]) -> None:
        if not self._active:
            return

        if event == "open" and self._is_write_open(args):
            raise RuntimeCapabilityError("read-only Harness section attempted a file write")
        if event in FILESYSTEM_MUTATION_EVENTS:
            raise RuntimeCapabilityError(
                f"read-only Harness section attempted filesystem mutation: {event}"
            )
        if event in PROCESS_EVENTS or event.startswith("os.spawn"):
            raise RuntimeCapabilityError(
                f"read-only Harness section attempted process execution: {event}"
            )
        if event.startswith("socket."):
            raise RuntimeCapabilityError(
                f"read-only Harness section attempted network access: {event}"
            )
        if event in DYNAMIC_CODE_EVENTS:
            raise RuntimeCapabilityError(
                f"read-only Harness section attempted dynamic code execution: {event}"
            )
        if event == "import" and args:
            root = str(args[0]).split(".", 1)[0]
            if root not in READ_ONLY_ALLOWED_IMPORTS:
                raise RuntimeCapabilityError(
                    f"read-only Harness section attempted non-allowlisted import: {root}"
                )

    @staticmethod
    def _is_write_open(args: tuple[object, ...]) -> bool:
        mode = args[1] if len(args) > 1 else None
        flags = args[2] if len(args) > 2 else None
        if isinstance(mode, str) and any(character in mode for character in "wax+"):
            return True
        return isinstance(flags, int) and bool(flags & WRITE_OPEN_FLAGS)


class NullRuntimePolicy:
    @contextmanager
    def enforce(self):
        yield


def policy_for_context(context):
    if context.runtime_profile == "read_only":
        return ReadOnlyRuntimePolicy()
    return NullRuntimePolicy()
