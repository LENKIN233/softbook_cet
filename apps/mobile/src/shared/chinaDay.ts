const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getChinaDayKey(now: Date = new Date()): string {
  const timestamp = now.getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error('China product day requires a valid instant.');
  }

  return new Date(timestamp + CHINA_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}
