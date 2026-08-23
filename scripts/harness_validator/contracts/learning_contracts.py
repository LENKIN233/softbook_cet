from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[3]


def _load_json(path: str) -> dict[str, Any]:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


CANONICAL_ACCOUNT = _load_json("spec/account-sync-contract.json")
CANONICAL_RUNTIME = _load_json("spec/runtime-boundaries.json")
CANONICAL_AGENT = _load_json("spec/agent-harness.json")
CANONICAL_EVALS = _load_json("spec/evals.json")
MISSING = object()


def _read(value: Any, path: tuple[str, ...]) -> Any:
    current = value
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return MISSING
        current = current[key]
    return current


def _check_owner_paths(
    findings: list[str],
    candidate: dict[str, Any],
    canonical: dict[str, Any],
    checks: Iterable[tuple[tuple[str, ...], str]],
) -> None:
    for path, label in checks:
        if _read(candidate, path) != _read(canonical, path):
            findings.append(f"{label}: owner behavior invariant drift")


def _entry(entries: Any, entry_id: str) -> dict[str, Any] | None:
    if not isinstance(entries, list):
        return None
    return next(
        (
            item
            for item in entries
            if isinstance(item, dict) and item.get("id") == entry_id
        ),
        None,
    )


def _check_eval_entry(
    findings: list[str],
    evals: dict[str, Any],
    collection: str,
    entry_id: str,
    drift_label: str,
) -> None:
    candidate = _entry(evals.get(collection), entry_id)
    canonical = _entry(CANONICAL_EVALS.get(collection), entry_id)
    if candidate is None:
        findings.append(f"missing {entry_id}")
    elif canonical is not None and candidate != canonical:
        findings.append(drift_label)


def _check_snippets(
    findings: list[str],
    text: str,
    snippets: Iterable[str],
) -> None:
    for snippet in snippets:
        if snippet not in text:
            findings.append(
                f"runtime contract missing exact snippet: {snippet!r}"
            )


EVENT_OWNER_CHECKS = (
    (("learning_events_v2", "event_contract", "required_fields"), "event fields"),
    (("learning_events_v2", "event_contract", "answer_grade_values"), "answer grades"),
    (("learning_events_v2", "event_contract", "forbidden_fields"), "forbidden client authority"),
    (("learning_events_v2", "idempotency_and_atomicity", "exact_replay"), "exact replay"),
    (("learning_events_v2", "idempotency_and_atomicity", "event_id_conflict"), "event conflict"),
    (("learning_events_v2", "idempotency_and_atomicity", "device_cursor_conflict"), "device cursor conflict"),
    (("learning_events_v2", "idempotency_and_atomicity", "mixed_batch_rule"), "selection-bound mixed batch"),
    (("learning_events_v2", "contract_status"), "learning-events status"),
    (("learning_events_v2", "implementation_progress", "mobile_durable_event_producer"), "mobile producer boundary"),
    (("learning_events_v2", "implementation_progress", "mobile_active_v1_learning_snapshot_writes_disabled"), "mobile active v1 learning write boundary"),
    (("learning_events_v2", "implementation_progress", "cloudbase_atomic_batch_limit"), "CloudBase atomic batch limit"),
    (("learning_events_v2", "implementation_progress", "legacy_all_track_projection_migration"), "all-track legacy projection migration"),
    (("learning_events_v2", "mobile_client_contract", "storage_rule"), "mobile durable storage owner contract"),
    (("learning_events_v2", "mobile_client_contract", "account_switch_rule"), "mobile account switch owner contract"),
    (("learning_events_v2", "mobile_client_contract", "recovery_rule"), "mobile restored outbox owner contract"),
    (("learning_events_v2", "mobile_client_contract", "request_lifecycle_rule"), "mobile request lifecycle owner contract"),
    (("learning_events_v2", "migration_boundary", "migrated_account_write_rule"), "migrated account write rule"),
    (("default_sync_strategy", "ordering_basis"), "default ordering basis"),
    (("daily_check_in_v2", "command_contract", "required_fields"), "daily check-in required fields"),
    (("daily_check_in_v2", "command_contract", "storage_adapter_rule"), "daily check-in storage adapter"),
    (("daily_check_in_v2", "mobile_contract", "trigger_rule"), "daily check-in mobile trigger"),
    (("daily_check_in_v2", "mobile_contract", "offline_rule"), "daily check-in offline queue"),
    (("daily_check_in_v2", "mobile_contract", "recovery_rule"), "daily check-in restart recovery"),
    (("daily_check_in_v2", "mobile_contract", "legacy_queue_rule"), "daily check-in legacy queue"),
    (("daily_check_in_v2", "legacy_cutover", "disabled_routes"), "daily check-in disabled routes"),
)

