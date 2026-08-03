import { isProductLibraryName } from './productTaxonomy';

export type LearningSessionDisplayPhase = 'learning' | 'review';

export function formatLearningSessionDisplayLabel(
  phase: LearningSessionDisplayPhase,
) {
  return phase === 'review' ? '本轮回看卡' : '本轮学习卡';
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

export function formatSpaceLibraryDisplayName(value: string) {
  const normalized = normalizeSemanticSpaceLabel(value);
  return normalized && isProductLibraryName(normalized)
    ? normalized
    : '当前书架';
}

export function formatSpaceGroupDisplayName(value: string) {
  return normalizeSemanticSpaceLabel(value) ?? '当前分区';
}

export function formatSpaceBoxDisplayName(value: string) {
  return normalizeSemanticSpaceLabel(value) ?? '当前卡盒';
}

function normalizeDisplayIndex(index: number) {
  return Math.max(Math.trunc(index), 1);
}

function normalizeSemanticSpaceLabel(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (
    normalized.length === 0 ||
    normalized.length > 32 ||
    !/[\u3400-\u9fff]/u.test(normalized) ||
    /(?:[_\\]|https?:\/\/|\d{4,}|远端|(?:^|[-.])(?:raw|debug|dev|mock|fixture|metadata)(?:[-.]|$))/iu.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
}

const neighborOrdinals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

function formatNeighborLabel(base: string, normalizedIndex: number) {
  return `${base}${neighborOrdinals[normalizedIndex - 2] ?? '多'}`;
}
