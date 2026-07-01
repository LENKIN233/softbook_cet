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
import {
  LearningResultDetailSurface,
  LearningSurface,
} from './src/learning/LearningSurface';
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
import {
  SpaceSurface,
  type SpaceStatusRail,
  type SpaceSurfaceScreen,
} from './src/space/SpaceSurface';
import { StatisticsSurface } from './src/statistics/StatisticsSurface';
import { formatLearningSessionDisplayLabel } from './src/shared/uiMetadata/displayMetadata';
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
import { hexToRgba } from './src/visual/tokens';

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type DeviceClass = 'phone' | 'tablet';
type AuthStage = 'logged_out' | 'code_sent' | 'authenticated';
type MembershipGate = 'space' | 'review' | 'library';
type LearningSurfaceScreen = 'practice' | 'result_detail';

type AppProps = {
  softbookRemoteRuntimeProfile?: SoftbookRemoteRuntimeProfile;
};

type ShellRoute = {
  key: RouteKey;
  label: string;
  badge: string;
  eyebrow: string;
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

type SyncStatusState = {
  detail: string;
  label: string;
  state: 'idle' | 'syncing' | 'synced' | 'error';
};

type ProgressSyncState = SyncStatusState;
type LearningStateSyncState = SyncStatusState;
type SpaceStateSyncState = SyncStatusState;

type LearningBootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';
type LearningPhase = 'learning' | 'review';

type SpaceCardState = {
  isFavorited: boolean;
  isSleeping: boolean;
};

const SHELL_ACCENT = '#637783';
const SHELL_DEPTH = '#86A3A1';

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
    badge: '练',
    eyebrow: '继续学习',
  },
  {
    key: 'space',
    label: '空间',
    badge: '位',
    eyebrow: '知识空间',
  },
  {
    key: 'statistics',
    label: '统计',
    badge: '记',
    eyebrow: '今日进展',
  },
  {
    key: 'mine',
    label: '我的',
    badge: '我',
    eyebrow: '账号与会员',
  },
];

const LIGHT_PALETTE: Palette = {
  background: '#F0F0EA',
  panel: 'rgba(255,255,250,0.84)',
  panelStrong: 'rgba(255,255,252,0.96)',
  border: 'rgba(18,19,26,0.11)',
  text: '#12131A',
  textMuted: '#626977',
  accent: SHELL_ACCENT,
  accentSoft: hexToRgba(SHELL_ACCENT, 0.12),
  accentStrong: '#2F4650',
  tabIdle: '#8D948D',
  success: '#249B77',
  warning: '#C98524',
  danger: '#B6545B',
};

