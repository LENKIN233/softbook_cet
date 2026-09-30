import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {StatisticsSurface} from '../src/statistics/StatisticsSurface';

const palette: Parameters<typeof StatisticsSurface>[0]['palette'] = {
  accent: '#5658D6', accentSoft: '#E7E8FF', accentStrong: '#4144AF', background: '#F0F0F8', border: '#DDDDEB',
  activeSurface: '#E7E8FF', activeText: '#4144AF', danger: '#B23B4B', primaryActionMuted: '#C7C7DE',
  success: '#267153', tabIdle: '#626477', warning: '#8F6520', warningText: '#72530D',
  panel: '#FFFFFF', panelStrong: '#F7F7FB', primaryActionSurface: '#5658D6', primaryActionText: '#FFFFFF', text: '#242435', textMuted: '#626477',
};
const base = {track: 'cet4' as const, deviceClass: 'phone' as const, palette, canCheckInToday: true, hasCheckedInToday: false,
  onCheckIn: jest.fn(), onGoToLearning: jest.fn(), syncStatusLabel: '已同步', syncStatusDetail: ''};
function text(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  if (node && typeof node === 'object' && 'children' in node) return text(node.children);
  return '';
}
const trees: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {for (const tree of trees.splice(0)) act(() => tree.unmount()); jest.clearAllMocks();});
function render(props: Partial<Parameters<typeof StatisticsSurface>[0]> = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {tree = ReactTestRenderer.create(<StatisticsSurface {...base} {...props}/>);});
  trees.push(tree); return tree;
}

test('unknown track statistics are stated as unavailable without borrowing account totals or showing zero', () => {
  const tree = render({track: 'cet6', learningCompletedCount: 12, reviewCompletedCount: 6, cumulativeLearnedCount: 48});
  expect(text(tree.toJSON())).toContain('英语六级');
  expect(text(tree.toJSON())).toContain('当前科目的统计暂时无法读取');
  expect(tree.root.findAllByProps({testID: 'statistics-metric-completed-value'})).toHaveLength(0);
  expect(text(tree.toJSON())).not.toMatch(/0 张|12 张|18 次|48 张/);
  act(() => tree.root.findByProps({testID: 'statistics-go-learning-button'}).props.onPress());
  expect(base.onGoToLearning).toHaveBeenCalledTimes(1);
});

test('distinguishes different cards from repeated attempts and gives no fake objective score for self assessments', () => {
  const tree = render({statistics: {track: 'cet4', dayKey: '2026-09-30', completedCardCount: 5, completedAttemptCount: 6, reviewAttemptCount: 1, cumulativeLearnedCardCount: 9}});
  expect(text(tree.root.findByProps({testID: 'statistics-metric-completed-value'}).props.children)).toBe('5 张卡');
  expect(text(tree.root.findByProps({testID: 'statistics-metric-review'}).props.children)).toBe('共完成 6 次练习，含 1 次复习');
  expect(text(tree.root.findByProps({testID: 'statistics-metric-cumulative-value'}).props.children)).toBe('9 张');
  expect(text(tree.toJSON())).not.toMatch(/答对|正确率|使用提示/);
  act(() => tree.root.findByProps({testID: 'statistics-explanation-toggle'}).props.onPress());
  expect(text(tree.toJSON())).toContain('同一张卡再次作答会增加练习次数，不重复增加当天的卡片数');
  expect(text(tree.toJSON())).toContain('自评有把握不等于客观题答对');
});

test('a verified empty day can show zero while sign-in remains governed by account eligibility', () => {
  const tree = render({canCheckInToday: false, statistics: {track: 'cet4', dayKey: '2026-09-30', completedCardCount: 0, completedAttemptCount: 0, reviewAttemptCount: 0, cumulativeLearnedCardCount: 9}});
  expect(text(tree.toJSON())).toContain('0 张卡');
  expect(tree.root.findByProps({testID: 'statistics-checkin-button'}).props.disabled).toBe(true);
  act(() => tree.update(<StatisticsSurface {...base} hasCheckedInToday/>));
  expect(tree.root.findByProps({testID: 'statistics-checkin-button'}).props.disabled).toBe(true);
  expect(text(tree.toJSON())).toContain('今日已签到');
});

test('keeps an explicit secondary review entry without claiming those cards are due now', () => {
  const onStartReview = jest.fn();
  const tree = render({pendingReviewCount: 3, onStartReview});
  expect(text(tree.toJSON())).toContain('有 3 张卡需要再练');
  expect(text(tree.toJSON())).not.toMatch(/到期|现在可复习/);
  act(() => tree.root.findByProps({testID: 'statistics-start-review-button'}).props.onPress());
  expect(onStartReview).toHaveBeenCalledTimes(1);
  act(() => tree.update(<StatisticsSurface {...base} pendingReviewCount={0} onStartReview={onStartReview}/>));
  expect(tree.root.findAllByProps({testID: 'statistics-start-review-button'})).toHaveLength(0);
});
