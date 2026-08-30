import type {
  AccountBootstrapComponentRevisions,
  AccountBootstrapSnapshot,
} from './accountBootstrapRepository';

type RevisionRecord = Record<string, number>;

export function areAccountBootstrapComponentRevisionsAtLeast(
  candidate: AccountBootstrapComponentRevisions,
  baseline: AccountBootstrapComponentRevisions,
): boolean {
  return [
    [membershipRevisionRecord(baseline), membershipRevisionRecord(candidate)],
    [learningRevisionRecord(baseline), learningRevisionRecord(candidate)],
    [progressRevisionRecord(baseline), progressRevisionRecord(candidate)],
    [spaceRevisionRecord(baseline), spaceRevisionRecord(candidate)],
  ].every(([previous, next]) =>
    Object.entries(previous).every(
      ([field, previousValue]) => next[field] >= previousValue,
    ),
  );
}

export function assertAccountBootstrapRevisionTransition(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
): void {
  const previousRevisions = previous.componentRevisions;
  const nextRevisions = next.componentRevisions;
  const trackIsSame = previous.track === next.track;
  const dayIsSame = previous.dayKey === next.dayKey;
  const contentIsSame =
    previous.content.version === next.content.version &&
    previous.content.source.id === next.content.source.id;

  assertRevisionRecordDoesNotRegress(
    'membership',
    membershipRevisionRecord(previousRevisions),
    membershipRevisionRecord(nextRevisions),
  );
  if (trackIsSame) {
    assertRevisionRecordDoesNotRegress(
      'learning',
      learningRevisionRecord(previousRevisions),
      learningRevisionRecord(nextRevisions),
    );
  }
  assertRevisionFieldsDoNotRegress(
    'progress',
    progressRevisionRecord(previousRevisions),
    progressRevisionRecord(nextRevisions),
    dayIsSame
      ? ['checkInRevision', 'learningServerSequence', 'spaceRevision']
      : ['learningServerSequence', 'spaceRevision'],
  );
  assertRevisionRecordDoesNotRegress(
    'space',
    spaceRevisionRecord(previousRevisions),
    spaceRevisionRecord(nextRevisions),
  );

  if (
    revisionRecordsEqual(
      membershipRevisionRecord(previousRevisions),
      membershipRevisionRecord(nextRevisions),
    ) &&
    !jsonEqual(
      stableMembershipProjection(previous),
      stableMembershipProjection(next),
    )
  ) {
    throw new Error('Bootstrap membership changed without a new revision.');
  }

  if (
    revisionRecordsEqual(
      membershipRevisionRecord(previousRevisions),
      membershipRevisionRecord(nextRevisions),
    )
  ) {
    assertTrialRemainingPresentationTransition(previous, next);
  }

  if (trackIsSame) {
    assertLearningFactsDoNotRegress(previous, next, dayIsSame);
    assertLearningOwnerInvariants(previous, next, contentIsSame, dayIsSame);
  }
  if (dayIsSame) {
    assertDailyProgressFactsDoNotRegress(previous, next);
  }
  assertProgressOwnerInvariants(previous, next, {
    dayIsSame,
    spaceScopeIsSame: trackIsSame && contentIsSame,
  });

  if (
    revisionRecordsEqual(
      spaceRevisionRecord(previousRevisions),
      spaceRevisionRecord(nextRevisions),
    )
  ) {
    if (contentIsSame && previous.track === next.track) {
      if (!jsonEqual(previous.space.snapshot.states, next.space.snapshot.states)) {
        throw new Error('Bootstrap Space changed without a new revision.');
      }
    } else {
      assertSharedSpaceStatesEqual(previous, next);
    }
  }
}

function assertLearningFactsDoNotRegress(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
  dayIsSame: boolean,
) {
  const nextByCardId = new Map(
    next.learning.cardStates.map(state => [state.cardId, state]),
  );

  for (const previousState of previous.learning.cardStates) {
    const nextState = nextByCardId.get(previousState.cardId);

    if (
      nextState === undefined &&
      !(previousState.serverSequence === 0 && !dayIsSame)
    ) {
      throw new Error(
        'Bootstrap learning card sequence regressed or disappeared.',
      );
    }

    if (nextState === undefined) {
      continue;
    }

    if (
      previousState.serverSequence === 0 &&
      nextState.serverSequence === 0 &&
      !dayIsSame
    ) {
      continue;
    }

    if (nextState.serverSequence < previousState.serverSequence) {
      throw new Error(
        'Bootstrap learning card sequence regressed or disappeared.',
      );
    }

    if (
      nextState.serverSequence === previousState.serverSequence &&
      !jsonEqual(
        learningEventCardProjection(previousState),
        learningEventCardProjection(nextState),
      )
    ) {
      throw new Error(
        'Bootstrap learning card changed without a new per-card sequence.',
      );
    }
  }
}