const DARK_PALETTE: Palette = {
  background: '#0B0B12',
  panel: 'rgba(28,28,42,0.74)',
  panelStrong: 'rgba(34,36,52,0.92)',
  border: 'rgba(255,255,255,0.08)',
  text: '#F2F1EB',
  textMuted: '#B8B8CE',
  accent: '#7C8BFF',
  accentSoft: hexToRgba(SHELL_ACCENT, 0.2),
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

const INITIAL_SPACE_STATE_SYNC_STATE: SpaceStateSyncState = {
  detail: '当前还没有需要同步的空间状态。',
  label: '等待空间状态',
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
  const [learningScreen, setLearningScreen] =
    useState<LearningSurfaceScreen>('practice');
  const [spaceScreen, setSpaceScreen] =
    useState<SpaceSurfaceScreen>('overview');
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
  const [reviewSessionCards, setReviewSessionCards] = useState<LearningCard[]>(
    [],
  );
  const [reviewCompletedResults, setReviewCompletedResults] = useState<
    LearningCardResult[]
  >([]);
  const [checkedInDayKey, setCheckedInDayKey] = useState<string | null>(null);
  const [progressSyncState, setProgressSyncState] = useState<ProgressSyncState>(
    INITIAL_PROGRESS_SYNC_STATE,
  );
  const [learningStateSyncState, setLearningStateSyncState] =
    useState<LearningStateSyncState>(INITIAL_LEARNING_STATE_SYNC_STATE);
  const [spaceStateSyncState, setSpaceStateSyncState] =
    useState<SpaceStateSyncState>(INITIAL_SPACE_STATE_SYNC_STATE);
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
  const previousMembershipStage = useRef<MembershipStage>(
    membershipState.stage,
  );
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
      stateMap[cardId] ?? { isFavorited: false, isSleeping: false },
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
  const resolveVisibleLearningCards = useCallback(
    (
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
    },
    [learningSession, membershipState, readSpaceCardState, spaceCardStateById],
  );
  const resolveSleepingAccessibleCards = useCallback(
    (
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
        card => readSpaceCardState(card.card_id, stateMap).isSleeping,
      );
    },
    [learningSession, membershipState, readSpaceCardState, spaceCardStateById],
  );
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
      !reviewCompletedResults.some(result => result.cardId === card.card_id),
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
        const replayedProgressKey = JSON.stringify(
          result.entry.payload.snapshot,
        );

        setLastSyncedProgressKey(replayedProgressKey);

        if (replayedProgressKey === dailyProgressKey) {
          setProgressSyncState({
            detail: '网络恢复后，今天的学习进展已同步。',
            label: '已同步',
            state: 'synced',
          });
        }

        return;
      }

      if (result.entry.type === 'sync_space_state') {
        const replayedSpaceStateKey = JSON.stringify(
          result.entry.payload.snapshot,
        );

        setLastSyncedSpaceStateKey(replayedSpaceStateKey);

        if (replayedSpaceStateKey === spaceStateSyncKey) {
          setSpaceStateSyncState({
            detail: '网络恢复后，空间收藏和休眠状态已同步。',
            label: '已同步',
            state: 'synced',
          });
        }

        return;
      }

      if (result.entry.type === 'sync_learning_state') {
        const replayedLearningStateKey = JSON.stringify(
          result.entry.payload.snapshot,
        );

        setLastSyncedLearningStateKey(replayedLearningStateKey);

        if (replayedLearningStateKey === learningStateSyncKey) {
          setLearningStateSyncState({
            detail: '网络恢复后，当前答题记录已同步。',
            label: '已同步',
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
    spaceStateSyncKey,
  ]);

  const countCompletedCards = useCallback(
    (cards: LearningCard[], results: LearningCardResult[]) =>
      cards.filter(card =>
        results.some(result => result.cardId === card.card_id),
      ).length,
    [],
  );

  const resetLearningDeck = useCallback(
    (
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
    },
    [
      createTrackedLearningCardState,
      learningSession,
      membershipState,
      resolveVisibleLearningCards,
      spaceCardStateById,
    ],
  );

  const reconcileLearningDeckState = useCallback(
    (
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
          ? createTrackedLearningCardState(
              nextSessionCards[nextIndex],
              stateMap,
            )
          : null,
      );
    },
    [
      countCompletedCards,
      createTrackedLearningCardState,
      learningCompletedResults,
      learningPhase,
      learningSession,
      membershipState,
      resolveVisibleLearningCards,
      reviewCompletedResults,
      spaceCardStateById,
    ],
  );

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
      setSpaceStateSyncState(INITIAL_SPACE_STATE_SYNC_STATE);
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
          )} 网络恢复后会自动再试。`,
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
        detail: '先产生今天的学习进展，再同步今日进展。',
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
        detail: '今天的学习进展已记录。',
        label: '已记录',
        state: 'synced',
      });
      return;
    }

    let isCancelled = false;

    setProgressSyncState({
      detail: `正在同步 ${dailyProgressSnapshot.dayKey} 的学习进展。`,
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
              : '今天的学习进展已记录。',
          label: result.mode === 'remote' ? '已同步' : '已记录',
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
          detail: `${getUserFacingErrorMessage(
            error,
            '日级进展同步失败。',
          )} 网络恢复后会自动再试。`,
          label: '待重试',
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
        detail: '当前答题记录已记录。',
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
          detail: '当前答题记录已同步。',
          label: '已同步',
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
          detail: `${getUserFacingErrorMessage(
            error,
            '学习状态同步失败。',
          )} 网络恢复后会自动再试。`,
          label: '待重试',
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
      setSpaceStateSyncState({
        detail: '空间收藏和休眠状态已记录。',
        label: '已记录',
        state: 'synced',
      });
      return;
    }

    if (authenticatedRuntimeContext === null) {
      setSpaceStateSyncState({
        detail: '当前缺少可用的登录上下文，空间状态无法同步。',
        label: '同步受阻',
        state: 'error',
      });
      return;
    }

    let isCancelled = false;

    setSpaceStateSyncState({
      detail:
        '正在同步空间里的收藏和休眠状态；当前位置和卡片列表仍可继续浏览。',
      label: '同步中',
      state: 'syncing',
    });
    startMutationReplay().catch(() => undefined);

    spaceStateRepository
      .syncSpaceState(authenticatedRuntimeContext, spaceStateSnapshot)
      .then(() => {
        if (isCancelled) {
          return;
        }

        setLastSyncedSpaceStateKey(spaceStateSyncKey);
        setSpaceStateSyncState({
          detail: '空间收藏和休眠状态已同步。',
          label: '已同步',
          state: 'synced',
        });
      })
      .catch((error: unknown) => {
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
        setSpaceStateSyncState({
          detail: `${getUserFacingErrorMessage(
            error,
            '空间状态同步失败。',
          )} 网络恢复后会自动再试，当前空间仍可继续使用。`,
          label: '待重试',
          state: 'error',
        });
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
      setLearningBootstrapError('当前登录状态不可用，本轮卡片无法加载。');
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
          getUserFacingErrorMessage(error, '本轮卡片加载失败。'),
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
        setLearningScreen('practice');
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
            )} 已先放行本次完整试用；网络恢复后会自动再试。`,
          );
          setMembershipPendingAction(null);
          completeMembershipUnlock(
            startMembershipTrial(membershipState),
            nextGate,
          );
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
      !membershipAccess.completePhysicalSpace
    ) {
      setMembershipGate('space');
    }

    startTransition(() => {
      setActiveRoute(nextRoute);
      setLearningScreen('practice');
      setSpaceScreen('overview');
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
            error: getUserFacingErrorMessage(error, '验证码请求暂时失败。'),
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
                  `membership:${
                    session.authToken ?? session.phoneNumber
                  }:login`,
                )
                .catch(() => undefined)
                .then(() => ({
                  membershipErrorMessage: `${getUserFacingErrorMessage(
                    error,
                    '会员状态暂时无法读取。',
                  )} 已保留登录态；网络恢复后会自动再试。`,
                  membershipRefreshSucceeded: false,
                  membershipState: createEntitlementPendingMembershipState(),
                  session,
                }));
            });
        })
        .then(
          ({
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
          },
        )
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
      setSpaceStateSyncState(INITIAL_SPACE_STATE_SYNC_STATE);
      startTransition(() => {
        setActiveRoute('mine');
        setLearningScreen('practice');
        setSpaceScreen('overview');
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
            getUserFacingErrorMessage(error, '会员开通暂时失败。'),
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
            getUserFacingErrorMessage(error, '恢复购买提醒暂时无法更新。'),
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
      setLearningScreen('practice');
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
      setLearningScreen('practice');
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
      setLearningScreen('practice');

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
          setLearningScreen('practice');
          setSpaceScreen('overview');
        });
        return;
      }

      setLearningPhase('review');
      setReviewSessionCards(reviewCandidateCards);
      setReviewCompletedResults([]);
      setLearningIndex(0);
      setLearningCurrentResult(null);
      setLearningScreen('practice');
      setLearningCardState(
        createTrackedLearningCardState(reviewCandidateCards[0]),
      );
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

      if (
        currentLearningCard?.card_id === cardId &&
        learningCardState !== null
      ) {
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
  const retryLearningBootstrap = () => {
    setLearningBootstrapStatus('idle');
    setLearningBootstrapError(null);
  };

  const accessibleSpaceCards = learningSession
    ? learningSession.catalogCards.slice(
        0,
        resolveAccessibleLearningCardCount(
          learningSession.catalogCards.length,
          membershipState,
        ),
      )
    : [];
  const spaceSurfaceCards = membershipAccess.completePhysicalSpace
    ? learningSession?.catalogCards ?? []
    : accessibleSpaceCards;
  const spaceGateRail =
    route.key === 'space' && !membershipAccess.completePhysicalSpace
      ? {
          actionSlot: (
            <>
              {membershipError ? (
                <Text style={[styles.authError, { color: palette.danger }]}>
                  {membershipError}
                </Text>
              ) : null}
              <MembershipActionGroup
                handlers={membershipHandlers}
                membershipPendingAction={membershipPendingAction}
                membershipRepositoryMode={runtimeMembershipRepositoryMode}
                membershipState={membershipState}
                palette={palette}
              />
            </>
          ),
          detail:
            '当前保留已解锁卡片的空间预览和位置提示；完整卡片浏览、收藏/休眠调整与更多空间操作需要试用或会员。',
          label:
            membershipPendingAction === 'start_trial'
              ? '正在开通'
              : '完整空间受限',
          title: '完整物理空间需要试用或会员',
        }
      : null;
  const spaceStatusRail: SpaceStatusRail | null =
    route.key === 'space' && learningBootstrapStatus !== 'ready'
      ? {
          actionSlot:
            learningBootstrapStatus === 'error' ? (
              <Pressable
                onPress={retryLearningBootstrap}
                style={[
                  styles.primaryButton,
                  styles.compactButton,
                  { backgroundColor: palette.accent },
                ]}
                testID="space-bootstrap-retry-button"
              >
                <Text
                  style={[styles.primaryButtonLabel, { color: palette.panel }]}
                >
                  重新加载空间内容
                </Text>
              </Pressable>
            ) : null,
          detail:
            learningBootstrapStatus === 'error'
              ? `${
                  learningBootstrapError ?? '空间内容暂时不可用。'
                } 空间会保留当前位置，重试后再恢复卡片列表。`
              : '正在整理本轮卡片；空间当前位置会先保留在原位。',
          label: learningBootstrapStatus === 'error' ? '可重试' : '加载中',
          state: learningBootstrapStatus === 'error' ? 'error' : 'loading',
          title:
            learningBootstrapStatus === 'error'
              ? '空间内容暂时不可用'
              : '正在整理空间内容',
        }
      : null;
  const spaceSyncRail =
    route.key === 'space' &&
    runtimeSpaceStateMode === 'remote' &&
    spaceStateSyncState.state !== 'idle'
      ? {
          detail: spaceStateSyncState.detail,
          label: spaceStateSyncState.label,
          state: spaceStateSyncState.state,
          title:
            spaceStateSyncState.state === 'error'
              ? '空间状态待重试'
              : spaceStateSyncState.state === 'syncing'
              ? '正在同步空间状态'
              : '空间状态已同步',
        }
      : null;

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
      onGoToLearning={() => {
        startTransition(() => {
          setActiveRoute('learning');
          setLearningScreen('practice');
          setSpaceScreen('overview');
        });
      }}
      onGoToSpace={() => {
        startTransition(() => {
          setActiveRoute('space');
          setLearningScreen('practice');
          setSpaceScreen('overview');
        });
      }}
      onGoToStatistics={() => {
        startTransition(() => {
          setActiveRoute('statistics');
          setLearningScreen('practice');
          setSpaceScreen('overview');
        });
      }}
      palette={palette}
      learningStateSyncState={learningStateSyncState}
      progressSyncState={progressSyncState}
      reviewResults={reviewCompletedResults}
      sleepingCount={sleepingCount}
    />
  ) : route.key === 'learning' && learningBootstrapStatus !== 'ready' ? (
    <LearningBootstrapSurface
      error={
        learningBootstrapStatus === 'error' ? learningBootstrapError : null
      }
      onRetry={retryLearningBootstrap}
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
          setLearningScreen('practice');
          setSpaceScreen('overview');
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
  ) : route.key === 'learning' &&
    learningScreen === 'result_detail' &&
    currentLearningCard !== null &&
    learningCardState !== null &&
    learningCurrentResult !== null ? (
    <LearningResultDetailSurface
      card={currentLearningCard}
      cardState={learningCardState}
      isLastCard={learningIndex === activeSessionCards.length - 1}
      onAdvanceCard={learningHandlers.onAdvanceCard}
      onBackToPractice={() => setLearningScreen('practice')}
      palette={palette}
      phase={learningPhase}
      result={learningCurrentResult}
      sessionLabel={formatLearningSessionDisplayLabel(learningPhase)}
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
      onOpenResultDetail={() => setLearningScreen('result_detail')}
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
      sessionLabel={formatLearningSessionDisplayLabel(learningPhase)}
    />
  ) : route.key === 'space' ? (
    <SpaceSurface
      cardStateById={spaceCardStateById}
      currentLearningCard={currentLearningCard}
      deviceClass={deviceClass}
      onBackToOverview={() => setSpaceScreen('overview')}
      onOpenCardList={() => setSpaceScreen('card_list')}
      onReturnToLearning={() => {
        startTransition(() => {
          setActiveRoute('learning');
          setLearningScreen('practice');
          setSpaceScreen('overview');
        });
      }}
      onToggleFavoriteTag={spaceHandlers.onToggleFavoriteTag}
      onToggleSleepState={spaceHandlers.onToggleSleepState}
      palette={palette}
      screen={spaceScreen}
      spaceCards={spaceSurfaceCards}
      spaceGateRail={spaceGateRail}
      spaceStatusRail={spaceStatusRail}
      spaceSyncRail={spaceSyncRail}
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
  ) : null;

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
    <View style={styles.stateScreen}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          学习准备
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {isLoading ? '正在准备本轮学习' : '本轮学习暂时不可用'}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {isLoading
            ? '正在整理本轮要学的卡片，准备好后会直接开始当前卡。'
            : '已登录，但这次没能拿到可用卡片。可以在这里重试。'}
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
                '准备完成后会自动回到当前练习。',
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
            重新加载本轮卡片
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
            本轮卡片准备好后才会开始当前卡。
          </Text>
        </View>
      )}
    </View>
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
    <View style={styles.stateScreen}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          休眠区
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          当前学习卡都已进入休眠区
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {canRecoverInPlace
            ? '当前免费态还不能进入完整空间，但为了保留基础学习，可以先把一张可学习卡移出休眠区，再继续当前学习。'
            : '按空间里的休眠设置，进入休眠区的卡不会继续出现在当前练习里。先去空间里把需要恢复的卡移出休眠区，再继续当前学习。'}
        </Text>
      </View>
      <InfoCard
        palette={palette}
        title="为什么现在不能继续学习"
        items={
          canRecoverInPlace
            ? [
                '休眠会让卡片暂时退出当前练习，不是普通标签。',
                '免费态仍需保留基础学习，所以这里提供一条窄恢复口，不直接放开完整空间。',
                recoverableCard
                  ? `下一张可恢复卡：${recoverableCard.front.prompt}`
                  : '当前没有可恢复卡。',
              ]
            : [
                '休眠会让卡片暂时退出当前练习，不是普通标签。',
                '进入休眠后，这张卡会先从当前练习里移出。',
                '恢复后回到学习，就能继续当前练习。',
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
    </View>
  );
}

