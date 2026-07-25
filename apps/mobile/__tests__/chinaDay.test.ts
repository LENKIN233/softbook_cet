import { getChinaDayKey } from '../src/shared/chinaDay';

describe('getChinaDayKey', () => {
  it.each([
    ['2026-07-24T15:59:59.999Z', '2026-07-24'],
    ['2026-07-24T16:00:00.000Z', '2026-07-25'],
    ['2026-12-31T16:00:00.000Z', '2027-01-01'],
  ])('maps %s to China product day %s', (instant, expected) => {
    expect(getChinaDayKey(new Date(instant))).toBe(expected);
  });

  it('rejects an invalid instant', () => {
    expect(() => getChinaDayKey(new Date('invalid'))).toThrow(
      'requires a valid instant',
    );
  });
});
