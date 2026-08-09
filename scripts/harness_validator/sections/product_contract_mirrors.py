from __future__ import annotations

import json


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


def _expect_contract_path(findings, contract, label, value, keys, expected):
    found, actual = _read_path(value, keys)
    if not found:
        findings.append(f"{contract} contract {label}: missing {'.'.join(keys)}")
    elif actual != expected:
        findings.append(
            f"{contract} contract {label}: expected {expected!r}, got {actual!r}"
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
    provision_text,
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
            "the repository-local CloudBase learning-events.v2 backend, explicit daily check-in, physical-space actions, React Native durable producer/replay, server scheduler, and mobile scheduler-session binding are implemented but not deployed; production publication remains unimplemented",
        ),
        (
            "canonical China product day",
            ("canonical_read", "day_key_rule"),
            "mobile derives the China product day from the current instant at fixed UTC+8 through one shared helper; bootstrap, explicit check-in, and local daily presentation must never use the host timezone or the UTC calendar date as independent authorities",
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
            True,
        ),
        (
            "migrated account legacy write boundary",
            (
                "learning_events_v2",
                "implementation_progress",
                "migrated_account_v1_learning_writes",
            ),
            "daily_and_learning_snapshot_routes_disabled_globally_v2_check_in_is_the_only_daily_write",
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
            "replay only after validated bootstrap and content hydration; while events are pending, queue dependent check-in and space-state mutations and suppress routine canonical refreshes that would overwrite local intent; after any acknowledgement, keep dependent mutations blocked until another bootstrap is fetched and mapped",
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
            "green repository-local backend, explicit check-in, scheduler, mobile binding, memory smoke, or simulated evidence do not satisfy formal content approval, production deployment, or launch readiness",
        ),
        (
            "migrated account write rule",
            ("learning_events_v2", "migration_boundary", "migrated_account_write_rule"),
            "the first accepted v2 event transaction preserves valid retained sequence-zero learning baselines for both tracks before closing migration; both v1 snapshot-write routes always return 410, while v2 check-in can only merge monotonic checked_in_today and cannot overwrite server-derived learning counts or canonical physical-space counts",
        ),
        (
            "daily check-in status",
            ("daily_check_in_v2", "contract_status"),
            "cloudbase_backend_and_mobile_client_implemented_locally_not_deployed",
        ),
        (
            "daily check-in endpoint",
            ("daily_check_in_v2", "endpoint", "path"),
            "/v2/progress/check-in",
        ),
        (
            "daily check-in authentication",
            ("daily_check_in_v2", "endpoint", "authentication"),
            "active_v2_session",
        ),
        (
            "daily check-in identity",
            ("daily_check_in_v2", "endpoint", "identity_rule"),
            "derive the account only from the active v2 session; reject phone_number, counters, snapshots, and every request field except day_key",
        ),
        (
            "daily check-in required fields",
            ("daily_check_in_v2", "command_contract", "required_fields"),
            ["day_key"],
        ),
        (
            "daily check-in China product day",
            ("daily_check_in_v2", "command_contract", "day_key_rule"),
            "require a valid YYYY-MM-DD; mobile captures the China product day at fixed UTC+8 when the explicit action occurs and preserves that exact day during offline replay; the client cannot submit checked_in_today because the endpoint itself is the affirmative action",
        ),
        (
            "daily check-in schema",
            ("daily_check_in_v2", "command_contract", "schema_rule"),
            "reject unknown fields and any empty, scalar, array, or missing body",
        ),
        (
            "daily check-in monotonic rule",
            ("daily_check_in_v2", "command_contract", "monotonic_rule"),
            "the first valid command moves the account-and-day state to checked in; exact repeats return the already-canonical acknowledgement without another state transition",
        ),
        (
            "daily check-in counter rule",
            ("daily_check_in_v2", "command_contract", "counter_rule"),
            "never accept learning, review, favorite, sleeping, pending-review, or total counters; learning aggregates are derived from accepted learning-events.v2 and space aggregates are derived from canonical physical space",
        ),
        (
            "daily check-in storage rule",
            ("daily_check_in_v2", "command_contract", "storage_rule"),
            "persist only schema_version, account_key, day_key, checked_in_today true, and acknowledged_at in the independent softbook_daily_check_ins collection",
        ),
        (
            "daily check-in storage adapter",
            ("daily_check_in_v2", "command_contract", "storage_adapter_rule"),
            "CloudBase may return its system _id; strip only that adapter-owned field before validating the exact five-field business record, and fail closed on every other unknown or malformed field",
        ),
        (
            "daily check-in migration rule",
            ("daily_check_in_v2", "command_contract", "migration_rule"),
            "write an independent account-and-day daily-check-in.v2 record and never mutate retained legacy daily documents; first-event migration can still read their unchanged baseline counters while canonical reads overlay the independent check-in",
        ),
        (
            "daily check-in transaction rule",
            ("daily_check_in_v2", "command_contract", "transaction_rule"),
            "check-in commits monotonically in its own account-and-day record through the same serialized memory store or CloudBase transaction facility; learning-event transactions never overwrite that record, so a concurrent first event cannot lose the action",
        ),
        (
            "daily check-in mobile trigger",
            ("daily_check_in_v2", "mobile_contract", "trigger_rule"),
            "only an explicit user check-in creates the command; learning completion never uploads a daily snapshot because learning-events.v2 owns progress",
        ),
        (
            "daily check-in offline queue",
            ("daily_check_in_v2", "mobile_contract", "offline_rule"),
            "persist a credential-free account-scoped check_in_daily_progress command containing only dayKey; replay injects the current access token in memory",
        ),
        (
            "daily check-in legacy queue",
            ("daily_check_in_v2", "mobile_contract", "legacy_queue_rule"),
            "during hydration convert a persisted sync_daily_progress entry only when its complete legacy snapshot records checkedInToday true, uses a valid day, contains nonnegative integer counters, and has a consistent total; retain only account context and dayKey and discard every other legacy daily snapshot entry",
        ),
        (
            "daily check-in acknowledgement",
            ("daily_check_in_v2", "mobile_contract", "ack_rule"),
            "remove the queued command only after a strict matching daily-check-in.v2 response; a failed, ambiguous, cancelled, or stale-session response keeps the command queued",
        ),
        (
            "daily check-in restart recovery",
            ("daily_check_in_v2", "mobile_contract", "recovery_rule"),
            "on restart, preserve a queued local check-in only when an exact persisted command matches the active account and bootstrap day; without that command, canonical checked_in_today false clears stale local state, and event-derived counts never confirm check-in",
        ),
        (
            "daily check-in disabled routes",
            ("daily_check_in_v2", "legacy_cutover", "disabled_routes"),
            [
                "POST /v1/progress/daily-sync",
                "POST /v1/learning/state-sync",
            ],
        ),
        (
            "daily check-in legacy scope",
            ("daily_check_in_v2", "legacy_cutover", "scope_rule"),
            "no runtime option, legacy token, active v2 session, or unmigrated account can re-enable either snapshot-write route; retained legacy documents are read-only migration input",
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
            "daily_and_learning_snapshot_routes_disabled_globally_retained_documents_are_read_only_migration_input",
        ),
        (
            "runtime daily check-in owner",
            ("daily_check_in_runtime", "owner"),
            "spec/account-sync-contract.json#daily_check_in_v2",
        ),
        (
            "runtime daily check-in endpoint",
            ("daily_check_in_runtime", "endpoint"),
            "POST /v2/progress/check-in",
        ),
        (
            "runtime daily check-in request",
            ("daily_check_in_runtime", "request_body"),
            "strict_day_key_only_without_phone_snapshot_or_counters",
        ),
        (
            "runtime daily check-in storage",
            ("daily_check_in_runtime", "storage_collection"),
            "softbook_daily_check_ins",
        ),
        (
            "runtime daily check-in stored integrity",
            ("daily_check_in_runtime", "stored_integrity"),
            "exact_account_day_schema_is_revalidated_on_write_and_canonical_read_and_corruption_fails_closed",
        ),
        (
            "runtime daily check-in system fields",
            ("daily_check_in_runtime", "storage_system_fields"),
            "cloudbase_adapter_strips_only_system_id_before_exact_business_schema_validation",
        ),
        (
            "runtime daily check-in write boundary",
            ("daily_check_in_runtime", "write_boundary"),
            "independent_monotonic_idempotent_account_day_record_never_mutates_retained_legacy_documents",
        ),
        (
            "runtime daily check-in transaction",
            ("daily_check_in_runtime", "transaction_boundary"),
            "serialized_memory_or_cloudbase_transaction_record_not_overwritten_by_learning_event_migration",
        ),
        (
            "runtime daily check-in trigger",
            ("daily_check_in_runtime", "mobile_trigger"),
            "explicit_user_check_in_only_never_learning_completion",
        ),
        (
            "runtime daily check-in China product day",
            ("daily_check_in_runtime", "mobile_day_key"),
            "one_shared_fixed_utc_plus_8_china_product_day_for_bootstrap_check_in_and_local_daily_presentation",
        ),
        (
            "runtime daily check-in queue",
            ("daily_check_in_runtime", "mobile_queue"),
            "credential_free_check_in_daily_progress_with_account_context_and_day_key_only",
        ),
        (
            "runtime daily check-in recovery",
            ("daily_check_in_runtime", "mobile_recovery"),
            "exact_pending_account_day_command_preserves_queued_check_in_on_restart_without_matching_queue_canonical_false_clears_stale_local_state_and_event_counts_never_confirm_check_in",
        ),
        (
            "runtime daily check-in legacy migration",
            ("daily_check_in_runtime", "legacy_queue_migration"),
            "only_complete_consistent_valid_checked_in_sync_daily_progress_becomes_counter_free_check_in_command_all_other_legacy_daily_snapshots_are_discarded",
        ),
        (
            "runtime daily check-in legacy routes",
            ("daily_check_in_runtime", "legacy_snapshot_routes"),
            "post_v1_progress_daily_sync_and_post_v1_learning_state_sync_always_disabled",
        ),
        (
            "runtime daily check-in deployment",
            ("daily_check_in_runtime", "deployment_status"),
            "not_deployed_by_repository_change",
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
        "retained_v1_daily_and_learning_snapshots_are_read_only_migration_input",
        "v1_daily_and_learning_snapshot_write_routes_are_globally_disabled",
        "explicit_daily_check_in_v2_is_repository_local_not_deployed",
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
        "retained_v1_snapshots_are_read_only_migration_input",
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
        "v1_daily_and_learning_snapshot_write_routes_always_return_410",
        "v2_check_in_is_monotonic_and_cannot_override_learning_or_space_counts",
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

    hr42 = _entry_by_id(evals.get("regressions", []), "HR-42")
    expected_hr42 = [
        "account_sync_contract_is_daily_check_in_owner",
        "active_v2_session_is_only_account_identity",
        "strict_day_key_only_daily_check_in_command",
        "phone_number_snapshots_and_all_counters_are_forbidden",
        "explicit_check_in_is_monotonic_and_idempotent",
        "independent_account_day_record_never_mutates_legacy_baseline",
        "cloudbase_system_id_is_not_a_business_field_and_other_unknown_fields_fail_closed",
        "learning_counts_remain_learning_event_derived",
        "favorite_and_sleeping_counts_remain_space_derived",
        "concurrent_first_event_cannot_lose_check_in",
        "mobile_learning_completion_never_uploads_daily_snapshot",
        "credential_free_offline_check_in_command",
        "restart_preserves_only_exact_pending_account_day_check_in",
        "event_derived_counts_never_confirm_check_in",
        "valid_legacy_checked_in_queue_entry_migrates_without_counters",
        "corrupt_or_inconsistent_legacy_checked_in_snapshots_are_discarded",
        "other_legacy_daily_snapshot_entries_are_discarded",
        "v1_daily_and_learning_snapshot_routes_are_globally_disabled",
        "retained_legacy_documents_are_read_only_migration_input",
        "repository_local_green_is_not_deployment_or_launch_readiness",
    ]
    if not hr42:
        findings.append("learning-events contract evals: missing HR-42")
    elif hr42.get("must_hit") != expected_hr42:
        findings.append("learning-events contract evals: HR-42 must_hit drift")

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

    gt33 = _entry_by_id(evals.get("golden_tasks", []), "GT-33")
    expected_gt33 = [
        "account_sync_contract_owner",
        "post_v2_progress_check_in_with_active_session_identity",
        "strict_daily_check_in_command_day_key_only",
        "strict_matching_daily_check_in_v2_response",
        "no_phone_number_snapshot_or_counter_fields",
        "monotonic_idempotent_account_day_state",
        "softbook_daily_check_ins_is_independent_from_event_derived_progress",
        "cloudbase_adapter_strips_only_system_id_before_exact_schema_validation",
        "memory_and_cloudbase_transactional_implementations",
        "concurrent_first_learning_event_preserves_check_in",
        "pre_event_legacy_baseline_counters_are_preserved_read_only",
        "mobile_explicit_check_in_is_the_only_trigger",
        "mobile_learning_progress_uses_learning_events_not_daily_snapshots",
        "mobile_uses_one_fixed_utc_plus_8_china_product_day",
        "credential_free_check_in_daily_progress_queue_entry",
        "restart_recovers_exact_pending_account_day_check_in_as_queued",
        "canonical_false_without_matching_queue_clears_stale_local_check_in",
        "event_derived_progress_never_marks_check_in_synced",
        "legacy_checked_in_queue_migrates_to_day_key_only",
        "legacy_checked_in_snapshot_requires_complete_consistent_counters_before_migration",
        "legacy_non_check_in_daily_snapshots_are_discarded",
        "stale_session_cancellation_cannot_acknowledge_or_remove_command",
        "post_ack_canonical_bootstrap_reconciliation",
        "v1_progress_daily_sync_always_returns_410",
        "v1_learning_state_sync_always_returns_410",
        "development_v1_card_and_membership_bridge_is_unchanged",
        "repository_local_cutover_is_not_deployment_content_approval_or_launch_readiness",
    ]
    if not gt33:
        findings.append("learning-events contract evals: missing GT-33")
    elif gt33.get("must_include") != expected_gt33:
        findings.append("learning-events contract evals: GT-33 must_include drift")

    required_runtime_snippets = [
        "repository-local CommonJS CloudBase function now implements",
        "This repository change deploys neither backend nor mobile release artifacts;",
        "softbook_learning_events",
        "softbook_learning_migration_revisions",
        "softbook_learning_sessions",
        "softbook_daily_check_ins",
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
        "On restart, only an exact queued check-in command",
        "event-derived completion counts never mark check-in synchronized.",
        "check-in and space-state",
        "active mobile completion no longer calls",
        "Late replay, authorization, or bootstrap responses",
        "including same-phone reauthentication.",
        "Every remote authentication call has a 15-second deadline",
        "Explicit caller cancellation or session replacement leaves the queued event and retry",
        "They are read-only migration",
        "`410 legacy_snapshot_write_disabled` in development",
        "Explicit daily check-in uses authenticated `POST /v2/progress/check-in`",
        'the exact body `{"day_key":"YYYY-MM-DD"}`',
        "a concurrent first",
        "former HTTP write routes are",
        "globally disabled",
        "CloudBase may materialize its adapter-owned `_id` on read.",
        "`daily_check_in_projection_invalid`",
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

    if "'softbook_daily_check_ins'," not in provision_text:
        findings.append(
            "learning-events contract daily check-in storage: "
            "provisioning is missing softbook_daily_check_ins"
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
                "production_membership_expiry_and_payment_entitlement",
                "formal_content_publication",
            ],
        ),
        (
            "scheduler launch non-claim",
            ("server_scheduler_v1", "launch_claim_rule"),
            "a green repository-local scheduler, mobile binding, memory smoke, or simulated evidence does not prove deployed integration, production entitlement, formal content approval, or launch readiness",
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


def space_actions_contract_findings(
    auth,
    runtime,
    agent,
    evals,
    runtime_text,
    agent_entry_text,
    provision_text,
):
    findings = []
    runtime_path = "infra/cloudbase/space-actions-v2-runtime-contract.md"

    owner_expectations = [
        (
            "classification",
            ("physical_space_actions_v2", "classification"),
            "implementation_hypothesis",
        ),
        (
            "status",
            ("physical_space_actions_v2", "contract_status"),
            "cloudbase_backend_and_mobile_client_implemented_locally_not_deployed",
        ),
        (
            "runtime path",
            ("physical_space_actions_v2", "runtime_contract"),
            runtime_path,
        ),
        (
            "method",
            ("physical_space_actions_v2", "endpoint", "method"),
            "POST",
        ),
        (
            "path",
            ("physical_space_actions_v2", "endpoint", "path"),
            "/v2/space/actions",
        ),
        (
            "authentication",
            ("physical_space_actions_v2", "endpoint", "authentication"),
            "active_v2_session",
        ),
        (
            "identity",
            ("physical_space_actions_v2", "endpoint", "identity_rule"),
            "derive the account only from the active v2 session; reject phone_number, day_key, snapshot counters, complete space snapshots, and every unknown request field",
        ),
        (
            "request schema",
            ("physical_space_actions_v2", "endpoint", "request_schema"),
            "space-actions.v2",
        ),
        (
            "response schema",
            ("physical_space_actions_v2", "endpoint", "response_schema"),
            "space-actions-ack.v2",
        ),
        (
            "required request fields",
            (
                "physical_space_actions_v2",
                "command_contract",
                "required_fields",
            ),
            ["schema_version", "track", "content_version", "actions"],
        ),
        (
            "batch",
            ("physical_space_actions_v2", "command_contract", "batch_rule"),
            "require one to twenty immutable actions; each contains exactly action_id, card_id, dimension, value, and client_occurred_at",
        ),
        (
            "action identity",
            ("physical_space_actions_v2", "command_contract", "action_id_rule"),
            "require a 1-128 character opaque identifier; the same account and action_id with an identical canonical payload returns duplicate while any payload mismatch rejects the complete batch with 409",
        ),
        (
            "dimension semantics",
            ("physical_space_actions_v2", "command_contract", "dimension_rule"),
            "dimension is exactly favorite or sleep and value is boolean; favorite is a tag while sleep excludes the card from learning without deleting scheduler state",
        ),
        (
            "content authority",
            ("physical_space_actions_v2", "command_contract", "content_rule"),
            "track, content_version, and every card_id must match the current normalized server card source; production additionally requires its published content-release.v1 descriptor",
        ),
        (
            "client time",
            ("physical_space_actions_v2", "command_contract", "time_rule"),
            "client_occurred_at is retained for long-offline ordering but rejected when it is more than five minutes ahead of server time",
        ),
        (
            "dimension merge",
            ("physical_space_actions_v2", "command_contract", "merge_rule"),
            "favorite and sleep use independent last-writer-wins clocks with action_id as the deterministic equal-time tie breaker, so an action in one dimension cannot overwrite the other",
        ),
        (
            "transaction",
            (
                "physical_space_actions_v2",
                "command_contract",
                "transaction_rule",
            ),
            "legacy migration, ledger conflict detection, dimension merge, immutable action records, and canonical account state commit atomically; a rejected batch commits nothing",
        ),
        (
            "response",
            ("physical_space_actions_v2", "command_contract", "response_rule"),
            "return one ordered result for every submitted action plus the requested track's canonical projection and matching content_version",
        ),
        (
            "state collection",
            (
                "physical_space_actions_v2",
                "storage_contract",
                "state_collection",
            ),
            "softbook_space_states",
        ),
        (
            "action collection",
            (
                "physical_space_actions_v2",
                "storage_contract",
                "action_collection",
            ),
            "softbook_space_actions",
        ),
        (
            "state identity",
            ("physical_space_actions_v2", "storage_contract", "state_identity"),
            "hash_of_account_key",
        ),
        (
            "action identity storage",
            ("physical_space_actions_v2", "storage_contract", "action_identity"),
            "hash_of_account_key_and_action_id",
        ),
        (
            "state integrity",
            ("physical_space_actions_v2", "storage_contract", "state_integrity"),
            "stored space-state.v2 business fields and each dimension clock/action pair are validated exactly on every canonical read and write; CloudBase system _id is the only removable adapter field",
        ),
        (
            "action integrity",
            ("physical_space_actions_v2", "storage_contract", "action_integrity"),
            "stored ledger payload, canonical digest, result, acknowledgement, and account ownership are validated exactly before duplicate acknowledgement",
        ),
        (
            "legacy migration",
            ("physical_space_actions_v2", "storage_contract", "legacy_migration"),
            "old phone and phone-day space documents are read-only input; the first account-scoped v2 read or write migrates each legacy card into both dimension clocks using last_modified_at and deterministic synthetic action ids without deleting the source documents",
        ),
        (
            "mobile durability",
            ("physical_space_actions_v2", "mobile_contract", "durability_rule"),
            "persist an account-scoped credential-free apply_space_action command before optimistic UI authority advances",
        ),
        (
            "mobile request",
            ("physical_space_actions_v2", "mobile_contract", "request_rule"),
            "replay preserves every immutable action field and action_id, injects the current access token in memory, and for the same track binds the request envelope to the currently validated content version; it never rebinds an action across tracks",
        ),
        (
            "mobile acknowledgement",
            ("physical_space_actions_v2", "mobile_contract", "ack_rule"),
            "remove queued actions as acknowledged only after a strict matching space-actions-ack.v2 result of applied, stale, or duplicate and a canonical projection matching track/content",
        ),
        (
            "mobile terminal rejection",
            (
                "physical_space_actions_v2",
                "mobile_contract",
                "terminal_rejection_rule",
            ),
            "only strict HTTP 409 error codes space_card_not_in_content and space_action_id_conflict are terminal for an immutable queued action; durably quarantine the credential-free command and exact code before removing it from the active FIFO, surface the rejection to the app, continue later mutations, and refresh canonical bootstrap before presenting reconciled space state",
        ),
        (
            "mobile retryable failure",
            (
                "physical_space_actions_v2",
                "mobile_contract",
                "retryable_failure_rule",
            ),
            "space_content_version_mismatch, unknown HTTP failures, transport failures, malformed responses, and every non-terminal rejection remain active and block later ordered space actions until retry or explicit reconciliation; authorization and session cancellation retain their separate session lifecycle handling",
        ),
        (
            "mobile terminal quarantine",
            ("physical_space_actions_v2", "mobile_contract", "quarantine_rule"),
            "terminal quarantine is account-local, credential-free, bounded, excluded from optimistic overlays and formal acknowledgement counts, cleared on logout with the active queue, and retained only as local diagnostic evidence rather than server approval",
        ),
        (
            "mobile legacy queue",
            ("physical_space_actions_v2", "mobile_contract", "legacy_queue_rule"),
            "during hydration migrate each valid legacy sync_space_state card snapshot into deterministic favorite and sleep actions, discard phone_number, day_key, counters, tokens, and malformed snapshots, and never replay the original whole snapshot",
        ),
        (
            "mobile recovery",
            ("physical_space_actions_v2", "mobile_contract", "recovery_rule"),
            "canonical bootstrap is the base; overlay only active same-account, same-track durable pending actions in queue order, including actions awaiting same-track content-version rebinding; quarantined actions are excluded, so rejected or unqueued device state can never overwrite server authority",
        ),
        (
            "mobile reconciliation",
            (
                "physical_space_actions_v2",
                "mobile_contract",
                "reconciliation_rule",
            ),
            "after remote acknowledgement refresh canonical bootstrap before treating space state and scheduler eligibility as reconciled",
        ),
        (
            "disabled legacy routes",
            ("physical_space_actions_v2", "legacy_cutover", "disabled_routes"),
            ["GET /v1/space/state-sync", "POST /v1/space/state-sync"],
        ),
        (
            "development legacy response",
            (
                "physical_space_actions_v2",
                "legacy_cutover",
                "development_response",
            ),
            "410 legacy_space_snapshot_disabled",
        ),
        (
            "production legacy response",
            (
                "physical_space_actions_v2",
                "legacy_cutover",
                "production_response",
            ),
            "410 legacy_api_disabled",
        ),
        (
            "legacy scope",
            ("physical_space_actions_v2", "legacy_cutover", "scope_rule"),
            "no runtime option, legacy token, active v2 session, or unmigrated account can re-enable physical-space snapshot reads or writes",
        ),
    ]
    for label, keys, expected in owner_expectations:
        _expect_contract_path(
            findings,
            "space-actions",
            label,
            auth,
            keys,
            expected,
        )

    runtime_expectations = [
        ("classification", ("classification",), "implementation_hypothesis"),
        (
            "owner",
            ("owner",),
            "spec/account-sync-contract.json#physical_space_actions_v2",
        ),
        ("runtime path", ("runtime_contract",), runtime_path),
        ("endpoint", ("endpoint",), "POST /v2/space/actions"),
        ("request schema", ("request_schema",), "space-actions.v2"),
        ("response schema", ("response_schema",), "space-actions-ack.v2"),
        (
            "implementation status",
            ("implementation_status",),
            "cloudbase_backend_and_mobile_client_implemented_locally_not_deployed",
        ),
        ("account identity", ("account_identity",), "active_v2_session_only"),
        (
            "request body",
            ("request_body",),
            "strict_track_content_version_and_one_to_twenty_immutable_favorite_or_sleep_actions_without_phone_snapshot_day_or_counters",
        ),
        (
            "storage collections",
            ("storage_collections",),
            ["softbook_space_states", "softbook_space_actions"],
        ),
        (
            "merge authority",
            ("merge_authority",),
            "independent_favorite_and_sleep_clocks_ordered_by_client_occurred_at_then_action_id",
        ),
        (
            "content authority",
            ("content_authority",),
            "current_normalized_track_source_and_content_version_with_published_release_required_in_production",
        ),
        (
            "transaction boundary",
            ("transaction_boundary",),
            "legacy_migration_ledger_conflict_detection_dimension_merge_action_insert_and_account_state_commit",
        ),
        (
            "mobile queue",
            ("mobile_queue",),
            "credential_free_apply_space_action_persisted_before_optimistic_ui_change",
        ),
        (
            "mobile terminal rejection",
            ("mobile_terminal_rejection",),
            "strict_space_card_not_in_content_or_space_action_id_conflict_409_is_durably_quarantined_before_active_fifo_removal_then_later_mutations_continue_and_bootstrap_reconciles",
        ),
        (
            "mobile retryable failure",
            ("mobile_retryable_failure",),
            "content_version_mismatch_unknown_http_transport_and_malformed_responses_remain_active_authorization_and_cancellation_keep_session_lifecycle_semantics",
        ),
        (
            "mobile recovery",
            ("mobile_recovery",),
            "canonical_bootstrap_base_plus_same_account_and_track_durable_pending_actions_with_only_same_track_request_envelopes_rebound_to_current_content",
        ),
        (
            "legacy queue migration",
            ("legacy_queue_migration",),
            "valid_sync_space_state_cards_become_deterministic_favorite_and_sleep_actions_original_snapshots_are_never_replayed",
        ),
        (
            "legacy routes",
            ("legacy_snapshot_routes",),
            "get_and_post_v1_space_state_sync_always_disabled",
        ),
        (
            "scheduler boundary",
            ("scheduler_boundary",),
            "sleep_actions_change_eligibility_only_after_canonical_acknowledgement_and_bootstrap_session_reconciliation",
        ),
        (
            "deployment",
            ("deployment_status",),
            "not_deployed_by_repository_change",
        ),
        ("launch gate", ("launch_gate_status",), "pending"),
    ]
    runtime_value = runtime.get("physical_space_action_runtime", {})
    for label, keys, expected in runtime_expectations:
        _expect_contract_path(
            findings,
            "space-actions runtime",
            label,
            runtime_value,
            keys,
            expected,
        )

    expected_read_path = [
        "spec/requirement-memory.json",
        "spec/authority-map.json",
        "spec/product-core.json",
        "spec/account-sync-contract.json",
        "spec/knowledge-map.json",
        "spec/space-operations.json",
        "spec/box-catalog.json",
        "spec/runtime-boundaries.json",
        runtime_path,
        "spec/harness-architecture.json",
        "spec/agent-harness.json",
        "spec/repo-delivery-contract.json",
        "spec/agent-run-record.json",
        "spec/evals.json",
    ]
    found, actual_read_path = _read_path(
        agent,
        ("read_paths", "physical_space_actions_runtime"),
    )
    if not found:
        findings.append(
            "space-actions contract agent read path: missing "
            "read_paths.physical_space_actions_runtime"
        )
    elif actual_read_path != expected_read_path:
        findings.append(
            "space-actions contract agent read path: "
            "physical_space_actions_runtime drift"
        )

    expected_gt34 = [
        "account_sync_contract_owner",
        "post_v2_space_actions_with_active_session_identity",
        "strict_space_actions_v2_and_space_actions_ack_v2_schemas",
        "request_rejects_phone_day_counters_credentials_snapshots_and_unknown_fields",
        "one_to_twenty_immutable_actions_with_exact_action_fields",
        "exact_duplicate_returns_duplicate_and_action_id_payload_conflict_is_atomic_409",
        "favorite_and_sleep_are_independent_dimensions",
        "client_time_then_action_id_is_the_deterministic_dimension_order",
        "current_track_content_version_and_card_ids_are_server_validated",
        "production_requires_matching_published_content_release",
        "softbook_space_actions_is_an_immutable_account_scoped_ledger",
        "softbook_space_states_is_account_scoped_canonical_state",
        "stored_business_schema_and_digest_integrity_fail_closed",
        "cloudbase_adapter_strips_only_system_id",
        "memory_and_cloudbase_commits_are_transactional",
        "maximum_twenty_action_cloudbase_commit_uses_at_most_42_operations",
        "legacy_phone_and_phone_day_documents_are_read_only_migration_inputs",
        "legacy_dimension_clocks_use_last_modified_at_and_deterministic_action_ids",
        "get_and_post_v1_space_state_sync_always_return_410",
        "mobile_persists_credential_free_apply_space_action_before_optimistic_ui",
        "legacy_sync_space_state_entries_migrate_to_deterministic_actions_without_replaying_snapshots",
        "canonical_bootstrap_is_base_and_only_matching_durable_pending_actions_overlay",
        "same_track_content_update_rebinds_only_the_request_envelope",
        "cross_track_action_rebinding_is_forbidden",
        "strict_ordered_applied_stale_or_duplicate_ack_before_queue_removal",
        "terminal_card_or_action_id_409_is_durably_quarantined_before_fifo_removal",
        "terminal_quarantine_is_excluded_from_overlay_and_later_mutations_continue",
        "unknown_and_content_version_failures_remain_active",
        "post_ack_bootstrap_and_scheduler_reconciliation",
        "transient_failure_keeps_exact_action_and_exposes_retryable_diagnosis",
        "unqueued_local_space_state_never_overwrites_server_authority",
        "local_mock_smoke_proves_applied_duplicate_bootstrap_and_legacy_410",
        "repository_local_cutover_is_not_deployment_content_approval_or_launch_readiness",
    ]
    gt34 = _entry_by_id(evals.get("golden_tasks", []), "GT-34")
    if not gt34:
        findings.append("space-actions contract evals: missing GT-34")
    elif gt34.get("must_include") != expected_gt34:
        findings.append("space-actions contract evals: GT-34 must_include drift")

    required_runtime_snippets = [
        "It does not grant content approval, deployment",
        "`POST /v2/space/actions` requires an active v2 session.",
        "`actions`: one to twenty exact action objects",
        "The action ledger is keyed by account plus action ID.",
        "Favorite and sleep use separate clocks.",
        "`client_occurred_at`, then by `action_id` for equal timestamps.",
        "commits legacy migration, ledger checks, both dimension merges,",
        "commits nothing.",
        "`space-actions-ack.v2` response preserves input order",
        "Scheduler sleep authority reads the same",
        "credential-free `apply_space_action` entry before optimistic",
        "The immutable action fields and action ID never change.",
        "it never rebinds an action across tracks.",
        "removed as acknowledged only after strict matching",
        "Two exact HTTP 409 codes are terminal for an immutable queued action:",
        "durably moves",
        "into a bounded local quarantine before removing",
        "Quarantined actions are diagnostic evidence, not acknowledgement or approval,",
        "`space_content_version_mismatch`, unknown HTTP failures, transport failures,",
        "Hydration starts from canonical bootstrap and overlays only matching durable",
        "Quarantined actions are excluded.",
        "Both `GET /v1/space/state-sync` and `POST /v1/space/state-sync` return 410",
        "Retained legacy documents remain read-only migration input.",
    ]
    for snippet in required_runtime_snippets:
        if snippet not in runtime_text:
            findings.append(
                f"space-actions runtime contract missing exact snippet: {snippet!r}"
            )

    if runtime_path not in agent_entry_text:
        findings.append(
            "space-actions contract Agent entry: missing exact runtime contract path"
        )
    for collection in ("softbook_space_states", "softbook_space_actions"):
        if f"'{collection}'" not in provision_text:
            findings.append(
                f"space-actions provisioning: missing {collection}"
            )

    return findings


def launch_evidence_contract_findings(
    root,
    policy,
    auth,
    runtime,
    agent,
    evals,
    release_runtime_text,
    package_text,
):
    findings = []

    expected_policy = {
        "schema_version": "release-operational-policy.v1",
        "policy_id": "softbook-release-operations.v1",
        "classification": "implementation_hypothesis",
        "status": "active",
        "target_release": "2027-Q2",
        "quality_policy": "move_release_date_before_reducing_gate",
        "evidence_validity_days": 180,
        "environment": {
            "allowed_classes": [
                "production_like_staging",
                "production",
            ],
            "receiver_owned_required": True,
            "personal_development_environment_forbidden": True,
            "required_execution_modes": {
                "load-test-report": "receiver_deployed",
                "availability-observation": "receiver_deployed",
                "backup-restore-drill": "receiver_external_apply",
                "penetration-test-report": "receiver_deployed",
                "rollback-drill": "receiver_external_apply",
            },
        },
        "common_binding": {
            "repository": "LENKIN233/softbook_cet",
            "require_one_campaign": True,
            "require_same_commit": True,
            "require_same_profile": True,
            "require_same_environment": True,
            "require_same_bundle": True,
            "require_same_release": True,
            "require_parent_release": True,
            "require_reachable_commit": True,
            "require_launch_release_candidate_cohort": True,
            "require_raw_artifact_hashes": True,
            "require_repository_raw_artifact_verification": True,
            "require_repository_raw_artifacts_only": True,
            "require_independent_verification": True,
            "require_distinct_operator_and_verifier": True,
            "require_execution_window_binding": True,
        },
        "external_capability": {
            "schema_version": "external-capability-evidence.v1",
            "product_owner": "github:LENKIN233",
            "protected_approval_environment": "formal-product-owner-approval",
            "target_release_binding_required": True,
            "repository_report_and_raw_artifacts_must_be_rehashed": True,
            "capability_evidence_cannot_replace_launch_gate": True,
            "allowed_observation_modes": [
                "provider_control_plane",
                "official_registry",
                "public_endpoint",
            ],
            "common_required_checks": [
                "provider-subject-bound",
                "owner-control-confirmed",
                "current-state-observed",
            ],
            "required_checks": {
                "apple-developer": {
                    "app-store-connect": [
                        "team-access-confirmed",
                        "app-record-active",
                        "release-role-confirmed",
                    ],
                    "storekit-subscriptions": [
                        "monthly-product-active",
                        "yearly-product-active",
                        "subscription-group-active",
                    ],
                    "app-store-server-notifications": [
                        "v2-endpoint-registered",
                        "production-url-configured",
                        "provider-configuration-active",
                    ],
                    "distribution-signing": [
                        "distribution-certificate-active",
                        "provisioning-profile-active",
                        "signing-assets-custody-confirmed",
                    ],
                },
                "android-distribution": {
                    "huawei": [
                        "publisher-account-active",
                        "app-record-active",
                        "release-channel-available",
                    ],
                    "xiaomi": [
                        "publisher-account-active",
                        "app-record-active",
                        "release-channel-available",
                    ],
                    "oppo": [
                        "publisher-account-active",
                        "app-record-active",
                        "release-channel-available",
                    ],
                    "vivo": [
                        "publisher-account-active",
                        "app-record-active",
                        "release-channel-available",
                    ],
                    "tencent-myapp": [
                        "publisher-account-active",
                        "app-record-active",
                        "release-channel-available",
                    ],
                    "release-signing": [
                        "keystore-custody-confirmed",
                        "certificate-fingerprint-recorded",
                        "backup-custody-confirmed",
                    ],
                },
                "tencent-cloud-production": {
                    "cloudbase-run": [
                        "receiver-owned-environment-confirmed",
                        "service-identity-configured",
                        "deployment-permission-confirmed",
                    ],
                    "tencentdb-postgresql": [
                        "instance-access-confirmed",
                        "backup-policy-active",
                        "network-policy-configured",
                    ],
                    "cos-private-bucket": [
                        "private-bucket-confirmed",
                        "access-policy-configured",
                        "signed-url-capability-enabled",
                    ],
                    "sms": [
                        "sender-approved",
                        "template-approved",
                        "quota-and-region-configured",
                    ],
                    "cls": [
                        "logset-access-confirmed",
                        "retention-policy-active",
                        "alert-destination-configured",
                    ],
                    "rum": [
                        "application-registered",
                        "data-source-configured",
                        "alerting-path-configured",
                    ],
                },
                "payments": {
                    "wechat-pay": [
                        "merchant-account-active",
                        "product-configuration-confirmed",
                        "api-credential-configured",
                        "webhook-endpoint-registered",
                    ],
                    "alipay": [
                        "merchant-account-active",
                        "product-configuration-confirmed",
                        "api-credential-configured",
                        "webhook-endpoint-registered",
                    ],
                    "webhook-domain": [
                        "dns-control-confirmed",
                        "tls-certificate-configured",
                        "public-endpoint-registered",
                    ],
                },
                "china-compliance": {
                    "domain-registration": [
                        "registrant-current",
                        "dns-control-confirmed",
                    ],
                    "icp-filing": [
                        "filing-approved",
                        "domain-binding-confirmed",
                    ],
                    "app-filing": [
                        "filing-approved",
                        "app-identity-binding-confirmed",
                    ],
                    "privacy-policy-public-url": [
                        "public-reachability-confirmed",
                        "published-content-current",
                    ],
                    "customer-support-contact": [
                        "contact-channel-reachable",
                        "response-owner-confirmed",
                    ],
                },
            },
        },
        "load_test": {
            "required_scenarios": [
                "auth-bootstrap",
                "learning-session",
                "learning-event",
                "content-manifest",
                "space-action",
            ],
            "minimum_concurrent_users": 200,
            "minimum_duration_seconds": 1800,
            "minimum_request_count": 10000,
            "maximum_error_ratio": 0.01,
            "maximum_p95_latency_ms": 1200,
            "maximum_p99_latency_ms": 2500,
            "maximum_data_integrity_errors": 0,
            "measurement_duration_within_execution_window_required": True,
        },
        "availability": {
            "required_routes": [
                "/v2/bootstrap",
                "/v2/learning/session",
                "/v2/content/manifest",
            ],
            "minimum_window_seconds": 86400,
            "maximum_probe_interval_seconds": 60,
            "minimum_availability_ratio": 0.999,
            "maximum_p95_latency_ms": 1200,
            "maximum_single_outage_seconds": 300,
            "missing_probe_counts_as_failure": True,
            "per_route_probe_coverage_required": True,
        },
        "backup_restore": {
            "required_datasets": [
                "account-session-membership",
                "learning-events-and-projections",
                "daily-progress",
                "space-actions-and-state",
                "content-releases",
            ],
            "maximum_rpo_seconds": 900,
            "maximum_rto_seconds": 3600,
            "isolated_restore_target_required": True,
            "source_and_restore_counts_must_match": True,
            "source_and_restore_hashes_must_match": True,
            "production_must_remain_unchanged": True,
            "rpo_recomputed_from_snapshot_and_recovery_reference": True,
            "all_required_source_datasets_must_be_nonempty": True,
        },
        "penetration_test": {
            "required_scope": [
                "authentication-and-session",
                "learning-and-space-api",
                "private-content-storage",
                "ios-release",
                "android-release",
                "pc-web-release",
                "payments-and-webhooks",
            ],
            "maximum_open_critical": 0,
            "maximum_open_high": 0,
            "critical_and_high_waivers_forbidden": True,
            "retest_required_for_resolved_critical_and_high": True,
        },
        "rollback": {
            "required_sequence": [
                "publish-release-a",
                "verify-release-a",
                "publish-release-b",
                "verify-release-b",
                "rollback-release-a",
                "reverify-release-a",
            ],
            "maximum_rto_seconds": 900,
            "active_pointer_must_match_target": True,
            "api_and_content_must_match_target": True,
            "learning_data_count_and_hash_must_match": True,
            "maximum_delete_operations": 0,
            "nonempty_learning_dataset_required": True,
            "retained_and_verified_target_required": True,
        },
        "simulation_boundary": {
            "schema_version": "release-blank-environment-simulation.v1",
            "execution_mode": "repository_in_memory",
            "simulation": True,
            "gate_eligible": False,
            "may_satisfy_formal_gate": False,
        },
    }
    if set(policy) != set(expected_policy):
        findings.append(
            "launch-evidence contract release operational policy top-level keys drift"
        )
    for key, expected in expected_policy.items():
        _expect_contract_path(
            findings,
            "launch-evidence",
            f"release operational policy {key}",
            policy,
            (key,),
            expected,
        )

    expected_learning_contract = {
        "schema_version": "learning-runtime-evidence.v1",
        "policy_binding": "exact_learning_events_v2_runtime_contract_sha256",
        "required_types": [
            "cross-device-bootstrap-test",
            "offline-replay-test",
            "canonical-state-test",
        ],
        "receiver_owned_deployment_required": True,
        "local_or_simulated_evidence_gate_eligible": False,
        "outer_metadata_must_match_report": True,
        "outer_subject_commit_must_match_and_be_reachable": True,
        "launch_release_candidate_cohort_required": True,
        "repository_raw_artifacts_must_be_rehashed": True,
        "independent_operator_and_verifier_required": True,
        "execution_window_binding_required": True,
    }
    _expect_contract_path(
        findings,
        "launch-evidence",
        "learning-events formal evidence",
        auth,
        (
            "learning_events_v2",
            "migration_boundary",
            "launch_evidence_contract",
        ),
        expected_learning_contract,
    )

    expected_scheduler_contract = {
        "schema_version": "learning-runtime-evidence.v1",
        "policy_binding": "exact_learning_session_v1_runtime_contract_sha256",
        "required_types": [
            "fsrs-version-lock",
            "scheduler-contract-test",
            "clock-boundary-test",
        ],
        "receiver_owned_deployment_required": True,
        "local_or_simulated_evidence_gate_eligible": False,
        "outer_metadata_must_match_report": True,
        "outer_subject_commit_must_match_and_be_reachable": True,
        "launch_release_candidate_cohort_required": True,
        "repository_raw_artifacts_must_be_rehashed": True,
        "independent_operator_and_verifier_required": True,
        "execution_window_binding_required": True,
        "exact_scheduler_lockfile_sha256_required": True,
    }
    _expect_contract_path(
        findings,
        "launch-evidence",
        "scheduler formal evidence",
        auth,
        ("server_scheduler_v1", "launch_evidence_contract"),
        expected_scheduler_contract,
    )

    expected_external_account_contract = {
        "classification": "implementation_hypothesis",
        "schema_version": "external-capability-evidence.v1",
        "policy_owner": "spec/release-operational-policy.json#external_capability",
        "scope": "provider_and_regulatory_control_plane_capability_only",
        "subject_binding": "exact_repository_reachable_commit_target_release_policy_hash_account_id_and_capability_id",
        "required_checks": "policy_common_checks_plus_exact_capability_specific_checks",
        "repository_evidence_rule": "outer_report_and_every_referenced_raw_artifact_are_tracked_regular_root_contained_size_checked_and_sha256_rehashed",
        "truth_authority": "protected_formal_product_owner_approval_for_the_exact_pull_request_head",
        "metadata_rule": "verified_by_observation_and_portal_artifacts_are_reviewable_metadata_not_provider_authentication_by_themselves",
        "gate_nonreplacement_rule": "capability_evidence_is_gate_eligible_false_and_cannot_replace_runtime_payment_distribution_compliance_or_security_launch_gates",
        "current_status": "all_capabilities_unverified",
    }
    _expect_contract_path(
        findings,
        "launch-evidence",
        "external account formal evidence",
        auth,
        ("external_account_readiness",),
        expected_external_account_contract,
    )

    runtime_expectations = [
        (
            "learning evidence schema",
            ("learning_event_runtime", "launch_evidence_schema"),
            "learning-runtime-evidence.v1",
        ),
        (
            "learning evidence policy binding",
            ("learning_event_runtime", "launch_evidence_policy_binding"),
            "exact_learning_events_runtime_contract_sha256",
        ),
        (
            "learning repository simulation eligibility",
            ("learning_event_runtime", "repository_simulation_gate_eligible"),
            False,
        ),
        (
            "learning deployment non-claim",
            ("learning_event_runtime", "deployment_status"),
            "not_deployed_by_repository_change",
        ),
        (
            "learning launch pending",
            ("learning_event_runtime", "launch_gate_status"),
            "pending",
        ),
        (
            "scheduler evidence schema",
            ("scheduler_runtime", "launch_evidence_schema"),
            "learning-runtime-evidence.v1",
        ),
        (
            "scheduler evidence policy binding",
            ("scheduler_runtime", "launch_evidence_policy_binding"),
            "exact_learning_session_runtime_contract_sha256",
        ),
        (
            "scheduler repository simulation eligibility",
            ("scheduler_runtime", "repository_simulation_gate_eligible"),
            False,
        ),
        (
            "scheduler deployment non-claim",
            ("scheduler_runtime", "deployment_status"),
            "not_deployed_by_repository_change",
        ),
        (
            "scheduler launch pending",
            ("scheduler_runtime", "launch_gate_status"),
            "pending",
        ),
        (
            "release operational evidence policy",
            ("release_delivery_runtime", "operational_evidence_policy"),
            "spec/release-operational-policy.json",
        ),
        (
            "release operational evidence schema",
            ("release_delivery_runtime", "operational_evidence_schema"),
            "release-operational-evidence.v1",
        ),
        (
            "release retained target verification",
            ("release_delivery_runtime", "retained_release_verification"),
            "rollback_requires_verified_true_and_retention_status_retained_before_pointer_activation",
        ),
        (
            "release repository simulation status",
            (
                "release_delivery_runtime",
                "repository_blank_environment_simulation_status",
            ),
            "implemented_with_real_publisher_receiver_adapter_rollback_in_memory_runner_user_data_sentinel_and_zero_delete_assertion",
        ),
        (
            "release repository simulation eligibility",
            (
                "release_delivery_runtime",
                "repository_blank_environment_simulation_gate_eligible",
            ),
            False,
        ),
        (
            "release formal rollback evidence",
            ("release_delivery_runtime", "formal_rollback_evidence"),
            "distinct_release_a_and_b_verified_and_retained_state_nonempty_learning_count_and_hash_zero_deletes_and_timed_execution_are_required",
        ),
        (
            "release blank environment drill pending",
            ("release_delivery_runtime", "blank_environment_drill_status"),
            "pending",
        ),
        (
            "release deployment non-claim",
            ("release_delivery_runtime", "deployment_status"),
            "not_deployed_by_repository_change",
        ),
        (
            "release launch pending",
            ("release_delivery_runtime", "launch_gate_status"),
            "pending",
        ),
    ]
    for label, keys, expected in runtime_expectations:
        _expect_contract_path(
            findings,
            "launch-evidence",
            label,
            runtime,
            keys,
            expected,
        )

    expected_launch_runtime = {
        "classification": "implementation_hypothesis",
        "owner": "spec/release-operational-policy.json",
        "gate_record_owner": "docs/release/launch-readiness.v1.json",
        "semantic_schemas": [
            "launch-gate-evidence.v1",
            "learning-runtime-evidence.v1",
            "release-operational-evidence.v1",
            "external-capability-evidence.v1",
        ],
        "strict_json_boundary": "valid_utf8_without_bom_duplicate_keys_unknown_fields_nonfinite_numbers_or_trailing_content",
        "repository_evidence_boundary": "explicit_trusted_git_tracked_file_and_reachable_commit_sets_regular_file_size_and_sha256_for_outer_reports_and_nested_repository_raw_artifacts_then_type_specific_semantic_validation",
        "remote_raw_evidence_boundary": "formal_reports_reference_only_repo_raw_artifacts_remote_archives_require_an_evidence_archive_verified_repository_manifest",
        "common_binding": "exact_gate_and_evidence_type_repository_commit_target_release_policy_hash_receiver_owned_profile_and_environment_release_bundle_content_version_backend_deployment_ios_android_pc_web_builds_execution_window_raw_artifacts_checks_and_independent_verification",
        "release_candidate_cohort": "launch_readiness_owns_one_product_owner_recorded_launch_release_candidate_v1_commit_profile_environment_release_parent_bundle_content_backend_and_all_client_builds_cohort_every_formal_gate_report_must_match_exactly",
        "external_capability_boundary": "external_reports_bind_reachable_commit_target_release_policy_hash_account_capability_observation_required_checks_and_rehashed_repository_raw_artifacts",
        "external_capability_scope": "provider_and_regulatory_control_plane_only_never_runtime_payment_distribution_compliance_or_security_gate_substitution",
        "external_capability_truth_authority": "protected_formal_product_owner_approval_authenticates_the_exact_pull_request_head_report_identity_and_portal_bytes_remain_metadata",
        "commit_authority": "outer_subject_commit_matches_inner_report_and_must_be_reachable_from_validated_repository_head",
        "independent_verification_rule": "execution_operator_and_independent_verifier_must_be_distinct_identities",
        "execution_window_rule": "measured_runtime_windows_and_events_must_fit_inside_the_recorded_execution_window",
        "generic_gate_rule": "launch_gate_evidence_without_a_registered_type_specific_measurement_contract_is_gate_ineligible_fail_closed",
        "learning_evidence_types": [
            "cross-device-bootstrap-test",
            "offline-replay-test",
            "canonical-state-test",
            "fsrs-version-lock",
            "scheduler-contract-test",
            "clock-boundary-test",
        ],
        "learning_policy_binding": "canonical_gate_binds_exact_learning_events_runtime_contract_sha256_scheduler_gate_binds_exact_learning_session_runtime_contract_sha256",
        "scheduler_lockfile_binding": "fsrs_version_lock_binds_exact_repository_softbook_api_package_lock_sha256",
        "release_operational_policy": "spec/release-operational-policy.json",
        "release_campaign_coherence": "five_reports_share_campaign_commit_policy_profile_environment_release_parent_bundle_content_and_all_client_builds",
        "release_result_rule": "validator_recomputes_load_duration_and_counts_availability_per_route_probe_coverage_backup_rpo_and_rto_penetration_findings_and_rollback_retained_verified_nonempty_learning_state_from_policy_and_measurements_never_trusts_result_passed_alone",
        "availability_route_probe_rule": "each_required_route_has_exact_expected_success_failed_missing_ratio_latency_and_outage_measurements_each_meets_window_and_policy_and_aggregates_match",
        "backup_restore_nonempty_rule": "every_required_source_dataset_has_positive_count_before_exact_restored_count_and_hash_comparison",
        "formal_approval_boundary": "tracked_verified_by_and_attestation_fields_are_metadata_the_protected_formal_product_owner_environment_remains_the_merge_authority",
        "simulation_schema": "release-blank-environment-simulation.v1",
        "simulation_execution_mode": "repository_in_memory",
        "simulation_gate_eligible": False,
        "implementation_status": "strict_repository_evidence_loader_semantic_contracts_policy_thresholds_and_repository_blank_environment_simulation_implemented",
        "deployment_status": "formal_receiver_evidence_not_created_by_repository_change",
        "launch_gate_status": "pending",
    }
    _expect_contract_path(
        findings,
        "launch-evidence",
        "runtime mirror",
        runtime,
        ("launch_evidence_runtime",),
        expected_launch_runtime,
    )

    expected_read_path = [
        "spec/requirement-memory.json",
        "spec/authority-map.json",
        "spec/product-core.json",
        "spec/account-sync-contract.json",
        "spec/membership.json",
        "spec/runtime-boundaries.json",
        "spec/release-operational-policy.json",
        "infra/cloudbase/learning-events-v2-runtime-contract.md",
        "infra/cloudbase/learning-session-v1-runtime-contract.md",
        "infra/cloudbase/release-bundle-v1-runtime-contract.md",
        "spec/harness-architecture.json",
        "spec/agent-harness.json",
        "spec/repo-delivery-contract.json",
        "spec/agent-run-record.json",
        "spec/evals.json",
    ]
    _expect_contract_path(
        findings,
        "launch-evidence",
        "agent read path",
        agent,
        ("read_paths", "launch_evidence_or_release_readiness"),
        expected_read_path,
    )

    expected_hr43 = [
        "release_operational_policy_is_the_threshold_owner",
        "strict_json_rejects_bom_duplicate_keys_unknown_fields_and_trailing_content",
        "trusted_git_tracked_file_set_is_required",
        "outer_type_time_verifier_and_subject_commit_match_report",
        "subject_commit_is_reachable_from_validated_head",
        "one_product_owner_recorded_launch_release_candidate_cohort_is_required",
        "every_gate_report_matches_the_launch_release_candidate_cohort",
        "evidence_binds_commit_policy_profile_environment_release_bundle_content_backend_and_all_client_builds",
        "nested_repository_raw_artifacts_are_tracked_regular_rehashed_and_size_checked",
        "remote_raw_evidence_requires_evidence_archive_verified_repository_manifest",
        "execution_operator_and_independent_verifier_are_distinct",
        "measured_runtime_fits_recorded_execution_window",
        "learning_reports_bind_exact_runtime_contract_hashes",
        "fsrs_report_binds_exact_repository_lockfile_hash",
        "release_reports_share_one_campaign_and_release_binding",
        "release_reports_share_backend_deployment",
        "availability_has_exact_per_route_probe_counters_and_aggregate_binding",
        "backup_restore_requires_every_source_dataset_nonempty",
        "load_availability_backup_restore_penetration_and_rollback_results_are_recomputed",
        "receiver_owned_deployed_or_apply_execution_is_required",
        "unregistered_generic_gate_semantics_fail_closed",
        "repository_simulation_is_always_gate_ineligible",
        "rollback_requires_retained_and_verified_release",
        "formal_rollback_requires_distinct_releases_and_nonempty_learning_state",
        "rollback_preserves_nonempty_learning_sentinel_and_performs_zero_deletes",
        "formal_receiver_evidence_and_protected_product_owner_approval_remain_pending",
    ]
    hr43 = _entry_by_id(evals.get("regressions", []), "HR-43")
    if not hr43:
        findings.append("launch-evidence contract evals: missing HR-43")
    elif hr43.get("must_hit") != expected_hr43:
        findings.append("launch-evidence contract evals: HR-43 must_hit drift")

    expected_hr44 = [
        "release_operational_policy_owns_external_capability_checks",
        "arbitrary_json_cannot_satisfy_external_capability_evidence",
        "external_capability_evidence_v1_exact_schema",
        "outer_and_inner_commit_match_and_reachable",
        "target_release_policy_hash_account_and_capability_are_exactly_bound",
        "common_and_capability_specific_check_registry_is_complete",
        "provider_subject_observation_mode_and_freshness_are_validated",
        "report_and_referenced_repository_raw_artifacts_are_rehashed",
        "capability_eligible_true_and_gate_eligible_false_are_fixed",
        "capability_evidence_cannot_replace_runtime_payment_distribution_compliance_or_security_gates",
        "verified_by_and_portal_bytes_are_metadata_only",
        "protected_product_owner_environment_authenticates_exact_pr_head",
        "policy_semantic_parser_and_validator_paths_require_formal_approval",
        "tracked_external_accounts_remain_unverified_without_formal_evidence",
    ]
    hr44 = _entry_by_id(evals.get("regressions", []), "HR-44")
    if not hr44:
        findings.append("launch-evidence contract evals: missing HR-44")
    elif hr44.get("must_hit") != expected_hr44:
        findings.append("launch-evidence contract evals: HR-44 must_hit drift")

    expected_gt35 = [
        "release_operational_policy_owner_and_non_regressing_thresholds",
        "launch_gate_learning_runtime_and_release_operational_evidence_schemas",
        "strict_utf8_json_without_bom_duplicate_keys_unknown_fields_or_trailing_content",
        "explicit_trusted_git_tracked_file_snapshot",
        "outer_metadata_and_subject_commit_match_inner_report",
        "subject_commit_is_reachable_from_validated_repository_head",
        "launch_release_candidate_v1_is_the_single_formal_gate_subject_cohort",
        "all_formal_gate_reports_match_the_candidate_cohort",
        "exact_commit_policy_profile_environment_release_parent_bundle_content_backend_and_client_build_binding",
        "nested_repository_raw_artifacts_are_tracked_regular_size_and_sha256_verified",
        "remote_raw_evidence_uses_evidence_archive_verified_repository_manifest",
        "independent_verifier_differs_from_execution_operator",
        "measured_runtime_windows_fit_recorded_execution_window",
        "learning_events_and_scheduler_reports_bind_exact_runtime_contract_hashes",
        "fsrs_version_lock_binds_exact_repository_package_lock_hash",
        "generic_evidence_without_type_specific_semantics_fails_closed",
        "load_counts_ratios_latency_and_integrity_recomputed",
        "availability_each_route_counts_ratio_latency_outage_window_and_aggregate_recomputed",
        "backup_restore_uses_nonempty_source_datasets_isolated_target_matching_counts_hashes_and_recomputed_rpo_rto",
        "penetration_scope_has_zero_open_or_waived_critical_and_high",
        "rollback_sequence_retained_verified_pointer_api_content_nonempty_learning_hash_rto_and_zero_delete_recomputed",
        "five_release_reports_share_one_campaign_release_and_backend_deployment_binding",
        "real_publisher_receiver_adapter_and_rollback_used_by_memory_simulation",
        "nonempty_learning_sentinel_is_preserved",
        "rollback_target_requires_retained_and_verified",
        "simulation_schema_execution_mode_and_gate_eligible_false_are_fixed",
        "repository_simulation_does_not_change_launch_gate_from_pending",
        "formal_receiver_owned_execution_and_protected_product_owner_approval_remain_external",
    ]
    gt35 = _entry_by_id(evals.get("golden_tasks", []), "GT-35")
    if not gt35:
        findings.append("launch-evidence contract evals: missing GT-35")
    elif gt35.get("must_include") != expected_gt35:
        findings.append("launch-evidence contract evals: GT-35 must_include drift")

    expected_gt36 = [
        "external_capability_evidence_v1",
        "provider_and_regulatory_control_plane_scope_only",
        "reachable_commit_target_release_policy_account_and_capability_binding",
        "common_plus_exact_capability_required_checks",
        "provider_subject_hash_observation_mode_time_and_optional_expiry",
        "strict_json_exact_keys_and_non_placeholder_hashes",
        "tracked_regular_root_contained_report_and_raw_artifact_rehash",
        "all_external_account_capability_pairs_have_policy_coverage",
        "arbitrary_json_self_attestation_missing_or_extra_checks_fail_closed",
        "capability_eligible_true_gate_eligible_false",
        "runtime_payment_distribution_compliance_and_security_gates_are_not_replaced",
        "protected_formal_product_owner_approval_is_the_only_authentication_authority",
        "formal_scope_classifier_covers_policy_semantic_parser_and_validator",
        "repository_baseline_remains_unverified",
    ]
    gt36 = _entry_by_id(evals.get("golden_tasks", []), "GT-36")
    if not gt36:
        findings.append("launch-evidence contract evals: missing GT-36")
    elif gt36.get("must_include") != expected_gt36:
        findings.append("launch-evidence contract evals: GT-36 must_include drift")

    expected_ap43 = {
        "id": "AP-43",
        "name": "treat_hashed_external_account_file_as_verified_provider_capability",
        "correction": "require_external_capability_evidence_v1_reachable_commit_policy_identity_exact_checks_rehashed_raw_artifacts_and_protected_product_owner_approval_without_replacing_launch_gates",
    }
    ap43 = _entry_by_id(agent.get("anti_patterns", []), "AP-43")
    if ap43 != expected_ap43:
        findings.append("launch-evidence agent harness AP-43 drift")

    required_release_runtime_snippets = [
        "## Operational evidence policy",
        "`spec/release-operational-policy.json` owns the minimum non-regressing launch",
        "`release-slo-and-recovery-drill` gate requires one coherent campaign containing",
        "all five `release-operational-evidence.v1` reports:",
        "inner subject commit to match and that commit to be reachable from the",
        "product-owner-recorded `launch-release-candidate.v1` cohort",
        "repository raw artifacts are rechecked for tracked regular-file identity",
        "Formal reports may reference only `repo://` raw artifacts;",
        "expected/success/failed/missing counts, ratio, latency, and outage for every",
        "source dataset to be nonempty before exact restored count/hash comparison",
        "RPO is recomputed from the snapshot and recovery reference",
        "distinct A/B releases with explicit verified/retained state plus a nonempty",
        "different from the execution operator.",
        "External account readiness uses `external-capability-evidence.v1`.",
        "always `gate_eligible=false`: external capability evidence cannot replace",
        "protected product-owner",
        "Other launch-gate evidence remains fail-closed when no type-specific",
        "## Repository blank-environment simulation",
        "`infra/cloudbase/release-blank-environment-simulation.mjs` runs the real",
        "publisher, receiver adapter, and rollback functions against an injected",
        "sentinel count and canonical hash are unchanged with zero delete operations.",
        "`schema_version=release-blank-environment-simulation.v1`",
        "`execution_mode=repository_in_memory`",
        "`simulation=true`",
        "`gate_eligible=false`",
        "The simulation is a regression framework, not receiver execution evidence.",
        "Only a receiver-owned deployment running the formal policy can satisfy the",
    ]
    for snippet in required_release_runtime_snippets:
        if snippet not in release_runtime_text:
            findings.append(
                "launch-evidence release runtime contract missing exact snippet: "
                f"{snippet!r}"
            )

    simulation_source_path = (
        root / "infra/cloudbase/release-blank-environment-simulation.mjs"
    )
    simulation_test_path = (
        root
        / "infra/cloudbase/functions/softbook-api/test/"
        "release-blank-environment-simulation.test.js"
    )
    simulation_source_text = (
        simulation_source_path.read_text(encoding="utf-8")
        if simulation_source_path.is_file()
        else ""
    )
    simulation_test_text = (
        simulation_test_path.read_text(encoding="utf-8")
        if simulation_test_path.is_file()
        else ""
    )
    if not simulation_source_path.is_file():
        findings.append(
            "launch-evidence simulation source missing: "
            "infra/cloudbase/release-blank-environment-simulation.mjs"
        )
    if not simulation_test_path.is_file():
        findings.append(
            "launch-evidence simulation test missing: "
            "infra/cloudbase/functions/softbook-api/test/"
            "release-blank-environment-simulation.test.js"
        )

    required_simulation_source_snippets = [
        "from './cloudbase-receiver-adapter.mjs';",
        "from './release-delivery-v1.mjs';",
        "const adapter = createCloudBaseReceiverAdapter({",
        "const publishedA = await publishVerifiedRelease(releaseA, adapter);",
        "const publishedB = await publishVerifiedRelease(releaseB, adapter);",
        "const rollback = await rollbackToRetainedRelease(",
        "'softbook_learning_events'",
        "schema_version: RELEASE_BLANK_ENVIRONMENT_SIMULATION_SCHEMA",
        "simulation: true",
        "gate_eligible: false",
        "execution_mode: 'repository_in_memory'",
    ]
    for snippet in required_simulation_source_snippets:
        if snippet not in simulation_source_text:
            findings.append(
                f"launch-evidence simulation source missing exact snippet: {snippet!r}"
            )

    required_simulation_test_snippets = [
        "../../../release-blank-environment-simulation.mjs",
        "'release-blank-environment-simulation.v1'",
        "assert.equal(report.simulation, true);",
        "assert.equal(report.gate_eligible, false);",
        "assert.equal(report.execution_mode, 'repository_in_memory');",
        "assert.equal(report.assertions.user_data_sentinel_unchanged, true);",
        "assert.equal(report.assertions.delete_attempt_count, 0);",
    ]
    for snippet in required_simulation_test_snippets:
        if snippet not in simulation_test_text:
            findings.append(
                f"launch-evidence simulation test missing exact snippet: {snippet!r}"
            )

    if '"test": "node --test test/*.test.js"' not in package_text:
        findings.append(
            "launch-evidence package test script must include every test/*.test.js file"
        )

    launch_readiness_path = root / "docs/release/launch-readiness.v1.json"
    launch_readiness = (
        json.loads(launch_readiness_path.read_text(encoding="utf-8"))
        if launch_readiness_path.is_file()
        else {}
    )
    if "release_candidate" not in launch_readiness:
        findings.append(
            "launch-evidence launch readiness must declare release_candidate"
        )

    validator_path = root / "scripts/validate_launch_readiness.mjs"
    validator_text = (
        validator_path.read_text(encoding="utf-8")
        if validator_path.is_file()
        else ""
    )
    required_validator_snippets = [
        "'launch-release-candidate.v1'",
        "'release_candidate is required before recording formal gate evidence.'",
        "function verifyInnerRepositoryArtifact(",
        "validateExternalCapabilityEvidenceArtifact(artifact,",
        "'external-capability-evidence.v1'",
        "artifact.capability_eligible",
        "artifact.gate_eligible",
        "release_candidate commit must be reachable from the validated repository HEAD.",
    ]
    for snippet in required_validator_snippets:
        if snippet not in validator_text:
            findings.append(
                "launch-evidence validator missing exact snippet: "
                f"{snippet!r}"
            )

    evidence_contract_path = root / "scripts/lib/launch_evidence_contract.mjs"
    evidence_contract_text = (
        evidence_contract_path.read_text(encoding="utf-8")
        if evidence_contract_path.is_file()
        else ""
    )
    for snippet in [
        "must match the launch-level release_candidate cohort.",
        "'route_probes'",
        "must use repo://; remote evidence requires a verified repository manifest",
        "all_required_source_datasets_must_be_nonempty",
        "validateAvailabilityRouteProbes(",
    ]:
        if snippet not in evidence_contract_text:
            findings.append(
                "launch-evidence semantic contract missing exact snippet: "
                f"{snippet!r}"
            )

    classifier_path = root / "scripts/classify_formal_approval_scope.mjs"
    classifier_text = (
        classifier_path.read_text(encoding="utf-8")
        if classifier_path.is_file()
        else ""
    )
    for sensitive_path in [
        "'docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md'",
        "'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md'",
        "'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md'",
        "'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-layering-decision-proposal.md'",
        "'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md'",
        "'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md'",
        "'scripts/harness_validator/context.py'",
        "'scripts/harness_validator/sections/product_contract_mirrors.py'",
        "'scripts/harness_validator/sections/pr_design_gate_regressions.py'",
        "'scripts/harness_validator/sections/truth_mirrors.py'",
        "'scripts/lib/launch_evidence_contract.mjs'",
        "'scripts/lib/strict_json.mjs'",
        "'scripts/test_harness_module_boundaries.py'",
        "'scripts/test_validate_mobile_ux_batch0_decision.mjs'",
        "'scripts/test_validate_mobile_ux_batch1_registry.mjs'",
        "'scripts/test_validate_mobile_ux_batch1_freeze_candidate.mjs'",
        "'scripts/test_mobile_ux_batch1_manifest_contract.mjs'",
        "'scripts/validate_mobile_ux_batch0_decision.mjs'",
        "'scripts/validate_mobile_ux_batch1_registry.mjs'",
        "'scripts/validate_mobile_ux_batch1_freeze_candidate.mjs'",
        "'scripts/validate_mobile_ux_batch1_execution_manifest.mjs'",
        "'scripts/validate_state_evidence_ledger.mjs'",
        "'scripts/lib/mobile_ux_batch1_manifest_contract.mjs'",
        "'scripts/validate_pr_design_gate.py'",
        "'spec/account-sync-contract.json'",
        "'spec/authority-map.json'",
        "'spec/doc-manifest.json'",
        "'spec/release-operational-policy.json'",
        "'spec/runtime-boundaries.json'",
        "'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/'",
        "'docs/agent-runs/2026-08-10-mobile-ux-batch1-v2-schema-definition.md'",
    ]:
        if sensitive_path not in classifier_text:
            findings.append(
                "launch-evidence formal approval classifier missing sensitive path: "
                f"{sensitive_path}"
            )

    workflow_path = root / ".github/workflows/pr-gates.yml"
    workflow_text = (
        workflow_path.read_text(encoding="utf-8")
        if workflow_path.is_file()
        else ""
    )
    validate_harness_marker = "\n  validate-harness:\n"
    agent_review_marker = "\n  agent-review:\n"
    if (
        validate_harness_marker not in workflow_text
        or agent_review_marker not in workflow_text
    ):
        findings.append(
            "launch-evidence PR gates must retain validate-harness and agent-review jobs"
        )
    else:
        validate_harness_block = workflow_text.split(
            validate_harness_marker, 1
        )[1].split(agent_review_marker, 1)[0]
        if "fetch-depth: 0" not in validate_harness_block:
            findings.append(
                "launch-evidence validate-harness checkout must use fetch-depth: 0"
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
    release_policy = context.load("release-operational-policy.json")
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
    space_runtime_contract = (
        context.root / "infra/cloudbase/space-actions-v2-runtime-contract.md"
    )
    space_runtime_text = (
        space_runtime_contract.read_text(encoding="utf-8")
        if space_runtime_contract.is_file()
        else ""
    )
    release_runtime_contract = (
        context.root / "infra/cloudbase/release-bundle-v1-runtime-contract.md"
    )
    release_runtime_text = (
        release_runtime_contract.read_text(encoding="utf-8")
        if release_runtime_contract.is_file()
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
            provision_text,
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
    context.errors.extend(
        space_actions_contract_findings(
            auth,
            runtime,
            agent,
            evals,
            space_runtime_text,
            agent_entry_text,
            provision_text,
        )
    )
    context.errors.extend(
        launch_evidence_contract_findings(
            context.root,
            release_policy,
            auth,
            runtime,
            agent,
            evals,
            release_runtime_text,
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
