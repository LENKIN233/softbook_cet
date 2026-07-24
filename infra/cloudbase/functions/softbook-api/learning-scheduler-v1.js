const crypto = require('node:crypto');
const {createEmptyCard, fsrs, Rating, State} = require('ts-fsrs');

const LEARNING_SESSION_SCHEMA_VERSION = 'learning-session.v1';
const SCHEDULER_POLICY_VERSION = 'softbook-fsrs.v1';
const SCHEDULER_ALGORITHM = 'FSRS-6';
const SCHEDULER_LIBRARY = 'ts-fsrs';
const SCHEDULER_LIBRARY_VERSION = '5.4.1';
const SESSION_SELECTION_ATTEMPTS = 3;
const CHINA_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;
const TRACKS = ['cet4', 'cet6'];
const MEMBERSHIP_STAGES = ['trial_available', 'trial', 'free', 'premium'];
const CONTENT_VERSION_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CARD_ID_PATTERN = /^\d{6}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const SELECTION_ID_PATTERN = /^sel_[A-Za-z0-9_-]{16,128}$/;
const INTERNAL_CURSOR_KEYS = [
  'card_id',
  'content_version',
  'due_at',
  'phase',
  'reason',
  'selected_at',
  'selection_id',
  'source_id',
  'track',
];
const SCHEDULER_ENTRY_KEYS = [
  'algorithm',
  'card',
  'card_id',
  'content_version',
  'last_event_id',
  'last_server_sequence',
  'library',
  'library_version',
  'policy_version',
];
const FSRS_CARD_KEYS = [
  'difficulty',
  'due',
  'elapsed_days',
  'lapses',
  'last_review',
  'learning_steps',
  'reps',
  'scheduled_days',
  'stability',
  'state',
];
const scheduler = fsrs({enable_fuzz: false});

function createLearningSchedulerV1Service(options) {
  const config = {
    now: options.now,
    randomBytes: options.randomBytes ?? crypto.randomBytes,
    runtimeMode: options.runtimeMode,
    store: options.store,
  };
  validateServiceConfig(config);

  return {
    read: input => readLearningSession(config, input),
  };
}

async function readLearningSession(config, input) {
  const generatedAt = requireValidDate(config.now(), 'scheduler clock');
  const generatedAtIso = generatedAt.toISOString();
  const track = requireTrack(input.track, 'track');
  const dayKey = chinaActivityDay(generatedAt.getTime());

  for (let attempt = 1; attempt <= SESSION_SELECTION_ATTEMPTS; attempt += 1) {
    const [
      cardSource,
      learningState,
      membership,
      spaceState,
      sessionStateValue,
    ] =
      await Promise.all([
        config.store.getCardSource(track, {
          allowDevelopmentDefault: config.runtimeMode !== 'production',
        }),
        config.store.getLearningState(
          input.phoneNumber,
          dayKey,
          track,
          {accountKey: input.accountKey, includeSchedulerState: true},
        ),
        config.store.getMembership(input.phoneNumber),
        config.store.getSpaceState(input.phoneNumber, dayKey),
        config.store.getLearningSessionCursor(input.accountKey, track),
      ]);

    assertPublishedContentAvailable(
      cardSource,
      config.runtimeMode,
      track,
    );
    const context = normalizeCanonicalSelectionContext({
      accountKey: input.accountKey,
      cardSource,
      generatedAt,
      learningState,
      membership,
      sessionStateValue,
      spaceState,
      track,
    });
    if (
      context.sessionState.learning_acknowledged_at !==
        context.learning.projectionAcknowledgedAt ||
      context.sessionState.learning_server_sequence !==
        context.learning.projectionServerSequence
    ) {
      continue;
    }
    const resumed = resumePersistedCursor(context);

    if (resumed) {
      if (
        !(await config.store.confirmLearningSessionCursor({
          accountKey: input.accountKey,
          expectedLearningAcknowledgedAt:
            context.learning.projectionAcknowledgedAt,
          expectedLearningServerSequence:
            context.learning.projectionServerSequence,
          expectedRevision: context.sessionState.revision,
          track,
        }))
      ) {
        continue;
      }
      if (
        !(await activateAvailableTrial(
          config,
          context,
          input.phoneNumber,
          generatedAtIso,
        ))
      ) {
        continue;
      }
      return serializeLearningSession(context, resumed, 'persisted_cursor');
    }

    const next = selectNextCard(context, config.randomBytes);
    const cursor = next.selection?.cursor ?? null;
    const cursorAlreadyEmpty =
      context.sessionState.cursor === null && cursor === null;
    const cursorStateAccepted =
      cursorAlreadyEmpty && context.sessionState.revision > 0
      ? await config.store.confirmLearningSessionCursor({
          accountKey: input.accountKey,
          expectedLearningAcknowledgedAt:
            context.learning.projectionAcknowledgedAt,
          expectedLearningServerSequence:
            context.learning.projectionServerSequence,
          expectedRevision: context.sessionState.revision,
          track,
        })
      : await config.store.saveLearningSessionCursor({
          accountKey: input.accountKey,
          cursor,
          expectedRevision: context.sessionState.revision,
          learningAcknowledgedAt:
            context.learning.projectionAcknowledgedAt,
          learningServerSequence: context.learning.projectionServerSequence,
          track,
          updatedAt: generatedAtIso,
        });

    if (cursorStateAccepted) {
      if (
        !(await activateAvailableTrial(
          config,
          context,
          input.phoneNumber,
          generatedAtIso,
        ))
      ) {
        continue;
      }
      return serializeLearningSession(
        context,
        next.selection,
        next.selection?.cursor.reason ?? null,
        next.nextDueAt,
      );
    }
  }

  throw learningSchedulerError(
    409,
    'learning_session_conflict',
    'Learning state changed while selecting the next card.',
  );
}

