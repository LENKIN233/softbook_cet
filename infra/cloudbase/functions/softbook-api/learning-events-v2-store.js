const crypto = require('node:crypto');
const {
  SCHEDULER_POLICY_VERSION,
  advanceSchedulerEntry,
  createAccountLearningSessionId,
  createAccountLearningSessionKey,
  maximumLearningServerSequence,
  normalizeLearningSessionState,
  normalizeSchedulerProjection,
} = require('./learning-scheduler-v1');

const LEARNING_EVENTS_ERROR = Symbol('learning-events-error');
const LEGACY_MIGRATION_RETRY = Symbol('legacy-migration-retry');
const RETENTION_STATUSES = ['active', 'retained', 'expired'];
const LEGACY_QUERY_PAGE_SIZE = 100;
const LEGACY_QUERY_MAX_DOCUMENTS = 5000;
const LEGACY_MIGRATION_SNAPSHOT_ATTEMPTS = 3;
const CHINA_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;
const TRACKS = ['cet4', 'cet6'];
const OUTCOMES_BY_INTERACTION = {
  flip: ['confident', 'review'],
  multiple_choice: ['correct', 'incorrect'],
  lock: ['correct', 'incorrect'],
  elimination: ['correct', 'incorrect'],
  swipe: ['correct', 'incorrect'],
};
const ANSWER_GRADE_BY_OUTCOME = {
  correct: 'passed',
  incorrect: 'review_needed',
  confident: 'passed',
  review: 'review_needed',
};

function createMemoryLearningEventsCommitter(options) {
  const {state} = options;
  const runTransaction =
    options.runTransaction ?? createSerializedTransactionRunner();

  return input =>
    runTransaction(async () => {
      const staged = cloneMemoryState(state);
      const adapter = createMemoryAdapter(options, staged, input);
      const results = await commitLearningEventsTransaction(adapter, input);
      commitMemoryState(state, staged);
      return results;
    });
}

