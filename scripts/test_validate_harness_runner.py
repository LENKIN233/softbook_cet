#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock

from harness_validator.runner import (
    RESULT_SCHEMA_VERSION,
    RunnerOptions,
    build_catalog,
    emit,
    parse_args,
    render_catalog,
    render_result,
    resolve_sections,
    run_harness,
)
from validate_agent_review import validate as validate_agent_review


TEST_LAYERS = (
    {"id": "bootstrap_layer", "sections": ("prelude",)},
    {"id": "test_layer", "sections": ("alpha", "beta")},
    {"id": "runtime_smoke_layer", "sections": ()},
)
ROOT = Path(__file__).resolve().parents[1]
ENTRYPOINT = ROOT / "scripts" / "validate_harness.py"


class HarnessRunnerTests(unittest.TestCase):
    def test_default_mode_preserves_full_run_and_compatibility_alias_is_local(self):
        default = parse_args([], layers=TEST_LAYERS)
        local = parse_args(["--skip-remote-guard"], layers=TEST_LAYERS)

        self.assertEqual(default.mode, "full")
        self.assertEqual(resolve_sections(default, layers=TEST_LAYERS), ("prelude", "alpha", "beta"))
        self.assertEqual(local.mode, "local")

    def test_unknown_argument_and_conflicting_remote_modes_exit_two(self):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as unknown:
                parse_args(["--unknown"], layers=TEST_LAYERS)
            with self.assertRaises(SystemExit) as conflict:
                parse_args(
                    ["--mode", "full", "--skip-remote-guard"],
                    layers=TEST_LAYERS,
                )

        self.assertEqual(unknown.exception.code, 2)
        self.assertEqual(conflict.exception.code, 2)

    def test_section_selection_adds_prelude_and_marks_other_sections_skipped(self):
        with self.section_directory(
            prelude="pass\n",
            alpha="errors.append('alpha must not run')\n",
            beta="marker = 'beta-ran'\n",
        ) as section_dir:
            options = RunnerOptions(mode="full", sections=("beta",))
            result = run_harness(options, layers=TEST_LAYERS, section_dir=section_dir)

        self.assertEqual(
            result["selection"]["selected_sections"],
            ["prelude", "beta"],
        )
        self.assertEqual(result["sections"][1]["status"], "skipped")
        self.assertEqual(result["status"], "passed")
        self.assertFalse(result["completeness"]["complete"])

    def test_empty_delegated_layer_selection_fails_closed(self):
        options = RunnerOptions(layers=("runtime_smoke_layer",))
        with self.assertRaisesRegex(ValueError, "no runnable Harness sections"):
            resolve_sections(options, layers=TEST_LAYERS)

    def test_section_selection_expands_declared_logical_prerequisites(self):
        options = RunnerOptions(sections=("delivery_runtime",))
        selected = resolve_sections(options)

        self.assertEqual(
            selected,
            ("prelude", "governance_contracts", "delivery_runtime"),
        )

    def test_section_exception_does_not_hide_later_diagnostics(self):
        with self.section_directory(
            prelude="pass\n",
            alpha="errors.append('alpha finding')\nraise RuntimeError('alpha exploded')\n",
            beta="errors.append('beta finding')\n",
        ) as section_dir:
            result = run_harness(
                RunnerOptions(),
                layers=TEST_LAYERS,
                section_dir=section_dir,
            )

        messages = [finding["message"] for finding in result["findings"]]
        finding_types = [finding["type"] for finding in result["findings"]]
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["exit_code"], 1)
        self.assertIn("alpha finding", messages)
        self.assertIn("alpha exploded", messages)
        self.assertIn("beta finding", messages)
        self.assertIn("exception", finding_types)
        self.assertEqual(result["sections"][2]["status"], "failed")

    def test_multiple_module_errors_are_attributed_to_their_section(self):
        with self.section_directory(
            prelude="pass\n",
            alpha="errors.extend(['first', 'second'])\n",
            beta="pass\n",
        ) as section_dir:
            result = run_harness(
                RunnerOptions(),
                layers=TEST_LAYERS,
                section_dir=section_dir,
            )

        alpha_findings = result["sections"][1]["findings"]
        self.assertEqual([finding["message"] for finding in alpha_findings], ["first", "second"])
        self.assertTrue(
            all(finding["layer"] == "test_layer" for finding in alpha_findings)
        )
        self.assertTrue(
            all(finding["section"] == "alpha" for finding in alpha_findings)
        )

    def test_section_error_lists_are_isolated(self):
        isolated_layers = (
            {"id": "bootstrap_layer", "sections": ("prelude",)},
            {"id": "test_layer", "sections": ("alpha", "beta")},
        )
        with self.section_directory(
            prelude="pass\n",
            alpha="errors.append('alpha only')\n",
            beta=(
                "if errors:\n"
                "    raise RuntimeError('beta inherited another section errors')\n"
                "errors.append('beta only')\n"
            ),
        ) as section_dir:
            result = run_harness(
                RunnerOptions(),
                layers=isolated_layers,
                section_dir=section_dir,
            )

        self.assertEqual(
            [finding["message"] for finding in result["sections"][1]["findings"]],
            ["alpha only"],
        )
        self.assertEqual(
            [finding["message"] for finding in result["sections"][2]["findings"]],
            ["beta only"],
        )

    def test_local_mode_is_injected_without_remote_guard_access(self):
        delivery_layers = (
            {"id": "bootstrap_layer", "sections": ("prelude",)},
            {"id": "delivery_governance_layer", "sections": ("delivery_runtime",)},
        )
        with self.section_directory(
            prelude="pass\n",
            delivery_runtime=(
                "if context.mode == 'full':\n"
                "    context.mark_remote_guard_executed()\n"
                "    errors.append('remote guard attempted')\n"
            ),
        ) as section_dir:
            local = run_harness(
                RunnerOptions(mode="local"),
                layers=delivery_layers,
                section_dir=section_dir,
            )
            full = run_harness(
                RunnerOptions(mode="full"),
                layers=delivery_layers,
                section_dir=section_dir,
            )

        self.assertEqual(local["status"], "passed")
        self.assertFalse(local["completeness"]["remote_guard_executed"])
        self.assertEqual(full["status"], "failed")
        self.assertTrue(full["completeness"]["remote_guard_executed"])

    def test_section_timeout_is_attributed_and_later_sections_still_run(self):
        with self.section_directory(
            prelude="pass\n",
            alpha="import time\ntime.sleep(5)\n",
            beta="errors.append('beta after timeout')\n",
        ) as section_dir:
            result = run_harness(
                RunnerOptions(mode="local"),
                layers=TEST_LAYERS,
                section_dir=section_dir,
                section_timeout_seconds=0.1,
            )

        self.assertEqual(result["sections"][1]["findings"][0]["type"], "timeout")
        self.assertEqual(
            [finding["message"] for finding in result["sections"][2]["findings"]],
            ["beta after timeout"],
        )

    def test_worker_start_error_is_attributed_for_every_selected_section(self):
        with self.section_directory(
            prelude="pass\n",
            alpha="pass\n",
            beta="pass\n",
        ) as section_dir:
            with mock.patch(
                "harness_validator.runner.subprocess.Popen",
                side_effect=OSError("worker unavailable"),
            ):
                result = run_harness(
                    RunnerOptions(mode="local"),
                    layers=TEST_LAYERS,
                    section_dir=section_dir,
                )

        self.assertEqual(result["summary"]["failed"], 3)
        self.assertTrue(
            all(
                section["findings"][0]["type"] == "worker_start_error"
                for section in result["sections"]
            )
        )

    def test_pure_section_capability_violation_fails_before_execution(self):
        pure_layers = (
            {"id": "bootstrap_layer", "sections": ("prelude",)},
            {"id": "truth_spec_layer", "sections": ("alpha",)},
        )
        with self.section_directory(
            prelude="pass\n",
            alpha="import subprocess\nsubprocess.run(['false'])\n",
        ) as section_dir:
            result = run_harness(
                RunnerOptions(mode="local"),
                layers=pure_layers,
                section_dir=section_dir,
            )

        alpha = result["sections"][1]
        self.assertEqual(alpha["status"], "failed")
        self.assertTrue(
            all(finding["type"] == "capability_violation" for finding in alpha["findings"])
        )

    def test_local_cli_does_not_invoke_gh_and_full_reports_unavailable_github(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            sentinel = tmp / "gh-invoked"
            fake_gh = tmp / "gh"
            fake_gh.write_text(
                "#!/bin/sh\n"
                f"printf invoked > {sentinel!s}\n"
                "exit 99\n",
                encoding="utf-8",
            )
            fake_gh.chmod(0o755)
            env = {**os.environ, "PATH": f"{tmp}{os.pathsep}{os.environ['PATH']}"}

            local = subprocess.run(
                [sys.executable, str(ENTRYPOINT), "--mode", "local"],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(local.returncode, 0, local.stdout + local.stderr)
            self.assertFalse(sentinel.exists())

            full = subprocess.run(
                [
                    sys.executable,
                    str(ENTRYPOINT),
                    "--mode",
                    "full",
                    "--section",
                    "delivery_runtime",
                    "--format",
                    "json",
                ],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(full.returncode, 1, full.stdout + full.stderr)
            self.assertTrue(sentinel.exists())
            full_result = json.loads(full.stdout)
            self.assertTrue(
                any(
                    finding["section"] == "delivery_runtime"
                    and "unable to read GitHub branch protection" in finding["message"]
                    for finding in full_result["findings"]
                )
            )

    def test_partial_cli_commands_cannot_satisfy_full_pr_validation(self):
        partial_commands = (
            "python3 scripts/validate_harness.py --skip-remote-guard",
            "python3 scripts/validate_harness.py --mode local",
            "python3 scripts/validate_harness.py --mode=local",
            "python3 scripts/validate_harness.py --section truth_mirrors",
            "python3 scripts/validate_harness.py --section=truth_mirrors",
            "python3 scripts/validate_harness.py --layer truth_spec_layer",
            "python3 scripts/validate_harness.py --layer=truth_spec_layer",
            "python3 scripts/validate_harness.py --list",
            "python3 scripts/validate_harness.py --help",
            "python3 scripts/validate_harness.py -h",
        )
        for command in partial_commands:
            with self.subTest(command=command):
                errors = validate_agent_review(self.review_body(command))
                self.assertTrue(
                    any("runs are partial" in error for error in errors),
                    errors,
                )

        for command in (
            "python3 scripts/validate_harness.py",
            "python3 scripts/validate_harness.py --mode full --format json",
        ):
            with self.subTest(command=command):
                self.assertEqual(validate_agent_review(self.review_body(command)), [])

        mixed_record = self.review_body(
            "python3 scripts/validate_harness.py --mode local"
        ).replace(
            "## Agent review",
            "- `python3 scripts/validate_harness.py`\n\n## Agent review",
        )
        mixed_errors = validate_agent_review(mixed_record)
        self.assertTrue(
            any("runs are partial" in error for error in mixed_errors),
            mixed_errors,
        )

    def test_json_result_has_stable_schema_and_structured_findings(self):
        with self.section_directory(
            prelude="pass\n",
            alpha="errors.append('structured failure')\n",
            beta="pass\n",
        ) as section_dir:
            result = run_harness(
                RunnerOptions(profile=True),
                layers=TEST_LAYERS,
                section_dir=section_dir,
            )

        rendered = json.loads(render_result(result, "json", profile=True))
        architecture = json.loads(
            (ROOT / "spec" / "harness-architecture.json").read_text(encoding="utf-8")
        )
        contract = architecture["runner_contract"]["result_contract"]
        self.assertEqual(rendered["schema_version"], RESULT_SCHEMA_VERSION)
        self.assertTrue(
            set(contract["required_top_level_fields"]).issubset(rendered)
        )
        self.assertEqual(rendered["status"], "failed")
        self.assertEqual(rendered["summary"]["findings"], 1)
        self.assertEqual(
            set(rendered["findings"][0]),
            {"layer", "section", "type", "message"},
        )
        self.assertIsInstance(rendered["duration_ms"], float)
        self.assertTrue(
            all(
                section["status"] in contract["section_status_values"]
                for section in rendered["sections"]
            )
        )
        self.assertTrue(
            all(not any(key.startswith("_") for key in section) for section in rendered["sections"])
        )

    def test_remote_guard_aggregation_never_leaks_worker_protocol_fields(self):
        layers = (
            {"id": "bootstrap_layer", "sections": ("prelude",)},
            {
                "id": "delivery_governance_layer",
                "sections": ("delivery_runtime", "after_remote_guard"),
            },
        )
        with self.section_directory(
            prelude="pass\n",
            delivery_runtime="context.mark_remote_guard_executed()\n",
            after_remote_guard="pass\n",
        ) as section_dir:
            result = run_harness(
                RunnerOptions(),
                layers=layers,
                section_dir=section_dir,
            )

        self.assertTrue(result["completeness"]["remote_guard_executed"])
        self.assertTrue(result["completeness"]["complete"])
        self.assertTrue(
            all(not any(key.startswith("_") for key in section) for section in result["sections"])
        )

    def test_catalog_and_output_file_are_machine_readable(self):
        catalog = build_catalog(TEST_LAYERS)
        rendered = render_catalog(catalog, "json")

        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "nested" / "catalog.json"
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertTrue(emit(rendered, output))
            saved = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(saved["schema_version"], "harness-catalog.v1")
        self.assertFalse(saved["layers"][-1]["runnable"])

    @contextlib.contextmanager
    def section_directory(self, **sources):
        with tempfile.TemporaryDirectory() as tmpdir:
            section_dir = Path(tmpdir)
            for section, source in sources.items():
                module = (
                    "from __future__ import annotations\n\n\n"
                    "def validate(context) -> None:\n"
                    "    errors = context.errors\n"
                    f"{textwrap.indent(source, '    ')}"
                )
                (section_dir / f"{section}.py").write_text(module, encoding="utf-8")
            yield section_dir

    @staticmethod
    def review_body(command: str) -> str:
        return f"""
## 当前任务引用的 spec

- `spec/harness-architecture.json`

## 变更摘要

- Validate structured Harness runner behavior.

## 验证

- [x] `{command}`

## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed structured runner behavior.

## Agent run record

- Run record: docs/agent-runs/2026-07-14-harness-structured-runner.md

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
"""


if __name__ == "__main__":
    unittest.main()