async function activateAvailableTrial(
  config,
  context,
  phoneNumber,
  acknowledgedAt,
) {
  if (context.membershipStage !== 'trial_available') {
    return true;
  }

  const activatedMembership = await config.store.startTrial(
    phoneNumber,
    acknowledgedAt,
  );
  const activatedStage = requireMembershipStage(activatedMembership.stage);

  if (activatedStage !== 'trial') {
    return false;
  }

  context.membershipStage = activatedStage;
  return true;
}

function normalizeCanonicalSelectionContext(input) {
  try {
    const sessionState = normalizeLearningSessionState(
      input.sessionStateValue,
      {
        accountKey: input.accountKey,
        track: input.track,
      },
    );

    return normalizeSelectionContext({
      cardSource: input.cardSource,
      generatedAt: input.generatedAt,
      learningState: input.learningState,
      membershipStage: requireMembershipStage(input.membership.stage),
      sessionState,
      spaceState: input.spaceState,
      track: input.track,
    });
  } catch (error) {
    if (Number.isInteger(error.statusCode)) {
      throw error;
    }

    throw learningSchedulerError(
      500,
      'learning_scheduler_projection_invalid',
      `Canonical scheduler state is invalid: ${error.message}`,
    );
  }
}

function normalizeSelectionContext(input) {
  const cardRecords = requireArray(
    input.cardSource.card_records,
    'card source.card_records',
  );

  if (cardRecords.length === 0) {
    throw unavailable('The canonical card source is empty.');
  }

  const cards = cardRecords.map((card, index) => {
    if (!isObject(card) || !CARD_ID_PATTERN.test(card.card_id)) {
      throw unavailable('The canonical card source contains an invalid card.');
    }

    return {cardId: card.card_id, index};
  });
  const cardIdSet = new Set(cards.map(card => card.cardId));

  if (cardIdSet.size !== cards.length) {
    throw unavailable('The canonical card source contains duplicate cards.');
  }

  const contentVersion = requireContentVersion(
    input.cardSource.content_version,
    'card source.content_version',
  );
  const sourceId = requireNonEmptyString(
    input.cardSource.source?.id,
    'card source.source.id',
  );
  const learning = normalizeLearningStateForScheduler(
    input.learningState,
    input.track,
  );
  const sleepingCardIds = normalizeSleepingCardIds(input.spaceState);
  const accessibleCardCount =
    input.membershipStage === 'free'
      ? Math.ceil(cards.length * 0.5)
      : cards.length;
  const accessibleCards = cards.slice(0, accessibleCardCount);
  const accessibleCardIds = new Set(
    accessibleCards.map(card => card.cardId),
  );

  return {
    accessibleCardCount,
    accessibleCardIds,
    accessibleCards,
    accessMode: input.membershipStage === 'free' ? 'free_subset' : 'full',
    cards,
    cardIdSet,
    contentVersion,
    generatedAt: input.generatedAt,
    learning,
    membershipStage: input.membershipStage,
    sessionState: input.sessionState,
    sleepingCardIds,
    sourceId,
    totalCardCount: cards.length,
    track: input.track,
  };
}

