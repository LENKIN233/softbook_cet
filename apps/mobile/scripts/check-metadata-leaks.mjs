#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const appRoot = fs.existsSync(path.join(rootDir, 'src'))
  ? rootDir
  : path.join(rootDir, 'apps/mobile');
const scanRoots = [path.join(appRoot, 'App.tsx'), path.join(appRoot, 'src')];
const visibleCopySourceFiles = [
  path.join(appRoot, 'src/learning/localCardRecords.ts'),
  path.join(appRoot, 'src/learning/model.ts'),
  path.join(appRoot, 'src/shared/uiMetadata/displayMetadata.ts'),
  path.join(appRoot, 'src/space/spaceMetadataDisplay.ts'),
];

const rawMetadataFieldNames =
  'track|libraryName|groupName|boxName|box_ref|boxRef|template_box_prefix|templateBoxPrefix|box_id|boxId|track_availability|trackAvailability|resolved_box_prefixes|resolvedBoxPrefixes|card_template|cardTemplate|card_counts|cardCounts|template_track_placeholder|templateTrackPlaceholder|knowledge_ref|knowledgeRef|interaction_id|interactionId|auto_scoring|autoScoring|answer_key|answerKey|correct_option|correctOption|lock_pattern|lockPattern|correct_items|correctItems|correct_state|correctState|card_id|cardId|sourceLabel|sourceId|source_label|source_id|catalogCards|completedAt|usedHint|usedPeek|flipConfidence|selectedOptionId|lockSelections|eliminatedItemIds|swipeSelection|auth_token|authToken|sms_code|phone_number|day_key|completed_at|used_hint|used_peek|is_favorited|is_sleeping|last_modified_at|lastModifiedAt|checked_in_today|favorite_count|learning_completed_count|pending_review_count|review_completed_count|sleeping_count|total_completed_count|counted_entry_count|countedEntryCount|last_experience_ended_by|recovery_prompt_visible|recoveryPromptVisible|trial_duration_days|trial_started_at_entry_count|trialStartedAtEntryCount|acknowledgedAt|sync_daily_progress|sync_space_state|sync_learning_state|start_membership_trial|refresh_membership|__softbook_mutation_queue|retryCount|apiKey|apiKeyHeader|baseUrl|remoteConfig|requestCodeEndpoint|verifyCodeEndpoint|dismissRecoveryEndpoint|entitlementEndpoint|purchaseEndpoint|startTrialEndpoint|trackQueryParam|__SOFTBOOK_CET_RUNTIME_CONFIG__|__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__|SOFTBOOK_CET_REMOTE_BASE_URL|SOFTBOOK_CET_REMOTE_API_KEY|SOFTBOOK_CET_LEARNING_TRACK|SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES|SOFTBOOK_CET_AUTH_TOKEN|SOFTBOOK_CET_TEST_PHONE|SOFTBOOK_CET_TEST_CODE|SOFTBOOK_CET_SMOKE_ISOLATED_PHONE|SOFTBOOK_CET_SMOKE_WRITE|SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS|SOFTBOOK_CET_EXPECT_INITIAL_STAGE|SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE|SOFTBOOK_CET_EXPECT_PURCHASE_STAGE|SOFTBOOK_CET_IOS_LAUNCH|SOFTBOOK_CET_IOS_DEVICE|SOFTBOOK_CET_IOS_SIMULATOR|SOFTBOOK_CET_IOS_BUNDLE_ID|SOFTBOOK_CET_METRO_PORT|SOFTBOOK_CET_STOP_METRO_ON_EXIT|SOFTBOOK_CET_MANUAL_TEST_PHONE|SOFTBOOK_CET_IOS_MAESTRO_FLOW|SOFTBOOK_CET_MAESTRO_PHONE|SOFTBOOK_CET_MAESTRO_CODE|IOS_SIMULATOR|IOS_DEVICE|IOS_BUNDLE_ID|METRO_PORT|STOP_METRO_ON_EXIT|SMS_CODE|MANUAL_TEST_PHONE|MAESTRO_FLOW|MAESTRO_PHONE|MAESTRO_CODE|SOFTBOOK_API_KEY|SOFTBOOK_SMS_DEV_CODE|SOFTBOOK_AUTH_TOKEN_SECRET|SOFTBOOK_AUTH_TOKEN_TTL_SECONDS|SOFTBOOK_STORE_MODE|CLOUDBASE_ENV_ID|TCB_ENV|SCF_NAMESPACE|CLOUDBASE_COLLECTIONS|cardSources|dailyProgress|learningStates|memberships|spaceStates|softbook_card_sources|softbook_daily_progress|softbook_learning_states|softbook_memberships|softbook_space_states|getDefaultApi|createSoftbookApi|handleCloudBaseEvent|handleHttpRequest|handleRequestCode|handleVerifyCode|handleLearningCardSource|sendJson|createAuthToken|verifyAuthToken|httpError|getHeader|requireObjectBody|requireObject|requireArray|requirePhoneNumber|requireBoolean|requireIsoTimestamp|requireAuthSession|requireNonEmptyString|requireDayKey|requireNonNegativeInteger|requireInteractionId|requireLearningOutcome|requireEnum|parseJson|resolveTokenTtlSeconds|isApiKeyAllowed|assertBodyPhoneMatchesSession|signTokenPayload|base64UrlEncode|base64UrlDecode|safeEqual|parseDailyProgressSnapshot|parseLearningStateSnapshot|parseSpaceStateSnapshot|acknowledgedResponse|parseCloudBaseEvent|parseEventBody|normalizeApiPath|normalizeHeaders|normalizeQuery|parseQueryString|toCloudBaseResponse|jsonResponse|errorResponse|createDefaultStore|createMemoryStore|createCloudBaseStore|createCloudBaseDatabase|getCloudBaseMembership|saveCloudBaseMembership|deserializeMembershipDocument|createInitialMembership|cloneMembership|serializeMembershipEntitlement|getCloudBaseDocument|setCloudBaseDocument|isCloudBaseDocumentMissingError|createCloudBaseDocumentId|getCardRecordsForTrack|CET4_CARD_RECORDS|CET6_CARD_RECORDS|createDefaultCardSource|cloneCardSource|serializeCardSourceResponse|validateCardSourceForImport|normalizeCardSource|normalizeCardRecord|requireCardSourceObject|requireCardSourceArray|requireCardSourceString|requireCardSourcePattern|requireCardSourceTrack|cardSourceError|cloneJson|DEFAULT_SMS_CODE|DEFAULT_TRIAL_DURATION_DAYS|DEFAULT_TOKEN_TTL_SECONDS|DEFAULT_CARD_SOURCE|DEFAULT_ENV_ID|COLLECTION_NAME|DEFAULT_TRACKS|ENV_ID|FUNCTION_NAME|HTTP_PATH|DEFAULT_OUTPUT|DEFAULT_FLOW_DIR|useIsolatedPhone|authTokenFromEnv|enableWrites|enableMembershipMutations|expectedInitialStage|expectedStartTrialStage|expectedPurchaseStage|authHeaders|remoteHeaders|returnedPhoneNumber|requestSmsCode|verifySmsCode|syncDailyProgress|syncLearningState|syncSpaceState|postJson|REQUIRED_CORE_INTERACTIONS|missingInteractions|validateCardRecord|assertPattern|assertTrack|assertArrayLength|assertNonEmptyArray|assertCoreInteractionCoverage|loadMembershipEntitlement|loadLearningCardSource|runMembershipMutation|assertExpectedStage|expectedStage|startMembershipTrial|purchaseMembership|dismissMembershipRecovery|parseEntitlement|assertOk|assertObject|assertString|assertNonNegativeInteger|assertPositiveInteger|normalizeBaseUrl|todayKey|createIsolatedPhoneNumber|firstCard|returnedTrack|itemIds|featureModes|learningTrack|learningSource|progressSync|spaceState|learningState|cardRecords|card_records';

