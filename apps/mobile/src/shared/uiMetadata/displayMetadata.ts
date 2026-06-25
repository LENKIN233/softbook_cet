export type LearningSessionDisplayPhase = 'learning' | 'review';

export function formatLearningSessionDisplayLabel(
  phase: LearningSessionDisplayPhase,
) {
  return phase === 'review' ? '本轮回看卡' : '本轮学习卡';
}

export function formatSpaceLibraryLabel(index: number) {
  return normalizeDisplayIndex(index) === 1 ? '主书架' : '相邻书架';
}

export function formatSpaceGroupLabel(index: number) {
  return normalizeDisplayIndex(index) === 1 ? '当前分区' : '相邻分区';
}

export function formatSpaceBoxLabel(index: number) {
  return normalizeDisplayIndex(index) === 1 ? '当前卡盒' : '相邻卡盒';
}

function normalizeDisplayIndex(index: number) {
  return Math.max(Math.trunc(index), 1);
}