function assertLearningOwnerInvariants(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
  contentIsSame: boolean,
  dayIsSame: boolean,
) {
  const beforeRevision = previous.componentRevisions.learning;
  const afterRevision = next.componentRevisions.learning;

  const legacyDayBaselineChanged =
    !dayIsSame &&
    beforeRevision.eventServerSequence === 0 &&
    afterRevision.eventServerSequence === 0;

  if (
    beforeRevision.eventServerSequence === afterRevision.eventServerSequence &&
    !legacyDayBaselineChanged
  ) {
    if (
      !jsonEqual(
        learningEventProjection(previous),
        learningEventProjection(next),
      )
    ) {
      throw new Error(
        'Bootstrap learning event facts changed without a new event revision.',
      );
    }
  }

  if (
    beforeRevision.sessionRevision === afterRevision.sessionRevision &&
    !jsonEqual(previous.learning.cursor, next.learning.cursor)
  ) {
    throw new Error(
      'Bootstrap learning cursor changed without a new session revision.',
    );
  }

  if (beforeRevision.spaceRevision === afterRevision.spaceRevision) {
    assertSharedLearningFavoriteFactsEqual(
      previous,
      next,
      contentIsSame,
      dayIsSame,
    );
  }
}

function assertProgressOwnerInvariants(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
  scope: {dayIsSame: boolean; spaceScopeIsSame: boolean},
) {
  const beforeRevision = previous.componentRevisions.progress;
  const afterRevision = next.componentRevisions.progress;
  const before = previous.progress.snapshot;
  const after = next.progress.snapshot;

  if (
    beforeRevision.learningServerSequence ===
    afterRevision.learningServerSequence
  ) {
    if (
      previous.progress.learningAuthority !== next.progress.learningAuthority
    ) {
      throw new Error(
        'Bootstrap Progress learning authority changed without a new event revision.',
      );
    }

    if (before.pendingReviewCount !== after.pendingReviewCount) {
      throw new Error(
        'Bootstrap pending review count changed without a new event revision.',
      );
    }

    if (
      scope.dayIsSame &&
      !jsonEqual(
        dailyLearningProgressProjection(before),
        dailyLearningProgressProjection(after),
      )
    ) {
      throw new Error(
        'Bootstrap progress learning facts changed without a new event revision.',
      );
    }
  }

  if (
    scope.dayIsSame &&
    beforeRevision.checkInRevision === afterRevision.checkInRevision &&
    before.checkedInToday !== after.checkedInToday
  ) {
    throw new Error(
      'Bootstrap check-in fact changed without a new check-in revision.',
    );
  }

  if (
    scope.spaceScopeIsSame &&
    beforeRevision.spaceRevision === afterRevision.spaceRevision &&
    (before.favoriteCount !== after.favoriteCount ||
      before.sleepingCount !== after.sleepingCount)
  ) {
    throw new Error(
      'Bootstrap progress Space facts changed without a new Space revision.',
    );
  }
}

function assertDailyProgressFactsDoNotRegress(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
) {
  const before = previous.progress.snapshot;
  const after = next.progress.snapshot;

  if (
    (before.checkedInToday && !after.checkedInToday) ||
    after.learningCompletedCount < before.learningCompletedCount ||
    after.reviewCompletedCount < before.reviewCompletedCount ||
    after.totalCompletedCount < before.totalCompletedCount
  ) {
    throw new Error('Bootstrap daily progress regressed.');
  }
}

function assertSharedSpaceStatesEqual(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
) {
  const nextByCardId = new Map(
    next.space.snapshot.states.map(state => [state.cardId, state]),
  );

  for (const previousState of previous.space.snapshot.states) {
    const nextState = nextByCardId.get(previousState.cardId);

    if (nextState !== undefined && !jsonEqual(previousState, nextState)) {
      throw new Error(
        'Bootstrap shared Space state changed without a new revision.',
      );
    }
  }
}

function learningEventProjection(snapshot: AccountBootstrapSnapshot) {
  return {
    cardStates: snapshot.learning.cardStates.map(learningEventCardProjection),
    source: snapshot.learning.source,
  };
}

function learningEventCardProjection(
  state: AccountBootstrapSnapshot['learning']['cardStates'][number],
) {
  return {
    cardId: state.cardId,
    completedAt: state.completedAt,
    interactionId: state.interactionId,
    outcome: state.outcome,
    phase: state.phase,
    serverSequence: state.serverSequence,
    usedHint: state.usedHint,
    usedPeek: state.usedPeek,
  };
}

