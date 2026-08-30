from __future__ import annotations

import json


def validate(context) -> None:
    """Check a small set of cross-owner product invariants.

    Domain validators own detailed schemas and behavior. This section deliberately
    does not copy full specs, eval answer lists, Markdown snippets, or source code.
    """

    root = context.root
    errors = context.errors
    load = context.load
    check_equal = context.check_equal
    find_by_id = context.find_by_id

    requirement = load("requirement-memory.json")
    acceptance = load("machine-acceptance.json")
    product = load("product-core.json")
    platform = load("platform-contract.json")
    account = load("account-sync-contract.json")
    interactions = load("interactions.json")
    runtime = load("runtime-boundaries.json")
    release = load("release-operational-policy.json")
    evals = load("evals.json")

    launch = json.loads(
        (root / "docs/release/launch-readiness.v1.json").read_text(encoding="utf-8")
    )
    external = json.loads(
        (root / "docs/release/external-account-readiness.v1.json").read_text(
            encoding="utf-8"
        )
    )
    closed_beta_spec = load("cet4-closed-beta-readiness.json")
    media_receipt = load("trusted-media-run-receipt.json")
    closed_beta = json.loads(
        (root / "docs/release/cet4-closed-beta-readiness.v1.json").read_text(
            encoding="utf-8"
        )
    )

    check_equal(
        "raw requirement target release",
        acceptance["target_release"],
        requirement["launch_and_agent_authority"]["target_release"],
    )
    check_equal(
        "release policy target",
        acceptance["target_release"],
        release["target_release"],
    )
    check_equal(
        "launch record target",
        acceptance["target_release"],
        launch["target_release"],
    )
    check_equal(
        "release policy machine owner",
        "spec/machine-acceptance.json",
        release.get("machine_acceptance_policy"),
    )
    check_equal(
        "launch machine owner",
        "spec/machine-acceptance.json",
        launch.get("machine_acceptance", {}).get("policy"),
    )
    check_equal(
        "launch machine check",
        "validate-harness",
        launch.get("machine_acceptance", {}).get("required_check"),
    )
    if "formal_approval" in launch:
        errors.append("launch readiness must not contain a human formal_approval gate")
    for field in (
        "human_review_required",
        "user_review_required",
        "product_owner_click_required",
    ):
        check_equal(
            f"launch machine acceptance {field}",
            False,
            launch["machine_acceptance"].get(field),
        )

    check_equal(
        "closed beta exact scope",
        (1180, 108, 301),
        (
            closed_beta["scope"]["card_count"],
            closed_beta["scope"]["box_count"],
            closed_beta["scope"]["audio_asset_count"],
        ),
    )
    check_equal(
        "closed beta release targets",
        ["ios", "android", "pc_web"],
        closed_beta["scope"]["release_targets"],
    )
    check_equal(
        "closed beta machine acceptance owner",
        "spec/machine-acceptance.json",
        closed_beta.get("machine_acceptance", {}).get("policy"),
    )
    check_equal(
        "closed beta machine check",
        "validate-harness",
        closed_beta.get("machine_acceptance", {}).get("required_check"),
    )
    if "formal_approval" in closed_beta:
        errors.append("closed beta readiness must not contain formal_approval")
    for entry in closed_beta["external_dependencies"]:
        check_equal(
            f"closed beta dependency {entry['id']} owner",
            "model_harness",
            entry.get("owner"),
        )
    check_equal(
        "closed beta content acceptance dependency",
        True,
        "model-content-acceptance"
        in {entry["id"] for entry in closed_beta["external_dependencies"]},
    )
    check_equal(
        "closed beta launch non-replacement",
        True,
        closed_beta["launch_non_replacement"][
            "closed_beta_ready_does_not_imply_public_launch_ready"
        ],
    )
    check_equal(
        "closed beta target truth",
        "cet4-closed-beta",
        closed_beta_spec["product_truth"]["target_release"],
    )

    authority = release["external_capability"].get("acceptance_authority")
    check_equal(
        "external account acceptance authority",
        authority,
        external.get("acceptance_authority"),
    )
    for entry in external["accounts"]:
        check_equal(
            f"external account {entry['id']} owner",
            "model_harness",
            entry.get("owner"),
        )
    for entry in launch["external_dependencies"]:
        check_equal(
            f"launch dependency {entry['id']} owner",
            "model_harness",
            entry.get("owner"),
        )

    if "machine_harness" not in account["external_account_readiness"]["truth_authority"]:
        errors.append("account sync external authority must be machine-harness owned")
    launch_runtime = runtime["launch_evidence_runtime"]
    if "machine_harness" not in launch_runtime["external_capability_truth_authority"]:
        errors.append("runtime external authority must be machine-harness owned")
    check_equal(
        "unregistered external capability semantics fail closed",
        True,
        release["external_capability"].get(
            "unregistered_type_specific_semantics_fail_closed"
        ),
    )
    check_equal(
        "registered external capability semantics",
        {"android-distribution/release-signing"},
        set(
            release["external_capability"]
            .get("registered_type_specific_semantics", {})
            .keys()
        ),
    )
    if "currently_only_android-distribution_release-signing" not in launch_runtime[
        "external_capability_registered_semantics"
    ]:
        errors.append("runtime must name the only registered external capability")
    if "capability_ineligible" not in launch_runtime[
        "external_capability_unregistered_rule"
    ]:
        errors.append("runtime must keep unregistered external capabilities ineligible")
    if "distinct_machine" not in launch_runtime["independent_verification_rule"]:
        errors.append("high-risk release verification must use distinct machine runs")

    deletion = account["account_deletion"]
    deletion_runtime = runtime["account_deletion_runtime"]
    check_equal(
        "account deletion runtime owner",
        "spec/account-sync-contract.json#account_deletion",
        deletion_runtime["owner"],
    )
    for token in ("account-deletion-task.v2", "blocks login"):
        if token not in deletion["request_rule"]:
            errors.append(f"account deletion request boundary missing: {token}")
    for collection in (
        "softbook_accounts",
        "softbook_auth_sessions",
        "softbook_learning_events",
        "softbook_learning_sessions",
        "softbook_space_states",
    ):
        if collection not in deletion["account_keyed_collections"]:
            errors.append(f"account deletion collection coverage missing: {collection}")
    check_equal(
        "account deletion task schema",
        "account-deletion-task.v2",
        deletion_runtime["task_schema"],
    )
    for token in (
        "expected_deletion_id_account_instance_id",
        "stale_worker_cannot_delete_post_completion_reregistration_data",
        "stale_worker_cannot_complete_or_release_newer_claim",
    ):
        if token not in deletion_runtime["lease_boundary"]:
            errors.append(f"account deletion lease boundary missing: {token}")
    if deletion_runtime["deployment_status"] != "not_deployed_by_repository_change":
        errors.append("repository changes must not claim account-deletion deployment")
    auth_runtime_tests = (
        root
        / "infra/cloudbase/functions/softbook-api/test/auth-v2.test.js"
    ).read_text(encoding="utf-8")
    worker_runtime_tests = (
        root
        / "infra/cloudbase/functions/softbook-api/test/account-deletion-worker-v1.test.js"
    ).read_text(encoding="utf-8")
    for token in (
        "challenge reservation uses exactly four transaction operations",
        "db.transactionOperationCounts(), [2, 3, 4, 2]",
        "db.transactionOperationCounts().at(-1), 3",
        "real 50ms acknowledgement envelope prevents absent and task suppression early returns",
        "Memory and CloudBase converge an empty-read deletion race after origin erasure",
        "createV2TestApi({providerDeliveryDeadlineMs: 10000})",
        "createV2TestApi({providerDeliveryDeadlineMs: 8000})",
    ):
        if token not in auth_runtime_tests:
            errors.append(f"auth transaction budget assertion missing: {token}")
    for token in (
        "guarded single-document removal uses exactly four transaction operations",
        "db.transactionOperationCounts().at(-1), 4",
    ):
        if token not in worker_runtime_tests:
            errors.append(f"worker transaction budget assertion missing: {token}")
    acknowledgement_envelope = deletion_runtime.get(
        "request_code_acknowledgement_envelope", ""
    )
    for token in (
        "1_to_8000ms",
        "strictly_below_10000ms_Cloud_Function_timeout",
        "8000_accepted_10000_rejected",
        "real_50ms",
        "providerDeliveryDeadlineMs",
    ):
        if token not in acknowledgement_envelope:
            errors.append(f"request-code acknowledgement envelope missing: {token}")
    deployment_safety_tests = (
        root
        / "infra/cloudbase/functions/softbook-api/test/deployment-safety.test.js"
    ).read_text(encoding="utf-8")
    if (
        "MAX_PROVIDER_DELIVERY_DEADLINE_MS <"
        not in deployment_safety_tests
        or "EXPECTED_FUNCTION_CONFIG.timeout * 1000" not in deployment_safety_tests
    ):
        errors.append(
            "auth acknowledgement envelope must be executable-proven below function timeout"
        )

    required_external_ids = set(release["external_capability"]["required_checks"])
    account_ids = {entry["id"] for entry in external["accounts"]}
    dependency_ids = {entry["id"] for entry in launch["external_dependencies"]}
    check_equal("external capability account coverage", required_external_ids, account_ids)
    check_equal("external capability launch coverage", required_external_ids, dependency_ids)

    release_targets = platform["release_targets"]
    if (
        release_targets.get("ios_app") is not True
        or release_targets.get("android_app") is not True
        or release_targets.get("web") is not True
        or release_targets.get("harmonyos") is not False
    ):
        errors.append("platform release targets must remain iOS, Android, and Web")
    if product["product_promise"] != "帮助中国大学生以更轻松、更低负担、但仍然可信的方式通过 CET4/CET6。":
        errors.append("product promise drifted from the CET4/CET6 owner")
    if requirement["learning_model"]["single_card_flow"] is not True:
        errors.append("single-card flow must remain product truth")
    if requirement["physical_space"]["is_core_differentiator"] is not True:
        errors.append("physical space must remain a core differentiator")

    interaction_ids = {entry["id"] for entry in interactions["interactions"]}
    for interaction_id in ("flip", "multiple_choice", "lock", "elimination", "swipe"):
        if interaction_id not in interaction_ids:
            errors.append(f"missing core interaction: {interaction_id}")

    for regression_id in (
        "HR-33",
        "HR-34",
        "HR-36",
        "HR-45",
        "HR-46",
        "HR-47",
        "HR-48",
        "HR-49",
        "HR-50",
        "HR-51",
        "HR-52",
        "HR-53",
    ):
        if not find_by_id(evals["regressions"], regression_id):
            errors.append(f"missing representative machine-acceptance eval: {regression_id}")
    for task_id in (
        "GT-17",
        "GT-25",
        "GT-37",
        "GT-38",
        "GT-39",
        "GT-40",
        "GT-43",
        "GT-44",
        "GT-45",
    ):
        if not find_by_id(evals["golden_tasks"], task_id):
            errors.append(f"missing representative delivery eval: {task_id}")

    report_boundary = runtime["release_delivery_runtime"].get(
        "formal_bundle_build_report_boundary", ""
    )
    for token in (
        "formal_release_bundle_build_report_v2",
        "clean_main_exact_origin",
        "model_authorization_model_review",
        "execution_window",
        "no_CloudBase_writes",
        "gate_eligible_false",
    ):
        if token not in report_boundary:
            errors.append(f"formal bundle report boundary missing: {token}")
    formal_media_boundary = runtime["cet4_closed_beta_readiness"].get(
        "formal_content_evidence", ""
    )
    for token in (
        "registered_and_fail_closed",
        "trusted_media_run_receipt_v2",
        "original_model_execution_commit",
        "later_attested_finalizer_commit",
        "exact_1180_108_301_scope",
        "GitHub_Sigstore",
        "all_27_QC_records",
    ):
        if token not in formal_media_boundary:
            errors.append(f"formal media boundary missing: {token}")
    check_equal(
        "trusted media receipt owner",
        "spec/machine-acceptance.json",
        media_receipt.get("owner"),
    )
    check_equal(
        "trusted media receipt producer repository",
        "LENKIN233/card-make",
        media_receipt.get("producer", {}).get("repository"),
    )
    check_equal(
        "trusted media receipt fixed workflow",
        "LENKIN233/card-make/.github/workflows/trusted-media-run.yml",
        media_receipt.get("producer", {}).get("signer_workflow"),
    )
    check_equal(
        "trusted media receipt real observation boundary",
        True,
        media_receipt.get("current_boundary", {}).get(
            "real_attested_receipt_observed"
        ),
    )
    for asset in (
        "scripts/verify_trusted_media_run_receipt.mjs",
        "scripts/replay_trusted_media_raw_outputs.py",
        "scripts/test_verify_trusted_media_run_receipt.mjs",
    ):
        if not (root / asset).is_file():
            errors.append(f"trusted media receipt asset missing: {asset}")
    formal_entitlement_boundary = runtime["cet4_closed_beta_readiness"].get(
        "formal_entitlement_evidence", ""
    )
    for token in (
        "beta_entitlement_drill",
        "grant_idempotent_replay",
        "revoke_idempotent_replay",
        "exact_commit",
    ):
        if token not in formal_entitlement_boundary:
            errors.append(f"formal entitlement boundary missing: {token}")

    space_drill = account["physical_space_actions_v2"].get("receiver_drill", {})
    check_equal(
        "space drill runner",
        "infra/cloudbase/run-space-sync-drill.mjs",
        space_drill.get("runner"),
    )
    space_runtime_drill = runtime["physical_space_action_runtime"].get(
        "receiver_drill_report", ""
    )
    for token in (
        "space_sync_drill_report_v1",
        "cross_client",
        "duplicate",
        "conflict",
        "cleanup",
        "gate_ineligible",
    ):
        if token not in space_runtime_drill:
            errors.append(f"space drill boundary missing: {token}")
    formal_space_boundary = runtime["cet4_closed_beta_readiness"].get(
        "formal_space_evidence", ""
    )
    for token in (
        "space_sync_test",
        "applied_space_sync_drill_report_v1",
        "exact_candidate_commit",
        "cross_client_revision",
        "idempotency_conflict",
        "cleanup_binding",
    ):
        if token not in formal_space_boundary:
            errors.append(f"formal space boundary missing: {token}")

    session_drill = account["authentication"].get(
        "receiver_session_revocation_drill", {}
    )
    check_equal(
        "session revocation drill runner",
        "infra/cloudbase/run-session-revocation-drill.mjs",
        session_drill.get("runner"),
    )
    session_runtime = runtime.get("session_revocation_drill_runtime", {})
    session_runtime_text = " ".join(str(item) for item in session_runtime.values())
    for token in (
        "session-revocation-drill-report.v1",
        "fresh_same_phone_distinct_session",
        "A_refresh_rotation",
        "single_session_revocation",
        "B_refresh_rotation",
        "rotated_access_survival",
        "logout_idempotency",
        "operator_cannot_embed_phone_or_credential",
        "tracked_HEAD_identical",
        "control_plane_verified_backend_deployment",
        "redirect_error",
        "10_second_abort",
        "without_phone_or_token_values",
        "gate_eligible_false",
    ):
        if token not in session_runtime_text:
            errors.append(f"session revocation drill boundary missing: {token}")

    launch_validator = (root / "scripts/validate_launch_readiness.mjs").read_text(
        encoding="utf-8"
    )
    evidence_contract = (root / "scripts/lib/launch_evidence_contract.mjs").read_text(
        encoding="utf-8"
    )
    if "machine_acceptance" not in launch_validator:
        errors.append("launch validator must enforce machine_acceptance")
    if "run_id" not in evidence_contract:
        errors.append("launch evidence must bind machine run identity")
    for artifact in (
        "scripts/build_formal_release_bundle.mjs",
        "scripts/test_build_formal_release_bundle.mjs",
        "scripts/validate_cet4_closed_beta_readiness.mjs",
        "scripts/test_validate_cet4_closed_beta_readiness.mjs",
        "scripts/test_beta_entitlement_drill_evidence.mjs",
        "infra/cloudbase/run-space-sync-drill.mjs",
        "scripts/test_space_sync_evidence.mjs",
        "infra/cloudbase/run-session-revocation-drill.mjs",
        "infra/cloudbase/functions/softbook-api/test/session-revocation-drill-report.test.js",
    ):
        if not (root / artifact).is_file():
            errors.append(f"missing closed-beta machine artifact: {artifact}")