EVENT_RUNTIME_CHECKS = (
    (("learning_event_runtime", "exact_same_card_cross_device_resume_required"), "runtime exact resume boundary"),
    (("learning_event_runtime", "deployment_status"), "runtime deployment boundary"),
    (("learning_event_runtime", "mobile_outbox_schema"), "runtime mobile outbox schema"),
    (("learning_event_runtime", "mobile_replay_boundary"), "runtime mobile replay boundary"),
    (("learning_event_runtime", "mobile_active_v1_learning_snapshot_writes"), "runtime mobile active v1 learning writes"),
    (("learning_event_runtime", "mobile_restore_boundary"), "runtime mobile restore boundary"),
    (("learning_event_runtime", "mobile_authenticated_request_timeout_ms"), "runtime mobile authenticated request timeout"),
    (("learning_event_runtime", "selection_binding"), "runtime selection binding"),
    (("learning_event_runtime", "cloudbase_transaction_boundary"), "runtime CloudBase transaction boundary"),
    (("daily_check_in_runtime", "endpoint"), "runtime daily check-in endpoint"),
)

EVENT_RUNTIME_SNIPPETS = (
    "The repository-local backend, scheduler, and mobile binding do not prove",
    "positive device sequence before advancing the card UI.",
    "Every remote authentication call has a 15-second deadline",
    'the exact body `{"day_key":"YYYY-MM-DD"}`',
)


def learning_events_contract_findings(
    auth: dict[str, Any],
    runtime: dict[str, Any],
    agent: dict[str, Any],
    evals: dict[str, Any],
    runtime_text: str,
    agent_entry_text: str,
    provision_text: str,
) -> list[str]:
    """Return concise findings for learning-event behavioral drift.

    The account-sync contract is the owner. Long prose values are compared to
    that owner at runtime instead of being copied into this module.
    """

    findings: list[str] = []
    _check_owner_paths(findings, auth, CANONICAL_ACCOUNT, EVENT_OWNER_CHECKS)
    _check_owner_paths(findings, runtime, CANONICAL_RUNTIME, EVENT_RUNTIME_CHECKS)

    if _read(agent, ("read_paths", "learning_events_runtime")) != _read(
        CANONICAL_AGENT,
        ("read_paths", "learning_events_runtime"),
    ):
        findings.append("agent read path learning_events_runtime drift")

    for collection, entry_id, label in (
        ("regressions", "HR-37", "HR-37 must_hit drift"),
        ("regressions", "HR-38", "HR-38 must_hit drift"),
        ("regressions", "HR-39", "HR-39 must_hit drift"),
        ("regressions", "HR-41", "HR-41 must_hit drift"),
        ("regressions", "HR-42", "HR-42 must_hit drift"),
        ("golden_tasks", "GT-29", "GT-29 must_include drift"),
        ("golden_tasks", "GT-30", "GT-30 must_include drift"),
        ("golden_tasks", "GT-32", "GT-32 must_include drift"),
        ("golden_tasks", "GT-33", "GT-33 must_include drift"),
    ):
        _check_eval_entry(findings, evals, collection, entry_id, label)

    _check_snippets(findings, runtime_text, EVENT_RUNTIME_SNIPPETS)
    if "infra/cloudbase/learning-events-v2-runtime-contract.md" not in agent_entry_text:
        findings.append("Agent entry runtime path is missing")
    for collection in (
        "softbook_learning_events",
        "softbook_learning_event_cursors",
        "softbook_learning_event_sequences",
        "softbook_learning_states",
        "softbook_daily_check_ins",
    ):
        if collection not in provision_text:
            findings.append(f"provisioning is missing {collection}")
    return findings


