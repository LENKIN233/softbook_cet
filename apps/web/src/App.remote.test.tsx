import {act, fireEvent, render, screen} from '@testing-library/react';

import type {LearningCard, LearningSession} from '../../mobile/src/learning/model';
import {
  createInitialMembershipState,
  type MembershipState,
} from '../../mobile/src/membership/localMembership';
import {App} from './App';
import type {
  WebRemoteRuntimeController,
  WebRemoteSnapshot,
} from './remoteRuntime';

const PHONE = '13800138000';

describe('PC Web remote UI authority', () => {
  beforeEach(() => {
    window.__SOFTBOOK_WEB_RUNTIME__ = {
      baseUrl: 'https://runtime.example.cn',
      clientKind: 'web',
      contentManifestPublicKeys: {'release-2026': 'ab'.repeat(32)},
      mode: 'remote',
      track: 'cet4',
    };
  });

  afterEach(() => {
    delete window.__SOFTBOOK_WEB_RUNTIME__;
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

    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));
    expect(screen.getByRole('button', {name: '标记喜欢'})).toBeDisabled();
    expect(screen.queryByRole('button', {name: '已标记喜欢'})).toBeNull();

    await act(async () => {
      rejectMutation?.(new Error('injected storage failure'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '喜欢状态暂时没有更新。',
    );
    expect(screen.getByRole('button', {name: '标记喜欢'})).toBeEnabled();
    expect(screen.queryByRole('button', {name: '已标记喜欢'})).toBeNull();
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
    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));

    expect(
      await screen.findByRole('button', {name: '已标记喜欢'}),
    ).toBeInTheDocument();
    expect(screen.getByText('Card 1 answer')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '翻面看答案'})).toBeNull();
    expect(screen.getByRole('button', {name: '有把握'})).toBeEnabled();
  });

  it('does not present logged-out UI when durable cleanup fails', async () => {
    const snapshot = createSnapshot('premium');
    const controller = createController(snapshot);
    let authenticated = true;
    vi.mocked(controller.isAuthenticated).mockImplementation(
      () => authenticated,
    );
    vi.mocked(controller.logout)
      .mockImplementationOnce(async () => {
        authenticated = false;
        throw new Error('injected cleanup failure');
      })
      .mockResolvedValueOnce();
    await authenticateRemote(controller);

    fireEvent.click(screen.getByRole('button', {name: '退出'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '本地待同步记录尚未安全清理',
    );
    expect(screen.getByRole('navigation', {name: '主要导航'})).toBeInTheDocument();
    expect(screen.queryByLabelText('手机号')).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: '退出'}));
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
      screen.getByText('跨端同步 · 2 项空间操作等待同步'),
    ).toBeInTheDocument();
    expect(screen.queryByText('跨端同步 · 服务端已确认')).toBeNull();
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
      '空间操作未被服务端接受，已停止自动重试',
    );
    expect(
      screen.getByText('跨端同步 · 1 项空间操作已被拒绝'),
    ).toBeInTheDocument();
    expect(screen.queryByText('跨端同步 · 服务端已确认')).toBeNull();

    for (const routeName of ['空间', '统计', '我的', '学习']) {
      fireEvent.click(
        screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}),
      );
      expect(
        screen.getByText(/1 项空间操作已被拒绝/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/服务端已确认/)).toBeNull();
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
      fireEvent.click(
        screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}),
      );
      expect(
        screen.getByText(
          /1 项空间操作已被拒绝；1 项空间操作等待同步/,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/服务端已确认/)).toBeNull();
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
    expect(screen.queryByText(/服务端已确认/)).toBeNull();

    for (const routeName of ['空间', '统计', '我的', '学习']) {
      fireEvent.click(
        screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}),
      );
      expect(
        screen.getByText(/1 项学习结果等待同步/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/服务端已确认/)).toBeNull();
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
    expect(screen.getByRole('button', {name: '再回看'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '再回看'}));

    fireEvent.click(
      screen.getByRole('button', {name: '重试同步当前结果'}),
    );
    expect(await screen.findByText('已记为有把握')).toBeInTheDocument();
    expect(screen.queryByText('已加入回看')).toBeNull();
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
    expect(screen.getByRole('button', {name: '标记喜欢'})).toBeDisabled();
    expect(
      screen.getByRole('button', {name: '移入盒内休眠区'}),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));
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
    fireEvent.click(screen.getByRole('button', {name: '统计'}));

    fireEvent.click(screen.getByRole('button', {name: '记录今天'}));
    expect(
      await screen.findByRole('button', {name: '今日已记录'}),
    ).toBeDisabled();
    expect(screen.getByText('今天已收好')).toBeInTheDocument();
  });

  it('keeps explicit check-in unavailable before one canonical completion', async () => {
    await authenticateRemote(createController(createSnapshot('premium')));
    fireEvent.click(screen.getByRole('button', {name: '统计'}));

    expect(
      screen.getByRole('button', {name: '签到暂不可用'}),
    ).toBeDisabled();
    expect(screen.getByText('先完成今天的学习')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', {name: '我的'}));
    fireEvent.click(screen.getByRole('button', {name: '删除账户'}));
    fireEvent.click(screen.getByRole('button', {name: '确认删除账户'}));

    expect(await screen.findByText('删除结果暂时未知')).toBeInTheDocument();
    expect(controller.logout).not.toHaveBeenCalled();
    expect(
      screen.getByRole('navigation', {name: '主要导航'}),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '退出登录'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '统计'}));
    expect(screen.getByRole('button', {name: '记录今天'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '我的'}));
    fireEvent.click(screen.getByRole('button', {name: '重试确认'}));
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
    fireEvent.click(screen.getByRole('button', {name: '我的'}));
    fireEvent.click(screen.getByRole('button', {name: '删除账户'}));
    fireEvent.click(screen.getByRole('button', {name: '确认删除账户'}));

    expect(await screen.findByText('删除申请已提交')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
    expect(screen.getByText(/不表示所有数据已在这一刻擦除完成/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '返回手机号验证'}));
    expect(await screen.findByLabelText('手机号')).toHaveValue('');
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
        name: '重新验证手机号，继续确认删除',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/138 \*\*\*\* 8000/)).toBeInTheDocument();
    expect(screen.queryByLabelText('手机号')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {name: '向原手机号获取验证码'}),
    );

    const code = await screen.findByLabelText('短信验证码');
    expect(
      screen.getByRole('button', {name: '重新获取验证码'}),
    ).toBeEnabled();
    fireEvent.change(code, {target: {value: '123456'}});
    fireEvent.click(
      screen.getByRole('button', {name: '验证并继续确认删除'}),
    );

    expect(await screen.findByText('删除申请已提交')).toBeInTheDocument();
    expect(
      controller.requestAccountDeletionRecoverySmsCode,
    ).toHaveBeenCalledTimes(1);
    expect(
      controller.verifyAccountDeletionRecoverySmsCode,
    ).toHaveBeenCalledWith('123456');
    expect(controller.verifySmsCode).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', {name: '主要导航'})).toBeNull();
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
        name: '向原手机号获取验证码',
      }),
    );
    fireEvent.change(await screen.findByLabelText('短信验证码'), {
      target: {value: '123456'},
    });
    fireEvent.click(
      screen.getByRole('button', {name: '验证并继续确认删除'}),
    );

    expect(
      await screen.findByText('现在可以重新验证手机号'),
    ).toBeInTheDocument();
    expect(screen.getByText(/不表示此前删除申请已接收或已经完成/)).toBeInTheDocument();
    expect(screen.queryByText('删除申请已提交')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '返回手机号验证'}));
    expect(await screen.findByLabelText('手机号')).toHaveValue('');
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
      await screen.findByText('重新验证前还要完成本机清理'),
    ).toBeInTheDocument();
    expect(screen.getByText(/不证明此前申请已接收或完成/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '重试本机清理'}));

    expect(
      await screen.findByText('现在可以重新验证手机号'),
    ).toBeInTheDocument();
    expect(resumeAccountDeletion).toHaveBeenCalledTimes(2);
    expect(
      controller.requestAccountDeletionRecoverySmsCode,
    ).not.toHaveBeenCalled();
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
    const controller = createController(snapshot, {
      playCardAudio: vi
        .fn()
        .mockResolvedValueOnce('ready')
        .mockResolvedValueOnce('playing'),
      subscribeAudioStatus: vi.fn(listener => {
        audioListener = listener;
        return () => undefined;
      }),
    });
    await authenticateRemote(controller);

    fireEvent.click(screen.getByRole('button', {name: '准备卡片音频'}));
    fireEvent.click(
      await screen.findByRole('button', {name: '播放已校验音频'}),
    );
    expect(
      await screen.findByRole('button', {name: '暂停卡片音频'}),
    ).toBeInTheDocument();

    act(() => audioListener?.('idle'));
    expect(
      screen.getByRole('button', {name: '准备卡片音频'}),
    ).toBeInTheDocument();
    act(() => audioListener?.('error'));
    expect(
      screen.getByRole('button', {name: '重试卡片音频'}),
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
      expect(screen.getByRole('button', {name: '标记喜欢'})).toBeEnabled();
      expect(
        screen.getByRole('button', {name: '移入盒内休眠区'}),
      ).toBeEnabled();
    },
  );
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
  fireEvent.click(screen.getByRole('button', {name: '验证并继续'}));
  await screen.findByRole('navigation', {name: '主要导航'});
}

function createController(
  snapshot: WebRemoteSnapshot,
  overrides: Partial<WebRemoteRuntimeController> = {},
): WebRemoteRuntimeController {
  return {
    applySpaceState: vi.fn(async () => snapshot),
    checkInToday: vi.fn(async () => snapshot),
    cleanupInvalidatedSession: vi.fn(async () => undefined),
    completeCurrentCard: vi.fn(async () => ({
      pendingEventCount: 0,
      status: 'confirmed' as const,
    })),
    continueServerRound: vi.fn(async () => snapshot),
    isAuthenticated: vi.fn(() => true),
    loadAuthenticatedState: vi.fn(async () => snapshot),
    logout: vi.fn(async () => undefined),
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
      retryAfterSeconds: 0,
    })),
    resumeAccountDeletion: vi.fn(async () => ({status: 'none' as const})),
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
      dayKey: '2026-08-29',
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
          dayKey: '2026-08-29',
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
        snapshot: {dayKey: '2026-08-29', states: []},
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