function normalizeLearningStateForScheduler(value, expectedTrack) {
  if (!isObject(value) || value.track !== expectedTrack) {
    throw unavailable('The canonical learning state is invalid.');
  }

  const eventsByCardId = requireObject(
    value.events_by_card_id,
    'learning state.events_by_card_id',
  );
  let schedulerByCardId = {};
  let projectionServerSequence = 0;

  if (value.projection_version === 'learning-events.v2') {
    try {
      schedulerByCardId = normalizeSchedulerProjection(value);
      projectionServerSequence = maximumLearningServerSequence(
        eventsByCardId,
      );
    } catch (error) {
      throw unavailable(
        `The canonical scheduler projection is invalid: ${error.message}`,
      );
    }
  } else if (
    value.scheduler_version !== undefined ||
    value.scheduler_by_card_id !== undefined
  ) {
    throw unavailable('A legacy learning state contains scheduler authority.');
  }

  return {
    eventsByCardId,
    projectionAcknowledgedAt:
      value.projection_version === 'learning-events.v2'
        ? requireIsoTimestamp(
            value.acknowledged_at,
            'learning state.acknowledged_at',
          )
        : null,
    projectionServerSequence,
    schedulerByCardId,
  };
}

function normalizeSleepingCardIds(value) {
  if (!isObject(value) || !isObject(value.states_by_card_id)) {
    throw unavailable('The canonical physical-space state is invalid.');
  }

  const sleeping = new Set();

  for (const [cardId, state] of Object.entries(value.states_by_card_id)) {
    if (
      !CARD_ID_PATTERN.test(cardId) ||
      !isObject(state) ||
      state.card_id !== cardId ||
      typeof state.is_sleeping !== 'boolean'
    ) {
      throw unavailable('The canonical physical-space state is invalid.');
    }

    if (state.is_sleeping) {
      sleeping.add(cardId);
    }
  }

  return sleeping;
}

function resumePersistedCursor(context) {
  const cursor = context.sessionState.cursor;

  if (
    cursor === null ||
    cursor.track !== context.track ||
    cursor.content_version !== context.contentVersion ||
    cursor.source_id !== context.sourceId ||
    !context.cardIdSet.has(cursor.card_id) ||
    !context.accessibleCardIds.has(cursor.card_id) ||
    context.sleepingCardIds.has(cursor.card_id)
  ) {
    return null;
  }

  const hasEvent = Object.hasOwn(
    context.learning.eventsByCardId,
    cursor.card_id,
  );

  if (
    (cursor.phase === 'learning' && hasEvent) ||
    (cursor.phase === 'review' && !hasEvent)
  ) {
    return null;
  }

  return {cursor};
}

function selectNextCard(context, randomBytes) {
  const due = [];
  const future = [];

  for (const card of context.accessibleCards) {
    if (context.sleepingCardIds.has(card.cardId)) {
      continue;
    }

    const event = context.learning.eventsByCardId[card.cardId];

    if (!event) {
      continue;
    }

    const schedulerEntry =
      context.learning.schedulerByCardId[card.cardId] ?? null;
    const dueAt = schedulerEntry
      ? requireIsoTimestamp(
          schedulerEntry.card.due,
          `scheduler ${card.cardId}.due`,
        )
      : context.generatedAt.toISOString();
    const candidate = {...card, dueAt};

    if (Date.parse(dueAt) <= context.generatedAt.getTime()) {
      due.push(candidate);
    } else {
      future.push(candidate);
    }
  }

  due.sort(compareDueCandidate);

  if (due.length > 0) {
    return {
      nextDueAt: null,
      selection: createSelection(
        context,
        due[0].cardId,
        'review',
        'due_review',
        due[0].dueAt,
        randomBytes,
      ),
    };
  }

  for (const card of context.accessibleCards) {
    if (
      context.sleepingCardIds.has(card.cardId) ||
      Object.hasOwn(context.learning.eventsByCardId, card.cardId)
    ) {
      continue;
    }

    return {
      nextDueAt: null,
      selection: createSelection(
        context,
        card.cardId,
        'learning',
        'catalog_new',
        null,
        randomBytes,
      ),
    };
  }

  future.sort(compareDueCandidate);

  return {
    nextDueAt: future[0]?.dueAt ?? null,
    selection: null,
  };
}

