import {
  reconcileAccountBootstrap,
  resolveAccountBootstrapLearningState,
} from '../src/bootstrap/accountBootstrapHydration';
import type { AccountBootstrapSnapshot } from '../src/bootstrap/accountBootstrapRepository';
import { createLocalLearningSession } from '../src/learning/session';

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;

function createContentBoundSession() {
  return {
    ...createLocalLearningSession('cet4'),
    contentVersion: CONTENT_VERSION,
  };
}

function createBootstrapFixture(): AccountBootstrapSnapshot {
  const session = createContentBoundSession();
  const firstCard = session.catalogCards[0];
  const secondCard = session.catalogCards[1];

  return {
    componentRevisions: {
      learning: {
        eventServerSequence: 1,
        sessionRevision: 1,
        spaceRevision: 1,
      },
      membership: {
        baseMembershipRevision: 0,
        betaEntitlementRevision: 0,
      },
      progress: {
        checkInRevision: 0,
        learningServerSequence: 1,
        spaceRevision: 1,
      },
      schemaVersion: 'bootstrap-component-revisions.v1',
      space: { stateRevision: 1 },
    },
    content: {
      cardCount: session.catalogCards.length,
      minimumClientVersion: null,
      parentReleaseId: null,
      publishedAt: null,
      releaseId: null,
      source: { id: session.sourceId, label: session.sourceLabel },
      version: CONTENT_VERSION,
    },
    dayKey: '2026-07-20',
    generatedAt: '2026-07-20T10:00:00.000Z',
    learning: {
      acknowledgedAt: '2026-07-20T09:00:00.000Z',
      cardStates: [
        {
          cardId: firstCard.card_id,
          completedAt: '2026-07-20T08:00:00.000Z',
          interactionId: firstCard.interaction_id,
          isFavorited: true,
          outcome:
            firstCard.interaction_id === 'flip' ? 'confident' : 'correct',
          phase: 'learning',
          serverSequence: 1,
          usedHint: false,
          usedPeek: false,
        },
      ],
      cursor: {
        cardId: secondCard.card_id,
        sourceId: session.sourceId,
        track: 'cet4',
      },
      source: { id: session.sourceId, label: session.sourceLabel },
    },
    membership: {
      acknowledgedAt: null,
      state: {
        countedEntryCount: 0,
        lastExperienceEndedBy: null,
        recoveryPromptVisible: false,
        stage: 'trial_available',
        trialDurationDays: 5,
        trialStartedAtEntryCount: null,
      },
    },
    progress: {
      acknowledgedAt: null,
      learningAuthority: 'empty',
      snapshot: {
        checkedInToday: false,
        dayKey: '2026-07-20',
        favoriteCount: 1,
        learningCompletedCount: 1,
        pendingReviewCount: 0,
        reviewCompletedCount: 0,
        sleepingCount: 0,
        totalCompletedCount: 1,
      },
    },
    schemaVersion: 'bootstrap.v2',
    space: {
      acknowledgedAt: null,
      snapshot: {
        dayKey: '2026-07-20',
        states: [
          {
            cardId: firstCard.card_id,
            isFavorited: true,
            isSleeping: false,
            lastModifiedAt: '2026-07-20T09:00:00.000Z',
          },
        ],
      },
    },
    track: 'cet4',
  };
}

test('reconciles same-day local state only after canonical read', () => {
  const bootstrap = createBootstrapFixture();
  const cardId = bootstrap.space.snapshot.states[0].cardId;
  const result = reconcileAccountBootstrap(
    {
      checkedInDayKey: bootstrap.dayKey,
      learningCursor: {
        cardId: 'stale-card',
        sourceId: 'stale-source',
        track: 'cet4',
      },
      spaceCardStateById: {
        [cardId]: {
          isFavorited: false,
          isSleeping: true,
          lastModifiedAt: '2026-07-20T08:00:00.000Z',
        },
      },
    },
    bootstrap,
  );

  expect(result.persistedUserState).toMatchObject({
    checkedInDayKey: null,
    learningCursor: bootstrap.learning.cursor,
    spaceCardStateById: {
      [cardId]: {
        isFavorited: true,
        isSleeping: false,
        lastModifiedAt: '2026-07-20T09:00:00.000Z',
      },
    },
  });
});

test('preserves same-day check-in only when a durable command is pending', () => {
  const bootstrap = createBootstrapFixture();
  const result = reconcileAccountBootstrap(
    {
      checkedInDayKey: bootstrap.dayKey,
      learningCursor: null,
      spaceCardStateById: {},
    },
    bootstrap,
    { pendingCheckInDayKey: bootstrap.dayKey },
  );

  expect(result.persistedUserState.checkedInDayKey).toBe(bootstrap.dayKey);
});

