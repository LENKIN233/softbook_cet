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
import { createAuthenticatedFetch } from './src/auth/authenticatedFetch';
import { resolveAuthRepositoryConfig } from './src/auth/authRuntimeConfig';
import { createAuthSessionCoordinator } from './src/auth/authSessionCoordinator';
import {
  getAuthAccessToken,
  getAuthSessionScopeKey,
  type AuthChallenge,
  type AuthSession,
} from './src/auth/authSession';
import {
  reconcileAccountBootstrap,
  resolveAccountBootstrapLearningState,
} from './src/bootstrap/accountBootstrapHydration';
import {
  createAccountBootstrapRepository,
  type AccountBootstrapSnapshot,
} from './src/bootstrap/accountBootstrapRepository';
import { resolveAccountBootstrapRepositoryConfig } from './src/bootstrap/accountBootstrapRuntimeConfig';
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
import { createAuthSessionStore } from './src/persistence/authSessionStore';
import {
  createUserStateStore,
  LEGACY_SPACE_STATE_TIMESTAMP,
  type PersistedLearningCursor,
  type PersistedUserState,
} from './src/persistence/userStateStore';
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
  mergeSpaceStateMaps,
  spaceStateSnapshotToMap,
  type SpaceCardStateValue,
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
import { createLearningEventSyncRepository } from './src/sync/learningEventSyncRepository';
import { createLearningEventsRepository } from './src/sync/learningEventsRepository';
import { resolveLearningEventsRepositoryConfig } from './src/sync/learningEventsRuntimeConfig';
import {
  createDailyProgressSnapshot,
  createProgressSyncRepository,
} from './src/sync/progressSyncRepository';
import { resolveProgressSyncRepositoryConfig } from './src/sync/progressSyncRuntimeConfig';
import { isRemoteAuthorizationError } from './src/runtime/remoteHttpError';
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
  activeSurface: string;
  activeText: string;
  primaryActionSurface: string;
  primaryActionText: string;
  primaryActionMuted: string;
  tabIdle: string;
  success: string;
  warning: string;
  warningText: string;
  danger: string;
};

type AuthStatusCopy = {
  label: string;
  value: string;
};

type ShellAccountChipCopy = {
  label: string;
  value: string;
};

function getShellAccountChipCopy(authState: AuthState): ShellAccountChipCopy {
  return authState.stage === 'authenticated'
    ? {
        label: '账户',
        value: '已确认',
      }
    : authState.stage === 'code_sent'
    ? {
        label: '验证码',
        value: '继续',
      }
    : {
        label: '账号',
        value: '登录',
      };
}

function getAuthStatusCopy(authState: AuthState): AuthStatusCopy {
  return authState.stage === 'authenticated'
    ? {
        label: '身份已确认',
        value: maskPhoneNumber(authState.phoneNumber),
      }
    : authState.stage === 'code_sent'
    ? {
        label: '验证码已发',
        value: '输入验证码',
      }
    : {
        label: '等待登录',
        value: '手机号验证码',
      };
}

type AuthState = {
  authToken: string | null;
  challenge: AuthChallenge | null;
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
type AccountBootstrapStatus = 'not_required' | 'pending' | 'ready' | 'deferred';

type AuthenticatedRuntimeHydration = {
  accountBootstrap: AccountBootstrapSnapshot | null;
  accountBootstrapStatus: AccountBootstrapStatus;
  pendingLearningEventCount: number;
  membershipErrorMessage: string | null;
  membershipRefreshSucceeded: boolean;
  membershipState: MembershipState;
  persistedUserState: PersistedUserState;
  progressSyncKey: string | null;
  spaceStateSyncKey: string | null;
};

type SpaceCardState = SpaceCardStateValue;

const SHELL_ACCENT = '#637783';

type AuthHandlers = {
  onChangePhone: (value: string) => void;
  onChangeCode: (value: string) => void;
  onRequestCode: () => void;
  onSubmitCode: () => void;
  onLogout: () => Promise<void>;
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
    eyebrow: '继续学习',
  },
  {
    key: 'space',
    label: '空间',
    eyebrow: '知识空间',
  },
  {
    key: 'statistics',
    label: '统计',
    eyebrow: '今日进展',
  },
  {
    key: 'mine',
    label: '我的',
    eyebrow: '学习账户',
  },
];
const MINE_ROUTE = ROUTES.find(route => route.key === 'mine')!;

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
  activeSurface: '#12131A',
  activeText: '#FFFFFC',
  primaryActionSurface: '#12131A',
  primaryActionText: '#FFFFFC',
  primaryActionMuted: hexToRgba('#FFFFFF', 0.74),
  tabIdle: '#8D948D',
  success: '#249B77',
  warning: '#C98524',
  warningText: '#12131A',
  danger: '#B6545B',
};

const DARK_PALETTE: Palette = {
  background: '#0B0B12',
  panel: 'rgba(25,26,36,0.78)',
  panelStrong: 'rgba(31,33,45,0.94)',
  border: 'rgba(238,235,218,0.1)',
  text: '#F3F0E7',
  textMuted: '#BAB6A8',
  accent: '#AAB7AD',
  accentSoft: hexToRgba('#AAB7AD', 0.14),
  accentStrong: '#E0E7DC',
  activeSurface: '#D8D7C9',
  activeText: '#17191D',
  primaryActionSurface: '#D8D7C9',
  primaryActionText: '#17191D',
  primaryActionMuted: hexToRgba('#17191D', 0.62),
  tabIdle: '#86869C',
  success: '#4FDE9C',
  warning: '#F5B100',
  warningText: '#12131A',
  danger: '#F15B6E',
};

const PROTECTED_ROUTES: RouteKey[] = ['learning', 'space', 'statistics'];
const AUTH_KEYBOARD_ACCESSORY_ID = 'auth-keyboard-accessory';
const SMS_CODE_CELL_COUNT = 6;

