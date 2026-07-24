#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from harness_validator.sections.product_contract_mirrors import (
    learning_scheduler_contract_findings,
)


ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "spec"
RUNTIME_CONTRACT = (
    ROOT / "infra/cloudbase/learning-session-v1-runtime-contract.md"
)
PROVISION = ROOT / "infra/cloudbase/provision-softbook-nosql.mjs"
PACKAGE = ROOT / "infra/cloudbase/functions/softbook-api/package.json"


def load_json(name: str):
    return json.loads((SPEC / name).read_text(encoding="utf-8"))


class LearningSchedulerContractTests(unittest.TestCase):
    def setUp(self):
        self.auth = load_json("account-sync-contract.json")
        self.runtime = load_json("runtime-boundaries.json")
        self.agent = load_json("agent-harness.json")
        self.evals = load_json("evals.json")
        self.runtime_text = RUNTIME_CONTRACT.read_text(encoding="utf-8")
        self.agent_entry_text = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
        self.provision_text = PROVISION.read_text(encoding="utf-8")
        self.package_text = PACKAGE.read_text(encoding="utf-8")

    def findings(
        self,
        *,
        auth=None,
        runtime=None,
        agent=None,
        evals=None,
        text=None,
        agent_entry_text=None,
        provision_text=None,
        package_text=None,
    ):
        return learning_scheduler_contract_findings(
            auth if auth is not None else self.auth,
            runtime if runtime is not None else self.runtime,
            agent if agent is not None else self.agent,
            evals if evals is not None else self.evals,
            text if text is not None else self.runtime_text,
            agent_entry_text
            if agent_entry_text is not None
            else self.agent_entry_text,
            provision_text
            if provision_text is not None
            else self.provision_text,
            package_text if package_text is not None else self.package_text,
        )

    def assert_finding(self, findings, marker):
        self.assertTrue(
            any(marker in finding for finding in findings),
            f"expected finding containing {marker!r}, got {findings!r}",
        )

    def test_active_learning_scheduler_contract_is_internally_consistent(self):
        self.assertEqual(self.findings(), [])

    def test_client_scheduler_authority_and_four_grade_drift_fail(self):
        client_authority = copy.deepcopy(self.auth)
        client_authority["server_scheduler_v1"]["endpoint"]["identity_rule"] = (
            "accept client card_id, due, and rating"
        )
        four_grade = copy.deepcopy(self.auth)
        four_grade["server_scheduler_v1"]["algorithm_contract"][
            "visible_assessment_rule"
        ] = "show Again, Hard, Good, and Easy"

        self.assert_finding(
            self.findings(auth=client_authority),
            "scheduler identity authority",
        )
        self.assert_finding(
            self.findings(auth=four_grade),
            "scheduler visible assessment",
        )

    def test_duplicate_atomicity_and_cursor_scope_cannot_be_weakened(self):
        duplicate = copy.deepcopy(self.auth)
        duplicate["server_scheduler_v1"]["projection_contract"][
            "duplicate_rule"
        ] = "advance FSRS on every retry"
        atomicity = copy.deepcopy(self.auth)
        atomicity["server_scheduler_v1"]["projection_contract"][
            "atomicity"
        ] = "write the cursor after acknowledging the event"
        cursor = copy.deepcopy(self.runtime)
        cursor["scheduler_runtime"]["cursor_storage"] = (
            "device_local_unversioned_cursor"
        )
        empty_selection = copy.deepcopy(self.runtime)
        empty_selection["scheduler_runtime"]["empty_selection_consistency"] = (
            "return_stale_empty_result_without_confirmation"
        )
        membership = copy.deepcopy(self.runtime)
        membership["scheduler_runtime"]["membership_mutation_atomicity"] = (
            "trial_may_overwrite_premium"
        )

        self.assert_finding(
            self.findings(auth=duplicate),
            "scheduler duplicate rule",
        )
        self.assert_finding(
            self.findings(auth=atomicity),
            "scheduler projection atomicity",
        )
        self.assert_finding(
            self.findings(runtime=cursor),
            "scheduler runtime cursor storage",
        )
        self.assert_finding(
            self.findings(runtime=empty_selection),
            "scheduler runtime empty-selection consistency",
        )
        self.assert_finding(
            self.findings(runtime=membership),
            "scheduler runtime membership mutation atomicity",
        )

    def test_due_sleep_and_free_access_order_are_owner_guarded(self):
        due = copy.deepcopy(self.auth)
        due["server_scheduler_v1"]["selection_contract"][
            "due_rule"
        ] = "show new cards before due reviews"
        sleep = copy.deepcopy(self.auth)
        sleep["server_scheduler_v1"]["selection_contract"][
            "sleep_rule"
        ] = "schedule sleeping cards and delete their history"
        membership = copy.deepcopy(self.auth)
        membership["server_scheduler_v1"]["selection_contract"][
            "membership_rule"
        ] = "free users receive three arbitrary demo cards"
        empty_selection = copy.deepcopy(self.auth)
        empty_selection["server_scheduler_v1"]["selection_contract"][
            "future_rule"
        ] = "return stale selection null without confirmation"
        response_membership = copy.deepcopy(self.auth)
        response_membership["server_scheduler_v1"]["response_contract"][
            "membership_stage_values"
        ].append("trial_available")

        self.assert_finding(self.findings(auth=due), "scheduler due order")
        self.assert_finding(
            self.findings(auth=sleep),
            "scheduler sleep authority",
        )
        self.assert_finding(
            self.findings(auth=membership),
            "scheduler membership authority",
        )
        self.assert_finding(
            self.findings(auth=empty_selection),
            "scheduler empty-selection consistency",
        )
        self.assert_finding(
            self.findings(auth=response_membership),
            "scheduler response membership stages",
        )

    def test_runtime_cannot_promote_binding_to_shipped_deployment_or_launch(self):
        mobile = copy.deepcopy(self.runtime)
        mobile["scheduler_runtime"]["mobile_session_binding_status"] = "shipped"
        deployed = copy.deepcopy(self.runtime)
        deployed["scheduler_runtime"]["deployment_status"] = "production"
        launch = copy.deepcopy(self.runtime)
        launch["scheduler_runtime"]["launch_gate_status"] = "passed"

        self.assert_finding(
            self.findings(runtime=mobile),
            "scheduler runtime mobile binding",
        )
        self.assert_finding(
            self.findings(runtime=deployed),
            "scheduler runtime deployment",
        )
        self.assert_finding(
            self.findings(runtime=launch),
            "scheduler runtime launch",
        )

    def test_scheduler_read_path_and_evals_are_required(self):
        missing_path = copy.deepcopy(self.agent)
        missing_path["read_paths"].pop("learning_scheduler_runtime")
        missing_hr40 = copy.deepcopy(self.evals)
        missing_hr40["regressions"] = [
            item
            for item in missing_hr40["regressions"]
            if item["id"] != "HR-40"
        ]
        weakened_gt31 = copy.deepcopy(self.evals)
        gt31 = next(
            item
            for item in weakened_gt31["golden_tasks"]
            if item["id"] == "GT-31"
        )
        gt31["must_include"].remove(
            "trial_starts_only_after_canonical_context_and_selection_persistence"
        )

        self.assert_finding(
            self.findings(agent=missing_path),
            "agent read path learning_scheduler_runtime",
        )
        self.assert_finding(
            self.findings(evals=missing_hr40),
            "missing HR-40",
        )
        self.assert_finding(
            self.findings(evals=weakened_gt31),
            "GT-31 must_include drift",
        )

    def test_dependency_provisioning_and_runtime_nonclaims_are_required(self):
        unpinned = self.package_text.replace(
            '"ts-fsrs": "5.4.1"',
            '"ts-fsrs": "^5.4.1"',
        )
        unprovisioned = self.provision_text.replace(
            "  'softbook_learning_sessions',\n",
            "",
        )
        promoted = self.runtime_text.replace(
            "This backend and the mobile binding are repository-local and not deployed.",
            "This backend and the mobile binding are deployed.",
        )
        non_atomic_membership = self.runtime_text.replace(
            "dismissal cannot overwrite a premium purchase.",
            "dismissal may overwrite a premium purchase.",
        )
        stale_empty_selection = self.runtime_text.replace(
            "and its `next_due_at` receive the same transactional watermark",
            "and its `next_due_at` skip transactional confirmation",
        )

        self.assert_finding(
            self.findings(package_text=unpinned),
            "must be pinned exactly",
        )
        self.assert_finding(
            self.findings(provision_text=unprovisioned),
            "missing softbook_learning_sessions",
        )
        self.assert_finding(
            self.findings(text=promoted),
            "runtime contract missing exact snippet",
        )
        self.assert_finding(
            self.findings(text=non_atomic_membership),
            "runtime contract missing exact snippet",
        )
        self.assert_finding(
            self.findings(text=stale_empty_selection),
            "runtime contract missing exact snippet",
        )

    def test_mobile_selection_binding_cannot_be_weakened(self):
        card_choice = copy.deepcopy(self.auth)
        card_choice["server_scheduler_v1"]["mobile_binding_contract"][
            "session_read_rule"
        ] = "mobile chooses any local card"
        early_advance = copy.deepcopy(self.auth)
        early_advance["server_scheduler_v1"]["mobile_binding_contract"][
            "advance_rule"
        ] = "choose the next local card before acknowledgement"
        stale_membership = copy.deepcopy(self.auth)
        stale_membership["server_scheduler_v1"]["mobile_binding_contract"][
            "membership_reconciliation_rule"
        ] = "trust the stale bootstrap or invent local entitlement details"
        unbound_runtime = copy.deepcopy(self.runtime)
        unbound_runtime["scheduler_runtime"][
            "mobile_session_binding"
        ] = "card_id_only"

        self.assert_finding(
            self.findings(auth=card_choice),
            "mobile session read binding",
        )
        self.assert_finding(
            self.findings(auth=early_advance),
            "mobile next-card binding",
        )
        self.assert_finding(
            self.findings(auth=stale_membership),
            "mobile membership reconciliation",
        )
        self.assert_finding(
            self.findings(runtime=unbound_runtime),
            "scheduler runtime mobile binding behavior",
        )

    def test_agent_entry_must_keep_scheduler_contract_discoverable(self):
        hidden = self.agent_entry_text.replace(
            "infra/cloudbase/learning-session-v1-runtime-contract.md",
            "infra/cloudbase/bootstrap-v2-runtime-contract.md",
        )
        self.assert_finding(
            self.findings(agent_entry_text=hidden),
            "learning-scheduler Agent entry",
        )


if __name__ == "__main__":
    unittest.main()
