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

    def test_runtime_document_cannot_hide_contract_only_status(self):
        weakened = self.runtime_text.replace(
            "This contract-only artifact does not prove",
            "This contract proves",
        )
        self.assert_finding(
            self.findings(text=weakened),
            "runtime contract missing exact snippet",
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
