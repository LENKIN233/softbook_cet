import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SpaceSurface, type SpaceSurfaceProps} from './SpaceSurface';
import {createLocalLearningSession} from '../../mobile/__tests__/fixtures/interactionSession';
import {createInitialMembershipState} from '../../mobile/src/membership/localMembership';
import type {LearningCard} from '../../mobile/src/learning/model';
import {bundledCardLibrary} from '../../mobile/src/learning/bundledCardLibrary';
import {normalizeLearningCardRecord} from '../../mobile/src/learning/sourceContract';

const base = createLocalLearningSession('cet4').catalogCards[0];
function card(id: string, library: string, group: string, box: string, boxRef: string): LearningCard {
  return {...base, card_id: id, front: {...base.front, prompt: `练习 ${id}`, support: `材料 ${id}`}, space_metadata: {library, group, box, box_ref: boxRef}};
}
const first = card('000001', '听力', '听前预测', '主题预测', '0000');
const current = card('000002', '听力', '听前预测', '主题预测', '0000');
const neighbor = card('000101', '听力', '听前预测', '关键词预测', '0001');
const otherLibrary = card('010001', '仔细阅读', '定位词抓取', '题干定位', '0100');
const props = (): SpaceSurfaceProps => ({busy: false, cards: [first, current, neighbor, otherLibrary], canMutate: true, currentCardId: current.card_id, pendingReviewIds: [neighbor.card_id], favorites: [otherLibrary.card_id], sleeping: [], membership: createInitialMembershipState(), onFavorite: vi.fn(), onSleep: vi.fn(), onReturn: vi.fn(), statusMessage: '', syncStatus: '已同步'});
afterEach(cleanup);
function tray() {return screen.getByRole('region', {name: /^当前卡盒/});}
function browse() {fireEvent.click(screen.getByText('浏览与查找卡片').closest('summary')!);}