function createSelection(
  context,
  cardId,
  phase,
  reason,
  dueAt,
  randomBytes,
) {
  const selectionId = createSelectionId(randomBytes);
  const cursor = {
    card_id: cardId,
    content_version: context.contentVersion,
    due_at: dueAt,
    phase,
    reason,
    selected_at: context.generatedAt.toISOString(),
    selection_id: selectionId,
    source_id: context.sourceId,
    track: context.track,
  };

  return {cursor};
}

function serializeLearningSession(
  context,
  selection,
  responseReason,
  nextDueAt = null,
) {
  const cursor = selection?.cursor ?? null;

  return {
    schema_version: LEARNING_SESSION_SCHEMA_VERSION,
    generated_at: context.generatedAt.toISOString(),
    track: context.track,
    content_version: context.contentVersion,
    source_id: context.sourceId,
    membership_stage: context.membershipStage,
    algorithm: {
      id: SCHEDULER_ALGORITHM,
      library: SCHEDULER_LIBRARY,
      library_version: SCHEDULER_LIBRARY_VERSION,
      policy_version: SCHEDULER_POLICY_VERSION,
    },
    access: {
      mode: context.accessMode,
      accessible_card_count: context.accessibleCardCount,
      total_card_count: context.totalCardCount,
    },
    selection: cursor
      ? {
          selection_id: cursor.selection_id,
          card_id: cursor.card_id,
          phase: cursor.phase,
          reason: responseReason,
          due_at: cursor.due_at,
        }
      : null,
    next_due_at: nextDueAt,
  };
}

function compareDueCandidate(left, right) {
  return (
    Date.parse(left.dueAt) - Date.parse(right.dueAt) ||
    left.index - right.index ||
    left.cardId.localeCompare(right.cardId)
  );
}

function advanceSchedulerEntry(previousValue, input) {
  const now = new Date(
    requireIsoTimestamp(input.acceptedAt, 'scheduler acceptedAt'),
  );
  const previous = previousValue
    ? normalizeSchedulerEntry(previousValue)
    : null;
  const previousCard = previous
    ? deserializeFsrsCard(previous.card)
    : createEmptyCard(now);

  if (
    previousCard.last_review &&
    previousCard.last_review.getTime() > now.getTime()
  ) {
    throw new Error('Scheduler acceptance time moved backwards.');
  }

  const rating = ratingForEvent(input.event);
  const result = scheduler.next(previousCard, now, rating);

  return {
    algorithm: SCHEDULER_ALGORITHM,
    card: serializeFsrsCard(result.card),
    card_id: requireCardId(input.event.card_id, 'event.card_id'),
    content_version: requireContentVersion(
      input.event.content_version,
      'event.content_version',
    ),
    last_event_id: requireEventId(input.event.event_id, 'event.event_id'),
    last_server_sequence: requirePositiveSafeInteger(
      input.serverSequence,
      'serverSequence',
    ),
    library: SCHEDULER_LIBRARY,
    library_version: SCHEDULER_LIBRARY_VERSION,
    policy_version: SCHEDULER_POLICY_VERSION,
  };
}

function ratingForEvent(event) {
  if (!isObject(event)) {
    throw new Error('Scheduler event is invalid.');
  }

  if (event.answer_grade === 'review_needed') {
    return Rating.Again;
  }

  if (event.answer_grade !== 'passed') {
    throw new Error('Scheduler answer grade is invalid.');
  }

  if (
    typeof event.used_hint !== 'boolean' ||
    typeof event.used_peek !== 'boolean'
  ) {
    throw new Error('Scheduler assistance evidence is invalid.');
  }

  return event.used_hint || event.used_peek ? Rating.Hard : Rating.Good;
}

