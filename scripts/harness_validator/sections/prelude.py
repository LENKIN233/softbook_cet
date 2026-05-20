import json
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "spec"
errors = []
SKIP_REMOTE_GUARD = "--skip-remote-guard" in sys.argv


def load(name: str):
    return json.loads((SPEC / name).read_text(encoding="utf-8"))


def check_equal(label, expected, actual):
    if expected != actual:
        errors.append(f"{label}: expected {expected!r}, got {actual!r}")


def check_contains(label, text, expected):
    if expected not in text:
        errors.append(f"{label}: missing exact snippet {expected!r}")


def find_by_id(entries, entry_id):
    for entry in entries:
        if entry["id"] == entry_id:
            return entry

    errors.append(f"missing entry id: {entry_id}")
    return None


def run_command(*args):
    try:
        return subprocess.run(
            args,
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        errors.append(f"missing required command: {args[0]}")
        return None


def run_design_gate_case(body: str, changed_files: list[str]):
    args = [sys.executable, str(ROOT / "scripts" / "validate_pr_design_gate.py")]
    for changed_file in changed_files:
        args.extend(["--changed-file", changed_file])

    return subprocess.run(
        args,
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "PR_BODY": body},
    )


def load_design_gate_module():
    path = ROOT / "scripts" / "validate_pr_design_gate.py"
    spec = importlib.util.spec_from_file_location("validate_pr_design_gate", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


req = load("requirement-memory.json")
auth = load("account-sync-contract.json")
platform = load("platform-contract.json")
product = load("product-core.json")
membership = load("membership.json")
delivery = load("repo-delivery-contract.json")
interactions = load("interactions.json")
manifest = load("doc-manifest.json")
authority = load("authority-map.json")
harness = load("agent-harness.json")
harness_architecture = load("harness-architecture.json")
evals = load("evals.json")
perturbation_audit = load("perturbation-audit.json")

literal_source_anchors = {
    "login_gate": "必须登入",
    "primary_login_method": "手机号+验证码",
    "purchase_authority": "web与app购买同权",
    "top_level_navigation": "三端信息架构导航是一致的：学习 空间 统计 我的",
    "audio_presentation_policy": "不自动播放，没有字幕（背面可以有）",
    "default_learning_path": "建议用户按照我们拟定的顺序学习，不建议用户按模块学习",
}


def anchor_texts(*keys):
    return [literal_source_anchors[key] for key in keys]