const rawSpaceMetadataFieldNames = 'library|group|box|box_ref|boxRef';
const propertyAccessPattern = String.raw`(?:\.|\?\.)`;
const bracketAccessPattern = String.raw`(?:\?\.\s*)?\[\s*["']`;
const quotedSpaceMetadataReferencePattern = String.raw`\b(?:\w+${propertyAccessPattern})?space_metadata${bracketAccessPattern}(?:${rawSpaceMetadataFieldNames})["']\s*\]`;
const quotedNestedSpaceMetadataReferencePattern = String.raw`\b\w+${bracketAccessPattern}space_metadata["']\s*\]${bracketAccessPattern}(?:${rawSpaceMetadataFieldNames})["']\s*\]`;

const rawMetadataReferencePattern = new RegExp(
  [
    quotedNestedSpaceMetadataReferencePattern,
    quotedSpaceMetadataReferencePattern,
    `\\b\\w+${propertyAccessPattern}space_metadata${propertyAccessPattern}(?:${rawSpaceMetadataFieldNames})\\b`,
    `\\b\\w+${propertyAccessPattern}(?:${rawMetadataFieldNames})\\b`,
    `\\b(?:${rawMetadataFieldNames})\\b`,
  ].join('|'),
);

const visibleCopyPropNames = [
  'aria-label',
  'aria-valuetext',
  'accessibilityHint',
  'accessibilityLabel',
  'accessibilityValue',
  'body',
  'caption',
  'description',
  'detail',
  'emptyMessage',
  'emptyTitle',
  'hint',
  'items',
  'label',
  'message',
  'placeholder',
  'primaryActionLabel',
  'secondaryActionLabel',
  'summary',
  'text',
  'title',
  'value',
];