function normalizeSchedulerProjection(projection) {
  if (
    !isObject(projection) ||
    projection.scheduler_version !== SCHEDULER_POLICY_VERSION ||
    !isObject(projection.scheduler_by_card_id) ||
    !isObject(projection.events_by_card_id)
  ) {
    throw new Error('Scheduler projection metadata is invalid.');
  }

  const normalized = {};
  const expectedCardIds = new Set();

  for (const [cardId, event] of Object.entries(
    projection.events_by_card_id,
  )) {
    if (
      !isObject(event) ||
      event.card_id !== cardId ||
      !Number.isSafeInteger(event.server_sequence) ||
      event.server_sequence < 0
    ) {
      throw new Error('Scheduler projection event authority is invalid.');
    }

    if (event.server_sequence === 0) {
      if (projection.scheduler_by_card_id[cardId] !== undefined) {
        throw new Error('Legacy scheduler history must not be invented.');
      }
      continue;
    }

    expectedCardIds.add(cardId);
    const entry = normalizeSchedulerEntry(
      projection.scheduler_by_card_id[cardId],
    );

    if (
      entry.card_id !== cardId ||
      entry.last_event_id !== event.event_id ||
      entry.last_server_sequence !== event.server_sequence ||
      entry.content_version !== event.content_version
    ) {
      throw new Error('Scheduler projection is stale or cross-card.');
    }
    normalized[cardId] = entry;
  }

  if (
    Object.keys(projection.scheduler_by_card_id).length !==
    expectedCardIds.size
  ) {
    throw new Error('Scheduler projection contains orphan state.');
  }

  return normalized;
}

function normalizeSchedulerEntry(value) {
  requireExactKeys(value, SCHEDULER_ENTRY_KEYS, 'scheduler entry');

  if (
    value.algorithm !== SCHEDULER_ALGORITHM ||
    value.library !== SCHEDULER_LIBRARY ||
    value.library_version !== SCHEDULER_LIBRARY_VERSION ||
    value.policy_version !== SCHEDULER_POLICY_VERSION
  ) {
    throw new Error('Scheduler entry version is invalid.');
  }

  return {
    algorithm: value.algorithm,
    card: normalizeFsrsCard(value.card),
    card_id: requireCardId(value.card_id, 'scheduler entry.card_id'),
    content_version: requireContentVersion(
      value.content_version,
      'scheduler entry.content_version',
    ),
    last_event_id: requireEventId(
      value.last_event_id,
      'scheduler entry.last_event_id',
    ),
    last_server_sequence: requirePositiveSafeInteger(
      value.last_server_sequence,
      'scheduler entry.last_server_sequence',
    ),
    library: value.library,
    library_version: value.library_version,
    policy_version: value.policy_version,
  };
}

function serializeFsrsCard(value) {
  return normalizeFsrsCard({
    due: value.due.toISOString(),
    stability: value.stability,
    difficulty: value.difficulty,
    elapsed_days: value.elapsed_days,
    scheduled_days: value.scheduled_days,
    reps: value.reps,
    lapses: value.lapses,
    learning_steps: value.learning_steps,
    state: value.state,
    last_review: value.last_review?.toISOString() ?? null,
  });
}

function normalizeFsrsCard(value) {
  requireExactKeys(value, FSRS_CARD_KEYS, 'FSRS card');
  const due = requireIsoTimestamp(value.due, 'FSRS card.due');
  const lastReview = requireIsoTimestamp(
    value.last_review,
    'FSRS card.last_review',
  );
  const stability = requireFiniteNumber(
    value.stability,
    'FSRS card.stability',
  );
  const difficulty = requireFiniteNumber(
    value.difficulty,
    'FSRS card.difficulty',
  );

  if (
    stability <= 0 ||
    difficulty < 1 ||
    difficulty > 10 ||
    Date.parse(due) < Date.parse(lastReview)
  ) {
    throw new Error('FSRS card memory state is invalid.');
  }

  const state = requireNonNegativeSafeInteger(
    value.state,
    'FSRS card.state',
  );

  if (![State.Learning, State.Review, State.Relearning].includes(state)) {
    throw new Error('FSRS card state is invalid.');
  }

  return {
    due,
    stability,
    difficulty,
    elapsed_days: requireNonNegativeSafeInteger(
      value.elapsed_days,
      'FSRS card.elapsed_days',
    ),
    scheduled_days: requireNonNegativeSafeInteger(
      value.scheduled_days,
      'FSRS card.scheduled_days',
    ),
    reps: requirePositiveSafeInteger(value.reps, 'FSRS card.reps'),
    lapses: requireNonNegativeSafeInteger(
      value.lapses,
      'FSRS card.lapses',
    ),
    learning_steps: requireNonNegativeSafeInteger(
      value.learning_steps,
      'FSRS card.learning_steps',
    ),
    state,
    last_review: lastReview,
  };
}

