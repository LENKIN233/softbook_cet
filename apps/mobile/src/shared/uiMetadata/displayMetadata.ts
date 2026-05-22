export type LearningSessionDisplayPhase = 'learning' | 'review';

export function formatLearningSessionDisplayLabel(
  phase: LearningSessionDisplayPhase,
) {
  return phase === 'review' ? '本轮回看卡' : '本轮学习卡';
}

export function formatSpaceLibraryLabel(index: number) {
  return `馆 ${normalizeDisplayIndex(index)}`;
}

export function formatSpaceGroupLabel(index: number) {
  return `组 ${normalizeDisplayIndex(index)}`;
}

export function formatSpaceBoxLabel(index: number) {
  return `盒 ${normalizeDisplayIndex(index)}`;
}

function normalizeDisplayIndex(index: number) {
  return Math.max(Math.trunc(index), 1);
}