const visiblePropPattern =
  new RegExp(`\\b(?:${visibleCopyPropNames.join('|')})\\s*(?::|=(?!=|>))`);

const visiblePropOpenPattern = new RegExp(
  `\\b(?:${visibleCopyPropNames.join('|')})\\s*(?::|=(?!=|>))\\s*(?:\\{|\\(|$)`,
);

const visiblePropTemplateOpenPattern = new RegExp(
  `\\b(?:${visibleCopyPropNames.join('|')})\\s*(?::|=(?!=|>))\\s*\\x60`,
);

const rawMetadataExpressionPattern =
  new RegExp(
    `${rawMetadataReferencePattern.source}|\\bspace_metadata${propertyAccessPattern}(?:${rawSpaceMetadataFieldNames})\\b|track\\.toUpperCase\\(`,
  );

const renderedMetadataPropNames = [
  'testID',
  'nativeID',
  'accessibilityLabelledBy',
  'aria-labelledby',
];

const renderedMetadataPropPattern = new RegExp(
  `(?:${renderedMetadataPropNames.join('|')})\\s*=\\s*\\{(?:\`[^\`]*\\$\\{[^\`]*(?:${rawMetadataExpressionPattern.source})[^\`]*\\}[^\`]*\`|[^}\`\\n]*(?:${rawMetadataExpressionPattern.source})[^}\`\\n]*)\\}`,
);

const renderedMetadataStringPropPattern = new RegExp(
  `(?:${renderedMetadataPropNames.join('|')})\\s*=\\s*["'][^"'\\n]*(?:${rawMetadataExpressionPattern.source})[^"'\\n]*["']`,
);

const renderedMetadataPropOpenPattern = new RegExp(
  `\\b(?:${renderedMetadataPropNames.join('|')})\\s*=\\s*(?:\\{|\\(|$)`,
);

const allowedDisplayMetadataLookupPattern =
  /\bINTERACTION_LABELS\s*\[[^\]]*\b(?:interaction_id|interactionId)\b[^\]]*\]/g;

const visibleCardContentLeakPattern =
  /\bCET[46]\b|(?:听力|阅读|写作|翻译|词汇|仔细阅读|快速阅读|学习馆|知识组|训练轨道|原盒位|卡组)|\b0\d{3,6}\b/;

const visibleDesignJargonLeakPattern =
  /\b(?:SHELL|FLOW|GATE|SETUP|PROFILE|STATUS|SYNC)\b|顶层|入口|最重要|服务核心价值|账户与会员|壳层|页面内部|最小必要信息|首读路径|低成本|轻量|会员边界|主要任务|复杂设置中心|模块选择|复杂大盘|复杂管理器|承接|权限|主路径|单卡流|学习流|本组第|这一组学习卡|这组回看卡|这一组已经按学习节奏走完|再练一轮这一组|回看这一组|product_truth|implementation_hypothesis|design artifact|harness|Agent review|PR 描述/i;

const internalGuardLinePattern =
  /INTERNAL_ERROR_COPY_PATTERN|visibleDesignJargonLeakPattern/;

const visibleStringLinePattern =
  new RegExp(
    `(?:<Text\\b|>[^<]*(?:<\\/Text>|$)|\\b(?:${[
      ...visibleCopyPropNames,
      'eyebrow',
    ].join('|')})\\s*[:=]|^['"\\x60].*[,)'"\\x60]?$)`,
  );

