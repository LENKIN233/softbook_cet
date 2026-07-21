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
        (
            "status",
            ("learning_events_v2", "contract_status"),
            "cloudbase_backend_and_mobile_client_implemented_locally_not_deployed",
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
            "atomic transaction",
            ("learning_events_v2", "idempotency_and_atomicity", "transaction_atomicity"),
            "new immutable events, account server sequences, and derived learning projections commit in one transaction; failure leaves no partial acceptance",
        ),
        (
            "CloudBase atomic batch rule",
            (
                "learning_events_v2",
                "idempotency_and_atomicity",
                "cloudbase_atomic_batch_rule",
            ),
            "the repository-local CloudBase adapter accepts at most 9 events so worst-case immutable-event, retained-content, all-track migration, projection, and daily work uses at most 91 of the platform limit of 100 operations per transaction",
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
            "learning-event-outbox.v1",
        ),
        (
            "mobile durable storage owner contract",
            ("learning_events_v2", "mobile_client_contract", "storage_rule"),
            "persist the outbox under an independent versioned AsyncStorage key; persist the immutable event and allocated installation cursor before advancing the card UI",
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
            "submit at most 9 events for one account and one track per request without compacting, rewriting, or reordering immutable payloads; end a batch at the first track boundary",
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
            "hydrate the account outbox count with authenticated bootstrap; a restored pending event blocks duplicate card advance until strict acknowledgement and post-acknowledgement bootstrap mapping, while events enqueued in the current validated session may continue batching without a routine canonical refresh overwriting local intent",
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
            "mobile legacy queue owner contract",
            ("learning_events_v2", "mobile_client_contract", "legacy_queue_rule"),
            "discard persisted generic sync_learning_state mutations during hydration and never route active mobile learning completion through /v1/learning/state-sync",
        ),
        (
            "launch non-claim",
            ("learning_events_v2", "migration_boundary", "launch_claim_rule"),
            "green repository-local backend and mobile client tests do not satisfy global legacy snapshot-write removal, server scheduling, formal content approval, production deployment, or launch readiness",
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
            "cloudbase_backend_and_mobile_producer_implemented_locally_not_deployed_scheduler_pending",
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
            "full_v2_learning_daily_and_migrated_v1_projection_invariants_fail_closed",
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
            "learning-event-outbox.v1",
        ),
        (
            "runtime mobile durability boundary",
            ("learning_event_runtime", "mobile_durability_boundary"),
            "immutable_event_and_device_cursor_persist_before_card_ui_advance",
        ),
        (
            "runtime mobile replay boundary",
            ("learning_event_runtime", "mobile_replay_boundary"),
            "validated_bootstrap_then_exact_event_replay_then_bootstrap_refresh_before_dependent_mutations",
        ),
        (
            "runtime mobile restore boundary",
            ("learning_event_runtime", "mobile_restore_boundary"),
            "restored_pending_event_blocks_duplicate_card_advance_until_ack_and_post_ack_bootstrap_mapping",
        ),
        (
            "runtime mobile account switch boundary",
            ("learning_event_runtime", "mobile_account_switch_boundary"),
            "originating_session_scoped_stale_replaced_session_responses_cannot_refresh_invalidate_clear_hydrate_or_mutate_current_session",
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
        "server_scheduler_remains_a_separate_future_gate",
        "formal_content_approval_and_production_publication_remain_pending",
        "backend_green_is_not_launch_readiness",
    ]
    if not hr38:
        findings.append("learning-events contract evals: missing HR-38")
    elif hr38.get("must_hit") != expected_hr38:
        findings.append("learning-events contract evals: HR-38 must_hit drift")

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
        "scheduler_is_a_separate_future_gate",
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
        "mobile_scheduler_deployment_and_launch_non_claims",
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
        "one_account_and_track_per_batch_with_limit_nine",
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
        "persisted_v1_learning_mutations_are_discarded",
        "active_mobile_v1_learning_snapshot_writes_are_removed",
        "storage_failure_does_not_advance_the_card",
        "mobile_green_does_not_claim_backend_deployment_scheduler_content_approval_or_launch_readiness",
    ]
    if not gt30:
        findings.append("learning-events contract evals: missing GT-30")
    elif gt30.get("must_include") != expected_gt30:
        findings.append("learning-events contract evals: GT-30 must_include drift")

    required_runtime_snippets = [
        "repository-local CommonJS CloudBase function now implements",
        "This repository change deploys neither backend nor mobile release artifacts;",
        "softbook_learning_events",
        "softbook_learning_migration_revisions",
        "softbook_card_source_versions",
        "at most 9 events",
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
        "learning-event-outbox.v1",
        "ends a batch at the first track boundary",
        "advancing the card UI. A failed durable write leaves the current result in",
        "A transient failure pauses automatic replay until network recovery,",
        "Replay is serialized per originating session.",
        "Authenticated startup hydrates the account's outbox count with bootstrap.",
        "Generic mutation queue operations are serialized and use candidate persistence:",
        "daily-progress and space-state",
        "active mobile completion no longer calls",
        "Late replay, authorization, or bootstrap responses",
        "including same-phone reauthentication.",
        "Legacy `/v1/learning/state-sync` remains",
        "only `checked_in_today` is merged",
        "409 legacy_learning_write_disabled",
        "The repository-local backend and mobile implementation do not prove",
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
