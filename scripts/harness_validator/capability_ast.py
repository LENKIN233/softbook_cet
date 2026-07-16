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
    "design_contracts",
}
FIXTURE_SECTION_OWNERS = {
    "mobile_metadata_regressions": "design_governance_layer",
    "design_metadata_regressions": "design_governance_layer",
    "design_search_regressions": "design_governance_layer",
    "agent_review_regressions": "delivery_governance_layer",
    "pr_design_gate_regressions": "design_governance_layer",
}
KNOWN_SECTION_OWNERS = {
    "prelude": "bootstrap_layer",
    "truth_mirrors": "truth_spec_layer",
    "harness_architecture": "truth_spec_layer",
    "product_contract_mirrors": "truth_spec_layer",
    "visual_language": "truth_spec_layer",
    "workspace_boundary": "workspace_hygiene_layer",
    "governance_contracts": "delivery_governance_layer",
    "agent_run_record": "delivery_governance_layer",
    "agent_review_regressions": "delivery_governance_layer",
    "delivery_runtime": "delivery_governance_layer",
    "design_contracts": "design_governance_layer",
    "mobile_metadata_regressions": "design_governance_layer",
    "design_metadata_regressions": "design_governance_layer",
    "design_search_regressions": "design_governance_layer",
    "pr_design_gate_regressions": "design_governance_layer",
}
RUNTIME_SMOKE_LAYER_ID = "runtime_smoke_layer"
FORBIDDEN_DIRECT_IMPORTS = {
    "http",
    "importlib",
    "os",
    "requests",
    "shutil",
    "socket",
    "subprocess",
    "tempfile",
    "urllib",
}
FORBIDDEN_DYNAMIC_CALLS = {
    "__import__",
    "compile",
    "delattr",
    "eval",
    "exec",
    "getattr",
    "open",
    "setattr",
}
FILESYSTEM_MUTATION_METHODS = {
    "chmod",
    "hardlink_to",
    "mkdir",
    "remove",
    "rename",
    "rmdir",
    "symlink_to",
    "touch",
    "unlink",
    "write_bytes",
    "write_text",
}
PROCESS_OR_NETWORK_METHODS = {
    "popen",
    "system",
    "urlopen",
}
FIXTURE_CONTEXT_METHODS = {
    "copy_fixture_file",
    "fixture_path",
    "load_validator_module",
    "normalize_fixture_text",
    "remove_fixture_tree",
    "run_validator",
    "temporary_directory",
}
DELIVERY_CONTEXT_METHODS = {
    "mark_remote_guard_executed",
    "run_command",
    "temporary_directory",
}


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _import_roots(node: ast.Import | ast.ImportFrom) -> list[str]:
    if isinstance(node, ast.Import):
        return [alias.name.split(".", 1)[0] for alias in node.names]
    return [(node.module or "").split(".", 1)[0]]


def _context_attribute(node: ast.AST, attribute: str) -> bool:
    return (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "context"
        and node.attr == attribute
    )


def _expression_taint(
    node: ast.AST,
    *,
    repository_names: set[str],
    fixture_names: set[str],
) -> str | None:
    if isinstance(node, ast.Name):
        if node.id in repository_names:
            return "repository"
        if node.id in fixture_names:
            return "fixture"
        return None
    if _context_attribute(node, "root") or _context_attribute(node, "spec"):
        return "repository"
    if (
        isinstance(node, ast.Call)
        and _context_attribute(node.func, "fixture_path")
    ):
        return "fixture"
    if isinstance(node, ast.Attribute):
        return _expression_taint(
            node.value,
            repository_names=repository_names,
            fixture_names=fixture_names,
        )
    if isinstance(node, ast.BinOp):
        left = _expression_taint(
            node.left,
            repository_names=repository_names,
            fixture_names=fixture_names,
        )
        right = _expression_taint(
            node.right,
            repository_names=repository_names,
            fixture_names=fixture_names,
        )
        return "repository" if "repository" in {left, right} else left or right
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr
        in {"absolute", "joinpath", "resolve", "with_name", "with_suffix"}
    ):
        return _expression_taint(
            node.func.value,
            repository_names=repository_names,
            fixture_names=fixture_names,
        )
    if isinstance(node, ast.Subscript):
        return _expression_taint(
            node.value,
            repository_names=repository_names,
            fixture_names=fixture_names,
        )
    return None


