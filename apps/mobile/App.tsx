import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  AppState,
  InputAccessoryView,
  Keyboard,
  Pressable,
  Platform,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
  ViewStyle,
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
import {
  readSoftbookAppRuntimeConfig,
  resolveLearningSessionRepositoryConfig,
  resolveLearningTrack,
  type SoftbookAppRuntimeConfig,
} from './src/learning/learningRuntimeConfig';
import {
  createSoftbookRemoteRuntimeConfig,
  type SoftbookRemoteRuntimeProfile,
} from './src/runtime/appRuntimeConfig';
import { installSoftbookAppRuntimeConfig } from './src/runtime/installRuntimeConfig';
import {
  createSpaceStateRepository,
  createSpaceStateSnapshot,
} from './src/space/spaceStateRepository';
import { resolveSpaceStateRepositoryConfig } from './src/space/spaceStateRuntimeConfig';
import { SpaceSurface } from './src/space/SpaceSurface';
import { StatisticsSurface } from './src/statistics/StatisticsSurface';
import { createMutationQueueRepository } from './src/sync/mutationQueueRepository';
import {
  createLearningStateRepository,
  createLearningStateSnapshot,
} from './src/sync/learningStateRepository';
import { resolveLearningStateRepositoryConfig } from './src/sync/learningStateRuntimeConfig';
import {
  createDailyProgressSnapshot,
  createProgressSyncRepository,
} from './src/sync/progressSyncRepository';
import { resolveProgressSyncRepositoryConfig } from './src/sync/progressSyncRuntimeConfig';
import { LIBRARY_IDENTITY, hexToRgba } from './src/visual/tokens';

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type DeviceClass = 'phone' | 'tablet';
type AuthStage = 'logged_out' | 'code_sent' | 'authenticated';
type MembershipGate = 'space' | 'review' | 'library';

type AppProps = {
  softbookRemoteRuntimeProfile?: SoftbookRemoteRuntimeProfile;
};

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
  warning: string;
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

type SyncStatusState =
  | {
      detail: string;
      label: string;
      state: 'idle' | 'syncing' | 'synced' | 'error';
    };

type ProgressSyncState = SyncStatusState;
type LearningStateSyncState = SyncStatusState;

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
      '登录后直接进入系统顺序里的当前卡；卡片加载、失败重试和单卡推进都留在学习入口内完成。',
    highlights: [
      '一次只推进一张卡，不把学习入口做成按钮堆。',
      '卡片按备考顺序进入当前轮；网络波动时也保留清晰的重试入口。',
      'Peek、收藏和提示层保持轻量，不抢主交互。',
    ],
    focus: ['当前卡加载', '单卡学习流', '失败重试'],
  },
  {
    key: 'space',
    label: '空间',
    badge: '02',
    eyebrow: '顶层入口',
    title: '知识地图与物理空间',
    summary:
      '空间会展示已接入卡片的 library / group / box / card 层级，让用户能浏览知识地图、查看盒内卡片，并看见当前学习卡的位置。',
    highlights: [
      '能看见当前学习卡在空间中的位置。',
      '能按 library / group / box 层级浏览已接入卡片。',
      '先收口低成本浏览，不开放任意拖拽改盒。',
    ],
    focus: ['休眠区规则', '支持的位置操作'],
  },
  {
    key: 'statistics',
    label: '统计',
    badge: '03',
    eyebrow: '服务核心价值',
    title: '轻量统计与签到',
    summary:
      '统计只保留今日签到、学习摘要和回看状态，帮助用户确认自己有在推进。',
    highlights: [
      '签到只和真实学习进展挂钩，不做空转打卡。',
      '首轮与回看结果会以低成本摘要方式展示。',
      '页面会跟随设备形态变化，但入口顺序保持一致。',
    ],
    focus: ['轻量签到', '低成本连续性'],
  },
  {
    key: 'mine',
    label: '我的',
    badge: '04',
    eyebrow: '账户与会员',
    title: '个人页',
    summary:
      '“我的”承接账号、学习、空间摘要与试用/会员边界，让个人状态集中在一个入口里。',
    highlights: [
      '已登录后能看到账号、学习、空间与会员摘要。',
      '试用在首个计入入口开始，不在注册时偷跑。',
      '基础学习保留，完整空间、完整卡库和完整算法挂到试用/会员后。',
    ],
    focus: ['账号概览', '试用与会员', '恢复购买'],
  },
];

const LIGHT_PALETTE: Palette = {
  background: '#F1F0F6',
  panel: 'rgba(255,255,255,0.82)',
  panelStrong: 'rgba(255,255,255,0.94)',
  border: 'rgba(11,11,20,0.08)',
  text: '#0B0B14',
  textMuted: '#7A7A90',
  accent: LIBRARY_IDENTITY.listening,
  accentSoft: hexToRgba(LIBRARY_IDENTITY.listening, 0.12),
  accentStrong: '#4152E1',
  tabIdle: '#ACACBF',
  success: '#22C58B',
  warning: '#F5B100',
  danger: '#F15B6E',
};

const DARK_PALETTE: Palette = {
  background: '#0B0B12',
  panel: 'rgba(28,28,42,0.74)',
  panelStrong: 'rgba(34,36,52,0.92)',
  border: 'rgba(255,255,255,0.08)',
  text: '#F2F1EB',
  textMuted: '#B8B8CE',
  accent: '#7C8BFF',
  accentSoft: hexToRgba(LIBRARY_IDENTITY.listening, 0.2),
  accentStrong: '#D5DAFF',
  tabIdle: '#86869C',
  success: '#4FDE9C',
  warning: '#F5B100',
  danger: '#F15B6E',
};

const PROTECTED_ROUTES: RouteKey[] = ['learning', 'space', 'statistics'];
const AUTH_KEYBOARD_ACCESSORY_ID = 'auth-keyboard-accessory';

