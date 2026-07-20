from __future__ import annotations


def _read_path(value, keys):
    current = value
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return False, None
        current = current[key]
    return True, current


def _expect_path(findings, label, value, keys, expected):
    found, actual = _read_path(value, keys)
    if not found:
        findings.append(f"learning-events contract {label}: missing {'.'.join(keys)}")
    elif actual != expected:
        findings.append(
            f"learning-events contract {label}: expected {expected!r}, got {actual!r}"
        )


def _entry_by_id(entries, entry_id):
    for entry in entries:
        if isinstance(entry, dict) and entry.get("id") == entry_id:
            return entry
    return None


def learning_events_contract_findings(
    auth,
    runtime,
    agent,
    evals,
    runtime_text,
    agent_entry_text,
):
    findings = []
    required_event_fields = [
        "event_id",
        "card_id",
        "interaction_id",
        "phase",
        "outcome",
        "answer_grade",
        "used_hint",
        "used_peek",
        "client_occurred_at",
        "content_version",
        "device_cursor",
    ]
    forbidden_event_fields = [
        "phone_number",
        "auth_token",
        "access_token",
        "refresh_token",
        "day_key",
        "source_id",
        "source_label",
        "is_favorited",
        "checked_in_today",
        "favorite_count",
        "learning_completed_count",
        "pending_review_count",
        "review_completed_count",
        "sleeping_count",
        "total_completed_count",
        "membership_entitlement",
        "scheduler_cursor",
        "fsrs_rating",
        "stability",
        "difficulty",
        "due",
        "front",
        "analysis",
        "selected_answer",
        "correct_answer",
        "transcript",
    ]
    expected_grade_mapping = {
        "correct": "passed",
        "incorrect": "review_needed",
        "confident": "passed",
        "review": "review_needed",
    }
    expected_interaction_outcomes = {
        "flip": ["confident", "review"],
        "multiple_choice": ["correct", "incorrect"],
        "lock": ["correct", "incorrect"],
        "elimination": ["correct", "incorrect"],
        "swipe": ["correct", "incorrect"],
    }

    owner_expectations = [
        (
            "default ordering basis",
            ("default_sync_strategy", "ordering_basis"),
            ["account_scoped_server_sequence"],
        ),
        (
            "default learning state authority",
            ("default_sync_strategy", "learning_state_rule"),
            "latest_valid_learning_event_wins_per_card; learning and review completion aggregates plus per-card learning state are derived from accepted events while physical-space and check-in state keep separate authority",
        ),
        ("status", ("learning_events_v2", "contract_status"), "defined_not_implemented"),
        (
            "runtime document",
            ("learning_events_v2", "runtime_contract"),
            "infra/cloudbase/learning-events-v2-runtime-contract.md",
        ),
        ("method", ("learning_events_v2", "endpoint", "method"), "POST"),
        ("path", ("learning_events_v2", "endpoint", "path"), "/v2/learning/events"),
        (
            "session identity",
            ("learning_events_v2", "endpoint", "authentication"),
            "active_v2_session",
        ),
        (
            "request schema",
            ("learning_events_v2", "endpoint", "request_schema"),
            "learning-events.v2",
        ),
        (
            "response schema",
            ("learning_events_v2", "endpoint", "response_schema"),
            "learning-events-ack.v2",
        ),
        (
            "daily minimum",
            ("learning_events_v2", "product_alignment", "minimum_cross_surface_consistency"),
            "daily_level",
        ),
        (
            "no exact resume claim",
            ("learning_events_v2", "product_alignment", "exact_same_card_cross_device_resume_required"),
            False,
        ),
        (
            "server authority",
            ("learning_events_v2", "product_alignment", "server_is_source_of_truth"),
            True,
        ),
        (
            "request fields",
            ("learning_events_v2", "request_contract", "required_top_level_fields"),
            ["schema_version", "track", "events"],
        ),
        (
            "strict request schema",
            ("learning_events_v2", "request_contract", "schema_rule"),
            "reject unknown fields at the request, event, and device_cursor levels",
        ),
        (
            "event fields",
            ("learning_events_v2", "event_contract", "required_fields"),
            required_event_fields,
        ),
        (
            "answer grades",
            ("learning_events_v2", "event_contract", "answer_grade_values"),
            ["passed", "review_needed"],
        ),
        (
            "answer grade mapping",
            ("learning_events_v2", "event_contract", "answer_grade_mapping"),
            expected_grade_mapping,
        ),
        (
            "interaction outcome mapping",
            ("learning_events_v2", "event_contract", "interaction_outcome_rule"),
            expected_interaction_outcomes,
        ),
        (
            "device cursor fields",
            ("learning_events_v2", "event_contract", "device_cursor", "required_fields"),
            ["device_id", "sequence"],
        ),
        (
            "forbidden client authority",
            ("learning_events_v2", "event_contract", "forbidden_fields"),
            forbidden_event_fields,
        ),
        (
            "event idempotency key",
            ("learning_events_v2", "idempotency_and_atomicity", "event_key"),
            "account_id + event_id",
        ),
        (
            "exact replay",
            ("learning_events_v2", "idempotency_and_atomicity", "exact_replay"),
            "return duplicate with the original server_sequence and do not mutate projections",
        ),
        (
            "event conflict",
            ("learning_events_v2", "idempotency_and_atomicity", "event_id_conflict"),
            "the same event key with a different canonical payload rejects the entire request with HTTP 409",
        ),
        (
            "device cursor key",
            ("learning_events_v2", "idempotency_and_atomicity", "device_cursor_key"),
            "account_id + device_id + sequence",
        ),
        (
            "device cursor conflict",
            ("learning_events_v2", "idempotency_and_atomicity", "device_cursor_conflict"),
            "the same device cursor bound to a different event_id rejects the entire request with HTTP 409",
        ),
        (
            "atomic transaction",
            ("learning_events_v2", "idempotency_and_atomicity", "transaction_atomicity"),
            "new immutable events, account server sequences, and derived learning projections commit in one transaction; failure leaves no partial acceptance",
        ),
        (
            "canonical ordering",
            ("learning_events_v2", "server_authority", "canonical_ordering_rule"),
            "server_sequence is canonical ordering; client time and device sequence never override it",
        ),
        (
            "ack statuses",
            ("learning_events_v2", "acknowledgement_contract", "status_values"),
            ["accepted", "duplicate"],
        ),
        (
            "post replay read",
            ("learning_events_v2", "acknowledgement_contract", "canonical_refresh_rule"),
            "after replay, read /v2/bootstrap again before presenting reconciled server state or sending dependent mutations",
        ),
        (
            "launch non-claim",
            ("learning_events_v2", "migration_boundary", "launch_claim_rule"),
            "a green contract PR does not satisfy canonical-bootstrap-and-idempotent-events, server-scheduler, formal content approval, or launch readiness",
        ),
    ]
    for label, keys, expected in owner_expectations:
        _expect_path(findings, label, auth, keys, expected)

    runtime_expectations = [
        (
            "runtime owner",
            ("learning_event_runtime", "owner"),
            "spec/account-sync-contract.json#learning_events_v2",
        ),
        (
            "runtime status",
            ("learning_event_runtime", "implementation_status"),
            "contract_defined_endpoint_backend_and_client_not_implemented",
        ),
        (
            "runtime server authority",
            ("learning_event_runtime", "server_source_of_truth"),
            True,
        ),
        (
            "runtime canonical ordering",
            ("learning_event_runtime", "canonical_ordering"),
            "account_scoped_server_sequence",
        ),
        (
            "runtime counter boundary",
            ("learning_event_runtime", "client_snapshot_counters_forbidden"),
            True,
        ),
        (
            "runtime exact resume boundary",
            ("learning_event_runtime", "exact_same_card_cross_device_resume_required"),
            False,
        ),
        (
            "runtime scheduler boundary",
            ("learning_event_runtime", "scheduler_status"),
            "separate_future_gate",
        ),
        (
            "runtime launch status",
            ("learning_event_runtime", "launch_gate_status"),
            "pending",
        ),
    ]
    for label, keys, expected in runtime_expectations:
        _expect_path(findings, label, runtime, keys, expected)

    runtime_path = "infra/cloudbase/learning-events-v2-runtime-contract.md"
    found, values = _read_path(agent, ("read_paths", "learning_events_runtime"))
    if not found or runtime_path not in values:
        findings.append(
            f"learning-events contract agent read path learning_events_runtime: missing {runtime_path}"
        )

    hr37 = _entry_by_id(evals.get("regressions", []), "HR-37")
    expected_hr37 = [
        "account_sync_contract_is_learning_events_owner",
        "active_v2_session_is_only_account_identity",
        "stable_event_id_generated_before_durable_enqueue",
        "exact_replay_returns_duplicate_without_projection_mutation",
        "changed_payload_for_same_event_id_rejects_entire_request_with_409",
        "device_cursor_fork_rejects_entire_request_with_409",
        "new_events_sequences_and_projections_commit_atomically",
        "server_sequence_is_canonical_ordering",
        "client_learning_snapshots_and_counters_are_forbidden",
        "two_answer_grades_map_deterministically_from_existing_outcomes",
        "content_version_and_card_interaction_are_validated",
        "bootstrap_runs_again_after_replay",
        "exact_same_card_cross_device_resume_is_not_promised",
        "contract_green_does_not_claim_endpoint_scheduler_or_launch_readiness",
    ]
    if not hr37:
        findings.append("learning-events contract evals: missing HR-37")
    elif hr37.get("must_hit") != expected_hr37:
        findings.append("learning-events contract evals: HR-37 must_hit drift")

    gt28 = _entry_by_id(evals.get("golden_tasks", []), "GT-28")
    expected_gt28 = [
        "account_sync_contract_owner",
        "learning_events_v2_request_and_ack_schemas",
        "active_v2_session_identity_only",
        "immutable_event_ledger",
        "stable_event_id_and_device_cursor_before_enqueue",
        "exact_duplicate_returns_original_server_sequence",
        "event_id_payload_conflict_is_atomic_409",
        "device_cursor_fork_is_atomic_409",
        "mixed_duplicate_and_new_batch_has_per_event_results",
        "server_derived_learning_state_and_counts",
        "passed_and_review_needed_only",
        "outcome_grade_and_interaction_validation",
        "retained_content_version_validation_for_offline_replay",
        "client_time_is_not_canonical_ordering_authority",
        "post_replay_bootstrap_reconciliation",
        "legacy_v1_snapshots_are_migration_only",
        "scheduler_is_a_separate_future_gate",
        "contract_status_is_defined_not_implemented",
    ]
    if not gt28:
        findings.append("learning-events contract evals: missing GT-28")
    elif gt28.get("must_include") != expected_gt28:
        findings.append("learning-events contract evals: GT-28 must_include drift")

    required_runtime_snippets = [
        "not implemented by",
        "The primary idempotency key is `(account_id, event_id)`.",
        "An exact replay returns `duplicate`, the original `server_sequence`, and no",
        "Binding the same cursor to another event also returns `409`",
        "commit in one transaction",
        "not the scheduler cursor and not a",
        "does not accept a client-authored",
        "reads `/v2/bootstrap` again",
        "Legacy `/v1/progress/daily-sync` and `/v1/learning/state-sync` remain",
        "This contract-only artifact does not prove",
    ]
    for snippet in required_runtime_snippets:
        if snippet not in runtime_text:
            findings.append(
                f"learning-events runtime contract missing exact snippet: {snippet!r}"
            )

    if runtime_path not in agent_entry_text:
        findings.append(
            f"learning-events contract Agent entry runtime path: missing exact snippet {runtime_path!r}"
        )

    return findings