function createSerializedTransactionRunner() {
  let transactionTail = Promise.resolve();

  return operation => {
    const run = transactionTail.then(operation);
    transactionTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

function createCloudBaseLearningEventsCommitter(options) {
  return async input => {
    for (
      let attempt = 1;
      attempt <= LEGACY_MIGRATION_SNAPSHOT_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const legacyMigration = await readCloudBaseLegacyMigrationSnapshot(
          options,
          input,
        );

        return await options.db.runTransaction(async transaction => {
          const adapter = createCloudBaseAdapter(
            options,
            transaction,
            input,
            legacyMigration,
          );
          return commitLearningEventsTransaction(adapter, input);
        });
      } catch (error) {
        if (
          isLegacyMigrationRetry(error) &&
          attempt < LEGACY_MIGRATION_SNAPSHOT_ATTEMPTS
        ) {
          continue;
        }

        if (isLearningEventsError(error)) {
          throw error;
        }

        throw createLearningEventsError(
          503,
          'learning_events_unavailable',
          'Learning event storage is temporarily unavailable.',
        );
      }
    }

    throw createLearningEventsError(
      503,
      'learning_events_unavailable',
      'Learning event storage is temporarily unavailable.',
    );
  };
}

async function readCloudBaseLegacyMigrationSnapshot(options, input) {
  const collections = options.collections;
  const sequences = options.db.collection(collections.learningEventSequences);
  const storedSequence = await getDocument(
    sequences,
    createLearningEventSequenceId(input.accountKey),
  );

  if (storedSequence !== null) {
    return null;
  }

  const revisions = options.db.collection(
    collections.learningMigrationRevisions,
  );
  const learningStates = options.db.collection(collections.learningStates);
  const revisionId = createLearningMigrationRevisionId(input.accountKey);
  const before = normalizeLearningMigrationRevision(
    await getDocument(revisions, revisionId),
    input.accountKey,
  );

  if (before.status !== 'open') {
    throw invalidStoredState(
      'A migrated legacy snapshot is missing its account sequence.',
    );
  }

  const states = await listDocumentsByQuery(
    learningStates,
    {phone_number: input.phoneNumber},
    LEGACY_QUERY_PAGE_SIZE,
    LEGACY_QUERY_MAX_DOCUMENTS,
  );
  const after = normalizeLearningMigrationRevision(
    await getDocument(revisions, revisionId),
    input.accountKey,
  );

  if (before.revision !== after.revision || after.status !== 'open') {
    throw legacyMigrationRetry();
  }

  return {
    revision: after.revision,
    states,
  };
}

async function commitLearningEventsTransaction(adapter, input) {
  const uniqueEntries = [];
  const entryByEventId = new Map();
  const eventIdByCursor = new Map();

  for (const event of input.events) {
    const eventId = event.payload.event_id;
    const cursorKey = createCursorKey(event.payload.device_cursor);
    const previousEvent = entryByEventId.get(eventId);

    if (previousEvent && previousEvent.digest !== event.digest) {
      throw eventConflict();
    }

    const cursorEventId = eventIdByCursor.get(cursorKey);

    if (cursorEventId && cursorEventId !== eventId) {
      throw cursorConflict();
    }

    if (!previousEvent) {
      entryByEventId.set(eventId, event);
      uniqueEntries.push(event);
    }
    eventIdByCursor.set(cursorKey, eventId);
  }

  const classificationByEventId = new Map();
  const newEntries = [];
  let maximumExistingServerSequence = 0;

  for (const event of uniqueEntries) {
    const eventId = event.payload.event_id;
    const cursor = event.payload.device_cursor;
    const existingEvent = await adapter.getEvent(eventId);
    const existingCursor = await adapter.getCursor(
      cursor.device_id,
      cursor.sequence,
    );

    if (existingEvent) {
      const normalized = normalizeStoredEvent(existingEvent, {
        accountKey: input.accountKey,
        eventId,
      });

      if (normalized.payloadDigest !== event.digest) {
        throw eventConflict();
      }

      if (normalized.track !== input.track) {
        throw invalidStoredState(
          'An immutable event track does not match its canonical payload.',
        );
      }

      if (!existingCursor) {
        throw invalidStoredState(
          'An accepted event is missing its cursor binding.',
        );
      }

      const cursorBinding = normalizeStoredCursor(existingCursor, {
        accountKey: input.accountKey,
        deviceId: cursor.device_id,
        sequence: cursor.sequence,
      });

      if (cursorBinding.eventId !== eventId) {
        throw cursorConflict();
      }

      classificationByEventId.set(eventId, {
        serverSequence: normalized.serverSequence,
        status: 'duplicate',
      });
      maximumExistingServerSequence = Math.max(
        maximumExistingServerSequence,
        normalized.serverSequence,
      );
      continue;
    }

    if (existingCursor) {
      const cursorBinding = normalizeStoredCursor(existingCursor, {
        accountKey: input.accountKey,
        deviceId: cursor.device_id,
        sequence: cursor.sequence,
      });

      if (cursorBinding.eventId !== eventId) {
        throw cursorConflict();
      }

      throw invalidStoredState(
        'A device cursor exists without its immutable event.',
      );
    }

    newEntries.push({...event, track: input.track});
  }

  if (newEntries.length === 0) {
    const storedSequence = await adapter.getSequence();
    const sequenceState = normalizeSequenceState(
      storedSequence,
      [],
      input.accountKey,
      maximumExistingServerSequence,
    );
    const storedProjection = await adapter.getLearningProjection(input.track);

    if (storedProjection === null) {
      throw invalidStoredState(
        'An accepted event is missing its learning projection.',
      );
    }
    const projection = normalizeLearningProjection(
      storedProjection,
      input.track,
      input.accountKey,
      sequenceState.lastServerSequence,
    );
    const sessionState = normalizeStoredLearningSession(
      await adapter.getLearningSession(input.track),
      input,
    );
    assertLearningSessionProjectionWatermark(sessionState, projection);
    return orderedResults(input.events, classificationByEventId);
  }

  const validatedEntries = await input.validateNewEvents(newEntries, query =>
    adapter.readContentVersion(query),
  );
  assertValidatedEntries(newEntries, validatedEntries);

  const storedSequence = await adapter.getSequence();
  const initializesSequence = storedSequence === null;
  const legacyStates = initializesSequence
    ? await adapter.listLegacyLearningStates()
    : [];
  const sequenceState = normalizeSequenceState(
    storedSequence,
    legacyStates,
    input.accountKey,
    maximumExistingServerSequence,
  );

  if (
    sequenceState.lastServerSequence >
    Number.MAX_SAFE_INTEGER - validatedEntries.length
  ) {
    throw invalidStoredState('The account server sequence is exhausted.');
  }

  const storedProjection = await adapter.getLearningProjection(input.track);

  if (initializesSequence && storedProjection !== null) {
    throw invalidStoredState(
      'An account learning projection exists without its event sequence.',
    );
  }

  const projection = storedProjection
    ? normalizeLearningProjection(
        storedProjection,
        input.track,
        input.accountKey,
        sequenceState.lastServerSequence,
      )
    : migrateLegacyLearningProjection(legacyStates, input.track);
  const sessionState = normalizeStoredLearningSession(
    await adapter.getLearningSession(input.track),
    input,
  );
  assertLearningSessionProjectionWatermark(
    sessionState,
    storedProjection === null ? null : projection,
  );
  const migratedProjectionWrites = [];
  const migratedSessionWrites = [];

  if (initializesSequence) {
    for (const track of TRACKS) {
      if (track === input.track) {
        continue;
      }

      const storedSiblingProjection = await adapter.getLearningProjection(
        track,
      );

      if (storedSiblingProjection !== null) {
        throw invalidStoredState(
          'An account learning projection exists without its event sequence.',
        );
      }

      const migratedSiblingProjection = migrateLegacyLearningProjection(
        legacyStates,
        track,
      );

      if (migratedSiblingProjection.legacy_baseline_migrated) {
        const migratedSession = normalizeStoredLearningSession(
          await adapter.getLearningSession(track),
          {...input, track},
        );
        assertLearningSessionProjectionWatermark(migratedSession, null);
        migratedProjectionWrites.push([track, migratedSiblingProjection]);
        migratedSessionWrites.push([
          track,
          migratedSession,
          migratedSiblingProjection,
        ]);
      }
    }
  }
  const acceptedEntries = [];

  for (const entry of validatedEntries) {
    sequenceState.lastServerSequence += 1;
    const serverSequence = sequenceState.lastServerSequence;
    const previous = projection.events_by_card_id[entry.payload.card_id];
    const previousNeedsReview = previous
      ? answerGradeForProjection(previous) === 'review_needed'
      : false;
    const nextNeedsReview = entry.payload.answer_grade === 'review_needed';

    sequenceState.pendingReviewCount +=
      Number(nextNeedsReview) - Number(previousNeedsReview);

    if (sequenceState.pendingReviewCount < 0) {
      throw invalidStoredState('The derived pending-review count is invalid.');
    }

    const projectionEvent = createProjectionEvent(entry, serverSequence);
    projection.events_by_card_id[entry.payload.card_id] = projectionEvent;
    try {
      projection.scheduler_by_card_id[entry.payload.card_id] =
        advanceSchedulerEntry(
          projection.scheduler_by_card_id[entry.payload.card_id] ?? null,
          {
            acceptedAt: input.acknowledgedAt,
            event: entry.payload,
            serverSequence,
          },
        );
    } catch (error) {
      throw invalidStoredState(
        `The scheduler projection could not advance: ${error.message}`,
      );
    }
    projection.acknowledged_at = input.acknowledgedAt;
    projection.source_id = entry.sourceId;
    projection.source_label = entry.sourceLabel;
    acceptedEntries.push({...entry, projectionEvent, serverSequence});
    classificationByEventId.set(entry.payload.event_id, {
      serverSequence,
      status: 'accepted',
    });
  }

  const entriesByActivityDay = groupBy(
    acceptedEntries,
    entry => entry.activityDay,
  );
  const progressWrites = [];

  for (const [activityDay, entries] of entriesByActivityDay) {
    const storedProgress = await adapter.getDailyProgress(activityDay);
    const legacyProgress = storedProgress
      ? null
      : await adapter.getLegacyDailyProgress(activityDay);
    const progress = normalizeDailyProgress(
      storedProgress ?? legacyProgress,
      activityDay,
      storedProgress ? input.accountKey : null,
    );

    for (const entry of entries) {
      if (entry.payload.phase === 'learning') {
        progress.learning_completed_count += 1;
      } else {
        progress.review_completed_count += 1;
      }
    }

    progress.acknowledged_at = input.acknowledgedAt;
    progress.pending_review_count = sequenceState.pendingReviewCount;
    progress.total_completed_count =
      progress.learning_completed_count + progress.review_completed_count;

    if (!Number.isSafeInteger(progress.total_completed_count)) {
      throw invalidStoredState('A daily progress projection is invalid.');
    }
    progressWrites.push([activityDay, progress]);
  }

  for (const entry of acceptedEntries) {
    await adapter.setEvent(entry.payload.event_id, {
      accepted_at: input.acknowledgedAt,
      account_key: input.accountKey,
      activity_day: entry.activityDay,
      event_id: entry.payload.event_id,
      payload: entry.payload,
      payload_digest: entry.digest,
      server_sequence: entry.serverSequence,
      track: input.track,
    });
    await adapter.setCursor(
      entry.payload.device_cursor.device_id,
      entry.payload.device_cursor.sequence,
      {
        account_key: input.accountKey,
        device_id: entry.payload.device_cursor.device_id,
        event_id: entry.payload.event_id,
        sequence: entry.payload.device_cursor.sequence,
      },
    );
  }

  if (initializesSequence) {
    await adapter.markLegacyLearningMigrated(input.acknowledgedAt);
  }

  await adapter.setSequence({
    account_key: input.accountKey,
    last_server_sequence: sequenceState.lastServerSequence,
    pending_review_count: sequenceState.pendingReviewCount,
    updated_at: input.acknowledgedAt,
  });
  await adapter.setLearningProjection(input.track, {
    ...projection,
    account_key: input.accountKey,
    projection_version: 'learning-events.v2',
  });

  if (
    [sessionState, ...migratedSessionWrites.map(([, state]) => state)].some(
      state => state.revision === Number.MAX_SAFE_INTEGER,
    )
  ) {
    throw invalidStoredState('The learning session revision is exhausted.');
  }
  const clearsSelectedCursor =
    sessionState.cursor !== null &&
    acceptedEntries.some(
      entry =>
        entry.payload.card_id === sessionState.cursor.card_id &&
        entry.payload.content_version === sessionState.cursor.content_version,
    );

  await adapter.setLearningSession(input.track, {
    account_key: input.accountKey,
    cursor: clearsSelectedCursor ? null : sessionState.cursor,
    learning_acknowledged_at: input.acknowledgedAt,
    learning_server_sequence: maximumLearningServerSequence(
      projection.events_by_card_id,
    ),
    revision: sessionState.revision + 1,
    track: input.track,
    updated_at: input.acknowledgedAt,
  });

  for (const [track, migratedProjection] of migratedProjectionWrites) {
    await adapter.setLearningProjection(track, {
      ...migratedProjection,
      account_key: input.accountKey,
      projection_version: 'learning-events.v2',
    });
  }
  for (const [
    track,
    migratedSession,
    migratedProjection,
  ] of migratedSessionWrites) {
    await adapter.setLearningSession(track, {
      account_key: input.accountKey,
      cursor: migratedSession.cursor,
      learning_acknowledged_at: input.acknowledgedAt,
      learning_server_sequence: maximumLearningServerSequence(
        migratedProjection.events_by_card_id,
      ),
      revision: migratedSession.revision + 1,
      track,
      updated_at: input.acknowledgedAt,
    });
  }

  for (const [activityDay, progress] of progressWrites) {
    await adapter.setDailyProgress(activityDay, {
      ...progress,
      account_key: input.accountKey,
      projection_version: 'learning-events.v2',
    });
  }

  return orderedResults(input.events, classificationByEventId);
}

function createMemoryAdapter(options, staged, input) {
  return {
    getCursor: (deviceId, sequence) =>
      cloneJson(
        staged.learningEventCursors.get(
          createLearningEventCursorId(input.accountKey, deviceId, sequence),
        ) ?? null,
      ),
    getDailyProgress: dayKey =>
      cloneJson(
        staged.dailyProgress.get(
          createAccountDailyProgressKey(input.accountKey, dayKey),
        ) ?? null,
      ),
    getEvent: eventId =>
      cloneJson(
        staged.learningEvents.get(
          createLearningEventId(input.accountKey, eventId),
        ) ?? null,
      ),
    getLearningProjection: track =>
      cloneJson(
        staged.learningStates.get(
          createAccountLearningStateKey(input.accountKey, track),
        ) ?? null,
      ),
    getLearningSession: track =>
      cloneJson(
        staged.learningSessions.get(
          createAccountLearningSessionKey(input.accountKey, track),
        ) ?? null,
      ),
    getLegacyDailyProgress: dayKey =>
      cloneJson(
        staged.dailyProgress.get(`${input.phoneNumber}:${dayKey}`) ?? null,
      ),
    getSequence: () =>
      cloneJson(
        staged.learningEventSequences.get(
          createLearningEventSequenceId(input.accountKey),
        ) ?? null,
      ),
    listLegacyLearningStates: () => {
      const revision = normalizeLearningMigrationRevision(
        staged.learningMigrationRevisions.get(
          createLearningMigrationRevisionId(input.accountKey),
        ) ?? null,
        input.accountKey,
      );

      if (revision.status !== 'open') {
        throw invalidStoredState(
          'A migrated legacy snapshot is missing its account sequence.',
        );
      }

      return [...staged.learningStates.entries()]
        .filter(([key]) => key.startsWith(`${input.phoneNumber}:`))
        .map(([, value]) => cloneJson(value));
    },
    markLegacyLearningMigrated: acknowledgedAt => {
      const revisionId = createLearningMigrationRevisionId(input.accountKey);
      const revision = normalizeLearningMigrationRevision(
        staged.learningMigrationRevisions.get(revisionId) ?? null,
        input.accountKey,
      );
      staged.learningMigrationRevisions.set(revisionId, {
        account_key: input.accountKey,
        revision: revision.revision,
        status: 'migrated',
        updated_at: acknowledgedAt,
      });
    },
    readContentVersion: query =>
      readMemoryContentVersion(options, staged, query),
    setCursor: (deviceId, sequence, value) => {
      staged.learningEventCursors.set(
        createLearningEventCursorId(input.accountKey, deviceId, sequence),
        cloneJson(value),
      );
    },
    setDailyProgress: (dayKey, value) => {
      staged.dailyProgress.set(
        createAccountDailyProgressKey(input.accountKey, dayKey),
        cloneJson(value),
      );
    },
    setEvent: (eventId, value) => {
      staged.learningEvents.set(
        createLearningEventId(input.accountKey, eventId),
        cloneJson(value),
      );
    },
    setLearningProjection: (track, value) => {
      staged.learningStates.set(
        createAccountLearningStateKey(input.accountKey, track),
        cloneJson(value),
      );
    },
    setLearningSession: (track, value) => {
      staged.learningSessions.set(
        createAccountLearningSessionKey(input.accountKey, track),
        cloneJson(value),
      );
    },
    setSequence: value => {
      staged.learningEventSequences.set(
        createLearningEventSequenceId(input.accountKey),
        cloneJson(value),
      );
    },
  };
}

async function readMemoryContentVersion(options, staged, query) {
  let current = staged.cardSources.get(query.track);

  if (!current && query.allowDevelopmentDefault) {
    current = options.createDefaultCardSource(query.track);
    staged.cardSources.set(query.track, cloneJson(current));
    staged.cardSourceVersions.set(
      createCardSourceVersionId(query.track, current.content_version),
      {
        ...cloneJson(current),
        retained_until: null,
        retention_status: 'active',
      },
    );
  }

  if (current) {
    const normalized = options.normalizeCardSource(current, query.track);

    if (normalized.content_version === query.contentVersion) {
      return contentSnapshot(normalized, true, current);
    }
  }

  const historical = staged.cardSourceVersions.get(
    createCardSourceVersionId(query.track, query.contentVersion),
  );

  if (!historical) {
    return null;
  }

  const normalized = options.normalizeCardSource(historical, query.track);

  if (normalized.content_version !== query.contentVersion) {
    throw invalidStoredState(
      'A retained content version has an invalid digest.',
    );
  }

  return contentSnapshot(normalized, false, historical);
}

function createCloudBaseAdapter(options, transaction, input, legacyMigration) {
  const collections = options.collections;
  const cardSources = transaction.collection(collections.cardSources);
  const cardSourceVersions = transaction.collection(
    collections.cardSourceVersions,
  );
  const dailyProgress = transaction.collection(collections.dailyProgress);
  const learningEventCursors = transaction.collection(
    collections.learningEventCursors,
  );
  const learningEvents = transaction.collection(collections.learningEvents);
  const learningMigrationRevisions = transaction.collection(
    collections.learningMigrationRevisions,
  );
  const learningEventSequences = transaction.collection(
    collections.learningEventSequences,
  );
  const learningSessions = transaction.collection(collections.learningSessions);
  const learningStates = transaction.collection(collections.learningStates);

  return {
    getCursor: (deviceId, sequence) =>
      getDocument(
        learningEventCursors,
        createLearningEventCursorId(input.accountKey, deviceId, sequence),
      ),
    getDailyProgress: dayKey =>
      getDocument(
        dailyProgress,
        createAccountDailyProgressId(input.accountKey, dayKey),
      ),
    getEvent: eventId =>
      getDocument(
        learningEvents,
        createLearningEventId(input.accountKey, eventId),
      ),
    getLearningProjection: track =>
      getDocument(
        learningStates,
        createAccountLearningStateId(input.accountKey, track),
      ),
    getLearningSession: track =>
      getDocument(
        learningSessions,
        createAccountLearningSessionId(input.accountKey, track),
      ),
    getLegacyDailyProgress: dayKey =>
      getDocument(
        dailyProgress,
        createDocumentId(`${input.phoneNumber}:${dayKey}`),
      ),
    getSequence: () =>
      getDocument(
        learningEventSequences,
        createLearningEventSequenceId(input.accountKey),
      ),
    listLegacyLearningStates: async () => {
      if (legacyMigration === null) {
        throw legacyMigrationRetry();
      }

      const revision = normalizeLearningMigrationRevision(
        await getDocument(
          learningMigrationRevisions,
          createLearningMigrationRevisionId(input.accountKey),
        ),
        input.accountKey,
      );

      if (
        revision.status !== 'open' ||
        revision.revision !== legacyMigration.revision
      ) {
        throw legacyMigrationRetry();
      }

      return cloneJson(legacyMigration.states);
    },
    markLegacyLearningMigrated: acknowledgedAt => {
      if (legacyMigration === null) {
        throw legacyMigrationRetry();
      }

      return setDocument(
        learningMigrationRevisions,
        createLearningMigrationRevisionId(input.accountKey),
        {
          account_key: input.accountKey,
          revision: legacyMigration.revision,
          status: 'migrated',
          updated_at: acknowledgedAt,
        },
      );
    },
    readContentVersion: query =>
      readCloudBaseContentVersion(
        options,
        cardSources,
        cardSourceVersions,
        query,
        input.acknowledgedAt,
      ),
    setCursor: (deviceId, sequence, value) =>
      setDocument(
        learningEventCursors,
        createLearningEventCursorId(input.accountKey, deviceId, sequence),
        value,
      ),
    setDailyProgress: (dayKey, value) =>
      setDocument(
        dailyProgress,
        createAccountDailyProgressId(input.accountKey, dayKey),
        value,
      ),
    setEvent: (eventId, value) =>
      setDocument(
        learningEvents,
        createLearningEventId(input.accountKey, eventId),
        value,
      ),
    setLearningProjection: (track, value) =>
      setDocument(
        learningStates,
        createAccountLearningStateId(input.accountKey, track),
        value,
      ),
    setLearningSession: (track, value) =>
      setDocument(
        learningSessions,
        createAccountLearningSessionId(input.accountKey, track),
        value,
      ),
    setSequence: value =>
      setDocument(
        learningEventSequences,
        createLearningEventSequenceId(input.accountKey),
        value,
      ),
  };
}

async function readCloudBaseContentVersion(
  options,
  cardSources,
  cardSourceVersions,
  query,
  acknowledgedAt,
) {
  let current = await getDocument(cardSources, query.track);

  if (!current && query.allowDevelopmentDefault) {
    current = options.createDefaultCardSource(query.track);
    await setDocument(cardSources, query.track, {
      ...current,
      updated_at: acknowledgedAt,
    });
    await setDocument(
      cardSourceVersions,
      createCardSourceVersionId(query.track, current.content_version),
      {
        ...current,
        retained_until: null,
        retention_status: 'active',
      },
    );
  }

  if (current) {
    const normalized = options.normalizeCardSource(current, query.track);

    if (normalized.content_version === query.contentVersion) {
      return contentSnapshot(normalized, true, current);
    }
  }

  const historical = await getDocument(
    cardSourceVersions,
    createCardSourceVersionId(query.track, query.contentVersion),
  );

  if (!historical) {
    return null;
  }

  const normalized = options.normalizeCardSource(historical, query.track);

  if (normalized.content_version !== query.contentVersion) {
    throw invalidStoredState(
      'A retained content version has an invalid digest.',
    );
  }

  return contentSnapshot(normalized, false, historical);
}

function contentSnapshot(cardSource, isCurrent, metadata) {
  const retentionStatus =
    metadata.retention_status ?? (isCurrent ? 'active' : 'retained');

  if (!RETENTION_STATUSES.includes(retentionStatus)) {
    throw invalidStoredState(
      'A content version has an invalid retention status.',
    );
  }

  if (isCurrent && retentionStatus !== 'active') {
    throw invalidStoredState('The current content version is not active.');
  }

  if (!isCurrent && retentionStatus === 'active') {
    throw invalidStoredState(
      'A historical content version cannot remain active.',
    );
  }

  const retainedUntil = metadata.retained_until ?? null;

  if (retainedUntil !== null && typeof retainedUntil !== 'string') {
    throw invalidStoredState(
      'A content version has an invalid retention deadline.',
    );
  }

  return {
    cardSource,
    isCurrent,
    retainedUntil,
    retentionStatus,
  };
}

function orderedResults(events, classificationByEventId) {
  const seen = new Set();

  return events.map(event => {
    const eventId = event.payload.event_id;
    const classification = classificationByEventId.get(eventId);

    if (!classification) {
      throw invalidStoredState(
        'A committed event is missing its acknowledgement.',
      );
    }

    const status =
      classification.status === 'accepted' && !seen.has(eventId)
        ? 'accepted'
        : 'duplicate';
    seen.add(eventId);

    return {
      event_id: eventId,
      status,
      server_sequence: classification.serverSequence,
    };
  });
}

function assertValidatedEntries(expected, actual) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw invalidStoredState(
      'Content validation returned an incomplete batch.',
    );
  }

  for (let index = 0; index < expected.length; index += 1) {
    const entry = actual[index];

    if (
      !entry ||
      entry.payload?.event_id !== expected[index].payload.event_id ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.activityDay) ||
      typeof entry.sourceId !== 'string' ||
      entry.sourceId.length === 0 ||
      typeof entry.sourceLabel !== 'string' ||
      entry.sourceLabel.length === 0
    ) {
      throw invalidStoredState('Content validation returned an invalid batch.');
    }
  }
}

