import {getChinaDayKey} from '../../mobile/src/shared/chinaDay';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {StrictMode} from 'react';

import type {LearningCard, LearningCardResult, LearningSession} from '../../mobile/src/learning/model';
import {AccountBootstrapIntegrityError} from '../../mobile/src/bootstrap/accountBootstrapRepository';
import {ClientUpdateRequiredError} from '../../mobile/src/runtime/clientVersion';
import {RemoteHttpError} from '../../mobile/src/runtime/remoteHttpError';
import {
  createInitialMembershipState,
  type MembershipState,
} from '../../mobile/src/membership/localMembership';
import {App} from './App';
import type {
  WebAccountDeletionOutcome,
  WebAccountPresentationInvalidation,
  WebRemoteRuntimeController,
  WebRemoteSnapshot,
} from './remoteRuntime';
import {WebRemotePostAuthError} from './remoteRuntime';
import {FIRST_RUN_GUIDANCE_KEY} from './firstRunGuidanceStore';

const PHONE = '13800138000';

describe('PC Web remote UI authority', () => {
  beforeEach(() => {
    window.localStorage.setItem(FIRST_RUN_GUIDANCE_KEY, JSON.stringify({version: 1, selectedTrack: 'cet4', learningGuideSeen: true}));
    window.__SOFTBOOK_WEB_RUNTIME__ = {
      baseUrl: 'https://runtime.example.cn',
      clientKind: 'web',
      contentManifestPublicKeys: {'release-2026': 'ab'.repeat(32)},
      mode: 'remote',
      track: 'cet4',
    };
  });

  afterEach(() => {
    window.localStorage.removeItem(FIRST_RUN_GUIDANCE_KEY);
    delete window.__SOFTBOOK_WEB_RUNTIME__;
  });

  it('requests a server review from statistics and restores the interrupted new-card draft', async () => {
    const initial = createSnapshot('premium');
    const pending = {cardId: createCard(2).card_id, interactionId: 'flip' as const,
      phase: 'learning' as const, outcome: 'review' as const, usedHint: false,
      usedPeek: false, isFavorited: false, completedAt: new Date().toISOString(), serverSequence: 1};
    initial.bootstrap.learning.cardStates = [pending];
    const review = structuredClone(initial);
    review.learningSession.cards = [createCard(2)];
    review.learningSession.serverSelection = {...review.learningSession.serverSelection!, cardId: createCard(2).card_id,
      phase: 'review', reason: 'requested_review', selectionId: 'sel_requested_ui_review', dueAt: new Date().toISOString()};
    const resumed = structuredClone(initial);
    resumed.learningSession.serverSelection!.selectionId = 'sel_fresh_learning_resume';
    const controller = createController(initial, {
      requestReview: vi.fn(async () => review), loadAuthenticatedState: vi.fn(async () => resumed),
    });
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    await screen.findByRole('button', {name: '有把握'});
    openGlobalRoute('统计');
    fireEvent.click(await screen.findByRole('button', {name: '开始复习'}));
    expect(await screen.findByRole('heading', {name: createCard(2).front.prompt})).toBeInTheDocument();
    expect(controller.requestReview).toHaveBeenCalledTimes(1);
    expect(controller.completeCurrentCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    fireEvent.click(await screen.findByRole('button', {name: '下一张'}));
    expect(await screen.findByRole('button', {name: '有把握'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '翻面看答案'})).toBeNull();
    expect(controller.completeCurrentCard).toHaveBeenCalledTimes(1);
  });

  it('shows an empty requested review without claiming all new learning is complete', async () => {
    const initial = createSnapshot('premium');
    initial.bootstrap.learning.cardStates = [{cardId: createCard(2).card_id, interactionId: 'flip',
      phase: 'learning', outcome: 'review', usedHint: false, usedPeek: false,
      isFavorited: false, completedAt: new Date().toISOString(), serverSequence: 1}];
    const empty = structuredClone(initial);
    empty.learningSession.cards = []; empty.learningSession.serverSelection = null;
    const controller = createController(initial, {requestReview: vi.fn(async () => empty)});
    await authenticateRemote(controller);
    openGlobalRoute('统计');
    fireEvent.click(await screen.findByRole('button', {name: '开始复习'}));
    await screen.findByRole('heading', {name: '暂时没有需要复习的卡片'});
    expect(controller.loadAuthenticatedState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '继续学习'}));
    await screen.findByRole('button', {name: '翻面看答案'});
    expect(controller.loadAuthenticatedState).toHaveBeenCalledTimes(1);
    expect(controller.completeCurrentCard).not.toHaveBeenCalled();
  });

  it('keeps authentication when review access expires and directs the learner to membership', async () => {
    const initial = createSnapshot('premium');
    initial.bootstrap.learning.cardStates = [{cardId: createCard(2).card_id, interactionId: 'flip',
      phase: 'learning', outcome: 'review', usedHint: false, usedPeek: false,
      isFavorited: false, completedAt: new Date().toISOString(), serverSequence: 1}];
    const controller = createController(initial, {
      requestReview: vi.fn(async () => {throw new RemoteHttpError('Review unavailable', 409, 'review_access_unavailable');}),
    });
    await authenticateRemote(controller);
    openGlobalRoute('统计');
    fireEvent.click(await screen.findByRole('button', {name: '开始复习'}));
    expect(await screen.findByText('复习权限已变化，请查看当前会员状态。')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '获取验证码'})).toBeNull();
    expect(controller.completeCurrentCard).not.toHaveBeenCalled();
  });

  it('does not count bootstrap history as the current presentation segment', async () => {
    const initial = createSnapshot('premium');
    const fifth = createCard(5), sixth = createCard(6);
    const prior = [1, 2, 3, 4].map(index => ({cardId: createCard(index).card_id,
      interactionId: 'flip' as const, outcome: 'confident' as const, phase: 'learning' as const, serverSequence: index,
      usedHint: false, usedPeek: false, isFavorited: false, completedAt: new Date().toISOString()}));
    initial.bootstrap.learning.cardStates = prior;
    initial.learningResults = prior;
    initial.bootstrap.learning.cursor!.cardId = fifth.card_id;
    initial.bootstrap.componentRevisions.learning.eventServerSequence = 4;
    initial.bootstrap.componentRevisions.progress.learningServerSequence = 4;
    initial.bootstrap.statistics = {...initial.bootstrap.statistics!, completedCardCount: 4, completedAttemptCount: 4, cumulativeLearnedCardCount: 4};
    initial.learningSession.cards = [fifth];
    initial.learningSession.catalogCards = [...initial.learningSession.catalogCards, fifth, sixth];
    initial.learningSession.serverSelection = {...initial.learningSession.serverSelection!, cardId: fifth.card_id};
    const next = structuredClone(initial);
    next.learningSession.cards = [sixth];
    next.learningSession.serverSelection = {...next.learningSession.serverSelection!, cardId: sixth.card_id, selectionId: 'sel_after_first_segment'};
    next.bootstrap.learning.cardStates = [...prior, {...prior[0], cardId: fifth.card_id, serverSequence: 5}];
    next.learningResults = next.bootstrap.learning.cardStates;
    next.bootstrap.learning.cursor!.cardId = sixth.card_id;
    next.bootstrap.componentRevisions.learning.eventServerSequence = 5;
    next.bootstrap.componentRevisions.progress.learningServerSequence = 5;
    next.bootstrap.statistics = {...next.bootstrap.statistics!, completedCardCount: 5, completedAttemptCount: 5, cumulativeLearnedCardCount: 5};
    const controller = createController(initial, {loadAuthenticatedState: vi.fn(async () => next)});
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('button', {name: '下一张'});
    expect(screen.getByRole('status', {name: '第 1 轮 · 已完成 1/5'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: /轮完成/})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '先到这里'}));
    await screen.findByRole('heading', {name: '学习统计'});
    fireEvent.click(screen.getByRole('button', {name: '继续学习'}));
    await screen.findByRole('button', {name: '下一张'});
    expect(controller.loadAuthenticatedState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '下一张'}));
    expect(await screen.findByRole('heading', {name: sixth.front.prompt})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: /轮完成/})).toBeNull();
    expect(controller.completeCurrentCard).toHaveBeenCalledTimes(1);
    expect(controller.loadAuthenticatedState).toHaveBeenCalledTimes(1);
  });

  for (const track of ['cet4', 'cet6'] as const) {
    it(`${track}: repeats two five-task rounds, counts only acknowledgements, and preserves paused feedback`, async () => {
      window.localStorage.setItem(FIRST_RUN_GUIDANCE_KEY, JSON.stringify({version: 1, selectedTrack: track, learningGuideSeen: true}));
      const cards = Array.from({length: 11}, (_, index) => ({...createCard(index + 20),
        card_id: `${track === 'cet4' ? '0' : '1'}${String(index + 20).padStart(5, '0')}`, track,
        front: {...createCard(index + 20).front, prompt: `${track} task ${index + 1}`},
        space_metadata: {library: index % 2 ? '语法' : '听力', group: '本轮材料',
          box: index % 2 ? '主谓结构' : '根据选项预测考点', box_ref: `actual-box-${index % 2}`},
      })) as LearningCard[];
      const accepted: LearningCardResult[] = [];
      const snapshot = () => {
        const value = createSnapshot('premium'), current = cards[accepted.length];
        value.bootstrap.track = track;
        value.bootstrap.content.cardCount = cards.length;
        value.bootstrap.statistics = {...value.bootstrap.statistics!, track, completedCardCount: accepted.length,
          completedAttemptCount: accepted.length, cumulativeLearnedCardCount: accepted.length};
        value.bootstrap.learning.cardStates = accepted.map((result, index) => ({...result, phase: 'learning', serverSequence: index + 1}));
        value.bootstrap.learning.cursor = {cardId: current.card_id, sourceId: value.learningSession.sourceId, track};
        value.bootstrap.componentRevisions.learning.eventServerSequence = accepted.length;
        value.bootstrap.componentRevisions.progress.learningServerSequence = accepted.length;
        value.learningResults = [...accepted];
        value.learningSession = {...value.learningSession, track, catalogCards: cards, cards: [current],
          serverSelection: {...value.learningSession.serverSelection!, cardId: current.card_id, selectionId: `sel_${track}_actual_task_${accepted.length}`} };
        return value;
      };
      let confirmFifth: (() => void) | null = null;
      const completeCurrentCard = vi.fn(async (result: LearningCardResult) => {
        if (accepted.length === 4) await new Promise<void>(resolve => {confirmFifth = resolve;});
        accepted.push(result);
        return {pendingEventCount: 0, status: 'confirmed' as const};
      });
      const loadAuthenticatedState = vi.fn(async () => snapshot());
      const controller = createController(snapshot(), {completeCurrentCard, loadAuthenticatedState});
      await authenticateRemote(controller);
      for (let index = 0; index < 10; index += 1) {
        expect(screen.getByRole('status', {name: `第 ${Math.floor(index / 5) + 1} 轮 · 已完成 ${index % 5}/5`})).toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', {name: '翻面看答案'}));
        fireEvent.click(screen.getByRole('button', {name: '有把握'}));
        if (index === 4) {
          await act(async () => {await new Promise(resolve => setTimeout(resolve, 0));});
          expect(screen.getByRole('status', {name: '第 1 轮 · 已完成 4/5'})).toBeInTheDocument();
          expect(screen.queryByRole('heading', {name: '第 1 轮完成'})).toBeNull();
          await act(async () => {confirmFifth!();});
        }
        await screen.findByRole('button', {name: '下一张'});
        if (index === 4) {
          // The fifth answer explanation remains available before the summary.
          expect(screen.queryByRole('heading', {name: '第 1 轮完成'})).toBeNull();
          fireEvent.click(screen.getByRole('button', {name: '先到这里'}));
          await screen.findByRole('heading', {name: '学习统计'});
          fireEvent.click(screen.getByRole('button', {name: '继续学习'}));
          await screen.findByRole('button', {name: '下一张'});
          expect(screen.getByRole('status', {name: '第 1 轮 · 已完成 5/5'})).toBeInTheDocument();
        }
        fireEvent.click(screen.getByRole('button', {name: '下一张'}));
        if ((index + 1) % 5 === 0) {
          await screen.findByRole('heading', {name: `第 ${(index + 1) / 5} 轮完成`});
          const topics = within(screen.getByRole('list', {name: '本轮练过的知识点'}));
          expect(topics.getByText('听力 · 根据选项预测考点')).toBeInTheDocument();
          expect(topics.getByText('语法 · 主谓结构')).toBeInTheDocument();
          expect(screen.queryByText(/找比较对象、根据线索判断范围/)).toBeNull();
          const loads = loadAuthenticatedState.mock.calls.length;
          if (index === 9) {
            fireEvent.click(screen.getByRole('button', {name: '结束学习'}));
            await screen.findByRole('heading', {name: '学习统计'});
            fireEvent.click(screen.getByRole('button', {name: '继续学习'}));
          } else fireEvent.click(screen.getByRole('button', {name: '继续下一轮'}));
          await screen.findByRole('heading', {name: cards[index + 1].front.prompt});
          expect(loadAuthenticatedState).toHaveBeenCalledTimes(loads);
          expect(completeCurrentCard).toHaveBeenCalledTimes(index + 1);
        } else await screen.findByRole('heading', {name: cards[index + 1].front.prompt});
      }
      expect(screen.getByRole('status', {name: '第 3 轮 · 已完成 0/5'})).toBeInTheDocument();
    });
  }

  it('preserves the canonical pilot checkpoint instead of layering an ordinary presentation segment', async () => {
    const initial = createSnapshot('premium');
    initial.bootstrap.content.releaseClass = 'controlled_pilot';
    const last = {...createCard(5), space_metadata: {...createCard(5).space_metadata, box: '实际试点知识点'}};
    initial.learningSession.cards = [last];
    initial.learningSession.catalogCards.push(last);
    initial.learningSession.serverSelection = {...initial.learningSession.serverSelection!, cardId: last.card_id};
    const boundary = structuredClone(initial);
    boundary.learningSession.cards = [];
    boundary.learningSession.serverSelection = null;
    boundary.learningSession.roundCompletion = {completedCount: 5, contentVersion: boundary.learningSession.contentVersion!,
      pilotId: 'actual-pilot', receiptId: 'prc_actual_boundary', reviewCardIds: [], spaceCardId: last.card_id};
    const continued = structuredClone(initial);
    continued.learningSession.cards = [createCard(6)];
    continued.learningSession.catalogCards.push(createCard(6));
    continued.learningSession.serverSelection = {...initial.learningSession.serverSelection!, cardId: createCard(6).card_id, selectionId: 'sel_after_pilot_checkpoint'};
    const controller = createController(initial, {loadAuthenticatedState: vi.fn(async () => boundary),
      continueServerRound: vi.fn(async () => continued)});
    await authenticateRemote(controller);
    expect(screen.queryByText(/第 1 轮 · 已完成/)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('button', {name: '下一张'});
    fireEvent.click(screen.getByRole('button', {name: '下一张'}));
    await screen.findByRole('heading', {name: '本轮完成'});
    expect(screen.queryByRole('heading', {name: '第 1 轮完成'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '刷新学习进度'}));
    await screen.findByRole('heading', {name: createCard(6).front.prompt});
    expect(controller.continueServerRound).toHaveBeenCalledTimes(1);
    expect(controller.completeCurrentCard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', {name: /第 .*轮完成/})).toBeNull();
  });

  it('keeps the fifth pilot feedback at 5/5 until a next selection is read successfully', async () => {
    const initial = createSnapshot('premium');
    initial.bootstrap.content.releaseClass = 'controlled_pilot';
    initial.bootstrap.componentRevisions.learning.eventServerSequence = 4;
    const fifth = createCard(5), sixth = createCard(6);
    initial.learningSession.cards = [fifth];
    initial.learningSession.catalogCards.push(fifth, sixth);
    initial.learningSession.serverSelection = {...initial.learningSession.serverSelection!, cardId: fifth.card_id};
    const confirmedBootstrap = structuredClone(initial.bootstrap);
    confirmedBootstrap.componentRevisions.learning.eventServerSequence = 5;
    const next = structuredClone(initial);
    next.bootstrap = confirmedBootstrap;
    next.learningSession.cards = [sixth];
    next.learningSession.serverSelection = {...next.learningSession.serverSelection!, cardId: sixth.card_id, selectionId: 'sel_after_fifth_feedback'};
    let rejectNextRead: ((reason: Error) => void) | null = null;
    const loadAuthenticatedState = vi.fn(async () => next).mockImplementationOnce(
      () => new Promise<WebRemoteSnapshot>((_resolve, reject) => {rejectNextRead = reject;}),
    );
    const controller = createController(initial, {
      loadAuthenticatedState,
      refreshStatistics: vi.fn(async () => ({bootstrap: confirmedBootstrap, checkInSync: initial.checkInSync})),
    });
    await authenticateRemote(controller);
    expect(screen.getByRole('status', {name: '第 1 轮 · 已完成 4/5'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('button', {name: '下一张'});
    expect(await screen.findByRole('status', {name: '第 1 轮 · 已完成 5/5'})).toBeInTheDocument();
    expect(screen.getByRole('region', {name: '答案对照'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '下一张'}));
    expect(screen.getByRole('button', {name: '正在准备下一张…'})).toBeDisabled();
    expect(screen.getByRole('status', {name: '第 1 轮 · 已完成 5/5'})).toBeInTheDocument();
    await act(async () => {rejectNextRead!(new Error('next selection unavailable'));});
    expect(screen.getByRole('button', {name: '下一张'})).toBeEnabled();
    expect(screen.getByRole('region', {name: '答案对照'})).toBeInTheDocument();
    expect(screen.getByRole('status', {name: '第 1 轮 · 已完成 5/5'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '下一张'}));
    await screen.findByRole('heading', {name: sixth.front.prompt});
    expect(screen.queryByRole('region', {name: '答案对照'})).toBeNull();
    expect(screen.getByRole('status', {name: '第 2 轮 · 已完成 0/5'})).toBeInTheDocument();
    expect(loadAuthenticatedState).toHaveBeenCalledTimes(2);
    expect(controller.completeCurrentCard).toHaveBeenCalledTimes(1);
  });

  it('keeps a completed canonical pilot boundary while no server selection is available', async () => {
    const snapshot = createSnapshot('premium');
    snapshot.bootstrap.content.releaseClass = 'controlled_pilot';
    snapshot.bootstrap.componentRevisions.learning.eventServerSequence = 10;
    snapshot.learningSession.cards = [];
    snapshot.learningSession.serverSelection = null;
    await authenticateRemote(createController(snapshot));
    expect(screen.getByRole('status', {name: '第 2 轮 · 已完成 5/5'})).toBeInTheDocument();
  });

  it('enters a focused scene and restores global navigation without losing the current attempt', async () => {
    const snapshot = createSnapshot('premium');
    snapshot.bootstrap.statistics = {...snapshot.bootstrap.statistics!, cumulativeLearnedCardCount: 99};
    const history = {cardId: createCard(2).card_id, interactionId: 'flip' as const, phase: 'learning' as const,
      outcome: 'confident' as const, serverSequence: 1, completedAt: new Date().toISOString(),
      usedHint: false, usedPeek: false, isFavorited: false};
    snapshot.bootstrap.learning.cardStates = [history, {...history, cardId: '999999', serverSequence: 2}];
    const controller = createController(snapshot);
    await authenticateRemote(controller);
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
    expect(screen.queryByRole('button', {name: '选择备考科目'})).toBeNull();
    expect(screen.getByText('本库已练过 1/4 张')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    expect(screen.getByRole('list', {name: '本轮已确认 0/5'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '空间'}));
    expect(screen.getByRole('navigation', {name: '主要导航'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '返回学习'}));
    expect(screen.getByRole('button', {name: '有把握'})).toBeEnabled();
    expect(screen.queryByRole('button', {name: '翻面看答案'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '先到这里'}));
    expect(screen.getByRole('heading', {name: '学习统计'})).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', {name: '主要导航'})).getAllByRole('button')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', {name: '学习'}));
    expect(screen.getByRole('button', {name: '有把握'})).toBeEnabled();
    expect(controller.loadAuthenticatedState).not.toHaveBeenCalled();
  });

  it('reports coverage of the accessible prefix without claiming the locked full library', async () => {
    const snapshot = createSnapshot('free');
    snapshot.learningSession.catalogCards = snapshot.learningSession.catalogCards.slice(0, 2);
    const history = {cardId: createCard(1).card_id, interactionId: 'flip' as const, phase: 'learning' as const,
      outcome: 'confident' as const, serverSequence: 1, completedAt: new Date().toISOString(),
      usedHint: false, usedPeek: false, isFavorited: false};
    snapshot.bootstrap.learning.cardStates = [history, {...history, cardId: createCard(4).card_id, serverSequence: 2}];
    snapshot.bootstrap.statistics = {...snapshot.bootstrap.statistics!, cumulativeLearnedCardCount: 2};
    const controller = createController(snapshot, {refreshStatistics: vi.fn(async () => {throw new Error('network failure');})});
    await authenticateRemote(controller);
    expect(screen.getByText('可学卡片已练 1/2 张')).toBeInTheDocument();
    expect(screen.queryByText('本库已练过 1/4 张')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('button', {name: '下一张'});
    expect(await screen.findByText('可学卡片进度暂不可读')).toBeInTheDocument();
    expect(screen.queryByText(/(?:本库已练过|可学卡片已练) \d+\/\d+ 张/)).toBeNull();
  });

  it('keeps the saved result and shows unreadable coverage after a canonical progress read fails', async () => {
    const controller = createController(createSnapshot('premium'), {refreshStatistics: vi.fn(async () => {throw new Error('network failure');})});
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('button', {name: '下一张'});
    expect(await screen.findByText('本库进度暂不可读')).toBeInTheDocument();
    expect(screen.getByRole('list', {name: '本轮已确认 1/5'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '先到这里'})).toBeEnabled();
    expect(controller.completeCurrentCard).toHaveBeenCalledTimes(1);
  });

  it('preserves the canonical pilot round when its coverage refresh fails', async () => {
    const snapshot = createSnapshot('premium');
    snapshot.bootstrap.content.releaseClass = 'controlled_pilot';
    snapshot.bootstrap.componentRevisions.learning.eventServerSequence = 7;
    const controller = createController(snapshot, {refreshStatistics: vi.fn(async () => {throw new Error('network failure');})});
    await authenticateRemote(controller);
    expect(screen.getByRole('status', {name: '第 2 轮 · 已完成 2/5'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('button', {name: '下一张'});
    expect(await screen.findByText('本库进度暂不可读')).toBeInTheDocument();
    expect(screen.getByRole('status', {name: '第 2 轮 · 已完成 2/5'})).toBeInTheDocument();
  });

  it('keeps the phone bound while a code request is in flight', async () => {
    type Challenge = Awaited<ReturnType<WebRemoteRuntimeController['requestSmsCode']>>;
    let resolveRequest: (challenge: Challenge) => void = () => {
      throw new Error('Code request did not start.');
    };
    let requestedPhone = '';
    const requestSmsCode = vi.fn((phoneNumber: string) =>
      new Promise<Challenge>(resolve => {
        requestedPhone = phoneNumber;
        resolveRequest = resolve;
      }),
    );
    const controller = createController(createSnapshot('premium'), {requestSmsCode});
    render(<App remoteRuntimeFactory={() => controller} />);

    const phoneInput = await screen.findByLabelText('手机号');
    fireEvent.change(phoneInput, {target: {value: PHONE}});
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    expect(requestedPhone).toBe(PHONE);
    expect(phoneInput).toBeDisabled();

    await act(async () => {
      resolveRequest({
        challengeId: 'challenge-bound-phone',
        expiresAt: '2026-08-29T12:05:00.000Z',
        mode: 'remote',
        phoneNumber: requestedPhone,
        retryAfterSeconds: 0,
      });
    });
    await screen.findByLabelText('短信验证码');
    expect(phoneInput).toHaveValue(PHONE);
  });

  it('binds a login verification error to the submitted code', async () => {
    let rejectVerification: (error: unknown) => void = () => {
      throw new Error('Verification did not start.');
    };
    const verification = new Promise<WebRemoteSnapshot>((_resolve, reject) => {
      rejectVerification = reject;
    });
    const controller = createController(createSnapshot('premium'), {
      verifySmsCode: vi.fn(() => verification),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.change(await screen.findByLabelText('手机号'), {target: {value: PHONE}});
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    const codeInput = await screen.findByLabelText('短信验证码');
    fireEvent.change(codeInput, {target: {value: '123456'}});
    fireEvent.click(screen.getByRole('button', {name: '登录'}));
    expect(codeInput).toBeDisabled();

    await act(async () => {
      rejectVerification(new RemoteHttpError('private', 401, 'invalid_sms_code'));
      await verification.catch(() => undefined);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('验证码不正确');
    expect(codeInput).toBeEnabled();
    fireEvent.change(codeInput, {target: {value: '654321'}});
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('recovers a stale registration challenge with a fresh code for the same phone', async () => {
    const snapshot = createSnapshot('premium');
    const controller = createController(snapshot, {
      verifySmsCode: vi.fn().mockRejectedValueOnce(new RemoteHttpError('private account generation', 409, 'account_instance_changed')).mockResolvedValueOnce(snapshot),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.change(await screen.findByLabelText('手机号'), {target: {value: PHONE}});
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    fireEvent.change(await screen.findByLabelText('短信验证码'), {target: {value: '123456'}});
    fireEvent.click(screen.getByRole('button', {name: '登录'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('验证码已失效，请重新获取。');
    fireEvent.click(screen.getByRole('button', {name: '更换手机号 / 重新获取验证码'}));
    expect(screen.getByLabelText('手机号')).toHaveValue(PHONE);
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    const code = await screen.findByLabelText('短信验证码');
    expect(code).toHaveValue('');
    fireEvent.change(code, {target: {value: '654321'}});
    fireEvent.click(screen.getByRole('button', {name: '登录'}));
    await screen.findByRole('navigation', {name: '学习操作'});
    expect(controller.requestSmsCode).toHaveBeenNthCalledWith(2, PHONE);
    expect(controller.verifySmsCode).toHaveBeenCalledTimes(2);
  });

  it('starts a new server selection at the beginning without resetting an auxiliary same-card update', async () => {
    const initial = createSnapshot('premium');
    const next = createSnapshot('premium');
    next.learningSession.cards = [next.learningSession.catalogCards[1]];
    next.learningSession.serverSelection = {...next.learningSession.serverSelection!, cardId: '000002', selectionId: 'sel_next_1234567890'};
    const controller = createController(initial, {loadAuthenticatedState: vi.fn(async () => next)});
    await authenticateRemote(controller);
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(screen.getByRole('button', {name: '收藏'}));
    await act(async () => undefined);
    expect(window.scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    fireEvent.click(await screen.findByRole('button', {name: '下一张'}));
    await screen.findByRole('heading', {name: 'Card 2 prompt'});
    expect(window.scrollTo).toHaveBeenCalledWith({behavior: 'auto', top: 0});
  });

  it('offers a supplied listening original only after answering and hides it initially', async () => {
    const snapshot = createSnapshot('premium');
    const original = 'Listen to the complete original passage. Its final line is preserved.';
    snapshot.learningSession.cards[0].audio = {asset_id: 'original', duration_ms: 1000, sha256: `sha256:${'a'.repeat(64)}`, transcript: original};
    await authenticateRemote(createController(snapshot));
    expect(screen.queryByText(original)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    expect(screen.queryByText(original)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('button', {name: '下一张'});
    expect(screen.getByText(original)).not.toBeVisible();
    fireEvent.click(screen.getByText('听力原文'));
    expect(screen.getByText(original)).toBeVisible();
  });

  it('refreshes after a rejected completion without showing it as an accepted result', async () => {
    const initial = createSnapshot('premium');
    const next = createSnapshot('premium');
    next.learningSession.cards = [next.learningSession.catalogCards[1]];
    next.learningSession.serverSelection = {...next.learningSession.serverSelection!, cardId: '000002', selectionId: 'sel_recovered_1234567890'};
    next.learningSync = {pendingEventCount: 0, rejectedEventCount: 1, rejectionCodes: ['learning_event_selection_conflict'], status: 'rejected'};
    const controller = createController(initial, {
      completeCurrentCard: vi.fn(async () => ({...next.learningSync, completionStatus: 'rejected' as const})),
      loadAuthenticatedState: vi.fn(async () => next),
    });
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('heading', {name: 'Card 2 prompt'});
    expect(screen.queryByRole('region', {name: '答案对照'})).toBeNull();
    expect(screen.getByRole('button', {name: '翻面看答案'})).toBeEnabled();
    expect(screen.getByText(/这次结果未计入，学习安排已更新/)).toBeInTheDocument();
    openGlobalRoute('统计');
    expect((await screen.findByText('今天练过')).closest('div')).toHaveTextContent('0 张卡');
    expect(screen.getByText(/1 次学习结果未计入/)).toBeInTheDocument();
  });

  it('keeps rejected-result recovery usable when the first canonical refresh fails', async () => {
    const snapshot = createSnapshot('premium');
    const load = vi.fn().mockRejectedValueOnce(new Error('temporarily unavailable')).mockResolvedValueOnce(snapshot);
    const complete = vi.fn(async () => ({pendingEventCount: 0, rejectedEventCount: 1, status: 'rejected' as const, completionStatus: 'rejected' as const}));
    await authenticateRemote(createController(snapshot, {completeCurrentCard: complete, loadAuthenticatedState: load}));
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('heading', {name: '这次结果未计入'});
    expect(screen.queryByRole('button', {name: '重试同步'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '刷新学习进度'}));
    await screen.findByText(/这次结果未计入，学习安排已更新/);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('heading', {name: '这次结果未计入'})).toBeNull();
  });

  it('keeps a new accepted completion distinct from historical rejected results', async () => {
    const snapshot = createSnapshot('premium');
    snapshot.learningSync = {pendingEventCount: 0, rejectedEventCount: 1, status: 'rejected'};
    await authenticateRemote(createController(snapshot, {
      completeCurrentCard: vi.fn(async () => ({...snapshot.learningSync, completionStatus: 'confirmed' as const})),
    }));
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByRole('region', {name: '答案对照'});
    expect(screen.getByText('有把握')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '下一张'})).toBeEnabled();
    expect(screen.getByText(/1 次学习结果未计入/)).toBeInTheDocument();
  });

  it('keeps the visible favorite unchanged until durable enqueue succeeds', async () => {
    const snapshot = createSnapshot('premium');
    let rejectMutation: ((error: Error) => void) | null = null;
    const controller = createController(snapshot, {
      applySpaceState: () =>
        new Promise((_resolve, reject) => {
          rejectMutation = reject;
        }),
    });
    await authenticateRemote(controller);

    fireEvent.click(screen.getByRole('button', {name: '收藏'}));
    expect(screen.getByRole('button', {name: '收藏'})).toBeDisabled();
    expect(screen.queryByRole('button', {name: '已收藏'})).toBeNull();

    await act(async () => {
      rejectMutation?.(new Error('injected storage failure'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '收藏状态暂时没有更新。',
    );
    expect(screen.getByRole('button', {name: '收藏'})).toBeEnabled();
    expect(screen.queryByRole('button', {name: '已收藏'})).toBeNull();
  });

  it('preserves an unsubmitted card draft across an auxiliary snapshot', async () => {
    const initial = createSnapshot('premium');
    const afterFavorite = createSnapshot('premium');
    afterFavorite.favorites = ['000001'];
    const controller = createController(initial, {
      applySpaceState: vi.fn(async () => afterFavorite),
    });
    await authenticateRemote(controller);

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    expect(screen.getByText('Card 1 answer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '收藏'}));

    expect(
      await screen.findByRole('button', {name: '已收藏'}),
    ).toBeInTheDocument();
    expect(screen.getByText('Card 1 answer')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '翻面看答案'})).toBeNull();
    expect(screen.getByRole('button', {name: '有把握'})).toBeEnabled();
  });

  it('hides a durably slept current selection until a fresh server selection arrives', async () => {
    const initial = createSnapshot('premium');
    const pending = createSnapshot('premium');
    pending.sleeping = ['000001'];
    pending.spaceSync = {pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'};
    const next = createSnapshot('premium');
    next.sleeping = ['000001'];
    next.learningSession.cards = [next.learningSession.catalogCards[1]];
    next.learningSession.serverSelection = {...next.learningSession.serverSelection!,cardId:'000002',selectionId:'sel_after_sleep_1234567890'};
    const load = vi.fn().mockRejectedValueOnce(new Error('temporary read failure')).mockResolvedValueOnce(next);
    const complete = vi.fn();
    await authenticateRemote(createController(initial, {
      applySpaceState:vi.fn(async()=>pending),loadAuthenticatedState:load,completeCurrentCard:complete,
    }));
    fireEvent.click(screen.getByRole('button',{name:'翻面看答案'}));
    fireEvent.click(screen.getByRole('button',{name:'空间'}));
    fireEvent.click(screen.getByRole('button',{name:'暂不学习这张卡'}));
    await screen.findByRole('button',{name:'恢复学习'});
    fireEvent.click(screen.getByRole('button',{name:'返回学习'}));
    expect(screen.queryByRole('button',{name:'有把握'})).toBeNull();
    expect(screen.queryByText('Card 1 answer')).toBeNull();
    expect(screen.queryByText('Card 2 prompt')).toBeNull();
    expect(screen.getByRole('heading',{name:'这张卡已暂停学习'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'刷新学习进度'}));
    await screen.findByRole('alert');
    expect(screen.getByRole('heading',{name:'这张卡已暂停学习'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'刷新学习进度'}));
    await screen.findByRole('heading',{name:'Card 2 prompt'});
    expect(screen.getByRole('button',{name:'翻面看答案'})).toBeEnabled();
    expect(complete).not.toHaveBeenCalled();
  });

  it.each(['wake','rejection'] as const)('restores the same assisted draft after sleep %s without counting a completion', async recovery => {
    const initial=createSnapshot('premium');
    initial.learningSession.cards[0].hint_layer={label:'提示',content:'Retained hint',reveal_gesture:'下滑'};
    const pending=structuredClone(initial);
    pending.sleeping=['000001'];
    pending.spaceSync={pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'};
    const restored=structuredClone(initial);
    restored.spaceSync=recovery==='wake'
      ? {pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'}
      : {pendingActionCount:0,rejectedActionCount:1,rejectionCodes:['space_action_id_conflict'],status:'rejected'};
    const controller=createController(initial,{
      applySpaceState:vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(restored),
      loadAuthenticatedState:vi.fn(async()=>restored),
    });
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button',{name:'看判断方法'}));
    fireEvent.click(screen.getByRole('button',{name:'再看一个提示'}));
    fireEvent.click(screen.getByRole('button',{name:'收起提示'}));
    fireEvent.click(screen.getByRole('button',{name:'收起判断方法'}));
    fireEvent.click(screen.getByRole('button',{name:'翻面看答案'}));
    fireEvent.click(screen.getByRole('button',{name:'空间'}));
    fireEvent.click(screen.getByRole('button',{name:'暂不学习这张卡'}));
    await screen.findByRole('button',{name:'恢复学习'});
    fireEvent.click(screen.getByRole('button',{name:'返回学习'}));
    expect(screen.getByRole('heading',{name:'这张卡已暂停学习'})).toBeInTheDocument();
    if(recovery==='wake') {
      fireEvent.click(screen.getByRole('button',{name:'前往空间'}));
      fireEvent.click(screen.getByRole('button',{name:'恢复学习'}));
      await screen.findByRole('button',{name:'暂不学习这张卡'});
      fireEvent.click(screen.getByRole('button',{name:'返回学习'}));
    } else {
      fireEvent.click(screen.getByRole('button',{name:'刷新学习进度'}));
      expect(await screen.findByRole('alert')).toHaveTextContent('设置未能保存');
    }
    expect(screen.getByRole('button',{name:'有把握'})).toBeEnabled();
    expect(screen.queryByRole('button',{name:'翻面看答案'})).toBeNull();
    expect(controller.completeCurrentCard).not.toHaveBeenCalled();
    openGlobalRoute('统计');
    expect((await screen.findByText('今天练过')).closest('div')).toHaveTextContent('0 张卡');
    fireEvent.click(screen.getByRole('button',{name:'学习'}));
    fireEvent.click(screen.getByRole('button',{name:'有把握'}));
    await screen.findByRole('region',{name:'答案对照'});
    expect(controller.completeCurrentCard).toHaveBeenCalledWith(expect.objectContaining({usedHint:true,usedPeek:true}));
  });

  it('keeps another card sleep auxiliary and preserves the current answer draft', async()=>{
    const initial=createSnapshot('premium');const pending=createSnapshot('premium');
    pending.sleeping=['000002'];
    pending.spaceSync={pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'};
    const controller=createController(initial,{applySpaceState:vi.fn(async()=>pending)});
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button',{name:'翻面看答案'}));
    fireEvent.click(screen.getByRole('button',{name:'空间'}));
    fireEvent.click(screen.getByRole('button',{name:'Box 2 1 张'}));
    fireEvent.click(screen.getByRole('button',{name:'暂不学习这张卡'}));
    await screen.findByRole('button',{name:'恢复学习'});
    fireEvent.click(screen.getByRole('button',{name:'返回学习'}));
    expect(screen.getByRole('button',{name:'有把握'})).toBeEnabled();
    expect(screen.getByText('Card 1 answer')).toBeInTheDocument();
    expect(screen.queryByRole('heading',{name:'这张卡已暂停学习'})).toBeNull();
    expect(controller.completeCurrentCard).not.toHaveBeenCalled();
  });

  it('removes resolved-card keyboard continuation while the current card is sleeping',async()=>{
    const initial=createSnapshot('premium');const pending=createSnapshot('premium');
    pending.sleeping=['000001'];pending.spaceSync={pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'};
    const controller=createController(initial,{applySpaceState:vi.fn(async()=>pending)});
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button',{name:'翻面看答案'}));
    fireEvent.click(screen.getByRole('button',{name:'有把握'}));
    await screen.findByRole('button',{name:'下一张'});
    fireEvent.click(screen.getByRole('button',{name:'收藏'}));
    await screen.findByRole('heading',{name:'这张卡已暂停学习'});
    fireEvent.keyDown(document.body,{key:'Enter'});
    expect(controller.completeCurrentCard).toHaveBeenCalledTimes(1);
    expect(controller.loadAuthenticatedState).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:'下一张'})).toBeNull();
  });

  it('does not let hidden-card keyboard choices change the retained answer',async()=>{
    const initial=createSnapshot('premium');
    const choiceCard:LearningCard={...initial.learningSession.cards[0],interaction_id:'multiple_choice',auto_scoring:true,
      options:[{id:'a',label:'A',text:'alpha'},{id:'b',label:'B',text:'beta'},{id:'c',label:'C',text:'gamma'},{id:'d',label:'D',text:'delta'}],
      answer_key:{correct_option:'a'}};
    initial.learningSession.cards=[choiceCard];initial.learningSession.catalogCards[0]=choiceCard;
    const pending=structuredClone(initial);pending.sleeping=['000001'];
    pending.spaceSync={pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'};
    const controller=createController(initial,{applySpaceState:vi.fn(async()=>pending)});
    await authenticateRemote(controller);
    fireEvent.keyDown(document.body,{key:'1'});
    fireEvent.click(screen.getByRole('button',{name:'收藏'}));
    await screen.findByRole('heading',{name:'这张卡已暂停学习'});
    fireEvent.keyDown(document.body,{key:'2'});
    fireEvent.keyDown(document.body,{key:'Enter'});
    expect(controller.completeCurrentCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'刷新学习进度'}));
    const option=await screen.findByRole('button',{name:/alpha$/});
    expect(option).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('button',{name:/beta$/})).toHaveAttribute('aria-pressed','false');
  });

  it('retains a lock mistake across pending sleep and waking the same selection',async()=>{
    const initial=createSnapshot('premium');
    const lockCard:LearningCard={...initial.learningSession.cards[0],interaction_id:'lock',auto_scoring:true,
      lock_slots:[{id:'subject',label:'主语',options:['correct subject','wrong subject']},{id:'verb',label:'谓语',options:['correct verb','wrong verb']}],
      answer_key:{lock_pattern:['correct subject','correct verb']}};
    initial.learningSession.cards=[lockCard];initial.learningSession.catalogCards[0]=lockCard;
    const pending=structuredClone(initial);pending.sleeping=['000001'];
    pending.spaceSync={pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'};
    const controller=createController(initial,{applySpaceState:vi.fn(async()=>pending)});
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button',{name:'wrong subject'}));
    fireEvent.click(screen.getByRole('button',{name:'收藏'}));
    await screen.findByRole('heading',{name:'这张卡已暂停学习'});
    fireEvent.click(screen.getByRole('button',{name:'刷新学习进度'}));
    expect(await screen.findByRole('button',{name:'wrong subject'})).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByRole('button',{name:'correct subject'}));
    fireEvent.click(screen.getByRole('button',{name:'correct verb'}));
    await screen.findByRole('region',{name:'答案对照'});
    expect(controller.completeCurrentCard).toHaveBeenCalledTimes(1);
    expect(controller.completeCurrentCard).toHaveBeenCalledWith(expect.objectContaining({outcome:'incorrect'}));
  });

  it('invalidates pending audio when an auxiliary snapshot sleeps the current selection',async()=>{
    const initial=createSnapshot('premium');
    initial.learningSession.cards[0].audio={asset_id:'sleep-audio',duration_ms:1000,sha256:`sha256:${'a'.repeat(64)}`};
    const pending=structuredClone(initial);pending.sleeping=['000001'];
    pending.spaceSync={pendingActionCount:1,rejectedActionCount:0,rejectionCodes:[],status:'queued'};
    let finishPlayback!:(value:'playing')=>void;
    const controller=createController(initial,{
      applySpaceState:vi.fn(async()=>pending),stopCardAudio:vi.fn(),
      playCardAudio:vi.fn(()=>new Promise<'playing'>(resolve=>{finishPlayback=resolve})),
    });
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button',{name:'播放音频'}));
    fireEvent.click(screen.getByRole('button',{name:'收藏'}));
    await screen.findByRole('heading',{name:'这张卡已暂停学习'});
    expect(controller.stopCardAudio).toHaveBeenCalled();
    await act(async()=>finishPlayback('playing'));
    fireEvent.click(screen.getByRole('button',{name:'刷新学习进度'}));
    await screen.findByRole('button',{name:'播放音频'});
    expect(screen.queryByRole('button',{name:'暂停音频'})).toBeNull();
  });

  it.each(['content', 'phase'] as const)('starts a fresh attempt when %s changes even if a selection id is reused', async change => {
    const initial = createSnapshot('premium');
    const changed = createSnapshot('premium');
    if (change === 'content') changed.learningSession.contentVersion = `sha256:${'ab'.repeat(32)}`;
    else changed.learningSession.serverSelection = {...changed.learningSession.serverSelection!, phase: 'review'};
    await authenticateRemote(createController(initial, {applySpaceState: vi.fn(async () => changed)}));
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    expect(screen.getByRole('button', {name: '有把握'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '收藏'}));
    await screen.findByRole('button', {name: '翻面看答案'});
    expect(screen.queryByRole('button', {name: '有把握'})).toBeNull();
  });

  it('keeps Mine and logout reachable when the first account snapshot fails', async () => {
    const controller = createController(createSnapshot('premium'), {
      verifySmsCode: vi.fn(async () => {
        throw new WebRemotePostAuthError(new Error('injected bootstrap failure'));
      }),
    });
    await authenticateRemote(controller);

    expect(screen.getByText('暂时无法加载学习进度')).toBeInTheDocument();
    openGlobalRoute('我的');
    expect(
      screen.getByRole('heading', {name: '暂时无法加载账号信息'}),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '退出登录'})).toBeEnabled();
  });

  it('shows an explicit update path while preserving authenticated state', async () => {
    const controller = createController(createSnapshot('premium'), {
      verifySmsCode: vi.fn(async () => {
        throw new WebRemotePostAuthError(
          new AccountBootstrapIntegrityError(
            new ClientUpdateRequiredError('web', '1.0.0', '1.1.0'),
          ),
        );
      }),
    });
    await authenticateRemote(controller);

    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent('请刷新页面，更新后可继续学习');
    expect(screen.getByRole('navigation', {name: '学习操作'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '先到这里'}));
    expect(screen.getByRole('navigation', {name: '主要导航'})).toBeInTheDocument();
    expect(screen.queryByLabelText('短信验证码')).toBeNull();
  });

  it('filters internal Space metadata in text and aria sinks', async () => {
    const snapshot = createSnapshot('premium');
    for (const card of snapshot.learningSession!.catalogCards) {
      card.space_metadata = {
        ...card.space_metadata,
        box: 'raw-box-name',
        group: 'internal-group-name',
        library: 'fixture-library-name',
      };
    }
    await authenticateRemote(createController(snapshot));

    expect(document.body.textContent).not.toMatch(
      /raw-box-name|internal-group-name|fixture-library-name/,
    );
    fireEvent.click(screen.getByRole('button', {name: '空间'}));
    expect(document.body.textContent).not.toMatch(
      /raw-box-name|internal-group-name|fixture-library-name/,
    );
    expect(screen.getByRole('region', {name: '当前卡盒 当前卡盒'})).toBeInTheDocument();
  });

  it('keeps login closed on durable logout cleanup failure and resumes it', async () => {
    const snapshot = createSnapshot('premium');
    const controller = createController(snapshot);
    let authenticated = true;
    vi.mocked(controller.isAuthenticated).mockImplementation(
      () => authenticated,
    );
    vi.mocked(controller.logout).mockImplementationOnce(async () => {
      authenticated = false;
      throw new Error('injected cleanup failure');
    });
    vi.mocked(controller.resumeAccountDeletion)
      .mockResolvedValueOnce({status: 'none'})
      .mockResolvedValueOnce({status: 'session_cleanup_required'})
      .mockResolvedValueOnce({status: 'none'});
    await authenticateRemote(controller);

    openGlobalRoute('我的');
    fireEvent.click(screen.getByRole('button', {name: '退出登录'}));
    expect(
      await screen.findByText('正在退出登录'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
    expect(screen.queryByLabelText('手机号')).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: '重新清理'}));
    expect(await screen.findByLabelText('手机号')).toHaveValue('');
  });

  it('labels pending Space intent as queued instead of server-confirmed', async () => {
    const snapshot = createSnapshot('trial');
    snapshot.spaceSync = {
      pendingActionCount: 2,
      rejectedActionCount: 0,
      rejectionCodes: [],
      status: 'queued',
    };
    await authenticateRemote(createController(snapshot));

    expect(
      screen.getByText('学习记录 · 2 项设置等待同步'),
    ).toBeInTheDocument();
    expect(screen.queryByText('学习记录 · 已同步')).toBeNull();
  });

  it('shows terminal Space rejection as stopped instead of confirmed', async () => {
    const snapshot = createSnapshot('trial');
    snapshot.spaceSync = {
      pendingActionCount: 0,
      rejectedActionCount: 1,
      rejectionCodes: ['space_card_not_in_content'],
      status: 'rejected',
    };
    await authenticateRemote(createController(snapshot));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '设置未能保存。请刷新后重新操作。',
    );
    expect(
      screen.getByText('学习记录 · 1 项设置未能保存'),
    ).toBeInTheDocument();
    expect(screen.queryByText('学习记录 · 已同步')).toBeNull();

    for (const routeName of ['空间', '统计', '我的', '学习']) {
      fireEvent.click(
        screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}),
      );
      expect(
        screen.getByText(/1 项设置未能保存/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/已同步/)).toBeNull();
    }
  });

  it('renders persistent rejected and newer pending Space facts together', async () => {
    const snapshot = createSnapshot('trial');
    snapshot.spaceSync = {
      pendingActionCount: 1,
      rejectedActionCount: 1,
      rejectionCodes: ['space_action_id_conflict'],
      status: 'queued_and_rejected',
    };
    await authenticateRemote(createController(snapshot));

    for (const routeName of ['学习', '空间', '统计', '我的']) {
      if (routeName !== '学习' || screen.queryByRole('navigation', {name: '主要导航'})) {
        if (routeName === '统计' || routeName === '我的') openGlobalRoute(routeName);
        else fireEvent.click(screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}));
      }
      expect(
        screen.getByText(
          /1 项设置未能保存；1 项设置等待同步/,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/已同步/)).toBeNull();
    }
  });

  it('keeps an unacked Learning event visible across route navigation', async () => {
    const snapshot = createSnapshot('premium');
    const controller = createController(snapshot);
    vi.mocked(controller.completeCurrentCard).mockResolvedValue({
      pendingEventCount: 1,
      status: 'queued',
    });
    await authenticateRemote(controller);

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    expect(
      await screen.findByText(/1 项学习结果等待同步/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/已同步/)).toBeNull();

    for (const routeName of ['空间', '统计', '我的', '学习']) {
      fireEvent.click(
        screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}),
      );
      expect(
        screen.getByText(/1 项学习结果等待同步/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/已同步/)).toBeNull();
    }
  });

  it('freezes queued answer A and cannot display changed answer B after retry', async () => {
    const snapshot = createSnapshot('premium');
    const controller = createController(snapshot);
    vi.mocked(controller.completeCurrentCard)
      .mockResolvedValueOnce({pendingEventCount: 1, status: 'queued'})
      .mockResolvedValueOnce({pendingEventCount: 0, status: 'confirmed'});
    await authenticateRemote(controller);

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    await screen.findByText('学习结果等待同步');
    expect(screen.getByRole('button', {name: '有把握'})).toBeDisabled();
    expect(screen.getByRole('button', {name: '需要复习'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '需要复习'}));

    fireEvent.click(
      screen.getByRole('button', {name: '重试同步'}),
    );
    expect(await screen.findByRole('region', {name: '答案对照'})).toHaveTextContent('有把握');
    expect(screen.queryByText('已加入复习')).toBeNull();
    const submittedResults = vi.mocked(controller.completeCurrentCard).mock.calls
      .map(([result]) => result.outcome);
    expect(submittedResults).toEqual(['confident', 'confident']);
  });

  it('uses the server canonical free prefix without slicing it a second time', async () => {
    const snapshot = createSnapshot('free');
    snapshot.learningSession.catalogCards =
      snapshot.learningSession.catalogCards.slice(0, 3);
    const controller = createController(snapshot);
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button', {name: '空间'}));

    expect(screen.getByRole('button', {name: 'Box 1 1 张'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Box 2 1 张'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Box 3 1 张'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Box 4 1 张'})).toBeNull();
    expect(screen.getByRole('button', {name: '收藏'})).toBeDisabled();
    expect(
      screen.getByRole('button', {name: '暂不学习这张卡'}),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '收藏'}));
    expect(controller.applySpaceState).not.toHaveBeenCalled();
  });

  it('moves explicit check-in from ready to server-confirmed', async () => {
    const ready = createSnapshot('premium');
    ready.checkInSync.status = 'ready';
    ready.bootstrap.progress.snapshot.learningCompletedCount = 1;
    ready.bootstrap.progress.snapshot.totalCompletedCount = 1;
    const confirmed = structuredClone(ready);
    confirmed.checkInSync = {
      checkedInToday: true,
      pending: false,
      status: 'confirmed',
    };
    confirmed.bootstrap.progress.snapshot.checkedInToday = true;
    const controller = createController(ready, {
      checkInToday: vi.fn(async () => confirmed),
    });
    await authenticateRemote(controller);
    openGlobalRoute('统计');

    fireEvent.click(await screen.findByRole('button', {name: '签到'}));
    expect(
      await screen.findByRole('button', {name: '今日已签到'}),
    ).toBeDisabled();
    expect(screen.getByText('今日已签到')).toBeInTheDocument();
  });

  it('keeps explicit check-in unavailable before one canonical completion', async () => {
    await authenticateRemote(createController(createSnapshot('premium')));
    openGlobalRoute('统计');

    expect(
      await screen.findByRole('button', {name: '签到暂不可用'}),
    ).toBeDisabled();
    expect(screen.getByText('完成一张卡后可以签到，四六级共用签到记录。')).toBeInTheDocument();
  });

  it('shows unknown deletion without clearing the authenticated account', async () => {
    const snapshot = createSnapshot('premium');
    snapshot.checkInSync.status = 'ready';
    snapshot.bootstrap.progress.snapshot.learningCompletedCount = 1;
    snapshot.bootstrap.progress.snapshot.totalCompletedCount = 1;
    const controller = createController(snapshot, {
      requestAccountDeletion: vi.fn(async () => ({
        status: 'unknown' as const,
      })),
    });
    await authenticateRemote(controller);
    openGlobalRoute('我的');
    fireEvent.click(screen.getByRole('button', {name: '注销账号'}));
    fireEvent.click(screen.getByRole('button', {name: '确认注销账号'}));

    expect(await screen.findByText('尚未确认注销结果')).toBeInTheDocument();
    expect(controller.logout).not.toHaveBeenCalled();
    expect(
      screen.getByRole('navigation', {name: '主要导航'}),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '退出登录'})).toBeDisabled();
    openGlobalRoute('统计');
    expect(await screen.findByRole('button', {name: '签到'})).toBeDisabled();
    openGlobalRoute('我的');
    fireEvent.click(screen.getByRole('button', {name: '重新查询'}));
    expect(controller.requestAccountDeletion).toHaveBeenCalledTimes(2);
  });

  it('removes the authenticated shell only after accepted deletion cleanup', async () => {
    const snapshot = createSnapshot('premium');
    const controller = createController(snapshot, {
      requestAccountDeletion: vi.fn(async () => ({
        status: 'accepted' as const,
      })),
    });
    await authenticateRemote(controller);
    openGlobalRoute('我的');
    fireEvent.click(screen.getByRole('button', {name: '注销账号'}));
    fireEvent.click(screen.getByRole('button', {name: '确认注销账号'}));

    expect(await screen.findByText('注销申请已提交')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
    expect(screen.getByText(/注销正在处理中/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/账户已删除|删除已完成/);
    fireEvent.click(screen.getByRole('button', {name: '返回登录'}));
    expect(await screen.findByLabelText('手机号')).toHaveValue('');
  });

  it('immediately removes every cached account surface on a cross-tab authority change', async () => {
    const snapshot = createSnapshot('premium');
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    let resolveRecovery:
      | ((outcome: WebAccountDeletionOutcome) => void)
      | null = null;
    const recovery = new Promise<WebAccountDeletionOutcome>(resolve => {
      resolveRecovery = resolve;
    });
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({status: 'none' as const})
      .mockReturnValueOnce(recovery);
    const controller = createController(snapshot, {
      resumeAccountDeletion,
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
    });
    await authenticateRemote(controller);
    openGlobalRoute('我的');
    expect(screen.getByRole('heading', {name: '138 **** 8000'}))
      .toBeInTheDocument();
    expect(screen.getByText('会员')).toBeInTheDocument();

    act(() => invalidatePresentation?.({source: 'external_epoch'}));

    expect(screen.getByText('正在查询注销进度')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
    expect(screen.queryByText('138 **** 8000')).toBeNull();
    expect(screen.queryByText('会员')).toBeNull();
    expect(screen.queryByText('Card 1')).toBeNull();

    await act(async () => {
      resolveRecovery?.({
        phoneNumber: PHONE,
        status: 'reauthentication_required',
      });
      await recovery;
    });

    expect(
      screen.getByRole('heading', {
        name: '查询注销进度',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/138 \*\*\*\* 8000/)).toBeInTheDocument();
    expect(resumeAccountDeletion).toHaveBeenCalledTimes(2);
  });

  it('closes an ordinary SMS code surface when an external deletion epoch arrives', async () => {
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    let resolveRecovery:
      | ((outcome: WebAccountDeletionOutcome) => void)
      | null = null;
    const recovery = new Promise<WebAccountDeletionOutcome>(resolve => {
      resolveRecovery = resolve;
    });
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({status: 'none' as const})
      .mockReturnValueOnce(recovery);
    const controller = createController(createSnapshot('premium'), {
      resumeAccountDeletion,
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.change(await screen.findByLabelText('手机号'), {
      target: {value: PHONE},
    });
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    expect(await screen.findByLabelText('短信验证码')).toBeInTheDocument();

    act(() => invalidatePresentation?.({source: 'external_epoch'}));

    expect(screen.getByText('正在查询注销进度')).toBeInTheDocument();
    expect(screen.queryByLabelText('手机号')).toBeNull();
    expect(screen.queryByLabelText('短信验证码')).toBeNull();

    await act(async () => {
      resolveRecovery?.({
        phoneNumber: PHONE,
        status: 'reauthentication_required',
      });
      await recovery;
    });
    expect(
      screen.getByRole('heading', {
        name: '查询注销进度',
      }),
    ).toBeInTheDocument();
    expect(controller.verifySmsCode).not.toHaveBeenCalled();
  });

  it('clears phone and code when session authority is lost before initial bootstrap presents', async () => {
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    let resolveVerification:
      | ((snapshot: WebRemoteSnapshot) => void)
      | null = null;
    const verification = new Promise<WebRemoteSnapshot>(resolve => {
      resolveVerification = resolve;
    });
    const controller = createController(createSnapshot('premium'), {
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
      verifySmsCode: vi.fn(() => verification),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.change(await screen.findByLabelText('手机号'), {
      target: {value: PHONE},
    });
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    fireEvent.change(await screen.findByLabelText('短信验证码'), {
      target: {value: '123456'},
    });
    fireEvent.click(screen.getByRole('button', {name: '登录'}));

    act(() =>
      invalidatePresentation?.({
        reason: 'authorization_invalidated',
        source: 'session_authority',
      }),
    );
    expect(screen.getByText('正在查询注销进度')).toBeInTheDocument();
    expect(await screen.findByLabelText('手机号')).toHaveValue('');
    expect(screen.queryByLabelText('短信验证码')).not.toBeInTheDocument();
    expect(screen.getByText('登录已失效，请重新验证。')).toBeInTheDocument();
    expect(controller.cleanupInvalidatedSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveVerification?.(createSnapshot('premium'));
      await verification;
    });

    expect(screen.getByLabelText('手机号')).toHaveValue('');
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
  });

  it('returns session-authority loss to a clean phone shell without a competing resume', async () => {
    const snapshot = createSnapshot('premium');
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    let resolveDeletion:
      | ((outcome: WebAccountDeletionOutcome) => void)
      | null = null;
    const deletion = new Promise<WebAccountDeletionOutcome>(resolve => {
      resolveDeletion = resolve;
    });
    const resumeAccountDeletion = vi.fn(async () => ({
      status: 'none' as const,
    }));
    const controller = createController(snapshot, {
      requestAccountDeletion: vi.fn(() => deletion),
      resumeAccountDeletion,
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
    });
    await authenticateRemote(controller);
    openGlobalRoute('我的');
    fireEvent.click(screen.getByRole('button', {name: '注销账号'}));
    fireEvent.click(screen.getByRole('button', {name: '确认注销账号'}));

    act(() =>
      invalidatePresentation?.({source: 'session_authority'}),
    );
    expect(screen.getByLabelText('手机号')).toHaveValue('');
    expect(screen.queryByLabelText('短信验证码')).not.toBeInTheDocument();
    expect(screen.getByText('登录已失效，请重新验证。')).toBeInTheDocument();
    expect(resumeAccountDeletion).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDeletion?.({status: 'accepted'});
      await deletion;
    });
    expect(screen.getByLabelText('手机号')).toHaveValue('');
    expect(screen.queryByText('注销申请已提交')).not.toBeInTheDocument();
    expect(resumeAccountDeletion).toHaveBeenCalledTimes(1);
  });

  it('keeps failed cross-tab phase resolution retryable without restoring account presentation', async () => {
    const snapshot = createSnapshot('premium');
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({status: 'none' as const})
      .mockRejectedValueOnce(new Error('injected phase read failure'))
      .mockResolvedValueOnce({status: 'registration_ready' as const});
    const controller = createController(snapshot, {
      resumeAccountDeletion,
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
    });
    await authenticateRemote(controller);

    await act(async () => {
      invalidatePresentation?.({source: 'external_epoch'});
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('尚未确认注销结果')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '重新查询'}));
    expect(
      await screen.findByText('可以重新登录了'),
    ).toBeInTheDocument();
    expect(resumeAccountDeletion).toHaveBeenCalledTimes(3);
  });

  it('recovers a refreshed unknown deletion only with the original phone', async () => {
    const snapshot = createSnapshot('premium');
    const controller = createController(snapshot, {
      resumeAccountDeletion: vi.fn(async () => ({
        phoneNumber: PHONE,
        status: 'reauthentication_required' as const,
      })),
      verifyAccountDeletionRecoverySmsCode: vi.fn(async () => ({
        status: 'accepted' as const,
      })),
    });
    render(<App remoteRuntimeFactory={() => controller} />);

    expect(
      await screen.findByRole('heading', {
        name: '查询注销进度',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/138 \*\*\*\* 8000/)).toBeInTheDocument();
    expect(screen.queryByLabelText('手机号')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {name: '获取验证码'}),
    );

    const code = await screen.findByLabelText('短信验证码');
    expect(
      screen.getByRole('button', {name: '重新获取验证码'}),
    ).toBeEnabled();
    fireEvent.change(code, {target: {value: '123456'}});
    fireEvent.click(
      screen.getByRole('button', {name: '验证并查询'}),
    );

    expect(await screen.findByText('注销申请已提交')).toBeInTheDocument();
    expect(
      controller.requestAccountDeletionRecoverySmsCode,
    ).toHaveBeenCalledTimes(1);
    expect(
      controller.verifyAccountDeletionRecoverySmsCode,
    ).toHaveBeenCalledWith('123456');
    expect(controller.verifySmsCode).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
  });

  it('binds a deletion recovery error to the submitted code', async () => {
    let rejectVerification: (error: unknown) => void = () => {
      throw new Error('Recovery verification did not start.');
    };
    const verification = new Promise<WebAccountDeletionOutcome>((_resolve, reject) => {
      rejectVerification = reject;
    });
    const controller = createController(createSnapshot('premium'), {
      resumeAccountDeletion: vi.fn(async () => ({
        phoneNumber: PHONE,
        status: 'reauthentication_required' as const,
      })),
      verifyAccountDeletionRecoverySmsCode: vi.fn(() => verification),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.click(await screen.findByRole('button', {name: '获取验证码'}));
    const codeInput = await screen.findByLabelText('短信验证码');
    fireEvent.change(codeInput, {target: {value: '123456'}});
    fireEvent.click(screen.getByRole('button', {name: '验证并查询'}));
    expect(codeInput).toBeDisabled();

    await act(async () => {
      rejectVerification(new RemoteHttpError('private', 401, 'invalid_sms_code'));
      await verification.catch(() => undefined);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('验证码不正确');
    expect(codeInput).toBeEnabled();
    fireEvent.change(codeInput, {target: {value: '654321'}});
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens fresh registration after exact recovery none without claiming acceptance', async () => {
    const controller = createController(createSnapshot('premium'), {
      resumeAccountDeletion: vi.fn(async () => ({
        phoneNumber: PHONE,
        status: 'reauthentication_required' as const,
      })),
      verifyAccountDeletionRecoverySmsCode: vi.fn(async () => ({
        status: 'registration_ready' as const,
      })),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: '获取验证码',
      }),
    );
    fireEvent.change(await screen.findByLabelText('短信验证码'), {
      target: {value: '123456'},
    });
    fireEvent.click(
      screen.getByRole('button', {name: '验证并查询'}),
    );

    expect(
      await screen.findByText('可以重新登录了'),
    ).toBeInTheDocument();
    expect(screen.getByText(/没有待处理的注销申请/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/账户已删除|删除已完成/);
    expect(screen.queryByText('注销申请已提交')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '返回登录'}));
    expect(await screen.findByLabelText('手机号')).toHaveValue('');
  });

  it('does not let a stale recovery-code request overwrite a newer external epoch', async () => {
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    let resolveRequest:
      | (() => void)
      | null = null;
    const request = new Promise<void>(resolve => {
      resolveRequest = resolve;
    });
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({
        phoneNumber: PHONE,
        status: 'reauthentication_required' as const,
      })
      .mockResolvedValueOnce({status: 'registration_ready' as const});
    const controller = createController(createSnapshot('premium'), {
      requestAccountDeletionRecoverySmsCode: vi.fn(async () => {
        await request;
        return {
          challengeId: 'challenge-deletion-recovery',
          delivery: 'sms',
          expiresAt: '2026-08-29T12:05:00.000Z',
          phoneNumber: PHONE,
          requestingRevision: 1,
          retryAfterSeconds: 0,
        };
      }),
      resumeAccountDeletion,
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: '获取验证码',
      }),
    );

    act(() => invalidatePresentation?.({source: 'external_epoch'}));
    expect(
      await screen.findByText('可以重新登录了'),
    ).toBeInTheDocument();
    await act(async () => {
      resolveRequest?.();
      await request;
    });

    expect(screen.getByText('可以重新登录了')).toBeInTheDocument();
    expect(screen.queryByLabelText('短信验证码')).not.toBeInTheDocument();
  });

  it('does not let a stale recovery verification overwrite a newer external epoch', async () => {
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    let resolveVerification:
      | ((outcome: WebAccountDeletionOutcome) => void)
      | null = null;
    const verification = new Promise<WebAccountDeletionOutcome>(resolve => {
      resolveVerification = resolve;
    });
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({
        phoneNumber: PHONE,
        status: 'reauthentication_required' as const,
      })
      .mockResolvedValueOnce({status: 'registration_ready' as const});
    const controller = createController(createSnapshot('premium'), {
      resumeAccountDeletion,
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
      verifyAccountDeletionRecoverySmsCode: vi.fn(() => verification),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: '获取验证码',
      }),
    );
    fireEvent.change(await screen.findByLabelText('短信验证码'), {
      target: {value: '123456'},
    });
    fireEvent.click(
      screen.getByRole('button', {name: '验证并查询'}),
    );

    act(() => invalidatePresentation?.({source: 'external_epoch'}));
    expect(
      await screen.findByText('可以重新登录了'),
    ).toBeInTheDocument();
    await act(async () => {
      resolveVerification?.({status: 'accepted'});
      await verification;
    });

    expect(screen.getByText('可以重新登录了')).toBeInTheDocument();
    expect(screen.queryByText('注销申请已提交')).not.toBeInTheDocument();
  });

  it('keeps a newer external recovery result when an older retry finishes late', async () => {
    let invalidatePresentation:
      | ((event: WebAccountPresentationInvalidation) => void)
      | null = null;
    let resolveRetry:
      | ((outcome: WebAccountDeletionOutcome) => void)
      | null = null;
    const retry = new Promise<WebAccountDeletionOutcome>(resolve => {
      resolveRetry = resolve;
    });
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({status: 'unknown' as const})
      .mockReturnValueOnce(retry)
      .mockResolvedValueOnce({status: 'registration_ready' as const});
    const controller = createController(createSnapshot('premium'), {
      resumeAccountDeletion,
      subscribeAccountPresentationInvalidation: vi.fn(listener => {
        invalidatePresentation = listener;
        return () => {
          invalidatePresentation = null;
        };
      }),
    });
    render(<App remoteRuntimeFactory={() => controller} />);
    fireEvent.click(
      await screen.findByRole('button', {name: '重新查询'}),
    );

    act(() => invalidatePresentation?.({source: 'external_epoch'}));
    expect(
      await screen.findByText('可以重新登录了'),
    ).toBeInTheDocument();
    await act(async () => {
      resolveRetry?.({status: 'accepted'});
      await retry;
    });

    expect(screen.getByText('可以重新登录了')).toBeInTheDocument();
    expect(screen.queryByText('注销申请已提交')).not.toBeInTheDocument();
  });

  it('retries registration-ready local cleanup without another SMS', async () => {
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'registration_cleanup_required' as const,
      })
      .mockResolvedValueOnce({status: 'registration_ready' as const});
    const controller = createController(createSnapshot('premium'), {
      resumeAccountDeletion,
    });
    render(<App remoteRuntimeFactory={() => controller} />);

    expect(
      await screen.findByText('本机记录还未清理完成'),
    ).toBeInTheDocument();
    expect(screen.getByText(/请先清理本机的旧登录记录/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/账户已删除|删除已完成/);
    fireEvent.click(screen.getByRole('button', {name: '重新清理'}));

    expect(
      await screen.findByText('可以重新登录了'),
    ).toBeInTheDocument();
    expect(resumeAccountDeletion).toHaveBeenCalledTimes(2);
    expect(
      controller.requestAccountDeletionRecoverySmsCode,
    ).not.toHaveBeenCalled();
  });

  it('keeps ordinary login closed while a reloaded session cleanup retries', async () => {
    const resumeAccountDeletion = vi
      .fn()
      .mockResolvedValueOnce({status: 'session_cleanup_required' as const})
      .mockResolvedValueOnce({status: 'none' as const});
    const controller = createController(createSnapshot('premium'), {
      resumeAccountDeletion,
    });
    render(<App remoteRuntimeFactory={() => controller} />);

    expect(
      await screen.findByText('正在退出登录'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('手机号')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '重新清理'}));

    expect(await screen.findByLabelText('手机号')).toHaveValue('');
    expect(resumeAccountDeletion).toHaveBeenCalledTimes(2);
    expect(controller.requestSmsCode).not.toHaveBeenCalled();
  });

  it.each([
    ['accepted', '注销申请已提交'],
    ['registration_ready', '可以重新登录了'],
  ] as const)(
    'renders %s truth returned by logout cleanup dispatch',
    async (status, expectedTitle) => {
      const controller = createController(createSnapshot('premium'), {
        logout: vi.fn(async () => ({status})),
      });
      await authenticateRemote(controller);

      openGlobalRoute('我的');
    fireEvent.click(screen.getByRole('button', {name: '退出登录'}));

      expect(await screen.findByText(expectedTitle)).toBeInTheDocument();
      expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
    },
  );

  it('keeps requesting truth when logout races an account deletion request', async () => {
    const controller = createController(createSnapshot('premium'), {
      logout: vi.fn(async () => ({status: 'unknown' as const})),
    });
    await authenticateRemote(controller);

    openGlobalRoute('我的');
    fireEvent.click(screen.getByRole('button', {name: '退出登录'}));
    openGlobalRoute('我的');

    expect(await screen.findByText('尚未确认注销结果')).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: '主要导航'})).toBeInTheDocument();
  });

  it('updates the audio action after ended and error events', async () => {
    const snapshot = createSnapshot('premium');
    const audioCard = {
      ...snapshot.learningSession.cards[0],
      audio: {
        asset_id: 'cet4.000001.prompt',
        duration_ms: 1_000,
        sha256: `sha256:${'ab'.repeat(32)}`,
      },
    };
    snapshot.learningSession.cards = [audioCard];
    snapshot.learningSession.catalogCards = [
      audioCard,
      ...snapshot.learningSession.catalogCards.slice(1),
    ];
    let audioListener: ((status: 'error' | 'idle') => void) | null = null;
    let resolvePreparedAudio: (status: 'ready') => void = () => undefined;
    const preparedAudio = new Promise<'ready'>(resolve => {
      resolvePreparedAudio = resolve;
    });
    const controller = createController(snapshot, {
      playCardAudio: vi
        .fn()
        .mockImplementationOnce(() => preparedAudio)
        .mockResolvedValueOnce('playing'),
      subscribeAudioStatus: vi.fn(listener => {
        audioListener = listener;
        return () => undefined;
      }),
    });
    await authenticateRemote(controller);

    fireEvent.click(screen.getByRole('button', {name: '播放音频'}));
    expect(screen.getByRole('button', {name: '正在准备音频'})).toBeDisabled();
    await act(async () => {
      resolvePreparedAudio('ready');
      await preparedAudio;
    });
    expect(await screen.findByRole('button', {name: '播放音频'})).toBeEnabled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: '播放音频'}));
    });
    expect(
      await screen.findByRole('button', {name: '暂停音频'}),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    expect(await screen.findByRole('region', {name: '答案对照'})).toHaveTextContent('有把握');
    expect(screen.getByRole('button', {name: '暂停音频'})).toBeEnabled();
    vi.mocked(controller.playCardAudio).mockResolvedValueOnce('paused');
    fireEvent.click(screen.getByRole('button', {name: '暂停音频'}));
    expect(await screen.findByRole('button', {name: '继续播放'})).toBeEnabled();
    expect(controller.playCardAudio).toHaveBeenCalledTimes(3);

    act(() => audioListener?.('idle'));
    expect(
      screen.getByRole('button', {name: '播放音频'}),
    ).toBeInTheDocument();
    act(() => audioListener?.('error'));
    expect(
      screen.getByRole('button', {name: '重试播放'}),
    ).toBeInTheDocument();
  });

  it.each(['premium', 'trial'] as const)(
    'shows the full multi-card Space and enables writes for %s',
    async stage => {
      const snapshot = createSnapshot(stage);
      const controller = createController(snapshot);
      await authenticateRemote(controller);
      fireEvent.click(screen.getByRole('button', {name: '空间'}));

      for (const index of [1, 2, 3, 4]) {
        expect(
          screen.getByRole('button', {name: `Box ${index} 1 张`}),
        ).toBeInTheDocument();
      }
      expect(screen.getByRole('button', {name: '收藏'})).toBeEnabled();
      expect(
        screen.getByRole('button', {name: '暂不学习这张卡'}),
      ).toBeEnabled();
    },
  );

  it('restarts controller listeners under StrictMode and disposes on remount', () => {
    const strictControllers: WebRemoteRuntimeController[] = [];
    let activePresentationSubscriptions = 0;
    const subscribeAccountPresentationInvalidation = vi.fn(() => {
      activePresentationSubscriptions += 1;
      return () => {
        activePresentationSubscriptions -= 1;
      };
    });
    const firstRender = render(
      <StrictMode>
        <App
          remoteRuntimeFactory={() => {
            const controller = createController(createSnapshot('premium'), {
              resumeAccountDeletion: vi.fn(
                () => new Promise<WebAccountDeletionOutcome>(() => undefined),
              ),
              subscribeAccountPresentationInvalidation,
            });
            strictControllers.push(controller);
            return controller;
          }}
        />
      </StrictMode>,
    );

    expect(strictControllers).toHaveLength(2);
    const first = strictControllers.find(
      controller => vi.mocked(controller.start).mock.calls.length > 0,
    )!;
    const discarded = strictControllers.find(
      controller => controller !== first,
    )!;
    expect(discarded.start).not.toHaveBeenCalled();
    expect(discarded.dispose).not.toHaveBeenCalled();
    expect(first.start).toHaveBeenCalledTimes(2);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(activePresentationSubscriptions).toBe(1);
    firstRender.unmount();
    expect(first.dispose).toHaveBeenCalledTimes(2);
    expect(activePresentationSubscriptions).toBe(0);

    const second = createController(createSnapshot('premium'), {
      resumeAccountDeletion: vi.fn(
        () => new Promise<WebAccountDeletionOutcome>(() => undefined),
      ),
      subscribeAccountPresentationInvalidation,
    });
    const secondRender = render(<App remoteRuntimeFactory={() => second} />);
    expect(second.start).toHaveBeenCalledTimes(1);
    expect(activePresentationSubscriptions).toBe(1);
    expect(first.start).toHaveBeenCalledTimes(2);
    secondRender.unmount();
    expect(second.dispose).toHaveBeenCalledTimes(1);
    expect(activePresentationSubscriptions).toBe(0);
  });
});

async function authenticateRemote(controller: WebRemoteRuntimeController) {
  render(<App remoteRuntimeFactory={() => controller} />);
  fireEvent.change(await screen.findByLabelText('手机号'), {
    target: {value: PHONE},
  });
  fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
  await screen.findByLabelText('短信验证码');
  fireEvent.change(screen.getByLabelText('短信验证码'), {
    target: {value: '123456'},
  });
  fireEvent.click(screen.getByRole('button', {name: '登录'}));
  await screen.findByRole('navigation', {name: '学习操作'});
}

function createController(
  snapshot: WebRemoteSnapshot,
  overrides: Partial<WebRemoteRuntimeController> = {},
): WebRemoteRuntimeController {
  return {
    applySpaceState: vi.fn(async () => snapshot),
    checkInToday: vi.fn(async () => snapshot),
    cleanupInvalidatedSession: vi.fn(async () => null),
    completeCurrentCard: vi.fn(async () => ({
      pendingEventCount: 0,
      status: 'confirmed' as const,
    })),
    continueServerRound: vi.fn(async () => snapshot),
    dispose: vi.fn(),
    isAuthenticated: vi.fn(() => true),
    loadAuthenticatedState: vi.fn(async () => snapshot),
    requestReview: vi.fn(async () => snapshot),
    refreshStatistics: vi.fn(async () => ({bootstrap: snapshot.bootstrap, checkInSync: snapshot.checkInSync})),
    switchTrack: vi.fn(async () => snapshot),
    logout: vi.fn(async () => null),
    playCardAudio: vi.fn(async (): Promise<'ready'> => 'ready'),
    requestSmsCode: vi.fn(async (phoneNumber: string) => ({
      challengeId: 'challenge-ui',
      expiresAt: '2026-08-29T12:05:00.000Z',
      mode: 'remote' as const,
      phoneNumber,
      retryAfterSeconds: 0,
    })),
    requestAccountDeletion: vi.fn(async () => ({status: 'none' as const})),
    requestAccountDeletionRecoverySmsCode: vi.fn(async () => ({
      challengeId: 'challenge-deletion-recovery',
      delivery: 'sms',
      expiresAt: '2026-08-29T12:05:00.000Z',
      phoneNumber: PHONE,
      requestingRevision: 1,
      retryAfterSeconds: 0,
    })),
    resumeAccountDeletion: vi.fn(async () => ({status: 'none' as const})),
    start: vi.fn(),
    subscribeAccountPresentationInvalidation: vi.fn(
      () => () => undefined,
    ),
    subscribeAudioStatus: vi.fn(() => () => undefined),
    verifyAccountDeletionRecoverySmsCode: vi.fn(async () => ({
      status: 'unknown' as const,
    })),
    verifySmsCode: vi.fn(async () => snapshot),
    ...overrides,
  };
}

function createSnapshot(stage: 'free' | 'premium' | 'trial'): WebRemoteSnapshot {
  const membership = createMembership(stage);
  const catalogCards = [1, 2, 3, 4].map(createCard);
  const learningSession: LearningSession = {
    cards: [catalogCards[0]],
    catalogCards,
    contentManifest: null,
    contentVersion: `sha256:${'12'.repeat(32)}`,
    membershipStage: stage,
    membershipTrialExpiresAt: membership.trialExpiresAt,
    membershipTrialRemainingSeconds: membership.trialRemainingSeconds,
    membershipTrialStartedAt: membership.trialStartedAt,
    nextDueAt: null,
    roundCompletion: null,
    schedulingMode: 'server',
    serverSelection: {
      cardId: catalogCards[0].card_id,
      dueAt: null,
      phase: 'learning',
      reason: 'catalog_new',
      selectionId: 'sel_1234567890abcdef',
    },
    sourceId: 'source-remote-ui',
    sourceLabel: 'CET4',
    track: 'cet4',
  };

  return {
    bootstrap: {
      statistics: {dayKey: getChinaDayKey(), track: 'cet4', completedCardCount: 0, completedAttemptCount: 0, reviewAttemptCount: 0, cumulativeLearnedCardCount: 0},
      componentRevisions: {
        learning: {eventServerSequence: 0, sessionRevision: 1, spaceRevision: 0},
        membership: {
          baseMembershipRevision: 1,
          betaEntitlementRevision: 0,
          pilotEntitlementRevision: 0,
        },
        progress: {
          checkInRevision: 0,
          learningServerSequence: 0,
          spaceRevision: 0,
        },
        schemaVersion: 'bootstrap-component-revisions.v1',
        space: {stateRevision: 0},
      },
      content: {
        cardCount: catalogCards.length,
        minimumClientVersion: '0.1.0',
        parentReleaseId: null,
        publishedAt: '2026-08-29T00:00:00.000Z',
        releaseClass: 'production',
        releaseId: 'release-2026',
        source: {id: 'source-remote-ui', label: 'CET4'},
        version: `sha256:${'12'.repeat(32)}`,
      },
      dayKey: getChinaDayKey(),
      generatedAt: '2026-08-29T12:00:00.000Z',
      learning: {
        acknowledgedAt: null,
        cardStates: [],
        cursor: {
          cardId: catalogCards[0].card_id,
          sourceId: 'source-remote-ui',
          track: 'cet4',
        },
        source: {id: 'source-remote-ui', label: 'CET4'},
      },
      membership: {
        acknowledgedAt: '2026-08-29T12:00:00.000Z',
        state: membership,
      },
      progress: {
        acknowledgedAt: null,
        learningAuthority: 'empty',
        snapshot: {
          checkedInToday: false,
          dayKey: getChinaDayKey(),
          favoriteCount: 0,
          learningCompletedCount: 0,
          pendingReviewCount: 0,
          reviewCompletedCount: 0,
          sleepingCount: 0,
          totalCompletedCount: 0,
        },
      },
      schemaVersion: 'bootstrap.v2',
      space: {
        acknowledgedAt: null,
        snapshot: {dayKey: getChinaDayKey(), states: []},
      },
      track: 'cet4',
    },
    checkInSync: {
      checkedInToday: false,
      pending: false,
      status: 'unavailable',
    },
    favorites: [],
    learningResults: [],
    learningSession,
    learningSync: {pendingEventCount: 0, status: 'confirmed'},
    membership,
    reviewResults: [],
    sleeping: [],
    spaceSync: {
      pendingActionCount: 0,
      rejectedActionCount: 0,
      rejectionCodes: [],
      status: 'confirmed',
    },
  };
}

function createMembership(stage: 'free' | 'premium' | 'trial'): MembershipState {
  const initial = createInitialMembershipState();
  if (stage !== 'trial') {
    return {...initial, stage};
  }
  return {
    ...initial,
    countedEntryCount: 1,
    stage: 'trial',
    trialExpiresAt: '2026-09-03T12:00:00.000Z',
    trialRemainingSeconds: 432000,
    trialStartedAt: '2026-08-29T12:00:00.000Z',
    trialStartedAtEntryCount: 1,
  };
}

function createCard(index: number): LearningCard {
  const cardId = String(index).padStart(6, '0');
  return {
    analysis: {exam_tip: 'tip', summary: 'summary', title: 'title'},
    back_text: `Card ${index} answer`,
    card_id: cardId,
    front: {
      context: `Card ${index} context`,
      eyebrow: 'eyebrow',
      prompt: `Card ${index} prompt`,
      support: `Card ${index} support`,
    },
    interaction_id: 'flip',
    knowledge_ref: `knowledge-${index}`,
    space_metadata: {
      box: `Box ${index}`,
      box_ref: `box-${index}`,
      group: 'Group',
      library: 'Library',
    },
    track: 'cet4',
  };
}

function openGlobalRoute(name: '统计' | '我的') {
  if (!screen.queryByRole('navigation', {name: '主要导航'})) {
    fireEvent.click(screen.getByRole('button', {name: '先到这里'}));
  }
  fireEvent.click(screen.getByRole('button', {name}));
}
