import { createSpaceStateSnapshot } from '../src/space/spaceStateRepository';

describe('spaceStateRepository', () => {
  it('creates snapshot for every touched card including cleared state', () => {
    const spaceCardStateById = {
      'card-1': {isFavorited: true, isSleeping: false},
      'card-2': {isFavorited: false, isSleeping: true},
      'card-3': {isFavorited: false, isSleeping: false},
      'card-4': {isFavorited: true, isSleeping: true},
    };

    const snapshot = createSpaceStateSnapshot({
      dayKey: '2026-04-27',
      spaceCardStateById,
    });

    expect(snapshot.dayKey).toBe('2026-04-27');
    expect(snapshot.states).toHaveLength(4);
    expect(snapshot.states.find(s => s.cardId === 'card-1')).toMatchObject({
      isFavorited: true,
      isSleeping: false,
    });
    expect(snapshot.states.find(s => s.cardId === 'card-3')).toMatchObject({
      isFavorited: false,
      isSleeping: false,
    });
  });

  it('includes lastModifiedAt timestamp for each state', () => {
    const spaceCardStateById = {
      'card-1': {isFavorited: true, isSleeping: false},
    };

    const beforeMs = new Date().getTime();
    const snapshot = createSpaceStateSnapshot({
      dayKey: '2026-04-27',
      spaceCardStateById,
    });
    const afterMs = new Date().getTime();

    const lastModifiedMs = new Date(
      snapshot.states[0].lastModifiedAt,
    ).getTime();
    expect(lastModifiedMs).toBeGreaterThanOrEqual(beforeMs);
    expect(lastModifiedMs).toBeLessThanOrEqual(afterMs);
  });
});
