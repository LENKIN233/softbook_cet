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

  it('limits free Space to the stable accessible prefix and blocks writes', async () => {
    const snapshot = createSnapshot('free');
    const controller = createController(snapshot);
    await authenticateRemote(controller);
    fireEvent.click(screen.getByRole('button', {name: '空间'}));

    expect(screen.getByRole('button', {name: 'Box 1 1 张'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Box 2 1 张'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Box 3 1 张'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'Box 4 1 张'})).toBeNull();
    expect(screen.getByRole('button', {name: '标记喜欢'})).toBeDisabled();
    expect(
      screen.getByRole('button', {name: '移入盒内休眠区'}),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));
    expect(controller.applySpaceState).not.toHaveBeenCalled();
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
  fireEvent.change(screen.getByLabelText('手机号'), {
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
