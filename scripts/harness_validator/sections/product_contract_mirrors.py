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
        "selection_id",
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
            "remote auth request timeout",
            ("authentication", "remote_request_timeout_ms"),
            15000,
        ),
        (
            "authenticated request lifecycle",
            ("authentication", "authenticated_request_rule"),
            "access-token acquisition, the first protected fetch, at most one forced refresh, and one retry share one bounded deadline; caller cancellation or a changed originating session cancels the request, and cancellation itself cannot trigger refresh, invalidate, or mutate a replacement session",
        ),
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
        (
            "status",
            ("learning_events_v2", "contract_status"),
            "cloudbase_backend_mobile_client_and_scheduler_binding_implemented_locally_not_deployed",
        ),
        (
            "bootstrap known gap",
            ("canonical_read", "known_gap"),
            "the repository-local CloudBase learning-events.v2 backend, React Native durable producer/replay, server scheduler, and mobile scheduler-session binding are implemented but not deployed; global legacy v1 snapshot-write removal and production publication remain unimplemented",
        ),
        (
            "backend implementation",
            ("learning_events_v2", "implementation_progress", "cloudbase_backend"),
            "implemented_locally_not_deployed",
        ),
        (
            "transactional ledger implementation",
            (
                "learning_events_v2",
                "implementation_progress",
                "transactional_event_ledger",
            ),
            True,
        ),
        (
            "active session account-key integrity",
            (
                "learning_events_v2",
                "implementation_progress",
                "active_session_account_key_integrity",
            ),
            True,
        ),
        (
            "stored projection integrity",
            (
                "learning_events_v2",
                "implementation_progress",
                "stored_projection_integrity_validation",
            ),
            True,
        ),
        (
            "CloudBase atomic batch limit",
            (
                "learning_events_v2",
                "implementation_progress",
                "cloudbase_atomic_batch_limit",
            ),
            9,
        ),
        (
            "CloudBase transaction boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "cloudbase_transaction_boundary",
            ),
            "doc_only_with_at_most_100_operations",
        ),
        (
            "legacy migration consistency",
            (
                "learning_events_v2",
                "implementation_progress",
                "legacy_migration_consistency",
            ),
            "bounded_outside_transaction_snapshot_with_transactional_revision_fence",
        ),
        (
            "all-track legacy projection migration",
            (
                "learning_events_v2",
                "implementation_progress",
                "legacy_all_track_projection_migration",
            ),
            True,
        ),
        (
            "mobile producer boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "mobile_durable_event_producer",
            ),
            True,
        ),
        (
            "mobile bounded authenticated request boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "mobile_bounded_authenticated_requests",
            ),
            True,
        ),
        (
            "mobile active v1 learning write boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "mobile_active_v1_learning_snapshot_writes_disabled",
            ),
            True,
        ),
        (
            "legacy write boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "legacy_v1_snapshot_writes_disabled",
            ),
            False,
        ),
        (
            "migrated account legacy write boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "migrated_account_v1_learning_writes",
            ),
            "learning_state_rejected_daily_progress_check_in_only_after_first_accepted_v2_event",
        ),
        (
            "selection-bound event implementation",
            (
                "learning_events_v2",
                "implementation_progress",
                "selection_bound_events",
            ),
            True,
        ),
        (
            "mobile scheduler binding implementation",
            (
                "learning_events_v2",
                "implementation_progress",
                "mobile_scheduler_session_binding",
            ),
            True,
        ),
        (
            "production deployment boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "production_deployment",
            ),
            False,
        ),
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
            "selection ID rule",
            ("learning_events_v2", "event_contract", "selection_id_rule"),
            "copy the opaque selection_id from the current learning-session.v1 selection into the immutable event; for each unseen event the server transaction requires the current account-and-track cursor to match selection_id, card_id, phase, and content_version exactly, while an already accepted exact replay remains valid after that cursor is cleared",
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
            "return duplicate with the original server_sequence and do not mutate projections; an already accepted byte-equivalent canonical event remains a duplicate when mutable time or content-retention windows later change",
        ),
        (
            "stored event integrity",
            (
                "learning_events_v2",
                "idempotency_and_atomicity",
                "stored_event_integrity",
            ),
            "before returning duplicate, recompute the canonical digest from the stored immutable payload and track; any mismatch fails closed without acknowledgement or writes",
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
            "selection-bound mixed batch",
            (
                "learning_events_v2",
                "idempotency_and_atomicity",
                "mixed_batch_rule",
            ),
            "exact duplicates and at most one unseen event may commit together and each receives an explicit result; the unseen event must consume the current selection and a request with multiple unseen events is rejected atomically",
        ),
        (
            "selection conflict",
            (
                "learning_events_v2",
                "idempotency_and_atomicity",
                "selection_conflict_rule",
            ),
            "a missing, stale, cross-account, cross-track, or mismatched selection binding rejects the entire request with HTTP 409 before writes",
        ),
        (
            "atomic transaction",
            ("learning_events_v2", "idempotency_and_atomicity", "transaction_atomicity"),
            "current selection validation, one new immutable event, account server sequence, derived learning and FSRS projections, all migrated-track learning-session projection watermarks, exact input-track selection clearing, and daily progress commit in one transaction; failure leaves no partial acceptance",
        ),
        (
            "CloudBase atomic batch rule",
            (
                "learning_events_v2",
                "idempotency_and_atomicity",
                "cloudbase_atomic_batch_rule",
            ),
            "the repository-local CloudBase adapter accepts at most 9 input events but at most one may be unseen; the maximum successful fixture of 8 distinct exact duplicates plus one current-selection event uses 29 operations, and the first-event all-track migration fixture uses no more than 29, below the platform limit of 100 operations per transaction",
        ),
        (
            "CloudBase transaction query rule",
            (
                "learning_events_v2",
                "idempotency_and_atomicity",
                "cloudbase_transaction_query_rule",
            ),
            "CloudBase transactions use deterministic document reads and writes only; bounded legacy learning queries run before the transaction and a transactionally written account revision fence forces a retry when a v1 write changes that snapshot",
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
            "mobile outbox owner contract",
            ("learning_events_v2", "mobile_client_contract", "outbox_schema"),
            "learning-event-outbox.v2",
        ),
        (
            "mobile durable storage owner contract",
            ("learning_events_v2", "mobile_client_contract", "storage_rule"),
            "persist the outbox under an independent versioned AsyncStorage key; persist the immutable selection-bound event and allocated installation cursor before advancing the card UI",
        ),
        (
            "mobile identity owner contract",
            ("learning_events_v2", "mobile_client_contract", "identity_rule"),
            "store the account owner only for local queue isolation; never include phone_number or credential material in the learning-events.v2 request body or event payload",
        ),
        (
            "mobile strict acknowledgement owner contract",
            ("learning_events_v2", "mobile_client_contract", "ack_rule"),
            "remove events only after a strict ordered accepted-or-duplicate acknowledgement with matching event IDs and positive unique server sequences",
        ),
        (
            "mobile batch ordering owner contract",
            ("learning_events_v2", "mobile_client_contract", "batch_rule"),
            "submit exact duplicates plus at most one unseen selection-bound event for one account and one track without compacting, rewriting, or reordering immutable payloads; end a batch at the first track boundary and never answer a second card before the first acknowledgement, bootstrap reconciliation, and next session read",
        ),
        (
            "mobile retry owner contract",
            ("learning_events_v2", "mobile_client_contract", "retry_rule"),
            "retain byte-equivalent events after ambiguous or failed requests; pause automatic retry after a transient failure until network recovery, app foreground, or a newly durably enqueued event",
        ),
        (
            "mobile replay concurrency owner contract",
            ("learning_events_v2", "mobile_client_contract", "concurrency_rule"),
            "serialize replay per originating session; if a durable event arrives or a dependent mutation finishes queueing after an in-flight pass has read its queue, schedule one follow-up pass instead of running concurrently or waiting for an unrelated trigger",
        ),
        (
            "mobile restored outbox owner contract",
            ("learning_events_v2", "mobile_client_contract", "recovery_rule"),
            "hydrate the account outbox count with authenticated bootstrap; any pending selection-bound event blocks another card completion until strict acknowledgement, post-acknowledgement bootstrap mapping, and a fresh learning-session read; a cached selected card may be answered offline once, but the client cannot choose or enqueue a second card offline",
        ),
        (
            "mobile reconciliation owner contract",
            (
                "learning_events_v2",
                "mobile_client_contract",
                "reconciliation_rule",
            ),
            "replay only after validated bootstrap and content hydration; while events are pending, queue dependent daily-progress and space-state mutations and suppress routine canonical refreshes that would overwrite local intent; after any acknowledgement, keep dependent mutations blocked until another bootstrap is fetched and mapped",
        ),
        (
            "mobile logout owner contract",
            ("learning_events_v2", "mobile_client_contract", "logout_rule"),
            "clear only the signed-out account's queued events while preserving the installation identity and next sequence",
        ),
        (
            "mobile account switch owner contract",
            ("learning_events_v2", "mobile_client_contract", "account_switch_rule"),
            "scope replay, bootstrap, and authenticated HTTP authorization handling to the originating session identity rather than phone number alone; a stale response from a signed-out or replaced session must not refresh, invalidate, clear, hydrate, or change sync state for the current session, including same-phone reauthentication",
        ),
        (
            "mobile request lifecycle owner contract",
            (
                "learning_events_v2",
                "mobile_client_contract",
                "request_lifecycle_rule",
            ),
            "bound token acquisition and each authenticated fetch pipeline to 15000 milliseconds; timeout retains byte-equivalent events and advances retry state, while caller cancellation or originating-session replacement cancels immediately without acknowledging, removing, rewriting, or incrementing retry state for queued events",
        ),
        (
            "mobile legacy queue owner contract",
            ("learning_events_v2", "mobile_client_contract", "legacy_queue_rule"),
            "discard persisted generic sync_learning_state mutations during hydration, remove the pre-binding learning-event-outbox.v1 key without replaying its unbound entries, and never route active mobile learning completion through /v1/learning/state-sync",
        ),
        (
            "launch non-claim",
            ("learning_events_v2", "migration_boundary", "launch_claim_rule"),
            "green repository-local backend, scheduler, and mobile binding tests do not satisfy global legacy snapshot-write removal, formal content approval, production deployment, or launch readiness",
        ),
        (
            "migrated account write rule",
            ("learning_events_v2", "migration_boundary", "migrated_account_write_rule"),
            "the first accepted v2 event transaction preserves valid legacy sequence-zero learning baselines for both tracks before closing account migration; later v1 learning-state snapshots fail with HTTP 409; v1 daily-progress remains a development bridge that can only merge monotonic checked_in_today, cannot overwrite server-derived learning counts, and cannot supply favorite or sleeping counts because bootstrap derives them from canonical physical space; unmigrated development accounts may still provide the migration baseline",
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
            "cloudbase_backend_mobile_producer_server_scheduler_and_selection_binding_implemented_locally_not_deployed",
        ),
        (
            "runtime backend storage",
            ("learning_event_runtime", "backend_storage"),
            "cloudbase_nosql_transaction_with_memory_test_adapter",
        ),
        (
            "runtime account-key integrity",
            ("learning_event_runtime", "active_session_account_key_integrity"),
            "server_rederives_and_matches_the_account_key_from_the_signed_session_phone",
        ),
        (
            "runtime stored projection integrity",
            ("learning_event_runtime", "stored_projection_integrity"),
            "full_v2_learning_daily_scheduler_and_migrated_v1_projection_invariants_fail_closed",
        ),
        (
            "runtime CloudBase atomic batch limit",
            ("learning_event_runtime", "cloudbase_atomic_batch_limit"),
            9,
        ),
        (
            "runtime CloudBase transaction boundary",
            ("learning_event_runtime", "cloudbase_transaction_boundary"),
            "doc_only_with_at_most_100_operations",
        ),
        (
            "runtime CloudBase worst-case operations",
            ("learning_event_runtime", "cloudbase_worst_case_transaction_operations"),
            29,
        ),
        (
            "runtime legacy migration consistency",
            ("learning_event_runtime", "legacy_migration_consistency"),
            "bounded_outside_transaction_snapshot_with_transactional_revision_fence",
        ),
        (
            "runtime all-track legacy projection migration",
            ("learning_event_runtime", "legacy_all_track_projection_migration"),
            True,
        ),
        (
            "runtime deployment boundary",
            ("learning_event_runtime", "deployment_status"),
            "not_deployed_by_repository_change",
        ),
        (
            "runtime mobile boundary",
            ("learning_event_runtime", "mobile_producer_status"),
            "implemented_locally_not_deployed",
        ),
        (
            "runtime mobile outbox schema",
            ("learning_event_runtime", "mobile_outbox_schema"),
            "learning-event-outbox.v2",
        ),
        (
            "runtime mobile durability boundary",
            ("learning_event_runtime", "mobile_durability_boundary"),
            "immutable_selection_bound_event_and_device_cursor_persist_before_card_ui_advance",
        ),
        (
            "runtime mobile replay boundary",
            ("learning_event_runtime", "mobile_replay_boundary"),
            "validated_bootstrap_then_exact_selection_bound_event_replay_then_bootstrap_refresh_and_fresh_session_read_before_dependent_mutations_or_next_card",
        ),
        (
            "runtime mobile restore boundary",
            ("learning_event_runtime", "mobile_restore_boundary"),
            "pending_event_blocks_another_card_completion_until_ack_post_ack_bootstrap_mapping_and_fresh_session_read",
        ),
        (
            "runtime mobile account switch boundary",
            ("learning_event_runtime", "mobile_account_switch_boundary"),
            "originating_session_scoped_stale_replaced_session_responses_cannot_refresh_invalidate_clear_hydrate_or_mutate_current_session",
        ),
        (
            "runtime mobile authenticated request timeout",
            ("learning_event_runtime", "mobile_authenticated_request_timeout_ms"),
            15000,
        ),
        (
            "runtime mobile request lifecycle boundary",
            ("learning_event_runtime", "mobile_request_lifecycle_boundary"),
            "timeout_retains_exact_events_and_increments_retry_while_caller_or_session_cancellation_keeps_retry_state_unchanged",
        ),
        (
            "runtime mobile active v1 learning writes",
            ("learning_event_runtime", "mobile_active_v1_learning_snapshot_writes"),
            False,
        ),
        (
            "runtime legacy write boundary",
            ("learning_event_runtime", "legacy_v1_write_status"),
            "development_bridge_learning_state_rejected_daily_progress_check_in_only_after_first_v2_event",
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
            "repository_local_backend_and_mobile_binding_implemented_not_deployed",
        ),
        (
            "runtime selection binding",
            ("learning_event_runtime", "selection_binding"),
            "unseen_event_must_match_current_account_track_selection_id_card_phase_and_content_inside_the_commit_transaction",
        ),
        (
            "runtime mobile scheduler binding",
            ("learning_event_runtime", "mobile_scheduler_session_binding"),
            True,
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
        "backend_green_does_not_claim_mobile_scheduler_deployment_or_launch_readiness",
    ]
    if not hr37:
        findings.append("learning-events contract evals: missing HR-37")
    elif hr37.get("must_hit") != expected_hr37:
        findings.append("learning-events contract evals: HR-37 must_hit drift")

    hr38 = _entry_by_id(evals.get("regressions", []), "HR-38")
    expected_hr38 = [
        "cloudbase_backend_is_repository_local_and_not_deployed",
        "mobile_durable_event_producer_is_repository_local_and_not_production_deployed",
        "legacy_v1_learning_snapshot_bridge_remains_only_for_unmigrated_development_accounts",
        "migrated_v1_daily_progress_is_check_in_only",
        "server_scheduler_is_repository_local_and_not_deployed",
        "mobile_scheduler_session_binding_is_repository_local_and_not_deployed",
        "formal_content_approval_and_production_publication_remain_pending",
        "backend_green_is_not_launch_readiness",
    ]
    if not hr38:
        findings.append("learning-events contract evals: missing HR-38")
    elif hr38.get("must_hit") != expected_hr38:
        findings.append("learning-events contract evals: HR-38 must_hit drift")

    hr39 = _entry_by_id(evals.get("regressions", []), "HR-39")
    expected_hr39 = [
        "remote_auth_and_authenticated_fetch_deadline_is_15000ms",
        "token_acquisition_first_fetch_refresh_and_retry_share_one_deadline",
        "session_replacement_aborts_stale_protected_request_and_refresh",
        "timeout_retains_exact_event_and_advances_retry_state",
        "caller_or_session_cancellation_retains_event_without_retry_increment",
        "transport_cancellation_never_invalidates_or_mutates_replacement_session",
    ]
    if not hr39:
        findings.append("learning-events contract evals: missing HR-39")
    elif hr39.get("must_hit") != expected_hr39:
        findings.append("learning-events contract evals: HR-39 must_hit drift")

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
        "legacy_v1_learning_snapshots_are_migration_only",
        "scheduler_is_a_server_owned_separate_contract",
        "backend_status_is_implemented_locally_not_deployed",
    ]
    if not gt28:
        findings.append("learning-events contract evals: missing GT-28")
    elif gt28.get("must_include") != expected_gt28:
        findings.append("learning-events contract evals: GT-28 must_include drift")

    gt29 = _entry_by_id(evals.get("golden_tasks", []), "GT-29")
    expected_gt29 = [
        "active_v2_session_account_identity",
        "active_session_account_key_is_rederived",
        "strict_learning_events_v2_schema",
        "cloudbase_atomic_batch_is_capped_at_nine",
        "cloudbase_transaction_uses_doc_only_operations",
        "track_is_part_of_canonical_event_digest",
        "account_scoped_immutable_event_and_cursor_keys",
        "stored_immutable_event_payload_digest_is_revalidated",
        "exact_duplicate_bypasses_mutable_retention_revalidation",
        "event_and_cursor_conflicts_are_atomic_409",
        "account_scoped_server_sequence_is_transactional",
        "daily_counts_and_latest_per_card_projection_are_server_derived",
        "favorite_and_check_in_authority_remain_separate",
        "retained_content_versions_survive_card_source_replacement",
        "legacy_v1_state_migrates_as_sequence_zero_baseline",
        "legacy_v1_migration_reads_all_bounded_pages",
        "legacy_migration_snapshot_uses_transactional_revision_fence",
        "legacy_v1_migration_preserves_both_track_baselines",
        "migrated_account_rejects_later_v1_learning_snapshot_writes",
        "migrated_daily_progress_cannot_override_v2_learning_or_space_counts",
        "cloudbase_and_memory_adapters_share_transaction_algorithm",
        "stored_learning_daily_and_legacy_projection_invariants_fail_closed",
        "concurrent_and_injected_failure_tests",
        "bootstrap_reads_account_keyed_v2_projection",
        "mobile_binding_deployment_and_launch_non_claims",
    ]
    if not gt29:
        findings.append("learning-events contract evals: missing GT-29")
    elif gt29.get("must_include") != expected_gt29:
        findings.append("learning-events contract evals: GT-29 must_include drift")

    gt30 = _entry_by_id(evals.get("golden_tasks", []), "GT-30")
    expected_gt30 = [
        "event_and_device_cursor_persist_before_ui_advance",
        "pseudonymous_installation_id_and_monotonic_safe_sequence",
        "credential_free_strict_event_body",
        "content_version_and_existing_two_grade_mapping",
        "independent_versioned_asyncstorage_outbox",
        "one_account_track_and_at_most_one_unseen_selection_bound_event_per_batch",
        "interleaved_track_enqueue_order_is_preserved",
        "strict_ordered_ack_before_removal",
        "byte_equivalent_retry_with_same_event_id",
        "transient_failure_pauses_until_explicit_retry_trigger",
        "event_or_dependent_mutation_enqueued_during_inflight_pass_triggers_one_serial_followup_replay",
        "restored_pending_event_blocks_duplicate_advance_until_reconciled",
        "validated_bootstrap_before_replay_and_refresh_after_ack",
        "dependent_daily_and_space_mutations_wait_for_event_reconciliation",
        "dependent_mutation_persistence_failure_does_not_report_success_or_mutate_memory",
        "late_generic_result_cannot_consume_same_id_replacement",
        "logout_clears_account_events_but_preserves_installation_cursor",
        "stale_replaced_session_response_cannot_affect_current_session_including_same_phone_reauthentication",
        "bounded_authenticated_request_deadline_includes_token_refresh_and_retry",
        "timeout_retains_exact_event_and_advances_retry_state",
        "caller_or_session_cancellation_keeps_event_retry_state_unchanged",
        "persisted_v1_learning_mutations_are_discarded",
        "active_mobile_v1_learning_snapshot_writes_are_removed",
        "storage_failure_does_not_advance_the_card",
        "mobile_binding_green_does_not_claim_backend_deployment_content_approval_or_launch_readiness",
    ]
    if not gt30:
        findings.append("learning-events contract evals: missing GT-30")
    elif gt30.get("must_include") != expected_gt30:
        findings.append("learning-events contract evals: GT-30 must_include drift")

    hr41 = _entry_by_id(evals.get("regressions", []), "HR-41")
    expected_hr41 = [
        "selection_id_is_required_immutable_event_evidence",
        "unseen_event_matches_current_account_track_selection",
        "selection_card_phase_and_content_must_match",
        "selection_validation_and_clear_share_event_transaction",
        "exact_duplicate_remains_valid_after_cursor_clear",
        "at_most_one_unseen_event_per_request",
        "pending_event_blocks_second_card_completion",
        "post_ack_bootstrap_and_fresh_session_before_next_card",
        "learning_session_membership_stage_drift_requires_canonical_bootstrap_refresh",
        "remote_null_selection_never_falls_back_to_client_ordering",
        "repository_local_binding_is_not_deployment_or_launch_readiness",
    ]
    if not hr41:
        findings.append("learning-events contract evals: missing HR-41")
    elif hr41.get("must_hit") != expected_hr41:
        findings.append("learning-events contract evals: HR-41 must_hit drift")

    gt32 = _entry_by_id(evals.get("golden_tasks", []), "GT-32")
    expected_gt32 = [
        "account_sync_contract_owner",
        "strict_authenticated_learning_session_v1_parser",
        "session_and_card_source_track_source_content_match",
        "only_server_selected_card_is_rendered",
        "selection_null_never_uses_local_fallback_or_ordering",
        "selection_id_card_phase_content_persist_before_ui_advance",
        "backend_transaction_validates_current_selection",
        "at_most_one_unseen_event_and_exact_duplicates_remain_idempotent",
        "pending_event_blocks_second_completion",
        "post_ack_bootstrap_then_fresh_session_before_next_card",
        "learning_session_membership_stage_drift_requires_canonical_bootstrap_refresh",
        "stale_session_or_auth_response_cannot_replace_current_session",
        "prebinding_outbox_v1_is_removed_without_replay",
        "local_mode_preserves_development_five_interaction_session",
        "mobile_and_backend_binding_are_not_deployed_by_repository_change",
        "formal_content_approval_and_launch_readiness_remain_pending",
    ]
    if not gt32:
        findings.append("learning-events contract evals: missing GT-32")
    elif gt32.get("must_include") != expected_gt32:
        findings.append("learning-events contract evals: GT-32 must_include drift")

    required_runtime_snippets = [
        "repository-local CommonJS CloudBase function now implements",
        "This repository change deploys neither backend nor mobile release artifacts;",
        "softbook_learning_events",
        "softbook_learning_migration_revisions",
        "softbook_learning_sessions",
        "softbook_card_source_versions",
        "at most 9 input events",
        "29 operations",
        "both CET4 and CET6 legacy learning baselines",
        "outside the transaction",
        "revision fence",
        "The primary idempotency key is `(account_id, event_id)`.",
        "An exact replay returns `duplicate`, the original `server_sequence`, and no",
        "Binding the same cursor to another event also returns `409`",
        "commit in one transaction",
        "not the scheduler cursor and not a",
        "does not accept a client-authored",
        "reads `/v2/bootstrap` again",
        "learning-event-outbox.v2",
        "`selection_id`: the opaque ID copied from the current authenticated",
        "exact match on `selection_id`,",
        "at most one unseen event",
        "fresh learning-session read",
        "ends a batch at the first track boundary",
        "positive device sequence before advancing the card UI.",
        "leaves the current result in place.",
        "A transient failure pauses automatic replay until network recovery,",
        "Replay is serialized per originating session.",
        "Authenticated startup hydrates the account's outbox count with bootstrap.",
        "Generic mutation queue operations are serialized and use candidate persistence:",
        "daily-progress and space-state",
        "active mobile completion no longer calls",
        "Late replay, authorization, or bootstrap responses",
        "including same-phone reauthentication.",
        "Every remote authentication call has a 15-second deadline",
        "Explicit caller cancellation or session replacement leaves the queued event and retry",
        "Legacy `/v1/learning/state-sync` remains",
        "only `checked_in_today` is merged",
        "409 legacy_learning_write_disabled",
        "The repository-local backend, scheduler, and mobile binding do not prove",
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


def learning_scheduler_contract_findings(
    auth,
    runtime,
    agent,
    evals,
    runtime_text,
    agent_entry_text,
    provision_text,
    package_text,
):
    findings = []
    rating_mapping = {
        "review_needed": "Again",
        "passed_with_used_hint_or_used_peek": "Hard",
        "passed_without_assistance": "Good",
        "Easy": "unused",
    }
    owner_expectations = [
        (
            "scheduler classification",
            ("server_scheduler_v1", "classification"),
            "implementation_hypothesis",
        ),
        (
            "scheduler status",
            ("server_scheduler_v1", "contract_status"),
            "repository_local_backend_and_mobile_binding_implemented_not_deployed",
        ),
        (
            "scheduler runtime document",
            ("server_scheduler_v1", "runtime_contract"),
            "infra/cloudbase/learning-session-v1-runtime-contract.md",
        ),
        (
            "scheduler endpoint method",
            ("server_scheduler_v1", "endpoint", "method"),
            "GET",
        ),
        (
            "scheduler endpoint path",
            ("server_scheduler_v1", "endpoint", "path"),
            "/v2/learning/session",
        ),
        (
            "scheduler endpoint authentication",
            ("server_scheduler_v1", "endpoint", "authentication"),
            "active_v2_session",
        ),
        (
            "scheduler identity authority",
            ("server_scheduler_v1", "endpoint", "identity_rule"),
            "derive the account only from the active v2 session; reject every query field except track and reject every request body",
        ),
        (
            "scheduler response schema",
            ("server_scheduler_v1", "endpoint", "response_schema"),
            "learning-session.v1",
        ),
        (
            "scheduler response membership stages",
            ("server_scheduler_v1", "response_contract", "membership_stage_values"),
            ["trial", "free", "premium"],
        ),
        (
            "scheduler algorithm",
            ("server_scheduler_v1", "algorithm_contract", "algorithm"),
            "FSRS-6",
        ),
        (
            "scheduler library",
            ("server_scheduler_v1", "algorithm_contract", "library"),
            "ts-fsrs",
        ),
        (
            "scheduler library version",
            ("server_scheduler_v1", "algorithm_contract", "library_version"),
            "5.4.1",
        ),
        (
            "scheduler policy version",
            ("server_scheduler_v1", "algorithm_contract", "policy_version"),
            "softbook-fsrs.v1",
        ),
        (
            "scheduler parameters",
            ("server_scheduler_v1", "algorithm_contract", "parameters"),
            "version_locked_library_defaults_with_fuzz_disabled",
        ),
        (
            "scheduler server time",
            ("server_scheduler_v1", "algorithm_contract", "server_time_rule"),
            "apply newly accepted events to scheduler state at canonical server acceptance time; client_occurred_at remains bounded activity-day input and never overrides server_sequence ordering",
        ),
        (
            "scheduler rating mapping",
            ("server_scheduler_v1", "algorithm_contract", "rating_mapping"),
            rating_mapping,
        ),
        (
            "scheduler visible assessment",
            (
                "server_scheduler_v1",
                "algorithm_contract",
                "visible_assessment_rule",
            ),
            "the server-only mapping never expands the visible two-state self-assessment into four choices",
        ),
        (
            "scheduler projection storage",
            ("server_scheduler_v1", "projection_contract", "storage"),
            "account_and_track_scoped_scheduler_by_card_id_inside_the_learning_events_v2_projection",
        ),
        (
            "scheduler projection atomicity",
            ("server_scheduler_v1", "projection_contract", "atomicity"),
            "current selection validation, one new immutable event, account server sequence, learning projection, FSRS scheduler projection, learning-session projection watermark update and exact selection clearing, and daily progress commit in the same transaction",
        ),
        (
            "scheduler projection integrity",
            ("server_scheduler_v1", "projection_contract", "integrity"),
            "every positive-sequence latest card projection has exactly one matching validated scheduler state and no orphan scheduler state is accepted",
        ),
        (
            "scheduler duplicate rule",
            ("server_scheduler_v1", "projection_contract", "duplicate_rule"),
            "exact event replay does not advance FSRS state, due time, cursor, sequence, or counters",
        ),
        (
            "scheduler legacy rule",
            ("server_scheduler_v1", "projection_contract", "legacy_rule"),
            "sequence-zero migrated cards have no invented FSRS history and remain immediately review-eligible until their first accepted v2 event",
        ),
        (
            "scheduler cursor rule",
            ("server_scheduler_v1", "projection_contract", "cursor_rule"),
            "a selected card persists in the independent account-and-track softbook_learning_sessions record as an opaque revisioned server cursor with an acknowledged-at plus latest-positive-server-sequence projection watermark; every newly accepted event for the track updates the timestamp component and advances the sequence component, first-event all-track migration synchronizes every migrated track while preserving valid sibling cursors, only one unseen completion carrying the exact current selection_id, card_id, phase, and content_version clears the cursor atomically, exact duplicate replay remains valid after clearing, and a session read requires the complete matching watermark plus transactional revision confirmation before returning a resumed cursor",
        ),
        (
            "scheduler single-card rule",
            ("server_scheduler_v1", "selection_contract", "single_card_rule"),
            "return at most one selection and never return card body content",
        ),
        (
            "scheduler resume order",
            ("server_scheduler_v1", "selection_contract", "existing_cursor_rule"),
            "resume an eligible persisted cursor before selecting another card only after its learning-projection watermark matches and its revision is transactionally confirmed",
        ),
        (
            "scheduler due order",
            ("server_scheduler_v1", "selection_contract", "due_rule"),
            "select an accessible non-sleeping due review before every new card; order by earliest due time, then canonical card-source index, then card_id",
        ),
        (
            "scheduler new-card order",
            ("server_scheduler_v1", "selection_contract", "new_card_rule"),
            "when no review is due, select the first accessible non-sleeping unseen card in normalized ordered card_records",
        ),
        (
            "scheduler empty-selection consistency",
            ("server_scheduler_v1", "selection_contract", "future_rule"),
            "when no due review or new card exists, return selection null plus the earliest future next_due_at when one exists only after transactionally confirming the matching learning-projection watermark and session revision",
        ),
        (
            "scheduler sleep authority",
            ("server_scheduler_v1", "selection_contract", "sleep_rule"),
            "canonical physical-space sleeping state removes a card from resume, due, new, and next-due selection without deleting its learning or FSRS state",
        ),
        (
            "scheduler membership authority",
            ("server_scheduler_v1", "selection_contract", "membership_rule"),
            "the first authenticated learning-session entry starts an available trial exactly once only after canonical context validation, selection generation, and required cursor persistence succeed; trial and premium may schedule the full library, while free schedules a stable release-scoped prefix of ceil(card_count * 0.5) in canonical card-source order",
        ),
        (
            "scheduler content authority",
            ("server_scheduler_v1", "selection_contract", "content_rule"),
            "selection binds to the exact normalized content_version and source; production still requires a matching published content-release.v1 descriptor",
        ),
        (
            "mobile session read binding",
            (
                "server_scheduler_v1",
                "mobile_binding_contract",
                "session_read_rule",
            ),
            "remote mobile learning reads authenticated learning-session.v1 and the canonical card source, requires matching track, source_id, and content_version, and resolves only the returned card_id; it never applies client membership, sleep, review, or catalog ordering to replace the server selection",
        ),
        (
            "mobile completion binding",
            (
                "server_scheduler_v1",
                "mobile_binding_contract",
                "completion_rule",
            ),
            "the mobile completion event copies the returned selection_id and phase and must match the selected card and exact content version before durable enqueue",
        ),
        (
            "mobile membership reconciliation",
            (
                "server_scheduler_v1",
                "mobile_binding_contract",
                "membership_reconciliation_rule",
            ),
            "when learning-session.v1 membership_stage differs from the bootstrap snapshot, remote mobile refreshes canonical bootstrap and requires the exact stage before presenting the selection; it never synthesizes entitlement counters or dates from the session response",
        ),
        (
            "mobile next-card binding",
            (
                "server_scheduler_v1",
                "mobile_binding_contract",
                "advance_rule",
            ),
            "after durable enqueue the completed card may leave the interaction surface, but no next card is selected until strict event acknowledgement, bootstrap reconciliation, and a fresh learning-session.v1 read",
        ),
        (
            "mobile offline binding",
            (
                "server_scheduler_v1",
                "mobile_binding_contract",
                "offline_rule",
            ),
            "a previously validated cached selection and matching content may be answered once offline; without that pair learning stays blocked, and no second card may be selected locally",
        ),
        (
            "mobile empty selection binding",
            (
                "server_scheduler_v1",
                "mobile_binding_contract",
                "empty_rule",
            ),
            "selection null is a valid server result and does not trigger bundled-card fallback or client ordering",
        ),
        (
            "scheduler response reasons",
            (
                "server_scheduler_v1",
                "response_contract",
                "selection_reason_values",
            ),
            ["persisted_cursor", "due_review", "catalog_new"],
        ),
        (
            "scheduler known gaps",
            ("server_scheduler_v1", "known_gaps"),
            [
                "production_deployment",
                "global_legacy_v1_snapshot_write_removal",
                "production_membership_expiry_and_payment_entitlement",
                "formal_content_publication",
            ],
        ),
        (
            "scheduler launch non-claim",
            ("server_scheduler_v1", "launch_claim_rule"),
            "a green repository-local scheduler and mobile binding do not prove deployed integration, production entitlement, formal content approval, or launch readiness",
        ),
    ]
    for label, keys, expected in owner_expectations:
        _expect_path(findings, label, auth, keys, expected)

    runtime_expectations = [
        (
            "scheduler runtime owner",
            ("scheduler_runtime", "owner"),
            "spec/account-sync-contract.json#server_scheduler_v1",
        ),
        (
            "scheduler runtime contract",
            ("scheduler_runtime", "runtime_contract"),
            "infra/cloudbase/learning-session-v1-runtime-contract.md",
        ),
        (
            "scheduler runtime endpoint",
            ("scheduler_runtime", "endpoint"),
            "GET /v2/learning/session",
        ),
        (
            "scheduler runtime response",
            ("scheduler_runtime", "response_schema"),
            "learning-session.v1",
        ),
        (
            "scheduler runtime identity",
            ("scheduler_runtime", "account_identity"),
            "active_v2_session_only",
        ),
        (
            "scheduler runtime algorithm",
            ("scheduler_runtime", "algorithm"),
            "FSRS-6_via_exact_ts-fsrs_5.4.1",
        ),
        (
            "scheduler runtime rating",
            ("scheduler_runtime", "rating_mapping"),
            "review_needed_to_again_passed_with_assistance_to_hard_other_passed_to_good_easy_unused",
        ),
        (
            "scheduler runtime event time",
            ("scheduler_runtime", "event_time_authority"),
            "canonical_server_acceptance_time",
        ),
        (
            "scheduler runtime atomicity",
            ("scheduler_runtime", "projection_atomicity"),
            "selection_validation_event_sequence_learning_fsrs_session_watermark_exact_cursor_clear_and_daily_progress_commit_together",
        ),
        (
            "scheduler runtime cursor storage",
            ("scheduler_runtime", "cursor_storage"),
            "softbook_learning_sessions_revision_compare_and_swap_with_acknowledged_at_and_server_sequence_projection_watermark",
        ),
        (
            "scheduler runtime empty-selection consistency",
            ("scheduler_runtime", "empty_selection_consistency"),
            "selection_null_and_next_due_require_transactional_watermark_and_revision_confirmation",
        ),
        (
            "scheduler runtime selection",
            ("scheduler_runtime", "selection_order"),
            "eligible_persisted_cursor_then_earliest_due_review_then_canonical_catalog_new_card",
        ),
        (
            "scheduler runtime sleep",
            ("scheduler_runtime", "sleep_authority"),
            "canonical_physical_space_excludes_sleeping_cards_without_deleting_scheduler_state",
        ),
        (
            "scheduler runtime membership",
            ("scheduler_runtime", "membership_authority"),
            "first_session_starts_available_trial_trial_and_premium_full_free_canonical_prefix_ceil_half",
        ),
        (
            "scheduler runtime membership mutation atomicity",
            ("scheduler_runtime", "membership_mutation_atomicity"),
            "cloudbase_single_document_transactions_prevent_trial_or_recovery_from_downgrading_premium",
        ),
        (
            "scheduler runtime content",
            ("scheduler_runtime", "content_authority"),
            "exact_normalized_content_version_and_source",
        ),
        (
            "scheduler runtime exact resume",
            ("scheduler_runtime", "exact_same_card_cross_device_resume_required"),
            False,
        ),
        (
            "scheduler runtime mobile binding",
            ("scheduler_runtime", "mobile_session_binding_status"),
            "implemented_locally_not_deployed",
        ),
        (
            "scheduler runtime mobile binding behavior",
            ("scheduler_runtime", "mobile_session_binding"),
            "authenticated_session_and_card_source_must_match_track_source_and_content_then_only_server_selected_card_is_rendered_and_selection_id_is_durably_submitted",
        ),
        (
            "scheduler runtime mobile membership reconciliation",
            ("scheduler_runtime", "mobile_membership_reconciliation"),
            "session_stage_drift_requires_verified_canonical_bootstrap_refresh_before_presenting_selection",
        ),
        (
            "scheduler runtime deployment",
            ("scheduler_runtime", "deployment_status"),
            "not_deployed_by_repository_change",
        ),
        (
            "scheduler runtime launch",
            ("scheduler_runtime", "launch_gate_status"),
            "pending",
        ),
    ]
    for label, keys, expected in runtime_expectations:
        _expect_path(findings, label, runtime, keys, expected)

    runtime_path = "infra/cloudbase/learning-session-v1-runtime-contract.md"
    events_runtime_path = (
        "infra/cloudbase/learning-events-v2-runtime-contract.md"
    )
    found, values = _read_path(agent, ("read_paths", "learning_scheduler_runtime"))
    if not found or runtime_path not in values or events_runtime_path not in values:
        findings.append(
            "learning-scheduler contract agent read path "
            "learning_scheduler_runtime: missing scheduler or event runtime contract"
        )

    expected_hr40 = [
        "account_sync_contract_is_scheduler_owner",
        "active_v2_session_is_only_account_identity",
        "client_scheduler_fields_and_card_choice_are_forbidden",
        "exact_ts_fsrs_5_4_1_policy_softbook_fsrs_v1",
        "visible_assessment_remains_two_state",
        "server_acceptance_time_and_sequence_are_canonical",
        "exact_duplicate_does_not_advance_fsrs_or_cursor",
        "projection_watermark_and_transactional_cursor_confirmation_prevent_stale_selection",
        "eligible_persisted_cursor_then_due_review_then_catalog_new",
        "sleeping_cards_are_excluded_without_history_deletion",
        "free_access_is_release_scoped_canonical_ceil_half_prefix",
        "only_exact_selection_bound_completion_clears_cursor_atomically",
        "production_requires_published_content_release",
        "repository_local_green_does_not_claim_deployed_integration_or_launch",
    ]
    hr40 = _entry_by_id(evals.get("regressions", []), "HR-40")
    if not hr40:
        findings.append("learning-scheduler contract evals: missing HR-40")
    elif hr40.get("must_hit") != expected_hr40:
        findings.append("learning-scheduler contract evals: HR-40 must_hit drift")

    expected_gt31 = [
        "active_v2_session_account_identity",
        "strict_get_track_only_and_no_request_body",
        "exact_ts_fsrs_5_4_1_with_softbook_fsrs_v1_and_fuzz_disabled",
        "review_needed_again_assisted_hard_unassisted_good_easy_unused",
        "visible_two_state_assessment_is_unchanged",
        "server_acceptance_time_and_server_sequence_authority",
        "scheduler_projection_matches_latest_positive_sequence_event",
        "sequence_zero_legacy_cards_have_no_invented_fsrs_history",
        "event_learning_fsrs_cursor_and_daily_state_commit_atomically",
        "exact_duplicate_does_not_advance_scheduler_or_clear_new_cursor",
        "revisioned_account_track_cursor_compare_and_swap",
        "learning_session_projection_watermark_advances_with_every_new_event",
        "timestamp_and_server_sequence_watermark_rejects_equal_time_split_reads",
        "all_track_migration_synchronizes_watermarks_and_preserves_sibling_cursor",
        "resumed_cursor_is_transactionally_confirmed_before_response",
        "empty_selection_and_next_due_are_transactionally_confirmed_before_response",
        "eligible_persisted_cursor_before_due_review_before_catalog_new",
        "earliest_due_then_canonical_index_then_card_id",
        "sleeping_cards_are_excluded_without_deleting_history",
        "trial_starts_only_after_canonical_context_and_selection_persistence",
        "transactional_membership_mutations_cannot_downgrade_premium",
        "trial_and_premium_full_access_free_ceil_half_canonical_prefix",
        "production_content_release_fails_closed",
        "cloudbase_worst_case_transaction_operations_is_29",
        "cloudbase_learning_sessions_collection_is_provisioned",
        "memory_and_cloudbase_concurrency_rollback_and_cross_instance_tests",
        "bootstrap_exposes_only_sanitized_cursor_identity",
        "mobile_binding_is_repository_local_and_deployment_content_approval_and_launch_remain_non_claims",
    ]
    gt31 = _entry_by_id(evals.get("golden_tasks", []), "GT-31")
    if not gt31:
        findings.append("learning-scheduler contract evals: missing GT-31")
    elif gt31.get("must_include") != expected_gt31:
        findings.append("learning-scheduler contract evals: GT-31 must_include drift")

    required_runtime_snippets = [
        "`GET /v2/learning/session` is the repository-local server selection boundary.",
        "`ts-fsrs@5.4.1`",
        "`softbook_learning_sessions`",
        "`Easy` is unused.",
        "The scheduler applies events in canonical `server_sequence` order",
        "Current selection validation, one new immutable event, its device cursor",
        "`learning_server_sequence`, a two-part projection watermark",
        "Resume a persisted cursor only while its account, track, content version,",
        "Free schedules the stable release-scoped prefix of",
        "Canonical context validation, selection ID generation, and required cursor",
        "dismissal cannot overwrite a premium purchase.",
        "one newly accepted event carrying that selection ID and matching card, phase,",
        "and its `next_due_at` receive the same transactional watermark",
        "This backend and the mobile binding are repository-local and not deployed.",
        "Remote mobile learning fetches `learning-session.v1`",
        "requires the canonical stage to match before presenting the session.",
        "pending unseen event blocks a second completion.",
        "This contract does not prove:",
        "deployed mobile/backend integration or release validation",
    ]
    for snippet in required_runtime_snippets:
        if snippet not in runtime_text:
            findings.append(
                f"learning-scheduler runtime contract missing exact snippet: {snippet!r}"
            )

    if "'softbook_learning_sessions'" not in provision_text:
        findings.append(
            "learning-scheduler provisioning: missing softbook_learning_sessions"
        )
    if '"ts-fsrs": "5.4.1"' not in package_text:
        findings.append(
            "learning-scheduler dependency: ts-fsrs must be pinned exactly to 5.4.1"
        )
    if runtime_path not in agent_entry_text:
        findings.append(
            "learning-scheduler Agent entry: missing exact runtime contract path"
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
    scheduler_runtime_contract = (
        context.root / "infra/cloudbase/learning-session-v1-runtime-contract.md"
    )
    scheduler_runtime_text = (
        scheduler_runtime_contract.read_text(encoding="utf-8")
        if scheduler_runtime_contract.is_file()
        else ""
    )
    provision_path = context.root / "infra/cloudbase/provision-softbook-nosql.mjs"
    provision_text = (
        provision_path.read_text(encoding="utf-8")
        if provision_path.is_file()
        else ""
    )
    package_path = (
        context.root / "infra/cloudbase/functions/softbook-api/package.json"
    )
    package_text = (
        package_path.read_text(encoding="utf-8") if package_path.is_file() else ""
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
    context.errors.extend(
        learning_scheduler_contract_findings(
            auth,
            runtime,
            agent,
            evals,
            scheduler_runtime_text,
            agent_entry_text,
            provision_text,
            package_text,
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