function normalizeStoredEvent(value, expected) {
  if (
    !isObject(value) ||
    value.account_key !== expected.accountKey ||
    value.event_id !== expected.eventId ||
    (value.track !== 'cet4' && value.track !== 'cet6') ||
    typeof value.payload_digest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.payload_digest) ||
    !isObject(value.payload) ||
    value.payload.event_id !== expected.eventId ||
    !Number.isSafeInteger(value.server_sequence) ||
    value.server_sequence <= 0
  ) {
    throw invalidStoredState('An immutable event record is invalid.');
  }

  const computedDigest = sha256(
    stableJsonStringify({payload: value.payload, track: value.track}),
  );

  if (computedDigest !== value.payload_digest) {
    throw invalidStoredState('An immutable event payload digest is invalid.');
  }

  return {
    payloadDigest: value.payload_digest,
    serverSequence: value.server_sequence,
    track: value.track,
  };
}

function normalizeStoredCursor(value, expected) {
  if (
    !isObject(value) ||
    value.account_key !== expected.accountKey ||
    value.device_id !== expected.deviceId ||
    value.sequence !== expected.sequence ||
    typeof value.event_id !== 'string' ||
    value.event_id.length === 0
  ) {
    throw invalidStoredState('A device cursor binding is invalid.');
  }

  return {eventId: value.event_id};
}

