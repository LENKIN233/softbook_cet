export type LearningSessionDisplayPhase = 'learning' | 'review';

export function formatLearningSessionDisplayLabel(
  phase: LearningSessionDisplayPhase,
) {
  return phase === 'review' ? '本轮回看' : '本轮学习';
}

export function formatSpaceLibraryLabel(index: number) {
  const normalizedIndex = normalizeDisplayIndex(index);
  return normalizedIndex === 1
    ? '主书架'
    : formatNeighborLabel('相邻书架', normalizedIndex);
}

export function formatSpaceGroupLabel(index: number) {
  const normalizedIndex = normalizeDisplayIndex(index);
  return normalizedIndex === 1
    ? '当前分区'
    : formatNeighborLabel('相邻分区', normalizedIndex);
}

export function formatSpaceBoxLabel(index: number) {
  const normalizedIndex = normalizeDisplayIndex(index);
  return normalizedIndex === 1
    ? '当前卡盒'
    : formatNeighborLabel('相邻卡盒', normalizedIndex);
}

export function formatSpaceDisplayName(value: string, fallback: string) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  if (
    /^(?:raw|internal|test|fixture|dev|prod|staging|seed|mock)[-_:/]/i.test(
      normalizedValue,
    ) ||
    /^(?:sha256:|[a-z][a-z0-9_]*(?:_id|_ref|_key)[:=])/i.test(
      normalizedValue,
    ) ||
    /^[a-z][a-z0-9]*(?:[-_:/][a-z0-9.]+)+$/i.test(normalizedValue)
  ) {
    return fallback;
  }

  return normalizedValue || fallback;
}

function normalizeDisplayIndex(index: number) {
  return Math.max(Math.trunc(index), 1);
}

const neighborOrdinals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

function formatNeighborLabel(base: string, normalizedIndex: number) {
  return `${base}${neighborOrdinals[normalizedIndex - 2] ?? '多'}`;
}
