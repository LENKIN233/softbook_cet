export const LOCAL_BATCH_SIZE: 5;
export function localBatch(total: number, cursor: number, complete?: boolean): {start: number; end: number; size: number; index: number; hasMore: boolean};
export function endsLocalBatch(nextCursor: number, total: number): boolean;
export function localResumeIndex(orderedCards: readonly {card_id: string}[], eligibleCards: readonly {card_id: string}[], resumeCardId: string | null): number;