const nonVisibleDesignJargonLinePattern =
  /^(?:import\b|export\b|type\b|interface\b|const\b|let\b|var\b|function\b|case\b|switch\b|if\b|return\b|[A-Za-z0-9_]+[,:])|\b(?:testID|nativeID|status|gate)\s*=/;

const directDisplayMetadataPatterns = [
  {
    pattern: /\b\w*Track\.toUpperCase\(\)/,
    reason: 'raw learning track transformed for display',
  },
  {
    pattern: renderedMetadataPropPattern,
    transform: stripAllowedMetadataDisplayLookups,
    reason: 'raw metadata embedded in rendered element props',
  },
  {
    pattern: renderedMetadataStringPropPattern,
    transform: stripAllowedMetadataDisplayLookups,
    reason: 'raw metadata embedded in static rendered element props',
  },
  {
    pattern: /(?:\bCET[46]\b|学习馆|知识组|训练轨道|原盒位)/,
    reason: 'semantic space metadata term in visible copy',
  },
];

function walkSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      walkSourceFiles(path.join(dir, entry.name), files);
      continue;
    }

    if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(path.join(dir, entry.name));
    }
  }

  return files;
}

function collectSourceFiles() {
  return scanRoots.flatMap(scanRoot => {
    if (!fs.existsSync(scanRoot)) {
      return [];
    }

    if (fs.statSync(scanRoot).isFile()) {
      return /\.(?:ts|tsx)$/.test(scanRoot) && !scanRoot.endsWith('.d.ts')
        ? [scanRoot]
        : [];
    }

    return walkSourceFiles(scanRoot);
  });
}

function collectVisibleCopySourceFiles() {
  return visibleCopySourceFiles.filter(filePath => fs.existsSync(filePath));
}