function AuroraBackdrop() {
  return (
    <View pointerEvents="none" style={styles.auroraRoot}>
      <View style={[styles.auroraField, styles.auroraFieldTop]} />
      <View style={[styles.auroraField, styles.auroraFieldBase]} />
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
      <PhoneTopBar authState={authState} palette={palette} route={route} />
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

function PhoneTopBar({
  authState,
  palette,
  route,
}: {
  authState: AuthState;
  palette: Palette;
  route: ShellRoute;
}) {
  const routeCue =
    route.key === 'learning'
      ? '继续当前卡'
      : route.key === 'space'
      ? '查看卡片位置'
      : route.key === 'statistics'
      ? '今日进展'
      : '账号与会员';

  return (
    <View
      style={[
        styles.phoneTopBar,
        route.key === 'learning' ? styles.phoneTopBarLearning : null,
        { backgroundColor: palette.panel, borderColor: palette.border },
      ]}
    >
      <View style={styles.phoneTopCopy}>
        <Text
          style={[
            styles.phoneTopTitle,
            route.key === 'learning' ? styles.phoneTopTitleLearning : null,
            { color: palette.text },
          ]}
        >
          {route.label}
        </Text>
        <Text
          style={[
            styles.phoneTopMeta,
            route.key === 'learning' ? styles.phoneTopMetaLearning : null,
            { color: palette.textMuted },
          ]}
        >
          {routeCue}
        </Text>
      </View>
      <View
        style={[
          styles.phoneTopPill,
          {
            backgroundColor: palette.panelStrong,
            borderColor: palette.border,
          },
        ]}
      >
        <Text style={[styles.phoneTopPillText, { color: palette.textMuted }]}>
          {authState.stage === 'authenticated' ? '已登录' : '未登录'}
        </Text>
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
          备考主页
        </Text>
        <Text style={[styles.brandTitle, { color: palette.text }]}>
          软书四六级
        </Text>
        <Text style={[styles.brandSummary, { color: palette.textMuted }]}>
          登录后从当前卡继续；空间、统计和“我的”分别查看位置、进展和个人状态。
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
  const authText = authState.stage === 'authenticated' ? '已登录' : '未登录';

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
              ? '当前卡已经准备好，先完成这一张。'
              : '左侧保留导航，右侧继续当前卡。'
            : route.key === 'space'
            ? '从当前位置看卡片、收藏和休眠状态。'
            : route.key === 'statistics'
            ? '看今天完成了什么、还有多少需要回看。'
            : deviceClass === 'phone'
            ? '查看账号、试用、会员和个人学习状态。'
            : '左侧保留导航，右侧查看个人学习状态。'}
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
  const hasSentCode = authState.stage === 'code_sent';
  const authGateContent =
    route.key === 'space'
      ? {
          continuityItems: [
            { label: '层级', value: '库组盒' },
            { label: '卡片', value: '原位保留' },
            { label: '操作', value: '登录后同步' },
          ],
          eyebrow: '空间位置已保留',
          gateSummary: '验证后回到当前位置，收藏、休眠和会员状态保持一致。',
          gateTitle: '登录后查看空间',
          retainedSummary: '库、组、盒和卡片位置已收好，验证后继续查看。',
          retainedTitle: '空间 · 当前位置',
          returnTarget: '当前位置',
        }
      : route.key === 'statistics'
      ? {
          continuityItems: [
            { label: '完成', value: '已暂存' },
            { label: '回看', value: '待同步' },
            { label: '签到', value: '登录后保存' },
          ],
          eyebrow: '今日记录已保留',
          gateSummary: '验证后查看今日完成、回看和签到状态。',
          gateTitle: '登录后查看今日进展',
          retainedSummary: '完成记录和回看队列已保留，登录后继续同步。',
          retainedTitle: '今日进展 · 待同步',
          returnTarget: '今日进展',
        }
      : route.key === 'mine'
      ? {
          continuityItems: [
            { label: '身份', value: '手机验证' },
            { label: '会员', value: '登录后确认' },
            { label: '记录', value: '跨端同步' },
          ],
          eyebrow: '账号权益待确认',
          gateSummary: '验证后查看会员、购买恢复和同步记录。',
          gateTitle: '登录后查看我的',
          retainedSummary: '会员和学习记录会在登录后恢复到当前账号。',
          retainedTitle: '会员与记录 · 待确认',
          returnTarget: '我的',
        }
      : {
          continuityItems: [
            { label: '卡片', value: '已保留' },
            { label: '位置', value: '原位保留' },
            { label: '记录', value: '登录后保存' },
          ],
          eyebrow: '当前卡已保留',
          gateSummary: '验证码通过后回到这张卡，空间和会员状态保持一致。',
          gateTitle: '登录后继续学习',
          retainedSummary: '题面和位置已收好，验证后继续判断。',
          retainedTitle: '当前卡 · 四选一',
          returnTarget: '当前卡',
        };

  return (
    <View style={styles.authGateScreen}>
      <View
        style={[
          styles.authEntryCard,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <View style={styles.authObjectHeader}>
          <View style={styles.authHeaderMeta}>
            <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
              {authGateContent.eyebrow}
            </Text>
            <View
              style={[
                styles.authObjectBadge,
                {
                  backgroundColor: palette.panelStrong,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text
                style={[styles.authObjectBadgeValue, { color: palette.text }]}
              >
                {hasSentCode ? '验证码已发' : '未登录'}
              </Text>
              <Text
                style={[
                  styles.authObjectBadgeLabel,
                  { color: palette.textMuted },
                ]}
              >
                手机验证
              </Text>
            </View>
          </View>
          <Text
            style={[styles.authGateTitle, { color: palette.text }]}
            testID="auth-gate-title"
          >
            {authGateContent.gateTitle}
          </Text>
          <Text
            style={[styles.authGateSummary, { color: palette.textMuted }]}
            testID="auth-gate-keyboard-dismiss-target"
          >
            {authGateContent.gateSummary}
          </Text>
        </View>
        <View
          style={[
            styles.authRetainedObject,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.authRetainedHead}>
            <View
              pointerEvents="none"
              style={[
                styles.authRetainedAccent,
                { backgroundColor: palette.accent },
              ]}
            />
            <View style={styles.authRetainedCopy}>
              <Text
                numberOfLines={1}
                style={[styles.authRetainedTitle, { color: palette.text }]}
                testID="auth-retained-object-title"
              >
                {authGateContent.retainedTitle}
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.authRetainedSummary,
                  { color: palette.textMuted },
                ]}
                testID="auth-retained-object-summary"
              >
                {authGateContent.retainedSummary}
              </Text>
            </View>
          </View>
          <View style={styles.authRetainedPillRow}>
            {authGateContent.continuityItems.map(item => (
              <View
                key={item.label}
                style={[
                  styles.authRetainedPill,
                  {
                    backgroundColor: palette.panel,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.authContinuityLabel,
                    { color: palette.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.authContinuityValue, { color: palette.text }]}
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <PhoneSmsPanel
          authRepositoryMode={authRepositoryMode}
          authState={authState}
          embedded
          handlers={handlers}
          palette={palette}
          returnTarget={authGateContent.returnTarget}
          title="手机号验证"
          summary={
            authRepositoryMode === 'remote'
              ? `用短信验证码确认身份，完成后回到${authGateContent.returnTarget}。`
              : `输入验证码确认身份，完成后回到${authGateContent.returnTarget}。`
          }
        />
      </View>
    </View>
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
  onGoToLearning,
  onGoToSpace,
  onGoToStatistics,
  palette,
  progressSyncState,
  reviewResults,
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
  membershipPendingAction:
    | 'dismiss_recovery'
    | 'purchase'
    | 'start_trial'
    | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  onGoToLearning: () => void;
  onGoToSpace: () => void;
  onGoToStatistics: () => void;
  palette: Palette;
  progressSyncState: ProgressSyncState;
  reviewResults: LearningCardResult[];
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
  const profileName = isAuthenticated
    ? maskPhoneNumber(authState.phoneNumber)
    : '待验证';
  const profileDetail = isAuthenticated
    ? `${checkedInToday ? '已签到' : '未签到'} · ${completedCount} 张完成`
    : '学习/空间/会员';
  const profileIdentityLabel = isAuthenticated ? '已确认' : '身份';
  const profileProgressLabel = isAuthenticated ? '今日' : '同步';
  const syncDetail = isAuthenticated
    ? progressSyncState.state === 'error' ||
      learningStateSyncState.state === 'error'
      ? '记录待重试'
      : progressSyncState.state === 'syncing' ||
        learningStateSyncState.state === 'syncing'
      ? '记录保存中'
      : '记录已保存'
    : '手机验证码';
  const membershipTitle = isAuthenticated
    ? getMembershipCardTitle(membershipState.stage)
    : '待登录';

  return (
    <View
      style={[
        styles.mineScreen,
        deviceClass === 'tablet' ? styles.mineScreenTablet : null,
      ]}
      testID="mine-surface"
    >
      <View
        style={[
          styles.mineProfilePanel,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
        testID="mine-profile-card"
      >
        <View style={styles.minePassportHeader}>
          <View
            style={[styles.mineAvatar, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.mineAvatarText, { color: palette.panel }]}>
              {isAuthenticated ? '我' : '登'}
            </Text>
          </View>
          <View style={styles.mineAccountHeaderCopy}>
            <Text
              style={[styles.mineAccountEyebrow, { color: palette.accent }]}
            >
              账号与权益
            </Text>
            <Text style={[styles.mineAccountTitle, { color: palette.text }]}>
              {isAuthenticated ? '今天继续这一轮' : '登录后管理我的'}
            </Text>
            <Text
              style={[styles.mineAccountSummary, { color: palette.textMuted }]}
            >
              {isAuthenticated
                ? '账号、会员和购买恢复在这里，不打断学习任务。'
                : '学习记录、空间位置和会员权益会归到同一账号。'}
            </Text>
          </View>
          <View
            style={[
              styles.mineMembershipPill,
              {
                backgroundColor: palette.accentSoft,
                borderColor: hexToRgba(palette.accent, 0.14),
              },
            ]}
          >
            <Text
              style={[styles.mineMembershipPillText, { color: palette.accent }]}
              testID="mine-membership-stage"
            >
              {membershipTitle}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.mineIdentityBand,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.mineIdentityCopy}>
            <Text
              style={[styles.mineIdentityLabel, { color: palette.textMuted }]}
            >
              {profileIdentityLabel}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.mineIdentityValue, { color: palette.text }]}
              testID="mine-profile-phone"
            >
              {profileName}
            </Text>
          </View>
          <View style={styles.mineIdentityCopy}>
            <Text
              style={[styles.mineIdentityLabel, { color: palette.textMuted }]}
            >
              {profileProgressLabel}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.mineIdentityValue, { color: palette.text }]}
              testID="mine-profile-today"
            >
              {profileDetail}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.mineIdentitySync, { color: palette.textMuted }]}
          >
            {syncDetail}
          </Text>
        </View>

        {isAuthenticated ? (
          <>
            <View
              style={[
                styles.mineMetricStrip,
                {
                  backgroundColor: palette.panelStrong,
                  borderColor: palette.border,
                },
                deviceClass === 'tablet' ? styles.mineMetricStripTablet : null,
              ]}
              testID="mine-status-strip"
            >
              <SummaryMetricCard
                label="已完成"
                value={`${completedCount}`}
                palette={palette}
                testID="mine-metric-completed"
              />
              <SummaryMetricCard
                label="待回看"
                value={`${pendingReviewCount}`}
                palette={palette}
                testID="mine-metric-review"
                tone={pendingReviewCount > 0 ? 'warning' : 'neutral'}
              />
              <SummaryMetricCard
                label="收藏"
                value={`${favoriteCount}`}
                palette={palette}
                testID="mine-metric-favorites"
              />
              <SummaryMetricCard
                label="休眠"
                value={`${sleepingCount}`}
                palette={palette}
                testID="mine-metric-sleeping"
              />
            </View>

            <View
              style={[
                styles.mineActionRail,
                {
                  backgroundColor: palette.panelStrong,
                  borderColor: palette.border,
                },
                deviceClass === 'tablet' ? styles.mineActionRailTablet : null,
              ]}
            >
              <MineActionCard
                detail={
                  pendingReviewCount > 0
                    ? `${pendingReviewCount} 张卡等待回看`
                    : '下一张已经准备好'
                }
                label="继续学习"
                onPress={onGoToLearning}
                palette={palette}
                testID="mine-go-learning"
                value="练"
              />
              <MineActionCard
                detail={`${favoriteCount} 收藏 · ${sleepingCount} 休眠`}
                label="查看空间"
                onPress={onGoToSpace}
                palette={palette}
                testID="mine-go-space"
                value="位"
              />
              <MineActionCard
                detail={checkedInToday ? '今日已签到' : '今日未签到'}
                label="今日进展"
                onPress={onGoToStatistics}
                palette={palette}
                testID="mine-go-statistics"
                value="记"
              />
            </View>

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
          </>
        ) : null}
      </View>

      {!isAuthenticated ? (
        <PhoneSmsPanel
          authRepositoryMode={authRepositoryMode}
          authState={authState}
          handlers={handlers}
          palette={palette}
          fullWidthRequestButton
          returnTarget="我的"
          title="手机号验证"
          summary="验证后回到我的，查看记录、空间和会员。"
        />
      ) : null}
    </View>
  );
}

function MineActionCard({
  detail,
  label,
  onPress,
  palette,
  testID,
  value,
}: {
  detail: string;
  label: string;
  onPress: () => void;
  palette: Palette;
  testID: string;
  value: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.mineActionCard, { borderColor: palette.border }]}
      testID={testID}
    >
      <View style={styles.mineActionTopRow}>
        <View
          style={[
            styles.mineActionGlyph,
            {
              backgroundColor: palette.accentSoft,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.mineActionValue, { color: palette.accent }]}>
            {value}
          </Text>
        </View>
        <Text style={[styles.mineActionArrow, { color: palette.textMuted }]}>
          →
        </Text>
      </View>
      <View style={styles.mineActionCopy}>
        <Text
          numberOfLines={1}
          style={[styles.mineActionLabel, { color: palette.text }]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={2}
          style={[styles.mineActionDetail, { color: palette.textMuted }]}
        >
          {detail}
        </Text>
      </View>
    </Pressable>
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
  membershipPendingAction:
    | 'dismiss_recovery'
    | 'purchase'
    | 'start_trial'
    | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  palette: Palette;
}) {
  const access = resolveMembershipAccess(membershipState);
  const accessSummary = [
    { label: '基础学习', open: access.basicLearning },
    { label: '完整卡库', open: access.completeCardLibrary },
    { label: '完整空间', open: access.completePhysicalSpace },
    { label: '智能回看', open: access.completeAlgorithm },
  ];
  const unlockedAccessCount = accessSummary.filter(item => item.open).length;
  const focusCopy =
    focusGate === null
      ? null
      : focusGate === 'review'
      ? '智能回看当前需要试用或会员。开始试用或升级后，会回到学习继续这轮回看。'
      : focusGate === 'space'
      ? '完整知识空间当前需要试用或会员。开始试用或升级后，可以查看完整空间。'
      : '完整卡库当前需要试用或会员。开始试用或升级后，会放开完整卡片。';

  return (
    <View
      style={[
        styles.membershipHostCard,
        { backgroundColor: palette.panelStrong, borderColor: palette.border },
      ]}
      testID="membership-host-card"
    >
      <View style={styles.membershipHeaderRow}>
        <View style={styles.membershipHeaderCopy}>
          <Text style={[styles.infoTitle, { color: palette.text }]}>
            {getMembershipCardTitle(membershipState.stage)}
          </Text>
          <Text
            style={[styles.membershipSummary, { color: palette.textMuted }]}
          >
            {getMembershipCardSummary(
              membershipState,
              membershipRepositoryMode,
            )}
          </Text>
        </View>
        <View
          style={[
            styles.membershipCountPill,
            {
              backgroundColor: palette.accentSoft,
              borderColor: palette.border,
            },
          ]}
        >
          <Text
            style={[styles.membershipCountValue, { color: palette.accent }]}
          >
            {unlockedAccessCount}/4
          </Text>
          <Text
            style={[styles.membershipCountLabel, { color: palette.textMuted }]}
          >
            已开放
          </Text>
        </View>
      </View>
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
          <Text
            style={[styles.membershipFocusTitle, { color: palette.warning }]}
          >
            当前拦截点
          </Text>
          <Text style={[styles.authSummary, { color: palette.textMuted }]}>
            {focusCopy}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.membershipAccessTrack,
          deviceClass === 'tablet' ? styles.membershipAccessTrackTablet : null,
        ]}
        testID="membership-access-strip"
      >
        {accessSummary.map(item => (
          <View
            key={item.label}
            style={[
              styles.membershipAccessStep,
              { borderColor: palette.border },
            ]}
          >
            <View
              style={[
                styles.membershipAccessDot,
                {
                  backgroundColor: item.open
                    ? palette.success
                    : hexToRgba(palette.warning, 0.2),
                  borderColor: item.open ? palette.success : palette.warning,
                },
              ]}
            />
            <Text
              numberOfLines={1}
              style={[styles.membershipAccessLabel, { color: palette.text }]}
            >
              {item.label}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.membershipAccessValue,
                { color: item.open ? palette.success : palette.warning },
              ]}
            >
              {item.open ? '已开放' : '待开放'}
            </Text>
          </View>
        ))}
      </View>
      {membershipState.recoveryPromptVisible ? (
        <View
          style={[
            styles.membershipRecoveryCard,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.membershipFocusTitle, { color: palette.text }]}>
            恢复购买提醒
          </Text>
          <Text
            style={[styles.membershipSummary, { color: palette.textMuted }]}
          >
            {membershipState.lastExperienceEndedBy === 'premium'
              ? '会员体验结束后，恢复购买可继续保留完整空间、完整卡库和智能回看。'
              : '完整试用结束后，恢复购买可继续完整空间与智能回看。'}
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
            <Text
              style={[styles.secondaryButtonLabel, { color: palette.text }]}
            >
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

function MembershipActionGroup({
  handlers,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
}: {
  handlers: MembershipHandlers;
  membershipPendingAction:
    | 'dismiss_recovery'
    | 'purchase'
    | 'start_trial'
    | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  palette: Palette;
}) {
  const isPending = membershipPendingAction !== null;
  const showLocalDebugActions =
    membershipRepositoryMode === 'local' && process.env.NODE_ENV === 'test';

  return membershipState.stage === 'trial_available' ? (
    <View style={styles.membershipActionRow}>
      <Pressable
        disabled={isPending}
        onPress={handlers.onStartTrial}
        style={[
          styles.primaryButton,
          styles.membershipPrimaryAction,
          { backgroundColor: palette.accent },
        ]}
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
          styles.membershipSecondaryAction,
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
            {
              borderColor: palette.border,
              backgroundColor: palette.panelStrong,
            },
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
            {
              borderColor: palette.border,
              backgroundColor: palette.panelStrong,
            },
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
  embedded = false,
  fullWidthRequestButton = false,
  handlers,
  palette,
  returnTarget,
  title,
  summary,
}: {
  authRepositoryMode: 'local' | 'remote';
  authState: AuthState;
  embedded?: boolean;
  fullWidthRequestButton?: boolean;
  handlers: AuthHandlers;
  palette: Palette;
  returnTarget: string;
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
        embedded ? styles.authPanelEmbedded : null,
        {
          backgroundColor: embedded ? 'transparent' : palette.panel,
          borderColor: palette.border,
        },
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
        <View
          style={[
            styles.authCodeSentSlip,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.authCodeSentHeader}>
            <View
              pointerEvents="none"
              style={[
                styles.authCodeSentDot,
                { backgroundColor: palette.accent },
              ]}
            />
            <View style={styles.authCodeSentCopy}>
              <Text
                style={[styles.authCodeSentTitle, { color: palette.text }]}
                testID="auth-code-sent-title"
              >
                验证码已发送
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.authCodeSentMeta, { color: palette.textMuted }]}
              >
                已发送到 {maskPhoneNumber(authState.phoneNumber)}
              </Text>
            </View>
            <Pressable
              disabled={isPending || isAuthenticated}
              onPress={handlers.onRequestCode}
              style={[
                styles.authCodeResendButton,
                {
                  backgroundColor: palette.panel,
                  borderColor: palette.border,
                },
              ]}
              testID="auth-request-code-button"
            >
              <Text
                numberOfLines={1}
                style={[styles.authCodeResendLabel, { color: palette.text }]}
              >
                {authState.pendingAction === 'request_code'
                  ? '请求中'
                  : '重新发送'}
              </Text>
            </Pressable>
          </View>
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
                  backgroundColor: palette.panel,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              testID="auth-code-input"
              textContentType="oneTimeCode"
              value={authState.smsCode}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.authCodeSentMeta, { color: palette.textMuted }]}
          >
            完成后回到{returnTarget}。
          </Text>
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
            {authState.pendingAction === 'verify_code'
              ? '正在登录'
              : '完成登录'}
          </Text>
        </Pressable>
      ) : null}

      {!hasRequestedCode ? (
        <View style={styles.authActions}>
          <Pressable
            disabled={isPending || isAuthenticated}
            onPress={handlers.onRequestCode}
            style={[
              styles.primaryButton,
              embedded || fullWidthRequestButton ? null : styles.compactButton,
              {
                backgroundColor: palette.accent,
                borderColor: palette.accent,
              },
            ]}
            testID="auth-request-code-button"
          >
            <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
              {authState.pendingAction === 'request_code'
                ? '正在请求验证码'
                : '请求验证码'}
            </Text>
          </Pressable>
          <Text style={[styles.authHint, { color: palette.textMuted }]}>
            {authState.pendingAction === 'request_code'
              ? '正在向当前手机号请求验证码。'
              : authRepositoryMode === 'remote'
              ? '将通过短信验证码确认身份。'
              : `验证码通过后会回到${returnTarget}。`}
          </Text>
        </View>
      ) : null}

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
                style={[
                  styles.keyboardAccessoryLabel,
                  { color: palette.panel },
                ]}
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
              : '已完成登录。'}
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
  palette,
  testID,
  tone = 'neutral',
  value,
}: {
  label: string;
  palette: Palette;
  testID?: string;
  tone?: 'neutral' | 'success' | 'warning';
  value: string;
}) {
  const valueColor =
    tone === 'success'
      ? palette.success
      : tone === 'warning'
      ? palette.warning
      : palette.text;

  return (
    <View
      style={[styles.summaryMetricCard, { borderColor: palette.border }]}
      testID={testID}
    >
      <Text style={[styles.summaryMetricValue, { color: valueColor }]}>
        {value}
      </Text>
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

const INTERNAL_ERROR_COPY_PATTERN =
  /\b(Remote|payload|source_id|source_label|card_records|remoteConfig|authToken|endpoint|repository|card_id|knowledge_ref|box_ref|space_metadata|MutationQueue|runtime|SHELL|FLOW|GATE|SETUP|PROFILE|STATUS|SYNC)\b|data\.|卡源|离线队列|离线重试|本机缓存|当前设备|会员矩阵|占位|快照|顶层|入口|最重要|服务核心价值|账户与会员|壳层|页面内部|最小必要信息|首读路径|低成本|轻量|会员边界|主要任务|复杂设置中心|模块选择|复杂大盘|复杂管理器|承接|权限|主路径|单卡流|学习流|product_truth|implementation_hypothesis|design artifact|harness|Agent review|PR 描述/i;

function getUserFacingErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  const remoteStatusMatch = message.match(
    /^Remote (auth request-code|auth verify-code|learning card source request|membership entitlement request|membership mutation|progress sync|learning state sync|space state sync) failed(?: with status| with)? (\d+)\.$/,
  );

  if (!remoteStatusMatch) {
    return INTERNAL_ERROR_COPY_PATTERN.test(message) ? fallback : message;
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
      return '试用从第一次计入学习开始；完整卡库、空间和回看会一起放开。';
    case 'trial':
      return mode === 'remote'
        ? `完整试用 ${membershipState.trialDurationDays} 天已开启，空间和回看同步放开。`
        : `完整试用 ${membershipState.trialDurationDays} 天已开启，先完整体验路线和空间。`;
    case 'free':
      return '当前保留基础学习；完整空间、卡库和回看需要会员。';
    case 'premium':
      return mode === 'remote'
        ? '会员状态已随账号生效，完整卡库、空间和回看已放开。'
        : '会员体验已开启，完整卡库、空间和回看已放开。';
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
  auroraField: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  auroraFieldTop: {
    height: 280,
    top: -64,
    backgroundColor: hexToRgba(SHELL_ACCENT, 0.14),
  },
  auroraFieldBase: {
    height: 360,
    bottom: -24,
    backgroundColor: hexToRgba(SHELL_DEPTH, 0.1),
  },
  shellRoot: {
    flex: 1,
    gap: 8,
  },
  shellContent: {
    flex: 1,
    minHeight: 0,
  },
  phoneTopBar: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 4,
    paddingHorizontal: 13,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  phoneTopBarLearning: {
    marginTop: 2,
    paddingVertical: 7,
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  phoneTopCopy: {
    flex: 1,
    gap: 2,
  },
  phoneTopTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  phoneTopTitleLearning: {
    fontSize: 16,
  },
  phoneTopMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  phoneTopMetaLearning: {
    fontSize: 11,
  },
  phoneTopPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  phoneTopPillText: {
    fontSize: 12,
    fontWeight: '700',
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
    borderRadius: 24,
    paddingHorizontal: 17,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 18,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.09,
    shadowRadius: 28,
    elevation: 5,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  headerMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  headerPill: {
    minWidth: 50,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  stateScreen: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  authGateScreen: {
    flex: 1,
    gap: 10,
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  authEntryCard: {
    borderWidth: 1,
    borderRadius: 28,
    gap: 13,
    paddingHorizontal: 16,
    paddingVertical: 15,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 5,
  },
  authObjectHeader: {
    gap: 8,
  },
  authHeaderMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    width: '100%',
  },
  authGateTitle: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 33,
  },
  authGateSummary: {
    fontSize: 14,
    lineHeight: 21,
  },
  authRetainedObject: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  authRetainedHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  authRetainedAccent: {
    borderRadius: 999,
    height: 44,
    width: 5,
  },
  authRetainedCopy: {
    flex: 1,
    gap: 3,
  },
  authRetainedTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  authRetainedSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  authRetainedPillRow: {
    flexDirection: 'row',
    gap: 7,
  },
  authRetainedPill: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  authObjectBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  authObjectBadgeValue: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  authObjectBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
  authContinuityRail: {
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
  },
  authContinuityItem: {
    alignItems: 'flex-start',
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  authContinuityDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  authContinuityLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  authContinuityValue: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 11,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 4,
  },
  authPanelEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    elevation: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    shadowOpacity: 0,
  },
  authSummary: {
    fontSize: 14,
    lineHeight: 21,
  },
  authCodeSentSlip: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  authCodeSentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  authCodeSentDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  authCodeSentCopy: {
    flex: 1,
    gap: 1,
  },
  authCodeSentTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  authCodeSentMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  authCodeResendButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  authCodeResendLabel: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 12,
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
    paddingVertical: 13,
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
  mineMetricStripTablet: {
    gap: 12,
  },
  summaryMetricCard: {
    minWidth: 68,
    flexGrow: 1,
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 3,
  },
  summaryMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 9,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
    fontSize: 12,
    lineHeight: 18,
  },
  mineScreen: {
    flex: 1,
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  mineScreenTablet: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  mineProfilePanel: {
    alignItems: 'stretch',
    borderRadius: 26,
    borderWidth: 1,
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.09,
    shadowRadius: 30,
    elevation: 4,
  },
  minePassportHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 11,
  },
  mineAccountHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  mineAccountEyebrow: {
    fontSize: 12,
    fontWeight: '800',
  },
  mineAccountTitle: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 28,
  },
  mineAccountSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  mineAvatar: {
    alignItems: 'center',
    borderRadius: 24,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  mineAvatarText: {
    fontSize: 19,
    fontWeight: '800',
  },
  mineMembershipPill: {
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 118,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  mineMembershipPillText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  mineIdentityBand: {
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mineIdentityCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  mineIdentityLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  mineIdentityValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  mineIdentitySync: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 88,
    textAlign: 'right',
  },
  mineMetricStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  mineActionRail: {
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mineActionRailTablet: {
    flexDirection: 'row',
  },
  mineActionCard: {
    alignItems: 'stretch',
    borderRightWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 86,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  mineActionTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mineActionCopy: {
    gap: 3,
    minWidth: 0,
  },
  mineActionGlyph: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  mineActionValue: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  mineActionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  mineActionDetail: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
  },
  mineActionArrow: {
    fontSize: 14,
    fontWeight: '800',
  },
  membershipHostCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowOpacity: 0,
    elevation: 0,
  },
  membershipHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  membershipHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  membershipSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  membershipCountPill: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  membershipCountValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  membershipCountLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  membershipFocusCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  membershipFocusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  membershipRecoveryCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  membershipAccessStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  membershipAccessStripTablet: {
    gap: 8,
  },
  membershipAccessChip: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  membershipAccessTrack: {
    flexDirection: 'row',
    gap: 4,
  },
  membershipAccessTrackTablet: {
    gap: 8,
  },
  membershipAccessStep: {
    borderTopWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 0,
    paddingTop: 7,
  },
  membershipAccessDot: {
    borderRadius: 999,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
  membershipAccessLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  membershipAccessValue: {
    fontSize: 10,
    fontWeight: '800',
  },
  membershipActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  membershipPrimaryAction: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  membershipSecondaryAction: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  phoneTabBarWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  phoneTabBar: {
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    paddingHorizontal: 5,
    paddingVertical: 5,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  phoneTabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  phoneTabBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  phoneTabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default App;
