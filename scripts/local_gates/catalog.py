from __future__ import annotations

import sys
from typing import Iterable, Mapping

from .model import CommandSpec, GateSpec, PROFILES, ROOT, RunContext


def all_profiles() -> frozenset[str]:
    return frozenset(PROFILES)


def pr_profiles() -> frozenset[str]:
    return frozenset(("pr", "release"))


def artifact(context: RunContext, name: str) -> str:
    return str(context.artifacts_dir / name)


def pr_body_environment(context: RunContext) -> Mapping[str, str]:
    return {"PR_BODY": context.pr_body or ""}


def resolved_base(context: RunContext) -> str:
    if context.pr_context:
        return str(context.pr_context["base_sha"])
    if context.options.base:
        return context.options.base
    return "origin/main"


def build_catalog() -> tuple[GateSpec, ...]:
    dev = all_profiles()
    pr = pr_profiles()
    release = frozenset(("release",))
    mobile = ROOT / "apps" / "mobile"
    backend = ROOT / "infra" / "cloudbase" / "functions" / "softbook-api"

    return (
        GateSpec("toolchain", dev, 30, False, special="toolchain", stage=0),
        GateSpec(
            "network-isolation",
            dev,
            10,
            False,
            special="network_isolation",
            stage=1,
        ),
        GateSpec(
            "harness-runner-tests",
            dev,
            120,
            False,
            lambda _: CommandSpec((sys.executable, "scripts/test_validate_harness_runner.py")),
        ),
        GateSpec(
            "harness-boundary-tests",
            dev,
            60,
            False,
            lambda _: CommandSpec((sys.executable, "scripts/test_harness_module_boundaries.py")),
        ),
        GateSpec(
            "local-gate-runner-tests",
            dev,
            120,
            False,
            lambda _: CommandSpec((sys.executable, "scripts/test_run_local_gates.py")),
        ),
        GateSpec(
            "design-scanner-tests",
            dev,
            60,
            False,
            lambda _: CommandSpec(("node", "--test", "scripts/test_check_design_metadata_leaks.mjs")),
        ),
        GateSpec(
            "harness-local",
            dev,
            120,
            False,
            lambda context: CommandSpec(
                (
                    sys.executable,
                    "scripts/validate_harness.py",
                    "--mode",
                    "local",
                    "--format",
                    "json",
                    "--output",
                    artifact(context, "harness-local.json"),
                )
            ),
        ),
        GateSpec(
            "maestro-contract",
            dev,
            60,
            False,
            lambda _: CommandSpec((sys.executable, "scripts/validate_maestro_selectors.py")),
        ),
        GateSpec(
            "launch-contract-tests",
            dev,
            60,
            False,
            lambda _: CommandSpec(("node", "--test", "scripts/test_validate_launch_readiness.mjs")),
        ),
        GateSpec(
            "launch-readiness",
            dev,
            60,
            False,
            lambda _: CommandSpec(("node", "scripts/validate_launch_readiness.mjs")),
        ),
        GateSpec(
            "mobile-metadata-scan",
            dev,
            120,
            False,
            lambda _: CommandSpec(("npm", "run", "metadata-leak-scan"), cwd=mobile),
        ),
        GateSpec(
            "design-metadata-scan",
            dev,
            120,
            False,
            lambda _: CommandSpec(("npm", "run", "design-metadata-leak-scan"), cwd=mobile),
        ),
        GateSpec(
            "mobile-lint",
            dev,
            180,
            False,
            lambda _: CommandSpec(("npm", "run", "lint", "--", "--quiet"), cwd=mobile),
        ),
        GateSpec(
            "mobile-typecheck",
            dev,
            180,
            False,
            lambda _: CommandSpec(("npm", "run", "typecheck"), cwd=mobile),
        ),
        GateSpec(
            "mobile-jest",
            dev,
            300,
            False,
            lambda _: CommandSpec(
                (
                    "npm",
                    "test",
                    "--",
                    "--runInBand",
                    "--watchAll=false",
                    "--no-watchman",
                ),
                cwd=mobile,
            ),
        ),
        GateSpec(
            "backend-tests",
            dev,
            180,
            False,
            lambda _: CommandSpec(("npm", "test"), cwd=backend),
        ),
        GateSpec("pr-context", pr, 45, True, special="pr_context", stage=20),
        GateSpec(
            "harness-full",
            pr,
            180,
            True,
            lambda context: CommandSpec(
                (
                    sys.executable,
                    "scripts/validate_harness.py",
                    "--mode",
                    "full",
                    "--format",
                    "json",
                    "--output",
                    artifact(context, "harness-full.json"),
                )
            ),
            stage=21,
        ),
        GateSpec(
            "pr-design-gate",
            pr,
            60,
            False,
            lambda context: CommandSpec(
                (
                    sys.executable,
                    "scripts/validate_pr_design_gate.py",
                    "--base",
                    resolved_base(context),
                    "--head",
                    "HEAD",
                ),
                env=pr_body_environment(context),
            ),
            requires_pr_context=True,
            stage=21,
        ),
        GateSpec(
            "agent-review",
            pr,
            60,
            False,
            lambda context: CommandSpec(
                (sys.executable, "scripts/validate_agent_review.py"),
                env=pr_body_environment(context),
            ),
            requires_pr_context=True,
            stage=21,
        ),
        GateSpec(
            "dependency-policy-tests",
            pr,
            60,
            False,
            lambda _: CommandSpec(("node", "scripts/test_validate_dependency_security.mjs")),
            stage=21,
        ),
        GateSpec(
            "podspec-policy-tests",
            pr,
            60,
            False,
            lambda _: CommandSpec(("node", "scripts/test_normalize_react_native_podspecs.mjs")),
            stage=21,
        ),
        GateSpec(
            "dependency-security",
            pr,
            240,
            True,
            lambda _: CommandSpec(
                ("node", "scripts/validate_dependency_security.mjs"),
                capture_output=True,
            ),
            special="dependency_report",
            stage=21,
        ),
        GateSpec(
            "repo-health-tests",
            pr,
            60,
            False,
            lambda _: CommandSpec(("node", "scripts/test_report_repo_health.mjs")),
            stage=21,
        ),
        GateSpec(
            "repo-health-strict",
            pr,
            120,
            True,
            lambda context: CommandSpec(
                (
                    "node",
                    "scripts/report_repo_health.mjs",
                    "--base",
                    resolved_base(context),
                    "--remote",
                    "--strict",
                    "--expected-max-worktrees",
                    "1",
                    "--expected-max-stashes",
                    "0",
                    "--expected-max-topic-branches",
                    "1",
                    "--require-upstreams",
                    "--output",
                    artifact(context, "repository-health.json"),
                )
            ),
            stage=21,
        ),
        GateSpec(
            "git-lfs",
            pr,
            120,
            False,
            lambda _: CommandSpec(("git", "lfs", "fsck")),
            stage=21,
        ),
        GateSpec(
            "evidence-tests",
            pr,
            60,
            False,
            lambda _: CommandSpec(("node", "--test", "scripts/test_validate_agent_run_evidence.mjs")),
            stage=21,
        ),
        GateSpec(
            "evidence-remote",
            pr,
            180,
            True,
            lambda _: CommandSpec(
                ("node", "scripts/validate_agent_run_evidence.mjs", "--verify-remote")
            ),
            stage=21,
        ),
        GateSpec(
            "release-platform",
            release,
            10,
            False,
            special="release_platform",
            stage=30,
        ),
        GateSpec(
            "ruby-bundle-preflight",
            release,
            120,
            False,
            lambda _: CommandSpec(("bundle", "check"), cwd=mobile),
            stage=31,
        ),
        GateSpec(
            "cocoapods-lock",
            release,
            600,
            True,
            lambda _: CommandSpec(
                (
                    "bundle",
                    "exec",
                    "pod",
                    "install",
                    "--project-directory=ios",
                    "--deployment",
                ),
                cwd=mobile,
            ),
            stage=32,
        ),
        GateSpec(
            "ios-release-simulator",
            release,
            3600,
            False,
            lambda context: CommandSpec(
                (
                    "xcodebuild",
                    "-workspace",
                    "ios/SoftbookCET.xcworkspace",
                    "-scheme",
                    "SoftbookCET",
                    "-configuration",
                    "Release",
                    "-sdk",
                    "iphonesimulator",
                    "-destination",
                    "generic/platform=iOS Simulator",
                    "-derivedDataPath",
                    artifact(context, "ios-simulator-derived"),
                    "CODE_SIGNING_ALLOWED=NO",
                    "CODE_SIGNING_REQUIRED=NO",
                    "build",
                ),
                cwd=mobile,
            ),
            stage=33,
        ),
        GateSpec(
            "ios-unsigned-archive",
            release,
            3600,
            False,
            lambda context: CommandSpec(
                (
                    "xcodebuild",
                    "-workspace",
                    "ios/SoftbookCET.xcworkspace",
                    "-scheme",
                    "SoftbookCET",
                    "-configuration",
                    "Release",
                    "-destination",
                    "generic/platform=iOS",
                    "-archivePath",
                    artifact(context, "SoftbookCET.xcarchive"),
                    "-derivedDataPath",
                    artifact(context, "ios-device-derived"),
                    "CODE_SIGNING_ALLOWED=NO",
                    "CODE_SIGNING_REQUIRED=NO",
                    "archive",
                ),
                cwd=mobile,
            ),
            stage=34,
        ),
    )


def selected_gates(
    profile: str,
    catalog: Iterable[GateSpec] | None = None,
) -> tuple[GateSpec, ...]:
    catalog = tuple(catalog or build_catalog())
    return tuple(gate for gate in catalog if profile in gate.profiles)
