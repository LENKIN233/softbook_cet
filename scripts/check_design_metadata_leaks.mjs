#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const defaultRepoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');

function parseArgs(argv) {
  let repoRoot = defaultRepoRoot;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== '--root') {
      throw new Error(`unknown argument: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('--root requires a path');
    }
    repoRoot = path.resolve(value);
    index += 1;
  }

  return repoRoot;
}

let repoRoot;
try {
  repoRoot = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(2);
}

const scanRoots = [
  'docs/design/directions',
  'docs/design/interaction-motion',
  'docs/design/physical-space',
  'docs/design/mocks',
  'docs/design/storyboards',
  'docs/design/search-runs',
];

const visualReferenceFiles = ['docs/design/visual-reference.html'];

const maxReportedFindings = 160;

const excludedPathPatterns = [
  /\/README\.md$/,
  /\/templates\//,
];

const textFilePattern = /\.(html|md|svg)$/;

const metadataFieldPattern =
  /\b(?:space_metadata|spaceMetadata|box_ref|boxRef|template_box_prefix|templateBoxPrefix|box_id|boxId|track_availability|trackAvailability|resolved_box_prefixes|resolvedBoxPrefixes|card_template|cardTemplate|card_counts|cardCounts|template_track_placeholder|templateTrackPlaceholder|knowledge_ref|knowledgeRef|interaction_id|interactionId|auto_scoring|autoScoring|answer_key|answerKey|correct_option|correctOption|lock_pattern|lockPattern|correct_items|correctItems|correct_state|correctState|card_id|cardId|source_id|sourceId|source_label|sourceLabel|catalogCards|completedAt|usedHint|usedPeek|card_records|cardRecords|flipConfidence|selectedOptionId|lockSelections|eliminatedItemIds|swipeSelection|auth_token|authToken|access_token|accessToken|accessTokenExpiresAt|refresh_token|refreshToken|refreshExpiresAt|challenge_id|challengeId|session_id|sessionId|selection_id|selectionId|scheduler_version|schedulerVersion|scheduler_by_card_id|schedulerByCardId|next_due_at|nextDueAt|learning_acknowledged_at|learningAcknowledgedAt|token_type|tokenType|sms_code|phone_number|day_key|completed_at|used_hint|used_peek|is_favorited|is_sleeping|last_modified_at|lastModifiedAt|checked_in_today|favorite_count|learning_completed_count|pending_review_count|review_completed_count|sleeping_count|total_completed_count|counted_entry_count|countedEntryCount|last_experience_ended_by|recovery_prompt_visible|recoveryPromptVisible|trial_duration_days|trial_started_at_entry_count|trialStartedAtEntryCount|acknowledgedAt|sync_daily_progress|sync_space_state|sync_learning_state|start_membership_trial|refresh_membership|__softbook_mutation_queue|__softbook_learning_event_outbox_v1|__softbook_learning_event_outbox_v2|retryCount|apiKey|apiKeyHeader|baseUrl|remoteConfig|requestCodeEndpoint|verifyCodeEndpoint|dismissRecoveryEndpoint|entitlementEndpoint|purchaseEndpoint|startTrialEndpoint|trackQueryParam|contentManifest|contentManifestPublicKeys|__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__|SOFTBOOK_CET_REMOTE_BASE_URL|SOFTBOOK_CET_REMOTE_API_KEY|SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS|SOFTBOOK_CET_LEARNING_TRACK|SOFTBOOK_CET_AUTH_TOKEN|SOFTBOOK_CET_TEST_PHONE|SOFTBOOK_CET_TEST_CODE|SOFTBOOK_CET_SMOKE_ISOLATED_PHONE|SOFTBOOK_CET_SMOKE_WRITE|SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS|SOFTBOOK_CET_EXPECT_INITIAL_STAGE|SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE|SOFTBOOK_CET_EXPECT_PURCHASE_STAGE|SOFTBOOK_CET_IOS_LAUNCH|SOFTBOOK_CET_IOS_DEVICE|SOFTBOOK_CET_IOS_SIMULATOR|SOFTBOOK_CET_IOS_BUNDLE_ID|SOFTBOOK_CET_METRO_PORT|SOFTBOOK_CET_STOP_METRO_ON_EXIT|SOFTBOOK_CET_MANUAL_TEST_PHONE|SOFTBOOK_CET_IOS_MAESTRO_FLOW|SOFTBOOK_CET_MAESTRO_PHONE|SOFTBOOK_CET_MAESTRO_CODE|IOS_SIMULATOR|IOS_DEVICE|IOS_BUNDLE_ID|METRO_PORT|STOP_METRO_ON_EXIT|SMS_CODE|MANUAL_TEST_PHONE|MAESTRO_FLOW|MAESTRO_PHONE|MAESTRO_CODE|CLOUDBASE_COLLECTIONS|cardSources|dailyProgress|learningStates|learningSessions|memberships|spaceStates|softbook_card_sources|softbook_daily_progress|softbook_learning_states|softbook_learning_sessions|softbook_memberships|softbook_space_states|getCardSource|getMembership|startTrial|dismissRecovery|saveDailyProgress|saveLearningState|saveSpaceState|acknowledged_at|updated_at|events_by_card_id|states_by_card_id|documentId|eventsByCardId|statesByCardId|server_sequence|eventObject|stateObject|not_found|invalid_api_key|invalid_sms_code|invalid_track|DOCUMENT_NOT_EXIST|invalid_card_source|missing_auth_token|invalid_auth_token|expired_auth_token|phone_number_mismatch|internal_error|invalid_request|invalid_json|isBase64Encoded|tokenSecret|tokenTtlSeconds|issuedAt|encodedPayload|expectedSignature|leftBuffer|rightBuffer|trial_available|lock_slots|elimination_items|swipe_states|optionIds|lockSlots|eliminationItems|swipeStates|defaultCardSource|expectedTrack|hintLayer|headers|httpMethod|rawPath|rawQueryString|queryStringParameters|queryString|pathname|v1Index|fieldName|statusCode|requestContext|defaultApi|overrideValue|envValue|storeMode|DEFAULT_SMS_CODE|DEFAULT_TRIAL_DURATION_DAYS|DEFAULT_TOKEN_TTL_SECONDS|DEFAULT_CARD_SOURCE|getDefaultApi|createSoftbookApi|handleCloudBaseEvent|handleHttpRequest|handleRequestCode|handleVerifyCode|handleLearningCardSource|sendJson|createAuthToken|verifyAuthToken|httpError|getHeader|requireObjectBody|requireObject|requireArray|requirePhoneNumber|requireBoolean|requireIsoTimestamp|requireAuthSession|requireNonEmptyString|requireDayKey|requireNonNegativeInteger|requireInteractionId|requireLearningOutcome|requireEnum|parseJson|resolveTokenTtlSeconds|isApiKeyAllowed|assertBodyPhoneMatchesSession|signTokenPayload|base64UrlEncode|base64UrlDecode|safeEqual|parseDailyProgressSnapshot|parseLearningStateSnapshot|parseSpaceStateSnapshot|acknowledgedResponse|parseCloudBaseEvent|parseEventBody|normalizeApiPath|normalizeHeaders|normalizeQuery|parseQueryString|toCloudBaseResponse|jsonResponse|errorResponse|createDefaultStore|createMemoryStore|createCloudBaseStore|createCloudBaseDatabase|getCloudBaseMembership|saveCloudBaseMembership|deserializeMembershipDocument|createInitialMembership|cloneMembership|serializeMembershipEntitlement|getCloudBaseDocument|setCloudBaseDocument|isCloudBaseDocumentMissingError|createCloudBaseDocumentId|getCardRecordsForTrack|CET4_CARD_RECORDS|CET6_CARD_RECORDS|createDefaultCardSource|cloneCardSource|serializeCardSourceResponse|validateCardSourceForImport|normalizeCardSource|normalizeCardRecord|requireCardSourceObject|requireCardSourceArray|requireCardSourceString|requireCardSourcePattern|requireCardSourceTrack|cardSourceError|cloneJson|DEFAULT_ENV_ID|COLLECTION_NAME|DEFAULT_TRACKS|ENV_ID|FUNCTION_NAME|HTTP_PATH|DEFAULT_OUTPUT|DEFAULT_FLOW_DIR|useIsolatedPhone|phoneNumber|smsCode|authTokenFromEnv|enableWrites|enableMembershipMutations|expectedInitialStage|expectedStartTrialStage|expectedPurchaseStage|authHeaders|remoteHeaders|returnedPhoneNumber|requestSmsCode|verifySmsCode|syncDailyProgress|syncLearningState|syncSpaceState|postJson|REQUIRED_CORE_INTERACTIONS|missingInteractions|validateCardRecord|assertPattern|assertTrack|assertArrayLength|assertNonEmptyArray|assertCoreInteractionCoverage|loadMembershipEntitlement|loadLearningCardSource|runMembershipMutation|assertExpectedStage|expectedStage|startMembershipTrial|purchaseMembership|dismissMembershipRecovery|parseEntitlement|assertOk|assertObject|assertString|assertNonNegativeInteger|assertPositiveInteger|normalizeBaseUrl|todayKey|createIsolatedPhoneNumber|firstCard|returnedTrack|itemIds|featureModes|learningTrack|learningSource|progressSync|spaceState|learningState|track)\b/i;
const spaceActionMetadataFieldPattern =
  /\b(?:action_id|actionId|apply_space_action|applySpaceAction|parseSpaceActionAck|commitSpaceActions|spaceActions|softbook_space_actions)\b/i;
const schedulerWatermarkFieldPattern =
  /\b(?:learning_server_sequence|learningServerSequence)\b/i;
const dailyCheckInMetadataFieldPattern =
  /\b(?:check_in_daily_progress|dailyCheckIns|softbook_daily_check_ins|checkInDailyProgress|assertLegacySnapshotWritesDisabled)\b/i;
const betaEntitlementMetadataFieldPattern =
  /\b(?:betaEntitlements|softbook_beta_entitlements)\b/i;

const processLeakTermPattern =
  /(^|[^A-Za-z0-9])(?:agent|harness|validator|runtime|mock|prototype|seed|fixture|debug|dev|todo|implementation|repository|repo|pull request|pr|rn|endpoint|payload)(?=$|[^A-Za-z0-9])/i;

function normalizeCamelCaseText(text) {
  return text
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

// spec/knowledge-map.json owns these canonical library names. In learner-facing
// UI, the public label is the canonical name plus “馆”. Mask only those exact
// public forms before checking raw library names; group/box labels, ids,
// metadata fields, and standalone library names remain subject to quarantine.
const canonicalPublicLibraryLabels = [
  '听力馆',
  '仔细阅读馆',
  '选词填空馆',
  '写作馆',
  '翻译馆',
  '词汇馆',
  '语法馆',
];

function maskCanonicalPublicLibraryLabels(text) {
  return canonicalPublicLibraryLabels.reduce(
    (masked, label) => masked.replaceAll(label, 'PUBLIC_LIBRARY_LABEL'),
    text,
  );
}

const rawStandaloneChineseLibraryPattern =
  /(?<!\p{Script=Han})(?:仔细阅读|选词填空|听力|写作|翻译|词汇|语法|阅读)(?!\p{Script=Han})/u;

const rawStandaloneChineseGroupOrBoxPattern =
  /(?<!\p{Script=Han})(?:长难句关键修饰|阅读高频词|词义辨析组|语义关系盒|同义词替换|句式替换|长难句主干|逻辑关系|转折关系|主谓宾|高频词|定语)(?!\p{Script=Han})/u;

const leakagePatterns = [
  {
    pattern: /#(?:5b6df5|ff8a3d|b568f5|18c4e0|f15b6e)\b/i,
    reason: 'known library identity hex in visual design artifact',
  },
  {
    pattern:
      /(?:第一馆\s*1|馆\s*1(?:对象|节奏|主线|卡)|library-1\s*\/\s*current\s*\/\s*focus-area|current\s*\/\s*group-1\s*\/\s*盒\s*1|本轮\s*\/\s*馆\s*1\s*\/\s*盒\s*1\s*\/\s*盒\s*1)/i,
    reason: 'broken replacement residue in design authority or visual artifact',
  },
  {
    pattern:
      /(?:group-1|\bbox\s+id\b|\bcard\s+id\b|Detail Evidence|argument support|Current drawer|Original box|same box sibling|Very Long Detail Evidence|Long Detail Evidence)/i,
    reason: 'raw semantic group/box/card label in visual design artifact',
  },
  {
    pattern: rawStandaloneChineseGroupOrBoxPattern,
    reason: 'standalone raw Chinese group/box label in visual design artifact',
  },
  {
    pattern: /\bCET[46]\b(?!\/6)/i,
    reason: 'raw CET track value in visual design artifact',
  },
  {
    pattern: rawStandaloneChineseLibraryPattern,
    normalize: maskCanonicalPublicLibraryLabels,
    reason: 'standalone raw Chinese library label in visual design artifact',
  },
  {
    pattern: /(?:阅读馆|快速阅读|定位词抓取|细节题|细节定位盒)/,
    normalize: maskCanonicalPublicLibraryLabels,
    reason: 'raw Chinese group/box or non-canonical library label in visual design artifact',
  },
  {
    pattern:
      /\b(?:listening|reading|writing|translation|vocabulary|locating-keywords)\b/i,
    reason: 'raw English library/group label in visual design artifact',
  },
  {
    pattern: metadataFieldPattern,
    reason: 'raw metadata field name in visual design artifact',
  },
  {
    pattern: spaceActionMetadataFieldPattern,
    reason: 'raw physical-space action field in visual design artifact',
  },
  {
    pattern: schedulerWatermarkFieldPattern,
    reason: 'raw scheduler watermark field name in visual design artifact',
  },
  {
    pattern: dailyCheckInMetadataFieldPattern,
    reason: 'raw daily check-in storage field in visual design artifact',
  },
  {
    pattern: betaEntitlementMetadataFieldPattern,
    reason: 'raw beta entitlement storage field in visual design artifact',
  },
  {
    pattern: /\b(?:0\d{3,5}|R-\d{1,3})\b/i,
    reason: 'raw box/card reference in visual design artifact',
  },
  {
    pattern: /--(?:listening|reading|writing|translation|vocabulary)\b/i,
    reason: 'semantic library color token in rendered proof source',
  },
];

const visibleHtmlLeakagePatterns = [
  {
    pattern: processLeakTermPattern,
    normalize: normalizeCamelCaseText,
    reason: 'internal process or implementation term in rendered visual proof',
  },
  {
    pattern: /\b(?:docs|apps|scripts|spec|infra)\/[A-Za-z0-9_./-]+/i,
    reason: 'repo path in rendered visual proof',
  },
];

const learnerSurfaceLeakagePatterns = [
  {
    pattern: /本(?:证明|原型|测试|审查)|服务端|本地计数|完整算法|当前知识对象|当前对象|共享同一个知识对象/,
    reason: 'review, implementation, or data-model language in learner surface',
  },
  {
    pattern: /主动作|焦点(?:已|回到|移到)|重复操作|已阻止|状态已退出|操作已收起|拥有当前卡|仍由[^。；]*拥有/,
    reason: 'QA or state-machine narration in learner surface',
  },
  {
    pattern: /第\s*\d+\s*盒/,
    reason: 'raw numeric box reference in learner surface',
  },
  {
    pattern: /(?:未越过|越过)阈值|方向键预览|回车提交|键盘可用|按\s*Escape/,
    reason: 'test-input instruction in learner surface',
  },
  {
    pattern: /认证门|自动内联解析/,
    reason: 'internal interaction or routing label in learner surface',
  },
];

const namedHtmlEntities = {
  amp: '&',
  bull: ' · ',
  gt: '>',
  lt: '<',
  middot: ' · ',
  nbsp: ' ',
  rarr: ' -> ',
  rightarrow: ' -> ',
  sol: '/',
};

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath, files);
      continue;
    }

    if (textFilePattern.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function decodeHtmlEntities(text) {
  return text.replace(
    /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]+);/gi,
    (entity, value) => {
      const normalized = value.toLowerCase();

      if (normalized.startsWith('#x')) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : entity;
      }

      if (normalized.startsWith('#')) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : entity;
      }

      return namedHtmlEntities[normalized] ?? entity;
    },
  );
}

function visibleHtmlText(source) {
  return decodeHtmlEntities(source)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function structuralHtmlSource(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
}

function hasHtmlAttribute(attributeSource, attributeName) {
  const attributePattern =
    /(?:^|\s)([^\s"'<>\/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let match;

  while ((match = attributePattern.exec(attributeSource)) !== null) {
    if (match[1].toLowerCase() === attributeName) {
      return true;
    }
  }

  return false;
}

function learnerSurfaceMarkup(source) {
  const values = [];
  const templatePattern =
    /<template\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/template\s*>/gi;
  let match;

  const structuralSource = structuralHtmlSource(source);
  while ((match = templatePattern.exec(structuralSource)) !== null) {
    if (hasHtmlAttribute(match[1], 'data-learner-surface')) {
      values.push(match[2]);
    }
  }

  return values.join(' ');
}

function hasStructuralLearnerSurfaceMarker(source) {
  const elementPattern =
    /<([A-Za-z][A-Za-z0-9:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/g;
  let match;

  const structuralSource = structuralHtmlSource(source);
  while ((match = elementPattern.exec(structuralSource)) !== null) {
    if (
      match[1].toLowerCase() === 'main' &&
      hasHtmlAttribute(match[2], 'data-learner-surface')
    ) {
      return true;
    }
  }

  return false;
}

function htmlDocumentAudience(source) {
  const structuralSource = structuralHtmlSource(source);
  const elementPattern =
    /<([A-Za-z][A-Za-z0-9:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/g;
  const bodyAttributeSources = [];
  let elementMatch;

  while ((elementMatch = elementPattern.exec(structuralSource)) !== null) {
    if (elementMatch[1].toLowerCase() === 'body') {
      bodyAttributeSources.push(elementMatch[2]);
    }
  }

  // Fail closed when malformed source contains zero or multiple structural
  // body elements. In particular, reviewer classification must never come
  // from a body-looking string in a comment, script, style, or attribute.
  if (bodyAttributeSources.length !== 1) {
    return '';
  }

  const audienceValues = [];
  const attributePattern =
    /(?:^|\s)([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let attributeMatch;

  while (
    (attributeMatch = attributePattern.exec(bodyAttributeSources[0])) !== null
  ) {
    if (attributeMatch[1].toLowerCase() === 'data-audience') {
      audienceValues.push(
        attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? '',
      );
    }
  }

  if (audienceValues.length !== 1) {
    return '';
  }

  return audienceValues[0].trim().toLowerCase();
}

function inlineScriptSource(source) {
  const values = [];
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(source)) !== null) {
    values.push(match[1]);
  }

  return values.join(' ');
}

const visibleAttributeNames = [
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'alt',
  'placeholder',
  'title',
  'value',
];

function visibleAttributeText(source) {
  const attributePattern = new RegExp(
    `\\b(?:${visibleAttributeNames.join('|')})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'<>]+))`,
    'gi',
  );
  const values = [];
  let match;

  while ((match = attributePattern.exec(source)) !== null) {
    values.push(match[1] ?? match[2] ?? match[3] ?? '');
  }

  return decodeHtmlEntities(values.join(' ')).replace(/\s+/g, ' ').trim();
}

