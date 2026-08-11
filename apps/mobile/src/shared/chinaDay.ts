const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getChinaDayKey(now: Date = new Date()): string {
  const timestamp = now.getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error('China product day requires a valid instant.');
  }

  return new Date(timestamp + CHINA_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function getMillisecondsUntilNextChinaDay(
  now: Date = new Date(),
): number {
  const timestamp = now.getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error('China product day requires a valid instant.');
  }

  const shiftedTimestamp = timestamp + CHINA_UTC_OFFSET_MS;
  const nextDayStart =
    (Math.floor(shiftedTimestamp / DAY_MS) + 1) * DAY_MS;

  return nextDayStart - shiftedTimestamp;
}