function normalizeSequenceState(
  value,
  legacyStates,
  expectedAccountKey,
  minimumServerSequence,
) {
  if (value === null || value === undefined) {
    if (minimumServerSequence > 0) {
      throw invalidStoredState(
        'An accepted event is missing its account sequence.',
      );
    }

    return {
      lastServerSequence: 0,
      pendingReviewCount: countLegacyPendingReview(legacyStates),
    };
  }

  if (
    !isObject(value) ||
    value.account_key !== expectedAccountKey ||
    !Number.isSafeInteger(value.last_server_sequence) ||
    value.last_server_sequence <= 0 ||
    value.last_server_sequence < minimumServerSequence ||
    !Number.isSafeInteger(value.pending_review_count) ||
    value.pending_review_count < 0
  ) {
    throw invalidStoredState('The account learning-event sequence is invalid.');
  }

  return {
    lastServerSequence: value.last_server_sequence,
    pendingReviewCount: value.pending_review_count,
  };
}

function normalizeLearningMigrationRevision(value, expectedAccountKey) {
  if (value === null || value === undefined) {
    return {revision: 0, status: 'open'};
  }

  if (
    !isObject(value) ||
    value.account_key !== expectedAccountKey ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    (value.status !== 'open' && value.status !== 'migrated') ||
    typeof value.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(value.updated_at))
  ) {
    throw invalidStoredState(
      'The legacy learning migration revision is invalid.',
    );
  }

  return {revision: value.revision, status: value.status};
}

