#!/usr/bin/env python3
from __future__ import annotations

import ast
import tempfile
import unittest
from pathlib import Path

from harness_validator.capability_ast import validate_section_module
from harness_validator.context import (
    CapabilityError,
    DeliveryContext,
    FixtureContext,
    ReadOnlyContext,
    context_for_layer,
)
from harness_validator.runner import HARNESS_LAYERS, SECTION_DIR


ROOT = Path(__file__).resolve().parents[1]


class HarnessModuleBoundaryTests(unittest.TestCase):
    def test_all_real_sections_have_valid_explicit_module_boundaries(self):
        violations = []
        for layer in HARNESS_LAYERS:
            for section in layer["sections"]:
                for message in validate_section_module(
                    SECTION_DIR / f"{section}.py",
                    section=section,
                    layer=layer["id"],
                ):
                    violations.append(f"{layer['id']}/{section}: {message}")

        self.assertEqual(violations, [])

    def test_each_owned_layer_rejects_a_known_section_from_another_owner(self):
        cases = (
            ("bootstrap_layer", "truth_mirrors"),
            ("truth_spec_layer", "prelude"),
            ("workspace_hygiene_layer", "design_contracts"),
            ("delivery_governance_layer", "design_contracts"),
            ("design_governance_layer", "agent_review_regressions"),
        )
        for layer, section in cases:
            with self.subTest(layer=layer), self.section_module("pass\n") as path:
                violations = validate_section_module(path, section=section, layer=layer)
                self.assertTrue(
                    any("must be owned" in violation for violation in violations),
                    violations,
                )

    def test_each_pure_layer_rejects_a_direct_capability_break(self):
        cases = {
            "bootstrap_layer": "import subprocess\nsubprocess.run(['true'])\n",
            "truth_spec_layer": "context.root.joinpath('x').write_text('bad')\n",
            "workspace_hygiene_layer": "exec('value = 1')\n",
        }
        for layer, body in cases.items():
            with self.subTest(layer=layer), self.section_module(body) as path:
                violations = validate_section_module(
                    path,
                    section="broken_owner_contract",
                    layer=layer,
                )
                self.assertTrue(violations)
                self.assertTrue(
                    any(
                        "forbidden" in violation or "mutation" in violation
                        for violation in violations
                    ),
                    violations,
                )

    def test_delivery_layer_rejects_mutating_command_capability(self):
        context = DeliveryContext(root=ROOT, mode="full", section="delivery_runtime")

        for command in (
            ("git", "commit", "-m", "bad"),
            ("git", "config", "user.name", "bad"),
            ("gh", "api", "repos/x", "--method", "DELETE"),
            ("rm", "-rf", "anything"),
        ):
            with self.subTest(command=command), self.assertRaises(CapabilityError):
                context.run_command(*command)

    def test_delivery_context_rejects_github_access_in_local_mode(self):
        context = DeliveryContext(root=ROOT, mode="local", section="delivery_runtime")

        with self.assertRaisesRegex(CapabilityError, "outside full mode"):
            context.run_command("gh", "api", "repos/LENKIN233/softbook_cet")

    def test_fixture_section_rejects_direct_remote_or_process_capabilities(self):
        body = "import subprocess\nsubprocess.run(['gh', 'api'])\n"
        with self.section_module(body) as path:
            violations = validate_section_module(
                path,
                section="design_search_regressions",
                layer="design_governance_layer",
            )

        self.assertTrue(
            any("forbidden direct capability subprocess" in item for item in violations),
            violations,
        )

    def test_fixture_section_rejects_repository_derived_write(self):
        body = "target = context.root / 'leak'\ntarget.write_text('bad')\n"
        with self.section_module(body) as path:
            violations = validate_section_module(
                path,
                section="design_search_regressions",
                layer="design_governance_layer",
            )

        self.assertTrue(
            any("mutates a repository-derived path" in item for item in violations),
            violations,
        )

    def test_fixture_section_rejects_write_without_fixture_provenance(self):
        body = "from pathlib import Path\nPath('/tmp/leak').write_text('bad')\n"
        with self.section_module(body) as path:
            violations = validate_section_module(
                path,
                section="design_search_regressions",
                layer="design_governance_layer",
            )

        self.assertTrue(
            any("not proven to be fixture-derived" in item for item in violations),
            violations,
        )

    def test_fixture_context_uses_system_temp_and_cleans_it(self):
        context = FixtureContext(
            root=ROOT,
            mode="local",
            section="design_search_regressions",
        )

        with context.temporary_directory(prefix="boundary-test") as fixture_root:
            self.assertNotEqual(fixture_root, ROOT)
            self.assertNotIn(ROOT, fixture_root.parents)
            self.assertTrue(fixture_root.exists())
        self.assertFalse(fixture_root.exists())

    def test_fixture_context_rejects_unallowlisted_validator_cwd_and_env(self):
        context = FixtureContext(
            root=ROOT,
            mode="local",
            section="design_search_regressions",
        )
        with self.assertRaisesRegex(CapabilityError, "not allowlisted"):
            context.run_validator("scripts/validate_agent_review.py")
        with self.assertRaisesRegex(CapabilityError, "outside repository and fixture roots"):
            context.run_validator(
                "scripts/validate_design_search_run.py",
                cwd=ROOT.parent,
            )
        with self.assertRaisesRegex(CapabilityError, "non-allowlisted keys"):
            context.run_validator(
                "scripts/validate_design_search_run.py",
                env={"TOKEN": "secret"},
            )

    def test_context_factory_moves_agent_review_regressions_to_delivery(self):
        delivery_fixture = context_for_layer(
            layer="delivery_governance_layer",
            root=ROOT,
            mode="local",
            section="agent_review_regressions",
        )
        wrong_owner = context_for_layer(
            layer="design_governance_layer",
            root=ROOT,
            mode="local",
            section="agent_review_regressions",
        )

        self.assertIsInstance(delivery_fixture, FixtureContext)
        self.assertIsInstance(wrong_owner, ReadOnlyContext)
        self.assertNotIsInstance(wrong_owner, FixtureContext)

    def test_runtime_smoke_layer_rejects_runnable_harness_section(self):
        with self.section_module("pass\n") as path:
            violations = validate_section_module(
                path,
                section="runtime_test",
                layer="runtime_smoke_layer",
            )

        self.assertEqual(
            violations,
            ["runtime_smoke_layer is delegated to CI and cannot own a Harness section"],
        )

    def test_executable_top_level_statement_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "top_level.py"
            path.write_text(
                "from pathlib import Path\n"
                "Path('leak').write_text('bad')\n\n"
                "def validate(context):\n"
                "    pass\n",
                encoding="utf-8",
            )
            violations = validate_section_module(
                path,
                section="top_level",
                layer="truth_spec_layer",
            )

        self.assertTrue(any("executable top-level" in item for item in violations))

    def test_validate_signature_rejects_definition_time_execution_hooks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "decorated.py"
            path.write_text(
                "@decorate()\n"
                "def validate(context=side_effect()):\n"
                "    pass\n",
                encoding="utf-8",
            )
            violations = validate_section_module(
                path,
                section="decorated",
                layer="truth_spec_layer",
            )

        self.assertTrue(any("exactly one context argument" in item for item in violations))
        self.assertTrue(any("cannot have decorators" in item for item in violations))
        self.assertTrue(any("decorators and defaults are forbidden" in item for item in violations))

    def test_read_only_context_exposes_no_command_fixture_or_temp_capability(self):
        context = ReadOnlyContext(root=ROOT, mode="local", section="truth_mirrors")

        self.assertFalse(hasattr(context, "run_command"))
        self.assertFalse(hasattr(context, "run_validator"))
        self.assertFalse(hasattr(context, "temporary_directory"))
        self.assertFalse(hasattr(context, "mark_remote_guard_executed"))

    def test_exec_call_does_not_exist_in_harness_runtime(self):
        calls = []
        harness_dir = ROOT / "scripts" / "harness_validator"
        for path in harness_dir.rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                    if node.func.id == "exec":
                        calls.append(path.relative_to(ROOT).as_posix())

        self.assertEqual(calls, [])

    @staticmethod
    def section_module(body: str):
        class ModuleContext:
            def __enter__(self):
                self.temp = tempfile.TemporaryDirectory()
                self.path = Path(self.temp.name) / "section.py"
                indented = "".join(f"    {line}\n" for line in body.splitlines())
                self.path.write_text(
                    "def validate(context):\n" + indented,
                    encoding="utf-8",
                )
                return self.path

            def __exit__(self, exc_type, exc, traceback):
                self.temp.cleanup()

        return ModuleContext()


if __name__ == "__main__":
    unittest.main()