function assertSharedLearningFavoriteFactsEqual(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
  contentIsSame: boolean,
  dayIsSame: boolean,
) {
  if (!contentIsSame) {
    return;
  }

  const nextByCardId = new Map(
    next.learning.cardStates.map(state => [state.cardId, state]),
  );

  for (const previousState of previous.learning.cardStates) {
    const nextState = nextByCardId.get(previousState.cardId);

    if (
      nextState === undefined &&
      previousState.serverSequence === 0 &&
      !dayIsSame
    ) {
      continue;
    }

    if (nextState === undefined) {
      throw new Error(
        'Bootstrap learning favorite facts disappeared without a content change.',
      );
    }

    if (previousState.isFavorited !== nextState.isFavorited) {
      throw new Error(
        'Bootstrap learning favorite fact changed without a new Space revision.',
      );
    }
  }
}

function dailyLearningProgressProjection(
  progress: AccountBootstrapSnapshot['progress']['snapshot'],
) {
  return {
    learningCompletedCount: progress.learningCompletedCount,
    reviewCompletedCount: progress.reviewCompletedCount,
    totalCompletedCount: progress.totalCompletedCount,
  };
}

function stableMembershipProjection(snapshot: AccountBootstrapSnapshot) {
  const state = snapshot.membership.state;

  return {
    countedEntryCount: state.countedEntryCount,
    lastExperienceEndedBy: state.lastExperienceEndedBy,
    recoveryPromptVisible: state.recoveryPromptVisible,
    stage: state.stage,
    trialDurationDays: state.trialDurationDays,
    trialExpiresAt: state.trialExpiresAt,
    trialStartedAt: state.trialStartedAt,
    trialStartedAtEntryCount: state.trialStartedAtEntryCount,
  };
}

function assertTrialRemainingPresentationTransition(
  previous: AccountBootstrapSnapshot,
  next: AccountBootstrapSnapshot,
) {
  const previousState = previous.membership.state;
  const nextState = next.membership.state;

  if (previousState.stage !== 'trial' || nextState.stage !== 'trial') {
    if (
      previousState.trialRemainingSeconds !== 0 ||
      nextState.trialRemainingSeconds !== 0
    ) {
      throw new Error('Bootstrap membership trial presentation is invalid.');
    }
    return;
  }

  const previousGeneratedAt = Date.parse(previous.generatedAt);
  const nextGeneratedAt = Date.parse(next.generatedAt);

  if (
    nextGeneratedAt >= previousGeneratedAt &&
    nextState.trialRemainingSeconds > previousState.trialRemainingSeconds
  ) {
    throw new Error(
      'Bootstrap membership trial remaining time increased without a new revision.',
    );
  }

  const elapsedSeconds = Math.ceil(
    Math.max(nextGeneratedAt - previousGeneratedAt, 0) / 1000,
  );
  if (
    nextGeneratedAt >= previousGeneratedAt &&
    previousState.trialRemainingSeconds -
      nextState.trialRemainingSeconds >
      elapsedSeconds
  ) {
    throw new Error(
      'Bootstrap membership trial remaining time decreased faster than the server clock.',
    );
  }
}

function membershipRevisionRecord(
  revisions: AccountBootstrapComponentRevisions,
): RevisionRecord {
  return revisions.membership;
}

function learningRevisionRecord(
  revisions: AccountBootstrapComponentRevisions,
): RevisionRecord {
  return revisions.learning;
}

function progressRevisionRecord(
  revisions: AccountBootstrapComponentRevisions,
): RevisionRecord {
  return revisions.progress;
}

function spaceRevisionRecord(
  revisions: AccountBootstrapComponentRevisions,
): RevisionRecord {
  return revisions.space;
}

function assertRevisionRecordDoesNotRegress(
  label: string,
  previous: RevisionRecord,
  next: RevisionRecord,
) {
  for (const [field, previousValue] of Object.entries(previous)) {
    if (next[field] < previousValue) {
      throw new Error(`Bootstrap ${label} revision ${field} regressed.`);
    }
  }
}

function assertRevisionFieldsDoNotRegress(
  label: string,
  previous: RevisionRecord,
  next: RevisionRecord,
  fields: string[],
) {
  for (const field of fields) {
    if (next[field] < previous[field]) {
      throw new Error(`Bootstrap ${label} revision ${field} regressed.`);
    }
  }
}

function revisionRecordsEqual(left: RevisionRecord, right: RevisionRecord) {
  return Object.keys(left).every(field => left[field] === right[field]);
}

function jsonEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