function decodeCssEscapes(text) {
  return text
    .replace(
      /\\([0-9a-f]{1,6})(?:\r\n|[\t\n\r\f ])?/gi,
      (escape, hex) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : escape;
      },
    )
    .replace(/\\([\s\S])/g, '$1');
}

function cssGeneratedStringValues(source) {
  const contentDeclarationPattern = /\bcontent\s*:\s*([^;{}]+)/gi;
  const values = [];
  let declarationMatch;

  while ((declarationMatch = contentDeclarationPattern.exec(source)) !== null) {
    const stringPattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g;
    let stringMatch;

    while ((stringMatch = stringPattern.exec(declarationMatch[1])) !== null) {
      values.push(decodeCssEscapes(stringMatch[1] ?? stringMatch[2] ?? ''));
    }
  }

  return values;
}

function cssGeneratedAttrNames(source) {
  const contentDeclarationPattern = /\bcontent\s*:\s*([^;{}]+)/gi;
  const names = new Set();
  let declarationMatch;

  while ((declarationMatch = contentDeclarationPattern.exec(source)) !== null) {
    const attrPattern = /\battr\(\s*([A-Za-z_:][-A-Za-z0-9_:.]*)/gi;
    let attrMatch;

    while ((attrMatch = attrPattern.exec(declarationMatch[1])) !== null) {
      names.add(attrMatch[1].toLowerCase());
    }
  }

  return names;
}

function cssGeneratedVarNames(source) {
  const contentDeclarationPattern = /\bcontent\s*:\s*([^;{}]+)/gi;
  const names = new Set();
  let declarationMatch;

  while ((declarationMatch = contentDeclarationPattern.exec(source)) !== null) {
    const varPattern = /\bvar\(\s*(--[-A-Za-z0-9_]+)/gi;
    let varMatch;

    while ((varMatch = varPattern.exec(declarationMatch[1])) !== null) {
      names.add(varMatch[1].toLowerCase());
    }
  }

  return names;
}

function attributeValues(source, names) {
  if (names.size === 0) {
    return [];
  }

  const values = [];
  const attributePattern =
    /\b([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))/gi;
  let match;

  while ((match = attributePattern.exec(source)) !== null) {
    if (names.has(match[1].toLowerCase())) {
      values.push(match[2] ?? match[3] ?? match[4] ?? '');
    }
  }

  return values;
}

function cssVariableStringValues(source, names) {
  if (names.size === 0) {
    return [];
  }

  const values = [];
  const variablePattern =
    /(?:^|[;{\s])(--[-A-Za-z0-9_]+)\s*:\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/gi;
  let match;

  while ((match = variablePattern.exec(source)) !== null) {
    if (names.has(match[1].toLowerCase())) {
      values.push(decodeCssEscapes(match[2] ?? match[3] ?? ''));
    }
  }

  return values;
}

function cssGeneratedText(source) {
  const values = cssGeneratedStringValues(source);

  values.push(...attributeValues(source, cssGeneratedAttrNames(source)));
  values.push(...cssVariableStringValues(source, cssGeneratedVarNames(source)));

  return decodeHtmlEntities(values.join(' ')).replace(/\s+/g, ' ').trim();
}

function scanText(filePath, source) {
  const suffix = path.extname(filePath).toLowerCase();
  const scanTargets =
    suffix === '.html' || suffix === '.svg'
      ? [
          {
            kind: 'visible text',
            text: visibleHtmlText(source),
            rules: [...leakagePatterns, ...visibleHtmlLeakagePatterns],
          },
          {
            kind: 'accessibility text',
            text: visibleAttributeText(source),
            rules: [...leakagePatterns, ...visibleHtmlLeakagePatterns],
          },
          {
            kind: 'generated content',
            text: cssGeneratedText(source),
            rules: [...leakagePatterns, ...visibleHtmlLeakagePatterns],
          },
          { kind: 'source token', text: source, rules: leakagePatterns },
        ]
      : [{ kind: 'markdown text', text: source, rules: leakagePatterns }];
  const findings = [];

  for (const target of scanTargets) {
    const lines = target.text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      for (const rule of target.rules) {
        const ruleText = rule.normalize ? rule.normalize(line) : line;
        if (rule.pattern.test(ruleText)) {
          findings.push({
            filePath,
            kind: target.kind,
            line: lineIndex + 1,
            reason: rule.reason,
            text: line.trim().slice(0, 220),
          });
          break;
        }
      }
    }
  }

  return findings;
}

function scanVisibleHtmlProcessText(filePath, source) {
  const lines =
    `${visibleHtmlText(source)} ${visibleAttributeText(source)} ${cssGeneratedText(
      source,
    )}`.split(/\r?\n/);
  const findings = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const rule of visibleHtmlLeakagePatterns) {
      const ruleText = rule.normalize ? rule.normalize(line) : line;
      if (rule.pattern.test(ruleText)) {
        findings.push({
          filePath,
          kind: 'visible text',
          line: lineIndex + 1,
          reason: rule.reason,
          text: line.trim().slice(0, 220),
        });
        break;
      }
    }
  }

  return findings;
}

