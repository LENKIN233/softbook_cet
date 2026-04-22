import {
  createLearningCardState,
  evaluateLearningCard,
  LEARNING_TEST_CARDS,
} from '../src/learning/testDeck';

test('local test deck covers all core learning interactions', () => {
  expect(LEARNING_TEST_CARDS.map(card => card.interaction_id)).toEqual([
    'flip',
    'multiple_choice',
    'lock',
    'elimination',
    'swipe',
  ]);
});

test('flip card supports both confident and review outcomes', () => {
  const card = LEARNING_TEST_CARDS[0];
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
  const multipleChoiceCard = LEARNING_TEST_CARDS[1];
  const multipleChoiceState = createLearningCardState(multipleChoiceCard);
  multipleChoiceState.selectedOptionId = 'unclear';
  expect(evaluateLearningCard(multipleChoiceCard, multipleChoiceState)?.outcome).toBe(
    'correct',
  );

  const lockCard = LEARNING_TEST_CARDS[2];
  const lockState = createLearningCardState(lockCard);
  lockState.lockSelections.subject = 'The policy';
  lockState.lockSelections.verb = 'reduces';
  lockState.lockSelections.object = 'test anxiety';
  expect(evaluateLearningCard(lockCard, lockState)?.outcome).toBe('correct');

  const eliminationCard = LEARNING_TEST_CARDS[3];
  const eliminationState = createLearningCardState(eliminationCard);
  eliminationState.eliminatedItemIds = [
    'relative_clause',
    'adverb',
    'time_phrase',
  ];
  expect(evaluateLearningCard(eliminationCard, eliminationState)?.outcome).toBe(
    'correct',
  );

  const swipeCard = LEARNING_TEST_CARDS[4];
  const swipeState = createLearningCardState(swipeCard);
  swipeState.swipeSelection = 'risky';
  expect(evaluateLearningCard(swipeCard, swipeState)?.outcome).toBe('incorrect');
});
