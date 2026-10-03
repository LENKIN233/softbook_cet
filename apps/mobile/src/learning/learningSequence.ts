import type {LearningCard} from './model';

export function knowledgePointOf(card: LearningCard): string {
  return card.space_metadata.box_ref || card.knowledge_ref || card.card_id;
}

export const KNOWLEDGE_POINT_WINDOW_SIZE = 4;

export function advanceKnowledgeWindow(window: readonly string[], point: string): string[] {
  return [...window.filter(value => value !== point), point].slice(-KNOWLEDGE_POINT_WINDOW_SIZE);
}

export function nextKnowledgeCandidateIndex(cards: readonly LearningCard[], window: readonly string[]): number {
  let selected = -1, oldest = Infinity;
  for (let index = 0; index < cards.length; index++) {
    const recency = window.lastIndexOf(knowledgePointOf(cards[index]));
    if (recency < 0) return index;
    if (recency < oldest) {selected = index;oldest = recency;}
  }
  return selected;
}

export function separateKnowledgePoints(
  cards: readonly LearningCard[],
  previous: string | readonly string[] | null = null,
): LearningCard[] {
  const remaining = [...cards];
  const ordered: LearningCard[] = [];
  let window = typeof previous === 'string' ? [previous]
    : previous?.reduce<string[]>((recent, point) => advanceKnowledgeWindow(recent, point), []) ?? [];
  while (remaining.length > 0) {
    const [card] = remaining.splice(nextKnowledgeCandidateIndex(remaining, window), 1);
    ordered.push(card);
    window = advanceKnowledgeWindow(window, knowledgePointOf(card));
  }
  return ordered;
}

export function baseLearningCardOrder(cards: readonly LearningCard[]): LearningCard[] {
  const subjects = new Map<string, LearningCard[]>();
  for (const card of cards) {
    const subject = card.space_metadata.library;
    if (!subjects.has(subject)) subjects.set(subject, []);
    subjects.get(subject)!.push(card);
  }
  const offsets = new Map<string, number>();
  const base: LearningCard[] = [];
  while (base.length < cards.length) {
    for (const [subject, queue] of subjects) {
      const start = offsets.get(subject) ?? 0;
      const end = Math.min(start + 2, queue.length);
      base.push(...queue.slice(start, end));
      offsets.set(subject, end);
    }
  }
  return base;
}

export function orderLearningCards(cards: readonly LearningCard[]): LearningCard[] {
  return separateKnowledgePoints(baseLearningCardOrder(cards));
}
