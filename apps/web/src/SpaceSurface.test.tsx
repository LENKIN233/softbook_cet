import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SpaceSurface, type SpaceSurfaceProps} from './SpaceSurface';
import {createLocalLearningSession} from '../../mobile/__tests__/fixtures/interactionSession';
import {createInitialMembershipState} from '../../mobile/src/membership/localMembership';
import type {LearningCard} from '../../mobile/src/learning/model';

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
function browse() {fireEvent.click(screen.getByText('浏览全部卡盒', {selector: 'summary'}));}

describe('current task first Space', () => {
  it('starts on the actual current card within its box and leaves full navigation collapsed', () => {
    const callbacks = props();
    render(<SpaceSurface {...callbacks}/>);
    expect(within(tray()).getByText(`材料 ${current.card_id}`)).toBeVisible();
    expect(screen.getByText('翻面 · 正在学习')).toBeVisible();
    expect(screen.getByText('浏览全部卡盒').parentElement).not.toHaveAttribute('open');
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
