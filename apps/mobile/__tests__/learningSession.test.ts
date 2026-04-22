import { CORE_INTERACTION_ORDER, LearningCard } from '../src/learning/model';
import { localLearningCardSource } from '../src/learning/localCardSource';
import {
  createLearningCardState,
  createLocalLearningSession,
  evaluateLearningCard,
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

test('local learning session picks one card per core interaction before duplicates', () => {
  const session = createLocalLearningSession('cet4');

  expect(session.cards.map(card => card.interaction_id)).toEqual(
    CORE_INTERACTION_ORDER,
  );
  expect(new Set(session.cards.map(card => card.card_id)).size).toBe(
    session.cards.length,
  );
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
