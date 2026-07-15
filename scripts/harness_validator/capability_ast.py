from __future__ import annotations

import ast
from pathlib import Path


PURE_LAYER_IDS = {
    "bootstrap_layer",
    "truth_spec_layer",
    "workspace_hygiene_layer",
}
READ_ONLY_SECTIONS = {
    "prelude",
    "truth_mirrors",
    "harness_architecture",
    "product_contract_mirrors",
    "visual_language",
    "workspace_boundary",
    "governance_contracts",
    "agent_run_record",
}
LEGACY_SECTIONS = {"design_governance"}
DESIGN_LAYER_ID = "design_governance_layer"
RUNTIME_SMOKE_LAYER_ID = "runtime_smoke_layer"
FORBIDDEN_PURE_IMPORTS = {
    "http",
    "requests",
    "shutil",
    "socket",
    "subprocess",
    "tempfile",
    "urllib",
}
READ_ONLY_ALLOWED_IMPORTS = {"__future__", "json", "re"}
FORBIDDEN_LEGACY_REMOTE_EXECUTABLES = {"curl", "gh", "git", "wget"}
FORBIDDEN_PURE_CALL_NAMES = {
    "__import__",
    "compile",
    "eval",
    "exec",
    "open",
    "run_command",
    "run_design_gate_case",
}
FORBIDDEN_PURE_METHODS = {
    "hardlink_to",
    "mkdir",
    "popen",
    "remove",
    "rename",
    "replace",
    "rmdir",
    "symlink_to",
    "system",
    "touch",
    "unlink",
    "write_bytes",
    "write_text",
}


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _literal_executable(node: ast.Call) -> str | None:
    if not node.args:
        return None
    first = node.args[0]
    if isinstance(first, ast.Constant) and isinstance(first.value, str):
        return first.value
    if isinstance(first, (ast.List, ast.Tuple)) and first.elts:
        value = first.elts[0]
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            return value.value
    return None


def _validate_legacy_design(tree: ast.Module, *, layer: str) -> list[str]:
    errors: list[str] = []
    if layer != DESIGN_LAYER_ID:
        errors.append("legacy design section must remain owned by design_governance_layer")

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = (
                node.names[0].name
                if isinstance(node, ast.Import)
                else (node.module or "")
            ).split(".", 1)[0]
            if module in {"http", "requests", "socket", "urllib"}:
                errors.append(
                    f"line {node.lineno}: legacy design section imports forbidden remote module {module}"
                )
        elif isinstance(node, ast.Call):
            executable = _literal_executable(node)
            if executable in FORBIDDEN_LEGACY_REMOTE_EXECUTABLES:
                errors.append(
                    f"line {node.lineno}: legacy design section invokes forbidden remote command {executable}"
                )
    return errors


def validate_section_module(path: Path, *, section: str, layer: str) -> list[str]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (OSError, SyntaxError) as exc:
        return [f"unable to parse section module: {exc}"]

    if layer == RUNTIME_SMOKE_LAYER_ID:
        return ["runtime_smoke_layer is delegated to CI and cannot own a Harness section"]

    if section in LEGACY_SECTIONS:
        return _validate_legacy_design(tree, layer=layer)

    errors: list[str] = []
    validate_defs = [
        node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "validate"
    ]
    if len(validate_defs) != 1:
        errors.append("section module must define exactly one validate(context) function")
    else:
        args = validate_defs[0].args
        if (
            args.posonlyargs
            or len(args.args) != 1
            or args.args[0].arg != "context"
            or args.kwonlyargs
            or args.defaults
            or any(default is not None for default in args.kw_defaults)
            or args.vararg is not None
            or args.kwarg is not None
        ):
            errors.append("section validate function must have exactly one context argument")
        if validate_defs[0].decorator_list:
            errors.append("section validate function cannot have decorators")

    for node in tree.body:
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            continue
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        if isinstance(node, ast.FunctionDef):
            if node.decorator_list or node.args.defaults or any(
                default is not None for default in node.args.kw_defaults
            ):
                errors.append(
                    f"line {node.lineno}: top-level function decorators and defaults are forbidden"
                )
            continue
        if isinstance(node, ast.Assign) and all(isinstance(target, ast.Name) for target in node.targets):
            try:
                ast.literal_eval(node.value)
            except (ValueError, TypeError):
                pass
            else:
                continue
        errors.append(
            f"line {getattr(node, 'lineno', '?')}: executable top-level statement is forbidden"
        )

    if layer not in PURE_LAYER_IDS and section not in READ_ONLY_SECTIONS:
        return errors

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root not in READ_ONLY_ALLOWED_IMPORTS or root in FORBIDDEN_PURE_IMPORTS:
                    errors.append(
                        f"line {node.lineno}: read-only section imports forbidden non-allowlisted module {root}"
                    )
        elif isinstance(node, ast.ImportFrom) and node.module:
            root = node.module.split(".", 1)[0]
            if root not in READ_ONLY_ALLOWED_IMPORTS or root in FORBIDDEN_PURE_IMPORTS:
                errors.append(
                    f"line {node.lineno}: read-only section imports forbidden non-allowlisted module {root}"
                )
        elif isinstance(node, ast.Call):
            name = _call_name(node)
            if name in FORBIDDEN_PURE_CALL_NAMES or name in FORBIDDEN_PURE_METHODS:
                errors.append(f"line {node.lineno}: pure section calls forbidden capability {name}")

    return errors