SCHEDULER_OWNER_CHECKS = (
    (("server_scheduler_v1", "endpoint", "identity_rule"), "scheduler identity authority"),
    (("server_scheduler_v1", "algorithm_contract", "visible_assessment_rule"), "scheduler visible assessment"),
    (("server_scheduler_v1", "projection_contract", "duplicate_rule"), "scheduler duplicate rule"),
    (("server_scheduler_v1", "projection_contract", "atomicity"), "scheduler projection atomicity"),
    (("server_scheduler_v1", "selection_contract", "due_rule"), "scheduler due order"),
    (("server_scheduler_v1", "selection_contract", "sleep_rule"), "scheduler sleep authority"),
    (("server_scheduler_v1", "selection_contract", "membership_rule"), "scheduler membership authority"),
    (("server_scheduler_v1", "selection_contract", "future_rule"), "scheduler empty-selection consistency"),
    (("server_scheduler_v1", "response_contract", "membership_stage_values"), "scheduler response membership stages"),
    (("server_scheduler_v1", "mobile_binding_contract", "session_read_rule"), "mobile session read binding"),
    (("server_scheduler_v1", "mobile_binding_contract", "advance_rule"), "mobile next-card binding"),
    (("server_scheduler_v1", "mobile_binding_contract", "membership_reconciliation_rule"), "mobile membership reconciliation"),
)

SCHEDULER_RUNTIME_CHECKS = (
    (("scheduler_runtime", "cursor_storage"), "scheduler runtime cursor storage"),
    (("scheduler_runtime", "empty_selection_consistency"), "scheduler runtime empty-selection consistency"),
    (("scheduler_runtime", "membership_mutation_atomicity"), "scheduler runtime membership mutation atomicity"),
    (("scheduler_runtime", "mobile_session_binding_status"), "scheduler runtime mobile binding"),
    (("scheduler_runtime", "deployment_status"), "scheduler runtime deployment"),
    (("scheduler_runtime", "launch_gate_status"), "scheduler runtime launch"),
    (("scheduler_runtime", "mobile_session_binding"), "scheduler runtime mobile binding behavior"),
)

SCHEDULER_RUNTIME_SNIPPETS = (
    "This backend and the mobile binding are repository-local and not deployed.",
    "dismissal cannot overwrite a premium purchase.",
    "and its `next_due_at` receive the same transactional watermark",
)


def learning_scheduler_contract_findings(
    auth: dict[str, Any],
    runtime: dict[str, Any],
    agent: dict[str, Any],
    evals: dict[str, Any],
    runtime_text: str,
    agent_entry_text: str,
    provision_text: str,
    package_text: str,
) -> list[str]:
    """Return concise findings for server-scheduler behavioral drift."""

    findings: list[str] = []
    _check_owner_paths(findings, auth, CANONICAL_ACCOUNT, SCHEDULER_OWNER_CHECKS)
    _check_owner_paths(
        findings,
        runtime,
        CANONICAL_RUNTIME,
        SCHEDULER_RUNTIME_CHECKS,
    )

    if _read(agent, ("read_paths", "learning_scheduler_runtime")) != _read(
        CANONICAL_AGENT,
        ("read_paths", "learning_scheduler_runtime"),
    ):
        findings.append("agent read path learning_scheduler_runtime drift")

    _check_eval_entry(
        findings,
        evals,
        "regressions",
        "HR-40",
        "HR-40 must_hit drift",
    )
    _check_eval_entry(
        findings,
        evals,
        "golden_tasks",
        "GT-31",
        "GT-31 must_include drift",
    )

    try:
        package = json.loads(package_text)
    except json.JSONDecodeError:
        package = {}
    expected_version = _read(
        auth,
        ("server_scheduler_v1", "algorithm_contract", "library_version"),
    )
    if package.get("dependencies", {}).get("ts-fsrs") != expected_version:
        findings.append("ts-fsrs must be pinned exactly to the owner version")

    if "softbook_learning_sessions" not in provision_text:
        findings.append("provisioning is missing softbook_learning_sessions")
    _check_snippets(findings, runtime_text, SCHEDULER_RUNTIME_SNIPPETS)
    if "infra/cloudbase/learning-session-v1-runtime-contract.md" not in agent_entry_text:
        findings.append("learning-scheduler Agent entry is missing")
    return findings