function deserializeFsrsCard(value) {
  const card = normalizeFsrsCard(value);

  return {
    ...card,
    due: new Date(card.due),
    last_review: new Date(card.last_review),
  };
}

function normalizeLearningSessionState(value, expected) {
  if (value === null || value === undefined) {
    return {
      account_key: expected.accountKey,
      cursor: null,
      learning_acknowledged_at: null,
      learning_server_sequence: 0,
      revision: 0,
      track: expected.track,
      updated_at: null,
    };
  }

  requireExactKeys(
    value,
    [
      'account_key',
      'cursor',
      'learning_acknowledged_at',
      'learning_server_sequence',
      'revision',
      'track',
      'updated_at',
    ],
    'learning session state',
  );

  if (
    value.account_key !== expected.accountKey ||
    value.track !== expected.track
  ) {
    throw new Error('Learning session scope is invalid.');
  }

  return {
    account_key: value.account_key,
    cursor:
      value.cursor === null
        ? null
        : normalizeLearningSessionCursor(value.cursor, expected.track),
    learning_acknowledged_at:
      value.learning_acknowledged_at === null
        ? null
        : requireIsoTimestamp(
            value.learning_acknowledged_at,
            'learning session learning_acknowledged_at',
          ),
    learning_server_sequence: requireNonNegativeSafeInteger(
      value.learning_server_sequence,
      'learning session learning_server_sequence',
    ),
    revision: requirePositiveSafeInteger(
      value.revision,
      'learning session revision',
    ),
    track: value.track,
    updated_at: requireIsoTimestamp(
      value.updated_at,
      'learning session updated_at',
    ),
  };
}

function normalizeLearningSessionCursor(value, expectedTrack) {
  requireExactKeys(value, INTERNAL_CURSOR_KEYS, 'learning session cursor');
  const phase = requireEnum(
    value.phase,
    ['learning', 'review'],
    'learning session cursor.phase',
  );
  const reason = requireEnum(
    value.reason,
    ['catalog_new', 'due_review'],
    'learning session cursor.reason',
  );
  const dueAt =
    value.due_at === null
      ? null
      : requireIsoTimestamp(
          value.due_at,
          'learning session cursor.due_at',
        );

  if (
    value.track !== expectedTrack ||
    (phase === 'learning' && (reason !== 'catalog_new' || dueAt !== null)) ||
    (phase === 'review' && (reason !== 'due_review' || dueAt === null))
  ) {
    throw new Error('Learning session cursor authority is invalid.');
  }

  if (
    typeof value.selection_id !== 'string' ||
    !SELECTION_ID_PATTERN.test(value.selection_id)
  ) {
    throw new Error('Learning session selection ID is invalid.');
  }

  return {
    card_id: requireCardId(
      value.card_id,
      'learning session cursor.card_id',
    ),
    content_version: requireContentVersion(
      value.content_version,
      'learning session cursor.content_version',
    ),
    due_at: dueAt,
    phase,
    reason,
    selected_at: requireIsoTimestamp(
      value.selected_at,
      'learning session cursor.selected_at',
    ),
    selection_id: value.selection_id,
    source_id: requireNonEmptyString(
      value.source_id,
      'learning session cursor.source_id',
    ),
    track: value.track,
  };
}

function toBootstrapLearningCursor(sessionState) {
  if (sessionState.cursor === null) {
    return null;
  }

  return {
    card_id: sessionState.cursor.card_id,
    source_id: sessionState.cursor.source_id,
    track: sessionState.cursor.track,
  };
}

function maximumLearningServerSequence(eventsByCardId) {
  if (!isObject(eventsByCardId)) {
    throw new Error('Learning projection events are invalid.');
  }

  let maximum = 0;

  for (const event of Object.values(eventsByCardId)) {
    if (
      !isObject(event) ||
      !Number.isSafeInteger(event.server_sequence) ||
      event.server_sequence < 0
    ) {
      throw new Error('Learning projection event sequence is invalid.');
    }
    maximum = Math.max(maximum, event.server_sequence);
  }

  return maximum;
}