function normalizeLearningProjection(
  value,
  expectedTrack,
  expectedAccountKey,
  maximumServerSequence,
) {
  if (
    !isObject(value) ||
    value.account_key !== expectedAccountKey ||
    value.projection_version !== 'learning-events.v2' ||
    value.track !== expectedTrack ||
    value.cursor !== null ||
    value.scheduler_version !== SCHEDULER_POLICY_VERSION ||
    !isObject(value.scheduler_by_card_id) ||
    typeof value.legacy_baseline_migrated !== 'boolean' ||
    !isObject(value.events_by_card_id) ||
    Object.keys(value.events_by_card_id).length === 0 ||
    typeof value.acknowledged_at !== 'string' ||
    !Number.isFinite(Date.parse(value.acknowledged_at)) ||
    typeof value.source_id !== 'string' ||
    value.source_id.length === 0 ||
    typeof value.source_label !== 'string' ||
    value.source_label.length === 0
  ) {
    throw invalidStoredState('The account learning projection is invalid.');
  }

  const acceptedEventIds = new Set();
  const acceptedSequences = new Set();
  let migratedEventCount = 0;

  for (const [cardId, event] of Object.entries(value.events_by_card_id)) {
    validateProjectionEvent(event, cardId, maximumServerSequence);

    if (event.server_sequence > 0) {
      if (
        acceptedEventIds.has(event.event_id) ||
        acceptedSequences.has(event.server_sequence)
      ) {
        throw invalidStoredState(
          'The account learning projection contains duplicate event authority.',
        );
      }
      acceptedEventIds.add(event.event_id);
      acceptedSequences.add(event.server_sequence);
    } else {
      migratedEventCount += 1;
    }
  }

  if (
    (migratedEventCount > 0 && !value.legacy_baseline_migrated) ||
    (acceptedSequences.size === 0 && !value.legacy_baseline_migrated)
  ) {
    throw invalidStoredState(
      'The account learning projection has invalid migration authority.',
    );
  }

  try {
    normalizeSchedulerProjection(value);
  } catch (error) {
    throw invalidStoredState(
      `The account scheduler projection is invalid: ${error.message}`,
    );
  }

  return cloneJson(value);
}

