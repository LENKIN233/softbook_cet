import type {LearningCardResult} from '../learning/model';
export type SpaceCardFilter = 'all' | 'favorites' | 'review' | 'sleeping';
export function latestCardResults<T extends LearningCardResult & {serverSequence?: number}>(results: readonly T[]): T[];
export function reviewCardIds(results: readonly (LearningCardResult & {serverSequence?: number})[], sleeping?: readonly string[]): string[];
export function filterSpaceCards<T extends {card_id: string}>(cards: readonly T[], filter: SpaceCardFilter, favorites: readonly string[], pendingReview: readonly string[], sleeping?: readonly string[], query?: string): readonly T[];