def _path_taints(tree: ast.Module) -> tuple[set[str], set[str]]:
    repository_names: set[str] = set()
    fixture_names: set[str] = set()

    for node in ast.walk(tree):
        if not isinstance(node, (ast.With, ast.AsyncWith)):
            continue
        for item in node.items:
            call = item.context_expr
            if (
                isinstance(call, ast.Call)
                and _context_attribute(call.func, "temporary_directory")
                and isinstance(item.optional_vars, ast.Name)
            ):
                fixture_names.add(item.optional_vars.id)

    changed = True
    while changed:
        changed = False
        for node in ast.walk(tree):
            value = None
            targets: list[ast.expr] = []
            if isinstance(node, ast.Assign):
                value = node.value
                targets = list(node.targets)
            elif isinstance(node, ast.AnnAssign) and node.value is not None:
                value = node.value
                targets = [node.target]
            if value is None:
                continue
            taint = _expression_taint(
                value,
                repository_names=repository_names,
                fixture_names=fixture_names,
            )
            for target in targets:
                if not isinstance(target, ast.Name):
                    continue
                if taint == "repository" and target.id not in repository_names:
                    repository_names.add(target.id)
                    changed = True
                elif taint == "fixture" and target.id not in fixture_names:
                    fixture_names.add(target.id)
                    changed = True

    return repository_names, fixture_names


def _validate_entrypoint(tree: ast.Module) -> list[str]:
    errors: list[str] = []
    validate_defs = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "validate"
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
        if (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Constant)
            and isinstance(node.value.value, str)
        ):
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
        if isinstance(node, ast.Assign) and all(
            isinstance(target, ast.Name) for target in node.targets
        ):
            try:
                ast.literal_eval(node.value)
            except (ValueError, TypeError):
                pass
            else:
                continue
        errors.append(
            f"line {getattr(node, 'lineno', '?')}: executable top-level statement is forbidden"
        )
    return errors


def validate_section_module(path: Path, *, section: str, layer: str) -> list[str]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (OSError, SyntaxError) as exc:
        return [f"unable to parse section module: {exc}"]

    if layer == RUNTIME_SMOKE_LAYER_ID:
        return ["runtime_smoke_layer is delegated to CI and cannot own a Harness section"]

    errors = _validate_entrypoint(tree)
    expected_owner = KNOWN_SECTION_OWNERS.get(section)
    if expected_owner is not None and layer != expected_owner:
        errors.append(
            f"section {section} must be owned by {expected_owner}, not {layer}"
        )

    repository_names, fixture_names = _path_taints(tree)
    is_read_only = layer in PURE_LAYER_IDS or section in READ_ONLY_SECTIONS
    is_fixture = section in FIXTURE_SECTION_OWNERS
    is_delivery = section == "delivery_runtime"

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for root in _import_roots(node):
                if root in FORBIDDEN_DIRECT_IMPORTS:
                    errors.append(
                        f"line {node.lineno}: section imports forbidden direct capability {root}"
                    )
            continue

        if not isinstance(node, ast.Call):
            continue
        name = _call_name(node)
        if name in FORBIDDEN_DYNAMIC_CALLS or name in PROCESS_OR_NETWORK_METHODS:
            errors.append(f"line {node.lineno}: section calls forbidden direct capability {name}")
            continue

        if name in FIXTURE_CONTEXT_METHODS and not is_fixture:
            if not (is_delivery and name == "temporary_directory"):
                errors.append(
                    f"line {node.lineno}: non-fixture section calls fixture capability {name}"
                )
        if name in DELIVERY_CONTEXT_METHODS and not is_delivery:
            if not (is_fixture and name == "temporary_directory"):
                errors.append(
                    f"line {node.lineno}: non-delivery section calls delivery capability {name}"
                )

        if name not in FILESYSTEM_MUTATION_METHODS:
            continue
        if is_read_only:
            errors.append(
                f"line {node.lineno}: read-only section calls filesystem mutation {name}"
            )
            continue
        if not isinstance(node.func, ast.Attribute):
            continue
        receiver_taint = _expression_taint(
            node.func.value,
            repository_names=repository_names,
            fixture_names=fixture_names,
        )
        if receiver_taint == "repository":
            errors.append(
                f"line {node.lineno}: section mutates a repository-derived path with {name}"
            )
        elif is_fixture and receiver_taint != "fixture":
            errors.append(
                f"line {node.lineno}: fixture section mutates a path not proven to be fixture-derived with {name}"
            )

    return errors