const INITIAL_AUTH_STATE: AuthState = {
  authToken: null,
  challenge: null,
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
  const authSessionStore = useMemo(() => createAuthSessionStore(), []);
  const authSessionCoordinator = useMemo(
    () =>
      createAuthSessionCoordinator({
        authRepository,
        authSessionStore,
      }),
    [authRepository, authSessionStore],
  );
  const authenticatedFetch = useMemo(
    () => createAuthenticatedFetch({ authSessionCoordinator }),
    [authSessionCoordinator],
  );
  const runtimeAuthRepositoryMode = authRepositoryConfig.mode;
  const accountBootstrapRepositoryConfig = useMemo(() => {
    const resolved = resolveAccountBootstrapRepositoryConfig(runtimeConfig);

    return resolved.mode === 'remote'
      ? { ...resolved, fetchImpl: authenticatedFetch }
      : resolved;
  }, [authenticatedFetch, runtimeConfig]);
  const accountBootstrapRepository = useMemo(
    () => createAccountBootstrapRepository(accountBootstrapRepositoryConfig),
    [accountBootstrapRepositoryConfig],
  );
  const runtimeAccountBootstrapMode = accountBootstrapRepositoryConfig.mode;
  const learningSessionRepositoryConfig = useMemo(() => {
    const resolved = resolveLearningSessionRepositoryConfig(runtimeConfig);

    return resolved.mode === 'remote'
      ? { ...resolved, fetchImpl: authenticatedFetch }
      : resolved;
  }, [authenticatedFetch, runtimeConfig]);
  const learningSessionRepository = useMemo(
    () => createLearningSessionRepository(learningSessionRepositoryConfig),
    [learningSessionRepositoryConfig],
  );
  const membershipRepositoryConfig = useMemo(() => {
    const resolved = resolveMembershipRepositoryConfig(runtimeConfig);

    return resolved.mode === 'remote'
      ? { ...resolved, fetchImpl: authenticatedFetch }
      : resolved;
  }, [authenticatedFetch, runtimeConfig]);
  const membershipRepository = useMemo(
    () => createMembershipRepository(membershipRepositoryConfig),
    [membershipRepositoryConfig],
  );
  const runtimeMembershipRepositoryMode = membershipRepositoryConfig.mode;
  const progressSyncRepositoryConfig = useMemo(() => {
    const resolved = resolveProgressSyncRepositoryConfig(runtimeConfig);

    return resolved.mode === 'remote'
      ? { ...resolved, fetchImpl: authenticatedFetch }
      : resolved;
  }, [authenticatedFetch, runtimeConfig]);
  const progressSyncRepository = useMemo(
    () => createProgressSyncRepository(progressSyncRepositoryConfig),
    [progressSyncRepositoryConfig],
  );
  const runtimeProgressSyncMode = progressSyncRepositoryConfig.mode;
  const learningEventsRepositoryConfig = useMemo(() => {
    const resolved = resolveLearningEventsRepositoryConfig(runtimeConfig);

    return resolved.mode === 'remote'
      ? { ...resolved, fetchImpl: authenticatedFetch }
      : resolved;
  }, [authenticatedFetch, runtimeConfig]);
  const learningEventsRepository = useMemo(
    () => createLearningEventsRepository(learningEventsRepositoryConfig),
    [learningEventsRepositoryConfig],
  );
  const learningEventSyncRepository = useMemo(
    () =>
      createLearningEventSyncRepository({
        eventsRepository: learningEventsRepository,
      }),
    [learningEventsRepository],
  );
  const runtimeLearningEventsMode = learningEventsRepositoryConfig.mode;
  const spaceStateRepositoryConfig = useMemo(() => {
    const resolved = resolveSpaceStateRepositoryConfig(runtimeConfig ?? {});

    return resolved.mode === 'remote'
      ? { ...resolved, fetchImpl: authenticatedFetch }
      : resolved;
  }, [authenticatedFetch, runtimeConfig]);
  const spaceStateRepository = useMemo(
    () => createSpaceStateRepository(spaceStateRepositoryConfig),
    [spaceStateRepositoryConfig],
  );
  const runtimeSpaceStateMode = spaceStateRepositoryConfig.mode;
  const mutationQueueRepository = useMemo(
    () =>
      createMutationQueueRepository({
        membershipRepository,
        progressSyncRepository,
        spaceStateRepository,
      }),
    [membershipRepository, progressSyncRepository, spaceStateRepository],
  );
  const userStateStore = useMemo(() => createUserStateStore(), []);
  const [activeRoute, setActiveRoute] = useState<RouteKey>('learning');
  const [learningScreen, setLearningScreen] =
    useState<LearningSurfaceScreen>('practice');
  const [spaceScreen, setSpaceScreen] =
    useState<SpaceSurfaceScreen>('overview');
  const [persistenceHydrated, setPersistenceHydrated] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const [accountBootstrapStatus, setAccountBootstrapStatus] =
    useState<AccountBootstrapStatus>(
      runtimeAccountBootstrapMode === 'remote' ? 'pending' : 'not_required',
    );
  const [accountBootstrapSnapshot, setAccountBootstrapSnapshot] =
    useState<AccountBootstrapSnapshot | null>(null);
  const [mappedAccountBootstrapSnapshot, setMappedAccountBootstrapSnapshot] =
    useState<AccountBootstrapSnapshot | null>(null);
  const [
    accountBootstrapHydrationSettled,
    setAccountBootstrapHydrationSettled,
  ] = useState(runtimeAccountBootstrapMode !== 'remote');
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
  const [pendingLearningEventCount, setPendingLearningEventCount] = useState(0);
  const pendingLearningEventCountRef = useRef(0);
  const [learningEventRecoveryPending, setLearningEventRecoveryPending] =
    useState(false);
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
  const persistedLearningCursor = useRef<PersistedLearningCursor | null>(null);
  const accountBootstrapStatusRef = useRef(accountBootstrapStatus);
  const accountBootstrapSnapshotRef = useRef<AccountBootstrapSnapshot | null>(
    null,
  );
  const accountBootstrapHydrationSettledRef = useRef(
    runtimeAccountBootstrapMode !== 'remote',
  );
  const accountBootstrapRetryInFlight = useRef<{
    preserveLocalState: boolean;
    sessionScopeKey: string;
    task: Promise<boolean>;
  } | null>(null);
  const accountBootstrapRefreshRequired = useRef(false);
  const logoutInFlight = useRef<Promise<void> | null>(null);
  const learningEventEnqueueInFlight = useRef<{
    sessionScopeKey: string;
  } | null>(null);
  const learningEventReplayPaused = useRef(false);
  const mutationReplayInFlight = useRef<{
    sessionScopeKey: string;
    task: Promise<void>;
  } | null>(null);
  const mutationReplayRequestedAfterCurrent = useRef<string | null>(null);
  const resetRuntimeAfterLogout = useCallback(
    (error: string | null = null) => {
      lastMembershipRefreshKey.current = null;
      pendingMembershipRefreshKey.current = null;
      persistedLearningCursor.current = null;
      accountBootstrapStatusRef.current =
        runtimeAccountBootstrapMode === 'remote' ? 'pending' : 'not_required';
      accountBootstrapRefreshRequired.current = false;
      accountBootstrapSnapshotRef.current = null;
      learningEventEnqueueInFlight.current = null;
      learningEventReplayPaused.current = false;
      mutationReplayRequestedAfterCurrent.current = null;
      accountBootstrapHydrationSettledRef.current =
        runtimeAccountBootstrapMode !== 'remote';
      setAccountBootstrapStatus(accountBootstrapStatusRef.current);
      setAccountBootstrapSnapshot(null);
      setMappedAccountBootstrapSnapshot(null);
      setAccountBootstrapHydrationSettled(
        accountBootstrapHydrationSettledRef.current,
      );
      setAuthState({ ...INITIAL_AUTH_STATE, error });
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
      pendingLearningEventCountRef.current = 0;
      setPendingLearningEventCount(0);
      setLearningEventRecoveryPending(false);
      setLastSyncedSpaceStateKey(null);
      setProgressSyncState(INITIAL_PROGRESS_SYNC_STATE);
      setLearningStateSyncState(INITIAL_LEARNING_STATE_SYNC_STATE);
      setSpaceStateSyncState(INITIAL_SPACE_STATE_SYNC_STATE);
      startTransition(() => {
        setActiveRoute('mine');
        setLearningScreen('practice');
        setSpaceScreen('overview');
      });
    },
    [runtimeAccountBootstrapMode],
  );
  const clearAuthenticatedSession = useCallback(
    (error: string | null = null, revokeRemote = false) => {
      if (logoutInFlight.current) {
        return logoutInFlight.current;
      }

      const logoutTask = (async () => {
        let authCleanupFailed = false;
        const accountPhoneNumber =
          authSessionCoordinator.getCurrentSession()?.phoneNumber ?? null;

        try {
          if (revokeRemote) {
            await authSessionCoordinator.logout();
          } else {
            await authSessionCoordinator.invalidate();
          }
        } catch {
          authCleanupFailed = true;
          console.warn(
            '[AppPersistence] Failed to persist auth session revocation.',
          );
        }

        const cleanupResults = await Promise.allSettled([
          userStateStore.clear(),
          mutationQueueRepository.clear(),
          ...(accountPhoneNumber
            ? [learningEventSyncRepository.clearAccount(accountPhoneNumber)]
            : []),
        ]);

        cleanupResults.forEach(result => {
          if (result.status === 'rejected') {
            console.warn(
              '[AppPersistence] Failed to clear account-bound local state.',
              result.reason,
            );
          }
        });
        resetRuntimeAfterLogout(
          error ??
            (authCleanupFailed
              ? '本地登录凭证未能完全清理，请重启应用后重新验证手机号。'
              : null),
        );
      })();

      logoutInFlight.current = logoutTask;
      logoutTask.finally(() => {
        if (logoutInFlight.current === logoutTask) {
          logoutInFlight.current = null;
        }
      });
      return logoutTask;
    },
    [
      authSessionCoordinator,
      learningEventSyncRepository,
      mutationQueueRepository,
      resetRuntimeAfterLogout,
      userStateStore,
    ],
  );
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
      stateMap[cardId] ?? {
        isFavorited: false,
        isSleeping: false,
        lastModifiedAt: LEGACY_SPACE_STATE_TIMESTAMP,
      },
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
      if (nextSession?.schedulingMode === 'server') {
        return nextSession.cards;
      }

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
      if (nextSession?.schedulingMode === 'server') {
        return [];
      }

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
  const reviewCandidateCards =
    learningSession?.schedulingMode === 'server'
      ? []
      : selectReviewCards(visibleLearningCards, learningCompletedResults);
  const pendingReviewCount = reviewCandidateCards.filter(
    card =>
      !reviewCompletedResults.some(result => result.cardId === card.card_id),
  ).length;
  const todayKey = getTodayKey();
  const loadCanonicalSpaceState = useCallback(
    async (context: { authToken?: string; phoneNumber: string }) => {
      if (runtimeSpaceStateMode === 'local') {
        return null;
      }

      try {
        return await spaceStateRepository.loadSpaceState(context, todayKey);
      } catch (error) {
        if (isRemoteAuthorizationError(error)) {
          throw error;
        }

        console.warn(
          '[AppPersistence] Failed to load canonical space state.',
          error,
        );
        return null;
      }
    },
    [runtimeSpaceStateMode, spaceStateRepository, todayKey],
  );
  const loadAuthenticatedRuntimeHydration = useCallback(
    async (session: AuthSession): Promise<AuthenticatedRuntimeHydration> => {
      const context = {
        authToken: getAuthAccessToken(session),
        phoneNumber: session.phoneNumber,
      };
      const persistedUserState = await userStateStore.load(session.phoneNumber);

      if (runtimeAccountBootstrapMode === 'remote') {
        try {
          const [accountBootstrap, hydratedPendingLearningEventCount] =
            await Promise.all([
              accountBootstrapRepository.load(learningTrack, todayKey),
              runtimeLearningEventsMode === 'remote'
                ? learningEventSyncRepository.getPendingCount(
                    session.phoneNumber,
                  )
                : Promise.resolve(0),
            ]);

          if (accountBootstrap === null) {
            throw new Error('Remote account bootstrap returned no state.');
          }

          const reconciliation = reconcileAccountBootstrap(
            persistedUserState,
            accountBootstrap,
          );

          return {
            accountBootstrap,
            accountBootstrapStatus: 'ready',
            pendingLearningEventCount: hydratedPendingLearningEventCount,
            membershipErrorMessage: null,
            membershipRefreshSucceeded: true,
            membershipState: accountBootstrap.membership.state,
            persistedUserState: reconciliation.persistedUserState,
            progressSyncKey: reconciliation.progressSyncKey,
            spaceStateSyncKey: reconciliation.spaceStateSyncKey,
          };
        } catch (error) {
          if (isRemoteAuthorizationError(error)) {
            throw error;
          }

          console.warn(
            '[AccountBootstrap] Canonical account state is temporarily unavailable.',
            error,
          );
          return {
            accountBootstrap: null,
            accountBootstrapStatus: 'deferred',
            pendingLearningEventCount: 0,
            membershipErrorMessage: `${getUserFacingErrorMessage(
              error,
              '账户状态暂时无法读取。',
            )} 已保留登录；服务恢复前不会上传本地状态。`,
            membershipRefreshSucceeded: false,
            membershipState: createEntitlementPendingMembershipState(),
            persistedUserState,
            progressSyncKey: null,
            spaceStateSyncKey: null,
          };
        }
      }

      const [membershipResolution, canonicalSpaceState] = await Promise.all([
        membershipRepository
          .loadState(context)
          .then(state => ({
            errorMessage: null,
            refreshSucceeded: true,
            state,
          }))
          .catch((error: unknown) => {
            if (isRemoteAuthorizationError(error)) {
              throw error;
            }

            if (runtimeMembershipRepositoryMode === 'remote') {
              mutationQueueRepository
                .enqueueMutation(
                  'refresh_membership',
                  { context },
                  'membership:hydrate',
                )
                .catch(() => undefined);
            }

            return {
              errorMessage: `${getUserFacingErrorMessage(
                error,
                '会员状态暂时无法读取。',
              )} 已恢复登录；网络恢复后会重新读取服务端权益。`,
              refreshSucceeded: false,
              state: createEntitlementPendingMembershipState(),
            };
          }),
        loadCanonicalSpaceState(context),
      ]);

      return {
        accountBootstrap: null,
        accountBootstrapStatus: 'not_required',
        pendingLearningEventCount: 0,
        membershipErrorMessage: membershipResolution.errorMessage,
        membershipRefreshSucceeded: membershipResolution.refreshSucceeded,
        membershipState: membershipResolution.state,
        persistedUserState: {
          ...persistedUserState,
          spaceCardStateById: canonicalSpaceState
            ? mergeSpaceStateMaps(
                persistedUserState.spaceCardStateById,
                canonicalSpaceState,
              )
            : persistedUserState.spaceCardStateById,
        },
        progressSyncKey: null,
        spaceStateSyncKey: null,
      };
    },
    [
      accountBootstrapRepository,
      learningTrack,
      loadCanonicalSpaceState,
      learningEventSyncRepository,
      membershipRepository,
      mutationQueueRepository,
      runtimeAccountBootstrapMode,
      runtimeLearningEventsMode,
      runtimeMembershipRepositoryMode,
      todayKey,
      userStateStore,
    ],
  );
  const applyAuthenticatedRuntimeHydration = useCallback(
    (hydration: AuthenticatedRuntimeHydration) => {
      accountBootstrapStatusRef.current = hydration.accountBootstrapStatus;
      accountBootstrapSnapshotRef.current = hydration.accountBootstrap;
      setAccountBootstrapStatus(hydration.accountBootstrapStatus);
      setAccountBootstrapSnapshot(hydration.accountBootstrap);
      setMappedAccountBootstrapSnapshot(null);
      accountBootstrapHydrationSettledRef.current =
        hydration.accountBootstrapStatus === 'not_required';
      setAccountBootstrapHydrationSettled(
        accountBootstrapHydrationSettledRef.current,
      );
      setLastSyncedProgressKey(hydration.progressSyncKey);
      setLastSyncedSpaceStateKey(hydration.spaceStateSyncKey);
      pendingLearningEventCountRef.current =
        hydration.pendingLearningEventCount;
      setPendingLearningEventCount(hydration.pendingLearningEventCount);
      setLearningEventRecoveryPending(hydration.pendingLearningEventCount > 0);
      previousMembershipStage.current = hydration.membershipState.stage;
      setMembershipState(hydration.membershipState);
      setMembershipError(hydration.membershipErrorMessage);
      setMembershipGate(null);
      persistedLearningCursor.current =
        hydration.persistedUserState.learningCursor;
      setCheckedInDayKey(hydration.persistedUserState.checkedInDayKey);
      setSpaceCardStateById(hydration.persistedUserState.spaceCardStateById);
    },
    [],
  );
  const isAccountStateReconciled =
    runtimeAccountBootstrapMode !== 'remote' ||
    accountBootstrapSnapshot !== null;
  const canWriteAccountState =
    isAccountStateReconciled && accountBootstrapHydrationSettled;
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
  const retryCanonicalAccountBootstrap = useCallback(
    async (
      options: { preserveLocalState?: boolean } = {},
    ): Promise<boolean> => {
      if (runtimeAccountBootstrapMode !== 'remote') {
        return true;
      }

      const preserveLocalState = options.preserveLocalState === true;

      const session = authSessionCoordinator.getCurrentSession();

      if (
        !session ||
        authenticatedRuntimeContext === null ||
        authenticatedRuntimeContext.phoneNumber !== session.phoneNumber
      ) {
        return false;
      }

      const sessionScopeKey = getAuthSessionScopeKey(session);

      if (sessionScopeKey === null) {
        return false;
      }

      const existingRetry = accountBootstrapRetryInFlight.current;

      if (
        existingRetry?.sessionScopeKey === sessionScopeKey &&
        existingRetry.preserveLocalState === preserveLocalState
      ) {
        return existingRetry.task;
      }

      const isCurrentSession = () =>
        getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
        sessionScopeKey;

      accountBootstrapStatusRef.current = 'pending';
      setAccountBootstrapStatus('pending');

      const retryTask = (async () => {
        try {
          const hydration = await loadAuthenticatedRuntimeHydration(session);
          const currentSession = authSessionCoordinator.getCurrentSession();

          if (
            currentSession === null ||
            getAuthSessionScopeKey(currentSession) !== sessionScopeKey
          ) {
            return false;
          }

          if (
            hydration.accountBootstrapStatus === 'deferred' &&
            accountBootstrapSnapshotRef.current !== null
          ) {
            accountBootstrapStatusRef.current = 'deferred';
            setAccountBootstrapStatus('deferred');
            setMembershipError(hydration.membershipErrorMessage);
            return false;
          }

          if (
            preserveLocalState ||
            (runtimeLearningEventsMode === 'remote' &&
              pendingLearningEventCountRef.current > 0)
          ) {
            if (
              hydration.accountBootstrap === null ||
              learningSession === null
            ) {
              throw new Error(
                'Pending learning events require validated account content.',
              );
            }

            resolveAccountBootstrapLearningState(
              hydration.accountBootstrap,
              learningSession,
            );
            accountBootstrapStatusRef.current = 'ready';
            setAccountBootstrapStatus('ready');
            return hydration.accountBootstrapStatus === 'ready';
          }

          applyAuthenticatedRuntimeHydration(hydration);
          if (
            hydration.accountBootstrapStatus === 'ready' &&
            learningSession === null
          ) {
            setLearningBootstrapStatus('idle');
            setLearningBootstrapError(null);
          }
          return hydration.accountBootstrapStatus === 'ready';
        } catch (error) {
          if (!isCurrentSession()) {
            return false;
          }

          if (isRemoteAuthorizationError(error)) {
            await clearAuthenticatedSession('登录已失效，请重新验证手机号。');
            return false;
          }

          throw error;
        }
      })();
      const scopedRetry = {
        preserveLocalState,
        sessionScopeKey,
        task: retryTask,
      };

      accountBootstrapRetryInFlight.current = scopedRetry;

      try {
        return await retryTask;
      } finally {
        if (accountBootstrapRetryInFlight.current === scopedRetry) {
          accountBootstrapRetryInFlight.current = null;
        }
      }
    },
    [
      applyAuthenticatedRuntimeHydration,
      authSessionCoordinator,
      authenticatedRuntimeContext,
      clearAuthenticatedSession,
      learningSession,
      loadAuthenticatedRuntimeHydration,
      runtimeAccountBootstrapMode,
      runtimeLearningEventsMode,
    ],
  );
  const activeMembershipRefreshKey =
    runtimeAccountBootstrapMode !== 'remote' &&
    runtimeMembershipRepositoryMode === 'remote' &&
    authenticatedRuntimeContext !== null &&
    activeRoute === 'mine'
      ? activeRoute
      : null;
  const activeAccountBootstrapRefreshKey =
    runtimeAccountBootstrapMode === 'remote' &&
    authenticatedRuntimeContext !== null &&
    activeRoute === 'mine'
      ? activeRoute
      : null;
  const startMutationReplay = useCallback(() => {
    if (!isAuthenticated || authenticatedRuntimeContext === null) {
      return Promise.resolve();
    }

    const replayContext = authenticatedRuntimeContext;
    const replayPhoneNumber = replayContext.phoneNumber;
    const replaySession = authSessionCoordinator.getCurrentSession();
    const replaySessionScopeKey = getAuthSessionScopeKey(replaySession);

    if (
      replaySession === null ||
      replaySession.phoneNumber !== replayPhoneNumber ||
      replaySessionScopeKey === null
    ) {
      return Promise.resolve();
    }

    const existingReplay = mutationReplayInFlight.current;

    if (existingReplay?.sessionScopeKey === replaySessionScopeKey) {
      mutationReplayRequestedAfterCurrent.current = replaySessionScopeKey;
      return existingReplay.task;
    }

    const precedingReplay = existingReplay?.task;
    const isReplayAccountCurrent = () =>
      getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
      replaySessionScopeKey;
    const replayTask = (async () => {
      if (precedingReplay) {
        await precedingReplay.catch(() => undefined);
      }

      if (!isReplayAccountCurrent()) {
        return;
      }

      let queuedLearningEventCount = 0;

      if (runtimeLearningEventsMode === 'remote') {
        try {
          queuedLearningEventCount =
            await learningEventSyncRepository.getPendingCount(
              replayPhoneNumber,
            );

          if (!isReplayAccountCurrent()) {
            return;
          }

          pendingLearningEventCountRef.current = queuedLearningEventCount;
          setPendingLearningEventCount(queuedLearningEventCount);
        } catch (error) {
          if (!isReplayAccountCurrent()) {
            return;
          }

          setLearningStateSyncState({
            detail: getUserFacingErrorMessage(
              error,
              '本地答题记录暂时无法读取。',
            ),
            label: '同步受阻',
            state: 'error',
          });
          return;
        }
      }

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        queuedLearningEventCount > 0 &&
        accountBootstrapRefreshRequired.current
      ) {
        try {
          const contentStillValid = await retryCanonicalAccountBootstrap({
            preserveLocalState: true,
          });

          if (!isReplayAccountCurrent()) {
            return;
          }

          if (!contentStillValid) {
            setLearningSession(null);
            setLearningCardState(null);
            setLearningBootstrapStatus('error');
            setLearningBootstrapError(
              '内容版本暂时无法重新确认，已保留答题记录且尚未上传。',
            );
            return;
          }

          accountBootstrapRefreshRequired.current = false;
        } catch (error) {
          if (!isReplayAccountCurrent()) {
            return;
          }

          setLearningSession(null);
          setLearningCardState(null);
          setLearningBootstrapStatus('error');
          setLearningBootstrapError(
            getUserFacingErrorMessage(
              error,
              '内容版本重新验证失败，已保留答题记录且尚未上传。',
            ),
          );
          return;
        }
      }

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        accountBootstrapStatusRef.current !== 'ready' &&
        !(await retryCanonicalAccountBootstrap())
      ) {
        if (!isReplayAccountCurrent()) {
          return;
        }

        if (queuedLearningEventCount > 0) {
          setLearningStateSyncState({
            detail: '答题记录已安全保存在本机，账户状态恢复后会继续同步。',
            label: '待重试',
            state: 'error',
          });
        }
        return;
      }

      if (!isReplayAccountCurrent()) {
        return;
      }

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        !accountBootstrapHydrationSettledRef.current
      ) {
        return;
      }

      if (
        runtimeLearningEventsMode === 'remote' &&
        queuedLearningEventCount > 0
      ) {
        if (learningEventReplayPaused.current) {
          return;
        }

        setLearningStateSyncState({
          detail: '正在提交本机安全保存的答题记录。',
          label: '同步中',
          state: 'syncing',
        });

        try {
          const replay = await learningEventSyncRepository.startReplay(
            replayContext,
          );

          if (!isReplayAccountCurrent()) {
            return;
          }

          learningEventReplayPaused.current = false;
          pendingLearningEventCountRef.current = replay.pendingCount;
          setPendingLearningEventCount(replay.pendingCount);

          if (replay.acknowledgedEntries.length > 0) {
            if (runtimeAccountBootstrapMode === 'remote') {
              setLearningSession(null);
              setLearningCardState(null);
              setMappedAccountBootstrapSnapshot(null);
              accountBootstrapRefreshRequired.current = false;
              accountBootstrapStatusRef.current = 'pending';
              setAccountBootstrapStatus('pending');
              accountBootstrapHydrationSettledRef.current = false;
              setAccountBootstrapHydrationSettled(false);
              setLearningStateSyncState({
                detail: '答题记录已由服务端确认，正在刷新账户学习状态。',
                label: '同步中',
                state: 'syncing',
              });

              try {
                const bootstrapRefreshed =
                  await retryCanonicalAccountBootstrap();

                if (!isReplayAccountCurrent()) {
                  return;
                }

                if (!bootstrapRefreshed) {
                  setLearningBootstrapStatus('error');
                  setLearningBootstrapError(
                    '账户学习状态尚未刷新，重新确认后再继续下一张。',
                  );
                  setLearningStateSyncState({
                    detail:
                      '答题记录已由服务端确认，账户状态将在服务恢复后刷新。',
                    label: '待刷新',
                    state: 'error',
                  });
                } else {
                  setLearningSession(null);
                  setLearningCardState(null);
                  setLearningBootstrapStatus('idle');
                  setLearningBootstrapError(null);
                }
              } catch (error) {
                if (!isReplayAccountCurrent()) {
                  return;
                }

                setLearningBootstrapStatus('error');
                setLearningBootstrapError(
                  '账户学习状态刷新失败，重新确认后再继续下一张。',
                );
                setLearningStateSyncState({
                  detail: `${getUserFacingErrorMessage(
                    error,
                    '账户学习状态刷新失败。',
                  )} 服务恢复后会自动再试。`,
                  label: '待刷新',
                  state: 'error',
                });
              }
              return;
            }

            setLearningStateSyncState({
              detail: '当前答题记录已同步。',
              label: '已同步',
              state: 'synced',
            });
          }
        } catch (error) {
          if (!isReplayAccountCurrent()) {
            return;
          }

          if (isRemoteAuthorizationError(error)) {
            await clearAuthenticatedSession('登录已失效，请重新验证手机号。');
            return;
          }

          learningEventReplayPaused.current = true;
          try {
            const pendingCount =
              await learningEventSyncRepository.getPendingCount(
                replayPhoneNumber,
              );

            if (!isReplayAccountCurrent()) {
              return;
            }

            pendingLearningEventCountRef.current = pendingCount;
            setPendingLearningEventCount(pendingCount);
          } catch {
            // The primary sync error remains the user-facing diagnosis.
          }

          if (!isReplayAccountCurrent()) {
            return;
          }

          setLearningStateSyncState({
            detail: `${getUserFacingErrorMessage(
              error,
              '学习状态同步失败。',
            )} 答题记录已保存在本机，网络恢复后会自动再试。`,
            label: '待重试',
            state: 'error',
          });
          return;
        }
      }

      let replayedResults;

      try {
        replayedResults = await mutationQueueRepository.startReplay(
          replayContext,
        );
      } catch (error) {
        if (!isReplayAccountCurrent()) {
          return;
        }

        if (isRemoteAuthorizationError(error)) {
          await clearAuthenticatedSession('登录已失效，请重新验证手机号。');
          return;
        }

        throw error;
      }

      if (!isReplayAccountCurrent()) {
        return;
      }

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
          if (!('spaceStateSnapshot' in result)) {
            return;
          }

          const replayedSpaceState = result.spaceStateSnapshot;
          const replayedSpaceStateKey = JSON.stringify(replayedSpaceState);

          setLastSyncedSpaceStateKey(replayedSpaceStateKey);

          if (replayedSpaceStateKey !== spaceStateSyncKey) {
            setSpaceCardStateById(spaceStateSnapshotToMap(replayedSpaceState));
          }
          setSpaceStateSyncState({
            detail: '网络恢复后，空间收藏和休眠状态已同步。',
            label: '已同步',
            state: 'synced',
          });

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

      if (
        replayedResults.length > 0 &&
        runtimeAccountBootstrapMode === 'remote'
      ) {
        accountBootstrapStatusRef.current = 'pending';
        setAccountBootstrapStatus('pending');
        accountBootstrapHydrationSettledRef.current = false;
        setAccountBootstrapHydrationSettled(false);
        await retryCanonicalAccountBootstrap();
      }
    })();

    const scopedReplay = {
      sessionScopeKey: replaySessionScopeKey,
      task: replayTask,
    };

    mutationReplayInFlight.current = scopedReplay;
    const finishReplay = () => {
      if (mutationReplayInFlight.current === scopedReplay) {
        mutationReplayInFlight.current = null;
      }

      const shouldReplayAgain =
        mutationReplayRequestedAfterCurrent.current === replaySessionScopeKey &&
        getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
          replaySessionScopeKey &&
        !learningEventReplayPaused.current;

      if (
        mutationReplayRequestedAfterCurrent.current === replaySessionScopeKey
      ) {
        mutationReplayRequestedAfterCurrent.current = null;
      }

      if (shouldReplayAgain) {
        startMutationReplay().catch(() => undefined);
      }
    };

    replayTask.then(finishReplay, finishReplay);
    return replayTask;
  }, [
    authenticatedRuntimeContext,
    authSessionCoordinator,
    clearAuthenticatedSession,
    dailyProgressKey,
    isAuthenticated,
    learningEventSyncRepository,
    mutationQueueRepository,
    retryCanonicalAccountBootstrap,
    runtimeAccountBootstrapMode,
    runtimeLearningEventsMode,
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
    let isCancelled = false;

    const hydratePersistence = async () => {
      const session = await authSessionCoordinator.restore();

      if (isCancelled || session === null) {
        return;
      }

      const hydration = await loadAuthenticatedRuntimeHydration(session);

      if (isCancelled) {
        return;
      }

      applyAuthenticatedRuntimeHydration(hydration);
      setAuthState({
        ...INITIAL_AUTH_STATE,
        authToken: getAuthAccessToken(session) ?? null,
        phoneNumber: session.phoneNumber,
        stage: 'authenticated',
      });
    };

    hydratePersistence()
      .catch(async (error: unknown) => {
        if (isRemoteAuthorizationError(error)) {
          await clearAuthenticatedSession('登录已失效，请重新验证手机号。');
          return;
        }

        console.warn('[AppPersistence] Failed to hydrate app state.', error);
      })
      .finally(() => {
        if (!isCancelled) {
          setPersistenceHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    applyAuthenticatedRuntimeHydration,
    authSessionCoordinator,
    clearAuthenticatedSession,
    loadAuthenticatedRuntimeHydration,
  ]);

  useEffect(() => {
    if (!persistenceHydrated || !isAuthenticated || !canWriteAccountState) {
      return;
    }

    if (
      learningPhase === 'learning' &&
      learningSession !== null &&
      currentLearningCard !== null
    ) {
      persistedLearningCursor.current = {
        cardId: currentLearningCard.card_id,
        sourceId: learningSession.sourceId,
        track: learningSession.track,
      };
    }

    userStateStore
      .save(authState.phoneNumber, {
        checkedInDayKey,
        learningCursor: persistedLearningCursor.current,
        spaceCardStateById,
      })
      .catch((error: unknown) => {
        console.warn('[AppPersistence] Failed to persist user state.', error);
      });
  }, [
    authState.phoneNumber,
    canWriteAccountState,
    checkedInDayKey,
    currentLearningCard,
    isAuthenticated,
    learningPhase,
    learningSession,
    persistenceHydrated,
    spaceCardStateById,
    userStateStore,
  ]);

  useEffect(() => {
    if (!persistenceHydrated) {
      return;
    }

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
      pendingLearningEventCountRef.current = 0;
      setPendingLearningEventCount(0);
      setLearningEventRecoveryPending(false);
      setLastSyncedSpaceStateKey(null);
      setProgressSyncState(INITIAL_PROGRESS_SYNC_STATE);
      setLearningStateSyncState(INITIAL_LEARNING_STATE_SYNC_STATE);
      setSpaceStateSyncState(INITIAL_SPACE_STATE_SYNC_STATE);
      return;
    }

    if (!isAccountStateReconciled) {
      if (learningBootstrapStatus !== 'error') {
        setLearningSession(null);
        setLearningCardState(null);
        setLearningBootstrapStatus('error');
        setLearningBootstrapError(
          '账户状态暂时无法读取，服务恢复后再加载本轮卡片。',
        );
      }
      return;
    }

    if (learningBootstrapStatus !== 'idle') {
      return;
    }

    setLearningBootstrapStatus('loading');
    setLearningBootstrapError(null);
  }, [
    isAccountStateReconciled,
    isAuthenticated,
    learningBootstrapStatus,
    persistenceHydrated,
  ]);

  useEffect(() => {
    if (activeRoute === 'mine') {
      return;
    }

    lastMembershipRefreshKey.current = null;
  }, [activeRoute]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      activeAccountBootstrapRefreshKey === null ||
      pendingLearningEventCount > 0 ||
      membershipPendingAction !== null ||
      lastMembershipRefreshKey.current === activeAccountBootstrapRefreshKey ||
      pendingMembershipRefreshKey.current === activeAccountBootstrapRefreshKey
    ) {
      return;
    }

    let isCancelled = false;
    pendingMembershipRefreshKey.current = activeAccountBootstrapRefreshKey;
    accountBootstrapStatusRef.current = 'pending';
    setAccountBootstrapStatus('pending');

    retryCanonicalAccountBootstrap()
      .then(succeeded => {
        if (isCancelled) {
          return;
        }

        pendingMembershipRefreshKey.current = null;
        lastMembershipRefreshKey.current = succeeded
          ? activeAccountBootstrapRefreshKey
          : null;
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        pendingMembershipRefreshKey.current = null;
        setMembershipError(
          getUserFacingErrorMessage(error, '账户状态刷新失败。'),
        );
      });

    return () => {
      isCancelled = true;

      if (
        pendingMembershipRefreshKey.current === activeAccountBootstrapRefreshKey
      ) {
        pendingMembershipRefreshKey.current = null;
      }
    };
  }, [
    activeAccountBootstrapRefreshKey,
    isAuthenticated,
    membershipPendingAction,
    pendingLearningEventCount,
    retryCanonicalAccountBootstrap,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !canWriteAccountState ||
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

        if (isRemoteAuthorizationError(error)) {
          clearAuthenticatedSession('登录已失效，请重新验证手机号。').catch(
            () => undefined,
          );
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
    clearAuthenticatedSession,
    canWriteAccountState,
    isAuthenticated,
    membershipPendingAction,
    membershipRepository,
    mutationQueueRepository,
    runtimeMembershipRepositoryMode,
  ]);

  useEffect(() => {
    if (!isAuthenticated || learningBootstrapStatus !== 'ready') {
      return;
    }

    startMutationReplay().catch(() => undefined);
  }, [
    activeRoute,
    accountBootstrapHydrationSettled,
    isAuthenticated,
    learningBootstrapStatus,
    startMutationReplay,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (!state.isConnected || state.isInternetReachable === false) {
        accountBootstrapRefreshRequired.current = true;
        return;
      }

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        accountBootstrapRefreshRequired.current &&
        pendingLearningEventCount === 0
      ) {
        accountBootstrapRefreshRequired.current = false;
        accountBootstrapStatusRef.current = 'pending';
        setAccountBootstrapStatus('pending');
      }

      learningEventReplayPaused.current = false;
      startMutationReplay().catch(() => undefined);
    });

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        learningEventReplayPaused.current = false;
        if (
          runtimeAccountBootstrapMode === 'remote' &&
          accountBootstrapRefreshRequired.current &&
          pendingLearningEventCount === 0
        ) {
          accountBootstrapRefreshRequired.current = false;
          accountBootstrapStatusRef.current = 'pending';
          setAccountBootstrapStatus('pending');
        }
        startMutationReplay().catch(() => undefined);
        return;
      }

      accountBootstrapRefreshRequired.current = true;
    });

    return () => {
      unsubscribeNetInfo();
      subscription.remove();
    };
  }, [
    isAuthenticated,
    pendingLearningEventCount,
    runtimeAccountBootstrapMode,
    startMutationReplay,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !canWriteAccountState ||
      learningBootstrapStatus !== 'ready'
    ) {
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

    if (pendingLearningEventCount > 0) {
      setProgressSyncState({
        detail: '答题记录确认后再同步今天的学习进展。',
        label: '已排队',
        state: 'syncing',
      });
      mutationQueueRepository
        .enqueueMutation(
          'sync_daily_progress',
          {
            context: authenticatedRuntimeContext,
            snapshot: dailyProgressSnapshot,
          },
          `progress:${dailyProgressKey}`,
        )
        .then(() => {
          if (!isCancelled && pendingLearningEventCountRef.current === 0) {
            startMutationReplay().catch(() => undefined);
          }
        })
        .catch((error: unknown) => {
          if (isCancelled) {
            return;
          }

          setProgressSyncState({
            detail: getUserFacingErrorMessage(
              error,
              '今天的学习进展暂时无法安全排队。',
            ),
            label: '排队失败',
            state: 'error',
          });
        });

      return () => {
        isCancelled = true;
      };
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

        if (isRemoteAuthorizationError(error)) {
          clearAuthenticatedSession('登录已失效，请重新验证手机号。').catch(
            () => undefined,
          );
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
    clearAuthenticatedSession,
    dailyProgressKey,
    dailyProgressSnapshot,
    canWriteAccountState,
    isAuthenticated,
    lastSyncedProgressKey,
    learningBootstrapStatus,
    mutationQueueRepository,
    pendingLearningEventCount,
    progressSyncRepository,
    runtimeProgressSyncMode,
    startMutationReplay,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !canWriteAccountState ||
      Object.keys(spaceCardStateById).length === 0
    ) {
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

    if (pendingLearningEventCount > 0) {
      setSpaceStateSyncState({
        detail: '答题记录确认后再同步空间里的收藏和休眠状态。',
        label: '已排队',
        state: 'syncing',
      });
      mutationQueueRepository
        .enqueueMutation(
          'sync_space_state',
          {
            context: authenticatedRuntimeContext,
            snapshot: spaceStateSnapshot,
          },
          `space:${spaceStateSyncKey}`,
        )
        .then(() => {
          if (!isCancelled && pendingLearningEventCountRef.current === 0) {
            startMutationReplay().catch(() => undefined);
          }
        })
        .catch((error: unknown) => {
          if (isCancelled) {
            return;
          }

          setSpaceStateSyncState({
            detail: getUserFacingErrorMessage(
              error,
              '空间变更暂时无法安全排队。',
            ),
            label: '排队失败',
            state: 'error',
          });
        });

      return () => {
        isCancelled = true;
      };
    }

    setSpaceStateSyncState({
      detail:
        '正在同步空间里的收藏和休眠状态；当前位置和卡片列表仍可继续浏览。',
      label: '同步中',
      state: 'syncing',
    });
    startMutationReplay().catch(() => undefined);

    spaceStateRepository
      .syncSpaceState(authenticatedRuntimeContext, spaceStateSnapshot)
      .then(result => {
        if (isCancelled) {
          return;
        }

        const canonicalSpaceStateKey = JSON.stringify(result.snapshot);

        setLastSyncedSpaceStateKey(canonicalSpaceStateKey);
        if (
          result.mode === 'remote' &&
          canonicalSpaceStateKey !== spaceStateSyncKey
        ) {
          setSpaceCardStateById(spaceStateSnapshotToMap(result.snapshot));
        }
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

        if (isRemoteAuthorizationError(error)) {
          clearAuthenticatedSession('登录已失效，请重新验证手机号。').catch(
            () => undefined,
          );
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
    clearAuthenticatedSession,
    canWriteAccountState,
    isAuthenticated,
    lastSyncedSpaceStateKey,
    mutationQueueRepository,
    pendingLearningEventCount,
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

        const canonicalLearningState = accountBootstrapSnapshot
          ? resolveAccountBootstrapLearningState(
              accountBootstrapSnapshot,
              session,
            )
          : {
              learningResults: [],
              reviewResults: [],
            };

        setMappedAccountBootstrapSnapshot(accountBootstrapSnapshot);

        setLearningSession(session);
        setLearningCurrentResult(null);
        setLearningCompletedResults(canonicalLearningState.learningResults);
        const scheduledPhase =
          session.schedulingMode === 'server' &&
          session.serverSelection?.phase === 'review'
            ? 'review'
            : 'learning';
        setLearningPhase(scheduledPhase);
        setReviewSessionCards(scheduledPhase === 'review' ? session.cards : []);
        setReviewCompletedResults(canonicalLearningState.reviewResults);
        const nextVisibleCards =
          session.schedulingMode === 'server'
            ? session.cards
            : session.cards
                .slice(
                  0,
                  resolveAccessibleLearningCardCount(
                    session.cards.length,
                    membershipState,
                  ),
                )
                .filter(card => !readSpaceCardState(card.card_id).isSleeping);
        const restoredCursor = persistedLearningCursor.current;
        const restoredIndex =
          session.schedulingMode === 'local' &&
          restoredCursor !== null &&
          restoredCursor.sourceId === session.sourceId &&
          restoredCursor.track === session.track
            ? nextVisibleCards.findIndex(
                card => card.card_id === restoredCursor.cardId,
              )
            : -1;
        const nextIndex = restoredIndex >= 0 ? restoredIndex : 0;

        setLearningIndex(nextIndex);
        setLearningCardState(
          nextVisibleCards[nextIndex]
            ? createTrackedLearningCardState(nextVisibleCards[nextIndex])
            : null,
        );
        setLearningBootstrapStatus('ready');
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        if (isRemoteAuthorizationError(error)) {
          clearAuthenticatedSession('登录已失效，请重新验证手机号。').catch(
            () => undefined,
          );
          return;
        }

        setLearningSession(null);
        setLearningCardState(null);
        setLearningBootstrapStatus('error');
        setLearningBootstrapError(
          getUserFacingErrorMessage(error, '本轮卡片加载失败。'),
        );
        if (
          runtimeAccountBootstrapMode === 'remote' &&
          accountBootstrapSnapshot !== null
        ) {
          accountBootstrapStatusRef.current = 'deferred';
          setAccountBootstrapStatus('deferred');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    accountBootstrapSnapshot,
    createTrackedLearningCardState,
    authenticatedRuntimeContext,
    clearAuthenticatedSession,
    isAuthenticated,
    learningBootstrapStatus,
    learningTrack,
    learningSessionRepository,
    membershipState,
    readSpaceCardState,
    runtimeAccountBootstrapMode,
  ]);

  useEffect(() => {
    if (
      accountBootstrapSnapshot === null ||
      learningSession === null ||
      learningBootstrapStatus !== 'ready' ||
      mappedAccountBootstrapSnapshot === accountBootstrapSnapshot
    ) {
      return;
    }

    try {
      const canonicalLearningState = resolveAccountBootstrapLearningState(
        accountBootstrapSnapshot,
        learningSession,
      );
      setMappedAccountBootstrapSnapshot(accountBootstrapSnapshot);
      setLearningCompletedResults(canonicalLearningState.learningResults);
      setReviewCompletedResults(canonicalLearningState.reviewResults);
      setLearningCurrentResult(null);
      const scheduledPhase =
        learningSession.schedulingMode === 'server' &&
        learningSession.serverSelection?.phase === 'review'
          ? 'review'
          : 'learning';
      setLearningPhase(scheduledPhase);
      setReviewSessionCards(
        scheduledPhase === 'review' ? learningSession.cards : [],
      );

      const nextVisibleCards = resolveVisibleLearningCards(
        learningSession,
        spaceCardStateById,
        membershipState,
      );
      const restoredCursor = accountBootstrapSnapshot.learning.cursor;
      const restoredIndex =
        restoredCursor && learningSession.schedulingMode === 'local'
          ? nextVisibleCards.findIndex(
              card => card.card_id === restoredCursor.cardId,
            )
          : -1;
      const nextIndex = restoredIndex >= 0 ? restoredIndex : 0;

      setLearningIndex(nextIndex);
      setLearningCardState(
        nextVisibleCards[nextIndex]
          ? createTrackedLearningCardState(
              nextVisibleCards[nextIndex],
              spaceCardStateById,
            )
          : null,
      );
    } catch (error) {
      accountBootstrapStatusRef.current = 'deferred';
      setAccountBootstrapStatus('deferred');
      setLearningSession(null);
      setLearningCardState(null);
      setLearningBootstrapStatus('error');
      setLearningBootstrapError(
        getUserFacingErrorMessage(error, '本轮卡片加载失败。'),
      );
    }
  }, [
    accountBootstrapSnapshot,
    createTrackedLearningCardState,
    learningBootstrapStatus,
    learningSession,
    mappedAccountBootstrapSnapshot,
    membershipState,
    resolveVisibleLearningCards,
    spaceCardStateById,
  ]);

  useEffect(() => {
    if (
      runtimeAccountBootstrapMode !== 'remote' ||
      accountBootstrapStatus !== 'ready' ||
      accountBootstrapSnapshot === null ||
      mappedAccountBootstrapSnapshot !== accountBootstrapSnapshot ||
      learningBootstrapStatus !== 'ready' ||
      accountBootstrapHydrationSettled
    ) {
      return;
    }

    accountBootstrapHydrationSettledRef.current = true;
    setLastSyncedProgressKey(dailyProgressKey);
    if (
      dailyProgressSnapshot.checkedInToday ||
      dailyProgressSnapshot.totalCompletedCount > 0
    ) {
      setProgressSyncState({
        detail: '今天的学习进展已从服务端恢复。',
        label: '已同步',
        state: 'synced',
      });
    }
    if (
      runtimeLearningEventsMode === 'remote' &&
      pendingLearningEventCount === 0
    ) {
      setLearningEventRecoveryPending(false);
      setLearningStateSyncState(current =>
        current.label === '记录失败'
          ? current
          : {
              detail: '服务端学习状态已恢复。',
              label: '已同步',
              state: 'synced',
            },
      );
    }
    setAccountBootstrapHydrationSettled(true);
  }, [
    accountBootstrapHydrationSettled,
    accountBootstrapSnapshot,
    accountBootstrapStatus,
    dailyProgressKey,
    dailyProgressSnapshot.checkedInToday,
    dailyProgressSnapshot.totalCompletedCount,
    learningBootstrapStatus,
    mappedAccountBootstrapSnapshot,
    pendingLearningEventCount,
    runtimeAccountBootstrapMode,
    runtimeLearningEventsMode,
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

    if (runtimeMembershipRepositoryMode === 'remote' && !canWriteAccountState) {
      setMembershipError('账户状态确认中，请稍后重试。');
      retryCanonicalAccountBootstrap().catch(() => undefined);
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
        if (isRemoteAuthorizationError(error)) {
          clearAuthenticatedSession('登录已失效，请重新验证手机号。').catch(
            () => undefined,
          );
          return;
        }

        if (shouldQueueMembershipTrialStart(error)) {
          mutationQueueRepository
            .enqueueMutation(
              'start_membership_trial',
              {
                context: authenticatedRuntimeContext,
                currentState: membershipState,
              },
              'membership-trial:start',
            )
            .catch(() => undefined);
          setMembershipError(
            `${getUserFacingErrorMessage(
              error,
              '试用开通暂时失败。',
            )} 请求已记录；网络恢复并由服务端确认后会自动更新。`,
          );
          setMembershipPendingAction(null);
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
      const phoneNumber = value.replace(/[^\d]/g, '').slice(0, 11);

      setAuthState(current => ({
        ...current,
        challenge:
          current.phoneNumber === phoneNumber ? current.challenge : null,
        error: null,
        phoneNumber,
        smsCode: current.phoneNumber === phoneNumber ? current.smsCode : '',
        stage:
          current.phoneNumber === phoneNumber ||
          current.stage === 'authenticated'
            ? current.stage
            : 'logged_out',
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

      if (!isPhoneNumberReady(authState.phoneNumber)) {
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
        .then(challenge => {
          setAuthState(current =>
            current.phoneNumber === phoneNumber
              ? {
                  ...current,
                  challenge,
                  error: null,
                  pendingAction: null,
                  smsCode: '',
                  stage: 'code_sent',
                }
              : {
                  ...current,
                  pendingAction: null,
                },
          );
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

      if (authState.challenge === null) {
        setAuthState(current => ({
          ...current,
          error: '验证码请求已失效，请重新获取。',
          stage: 'logged_out',
        }));
        return;
      }

      if (!isSmsCodeReady(authState.smsCode)) {
        setAuthState(current => ({
          ...current,
          error: '请输入 4-6 位验证码。',
        }));
        return;
      }

      const phoneNumber = authState.phoneNumber;
      const smsCode = authState.smsCode;
      const challenge = authState.challenge;
      setAuthState(current => ({
        ...current,
        error: null,
        pendingAction: 'verify_code',
      }));
      setMembershipError(null);
      setMembershipPendingAction(null);

      let sessionEstablished = false;

      (async () => {
        const session = await authRepository.verifySmsCode({
          challenge,
          phoneNumber,
          smsCode,
        });
        await authSessionCoordinator.establish(session);
        sessionEstablished = true;

        const hydration = await loadAuthenticatedRuntimeHydration(session);

        return {
          hydration,
          session,
        };
      })()
        .then(({ hydration, session }) => {
          if (runtimeMembershipRepositoryMode === 'remote') {
            lastMembershipRefreshKey.current =
              hydration.membershipRefreshSucceeded ? activeRoute : null;
            pendingMembershipRefreshKey.current = null;
          }
          applyAuthenticatedRuntimeHydration(hydration);
          setAuthState(current => ({
            ...current,
            authToken: getAuthAccessToken(session) ?? null,
            challenge: null,
            error: null,
            pendingAction: null,
            phoneNumber: session.phoneNumber,
            smsCode: '',
            stage: 'authenticated',
          }));
        })
        .catch(async (error: unknown) => {
          if (sessionEstablished && isRemoteAuthorizationError(error)) {
            await clearAuthenticatedSession('登录已失效，请重新验证手机号。');
            return;
          }

          if (sessionEstablished) {
            try {
              await authSessionCoordinator.invalidate();
            } catch (clearError) {
              console.warn(
                '[AppPersistence] Failed to roll back incomplete login.',
                clearError,
              );
            }
          }

          setAuthState(current => ({
            ...current,
            error: getUserFacingErrorMessage(error, '验证码暂时没通过。'),
            pendingAction: null,
          }));
        });
    },
    onLogout: () => {
      return clearAuthenticatedSession(null, true);
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

      if (
        runtimeMembershipRepositoryMode === 'remote' &&
        !canWriteAccountState
      ) {
        setMembershipError('账户状态确认中，请稍后重试。');
        retryCanonicalAccountBootstrap().catch(() => undefined);
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
          if (isRemoteAuthorizationError(error)) {
            clearAuthenticatedSession('登录已失效，请重新验证手机号。').catch(
              () => undefined,
            );
            return;
          }

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

      if (
        runtimeMembershipRepositoryMode === 'remote' &&
        !canWriteAccountState
      ) {
        setMembershipError('账户状态确认中，请稍后重试。');
        retryCanonicalAccountBootstrap().catch(() => undefined);
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
          if (isRemoteAuthorizationError(error)) {
            clearAuthenticatedSession('登录已失效，请重新验证手机号。').catch(
              () => undefined,
            );
            return;
          }

          setMembershipError(
            getUserFacingErrorMessage(error, '恢复购买提醒暂时无法更新。'),
          );
          setMembershipPendingAction(null);
        });
    },
  };

  const commitLearningCardAdvance = (completedResult: LearningCardResult) => {
    const nextResults = [...activeCompletedResults, completedResult];
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
          lastModifiedAt: new Date().toISOString(),
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
      if (
        learningCurrentResult === null ||
        learningEventEnqueueInFlight.current !== null ||
        (runtimeLearningEventsMode === 'remote' &&
          pendingLearningEventCountRef.current > 0)
      ) {
        return;
      }

      const completedResult = learningCurrentResult;

      if (runtimeLearningEventsMode === 'local') {
        commitLearningCardAdvance(completedResult);
        setLearningStateSyncState({
          detail: '当前答题记录已记录。',
          label: '已记录',
          state: 'idle',
        });
        return;
      }

      const completionSession = authSessionCoordinator.getCurrentSession();
      const completionSessionScopeKey =
        getAuthSessionScopeKey(completionSession);

      if (
        authenticatedRuntimeContext === null ||
        completionSession === null ||
        completionSessionScopeKey === null ||
        completionSession.phoneNumber !==
          authenticatedRuntimeContext.phoneNumber ||
        learningSession === null ||
        learningSession.contentVersion === null ||
        learningSession.schedulingMode !== 'server' ||
        learningSession.serverSelection === null ||
        learningSession.serverSelection.cardId !== completedResult.cardId ||
        learningEventRecoveryPending ||
        !canWriteAccountState
      ) {
        setLearningStateSyncState({
          detail: learningEventRecoveryPending
            ? '正在恢复上次安全保存的答题记录，确认完成后再继续。'
            : learningSession?.contentVersion === null
            ? '当前内容版本无法验证，本次答题未记录。'
            : '账户状态确认中，本次答题尚未记录，请稍后重试。',
          label: '记录受阻',
          state: 'error',
        });
        if (learningEventRecoveryPending) {
          startMutationReplay().catch(() => undefined);
        } else {
          retryCanonicalAccountBootstrap().catch(() => undefined);
        }
        return;
      }

      const accountPhoneNumber = authenticatedRuntimeContext.phoneNumber;
      const contentVersion = learningSession.contentVersion;
      const completedPhase = learningSession.serverSelection.phase;
      const completedSelectionId = learningSession.serverSelection.selectionId;
      const completedTrack = learningSession.track;
      const enqueueOperation = {
        sessionScopeKey: completionSessionScopeKey,
      };

      learningEventEnqueueInFlight.current = enqueueOperation;
      setLearningStateSyncState({
        detail: '正在安全保存本次答题记录。',
        label: '记录中',
        state: 'syncing',
      });

      (async () => {
        try {
          await learningEventSyncRepository.enqueueCompletion({
            accountPhoneNumber,
            contentVersion,
            phase: completedPhase,
            result: completedResult,
            selectionId: completedSelectionId,
            track: completedTrack,
          });

          if (
            getAuthSessionScopeKey(
              authSessionCoordinator.getCurrentSession(),
            ) !== completionSessionScopeKey
          ) {
            return;
          }

          learningEventReplayPaused.current = false;
          pendingLearningEventCountRef.current += 1;
          setPendingLearningEventCount(pendingLearningEventCountRef.current);
          setLearningEventRecoveryPending(true);

          try {
            const pendingCount =
              await learningEventSyncRepository.getPendingCount(
                accountPhoneNumber,
              );
            pendingLearningEventCountRef.current = pendingCount;
            setPendingLearningEventCount(pendingCount);
          } catch {
            // Keep the conservative increment when the exact count is unavailable.
          }

          if (
            getAuthSessionScopeKey(
              authSessionCoordinator.getCurrentSession(),
            ) !== completionSessionScopeKey
          ) {
            return;
          }

          commitLearningCardAdvance(completedResult);
          setLearningStateSyncState({
            detail: '答题记录已安全保存在本机，正在等待服务端确认。',
            label: '待同步',
            state: 'syncing',
          });
          startMutationReplay().catch(() => undefined);
        } catch (error) {
          if (
            getAuthSessionScopeKey(
              authSessionCoordinator.getCurrentSession(),
            ) !== completionSessionScopeKey
          ) {
            return;
          }

          setLearningStateSyncState({
            detail: getUserFacingErrorMessage(
              error,
              '本次答题记录无法安全保存，请重试。',
            ),
            label: '记录失败',
            state: 'error',
          });
        } finally {
          if (learningEventEnqueueInFlight.current === enqueueOperation) {
            learningEventEnqueueInFlight.current = null;
          }
        }
      })();
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
          lastModifiedAt: new Date().toISOString(),
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
          lastModifiedAt: new Date().toISOString(),
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
  const openLearningRoute = () => {
    startTransition(() => {
      setActiveRoute('learning');
      setLearningScreen('practice');
      setSpaceScreen('overview');
    });
  };
  const startReviewFromStatistics = () => {
    if (reviewCandidateCards.length === 0) {
      openLearningRoute();
      return;
    }

    const canStartReviewHere = membershipAccess.completeAlgorithm;
    learningHandlers.onStartReview();
    if (canStartReviewHere) {
      openLearningRoute();
    }
  };
  const retryLearningBootstrap = () => {
    if (
      runtimeAccountBootstrapMode === 'remote' &&
      accountBootstrapStatusRef.current !== 'ready'
    ) {
      retryCanonicalAccountBootstrap()
        .then(succeeded => {
          if (succeeded) {
            setLearningBootstrapStatus('idle');
            setLearningBootstrapError(null);
          }
        })
        .catch(() => undefined);
      return;
    }

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
    visibleLearningCards.length === 0 &&
    learningSession?.schedulingMode !== 'server' ? (
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
      currentIndex={learningIndex}
      isLastCard={learningIndex === activeSessionCards.length - 1}
      onAdvanceCard={learningHandlers.onAdvanceCard}
      onBackToPractice={() => setLearningScreen('practice')}
      palette={palette}
      phase={learningPhase}
      result={learningCurrentResult}
      sessionCardCount={activeSessionCards.length}
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
      deviceClass={deviceClass}
      hasCheckedInToday={hasCheckedInToday}
      learningResults={learningCompletedResults}
      onCheckIn={statisticsHandlers.onCheckIn}
      onGoToLearning={openLearningRoute}
      onStartReview={startReviewFromStatistics}
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
      <AppCanvasBackdrop palette={palette} />
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

function AppCanvasBackdrop({ palette }: { palette: Palette }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.appCanvasBackdrop,
        { backgroundColor: palette.background },
      ]}
    />
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
      <PhoneTopBar
        authState={authState}
        onOpenAccount={() => onSelectRoute('mine')}
        palette={palette}
        route={route}
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
                        backgroundColor: palette.activeSurface,
                        shadowColor: palette.activeSurface,
                      }
                    : null,
                ]}
                testID={`route-tab-${item.key}`}
              >
                <RouteIcon
                  active={isActive}
                  color={isActive ? palette.activeText : palette.tabIdle}
                  routeKey={item.key}
                />
                <Text
                  style={[
                    styles.phoneTabLabel,
                    {
                      color: isActive ? palette.activeText : palette.textMuted,
                    },
                  ]}
                  testID={`route-tab-label-${item.key}`}
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

function RouteIcon({
  active = false,
  color,
  routeKey,
  variant = 'tab',
}: {
  active?: boolean;
  color: string;
  routeKey: RouteKey;
  variant?: 'tab' | 'sidebar' | 'header';
}) {
  const iconStyle =
    variant === 'sidebar'
      ? styles.routeIconFrameSidebar
      : variant === 'header'
      ? styles.routeIconFrameHeader
      : styles.routeIconFrameTab;
  const strokeWidth = variant === 'tab' ? 2 : 2.2;
  const lineStyle = {
    backgroundColor: color,
  };
  const borderStyle = {
    borderColor: color,
  };

  if (routeKey === 'learning') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.routeIconFrame, iconStyle]}
      >
        <View
          style={[
            styles.routeIconBook,
            borderStyle,
            active ? styles.routeIconBookActive : null,
          ]}
        >
          <View style={[styles.routeIconBookSpine, lineStyle]} />
          <View style={[styles.routeIconBookLine, lineStyle]} />
          <View style={[styles.routeIconBookLineShort, lineStyle]} />
        </View>
      </View>
    );
  }

  if (routeKey === 'space') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.routeIconFrame, iconStyle]}
      >
        <View
          style={[
            styles.routeIconSpaceLine,
            styles.routeIconSpaceLineTop,
            lineStyle,
            { height: strokeWidth },
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceLine,
            styles.routeIconSpaceLineBottom,
            lineStyle,
            { height: strokeWidth },
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceNode,
            styles.routeIconSpaceNodeStart,
            borderStyle,
            active ? lineStyle : null,
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceNode,
            styles.routeIconSpaceNodeMiddle,
            borderStyle,
            active ? lineStyle : null,
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceNode,
            styles.routeIconSpaceNodeEnd,
            borderStyle,
            active ? lineStyle : null,
          ]}
        />
      </View>
    );
  }

  if (routeKey === 'statistics') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.routeIconFrame, iconStyle, styles.routeIconStatsFrame]}
      >
        <View style={[styles.routeIconStatBarShort, lineStyle]} />
        <View style={[styles.routeIconStatBarMid, lineStyle]} />
        <View style={[styles.routeIconStatBarTall, lineStyle]} />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.routeIconFrame, iconStyle]}
    >
      <View
        style={[
          styles.routeIconMineHead,
          borderStyle,
          active ? lineStyle : null,
        ]}
      />
      <View style={[styles.routeIconMineBody, borderStyle]} />
    </View>
  );
}