function normalizeStoredLearningSession(value, input) {
  try {
    return normalizeLearningSessionState(value, {
      accountKey: input.accountKey,
      track: input.track,
    });
  } catch (error) {
    throw invalidStoredState(
      `The account learning session is invalid: ${error.message}`,
    );
  }
}

function assertLearningSessionProjectionWatermark(sessionState, projection) {
  const expectedAcknowledgedAt =
    projection === null ? null : projection.acknowledged_at;
  const expectedServerSequence =
    projection === null
      ? 0
      : maximumLearningServerSequence(projection.events_by_card_id);

  if (
    sessionState.learning_acknowledged_at !== expectedAcknowledgedAt ||
    sessionState.learning_server_sequence !== expectedServerSequence
  ) {
    throw invalidStoredState(
      'The account learning session projection watermark is stale.',
    );
  }
}

function validateProjectionEvent(event, cardId, maximumServerSequence) {
  if (
    !isObject(event) ||
    event.card_id !== cardId ||
    !/^\d{6}$/.test(cardId) ||
    typeof event.completed_at !== 'string' ||
    !Number.isFinite(Date.parse(event.completed_at)) ||
    !Object.hasOwn(OUTCOMES_BY_INTERACTION, event.interaction_id) ||
    !OUTCOMES_BY_INTERACTION[event.interaction_id].includes(event.outcome) ||
    ANSWER_GRADE_BY_OUTCOME[event.outcome] !== event.answer_grade ||
    (event.phase !== 'learning' && event.phase !== 'review') ||
    typeof event.used_hint !== 'boolean' ||
    typeof event.used_peek !== 'boolean' ||
    !Number.isSafeInteger(event.server_sequence) ||
    event.server_sequence < 0 ||
    event.server_sequence > maximumServerSequence
  ) {
    throw invalidStoredState('The account learning projection is invalid.');
  }

  if (event.server_sequence === 0) {
    if (
      typeof event.is_favorited !== 'boolean' ||
      event.event_id !== undefined ||
      event.content_version !== undefined ||
      event.activity_day !== undefined
    ) {
      throw invalidStoredState(
        'A migrated learning projection event is invalid.',
      );
    }
    return;
  }

  const completedAt = Date.parse(event.completed_at);

  if (
    event.is_favorited !== undefined ||
    typeof event.event_id !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(event.event_id) ||
    typeof event.content_version !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(event.content_version) ||
    typeof event.activity_day !== 'string' ||
    !isValidDayKey(event.activity_day) ||
    event.activity_day !== chinaActivityDay(completedAt)
  ) {
    throw invalidStoredState(
      'An accepted learning projection event is invalid.',
    );
  }
}

