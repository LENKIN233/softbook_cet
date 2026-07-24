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
  expect(result.spaceStateSyncKey).toBe(
    JSON.stringify(bootstrap.space.snapshot),
  );
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
    {pendingCheckInDayKey: bootstrap.dayKey},
  );

  expect(result.persistedUserState.checkedInDayKey).toBe(bootstrap.dayKey);
});

test('preserves a newer local explicit space action for later push', () => {
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
    isFavorited: false,
    isSleeping: true,
  });
  expect(result.spaceStateSyncKey).toBe(
    JSON.stringify(bootstrap.space.snapshot),
  );
});

test('restores canonical learning results against matching content', () => {
  const bootstrap = createBootstrapFixture();
  const session = createContentBoundSession();
  const result = resolveAccountBootstrapLearningState(bootstrap, session);

  expect(result.learningResults).toHaveLength(1);
  expect(result.reviewResults).toHaveLength(0);
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
  {
    label: 'learning card interaction',
    mutate: (bootstrap: AccountBootstrapSnapshot) => {
      bootstrap.learning.cardStates[0].interactionId = 'swipe';
    },
  },
  {
    label: 'learning cursor',
    mutate: (bootstrap: AccountBootstrapSnapshot) => {
      bootstrap.learning.cursor!.cardId = 'missing-card';
    },
  },
  {
    label: 'space card',
    mutate: (bootstrap: AccountBootstrapSnapshot) => {
      bootstrap.space.snapshot.states[0].cardId = '999999';
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
