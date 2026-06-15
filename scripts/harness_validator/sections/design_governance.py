design_harness_text = (ROOT / "docs/design/design-harness.md").read_text(encoding="utf-8")
for snippet in [
    "### Design Evolution Engine",
    "generate candidate population",
    "pairwise-rank surviving candidates",
    "harvest strongest fragments",
    "targeted mutation",
    "docs/design/search-runs/README.md",
    "### Design Quarantine Harness",
    "docs/design/design-quarantine.md",
    "### Single-Card UX Contract Gate",
    "docs/design/single-card-ux-contract.md",
]:
    check_contains("design harness evolution engine", design_harness_text, snippet)

design_quarantine_text = (ROOT / "docs/design/design-quarantine.md").read_text(encoding="utf-8")
for snippet in [
    "Any design artifact that leaks such metadata is not design authority.",
    "accepted_authority",
    "candidate_exploration",
    "quarantined",
    "rejected",
    "agent",
    "harness",
    "validator",
    "runtime contract",
    "raw exception names",
    "Implementation PRs must not consume quarantined artifacts.",
]:
    check_contains("design quarantine contract", design_quarantine_text, snippet)

single_card_ux_text = (ROOT / "docs/design/single-card-ux-contract.md").read_text(encoding="utf-8")
for snippet in [
    "Single-card flow means the learner works through one current CET card",
    "It does not mean every control, explanation, statistic, navigation option, and state must fit into one static screen.",
    "current_card",
    "primary_task",
    "primary_action",
    "feedback_state",
    "escape_or_recovery",
    "space_continuity",
    "the current task and primary action are always findable",
]:
    check_contains("single-card UX contract", single_card_ux_text, snippet)

visual_language_text = (ROOT / "spec/visual-language.json").read_text(encoding="utf-8")
for snippet in [
    "user_visible_metadata_leakage_is_blocker",
    "single_card_flow_is_operable_focused_flow",
    "VL-AP-10",
    "VL-AP-11",
    "docs/design/design-quarantine.md",
    "docs/design/single-card-ux-contract.md",
]:
    check_contains("visual language quarantine and single-card gate", visual_language_text, snippet)

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
    "parseEntitlement",
    "assertOk",
    "assertObject",
    "assertString",
    "assertNonNegativeInteger",
    "assertPositiveInteger",
    "normalizeBaseUrl",
    "todayKey",
    "createIsolatedPhoneNumber",
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

