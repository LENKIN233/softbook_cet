import { CORE_INTERACTION_ORDER, LearningCard } from '../src/learning/model';
import { localLearningCardSource } from '../src/learning/localCardSource';
import {
  createLearningCardState,
  createLocalLearningSession,
  evaluateLearningCard,
  selectReviewCards,
} from '../src/learning/session';

test('local card source exposes structured TLGBNN ownership data', () => {
  const cards = localLearningCardSource.loadCards('cet4');

  expect(cards.length).toBeGreaterThan(CORE_INTERACTION_ORDER.length);

  cards.forEach(card => {
    expect(card.card_id).toMatch(/^\d{6}$/);
    expect(card.knowledge_ref).toMatch(/^\d{4}$/);
    expect(card.card_id.startsWith(card.knowledge_ref)).toBe(true);
    expect(card.space_metadata.box_ref).toBe(card.knowledge_ref);
  });
});

test('local card source can derive a usable cet6 track', () => {
  const cards = localLearningCardSource.loadCards('cet6');

  expect(cards.length).toBeGreaterThan(CORE_INTERACTION_ORDER.length);
  expect(cards.every(card => card.track === 'cet6')).toBe(true);
  expect(
    cards.every(card => card.card_id.startsWith(card.knowledge_ref)),
  ).toBe(true);
});

test('local learning session picks one card per core interaction before duplicates', () => {
  const session = createLocalLearningSession('cet4');

  expect(session.catalogCards.length).toBeGreaterThan(session.cards.length);
  expect(session.cards.map(card => card.interaction_id)).toEqual(
    CORE_INTERACTION_ORDER,
  );
  expect(new Set(session.cards.map(card => card.card_id)).size).toBe(
    session.cards.length,
  );
  expect(session.catalogCards.length).toBeGreaterThan(session.cards.length);
  expect(session.catalogCards[0].track).toBe('cet4');
});

test('local learning session keeps the active track across the catalog and deck', () => {
  const session = createLocalLearningSession('cet6');

  expect(session.track).toBe('cet6');
  expect(session.cards.every(card => card.track === 'cet6')).toBe(true);
  expect(session.catalogCards.every(card => card.track === 'cet6')).toBe(true);
});

test('flip card supports both confident and review outcomes', () => {
  const session = createLocalLearningSession('cet4');
  const card = session.cards[0];
  const confidentState = createLearningCardState(card);
  confidentState.isFlipped = true;
  confidentState.flipConfidence = 'confident';

  expect(evaluateLearningCard(card, confidentState)?.outcome).toBe('confident');

  const reviewState = createLearningCardState(card);
  reviewState.isFlipped = true;
  reviewState.flipConfidence = 'review';

  expect(evaluateLearningCard(card, reviewState)?.outcome).toBe('review');
});

test('multiple choice, lock, elimination and swipe cards can all be auto-scored', () => {
  const session = createLocalLearningSession('cet4');
  const cardsByInteraction = session.cards.reduce<
    Partial<Record<LearningCard['interaction_id'], LearningCard>>
  >((carry, card) => {
    carry[card.interaction_id] = card;
    return carry;
  }, {});

  const multipleChoiceCard = cardsByInteraction.multiple_choice!;
  const multipleChoiceState = createLearningCardState(multipleChoiceCard);
  multipleChoiceState.selectedOptionId = 'unclear';
  expect(
    evaluateLearningCard(multipleChoiceCard, multipleChoiceState)?.outcome,
  ).toBe('correct');

  const lockCard = cardsByInteraction.lock!;
  const lockState = createLearningCardState(lockCard);
  lockState.lockSelections.subject = 'The policy';
  lockState.lockSelections.verb = 'reduces';
  lockState.lockSelections.object = 'test anxiety';
  expect(evaluateLearningCard(lockCard, lockState)?.outcome).toBe('correct');

  const eliminationCard = cardsByInteraction.elimination!;
  const eliminationState = createLearningCardState(eliminationCard);
  eliminationState.eliminatedItemIds = [
    'relative_clause',
    'adverb',
    'time_phrase',
  ];
  expect(evaluateLearningCard(eliminationCard, eliminationState)?.outcome).toBe(
    'correct',
  );

  const swipeCard = cardsByInteraction.swipe!;
  const swipeState = createLearningCardState(swipeCard);
  swipeState.swipeSelection = 'risky';
  expect(evaluateLearningCard(swipeCard, swipeState)?.outcome).toBe(
    'incorrect',
  );
});

test('review flow only pulls incorrect and review cards in original order', () => {
  const session = createLocalLearningSession('cet4');
  const [flipCard, multipleChoiceCard, lockCard] = session.cards;

  const results = [
    {
      cardId: lockCard.card_id,
      interactionId: lockCard.interaction_id,
      outcome: 'incorrect' as const,
      usedHint: false,
      usedPeek: false,
      isFavorited: false,
    },
    {
      cardId: flipCard.card_id,
      interactionId: flipCard.interaction_id,
      outcome: 'review' as const,
      usedHint: false,
      usedPeek: false,
      isFavorited: false,
    },
    {
      cardId: multipleChoiceCard.card_id,
      interactionId: multipleChoiceCard.interaction_id,
      outcome: 'correct' as const,
      usedHint: false,
      usedPeek: false,
      isFavorited: false,
    },
  ];

  expect(selectReviewCards(session.cards, results).map(card => card.card_id)).toEqual([
    flipCard.card_id,
    lockCard.card_id,
  ]);
});
