from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    check_contains = context.check_contains

    mobile_metadata_scanner_text = (ROOT / "apps/mobile/scripts/check-metadata-leaks.mjs").read_text(encoding="utf-8")
    app_visible_metadata_guard_text = (ROOT / "apps/mobile/__tests__/App.test.tsx").read_text(encoding="utf-8")
    for snippet in [
        "src/learning/localCardRecords.ts",
        "src/learning/model.ts",
        "src/shared/uiMetadata/displayMetadata.ts",
        "src/space/spaceMetadataDisplay.ts",
        "rawMetadataFieldNames",
        "rawSpaceMetadataFieldNames",
        "propertyAccessPattern",
        "bracketAccessPattern",
        "quotedSpaceMetadataReferencePattern",
        "quotedNestedSpaceMetadataReferencePattern",
        "rawMetadataReferencePattern",
    ]:
        check_contains("mobile metadata scanner visible TS source coverage", mobile_metadata_scanner_text, snippet)

    for snippet in [
        "卡组",
        "本组第",
        "这一组学习卡",
        "这组回看卡",
        "这一组已经按学习节奏走完",
        "再练一轮这一组",
        "回看这一组",
    ]:
        check_contains("mobile metadata scanner old Learning group copy guard", mobile_metadata_scanner_text, snippet)

    for snippet in [
        "aria-label",
        "aria-labelledby",
        "aria-valuetext",
        "accessibilityLabelledBy",
        "accessibilityHint",
        "accessibilityLabel",
        "accessibilityValue",
        "visibleCopyPropNames",
        "description",
        "message",
        "sourceLabel",
        "source_label",
        "catalogCards",
        "completedAt",
        "usedHint",
        "usedPeek",
        "card_records",
        "cardRecords",
        "auth_token",
        "authToken",
        "access_token",
        "accessToken",
        "refresh_token",
        "refreshToken",
        "challenge_id",
        "challengeId",
        "session_id",
        "sessionId",
        "selection_id",
        "selectionId",
        "scheduler_version",
        "schedulerVersion",
        "scheduler_by_card_id",
        "schedulerByCardId",
        "next_due_at",
        "nextDueAt",
        "learning_acknowledged_at",
        "learningAcknowledgedAt",
        "learning_server_sequence",
        "learningServerSequence",
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
        "schema_version",
        "schemaVersion",
        "event_id",
        "eventId",
        "answer_grade",
        "answerGrade",
        "client_occurred_at",
        "clientOccurredAt",
        "content_version",
        "contentVersion",
        "device_cursor",
        "deviceCursor",
        "device_id",
        "deviceId",
        "serverSequence",
        "sync_daily_progress",
        "sync_space_state",
        "sync_learning_state",
        "start_membership_trial",
        "refresh_membership",
        "__softbook_mutation_queue",
        "__softbook_learning_event_outbox_v1",
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
        "__SOFTBOOK_CET_RUNTIME_CONFIG__",
        "__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__",
        "SOFTBOOK_CET_REMOTE_BASE_URL",
        "SOFTBOOK_CET_REMOTE_API_KEY",
        "SOFTBOOK_CET_LEARNING_TRACK",
        "SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES",
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
        "SOFTBOOK_API_KEY",
        "SOFTBOOK_SMS_DEV_CODE",
        "SOFTBOOK_AUTH_TOKEN_SECRET",
        "SOFTBOOK_AUTH_TOKEN_TTL_SECONDS",
        "SOFTBOOK_STORE_MODE",
        "CLOUDBASE_ENV_ID",
        "TCB_ENV",
        "SCF_NAMESPACE",
        "CLOUDBASE_COLLECTIONS",
        "cardSources",
        "dailyCheckIns",
        "dailyProgress",
        "learningStates",
        "learningSessions",
        "memberships",
        "spaceStates",
        "softbook_card_sources",
        "softbook_daily_check_ins",
        "softbook_daily_progress",
        "softbook_learning_states",
        "softbook_learning_sessions",
        "softbook_memberships",
        "softbook_space_states",
        "getCardSource",
        "getMembership",
        "checkInDailyProgress",
        "assertLegacySnapshotWritesDisabled",
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
        "dev_fixed_code",
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
        "box_ref",
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
        "knowledge_ref",
        "knowledgeRef",
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
        "card_records",
        "allowedDisplayMetadataLookupPattern",
        "stripAllowedMetadataDisplayLookups",
        "hasRawMetadataExpression",
        "visiblePropOpenPattern",
        "visiblePropTemplateOpenPattern",
        "pendingVisibleCopyProp",
        "hasUnclosedTemplateLiteral",
        "hasUnclosedJsxPropExpression",
        "renderedMetadataPropNames",
        "renderedMetadataPropOpenPattern",
        "pendingRenderedMetadataProp",
        "endsWith('.d.ts')",
        "inInternalErrorExpression",
        "visible or accessibility copy prop",
        "multiline visible or accessibility copy prop",
        "multiline rendered element prop",
    ]:
        check_contains("mobile metadata scanner accessibility copy prop coverage", mobile_metadata_scanner_text, snippet)

    for snippet in [
        "当前卡组",
        "本组第",
        "本轮卡组",
        "这一组学习卡",
        "这组回看卡",
        "这一组已经按学习节奏走完",
        "再练一轮这一组",
        "回看这一组",
    ]:
        check_contains("App visible metadata guard old Learning group copy guard", app_visible_metadata_guard_text, snippet)

    with context.temporary_directory(prefix="metadata-scanner-visible-ts") as tmp_app_root:
        (tmp_app_root / "src/learning").mkdir(parents=True)
        (tmp_app_root / "src/shared/uiMetadata").mkdir(parents=True)
        (tmp_app_root / "src/space").mkdir(parents=True)
        (tmp_app_root / "src/learning/model.ts").write_text(
            "export const INTERACTION_LABELS = { flip: '本轮卡组' };\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/shared/uiMetadata/displayMetadata.ts").write_text(
            "export const FALLBACK_LABEL = '本轮卡组';\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/space/spaceMetadataDisplay.ts").write_text(
            "export const SPACE_LABEL = '本轮卡组';\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/AccessibilityLeak.tsx").write_text(
            "export function AccessibilityLeak({ card }) {\n"
            "  return <Pressable accessibilityHint={card.space_metadata.box_ref} accessibilityValue={{ text: card.groupName }} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/AccessibilityLabelLeak.tsx").write_text(
            "export function AccessibilityLabelLeak({ card }) {\n"
            "  return <Pressable accessibilityLabel={card.sourceLabel} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/OptionalTextLeak.tsx").write_text(
            "export function OptionalTextLeak({ card }) {\n"
            "  return <Text>{card?.sourceLabel}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BareTextLeak.tsx").write_text(
            "export function BareTextLeak({ sourceLabel }) {\n"
            "  return <Text>{sourceLabel}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/OptionalSpacePropLeak.tsx").write_text(
            "export function OptionalSpacePropLeak({ card }) {\n"
            "  return <Pressable accessibilityHint={card.space_metadata?.box_ref} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/DestructuredBoxRefTextLeak.tsx").write_text(
            "export function DestructuredBoxRefTextLeak({ box_ref }) {\n"
            "  return <Text>{box_ref}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/DestructuredBoxRefPropLeak.tsx").write_text(
            "export function DestructuredBoxRefPropLeak({ box_ref }) {\n"
            "  return <Pressable accessibilityHint={box_ref} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/KnowledgeRefTextLeak.tsx").write_text(
            "export function KnowledgeRefTextLeak({ card }) {\n"
            "  return <Text>{card.knowledge_ref}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/DestructuredKnowledgeRefTextLeak.tsx").write_text(
            "export function DestructuredKnowledgeRefTextLeak({ knowledge_ref }) {\n"
            "  return <Text>{knowledge_ref}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelKnowledgeRefPropLeak.tsx").write_text(
            "export function CamelKnowledgeRefPropLeak({ knowledgeRef }) {\n"
            "  return <Pressable accessibilityHint={knowledgeRef} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InteractionIdTextLeak.tsx").write_text(
            "export function InteractionIdTextLeak({ card }) {\n"
            "  return <Text>{card.interaction_id}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelInteractionIdPropLeak.tsx").write_text(
            "export function CamelInteractionIdPropLeak({ interactionId }) {\n"
            "  return <Pressable accessibilityHint={interactionId} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InteractionIdRenderedPropLeak.tsx").write_text(
            "export function InteractionIdRenderedPropLeak({ card }) {\n"
            "  return <View testID={`interaction-${card.interaction_id}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InteractionLabelLookupNoLeak.tsx").write_text(
            "export function InteractionLabelLookupNoLeak({ card }) {\n"
            "  return <Text>{INTERACTION_LABELS[card.interaction_id]}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InteractionLabelPropNoLeak.tsx").write_text(
            "export function InteractionLabelPropNoLeak({ card }) {\n"
            "  return <Pressable accessibilityHint={INTERACTION_LABELS[card.interaction_id]} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/AnswerKeyTextLeak.tsx").write_text(
            "export function AnswerKeyTextLeak({ card }) {\n"
            "  return <Text>{card.answer_key.correct_option}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelAnswerKeyPropLeak.tsx").write_text(
            "export function CamelAnswerKeyPropLeak({ answerKey }) {\n"
            "  return <Pressable accessibilityHint={answerKey.correctOption} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/DestructuredCorrectOptionTextLeak.tsx").write_text(
            "export function DestructuredCorrectOptionTextLeak({ correct_option }) {\n"
            "  return <Text>{correct_option}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CorrectStateRenderedPropLeak.tsx").write_text(
            "export function CorrectStateRenderedPropLeak({ correctState }) {\n"
            "  return <View testID={correctState} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/AutoScoringTextLeak.tsx").write_text(
            "export function AutoScoringTextLeak({ card }) {\n"
            "  return <Text>{card.auto_scoring}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelAutoScoringPropLeak.tsx").write_text(
            "export function CamelAutoScoringPropLeak({ autoScoring }) {\n"
            "  return <Pressable accessibilityHint={autoScoring ? '自动评分' : '自评'} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/AutoScoringRenderedPropLeak.tsx").write_text(
            "export function AutoScoringRenderedPropLeak({ card }) {\n"
            "  return <View testID={card.auto_scoring} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BoxCatalogMetadataTextLeak.tsx").write_text(
            "export function BoxCatalogMetadataTextLeak({ box }) {\n"
            "  return <Text>{box.track_availability}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelBoxCatalogMetadataPropLeak.tsx").write_text(
            "export function CamelBoxCatalogMetadataPropLeak({ box }) {\n"
            "  return <Pressable accessibilityHint={box.templateBoxPrefix} accessibilityLabel={box.cardCounts} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BoxCatalogMetadataRenderedPropLeak.tsx").write_text(
            "export function BoxCatalogMetadataRenderedPropLeak({ box }) {\n"
            "  return <View testID={`${box.resolvedBoxPrefixes}-${box.templateTrackPlaceholder}-${box.box_id}-${box.card_template}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/ResultSessionMetadataTextLeak.tsx").write_text(
            "export function ResultSessionMetadataTextLeak({ session }) {\n"
            "  return <Text>{session.catalogCards}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/ResultSessionMetadataPropLeak.tsx").write_text(
            "export function ResultSessionMetadataPropLeak({ result }) {\n"
            "  return <Pressable accessibilityHint={result.usedHint} accessibilityLabel={result.usedPeek} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/ResultSessionMetadataRenderedPropLeak.tsx").write_text(
            "export function ResultSessionMetadataRenderedPropLeak({ result }) {\n"
            "  return <View testID={result.completedAt} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InteractionStateMetadataTextLeak.tsx").write_text(
            "export function InteractionStateMetadataTextLeak({ state }) {\n"
            "  return <Text>{state.selectedOptionId}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InteractionStateMetadataPropLeak.tsx").write_text(
            "export function InteractionStateMetadataPropLeak({ state }) {\n"
            "  return <Pressable accessibilityHint={state.flipConfidence} accessibilityLabel={state.eliminatedItemIds} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InteractionStateMetadataRenderedPropLeak.tsx").write_text(
            "export function InteractionStateMetadataRenderedPropLeak({ state }) {\n"
            "  return <View testID={`${state.lockSelections}-${state.swipeSelection}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SyncPayloadMetadataTextLeak.tsx").write_text(
            "export function SyncPayloadMetadataTextLeak({ payload }) {\n"
            "  return <Text>{payload.auth_token}{payload.access_token}{payload.refresh_token}{payload.challenge_id}{payload.session_id}{payload.phone_number}{payload.completed_at}{payload.used_hint}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SyncPayloadMetadataPropLeak.tsx").write_text(
            "export function SyncPayloadMetadataPropLeak({ payload }) {\n"
            "  return <Pressable accessibilityHint={payload.sms_code} accessibilityLabel={`${payload.used_peek}-${payload.checked_in_today}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SyncPayloadMetadataRenderedPropLeak.tsx").write_text(
            "export function SyncPayloadMetadataRenderedPropLeak({ payload }) {\n"
            "  return <View testID={`${payload.day_key}-${payload.is_favorited}-${payload.is_sleeping}-${payload.last_modified_at}-${payload.favorite_count}-${payload.learning_completed_count}-${payload.pending_review_count}-${payload.review_completed_count}-${payload.sleeping_count}-${payload.total_completed_count}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MembershipPayloadMetadataTextLeak.tsx").write_text(
            "export function MembershipPayloadMetadataTextLeak({ entitlement }) {\n"
            "  return <Text>{entitlement.counted_entry_count}{entitlement.last_experience_ended_by}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MembershipPayloadMetadataPropLeak.tsx").write_text(
            "export function MembershipPayloadMetadataPropLeak({ entitlement }) {\n"
            "  return <Pressable accessibilityHint={entitlement.recovery_prompt_visible} accessibilityLabel={entitlement.trial_duration_days} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MembershipPayloadMetadataRenderedPropLeak.tsx").write_text(
            "export function MembershipPayloadMetadataRenderedPropLeak({ entitlement }) {\n"
            "  return <View testID={`${entitlement.trial_started_at_entry_count}-${entitlement.counted_entry_count}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelRuntimeBookkeepingMetadataTextLeak.tsx").write_text(
            "export function CamelRuntimeBookkeepingMetadataTextLeak({ session, snapshot }) {\n"
            "  return <Text>{session.authToken}{session.accessToken}{session.refreshToken}{session.challengeId}{session.sessionId}{snapshot.acknowledgedAt}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelRuntimeBookkeepingMetadataPropLeak.tsx").write_text(
            "export function CamelRuntimeBookkeepingMetadataPropLeak({ state, membership }) {\n"
            "  return <Pressable accessibilityHint={state.lastModifiedAt} accessibilityLabel={`${membership.countedEntryCount}-${membership.recoveryPromptVisible}-${membership.trialStartedAtEntryCount}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelRuntimeBookkeepingMetadataRenderedPropLeak.tsx").write_text(
            "export function CamelRuntimeBookkeepingMetadataRenderedPropLeak({ session, state }) {\n"
            "  return <View testID={`${session.authToken}-${state.lastModifiedAt}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/LearningEventMetadataTextLeak.tsx").write_text(
            "export function LearningEventMetadataTextLeak({ event }) {\n"
            "  return <Text>{event.event_id}{event.answer_grade}{event.client_occurred_at}{event.content_version}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/LearningEventMetadataPropLeak.tsx").write_text(
            "export function LearningEventMetadataPropLeak({ event, ack }) {\n"
            "  return <Pressable accessibilityHint={event.device_cursor.device_id} accessibilityLabel={ack.serverSequence} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/LearningEventMetadataRenderedPropLeak.tsx").write_text(
            "export function LearningEventMetadataRenderedPropLeak() {\n"
            "  return <View testID=\"__softbook_learning_event_outbox_v1-schema_version-deviceCursor\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SchedulerMetadataLeak.tsx").write_text(
            "export function SchedulerMetadataLeak({ session }) {\n"
            "  return <Text>{session.selection_id}{session.scheduler_version}{session.scheduler_by_card_id}{session.next_due_at}{session.learning_acknowledged_at}{session.learning_server_sequence} learningSessions softbook_learning_sessions</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MutationQueueMetadataTextLeak.tsx").write_text(
            "export function MutationQueueMetadataTextLeak() {\n"
            "  return <Text>sync_daily_progress sync_space_state sync_learning_state</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MutationQueueMetadataPropLeak.tsx").write_text(
            "export function MutationQueueMetadataPropLeak() {\n"
            "  return <Pressable accessibilityHint=\"refresh_membership\" accessibilityLabel=\"start_membership_trial\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MutationQueueMetadataRenderedPropLeak.tsx").write_text(
            "export function MutationQueueMetadataRenderedPropLeak({ queue }) {\n"
            "  return <View testID={`__softbook_mutation_queue-${queue.retryCount}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeConfigMetadataTextLeak.tsx").write_text(
            "export function RuntimeConfigMetadataTextLeak({ config }) {\n"
            "  return <Text>{config.apiKey}{config.remoteConfig}{config.entitlementEndpoint}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeConfigMetadataPropLeak.tsx").write_text(
            "export function RuntimeConfigMetadataPropLeak({ config }) {\n"
            "  return <Pressable accessibilityHint={config.requestCodeEndpoint} accessibilityLabel={`${config.verifyCodeEndpoint}-${config.dismissRecoveryEndpoint}-${config.purchaseEndpoint}-${config.startTrialEndpoint}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeConfigMetadataRenderedPropLeak.tsx").write_text(
            "export function RuntimeConfigMetadataRenderedPropLeak({ config }) {\n"
            "  return <View testID={`${config.baseUrl}-${config.apiKeyHeader}-${config.trackQueryParam}-__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__-SOFTBOOK_CET_REMOTE_BASE_URL-SOFTBOOK_CET_REMOTE_API_KEY-SOFTBOOK_CET_LEARNING_TRACK`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeProfileMetadataTextLeak.tsx").write_text(
            "export function RuntimeProfileMetadataTextLeak({ profile }) {\n"
            "  return <Text>{profile.learningSource}{profile.progressSync}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeProfileMetadataPropLeak.tsx").write_text(
            "export function RuntimeProfileMetadataPropLeak({ profile }) {\n"
            "  return <Pressable accessibilityHint={profile.spaceState} accessibilityLabel={`${profile.learningState}-${profile.learningTrack}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeProfileMetadataRenderedPropLeak.tsx").write_text(
            "export function RuntimeProfileMetadataRenderedPropLeak({ profile }) {\n"
            "  return <View testID={`${profile.featureModes}-${profile.learningTrack}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/LocalRuntimeFeaturesMetadataTextLeak.tsx").write_text(
            "export function LocalRuntimeFeaturesMetadataTextLeak() {\n"
            "  return <Text>SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/LocalRuntimeFeaturesMetadataPropLeak.tsx").write_text(
            "export function LocalRuntimeFeaturesMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/LocalRuntimeFeaturesMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function LocalRuntimeFeaturesMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/LocalRuntimeFeaturesInternalErrorNoLeak.ts").write_text(
            "export function parseLocalRuntimeFeature(feature) {\n"
            "  throw new Error(`Unknown SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES value: ${feature}.`);\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeConfigGlobalMetadataTextLeak.tsx").write_text(
            "export function RuntimeConfigGlobalMetadataTextLeak() {\n"
            "  return <Text>__SOFTBOOK_CET_RUNTIME_CONFIG__</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeConfigGlobalMetadataPropLeak.tsx").write_text(
            "export function RuntimeConfigGlobalMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"__SOFTBOOK_CET_RUNTIME_CONFIG__\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/RuntimeConfigGlobalMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function RuntimeConfigGlobalMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"__SOFTBOOK_CET_RUNTIME_CONFIG__\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeAuthEnvMetadataTextLeak.tsx").write_text(
            "export function SmokeAuthEnvMetadataTextLeak() {\n"
            "  return <Text>SOFTBOOK_CET_AUTH_TOKEN SOFTBOOK_CET_TEST_PHONE</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeAuthEnvMetadataPropLeak.tsx").write_text(
            "export function SmokeAuthEnvMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"SOFTBOOK_CET_TEST_CODE\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeAuthEnvMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeAuthEnvMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"SOFTBOOK_CET_AUTH_TOKEN\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeControlEnvMetadataTextLeak.tsx").write_text(
            "export function SmokeControlEnvMetadataTextLeak() {\n"
            "  return <Text>SOFTBOOK_CET_SMOKE_ISOLATED_PHONE SOFTBOOK_CET_SMOKE_WRITE SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeControlEnvMetadataPropLeak.tsx").write_text(
            "export function SmokeControlEnvMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"SOFTBOOK_CET_EXPECT_INITIAL_STAGE SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE SOFTBOOK_CET_EXPECT_PURCHASE_STAGE\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeControlEnvMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeControlEnvMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"SOFTBOOK_CET_SMOKE_ISOLATED_PHONE\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosLaunchEnvMetadataTextLeak.tsx").write_text(
            "export function IosLaunchEnvMetadataTextLeak() {\n"
            "  return <Text>SOFTBOOK_CET_IOS_LAUNCH SOFTBOOK_CET_IOS_DEVICE SOFTBOOK_CET_IOS_SIMULATOR</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosLaunchEnvMetadataPropLeak.tsx").write_text(
            "export function IosLaunchEnvMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"SOFTBOOK_CET_IOS_BUNDLE_ID SOFTBOOK_CET_METRO_PORT SOFTBOOK_CET_STOP_METRO_ON_EXIT\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosLaunchEnvMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function IosLaunchEnvMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"SOFTBOOK_CET_IOS_LAUNCH\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosMaestroEnvMetadataTextLeak.tsx").write_text(
            "export function IosMaestroEnvMetadataTextLeak() {\n"
            "  return <Text>SOFTBOOK_CET_MANUAL_TEST_PHONE SOFTBOOK_CET_MAESTRO_PHONE</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosMaestroEnvMetadataPropLeak.tsx").write_text(
            "export function IosMaestroEnvMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"SOFTBOOK_CET_MAESTRO_CODE\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosMaestroEnvMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function IosMaestroEnvMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"SOFTBOOK_CET_IOS_MAESTRO_FLOW\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosSmokeLocalEnvMetadataTextLeak.tsx").write_text(
            "export function IosSmokeLocalEnvMetadataTextLeak() {\n"
            "  return <Text>IOS_SIMULATOR METRO_PORT SMS_CODE</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosSmokeLocalEnvMetadataPropLeak.tsx").write_text(
            "export function IosSmokeLocalEnvMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"MANUAL_TEST_PHONE MAESTRO_FLOW IOS_DEVICE\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/IosSmokeLocalEnvMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function IosSmokeLocalEnvMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"IOS_BUNDLE_ID STOP_METRO_ON_EXIT MAESTRO_CODE MAESTRO_PHONE\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRuntimeLocalMetadataTextLeak.tsx").write_text(
            "export function BackendRuntimeLocalMetadataTextLeak() {\n"
            "  return <Text>SOFTBOOK_API_KEY SOFTBOOK_SMS_DEV_CODE SOFTBOOK_AUTH_TOKEN_SECRET SOFTBOOK_STORE_MODE</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRuntimeLocalMetadataPropLeak.tsx").write_text(
            "export function BackendRuntimeLocalMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"CLOUDBASE_ENV_ID TCB_ENV SCF_NAMESPACE DEFAULT_SMS_CODE DEFAULT_TRIAL_DURATION_DAYS DEFAULT_CARD_SOURCE\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRuntimeLocalMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendRuntimeLocalMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"SOFTBOOK_AUTH_TOKEN_TTL_SECONDS CLOUDBASE_COLLECTIONS DEFAULT_TOKEN_TTL_SECONDS\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCollectionMetadataTextLeak.tsx").write_text(
            "export function BackendCollectionMetadataTextLeak() {\n"
            "  return <Text>cardSources dailyCheckIns dailyProgress learningStates</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCollectionMetadataPropLeak.tsx").write_text(
            "export function BackendCollectionMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"softbook_card_sources softbook_daily_check_ins softbook_daily_progress softbook_learning_states\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCollectionMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendCollectionMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"memberships spaceStates softbook_memberships softbook_space_states\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendStoreMethodMetadataTextLeak.tsx").write_text(
            "export function BackendStoreMethodMetadataTextLeak() {\n"
            "  return <Text>getCardSource getMembership checkInDailyProgress assertLegacySnapshotWritesDisabled saveDailyProgress</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendStoreMethodMetadataPropLeak.tsx").write_text(
            "export function BackendStoreMethodMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"startTrial dismissRecovery\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendStoreMethodMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendStoreMethodMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"saveLearningState saveSpaceState\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendDocumentFieldMetadataTextLeak.tsx").write_text(
            "export function BackendDocumentFieldMetadataTextLeak() {\n"
            "  return <Text>acknowledged_at updated_at</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendDocumentFieldMetadataPropLeak.tsx").write_text(
            "export function BackendDocumentFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"events_by_card_id server_sequence\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendDocumentFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendDocumentFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"states_by_card_id\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendDocumentLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendDocumentLocalFieldMetadataTextLeak() {\n"
            "  return <Text>documentId eventsByCardId</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendDocumentLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendDocumentLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"statesByCardId\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendDocumentLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendDocumentLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"documentId-statesByCardId\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendErrorCodeMetadataTextLeak.tsx").write_text(
            "export function BackendErrorCodeMetadataTextLeak() {\n"
            "  return <Text>not_found invalid_api_key invalid_sms_code invalid_track</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendErrorCodeMetadataPropLeak.tsx").write_text(
            "export function BackendErrorCodeMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"DOCUMENT_NOT_EXIST invalid_card_source missing_auth_token invalid_auth_token expired_auth_token\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendErrorCodeMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendErrorCodeMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"phone_number_mismatch internal_error invalid_request invalid_json\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendResponseFieldMetadataTextLeak.tsx").write_text(
            "export function BackendResponseFieldMetadataTextLeak() {\n"
            "  return <Text>dev_fixed_code isBase64Encoded</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendResponseFieldMetadataPropLeak.tsx").write_text(
            "export function BackendResponseFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"tokenSecret tokenTtlSeconds\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendResponseFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendResponseFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"dev_fixed_code-tokenSecret\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendTokenLocalFieldMetadataTextLeak() {\n"
            "  return <Text>issuedAt encodedPayload</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendTokenLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"expectedSignature\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendTokenLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"encodedPayload-expectedSignature\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenBufferMetadataTextLeak.tsx").write_text(
            "export function BackendTokenBufferMetadataTextLeak() {\n"
            "  return <Text>leftBuffer rightBuffer</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenBufferMetadataPropLeak.tsx").write_text(
            "export function BackendTokenBufferMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"leftBuffer\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenBufferMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendTokenBufferMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"leftBuffer-rightBuffer\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendMembershipEnumMetadataTextLeak.tsx").write_text(
            "export function BackendMembershipEnumMetadataTextLeak() {\n"
            "  return <Text>trial_available</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendMembershipEnumMetadataPropLeak.tsx").write_text(
            "export function BackendMembershipEnumMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"trial_available\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendMembershipEnumMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendMembershipEnumMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"trial_available\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardPayloadFieldMetadataTextLeak.tsx").write_text(
            "export function BackendCardPayloadFieldMetadataTextLeak() {\n"
            "  return <Text>lock_slots elimination_items</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardPayloadFieldMetadataPropLeak.tsx").write_text(
            "export function BackendCardPayloadFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"swipe_states\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardPayloadFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendCardPayloadFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"lock_slots-swipe_states\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendInteractionLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendInteractionLocalFieldMetadataTextLeak() {\n"
            "  return <Text>optionIds lockSlots</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendInteractionLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendInteractionLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"eliminationItems swipeStates\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendInteractionLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendInteractionLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"optionIds-swipeStates\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardShapeLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendCardShapeLocalFieldMetadataTextLeak() {\n"
            "  return <Text>defaultCardSource expectedTrack</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardShapeLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendCardShapeLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"hintLayer\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardShapeLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendCardShapeLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"defaultCardSource-hintLayer\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRequestFieldMetadataTextLeak.tsx").write_text(
            "export function BackendRequestFieldMetadataTextLeak() {\n"
            "  return <Text>headers pathname</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRequestFieldMetadataPropLeak.tsx").write_text(
            "export function BackendRequestFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"headers pathname\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRequestFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendRequestFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"headers-pathname\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendEventAdapterLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendEventAdapterLocalFieldMetadataTextLeak() {\n"
            "  return <Text>httpMethod rawPath rawQueryString</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendEventAdapterLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendEventAdapterLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"queryStringParameters\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendEventAdapterLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendEventAdapterLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"v1Index-queryString\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendHttpLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendHttpLocalFieldMetadataTextLeak() {\n"
            "  return <Text>fieldName statusCode</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendHttpLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendHttpLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"requestContext\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendHttpLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendHttpLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"fieldName-statusCode\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendConfigLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendConfigLocalFieldMetadataTextLeak() {\n"
            "  return <Text>defaultApi overrideValue</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendConfigLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendConfigLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"envValue storeMode\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendConfigLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendConfigLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"defaultApi-storeMode\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRouteHelperMetadataTextLeak.tsx").write_text(
            "export function BackendRouteHelperMetadataTextLeak() {\n"
            "  return <Text>getDefaultApi createSoftbookApi handleCloudBaseEvent</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRouteHelperMetadataPropLeak.tsx").write_text(
            "export function BackendRouteHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"handleHttpRequest handleRequestCode\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRouteHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendRouteHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"handleVerifyCode handleLearningCardSource\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendHttpHelperMetadataTextLeak.tsx").write_text(
            "export function BackendHttpHelperMetadataTextLeak() {\n"
            "  return <Text>sendJson httpError</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendHttpHelperMetadataPropLeak.tsx").write_text(
            "export function BackendHttpHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"getHeader verifyAuthToken\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendHttpHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendHttpHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"createAuthToken verifyAuthToken\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendValidatorHelperMetadataTextLeak.tsx").write_text(
            "export function BackendValidatorHelperMetadataTextLeak() {\n"
            "  return <Text>requireArray requirePhoneNumber requireBoolean</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendValidatorHelperMetadataPropLeak.tsx").write_text(
            "export function BackendValidatorHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"requireIsoTimestamp requirePhoneNumber\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendValidatorHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendValidatorHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"requireObjectBody requireObject\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRequestValidationHelperMetadataTextLeak.tsx").write_text(
            "export function BackendRequestValidationHelperMetadataTextLeak() {\n"
            "  return <Text>requireAuthSession requireNonEmptyString requireDayKey</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRequestValidationHelperMetadataPropLeak.tsx").write_text(
            "export function BackendRequestValidationHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"requireNonNegativeInteger requireInteractionId requireLearningOutcome\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendRequestValidationHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendRequestValidationHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"requireEnum parseJson\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenHelperMetadataTextLeak.tsx").write_text(
            "export function BackendTokenHelperMetadataTextLeak() {\n"
            "  return <Text>resolveTokenTtlSeconds isApiKeyAllowed safeEqual</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenHelperMetadataPropLeak.tsx").write_text(
            "export function BackendTokenHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"assertBodyPhoneMatchesSession base64UrlDecode\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendTokenHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendTokenHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"signTokenPayload base64UrlEncode\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendSyncSnapshotMetadataTextLeak.tsx").write_text(
            "export function BackendSyncSnapshotMetadataTextLeak() {\n"
            "  return <Text>parseDailyProgressSnapshot parseLearningStateSnapshot</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendSyncSnapshotMetadataPropLeak.tsx").write_text(
            "export function BackendSyncSnapshotMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"parseSpaceStateSnapshot\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendSyncSnapshotMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendSyncSnapshotMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"acknowledgedResponse\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendSyncLocalFieldMetadataTextLeak.tsx").write_text(
            "export function BackendSyncLocalFieldMetadataTextLeak() {\n"
            "  return <Text>eventObject stateObject</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendSyncLocalFieldMetadataPropLeak.tsx").write_text(
            "export function BackendSyncLocalFieldMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"stateObject\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendSyncLocalFieldMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendSyncLocalFieldMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"eventObject-stateObject\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendEventAdapterMetadataTextLeak.tsx").write_text(
            "export function BackendEventAdapterMetadataTextLeak() {\n"
            "  return <Text>parseCloudBaseEvent parseEventBody normalizeApiPath</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendEventAdapterMetadataPropLeak.tsx").write_text(
            "export function BackendEventAdapterMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"normalizeHeaders normalizeQuery parseQueryString\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendEventAdapterMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendEventAdapterMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"toCloudBaseResponse jsonResponse errorResponse\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendStoreHelperMetadataTextLeak.tsx").write_text(
            "export function BackendStoreHelperMetadataTextLeak() {\n"
            "  return <Text>createDefaultStore createMemoryStore createCloudBaseStore createCloudBaseDatabase</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendStoreHelperMetadataPropLeak.tsx").write_text(
            "export function BackendStoreHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"getCloudBaseMembership saveCloudBaseMembership deserializeMembershipDocument getCloudBaseDocument\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendStoreHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendStoreHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"setCloudBaseDocument isCloudBaseDocumentMissingError createCloudBaseDocumentId\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendMembershipHelperMetadataTextLeak.tsx").write_text(
            "export function BackendMembershipHelperMetadataTextLeak() {\n"
            "  return <Text>createInitialMembership cloneMembership</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendMembershipHelperMetadataPropLeak.tsx").write_text(
            "export function BackendMembershipHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"serializeMembershipEntitlement\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendMembershipHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendMembershipHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"cloneMembership serializeMembershipEntitlement\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardRecordSourceMetadataTextLeak.tsx").write_text(
            "export function BackendCardRecordSourceMetadataTextLeak() {\n"
            "  return <Text>getCardRecordsForTrack CET4_CARD_RECORDS</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardRecordSourceMetadataPropLeak.tsx").write_text(
            "export function BackendCardRecordSourceMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"CET6_CARD_RECORDS\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardRecordSourceMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendCardRecordSourceMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"getCardRecordsForTrack CET4_CARD_RECORDS CET6_CARD_RECORDS\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardSourceHelperMetadataTextLeak.tsx").write_text(
            "export function BackendCardSourceHelperMetadataTextLeak() {\n"
            "  return <Text>createDefaultCardSource cloneCardSource serializeCardSourceResponse validateCardSourceForImport</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardSourceHelperMetadataPropLeak.tsx").write_text(
            "export function BackendCardSourceHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"normalizeCardSource normalizeCardRecord requireCardSourceObject requireCardSourceArray requireCardSourceString\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BackendCardSourceHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function BackendCardSourceHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"requireCardSourcePattern requireCardSourceTrack cardSourceError cloneJson\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CloudbaseScriptLocalMetadataTextLeak.tsx").write_text(
            "export function CloudbaseScriptLocalMetadataTextLeak() {\n"
            "  return <Text>DEFAULT_ENV_ID COLLECTION_NAME DEFAULT_TRACKS</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CloudbaseScriptLocalMetadataPropLeak.tsx").write_text(
            "export function CloudbaseScriptLocalMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"ENV_ID DEFAULT_OUTPUT DEFAULT_FLOW_DIR\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CloudbaseScriptLocalMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function CloudbaseScriptLocalMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"FUNCTION_NAME HTTP_PATH\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeRuntimeLocalMetadataTextLeak.tsx").write_text(
            "export function SmokeRuntimeLocalMetadataTextLeak() {\n"
            "  return <Text>useIsolatedPhone authTokenFromEnv</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeRuntimeLocalMetadataPropLeak.tsx").write_text(
            "export function SmokeRuntimeLocalMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"expectedInitialStage expectedStartTrialStage expectedPurchaseStage\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeRuntimeLocalMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeRuntimeLocalMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"enableWrites enableMembershipMutations\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeRuntimeOutputMetadataTextLeak.tsx").write_text(
            "export function SmokeRuntimeOutputMetadataTextLeak() {\n"
            "  return <Text>authHeaders remoteHeaders</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeRuntimeOutputMetadataPropLeak.tsx").write_text(
            "export function SmokeRuntimeOutputMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"REQUIRED_CORE_INTERACTIONS\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeRuntimeOutputMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeRuntimeOutputMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"returnedPhoneNumber missingInteractions\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeCardShapeMetadataTextLeak.tsx").write_text(
            "export function SmokeCardShapeMetadataTextLeak() {\n"
            "  return <Text>validateCardRecord assertPattern assertTrack</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeCardShapeMetadataPropLeak.tsx").write_text(
            "export function SmokeCardShapeMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"assertCoreInteractionCoverage\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeCardShapeMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeCardShapeMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"assertArrayLength assertNonEmptyArray\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeEndpointHelperMetadataTextLeak.tsx").write_text(
            "export function SmokeEndpointHelperMetadataTextLeak() {\n"
            "  return <Text>loadMembershipEntitlement loadLearningCardSource</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeEndpointHelperMetadataPropLeak.tsx").write_text(
            "export function SmokeEndpointHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"loadLearningCardSource parseEntitlement\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeEndpointHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeEndpointHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"runMembershipMutation parseEntitlement\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeAssertionHelperMetadataTextLeak.tsx").write_text(
            "export function SmokeAssertionHelperMetadataTextLeak() {\n"
            "  return <Text>assertOk assertObject assertString</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeAssertionHelperMetadataPropLeak.tsx").write_text(
            "export function SmokeAssertionHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"assertNonNegativeInteger assertPositiveInteger\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeAssertionHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeAssertionHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"normalizeBaseUrl todayKey createIsolatedPhoneNumber\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeCardLocalMetadataTextLeak.tsx").write_text(
            "export function SmokeCardLocalMetadataTextLeak() {\n"
            "  return <Text>returnedTrack itemIds</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeCardLocalMetadataPropLeak.tsx").write_text(
            "export function SmokeCardLocalMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"firstCard itemIds\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeCardLocalMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeCardLocalMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"firstCard returnedTrack\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeMembershipHelperMetadataTextLeak.tsx").write_text(
            "export function SmokeMembershipHelperMetadataTextLeak() {\n"
            "  return <Text>startMembershipTrial purchaseMembership</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeMembershipHelperMetadataPropLeak.tsx").write_text(
            "export function SmokeMembershipHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"dismissMembershipRecovery expectedStage\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeMembershipHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeMembershipHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"assertExpectedStage expectedStage\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeActionHelperMetadataTextLeak.tsx").write_text(
            "export function SmokeActionHelperMetadataTextLeak() {\n"
            "  return <Text>requestSmsCode verifySmsCode syncDailyProgress</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeActionHelperMetadataPropLeak.tsx").write_text(
            "export function SmokeActionHelperMetadataPropLeak() {\n"
            "  return <Pressable accessibilityLabel=\"postJson syncSpaceState\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SmokeActionHelperMetadataStaticRenderedPropLeak.tsx").write_text(
            "export function SmokeActionHelperMetadataStaticRenderedPropLeak() {\n"
            "  return <View testID=\"syncLearningState syncSpaceState\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CardIdTextLeak.tsx").write_text(
            "export function CardIdTextLeak({ card }) {\n"
            "  return <Text>{card.card_id}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CamelCardIdPropLeak.tsx").write_text(
            "export function CamelCardIdPropLeak({ cardId }) {\n"
            "  return <Pressable accessibilityHint={cardId} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/CardIdHandlerNoLeak.tsx").write_text(
            "export function CardIdHandlerNoLeak({ card, isSleeping, onToggleSleepState }) {\n"
            "  return <ActionChip\n"
            "    label={isSleeping ? '移出休眠' : '放入休眠'}\n"
            "    onPress={() => onToggleSleepState(card.cardId)}\n"
            "  />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BracketSpaceTextLeak.tsx").write_text(
            "export function BracketSpaceTextLeak({ card }) {\n"
            "  return <Text>{card.space_metadata[\"box_ref\"]}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/NestedBracketSpaceTextLeak.tsx").write_text(
            "export function NestedBracketSpaceTextLeak({ card }) {\n"
            "  return <Text>{card[\"space_metadata\"][\"box_ref\"]}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/BracketSpacePropLeak.tsx").write_text(
            "export function BracketSpacePropLeak({ card }) {\n"
            "  return <Pressable accessibilityHint={card.space_metadata[\"box_ref\"]} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/OptionalBracketSpaceTextLeak.tsx").write_text(
            "export function OptionalBracketSpaceTextLeak({ card }) {\n"
            "  return <Text>{card.space_metadata?.[\"box_ref\"]}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/OptionalNestedBracketSpaceTextLeak.tsx").write_text(
            "export function OptionalNestedBracketSpaceTextLeak({ card }) {\n"
            "  return <Text>{card[\"space_metadata\"]?.[\"box_ref\"]}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/OptionalBracketSpacePropLeak.tsx").write_text(
            "export function OptionalBracketSpacePropLeak({ card }) {\n"
            "  return <Pressable accessibilityHint={card.space_metadata?.[\"box_ref\"]} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/AriaValueTextLeak.tsx").write_text(
            "export function AriaValueTextLeak({ card }) {\n"
            "  return <View aria-valuetext={card.sourceLabel} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/VisibleCopyLeak.ts").write_text(
            "export function visibleRows(card) {\n"
            "  return [{ label: card.groupName, text: card.space_metadata.box_ref }];\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/VisibleCopyKeyLeak.ts").write_text(
            "export function visibleMessages(card) {\n"
            "  return { description: card.groupName, message: card.space_metadata.box_ref };\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MultilineCopyLeak.tsx").write_text(
            "export function MultilineCopyLeak({ card }) {\n"
            "  return <Pressable accessibilityHint={\n"
            "    card.space_metadata.box_ref\n"
            "  } />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/TemplateCopyLeak.ts").write_text(
            "export function templateCopy(card) {\n"
            "  return { message: `学习位置 ${\n"
            "    card.groupName\n"
            "  }` };\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SourceMetadataCopyLeak.ts").write_text(
            "export function sourceCopy(card) {\n"
            "  return { message: card.source_label, description: card.sourceLabel, text: card.card_records };\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SourceTextNodeLeak.tsx").write_text(
            "export function SourceTextNodeLeak({ card }) {\n"
            "  return <Text>{card.sourceLabel}</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SourceTestIdLeak.tsx").write_text(
            "export function SourceTestIdLeak({ card }) {\n"
            "  return <View testID={`source-${card.sourceLabel}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SourceRenderedPropExpressionLeak.tsx").write_text(
            "export function SourceRenderedPropExpressionLeak({ card }) {\n"
            "  return <View testID={card.sourceLabel} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MultilineRenderedPropLeak.tsx").write_text(
            "export function MultilineRenderedPropLeak({ card }) {\n"
            "  return <View testID={\n"
            "    card.sourceLabel\n"
            "  } />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SourceNativeIdLeak.tsx").write_text(
            "export function SourceNativeIdLeak({ card }) {\n"
            "  return <View nativeID={`source-${card.sourceLabel}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SourceAccessibilityLabelledByLeak.tsx").write_text(
            "export function SourceAccessibilityLabelledByLeak({ card }) {\n"
            "  return <View accessibilityLabelledBy={`source-${card.sourceLabel}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/SourceAriaLabelledByLeak.tsx").write_text(
            "export function SourceAriaLabelledByLeak({ card }) {\n"
            "  return <View aria-labelledby={`source-${card.sourceLabel}`} />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/MultilineAriaLabelledByLeak.tsx").write_text(
            "export function MultilineAriaLabelledByLeak({ card }) {\n"
            "  return <View aria-labelledby={\n"
            "    card.sourceLabel\n"
            "  } />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/ProductLoginFixtureLeak.tsx").write_text(
            "export function ProductLoginFixtureLeak() {\n"
            "  return <Text>已登录 138****8000</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/ProductProgressFixtureLeak.tsx").write_text(
            "export function ProductProgressFixtureLeak() {\n"
            "  return <Text>第 1 张 / 共 7 张</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/ProductSpacePathFixtureLeak.tsx").write_text(
            "export function ProductSpacePathFixtureLeak() {\n"
            "  return <Text>这张在：馆 1 / 组 1 / 盒 1</Text>;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/ProductSpaceStateFixtureLeak.tsx").write_text(
            "export function ProductSpaceStateFixtureLeak() {\n"
            "  return <View accessibilityLabel=\"当前学习卡位于 当前地址\" />;\n"
            "}\n",
            encoding="utf-8",
        )
        (tmp_app_root / "src/learning/InternalError.ts").write_text(
            "export function failRemoteSync(status) {\n"
            "  throw new Error(`Remote debug sync failed with ${status}.`);\n"
            "}\n",
            encoding="utf-8",
        )
        metadata_scanner_fixture = context.run_validator(
            "apps/mobile/scripts/check-metadata-leaks.mjs",
            cwd=tmp_app_root,
        )
        metadata_scanner_output = (
            metadata_scanner_fixture.stdout + metadata_scanner_fixture.stderr
        )
        if metadata_scanner_fixture.returncode == 0:
            errors.append(
                "mobile metadata scanner must reject old Learning deck copy in visible TS sources"
            )
        for expected_snippet in [
            "src/learning/model.ts",
            "src/learning/AccessibilityLeak.tsx",
            "src/learning/AccessibilityLabelLeak.tsx",
            "src/learning/OptionalTextLeak.tsx",
            "src/learning/BareTextLeak.tsx",
            "src/learning/OptionalSpacePropLeak.tsx",
            "src/learning/DestructuredBoxRefTextLeak.tsx",
            "src/learning/DestructuredBoxRefPropLeak.tsx",
            "src/learning/KnowledgeRefTextLeak.tsx",
            "src/learning/DestructuredKnowledgeRefTextLeak.tsx",
            "src/learning/CamelKnowledgeRefPropLeak.tsx",
            "src/learning/InteractionIdTextLeak.tsx",
            "src/learning/CamelInteractionIdPropLeak.tsx",
            "src/learning/InteractionIdRenderedPropLeak.tsx",
            "src/learning/AnswerKeyTextLeak.tsx",
            "src/learning/CamelAnswerKeyPropLeak.tsx",
            "src/learning/DestructuredCorrectOptionTextLeak.tsx",
            "src/learning/CorrectStateRenderedPropLeak.tsx",
            "src/learning/AutoScoringTextLeak.tsx",
            "src/learning/CamelAutoScoringPropLeak.tsx",
            "src/learning/AutoScoringRenderedPropLeak.tsx",
            "src/learning/BoxCatalogMetadataTextLeak.tsx",
            "src/learning/CamelBoxCatalogMetadataPropLeak.tsx",
            "src/learning/BoxCatalogMetadataRenderedPropLeak.tsx",
            "src/learning/ResultSessionMetadataTextLeak.tsx",
            "src/learning/ResultSessionMetadataPropLeak.tsx",
            "src/learning/ResultSessionMetadataRenderedPropLeak.tsx",
            "src/learning/InteractionStateMetadataTextLeak.tsx",
            "src/learning/InteractionStateMetadataPropLeak.tsx",
            "src/learning/InteractionStateMetadataRenderedPropLeak.tsx",
            "src/learning/SyncPayloadMetadataTextLeak.tsx",
            "src/learning/SyncPayloadMetadataPropLeak.tsx",
            "src/learning/SyncPayloadMetadataRenderedPropLeak.tsx",
            "src/learning/MembershipPayloadMetadataTextLeak.tsx",
            "src/learning/MembershipPayloadMetadataPropLeak.tsx",
            "src/learning/MembershipPayloadMetadataRenderedPropLeak.tsx",
            "src/learning/CamelRuntimeBookkeepingMetadataTextLeak.tsx",
            "src/learning/CamelRuntimeBookkeepingMetadataPropLeak.tsx",
            "src/learning/CamelRuntimeBookkeepingMetadataRenderedPropLeak.tsx",
            "src/learning/LearningEventMetadataTextLeak.tsx",
            "src/learning/LearningEventMetadataPropLeak.tsx",
            "src/learning/LearningEventMetadataRenderedPropLeak.tsx",
            "src/learning/SchedulerMetadataLeak.tsx",
            "src/learning/MutationQueueMetadataTextLeak.tsx",
            "src/learning/MutationQueueMetadataPropLeak.tsx",
            "src/learning/MutationQueueMetadataRenderedPropLeak.tsx",
            "src/learning/RuntimeConfigMetadataTextLeak.tsx",
            "src/learning/RuntimeConfigMetadataPropLeak.tsx",
            "src/learning/RuntimeConfigMetadataRenderedPropLeak.tsx",
            "src/learning/RuntimeProfileMetadataTextLeak.tsx",
            "src/learning/RuntimeProfileMetadataPropLeak.tsx",
            "src/learning/RuntimeProfileMetadataRenderedPropLeak.tsx",
            "src/learning/LocalRuntimeFeaturesMetadataTextLeak.tsx",
            "src/learning/LocalRuntimeFeaturesMetadataPropLeak.tsx",
            "src/learning/LocalRuntimeFeaturesMetadataStaticRenderedPropLeak.tsx",
            "src/learning/RuntimeConfigGlobalMetadataTextLeak.tsx",
            "src/learning/RuntimeConfigGlobalMetadataPropLeak.tsx",
            "src/learning/RuntimeConfigGlobalMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeAuthEnvMetadataTextLeak.tsx",
            "src/learning/SmokeAuthEnvMetadataPropLeak.tsx",
            "src/learning/SmokeAuthEnvMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeControlEnvMetadataTextLeak.tsx",
            "src/learning/SmokeControlEnvMetadataPropLeak.tsx",
            "src/learning/SmokeControlEnvMetadataStaticRenderedPropLeak.tsx",
            "src/learning/IosLaunchEnvMetadataTextLeak.tsx",
            "src/learning/IosLaunchEnvMetadataPropLeak.tsx",
            "src/learning/IosLaunchEnvMetadataStaticRenderedPropLeak.tsx",
            "src/learning/IosMaestroEnvMetadataTextLeak.tsx",
            "src/learning/IosMaestroEnvMetadataPropLeak.tsx",
            "src/learning/IosMaestroEnvMetadataStaticRenderedPropLeak.tsx",
            "src/learning/IosSmokeLocalEnvMetadataTextLeak.tsx",
            "src/learning/IosSmokeLocalEnvMetadataPropLeak.tsx",
            "src/learning/IosSmokeLocalEnvMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendRuntimeLocalMetadataTextLeak.tsx",
            "src/learning/BackendRuntimeLocalMetadataPropLeak.tsx",
            "src/learning/BackendRuntimeLocalMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendCollectionMetadataTextLeak.tsx",
            "src/learning/BackendCollectionMetadataPropLeak.tsx",
            "src/learning/BackendCollectionMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendStoreMethodMetadataTextLeak.tsx",
            "src/learning/BackendStoreMethodMetadataPropLeak.tsx",
            "src/learning/BackendStoreMethodMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendDocumentFieldMetadataTextLeak.tsx",
            "src/learning/BackendDocumentFieldMetadataPropLeak.tsx",
            "src/learning/BackendDocumentFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendDocumentLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendDocumentLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendDocumentLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendErrorCodeMetadataTextLeak.tsx",
            "src/learning/BackendErrorCodeMetadataPropLeak.tsx",
            "src/learning/BackendErrorCodeMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendResponseFieldMetadataTextLeak.tsx",
            "src/learning/BackendResponseFieldMetadataPropLeak.tsx",
            "src/learning/BackendResponseFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendTokenLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendTokenLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendTokenLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendTokenBufferMetadataTextLeak.tsx",
            "src/learning/BackendTokenBufferMetadataPropLeak.tsx",
            "src/learning/BackendTokenBufferMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendMembershipEnumMetadataTextLeak.tsx",
            "src/learning/BackendMembershipEnumMetadataPropLeak.tsx",
            "src/learning/BackendMembershipEnumMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendCardPayloadFieldMetadataTextLeak.tsx",
            "src/learning/BackendCardPayloadFieldMetadataPropLeak.tsx",
            "src/learning/BackendCardPayloadFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendInteractionLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendInteractionLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendInteractionLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendCardShapeLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendCardShapeLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendCardShapeLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendRequestFieldMetadataTextLeak.tsx",
            "src/learning/BackendRequestFieldMetadataPropLeak.tsx",
            "src/learning/BackendRequestFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendEventAdapterLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendEventAdapterLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendEventAdapterLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendHttpLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendHttpLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendHttpLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendConfigLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendConfigLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendConfigLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendRouteHelperMetadataTextLeak.tsx",
            "src/learning/BackendRouteHelperMetadataPropLeak.tsx",
            "src/learning/BackendRouteHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendHttpHelperMetadataTextLeak.tsx",
            "src/learning/BackendHttpHelperMetadataPropLeak.tsx",
            "src/learning/BackendHttpHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendValidatorHelperMetadataTextLeak.tsx",
            "src/learning/BackendValidatorHelperMetadataPropLeak.tsx",
            "src/learning/BackendValidatorHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendRequestValidationHelperMetadataTextLeak.tsx",
            "src/learning/BackendRequestValidationHelperMetadataPropLeak.tsx",
            "src/learning/BackendRequestValidationHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendTokenHelperMetadataTextLeak.tsx",
            "src/learning/BackendTokenHelperMetadataPropLeak.tsx",
            "src/learning/BackendTokenHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendSyncSnapshotMetadataTextLeak.tsx",
            "src/learning/BackendSyncSnapshotMetadataPropLeak.tsx",
            "src/learning/BackendSyncSnapshotMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendSyncLocalFieldMetadataTextLeak.tsx",
            "src/learning/BackendSyncLocalFieldMetadataPropLeak.tsx",
            "src/learning/BackendSyncLocalFieldMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendEventAdapterMetadataTextLeak.tsx",
            "src/learning/BackendEventAdapterMetadataPropLeak.tsx",
            "src/learning/BackendEventAdapterMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendStoreHelperMetadataTextLeak.tsx",
            "src/learning/BackendStoreHelperMetadataPropLeak.tsx",
            "src/learning/BackendStoreHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendMembershipHelperMetadataTextLeak.tsx",
            "src/learning/BackendMembershipHelperMetadataPropLeak.tsx",
            "src/learning/BackendMembershipHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendCardRecordSourceMetadataTextLeak.tsx",
            "src/learning/BackendCardRecordSourceMetadataPropLeak.tsx",
            "src/learning/BackendCardRecordSourceMetadataStaticRenderedPropLeak.tsx",
            "src/learning/BackendCardSourceHelperMetadataTextLeak.tsx",
            "src/learning/BackendCardSourceHelperMetadataPropLeak.tsx",
            "src/learning/BackendCardSourceHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/CloudbaseScriptLocalMetadataTextLeak.tsx",
            "src/learning/CloudbaseScriptLocalMetadataPropLeak.tsx",
            "src/learning/CloudbaseScriptLocalMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeRuntimeLocalMetadataTextLeak.tsx",
            "src/learning/SmokeRuntimeLocalMetadataPropLeak.tsx",
            "src/learning/SmokeRuntimeLocalMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeRuntimeOutputMetadataTextLeak.tsx",
            "src/learning/SmokeRuntimeOutputMetadataPropLeak.tsx",
            "src/learning/SmokeRuntimeOutputMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeCardShapeMetadataTextLeak.tsx",
            "src/learning/SmokeCardShapeMetadataPropLeak.tsx",
            "src/learning/SmokeCardShapeMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeEndpointHelperMetadataTextLeak.tsx",
            "src/learning/SmokeEndpointHelperMetadataPropLeak.tsx",
            "src/learning/SmokeEndpointHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeAssertionHelperMetadataTextLeak.tsx",
            "src/learning/SmokeAssertionHelperMetadataPropLeak.tsx",
            "src/learning/SmokeAssertionHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeCardLocalMetadataTextLeak.tsx",
            "src/learning/SmokeCardLocalMetadataPropLeak.tsx",
            "src/learning/SmokeCardLocalMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeMembershipHelperMetadataTextLeak.tsx",
            "src/learning/SmokeMembershipHelperMetadataPropLeak.tsx",
            "src/learning/SmokeMembershipHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/SmokeActionHelperMetadataTextLeak.tsx",
            "src/learning/SmokeActionHelperMetadataPropLeak.tsx",
            "src/learning/SmokeActionHelperMetadataStaticRenderedPropLeak.tsx",
            "src/learning/CardIdTextLeak.tsx",
            "src/learning/CamelCardIdPropLeak.tsx",
            "src/learning/BracketSpaceTextLeak.tsx",
            "src/learning/NestedBracketSpaceTextLeak.tsx",
            "src/learning/BracketSpacePropLeak.tsx",
            "src/learning/OptionalBracketSpaceTextLeak.tsx",
            "src/learning/OptionalNestedBracketSpaceTextLeak.tsx",
            "src/learning/OptionalBracketSpacePropLeak.tsx",
            "src/learning/AriaValueTextLeak.tsx",
            "src/learning/VisibleCopyLeak.ts",
            "src/learning/VisibleCopyKeyLeak.ts",
            "src/learning/MultilineCopyLeak.tsx",
            "src/learning/TemplateCopyLeak.ts",
            "src/learning/SourceMetadataCopyLeak.ts",
            "src/learning/SourceTextNodeLeak.tsx",
            "src/learning/SourceTestIdLeak.tsx",
            "src/learning/SourceRenderedPropExpressionLeak.tsx",
            "src/learning/MultilineRenderedPropLeak.tsx",
            "src/learning/SourceNativeIdLeak.tsx",
            "src/learning/SourceAccessibilityLabelledByLeak.tsx",
            "src/learning/SourceAriaLabelledByLeak.tsx",
            "src/learning/MultilineAriaLabelledByLeak.tsx",
            "src/learning/ProductLoginFixtureLeak.tsx",
            "src/learning/ProductProgressFixtureLeak.tsx",
            "src/learning/ProductSpacePathFixtureLeak.tsx",
            "src/learning/ProductSpaceStateFixtureLeak.tsx",
            "src/shared/uiMetadata/displayMetadata.ts",
            "src/space/spaceMetadataDisplay.ts",
            "raw metadata leaked in Text display node",
            "raw metadata embedded in rendered element props",
            "raw metadata passed through visible or accessibility copy prop",
            "raw metadata embedded in static rendered element props",
            "raw metadata passed through multiline visible or accessibility copy prop",
            "raw metadata passed through multiline rendered element prop",
            "raw metadata leaked through visible copy source",
            "product-facing metadata or fixture state leaked in visible copy",
        ]:
            if expected_snippet not in metadata_scanner_output:
                errors.append(
                    "mobile metadata scanner visible TS fixture missing expected output: "
                    + expected_snippet
                )
        if "src/learning/CardIdHandlerNoLeak.tsx" in metadata_scanner_output:
            errors.append(
                "mobile metadata scanner must not treat cardId event handlers after closed label props as visible copy"
            )
        for unexpected_snippet in [
            "src/learning/InteractionLabelLookupNoLeak.tsx",
            "src/learning/InteractionLabelPropNoLeak.tsx",
        ]:
            if unexpected_snippet in metadata_scanner_output:
                errors.append(
                    "mobile metadata scanner must allow interaction id display label lookup: "
                    + unexpected_snippet
                )
        if "src/learning/LocalRuntimeFeaturesInternalErrorNoLeak.ts" in metadata_scanner_output:
            errors.append(
                "mobile metadata scanner must not treat internal local runtime feature errors as visible copy"
            )
