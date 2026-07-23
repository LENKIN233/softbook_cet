#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from harness_validator.sections.product_contract_mirrors import (
    learning_events_contract_findings,
)


ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "spec"
RUNTIME_CONTRACT = ROOT / "infra/cloudbase/learning-events-v2-runtime-contract.md"


def load_json(name: str):
    return json.loads((SPEC / name).read_text(encoding="utf-8"))


class LearningEventsContractTests(unittest.TestCase):
    def setUp(self):
        self.auth = load_json("account-sync-contract.json")
        self.runtime = load_json("runtime-boundaries.json")
        self.agent = load_json("agent-harness.json")
        self.evals = load_json("evals.json")
        self.runtime_text = RUNTIME_CONTRACT.read_text(encoding="utf-8")
        self.agent_entry_text = (ROOT / "AGENTS.md").read_text(encoding="utf-8")

    def findings(
        self,
        *,
        auth=None,
        runtime=None,
        agent=None,
        evals=None,
        text=None,
        agent_entry_text=None,
    ):
        return learning_events_contract_findings(
            auth if auth is not None else self.auth,
            runtime if runtime is not None else self.runtime,
            agent if agent is not None else self.agent,
            evals if evals is not None else self.evals,
            text if text is not None else self.runtime_text,
            agent_entry_text
            if agent_entry_text is not None
            else self.agent_entry_text,
        )

    def assert_finding(self, findings, marker):
        self.assertTrue(
            any(marker in finding for finding in findings),
            f"expected finding containing {marker!r}, got {findings!r}",
        )

    def test_active_learning_events_contract_is_internally_consistent(self):
        self.assertEqual(self.findings(), [])

    def test_missing_stable_event_identity_and_four_grade_drift_fail(self):
        missing_id = copy.deepcopy(self.auth)
        missing_id["learning_events_v2"]["event_contract"]["required_fields"].remove(
            "event_id"
        )
        four_grade = copy.deepcopy(self.auth)
        four_grade["learning_events_v2"]["event_contract"]["answer_grade_values"] = [
            "again",
            "hard",
            "good",
            "easy",
        ]

        self.assert_finding(self.findings(auth=missing_id), "event fields")
        self.assert_finding(self.findings(auth=four_grade), "answer grades")

    def test_mutated_replay_and_device_cursor_fork_cannot_be_weakened(self):
        replay = copy.deepcopy(self.auth)
        replay["learning_events_v2"]["idempotency_and_atomicity"]["exact_replay"] = (
            "accept and increment again"
        )
        event_conflict = copy.deepcopy(self.auth)
        event_conflict["learning_events_v2"]["idempotency_and_atomicity"][
            "event_id_conflict"
        ] = "overwrite the old payload"
        cursor_conflict = copy.deepcopy(self.auth)
        cursor_conflict["learning_events_v2"]["idempotency_and_atomicity"][
            "device_cursor_conflict"
        ] = "allow cursor reuse"

        self.assert_finding(self.findings(auth=replay), "exact replay")
        self.assert_finding(self.findings(auth=event_conflict), "event conflict")
        self.assert_finding(self.findings(auth=cursor_conflict), "device cursor conflict")

    def test_client_snapshots_and_exact_resume_claims_fail(self):
        snapshot_authority = copy.deepcopy(self.auth)
        snapshot_authority["learning_events_v2"]["event_contract"][
            "forbidden_fields"
        ].remove("total_completed_count")
        exact_resume = copy.deepcopy(self.runtime)
        exact_resume["learning_event_runtime"][
            "exact_same_card_cross_device_resume_required"
        ] = True
        client_ordering = copy.deepcopy(self.auth)
        client_ordering["default_sync_strategy"]["ordering_basis"] = [
            "client_occurred_at"
        ]

        self.assert_finding(
            self.findings(auth=snapshot_authority),
            "forbidden client authority",
        )
        self.assert_finding(
            self.findings(runtime=exact_resume),
            "runtime exact resume boundary",
        )
        self.assert_finding(
            self.findings(auth=client_ordering),
            "default ordering basis",
        )

    def test_runtime_read_path_and_eval_regressions_are_required(self):
        missing_read_path = copy.deepcopy(self.agent)
        missing_read_path["read_paths"]["learning_events_runtime"].remove(
            "infra/cloudbase/learning-events-v2-runtime-contract.md"
        )
        missing_eval_marker = copy.deepcopy(self.evals)
        hr37 = next(
            item for item in missing_eval_marker["regressions"] if item["id"] == "HR-37"
        )
        hr37["must_hit"].remove("server_sequence_is_canonical_ordering")

        self.assert_finding(
            self.findings(agent=missing_read_path),
            "agent read path learning_events_runtime",
        )
        self.assert_finding(
            self.findings(evals=missing_eval_marker),
            "HR-37 must_hit drift",
        )

        missing_implementation_eval = copy.deepcopy(self.evals)
        missing_implementation_eval["regressions"] = [
            item
            for item in missing_implementation_eval["regressions"]
            if item["id"] != "HR-38"
        ]
        self.assert_finding(
            self.findings(evals=missing_implementation_eval),
            "missing HR-38",
        )

    def test_runtime_document_cannot_hide_repository_local_non_claims(self):
        weakened = self.runtime_text.replace(
            "The repository-local backend and mobile implementation do not prove",
            "The repository-local backend and mobile implementation prove",
        )
        self.assert_finding(
            self.findings(text=weakened),
            "runtime contract missing exact snippet",
        )

    def test_backend_status_cannot_be_reverted_or_promoted_to_deployed(self):
        reverted = copy.deepcopy(self.auth)
        reverted["learning_events_v2"]["contract_status"] = (
            "defined_not_implemented"
        )
        promoted = copy.deepcopy(self.runtime)
        promoted["learning_event_runtime"]["deployment_status"] = "deployed"

        self.assert_finding(self.findings(auth=reverted), "status")
        self.assert_finding(
            self.findings(runtime=promoted),
            "runtime deployment boundary",
        )

    def test_mobile_producer_and_v1_write_boundaries_cannot_regress(self):
        missing_producer = copy.deepcopy(self.auth)
        missing_producer["learning_events_v2"]["implementation_progress"][
            "mobile_durable_event_producer"
        ] = False
        active_v1_write = copy.deepcopy(self.auth)
        active_v1_write["learning_events_v2"]["implementation_progress"][
            "mobile_active_v1_learning_snapshot_writes_disabled"
        ] = False
        unsafe_durability = copy.deepcopy(self.auth)
        unsafe_durability["learning_events_v2"]["mobile_client_contract"][
            "storage_rule"
        ] = "advance the card before best-effort persistence"
        missing_outbox = copy.deepcopy(self.runtime)
        missing_outbox["learning_event_runtime"]["mobile_outbox_schema"] = (
            "generic-mutation-queue.v1"
        )
        unsafe_replay = copy.deepcopy(self.runtime)
        unsafe_replay["learning_event_runtime"]["mobile_replay_boundary"] = (
            "replay_without_bootstrap_reconciliation"
        )
        unsafe_account_switch = copy.deepcopy(self.auth)
        unsafe_account_switch["learning_events_v2"]["mobile_client_contract"][
            "account_switch_rule"
        ] = "apply every late response to the current UI"
        unsafe_restore = copy.deepcopy(self.auth)
        unsafe_restore["learning_events_v2"]["mobile_client_contract"][
            "recovery_rule"
        ] = "allow the restored stale card to enqueue another completion"
        runtime_v1_write = copy.deepcopy(self.runtime)
        runtime_v1_write["learning_event_runtime"][
            "mobile_active_v1_learning_snapshot_writes"
        ] = True
        unsafe_runtime_restore = copy.deepcopy(self.runtime)
        unsafe_runtime_restore["learning_event_runtime"][
            "mobile_restore_boundary"
        ] = "restored_outbox_does_not_gate_card_advance"
        unsafe_request_lifecycle = copy.deepcopy(self.auth)
        unsafe_request_lifecycle["learning_events_v2"]["mobile_client_contract"][
            "request_lifecycle_rule"
        ] = "wait forever and increment retry after session replacement"
        unbounded_runtime = copy.deepcopy(self.runtime)
        unbounded_runtime["learning_event_runtime"][
            "mobile_authenticated_request_timeout_ms"
        ] = None

        self.assert_finding(
            self.findings(auth=missing_producer),
            "mobile producer boundary",
        )
        self.assert_finding(
            self.findings(auth=active_v1_write),
            "mobile active v1 learning write boundary",
        )
        self.assert_finding(
            self.findings(auth=unsafe_durability),
            "mobile durable storage owner contract",
        )
        self.assert_finding(
            self.findings(runtime=missing_outbox),
            "runtime mobile outbox schema",
        )
        self.assert_finding(
            self.findings(runtime=unsafe_replay),
            "runtime mobile replay boundary",
        )
        self.assert_finding(
            self.findings(auth=unsafe_account_switch),
            "mobile account switch owner contract",
        )
        self.assert_finding(
            self.findings(auth=unsafe_restore),
            "mobile restored outbox owner contract",
        )
        self.assert_finding(
            self.findings(runtime=runtime_v1_write),
            "runtime mobile active v1 learning writes",
        )
        self.assert_finding(
            self.findings(runtime=unsafe_runtime_restore),
            "runtime mobile restore boundary",
        )
        self.assert_finding(
            self.findings(auth=unsafe_request_lifecycle),
            "mobile request lifecycle owner contract",
        )
        self.assert_finding(
            self.findings(runtime=unbounded_runtime),
            "runtime mobile authenticated request timeout",
        )

    def test_mobile_golden_task_and_durable_runtime_proof_are_required(self):
        missing_gt30 = copy.deepcopy(self.evals)
        missing_gt30["golden_tasks"] = [
            item for item in missing_gt30["golden_tasks"] if item["id"] != "GT-30"
        ]
        weakened_gt30 = copy.deepcopy(self.evals)
        gt30 = next(
            item for item in weakened_gt30["golden_tasks"] if item["id"] == "GT-30"
        )
        gt30["must_include"].remove("storage_failure_does_not_advance_the_card")
        hidden_durability = self.runtime_text.replace(
            "advancing the card UI. A failed durable write leaves the current result in",
            "advancing the card UI even when durable storage fails",
        )

        self.assert_finding(self.findings(evals=missing_gt30), "missing GT-30")
        self.assert_finding(
            self.findings(evals=weakened_gt30),
            "GT-30 must_include drift",
        )
        self.assert_finding(
            self.findings(text=hidden_durability),
            "runtime contract missing exact snippet",
        )

    def test_request_deadline_regression_and_runtime_proof_are_required(self):
        missing_hr39 = copy.deepcopy(self.evals)
        missing_hr39["regressions"] = [
            item for item in missing_hr39["regressions"] if item["id"] != "HR-39"
        ]
        weakened_gt30 = copy.deepcopy(self.evals)
        gt30 = next(
            item for item in weakened_gt30["golden_tasks"] if item["id"] == "GT-30"
        )
        gt30["must_include"].remove(
            "caller_or_session_cancellation_keeps_event_retry_state_unchanged"
        )
        hidden_deadline = self.runtime_text.replace(
            "Every remote authentication call has a 15-second deadline",
            "Remote authentication may wait without a deadline",
        )

        self.assert_finding(self.findings(evals=missing_hr39), "missing HR-39")
        self.assert_finding(
            self.findings(evals=weakened_gt30),
            "GT-30 must_include drift",
        )
        self.assert_finding(
            self.findings(text=hidden_deadline),
            "runtime contract missing exact snippet",
        )

    def test_migrated_daily_bridge_cannot_regain_learning_authority(self):
        weakened = copy.deepcopy(self.auth)
        weakened["learning_events_v2"]["migration_boundary"][
            "migrated_account_write_rule"
        ] = "accept every v1 progress counter after migration"
        missing_eval = copy.deepcopy(self.evals)
        gt29 = next(
            item for item in missing_eval["golden_tasks"] if item["id"] == "GT-29"
        )
        gt29["must_include"].remove(
            "migrated_daily_progress_cannot_override_v2_learning_or_space_counts"
        )

        self.assert_finding(
            self.findings(auth=weakened),
            "migrated account write rule",
        )
        self.assert_finding(
            self.findings(evals=missing_eval),
            "GT-29 must_include drift",
        )

    def test_cloudbase_transaction_limits_and_migration_fence_are_required(self):
        unsafe_batch = copy.deepcopy(self.auth)
        unsafe_batch["learning_events_v2"]["implementation_progress"][
            "cloudbase_atomic_batch_limit"
        ] = 100
        unsafe_transaction = copy.deepcopy(self.runtime)
        unsafe_transaction["learning_event_runtime"][
            "cloudbase_transaction_boundary"
        ] = "where_queries_allowed"
        missing_fence_eval = copy.deepcopy(self.evals)
        missing_all_track_migration = copy.deepcopy(self.auth)
        del missing_all_track_migration["learning_events_v2"][
            "implementation_progress"
        ]["legacy_all_track_projection_migration"]
        gt29 = next(
            item
            for item in missing_fence_eval["golden_tasks"]
            if item["id"] == "GT-29"
        )
        gt29["must_include"].remove(
            "legacy_migration_snapshot_uses_transactional_revision_fence"
        )

        self.assert_finding(
            self.findings(auth=unsafe_batch),
            "CloudBase atomic batch limit",
        )
        self.assert_finding(
            self.findings(runtime=unsafe_transaction),
            "runtime CloudBase transaction boundary",
        )
        self.assert_finding(
            self.findings(evals=missing_fence_eval),
            "GT-29 must_include drift",
        )
        self.assert_finding(
            self.findings(auth=missing_all_track_migration),
            "all-track legacy projection migration",
        )

    def test_agent_entry_must_keep_runtime_contract_discoverable(self):
        hidden = self.agent_entry_text.replace(
            "infra/cloudbase/learning-events-v2-runtime-contract.md",
            "infra/cloudbase/bootstrap-v2-runtime-contract.md",
        )
        self.assert_finding(
            self.findings(agent_entry_text=hidden),
            "Agent entry runtime path",
        )


if __name__ == "__main__":
    unittest.main()
