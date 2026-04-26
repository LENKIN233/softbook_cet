import {
  CORE_INTERACTION_ORDER,
  LearningCard,
  LearningCardResult,
  LearningCardState,
  LearningSession,
  LearningTrack,
} from './model';
import { localLearningCardSource } from './localCardSource';

export const DEFAULT_LEARNING_SESSION_CARD_COUNT =
  CORE_INTERACTION_ORDER.length;

export function createLearningSession(
  track: LearningTrack,
  sourceId: string,
  sourceLabel: string,
  availableCards: LearningCard[],
  cardCount: number = DEFAULT_LEARNING_SESSION_CARD_COUNT,
): LearningSession {
  const orderedCards = orderLearningCards(availableCards);

  return {
    catalogCards: orderedCards,
    sourceId,
    sourceLabel,
    track,
    cards: selectSessionCards(orderedCards, cardCount),
  };
}

export function createLocalLearningSession(
  track: LearningTrack,
  cardCount: number = DEFAULT_LEARNING_SESSION_CARD_COUNT,
): LearningSession {
  return createLearningSession(
    track,
    localLearningCardSource.sourceId,
    localLearningCardSource.sourceLabel,
    localLearningCardSource.loadCards(track),
    cardCount,
  );
}

export function selectSessionCards(
  availableCards: LearningCard[],
  cardCount: number = DEFAULT_LEARNING_SESSION_CARD_COUNT,
) {
  const orderedCards = orderLearningCards(availableCards);
  const selectedCardIds = new Set<string>();
  const selectedCards: LearningCard[] = [];

  for (const interactionId of CORE_INTERACTION_ORDER) {
    const nextCard = orderedCards.find(
      card =>
        card.interaction_id === interactionId &&
        !selectedCardIds.has(card.card_id),
    );

    if (!nextCard) {
      continue;
    }

    selectedCards.push(nextCard);
    selectedCardIds.add(nextCard.card_id);

    if (selectedCards.length >= cardCount) {
      return selectedCards;
    }
  }

  for (const card of orderedCards) {
    if (selectedCardIds.has(card.card_id)) {
      continue;
    }

    selectedCards.push(card);
    selectedCardIds.add(card.card_id);

    if (selectedCards.length >= cardCount) {
      break;
    }
  }

  return selectedCards;
}

function orderLearningCards(cards: LearningCard[]) {
  return [...cards].sort((left, right) =>
    left.card_id.localeCompare(right.card_id),
  );
}

export function createLearningCardState(card: LearningCard): LearningCardState {
  const lockSelections =
    card.interaction_id === 'lock'
      ? card.lock_slots.reduce<Record<string, string | null>>((carry, slot) => {
          carry[slot.id] = null;
          return carry;
        }, {})
      : {};

  return {
    isPeeked: false,
    isFavorited: false,
    isHintVisible: false,
    isFlipped: false,
    flipConfidence: null,
    selectedOptionId: null,
    lockSelections,
    eliminatedItemIds: [],
    swipeSelection: null,
  };
}

export function canSubmitLearningCard(
  card: LearningCard,
  state: LearningCardState,
) {
  switch (card.interaction_id) {
    case 'flip':
      return state.isFlipped && state.flipConfidence !== null;
    case 'multiple_choice':
      return state.selectedOptionId !== null;
    case 'lock':
      return card.lock_slots.every(
        slot => state.lockSelections[slot.id] !== null,
      );
    case 'elimination':
      return state.eliminatedItemIds.length > 0;
    case 'swipe':
      return state.swipeSelection !== null;
    default:
      return false;
  }
}

export function evaluateLearningCard(
  card: LearningCard,
  state: LearningCardState,
): LearningCardResult | null {
  const baseResult = {
    cardId: card.card_id,
    interactionId: card.interaction_id,
    usedHint: state.isHintVisible,
    usedPeek: state.isPeeked,
    isFavorited: state.isFavorited,
  };

  switch (card.interaction_id) {
    case 'flip':
      if (!state.isFlipped || state.flipConfidence === null) {
        return null;
      }

      return {
        ...baseResult,
        outcome: state.flipConfidence,
      };
    case 'multiple_choice':
      if (state.selectedOptionId === null) {
        return null;
      }

      return {
        ...baseResult,
        outcome:
          state.selectedOptionId === card.answer_key.correct_option
            ? 'correct'
            : 'incorrect',
      };
    case 'lock':
      if (!canSubmitLearningCard(card, state)) {
        return null;
      }

      return {
        ...baseResult,
        outcome: card.answer_key.lock_pattern.every(
          (expectedValue, index) =>
            state.lockSelections[card.lock_slots[index].id] === expectedValue,
        )
          ? 'correct'
          : 'incorrect',
      };
    case 'elimination':
      if (!canSubmitLearningCard(card, state)) {
        return null;
      }

      return {
        ...baseResult,
        outcome: areStringSetsEqual(
          state.eliminatedItemIds,
          card.answer_key.correct_items,
        )
          ? 'correct'
          : 'incorrect',
      };
    case 'swipe':
      if (state.swipeSelection === null) {
        return null;
      }

      return {
        ...baseResult,
        outcome:
          state.swipeSelection === card.answer_key.correct_state
            ? 'correct'
            : 'incorrect',
      };
    default:
      return null;
  }
}

export function summarizeLearningResults(
  results: LearningCardResult[],
  totalCards: number,
) {
  return {
    completed: results.length,
    total: totalCards,
    autoCorrectCount: results.filter(result => result.outcome === 'correct')
      .length,
    autoIncorrectCount: results.filter(result => result.outcome === 'incorrect')
      .length,
    confidentFlipCount: results.filter(result => result.outcome === 'confident')
      .length,
    reviewFlipCount: results.filter(result => result.outcome === 'review')
      .length,
    hintUseCount: results.filter(result => result.usedHint).length,
    peekUseCount: results.filter(result => result.usedPeek).length,
    favoriteCount: results.filter(result => result.isFavorited).length,
  };
}

export function selectReviewCards(
  sessionCards: LearningCard[],
  results: LearningCardResult[],
) {
  const reviewCardIds = new Set(
    results
      .filter(result => result.outcome === 'incorrect' || result.outcome === 'review')
      .map(result => result.cardId),
  );

  return sessionCards.filter(card => reviewCardIds.has(card.card_id));
}

function areStringSetsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return leftSorted.every((item, index) => item === rightSorted[index]);
}