fixture_parent = ROOT / ".tmp" / "harness-validator"
fixture_parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(
    prefix="metadata-scanner-visible-ts-",
    dir=fixture_parent,
) as tmp_dir:
    tmp_app_root = Path(tmp_dir)
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
        "  return <Text>{payload.auth_token}{payload.phone_number}{payload.completed_at}{payload.used_hint}</Text>;\n"
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
        "  return <Text>{session.authToken}{snapshot.acknowledgedAt}</Text>;\n"
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
    (tmp_app_root / "src/learning/InternalError.ts").write_text(
        "export function failRemoteSync(status) {\n"
        "  throw new Error(`Remote debug sync failed with ${status}.`);\n"
        "}\n",
        encoding="utf-8",
    )
    metadata_scanner_fixture = subprocess.run(
        ["node", str(ROOT / "apps/mobile/scripts/check-metadata-leaks.mjs")],
        cwd=tmp_app_root,
        capture_output=True,
        text=True,
        check=False,
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
        "src/shared/uiMetadata/displayMetadata.ts",
        "src/space/spaceMetadataDisplay.ts",
        "raw metadata leaked in Text display node",
        "raw metadata embedded in rendered element props",
        "raw metadata passed through visible or accessibility copy prop",
        "raw metadata embedded in static rendered element props",
        "raw metadata passed through multiline visible or accessibility copy prop",
        "raw metadata passed through multiline rendered element prop",
        "raw metadata leaked through visible copy source",
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
    "parseEntitlement",
    "assertOk",
    "assertObject",
    "assertString",
    "assertNonNegativeInteger",
    "assertPositiveInteger",
    "normalizeBaseUrl",
    "todayKey",
    "createIsolatedPhoneNumber",
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

with tempfile.TemporaryDirectory(
    prefix="metadata-leak-fixture-",
    dir=ROOT / "docs/design/mocks",
) as tmp_dir:
    fixture_html = Path(tmp_dir) / "visible-process-leak.html"
    fixture_html.write_text(
        "<!doctype html><html><body><p>R&#117;ntime deb&#117;g payload visible to learner.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_snake_visible_html = Path(tmp_dir) / "snake-process-visible-leak.html"
    fixture_snake_visible_html.write_text(
        "<!doctype html><html><body><p>runtime_debug_payload</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_camel_visible_html = Path(tmp_dir) / "camel-process-visible-leak.html"
    fixture_camel_visible_html.write_text(
        "<!doctype html><html><body><p>runtimeDebugPayload visible to learner.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_camel_metadata_html = Path(tmp_dir) / "camel-metadata-visible-leak.html"
    fixture_camel_metadata_html.write_text(
        "<!doctype html><html><body><p>sourceLabel and boxRef are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_card_id_html = Path(tmp_dir) / "card-id-metadata-visible-leak.html"
    fixture_card_id_html.write_text(
        "<!doctype html><html><body><p>card_id and cardId are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_interaction_id_html = Path(tmp_dir) / "interaction-id-metadata-visible-leak.html"
    fixture_interaction_id_html.write_text(
        "<!doctype html><html><body><p>interaction_id and interactionId are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_answer_key_html = Path(tmp_dir) / "answer-key-metadata-visible-leak.html"
    fixture_answer_key_html.write_text(
        "<!doctype html><html><body><p>answer_key, answerKey, correct_option, and correctState are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_auto_scoring_html = Path(tmp_dir) / "auto-scoring-metadata-visible-leak.html"
    fixture_auto_scoring_html.write_text(
        "<!doctype html><html><body><p>auto_scoring and autoScoring are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_box_catalog_metadata_html = Path(tmp_dir) / "box-catalog-metadata-visible-leak.html"
    fixture_box_catalog_metadata_html.write_text(
        "<!doctype html><html><body><p>template_box_prefix, boxId, track_availability, resolvedBoxPrefixes, card_template, cardCounts, and templateTrackPlaceholder are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_result_session_metadata_html = Path(tmp_dir) / "result-session-metadata-visible-leak.html"
    fixture_result_session_metadata_html.write_text(
        "<!doctype html><html><body><p>catalogCards, completedAt, usedHint, and usedPeek are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_card_source_records_metadata_html = Path(tmp_dir) / "card-source-records-metadata-visible-leak.html"
    fixture_card_source_records_metadata_html.write_text(
        "<!doctype html><html><body><p>card_records and cardRecords are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_interaction_state_metadata_html = Path(tmp_dir) / "interaction-state-metadata-visible-leak.html"
    fixture_interaction_state_metadata_html.write_text(
        "<!doctype html><html><body><p>flipConfidence, selectedOptionId, lockSelections, eliminatedItemIds, and swipeSelection are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_sync_payload_metadata_html = Path(tmp_dir) / "sync-payload-metadata-visible-leak.html"
    fixture_sync_payload_metadata_html.write_text(
        "<!doctype html><html><body><p>auth_token, sms_code, phone_number, day_key, completed_at, used_hint, used_peek, is_favorited, is_sleeping, last_modified_at, checked_in_today, favorite_count, learning_completed_count, pending_review_count, review_completed_count, sleeping_count, and total_completed_count are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_membership_payload_metadata_html = Path(tmp_dir) / "membership-payload-metadata-visible-leak.html"
    fixture_membership_payload_metadata_html.write_text(
        "<!doctype html><html><body><p>counted_entry_count, last_experience_ended_by, recovery_prompt_visible, trial_duration_days, and trial_started_at_entry_count are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_camel_runtime_bookkeeping_metadata_html = Path(tmp_dir) / "camel-runtime-bookkeeping-metadata-visible-leak.html"
    fixture_camel_runtime_bookkeeping_metadata_html.write_text(
        "<!doctype html><html><body><p>authToken, acknowledgedAt, lastModifiedAt, countedEntryCount, recoveryPromptVisible, and trialStartedAtEntryCount are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_mutation_queue_metadata_html = Path(tmp_dir) / "mutation-queue-metadata-visible-leak.html"
    fixture_mutation_queue_metadata_html.write_text(
        "<!doctype html><html><body><p>sync_daily_progress, sync_space_state, sync_learning_state, start_membership_trial, refresh_membership, __softbook_mutation_queue, and retryCount are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_runtime_config_metadata_html = Path(tmp_dir) / "runtime-config-metadata-visible-leak.html"
    fixture_runtime_config_metadata_html.write_text(
        "<!doctype html><html><body><p>apiKey, apiKeyHeader, baseUrl, remoteConfig, requestCodeEndpoint, verifyCodeEndpoint, dismissRecoveryEndpoint, entitlementEndpoint, purchaseEndpoint, startTrialEndpoint, trackQueryParam, __SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__, SOFTBOOK_CET_REMOTE_BASE_URL, SOFTBOOK_CET_REMOTE_API_KEY, and SOFTBOOK_CET_LEARNING_TRACK are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_runtime_profile_metadata_html = Path(tmp_dir) / "runtime-profile-metadata-visible-leak.html"
    fixture_runtime_profile_metadata_html.write_text(
        "<!doctype html><html><body><p>featureModes, learningTrack, learningSource, progressSync, spaceState, and learningState are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_smoke_auth_env_metadata_html = Path(tmp_dir) / "smoke-auth-env-metadata-visible-leak.html"
    fixture_smoke_auth_env_metadata_html.write_text(
        "<!doctype html><html><body><p>SOFTBOOK_CET_AUTH_TOKEN, SOFTBOOK_CET_TEST_PHONE, and SOFTBOOK_CET_TEST_CODE are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_smoke_control_env_metadata_html = Path(tmp_dir) / "smoke-control-env-metadata-visible-leak.html"
    fixture_smoke_control_env_metadata_html.write_text(
        "<!doctype html><html><body><p>SOFTBOOK_CET_SMOKE_ISOLATED_PHONE, SOFTBOOK_CET_SMOKE_WRITE, SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS, SOFTBOOK_CET_EXPECT_INITIAL_STAGE, SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE, and SOFTBOOK_CET_EXPECT_PURCHASE_STAGE are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_ios_launch_env_metadata_html = Path(tmp_dir) / "ios-launch-env-metadata-visible-leak.html"
    fixture_ios_launch_env_metadata_html.write_text(
        "<!doctype html><html><body><p>SOFTBOOK_CET_IOS_LAUNCH, SOFTBOOK_CET_IOS_DEVICE, SOFTBOOK_CET_IOS_SIMULATOR, SOFTBOOK_CET_IOS_BUNDLE_ID, SOFTBOOK_CET_METRO_PORT, and SOFTBOOK_CET_STOP_METRO_ON_EXIT are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_ios_maestro_env_metadata_html = Path(tmp_dir) / "ios-maestro-env-metadata-visible-leak.html"
    fixture_ios_maestro_env_metadata_html.write_text(
        "<!doctype html><html><body><p>SOFTBOOK_CET_MANUAL_TEST_PHONE, SOFTBOOK_CET_IOS_MAESTRO_FLOW, SOFTBOOK_CET_MAESTRO_PHONE, and SOFTBOOK_CET_MAESTRO_CODE are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_ios_smoke_local_env_metadata_html = Path(tmp_dir) / "ios-smoke-local-env-metadata-visible-leak.html"
    fixture_ios_smoke_local_env_metadata_html.write_text(
        "<!doctype html><html><body><p>IOS_SIMULATOR, IOS_DEVICE, IOS_BUNDLE_ID, METRO_PORT, STOP_METRO_ON_EXIT, SMS_CODE, MANUAL_TEST_PHONE, MAESTRO_FLOW, MAESTRO_PHONE, and MAESTRO_CODE are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_cloudbase_script_local_metadata_html = (
        Path(tmp_dir) / "cloudbase-script-local-metadata-visible-leak.html"
    )
    fixture_cloudbase_script_local_metadata_html.write_text(
        "<!doctype html><html><body><p>DEFAULT_ENV_ID, COLLECTION_NAME, DEFAULT_TRACKS, ENV_ID, FUNCTION_NAME, HTTP_PATH, DEFAULT_OUTPUT, and DEFAULT_FLOW_DIR are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_smoke_runtime_local_metadata_html = (
        Path(tmp_dir) / "smoke-runtime-local-metadata-visible-leak.html"
    )
    fixture_smoke_runtime_local_metadata_html.write_text(
        "<!doctype html><html><body><p>useIsolatedPhone, phoneNumber, smsCode, authTokenFromEnv, enableWrites, enableMembershipMutations, expectedInitialStage, expectedStartTrialStage, and expectedPurchaseStage are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_smoke_runtime_output_metadata_html = (
        Path(tmp_dir) / "smoke-runtime-output-metadata-visible-leak.html"
    )
    fixture_smoke_runtime_output_metadata_html.write_text(
        "<!doctype html><html><body><p>authHeaders, remoteHeaders, returnedPhoneNumber, REQUIRED_CORE_INTERACTIONS, and missingInteractions are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_smoke_card_shape_metadata_html = (
        Path(tmp_dir) / "smoke-card-shape-metadata-visible-leak.html"
    )
    fixture_smoke_card_shape_metadata_html.write_text(
        "<!doctype html><html><body><p>validateCardRecord, assertPattern, assertTrack, assertArrayLength, assertNonEmptyArray, and assertCoreInteractionCoverage are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_smoke_endpoint_helper_metadata_html = (
        Path(tmp_dir) / "smoke-endpoint-helper-metadata-visible-leak.html"
    )
    fixture_smoke_endpoint_helper_metadata_html.write_text(
        "<!doctype html><html><body><p>loadMembershipEntitlement, loadLearningCardSource, runMembershipMutation, and parseEntitlement are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_smoke_assertion_helper_metadata_html = (
        Path(tmp_dir) / "smoke-assertion-helper-metadata-visible-leak.html"
    )
    fixture_smoke_assertion_helper_metadata_html.write_text(
        "<!doctype html><html><body><p>assertOk, assertObject, assertString, assertNonNegativeInteger, assertPositiveInteger, normalizeBaseUrl, todayKey, and createIsolatedPhoneNumber are visible.</p></body></html>\n",
        encoding="utf-8",
    )
    fixture_svg = Path(tmp_dir) / "visible-process-leak.svg"
    fixture_svg.write_text(
        '<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg"><text>R&#117;ntime deb&#117;g payload visible to learner.</text></svg>\n',
        encoding="utf-8",
    )
    fixture_accessible_html = Path(tmp_dir) / "accessible-process-leak.html"
    fixture_accessible_html.write_text(
        '<!doctype html><html><body><section aria-label="R&#117;ntime deb&#117;g payload visible to learner."><p>学习画面</p></section></body></html>\n',
        encoding="utf-8",
    )
    fixture_accessible_svg = Path(tmp_dir) / "accessible-process-leak.svg"
    fixture_accessible_svg.write_text(
        '<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg"><g aria-label="R&#117;ntime deb&#117;g payload visible to learner."><text>学习画面</text></g></svg>\n',
        encoding="utf-8",
    )
    fixture_visible_attribute_html = Path(tmp_dir) / "visible-attribute-leak.html"
    fixture_visible_attribute_html.write_text(
        '<!doctype html><html><body><input placeholder="R&#117;ntime deb&#117;g payload visible to learner." value="学习画面"></body></html>\n',
        encoding="utf-8",
    )
    fixture_unquoted_visible_attribute_html = Path(tmp_dir) / "unquoted-visible-attribute-leak.html"
    fixture_unquoted_visible_attribute_html.write_text(
        '<!doctype html><html><body><input placeholder=R&#117;ntime-deb&#117;g-payload value=学习画面></body></html>\n',
        encoding="utf-8",
    )
    fixture_snake_attribute_html = Path(tmp_dir) / "snake-process-attribute-leak.html"
    fixture_snake_attribute_html.write_text(
        '<!doctype html><html><body><input placeholder=agent_review value=学习画面></body></html>\n',
        encoding="utf-8",
    )
    fixture_aria_value_svg = Path(tmp_dir) / "aria-valuetext-leak.svg"
    fixture_aria_value_svg.write_text(
        '<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg"><g aria-valuetext="R&#117;ntime deb&#117;g payload visible to learner."><text>学习画面</text></g></svg>\n',
        encoding="utf-8",
    )
    fixture_generated_html = Path(tmp_dir) / "generated-content-leak.html"
    fixture_generated_html.write_text(
        '<!doctype html><html><head><style>.leak::before { content: "R\\75 ntime deb\\75 g payload visible to learner."; }</style></head><body><p class="leak">学习画面</p></body></html>\n',
        encoding="utf-8",
    )
    fixture_attr_generated_html = Path(tmp_dir) / "generated-attr-content-leak.html"
    fixture_attr_generated_html.write_text(
        '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class="leak" data-caption="R&#117;ntime deb&#117;g payload visible to learner.">学习画面</p></body></html>\n',
        encoding="utf-8",
    )
    fixture_unquoted_attr_generated_html = Path(tmp_dir) / "generated-unquoted-attr-content-leak.html"
    fixture_unquoted_attr_generated_html.write_text(
        '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class=leak data-caption=R&#117;ntime-deb&#117;g-payload>学习画面</p></body></html>\n',
        encoding="utf-8",
    )
    fixture_snake_generated_html = Path(tmp_dir) / "snake-process-generated-leak.html"
    fixture_snake_generated_html.write_text(
        '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class=leak data-caption=debug_payload>学习画面</p></body></html>\n',
        encoding="utf-8",
    )
    fixture_camel_generated_html = Path(tmp_dir) / "camel-metadata-generated-leak.html"
    fixture_camel_generated_html.write_text(
        '<!doctype html><html><head><style>.leak::before { content: attr(data-caption); }</style></head><body><p class=leak data-caption=sourceLabel>学习画面</p></body></html>\n',
        encoding="utf-8",
    )
    fixture_var_generated_html = Path(tmp_dir) / "generated-var-content-leak.html"
    fixture_var_generated_html.write_text(
        '<!doctype html><html><head><style>:root { --leak-copy: "R\\75 ntime deb\\75 g payload visible to learner."; } .leak::before { content: var(--leak-copy); }</style></head><body><p class="leak">学习画面</p></body></html>\n',
        encoding="utf-8",
    )
    fixture_composite_generated_html = Path(tmp_dir) / "generated-composite-content-leak.html"
    fixture_composite_generated_html.write_text(
        '<!doctype html><html><head><style>.leak::before { content: attr(data-caption) " R\\75 ntime deb\\75 g payload visible to learner."; }</style></head><body><p class="leak" data-caption="学习线索">学习画面</p></body></html>\n',
        encoding="utf-8",
    )
    design_metadata_fixture = subprocess.run(
        ["node", str(ROOT / "scripts/check_design_metadata_leaks.mjs")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
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
        "smoke-runtime-local-metadata-visible-leak.html",
        "smoke-runtime-output-metadata-visible-leak.html",
        "smoke-card-shape-metadata-visible-leak.html",
        "smoke-endpoint-helper-metadata-visible-leak.html",
        "smoke-assertion-helper-metadata-visible-leak.html",
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

visual_reference_path = ROOT / "docs/design/visual-reference.html"
visual_reference_original = visual_reference_path.read_text(encoding="utf-8")
try:
    visual_reference_path.write_text(
        visual_reference_original.replace(
            "</body>",
            "<p>docs/internal/path visible to learner.</p></body>",
        ),
        encoding="utf-8",
    )
    visual_reference_fixture = subprocess.run(
        ["node", str(ROOT / "scripts/check_design_metadata_leaks.mjs")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
finally:
    visual_reference_path.write_text(visual_reference_original, encoding="utf-8")

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

agent_harness_text = (ROOT / "spec/agent-harness.json").read_text(encoding="utf-8")
for snippet in [
    "AP-33",
    "AP-34",
    "quarantine_or_repair_any_design_artifact_before_UI_implementation",
    "define_current_card_primary_task_primary_action_feedback_recovery_and_space_continuity_before_visual_implementation",
]:
    check_contains("agent harness design quarantine anti-patterns", agent_harness_text, snippet)

evals_text = (ROOT / "spec/evals.json").read_text(encoding="utf-8")
for snippet in [
    "HR-27",
    "HR-28",
    "GT-21",
    "GT-22",
    "metadata_leakage_is_delivery_blocker",
    "single_card_flow_is_operable_focused_flow_not_one_screen_cram",
]:
    check_contains("evals design quarantine regressions", evals_text, snippet)

design_search_readme = ROOT / "docs/design/search-runs/README.md"
if not design_search_readme.exists():
    errors.append("missing Design Evolution Engine README: docs/design/search-runs/README.md")
else:
    design_search_text = design_search_readme.read_text(encoding="utf-8")
    for snippet in [
        "## Product Truth",
        "## Implementation Hypothesis",
        "## Required Loop",
        "at least 8 materially different candidates",
        "Pairwise Review",
        "Fragment Harvest",
        "Targeted Mutation",
        "Failure Sedimentation",
        "rejects copied templates",
        "candidate-bound visual evidence for every surviving candidate",
        "candidate-bound pairwise visual evidence for both compared candidates",
        "enough pairwise reviews to cover the candidate set",
    ]:
        check_contains("design search README", design_search_text, snippet)

design_search_script = ROOT / "scripts" / "validate_design_search_run.py"
if not design_search_script.exists():
    errors.append("missing design search validator: scripts/validate_design_search_run.py")
else:
    fixture_parent = ROOT / ".tmp" / "harness-validator"
    fixture_parent.mkdir(parents=True, exist_ok=True)

    design_search_validation = subprocess.run(
        [sys.executable, str(design_search_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if design_search_validation.returncode != 0:
        errors.append(
            "validate_design_search_run.py must pass repository templates: "
            + (design_search_validation.stdout + design_search_validation.stderr).strip()
        )

    with tempfile.TemporaryDirectory(
        prefix="design-search-template-",
        dir=fixture_parent,
    ) as tmp_dir:
        tmp_run = Path(tmp_dir) / "empty-template-regression"
        (tmp_run / "candidates").mkdir(parents=True)
        (tmp_run / "pairwise-reviews").mkdir()
        for filename in [
            "context-pack.md",
            "hard-filter-results.md",
            "fragment-harvest.md",
            "mutation-log.md",
            "promotion-record.md",
        ]:
            shutil.copyfile(ROOT / "docs/design/search-runs/templates" / filename, tmp_run / filename)
        (tmp_run / "candidate-index.md").write_text("# Candidate Index\n", encoding="utf-8")
        for index in range(1, 9):
            shutil.copyfile(
                ROOT / "docs/design/search-runs/templates/candidate-record.md",
                tmp_run / "candidates" / f"candidate-{index}.md",
            )
        shutil.copyfile(
            ROOT / "docs/design/search-runs/templates/pairwise-review.md",
            tmp_run / "pairwise-reviews/round-1-candidate-1-vs-candidate-2.md",
        )
        template_only_run = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(tmp_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if template_only_run.returncode == 0:
            errors.append("validate_design_search_run.py must reject copied-template search runs")
        else:
            template_regression_output = template_only_run.stdout + template_only_run.stderr
            for snippet in [
                "template placeholder",
                "pairwise reviews must include every surviving candidate",
                "must be backed by rendered-proof.html, external-prototype.md, screenshots/, or a concrete prototype URL",
            ]:
                if snippet not in template_regression_output:
                    errors.append(f"validate_design_search_run.py template regression missing expected rejection: {snippet}")

    def write_design_search_fixture(
        run_dir: Path,
        *,
        source_contexts: dict[int, str] | None = None,
        surviving: list[int] | None = None,
        rejected: list[int] | None = None,
        pairwise_pairs: list[tuple[int, int]] | None = None,
        winning_candidate: str = "candidate-1",
    ) -> None:
        if run_dir.exists():
            shutil.rmtree(run_dir)
        (run_dir / "candidates").mkdir(parents=True)
        (run_dir / "pairwise-reviews").mkdir()
        (run_dir / "candidate-proofs").mkdir()
        surviving = surviving or list(range(1, 9))
        rejected = rejected or []
        pairwise_pairs = pairwise_pairs or [(index, index + 1) for index in range(1, len(surviving))]
        source_contexts = source_contexts or {}

        def write(path: Path, text: str) -> None:
            path.write_text(text.strip() + "\n", encoding="utf-8")

        write(
            run_dir / "context-pack.md",
            """
# Context Pack

## Surface
Space surface validator regression.

## Accepted Baseline
Baseline: docs/design/mocks/space-surface-visual-refinement-v1.md.

## Product Truth
CET cards, interactions, and physical space remain product truth.

## Hard Constraints
Law of One, Space hierarchy, and implementation authority boundaries.

## Soft Objectives
Low-burden first read and stronger current box focus.

## Source Artifacts
Active baseline, visual-language, and physical-space artifacts.

## Forbidden Drift
No generic dashboard or flat list.

## Candidate Budget
Eight candidates, one generation, human checkpoint.
            """,
        )
        write(run_dir / "candidate-index.md", "# Candidate Index\n\n" + "\n".join(f"- candidate-{index}" for index in range(1, 9)))
        write(
            run_dir / "hard-filter-results.md",
            f"""
# Hard Filter Results

## Filter Scope
Generation one Space candidates against baseline and hard filters.

## Rejected Candidates
{', '.join(f'candidate-{index}' for index in rejected) if rejected else 'No candidates rejected.'}

## Surviving Candidates
{', '.join(f'candidate-{index}' for index in surviving)}

## Product Truth Violations
Rejected candidates weaken hierarchy; survivors keep product truth.

## Layout Or Proof Violations
Rejected candidates lack proof; survivors preserve containment.

## Notes For Mutation
Strengthen physical object address and reduce dashboard density.
            """,
        )
        write(
            run_dir / "fragment-harvest.md",
            """
# Fragment Harvest

## Best Focal Object
candidate-1 keeps the current box as the focal object.

## Best First-Read Path
candidate-2 gives card address before actions.

## Best State Language
candidate-3 handles sleep and wake as gentle states.

## Best Space Or Interaction Model
candidate-4 keeps library group box card hierarchy visible.

## Best Platform Adaptation
candidate-5 has phone and tablet hierarchy options.

## Rejected Failure Patterns
candidate-8 dashboard density is rejected.

## Synthesis Inputs
Use current box, address strip, and restrained actions.
            """,
        )
        write(
            run_dir / "mutation-log.md",
            """
# Mutation Log

## Failure Signal
candidate-8 collapses current box into dashboard density.

## Targeted Mutation
Make current box a physical desk object with parent context.

## Expected Improvement
The next generation should improve hierarchy recognition.

## Risk
The object treatment might become decorative.

## Result
Mutation improved hierarchy but needs containment review.
            """,
        )
        write(
            run_dir / "promotion-record.md",
            f"""
# Promotion Record

## Promoted Artifact
Probe artifact would update a Space visual mock.

## Winning Candidate
{winning_candidate}

## Baseline Comparison
{winning_candidate} beats baseline on first-read current box focus without regressing authority.

## Borrowed Fragments
Address strip from candidate-2 and state chip from candidate-3.

## Rejected Fragments
Dashboard metrics from candidate-8 are rejected.

## Rendered Proof
rendered-proof.html in this run proves the layout.

## Implementation Mapping Expectations
Future RN mapping must keep box desk, address, and operations separate.

## Unimplemented Gaps
No RN implementation authority is granted by this probe.

## Failure Sedimentation
Add dashboard-density failure to rejected notes if this were real.

## Design Review Checklist Answers
Q1: Current library is named and Law of One is kept.
Q2: Current box is focal object; address then operations is the read path.
Q3: Space hierarchy uses library group box card and no flat list.
Q4: No forbidden dashboard or two-box collapse is approved.
Q5: Containment is backed by rendered proof for target viewport.
Q6: Learning rules are not changed in this Space probe.
            """,
        )
        write(run_dir / "rendered-proof.html", "<!doctype html><title>probe</title><main>Concrete proof</main>")
        write(
            run_dir / "candidate-proofs/survivor-comparison.html",
            "<!doctype html><title>candidate proof</title><main>candidate-1 candidate-2 candidate-3 candidate-4 candidate-5 candidate-6 candidate-7 candidate-8</main>",
        )

        for index in range(1, 9):
            source_context = source_contexts.get(index, "context-pack.md")
            write(
                run_dir / "candidates" / f"candidate-{index}.md",
                f"""
# Candidate {index}

## Candidate ID
candidate-{index}

## Provenance
- Tool or model: probe-model
- Prompt: concrete prompt for candidate {index}
- Source context pack: {source_context}
- Artifact: candidate-proofs/survivor-comparison.html#candidate-{index}
- Screenshots: candidate-proofs/survivor-comparison.html#candidate-{index}

## Product Truth Fit
candidate-{index} preserves CET cards, interactions, and physical-space hierarchy.

## Focal Object
The current box object is primary for candidate-{index}.

## First-Read Path
Read box address, card state, then allowed action.

## Interaction Silhouette
Space hierarchy silhouette with library group box card visibility.

## Spatial Model
Library, group, box, and card are all named with current card address.

## State Language
Favorite tag, sleep, wake, and review state remain distinct.

## Motion Causality
Motion follows state change only and is not decorative.

## Platform Strategy
Phone is bounded target; tablet and pc web implications are named.

## Implementation Mapping
Regions map to future Space surface without granting implementation authority.

## Known Risks
Risk is density, containment, and over-decoration.

## Design Review Checklist Answers
Q1: Current library is vocabulary; Law of One is kept.
Q2: Current box is focal object and first-read path is explicit.
Q3: Space hierarchy silhouette is preserved.
Q4: Forbidden patterns are rejected.
Q5: Target viewport containment is claimed by proof.
Q6: Learning and flip rules are not changed.
                """,
            )

        for index, (candidate_a, candidate_b) in enumerate(pairwise_pairs, start=1):
            write(
                run_dir / "pairwise-reviews" / f"round-{index}-candidate-{candidate_a}-vs-candidate-{candidate_b}.md",
                f"""
# Pairwise Review {index}

## Pair
- Candidate A: candidate-{candidate_a}
- Candidate B: candidate-{candidate_b}

## Reviewer Role
Product Truth reviewer for probe {index}.

## Winner
candidate-{candidate_a}

## Visual Evidence
Compared candidate-{candidate_a} and candidate-{candidate_b} in candidate-proofs/survivor-comparison.html#candidate-{candidate_a} and candidate-proofs/survivor-comparison.html#candidate-{candidate_b}.

## Product Truth
candidate-{candidate_a} better preserves the product truth for current box focus.

## Task Clarity
candidate-{candidate_a} makes the next action clearer.

## Space Or Interaction Fit
candidate-{candidate_a} preserves the Space hierarchy better.

## Visual System Fit
candidate-{candidate_a} keeps Law of One and clear state language.

## Implementation Mapping
candidate-{candidate_a} maps cleanly without inventing code authority.

## Rationale
The decision is concrete enough for this validator probe.

## Borrowable Fragments
Address strip can be borrowed from candidate-{candidate_b}.

## Rejected Fragments
Weak dashboard density should be rejected.
                """,
            )

    with tempfile.TemporaryDirectory(
        prefix="design-search-regressions-",
        dir=fixture_parent,
    ) as tmp_dir:
        regression_root = Path(tmp_dir)
        coverage_run = regression_root / "pairwise-coverage-regression"
        promotion_run = regression_root / "promotion-consistency-regression"
        visual_evidence_run = regression_root / "candidate-visual-evidence-regression"
        borrowed_evidence_run = regression_root / "borrowed-visual-evidence-regression"

        write_design_search_fixture(
            coverage_run,
            pairwise_pairs=[(1, 2)] * 7,
            winning_candidate="candidate-1",
        )
        coverage_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(coverage_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if coverage_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject pairwise reviews that do not cover every surviving candidate")
        else:
            coverage_output = coverage_case.stdout + coverage_case.stderr
            for snippet in [
                "pairwise reviews must include every surviving candidate",
                "connected comparison graph",
            ]:
                if snippet not in coverage_output:
                    errors.append(f"validate_design_search_run.py pairwise coverage regression missing expected rejection: {snippet}")

        write_design_search_fixture(
            promotion_run,
            source_contexts={index: ("context-pack-a.md" if index % 2 else "context-pack-b.md") for index in range(1, 9)},
            surviving=list(range(1, 8)),
            rejected=[8],
            pairwise_pairs=[(index, index + 1) for index in range(1, 7)],
            winning_candidate="candidate-99",
        )
        promotion_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(promotion_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if promotion_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject promotion records that do not bind to known surviving reviewed candidates")
        else:
            promotion_output = promotion_case.stdout + promotion_case.stderr
            for snippet in [
                "candidate records must all use the same Source context pack",
                "candidate Source context pack must reference context-pack.md",
                "references unknown candidate id(s): candidate-99",
                "must reference at least one known candidate id",
            ]:
                if snippet not in promotion_output:
                    errors.append(f"validate_design_search_run.py promotion consistency regression missing expected rejection: {snippet}")

        write_design_search_fixture(
            visual_evidence_run,
            surviving=list(range(1, 8)),
            rejected=[8],
            pairwise_pairs=[(index, index + 1) for index in range(1, 7)],
            winning_candidate="candidate-1",
        )
        candidate_three = visual_evidence_run / "candidates/candidate-3.md"
        candidate_three.write_text(
            candidate_three.read_text(encoding="utf-8")
            .replace("- Artifact: candidate-proofs/survivor-comparison.html#candidate-3", "- Artifact: prose-only candidate record")
            .replace("- Screenshots: candidate-proofs/survivor-comparison.html#candidate-3", "- Screenshots: visual evidence omitted"),
            encoding="utf-8",
        )
        pairwise_two = visual_evidence_run / "pairwise-reviews/round-2-candidate-2-vs-candidate-3.md"
        pairwise_two.write_text(
            pairwise_two.read_text(encoding="utf-8").replace(
                "## Visual Evidence\nCompared candidate-2 and candidate-3 in candidate-proofs/survivor-comparison.html#candidate-2 and candidate-proofs/survivor-comparison.html#candidate-3.\n",
                "## Visual Evidence\nPairwise review relied on prose only.\n",
            ),
            encoding="utf-8",
        )
        visual_evidence_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(visual_evidence_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if visual_evidence_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject surviving candidates or pairwise reviews without visual evidence")
        else:
            visual_evidence_output = visual_evidence_case.stdout + visual_evidence_case.stderr
            for snippet in [
                "surviving candidate must reference candidate-bound rendered HTML",
                "visual evidence must include candidate-bound evidence for compared candidate id(s)",
                "visual evidence must reference rendered HTML",
            ]:
                if snippet not in visual_evidence_output:
                    errors.append(f"validate_design_search_run.py visual evidence regression missing expected rejection: {snippet}")

        write_design_search_fixture(
            borrowed_evidence_run,
            pairwise_pairs=[(index, index + 1) for index in range(1, 8)],
            winning_candidate="candidate-1",
        )
        candidate_two = borrowed_evidence_run / "candidates/candidate-2.md"
        candidate_two.write_text(
            candidate_two.read_text(encoding="utf-8")
            .replace("candidate-proofs/survivor-comparison.html#candidate-2", "candidate-proofs/survivor-comparison.html#candidate-1"),
            encoding="utf-8",
        )
        pairwise_one = borrowed_evidence_run / "pairwise-reviews/round-1-candidate-1-vs-candidate-2.md"
        pairwise_one.write_text(
            pairwise_one.read_text(encoding="utf-8").replace(
                "candidate-proofs/survivor-comparison.html#candidate-2",
                "candidate-proofs/survivor-comparison.html#candidate-1",
            ),
            encoding="utf-8",
        )
        borrowed_evidence_case = subprocess.run(
            [sys.executable, str(design_search_script), "--run", str(borrowed_evidence_run)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if borrowed_evidence_case.returncode == 0:
            errors.append("validate_design_search_run.py must reject borrowed visual evidence that is not bound to the candidate under review")
        else:
            borrowed_evidence_output = borrowed_evidence_case.stdout + borrowed_evidence_case.stderr
            for snippet in [
                "surviving candidate must reference candidate-bound rendered HTML",
                "visual evidence must include candidate-bound evidence for compared candidate id(s)",
            ]:
                if snippet not in borrowed_evidence_output:
                    errors.append(f"validate_design_search_run.py borrowed evidence regression missing expected rejection: {snippet}")

    for cleanup_dir in [fixture_parent, fixture_parent.parent]:
        try:
            cleanup_dir.rmdir()
        except OSError:
            pass

agent_review_script = ROOT / "scripts" / "validate_agent_review.py"
if not agent_review_script.exists():
    errors.append("missing agent review validator: scripts/validate_agent_review.py")
else:
    invalid_agent_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "PR_BODY": ""},
    )
    if invalid_agent_review.returncode == 0:
        errors.append("validate_agent_review.py must reject missing agent review records")

    agent_review_only = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files.
""",
        },
    )
    if agent_review_only.returncode == 0:
        errors.append("validate_agent_review.py must reject PR bodies that only contain Agent review")
    elif "当前任务引用的 spec" not in (agent_review_only.stdout + agent_review_only.stderr):
        errors.append("validate_agent_review.py required-section rejection must mention missing spec section")

    unchecked_validation_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## 当前任务引用的 spec

- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`

## 变更摘要

- Validate PR body review records.

## 验证

- [ ] `python3 scripts/validate_harness.py`

## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files.

## Agent run record

- Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
""",
        },
    )
    if unchecked_validation_review.returncode == 0:
        errors.append("validate_agent_review.py must reject unchecked validation boxes")
    elif "unchecked validation boxes" not in (
        unchecked_validation_review.stdout + unchecked_validation_review.stderr
    ):
        errors.append("validate_agent_review.py unchecked validation rejection must explain the problem")

    skip_remote_only_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## 当前任务引用的 spec

- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`

## 变更摘要

- Validate PR body review records.

## 验证

- [x] `python3 scripts/validate_harness.py --skip-remote-guard`

## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files.

## Agent run record

- Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
""",
        },
    )
    if skip_remote_only_review.returncode == 0:
        errors.append("validate_agent_review.py must reject PR records that only ran --skip-remote-guard harness")
    elif "full `python3 scripts/validate_harness.py`" not in (
        skip_remote_only_review.stdout + skip_remote_only_review.stderr
    ):
        errors.append("validate_agent_review.py skip-remote rejection must require full harness")

    valid_agent_review = subprocess.run(
        [sys.executable, str(agent_review_script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
        env={
            **os.environ,
            "PR_BODY": """
## 当前任务引用的 spec

- `spec/repo-delivery-contract.json`
- `spec/agent-harness.json`

## 变更摘要

- Validate PR body review records.

## 验证

- [x] `python3 scripts/validate_harness.py`
- [x] `python3 scripts/validate_agent_review.py`

## Agent review

- Reviewer: Codex
- Review status: Passed
- Blocking findings: None
- Review summary: Reviewed changed files, specs, validation, and found no blocking issues.

## Agent run record

- Run record: docs/agent-runs/2026-05-21-agent-run-record-contract.md

## 设计稿来源（用户可见 UI 如适用）

- Design artifact: N/A
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: N/A
- Unimplemented design gaps: N/A

## design_review_checklist（如适用）

- Universal Q1-Q4: N/A
- Conditional Q5-Q6: N/A
""",
        },
    )
    if valid_agent_review.returncode != 0:
        errors.append("validate_agent_review.py must accept a passed review with no blocking findings")

directory_reference_body = """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/decisions/
- Interaction/motion artifact: docs/design/interaction-motion/
- Physical space artifact: N/A
- Implementation mapping: apps/mobile/src/learning/LearningSurface.tsx
- Unimplemented design gaps: No known gaps.
- Learning microcopy basis: product correction - fixture confirms concrete accepted artifacts remain sufficient.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
"""
directory_reference_case = run_design_gate_case(
    directory_reference_body,
    [
        "apps/mobile/src/learning/LearningSurface.tsx",
        "docs/design/decisions/new-learning-direction.md",
        "docs/design/interaction-motion/new-learning-motion.md",
    ],
)
if directory_reference_case.returncode == 0:
    errors.append("validate_pr_design_gate.py must reject directory-only design artifact references")
else:
    directory_reference_output = directory_reference_case.stdout + directory_reference_case.stderr
    if "not only a directory" not in directory_reference_output:
        errors.append("validate_pr_design_gate.py directory-only rejection must explain the concrete file requirement")

visual_tokens_empty_case = run_design_gate_case("", ["apps/mobile/src/visual/tokens.ts"])
if visual_tokens_empty_case.returncode == 0:
    errors.append("validate_pr_design_gate.py must treat apps/mobile/src/visual/tokens.ts as design-gated")
else:
    visual_tokens_empty_output = visual_tokens_empty_case.stdout + visual_tokens_empty_case.stderr
    if "Design artifact" not in visual_tokens_empty_output:
        errors.append("validate_pr_design_gate.py visual token rejection must require design artifact evidence")

web_ui_empty_case = run_design_gate_case("", ["apps/web/src/App.tsx"])
if web_ui_empty_case.returncode == 0:
    errors.append("validate_pr_design_gate.py must treat apps/web UI files as design-gated")
else:
    web_ui_empty_output = web_ui_empty_case.stdout + web_ui_empty_case.stderr
    if "Design artifact" not in web_ui_empty_output:
        errors.append("validate_pr_design_gate.py web UI rejection must require design artifact evidence")

test_only_tsx_case = run_design_gate_case(
    "",
    [
        "apps/mobile/__tests__/SpaceSurface.test.tsx",
        "apps/mobile/src/space/SpaceSurface.test.tsx",
    ],
)
if test_only_tsx_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should not require design evidence for test-only TSX changes: "
        + test_only_tsx_case.stdout
        + test_only_tsx_case.stderr
    )

card_content_empty_case = run_design_gate_case(
    "",
    ["apps/mobile/src/learning/localCardRecords.ts"],
)
if card_content_empty_case.returncode == 0:
    errors.append("validate_pr_design_gate.py must treat repository dev card content as handoff-gated")
else:
    card_content_empty_output = card_content_empty_case.stdout + card_content_empty_case.stderr
    if "Card content handoff" not in card_content_empty_output:
        errors.append("validate_pr_design_gate.py card content rejection must require handoff evidence")

card_content_invalid_handoff_case = run_design_gate_case(
    """
## 卡片内容交接（如适用）

- Card content handoff: local softbook_cet edit
- Card content validation: node infra/cloudbase/import-card-source.mjs --file handoff.json --track cet4
""",
    ["apps/mobile/src/learning/localCardRecords.ts"],
)
if card_content_invalid_handoff_case.returncode == 0:
    errors.append("validate_pr_design_gate.py must reject repository dev card content without card make handoff")
else:
    card_content_invalid_output = (
        card_content_invalid_handoff_case.stdout + card_content_invalid_handoff_case.stderr
    )
    if "card make" not in card_content_invalid_output:
        errors.append("validate_pr_design_gate.py card content rejection must name the card make boundary")

card_content_valid_case = run_design_gate_case(
    """
## 卡片内容交接（如适用）

- Card content handoff: external_workspace:/Users/lenkin/programing/card make PR #12 handoff payload.
- Card content validation: dry-run import with node infra/cloudbase/import-card-source.mjs --file handoff.json --track cet4; catalog_audit_result recorded with node infra/cloudbase/audit-card-sources.mjs.
""",
    ["apps/mobile/src/learning/localCardRecords.ts"],
)
if card_content_valid_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow repository dev card content only with card make handoff evidence: "
        + card_content_valid_case.stdout
        + card_content_valid_case.stderr
    )

visual_tokens_valid_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/visual-reference.html
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: apps/mobile/src/visual/tokens.ts
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/visual/tokens.ts"],
)
if visual_tokens_valid_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow visual token changes with design evidence: "
        + visual_tokens_valid_case.stdout
        + visual_tokens_valid_case.stderr
    )

web_ui_valid_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/visual-reference.html
- Interaction/motion artifact: N/A
- Physical space artifact: N/A
- Implementation mapping: apps/web/src/App.tsx
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/web/src/App.tsx"],
)
if web_ui_valid_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow apps/web UI changes with design evidence: "
        + web_ui_valid_case.stdout
        + web_ui_valid_case.stderr
    )

visual_output_artifact_paths = [
    "docs/design/visual-reference.html",
    "docs/design/interaction-motion/learning-motion-v1.md",
    "docs/design/physical-space/space-model-v1.md",
    "docs/design/mocks/learning-surface-v1.md",
    "docs/design/search-runs/2026-05-07-space/rendered-proof.html",
    "docs/design/storyboards/learning-flow-v1.md",
]
for visual_output_path in visual_output_artifact_paths:
    visual_output_empty_case = run_design_gate_case("", [visual_output_path])
    if visual_output_empty_case.returncode == 0:
        errors.append(
            f"validate_pr_design_gate.py must require checklist answers for visual output artifact: {visual_output_path}"
        )
    else:
        visual_output_empty = visual_output_empty_case.stdout + visual_output_empty_case.stderr
        for snippet in ["Universal Q1-Q4", "Conditional Q5-Q6"]:
            if snippet not in visual_output_empty:
                errors.append(
                    f"validate_pr_design_gate.py visual-output rejection missing {snippet}: {visual_output_path}"
                )

placeholder_checklist_case = run_design_gate_case(
    """
## design_review_checklist（如适用）

- Universal Q1-Q4: answered
- Conditional Q5-Q6: answered
""",
    ["docs/design/mocks/learning-surface-v1.md"],
)
if placeholder_checklist_case.returncode == 0:
    errors.append("validate_pr_design_gate.py must reject placeholder-only checklist answers")
elif "placeholder" not in (placeholder_checklist_case.stdout + placeholder_checklist_case.stderr):
    errors.append("validate_pr_design_gate.py placeholder checklist rejection must explain the problem")

visual_output_checklist_body = """
## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
"""
for visual_output_path in visual_output_artifact_paths:
    visual_output_checklist_case = run_design_gate_case(
        visual_output_checklist_body,
        [visual_output_path],
    )
    if visual_output_checklist_case.returncode != 0:
        errors.append(
            "validate_pr_design_gate.py should allow design-only visual artifacts when checklist answers are present: "
            + visual_output_path
            + "\n"
            + visual_output_checklist_case.stdout
            + visual_output_checklist_case.stderr
        )

design_gate_module = load_design_gate_module()
bad_visual_output_errors = design_gate_module.scan_visual_output_text(
    "docs/design/mocks/bad-space-mock.html",
    """
<!doctype html>
<html>
<head>
  <style>
    .bad-title { background: linear-gradient(red, blue); color: transparent; }
    .serif-copy { font-family: serif; }
  </style>
</head>
<body>
  <div class="phone">有把握 / 再回看</div>
  <svg viewBox="0 0 12 12"><path d="M0 0h12v12H0z"/></svg>
</body>
</html>
""",
    load("visual-language.json"),
)
for expected_snippet in [
    "forbidden design pattern",
    "inline <svg> without explicit width and height",
    "有把握=confident/mint",
    "overflow-x containment evidence",
    "narrow-viewport media query",
]:
    if not any(expected_snippet in error for error in bad_visual_output_errors):
        errors.append(
            "validate_pr_design_gate.py visual-output scanner missing expected rejection: "
            + expected_snippet
        )

ui_external_artifact_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/decisions/learning-space-direction-decision-v1.md
- Interaction/motion artifact: https://example.com/softbook/learning-motion
- Physical space artifact: N/A
- Implementation mapping: apps/mobile/src/learning/LearningSurface.tsx
- Unimplemented design gaps: No known gaps.
- Learning microcopy basis: product correction - fixture keeps directory-reference rejection focused on directory-only evidence.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/learning/LearningSurface.tsx"],
)
if ui_external_artifact_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow concrete preexisting artifacts or external URLs: "
        + ui_external_artifact_case.stdout
        + ui_external_artifact_case.stderr
    )

space_missing_visual_proof_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/decisions/learning-space-direction-decision-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_missing_visual_proof_case.returncode == 0:
    errors.append(
        "validate_pr_design_gate.py must reject Space UI implementation without the Space visual proof artifact"
    )
elif "Space visual proof" not in (
    space_missing_visual_proof_case.stdout + space_missing_visual_proof_case.stderr
):
    errors.append(
        "validate_pr_design_gate.py Space visual proof rejection must explain the required artifact"
    )

space_visual_directions_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/directions/space-surface-visual-directions-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_visual_directions_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow Space UI implementation that names the accepted Space visual directions artifact: "
        + space_visual_directions_case.stdout
        + space_visual_directions_case.stderr
    )

space_visual_proof_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/mocks/space-surface-visual-proof-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_visual_proof_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow Space UI implementation that names the Space visual proof artifact: "
        + space_visual_proof_case.stdout
        + space_visual_proof_case.stderr
    )

space_visual_refinement_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/mocks/space-surface-visual-refinement-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_visual_refinement_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow Space UI implementation that names the refined Space visual artifact: "
        + space_visual_refinement_case.stdout
        + space_visual_refinement_case.stderr
    )

space_shelf_desk_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/mocks/space-surface-shelf-desk-v1.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: Loading, empty, remote-error, permission, and paywall Space states remain out of scope.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current box tray and first-read path address shelf -> tray -> cards; Q3 silhouette matches Space physical hierarchy; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment is covered by shelf-desk proof; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_shelf_desk_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow Space UI implementation that names the shelf-desk Space visual artifact: "
        + space_shelf_desk_case.stdout
        + space_shelf_desk_case.stderr
    )

space_state_baseline_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/mocks/space-state-baseline-v1.html
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-state-baseline-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: Motion for loading, error recovery, and sync merge remains out of scope.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current box tray and first-read path address shelf -> state rail -> tray -> contained objects; Q3 silhouette matches Space physical hierarchy; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment is covered by rendered proof; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_state_baseline_case.returncode != 0:
    errors.append(
        "validate_pr_design_gate.py should allow Space state UI implementation that names the accepted Space state baseline artifact: "
        + space_state_baseline_case.stdout
        + space_state_baseline_case.stderr
    )

space_fake_shelf_desk_case = run_design_gate_case(
    """
## 设计稿来源（用户可见 UI 如适用）

- Design artifact: docs/design/mocks/space-surface-shelf-desk-v1-fake.md
- Interaction/motion artifact: N/A
- Physical space artifact: docs/design/physical-space/space-model-v1.md
- Implementation mapping: docs/design/mapping/learning-space-implementation-map-v1.md
- Unimplemented design gaps: No known gaps.

## design_review_checklist（如适用）

- Universal Q1-Q4: Q1 Law of One current library reading; Q2 focal object current card; Q3 silhouette matches accepted contract; Q4 forbidden_design_patterns none.
- Conditional Q5-Q6: Q5 phone viewport containment not applicable or safe-area preserved; Q6 learning flip stats module rules unchanged.
- AP-22: AP-22 design review checklist was answered before render with six questions recorded.
- AP-23: AP-23 keeps two-state self-assess policy: 有把握 mint / 再回看 amber.
""",
    ["apps/mobile/src/space/SpaceSurface.tsx"],
)
if space_fake_shelf_desk_case.returncode == 0:
    errors.append(
        "validate_pr_design_gate.py must reject prefix-spoofed Space visual proof artifact names"
    )
elif "Space visual proof" not in (
    space_fake_shelf_desk_case.stdout + space_fake_shelf_desk_case.stderr
):
    errors.append(
        "validate_pr_design_gate.py prefix-spoofed Space visual proof rejection must explain the required artifact"
    )