def validate(context) -> None:
    check_equal = context.check_equal
    req = context.load("requirement-memory.json")
    auth = context.load("account-sync-contract.json")
    platform = context.load("platform-contract.json")
    product = context.load("product-core.json")
    membership = context.load("membership.json")
    interactions = context.load("interactions.json")
    runtime = context.load("runtime-boundaries.json")
    agent = context.load("agent-harness.json")
    evals = context.load("evals.json")
    runtime_contract = (
        context.root / "infra/cloudbase/learning-events-v2-runtime-contract.md"
    )
    runtime_text = (
        runtime_contract.read_text(encoding="utf-8")
        if runtime_contract.is_file()
        else ""
    )
    agent_entry_text = (context.root / "AGENTS.md").read_text(encoding="utf-8")

    context.errors.extend(
        learning_events_contract_findings(
            auth,
            runtime,
            agent,
            evals,
            runtime_text,
            agent_entry_text,
        )
    )

    # Auth / trial / purchase owner: account-sync-contract.
    check_equal(
        "login_required",
        auth["authentication"]["login_is_required_before_learning"],
        req["authentication_policy"]["login_is_required_before_learning"],
    )
    check_equal(
        "guest_learning_before_authentication",
        auth["authentication"]["guest_learning_before_authentication"],
        req["authentication_policy"]["guest_learning_before_authentication"],
    )
    check_equal(
        "primary_login_method requirement-memory",
        auth["authentication"]["primary_login_method"],
        req["authentication_policy"]["primary_login_method"],
    )
    check_equal(
        "primary_login_method platform-contract",
        auth["authentication"]["primary_login_method"],
        platform["authentication_policy"]["primary_login_method"],
    )
    check_equal(
        "trial_start requirement-memory",
        auth["trial_and_purchase"]["trial_starts_when"],
        req["business"]["trial_starts_when"],
    )
    check_equal(
        "trial_start membership",
        auth["trial_and_purchase"]["trial_starts_when"],
        membership["policy"]["trial_start_trigger"],
    )
    check_equal(
        "trial_start product-core",
        auth["trial_and_purchase"]["trial_starts_when"],
        product["monetization"]["trial_start_trigger"],
    )
    check_equal(
        "purchase_recovery requirement-memory",
        auth["trial_and_purchase"]["purchase_recovery_reminder"],
        req["business"]["purchase_recovery_reminder"],
    )
    check_equal(
        "purchase_recovery membership",
        auth["trial_and_purchase"]["purchase_recovery_reminder"],
        membership["policy"]["purchase_recovery_reminder"],
    )
    check_equal(
        "purchase_recovery platform-contract",
        auth["trial_and_purchase"]["purchase_recovery_reminder"],
        platform["commerce_surface_policy"]["purchase_recovery_reminder"],
    )
    check_equal(
        "purchase_recovery product-core",
        auth["trial_and_purchase"]["purchase_recovery_reminder"],
        product["monetization"]["post_membership_recovery_prompt"],
    )
    check_equal(
        "web_app_purchase_authority membership",
        auth["trial_and_purchase"]["web_and_app_purchase_authority"],
        membership["policy"]["web_and_app_purchase_authority"],
    )
    check_equal(
        "web_app_purchase_authority platform-contract",
        auth["trial_and_purchase"]["web_and_app_purchase_authority"],
        platform["commerce_surface_policy"]["web_and_app_purchase_authority"],
    )


    # Sync owner: account-sync-contract.
    check_equal(
        "sync_targets requirement-memory",
        auth["sync_scope"]["must_sync"],
        req["cross_surface_continuity"]["sync_targets"],
    )
    check_equal(
        "sync_targets product-core",
        auth["sync_scope"]["must_sync"],
        product["multi_surface_strategy"]["continuity_model"]["sync_targets"],
    )
    check_equal(
        "sync_mode requirement-memory",
        auth["sync_scope"]["target_sync_mode"],
        req["cross_surface_continuity"]["target_sync_mode"],
    )
    check_equal(
        "sync_mode product-core",
        auth["sync_scope"]["target_sync_mode"],
        product["multi_surface_strategy"]["continuity_model"]["target_sync_mode"],
    )


    # Platform owner: platform-contract.
    platform_release_targets = [
        key for key, enabled in platform["release_targets"].items() if enabled
    ]
    check_equal(
        "release_targets requirement-memory",
        platform_release_targets,
        req["platform_requirements"]["release_targets"],
    )
    check_equal(
        "release_targets product-core.multi_surface_strategy",
        platform_release_targets,
        product["multi_surface_strategy"]["release_targets"],
    )
    check_equal(
        "release_targets product-core.technical_constraints",
        platform_release_targets,
        product["technical_constraints"]["release_targets"],
    )
    check_equal(
        "priority_order requirement-memory",
        platform["design_strategy"]["mobile_priority"],
        req["platform_requirements"]["priority_order"],
    )
    check_equal(
        "priority_order product-core",
        platform["design_strategy"]["mobile_priority"],
        product["multi_surface_strategy"]["priority_order"],
    )
    check_equal(
        "nav_order requirement-memory",
        platform["navigation_contract"]["order"],
        req["page_and_spec_needs"]["top_level_navigation_is_consistent_across_surfaces"],
    )
    check_equal(
        "nav_order product-core",
        platform["navigation_contract"]["order"],
        product["surface_navigation"]["consistent_top_level_nav_order"],
    )
    check_equal(
        "learning_entry_requirement-memory",
        platform["entry_priority_by_surface"]["learning_flow_is_most_important_entry_on_all_release_targets"],
        req["platform_requirements"]["learning_flow_is_most_important_entry_on_all_release_targets"],
    )
    check_equal(
        "space_entry_requirement-memory",
        platform["entry_priority_by_surface"]["physical_space_is_top_level_entry_on_all_release_targets"],
        req["platform_requirements"]["physical_space_is_top_level_entry_on_all_release_targets"],
    )


    # Audio owner: interactions.
    check_equal(
        "audio_autoplay requirement-memory",
        interactions["audio_binding_policy"]["auto_play"],
        req["audio_role"]["auto_play"],
    )
    check_equal(
        "audio_autoplay product-core",
        interactions["audio_binding_policy"]["auto_play"],
        product["audio_product_role"]["auto_play"],
    )
    check_equal(
        "front_side_subtitles requirement-memory",
        interactions["audio_binding_policy"]["front_side_subtitles"],
        req["audio_role"]["front_side_subtitles"],
    )
    check_equal(
        "front_side_subtitles product-core",
        interactions["audio_binding_policy"]["front_side_subtitles"],
        product["audio_product_role"]["front_side_subtitles"],
    )
    check_equal(
        "back_text_or_transcript requirement-memory",
        interactions["audio_binding_policy"]["back_side_text_or_transcript_may_exist"],
        req["audio_role"]["back_side_text_or_transcript_may_exist"],
    )
    check_equal(
        "back_text_or_transcript product-core",
        interactions["audio_binding_policy"]["back_side_text_or_transcript_may_exist"],
        product["audio_product_role"]["back_side_text_or_transcript_may_exist"],
    )