function migrateLegacyLearningProjection(states, track) {
  const latestByCard = latestLegacyEvents(states, track);
  const projection = {
    acknowledged_at: null,
    cursor: null,
    events_by_card_id: {},
    legacy_baseline_migrated: latestByCard.size > 0,
    scheduler_by_card_id: {},
    scheduler_version: SCHEDULER_POLICY_VERSION,
    track,
  };

  for (const [cardId, entry] of latestByCard) {
    projection.events_by_card_id[cardId] = {
      ...cloneJson(entry.event),
      answer_grade: answerGradeForProjection(entry.event),
      server_sequence: 0,
    };

    if (
      projection.acknowledged_at === null ||
      entry.acknowledgedAt > projection.acknowledged_at
    ) {
      projection.acknowledged_at = entry.acknowledgedAt;
      projection.source_id = entry.sourceId;
      projection.source_label = entry.sourceLabel;
    }
  }

  return projection;
}

function latestLegacyEvents(states, expectedTrack = null) {
  const latest = new Map();

  for (const state of states) {
    if (
      !isObject(state) ||
      !isObject(state.events_by_card_id) ||
      !isValidDayKey(state.day_key)
    ) {
      throw invalidStoredState('A legacy learning snapshot is invalid.');
    }

    const track = state.track;

    if (track !== 'cet4' && track !== 'cet6') {
      throw invalidStoredState('A legacy learning snapshot track is invalid.');
    }

    if (expectedTrack && track !== expectedTrack) {
      continue;
    }

    const acknowledgedAt = normalizeLegacyTimestamp(
      state.acknowledged_at,
      state.day_key,
    );

    if (
      Object.keys(state.events_by_card_id).length > 0 &&
      (typeof state.source_id !== 'string' ||
        state.source_id.length === 0 ||
        typeof state.source_label !== 'string' ||
        state.source_label.length === 0)
    ) {
      throw invalidStoredState('A legacy learning snapshot is invalid.');
    }

    for (const [cardId, event] of Object.entries(state.events_by_card_id)) {
      validateLegacyLearningEvent(event, cardId);

      const completedAt = normalizeLegacyTimestamp(event.completed_at);
      const key = `${track}:${cardId}`;
      const current = latest.get(key);
      const orderKey = `${completedAt}:${acknowledgedAt}`;

      if (!current || orderKey > current.orderKey) {
        latest.set(key, {
          acknowledgedAt,
          event,
          orderKey,
          sourceId: state.source_id,
          sourceLabel: state.source_label,
          track,
        });
      }
    }
  }

  if (expectedTrack) {
    return new Map(
      [...latest.entries()].map(([key, value]) => [
        key.split(':').slice(1).join(':'),
        value,
      ]),
    );
  }

  return latest;
}

function validateLegacyLearningEvent(event, cardId) {
  if (
    !isObject(event) ||
    event.card_id !== cardId ||
    !/^\d{6}$/.test(cardId) ||
    typeof event.completed_at !== 'string' ||
    !Number.isFinite(Date.parse(event.completed_at)) ||
    !Object.hasOwn(OUTCOMES_BY_INTERACTION, event.interaction_id) ||
    !OUTCOMES_BY_INTERACTION[event.interaction_id].includes(event.outcome) ||
    (event.phase !== 'learning' && event.phase !== 'review') ||
    typeof event.used_hint !== 'boolean' ||
    typeof event.used_peek !== 'boolean' ||
    typeof event.is_favorited !== 'boolean' ||
    event.event_id !== undefined ||
    event.answer_grade !== undefined ||
    event.content_version !== undefined ||
    event.activity_day !== undefined ||
    (event.server_sequence !== undefined &&
      (!Number.isSafeInteger(event.server_sequence) ||
        event.server_sequence < 0))
  ) {
    throw invalidStoredState('A legacy learning event is invalid.');
  }
}

function countLegacyPendingReview(states) {
  return [...latestLegacyEvents(states).values()].filter(
    entry => answerGradeForProjection(entry.event) === 'review_needed',
  ).length;
}

function answerGradeForProjection(event) {
  if (
    event.answer_grade === 'passed' ||
    event.answer_grade === 'review_needed'
  ) {
    return event.answer_grade;
  }

  if (event.outcome === 'correct' || event.outcome === 'confident') {
    return 'passed';
  }

  if (event.outcome === 'incorrect' || event.outcome === 'review') {
    return 'review_needed';
  }

  throw invalidStoredState(
    'A learning projection has an invalid answer grade.',
  );
}

function createProjectionEvent(entry, serverSequence) {
  return {
    activity_day: entry.activityDay,
    answer_grade: entry.payload.answer_grade,
    card_id: entry.payload.card_id,
    completed_at: entry.payload.client_occurred_at,
    content_version: entry.payload.content_version,
    event_id: entry.payload.event_id,
    interaction_id: entry.payload.interaction_id,
    outcome: entry.payload.outcome,
    phase: entry.payload.phase,
    server_sequence: serverSequence,
    used_hint: entry.payload.used_hint,
    used_peek: entry.payload.used_peek,
  };
}

function normalizeDailyProgress(value, dayKey, expectedAccountKey = null) {
  if (value === null || value === undefined) {
    return {
      acknowledged_at: null,
      checked_in_today: false,
      day_key: dayKey,
      favorite_count: 0,
      learning_completed_count: 0,
      pending_review_count: 0,
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 0,
    };
  }

  if (
    !isObject(value) ||
    value.day_key !== dayKey ||
    (value.acknowledged_at !== null &&
      value.acknowledged_at !== undefined &&
      (typeof value.acknowledged_at !== 'string' ||
        !Number.isFinite(Date.parse(value.acknowledged_at)))) ||
    (expectedAccountKey !== null &&
      (value.account_key !== expectedAccountKey ||
        value.projection_version !== 'learning-events.v2'))
  ) {
    throw invalidStoredState('A daily progress projection is invalid.');
  }

  const progress = cloneJson(value);

  for (const field of [
    'favorite_count',
    'learning_completed_count',
    'pending_review_count',
    'review_completed_count',
    'sleeping_count',
    'total_completed_count',
  ]) {
    if (!Number.isSafeInteger(progress[field]) || progress[field] < 0) {
      throw invalidStoredState('A daily progress projection is invalid.');
    }
  }

  if (typeof progress.checked_in_today !== 'boolean') {
    throw invalidStoredState('A daily progress projection is invalid.');
  }

  const derivedTotal =
    progress.learning_completed_count + progress.review_completed_count;

  if (
    !Number.isSafeInteger(derivedTotal) ||
    (expectedAccountKey !== null &&
      progress.total_completed_count !== derivedTotal)
  ) {
    throw invalidStoredState('A daily progress projection is invalid.');
  }

  if (expectedAccountKey === null) {
    progress.total_completed_count = derivedTotal;
  }

  return progress;
}