function hasUnclosedTemplateLiteral(text) {
  const templateLiteralTicks = text.match(/(?<!\\)`/g) ?? [];
  return templateLiteralTicks.length % 2 === 1;
}

function hasUnclosedJsxPropExpression(text) {
  return (
    /[{(]\s*$/.test(text) ||
    (text.includes('{') && !text.includes('}')) ||
    hasUnclosedTemplateLiteral(text)
  );
}

function stripAllowedMetadataDisplayLookups(text) {
  return text.replace(allowedDisplayMetadataLookupPattern, 'INTERACTION_LABEL');
}

function hasRawMetadataExpression(text) {
  return rawMetadataExpressionPattern.test(stripAllowedMetadataDisplayLookups(text));
}

function checkTextNodeMetadata(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const findings = [];
  let inTextNode = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.includes('<Text') || trimmed.includes('<Text ')) {
      inTextNode = true;
    }

    const isStyleOnlyName =
      /\bstyles\.(?:libraryName|groupName|boxName)\b/.test(trimmed);

    if (
      inTextNode &&
      hasRawMetadataExpression(trimmed) &&
      !isStyleOnlyName
    ) {
      findings.push({
        filePath,
        line: index + 1,
        text: trimmed,
        reason: 'raw metadata leaked in Text display node',
      });
    }

    if (trimmed.includes('</Text>')) {
      inTextNode = false;
    }
  }

  return findings;
}

function checkDirectDisplayMetadata(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const findings = [];
  let inInternalGuardDeclaration = false;
  let inInternalErrorExpression = false;
  let pendingVisibleCopyProp = null;
  let pendingRenderedMetadataProp = null;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();
    const opensInternalErrorExpression = /\bnew Error\(/.test(text);
    const isInternalGuardLine =
      inInternalGuardDeclaration ||
      inInternalErrorExpression ||
      opensInternalErrorExpression ||
      internalGuardLinePattern.test(text);

    if (/const INTERNAL_ERROR_COPY_PATTERN\b/.test(text)) {
      inInternalGuardDeclaration = true;
      continue;
    }

    if (opensInternalErrorExpression) {
      inInternalErrorExpression = true;
    }

    if (
      pendingVisibleCopyProp &&
      !isInternalGuardLine &&
      hasRawMetadataExpression(text)
    ) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: 'raw metadata passed through multiline visible or accessibility copy prop',
      });
      pendingVisibleCopyProp = null;
    }

    if (
      pendingRenderedMetadataProp &&
      !isInternalGuardLine &&
      hasRawMetadataExpression(text)
    ) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: 'raw metadata passed through multiline rendered element prop',
      });
      pendingRenderedMetadataProp = null;
    }

    if (
      !isInternalGuardLine &&
      visiblePropPattern.test(text) &&
      hasRawMetadataExpression(text)
    ) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: 'raw metadata passed through visible or accessibility copy prop',
      });
    }

    if (
      !isInternalGuardLine &&
      ((visiblePropOpenPattern.test(text) &&
        hasUnclosedJsxPropExpression(text)) ||
        (visiblePropTemplateOpenPattern.test(text) &&
          hasUnclosedTemplateLiteral(text))) &&
      !hasRawMetadataExpression(text)
    ) {
      pendingVisibleCopyProp = { remainingLines: 4 };
    } else if (pendingVisibleCopyProp) {
      pendingVisibleCopyProp.remainingLines -= 1;
      if (
        pendingVisibleCopyProp.remainingLines <= 0 ||
        /^[})\]],?$/.test(text)
      ) {
        pendingVisibleCopyProp = null;
      }
    }

    if (
      !isInternalGuardLine &&
      renderedMetadataPropOpenPattern.test(text) &&
      hasUnclosedJsxPropExpression(text) &&
      !hasRawMetadataExpression(text)
    ) {
      pendingRenderedMetadataProp = { remainingLines: 4 };
    } else if (pendingRenderedMetadataProp) {
      pendingRenderedMetadataProp.remainingLines -= 1;
      if (
        pendingRenderedMetadataProp.remainingLines <= 0 ||
        /^[})\]],?$/.test(text)
      ) {
        pendingRenderedMetadataProp = null;
      }
    }

    const rule = directDisplayMetadataPatterns.find(({ pattern, transform }) =>
      pattern.test(transform ? transform(text) : text),
    );

    if (rule && !isInternalGuardLine) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: rule.reason,
      });
    }

    if (
      visibleStringLinePattern.test(text) &&
      visibleDesignJargonLeakPattern.test(text) &&
      !isInternalGuardLine &&
      !nonVisibleDesignJargonLinePattern.test(text)
    ) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: 'internal design or implementation jargon in visible copy',
      });
    }

    if (inInternalGuardDeclaration && /\/[a-z]*;?$/.test(text)) {
      inInternalGuardDeclaration = false;
    }

    if (inInternalErrorExpression && /\);?$/.test(text)) {
      inInternalErrorExpression = false;
    }
  }

  return findings;
}

function checkVisibleCopySourceMetadata(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const findings = [];
  let inSpaceMetadata = false;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();

    if (text.startsWith('space_metadata:')) {
      inSpaceMetadata = true;
      continue;
    }

    if (inSpaceMetadata && text === '},') {
      inSpaceMetadata = false;
      continue;
    }

    if (inSpaceMetadata) {
      continue;
    }

    if (
      /^(card_id|knowledge_ref|track):/.test(text) ||
      /^import\b/.test(text)
    ) {
      continue;
    }

    if (visibleCardContentLeakPattern.test(text)) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: 'raw metadata leaked through visible copy source',
      });
    }
  }

  return findings;
}

function collectFindings() {
  const files = collectSourceFiles();
  const allFindings = files.flatMap(file => [
    ...checkTextNodeMetadata(file),
    ...checkDirectDisplayMetadata(file),
  ]);
  const visibleCopySourceFindings = collectVisibleCopySourceFiles().flatMap(file =>
    checkVisibleCopySourceMetadata(file),
  );
  return [...allFindings, ...visibleCopySourceFindings];
}

function formatFindings(findings) {
  if (findings.length === 0) {
    return 'PASS: No metadata leaks detected in visible text.';
  }

  const grouped = findings.reduce((carry, item) => {
    const key = item.filePath;
    if (!carry[key]) {
      carry[key] = [];
    }
    carry[key].push(item);
    return carry;
  }, {});

  const lines = [
    'FAIL: Visual metadata leak candidates detected.',
    ...Object.entries(grouped).flatMap(([filePath, values]) => [
      `- ${path.relative(rootDir, filePath)}`,
      ...values.map(
        ({ line, reason, text }) =>
          `  line ${line}: ${reason}\n    ${text.slice(0, 160)}`,
      ),
    ]),
  ];

  return lines.join('\n');
}

const findings = collectFindings();
console.log(formatFindings(findings));

if (findings.length > 0) {
  process.exit(1);
}