const INITIAL_AUTH_STATE: AuthState = {
  authToken: null,
  stage: 'logged_out',
  phoneNumber: '',
  pendingAction: null,
  smsCode: '',
  error: null,
};

const INITIAL_PROGRESS_SYNC_STATE: ProgressSyncState = {
  detail: '今天还没有需要同步的学习进展。',
  label: '等待今日进展',
  state: 'idle',
};

const INITIAL_LEARNING_STATE_SYNC_STATE: LearningStateSyncState = {
  detail: '当前还没有需要同步的学习作答状态。',
  label: '等待学习状态',
  state: 'idle',
};

function createEntitlementPendingMembershipState(): MembershipState {
  return {
    ...createInitialMembershipState(),
    stage: 'free',
  };
}

function App({
  softbookRemoteRuntimeProfile,
}: AppProps = {}): React.JSX.Element {
  const runtimeConfig = useMemo(() => {
    if (softbookRemoteRuntimeProfile) {
      return installSoftbookAppRuntimeConfig(
        createSoftbookRemoteRuntimeConfig(softbookRemoteRuntimeProfile),
      );
    }

    return readSoftbookAppRuntimeConfig();
  }, [softbookRemoteRuntimeProfile]);

  return (
    <SafeAreaProvider>
      <AppShell runtimeConfig={runtimeConfig} />
    </SafeAreaProvider>
  );
}