function scanLearnerSurfaceCopy(filePath, source) {
  const documentAudience = htmlDocumentAudience(source);
  const learnerTemplateMarkup = learnerSurfaceMarkup(source);
  const hasLearnerTemplate = learnerTemplateMarkup.length > 0;
  const hasStructuralLearnerRoot = hasStructuralLearnerSurfaceMarker(source);
  const hasLearnerSurfaceMarker =
    hasLearnerTemplate || hasStructuralLearnerRoot;

  // A structural learner application root is publishable learner content, not
  // a reviewer-template convenience. It must be owned by exactly one learner
  // body. Missing, duplicate, conflicting, reviewer, or multi-body audience
  // markup therefore fails closed before any copy-scoping decision.
  if (hasStructuralLearnerRoot && documentAudience !== 'learner') {
    return [
      {
        filePath,
        kind: 'learner boundary',
        line: 1,
        reason:
          'structural learner root requires exactly one data-audience="learner" body',
        text: 'data-learner-surface',
      },
    ];
  }

  if (!hasLearnerSurfaceMarker && documentAudience !== 'learner') {
    return [];
  }

  if (!hasLearnerSurfaceMarker) {
    return [
      {
        filePath,
        kind: 'learner boundary',
        line: 1,
        reason: 'learner document is missing the required data-learner-surface marker',
        text: 'data-audience="learner"',
      },
    ];
  }

  const reviewerOnlyShell = documentAudience === 'reviewer';
  const staticScope = reviewerOnlyShell ? learnerTemplateMarkup : source;
  const scanTargets = [
    { kind: 'learner-visible text', text: visibleHtmlText(staticScope) },
    { kind: 'learner accessibility text', text: visibleAttributeText(staticScope) },
  ];

  // A reviewer shell may intentionally contain audit narration in its own CSS
  // and JavaScript. Its marked learner template is still scanned above, while
  // a learner or unmarked document fails closed across all generated/dynamic
  // copy. The publishable preview is independently marked data-audience=learner.
  if (!reviewerOnlyShell) {
    scanTargets.push(
      { kind: 'learner generated content', text: cssGeneratedText(source) },
      { kind: 'learner dynamic copy', text: inlineScriptSource(source) },
    );
  }
  const findings = [];

  for (const target of scanTargets) {
    for (const rule of learnerSurfaceLeakagePatterns) {
      if (rule.pattern.test(target.text)) {
        findings.push({
          filePath,
          kind: target.kind,
          line: 1,
          reason: rule.reason,
          text: target.text.replace(/\s+/g, ' ').trim().slice(0, 220),
        });
      }
    }
  }

  return findings;
}