describe('current task first Space', () => {
  it('starts on the actual current card within its box and leaves full navigation collapsed', () => {
    const callbacks = props();
    render(<SpaceSurface {...callbacks}/>);
    expect(within(tray()).getByText(`材料 ${current.card_id}`)).toBeVisible();
    expect(screen.getByText('翻面 · 正在学习')).toBeVisible();
    expect(screen.getByText('浏览与查找卡片').parentElement).not.toHaveAttribute('open');
    expect(screen.getByRole('button', {name: '只看收藏'})).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: '返回学习'}));
    expect(callbacks.onReturn).toHaveBeenCalledOnce();
  });

  it('browses another box and returns to the same current card without mutating study state', () => {
    const callbacks = props();
    render(<SpaceSurface {...callbacks}/>);
    fireEvent.click(within(screen.getByRole('region', {name: '本组其他卡盒'})).getByRole('button', {name: /关键词预测/}));
    expect(within(tray()).getByText(`材料 ${neighbor.card_id}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: '回到当前卡盒'}));
    expect(within(tray()).getByText(`材料 ${current.card_id}`)).toBeVisible();
    expect(callbacks.onReturn).not.toHaveBeenCalled();
    expect(callbacks.onFavorite).not.toHaveBeenCalled();
    expect(callbacks.onSleep).not.toHaveBeenCalled();
  });

  it('filters across all loaded boxes, preserves the original address and exposes clear filter', () => {
    render(<SpaceSurface {...props()}/>);
    browse();
    fireEvent.click(screen.getByRole('button', {name: '只看收藏'}));
    const results = screen.getByRole('region', {name: '筛选结果'});
    expect(within(results).getByText('仔细阅读 / 定位词抓取 / 题干定位')).toBeVisible();
    fireEvent.click(within(results).getByRole('button', {name: /仔细阅读/}));
    expect(within(tray()).getByRole('heading', {name: '题干定位'})).toBeVisible();
    expect(within(tray()).getByText(`材料 ${otherLibrary.card_id}`)).toBeVisible();
    expect(screen.getByRole('button', {name: '回到当前卡盒'})).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: '清除筛选'}));
    expect(screen.queryByRole('region', {name: '筛选结果'})).toBeNull();
    expect(screen.getByRole('region', {name: '知识空间层级'})).toBeVisible();
  });

  it('follows a new current card while idle and keeps a deliberate browsing selection', () => {
    const callbacks = props();
    const view = render(<SpaceSurface {...callbacks}/>);
    view.rerender(<SpaceSurface {...callbacks} currentCardId={otherLibrary.card_id}/>);
    expect(within(tray()).getByRole('heading', {name: '题干定位'})).toBeVisible();
    browse();
    fireEvent.click(screen.getByRole('button', {name: '听力'}));
    view.rerender(<SpaceSurface {...callbacks} currentCardId={neighbor.card_id}/>);
    expect(within(tray()).getByRole('heading', {name: '主题预测'})).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: '回到当前卡盒'}));
    expect(within(tray()).getByRole('heading', {name: '关键词预测'})).toBeVisible();
  });

  it('keeps sleep and favorite actions on the inspected card and respects access restrictions', () => {
    const callbacks = props();
    const view = render(<SpaceSurface {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', {name: '收藏'}));
    fireEvent.click(screen.getByRole('button', {name: '暂不学习这张卡'}));
    expect(callbacks.onFavorite).toHaveBeenCalledWith(current.card_id);
    expect(callbacks.onSleep).toHaveBeenCalledWith(current.card_id);
    view.rerender(<SpaceSurface {...callbacks} canMutate={false} sleeping={[current.card_id]}/>);
    expect(screen.getByRole('button', {name: '恢复学习'})).toBeDisabled();
    expect(screen.getByRole('button', {name: '收藏'})).toBeDisabled();
    fireEvent.click(screen.getByText('休眠区 · 1 张'));
    expect(screen.getByText(/休眠的卡片暂时离开学习流/)).toBeVisible();
  });
});


it('searches front material without leaking hidden answers and restores the inspected address', () => {
  const callbacks = props();
  const hidden = {...otherLibrary, back_text: 'private-back-only-word'};
  const remember = vi.fn();
  const view = render(<SpaceSurface {...callbacks} cards={[first, current, neighbor, hidden]} sleeping={[neighbor.card_id]} onBrowseStateChange={remember}/>);
  browse();
  fireEvent.change(screen.getByLabelText('查找卡片'), {target: {value: 'private-back-only-word'}});
  expect(within(screen.getByRole('region', {name: '筛选结果'})).queryByRole('button', {name: /题干定位/})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: '清除筛选'}));
  fireEvent.click(screen.getByRole('button', {name: '已暂停'}));
  const result = screen.getByRole('region', {name: '筛选结果'});
  expect(within(result).getByRole('button', {name: /关键词预测/})).toBeVisible();
  fireEvent.click(within(result).getByRole('button', {name: /关键词预测/}));
  expect(screen.queryByRole('button', {name: '回看答案与解析'})).toBeNull();
  const state = remember.mock.calls.at(-1)![0];
  view.unmount();
  render(<SpaceSurface {...callbacks} sleeping={[neighbor.card_id]} browseState={state} learnedIds={[neighbor.card_id]}/>);
  expect(within(tray()).getByRole('heading', {name: '关键词预测'})).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name: '回看答案与解析'}));
  expect(screen.getByRole('button', {name: '收起答案与解析'})).toBeVisible();
  expect(screen.getByRole('region', {name: '已学卡答案与解析'})).toBeVisible();
  expect(callbacks.onReturn).not.toHaveBeenCalled();
});


it('stops read-only audio when following a changed current card and on unmount', () => {
  const onStopAudio = vi.fn();
  const callbacks = props();
  const view = render(<SpaceSurface {...callbacks} learnedIds={[current.card_id]} onStopAudio={onStopAudio}/>);
  fireEvent.click(screen.getByRole('button', {name: '回看答案与解析'}));
  view.rerender(<SpaceSurface {...callbacks} learnedIds={[current.card_id]} currentCardId={otherLibrary.card_id} onStopAudio={onStopAudio}/>);
  expect(onStopAudio).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', {name: '收起答案与解析'})).toBeNull();
  view.unmount();
  expect(onStopAudio).toHaveBeenCalledTimes(2);
});

it('retains open sections and scroll position across a Space remount', () => {
  const callbacks = props();
  const save = vi.fn();
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const view = render(<SpaceSurface {...callbacks} browseState={{selection: null, filter: 'all', query: '', scrollY: 450, openSections: ['browser', '0000:rest']}} onBrowseStateChange={save}/>);
  expect(screen.getByText('浏览与查找卡片').closest('details')).toHaveAttribute('open');
  expect(screen.getByText(/查看盒内其他卡片/).closest('details')).toHaveAttribute('open');
  expect(scrollTo).toHaveBeenCalledWith({top: 450, behavior: 'instant'});
  Object.defineProperty(window, 'scrollY', {value: 625, configurable: true});
  fireEvent.scroll(window);
  expect(save.mock.lastCall?.[0].scrollY).toBe(625);
  const saved = save.mock.lastCall![0];
  view.unmount();
  render(<SpaceSurface {...callbacks} browseState={saved}/>);
  expect(scrollTo).toHaveBeenLastCalledWith({top: 625, behavior: 'instant'});
  scrollTo.mockRestore();
  Object.defineProperty(window, 'scrollY', {value: 0, configurable: true});
});

it('shows learning state and a short matching excerpt in search results, retaining full material on inspection', () => {
  const record = bundledCardLibrary.cet4.cards.find(item => item.card_id === '031106')!;
  const longCard = normalizeLearningCardRecord(record);
  const unseen = {...otherLibrary, front: {...otherLibrary.front, prompt: 'Group projects 的另一道题'}, back_text: 'hidden-search-answer'};
  render(<SpaceSurface {...props()} cards={[longCard, unseen]} currentCardId={longCard.card_id} learnedIds={[longCard.card_id]}/>);
  browse();
  fireEvent.change(screen.getByLabelText('查找卡片'), {target: {value: 'Group projects'}});
  const results = screen.getByRole('region', {name: '筛选结果'});
  const rows = results.querySelectorAll('.filtered-card');
  expect(rows).toHaveLength(2);
  expect(within(rows[0] as HTMLElement).getByText('已学过')).toBeVisible();
  expect(within(rows[1] as HTMLElement).getByText('未学习')).toBeVisible();
  expect(rows[0].textContent).toContain('Group projects');
  expect(rows[0].textContent).not.toContain('repeated practice in clear discussion');
  expect(rows[1].textContent).not.toContain('hidden-search-answer');
  fireEvent.click(rows[0]);
  expect(tray().textContent).toContain('repeated practice in clear discussion');
  expect(screen.getByLabelText('查找卡片')).toHaveValue('Group projects');
});

it('includes all original options in an already learned card recall without opening unseen answers', () => {
  const choice = normalizeLearningCardRecord(bundledCardLibrary.cet6.cards.find(item => item.card_id === '161004')!);
  if (choice.interaction_id !== 'multiple_choice') throw new Error('Expected real choice');
  const callbacks = {...props(), cards: [choice], currentCardId: choice.card_id};
  const view = render(<SpaceSurface {...callbacks} learnedIds={[choice.card_id]}/>);
  fireEvent.click(screen.getByRole('button', {name: '回看答案与解析'}));
  const answer = screen.getByRole('region', {name: '已学卡答案与解析'});
  for (const option of choice.options) expect(within(within(answer).getByRole('group', {name: '原题选项'})).getByText(`${option.label} · ${option.text}`)).toBeVisible();
  view.rerender(<SpaceSurface {...callbacks} learnedIds={[]}/>);
  expect(screen.queryByRole('region', {name: '已学卡答案与解析'})).toBeNull();
  expect(screen.queryByText(choice.analysis.summary)).toBeNull();
});
