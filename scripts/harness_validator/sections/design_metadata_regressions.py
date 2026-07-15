from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    check_contains = context.check_contains

    design_metadata_scanner_text = (ROOT / "scripts/check_design_metadata_leaks.mjs").read_text(encoding="utf-8")
    for snippet in [
        "visualReferenceFiles",
        "docs/design/visual-reference.html",
        "html|md|svg",
        "decodeHtmlEntities",
        "metadataFieldPattern",
        "sourceLabel",
        "catalogCards",
        "completedAt",
        "usedHint",
        "usedPeek",
        "auth_token",
        "authToken",
        "sms_code",
        "phone_number",
        "day_key",
        "completed_at",
        "used_hint",
        "used_peek",
        "is_favorited",
        "is_sleeping",
        "last_modified_at",
        "lastModifiedAt",
        "checked_in_today",
        "favorite_count",
        "learning_completed_count",
        "pending_review_count",
        "review_completed_count",
        "sleeping_count",
        "total_completed_count",
        "counted_entry_count",
        "countedEntryCount",
        "last_experience_ended_by",
        "recovery_prompt_visible",
        "recoveryPromptVisible",
        "trial_duration_days",
        "trial_started_at_entry_count",
        "trialStartedAtEntryCount",
        "acknowledgedAt",
        "sync_daily_progress",
        "sync_space_state",
        "sync_learning_state",
        "start_membership_trial",
        "refresh_membership",
        "__softbook_mutation_queue",
        "retryCount",
        "apiKey",
        "apiKeyHeader",
        "baseUrl",
        "remoteConfig",
        "requestCodeEndpoint",
        "verifyCodeEndpoint",
        "dismissRecoveryEndpoint",
        "entitlementEndpoint",
        "purchaseEndpoint",
        "startTrialEndpoint",
        "trackQueryParam",
        "__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__",
        "SOFTBOOK_CET_REMOTE_BASE_URL",
        "SOFTBOOK_CET_REMOTE_API_KEY",
        "SOFTBOOK_CET_LEARNING_TRACK",
        "SOFTBOOK_CET_AUTH_TOKEN",
        "SOFTBOOK_CET_TEST_PHONE",
        "SOFTBOOK_CET_TEST_CODE",
        "SOFTBOOK_CET_SMOKE_ISOLATED_PHONE",
        "SOFTBOOK_CET_SMOKE_WRITE",
        "SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS",
        "SOFTBOOK_CET_EXPECT_INITIAL_STAGE",
        "SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE",
        "SOFTBOOK_CET_EXPECT_PURCHASE_STAGE",
        "SOFTBOOK_CET_IOS_LAUNCH",
        "SOFTBOOK_CET_IOS_DEVICE",
        "SOFTBOOK_CET_IOS_SIMULATOR",
        "SOFTBOOK_CET_IOS_BUNDLE_ID",
        "SOFTBOOK_CET_METRO_PORT",
        "SOFTBOOK_CET_STOP_METRO_ON_EXIT",
        "SOFTBOOK_CET_MANUAL_TEST_PHONE",
        "SOFTBOOK_CET_IOS_MAESTRO_FLOW",
        "SOFTBOOK_CET_MAESTRO_PHONE",
        "SOFTBOOK_CET_MAESTRO_CODE",
        "IOS_SIMULATOR",
        "IOS_DEVICE",
        "IOS_BUNDLE_ID",
        "METRO_PORT",
        "STOP_METRO_ON_EXIT",
        "SMS_CODE",
        "MANUAL_TEST_PHONE",
        "MAESTRO_FLOW",
        "MAESTRO_PHONE",
        "MAESTRO_CODE",
        "getDefaultApi",
        "createSoftbookApi",
        "handleCloudBaseEvent",
        "handleHttpRequest",
        "handleRequestCode",
        "handleVerifyCode",
        "handleLearningCardSource",
        "sendJson",
        "createAuthToken",
        "verifyAuthToken",
        "httpError",
        "getHeader",
        "requireObjectBody",
        "requireObject",
        "requireArray",
        "requirePhoneNumber",
        "requireBoolean",
        "requireIsoTimestamp",
        "requireAuthSession",
        "requireNonEmptyString",
        "requireDayKey",
        "requireNonNegativeInteger",
        "requireInteractionId",
        "requireLearningOutcome",
        "requireEnum",
        "parseJson",
        "resolveTokenTtlSeconds",
        "isApiKeyAllowed",
        "assertBodyPhoneMatchesSession",
        "signTokenPayload",
        "base64UrlEncode",
        "base64UrlDecode",
        "safeEqual",
        "parseDailyProgressSnapshot",
        "parseLearningStateSnapshot",
        "parseSpaceStateSnapshot",
        "acknowledgedResponse",
        "parseCloudBaseEvent",
        "parseEventBody",
        "normalizeApiPath",
        "normalizeHeaders",
        "normalizeQuery",
        "parseQueryString",
        "toCloudBaseResponse",
        "jsonResponse",
        "errorResponse",
        "createDefaultStore",
        "createMemoryStore",
        "createCloudBaseStore",
        "createCloudBaseDatabase",
        "getCloudBaseMembership",
        "saveCloudBaseMembership",
        "deserializeMembershipDocument",
        "createInitialMembership",
        "cloneMembership",
        "serializeMembershipEntitlement",
        "getCloudBaseDocument",
        "setCloudBaseDocument",
        "isCloudBaseDocumentMissingError",
        "createCloudBaseDocumentId",
        "getCardRecordsForTrack",
        "CET4_CARD_RECORDS",
        "CET6_CARD_RECORDS",
        "createDefaultCardSource",
        "cloneCardSource",
        "serializeCardSourceResponse",
        "validateCardSourceForImport",
        "normalizeCardSource",
        "normalizeCardRecord",
        "requireCardSourceObject",
        "requireCardSourceArray",
        "requireCardSourceString",
        "requireCardSourcePattern",
        "requireCardSourceTrack",
        "cardSourceError",
        "cloneJson",
        "CLOUDBASE_COLLECTIONS",
        "cardSources",
        "dailyProgress",
        "learningStates",
        "memberships",
        "spaceStates",
        "softbook_card_sources",
        "softbook_daily_progress",
        "softbook_learning_states",
        "softbook_memberships",
        "softbook_space_states",
        "getCardSource",
        "getMembership",
        "startTrial",
        "dismissRecovery",
        "saveDailyProgress",
        "saveLearningState",
        "saveSpaceState",
        "acknowledged_at",
        "updated_at",
        "events_by_card_id",
        "states_by_card_id",
        "documentId",
        "eventsByCardId",
        "statesByCardId",
        "server_sequence",
        "eventObject",
        "stateObject",
        "not_found",
        "invalid_api_key",
        "invalid_sms_code",
        "invalid_track",
        "DOCUMENT_NOT_EXIST",
        "invalid_card_source",
        "missing_auth_token",
        "invalid_auth_token",
        "expired_auth_token",
        "phone_number_mismatch",
        "internal_error",
        "invalid_request",
        "invalid_json",
        "isBase64Encoded",
        "tokenSecret",
        "tokenTtlSeconds",
        "issuedAt",
        "encodedPayload",
        "expectedSignature",
        "leftBuffer",
        "rightBuffer",
        "trial_available",
        "lock_slots",
        "elimination_items",
        "swipe_states",
        "optionIds",
        "lockSlots",
        "eliminationItems",
        "swipeStates",
        "defaultCardSource",
        "expectedTrack",
        "hintLayer",
        "headers",
        "httpMethod",
        "rawPath",
        "rawQueryString",
        "queryStringParameters",
        "queryString",
        "pathname",
        "v1Index",
        "fieldName",
        "statusCode",
        "requestContext",
        "defaultApi",
        "overrideValue",
        "envValue",
        "storeMode",
        "DEFAULT_SMS_CODE",
        "DEFAULT_TRIAL_DURATION_DAYS",
        "DEFAULT_TOKEN_TTL_SECONDS",
        "DEFAULT_CARD_SOURCE",
        "DEFAULT_ENV_ID",
        "COLLECTION_NAME",
        "DEFAULT_TRACKS",
        "ENV_ID",
        "FUNCTION_NAME",
        "HTTP_PATH",
        "DEFAULT_OUTPUT",
        "DEFAULT_FLOW_DIR",
        "useIsolatedPhone",
        "phoneNumber",
        "smsCode",
        "authTokenFromEnv",
        "enableWrites",
        "enableMembershipMutations",
        "expectedInitialStage",
        "expectedStartTrialStage",
        "expectedPurchaseStage",
        "authHeaders",
        "remoteHeaders",
        "returnedPhoneNumber",
        "requestSmsCode",
        "verifySmsCode",
        "syncDailyProgress",
        "syncLearningState",
        "syncSpaceState",
        "postJson",
        "REQUIRED_CORE_INTERACTIONS",
        "missingInteractions",
        "validateCardRecord",
        "assertPattern",
        "assertTrack",
        "assertArrayLength",
        "assertNonEmptyArray",
        "assertCoreInteractionCoverage",
        "loadMembershipEntitlement",
        "loadLearningCardSource",
        "runMembershipMutation",
        "assertExpectedStage",
        "expectedStage",
        "startMembershipTrial",
        "purchaseMembership",
        "dismissMembershipRecovery",
        "parseEntitlement",
        "assertOk",
        "assertObject",
        "assertString",
        "assertNonNegativeInteger",
        "assertPositiveInteger",
        "normalizeBaseUrl",
        "todayKey",
        "createIsolatedPhoneNumber",
        "firstCard",
        "returnedTrack",
        "itemIds",
        "featureModes",
        "learningTrack",
        "learningSource",
        "progressSync",
        "spaceState",
        "learningState",
        "flipConfidence",
        "selectedOptionId",
        "lockSelections",
        "eliminatedItemIds",
        "swipeSelection",
        "boxRef",
        "template_box_prefix",
        "templateBoxPrefix",
        "box_id",
        "boxId",
        "track_availability",
        "trackAvailability",
        "resolved_box_prefixes",
        "resolvedBoxPrefixes",
        "card_template",
        "cardTemplate",
        "card_counts",
        "cardCounts",
        "template_track_placeholder",
        "templateTrackPlaceholder",
        "interaction_id",
        "interactionId",
        "auto_scoring",
        "autoScoring",
        "answer_key",
        "answerKey",
        "correct_option",
        "correctOption",
        "lock_pattern",
        "lockPattern",
        "correct_items",
        "correctItems",
        "correct_state",
        "correctState",
        "card_id",
        "cardId",
        "visibleAttributeText",
        "visibleAttributeNames",
        "aria-valuetext",
        "placeholder",
        "cssGeneratedText",
        "cssGeneratedStringValues",
        "cssGeneratedAttrNames",
        "cssGeneratedVarNames",
        "accessibility text",
        "generated content",
        "processLeakTermPattern",
        "normalizeCamelCaseText",
        "rule.normalize",
        "visibleHtmlLeakagePatterns",
        "scanVisibleHtmlProcessText",
    ]:
        check_contains("design metadata scanner visual-reference process coverage", design_metadata_scanner_text, snippet)

    with context.temporary_directory(prefix="metadata-leak-fixture") as fixture_root:
        tmp_dir = fixture_root / "docs/design/mocks"
        tmp_dir.mkdir(parents=True)
        fixture_html = tmp_dir / "visible-process-leak.html"
        fixture_html.write_text(
            "<!doctype html><html><body><p>R&#117;ntime deb&#117;g payload visible to learner.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_snake_visible_html = tmp_dir / "snake-process-visible-leak.html"
        fixture_snake_visible_html.write_text(
            "<!doctype html><html><body><p>runtime_debug_payload</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_camel_visible_html = tmp_dir / "camel-process-visible-leak.html"
        fixture_camel_visible_html.write_text(
            "<!doctype html><html><body><p>runtimeDebugPayload visible to learner.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_camel_metadata_html = tmp_dir / "camel-metadata-visible-leak.html"
        fixture_camel_metadata_html.write_text(
            "<!doctype html><html><body><p>sourceLabel and boxRef are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_card_id_html = tmp_dir / "card-id-metadata-visible-leak.html"
        fixture_card_id_html.write_text(
            "<!doctype html><html><body><p>card_id and cardId are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_interaction_id_html = tmp_dir / "interaction-id-metadata-visible-leak.html"
        fixture_interaction_id_html.write_text(
            "<!doctype html><html><body><p>interaction_id and interactionId are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_answer_key_html = tmp_dir / "answer-key-metadata-visible-leak.html"
        fixture_answer_key_html.write_text(
            "<!doctype html><html><body><p>answer_key, answerKey, correct_option, and correctState are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_auto_scoring_html = tmp_dir / "auto-scoring-metadata-visible-leak.html"
        fixture_auto_scoring_html.write_text(
            "<!doctype html><html><body><p>auto_scoring and autoScoring are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_box_catalog_metadata_html = tmp_dir / "box-catalog-metadata-visible-leak.html"
        fixture_box_catalog_metadata_html.write_text(
            "<!doctype html><html><body><p>template_box_prefix, boxId, track_availability, resolvedBoxPrefixes, card_template, cardCounts, and templateTrackPlaceholder are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_result_session_metadata_html = tmp_dir / "result-session-metadata-visible-leak.html"
        fixture_result_session_metadata_html.write_text(
            "<!doctype html><html><body><p>catalogCards, completedAt, usedHint, and usedPeek are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_card_source_records_metadata_html = tmp_dir / "card-source-records-metadata-visible-leak.html"
        fixture_card_source_records_metadata_html.write_text(
            "<!doctype html><html><body><p>card_records and cardRecords are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_interaction_state_metadata_html = tmp_dir / "interaction-state-metadata-visible-leak.html"
        fixture_interaction_state_metadata_html.write_text(
            "<!doctype html><html><body><p>flipConfidence, selectedOptionId, lockSelections, eliminatedItemIds, and swipeSelection are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_sync_payload_metadata_html = tmp_dir / "sync-payload-metadata-visible-leak.html"
        fixture_sync_payload_metadata_html.write_text(
            "<!doctype html><html><body><p>auth_token, sms_code, phone_number, day_key, completed_at, used_hint, used_peek, is_favorited, is_sleeping, last_modified_at, checked_in_today, favorite_count, learning_completed_count, pending_review_count, review_completed_count, sleeping_count, and total_completed_count are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_membership_payload_metadata_html = tmp_dir / "membership-payload-metadata-visible-leak.html"
        fixture_membership_payload_metadata_html.write_text(
            "<!doctype html><html><body><p>counted_entry_count, last_experience_ended_by, recovery_prompt_visible, trial_duration_days, and trial_started_at_entry_count are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_camel_runtime_bookkeeping_metadata_html = tmp_dir / "camel-runtime-bookkeeping-metadata-visible-leak.html"
        fixture_camel_runtime_bookkeeping_metadata_html.write_text(
            "<!doctype html><html><body><p>authToken, acknowledgedAt, lastModifiedAt, countedEntryCount, recoveryPromptVisible, and trialStartedAtEntryCount are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_mutation_queue_metadata_html = tmp_dir / "mutation-queue-metadata-visible-leak.html"
        fixture_mutation_queue_metadata_html.write_text(
            "<!doctype html><html><body><p>sync_daily_progress, sync_space_state, sync_learning_state, start_membership_trial, refresh_membership, __softbook_mutation_queue, and retryCount are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_runtime_config_metadata_html = tmp_dir / "runtime-config-metadata-visible-leak.html"
        fixture_runtime_config_metadata_html.write_text(
            "<!doctype html><html><body><p>apiKey, apiKeyHeader, baseUrl, remoteConfig, requestCodeEndpoint, verifyCodeEndpoint, dismissRecoveryEndpoint, entitlementEndpoint, purchaseEndpoint, startTrialEndpoint, trackQueryParam, __SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__, SOFTBOOK_CET_REMOTE_BASE_URL, SOFTBOOK_CET_REMOTE_API_KEY, and SOFTBOOK_CET_LEARNING_TRACK are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_runtime_profile_metadata_html = tmp_dir / "runtime-profile-metadata-visible-leak.html"
        fixture_runtime_profile_metadata_html.write_text(
            "<!doctype html><html><body><p>featureModes, learningTrack, learningSource, progressSync, spaceState, and learningState are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_auth_env_metadata_html = tmp_dir / "smoke-auth-env-metadata-visible-leak.html"
        fixture_smoke_auth_env_metadata_html.write_text(
            "<!doctype html><html><body><p>SOFTBOOK_CET_AUTH_TOKEN, SOFTBOOK_CET_TEST_PHONE, and SOFTBOOK_CET_TEST_CODE are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_control_env_metadata_html = tmp_dir / "smoke-control-env-metadata-visible-leak.html"
        fixture_smoke_control_env_metadata_html.write_text(
            "<!doctype html><html><body><p>SOFTBOOK_CET_SMOKE_ISOLATED_PHONE, SOFTBOOK_CET_SMOKE_WRITE, SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS, SOFTBOOK_CET_EXPECT_INITIAL_STAGE, SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE, and SOFTBOOK_CET_EXPECT_PURCHASE_STAGE are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_ios_launch_env_metadata_html = tmp_dir / "ios-launch-env-metadata-visible-leak.html"
        fixture_ios_launch_env_metadata_html.write_text(
            "<!doctype html><html><body><p>SOFTBOOK_CET_IOS_LAUNCH, SOFTBOOK_CET_IOS_DEVICE, SOFTBOOK_CET_IOS_SIMULATOR, SOFTBOOK_CET_IOS_BUNDLE_ID, SOFTBOOK_CET_METRO_PORT, and SOFTBOOK_CET_STOP_METRO_ON_EXIT are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_ios_maestro_env_metadata_html = tmp_dir / "ios-maestro-env-metadata-visible-leak.html"
        fixture_ios_maestro_env_metadata_html.write_text(
            "<!doctype html><html><body><p>SOFTBOOK_CET_MANUAL_TEST_PHONE, SOFTBOOK_CET_IOS_MAESTRO_FLOW, SOFTBOOK_CET_MAESTRO_PHONE, and SOFTBOOK_CET_MAESTRO_CODE are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_ios_smoke_local_env_metadata_html = tmp_dir / "ios-smoke-local-env-metadata-visible-leak.html"
        fixture_ios_smoke_local_env_metadata_html.write_text(
            "<!doctype html><html><body><p>IOS_SIMULATOR, IOS_DEVICE, IOS_BUNDLE_ID, METRO_PORT, STOP_METRO_ON_EXIT, SMS_CODE, MANUAL_TEST_PHONE, MAESTRO_FLOW, MAESTRO_PHONE, and MAESTRO_CODE are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_cloudbase_script_local_metadata_html = (
            tmp_dir / "cloudbase-script-local-metadata-visible-leak.html"
        )
        fixture_cloudbase_script_local_metadata_html.write_text(
            "<!doctype html><html><body><p>DEFAULT_ENV_ID, COLLECTION_NAME, DEFAULT_TRACKS, ENV_ID, FUNCTION_NAME, HTTP_PATH, DEFAULT_OUTPUT, and DEFAULT_FLOW_DIR are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_default_constant_metadata_html = (
            tmp_dir / "backend-default-constant-metadata-visible-leak.html"
        )
        fixture_backend_default_constant_metadata_html.write_text(
            "<!doctype html><html><body><p>DEFAULT_SMS_CODE, DEFAULT_TRIAL_DURATION_DAYS, DEFAULT_TOKEN_TTL_SECONDS, DEFAULT_CARD_SOURCE, and CLOUDBASE_COLLECTIONS are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_collection_metadata_html = (
            tmp_dir / "backend-collection-metadata-visible-leak.html"
        )
        fixture_backend_collection_metadata_html.write_text(
            "<!doctype html><html><body><p>cardSources, dailyProgress, learningStates, memberships, spaceStates, softbook_card_sources, softbook_daily_progress, softbook_learning_states, softbook_memberships, and softbook_space_states are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_store_method_metadata_html = (
            tmp_dir / "backend-store-method-metadata-visible-leak.html"
        )
        fixture_backend_store_method_metadata_html.write_text(
            "<!doctype html><html><body><p>getCardSource, getMembership, startTrial, dismissRecovery, saveDailyProgress, saveLearningState, and saveSpaceState are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_document_field_metadata_html = (
            tmp_dir / "backend-document-field-metadata-visible-leak.html"
        )
        fixture_backend_document_field_metadata_html.write_text(
            "<!doctype html><html><body><p>acknowledged_at, updated_at, events_by_card_id, states_by_card_id, and server_sequence are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_document_local_field_metadata_html = (
            tmp_dir / "backend-document-local-field-metadata-visible-leak.html"
        )
        fixture_backend_document_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>documentId, eventsByCardId, and statesByCardId are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_error_code_metadata_html = (
            tmp_dir / "backend-error-code-metadata-visible-leak.html"
        )
        fixture_backend_error_code_metadata_html.write_text(
            "<!doctype html><html><body><p>not_found, invalid_api_key, invalid_sms_code, invalid_track, DOCUMENT_NOT_EXIST, invalid_card_source, missing_auth_token, invalid_auth_token, expired_auth_token, phone_number_mismatch, internal_error, invalid_request, and invalid_json are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_response_field_metadata_html = (
            tmp_dir / "backend-response-field-metadata-visible-leak.html"
        )
        fixture_backend_response_field_metadata_html.write_text(
            "<!doctype html><html><body><p>isBase64Encoded, tokenSecret, and tokenTtlSeconds are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_membership_enum_metadata_html = (
            tmp_dir / "backend-membership-enum-metadata-visible-leak.html"
        )
        fixture_backend_membership_enum_metadata_html.write_text(
            "<!doctype html><html><body><p>trial_available is visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_card_payload_field_metadata_html = (
            tmp_dir / "backend-card-payload-field-metadata-visible-leak.html"
        )
        fixture_backend_card_payload_field_metadata_html.write_text(
            "<!doctype html><html><body><p>lock_slots, elimination_items, and swipe_states are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_interaction_local_field_metadata_html = (
            tmp_dir / "backend-interaction-local-field-metadata-visible-leak.html"
        )
        fixture_backend_interaction_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>optionIds, lockSlots, eliminationItems, and swipeStates are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_card_shape_local_field_metadata_html = (
            tmp_dir / "backend-card-shape-local-field-metadata-visible-leak.html"
        )
        fixture_backend_card_shape_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>defaultCardSource, expectedTrack, and hintLayer are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_request_field_metadata_html = (
            tmp_dir / "backend-request-field-metadata-visible-leak.html"
        )
        fixture_backend_request_field_metadata_html.write_text(
            "<!doctype html><html><body><p>headers and pathname are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_event_adapter_local_field_metadata_html = (
            tmp_dir / "backend-event-adapter-local-field-metadata-visible-leak.html"
        )
        fixture_backend_event_adapter_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>httpMethod, rawPath, rawQueryString, queryStringParameters, v1Index, and queryString are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_http_local_field_metadata_html = (
            tmp_dir / "backend-http-local-field-metadata-visible-leak.html"
        )
        fixture_backend_http_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>fieldName, statusCode, and requestContext are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_config_local_field_metadata_html = (
            tmp_dir / "backend-config-local-field-metadata-visible-leak.html"
        )
        fixture_backend_config_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>defaultApi, overrideValue, envValue, and storeMode are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_route_helper_metadata_html = (
            tmp_dir / "backend-route-helper-metadata-visible-leak.html"
        )
        fixture_backend_route_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>getDefaultApi, createSoftbookApi, handleCloudBaseEvent, handleHttpRequest, handleRequestCode, handleVerifyCode, and handleLearningCardSource are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_http_helper_metadata_html = (
            tmp_dir / "backend-http-helper-metadata-visible-leak.html"
        )
        fixture_backend_http_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>sendJson, createAuthToken, verifyAuthToken, httpError, and getHeader are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_validator_helper_metadata_html = (
            tmp_dir / "backend-validator-helper-metadata-visible-leak.html"
        )
        fixture_backend_validator_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>requireObjectBody, requireObject, requireArray, requirePhoneNumber, requireBoolean, and requireIsoTimestamp are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_request_validation_helper_metadata_html = (
            tmp_dir / "backend-request-validation-helper-metadata-visible-leak.html"
        )
        fixture_backend_request_validation_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>requireAuthSession, requireNonEmptyString, requireDayKey, requireNonNegativeInteger, requireInteractionId, requireLearningOutcome, requireEnum, and parseJson are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_token_helper_metadata_html = (
            tmp_dir / "backend-token-helper-metadata-visible-leak.html"
        )
        fixture_backend_token_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>resolveTokenTtlSeconds, isApiKeyAllowed, assertBodyPhoneMatchesSession, base64UrlEncode, base64UrlDecode, and safeEqual are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_token_local_field_metadata_html = (
            tmp_dir / "backend-token-local-field-metadata-visible-leak.html"
        )
        fixture_backend_token_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>issuedAt and expectedSignature are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_token_buffer_metadata_html = (
            tmp_dir / "backend-token-buffer-metadata-visible-leak.html"
        )
        fixture_backend_token_buffer_metadata_html.write_text(
            "<!doctype html><html><body><p>leftBuffer and rightBuffer are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_sync_snapshot_metadata_html = (
            tmp_dir / "backend-sync-snapshot-metadata-visible-leak.html"
        )
        fixture_backend_sync_snapshot_metadata_html.write_text(
            "<!doctype html><html><body><p>parseDailyProgressSnapshot, parseLearningStateSnapshot, parseSpaceStateSnapshot, and acknowledgedResponse are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_sync_local_field_metadata_html = (
            tmp_dir / "backend-sync-local-field-metadata-visible-leak.html"
        )
        fixture_backend_sync_local_field_metadata_html.write_text(
            "<!doctype html><html><body><p>eventObject and stateObject are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_event_adapter_metadata_html = (
            tmp_dir / "backend-event-adapter-metadata-visible-leak.html"
        )
        fixture_backend_event_adapter_metadata_html.write_text(
            "<!doctype html><html><body><p>parseCloudBaseEvent, parseEventBody, normalizeApiPath, normalizeHeaders, normalizeQuery, parseQueryString, toCloudBaseResponse, jsonResponse, and errorResponse are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_store_helper_metadata_html = (
            tmp_dir / "backend-store-helper-metadata-visible-leak.html"
        )
        fixture_backend_store_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>createDefaultStore, createMemoryStore, createCloudBaseStore, createCloudBaseDatabase, getCloudBaseMembership, saveCloudBaseMembership, deserializeMembershipDocument, getCloudBaseDocument, setCloudBaseDocument, isCloudBaseDocumentMissingError, and createCloudBaseDocumentId are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_membership_helper_metadata_html = (
            tmp_dir / "backend-membership-helper-metadata-visible-leak.html"
        )
        fixture_backend_membership_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>createInitialMembership, cloneMembership, and serializeMembershipEntitlement are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_card_record_source_metadata_html = (
            tmp_dir / "backend-card-record-source-metadata-visible-leak.html"
        )
        fixture_backend_card_record_source_metadata_html.write_text(
            "<!doctype html><html><body><p>getCardRecordsForTrack, CET4_CARD_RECORDS, and CET6_CARD_RECORDS are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_backend_card_source_helper_metadata_html = (
            tmp_dir / "backend-card-source-helper-metadata-visible-leak.html"
        )
        fixture_backend_card_source_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>createDefaultCardSource, cloneCardSource, serializeCardSourceResponse, validateCardSourceForImport, normalizeCardSource, normalizeCardRecord, requireCardSourceObject, requireCardSourceArray, requireCardSourceString, requireCardSourcePattern, requireCardSourceTrack, cardSourceError, and cloneJson are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_runtime_local_metadata_html = (
            tmp_dir / "smoke-runtime-local-metadata-visible-leak.html"
        )
        fixture_smoke_runtime_local_metadata_html.write_text(
            "<!doctype html><html><body><p>useIsolatedPhone, phoneNumber, smsCode, authTokenFromEnv, enableWrites, enableMembershipMutations, expectedInitialStage, expectedStartTrialStage, and expectedPurchaseStage are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_runtime_output_metadata_html = (
            tmp_dir / "smoke-runtime-output-metadata-visible-leak.html"
        )
        fixture_smoke_runtime_output_metadata_html.write_text(
            "<!doctype html><html><body><p>authHeaders, remoteHeaders, returnedPhoneNumber, REQUIRED_CORE_INTERACTIONS, and missingInteractions are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_card_shape_metadata_html = (
            tmp_dir / "smoke-card-shape-metadata-visible-leak.html"
        )
        fixture_smoke_card_shape_metadata_html.write_text(
            "<!doctype html><html><body><p>validateCardRecord, assertPattern, assertTrack, assertArrayLength, assertNonEmptyArray, and assertCoreInteractionCoverage are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_endpoint_helper_metadata_html = (
            tmp_dir / "smoke-endpoint-helper-metadata-visible-leak.html"
        )
        fixture_smoke_endpoint_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>loadMembershipEntitlement, loadLearningCardSource, runMembershipMutation, and parseEntitlement are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_assertion_helper_metadata_html = (
            tmp_dir / "smoke-assertion-helper-metadata-visible-leak.html"
        )
        fixture_smoke_assertion_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>assertOk, assertObject, assertString, assertNonNegativeInteger, assertPositiveInteger, normalizeBaseUrl, todayKey, and createIsolatedPhoneNumber are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_card_local_metadata_html = (
            tmp_dir / "smoke-card-local-metadata-visible-leak.html"
        )
        fixture_smoke_card_local_metadata_html.write_text(
            "<!doctype html><html><body><p>firstCard, returnedTrack, and itemIds are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_membership_helper_metadata_html = (
            tmp_dir / "smoke-membership-helper-metadata-visible-leak.html"
        )
        fixture_smoke_membership_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>assertExpectedStage, expectedStage, startMembershipTrial, purchaseMembership, and dismissMembershipRecovery are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_smoke_action_helper_metadata_html = (
            tmp_dir / "smoke-action-helper-metadata-visible-leak.html"
        )
        fixture_smoke_action_helper_metadata_html.write_text(
            "<!doctype html><html><body><p>requestSmsCode, verifySmsCode, syncDailyProgress, syncLearningState, syncSpaceState, and postJson are visible.</p></body></html>\n",
            encoding="utf-8",
        )
        fixture_svg = tmp_dir / "visible-process-leak.svg"
        fixture_svg.write_text(
            '<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg"><text>R&#117;ntime deb&#117;g payload visible to learner.</text></svg>\n',
            encoding="utf-8",
        )
        fixture_accessible_html = tmp_dir / "accessible-process-leak.html"
        fixture_accessible_html.write_text(
            '<!doctype html><html><body><section aria-label="R&#117;ntime deb&#117;g payload visible to learner."><p>学习画面</p></section></body></html>\n',
            encoding="utf-8",
        )
        fixture_accessible_svg = tmp_dir / "accessible-process-leak.svg"
        fixture_accessible_svg.write_text(
            '<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg"><g aria-label="R&#117;ntime deb&#117;g payload visible to learner."><text>学习画面</text></g></svg>\n',
            encoding="utf-8",
        )
        fixture_visible_attribute_html = tmp_dir / "visible-attribute-leak.html"
        fixture_visible_attribute_html.write_text(
            '<!doctype html><html><body><input placeholder="R&#117;ntime deb&#117;g payload visible to learner." value="学习画面"></body></html>\n',
            encoding="utf-8",
        )
        fixture_unquoted_visible_attribute_html = tmp_dir / "unquoted-visible-attribute-leak.html"
        fixture_unquoted_visible_attribute_html.write_text(
            '<!doctype html><html><body><input placeholder=R&#117;ntime-deb&#117;g-payload value=学习画面></body></html>\n',
            encoding="utf-8",
        )
        fixture_snake_attribute_html = tmp_dir / "snake-process-attribute-leak.html"
        fixture_snake_attribute_html.write_text(
            '<!doctype html><html><body><input placeholder=agent_review value=学习画面></body></html>\n',
            encoding="utf-8",
        )
        fixture_aria_value_svg = tmp_dir / "aria-valuetext-leak.svg"
        fixture_aria_value_svg.write_text(
            '<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg"><g aria-valuetext="R&#117;ntime deb&#117;g payload visible to learner."><text>学习画面</text></g></svg>\n',
            encoding="utf-8",
        )
        fixture_generated_html = tmp_dir / "generated-content-leak.html"
        fixture_generated_html.write_text(
            '<!doctype html><html><head><style>.leak::before { content: "R\\75 ntime deb\\75 g payload visible to learner."; }</style></head><body><p class="leak">学习画面</p></body></html>\n',
            encoding="utf-8",
        )
        fixture_attr_generated_html = tmp_dir / "generated-attr-content-leak.html"
        fixture_attr_generated_html.write_text(
            '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class="leak" data-caption="R&#117;ntime deb&#117;g payload visible to learner.">学习画面</p></body></html>\n',
            encoding="utf-8",
        )
        fixture_unquoted_attr_generated_html = tmp_dir / "generated-unquoted-attr-content-leak.html"
        fixture_unquoted_attr_generated_html.write_text(
            '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class=leak data-caption=R&#117;ntime-deb&#117;g-payload>学习画面</p></body></html>\n',
            encoding="utf-8",
        )
        fixture_snake_generated_html = tmp_dir / "snake-process-generated-leak.html"
        fixture_snake_generated_html.write_text(
            '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class=leak data-caption=debug_payload>学习画面</p></body></html>\n',
            encoding="utf-8",
        )
        fixture_camel_generated_html = tmp_dir / "camel-metadata-generated-leak.html"
        fixture_camel_generated_html.write_text(
            '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class=leak data-caption=sourceLabel>学习画面</p></body></html>\n',
            encoding="utf-8",
        )
        fixture_var_generated_html = tmp_dir / "generated-var-content-leak.html"
        fixture_var_generated_html.write_text(
            '<!doctype html><html><head><style>:root { --leak-copy: "R\\75 ntime deb\\75 g payload visible to learner."; } .leak::before { content: var(--leak-copy); }</style></head><body><p class="leak">学习画面</p></body></html>\n',
            encoding="utf-8",
        )
        fixture_composite_generated_html = tmp_dir / "generated-composite-content-leak.html"
        fixture_composite_generated_html.write_text(
            '<!doctype html><html><head><style>.leak::before { content: attr(data-caption) " R\\75 ntime deb\\75 g payload visible to learner."; }</style></head><body><p class="leak" data-caption="学习线索">学习画面</p></body></html>\n',
            encoding="utf-8",
        )
        design_metadata_fixture = context.run_validator(
            "scripts/check_design_metadata_leaks.mjs",
            "--root",
            str(fixture_root),
        )
        design_metadata_output = design_metadata_fixture.stdout + design_metadata_fixture.stderr
        if design_metadata_fixture.returncode == 0:
            errors.append("design metadata scanner must reject internal process wording in rendered HTML")
        for expected_snippet in [
            "visible-process-leak.html",
            "snake-process-visible-leak.html",
            "camel-process-visible-leak.html",
            "camel-metadata-visible-leak.html",
            "card-id-metadata-visible-leak.html",
            "interaction-id-metadata-visible-leak.html",
            "answer-key-metadata-visible-leak.html",
            "auto-scoring-metadata-visible-leak.html",
            "box-catalog-metadata-visible-leak.html",
            "result-session-metadata-visible-leak.html",
            "card-source-records-metadata-visible-leak.html",
            "interaction-state-metadata-visible-leak.html",
            "sync-payload-metadata-visible-leak.html",
            "membership-payload-metadata-visible-leak.html",
            "camel-runtime-bookkeeping-metadata-visible-leak.html",
            "mutation-queue-metadata-visible-leak.html",
            "runtime-config-metadata-visible-leak.html",
            "runtime-profile-metadata-visible-leak.html",
            "smoke-auth-env-metadata-visible-leak.html",
            "smoke-control-env-metadata-visible-leak.html",
            "ios-launch-env-metadata-visible-leak.html",
            "ios-maestro-env-metadata-visible-leak.html",
            "ios-smoke-local-env-metadata-visible-leak.html",
            "cloudbase-script-local-metadata-visible-leak.html",
            "backend-default-constant-metadata-visible-leak.html",
            "backend-collection-metadata-visible-leak.html",
            "backend-store-method-metadata-visible-leak.html",
            "backend-document-field-metadata-visible-leak.html",
            "backend-document-local-field-metadata-visible-leak.html",
            "backend-error-code-metadata-visible-leak.html",
            "backend-response-field-metadata-visible-leak.html",
            "backend-membership-enum-metadata-visible-leak.html",
            "backend-card-payload-field-metadata-visible-leak.html",
            "backend-interaction-local-field-metadata-visible-leak.html",
            "backend-card-shape-local-field-metadata-visible-leak.html",
            "backend-request-field-metadata-visible-leak.html",
            "backend-event-adapter-local-field-metadata-visible-leak.html",
            "backend-http-local-field-metadata-visible-leak.html",
            "backend-config-local-field-metadata-visible-leak.html",
            "backend-route-helper-metadata-visible-leak.html",
            "backend-http-helper-metadata-visible-leak.html",
            "backend-validator-helper-metadata-visible-leak.html",
            "backend-request-validation-helper-metadata-visible-leak.html",
            "backend-token-helper-metadata-visible-leak.html",
            "backend-token-local-field-metadata-visible-leak.html",
            "backend-token-buffer-metadata-visible-leak.html",
            "backend-sync-snapshot-metadata-visible-leak.html",
            "backend-sync-local-field-metadata-visible-leak.html",
            "backend-event-adapter-metadata-visible-leak.html",
            "backend-store-helper-metadata-visible-leak.html",
            "backend-membership-helper-metadata-visible-leak.html",
            "backend-card-record-source-metadata-visible-leak.html",
            "backend-card-source-helper-metadata-visible-leak.html",
            "smoke-runtime-local-metadata-visible-leak.html",
            "smoke-runtime-output-metadata-visible-leak.html",
            "smoke-card-shape-metadata-visible-leak.html",
            "smoke-endpoint-helper-metadata-visible-leak.html",
            "smoke-assertion-helper-metadata-visible-leak.html",
            "smoke-card-local-metadata-visible-leak.html",
            "smoke-membership-helper-metadata-visible-leak.html",
            "smoke-action-helper-metadata-visible-leak.html",
            "visible-process-leak.svg",
            "accessible-process-leak.html",
            "accessible-process-leak.svg",
            "accessibility text",
            "visible-attribute-leak.html",
            "snake-process-attribute-leak.html",
            "aria-valuetext-leak.svg",
            "generated-content-leak.html",
            "generated-attr-content-leak.html",
            "generated-unquoted-attr-content-leak.html",
            "snake-process-generated-leak.html",
            "camel-metadata-generated-leak.html",
            "unquoted-visible-attribute-leak.html",
            "generated-var-content-leak.html",
            "generated-composite-content-leak.html",
            "generated content",
            "internal process or implementation term in rendered visual proof",
        ]:
            if expected_snippet not in design_metadata_output:
                errors.append(
                    "design metadata scanner rendered HTML fixture missing expected output: "
                    + expected_snippet
                )

    with context.temporary_directory(prefix="visual-reference-fixture") as fixture_root:
        visual_reference_path = fixture_root / "docs/design/visual-reference.html"
        visual_reference_path.parent.mkdir(parents=True)
        visual_reference_original = (
            ROOT / "docs/design/visual-reference.html"
        ).read_text(encoding="utf-8")
        visual_reference_path.write_text(
            visual_reference_original.replace(
                "</body>",
                "<p>docs/internal/path visible to learner.</p></body>",
            ),
            encoding="utf-8",
        )
        visual_reference_fixture = context.run_validator(
            "scripts/check_design_metadata_leaks.mjs",
            "--root",
            str(fixture_root),
        )

    visual_reference_output = visual_reference_fixture.stdout + visual_reference_fixture.stderr
    if visual_reference_fixture.returncode == 0:
        errors.append("design metadata scanner must reject repo paths in visual-reference visible text")
    for expected_snippet in [
        "docs/design/visual-reference.html",
        "repo path in rendered visual proof",
    ]:
        if expected_snippet not in visual_reference_output:
            errors.append(
                "design metadata scanner visual-reference fixture missing expected output: "
                + expected_snippet
            )