test('discards unqueued local space state after a canonical read', () => {
  const bootstrap = createBootstrapFixture();
  const cardId = bootstrap.space.snapshot.states[0].cardId;
  const result = reconcileAccountBootstrap(
    {
      checkedInDayKey: null,
      learningCursor: null,
      spaceCardStateById: {
        [cardId]: {
          isFavorited: false,
          isSleeping: true,
          lastModifiedAt: '2026-07-20T10:30:00.000Z',
        },
      },
    },
    bootstrap,
  );

  expect(result.persistedUserState.spaceCardStateById[cardId]).toMatchObject({
    isFavorited: true,
    isSleeping: false,
  });
});

test('overlays only durable pending space actions on canonical state', () => {
  const bootstrap = createBootstrapFixture();
  const cardId = bootstrap.space.snapshot.states[0].cardId;
  const result = reconcileAccountBootstrap(
    {
      checkedInDayKey: null,
      learningCursor: null,
      spaceCardStateById: {},
    },
    bootstrap,
    {
      pendingSpaceActions: [
        {
          actionId: 'space_pending_0001',
          cardId,
          clientOccurredAt: '2026-07-20T10:30:00.000Z',
          dimension: 'sleep',
          value: true,
        },
      ],
    },
  );

  expect(result.persistedUserState.spaceCardStateById[cardId]).toMatchObject({
    isFavorited: true,
    isSleeping: true,
    lastModifiedAt: '2026-07-20T10:30:00.000Z',
  });
});

test('restores canonical learning results against matching content', () => {
  const bootstrap = createBootstrapFixture();
  const session = createContentBoundSession();
  const result = resolveAccountBootstrapLearningState(bootstrap, session);

  expect(result.learningResults).toHaveLength(1);
  expect(result.reviewResults).toHaveLength(0);
});

test('does not treat a prior China-day card projection as current-day progress', () => {
  const bootstrap = createBootstrapFixture();
  bootstrap.dayKey = '2026-07-21';
  bootstrap.progress.snapshot = {
    ...bootstrap.progress.snapshot,
    dayKey: '2026-07-21',
    learningCompletedCount: 0,
    reviewCompletedCount: 0,
    totalCompletedCount: 0,
  };
  bootstrap.space.snapshot.dayKey = '2026-07-21';

  const result = resolveAccountBootstrapLearningState(
    bootstrap,
    createContentBoundSession(),
  );

  expect(result.learningResults).toEqual([]);
  expect(result.reviewResults).toEqual([]);
});

test('ignores retained history that no longer maps to the current content release', () => {
  const bootstrap = createBootstrapFixture();
  const session = createContentBoundSession();
  bootstrap.learning.cardStates = [
    {
      ...bootstrap.learning.cardStates[0],
      cardId: 'removed-card',
    },
    {
      ...bootstrap.learning.cardStates[0],
      interactionId: 'swipe',
      serverSequence: 2,
    },
  ];
  bootstrap.componentRevisions.learning.eventServerSequence = 2;
  bootstrap.componentRevisions.progress.learningServerSequence = 2;
  bootstrap.space.snapshot.states.push({
    cardId: 'removed-card',
    isFavorited: true,
    isSleeping: false,
    lastModifiedAt: '2026-07-20T09:05:00.000Z',
  });

  expect(
    resolveAccountBootstrapLearningState(bootstrap, session),
  ).toEqual({learningResults: [], reviewResults: []});
});

test('ignores retained learning source and cursor from a replaced source', () => {
  const bootstrap = createBootstrapFixture();
  bootstrap.learning.source = {
    id: 'retained-source-a',
    label: 'Retained source A',
  };
  bootstrap.learning.cursor = {
    cardId: 'removed-card-a',
    sourceId: 'retained-source-a',
    track: 'cet4',
  };

  expect(
    resolveAccountBootstrapLearningState(
      bootstrap,
      createContentBoundSession(),
    ),
  ).toEqual({learningResults: [], reviewResults: []});
});

test.each([
  {
    label: 'content source',
    mutate: (bootstrap: AccountBootstrapSnapshot) => {
      bootstrap.content.source.id = 'another-source';
    },
  },
  {
    label: 'content count',
    mutate: (bootstrap: AccountBootstrapSnapshot) => {
      bootstrap.content.cardCount += 1;
    },
  },
  {
    label: 'content version',
    mutate: (bootstrap: AccountBootstrapSnapshot) => {
      bootstrap.content.version = `sha256:${'b'.repeat(64)}`;
    },
  },
])('rejects canonical $label mismatch', ({ mutate }) => {
  const bootstrap = createBootstrapFixture();
  mutate(bootstrap);

  expect(() =>
    resolveAccountBootstrapLearningState(
      bootstrap,
      createContentBoundSession(),
    ),
  ).toThrow();
});