function AppShell({
  runtimeConfig,
}: {
  runtimeConfig: SoftbookAppRuntimeConfig | undefined;
}) {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const learningTrack = useMemo(
    () => resolveLearningTrack(runtimeConfig),
    [runtimeConfig],
  );
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
  const learningStateRepositoryConfig = useMemo(
    () => resolveLearningStateRepositoryConfig(runtimeConfig),
    [runtimeConfig],
  );
  const learningStateRepository = useMemo(
    () => createLearningStateRepository(learningStateRepositoryConfig),
    [learningStateRepositoryConfig],
  );
  const runtimeLearningStateMode = learningStateRepositoryConfig.mode;
  const spaceStateRepositoryConfig = useMemo(
    () => resolveSpaceStateRepositoryConfig(runtimeConfig ?? {}),
    [runtimeConfig],
  );
  const spaceStateRepository = useMemo(
    () => createSpaceStateRepository(spaceStateRepositoryConfig),
    [spaceStateRepositoryConfig],
  );
  const runtimeSpaceStateMode = spaceStateRepositoryConfig.mode;
  const mutationQueueRepository = useMemo(
    () =>
      createMutationQueueRepository({
        learningStateRepository,
        membershipRepository,
        progressSyncRepository,
        spaceStateRepository,
      }),
    [
      learningStateRepository,
      membershipRepository,
      progressSyncRepository,
      spaceStateRepository,
    ],
  );
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
  const [progressSyncState, setProgressSyncState] = useState<ProgressSyncState>(
    INITIAL_PROGRESS_SYNC_STATE,
  );
  const [learningStateSyncState, setLearningStateSyncState] =
    useState<LearningStateSyncState>(INITIAL_LEARNING_STATE_SYNC_STATE);
  const [lastSyncedProgressKey, setLastSyncedProgressKey] = useState<
    string | null
  >(null);
  const [lastSyncedLearningStateKey, setLastSyncedLearningStateKey] = useState<
    string | null
  >(null);
  const [lastSyncedSpaceStateKey, setLastSyncedSpaceStateKey] = useState<
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
  const lastMembershipRefreshKey = useRef<string | null>(null);
  const pendingMembershipRefreshKey = useRef<string | null>(null);
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
  const resolveVisibleLearningCards = useCallback((
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
  }, [learningSession, membershipState, readSpaceCardState, spaceCardStateById]);
  const resolveSleepingAccessibleCards = useCallback((
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
  }, [learningSession, membershipState, readSpaceCardState, spaceCardStateById]);
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
  const spaceStateSnapshot = useMemo(
    () =>
      createSpaceStateSnapshot({
        dayKey: todayKey,
        spaceCardStateById,
      }),
    [spaceCardStateById, todayKey],
  );
  const spaceStateSyncKey = JSON.stringify(spaceStateSnapshot);
  const learningStateSnapshot = useMemo(
    () =>
      learningSession
        ? createLearningStateSnapshot({
            dayKey: todayKey,
            learningResults: learningCompletedResults,
            learningSession,
            reviewResults: reviewCompletedResults,
          })
        : null,
    [
      learningCompletedResults,
      learningSession,
      reviewCompletedResults,
      todayKey,
    ],
  );
  const learningStateSyncKey = learningStateSnapshot
    ? JSON.stringify(learningStateSnapshot)
    : null;
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
  const activeMembershipRefreshKey =
    runtimeMembershipRepositoryMode === 'remote' &&
    authenticatedRuntimeContext !== null &&
    activeRoute === 'mine'
      ? `${authenticatedRuntimeContext.authToken ?? ''}:${activeRoute}`
      : null;
  const startMutationReplay = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    if (authenticatedRuntimeContext === null) {
      return;
    }

    const replayedResults = await mutationQueueRepository.startReplay(
      authenticatedRuntimeContext,
    );

    replayedResults.forEach(result => {
      if (result.entry.type === 'sync_daily_progress') {
        const replayedProgressKey = JSON.stringify(result.entry.payload.snapshot);

        setLastSyncedProgressKey(replayedProgressKey);

        if (replayedProgressKey === dailyProgressKey) {
          setProgressSyncState({
            detail: '今天的学习进展已从离线队列补推到云端。',
            label: '云端已同步',
            state: 'synced',
          });
        }

        return;
      }

      if (result.entry.type === 'sync_space_state') {
        setLastSyncedSpaceStateKey(JSON.stringify(result.entry.payload.snapshot));
        return;
      }

      if (result.entry.type === 'sync_learning_state') {
        const replayedLearningStateKey = JSON.stringify(
          result.entry.payload.snapshot,
        );

        setLastSyncedLearningStateKey(replayedLearningStateKey);

        if (replayedLearningStateKey === learningStateSyncKey) {
          setLearningStateSyncState({
            detail: '当前学习作答状态已从离线队列补推到云端。',
            label: '云端已同步',
            state: 'synced',
          });
        }

        return;
      }

      if (result.entry.type === 'refresh_membership') {
        pendingMembershipRefreshKey.current = null;
        lastMembershipRefreshKey.current = result.entry.id.replace(
          /^membership:/,
          '',
        );
      }

      if ('membershipState' in result) {
        setMembershipError(null);
        setMembershipState(result.membershipState);
        setMembershipGate(currentGate =>
          shouldClearMembershipGate(currentGate, result.membershipState)
            ? null
            : currentGate,
        );
      }
    });
  }, [
    authenticatedRuntimeContext,
    dailyProgressKey,
    isAuthenticated,
    learningStateSyncKey,
    mutationQueueRepository,
  ]);

  const countCompletedCards = useCallback(
    (cards: LearningCard[], results: LearningCardResult[]) =>
      cards.filter(card =>
        results.some(result => result.cardId === card.card_id),
      ).length,
    [],
  );

  const resetLearningDeck = useCallback((
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
  }, [
    createTrackedLearningCardState,
    learningSession,
    membershipState,
    resolveVisibleLearningCards,
    spaceCardStateById,
  ]);

  const reconcileLearningDeckState = useCallback((
    stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    nextSession: LearningSession | null = learningSession,
    nextMembershipState: MembershipState = membershipState,
  ) => {
    const nextVisibleCards = resolveVisibleLearningCards(
      nextSession,
      stateMap,
      nextMembershipState,
    );
    const nextReviewCards = selectReviewCards(
      nextVisibleCards,
      learningCompletedResults,
    );
    const shouldStayInReview =
      learningPhase === 'review' &&
      resolveMembershipAccess(nextMembershipState).completeAlgorithm &&
      nextReviewCards.length > 0;
    const nextPhase = shouldStayInReview ? 'review' : 'learning';
    const nextSessionCards = shouldStayInReview
      ? nextReviewCards
      : nextVisibleCards;
    const nextIndex = shouldStayInReview
      ? countCompletedCards(nextReviewCards, reviewCompletedResults)
      : countCompletedCards(nextVisibleCards, learningCompletedResults);

    setLearningIndex(nextIndex);
    setLearningPhase(nextPhase);
    setLearningCurrentResult(null);
    setReviewSessionCards(shouldStayInReview ? nextReviewCards : []);
    setLearningCardState(
      nextSessionCards[nextIndex]
        ? createTrackedLearningCardState(nextSessionCards[nextIndex], stateMap)
        : null,
    );
  }, [
    countCompletedCards,
    createTrackedLearningCardState,
    learningCompletedResults,
    learningPhase,
    learningSession,
    membershipState,
    resolveVisibleLearningCards,
    reviewCompletedResults,
    spaceCardStateById,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      lastMembershipRefreshKey.current = null;
      pendingMembershipRefreshKey.current = null;
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
      setLastSyncedLearningStateKey(null);
      setLastSyncedSpaceStateKey(null);
      setProgressSyncState(INITIAL_PROGRESS_SYNC_STATE);
      setLearningStateSyncState(INITIAL_LEARNING_STATE_SYNC_STATE);
      return;
    }

    if (learningBootstrapStatus !== 'idle') {
      return;
    }

    setLearningBootstrapStatus('loading');
    setLearningBootstrapError(null);
  }, [isAuthenticated, learningBootstrapStatus]);

  useEffect(() => {
    if (activeRoute === 'mine') {
      return;
    }

    lastMembershipRefreshKey.current = null;
  }, [activeRoute]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      runtimeMembershipRepositoryMode !== 'remote' ||
      authenticatedRuntimeContext === null ||
      activeMembershipRefreshKey === null ||
      membershipPendingAction !== null
    ) {
      return;
    }

    if (
      lastMembershipRefreshKey.current === activeMembershipRefreshKey ||
      pendingMembershipRefreshKey.current === activeMembershipRefreshKey
    ) {
      return;
    }

    let isCancelled = false;
    pendingMembershipRefreshKey.current = activeMembershipRefreshKey;

    membershipRepository
      .loadState(authenticatedRuntimeContext)
      .then(nextMembershipState => {
        if (isCancelled) {
          return;
        }

        lastMembershipRefreshKey.current = activeMembershipRefreshKey;
        pendingMembershipRefreshKey.current = null;
        setMembershipError(null);
        setMembershipState(nextMembershipState);
        setMembershipGate(currentGate =>
          shouldClearMembershipGate(currentGate, nextMembershipState)
            ? null
            : currentGate,
        );
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        pendingMembershipRefreshKey.current = null;
        mutationQueueRepository
          .enqueueMutation(
            'refresh_membership',
            {
              context: authenticatedRuntimeContext,
            },
            `membership:${activeMembershipRefreshKey}`,
          )
          .catch(() => undefined);
        setMembershipError(
          `${getUserFacingErrorMessage(
            error,
            '会员状态刷新失败。',
          )} 已加入离线重试队列。`,
        );
      });

    return () => {
      isCancelled = true;

      if (pendingMembershipRefreshKey.current === activeMembershipRefreshKey) {
        pendingMembershipRefreshKey.current = null;
      }
    };
  }, [
    activeMembershipRefreshKey,
    authenticatedRuntimeContext,
    isAuthenticated,
    membershipPendingAction,
    membershipRepository,
    mutationQueueRepository,
    runtimeMembershipRepositoryMode,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    startMutationReplay().catch(() => undefined);
  }, [activeRoute, isAuthenticated, startMutationReplay]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        startMutationReplay().catch(() => undefined);
      }
    });

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        startMutationReplay().catch(() => undefined);
      }
    });

    return () => {
      unsubscribeNetInfo();
      subscription.remove();
    };
  }, [isAuthenticated, startMutationReplay]);

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
        detail: '今天的学习进展已在本机记录。',
        label: '已记录',
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

    startMutationReplay().catch(() => undefined);

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
              ? '今天的学习进展已推送到云端。'
              : '今天的学习进展已在本机记录。',
          label: result.mode === 'remote' ? '云端已同步' : '已记录',
          state: 'synced',
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        mutationQueueRepository
          .enqueueMutation(
            'sync_daily_progress',
            {
              context: authenticatedRuntimeContext,
              snapshot: dailyProgressSnapshot,
            },
            `progress:${dailyProgressKey}`,
          )
          .catch(() => undefined);
        setProgressSyncState({
          detail:
            `${getUserFacingErrorMessage(
              error,
              '日级进展同步失败。',
            )} 已加入离线重试队列。`,
          label: '已排队',
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
    mutationQueueRepository,
    progressSyncRepository,
    runtimeProgressSyncMode,
    startMutationReplay,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      learningBootstrapStatus !== 'ready' ||
      learningStateSnapshot === null ||
      learningStateSnapshot.events.length === 0 ||
      learningStateSyncKey === null
    ) {
      return;
    }

    if (lastSyncedLearningStateKey === learningStateSyncKey) {
      return;
    }

    if (runtimeLearningStateMode === 'local') {
      setLastSyncedLearningStateKey(learningStateSyncKey);
      setLearningStateSyncState({
        detail: '当前学习作答状态已在本机记录。',
        label: '已记录',
        state: 'idle',
      });
      return;
    }

    if (authenticatedRuntimeContext === null) {
      setLearningStateSyncState({
        detail: '当前缺少可用的登录上下文，学习状态无法同步。',
        label: '同步受阻',
        state: 'error',
      });
      return;
    }

    let isCancelled = false;

    setLearningStateSyncState({
      detail: '当前正在同步学习作答状态。',
      label: '同步中',
      state: 'syncing',
    });
    startMutationReplay().catch(() => undefined);

    learningStateRepository
      .syncLearningState(authenticatedRuntimeContext, learningStateSnapshot)
      .then(() => {
        if (isCancelled) {
          return;
        }

        setLastSyncedLearningStateKey(learningStateSyncKey);
        setLearningStateSyncState({
          detail: '当前学习作答状态已同步到云端。',
          label: '云端已同步',
          state: 'synced',
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        mutationQueueRepository
          .enqueueMutation(
            'sync_learning_state',
            {
              context: authenticatedRuntimeContext,
              snapshot: learningStateSnapshot,
            },
            `learning:${learningStateSyncKey}`,
          )
          .catch(() => undefined);
        setLearningStateSyncState({
          detail:
            `${getUserFacingErrorMessage(
              error,
              '学习状态同步失败。',
            )} 已加入离线重试队列。`,
          label: '已排队',
          state: 'error',
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [
    authenticatedRuntimeContext,
    isAuthenticated,
    lastSyncedLearningStateKey,
    learningBootstrapStatus,
    learningStateRepository,
    learningStateSnapshot,
    learningStateSyncKey,
    mutationQueueRepository,
    runtimeLearningStateMode,
    startMutationReplay,
  ]);

  useEffect(() => {
    if (!isAuthenticated || Object.keys(spaceCardStateById).length === 0) {
      return;
    }

    if (lastSyncedSpaceStateKey === spaceStateSyncKey) {
      return;
    }

    if (runtimeSpaceStateMode === 'local') {
      setLastSyncedSpaceStateKey(spaceStateSyncKey);
      return;
    }

    if (authenticatedRuntimeContext === null) {
      return;
    }

    let isCancelled = false;

    startMutationReplay().catch(() => undefined);

    spaceStateRepository
      .syncSpaceState(authenticatedRuntimeContext, spaceStateSnapshot)
      .then(() => {
        if (isCancelled) {
          return;
        }

        setLastSyncedSpaceStateKey(spaceStateSyncKey);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        mutationQueueRepository
          .enqueueMutation(
            'sync_space_state',
            {
              context: authenticatedRuntimeContext,
              snapshot: spaceStateSnapshot,
            },
            `space:${spaceStateSyncKey}`,
          )
          .catch(() => undefined);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    authenticatedRuntimeContext,
    isAuthenticated,
    lastSyncedSpaceStateKey,
    mutationQueueRepository,
    runtimeSpaceStateMode,
    spaceCardStateById,
    spaceStateRepository,
    spaceStateSnapshot,
    spaceStateSyncKey,
    startMutationReplay,
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
      .loadSession(authenticatedRuntimeContext, learningTrack)
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
          getUserFacingErrorMessage(error, '学习卡源加载失败。'),
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
    learningTrack,
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
    reconcileLearningDeckState(
      spaceCardStateById,
      learningSession,
      membershipState,
    );
  }, [
    isAuthenticated,
    learningBootstrapStatus,
    learningSession,
    membershipState,
    reconcileLearningDeckState,
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

  const completeMembershipUnlock = (
    nextState: MembershipState,
    nextGate: MembershipGate | null = membershipGate,
  ) => {
    const unlockedGate = nextGate;

    setMembershipState(nextState);
    setMembershipGate(null);

    if (unlockedGate === 'review') {
      startTransition(() => {
        setActiveRoute('learning');
      });
    }
  };

  const beginMembershipTrial = (nextGate: MembershipGate | null) => {
    if (
      authenticatedRuntimeContext === null ||
      membershipPendingAction !== null
    ) {
      return;
    }

    setMembershipError(null);
    setMembershipGate(nextGate);

    if (runtimeMembershipRepositoryMode === 'local') {
      completeMembershipUnlock(startMembershipTrial(membershipState), nextGate);
      return;
    }

    setMembershipPendingAction('start_trial');
    membershipRepository
      .startTrial(authenticatedRuntimeContext, membershipState)
      .then(result => {
        setMembershipPendingAction(null);
        completeMembershipUnlock(result.state, nextGate);
      })
      .catch((error: unknown) => {
        if (shouldQueueMembershipTrialStart(error)) {
          mutationQueueRepository
            .enqueueMutation(
              'start_membership_trial',
              {
                context: authenticatedRuntimeContext,
                currentState: membershipState,
              },
              `membership-trial:${authenticatedRuntimeContext.phoneNumber}`,
            )
            .catch(() => undefined);
          setMembershipError(
            `${getUserFacingErrorMessage(
              error,
              '试用开通暂时失败。',
            )} 已先放行本次完整试用，并加入离线重试队列。`,
          );
          setMembershipPendingAction(null);
          completeMembershipUnlock(startMembershipTrial(membershipState), nextGate);
          return;
        }

        setMembershipError(
          getUserFacingErrorMessage(error, '试用开通暂时失败。'),
        );
        setMembershipPendingAction(null);
      });
  };

  const handleSelectRoute = (nextRoute: RouteKey) => {
    if (
      nextRoute === 'space' &&
      isAuthenticated &&
      membershipState.stage === 'trial_available' &&
      !membershipAccess.completePhysicalSpace
    ) {
      startTransition(() => {
        setActiveRoute('space');
      });
      beginMembershipTrial('space');
      return;
    }

    startTransition(() => {
      setActiveRoute(nextRoute);
    });
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
              getUserFacingErrorMessage(error, '验证码请求暂时失败。'),
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
        .then(session => {
          const membershipContext = {
            authToken: session.authToken,
            phoneNumber: session.phoneNumber,
          };

          return membershipRepository
            .loadState(membershipContext)
            .then(nextMembershipState => ({
              membershipErrorMessage: null,
              membershipRefreshSucceeded: true,
              membershipState: nextMembershipState,
              session,
            }))
            .catch((error: unknown) => {
              if (runtimeMembershipRepositoryMode !== 'remote') {
                throw error;
              }

              return mutationQueueRepository
                .enqueueMutation(
                  'refresh_membership',
                  {
                    context: membershipContext,
                  },
                  `membership:${session.authToken ?? session.phoneNumber}:login`,
                )
                .catch(() => undefined)
                .then(() => ({
                  membershipErrorMessage: `${getUserFacingErrorMessage(
                    error,
                    '会员状态暂时无法读取。',
                  )} 已保留登录态，并加入离线重试队列。`,
                  membershipRefreshSucceeded: false,
                  membershipState: createEntitlementPendingMembershipState(),
                  session,
                }));
            });
        })
        .then(({
          membershipErrorMessage,
          membershipRefreshSucceeded,
          membershipState: nextMembershipState,
          session,
        }) => {
          if (runtimeMembershipRepositoryMode === 'remote') {
            lastMembershipRefreshKey.current = membershipRefreshSucceeded
              ? `${session.authToken ?? ''}:${activeRoute}`
              : null;
            pendingMembershipRefreshKey.current = null;
          }
          setMembershipState(nextMembershipState);
          setMembershipError(membershipErrorMessage);
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
            error: getUserFacingErrorMessage(error, '登录暂时失败。'),
            pendingAction: null,
          }));
        });
    },
    onLogout: () => {
      lastMembershipRefreshKey.current = null;
      pendingMembershipRefreshKey.current = null;
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
      setLastSyncedLearningStateKey(null);
      setLastSyncedSpaceStateKey(null);
      mutationQueueRepository.clear().catch(() => undefined);
      setProgressSyncState(INITIAL_PROGRESS_SYNC_STATE);
      setLearningStateSyncState(INITIAL_LEARNING_STATE_SYNC_STATE);
      startTransition(() => {
        setActiveRoute('mine');
      });
    },
  };

  const membershipHandlers: MembershipHandlers = {
    onStartTrial: () => {
      beginMembershipTrial(membershipGate);
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
        if (membershipState.stage === 'trial_available') {
          startTransition(() => {
            setActiveRoute('mine');
          });
          beginMembershipTrial('review');
          return;
        }

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
      reconcileLearningDeckState(nextStateMap);
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
      deviceClass={deviceClass}
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
      learningStateSyncState={learningStateSyncState}
      progressSyncState={progressSyncState}
      reviewResults={reviewCompletedResults}
      route={route}
      sleepingCount={sleepingCount}
    />
  ) : route.key === 'space' && !membershipAccess.completePhysicalSpace ? (
    <MembershipPaywallSurface
      deviceClass={deviceClass}
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
      spaceCards={learningSession?.catalogCards ?? []}
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
      <AuroraBackdrop />
      <View style={styles.safeAreaBody}>
        {deviceClass === 'tablet' ? (
          <TabletShell
            activeRoute={activeRoute}
            authState={authState}
            content={content}
            onSelectRoute={handleSelectRoute}
            palette={palette}
            route={route}
          />
        ) : (
          <PhoneShell
            activeRoute={activeRoute}
            authState={authState}
            content={content}
            onSelectRoute={handleSelectRoute}
            palette={palette}
            route={route}
          />
        )}
      </View>
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
          LEARNING SETUP
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {isLoading ? '正在准备本轮学习' : '本轮学习暂时不可用'}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {isLoading
            ? '正在整理本轮要学的卡片，准备好后会直接进入单卡流。'
            : '已登录，但这次没能拿到可用卡片。可以留在学习入口内重试。'}
        </Text>
      </View>
      <InfoCard
        palette={palette}
        title={isLoading ? '准备中' : '暂时停在这里'}
        items={
          isLoading
            ? [
                '正在加载本轮卡片。',
                '学习仍然会按一张卡一张卡推进。',
                '准备完成后会自动回到当前学习流。',
              ]
            : [
                error ?? '本轮卡片加载失败。',
                '还没有进入答题状态，学习进度不会被错误推进。',
                '重试后会重新准备本轮学习。',
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
            本轮卡片准备好后才会进入单卡流。
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

function AuroraBackdrop() {
  return (
    <View pointerEvents="none" style={styles.auroraRoot}>
      <View
        style={[
          styles.auroraOrb,
          styles.auroraOrbPrimary,
          { backgroundColor: hexToRgba(LIBRARY_IDENTITY.listening, 0.18) },
        ]}
      />
      <View
        style={[
          styles.auroraOrb,
          styles.auroraOrbSecondary,
          { backgroundColor: hexToRgba(LIBRARY_IDENTITY.writing, 0.14) },
        ]}
      />
      <View
        style={[
          styles.auroraOrb,
          styles.auroraOrbWarm,
          { backgroundColor: hexToRgba(LIBRARY_IDENTITY.reading, 0.12) },
        ]}
      />
      <View
        style={[
          styles.auroraOrb,
          styles.auroraOrbCool,
          { backgroundColor: hexToRgba(LIBRARY_IDENTITY.translation, 0.12) },
        ]}
      />
    </View>
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
      <View style={styles.shellContent}>{content}</View>
      <View style={styles.phoneTabBarWrap}>
        <View
          style={[
            styles.phoneTabBar,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
              shadowColor: palette.text,
            },
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
                style={[
                  styles.phoneTabButton,
                  isActive
                    ? {
                        backgroundColor: palette.text,
                        shadowColor: palette.text,
                      }
                    : null,
                ]}
                testID={`route-tab-${item.key}`}
              >
                <Text
                  style={[
                    styles.phoneTabBadge,
                    {
                      color: isActive ? palette.panelStrong : palette.tabIdle,
                    },
                  ]}
                >
                  {item.badge}
                </Text>
                <Text
                  style={[
                    styles.phoneTabLabel,
                    {
                      color: isActive ? palette.panelStrong : palette.textMuted,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.brandEyebrow, { color: palette.accent }]}>
          LEARNING / SHELL
        </Text>
        <Text style={[styles.brandTitle, { color: palette.text }]}>
          软书四六级
        </Text>
        <Text style={[styles.brandSummary, { color: palette.textMuted }]}>
          已登录后直接进入单卡学习流；空间、统计和“我的”各自承接清楚的备考任务。
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
          borderColor: palette.border,
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
              ? '系统顺序推进，只把当前这一张留在首读路径里。'
              : '左侧只负责顶层切换，右侧把单卡学习留成主画布。'
            : deviceClass === 'phone'
            ? '顶层切换留在壳层，页面内部只承接该模块最小必要信息。'
            : '导航与内容拆层处理，减少同屏的等权抢焦。'}
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
    <ScrollView
      contentContainerStyle={[styles.canvasContent, styles.authCanvasContent]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
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
          学习、空间和统计都需要先确认身份，避免把个人进度记录到无身份状态里。
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
            ? '使用短信验证码确认身份，登录后继续进入学习、空间和个人进度。'
            : '当前可用验证码完成登录体验，登录后继续进入学习、空间和个人进度。'
        }
      />
      <InfoCard
        palette={palette}
        title="为什么要先登录"
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
  deviceClass,
  favoriteCount,
  handlers,
  learningResults,
  learningStateSyncState,
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
  deviceClass: DeviceClass;
  favoriteCount: number;
  handlers: AuthHandlers;
  learningResults: LearningCardResult[];
  learningStateSyncState: LearningStateSyncState;
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
  const pendingReviewCount = Math.max(
    learningResults.filter(
      result => result.outcome === 'incorrect' || result.outcome === 'review',
    ).length - reviewResults.length,
    0,
  );
  const todayKey = getTodayKey();
  const checkedInToday = checkedInDayKey === todayKey;
  const detailCardStyle =
    deviceClass === 'tablet' ? styles.infoCardHalf : null;

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
          {isAuthenticated ? '个人主页' : '从“我的”建立个人主页入口'}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {isAuthenticated
            ? '这里集中显示账号概览、学习摘要、同步状态、空间摘要和会员边界。'
            : '先完成身份建立，再查看学习摘要、会员状态和购买恢复提醒。'}
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
              ? '已通过短信验证码确认身份；学习、会员和同步状态会继续跟随账号更新。'
              : '已完成登录体验；你可以查看基础账号信息、学习摘要、同步状态和会员状态。'
            : '先从这里完成身份建立，再让学习流和用户态页面具备真实入口。'
        }
      />

      <View
        style={[
          styles.profileMetricRow,
          deviceClass === 'tablet' ? styles.profileMetricRowTablet : null,
        ]}
      >
        <SummaryMetricCard
          label={isAuthenticated ? '已完成' : '登录状态'}
          value={isAuthenticated ? `${completedCount}` : '待登录'}
          palette={palette}
        />
        <SummaryMetricCard
          label={isAuthenticated ? '待回看' : '签到'}
          value={isAuthenticated ? `${pendingReviewCount}` : '未建立'}
          palette={palette}
          tone={isAuthenticated && pendingReviewCount > 0 ? 'warning' : 'neutral'}
        />
        <SummaryMetricCard
          label="收藏"
          value={isAuthenticated ? `${favoriteCount}` : '--'}
          palette={palette}
        />
        <SummaryMetricCard
          label="休眠"
          value={isAuthenticated ? `${sleepingCount}` : '--'}
          palette={palette}
        />
      </View>

      <View
        style={[
          styles.sectionGrid,
          deviceClass === 'tablet' ? styles.sectionGridTablet : null,
        ]}
      >
        <InfoCard
          palette={palette}
          style={detailCardStyle}
          title="账号概览"
          items={
            isAuthenticated
              ? [
                  `手机号：${maskPhoneNumber(authState.phoneNumber)}`,
                  `今日签到：${checkedInToday ? '已完成' : '尚未完成'}`,
                  `日级同步：${progressSyncState.label}`,
                  `学习状态：${learningStateSyncState.label}`,
                  authRepositoryMode === 'remote'
                    ? '账号已完成短信验证；会员状态会继续随账号刷新。'
                    : '当前可查看学习与会员状态。',
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
          style={detailCardStyle}
          title="个人学习摘要"
          items={
            isAuthenticated
              ? [
                  `今日已完成 ${completedCount} 张卡，其中首轮 ${learningResults.length} 张、回看 ${reviewResults.length} 张。`,
                  `当前待回看 ${pendingReviewCount} 张。`,
                  `同步说明：${progressSyncState.detail}`,
                  `学习状态说明：${learningStateSyncState.detail}`,
                  '这里保留低成本摘要，详细趋势仍交给统计页。',
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
          style={detailCardStyle}
          title="空间标签摘要"
          items={
            isAuthenticated
              ? [
                  `收藏标签 ${favoriteCount} 张。`,
                  `休眠区 ${sleepingCount} 张。`,
                  '收藏是标签，休眠是会影响学习流的空间状态。',
                ]
              : [
                  '登录后才能承接个人空间摘要。',
                  '空间入口仍保持独立顶层导航。',
                  '这里不会把收藏或休眠改写成新的盒子。',
                ]
          }
        />
        <InfoCard
          palette={palette}
          style={detailCardStyle}
          title="这里不承接什么"
          items={[
            '不把购买与恢复入口藏到学习或空间里。',
            '不让账号页替代学习、空间或统计入口。',
            '不把“我的”扩成设置中心或复杂账户系统。',
          ]}
        />
      </View>

      {isAuthenticated ? (
        <MembershipHostCard
          deviceClass={deviceClass}
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
  deviceClass,
  focusGate,
  handlers,
  membershipError,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
}: {
  deviceClass: DeviceClass;
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
              backgroundColor: hexToRgba(palette.warning, 0.12),
              borderColor: palette.border,
            },
          ]}
          testID="membership-focus-gate"
        >
          <Text style={[styles.membershipFocusTitle, { color: palette.warning }]}>
            当前拦截点
          </Text>
          <Text style={[styles.authSummary, { color: palette.textMuted }]}>
            {focusCopy}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.membershipAccessGrid,
          deviceClass === 'tablet' ? styles.membershipAccessGridTablet : null,
        ]}
      >
        {accessSummary.map(item => {
          const [label, value] = item.split('：');

          return (
            <SummaryMetricCard
              key={item}
              label={label}
              value={value}
              palette={palette}
              tone={value === '已开放' ? 'success' : 'warning'}
            />
          );
        })}
      </View>
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
            ? '正在同步会员状态。'
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
  deviceClass,
  gate,
  handlers,
  membershipError,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
}: {
  deviceClass: DeviceClass;
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
        <Text style={[styles.heroEyebrow, { color: palette.warning }]}>
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
            ? '免费态保留基础学习；完整物理空间属于试用或会员体验。'
            : gate === 'review'
            ? '免费态保留基础学习；完整回看和更聪明的引导属于试用或会员体验。'
            : '免费态可以正常学习一部分卡片；完整卡库需要试用或会员。'}
        </Text>
      </View>
      <View
        style={[
          styles.infoCard,
          { backgroundColor: palette.panelStrong, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.infoTitle, { color: palette.text }]}>此刻会放开什么</Text>
        <View
          style={[
            styles.membershipAccessGrid,
            deviceClass === 'tablet' ? styles.membershipAccessGridTablet : null,
          ]}
        >
          <SummaryMetricCard label="基础学习" value="保留" palette={palette} />
          <SummaryMetricCard
            label={gate === 'space' ? '完整空间' : gate === 'review' ? '完整算法' : '完整卡库'}
            value="试用/会员"
            palette={palette}
            tone="warning"
          />
          <SummaryMetricCard label="购买权" value="web / app 同权" palette={palette} />
          <SummaryMetricCard label="恢复购买" value="体验结束后提醒" palette={palette} />
        </View>
      </View>
      <MembershipHostCard
        deviceClass={deviceClass}
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
            结束试用体验
          </Text>
        </Pressable>
      ) : null}
    </View>
  ) : membershipState.stage === 'premium' ? (
    <View style={styles.authActions}>
      <Text style={[styles.authSuccess, { color: palette.success }]}>
        {membershipRepositoryMode === 'remote'
          ? '会员状态已随账号更新。'
          : '会员体验已开启。'}
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
            结束会员体验
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
  const hasRequestedCode = authState.stage !== 'logged_out';

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
          inputAccessoryViewID={
            Platform.OS === 'ios' ? AUTH_KEYBOARD_ACCESSORY_ID : undefined
          }
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

      {hasRequestedCode ? (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
            验证码
          </Text>
          <TextInput
            editable={!isPending && !isAuthenticated}
            inputAccessoryViewID={
              Platform.OS === 'ios' ? AUTH_KEYBOARD_ACCESSORY_ID : undefined
            }
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

      {!isAuthenticated && hasRequestedCode ? (
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
      ) : null}

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
            ? '将通过短信验证码确认身份。'
            : '可用验证码完成登录体验。'}
        </Text>
      </View>

      {authState.error ? (
        <Text style={[styles.authError, { color: palette.danger }]}>
          {authState.error}
        </Text>
      ) : null}

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={AUTH_KEYBOARD_ACCESSORY_ID}>
          <View
            style={[
              styles.keyboardAccessory,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
              },
            ]}
          >
            <Pressable
              onPress={Keyboard.dismiss}
              style={[
                styles.keyboardAccessoryButton,
                { backgroundColor: palette.accent },
              ]}
              testID="auth-dismiss-keyboard-button"
            >
              <Text
                style={[styles.keyboardAccessoryLabel, { color: palette.panel }]}
              >
                完成
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      {isAuthenticated ? (
        <View style={styles.authActions}>
          <Text style={[styles.authSuccess, { color: palette.success }]}>
            {authRepositoryMode === 'remote'
              ? '已完成短信验证码登录。'
              : '已完成登录体验。'}
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
              退出登录
            </Text>
          </Pressable>
        </View>
      ) : null}
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
          当前入口
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
          title="这个入口做什么"
          items={route.highlights}
        />
        <InfoCard palette={palette} title="下一步会接入" items={route.focus} />
        <InfoCard
          palette={palette}
          title="导航与权限"
          items={[
            '顶层顺序固定为 学习 / 空间 / 统计 / 我的。',
            '学习保持最重要入口，空间保持顶层入口。',
            '登录、会员和日级同步都围绕个人备考连续性展开。',
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
  style,
  title,
  items,
}: {
  palette: Palette;
  style?: StyleProp<ViewStyle>;
  title: string;
  items: string[];
}) {
  return (
    <View
      style={[
        styles.infoCard,
        style,
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

function SummaryMetricCard({
  label,
  value,
  palette,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  palette: Palette;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const valueColor =
    tone === 'success'
      ? palette.success
      : tone === 'warning'
      ? palette.warning
      : palette.text;

  return (
    <View
      style={[
        styles.summaryMetricCard,
        { backgroundColor: palette.panelStrong, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.summaryMetricValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.summaryMetricLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
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

function shouldClearMembershipGate(
  gate: MembershipGate | null,
  membershipState: MembershipState,
) {
  if (gate === null) {
    return false;
  }

  const access = resolveMembershipAccess(membershipState);

  switch (gate) {
    case 'space':
      return access.completePhysicalSpace;
    case 'review':
      return access.completeAlgorithm;
    case 'library':
      return access.completeCardLibrary;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getUserFacingErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  const remoteStatusMatch = message.match(
    /^Remote (auth request-code|auth verify-code|learning card source request|membership entitlement request|membership mutation|progress sync|learning state sync|space state sync) failed(?: with status| with)? (\d+)\.$/,
  );

  if (!remoteStatusMatch) {
    return message;
  }

  const [, type, statusCode] = remoteStatusMatch;

  switch (type) {
    case 'auth request-code':
      return `验证码发送暂时失败（${statusCode}）。`;
    case 'auth verify-code':
      return `验证码校验暂时失败（${statusCode}）。`;
    case 'membership entitlement request':
      return `会员状态暂时无法读取（${statusCode}）。`;
    case 'membership mutation':
      return `会员状态更新暂时失败（${statusCode}）。`;
    case 'learning card source request':
      return `学习卡片加载暂时失败（${statusCode}）。`;
    case 'progress sync':
      return `学习进展同步暂时失败（${statusCode}）。`;
    case 'learning state sync':
      return `学习状态同步暂时失败（${statusCode}）。`;
    case 'space state sync':
      return `空间状态同步暂时失败（${statusCode}）。`;
    default:
      return message;
  }
}

function shouldQueueMembershipTrialStart(error: unknown) {
  const message = getErrorMessage(error, '');

  return (
    /Remote membership mutation failed with 5\d{2}\./.test(message) ||
    /network error/i.test(message) ||
    /network request failed/i.test(message) ||
    /failed to fetch/i.test(message)
  );
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
        ? `完整试用已开启 ${membershipState.trialDurationDays} 天，完整卡库、空间和更聪明的引导会一起放开。`
        : `完整试用已开启 ${membershipState.trialDurationDays} 天，帮助你完整感受内容、引导和物理空间的价值。`;
    case 'free':
      return '当前只保留基础学习，并把完整卡库、完整空间和完整算法收回到试用/会员权限后。';
    case 'premium':
      return mode === 'remote'
        ? '会员状态已随账号生效，完整卡库、完整空间和完整算法都已放开。'
        : '会员体验已开启，完整卡库、完整空间和完整算法都已放开。';
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaBody: {
    flex: 1,
  },
  auroraRoot: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  auroraOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  auroraOrbPrimary: {
    width: 320,
    height: 320,
    top: -64,
    left: -88,
  },
  auroraOrbSecondary: {
    width: 280,
    height: 280,
    top: 84,
    right: -96,
  },
  auroraOrbWarm: {
    width: 260,
    height: 260,
    bottom: 132,
    right: -72,
  },
  auroraOrbCool: {
    width: 220,
    height: 220,
    bottom: -24,
    left: 32,
  },
  shellRoot: {
    flex: 1,
    gap: 12,
  },
  shellContent: {
    flex: 1,
  },
  tabletRoot: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  sidebar: {
    width: 300,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderRadius: 32,
    gap: 18,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 6,
  },
  sidebarNav: {
    gap: 12,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 24,
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
    gap: 12,
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
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginHorizontal: 20,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 5,
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
    fontSize: 28,
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
    paddingBottom: 28,
    gap: 16,
  },
  authCanvasContent: {
    paddingBottom: 180,
  },
  canvasContentTablet: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 6,
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
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 4,
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
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  authActions: {
    gap: 10,
  },
  keyboardAccessory: {
    alignItems: 'flex-end',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyboardAccessoryButton: {
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  keyboardAccessoryLabel: {
    fontSize: 15,
    fontWeight: '800',
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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 4,
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
  sectionGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoCardHalf: {
    width: '48%',
  },
  profileMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileMetricRowTablet: {
    gap: 12,
  },
  summaryMetricCard: {
    minWidth: 112,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  summaryMetricValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
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
    borderRadius: 22,
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
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  membershipAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  membershipAccessGridTablet: {
    gap: 12,
  },
  phoneTabBarWrap: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  phoneTabBar: {
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 6,
  },
  phoneTabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
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
});

export default App;