function normalizeLegacyTimestamp(value, fallbackDay = null) {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  if (isValidDayKey(fallbackDay)) {
    return `${fallbackDay}T00:00:00.000Z`;
  }

  throw invalidStoredState('A legacy learning timestamp is invalid.');
}

function cloneMemoryState(state) {
  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, cloneMap(value)]),
  );
}

function commitMemoryState(state, staged) {
  for (const key of Object.keys(state)) {
    state[key].clear();
    for (const [entryKey, value] of staged[key]) {
      state[key].set(entryKey, cloneJson(value));
    }
  }
}

function cloneMap(value) {
  return new Map(
    [...value.entries()].map(([key, item]) => [key, cloneJson(item)]),
  );
}

function groupBy(values, keyForValue) {
  const grouped = new Map();

  for (const value of values) {
    const key = keyForValue(value);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(value);
  }

  return grouped;
}

async function getDocument(collection, documentId) {
  let result;

  try {
    result = await collection.doc(documentId).get();
  } catch (error) {
    if (isCloudBaseDocumentMissingError(error)) {
      return null;
    }

    throw error;
  }

  const documents = Array.isArray(result.data)
    ? result.data
    : result.data
    ? [result.data]
    : [];

  if (documents.length === 0) {
    return null;
  }

  if (documents.length !== 1) {
    throw invalidStoredState('A transactional document lookup was ambiguous.');
  }

  return stripInternalId(documents[0]);
}

async function listDocumentsByQuery(collection, query, pageSize, maximumCount) {
  const documents = [];

  for (let offset = 0; ; offset += pageSize) {
    const result = await collection
      .where(query)
      .orderBy('_id', 'asc')
      .skip(offset)
      .limit(pageSize)
      .get();

    if (!result || !Array.isArray(result.data)) {
      throw invalidStoredState('A transactional collection query is invalid.');
    }

    documents.push(...result.data.map(stripInternalId));

    if (documents.length > maximumCount) {
      throw invalidStoredState(
        'Legacy learning-state migration exceeds the supported bound.',
      );
    }

    if (result.data.length < pageSize) {
      return documents;
    }
  }
}

async function setDocument(collection, documentId, value) {
  await collection.doc(documentId).set(stripInternalId(value));
}

function isCloudBaseDocumentMissingError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('DOCUMENT_NOT_EXIST') ||
    message.includes('document not exists') ||
    message.includes('not found')
  );
}

function stripInternalId(value) {
  if (!isObject(value)) {
    return value;
  }

  const {_id, ...rest} = value;
  return cloneJson(rest);
}

function createLearningEventId(accountKey, eventId) {
  return createDocumentId(`learning-event\0${accountKey}\0${eventId}`);
}

function createLearningEventCursorId(accountKey, deviceId, sequence) {
  return createDocumentId(
    `learning-event-cursor\0${accountKey}\0${deviceId}\0${sequence}`,
  );
}

function createLearningEventSequenceId(accountKey) {
  return createDocumentId(`learning-event-sequence\0${accountKey}`);
}

function createLearningMigrationRevisionId(accountKey) {
  return createDocumentId(`learning-migration-revision\0${accountKey}`);
}

function createAccountDailyProgressId(accountKey, dayKey) {
  return createDocumentId(`account-daily-progress\0${accountKey}\0${dayKey}`);
}

function createAccountLearningStateId(accountKey, track) {
  return createDocumentId(`account-learning-state\0${accountKey}\0${track}`);
}

function createCardSourceVersionId(track, contentVersion) {
  return createDocumentId(`card-source-version\0${track}\0${contentVersion}`);
}

function createAccountDailyProgressKey(accountKey, dayKey) {
  return `account:${createAccountDailyProgressId(accountKey, dayKey)}`;
}

function createAccountLearningStateKey(accountKey, track) {
  return `account:${createAccountLearningStateId(accountKey, track)}`;
}

function createCursorKey(cursor) {
  return `${cursor.device_id}\0${cursor.sequence}`;
}

function chinaActivityDay(timestamp) {
  return new Date(timestamp + CHINA_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function isValidDayKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

function createDocumentId(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function eventConflict() {
  return createLearningEventsError(
    409,
    'learning_event_id_conflict',
    'An event ID is already bound to a different canonical payload.',
  );
}

function cursorConflict() {
  return createLearningEventsError(
    409,
    'learning_event_cursor_conflict',
    'A device cursor is already bound to a different event.',
  );
}

function legacyMigrationRetry() {
  const error = new Error('Legacy learning migration snapshot changed.');
  error[LEGACY_MIGRATION_RETRY] = true;
  return error;
}

function isLegacyMigrationRetry(error) {
  return Boolean(error?.[LEGACY_MIGRATION_RETRY]);
}

function invalidStoredState(message) {
  return createLearningEventsError(
    503,
    'learning_events_projection_invalid',
    message,
  );
}

function createLearningEventsError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error[LEARNING_EVENTS_ERROR] = true;
  return error;
}

function isLearningEventsError(error) {
  return Boolean(error?.[LEARNING_EVENTS_ERROR]);
}

function cloneJson(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  commitLearningEventsTransaction,
  createAccountDailyProgressId,
  createAccountDailyProgressKey,
  createAccountLearningStateId,
  createAccountLearningStateKey,
  createCardSourceVersionId,
  createCloudBaseLearningEventsCommitter,
  createLearningEventSequenceId,
  createLearningMigrationRevisionId,
  createLearningEventsError,
  createMemoryLearningEventsCommitter,
  createSerializedTransactionRunner,
  isLearningEventsError,
};
