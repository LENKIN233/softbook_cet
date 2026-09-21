import type {LearningCard, LearningCardResult, LearningCardState, LearningTrack} from '../../mobile/src/learning/model';
export type LocalLearningSnapshot = {
  phase: 'learning' | 'review';
  complete: boolean;
  currentCardId: string | null;
  resumeCardId: string | null;
  reviewCardIds: string[];
  favorites: string[];
  sleeping: string[];
  results: LearningCardResult[];
  draft: LearningCardState | null;
  resolved: string | null;
  checkedInDay: string | null;
};
export class LocalLearningStorageError extends Error {
  readonly kind: 'invalid' | 'unavailable' | 'not_loaded' | 'conflict';
  constructor(kind: LocalLearningStorageError['kind']);
}
export function createLocalLearningStore(options: {
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'>;
  track: LearningTrack;
  contentVersion: string;
  cards: LearningCard[];
  withLock: (key: string, operation: () => Promise<void>) => Promise<void>;
}): {key: string; load: () => LocalLearningSnapshot | null; save: (state: LocalLearningSnapshot) => Promise<void>; flush: () => Promise<void>};