function PhoneTopBar({
  authState,
  onOpenAccount,
  palette,
  route,
}: {
  authState: AuthState;
  onOpenAccount: () => void;
  palette: Palette;
  route: ShellRoute;
}) {
  const accountChipCopy = getShellAccountChipCopy(authState);
  const routeCue =
    route.key === 'learning'
      ? '继续当前卡'
      : route.key === 'space'
      ? '查看卡片位置'
      : route.key === 'statistics'
      ? '今日进展'
      : '学习账户';

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
      <Pressable
        accessibilityLabel={`${accountChipCopy.label}，${accountChipCopy.value}`}
        accessibilityRole="button"
        onPress={() => {
          startTransition(() => onOpenAccount());
        }}
        style={[
          styles.phoneAccountChip,
          {
            backgroundColor: palette.panelStrong,
            borderColor: palette.border,
          },
        ]}
        testID="shell-account-chip"
      >
        <View
          style={[
            styles.phoneAccountChipDot,
            { backgroundColor: palette.textMuted },
          ]}
        />
        <View style={styles.phoneAccountChipCopy}>
          <Text
            style={[styles.phoneAccountChipLabel, { color: palette.textMuted }]}
          >
            {accountChipCopy.label}
          </Text>
          <Text style={[styles.phoneAccountChipValue, { color: palette.text }]}>
            {accountChipCopy.value}
          </Text>
        </View>
      </Pressable>
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
                <RouteIcon
                  active={isActive}
                  color={isActive ? palette.accentStrong : palette.tabIdle}
                  routeKey={item.key}
                  variant="sidebar"
                />
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
          onOpenAccount={() => onSelectRoute('mine')}
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
  onOpenAccount,
  palette,
  route,
  deviceClass,
}: {
  authState: AuthState;
  onOpenAccount: () => void;
  palette: Palette;
  route: ShellRoute;
  deviceClass: DeviceClass;
}) {
  const accountChipCopy = getShellAccountChipCopy(authState);

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
        <Pressable
          accessibilityLabel={`${accountChipCopy.label}，${accountChipCopy.value}`}
          accessibilityRole="button"
          onPress={() => {
            startTransition(() => onOpenAccount());
          }}
          style={[
            styles.headerAccountChip,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
          testID="shell-account-chip-tablet"
        >
          <RouteIcon
            color={palette.textMuted}
            routeKey="mine"
            variant="header"
          />
          <View style={styles.headerAccountCopy}>
            <Text
              style={[styles.headerAccountLabel, { color: palette.textMuted }]}
            >
              {accountChipCopy.label}
            </Text>
            <Text style={[styles.headerAccountValue, { color: palette.text }]}>
              {accountChipCopy.value}
            </Text>
          </View>
        </Pressable>
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
  const statusCopy = getAuthStatusCopy(authState);

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
        {statusCopy.label}
      </Text>
      <Text style={[styles.statusBadgeValue, { color: palette.text }]}>
        {statusCopy.value}
      </Text>
    </View>
  );
}

function AuthGate({
  authRepositoryMode,
  authState,
  cardTestID,
  embedded = false,
  handlers,
  palette,
  route,
}: {
  authRepositoryMode: 'local' | 'remote';
  authState: AuthState;
  cardTestID?: string;
  embedded?: boolean;
  handlers: AuthHandlers;
  palette: Palette;
  route: ShellRoute;
}) {
  const hasSentCode = authState.stage === 'code_sent';
  const isMineAccountGate = embedded && route.key === 'mine';
  const isRouteObjectGate = route.key !== 'mine';
  const isCompactAuthGate = isMineAccountGate || isRouteObjectGate;
  const authGateContent =
    route.key === 'space'
      ? {
          continuityPill: '空间',
          eyebrow: '空间',
          gateSummary: '确认手机号后直接回到当前盒位。',
          gateTitle: '确认后进入空间',
          retainedSummary: '书架、分区和卡盒都留在原位。',
          retainedTitle: '当前位置已保留',
          returnTarget: '空间',
        }
      : route.key === 'statistics'
      ? {
          continuityPill: '统计',
          eyebrow: '今日进展',
          gateSummary: '确认手机号后查看今天的完成、回看和签到。',
          gateTitle: '确认后查看进展',
          retainedSummary: '完成、回看和签到都会接上。',
          retainedTitle: '今日节奏已保留',
          returnTarget: '今日进展',
        }
      : route.key === 'mine'
      ? {
          continuityPill: '账户',
          eyebrow: '学习账户',
          gateSummary: '学习记录、空间位置和会员权益统一归到这个账号。',
          gateTitle: '确认手机号',
          retainedSummary: hasSentCode
            ? '短码确认后可查看记录与权益。'
            : '手机号确认后可查看记录与权益。',
          retainedTitle: '账号归属待确认',
          returnTarget: '我的',
        }
      : {
          continuityPill: '学习',
          eyebrow: '当前卡',
          gateSummary: '手机号确认后，题面、进度和权益会自动接上。',
          gateTitle: '从这张题继续',
          retainedSummary: '确认后回到作答区。',
          retainedTitle: '题面和作答位置已保留',
          returnTarget: '当前卡',
        };

  return (
    <View
      style={[
        styles.authGateScreen,
        embedded ? styles.authGateScreenEmbedded : null,
        isRouteObjectGate ? styles.authGateScreenRouteObject : null,
      ]}
      testID={isRouteObjectGate ? 'auth-route-object-screen' : undefined}
    >
      <View
        style={[
          styles.authEntryCard,
          embedded ? styles.authEntryCardEmbedded : null,
          isRouteObjectGate ? styles.authEntryCardRouteObject : null,
          isMineAccountGate ? styles.authEntryCardMine : null,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
        testID={
          cardTestID ??
          (isRouteObjectGate ? 'auth-route-object-card' : undefined)
        }
      >
        <View
          style={[
            styles.authObjectHeader,
            isRouteObjectGate ? styles.authObjectHeaderRouteObject : null,
            isMineAccountGate ? styles.authObjectHeaderMine : null,
          ]}
        >
          {isMineAccountGate ? (
            <View
              style={styles.authMinePassportHeader}
              testID="auth-mine-account-header"
            >
              <View
                style={[
                  styles.authMineAvatar,
                  { backgroundColor: palette.accent },
                ]}
              >
                <RouteIcon active color={palette.panel} routeKey="mine" />
              </View>
              <View style={styles.authMineHeaderCopy}>
                <View style={styles.authMineHeaderTopRow}>
                  <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
                    {authGateContent.eyebrow}
                  </Text>
                  <View
                    style={[
                      styles.authObjectBadge,
                      styles.authObjectBadgeMine,
                      {
                        backgroundColor: palette.panelStrong,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.authObjectBadgeValue,
                        { color: palette.text },
                      ]}
                    >
                      {hasSentCode ? '短码' : '手机'}
                    </Text>
                    <Text
                      style={[
                        styles.authObjectBadgeLabel,
                        { color: palette.textMuted },
                      ]}
                    >
                      {hasSentCode ? '待确认' : '验证'}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.authGateTitle,
                    styles.authGateTitleMine,
                    { color: palette.text },
                  ]}
                  testID="auth-gate-title"
                >
                  {authGateContent.gateTitle}
                </Text>
                <Text
                  onPress={Keyboard.dismiss}
                  style={[styles.authGateSummary, { color: palette.textMuted }]}
                  testID="auth-gate-keyboard-dismiss-target"
                >
                  {authGateContent.gateSummary}
                </Text>
              </View>
            </View>
          ) : (
            <>
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
                    style={[
                      styles.authObjectBadgeValue,
                      { color: palette.text },
                    ]}
                  >
                    {hasSentCode ? '短码已发' : '短信验证'}
                  </Text>
                  <Text
                    style={[
                      styles.authObjectBadgeLabel,
                      { color: palette.textMuted },
                    ]}
                  >
                    手机号
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.authGateTitle,
                  isRouteObjectGate ? styles.authGateTitleRouteObject : null,
                  { color: palette.text },
                ]}
                testID="auth-gate-title"
              >
                {authGateContent.gateTitle}
              </Text>
              <Text
                onPress={Keyboard.dismiss}
                style={[styles.authGateSummary, { color: palette.textMuted }]}
                testID="auth-gate-keyboard-dismiss-target"
              >
                {authGateContent.gateSummary}
              </Text>
            </>
          )}
        </View>
        <View
          style={[
            styles.authGateActionStack,
            isCompactAuthGate ? styles.authGateActionStackCompact : null,
            isMineAccountGate ? styles.authGateActionStackMine : null,
          ]}
          testID="auth-gate-action-stack"
        >
          <View
            style={[
              styles.authRetainedObject,
              isCompactAuthGate ? styles.authRetainedObjectCompact : null,
              isMineAccountGate ? styles.authRetainedObjectMine : null,
              {
                backgroundColor: isCompactAuthGate
                  ? hexToRgba(palette.accent, 0.045)
                  : palette.panelStrong,
                borderColor: isCompactAuthGate
                  ? hexToRgba(palette.accent, 0.12)
                  : palette.border,
              },
            ]}
            testID="auth-continuity-promise"
          >
            <View
              style={[
                styles.authRetainedHead,
                isCompactAuthGate ? styles.authRetainedHeadCompact : null,
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.authRetainedAccent,
                  isCompactAuthGate ? styles.authRetainedAccentCompact : null,
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
              <View
                style={[
                  styles.authContinuityPromisePill,
                  {
                    backgroundColor: palette.panel,
                    borderColor: hexToRgba(palette.accent, 0.16),
                  },
                ]}
                testID="auth-continuity-promise-pill"
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.authContinuityPromiseText,
                    { color: palette.text },
                  ]}
                >
                  {authGateContent.continuityPill}
                </Text>
              </View>
            </View>
          </View>
          <PhoneSmsPanel
            accountDock={isMineAccountGate}
            authState={authState}
            embedded
            handlers={handlers}
            palette={palette}
            routeDock={isRouteObjectGate}
            returnTarget={authGateContent.returnTarget}
            title="手机号验证"
            summary={
              authRepositoryMode === 'remote'
                ? '用短信短码确认身份。'
                : '输入短码确认身份。'
            }
            successMessage={
              authRepositoryMode === 'remote'
                ? '已完成短信验证码登录。'
                : '已完成登录。'
            }
          />
        </View>
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
  const hasSentCode = authState.stage === 'code_sent';
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
  const profileContinuityValue = isAuthenticated ? '当前卡' : profileName;
  const profileDetail = isAuthenticated
    ? `${checkedInToday ? '已签到' : '未签到'} · ${completedCount} 张`
    : '学习/空间/会员';
  const profileIdentityLabel = isAuthenticated ? '继续位置' : '身份';
  const profileProgressLabel = isAuthenticated ? '今日' : '同步';
  const syncDetail = isAuthenticated
    ? progressSyncState.state === 'error' ||
      learningStateSyncState.state === 'error'
      ? '记录待重试'
      : progressSyncState.state === 'syncing' ||
        learningStateSyncState.state === 'syncing'
      ? '记录保存中'
      : '记录已保存'
    : hasSentCode
    ? '输入验证码'
    : '手机验证码';
  const membershipTitle = isAuthenticated
    ? getMembershipCardTitle(membershipState.stage)
    : hasSentCode
    ? '验证码已发'
    : '待登录';
  const accountSummary = isAuthenticated
    ? `${profileName} · ${syncDetail}`
    : '学习记录、空间位置和会员权益会归到同一账号。';
  const mineStatusItems = [
    { label: '完成', testID: 'mine-metric-completed', value: completedCount },
    {
      label: '回看',
      testID: 'mine-metric-review',
      tone: pendingReviewCount > 0 ? 'warning' : 'neutral',
      value: pendingReviewCount,
    },
    { label: '收藏', testID: 'mine-metric-favorites', value: favoriteCount },
    { label: '休眠', testID: 'mine-metric-sleeping', value: sleepingCount },
  ] as const;

  if (!isAuthenticated) {
    return (
      <View
        style={[
          styles.mineScreen,
          deviceClass === 'tablet' ? styles.mineScreenTablet : null,
        ]}
        testID="mine-surface"
      >
        <AuthGate
          authRepositoryMode={authRepositoryMode}
          authState={authState}
          cardTestID="mine-profile-card"
          embedded
          handlers={handlers}
          palette={palette}
          route={MINE_ROUTE}
        />
      </View>
    );
  }

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
        <View style={styles.minePassportStack} testID="mine-passport-stack">
          <View style={styles.minePassportHeader}>
            <View
              style={[styles.mineAvatar, { backgroundColor: palette.accent }]}
            >
              <RouteIcon active color={palette.panel} routeKey="mine" />
            </View>
            <View style={styles.mineAccountHeaderCopy}>
              <Text
                style={[styles.mineAccountEyebrow, { color: palette.accent }]}
              >
                学习账户
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.mineAccountTitle, { color: palette.text }]}
              >
                账户已接上
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.mineAccountSummary,
                  { color: palette.textMuted },
                ]}
              >
                {accountSummary}
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
                style={[
                  styles.mineMembershipPillText,
                  { color: palette.accent },
                ]}
                testID="mine-membership-stage"
              >
                {membershipTitle}
              </Text>
            </View>
          </View>

          <View style={styles.mineContinuityDock}>
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
                  style={[
                    styles.mineIdentityLabel,
                    { color: palette.textMuted },
                  ]}
                >
                  {profileIdentityLabel}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.mineIdentityValue, { color: palette.text }]}
                  testID="mine-profile-phone"
                >
                  {profileContinuityValue}
                </Text>
              </View>
              <View style={styles.mineIdentityCopy}>
                <Text
                  style={[
                    styles.mineIdentityLabel,
                    { color: palette.textMuted },
                  ]}
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
            </View>

            <View
              style={[
                styles.mineMetricStrip,
                deviceClass === 'tablet' ? styles.mineMetricStripTablet : null,
                {
                  backgroundColor: palette.panelStrong,
                  borderColor: hexToRgba(palette.textMuted, 0.08),
                },
              ]}
              testID="mine-status-strip"
            >
              {mineStatusItems.map(item => {
                const valueColor =
                  'tone' in item && item.tone === 'warning'
                    ? palette.warning
                    : palette.text;

                return (
                  <View
                    key={item.testID}
                    style={styles.mineSignalPill}
                    testID={item.testID}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.mineSignalLabel,
                        { color: palette.textMuted },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.mineSignalValue, { color: valueColor }]}
                      testID={`${item.testID}-value`}
                    >
                      {`${item.value}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.mineRouteDock} testID="mine-route-dock">
          <View
            style={[
              styles.mineActionRail,
              deviceClass === 'tablet' ? styles.mineActionRailTablet : null,
            ]}
            testID="mine-action-rail"
          >
            <MineActionCard
              detail={
                pendingReviewCount > 0
                  ? `${pendingReviewCount} 张卡等待回看`
                  : '当前顺序，下一张已准备好'
              }
              heroLabel={
                pendingReviewCount > 0 ? '先回看，再继续前进' : '从这里继续'
              }
              heroValue={pendingReviewCount > 0 ? '回看' : '当前卡'}
              label="继续学习"
              metaItems={[
                {
                  label: '今日',
                  testID: 'mine-resume-today',
                  value: profileDetail,
                },
                {
                  label: '回看',
                  testID: 'mine-resume-review',
                  value: `${pendingReviewCount} 张`,
                },
                {
                  label: '记录',
                  testID: 'mine-resume-sync',
                  value: syncDetail,
                },
              ]}
              onPress={onGoToLearning}
              palette={palette}
              routeKey="learning"
              testID="mine-go-learning"
              variant="primary"
            />
            <View
              style={styles.mineSecondaryActionRow}
              testID="mine-secondary-action-row"
            >
              <MineActionCard
                detail={`${favoriteCount} 收藏 · ${sleepingCount} 休眠`}
                label="空间"
                onPress={onGoToSpace}
                palette={palette}
                routeKey="space"
                testID="mine-go-space"
              />
              <MineActionCard
                detail={checkedInToday ? '今日已签到' : '今日未签到'}
                label="今日"
                onPress={onGoToStatistics}
                palette={palette}
                routeKey="statistics"
                testID="mine-go-statistics"
              />
            </View>
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
        </View>
      </View>
    </View>
  );
}

function MineActionCard({
  detail,
  heroLabel,
  heroValue,
  label,
  metaItems,
  onPress,
  palette,
  routeKey,
  testID,
  variant = 'secondary',
}: {
  detail: string;
  heroLabel?: string;
  heroValue?: string;
  label: string;
  metaItems?: Array<{
    label: string;
    testID: string;
    value: string;
  }>;
  onPress: () => void;
  palette: Palette;
  routeKey: RouteKey;
  testID: string;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  const foregroundColor = isPrimary ? palette.primaryActionText : palette.text;
  const mutedColor = isPrimary ? palette.primaryActionMuted : palette.textMuted;
  const glyph = (
    <View
      style={[
        styles.mineActionGlyph,
        {
          backgroundColor: isPrimary
            ? hexToRgba(palette.primaryActionText, 0.12)
            : palette.accentSoft,
          borderColor: isPrimary
            ? hexToRgba(palette.primaryActionText, 0.16)
            : palette.border,
        },
      ]}
    >
      <RouteIcon
        active={isPrimary}
        color={isPrimary ? palette.primaryActionText : palette.accent}
        routeKey={routeKey}
      />
    </View>
  );
  const copy = (
    <View style={styles.mineActionCopy}>
      <Text
        numberOfLines={1}
        style={[
          styles.mineActionLabel,
          isPrimary ? styles.mineActionLabelPrimary : null,
          { color: foregroundColor },
        ]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={isPrimary ? 1 : 2}
        style={[
          styles.mineActionDetail,
          isPrimary ? styles.mineActionDetailPrimary : null,
          { color: mutedColor },
        ]}
      >
        {detail}
      </Text>
    </View>
  );
  const arrow = (
    <Text style={[styles.mineActionArrow, { color: mutedColor }]}>→</Text>
  );
  const primaryHeader = (
    <View style={styles.mineActionPrimaryHeader} testID="mine-resume-header">
      {glyph}
      {copy}
      {arrow}
    </View>
  );
  const primaryCenter =
    isPrimary && heroValue ? (
      <View style={styles.mineActionPrimaryCenter} testID="mine-resume-center">
        <Text
          numberOfLines={1}
          style={[
            styles.mineActionPrimaryHero,
            { color: palette.primaryActionText },
          ]}
          testID="mine-resume-hero"
        >
          {heroValue}
        </Text>
        {heroLabel ? (
          <Text
            numberOfLines={1}
            style={[styles.mineActionPrimaryHeroLabel, { color: mutedColor }]}
            testID="mine-resume-hero-label"
          >
            {heroLabel}
          </Text>
        ) : null}
      </View>
    ) : null;
  const primaryMeta =
    isPrimary && metaItems?.length ? (
      <View
        style={styles.mineActionPrimaryMetaRow}
        testID="mine-resume-meta-row"
      >
        {metaItems.map(item => (
          <View
            key={item.testID}
            style={[
              styles.mineActionPrimaryMetaPill,
              {
                backgroundColor: hexToRgba(palette.primaryActionText, 0.08),
                borderColor: hexToRgba(palette.primaryActionText, 0.12),
              },
            ]}
            testID={item.testID}
          >
            <Text
              numberOfLines={1}
              style={[styles.mineActionPrimaryMetaLabel, { color: mutedColor }]}
            >
              {item.label}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.mineActionPrimaryMetaValue,
                { color: foregroundColor },
              ]}
              testID={`${item.testID}-value`}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.mineActionCard,
        isPrimary
          ? styles.mineActionCardPrimary
          : styles.mineActionCardSecondary,
        {
          backgroundColor: isPrimary
            ? palette.primaryActionSurface
            : palette.panelStrong,
          borderColor: isPrimary
            ? palette.primaryActionSurface
            : palette.border,
        },
      ]}
      testID={testID}
    >
      {isPrimary ? (
        <>
          {primaryHeader}
          {primaryCenter}
          {primaryMeta}
        </>
      ) : (
        <>
          {glyph}
          {copy}
          {arrow}
        </>
      )}
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
  const benefitSummary = [
    { label: '完整卡库', open: access.completeCardLibrary },
    { label: '完整空间', open: access.completePhysicalSpace },
    { label: '智能回看', open: access.completeAlgorithm },
  ];
  const isTrialAvailable = membershipState.stage === 'trial_available';
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
        {
          backgroundColor: 'transparent',
          borderColor: hexToRgba(palette.accent, 0.1),
        },
      ]}
      testID="membership-host-card"
    >
      {isTrialAvailable ? null : (
        <View style={styles.membershipHeaderRow}>
          <View style={styles.membershipHeaderCopy}>
            <View style={styles.membershipTitleRow}>
              <Text
                style={[styles.membershipHostTitle, { color: palette.text }]}
              >
                {getMembershipHostTitle(membershipState.stage)}
              </Text>
              <View
                style={[
                  styles.membershipInlineStatus,
                  {
                    backgroundColor: palette.accentSoft,
                    borderColor: hexToRgba(palette.accent, 0.1),
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.membershipInlineStatusText,
                    { color: palette.accent },
                  ]}
                >
                  {getMembershipStatusChipLabel(membershipState.stage)}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.membershipSummary, { color: palette.textMuted }]}
            >
              {getMembershipCardSummary(
                membershipState,
                membershipRepositoryMode,
              )}
            </Text>
          </View>
        </View>
      )}
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
      {isTrialAvailable ? (
        <View
          style={[
            styles.membershipAccessCompactDock,
            {
              backgroundColor: hexToRgba(palette.accent, 0.055),
              borderColor: hexToRgba(palette.accent, 0.09),
            },
          ]}
          testID="membership-access-strip"
        >
          <View style={styles.membershipAccessCompactCopy}>
            <View style={styles.membershipAccessCompactTitleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.membershipAccessCompactTitle,
                  { color: palette.text },
                ]}
              >
                试用随学习开始
              </Text>
              <View
                style={[
                  styles.membershipInlineStatus,
                  {
                    backgroundColor: palette.panel,
                    borderColor: hexToRgba(palette.accent, 0.12),
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.membershipInlineStatusText,
                    { color: palette.accent },
                  ]}
                >
                  {getMembershipStatusChipLabel(membershipState.stage)}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.membershipAccessCompactMeta,
                { color: palette.textMuted },
              ]}
            >
              开始后开放空间和回看。
            </Text>
          </View>
          <View style={styles.membershipAccessCompactActions}>
            <Pressable
              disabled={membershipPendingAction !== null}
              onPress={handlers.onStartTrial}
              style={[
                styles.membershipCompactTrialButton,
                { backgroundColor: palette.accent },
              ]}
              testID="membership-start-trial-button"
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.membershipCompactTrialLabel,
                  { color: palette.panel },
                ]}
              >
                {membershipPendingAction === 'start_trial'
                  ? '开通中'
                  : '开始试用'}
              </Text>
            </Pressable>
            <Pressable
              disabled={membershipPendingAction !== null}
              onPress={handlers.onPurchase}
              style={[
                styles.membershipCompactPurchaseButton,
                {
                  backgroundColor: hexToRgba(palette.accent, 0.075),
                  borderColor: hexToRgba(palette.accent, 0.24),
                },
              ]}
              testID="membership-purchase-button"
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.membershipCompactPurchaseLabel,
                  { color: palette.accentStrong },
                ]}
              >
                {membershipPendingAction === 'purchase' ? '同步中' : '开会员'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.membershipAccessTrack,
            deviceClass === 'tablet'
              ? styles.membershipAccessTrackTablet
              : null,
          ]}
          testID="membership-access-strip"
        >
          {benefitSummary.map(item => (
            <View
              key={item.label}
              style={[
                styles.membershipAccessStep,
                { borderColor: palette.border },
              ]}
              testID="membership-access-step"
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
      )}
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
      {isTrialAvailable ? null : (
        <MembershipActionGroup
          handlers={handlers}
          membershipPendingAction={membershipPendingAction}
          membershipRepositoryMode={membershipRepositoryMode}
          membershipState={membershipState}
          palette={palette}
        />
      )}
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
    <View style={styles.membershipTrialActionRow}>
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
          styles.membershipSecondaryLink,
          { backgroundColor: palette.panel },
        ]}
        testID="membership-purchase-button"
      >
        <Text
          style={[styles.membershipSecondaryLinkLabel, { color: palette.text }]}
        >
          {membershipPendingAction === 'purchase' ? '同步中' : '直接开通'}
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
  accountDock = false,
  authState,
  embedded = false,
  handlers,
  palette,
  returnTarget,
  routeDock = false,
  stateLabel,
  title,
  summary,
  successMessage = '已完成登录。',
}: {
  accountDock?: boolean;
  authState: AuthState;
  embedded?: boolean;
  handlers: AuthHandlers;
  palette: Palette;
  returnTarget: string;
  routeDock?: boolean;
  stateLabel?: string;
  title: string;
  summary: string;
  successMessage?: string;
}) {
  const isDockedPanel = accountDock || routeDock;
  const isAuthenticated = authState.stage === 'authenticated';
  const isPending = authState.pendingAction !== null;
  const hasRequestedCode = authState.stage !== 'logged_out';
  const hasAuthError = authState.error !== null;
  const hasCodeError = hasAuthError && hasRequestedCode;
  const isPhoneReady = isPhoneNumberReady(authState.phoneNumber);
  const canRequestCode = isPhoneReady && !isPending && !isAuthenticated;
  const canSubmitCode =
    isSmsCodeReady(authState.smsCode) && !isPending && !isAuthenticated;
  const requestCodeLabelColor = canRequestCode ? palette.panel : palette.accent;
  const requestReadinessLabel =
    authState.pendingAction === 'request_code'
      ? '发送中'
      : canRequestCode
      ? '可发送'
      : '待输入';
  const requestDockTitle =
    authState.pendingAction === 'request_code'
      ? '正在发送短码'
      : canRequestCode
      ? '手机号可用'
      : accountDock
      ? '填写手机号'
      : '手机号';
  const requestDockDetail =
    authState.pendingAction === 'request_code'
      ? '短信短码正在发送。'
      : canRequestCode
      ? '下一步输入短码。'
      : '输入手机号获取短码。';
  const dockSummary = hasRequestedCode
    ? `短码已发送，确认后回到${returnTarget}。`
    : requestDockDetail;
  const requestStatusTone = canRequestCode ? palette.success : palette.accent;
  const authErrorTitle = hasRequestedCode
    ? '验证码暂时没通过'
    : '短码暂时没发出';
  const authErrorDetail = hasRequestedCode
    ? '检查短码后重试，当前位置不变。'
    : '检查手机号后重试，当前位置不变。';
  const codeActionTone = hasCodeError ? palette.warning : palette.accent;
  const submitCodeButtonBackground = canSubmitCode
    ? codeActionTone
    : hexToRgba(codeActionTone, 0.08);
  const submitCodeButtonBorder = canSubmitCode
    ? codeActionTone
    : hexToRgba(codeActionTone, 0.2);
  const submitCodeLabelColor = canSubmitCode
    ? hasCodeError
      ? palette.warningText
      : palette.panel
    : codeActionTone;
  const smsCodeDigits = authState.smsCode
    .split('')
    .slice(0, SMS_CODE_CELL_COUNT);
  const activeCodeCellIndex = Math.min(
    smsCodeDigits.length,
    SMS_CODE_CELL_COUNT - 1,
  );
  const errorDock = authState.error ? (
    <View
      style={[
        styles.authErrorDock,
        hasCodeError ? styles.authErrorDockCode : null,
        {
          backgroundColor: hexToRgba(palette.warning, 0.1),
          borderColor: hexToRgba(palette.warning, 0.24),
        },
      ]}
      testID="auth-error-dock"
    >
      <View
        pointerEvents="none"
        style={[styles.authErrorDot, { backgroundColor: palette.warning }]}
      />
      <View style={styles.authErrorCopy}>
        <Text
          numberOfLines={1}
          style={[styles.authErrorTitle, { color: palette.text }]}
          testID="auth-error-title"
        >
          {authErrorTitle}
        </Text>
        <Text
          numberOfLines={2}
          style={[styles.authErrorDetail, { color: palette.textMuted }]}
          testID="auth-error-detail"
        >
          {`${authState.error} ${authErrorDetail}`}
        </Text>
      </View>
      <View
        style={[
          styles.authErrorPill,
          {
            backgroundColor: palette.panel,
            borderColor: hexToRgba(palette.warning, 0.22),
          },
        ]}
        testID="auth-error-retry-pill"
      >
        <Text
          numberOfLines={1}
          style={[styles.authErrorPillText, { color: palette.warning }]}
        >
          可重试
        </Text>
      </View>
    </View>
  ) : null;

  return (
    <View
      style={[
        styles.authPanel,
        embedded ? styles.authPanelEmbedded : null,
        isDockedPanel ? styles.authPanelDock : null,
        {
          backgroundColor: embedded ? 'transparent' : palette.panel,
          borderColor: palette.border,
        },
      ]}
      testID="auth-sms-panel"
    >
      {!isDockedPanel ? (
        <View style={styles.authPanelHeader}>
          <View style={styles.authPanelTitleRow}>
            <Text style={[styles.infoTitle, { color: palette.text }]}>
              {title}
            </Text>
          </View>
          <Text style={[styles.authSummary, { color: palette.textMuted }]}>
            {summary}
          </Text>
        </View>
      ) : null}

      {hasRequestedCode ? (
        <View
          style={[
            styles.authCodeInlineDock,
            accountDock ? styles.authCodeInlineDockAccount : null,
            routeDock ? styles.authCodeInlineDockRoute : null,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
          testID="auth-code-inline-dock"
        >
          <View style={styles.authCodeSentHeader}>
            <View
              pointerEvents="none"
              style={[
                styles.authCodeSentDot,
                {
                  backgroundColor: hasCodeError
                    ? palette.warning
                    : palette.accent,
                },
              ]}
            />
            <View style={styles.authCodeSentCopy}>
              <Text
                style={[styles.authCodeSentTitle, { color: palette.text }]}
                testID="auth-code-sent-title"
              >
                {hasCodeError ? '验证码待确认' : '验证码已发送'}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.authCodeSentMeta, { color: palette.textMuted }]}
              >
                已发送到 {maskPhoneNumber(authState.phoneNumber)}
              </Text>
            </View>
            <Pressable
              disabled={!canRequestCode}
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
          <Text
            numberOfLines={1}
            style={[
              styles.authCodeSentMeta,
              styles.authCodeReturnText,
              { color: palette.textMuted },
            ]}
          >
            {`4-6 位短码，确认后回到${returnTarget}。`}
          </Text>
          <View
            style={[
              styles.authCodeEntryRow,
              accountDock ? styles.authCodeEntryRowAccount : null,
              hasCodeError ? styles.authCodeEntryRowError : null,
            ]}
            testID="auth-code-entry-row"
          >
            <View
              style={[
                styles.authCodeCellsFrame,
                isDockedPanel ? styles.authPhoneInputDock : null,
                accountDock ? styles.authCodeCellsFrameAccount : null,
                {
                  backgroundColor: hasCodeError
                    ? hexToRgba(palette.warning, 0.08)
                    : palette.panel,
                  borderColor: hasCodeError
                    ? hexToRgba(palette.warning, 0.42)
                    : canSubmitCode
                    ? palette.accent
                    : palette.border,
                },
              ]}
              testID="auth-code-cells-frame"
            >
              <View
                pointerEvents="none"
                style={[
                  styles.authCodeCells,
                  accountDock ? styles.authCodeCellsAccount : null,
                ]}
              >
                {Array.from({ length: SMS_CODE_CELL_COUNT }).map((_, index) => {
                  const digit = smsCodeDigits[index] ?? '';
                  const isFilled = digit.length > 0;
                  const isActive =
                    !isPending &&
                    !isAuthenticated &&
                    index === activeCodeCellIndex;

                  return (
                    <View
                      key={`auth-code-cell-${index}`}
                      style={[
                        styles.authCodeCell,
                        accountDock ? styles.authCodeCellAccount : null,
                        {
                          backgroundColor: hasCodeError
                            ? hexToRgba(palette.warning, isFilled ? 0.16 : 0.07)
                            : isFilled
                            ? palette.panelStrong
                            : hexToRgba(palette.accent, 0.045),
                          borderColor: hasCodeError
                            ? isActive
                              ? palette.warning
                              : hexToRgba(palette.warning, 0.3)
                            : isActive
                            ? palette.accent
                            : hexToRgba(palette.accent, 0.16),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.authCodeCellText,
                          { color: isFilled ? palette.text : palette.tabIdle },
                        ]}
                      >
                        {digit}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <TextInput
                caretHidden
                editable={!isPending && !isAuthenticated}
                inputAccessoryViewID={
                  Platform.OS === 'ios' ? AUTH_KEYBOARD_ACCESSORY_ID : undefined
                }
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={handlers.onChangeCode}
                style={styles.authCodeHiddenInput}
                testID="auth-code-input"
                textContentType="oneTimeCode"
                value={authState.smsCode}
              />
            </View>
            {!isAuthenticated ? (
              <Pressable
                disabled={!canSubmitCode}
                onPress={handlers.onSubmitCode}
                style={[
                  styles.authCodeSubmitButton,
                  accountDock ? styles.authCodeSubmitButtonAccount : null,
                  {
                    backgroundColor: submitCodeButtonBackground,
                    borderColor: submitCodeButtonBorder,
                  },
                ]}
                testID="auth-submit-button"
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.authCodeSubmitLabel,
                    { color: submitCodeLabelColor },
                  ]}
                >
                  {authState.pendingAction === 'verify_code'
                    ? '正在验证'
                    : hasCodeError && canSubmitCode
                    ? '重新验证'
                    : canSubmitCode
                    ? '完成登录'
                    : '输入验证码'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {errorDock}
        </View>
      ) : null}

      {!hasRequestedCode ? (
        <View
          style={[
            styles.authRequestInlineDock,
            accountDock ? styles.authRequestInlineDockAccount : null,
            routeDock ? styles.authRequestInlineDockRoute : null,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
          testID="auth-request-inline-dock"
        >
          <View style={styles.authRequestStatusLine}>
            <View
              pointerEvents="none"
              style={[
                styles.authCodeSentDot,
                { backgroundColor: requestStatusTone },
              ]}
            />
            <View style={styles.authRequestCopy}>
              <Text
                numberOfLines={1}
                style={[styles.authRequestTitle, { color: palette.text }]}
              >
                {stateLabel ?? requestDockTitle}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.authRequestDetail, { color: palette.textMuted }]}
              >
                {dockSummary}
              </Text>
            </View>
            <View
              style={[
                styles.authRequestReadinessPill,
                {
                  backgroundColor: canRequestCode
                    ? hexToRgba(palette.success, 0.12)
                    : palette.panel,
                  borderColor: canRequestCode
                    ? hexToRgba(palette.success, 0.28)
                    : palette.border,
                },
              ]}
              testID="auth-request-readiness-pill"
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.authRequestReadinessText,
                  {
                    color: canRequestCode ? palette.success : palette.textMuted,
                  },
                ]}
              >
                {requestReadinessLabel}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.authRequestActionRow,
              accountDock ? styles.authRequestActionRowAccount : null,
            ]}
            testID="auth-request-action-row"
          >
            <View
              style={[
                styles.authPhoneFieldDock,
                accountDock ? styles.authPhoneFieldDockAccount : null,
                {
                  backgroundColor: isPhoneReady
                    ? hexToRgba(palette.success, 0.055)
                    : palette.panel,
                  borderColor: isPhoneReady
                    ? hexToRgba(palette.success, 0.34)
                    : palette.border,
                },
              ]}
              testID="auth-phone-field-dock"
            >
              <Text
                style={[
                  styles.fieldLabel,
                  styles.authPhoneFieldDockLabel,
                  { color: palette.textMuted },
                ]}
              >
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
                  styles.authPhoneInputDock,
                  styles.authPhoneInputText,
                  {
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: palette.text,
                  },
                ]}
                testID="auth-phone-input"
                textContentType="telephoneNumber"
                value={authState.phoneNumber}
              />
            </View>
            <Pressable
              disabled={!canRequestCode}
              onPress={handlers.onRequestCode}
              style={[
                styles.authRequestButton,
                accountDock ? styles.authRequestButtonAccount : null,
                {
                  backgroundColor: canRequestCode
                    ? palette.accent
                    : hexToRgba(palette.accent, 0.08),
                  borderColor: canRequestCode
                    ? palette.accent
                    : hexToRgba(palette.accent, 0.14),
                },
              ]}
              testID="auth-request-code-button"
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.authRequestButtonLabel,
                  { color: requestCodeLabelColor },
                ]}
              >
                {authState.pendingAction === 'request_code'
                  ? '发送中'
                  : canRequestCode
                  ? '发送短码'
                  : '获取短码'}
              </Text>
            </Pressable>
          </View>
          {errorDock}
        </View>
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
            {successMessage}
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

function isPhoneNumberReady(phoneNumber: string) {
  return /^\d{11}$/.test(phoneNumber.trim());
}

function isSmsCodeReady(smsCode: string) {
  return /^\d{4,6}$/.test(smsCode.trim());
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

function getMembershipHostTitle(stage: MembershipStage) {
  switch (stage) {
    case 'trial_available':
      return '权益通行证';
    case 'trial':
      return '完整试用进行中';
    case 'free':
      return '基础学习保留';
    case 'premium':
      return '会员已开通';
  }
}

function getMembershipStatusChipLabel(stage: MembershipStage) {
  switch (stage) {
    case 'trial_available':
      return '基础可用';
    case 'trial':
      return '试用中';
    case 'free':
      return '基础态';
    case 'premium':
      return '会员态';
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
  /\b(Remote|Bootstrap|Canonical|payload|source_id|source_label|card_records|remoteConfig|authToken|accessToken|refreshToken|challengeId|sessionId|endpoint|repository|card_id|knowledge_ref|box_ref|space_metadata|MutationQueue|runtime|SHELL|FLOW|GATE|SETUP|PROFILE|STATUS|SYNC)\b|JSON Parse error|Unexpected character|SyntaxError|parse failed|data\.|卡源|离线队列|离线重试|本机缓存|当前设备|会员矩阵|占位|快照|顶层|入口|最重要|服务核心价值|账户与会员|壳层|页面内部|最小必要信息|首读路径|低成本|轻量|会员边界|主要任务|复杂设置中心|模块选择|复杂大盘|复杂管理器|承接|权限|主路径|单卡流|学习流|product_truth|implementation_hypothesis|design artifact|harness|Agent review|PR 描述/i;

function getUserFacingErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  const remoteStatusMatch = message.match(
    /^Remote (auth request-code|auth verify-code|learning card source request|membership entitlement request|membership mutation|progress sync|learning state sync|space state sync) failed(?: with status| with)? (\d+)\.$/,
  );

  if (!remoteStatusMatch) {
    return INTERNAL_ERROR_COPY_PATTERN.test(message) ? fallback : message;
  }

  const [, type] = remoteStatusMatch;

  switch (type) {
    case 'auth request-code':
      return '验证码暂时没发出。';
    case 'auth verify-code':
      return '验证码暂时没通过。';
    case 'membership entitlement request':
      return '会员状态暂时无法读取。';
    case 'membership mutation':
      return '会员状态更新暂时失败。';
    case 'learning card source request':
      return '学习卡片加载暂时失败。';
    case 'progress sync':
      return '学习进展同步暂时失败。';
    case 'learning state sync':
      return '学习状态同步暂时失败。';
    case 'space state sync':
      return '空间状态同步暂时失败。';
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
      return '首次计入学习时开启试用；完整卡库、完整空间和智能回看会一起放开。';
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
  appCanvasBackdrop: {
    ...StyleSheet.absoluteFill,
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
  phoneAccountChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 72,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  phoneAccountChipDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  phoneAccountChipCopy: {
    gap: 1,
  },
  phoneAccountChipLabel: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  phoneAccountChipValue: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  routeIconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  routeIconFrameTab: {
    width: 23,
    height: 23,
  },
  routeIconFrameSidebar: {
    width: 26,
    height: 26,
  },
  routeIconFrameHeader: {
    width: 23,
    height: 23,
  },
  routeIconBook: {
    width: 17,
    height: 18,
    borderWidth: 2,
    borderRadius: 5,
  },
  routeIconBookActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  routeIconBookSpine: {
    position: 'absolute',
    left: 4,
    top: 2,
    width: 2,
    height: 13,
    borderRadius: 999,
  },
  routeIconBookLine: {
    position: 'absolute',
    left: 8,
    top: 6,
    width: 6,
    height: 2,
    borderRadius: 999,
  },
  routeIconBookLineShort: {
    position: 'absolute',
    left: 8,
    top: 11,
    width: 4,
    height: 2,
    borderRadius: 999,
  },
  routeIconSpaceLine: {
    position: 'absolute',
    width: 13,
    borderRadius: 999,
  },
  routeIconSpaceLineTop: {
    left: 6,
    top: 8,
    transform: [{ rotate: '-26deg' }],
  },
  routeIconSpaceLineBottom: {
    left: 6,
    top: 14,
    transform: [{ rotate: '26deg' }],
  },
  routeIconSpaceNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  routeIconSpaceNodeStart: {
    left: 2,
    top: 9,
  },
  routeIconSpaceNodeMiddle: {
    left: 11,
    top: 3,
  },
  routeIconSpaceNodeEnd: {
    right: 2,
    bottom: 4,
  },
  routeIconStatsFrame: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  routeIconStatBarShort: {
    width: 4,
    height: 9,
    borderRadius: 999,
  },
  routeIconStatBarMid: {
    width: 4,
    height: 14,
    borderRadius: 999,
  },
  routeIconStatBarTall: {
    width: 4,
    height: 18,
    borderRadius: 999,
  },
  routeIconMineHead: {
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 2,
    marginBottom: 2,
  },
  routeIconMineBody: {
    width: 17,
    height: 9,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
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
  headerAccountChip: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    minWidth: 106,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  headerAccountCopy: {
    gap: 1,
  },
  headerAccountLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  headerAccountValue: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
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
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },
  authGateScreenEmbedded: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  authGateScreenRouteObject: {
    justifyContent: 'flex-start',
    paddingTop: 2,
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
  authEntryCardEmbedded: {
    flexShrink: 1,
  },
  authEntryCardRouteObject: {
    flexShrink: 1,
    gap: 12,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  authEntryCardMine: {
    gap: 10,
    justifyContent: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 16,
  },
  authObjectHeader: {
    gap: 8,
  },
  authObjectHeaderRouteObject: {
    gap: 7,
  },
  authObjectHeaderMine: {
    gap: 0,
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
  authGateTitleRouteObject: {
    fontSize: 25,
    lineHeight: 31,
  },
  authGateTitleMine: {
    fontSize: 23,
    lineHeight: 28,
  },
  authGateSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  authGateActionStack: {
    gap: 12,
  },
  authGateActionStackCompact: {
    gap: 10,
    marginTop: 10,
  },
  authGateActionStackMine: {
    gap: 10,
    marginTop: 12,
  },
  authMinePassportHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  authMineAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  authMineHeaderCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  authMineHeaderTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  authRetainedObject: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  authRetainedObjectCompact: {
    borderRadius: 20,
    gap: 0,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  authRetainedObjectMine: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  authRetainedHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  authRetainedHeadCompact: {
    alignItems: 'center',
    gap: 9,
  },
  authRetainedAccent: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  authRetainedAccentCompact: {
    height: 38,
    width: 4,
  },
  authRetainedCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
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
  authContinuityPromisePill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  authContinuityPromiseText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
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
  authObjectBadgeMine: {
    maxWidth: 104,
    paddingHorizontal: 9,
    paddingVertical: 6,
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
  authPanelDock: {
    borderTopWidth: 0,
    gap: 10,
    marginTop: 0,
    minHeight: 0,
    paddingTop: 0,
  },
  authPanelHeader: {
    gap: 5,
  },
  authPanelHeaderDock: {
    paddingHorizontal: 2,
  },
  authPanelTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  authPanelStatePill: {
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 96,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  authPanelStatePillText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
  },
  authSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  authRequestInlineDock: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  authRequestActionRow: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 10,
    justifyContent: 'flex-start',
  },
  authRequestActionRowAccount: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 8,
  },
  authRequestInlineDockAccount: {
    gap: 9,
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  authRequestInlineDockRoute: {
    paddingBottom: 9,
    paddingTop: 9,
  },
  authRequestCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  authRequestStatusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  authRequestReadinessPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 56,
    paddingHorizontal: 9,
  },
  authRequestReadinessText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  authRequestTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  authRequestDetail: {
    fontSize: 11,
    lineHeight: 15,
  },
  authRequestButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 11,
  },
  authRequestButtonAccount: {
    alignSelf: 'stretch',
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 12,
    width: '100%',
  },
  authRequestButtonLabel: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  authCodeInlineDock: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 11,
    minHeight: 214,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  authCodeInlineDockAccount: {
    gap: 10,
    minHeight: 205,
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  authCodeInlineDockRoute: {
    paddingBottom: 12,
    paddingTop: 12,
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
  authCodeReturnText: {
    paddingLeft: 19,
    paddingRight: 2,
    textAlign: 'left',
  },
  authCodeEntryRow: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 9,
  },
  authCodeEntryRowAccount: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 8,
  },
  authCodeEntryRowError: {
    marginBottom: 8,
  },
  authCodeCellsFrame: {
    minHeight: 54,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  authCodeCellsFrameAccount: {
    minHeight: 52,
  },
  authCodeCells: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  authCodeCellsAccount: {
    gap: 5,
    paddingHorizontal: 10,
  },
  authCodeCell: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 36,
  },
  authCodeCellAccount: {
    borderRadius: 10,
    height: 38,
    width: 34,
  },
  authCodeCellText: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 22,
  },
  authCodeHiddenInput: {
    borderWidth: 0,
    bottom: 0,
    color: 'transparent',
    fontSize: 1,
    left: 0,
    opacity: 0.02,
    paddingHorizontal: 0,
    paddingVertical: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  authCodeSubmitButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 45,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  authCodeSubmitButtonAccount: {
    alignSelf: 'stretch',
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  authCodeSubmitLabel: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
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
  authPhoneFieldDock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 18,
    borderWidth: 1,
    flex: 0,
    flexDirection: 'row',
    gap: 8,
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 13,
    paddingVertical: 0,
  },
  authPhoneFieldDockAccount: {
    flex: 0,
    minHeight: 52,
    paddingHorizontal: 12,
    width: '100%',
  },
  authPhoneFieldDockLabel: {
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 16,
    minWidth: 46,
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
  authPhoneInputDock: {
    borderWidth: 0,
    flex: 1,
    minHeight: 38,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 7,
  },
  authPhoneInputText: {
    fontSize: 16,
    fontWeight: '700',
    height: 42,
    lineHeight: 22,
    paddingVertical: 0,
    textAlignVertical: 'center',
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
  authErrorDock: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authErrorDockCode: {
    marginTop: 12,
  },
  authErrorDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  authErrorCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  authErrorTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  authErrorDetail: {
    fontSize: 11,
    lineHeight: 15,
  },
  authErrorPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 9,
  },
  authErrorPillText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
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
    flex: 1,
    gap: 9,
    justifyContent: 'space-between',
    minHeight: 0,
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.09,
    shadowRadius: 30,
    elevation: 4,
  },
  minePassportStack: {
    flexShrink: 0,
    gap: 8,
  },
  minePassportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mineAccountHeaderCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  mineAccountEyebrow: {
    fontSize: 12,
    fontWeight: '800',
  },
  mineAccountTitle: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 25,
  },
  mineAccountSummary: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  mineAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  mineMembershipPill: {
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 108,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  mineMembershipPillText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  mineIdentityBand: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mineContinuityDock: {
    gap: 6,
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
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  mineSignalPill: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 26,
    minWidth: 0,
    paddingHorizontal: 5,
  },
  mineSignalLabel: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  mineSignalValue: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
  mineRouteDock: {
    flex: 1,
    gap: 8,
    justifyContent: 'flex-end',
    minHeight: 0,
  },
  mineActionRail: {
    flex: 1,
    gap: 8,
    justifyContent: 'flex-end',
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  mineActionRailTablet: {
    maxWidth: 560,
  },
  mineSecondaryActionRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 0,
  },
  mineActionCard: {
    alignItems: 'stretch',
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
  },
  mineActionCardPrimary: {
    alignItems: 'stretch',
    borderRadius: 20,
    flex: 1.1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  mineActionCardSecondary: {
    alignItems: 'center',
    borderRadius: 17,
    flex: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  mineActionTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mineActionPrimaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mineActionPrimaryCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 62,
  },
  mineActionPrimaryHero: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  mineActionPrimaryHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  mineActionPrimaryMetaRow: {
    flexDirection: 'row',
    gap: 7,
  },
  mineActionPrimaryMetaPill: {
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 45,
    minWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  mineActionPrimaryMetaLabel: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
  mineActionPrimaryMetaValue: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  mineActionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  mineActionGlyph: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  mineActionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  mineActionLabelPrimary: {
    fontSize: 14,
  },
  mineActionDetail: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  mineActionDetailPrimary: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  mineActionArrow: {
    fontSize: 14,
    fontWeight: '800',
  },
  membershipHostCard: {
    borderTopWidth: 0,
    gap: 8,
    marginTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 1,
    paddingTop: 0,
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
  membershipTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  membershipHostTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  membershipSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  membershipInlineStatus: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  membershipInlineStatusText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
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
    gap: 6,
  },
  membershipAccessTrackTablet: {
    gap: 8,
  },
  membershipAccessCompactDock: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 68,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  membershipAccessCompactCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  membershipAccessCompactTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  membershipAccessCompactTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
  },
  membershipAccessCompactMeta: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  membershipAccessCompactActions: {
    alignItems: 'stretch',
    gap: 5,
    justifyContent: 'center',
    minWidth: 80,
  },
  membershipCompactBenefitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  membershipCompactBenefitChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  membershipCompactBenefitDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  membershipCompactBenefitLabel: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  membershipCompactTrialButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 80,
    paddingHorizontal: 9,
  },
  membershipCompactTrialLabel: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  membershipCompactPurchaseButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 82,
    paddingHorizontal: 10,
  },
  membershipCompactPurchaseLabel: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  membershipAccessStep: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
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
  membershipTrialActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  membershipPrimaryAction: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  membershipSecondaryLink: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minWidth: 76,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  membershipSecondaryLinkLabel: {
    fontSize: 12,
    fontWeight: '800',
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
    gap: 3,
    minHeight: 54,
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  phoneTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
});

export default App;
