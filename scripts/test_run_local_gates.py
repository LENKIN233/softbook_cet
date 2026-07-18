#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from dataclasses import replace
from pathlib import Path
from unittest import mock

from local_gates.runner import (
    EXPORT_ROOT,
    ROOT,
    SCHEMA_VERSION,
    STATUS_VALUES,
    CommandResult,
    CommandSpec,
    GateSpec,
    Options,
    RunContext,
    build_catalog,
    command_outcome,
    evaluate_dependency_report,
    evaluate_network_isolation,
    evaluate_release_platform,
    evaluate_toolchain,
    execute_gate,
    execute_command,
    parse_args,
    network_isolation_prefix,
    resolve_output_path,
    resolve_pr_context,
    run,
    selected_gates,
    tracked_snapshot,
    validate_report_contract,
    validate_base_ref,
)


ENTRYPOINT = ROOT / "scripts" / "run_local_gates"
ALL_PROFILES = frozenset(("dev", "pr", "release"))


class LocalGateRunnerTests(unittest.TestCase):
    def setUp(self):
        self.test_root = EXPORT_ROOT / f"runner-test-{uuid.uuid4().hex}"

    def tearDown(self):
        shutil.rmtree(self.test_root, ignore_errors=True)

    def options(self, **overrides) -> Options:
        values = {
            "profile": "dev",
            "output": str(self.test_root / "report.json"),
        }
        values.update(overrides)
        return Options(**values)

    def context(self, **overrides) -> RunContext:
        snapshot = tracked_snapshot()
        values = {
            "options": self.options(),
            "report_path": self.test_root / "report.json",
            "run_root": self.test_root,
            "logs_dir": self.test_root / "logs",
            "artifacts_dir": self.test_root / "artifacts",
            "head": snapshot["head"],
            "branch": "infra/local-quality-gates",
            "before_snapshot": snapshot,
        }
        values.update(overrides)
        return RunContext(**values)

    def command_gate(self, gate_id: str, code: str, *, timeout: float = 10) -> GateSpec:
        return GateSpec(
            gate_id,
            ALL_PROFILES,
            timeout,
            True,
            lambda _context, code=code: CommandSpec((sys.executable, "-c", code)),
        )

    def test_unknown_argument_and_invalid_pr_exit_two(self):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as unknown:
                parse_args(["--profile", "dev", "--unknown"])
            with self.assertRaises(SystemExit) as invalid_pr:
                parse_args(["--profile", "pr", "--pr", "0"])

        self.assertEqual(unknown.exception.code, 2)
        self.assertEqual(invalid_pr.exception.code, 2)

    def test_cli_unknown_argument_returns_two(self):
        result = subprocess.run(
            [sys.executable, str(ENTRYPOINT), "--profile", "dev", "--unknown"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)

    def test_output_is_restricted_to_ignored_local_gate_exports(self):
        with self.assertRaisesRegex(ValueError, "exports/local-gates"):
            resolve_output_path(
                Options(profile="dev", output="/tmp/not-a-local-gate-report.json"),
                "a" * 40,
            )

    def test_base_ref_rejects_option_and_control_character_injection(self):
        for value in ("--help", "origin/main\nHEAD", "origin/main HEAD"):
            with self.assertRaisesRegex(ValueError, "Git ref"):
                validate_base_ref(value)
        validate_base_ref("origin/main")
        validate_base_ref("623c663d20052bf43eae471f90d671745b9c3482")
        with self.assertRaisesRegex(ValueError, r"\.json"):
            resolve_output_path(
                Options(profile="dev", output="exports/local-gates/report.txt"),
                "a" * 40,
            )

    def test_dev_profile_has_no_network_gate(self):
        gates = selected_gates("dev")
        self.assertTrue(gates)
        self.assertTrue(all(not gate.network for gate in gates))
        self.assertNotIn("pr-context", [gate.id for gate in gates])
        self.assertIn("harness-local", [gate.id for gate in gates])
        self.assertIn("local-gate-runner-tests", [gate.id for gate in gates])
        self.assertIn("mobile-jest", [gate.id for gate in gates])
        self.assertIn("backend-tests", [gate.id for gate in gates])

    def test_pr_and_release_profiles_are_strict_supersets(self):
        dev = {gate.id for gate in selected_gates("dev")}
        pr = {gate.id for gate in selected_gates("pr")}
        release = {gate.id for gate in selected_gates("release")}

        self.assertTrue(dev < pr)
        self.assertTrue(pr < release)
        self.assertIn("repo-health-strict", pr)
        self.assertIn("evidence-remote", pr)
        self.assertIn("ios-release-simulator", release)
        self.assertIn("ios-unsigned-archive", release)

    def test_status_contract_is_fixed(self):
        self.assertEqual(
            STATUS_VALUES,
            ("passed", "passed_with_exception", "failed", "skipped", "deferred"),
        )

    def test_pr_catalog_delegates_oversized_blob_and_untracked_evidence_failures_to_strict_health(self):
        catalog = {gate.id: gate for gate in selected_gates("pr")}
        self.assertIn("repo-health-tests", catalog)
        strict = catalog["repo-health-strict"].command_factory(
            self.context(
                options=self.options(profile="pr", base="origin/main"),
                pr_context={"base_sha": "origin/main"},
            )
        )
        self.assertIn("--strict", strict.argv)
        self.assertIn("--remote", strict.argv)
        self.assertIn("--expected-max-worktrees", strict.argv)
        self.assertIn("--require-upstreams", strict.argv)

    def test_multiple_gate_failures_are_collected_and_schema_is_stable(self):
        catalog = (
            self.command_gate("first-failure", "raise SystemExit(3)"),
            self.command_gate("second-failure", "raise SystemExit(4)"),
            self.command_gate("later-pass", "print('ok')"),
        )
        result = run(self.options(), catalog=catalog)

        self.assertEqual(result["schema_version"], SCHEMA_VERSION)
        self.assertEqual(result["status"], "failed")
        self.assertTrue(result["complete"])
        self.assertEqual(result["summary"]["failed"], 2)
        self.assertEqual(result["summary"]["passed"], 2)
        self.assertTrue(result["workspace"]["tracked_worktree_unchanged"])
        self.assertEqual(
            result["formal_state_updates"],
            {
                "pull_request_review": False,
                "content_approval": False,
                "launch_readiness": False,
            },
        )
        stored = json.loads((self.test_root / "report.json").read_text(encoding="utf-8"))
        self.assertEqual(validate_report_contract(stored), [])
        for field in (
            "schema_version",
            "profile",
            "status",
            "complete",
            "head",
            "toolchain",
            "network_isolation",
            "safe_exceptions",
            "remote_checks",
            "gates",
        ):
            self.assertIn(field, stored)

    def test_report_contract_rejects_missing_fields_and_unknown_status(self):
        errors = validate_report_contract(
            {
                "schema_version": SCHEMA_VERSION,
                "profile": "dev",
                "status": "greenish",
                "complete": True,
                "exit_code": 7,
                "gates": ["not-an-object"],
                "formal_state_updates": {
                    "pull_request_review": True,
                    "content_approval": False,
                    "launch_readiness": False,
                },
            }
        )
        self.assertTrue(any("missing report fields" in error for error in errors))
        self.assertIn("invalid report status", errors)
        self.assertIn("report exit_code must be zero or one", errors)
        self.assertIn("gate 0 must be an object", errors)
        self.assertIn("local gate report must keep all formal state updates false", errors)

    def test_fail_fast_is_diagnostic_and_cannot_form_complete_pass(self):
        marker = self.test_root / "must-not-run"
        catalog = (
            self.command_gate("failure", "raise SystemExit(8)"),
            self.command_gate("skipped", f"from pathlib import Path; Path({str(marker)!r}).touch()"),
        )
        result = run(self.options(fail_fast=True), catalog=catalog)

        self.assertEqual(result["status"], "failed")
        self.assertFalse(result["complete"])
        self.assertEqual(result["summary"]["skipped"], 1)
        self.assertFalse(marker.exists())

    def test_fail_fast_flag_never_produces_complete_pass_even_without_failure(self):
        result = run(
            self.options(fail_fast=True),
            catalog=(self.command_gate("pass", "print('ok')"),),
        )
        self.assertEqual(result["status"], "deferred")
        self.assertEqual(result["exit_code"], 1)
        self.assertFalse(result["complete"])

    def test_gate_exception_is_isolated_from_later_gate(self):
        def explode(_context):
            raise RuntimeError("factory exploded")

        catalog = (
            GateSpec("exception", ALL_PROFILES, 10, False, explode),
            self.command_gate("later-pass", "print('later diagnostic')"),
        )
        result = run(self.options(), catalog=catalog)
        records = {gate["id"]: gate for gate in result["gates"]}

        self.assertEqual(records["exception"]["findings"][0]["type"], "gate_exception")
        self.assertEqual(records["later-pass"]["status"], "passed")

    def test_timeout_terminates_the_process_group(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            marker = tmp / "child-survived"
            child_code = (
                "import signal, time; from pathlib import Path; "
                "signal.signal(signal.SIGTERM, signal.SIG_IGN); "
                "time.sleep(0.5); "
                f"Path({str(marker)!r}).touch()"
            )
            code = (
                "import subprocess, sys, time; "
                f"subprocess.Popen([sys.executable, '-c', {child_code!r}], "
                "stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); "
                "time.sleep(5)"
            )
            result = execute_command(
                CommandSpec((sys.executable, "-c", code)),
                timeout_seconds=0.1,
                log_path=tmp / "timeout.log",
                verbose=False,
            )
            time.sleep(0.7)

            self.assertTrue(result.timed_out)
            self.assertEqual(result.returncode, 124)
            self.assertFalse(marker.exists())
            self.assertEqual(command_outcome(result).findings[0]["type"], "timeout")

    def test_supported_network_isolation_blocks_outbound_socket(self):
        prefix = network_isolation_prefix(ROOT)
        if prefix is None:
            self.skipTest("supported network isolation is unavailable")
        with tempfile.TemporaryDirectory() as tmpdir:
            result = execute_command(
                CommandSpec(
                    (
                        *prefix,
                        sys.executable,
                        "-c",
                        "import socket; socket.create_connection(('1.1.1.1', 443), timeout=1)",
                    )
                ),
                timeout_seconds=5,
                log_path=Path(tmpdir) / "network-denied.log",
                verbose=False,
            )
        self.assertNotEqual(result.returncode, 0)

    def test_network_false_gate_defers_when_os_isolation_is_missing(self):
        gate = GateSpec(
            "offline-command",
            ALL_PROFILES,
            10,
            False,
            lambda _context: CommandSpec((sys.executable, "-c", "raise SystemExit(99)")),
        )
        outcome, _duration = execute_gate(
            self.context(),
            gate,
            self.test_root / "offline-command.log",
        )
        self.assertEqual(outcome.status, "deferred")
        self.assertEqual(outcome.findings[0]["type"], "network_isolation_unavailable")

    def test_network_isolation_preflight_fails_closed_without_supported_mechanism(self):
        with (
            mock.patch("local_gates.execution.platform.system", return_value="Linux"),
            mock.patch("local_gates.execution.shutil.which", return_value=None),
        ):
            outcome = evaluate_network_isolation(self.context())
        self.assertEqual(outcome.status, "failed")
        self.assertEqual(outcome.findings[0]["type"], "network_isolation_unavailable")

    def test_logs_redact_sensitive_arguments_environment_and_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "redacted.log"
            secret = "github_pat_this-must-not-leak"
            body = "Review status: Passed\nAuthorization: body-secret"
            code = (
                "import os, sys; print(os.environ['API_TOKEN']); "
                "print(os.environ['PR_BODY']); print(sys.argv[-1]); "
                "print('PASS: No metadata leaks detected.'); "
                "print('pass=standalone-pass-secret')"
            )
            result = execute_command(
                CommandSpec(
                    (sys.executable, "-c", code, "--token", secret),
                    env={"API_TOKEN": secret, "PR_BODY": body},
                ),
                timeout_seconds=10,
                log_path=log_path,
                verbose=False,
            )
            text = log_path.read_text(encoding="utf-8")

            self.assertEqual(result.returncode, 0)
            self.assertNotIn(secret, text)
            self.assertNotIn("body-secret", text)
            self.assertNotIn("Review status", text)
            self.assertNotIn("standalone-pass-secret", text)
            self.assertIn("[REDACTED]", text)
            self.assertIn("PASS: No metadata leaks detected.", text)

    def test_missing_executable_is_a_missing_toolchain_finding(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = execute_command(
                CommandSpec(("softbook-command-that-does-not-exist",)),
                timeout_seconds=1,
                log_path=Path(tmpdir) / "missing.log",
                verbose=False,
            )
        outcome = command_outcome(result)
        self.assertEqual(outcome.status, "failed")
        self.assertEqual(outcome.findings[0]["type"], "missing_toolchain")

    def test_remote_unavailable_is_an_attributed_pr_context_finding(self):
        context = self.context(options=self.options(profile="pr"))

        def unavailable(_arguments):
            raise RuntimeError("GitHub unavailable")

        outcome = resolve_pr_context(context, capture=unavailable)
        self.assertEqual(outcome.status, "failed")
        self.assertEqual(outcome.findings[0]["type"], "remote_unavailable")

    def test_missing_unique_pr_context_fails_closed(self):
        context = self.context(options=self.options(profile="pr"))
        outcome = resolve_pr_context(context, capture=lambda _arguments: [])
        self.assertEqual(outcome.status, "failed")
        self.assertEqual(outcome.findings[0]["type"], "pr_context_ambiguous")

    def test_pr_context_rejects_malformed_remote_fields_and_stale_base(self):
        context = self.context(options=self.options(profile="pr", pr=413))
        malformed = resolve_pr_context(context, capture=lambda _arguments: {"number": 413})
        self.assertEqual(malformed.status, "failed")
        self.assertEqual(malformed.findings[0]["type"], "remote_response_invalid")

        context = self.context(options=self.options(profile="pr", pr=413, base="origin/main"))
        remote = {
            "number": 413,
            "url": "https://github.com/LENKIN233/softbook_cet/pull/413",
            "state": "OPEN",
            "isDraft": True,
            "body": "",
            "baseRefName": "main",
            "baseRefOid": "1" * 40,
            "headRefName": context.branch,
            "headRefOid": context.head,
        }
        with mock.patch("local_gates.checks.git_output", return_value="2" * 40):
            stale = resolve_pr_context(context, capture=lambda _arguments: remote)
        self.assertEqual(stale.status, "failed")
        self.assertIn("base_ref_stale", [finding["type"] for finding in stale.findings])

    def test_pending_agent_review_and_missing_pr_body_fail_real_pr_gate(self):
        gate = replace(
            next(gate for gate in build_catalog() if gate.id == "agent-review"),
            network=True,
        )
        pending_body = """## 当前任务引用的 spec

- `spec/harness-architecture.json`

## 变更摘要

- Governance-only change.

## 验证

- [x] `python3 scripts/validate_harness.py`

## Agent review

- Reviewer: Codex
- Review status: Pending
- Blocking findings: Pending
- Review summary: Pending

## Agent run record

- Run record: docs/agent-runs/example.md

## 设计稿来源（用户可见 UI 如适用）

- N/A

## design_review_checklist（如适用）

- N/A
"""
        for label, body in (("pending", pending_body), ("missing", "")):
            context = self.context(
                options=self.options(profile="pr"),
                pr_context={"base_sha": tracked_snapshot()["head"]},
                pr_body=body,
            )
            outcome, _duration = execute_gate(
                context,
                gate,
                self.test_root / f"{label}-agent-review.log",
            )
            self.assertEqual(outcome.status, "failed", label)
            self.assertEqual(outcome.findings[0]["type"], "command_failure", label)

    def test_dependency_exceptions_remain_visible_in_report_state(self):
        context = self.context(options=self.options(profile="pr"))
        report = {
            "schema_version": "dependency-security-report.v1",
            "ok": True,
            "targets": [
                {
                    "id": "cloudbase-api",
                    "ok": True,
                    "vulnerabilities": {"high": 3, "total": 3},
                    "advisories": [
                        {
                            "id": "GHSA-example",
                            "package": "lodash.set",
                            "severity": "high",
                        }
                    ],
                }
            ],
        }
        outcome = evaluate_dependency_report(
            CommandResult(returncode=0, duration_ms=1, output=json.dumps(report)),
            context,
        )

        self.assertEqual(outcome.status, "passed_with_exception")
        self.assertEqual(outcome.details["targets"][0]["vulnerabilities"]["high"], 3)
        self.assertEqual(context.safe_exceptions[0]["package"], "lodash.set")

    def test_dev_toolchain_drift_is_exception_but_pr_drift_fails(self):
        toolchain = {
            "python": "3.12.13",
            "node": "25.9.0",
            "ruby": "2.6.10",
            "bundler": None,
            "git_lfs": "git-lfs/3.7.1",
            "xcode": ["Xcode 26"],
            "expected": {"python": "3.12.x", "node": "22.13.0", "ruby": "3.3.x"},
        }
        with mock.patch("local_gates.checks.collect_toolchain", return_value=toolchain):
            dev_context = self.context(options=self.options(profile="dev"))
            pr_context = self.context(options=self.options(profile="pr"))
            dev = evaluate_toolchain(dev_context)
            pr = evaluate_toolchain(pr_context)

        self.assertEqual(dev.status, "passed_with_exception")
        self.assertEqual(dev_context.safe_exceptions[0]["code"], "dev_node_version_drift")
        self.assertEqual(pr.status, "failed")
        self.assertEqual(len(pr.findings), 2)

    def test_release_profile_fails_outside_macos(self):
        with mock.patch("local_gates.checks.platform.system", return_value="Linux"):
            outcome = evaluate_release_platform()
        self.assertEqual(outcome.status, "failed")
        self.assertEqual(outcome.findings[0]["type"], "unsupported_platform")

    def test_tracked_snapshot_detects_and_preserves_user_changes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True)
            tracked = repo / "tracked.txt"
            tracked.write_text("before\n", encoding="utf-8")
            subprocess.run(["git", "add", "tracked.txt"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "-q", "-m", "initial"], cwd=repo, check=True)
            before = tracked_snapshot(cwd=repo)
            tracked.write_text("after\n", encoding="utf-8")
            after = tracked_snapshot(cwd=repo)

            self.assertNotEqual(before["digest"], after["digest"])
            self.assertEqual(tracked.read_text(encoding="utf-8"), "after\n")

    def test_catalog_assigns_explicit_timeouts_and_fixed_status_contract(self):
        catalog = build_catalog()
        self.assertTrue(all(gate.timeout_seconds > 0 for gate in catalog))
        self.assertEqual(len({gate.id for gate in catalog}), len(catalog))

    def test_local_gate_modules_have_bounded_ownership(self):
        modules = {
            "model.py": (120, "class GateSpec"),
            "execution.py": (450, "def execute_command"),
            "checks.py": (400, "def resolve_pr_context"),
            "catalog.py": (500, "def build_catalog"),
            "runner.py": (550, "def run"),
        }
        for filename, (line_limit, owner_marker) in modules.items():
            path = ROOT / "scripts" / "local_gates" / filename
            text = path.read_text(encoding="utf-8")
            self.assertLessEqual(len(text.splitlines()), line_limit, filename)
            self.assertIn(owner_marker, text, filename)


if __name__ == "__main__":
    unittest.main()
