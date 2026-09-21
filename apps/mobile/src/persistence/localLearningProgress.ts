import {CORE_INTERACTION_ORDER} from '../learning/model';
import type {LearningCardResult, LearningTrack} from '../learning/model';

// A device-only development round. Remote progress always comes from bootstrap.
export type LocalLearningProgress = {
  dayKey: string;
  sourceId: string;
  track: LearningTrack;
  phase: 'learning' | 'review';
  cursorCardId: string | null;
  learningResults: LearningCardResult[];
  reviewResults: LearningCardResult[];
  reviewCardIds: string[];
};

export function parseLocalLearningProgress(value: unknown): LocalLearningProgress | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid local progress.');
  const entry = value as Record<string, unknown>;
  if (typeof entry.dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.dayKey) ||
      typeof entry.sourceId !== 'string' || !entry.sourceId ||
      !['cet4', 'cet6'].includes(String(entry.track)) ||
      !['learning', 'review'].includes(String(entry.phase)) ||
      (entry.cursorCardId !== null && (typeof entry.cursorCardId !== 'string' || !entry.cursorCardId)) ||
      !Array.isArray(entry.reviewCardIds) || entry.reviewCardIds.length > 10000 ||
      entry.reviewCardIds.some(id => typeof id !== 'string' || !id) ||
      new Set(entry.reviewCardIds).size !== entry.reviewCardIds.length) {
    throw new Error('Invalid local progress scope.');
  }
  return {
    dayKey: entry.dayKey,
    sourceId: entry.sourceId,
    track: entry.track as LearningTrack,
    phase: entry.phase as LocalLearningProgress['phase'],
    cursorCardId: entry.cursorCardId as string | null,
    learningResults: parseResults(entry.learningResults),
    reviewResults: parseResults(entry.reviewResults),
    reviewCardIds: entry.reviewCardIds as string[],
  };
}

function parseResults(value: unknown): LearningCardResult[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid local results.');
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item.cardId !== 'string' || !item.cardId || seen.has(item.cardId) ||
        !CORE_INTERACTION_ORDER.includes(item.interactionId) ||
        !['correct', 'incorrect', 'confident', 'review'].includes(item.outcome) ||
        typeof item.completedAt !== 'string' || !Number.isFinite(Date.parse(item.completedAt)) ||
        ['usedHint', 'usedPeek', 'isFavorited'].some(key => typeof item[key] !== 'boolean')) {
      throw new Error('Invalid local learning result.');
    }
    seen.add(item.cardId);
    return {cardId: item.cardId, interactionId: item.interactionId, outcome: item.outcome,
      completedAt: item.completedAt, usedHint: item.usedHint, usedPeek: item.usedPeek,
      isFavorited: item.isFavorited};
  });
}
