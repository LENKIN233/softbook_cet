import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { createAuthRepository } from './src/auth/authRepository';
import { resolveAuthRepositoryConfig } from './src/auth/authRuntimeConfig';
import { LearningSurface } from './src/learning/LearningSurface';
import {
  LearningCard,
  LearningCardResult,
  LearningCardState,
  LearningSession,
  LearningTrack,
} from './src/learning/model';
import {
  createLearningCardState,
  evaluateLearningCard,
  selectReviewCards,
} from './src/learning/session';
import {
  createInitialMembershipState,
  dismissMembershipRecovery,
  expireMembershipTrial,
  expirePremiumMembership,
  MembershipStage,
  MembershipState,
  purchaseMembership,
  resolveAccessibleLearningCardCount,
  resolveMembershipAccess,
  startMembershipTrial,
} from './src/membership/localMembership';
import { createMembershipRepository } from './src/membership/membershipRepository';
import { resolveMembershipRepositoryConfig } from './src/membership/membershipRuntimeConfig';
import { createLearningSessionRepository } from './src/learning/learningRepository';
import { readSoftbookAppRuntimeConfig, resolveLearningSessionRepositoryConfig } from './src/learning/learningRuntimeConfig';
import { SpaceSurface } from './src/space/SpaceSurface';
import { StatisticsSurface } from './src/statistics/StatisticsSurface';
import {
  createDailyProgressSnapshot,
  createProgressSyncRepository,
} from './src/sync/progressSyncRepository';
import { resolveProgressSyncRepositoryConfig } from './src/sync/progressSyncRuntimeConfig';

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type DeviceClass = 'phone' | 'tablet';
type AuthStage = 'logged_out' | 'code_sent' | 'authenticated';
type MembershipGate = 'space' | 'review' | 'library';

type ShellRoute = {
  key: RouteKey;
  label: string;
  badge: string;
  eyebrow: string;
  title: string;
  summary: string;
  highlights: string[];
  focus: string[];
};

type Palette = {
  background: string;
  panel: string;
  panelStrong: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  tabIdle: string;
  success: string;
  danger: string;
};

type AuthState = {
  authToken: string | null;
  stage: AuthStage;
  phoneNumber: string;
  pendingAction: 'request_code' | 'verify_code' | null;
  smsCode: string;
  error: string | null;
};

type ProgressSyncState =
  | {
      detail: string;
      label: string;
      state: 'idle' | 'syncing' | 'synced' | 'error';
    };

type LearningBootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';
type LearningPhase = 'learning' | 'review';

type SpaceCardState = {
  isFavorited: boolean;
  isSleeping: boolean;
};

type AuthHandlers = {
  onChangePhone: (value: string) => void;
  onChangeCode: (value: string) => void;
  onRequestCode: () => void;
  onSubmitCode: () => void;
  onLogout: () => void;
};

type MembershipHandlers = {
  onDismissRecovery: () => void;
  onExpirePremium: () => void;
  onExpireTrial: () => void;
  onPurchase: () => void;
  onStartTrial: () => void;
};

const ROUTES: ShellRoute[] = [
  {
    key: 'learning',
    label: '学习',
    badge: '01',
    eyebrow: '最重要入口',
    title: '单卡学习流',
    summary:
      '当前分支把学习主路径切到异步卡源 bootstrap，先收口学习入口的加载与失败边界。',
    highlights: [
      '一次只推进一张卡，不把学习入口做成按钮堆。',
      '学习卡源改成异步加载，先保住本地 source，再预留远端切换口。',
      'Peek、收藏和提示层保持轻量，不抢主交互。',
    ],
    focus: ['async source bootstrap', 'single-card flow', 'source fallback'],
  },
  {
    key: 'space',
    label: '空间',
    badge: '02',
    eyebrow: '顶层入口',
    title: '知识地图与物理空间',
    summary:
      '当前已经把已接入卡片的 library / group / box / card 层级接进空间入口，先收口知识地图浏览、盒内卡片查看和当前位置可见性。',
    highlights: [
      '能看见当前学习卡在空间中的位置。',
      '能按 library / group / box 层级浏览已接入卡片。',
      '先收口低成本浏览，不开放任意拖拽改盒。',
    ],
    focus: ['sleep zone rules', 'supported position adjustments'],
  },
  {
    key: 'statistics',
    label: '统计',
    badge: '03',
    eyebrow: '服务核心价值',
    title: '轻量统计与签到',
    summary:
      '当前已经把统计入口收成轻量签到与学习摘要，只承接最小必要的连续性反馈，不扩成复杂大盘。',
    highlights: [
      '签到只和真实学习进展挂钩，不做空转打卡。',
      '首轮与回看结果会以低成本摘要方式展示。',
      '页面会跟随设备形态变化，但入口顺序保持一致。',
    ],
    focus: ['defer heavy stats', 'keep confidence and continuity light'],
  },
  {
    key: 'mine',
    label: '我的',
    badge: '04',
    eyebrow: '账户与会员',
    title: '个人页',
    summary:
      '当前已经把“我的”收成个人主页，并接入本地 entitlement 宿主：账号、学习、空间摘要与试用/会员边界都在这里承接。',
    highlights: [
      '已登录后能看到账号、学习、空间与会员摘要。',
      '试用在首个计入入口开始，不在注册时偷跑。',
      '基础学习保留，完整空间、完整卡库和完整算法挂到试用/会员后。',
    ],
    focus: ['profile overview', 'trial/paywall', 'purchase recovery'],
  },
];

const LIGHT_PALETTE: Palette = {
  background: '#F5F1E8',
  panel: '#FFFDF7',
  panelStrong: '#F0E6D3',
  border: '#D5C7B1',
  text: '#1F2421',
  textMuted: '#5F635D',
  accent: '#1E5B67',
  accentSoft: '#D9E9E6',
  accentStrong: '#123F49',
  tabIdle: '#7E766B',
  success: '#2A7D46',
  danger: '#A33C35',
};

const DARK_PALETTE: Palette = {
  background: '#121513',
  panel: '#1B201D',
  panelStrong: '#24312C',
  border: '#324139',
  text: '#F2F1EB',
  textMuted: '#B6BBB3',
  accent: '#8ED0C3',
  accentSoft: '#193C3C',
  accentStrong: '#B9E8DF',
  tabIdle: '#8A9389',
  success: '#7DE5A0',
  danger: '#FF8A7A',
};

const PROTECTED_ROUTES: RouteKey[] = ['learning', 'space', 'statistics'];

const INITIAL_AUTH_STATE: AuthState = {
  authToken: null,
  stage: 'logged_out',
  phoneNumber: '',
  pendingAction: null,
  smsCode: '',
  error: null,
};