function createAccountLearningSessionKey(accountKey, track) {
  return `${accountKey}:${track}`;
}

function createAccountLearningSessionId(accountKey, track) {
  return crypto
    .createHash('sha256')
    .update(createAccountLearningSessionKey(accountKey, track))
    .digest('hex');
}

function createSelectionId(randomBytes) {
  let bytes;

  try {
    bytes = randomBytes(18);
  } catch {
    throw unavailable('The scheduler selection ID generator failed.');
  }

  if (!Buffer.isBuffer(bytes) || bytes.length !== 18) {
    throw unavailable('The scheduler selection ID generator failed.');
  }

  return `sel_${bytes.toString('base64url')}`;
}

function assertPublishedContentAvailable(cardSource, runtimeMode, track) {
  if (!isObject(cardSource)) {
    if (runtimeMode !== 'production') {
      throw unavailable('The canonical card source is unavailable.');
    }

    throw learningSchedulerError(
      503,
      'content_release_unavailable',
      'A matching published content release is required.',
    );
  }

  if (
    runtimeMode === 'production' &&
    (!isObject(cardSource.release) ||
      cardSource.release.track !== track ||
      cardSource.release.content_version !== cardSource.content_version)
  ) {
    throw learningSchedulerError(
      503,
      'content_release_unavailable',
      'A matching published content release is required.',
    );
  }
}

function chinaActivityDay(timestamp) {
  return new Date(timestamp + CHINA_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function validateServiceConfig(config) {
  for (const name of [
    'confirmLearningSessionCursor',
    'getCardSource',
    'getLearningSessionCursor',
    'getLearningState',
    'getMembership',
    'getSpaceState',
    'saveLearningSessionCursor',
    'startTrial',
  ]) {
    if (typeof config.store?.[name] !== 'function') {
      throw new Error(`Learning scheduler store.${name} is required.`);
    }
  }

  if (
    typeof config.now !== 'function' ||
    typeof config.randomBytes !== 'function' ||
    (config.runtimeMode !== 'development' &&
      config.runtimeMode !== 'production')
  ) {
    throw new Error('Learning scheduler configuration is invalid.');
  }
}

function requireExactKeys(value, expectedKeys, label) {
  if (!isObject(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${label} fields are invalid.`);
  }
}

function requireObject(value, label) {
  if (!isObject(value)) {
    throw unavailable(`${label} must be an object.`);
  }

  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw unavailable(`${label} must be an array.`);
  }

  return value;
}

function requireTrack(value, label) {
  return requireEnum(value, TRACKS, label);
}

function requireMembershipStage(value) {
  return requireEnum(value, MEMBERSHIP_STAGES, 'membership.stage');
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requireCardId(value, label) {
  if (typeof value !== 'string' || !CARD_ID_PATTERN.test(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requireEventId(value, label) {
  if (typeof value !== 'string' || !EVENT_ID_PATTERN.test(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requireContentVersion(value, label) {
  if (typeof value !== 'string' || !CONTENT_VERSION_PATTERN.test(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requireIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is invalid.`);
  }

  const normalized = new Date(value).toISOString();

  if (normalized !== value) {
    throw new Error(`${label} must be a normalized ISO timestamp.`);
  }

  return normalized;
}

function requireValidDate(value, label) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw unavailable(`${label} is invalid.`);
  }

  return new Date(value.getTime());
}

function requireFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requireNonNegativeSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function requirePositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unavailable(message) {
  return learningSchedulerError(
    503,
    'learning_scheduler_unavailable',
    message,
  );
}

function learningSchedulerError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

module.exports = {
  LEARNING_SESSION_SCHEMA_VERSION,
  SCHEDULER_ALGORITHM,
  SCHEDULER_LIBRARY,
  SCHEDULER_LIBRARY_VERSION,
  SCHEDULER_POLICY_VERSION,
  advanceSchedulerEntry,
  createAccountLearningSessionId,
  createAccountLearningSessionKey,
  createLearningSchedulerV1Service,
  maximumLearningServerSequence,
  normalizeLearningSessionState,
  normalizeSchedulerEntry,
  normalizeSchedulerProjection,
  ratingForEvent,
  toBootstrapLearningCursor,
};