const files = scanRoots
  .flatMap(root => walk(path.join(repoRoot, root)))
  .filter(filePath => {
    const relativePath = path.relative(repoRoot, filePath);
    return !excludedPathPatterns.some(pattern => pattern.test(relativePath));
  });

const visualReferencePaths = visualReferenceFiles
  .map(filePath => path.join(repoRoot, filePath))
  .filter(filePath => fs.existsSync(filePath));

const findings = [
  ...files.flatMap(filePath =>
    scanText(filePath, fs.readFileSync(filePath, 'utf8')),
  ),
  ...files.flatMap(filePath =>
    scanLearnerSurfaceCopy(filePath, fs.readFileSync(filePath, 'utf8')),
  ),
  ...visualReferencePaths.flatMap(filePath =>
    scanVisibleHtmlProcessText(filePath, fs.readFileSync(filePath, 'utf8')),
  ),
];

if (findings.length > 0) {
  console.error('FAIL: Design visual artifacts contain raw metadata leaks.');
  for (const finding of findings.slice(0, maxReportedFindings)) {
    console.error(
      `${path.relative(repoRoot, finding.filePath)}:${finding.line} ` +
        `[${finding.kind}] ${finding.reason}: ${finding.text}`,
    );
  }
  if (findings.length > maxReportedFindings) {
    console.error(`...and ${findings.length - maxReportedFindings} more finding(s).`);
  }
  process.exit(1);
}

console.log('PASS: No metadata leaks detected in design visual artifacts.');