const LEARNING_TRACK: LearningTrack = 'cet4';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const runtimeConfig = useMemo(() => readSoftbookAppRuntimeConfig(), []);
  const authRepositoryConfig = useMemo(
    () => resolveAuthRepositoryConfig(runtimeConfig),
    [runtimeConfig],
  );
  const authRepository = useMemo(
    () => createAuthRepository(authRepositoryConfig),
    [authRepositoryConfig],
  );
  const runtimeAuthRepositoryMode = authRepositoryConfig.mode;
  const learningSessionRepositoryConfig = useMemo(
    () => resolveLearningSessionRepositoryConfig(runtimeConfig),
    [runtimeConfig],
  );
  const learningSessionRepository = useMemo(
    () => createLearningSessionRepository(learningSessionRepositoryConfig),
    [learningSessionRepositoryConfig],
  );
  const membershipRepositoryConfig = useMemo(
    () => resolveMembershipRepositoryConfig(runtimeConfig),
    [runtimeConfig],
  );
  const membershipRepository = useMemo(
    () => createMembershipRepository(membershipRepositoryConfig),
    [membershipRepositoryConfig],
  );
  const runtimeMembershipRepositoryMode = membershipRepositoryConfig.mode;
  const progressSyncRepositoryConfig = useMemo(
    () => resolveProgressSyncRepositoryConfig(runtimeConfig),
    [runtimeConfig],
  );
  const progressSyncRepository = useMemo(
    () => createProgressSyncRepository(progressSyncRepositoryConfig),
    [progressSyncRepositoryConfig],
  );
  const runtimeProgressSyncMode = progressSyncRepositoryConfig.mode;
  const [activeRoute, setActiveRoute] = useState<RouteKey>('learning');
  const [authState, setAuthState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const [learningSession, setLearningSession] =
    useState<LearningSession | null>(null);
  const [learningBootstrapStatus, setLearningBootstrapStatus] =
    useState<LearningBootstrapStatus>('idle');
  const [learningBootstrapError, setLearningBootstrapError] = useState<
    string | null
  >(null);
  const [learningIndex, setLearningIndex] = useState(0);
  const [learningCardState, setLearningCardState] =
    useState<LearningCardState | null>(null);
  const [learningCompletedResults, setLearningCompletedResults] = useState<
    LearningCardResult[]
  >([]);
  const [learningCurrentResult, setLearningCurrentResult] =
    useState<LearningCardResult | null>(null);
  const [learningPhase, setLearningPhase] = useState<LearningPhase>('learning');
  const [reviewSessionCards, setReviewSessionCards] = useState<LearningCard[]>([]);
  const [reviewCompletedResults, setReviewCompletedResults] = useState<
    LearningCardResult[]
  >([]);
  const [checkedInDayKey, setCheckedInDayKey] = useState<string | null>(null);
  const [progressSyncState, setProgressSyncState] = useState<ProgressSyncState>({
    detail: '今天还没有需要同步的学习进展。',
    label: '等待今日进展',
    state: 'idle',
  });
  const [lastSyncedProgressKey, setLastSyncedProgressKey] = useState<
    string | null
  >(null);
  const [membershipState, setMembershipState] = useState<MembershipState>(
    createInitialMembershipState,
  );
  const [membershipPendingAction, setMembershipPendingAction] = useState<
    'dismiss_recovery' | 'purchase' | 'start_trial' | null
  >(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [membershipGate, setMembershipGate] = useState<MembershipGate | null>(
    null,
  );
  const [spaceCardStateById, setSpaceCardStateById] = useState<
    Record<string, SpaceCardState>
  >({});
  const previousMembershipStage = useRef<MembershipStage>(membershipState.stage);
  const { width, height } = useWindowDimensions();
  const deviceClass = getDeviceClass(width, height);
  const route = ROUTES.find(item => item.key === activeRoute) ?? ROUTES[0];
  const isAuthenticated = authState.stage === 'authenticated';
  const routeRequiresAuth = PROTECTED_ROUTES.includes(route.key);
  const shouldShowAuthGate = routeRequiresAuth && !isAuthenticated;
  const membershipAccess = resolveMembershipAccess(membershipState);
  const readSpaceCardState = useCallback(
    (
      cardId: string,
      stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    ): SpaceCardState =>
      stateMap[cardId] ?? {isFavorited: false, isSleeping: false},
    [spaceCardStateById],
  );
  const createTrackedLearningCardState = useCallback(
    (
      card: LearningSession['cards'][number],
      stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    ) => ({
      ...createLearningCardState(card),
      isFavorited: readSpaceCardState(card.card_id, stateMap).isFavorited,
      }),
    [readSpaceCardState, spaceCardStateById],
  );
  const resolveVisibleLearningCards = (
    nextSession: LearningSession | null = learningSession,
    stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    nextMembershipState: MembershipState = membershipState,
  ) => {
    const accessibleCardCount = nextSession
      ? resolveAccessibleLearningCardCount(
          nextSession.cards.length,
          nextMembershipState,
        )
      : 0;
    const accessibleCards =
      nextSession?.cards.slice(0, accessibleCardCount) ?? [];

    return accessibleCards.filter(
      card => !readSpaceCardState(card.card_id, stateMap).isSleeping,
    );
  };
  const resolveSleepingAccessibleCards = (
    nextSession: LearningSession | null = learningSession,
    stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    nextMembershipState: MembershipState = membershipState,
  ) => {
    const accessibleCardCount = nextSession
      ? resolveAccessibleLearningCardCount(
          nextSession.cards.length,
          nextMembershipState,
        )
      : 0;
    const accessibleCards =
      nextSession?.cards.slice(0, accessibleCardCount) ?? [];

    return accessibleCards.filter(card =>
      readSpaceCardState(card.card_id, stateMap).isSleeping,
    );
  };
  const visibleLearningCards = resolveVisibleLearningCards();
  const sleepingAccessibleCards = resolveSleepingAccessibleCards();
  const recoverableSleepingCard = sleepingAccessibleCards[0] ?? null;
  const activeSessionCards =
    learningPhase === 'review' ? reviewSessionCards : visibleLearningCards;
  const activeCompletedResults =
    learningPhase === 'review'
      ? reviewCompletedResults
      : learningCompletedResults;
  const currentLearningCard = activeSessionCards[learningIndex] ?? null;
  const reviewCandidateCards = selectReviewCards(
    visibleLearningCards,
    learningCompletedResults,
  );
  const pendingReviewCount = reviewCandidateCards.filter(
    card =>
      !reviewCompletedResults.some(
        result => result.cardId === card.card_id,
      ),
  ).length;
  const todayKey = getTodayKey();
  const hasCheckedInToday = checkedInDayKey === todayKey;
  const canCheckInToday =
    !hasCheckedInToday &&
    learningCompletedResults.length + reviewCompletedResults.length > 0;
  const favoriteCount = Object.values(spaceCardStateById).filter(
    state => state.isFavorited,
  ).length;
  const sleepingCount = Object.values(spaceCardStateById).filter(
    state => state.isSleeping,
  ).length;
  const dailyProgressSnapshot = useMemo(
    () =>
      createDailyProgressSnapshot({
        checkedInToday: hasCheckedInToday,
        dayKey: todayKey,
        favoriteCount,
        learningCompletedCount: learningCompletedResults.length,
        pendingReviewCount,
        reviewCompletedCount: reviewCompletedResults.length,
        sleepingCount,
      }),
    [
      favoriteCount,
      hasCheckedInToday,
      learningCompletedResults.length,
      pendingReviewCount,
      reviewCompletedResults.length,
      sleepingCount,
      todayKey,
    ],
  );
  const dailyProgressKey = JSON.stringify(dailyProgressSnapshot);
  const authenticatedRuntimeContext = useMemo(
    () =>
      authState.stage === 'authenticated'
        ? {
            authToken: authState.authToken ?? undefined,
            phoneNumber: authState.phoneNumber,
          }
        : null,
    [authState.authToken, authState.phoneNumber, authState.stage],
  );

  const resetLearningDeck = (
    stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    nextSession: LearningSession | null = learningSession,
    nextMembershipState: MembershipState = membershipState,
  ) => {
    const nextVisibleCards = resolveVisibleLearningCards(
      nextSession,
      stateMap,
      nextMembershipState,
    );

    setLearningIndex(0);
    setLearningPhase('learning');
    setLearningCurrentResult(null);
    setLearningCompletedResults([]);
    setReviewSessionCards([]);
    setReviewCompletedResults([]);
    setLearningCardState(
      nextVisibleCards[0]
        ? createTrackedLearningCardState(nextVisibleCards[0], stateMap)
        : null,
    );
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLearningSession(null);
      setLearningBootstrapStatus('idle');
      setLearningBootstrapError(null);
      setLearningIndex(0);
      setLearningCurrentResult(null);
      setLearningCompletedResults([]);
      setLearningPhase('learning');
      setReviewSessionCards([]);
      setReviewCompletedResults([]);
      setLearningCardState(null);
      setMembershipError(null);
      setMembershipPendingAction(null);
      setSpaceCardStateById({});
      setCheckedInDayKey(null);
      setLastSyncedProgressKey(null);
      setProgressSyncState({
        detail: '今天还没有需要同步的学习进展。',
        label: '等待今日进展',
        state: 'idle',
      });
      return;
    }

    if (learningBootstrapStatus !== 'idle') {
      return;
    }

    setLearningBootstrapStatus('loading');
    setLearningBootstrapError(null);
  }, [isAuthenticated, learningBootstrapStatus]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (dailyProgressSnapshot.totalCompletedCount === 0) {
      setProgressSyncState({
        detail: '先产生今天的学习进展，再进入日级同步。',
        label: '等待今日进展',
        state: 'idle',
      });
      return;
    }

    if (lastSyncedProgressKey === dailyProgressKey) {
      return;
    }

    if (runtimeProgressSyncMode === 'local') {
      setLastSyncedProgressKey(dailyProgressKey);
      setProgressSyncState({
        detail: '今天的学习进展已在本地记录；远端同步将在配置接通后启用。',
        label: '本地已记录',
        state: 'synced',
      });
      return;
    }

    let isCancelled = false;

    setProgressSyncState({
      detail: `正在同步 ${dailyProgressSnapshot.dayKey} 的日级进展快照。`,
      label: '同步中',
      state: 'syncing',
    });

    if (authenticatedRuntimeContext === null) {
      setProgressSyncState({
        detail: '当前缺少可用的登录上下文，暂时不能同步日级进展。',
        label: '同步失败',
        state: 'error',
      });
      return;
    }

    progressSyncRepository
      .syncDailyProgress(authenticatedRuntimeContext, dailyProgressSnapshot)
      .then(result => {
        if (isCancelled) {
          return;
        }

        setLastSyncedProgressKey(dailyProgressKey);
        setProgressSyncState({
          detail:
            result.mode === 'remote'
              ? '今天的学习进展已推送到远端日级同步端点。'
              : '今天的学习进展已在本地记录；远端同步将在配置接通后启用。',
          label: result.mode === 'remote' ? '远端已同步' : '本地已记录',
          state: 'synced',
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setProgressSyncState({
          detail:
            error instanceof Error
              ? error.message
              : '日级进展同步失败。',
          label: '同步失败',
          state: 'error',
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [
    authenticatedRuntimeContext,
    dailyProgressKey,
    dailyProgressSnapshot,
    isAuthenticated,
    lastSyncedProgressKey,
    progressSyncRepository,
    runtimeProgressSyncMode,
  ]);

  useEffect(() => {
    if (!isAuthenticated || learningBootstrapStatus !== 'loading') {
      return;
    }

    let isCancelled = false;

    if (authenticatedRuntimeContext === null) {
      setLearningSession(null);
      setLearningCardState(null);
      setLearningBootstrapStatus('error');
      setLearningBootstrapError('当前缺少可用的登录上下文，学习卡源无法加载。');
      return;
    }

    learningSessionRepository
      .loadSession(authenticatedRuntimeContext, LEARNING_TRACK)
      .then(session => {
        if (isCancelled) {
          return;
        }

        setLearningSession(session);
        setLearningIndex(0);
        setLearningCurrentResult(null);
        setLearningCompletedResults([]);
        setLearningPhase('learning');
        setReviewSessionCards([]);
        setReviewCompletedResults([]);
        const accessibleCardCount = resolveAccessibleLearningCardCount(
          session.cards.length,
          membershipState,
        );
        const nextVisibleCards = session.cards
          .slice(0, accessibleCardCount)
          .filter(card => !readSpaceCardState(card.card_id).isSleeping);
        setLearningCardState(
          nextVisibleCards[0]
            ? createTrackedLearningCardState(nextVisibleCards[0])
            : null,
        );
        setLearningBootstrapStatus('ready');
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setLearningSession(null);
        setLearningCardState(null);
        setLearningBootstrapStatus('error');
        setLearningBootstrapError(
          error instanceof Error ? error.message : '学习卡源加载失败。',
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [
    createTrackedLearningCardState,
    authenticatedRuntimeContext,
    isAuthenticated,
    learningBootstrapStatus,
    learningSessionRepository,
    membershipState,
    readSpaceCardState,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      learningBootstrapStatus !== 'ready' ||
      learningSession === null
    ) {
      return;
    }

    if (previousMembershipStage.current === membershipState.stage) {
      return;
    }

    previousMembershipStage.current = membershipState.stage;
    const accessibleCardCount = resolveAccessibleLearningCardCount(
      learningSession.cards.length,
      membershipState,
    );
    const nextVisibleCards = learningSession.cards
      .slice(0, accessibleCardCount)
      .filter(card => !readSpaceCardState(card.card_id, spaceCardStateById).isSleeping);

    setLearningIndex(0);
    setLearningPhase('learning');
    setLearningCurrentResult(null);
    setLearningCompletedResults([]);
    setReviewSessionCards([]);
    setReviewCompletedResults([]);
    setLearningCardState(
      nextVisibleCards[0]
        ? createTrackedLearningCardState(nextVisibleCards[0], spaceCardStateById)
        : null,
    );
  }, [
    createTrackedLearningCardState,
    isAuthenticated,
    learningBootstrapStatus,
    learningSession,
    membershipState,
    readSpaceCardState,
    spaceCardStateById,
  ]);

  const patchLearningCardState = (
    updater: (state: LearningCardState) => LearningCardState,
  ) => {
    if (currentLearningCard === null || learningCurrentResult !== null) {
      return;
    }

    setLearningCardState(current => {
      if (current === null) {
        return current;
      }

      return updater(current);
    });
  };

  const completeMembershipUnlock = (nextState: MembershipState) => {
    const nextGate = membershipGate;

    setMembershipState(nextState);
    setMembershipGate(null);

    if (nextGate === 'review') {
      startTransition(() => {
        setActiveRoute('learning');
      });
    }
  };

  const authHandlers: AuthHandlers = {
    onChangePhone: value => {
      setAuthState(current => ({
        ...current,
        phoneNumber: value.replace(/[^\d]/g, '').slice(0, 11),
        error: null,
      }));
    },
    onChangeCode: value => {
      setAuthState(current => ({
        ...current,
        smsCode: value.replace(/[^\d]/g, '').slice(0, 6),
        error: null,
      }));
    },
    onRequestCode: () => {
      if (authState.pendingAction !== null) {
        return;
      }

      if (authState.phoneNumber.length !== 11) {
        setAuthState(current => ({
          ...current,
          error: '请输入 11 位手机号后再请求验证码。',
        }));
        return;
      }

      const phoneNumber = authState.phoneNumber;
      setAuthState(current => ({
        ...current,
        error: null,
        pendingAction: 'request_code',
      }));

      authRepository
        .requestSmsCode(phoneNumber)
        .then(() => {
          setAuthState(current => ({
            ...current,
            error: null,
            pendingAction: null,
            smsCode: '',
            stage: 'code_sent',
          }));
        })
        .catch((error: unknown) => {
          setAuthState(current => ({
            ...current,
            error:
              error instanceof Error ? error.message : '验证码请求暂时失败。',
            pendingAction: null,
          }));
        });
    },
    onSubmitCode: () => {
      if (authState.pendingAction !== null) {
        return;
      }

      if (authState.stage !== 'code_sent') {
        setAuthState(current => ({
          ...current,
          error: '请先请求验证码。',
        }));
        return;
      }

      if (authState.smsCode.length < 4) {
        setAuthState(current => ({
          ...current,
          error: '请输入 4-6 位验证码。',
        }));
        return;
      }

      const phoneNumber = authState.phoneNumber;
      const smsCode = authState.smsCode;
      setAuthState(current => ({
        ...current,
        error: null,
        pendingAction: 'verify_code',
      }));
      setMembershipError(null);
      setMembershipPendingAction(null);

      authRepository
        .verifySmsCode({
          phoneNumber,
          smsCode,
        })
        .then(session =>
          membershipRepository
            .loadState({
              authToken: session.authToken,
              phoneNumber: session.phoneNumber,
            })
            .then(nextMembershipState => ({
              membershipState: nextMembershipState,
              session,
            })),
        )
        .then(({membershipState: nextMembershipState, session}) => {
          setMembershipState(nextMembershipState);
          setMembershipGate(null);
          setAuthState(current => ({
            ...current,
            authToken: session.authToken ?? null,
            error: null,
            pendingAction: null,
            phoneNumber: session.phoneNumber,
            smsCode: '',
            stage: 'authenticated',
          }));
        })
        .catch((error: unknown) => {
          setAuthState(current => ({
            ...current,
            error: error instanceof Error ? error.message : '登录暂时失败。',
            pendingAction: null,
          }));
        });
    },
    onLogout: () => {
      setAuthState(INITIAL_AUTH_STATE);
      setLearningPhase('learning');
      setReviewSessionCards([]);
      setReviewCompletedResults([]);
      setMembershipError(null);
      setMembershipPendingAction(null);
      setMembershipGate(null);
      setMembershipState(createInitialMembershipState());
      setSpaceCardStateById({});
      setCheckedInDayKey(null);
      setLastSyncedProgressKey(null);
      setProgressSyncState({
        detail: '今天还没有需要同步的学习进展。',
        label: '等待今日进展',
        state: 'idle',
      });
      startTransition(() => {
        setActiveRoute('mine');
      });
    },
  };

  const membershipHandlers: MembershipHandlers = {
    onStartTrial: () => {
      if (
        authenticatedRuntimeContext === null ||
        membershipPendingAction !== null
      ) {
        return;
      }

      setMembershipError(null);
      if (runtimeMembershipRepositoryMode === 'local') {
        completeMembershipUnlock(startMembershipTrial(membershipState));
        return;
      }

      setMembershipPendingAction('start_trial');
      membershipRepository
        .startTrial(authenticatedRuntimeContext, membershipState)
        .then(result => {
          setMembershipPendingAction(null);
          completeMembershipUnlock(result.state);
        })
        .catch((error: unknown) => {
          setMembershipError(
            error instanceof Error ? error.message : '试用开通暂时失败。',
          );
          setMembershipPendingAction(null);
        });
    },
    onPurchase: () => {
      if (
        authenticatedRuntimeContext === null ||
        membershipPendingAction !== null
      ) {
        return;
      }

      setMembershipError(null);
      if (runtimeMembershipRepositoryMode === 'local') {
        completeMembershipUnlock(purchaseMembership(membershipState));
        return;
      }

      setMembershipPendingAction('purchase');
      membershipRepository
        .purchase(authenticatedRuntimeContext, membershipState)
        .then(result => {
          setMembershipPendingAction(null);
          completeMembershipUnlock(result.state);
        })
        .catch((error: unknown) => {
          setMembershipError(
            error instanceof Error ? error.message : '会员开通暂时失败。',
          );
          setMembershipPendingAction(null);
        });
    },
    onExpireTrial: () => {
      if (runtimeMembershipRepositoryMode !== 'local') {
        return;
      }

      setMembershipError(null);
      setMembershipState(current => expireMembershipTrial(current));
    },
    onExpirePremium: () => {
      if (runtimeMembershipRepositoryMode !== 'local') {
        return;
      }

      setMembershipError(null);
      setMembershipState(current => expirePremiumMembership(current));
    },
    onDismissRecovery: () => {
      if (
        authenticatedRuntimeContext === null ||
        membershipPendingAction !== null
      ) {
        return;
      }

      setMembershipError(null);
      if (runtimeMembershipRepositoryMode === 'local') {
        setMembershipState(current => dismissMembershipRecovery(current));
        return;
      }

      setMembershipPendingAction('dismiss_recovery');
      membershipRepository
        .dismissRecovery(authenticatedRuntimeContext, membershipState)
        .then(result => {
          setMembershipError(null);
          setMembershipPendingAction(null);
          setMembershipState(result.state);
        })
        .catch((error: unknown) => {
          setMembershipError(
            error instanceof Error ? error.message : '恢复购买提醒暂时无法更新。',
          );
          setMembershipPendingAction(null);
        });
    },
  };

  const learningHandlers = {
    onTogglePeek: () => {
      patchLearningCardState(current => ({
        ...current,
        isPeeked: !current.isPeeked,
      }));
    },
    onToggleFavorite: () => {
      if (currentLearningCard === null || learningCardState === null) {
        return;
      }

      const nextFavorited = !learningCardState.isFavorited;

      setLearningCardState({
        ...learningCardState,
        isFavorited: nextFavorited,
      });
      setSpaceCardStateById(current => ({
        ...current,
        [currentLearningCard.card_id]: {
          ...readSpaceCardState(currentLearningCard.card_id, current),
          isFavorited: nextFavorited,
        },
      }));
    },
    onToggleHint: () => {
      patchLearningCardState(current => ({
        ...current,
        isHintVisible: !current.isHintVisible,
      }));
    },
    onFlip: () => {
      patchLearningCardState(current => ({
        ...current,
        isFlipped: true,
      }));
    },
    onSetFlipConfidence: (value: 'confident' | 'review') => {
      if (currentLearningCard === null || learningCardState === null) {
        return;
      }

      const nextState = {
        ...learningCardState,
        isFlipped: true,
        flipConfidence: value,
      };

      setLearningCardState(nextState);
      setLearningCurrentResult(
        evaluateLearningCard(currentLearningCard, nextState),
      );
    },
    onSelectOption: (optionId: string) => {
      patchLearningCardState(current => ({
        ...current,
        selectedOptionId: optionId,
      }));
    },
    onSetLockSelection: (slotId: string, value: string) => {
      patchLearningCardState(current => ({
        ...current,
        lockSelections: {
          ...current.lockSelections,
          [slotId]: value,
        },
      }));
    },
    onToggleEliminationItem: (itemId: string) => {
      patchLearningCardState(current => ({
        ...current,
        eliminatedItemIds: current.eliminatedItemIds.includes(itemId)
          ? current.eliminatedItemIds.filter(currentId => currentId !== itemId)
          : [...current.eliminatedItemIds, itemId],
      }));
    },
    onSelectSwipeState: (stateId: string) => {
      patchLearningCardState(current => ({
        ...current,
        swipeSelection: stateId,
      }));
    },
    onSubmitCurrentCard: () => {
      if (currentLearningCard === null || learningCardState === null) {
        return;
      }

      setLearningCurrentResult(
        evaluateLearningCard(currentLearningCard, learningCardState),
      );
    },
    onAdvanceCard: () => {
      if (learningCurrentResult === null) {
        return;
      }

      const nextResults = [...activeCompletedResults, learningCurrentResult];
      const nextIndex = learningIndex + 1;

      if (learningPhase === 'review') {
        setReviewCompletedResults(nextResults);
      } else {
        setLearningCompletedResults(nextResults);
      }
      setLearningCurrentResult(null);

      if (nextIndex >= activeSessionCards.length) {
        setLearningIndex(nextIndex);
        setLearningCardState(null);
        return;
      }

      const nextCard = activeSessionCards[nextIndex];
      setLearningIndex(nextIndex);
      setLearningCardState(createTrackedLearningCardState(nextCard));
    },
    onStartReview: () => {
      if (reviewCandidateCards.length === 0) {
        return;
      }

      if (!membershipAccess.completeAlgorithm) {
        setMembershipGate('review');
        startTransition(() => {
          setActiveRoute('mine');
        });
        return;
      }

      setLearningPhase('review');
      setReviewSessionCards(reviewCandidateCards);
      setReviewCompletedResults([]);
      setLearningIndex(0);
      setLearningCurrentResult(null);
      setLearningCardState(createTrackedLearningCardState(reviewCandidateCards[0]));
    },
    onRestartDeck: resetLearningDeck,
  };

  const spaceHandlers = {
    onToggleFavoriteTag: (cardId: string) => {
      const currentState = readSpaceCardState(cardId);
      const nextFavorited = !currentState.isFavorited;

      setSpaceCardStateById(current => ({
        ...current,
        [cardId]: {
          ...readSpaceCardState(cardId, current),
          isFavorited: nextFavorited,
        },
      }));

      if (currentLearningCard?.card_id === cardId && learningCardState !== null) {
        setLearningCardState({
          ...learningCardState,
          isFavorited: nextFavorited,
        });
      }
    },
    onToggleSleepState: (cardId: string) => {
      const currentState = readSpaceCardState(cardId);
      const nextStateMap = {
        ...spaceCardStateById,
        [cardId]: {
          ...currentState,
          isSleeping: !currentState.isSleeping,
        },
      };

      setSpaceCardStateById(nextStateMap);
      resetLearningDeck(nextStateMap);
    },
  };

  const statisticsHandlers = {
    onCheckIn: () => {
      if (!canCheckInToday) {
        return;
      }

      setCheckedInDayKey(todayKey);
    },
  };

  const content = shouldShowAuthGate ? (
    <AuthGate
      authRepositoryMode={runtimeAuthRepositoryMode}
      authState={authState}
      handlers={authHandlers}
      palette={palette}
      route={route}
    />
  ) : route.key === 'mine' ? (
    <MineSurface
      authRepositoryMode={runtimeAuthRepositoryMode}
      authState={authState}
      checkedInDayKey={checkedInDayKey}
      favoriteCount={favoriteCount}
      handlers={authHandlers}
      learningResults={learningCompletedResults}
      membershipError={membershipError}
      membershipGate={membershipGate}
      membershipHandlers={membershipHandlers}
      membershipPendingAction={membershipPendingAction}
      membershipRepositoryMode={runtimeMembershipRepositoryMode}
      membershipState={membershipState}
      palette={palette}
      progressSyncState={progressSyncState}
      reviewResults={reviewCompletedResults}
      route={route}
      sleepingCount={sleepingCount}
    />
  ) : route.key === 'space' && !membershipAccess.completePhysicalSpace ? (
    <MembershipPaywallSurface
      gate="space"
      handlers={membershipHandlers}
      membershipError={membershipError}
      membershipPendingAction={membershipPendingAction}
      membershipRepositoryMode={runtimeMembershipRepositoryMode}
      membershipState={membershipState}
      palette={palette}
    />
  ) : route.key === 'learning' && learningBootstrapStatus !== 'ready' ? (
    <LearningBootstrapSurface
      error={
        learningBootstrapStatus === 'error' ? learningBootstrapError : null
      }
      onRetry={() => {
        setLearningBootstrapStatus('idle');
        setLearningBootstrapError(null);
      }}
      palette={palette}
      status={learningBootstrapStatus}
    />
  ) : route.key === 'learning' &&
    learningPhase === 'learning' &&
    visibleLearningCards.length === 0 ? (
    <LearningSleepSurface
      canOpenSpace={membershipAccess.completePhysicalSpace}
      onGoToSpace={() => {
        startTransition(() => {
          setActiveRoute('space');
        });
      }}
      onRecoverCard={
        recoverableSleepingCard
          ? () => {
              spaceHandlers.onToggleSleepState(recoverableSleepingCard.card_id);
            }
          : null
      }
      palette={palette}
      recoverableCard={recoverableSleepingCard}
    />
  ) : route.key === 'learning' ? (
    <LearningSurface
      completedResults={activeCompletedResults}
      currentCard={currentLearningCard}
      currentCardState={learningCardState}
      currentIndex={learningIndex}
      currentResult={learningCurrentResult}
      phase={learningPhase}
      onAdvanceCard={learningHandlers.onAdvanceCard}
      onFlip={learningHandlers.onFlip}
      onRestartDeck={learningHandlers.onRestartDeck}
      onStartReview={learningHandlers.onStartReview}
      onSelectOption={learningHandlers.onSelectOption}
      onSelectSwipeState={learningHandlers.onSelectSwipeState}
      onSetFlipConfidence={learningHandlers.onSetFlipConfidence}
      onSetLockSelection={learningHandlers.onSetLockSelection}
      onSubmitCurrentCard={learningHandlers.onSubmitCurrentCard}
      onToggleEliminationItem={learningHandlers.onToggleEliminationItem}
      onToggleFavorite={learningHandlers.onToggleFavorite}
      onToggleHint={learningHandlers.onToggleHint}
      onTogglePeek={learningHandlers.onTogglePeek}
      palette={palette}
      reviewCandidateCount={reviewCandidateCards.length}
      sessionCards={activeSessionCards}
      sessionLabel={
        learningPhase === 'review'
          ? '首轮回看队列'
          : learningSession?.sourceLabel ?? '学习卡源'
      }
    />
  ) : route.key === 'space' ? (
    <SpaceSurface
      cardStateById={spaceCardStateById}
      currentLearningCard={currentLearningCard}
      deviceClass={deviceClass}
      onToggleFavoriteTag={spaceHandlers.onToggleFavoriteTag}
      onToggleSleepState={spaceHandlers.onToggleSleepState}
      palette={palette}
    />
  ) : route.key === 'statistics' ? (
    <StatisticsSurface
      canCheckInToday={canCheckInToday}
      dayLabel={todayKey}
      deviceClass={deviceClass}
      hasCheckedInToday={hasCheckedInToday}
      learningResults={learningCompletedResults}
      onCheckIn={statisticsHandlers.onCheckIn}
      palette={palette}
      pendingReviewCount={pendingReviewCount}
      reviewResults={reviewCompletedResults}
      syncStatusDetail={progressSyncState.detail}
      syncStatusLabel={progressSyncState.label}
    />
  ) : (
    <RouteCanvas palette={palette} route={route} deviceClass={deviceClass} />
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {deviceClass === 'tablet' ? (
        <TabletShell
          activeRoute={activeRoute}
          authState={authState}
          content={content}
          onSelectRoute={setActiveRoute}
          palette={palette}
          route={route}
        />
      ) : (
        <PhoneShell
          activeRoute={activeRoute}
          authState={authState}
          content={content}
          onSelectRoute={setActiveRoute}
          palette={palette}
          route={route}
        />
      )}
    </SafeAreaView>
  );
}

function LearningBootstrapSurface({
  error,
  onRetry,
  palette,
  status,
}: {
  error: string | null;
  onRetry: () => void;
  palette: Palette;
  status: LearningBootstrapStatus;
}) {
  const isLoading = status === 'idle' || status === 'loading';

  return (
    <ScrollView contentContainerStyle={styles.canvasContent}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          SOURCE BOOTSTRAP
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {isLoading ? '正在接学习卡源' : '学习卡源暂时不可用'}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {isLoading
            ? '当前先完成异步卡源 bootstrap。学习入口仍是一张张推进，只是先把卡源加载边界收口。'
            : '学习入口已经登录，但这次没能拿到可用卡源。先留在学习模块内重试，不把错误扩散到交互层。'}
        </Text>
      </View>
      <InfoCard
        palette={palette}
        title={isLoading ? '当前在做什么' : '这一步拦住了什么'}
        items={
          isLoading
            ? [
                '先加载学习 session，再进入单卡流。',
                '本地 source 仍可作为当前默认实现。',
                '远端 source 后续只替换 repository，不重写学习页面。',
              ]
            : [
                error ?? '学习卡源加载失败。',
                '错误还停留在 source bootstrap，没有进入答题状态。',
                '重试后会重新发起本轮学习 session 加载。',
              ]
        }
      />
      {!isLoading ? (
        <Pressable
          onPress={onRetry}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID="learning-bootstrap-retry-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            重新加载学习卡源
          </Text>
        </Pressable>
      ) : (
        <View
          style={[
            styles.infoCard,
            { backgroundColor: palette.panel, borderColor: palette.border },
          ]}
          testID="learning-bootstrap-loading"
        >
          <Text style={[styles.infoTitle, { color: palette.text }]}>
            加载中
          </Text>
          <Text style={[styles.authSummary, { color: palette.textMuted }]}>
            卡源加载完成后才会进入单卡流。
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function LearningSleepSurface({
  canOpenSpace,
  onGoToSpace,
  onRecoverCard,
  palette,
  recoverableCard,
}: {
  canOpenSpace: boolean;
  onGoToSpace: () => void;
  onRecoverCard: (() => void) | null;
  palette: Palette;
  recoverableCard: LearningCard | null;
}) {
  const canRecoverInPlace = !canOpenSpace && recoverableCard !== null;

  return (
    <ScrollView contentContainerStyle={styles.canvasContent}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          SLEEP ZONE
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          当前学习卡都已进入休眠区
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {canRecoverInPlace
            ? '当前免费态还不能进入完整空间，但为了保留基础学习，可以先把一张可学习卡移出休眠区，再继续当前学习。'
            : '根据空间规则，进入休眠区的卡不会继续出现在学习流里。先去空间里把需要恢复的卡移出休眠区，再继续当前学习。'}
        </Text>
      </View>
      <InfoCard
        palette={palette}
        title="这一步为什么拦住学习流"
        items={
          canRecoverInPlace
            ? [
                '休眠是 remove-from-flow 行为，不是普通标签。',
                '免费态仍需保留基础学习，所以这里提供一条窄恢复口，不直接放开完整空间。',
                recoverableCard
                  ? `下一张可恢复卡：${recoverableCard.front.prompt}`
                  : '当前没有可恢复卡。',
              ]
            : [
                '休眠是 remove-from-flow 行为，不是普通标签。',
                '当前实现会立刻把休眠卡移出当前学习集合。',
                '恢复后再回学习入口，就能重新进入学习流。',
              ]
        }
      />
      {canRecoverInPlace ? (
        <Pressable
          onPress={onRecoverCard}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID="learning-recover-sleeping-card-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            恢复一张可学习卡
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onGoToSpace}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID="learning-go-space-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            去空间管理休眠卡
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function PhoneShell({
  activeRoute,
  authState,
  content,
  onSelectRoute,
  palette,
  route,
}: {
  activeRoute: RouteKey;
  authState: AuthState;
  content: React.ReactNode;
  onSelectRoute: (route: RouteKey) => void;
  palette: Palette;
  route: ShellRoute;
}) {
  return (
    <View style={styles.shellRoot}>
      <ShellHeader
        authState={authState}
        palette={palette}
        route={route}
        deviceClass="phone"
      />
      {content}
      <View
        style={[
          styles.phoneTabBar,
          { backgroundColor: palette.panel, borderTopColor: palette.border },
        ]}
      >
        {ROUTES.map(item => {
          const isActive = item.key === activeRoute;

          return (
            <Pressable
              accessibilityRole="button"
              key={item.key}
              onPress={() => {
                startTransition(() => onSelectRoute(item.key));
              }}
              style={styles.phoneTabButton}
              testID={`route-tab-${item.key}`}
            >
              <Text
                style={[
                  styles.phoneTabBadge,
                  {
                    color: isActive ? palette.accentStrong : palette.tabIdle,
                  },
                ]}
              >
                {item.badge}
              </Text>
              <Text
                style={[
                  styles.phoneTabLabel,
                  { color: isActive ? palette.text : palette.tabIdle },
                ]}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.phoneTabIndicator,
                  isActive
                    ? { backgroundColor: palette.accent }
                    : styles.phoneTabIndicatorHidden,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabletShell({
  activeRoute,
  authState,
  content,
  onSelectRoute,
  palette,
  route,
}: {
  activeRoute: RouteKey;
  authState: AuthState;
  content: React.ReactNode;
  onSelectRoute: (route: RouteKey) => void;
  palette: Palette;
  route: ShellRoute;
}) {
  return (
    <View style={styles.tabletRoot}>
      <View
        style={[
          styles.sidebar,
          { backgroundColor: palette.panel, borderRightColor: palette.border },
        ]}
      >
        <Text style={[styles.brandEyebrow, { color: palette.accent }]}>
          LEARNING / SHELL
        </Text>
        <Text style={[styles.brandTitle, { color: palette.text }]}>
          软书四六级
        </Text>
        <Text style={[styles.brandSummary, { color: palette.textMuted }]}>
          当前分支把已登录后的单卡学习流接进 iOS
          壳层，空间、统计和“我的”先保持边界清楚。
        </Text>
        <AuthStatusBadge authState={authState} palette={palette} />
        <View style={styles.sidebarNav}>
          {ROUTES.map(item => {
            const isActive = item.key === activeRoute;

            return (
              <Pressable
                accessibilityRole="button"
                key={item.key}
                onPress={() => {
                  startTransition(() => onSelectRoute(item.key));
                }}
                style={[
                  styles.sidebarItem,
                  {
                    backgroundColor: isActive
                      ? palette.accentSoft
                      : palette.panelStrong,
                    borderColor: isActive ? palette.accent : palette.border,
                  },
                ]}
                testID={`route-sidebar-${item.key}`}
              >
                <Text
                  style={[
                    styles.sidebarBadge,
                    {
                      color: isActive ? palette.accentStrong : palette.tabIdle,
                    },
                  ]}
                >
                  {item.badge}
                </Text>
                <View style={styles.sidebarCopy}>
                  <Text
                    style={[
                      styles.sidebarLabel,
                      { color: isActive ? palette.text : palette.textMuted },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[styles.sidebarEyebrow, { color: palette.tabIdle }]}
                  >
                    {item.eyebrow}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.tabletContent}>
        <ShellHeader
          authState={authState}
          palette={palette}
          route={route}
          deviceClass="tablet"
        />
        {content}
      </View>
    </View>
  );
}

function ShellHeader({
  authState,
  palette,
  route,
  deviceClass,
}: {
  authState: AuthState;
  palette: Palette;
  route: ShellRoute;
  deviceClass: DeviceClass;
}) {
  const authText =
    authState.stage === 'authenticated'
      ? `已登录 ${maskPhoneNumber(authState.phoneNumber)}`
      : '未登录';

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: palette.panel,
          borderBottomColor: palette.border,
        },
      ]}
    >
      <View style={styles.headerCopy}>
        <Text style={[styles.headerEyebrow, { color: palette.accent }]}>
          {route.eyebrow}
        </Text>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          {route.label}
        </Text>
        <Text style={[styles.headerSummary, { color: palette.textMuted }]}>
          {route.key === 'learning'
            ? deviceClass === 'phone'
              ? 'iPhone 上直接进入单卡学习流，底部导航只负责模块切换，不把主学习动作拆散。'
              : 'iPad 侧边导航保留顶层顺序一致，右侧内容区承接更完整的单卡学习画布。'
            : deviceClass === 'phone'
            ? 'iPhone 使用底部导航，登录门禁仍先挂在学习、空间和统计入口前。'
            : 'iPad 使用侧边导航，保留顶层顺序一致，同时用更宽内容区承接登录与业务入口。'}
        </Text>
      </View>
      <View style={styles.headerMeta}>
        <View
          style={[
            styles.headerPill,
            {
              backgroundColor: palette.accentSoft,
              borderColor: palette.border,
            },
          ]}
        >
          <Text
            style={[styles.headerPillText, { color: palette.accentStrong }]}
          >
            {route.badge}
          </Text>
        </View>
        <Text style={[styles.headerAuthText, { color: palette.textMuted }]}>
          {authText}
        </Text>
      </View>
    </View>
  );
}

function AuthStatusBadge({
  authState,
  palette,
}: {
  authState: AuthState;
  palette: Palette;
}) {
  const isAuthenticated = authState.stage === 'authenticated';

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: isAuthenticated
            ? palette.accentSoft
            : palette.panelStrong,
          borderColor: palette.border,
        },
      ]}
    >
      <Text
        style={[
          styles.statusBadgeLabel,
          { color: isAuthenticated ? palette.success : palette.textMuted },
        ]}
      >
        {isAuthenticated ? '身份已确认' : '等待登录'}
      </Text>
      <Text style={[styles.statusBadgeValue, { color: palette.text }]}>
        {isAuthenticated
          ? maskPhoneNumber(authState.phoneNumber)
          : '手机号验证码'}
      </Text>
    </View>
  );
}

function AuthGate({
  authRepositoryMode,
  authState,
  handlers,
  palette,
  route,
}: {
  authRepositoryMode: 'local' | 'remote';
  authState: AuthState;
  handlers: AuthHandlers;
  palette: Palette;
  route: ShellRoute;
}) {
  return (
    <ScrollView contentContainerStyle={styles.canvasContent}>
      <View
        style={[
          styles.hero,
          styles.authHero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          AUTH GATE
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {route.key === 'learning'
            ? '学习前先登录'
            : `进入${route.label}前先确认身份`}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          根据认证合同，游客不能开始学习；当前壳层同时把空间与统计一起挂在登录态之后，避免无身份状态下承接个人连续性数据。
        </Text>
      </View>
      <PhoneSmsPanel
        authRepositoryMode={authRepositoryMode}
        authState={authState}
        handlers={handlers}
        palette={palette}
        title="手机号验证码登录"
        summary={
          authRepositoryMode === 'remote'
            ? '先把主登录方式接进 runtime 仓储。当前认证已切到远端短信合同；会员和同步继续按各自 runtime 配置运行。'
            : '先把主登录方式接进 runtime 仓储。当前仍走本地安全模式，但认证、entitlement 和同步都已经预留远端接线位。'
        }
      />
      <InfoCard
        palette={palette}
        title="当前门禁只落实什么"
        items={[
          '学习开始前必须登录。',
          '手机号验证码是主登录方式。',
          '试用不会在注册时偷跑，而是在首个计入入口开始。',
        ]}
      />
    </ScrollView>
  );
}

function MineSurface({
  authRepositoryMode,
  authState,
  checkedInDayKey,
  favoriteCount,
  handlers,
  learningResults,
  membershipError,
  membershipGate,
  membershipHandlers,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
  progressSyncState,
  reviewResults,
  route,
  sleepingCount,
}: {
  authRepositoryMode: 'local' | 'remote';
  authState: AuthState;
  checkedInDayKey: string | null;
  favoriteCount: number;
  handlers: AuthHandlers;
  learningResults: LearningCardResult[];
  membershipError: string | null;
  membershipGate: MembershipGate | null;
  membershipHandlers: MembershipHandlers;
  membershipPendingAction: 'dismiss_recovery' | 'purchase' | 'start_trial' | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  palette: Palette;
  progressSyncState: ProgressSyncState;
  reviewResults: LearningCardResult[];
  route: ShellRoute;
  sleepingCount: number;
}) {
  const isAuthenticated = authState.stage === 'authenticated';
  const completedCount = learningResults.length + reviewResults.length;
  const todayKey = getTodayKey();
  const checkedInToday = checkedInDayKey === todayKey;

  return (
    <ScrollView contentContainerStyle={styles.canvasContent}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          PROFILE PAGE
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {isAuthenticated ? '个人主页已经接进当前模块' : '从“我的”建立个人主页入口'}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {isAuthenticated
            ? '当前这里先承接账号概览、学习摘要、日级同步状态与空间摘要，同时把会员与购买边界落到同一宿主页。'
            : '“我的”作为个人主页入口，当前先支持身份建立；会员、试用与购买恢复留在这个宿主页继续承接。'}
        </Text>
      </View>
      <PhoneSmsPanel
        authRepositoryMode={authRepositoryMode}
        authState={authState}
        handlers={handlers}
        palette={palette}
        title={isAuthenticated ? '当前登录状态' : '手机号验证码登录'}
        summary={
          isAuthenticated
            ? authRepositoryMode === 'remote'
              ? '当前登录态已经过远端短信验证；学习、会员与同步会继续按各自 runtime 合同接线。'
              : '当前是本地 profile 登录态：你能看到基础账号信息、学习摘要、同步状态，以及本地 entitlement 宿主。'
            : '先从这里完成身份建立，再让学习流和用户态页面具备真实入口。'
        }
      />

      <View style={styles.sectionGrid}>
        <InfoCard
          palette={palette}
          title="账号概览"
          items={
            isAuthenticated
              ? [
                  `手机号：${maskPhoneNumber(authState.phoneNumber)}`,
                  `今日签到：${checkedInToday ? '已完成' : '尚未完成'}`,
                  `日级同步：${progressSyncState.label}`,
                  authRepositoryMode === 'remote'
                    ? '当前账号态已经通过远端认证合同建立；跨端 entitlement 仍按当前会员 runtime 模式加载。'
                    : '当前仍是本地账号态，不代表真实跨端 entitlement 已接通。',
                ]
              : [
                  '还没有完成身份建立。',
                  '手机号验证码仍是主登录方式。',
                  '登录后这里会显示你的账号、学习与会员摘要。',
                ]
          }
        />
        <InfoCard
          palette={palette}
          title="个人学习摘要"
          items={
            isAuthenticated
              ? [
                  `今日已完成 ${completedCount} 张卡，其中首轮 ${learningResults.length} 张、回看 ${reviewResults.length} 张。`,
                  `当前待回看 ${Math.max(learningResults.filter(result => result.outcome === 'incorrect' || result.outcome === 'review').length - reviewResults.length, 0)} 张。`,
                  `同步说明：${progressSyncState.detail}`,
                  '这里先保留低成本摘要，不扩成重统计中心。',
                ]
              : [
                  '未登录时不承接个人学习连续性。',
                  '完成登录后，学习摘要会回到这里。',
                  '统计页仍负责更明确的签到与轻量进展反馈。',
                ]
          }
        />
        <InfoCard
          palette={palette}
          title="空间标签摘要"
          items={
            isAuthenticated
              ? [
                  `收藏标签 ${favoriteCount} 张。`,
                  `休眠区 ${sleepingCount} 张。`,
                  'favorite 和 sleep 当前仍是本地状态承接，不是最终同步合同。',
                ]
              : [
                  '登录后才能承接个人空间摘要。',
                  '空间入口仍保持独立顶层导航。',
                  '这里不会把 favorite 或 sleep 改写成账号合同。',
                ]
          }
        />
        <InfoCard
          palette={palette}
          title="当前不做什么"
          items={[
            '不在这里接真实购买、恢复购买或跨端 entitlement。',
            '不在这里把会员壳层伪装成已接服务端事实。',
            '不把“我的”扩成设置中心或复杂账户系统。',
          ]}
        />
      </View>

      {isAuthenticated ? (
        <MembershipHostCard
          focusGate={membershipGate}
          handlers={membershipHandlers}
          membershipError={membershipError}
          membershipPendingAction={membershipPendingAction}
          membershipRepositoryMode={membershipRepositoryMode}
          membershipState={membershipState}
          palette={palette}
        />
      ) : (
        <RouteCanvas palette={palette} route={route} deviceClass="phone" />
      )}
    </ScrollView>
  );
}

function MembershipHostCard({
  focusGate,
  handlers,
  membershipError,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
}: {
  focusGate: MembershipGate | null;
  handlers: MembershipHandlers;
  membershipError: string | null;
  membershipPendingAction: 'dismiss_recovery' | 'purchase' | 'start_trial' | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  palette: Palette;
}) {
  const access = resolveMembershipAccess(membershipState);
  const accessSummary = [
    `基础学习：${access.basicLearning ? '已开放' : '未开放'}`,
    `完整卡库：${access.completeCardLibrary ? '已开放' : '需试用或会员'}`,
    `完整空间：${access.completePhysicalSpace ? '已开放' : '需试用或会员'}`,
    `完整算法：${access.completeAlgorithm ? '已开放' : '需试用或会员'}`,
  ];
  const focusCopy =
    focusGate === null
      ? null
      : focusGate === 'review'
      ? '完整回看算法当前被会员矩阵拦住。开始试用或升级后，会回到学习流继续这轮回看。'
      : focusGate === 'space'
      ? '完整物理空间当前被会员矩阵拦住。开始试用或升级后，会直接放开空间入口。'
      : '完整卡库当前被会员矩阵拦住。开始试用或升级后，会放开完整卡源。';

  return (
    <View
      style={[
        styles.infoCard,
        { backgroundColor: palette.panel, borderColor: palette.border },
      ]}
      testID="membership-host-card"
    >
      <Text style={[styles.infoTitle, { color: palette.text }]}>
        {getMembershipCardTitle(membershipState.stage)}
      </Text>
      <Text style={[styles.authSummary, { color: palette.textMuted }]}>
        {getMembershipCardSummary(membershipState, membershipRepositoryMode)}
      </Text>
      {focusCopy ? (
        <View
          style={[
            styles.membershipFocusCard,
            {
              backgroundColor: palette.accentSoft,
              borderColor: palette.border,
            },
          ]}
          testID="membership-focus-gate"
        >
          <Text style={[styles.membershipFocusTitle, { color: palette.accentStrong }]}>
            当前拦截点
          </Text>
          <Text style={[styles.authSummary, { color: palette.textMuted }]}>
            {focusCopy}
          </Text>
        </View>
      ) : null}
      <InfoCard palette={palette} title="当前权限矩阵" items={accessSummary} />
      {membershipState.recoveryPromptVisible ? (
        <View
          style={[
            styles.membershipRecoveryCard,
            { backgroundColor: palette.panelStrong, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.membershipFocusTitle, { color: palette.text }]}>
            恢复购买提醒
          </Text>
          <Text style={[styles.authSummary, { color: palette.textMuted }]}>
            {membershipState.lastExperienceEndedBy === 'premium'
              ? '正式会员体验结束后，提醒用户恢复购买，继续保留完整空间、完整卡库和完整算法。'
              : '完整试用体验结束后，当前只保留基础学习。若要继续完整空间与算法，请恢复购买。'}
          </Text>
          <Pressable
            onPress={handlers.onDismissRecovery}
            style={[
              styles.secondaryButton,
              {
                borderColor: palette.border,
                backgroundColor: palette.panel,
              },
            ]}
            testID="membership-dismiss-recovery-button"
          >
            <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
              收起恢复购买提醒
            </Text>
          </Pressable>
        </View>
      ) : null}
      {membershipPendingAction ? (
        <Text style={[styles.authHint, { color: palette.textMuted }]}>
          {membershipPendingAction === 'start_trial'
            ? '正在同步完整试用状态。'
            : membershipPendingAction === 'purchase'
            ? '正在同步会员 entitlement。'
            : '正在更新恢复购买提醒状态。'}
        </Text>
      ) : null}
      {membershipError ? (
        <Text style={[styles.authError, { color: palette.danger }]}>
          {membershipError}
        </Text>
      ) : null}
      <MembershipActionGroup
        handlers={handlers}
        membershipPendingAction={membershipPendingAction}
        membershipRepositoryMode={membershipRepositoryMode}
        membershipState={membershipState}
        palette={palette}
      />
    </View>
  );
}

function MembershipPaywallSurface({
  gate,
  handlers,
  membershipError,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
}: {
  gate: MembershipGate;
  handlers: MembershipHandlers;
  membershipError: string | null;
  membershipPendingAction: 'dismiss_recovery' | 'purchase' | 'start_trial' | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  palette: Palette;
}) {
  return (
    <ScrollView contentContainerStyle={styles.canvasContent}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
        testID={`membership-paywall-${gate}`}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          MEMBERSHIP / PAYWALL
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {gate === 'space'
            ? '完整物理空间需要试用或会员'
            : gate === 'review'
            ? '完整回看算法需要试用或会员'
            : '完整卡库需要试用或会员'}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {gate === 'space'
            ? '根据会员合同，免费态保留基础学习，但完整物理空间属于试用/会员完整体验的一部分。'
            : gate === 'review'
            ? '根据会员合同，完整算法属于试用/会员完整体验的一部分，免费态只保留基础学习。'
            : '根据会员合同，免费态应只开放接近一半卡量，完整卡库需要试用/会员。'}
        </Text>
      </View>
      <MembershipHostCard
        focusGate={gate}
        handlers={handlers}
        membershipError={membershipError}
        membershipPendingAction={membershipPendingAction}
        membershipRepositoryMode={membershipRepositoryMode}
        membershipState={membershipState}
        palette={palette}
      />
    </ScrollView>
  );
}

function MembershipActionGroup({
  handlers,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
}: {
  handlers: MembershipHandlers;
  membershipPendingAction: 'dismiss_recovery' | 'purchase' | 'start_trial' | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  palette: Palette;
}) {
  const isPending = membershipPendingAction !== null;
  const showLocalDebugActions = membershipRepositoryMode === 'local';

  return membershipState.stage === 'trial_available' ? (
    <View style={styles.authActions}>
      <Pressable
        disabled={isPending}
        onPress={handlers.onStartTrial}
        style={[styles.primaryButton, { backgroundColor: palette.accent }]}
        testID="membership-start-trial-button"
      >
        <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
          {membershipPendingAction === 'start_trial'
            ? '正在开通完整试用'
            : '开始完整试用'}
        </Text>
      </Pressable>
      <Pressable
        disabled={isPending}
        onPress={handlers.onPurchase}
        style={[
          styles.secondaryButton,
          { borderColor: palette.border, backgroundColor: palette.panelStrong },
        ]}
        testID="membership-purchase-button"
      >
        <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
          直接开通会员
        </Text>
      </Pressable>
    </View>
  ) : membershipState.stage === 'trial' ? (
    <View style={styles.authActions}>
      <Pressable
        disabled={isPending}
        onPress={handlers.onPurchase}
        style={[styles.primaryButton, { backgroundColor: palette.accent }]}
        testID="membership-purchase-button"
      >
        <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
          {membershipPendingAction === 'purchase'
            ? '正在开通会员'
            : '直接开通会员'}
        </Text>
      </Pressable>
      {showLocalDebugActions ? (
        <Pressable
          disabled={isPending}
          onPress={handlers.onExpireTrial}
          style={[
            styles.secondaryButton,
            { borderColor: palette.border, backgroundColor: palette.panelStrong },
          ]}
          testID="membership-expire-trial-button"
        >
          <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
            结束本地试用体验
          </Text>
        </Pressable>
      ) : null}
    </View>
  ) : membershipState.stage === 'premium' ? (
    <View style={styles.authActions}>
      <Text style={[styles.authSuccess, { color: palette.success }]}>
        {membershipRepositoryMode === 'remote'
          ? '当前 entitlement 已由远端账号合同回填为会员态。'
          : '当前本地 entitlement 已是会员态。'}
      </Text>
      {showLocalDebugActions ? (
        <Pressable
          disabled={isPending}
          onPress={handlers.onExpirePremium}
          style={[
            styles.secondaryButton,
            { borderColor: palette.border, backgroundColor: palette.panelStrong },
          ]}
          testID="membership-expire-premium-button"
        >
          <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
            结束本地会员体验
          </Text>
        </Pressable>
      ) : null}
    </View>
  ) : (
    <View style={styles.authActions}>
      <Pressable
        disabled={isPending}
        onPress={handlers.onPurchase}
        style={[styles.primaryButton, { backgroundColor: palette.accent }]}
        testID="membership-purchase-button"
      >
        <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
          {membershipPendingAction === 'purchase'
            ? '正在恢复购买'
            : '恢复购买并开通会员'}
        </Text>
      </Pressable>
    </View>
  );
}

function PhoneSmsPanel({
  authRepositoryMode,
  authState,
  handlers,
  palette,
  title,
  summary,
}: {
  authRepositoryMode: 'local' | 'remote';
  authState: AuthState;
  handlers: AuthHandlers;
  palette: Palette;
  title: string;
  summary: string;
}) {
  const isAuthenticated = authState.stage === 'authenticated';
  const isPending = authState.pendingAction !== null;

  return (
    <View
      style={[
        styles.authPanel,
        { backgroundColor: palette.panel, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.infoTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.authSummary, { color: palette.textMuted }]}>
        {summary}
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
          手机号
        </Text>
        <TextInput
          autoCapitalize="none"
          editable={!isPending && !isAuthenticated}
          keyboardType="number-pad"
          maxLength={11}
          onChangeText={handlers.onChangePhone}
          placeholder="输入 11 位手机号"
          placeholderTextColor={palette.tabIdle}
          style={[
            styles.input,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          testID="auth-phone-input"
          textContentType="telephoneNumber"
          value={authState.phoneNumber}
        />
      </View>

      <View style={styles.authActions}>
        <Pressable
          disabled={isPending || isAuthenticated}
          onPress={handlers.onRequestCode}
          style={[
            styles.primaryButton,
            styles.compactButton,
            { backgroundColor: palette.accent },
          ]}
          testID="auth-request-code-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            {authState.pendingAction === 'request_code'
              ? '正在请求验证码'
              : authState.stage === 'code_sent'
              ? '重新发送验证码'
              : '请求验证码'}
          </Text>
        </Pressable>
        <Text style={[styles.authHint, { color: palette.textMuted }]}>
          {authState.pendingAction === 'request_code'
            ? '正在向当前手机号请求验证码。'
            : authState.stage === 'code_sent'
            ? `已向 ${maskPhoneNumber(authState.phoneNumber)} 发送验证码。`
            : authRepositoryMode === 'remote'
            ? '当前会走远端短信验证码合同。'
            : '当前是本地壳层验证，不会真的发短信。'}
        </Text>
      </View>

      {authState.stage !== 'logged_out' ? (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
            验证码
          </Text>
          <TextInput
            editable={!isPending && !isAuthenticated}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={handlers.onChangeCode}
            placeholder="输入 4-6 位验证码"
            placeholderTextColor={palette.tabIdle}
            style={[
              styles.input,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            testID="auth-code-input"
            textContentType="oneTimeCode"
            value={authState.smsCode}
          />
        </View>
      ) : null}

      {authState.error ? (
        <Text style={[styles.authError, { color: palette.danger }]}>
          {authState.error}
        </Text>
      ) : null}

      {isAuthenticated ? (
        <View style={styles.authActions}>
          <Text style={[styles.authSuccess, { color: palette.success }]}>
            {authRepositoryMode === 'remote'
              ? '已完成远端短信验证码登录。'
              : '已完成本地登录态验证。'}
          </Text>
          <Pressable
            disabled={isPending}
            onPress={handlers.onLogout}
            style={[
              styles.secondaryButton,
              {
                borderColor: palette.border,
                backgroundColor: palette.panelStrong,
              },
            ]}
            testID="auth-logout-button"
          >
            <Text
              style={[styles.secondaryButtonLabel, { color: palette.text }]}
            >
              退出当前登录态
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          disabled={isPending}
          onPress={handlers.onSubmitCode}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID="auth-submit-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            {authState.pendingAction === 'verify_code' ? '正在登录' : '完成登录'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function RouteCanvas({
  palette,
  route,
  deviceClass,
}: {
  palette: Palette;
  route: ShellRoute;
  deviceClass: DeviceClass;
}) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.canvasContent,
        deviceClass === 'tablet' ? styles.canvasContentTablet : null,
      ]}
    >
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          当前阶段
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {route.title}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {route.summary}
        </Text>
      </View>

      <View style={styles.sectionGrid}>
        <InfoCard
          palette={palette}
          title="本分支只做什么"
          items={route.highlights}
        />
        <InfoCard palette={palette} title="下一步会接入" items={route.focus} />
        <InfoCard
          palette={palette}
          title="导航与权限"
          items={[
            '顶层顺序固定为 学习 / 空间 / 统计 / 我的。',
            '学习保持最重要入口，空间保持顶层入口。',
            '认证、会员矩阵与日级同步都已接进 runtime；默认仍是本地安全实现。',
          ]}
        />
        <InfoCard
          palette={palette}
          title="设备形态"
          items={
            deviceClass === 'phone'
              ? [
                  '当前布局面向 iPhone。',
                  '底部导航保持低操作成本。',
                  '后续业务屏会沿用这一层壳。',
                ]
              : [
                  '当前布局面向 iPad。',
                  '侧边导航允许同屏展示更多层级信息。',
                  '后续空间与统计模块会利用更宽的内容区。',
                ]
          }
        />
      </View>
    </ScrollView>
  );
}

function InfoCard({
  palette,
  title,
  items,
}: {
  palette: Palette;
  title: string;
  items: string[];
}) {
  return (
    <View
      style={[
        styles.infoCard,
        { backgroundColor: palette.panel, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.infoTitle, { color: palette.text }]}>{title}</Text>
      {items.map(item => (
        <View key={item} style={styles.infoRow}>
          <View
            style={[
              styles.infoDot,
              { backgroundColor: palette.accent, borderColor: palette.border },
            ]}
          />
          <Text style={[styles.infoText, { color: palette.textMuted }]}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function getDeviceClass(width: number, height: number): DeviceClass {
  return Math.min(width, height) >= 768 ? 'tablet' : 'phone';
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber.length !== 11) {
    return phoneNumber || '未填写手机号';
  }

  return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`;
}

function getMembershipCardTitle(stage: MembershipStage) {
  switch (stage) {
    case 'trial_available':
      return '试用待开始';
    case 'trial':
      return '完整试用进行中';
    case 'free':
      return '当前是基础学习态';
    case 'premium':
      return '当前是会员态';
  }
}

function getMembershipCardSummary(
  membershipState: MembershipState,
  mode: 'local' | 'remote',
) {
  switch (membershipState.stage) {
    case 'trial_available':
      return '试用不会在注册时自动起算，而是在首个计入入口开始。开始后会放开完整卡库、完整空间和完整算法。';
    case 'trial':
      return mode === 'remote'
        ? `当前 entitlement 已通过远端合同回填为 ${membershipState.trialDurationDays} 天完整试用态，继续验证完整卡库、空间和算法的放开边界。`
        : `当前用本地壳层模拟 ${membershipState.trialDurationDays} 天完整试用，确保用户能完整感受到内容、算法和物理空间的价值。`;
    case 'free':
      return '当前只保留基础学习，并把完整卡库、完整空间和完整算法收回到试用/会员权限后。';
    case 'premium':
      return mode === 'remote'
        ? '当前 entitlement 已通过远端合同统一为会员态，完整卡库、完整空间和完整算法都已放开。'
        : '当前本地 entitlement 已统一为会员态，完整卡库、完整空间和完整算法都已放开。';
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  shellRoot: {
    flex: 1,
  },
  tabletRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 300,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRightWidth: 1,
    gap: 18,
  },
  sidebarNav: {
    gap: 12,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sidebarBadge: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sidebarCopy: {
    flex: 1,
    gap: 4,
  },
  sidebarLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  sidebarEyebrow: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabletContent: {
    flex: 1,
  },
  brandEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  brandSummary: {
    fontSize: 15,
    lineHeight: 22,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  statusBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.05,
  },
  statusBadgeValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
  },
  headerSummary: {
    fontSize: 14,
    lineHeight: 21,
  },
  headerMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  headerPill: {
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  headerAuthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  canvasContent: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  canvasContentTablet: {
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
  },
  authHero: {
    marginTop: 2,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroSummary: {
    fontSize: 15,
    lineHeight: 23,
  },
  authPanel: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  authSummary: {
    fontSize: 14,
    lineHeight: 21,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  authActions: {
    gap: 10,
  },
  authHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  authError: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  authSuccess: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  compactButton: {
    alignSelf: 'flex-start',
    minWidth: 128,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionGrid: {
    gap: 14,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 7,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  membershipFocusCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  membershipFocusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  membershipRecoveryCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  phoneTabBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  phoneTabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  phoneTabBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  phoneTabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  phoneTabIndicator: {
    width: 24,
    height: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  phoneTabIndicatorHidden: {
    backgroundColor: 'transparent',
  },
});

export default App;
