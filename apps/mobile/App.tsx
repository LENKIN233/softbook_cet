import {StudioRouteIcon as RouteIcon} from './src/visual/StudioRouteIcon';
import {LocalStudyApp} from './src/local/LocalStudyApp';
import {localLearningCardSource} from './src/learning/localCardSource';
import {reviewCardIds, latestCardResults} from './src/space/cardFilters';
import {authFailure, type AuthFailureKind} from './src/auth/authErrorCopy';
import {endsLocalBatch, localBatch, localResumeIndex} from './src/learning/localBatch';
import {NativeMotionProvider, useCardMotion, StudioPressable as Pressable} from './src/learning/NativeMotion';
import {STUDIO} from './src/visual/studio';
import {StudioMark} from './src/visual/StudioMark';
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
  AccessibilityInfo,
  Animated,
  AppState,
  BackHandler,
  findNodeHandle,
  InputAccessoryView,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { createAccountDeletionRepository } from './src/account/accountDeletionRepository';
import {AccountDeletionRecoverySurface} from './src/account/AccountDeletionRecoverySurface';
import {
  createAccountDeletionRecoveryRepository,
  type AccountDeletionRecoveryChallenge,
} from './src/account/accountDeletionRecoveryRepository';
import {
  createAccountDeletionRecoveryStore,
  sameRecoveryState,
  type AccountDeletionRecoveryReceipt,
} from './src/account/accountDeletionRecoveryStore';
import { resolveAccountDeletionRepositoryConfig } from './src/account/accountDeletionRuntimeConfig';
import {
  createAccountDeletionCleanupStore,
  createAccountLogoutCleanupStore,
} from './src/account/accountDeletionCleanupStore';
import { createAuthRepository } from './src/auth/authRepository';
import { createAuthenticatedFetch } from './src/auth/authenticatedFetch';
import { resolveAuthRepositoryConfig } from './src/auth/authRuntimeConfig';
import { createAuthSessionCoordinator } from './src/auth/authSessionCoordinator';
import {
  DEFAULT_SMS_RESEND_SECONDS,
  smsResendRemainingSeconds,
  useSmsResendRemainingSeconds,
} from './src/auth/smsResend';
import {
  getAuthAccessToken,
  getAuthSessionScopeKey,
  isRemoteAuthSession,
  type AuthChallenge,
  type AuthSession,
  type RemoteAuthSession,
} from './src/auth/authSession';
import {
  reconcileAccountBootstrap,
  resolveAccountBootstrapLearningState,
} from './src/bootstrap/accountBootstrapHydration';
import {
  assertAccountBootstrapRevisionTransition,
} from './src/bootstrap/accountBootstrapRevision';
import {
  createAccountBootstrapRequestGate,
  type AccountBootstrapRequestLease,
} from './src/bootstrap/accountBootstrapRequestGate';
import {
  AccountBootstrapIntegrityError,
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
  type LearningTrack,
} from './src/learning/model';
import {
  createLearningCardState,
  evaluateLearningCard,
  selectLockOption,
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
import {LOCAL_CARD_SOURCE_ID} from './src/learning/localCardSource';
import type {LocalLearningProgress} from './src/persistence/localLearningProgress';
import { createLearningSessionRepository } from './src/learning/learningRepository';
import { resolveContentManifestRuntimeConfig } from './src/audio/contentManifestRuntimeConfig';
import type {RefreshLearningAudioDownload} from './src/audio/learningAudioController';
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
import {findClientUpdateRequiredError} from './src/runtime/clientVersion';
import {
  applySpaceActionToMap,
  createSpaceAction,
  createSpaceStateRepository,
  type SpaceAction,
  type SpaceActionDimension,
  type SpaceCardStateValue,
} from './src/space/spaceStateRepository';
import { resolveSpaceStateRepositoryConfig } from './src/space/spaceStateRuntimeConfig';
import {
  SpaceSurface,
  type SpaceStatusRail,
  type SpaceSurfaceScreen,
} from './src/space/SpaceSurface';
import { StatisticsSurface } from './src/statistics/StatisticsSurface';
import {
  getChinaDayKey,
  getMillisecondsUntilNextChinaDay,
} from './src/shared/chinaDay';
import { formatLearningSessionDisplayLabel } from './src/shared/uiMetadata/displayMetadata';
import {
  createMutationQueueRepository,
  hasCausalSpaceBootstrapAdvance,
} from './src/sync/mutationQueueRepository';
import {MutationQueueManager} from './src/sync/mutationQueue';
import type {
  AccountBootstrapObservationProof,
  SpaceCanonicalRefreshBaseline,
} from './src/sync/mutationQueue';
import {createReactNativeMutationQueueStorage} from './src/sync/mutationQueueStorage.native';
import {LearningEventOutbox} from './src/sync/learningEventOutbox';
import {createReactNativeLearningEventOutboxStorage} from './src/sync/learningEventOutboxStorage.native';
import { createLearningEventSyncRepository } from './src/sync/learningEventSyncRepository';
import { createLearningEventsRepository } from './src/sync/learningEventsRepository';
import { resolveLearningEventsRepositoryConfig } from './src/sync/learningEventsRuntimeConfig';
import {
  createDailyProgressSnapshot,
  createProgressSyncRepository,
} from './src/sync/progressSyncRepository';
import { resolveProgressSyncRepositoryConfig } from './src/sync/progressSyncRuntimeConfig';
import { isRemoteAuthorizationError, RemoteHttpError } from './src/runtime/remoteHttpError';
import {
  isRemoteRequestCancellationError,
  RemoteRequestLifecycleError,
} from './src/runtime/remoteRequest';
import { getUserFacingErrorMessage } from './src/runtime/userFacingError';
import {
  BRAND_IDENTITY,
  hexToRgba,
  resolveLibraryTone,
} from './src/visual/tokens';

const LOCAL_DEVICE_OWNER = '00000000000'; // Local-only identity, never submitted to SMS.

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type DeviceClass = 'phone' | 'tablet';
type AuthStage = 'logged_out' | 'code_sent' | 'authenticated';
type MembershipGate = 'space' | 'review' | 'library';
type LearningSurfaceScreen = 'practice' | 'result_detail';

type AppProps = {
  softbookRemoteRuntimeProfile?: SoftbookRemoteRuntimeProfile;
  deviceOnly?: boolean;
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
        label: '账号',
        value: '已登录',
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
        label: '登录账号',
        value: maskPhoneNumber(authState.phoneNumber),
      }
    : authState.stage === 'code_sent'
    ? {
        label: '验证码',
        value: '请输入',
      }
    : {
        label: '账号',
        value: '未登录',
      };
}

type AuthState = {
  authToken: string | null;
  challenge: AuthChallenge | null;
  stage: AuthStage;
  phoneNumber: string;
  pendingAction: 'request_code' | 'verify_code' | null;
  resendAvailableAt: number;
  errorAction?: 'request_code' | 'verify_code' | 'save_session';
  errorKind?: AuthFailureKind;
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
type SpaceStateSyncState = SyncStatusState & {requiresAttention?: boolean};

type LearningBootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';
type LearningPhase = 'learning' | 'review';
type AccountBootstrapStatus = 'not_required' | 'pending' | 'ready' | 'deferred';
type AccountDeletionPresentationState =
  | 'closed'
  | 'confirmation'
  | 'submitting'
  | 'cleanup_required'
  | 'cleanup_retrying'
  | 'accepted'
  | 'recoverable_unknown';

type AccountDeletionOrigin = {
  session: RemoteAuthSession;
  sessionScopeKey: string;
  emptyRevision: number | null;
  receipt: AccountDeletionRecoveryReceipt | null;
  generation: number;
  dispatched: boolean;
};

type AcceptedAccountDeletionCleanup = {
  phoneNumber: string;
  sessionScopeKey: string | null;
  receipt?: AccountDeletionRecoveryReceipt;
  registrationReady?: boolean;
  generation?: number;
  fromRecovery?: boolean;
};

type PendingAccountLogoutCleanup = AcceptedAccountDeletionCleanup & {
  error: string | null;
  revokeRemote: boolean;
};

type AuthenticatedRuntimeHydration = {
  accountBootstrap: AccountBootstrapSnapshot | null;
  accountBootstrapStatus: AccountBootstrapStatus;
  pendingCheckInDayKey: string | null;
  pendingLearningEventCount: number;
  membershipErrorMessage: string | null;
  membershipRefreshSucceeded: boolean;
  membershipState: MembershipState;
  persistedUserState: PersistedUserState;
};

type SpaceCardState = SpaceCardStateValue;

const SHELL_ACCENT = BRAND_IDENTITY.primary;

type AuthHandlers = {
  onChangePhone: (value: string) => void;
  onChangeCode: (value: string) => void;
  onResetPhone: () => void;
  onRequestCode: () => void;
  onSubmitCode: () => void;
  onStartLocal: () => void;
  onOpenUpdate: () => void;
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
  background: STUDIO.color.page,
  panel: STUDIO.color.paper,
  panelStrong: STUDIO.color.paperSoft,
  border: STUDIO.color.line,
  text: STUDIO.color.ink,
  textMuted: STUDIO.color.muted,
  accent: SHELL_ACCENT,
  accentSoft: BRAND_IDENTITY.soft,
  accentStrong: BRAND_IDENTITY.deep,
  activeSurface: STUDIO.color.brandSoft,
  activeText: STUDIO.color.brandDeep,
  primaryActionSurface: SHELL_ACCENT,
  primaryActionText: '#FFFFFF',
  primaryActionMuted: 'rgba(255,255,255,0.76)',
  tabIdle: STUDIO.color.muted,
  success: STUDIO.color.success,
  warning: '#F5B100',
  warningText: '#6B4A00',
  danger: STUDIO.color.danger,
};

const AUTH_KEYBOARD_ACCESSORY_ID = 'auth-keyboard-accessory';
const SMS_CODE_CELL_COUNT = 6;
const CLIENT_UPDATE_REQUIRED_COPY =
  '请更新到最新版本，更新后可继续学习。';

const INITIAL_AUTH_STATE: AuthState = {
  authToken: null,
  challenge: null,
  stage: 'logged_out',
  phoneNumber: '',
  pendingAction: null,
  resendAvailableAt: 0,
  smsCode: '',
  error: null,
};

const INITIAL_PROGRESS_SYNC_STATE: ProgressSyncState = {
  detail: '完成学习后自动保存。',
  label: '暂无记录',
  state: 'idle',
};

const INITIAL_LEARNING_STATE_SYNC_STATE: LearningStateSyncState = {
  detail: '还没有答题记录。',
  label: '暂无答题记录',
  state: 'idle',
};

const INITIAL_SPACE_STATE_SYNC_STATE: SpaceStateSyncState = {
  detail: '还没有收藏或休眠记录。',
  label: '暂无操作记录',
  state: 'idle',
};

function createAccountBootstrapRuntimeSessionId() {
  const randomPart = Math.random().toString(36).slice(2).padEnd(12, '0');
  return `bootstrap-runtime:${Date.now().toString(36)}:${randomPart}`;
}

function createEntitlementPendingMembershipState(): MembershipState {
  return {
    ...createInitialMembershipState(),
    stage: 'free',
  };
}

function App({
  softbookRemoteRuntimeProfile,
  deviceOnly = false,
}: AppProps = {}): React.JSX.Element {
  const runtimeConfig = useMemo(() => {
    if (softbookRemoteRuntimeProfile) {
      return installSoftbookAppRuntimeConfig(
        createSoftbookRemoteRuntimeConfig(softbookRemoteRuntimeProfile),
      );
    }

    return readSoftbookAppRuntimeConfig();
  }, [softbookRemoteRuntimeProfile]);

  if (!deviceOnly && localLearningCardSource.sourceId === 'bundled-card-make-v1' && runtimeConfig?.auth?.mode !== 'remote') {
    return <SafeAreaProvider><View style={{flex: 1, justifyContent: 'center', padding: 24}}><Text>服务尚未配置，请启动本地后端后重新打开应用。</Text></View></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <NativeMotionProvider>{deviceOnly && localLearningCardSource.sourceId === 'bundled-card-make-v1' && ['auth','accountBootstrap','contentManifest','learningSource','membership','progressSync','spaceState','learningState'].every(key => (runtimeConfig as Record<string, {mode?: string}> | undefined)?.[key]?.mode !== 'remote')
        ? <LocalStudyApp initialTrack={resolveLearningTrack(runtimeConfig)} palette={LIGHT_PALETTE} />
        : <AppShell runtimeConfig={runtimeConfig} />}</NativeMotionProvider>
    </SafeAreaProvider>
  );
}

function AppShell({
  runtimeConfig,
}: {
  runtimeConfig: SoftbookAppRuntimeConfig | undefined;
}) {
  const palette = LIGHT_PALETTE;
  const [learningTrack, setLearningTrack] = useState(() => resolveLearningTrack(runtimeConfig));
  const [trackSwitchPending, setTrackSwitchPending] = useState(false);
  const trackSwitchInFlight = useRef(false);
  const [trackSwitchError, setTrackSwitchError] = useState<string | null>(null);
  const authRepositoryConfig = useMemo(
    () => resolveAuthRepositoryConfig(runtimeConfig),
    [runtimeConfig],
  );
  const authRepository = useMemo(
    () => createAuthRepository(authRepositoryConfig),
    [authRepositoryConfig],
  );
  const authSessionStore = useMemo(() => createAuthSessionStore(), []);
  const accountLogoutCleanupStore = useMemo(
    () => createAccountLogoutCleanupStore(),
    [],
  );
  const pendingAccountLogoutCleanupRef =
    useRef<PendingAccountLogoutCleanup | null>(null);
  const accountDeletionOriginRef = useRef<AccountDeletionOrigin | null>(null);
  const deletionRecoveryReceiptRef = useRef<AccountDeletionRecoveryReceipt | null>(null);
  const deletionRecoveryLifetimeRef = useRef({active: true, generation: 0});
  const deletionRecoveryRequestRef = useRef<{
    controller: AbortController;
    generation: number;
    receipt: AccountDeletionRecoveryReceipt;
  } | null>(null);
  const accountDeletionRecoveryStore = useMemo(() => createAccountDeletionRecoveryStore(), []);
  const acceptedAccountDeletionCleanupRef =
    useRef<AcceptedAccountDeletionCleanup | null>(null);
  const isAccountDeletionSessionQuarantined = useCallback(
    (sessionScopeKey: string | null) =>
      sessionScopeKey !== null &&
      (accountDeletionOriginRef.current?.sessionScopeKey === sessionScopeKey ||
        acceptedAccountDeletionCleanupRef.current?.sessionScopeKey ===
          sessionScopeKey ||
        (deletionRecoveryReceiptRef.current !== null &&
          sessionScopeKey.startsWith(`remote:${deletionRecoveryReceiptRef.current.state.phoneNumber}:`))),
    [],
  );
  const isAccountSessionQuarantined = useCallback(
    (sessionScopeKey: string | null) =>
      isAccountDeletionSessionQuarantined(sessionScopeKey) ||
      (sessionScopeKey !== null &&
        pendingAccountLogoutCleanupRef.current?.sessionScopeKey === sessionScopeKey),
    [isAccountDeletionSessionQuarantined],
  );
  const authSessionCoordinator = useMemo(
    () =>
      createAuthSessionCoordinator({
        authRepository,
        authSessionStore,
        shouldPreserveAuthorizationRejection:
          isAccountSessionQuarantined,
        beforeSessionInvalidation: async ({session, reason}) => {
          if (session.mode === 'local' && authRepositoryConfig.mode === 'local') return;
          const lifetime = deletionRecoveryLifetimeRef.current;
          const generation = lifetime.generation;
          const assertActive = () => {
            if (!lifetime.active || lifetime.generation !== generation) {
              throw new Error('Session cleanup belongs to an inactive App.');
            }
          };
          assertActive();
          // Deletion keeps its own phase authority. Ordinary invalidation must
          // first retain enough non-secret state to finish cleanup after restart.
          if (
            accountDeletionOriginRef.current !== null ||
            deletionRecoveryReceiptRef.current !== null ||
            acceptedAccountDeletionCleanupRef.current !== null
          ) {
            return;
          }
          const cleanup = pendingAccountLogoutCleanupRef.current ?? {
            phoneNumber: session.phoneNumber,
            sessionScopeKey: getAuthSessionScopeKey(session),
            error: reason === 'authorization_invalidated'
              ? '登录已失效，请重新登录。'
              : null,
            revokeRemote: false,
          };
          pendingAccountLogoutCleanupRef.current = cleanup;
          try {
            await accountLogoutCleanupStore.markPending(cleanup.phoneNumber);
            assertActive();
          } catch (error) {
            if (lifetime.active && lifetime.generation === generation) {
              setAccountLogoutState('cleanup_required');
            }
            throw error;
          }
          setAccountLogoutState('cleanup_retrying');
        },
      }),
    [
      authRepository,
      authRepositoryConfig.mode,
      authSessionStore,
      accountLogoutCleanupStore,
      isAccountSessionQuarantined,
    ],
  );
  const authenticatedFetch = useMemo(
    () =>
      createAuthenticatedFetch({
        authSessionCoordinator,
        shouldPreserveAuthorizationRejection:
          isAccountSessionQuarantined,
        shouldQuarantineSession: isAccountSessionQuarantined,
      }),
    [authSessionCoordinator, isAccountSessionQuarantined],
  );
  const accountDeletionRepositoryConfig = useMemo(
    () => resolveAccountDeletionRepositoryConfig(runtimeConfig),
    [runtimeConfig],
  );
  const accountDeletionRepository = useMemo(
    () =>
      accountDeletionRepositoryConfig
        ? createAccountDeletionRepository(accountDeletionRepositoryConfig)
        : null,
    [accountDeletionRepositoryConfig],
  );
  const accountDeletionRecoveryRepository = useMemo(
    () => accountDeletionRepositoryConfig === null ? null : createAccountDeletionRecoveryRepository({
      baseUrl: accountDeletionRepositoryConfig.endpoint.replace(/\/v2\/account\/deletion$/, ''),
      headers: accountDeletionRepositoryConfig.headers,
      clientKind: 'mobile',
    }),
    [accountDeletionRepositoryConfig],
  );
  const accountDeletionCleanupStore = useMemo(
    () => createAccountDeletionCleanupStore(),
    [],
  );
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
  const contentManifestRuntimeConfig = useMemo(
    () => resolveContentManifestRuntimeConfig(runtimeConfig),
    [runtimeConfig],
  );
  const learningSessionRepositoryConfig = useMemo(() => {
    const resolved = resolveLearningSessionRepositoryConfig(runtimeConfig);

    if (resolved.mode !== 'remote') {
      return resolved;
    }

    return {
      ...resolved,
      contentManifestConfig:
        contentManifestRuntimeConfig.mode === 'remote'
          ? {
              mode: 'remote' as const,
              ...contentManifestRuntimeConfig.remote,
            }
          : { mode: 'disabled' as const },
      fetchImpl: authenticatedFetch,
    };
  }, [authenticatedFetch, contentManifestRuntimeConfig, runtimeConfig]);
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
  const configuredPurchaseMode = runtimeConfig?.membership?.purchaseMode;
  const clientPurchaseAvailable =
    configuredPurchaseMode === 'client' ||
    (configuredPurchaseMode === undefined &&
      runtimeMembershipRepositoryMode === 'local');
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
        outbox: new LearningEventOutbox({
          storage: createReactNativeLearningEventOutboxStorage(),
        }),
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
        queueManager: new MutationQueueManager({
          storage: createReactNativeMutationQueueStorage(),
        }),
        spaceStateRepository,
      }),
    [membershipRepository, progressSyncRepository, spaceStateRepository],
  );
  const userStateStore = useMemo(() => createUserStateStore(undefined,
    runtimeAccountBootstrapMode === 'local' && LOCAL_CARD_SOURCE_ID === 'bundled-card-make-v1'
      ? 'softbook-cet/user-state/bundled-card-make-v1' : undefined), [runtimeAccountBootstrapMode]);
  const [activeRoute, setActiveRoute] = useState<RouteKey>('learning');
  const [learningScreen, setLearningScreen] =
    useState<LearningSurfaceScreen>('practice');
  const [spaceScreen, setSpaceScreen] =
    useState<SpaceSurfaceScreen>('overview');
  const [persistenceHydrated, setPersistenceHydrated] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const smsResendAvailableAtByPhone = useRef(new Map<string, number>());
  const smsChallengesByPhone = useRef(new Map<string, AuthChallenge>());
  const [accountDeletionState, setAccountDeletionState] =
    useState<AccountDeletionPresentationState>('closed');
  const [accountDeletionSheetDismissed, setAccountDeletionSheetDismissed] =
    useState(false);
  const [deletionRecoverySnapshot, setDeletionRecoverySnapshot] = useState<AccountDeletionRecoveryReceipt | null>(null);
  const [deletionRecoveryReadBlocked, setDeletionRecoveryReadBlocked] = useState(false);
  const [deletionRecoveryBusy, setDeletionRecoveryBusy] = useState<'checking' | 'request_code' | 'verify_code' | null>(null);
  const [deletionRecoveryChallenge, setDeletionRecoveryChallenge] = useState<AccountDeletionRecoveryChallenge | null>(null);
  const [deletionRecoveryCode, setDeletionRecoveryCode] = useState('');
  const [deletionRecoveryResendAt, setDeletionRecoveryResendAt] = useState(0);
  const [deletionRecoveryError, setDeletionRecoveryError] = useState<string | null>(null);
  const [accountDeletionPreparationFailed, setAccountDeletionPreparationFailed] = useState(false);
  const [accountLogoutState, setAccountLogoutState] =
    useState<'idle' | 'cleanup_required' | 'cleanup_retrying'>('idle');
  const [accountRecoveryRetryGeneration, setAccountRecoveryRetryGeneration] =
    useState(0);
  useEffect(() => {
    const lifetime = deletionRecoveryLifetimeRef.current;
    lifetime.active = true;
    return () => {
      lifetime.active = false;
      lifetime.generation += 1;
      deletionRecoveryRequestRef.current?.controller.abort();
      deletionRecoveryRequestRef.current = null;
    };
  }, []);
  const [accountBootstrapStatus, setAccountBootstrapStatus] =
    useState<AccountBootstrapStatus>(
      runtimeAccountBootstrapMode === 'remote' ? 'pending' : 'not_required',
    );
  const [accountBootstrapSnapshot, setAccountBootstrapSnapshot] =
    useState<AccountBootstrapSnapshot | null>(null);
  const [accountBootstrapIntegrityBlocked, setAccountBootstrapIntegrityBlocked] =
    useState(false);
  const accountBootstrapIntegrityBlockedRef = useRef(false);
  const [mappedAccountBootstrapSnapshot, setMappedAccountBootstrapSnapshot] =
    useState<AccountBootstrapSnapshot | null>(null);
  const [
    accountBootstrapHydrationSettled,
    setAccountBootstrapHydrationSettled,
  ] = useState(runtimeAccountBootstrapMode !== 'remote');
  const [learningSession, setLearningSession] =
    useState<LearningSession | null>(null);
  const learningSessionScopeKeyRef = useRef<string | null>(null);
  const [learningBootstrapStatus, setLearningBootstrapStatus] =
    useState<LearningBootstrapStatus>('idle');
  const learningBootstrapStatusRef = useRef(learningBootstrapStatus);
  learningBootstrapStatusRef.current = learningBootstrapStatus;
  const learningAuthoritySnapshotRef = useRef<AccountBootstrapSnapshot | null>(null);
  const lastDueRefreshKeyRef = useRef<string | null>(null);
  const requestLearningSessionRefresh = useCallback(() => {
    if (
      learningBootstrapStatusRef.current !== 'ready' &&
      learningBootstrapStatusRef.current !== 'error'
    ) return;
    learningBootstrapStatusRef.current = 'idle';
    setLearningBootstrapStatus('idle');
    setLearningBootstrapError(null);
  }, []);
  const [learningBootstrapError, setLearningBootstrapError] = useState<
    string | null
  >(null);
  const [learningIndex, setLearningIndex] = useState(0);
  const authenticationInFlight = useRef(false);
  const [localBatchComplete, setLocalBatchComplete] = useState(false);
  const localResumeCardId = useRef<string | null>(null);
  const [localLearningAttemptGeneration, setLocalLearningAttemptGeneration] =
    useState(0);
  const [learningCardState, setLearningCardState] =
    useState<LearningCardState | null>(null);
  const [learningCompletedResults, setLearningCompletedResults] = useState<
    LearningCardResult[]
  >([]);
  const [learningCurrentResult, setLearningCurrentResult] =
    useState<LearningCardResult | null>(null);
  const [learningRoundContinuePending, setLearningRoundContinuePending] =
    useState(false);
  const [learningRoundContinueError, setLearningRoundContinueError] = useState<
    string | null
  >(null);
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
  const [learningAdvancePending, setLearningAdvancePending] = useState(false);
  const [spaceStateSyncState, setSpaceStateSyncState] =
    useState<SpaceStateSyncState>(INITIAL_SPACE_STATE_SYNC_STATE);
  const [pendingLearningEventCount, setPendingLearningEventCount] = useState(0);
  const [rejectedLearningNotice, setRejectedLearningNotice] = useState<{
    sessionScopeKey: string;
    count: number;
  } | null>(null);
  const [retainedReplayWakeGeneration, setRetainedReplayWakeGeneration] =
    useState(0);
  const pendingLearningEventCountRef = useRef(0);
  const unreconciledCheckInDayKeyRef = useRef<string | null>(null);
  const confirmedCheckInDayKeyRef = useRef<string | null>(null);
  const [learningEventRecoveryPending, setLearningEventRecoveryPending] =
    useState(false);
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
  const spaceCardStateByIdRef = useRef(spaceCardStateById);
  spaceCardStateByIdRef.current = spaceCardStateById;
  const spaceActionPersistenceInFlight = useRef(new Set<string>());
  const currentLearningCardIdRef = useRef<string | null>(null);
  const learningTrackRef = useRef(learningTrack);
  learningTrackRef.current = learningTrack;
  const previousMembershipStage = useRef<MembershipStage>(
    membershipState.stage,
  );
  const membershipStateRef = useRef(membershipState);
  membershipStateRef.current = membershipState;
  const lastMembershipRefreshKey = useRef<string | null>(null);
  const pendingMembershipRefreshKey = useRef<string | null>(null);
  const persistedLearningCursor = useRef<PersistedLearningCursor | null>(null);
  const persistedLocalProgress = useRef<LocalLearningProgress | null>(null);
  const accountBootstrapStatusRef = useRef(accountBootstrapStatus);
  const accountBootstrapSnapshotRef = useRef<AccountBootstrapSnapshot | null>(
    null,
  );
  const accountBootstrapRuntimeSessionId = useMemo(
    createAccountBootstrapRuntimeSessionId,
    [],
  );
  const accountBootstrapObservationGenerationRef = useRef(0);
  const accountBootstrapObservationRef = useRef<{
    proof: AccountBootstrapObservationProof;
    snapshot: AccountBootstrapSnapshot;
  } | null>(null);
  const accountBootstrapHydrationSettledRef = useRef(
    runtimeAccountBootstrapMode !== 'remote',
  );
  const accountBootstrapRetryInFlight = useRef<{
    allowRetainedEventReplay: boolean;
    lease: AccountBootstrapRequestLease;
    preserveLocalState: boolean;
    requestKey: string;
    sessionScopeKey: string;
    task: Promise<boolean>;
  } | null>(null);
  const accountBootstrapRequestGate = useRef(
    createAccountBootstrapRequestGate(),
  ).current;
  const accountBootstrapRefreshRequired = useRef(false);
  const logoutInFlight = useRef<Promise<void> | null>(null);
  const accountDeletionInFlight = useRef<Promise<void> | null>(null);
  const accountDeletionCleanupInFlight = useRef<Promise<void> | null>(null);
  const learningEventEnqueueInFlight = useRef<{
    sessionScopeKey: string;
  } | null>(null);
  const learningEventReplayPaused = useRef(false);
  const mutationReplayInFlight = useRef<{
    sessionScopeKey: string;
    task: Promise<void>;
  } | null>(null);
  const mutationReplayRequestedAfterCurrent = useRef<string | null>(null);
  const mutationReplayAllowsCanonicalRetryAfterCurrent = useRef(false);
  const externalReplayWakeRef = useRef<{
    appState: string | null;
    networkOnline: boolean | null;
    pending: boolean;
  }>({
    appState: AppState.currentState ?? null,
    networkOnline: null,
    pending: false,
  });
  const spaceCanonicalRefreshPauseRef = useRef<{
    baseline: SpaceCanonicalRefreshBaseline;
    sessionScopeKey: string;
  } | null>(null);
  const resetRuntimeAfterLogout = useCallback(
    (error: string | null = null) => {
      accountBootstrapRequestGate.invalidate();
      accountBootstrapRetryInFlight.current = null;
      lastMembershipRefreshKey.current = null;
      pendingMembershipRefreshKey.current = null;
      persistedLearningCursor.current = null;
      persistedLocalProgress.current = null;
      accountBootstrapStatusRef.current =
        runtimeAccountBootstrapMode === 'remote' ? 'pending' : 'not_required';
      accountBootstrapRefreshRequired.current = false;
      accountBootstrapSnapshotRef.current = null;
      accountBootstrapIntegrityBlockedRef.current = false;
      accountBootstrapObservationRef.current = null;
      learningEventEnqueueInFlight.current = null;
      learningEventReplayPaused.current = false;
      mutationReplayRequestedAfterCurrent.current = null;
      mutationReplayAllowsCanonicalRetryAfterCurrent.current = false;
      externalReplayWakeRef.current.pending = false;
      spaceCanonicalRefreshPauseRef.current = null;
      accountBootstrapHydrationSettledRef.current =
        runtimeAccountBootstrapMode !== 'remote';
      setAccountBootstrapStatus(accountBootstrapStatusRef.current);
      setAccountBootstrapSnapshot(null);
      setAccountBootstrapIntegrityBlocked(false);
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
      unreconciledCheckInDayKeyRef.current = null;
      confirmedCheckInDayKeyRef.current = null;
      pendingLearningEventCountRef.current = 0;
      setPendingLearningEventCount(0);
      setLearningEventRecoveryPending(false);
      setProgressSyncState(INITIAL_PROGRESS_SYNC_STATE);
      setLearningAdvancePending(false);
      setLearningStateSyncState(INITIAL_LEARNING_STATE_SYNC_STATE);
      setSpaceStateSyncState(INITIAL_SPACE_STATE_SYNC_STATE);
      startTransition(() => {
        setActiveRoute('mine');
        setLearningScreen('practice');
        setSpaceScreen('overview');
      });
    },
    [accountBootstrapRequestGate, runtimeAccountBootstrapMode],
  );
  const clearAuthenticatedSession = useCallback(
    (
      error: string | null = null,
      revokeRemote = false,
      accountPhoneNumberOverride: string | null = null,
    ) => {
      if (accountDeletionOriginRef.current !== null) {
        setAccountDeletionSheetDismissed(false);
        if (accountDeletionInFlight.current === null) {
          setAccountDeletionState('recoverable_unknown');
        }
        return Promise.resolve();
      }
      if (logoutInFlight.current) {
        return logoutInFlight.current;
      }

      const lifetime = deletionRecoveryLifetimeRef.current;
      const generation = lifetime.generation;
      const isActive = () => lifetime.active && lifetime.generation === generation;
      const accountPhoneNumber =
        pendingAccountLogoutCleanupRef.current?.phoneNumber ??
        accountPhoneNumberOverride ??
        authSessionCoordinator.getCurrentSession()?.phoneNumber ??
        (authState.stage === 'authenticated'
          ? authState.phoneNumber
          : null) ??
        null;

      if (accountPhoneNumber === null) {
        return Promise.reject(new Error('Account cleanup requires an exact account owner.'));
      }
      const cleanup = pendingAccountLogoutCleanupRef.current ?? {
        phoneNumber: accountPhoneNumber,
        sessionScopeKey: getAuthSessionScopeKey(
          authSessionCoordinator.getCurrentSession(),
        ),
        error,
        revokeRemote,
      };
      pendingAccountLogoutCleanupRef.current = cleanup;
      setAccountLogoutState('cleanup_retrying');

      const logoutTask = accountDeletionRecoveryStore.runSessionCleanup(async () => {
        // No credentials or account records are destroyed before this exact
        // owner marker is durable. A later failure leaves a restart-safe retry.
        try {
          await accountLogoutCleanupStore.markPending(accountPhoneNumber);
        } catch {
          if (isActive()) setAccountLogoutState('cleanup_required');
          return;
        }
        if (!isActive()) return;

        const currentScopeKey = getAuthSessionScopeKey(
          authSessionCoordinator.getCurrentSession(),
        );
        if (
          currentScopeKey !== null &&
          currentScopeKey !== cleanup.sessionScopeKey
        ) {
          setAccountLogoutState('cleanup_required');
          return;
        }

        let authCleanupFailed = false;
        try {
          if (cleanup.revokeRemote) {
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
        if (!isActive()) return;

        const cleanupResults = await Promise.allSettled([
          authSessionStore.clearExactly(),
          userStateStore.clear(),
          mutationQueueRepository.clear(),
          learningEventSyncRepository.clearAccount(accountPhoneNumber),
        ]);
        if (!isActive()) return;

        resetRuntimeAfterLogout(cleanup.error);
        if (
          authCleanupFailed ||
          cleanupResults.some(result => result.status === 'rejected')
        ) {
          setAccountLogoutState('cleanup_required');
          return;
        }
        try {
          await accountLogoutCleanupStore.clear();
        } catch {
          if (isActive()) setAccountLogoutState('cleanup_required');
          return;
        }
        if (!isActive()) return;
        pendingAccountLogoutCleanupRef.current = null;
        setAccountLogoutState('idle');
      }, isActive).catch(() => {
        if (isActive()) setAccountLogoutState('cleanup_required');
      });

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
      authSessionStore,
      accountLogoutCleanupStore,
      accountDeletionRecoveryStore,
      authState.phoneNumber,
      authState.stage,
      learningEventSyncRepository,
      mutationQueueRepository,
      resetRuntimeAfterLogout,
      userStateStore,
    ],
  );
  useEffect(() => {
    // A transport may surface session invalidation as cancellation before its
    // original caller can run account cleanup. The durable marker owns the
    // continuation, so it must not depend on that caller reaching a catch block.
    if (
      accountLogoutState === 'cleanup_retrying' &&
      pendingAccountLogoutCleanupRef.current !== null &&
      logoutInFlight.current === null
    ) {
      clearAuthenticatedSession().catch(() =>
        setAccountLogoutState('cleanup_required'),
      );
    }
  }, [accountLogoutState, clearAuthenticatedSession]);
  const clearOriginSessionAfterAuthorizationError = useCallback(
    async (
      error: unknown,
      originSessionScopeKey: string,
      originPhoneNumber: string,
    ): Promise<boolean> => {
      if (!isRemoteAuthorizationError(error)) {
        return false;
      }

      if (isAccountDeletionSessionQuarantined(originSessionScopeKey)) {
        return true;
      }

      const currentSessionScopeKey = getAuthSessionScopeKey(
        authSessionCoordinator.getCurrentSession(),
      );

      if (
        currentSessionScopeKey !== null &&
        currentSessionScopeKey !== originSessionScopeKey
      ) {
        return false;
      }

      await clearAuthenticatedSession(
        '登录已失效，请重新登录。',
        false,
        originPhoneNumber,
      );
      return true;
    },
    [
      authSessionCoordinator,
      clearAuthenticatedSession,
      isAccountDeletionSessionQuarantined,
    ],
  );
  const openAccountDeletionConfirmation = useCallback(() => {
    if (accountDeletionOriginRef.current !== null) {
      setAccountDeletionSheetDismissed(false);
      setAccountDeletionState('recoverable_unknown');
      return;
    }
    if (
      accountDeletionRepository === null ||
      pendingAccountLogoutCleanupRef.current !== null ||
      authState.stage !== 'authenticated' ||
      accountDeletionInFlight.current !== null ||
      accountDeletionState === 'accepted'
    ) {
      return;
    }

    setAccountDeletionSheetDismissed(false);
    setAccountDeletionState('confirmation');
  }, [accountDeletionRepository, accountDeletionState, authState.stage]);
  const closeAccountDeletionSheet = useCallback(() => {
    if (
      accountDeletionState !== 'confirmation' &&
      accountDeletionState !== 'recoverable_unknown'
    ) {
      return;
    }

    if (accountDeletionState === 'recoverable_unknown') {
      // Dismissing presentation cannot discard an irreversible request whose
      // outcome is unknown. Its original credentials stay isolated for retry.
      setAccountDeletionSheetDismissed(true);
      setActiveRoute('mine');
    } else {
      accountDeletionOriginRef.current = null;
      setAccountDeletionState('closed');
    }
  }, [accountDeletionState]);
  const completeAcceptedAccountDeletionCleanup = useCallback(() => {
    if (accountDeletionCleanupInFlight.current) {
      return accountDeletionCleanupInFlight.current;
    }

    const cleanup = acceptedAccountDeletionCleanupRef.current;

    if (cleanup === null) {
      return Promise.resolve();
    }
    const generation = cleanup.generation ?? deletionRecoveryLifetimeRef.current.generation;
    const isCleanupCurrent = () => deletionRecoveryLifetimeRef.current.active &&
      deletionRecoveryLifetimeRef.current.generation === generation &&
      acceptedAccountDeletionCleanupRef.current === cleanup;

    const cleanupTask = (async () => {
      if (!isCleanupCurrent()) return;
      const currentSessionScopeKey = getAuthSessionScopeKey(
        authSessionCoordinator.getCurrentSession(),
      );

      if (
        currentSessionScopeKey !== null &&
        currentSessionScopeKey !== cleanup.sessionScopeKey
      ) {
        acceptedAccountDeletionCleanupRef.current = null;
        setAccountDeletionState('closed');
        return;
      }

      setAccountDeletionState('cleanup_retrying');

      try {
        let receipt = cleanup.receipt;
        if (receipt === undefined) {
          const stored = await accountDeletionRecoveryStore.load();
          if (!isCleanupCurrent()) return;
          receipt = stored.state === null
            ? await accountDeletionRecoveryStore.begin(cleanup.phoneNumber, stored.revision, 'accepted')
            : stored as AccountDeletionRecoveryReceipt;
        }
        if (receipt.state.phoneNumber !== cleanup.phoneNumber) throw new Error('Deletion cleanup owner changed.');
        if (!cleanup.registrationReady && receipt.state.phase !== 'accepted') {
          receipt = await accountDeletionRecoveryStore.transition(receipt, 'accepted');
        }
        if (cleanup.registrationReady && receipt.state.phase !== 'registration_ready') {
          throw new Error('Registration cleanup phase changed.');
        }
        if (!isCleanupCurrent()) return;
        cleanup.receipt = receipt;
        deletionRecoveryReceiptRef.current = receipt;
        setDeletionRecoverySnapshot(receipt);
        if (!cleanup.registrationReady) {
          await accountDeletionCleanupStore.markPending(cleanup.phoneNumber);
        }
      } catch {
        if (!isCleanupCurrent()) return;
        console.warn(
          '[AccountDeletion] Exact local cleanup remains pending.',
        );
        setAccountDeletionState('cleanup_required');
        return;
      }

      if (!isCleanupCurrent()) return;

      let priorLogoutFailed = false;
      try {
        if (logoutInFlight.current) {
          await logoutInFlight.current;
        }
      } catch {
        priorLogoutFailed = true;
      }

      const refreshedSessionScopeKey = getAuthSessionScopeKey(
        authSessionCoordinator.getCurrentSession(),
      );
      if (
        refreshedSessionScopeKey !== null &&
        refreshedSessionScopeKey !== cleanup.sessionScopeKey
      ) {
        acceptedAccountDeletionCleanupRef.current = null;
        setAccountDeletionState('closed');
        return;
      }

      try {
        await accountDeletionRecoveryStore.runCleanup(cleanup.receipt!, async () => {
          if (priorLogoutFailed || !isCleanupCurrent()) throw new Error('Deletion cleanup must retry.');
          const pendingLogout = await accountLogoutCleanupStore.load();
          if (pendingLogout !== null && pendingLogout.phoneNumber !== cleanup.phoneNumber) {
            throw new Error('Another account owns pending local cleanup.');
          }
          if (!isCleanupCurrent()) throw new Error('Deletion cleanup was superseded.');
          await authSessionCoordinator.invalidate();
          if (!isCleanupCurrent()) throw new Error('Deletion cleanup was superseded.');
          const cleanupResults = await Promise.allSettled([
            authSessionStore.clearExactly(),
            userStateStore.clear(),
            learningEventSyncRepository.clearAccount(cleanup.phoneNumber),
            mutationQueueRepository.clear(),
          ]);
          if (cleanupResults.some(result => result.status === 'rejected') || !isCleanupCurrent()) {
            throw new Error('Exact account cleanup remains incomplete.');
          }
          await accountDeletionCleanupStore.clear();
          await accountLogoutCleanupStore.clear();
        }, isCleanupCurrent);
      } catch {
        if (!isCleanupCurrent()) return;
        resetRuntimeAfterLogout(null);
        console.warn(
          '[AccountDeletion] Exact local cleanup remains pending.',
        );
        setAccountDeletionState('cleanup_required');
        return;
      }

      if (!isCleanupCurrent()) return;
      resetRuntimeAfterLogout(null);
      pendingAccountLogoutCleanupRef.current = null;
      setAccountLogoutState('idle');
      acceptedAccountDeletionCleanupRef.current = null;
      if (cleanup.registrationReady) {
        deletionRecoveryLifetimeRef.current.generation += 1;
        deletionRecoveryRequestRef.current?.controller.abort();
        deletionRecoveryRequestRef.current = null;
        deletionRecoveryReceiptRef.current = null;
        setDeletionRecoverySnapshot(null);
        setDeletionRecoveryChallenge(null);
        setDeletionRecoveryCode('');
        setDeletionRecoveryResendAt(0);
        setDeletionRecoveryBusy(null);
        setDeletionRecoveryError(null);
        setDeletionRecoveryReadBlocked(false);
        setAccountDeletionState('closed');
      } else {
        setAccountDeletionState(cleanup.fromRecovery ? 'closed' : 'accepted');
      }
    })();

    accountDeletionCleanupInFlight.current = cleanupTask;
    cleanupTask.finally(() => {
      if (accountDeletionCleanupInFlight.current === cleanupTask) {
        accountDeletionCleanupInFlight.current = null;
      }
    });
    return cleanupTask;
  }, [
    accountDeletionCleanupStore,
    accountDeletionRecoveryStore,
    accountLogoutCleanupStore,
    authSessionCoordinator,
    authSessionStore,
    learningEventSyncRepository,
    mutationQueueRepository,
    resetRuntimeAfterLogout,
    userStateStore,
  ]);
  const submitAccountDeletion = useCallback(() => {
    if (
      accountDeletionRepository === null ||
      pendingAccountLogoutCleanupRef.current !== null ||
      accountDeletionInFlight.current !== null ||
      (accountDeletionState !== 'confirmation' &&
        accountDeletionState !== 'recoverable_unknown')
    ) {
      return accountDeletionInFlight.current ?? Promise.resolve();
    }

    let origin = accountDeletionOriginRef.current;

    if (accountDeletionState === 'confirmation') {
      const originSession = authSessionCoordinator.getCurrentSession();
      const originSessionScopeKey = getAuthSessionScopeKey(originSession);

      if (
        originSession === null ||
        originSessionScopeKey === null ||
        !isRemoteAuthSession(originSession)
      ) {
        accountDeletionOriginRef.current = null;
        setAccountDeletionState('closed');
        return Promise.resolve();
      }

      origin = {
        session: originSession,
        sessionScopeKey: originSessionScopeKey,
        emptyRevision: null,
        receipt: null,
        generation: deletionRecoveryLifetimeRef.current.generation,
        dispatched: false,
      };
      accountDeletionOriginRef.current = origin;
    }

    if (origin === null) {
      setAccountDeletionState('closed');
      return Promise.resolve();
    }

    const currentSessionScopeKey = getAuthSessionScopeKey(
      authSessionCoordinator.getCurrentSession(),
    );
    if (
      currentSessionScopeKey !== null &&
      currentSessionScopeKey !== origin.sessionScopeKey
    ) {
      accountDeletionOriginRef.current = null;
      setAccountDeletionState('closed');
      return Promise.resolve();
    }

    setAccountDeletionState('submitting');
    setAccountDeletionPreparationFailed(false);
    const isOriginCurrent = () => deletionRecoveryLifetimeRef.current.active &&
      deletionRecoveryLifetimeRef.current.generation === origin.generation &&
      accountDeletionOriginRef.current === origin;

    const task = (async () => {
      try {
        if (origin.receipt === null) {
          if (origin.emptyRevision === null) {
            const stored = await accountDeletionRecoveryStore.load();
            if (!isOriginCurrent()) return;
            if (stored.state !== null) throw new Error('An earlier deletion must be recovered first.');
            origin.emptyRevision = stored.revision;
          }
          const receipt = await accountDeletionRecoveryStore.begin(origin.session.phoneNumber, origin.emptyRevision);
          if (!isOriginCurrent()) return;
          origin.receipt = receipt;
          deletionRecoveryReceiptRef.current = receipt;
          setDeletionRecoverySnapshot(receipt);
        } else if (!sameRecoveryState(await accountDeletionRecoveryStore.load(), origin.receipt)) {
          throw new Error('Deletion request authority changed.');
        }
        if (!isOriginCurrent()) return;
        const dispatchScope = getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession());
        if (dispatchScope !== null && dispatchScope !== origin.sessionScopeKey) return;
        origin.dispatched = true;
        await accountDeletionRepository.requestDeletion({
          accessToken: origin.session.accessToken,
          tokenType: origin.session.tokenType,
        });

        if (!isOriginCurrent()) return;

        const responseSessionScopeKey = getAuthSessionScopeKey(
          authSessionCoordinator.getCurrentSession(),
        );
        if (
          responseSessionScopeKey !== null &&
          responseSessionScopeKey !== origin.sessionScopeKey
        ) {
          accountDeletionOriginRef.current = null;
          setAccountDeletionState('closed');
          return;
        }

        accountDeletionOriginRef.current = null;
        acceptedAccountDeletionCleanupRef.current = {
          phoneNumber: origin.session.phoneNumber,
          sessionScopeKey: origin.sessionScopeKey,
          receipt: origin.receipt,
          generation: origin.generation,
        };
        await completeAcceptedAccountDeletionCleanup();
      } catch {
        if (!isOriginCurrent()) return;
        const failureSessionScopeKey = getAuthSessionScopeKey(
          authSessionCoordinator.getCurrentSession(),
        );

        if (
          failureSessionScopeKey !== null &&
          failureSessionScopeKey !== origin.sessionScopeKey
        ) {
          accountDeletionOriginRef.current = null;
          setAccountDeletionState('closed');
          return;
        }

        setAccountDeletionPreparationFailed(!origin.dispatched);
        setAccountDeletionState('recoverable_unknown');
      }
    })();

    accountDeletionInFlight.current = task;
    task.finally(() => {
      if (accountDeletionInFlight.current === task) {
        accountDeletionInFlight.current = null;
      }
    });
    return task;
  }, [
    accountDeletionRepository,
    accountDeletionRecoveryStore,
    accountDeletionState,
    authSessionCoordinator,
    completeAcceptedAccountDeletionCleanup,
  ]);
  const switchUnknownDeletionToSmsRecovery = useCallback(() => {
    const origin = accountDeletionOriginRef.current;
    const receipt = deletionRecoveryReceiptRef.current;
    if (accountDeletionInFlight.current !== null || origin?.receipt == null ||
      receipt === null || !sameRecoveryState(origin.receipt, receipt) ||
      !deletionRecoveryLifetimeRef.current.active) return;
    // The user explicitly chooses a credential-free query. Keep the same
    // durable authority while retiring callbacks belonging to the raw retry.
    deletionRecoveryLifetimeRef.current.generation += 1;
    accountDeletionOriginRef.current = null;
    setDeletionRecoverySnapshot(receipt);
    setDeletionRecoveryError(null);
    setAccountDeletionSheetDismissed(false);
    setAccountDeletionState('closed');
  }, []);
  const queryAccountDeletionRecovery = useCallback((verify: boolean) => {
    const receipt = deletionRecoveryReceiptRef.current;
    const lifetime = deletionRecoveryLifetimeRef.current;
    if (
      receipt === null || !lifetime.active || deletionRecoveryRequestRef.current !== null ||
      accountDeletionOriginRef.current !== null || acceptedAccountDeletionCleanupRef.current !== null
    ) return;
    if (accountDeletionRecoveryRepository === null) {
      setDeletionRecoveryError('当前暂时无法查询账户状态，请稍后重试。');
      return;
    }
    const challenge = deletionRecoveryChallenge;
    if (verify && (challenge === null || challenge.phoneNumber !== receipt.state.phoneNumber ||
      challenge.requestingRevision !== receipt.revision || !/^\d{6}$/.test(deletionRecoveryCode))) return;
    if (!verify && smsResendRemainingSeconds(deletionRecoveryResendAt) > 0) return;
    const operation = {controller: new AbortController(), generation: lifetime.generation, receipt};
    deletionRecoveryRequestRef.current = operation;
    const isCurrent = () => lifetime.active && lifetime.generation === operation.generation &&
      deletionRecoveryRequestRef.current === operation && deletionRecoveryReceiptRef.current !== null &&
      sameRecoveryState(deletionRecoveryReceiptRef.current, receipt);
    setDeletionRecoveryBusy(verify ? 'verify_code' : 'request_code');
    setDeletionRecoveryError(null);
    (async () => {
      try {
        if (!sameRecoveryState(await accountDeletionRecoveryStore.load(), receipt) || !isCurrent()) return;
        if (!verify) {
          const nextChallenge = await accountDeletionRecoveryRepository.requestCode({
            phoneNumber: receipt.state.phoneNumber, requestingRevision: receipt.revision,
            signal: operation.controller.signal,
          });
          if (!isCurrent() || !sameRecoveryState(await accountDeletionRecoveryStore.load(), receipt)) return;
          setDeletionRecoveryChallenge(nextChallenge);
          setDeletionRecoveryResendAt(Date.now() + nextChallenge.retryAfterSeconds * 1000);
          return;
        }
        const result = await accountDeletionRecoveryRepository.verifyCode({
          challenge: challenge!, smsCode: deletionRecoveryCode, signal: operation.controller.signal,
        });
        if (!isCurrent()) return;
        const next = await accountDeletionRecoveryStore.transition(receipt, result.state === 'pending' ? 'accepted' : 'registration_ready');
        if (!isCurrent()) return;
        deletionRecoveryReceiptRef.current = next;
        setDeletionRecoverySnapshot(next);
        setDeletionRecoveryChallenge(null);
        setDeletionRecoveryCode('');
        acceptedAccountDeletionCleanupRef.current = {
          phoneNumber: next.state.phoneNumber,
          sessionScopeKey: getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()),
          receipt: next, registrationReady: result.state === 'none',
          generation: operation.generation, fromRecovery: true,
        };
        await completeAcceptedAccountDeletionCleanup();
      } catch {
        if (isCurrent()) setDeletionRecoveryError('注销进度查询失败，请稍后重试。');
      } finally {
        if (deletionRecoveryRequestRef.current === operation) {
          deletionRecoveryRequestRef.current = null;
          if (lifetime.active && lifetime.generation === operation.generation) setDeletionRecoveryBusy(null);
        }
      }
    })();
  }, [accountDeletionRecoveryRepository, accountDeletionRecoveryStore, authSessionCoordinator,
    completeAcceptedAccountDeletionCleanup, deletionRecoveryChallenge, deletionRecoveryCode, deletionRecoveryResendAt]);
  const { width, height, fontScale } = useWindowDimensions();
  const deviceClass = getDeviceClass(width, height);
  const usesAccessibilityLayout = fontScale >= 1.3;
  const route = ROUTES.find(item => item.key === activeRoute) ?? ROUTES[0];
  const isAuthenticated = authState.stage === 'authenticated';
  const activeLearningNoticeScope = isAuthenticated
    ? getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession())
    : null;
  useEffect(() => {
    if (activeLearningNoticeScope === null || runtimeLearningEventsMode !== 'remote') {
      setRejectedLearningNotice(null);
      return;
    }
    let cancelled = false;
    learningEventSyncRepository.getRejectedEntries(authState.phoneNumber).then(entries => {
      if (
        !cancelled &&
        getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) === activeLearningNoticeScope
      ) setRejectedLearningNotice(current => ({
        sessionScopeKey: activeLearningNoticeScope,
        count: Math.max(entries.length, current?.sessionScopeKey === activeLearningNoticeScope ? current.count : 0),
      }));
    }).catch(() => undefined);
    return () => {cancelled = true;};
  }, [
    activeLearningNoticeScope,
    authSessionCoordinator,
    authState.phoneNumber,
    learningEventSyncRepository,
    runtimeLearningEventsMode,
  ]);
  const routeMotion = useCardMotion(`${isAuthenticated}:${activeRoute}:${learningScreen}:${spaceScreen}`, activeRoute === 'space' && spaceScreen === 'overview' ? 'space' : 'focus');
  const cancelRouteMotion = routeMotion.cancel;
  const pendingRoute = useRef<RouteKey | null>(null);
  useEffect(() => {pendingRoute.current = null;}, [activeRoute, isAuthenticated]);
  useEffect(() => {
    if (Platform.OS !== 'android' || !isAuthenticated) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Modal/recovery flows own their close policy and must not be bypassed.
      if (accountDeletionState !== 'closed' || deletionRecoveryReceiptRef.current !== null) {
        return false;
      }
      if (pendingRoute.current !== null) {
        cancelRouteMotion(); pendingRoute.current = null;
        return true;
      }
      if (activeRoute === 'learning' && learningScreen === 'result_detail') {
        setLearningScreen('practice');
        return true;
      }
      if (activeRoute === 'space' && spaceScreen === 'card_list') {
        setSpaceScreen('overview');
        return true;
      }
      if (activeRoute !== 'learning') {
        setActiveRoute('learning');
        setLearningScreen('practice');
        setSpaceScreen('overview');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [accountDeletionState, activeRoute, isAuthenticated, learningScreen, cancelRouteMotion, spaceScreen]);
  useEffect(() => {
    if (authState.stage === 'authenticated') {
      return;
    }

    startTransition(() => {
      setActiveRoute('learning');
      setLearningScreen('practice');
      setSpaceScreen('overview');
    });
    setAccountDeletionState(current =>
      current === 'confirmation' ? 'closed' : current,
    );
  }, [authState.stage]);
  const membershipAccess = resolveMembershipAccess(membershipState);
  const readSpaceCardState = useCallback(
    (
      cardId: string,
      stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    ): SpaceCardState =>
      Object.hasOwn(stateMap, cardId)
        ? stateMap[cardId]
        : {
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
  const createTrackedLearningAttemptState = useCallback(
    (
      card: LearningSession['cards'][number],
      stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    ) => {
      setLocalLearningAttemptGeneration(current => current + 1);
      return createTrackedLearningCardState(card, stateMap);
    },
    [createTrackedLearningCardState, spaceCardStateById],
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
  const resumeLearningIndex = localResumeIndex(learningSession?.cards ?? [], visibleLearningCards, localResumeCardId.current);
  const sleepingAccessibleCards = resolveSleepingAccessibleCards();
  const recoverableSleepingCard = sleepingAccessibleCards[0] ?? null;
  const activeSessionCards =
    learningPhase === 'review' ? reviewSessionCards : visibleLearningCards;
  const activeCompletedResults =
    learningPhase === 'review'
      ? reviewCompletedResults
      : learningCompletedResults;
  const currentLearningCard = activeSessionCards[learningIndex] ?? null;
  const isLocalLearning = learningSession?.schedulingMode === 'local';
  const localGroup = localBatch(activeSessionCards.length, learningIndex, localBatchComplete);
  const presentedCards = isLocalLearning ? activeSessionCards.slice(localGroup.start, localGroup.end) : activeSessionCards;
  const presentedResults = isLocalLearning ? activeCompletedResults.filter(result => presentedCards.some(card => card.card_id === result.cardId)) : activeCompletedResults;
  const presentedIndex = isLocalLearning ? localGroup.index : learningIndex;
  useEffect(() => { setLocalBatchComplete(false); }, [learningSession?.sourceId, learningSession?.track, authState.phoneNumber]);
  const learningAudioAttemptId =
    learningSession?.schedulingMode === 'server'
      ? learningSession.serverSelection?.selectionId ?? null
      : `local-attempt:${learningSession?.sourceId ?? 'unavailable'}:${learningSession?.track ?? learningTrack}:${learningPhase}:${learningIndex}:${localLearningAttemptGeneration}`;
  const currentRoundCompletion = learningSession?.roundCompletion ?? null;
  const currentRoundSpaceCard = currentRoundCompletion
    ? learningSession?.catalogCards.find(
        card => card.card_id === currentRoundCompletion.spaceCardId,
      ) ?? null
    : null;
  const activeLearningContextCard =
    currentLearningCard ?? currentRoundSpaceCard;
  // A durable sleep intent hides this question while the server chooses its
  // replacement. It never selects another card from the local catalog.
  const isServerSelectionSleeping = Boolean(
    learningSession?.schedulingMode === 'server' &&
    currentLearningCard &&
    readSpaceCardState(currentLearningCard.card_id).isSleeping,
  );
  const isServerSelectionEmpty = Boolean(
    learningSession?.schedulingMode === 'server' &&
    learningSession.serverSelection === null &&
    !learningSession.roundCompletion,
  );
  const isServerSelectionEmptyRef = useRef(isServerSelectionEmpty);
  isServerSelectionEmptyRef.current = isServerSelectionEmpty;
  const activeLibraryTone = activeLearningContextCard
    ? resolveLibraryTone(activeLearningContextCard.space_metadata.library)
    : null;
  const learningPalette: Palette = activeLibraryTone
    ? {
        ...palette,
        accent: activeLibraryTone.accent,
        accentSoft: activeLibraryTone.accentSoft,
        accentStrong: activeLibraryTone.accentStrong,
        primaryActionSurface: activeLibraryTone.accent,
        primaryActionText: '#3A1708',
        primaryActionMuted: 'rgba(58,23,8,0.68)',
      }
    : palette;
  currentLearningCardIdRef.current = currentLearningCard?.card_id ?? null;
  const catalogResultIds = new Set((learningSession?.catalogCards ?? []).map(card => card.card_id));
  const catalogResults = latestCardResults(runtimeAccountBootstrapMode === 'remote'
    ? mappedAccountBootstrapSnapshot?.content.version === learningSession?.contentVersion ? mappedAccountBootstrapSnapshot?.learning.cardStates ?? [] : []
    : [...learningCompletedResults, ...reviewCompletedResults]).filter(result => catalogResultIds.has(result.cardId));
  const pendingSpaceReviewIds = reviewCardIds(catalogResults, Object.keys(spaceCardStateById).filter(id => spaceCardStateById[id].isSleeping));
  const reviewCandidateCards =
    learningSession?.schedulingMode === 'server'
      ? []
      : selectReviewCards(visibleLearningCards, learningCompletedResults);
  const localPendingReviewCount = reviewCandidateCards.filter(
    card =>
      !reviewCompletedResults.some(result => result.cardId === card.card_id),
  ).length;
  const [todayKey, setTodayKey] = useState(() => getChinaDayKey());
  const explicitChinaDayRefreshRef = useRef<string | null>(null);
  useEffect(() => {
    let rolloverTimer: ReturnType<typeof setTimeout> | null = null;

    const synchronizeChinaDay = () => {
      if (rolloverTimer !== null) {
        clearTimeout(rolloverTimer);
      }

      const now = new Date();
      const liveDayKey = getChinaDayKey(now);
      setTodayKey(currentDayKey =>
        currentDayKey === liveDayKey ? currentDayKey : liveDayKey,
      );
      rolloverTimer = setTimeout(
        synchronizeChinaDay,
        getMillisecondsUntilNextChinaDay(now) + 50,
      );
      (
        rolloverTimer as ReturnType<typeof setTimeout> & {
          unref?: () => void;
        }
      ).unref?.();
    };

    synchronizeChinaDay();
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          synchronizeChinaDay();
        }
      },
    );

    return () => {
      if (rolloverTimer !== null) {
        clearTimeout(rolloverTimer);
      }
      appStateSubscription.remove();
    };
  }, []);
  const canonicalProgressSnapshot =
    runtimeAccountBootstrapMode === 'remote' &&
    accountBootstrapSnapshot?.dayKey === todayKey &&
    accountBootstrapSnapshot.track === learningTrack
      ? accountBootstrapSnapshot.progress.snapshot
      : null;
  const pendingReviewCount = canonicalProgressSnapshot
    ? Math.max(
        canonicalProgressSnapshot.pendingReviewCount,
        localPendingReviewCount,
      )
    : runtimeAccountBootstrapMode === 'remote'
    ? 0
    : localPendingReviewCount;
  const loadAuthenticatedRuntimeHydration = useCallback(
    async (
      session: AuthSession,
      bootstrapRequest: {
        dayKey?: string;
        forceFresh?: boolean;
        signal?: AbortSignal;
        track?: LearningTrack;
      } = {},
    ): Promise<AuthenticatedRuntimeHydration> => {
      const context = {
        authToken: getAuthAccessToken(session),
        phoneNumber: session.phoneNumber,
      };
      const persistedUserState = await userStateStore.load(session.phoneNumber);

      if (runtimeAccountBootstrapMode === 'remote') {
        const requestedDayKey = bootstrapRequest.dayKey ?? todayKey;
        const requestedTrack = bootstrapRequest.track ?? learningTrack;
        const hasPendingCheckIn =
          runtimeProgressSyncMode === 'remote' &&
          (await mutationQueueRepository.hasPendingCheckIn(
            session.phoneNumber,
            requestedDayKey,
          ));
        const pendingCheckInDayKey = hasPendingCheckIn ? requestedDayKey : null;

        try {
          const [accountBootstrap, hydratedPendingLearningEventCount] =
            await Promise.all([
              accountBootstrapRepository.load(
                requestedTrack,
                requestedDayKey,
                {
                  forceFresh: bootstrapRequest.forceFresh,
                  signal: bootstrapRequest.signal,
                },
              ),
              runtimeLearningEventsMode === 'remote'
                ? learningEventSyncRepository.getPendingCount(
                    session.phoneNumber,
                  )
                : Promise.resolve(0),
            ]);

          if (accountBootstrap === null) {
            throw new Error('Remote account bootstrap returned no state.');
          }

          const pendingSpaceActions =
            await mutationQueueRepository.getPendingSpaceActions(
              session.phoneNumber,
              {
                contentVersion: accountBootstrap.content.version,
                track: accountBootstrap.track,
              },
            );
          const reconciliation = reconcileAccountBootstrap(
            persistedUserState,
            accountBootstrap,
            { pendingCheckInDayKey, pendingSpaceActions },
          );
          const unresolvedCheckInDayKey =
            pendingCheckInDayKey !== null &&
            !accountBootstrap.progress.snapshot.checkedInToday
              ? pendingCheckInDayKey
              : null;

          return {
            accountBootstrap,
            accountBootstrapStatus: 'ready',
            pendingCheckInDayKey: unresolvedCheckInDayKey,
            pendingLearningEventCount: hydratedPendingLearningEventCount,
            membershipErrorMessage: null,
            membershipRefreshSucceeded: true,
            membershipState: accountBootstrap.membership.state,
            persistedUserState: reconciliation.persistedUserState,
          };
        } catch (error) {
          if (
            isRemoteAuthorizationError(error) ||
            isRemoteRequestCancellationError(error) ||
            error instanceof AccountBootstrapIntegrityError
          ) {
            throw error;
          }

          console.warn(
            '[AccountBootstrap] Canonical account state is temporarily unavailable.',
            error,
          );
          return {
            accountBootstrap: null,
            accountBootstrapStatus: 'deferred',
            pendingCheckInDayKey,
            pendingLearningEventCount: 0,
            membershipErrorMessage: `${getUserFacingErrorMessage(
              error,
              '暂时无法加载账号信息。',
            )} 登录信息已保留，连接恢复后会重试。`,
            membershipRefreshSucceeded: false,
            membershipState: createEntitlementPendingMembershipState(),
            persistedUserState:
              pendingCheckInDayKey === null
                ? persistedUserState
                : {
                    ...persistedUserState,
                    checkedInDayKey: pendingCheckInDayKey,
                  },
          };
        }
      }

      const membershipResolution = await membershipRepository
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
            )} 已登录，联网后会更新会员信息。`,
            refreshSucceeded: false,
            state: createEntitlementPendingMembershipState(),
          };
        });

      return {
        accountBootstrap: null,
        accountBootstrapStatus: 'not_required',
        pendingCheckInDayKey: null,
        pendingLearningEventCount: 0,
        membershipErrorMessage: membershipResolution.errorMessage,
        membershipRefreshSucceeded: membershipResolution.refreshSucceeded,
        membershipState: membershipResolution.state,
        persistedUserState,
      };
    },
    [
      accountBootstrapRepository,
      learningTrack,
      learningEventSyncRepository,
      membershipRepository,
      mutationQueueRepository,
      runtimeAccountBootstrapMode,
      runtimeLearningEventsMode,
      runtimeMembershipRepositoryMode,
      runtimeProgressSyncMode,
      todayKey,
      userStateStore,
    ],
  );
  const applyAuthenticatedRuntimeHydration = useCallback(
    (
      hydration: AuthenticatedRuntimeHydration,
      options: {forceFresh?: boolean} = {},
    ) => {
      accountBootstrapStatusRef.current = hydration.accountBootstrapStatus;
      accountBootstrapSnapshotRef.current = hydration.accountBootstrap;
      if (hydration.accountBootstrap === null) {
        accountBootstrapObservationRef.current = null;
      } else {
        accountBootstrapObservationGenerationRef.current += 1;
        accountBootstrapObservationRef.current = {
          proof: {
            forceFresh: options.forceFresh === true,
            generation: accountBootstrapObservationGenerationRef.current,
            runtimeSessionId: accountBootstrapRuntimeSessionId,
            schemaVersion: 'account-bootstrap-observation.v1',
          },
          snapshot: hydration.accountBootstrap,
        };
      }
      setAccountBootstrapStatus(hydration.accountBootstrapStatus);
      setAccountBootstrapSnapshot(hydration.accountBootstrap);
      if (hydration.accountBootstrapStatus === 'ready') {
        accountBootstrapIntegrityBlockedRef.current = false;
        setAccountBootstrapIntegrityBlocked(false);
      }
      setMappedAccountBootstrapSnapshot(null);
      accountBootstrapHydrationSettledRef.current =
        hydration.accountBootstrapStatus === 'not_required';
      setAccountBootstrapHydrationSettled(
        accountBootstrapHydrationSettledRef.current,
      );
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
      persistedLocalProgress.current = hydration.persistedUserState.localLearningProgress ?? null;
      unreconciledCheckInDayKeyRef.current = hydration.pendingCheckInDayKey;
      setCheckedInDayKey(hydration.persistedUserState.checkedInDayKey);
      setSpaceCardStateById(hydration.persistedUserState.spaceCardStateById);
      if (hydration.pendingCheckInDayKey !== null) {
        setProgressSyncState({
          detail: '签到已保存，联网后会自动更新。',
          label: '已排队',
          state: 'syncing',
        });
      }
    },
    [accountBootstrapRuntimeSessionId],
  );
  const isAccountStateReconciled =
    runtimeAccountBootstrapMode !== 'remote' ||
    (accountBootstrapSnapshot !== null &&
      accountBootstrapSnapshot.dayKey === todayKey &&
      accountBootstrapSnapshot.track === learningTrack);
  const canWriteAccountState =
    !trackSwitchPending &&
    isAccountStateReconciled &&
    accountLogoutState === 'idle' &&
    accountDeletionOriginRef.current === null &&
    deletionRecoveryReceiptRef.current === null &&
    acceptedAccountDeletionCleanupRef.current === null &&
    !deletionRecoveryReadBlocked &&
    accountBootstrapHydrationSettled &&
    !accountBootstrapIntegrityBlocked;
  const hasCheckedInToday = checkedInDayKey === todayKey;
  const learningCompletedCount = canonicalProgressSnapshot
    ? Math.max(
        canonicalProgressSnapshot.learningCompletedCount,
        learningCompletedResults.length,
      )
    : runtimeAccountBootstrapMode === 'remote'
    ? 0
    : learningCompletedResults.length;
  const reviewCompletedCount = canonicalProgressSnapshot
    ? Math.max(
        canonicalProgressSnapshot.reviewCompletedCount,
        reviewCompletedResults.length,
      )
    : runtimeAccountBootstrapMode === 'remote'
    ? 0
    : reviewCompletedResults.length;
  const canCheckInToday =
    !hasCheckedInToday &&
    progressSyncState.state !== 'syncing' &&
    learningCompletedCount + reviewCompletedCount > 0;
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
        learningCompletedCount,
        pendingReviewCount,
        reviewCompletedCount,
        sleepingCount,
      }),
    [
      favoriteCount,
      hasCheckedInToday,
      learningCompletedCount,
      pendingReviewCount,
      reviewCompletedCount,
      sleepingCount,
      todayKey,
    ],
  );
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
      options: {
        allowRetainedEventReplay?: boolean;
        forceFresh?: boolean;
        preserveLocalState?: boolean;
      } = {},
    ): Promise<boolean> => {
      if (runtimeAccountBootstrapMode !== 'remote') {
        return true;
      }

      const allowRetainedEventReplay =
        options.allowRetainedEventReplay === true;
      const preserveLocalState = options.preserveLocalState === true;
      const forceFresh = options.forceFresh === true;

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

      const requestTrack = learningTrack;
      const requestDayKey = getChinaDayKey();
      const requestKey = JSON.stringify({
        dayKey: requestDayKey,
        allowRetainedEventReplay,
        preserveLocalState,
        sessionScopeKey,
        track: requestTrack,
      });

      const requestDecision = accountBootstrapRequestGate.begin(requestKey, {
        forceFresh,
      });
      const existingRetry = accountBootstrapRetryInFlight.current;

      if (requestDecision.reused) {
        if (
          existingRetry?.requestKey !== requestKey ||
          existingRetry.lease !== requestDecision.lease
        ) {
          throw new Error('Bootstrap request coalescing state is inconsistent.');
        }
        return existingRetry.task;
      }
      const requestLease = requestDecision.lease;

      const isCurrentSession = () =>
        getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
          sessionScopeKey;
      const isCurrentRequest = () =>
        isCurrentSession() &&
        accountBootstrapRequestGate.isCurrent(requestLease) &&
        learningTrackRef.current === requestTrack &&
        getChinaDayKey() === requestDayKey;

      accountBootstrapStatusRef.current = 'pending';
      setAccountBootstrapStatus('pending');

      const retryTask = (async () => {
        try {
          const hydration = await loadAuthenticatedRuntimeHydration(session, {
            dayKey: requestDayKey,
            forceFresh,
            signal: requestLease.abortController.signal,
            track: requestTrack,
          });
          const currentSession = authSessionCoordinator.getCurrentSession();

          if (
            !isCurrentRequest() ||
            currentSession === null ||
            getAuthSessionScopeKey(currentSession) !== sessionScopeKey
          ) {
            throw new RemoteRequestLifecycleError('caller_cancelled');
          }

          const previousBootstrap = accountBootstrapSnapshotRef.current;
          const nextBootstrap = hydration.accountBootstrap;

          if (
            previousBootstrap !== null &&
            nextBootstrap !== null
          ) {
            try {
              assertAccountBootstrapRevisionTransition(
                previousBootstrap,
                nextBootstrap,
              );
            } catch (error) {
              accountBootstrapIntegrityBlockedRef.current = true;
              setAccountBootstrapIntegrityBlocked(true);
              throw error;
            }
          }

          if (hydration.accountBootstrapStatus === 'ready') {
            accountBootstrapIntegrityBlockedRef.current = false;
            setAccountBootstrapIntegrityBlocked(false);
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

          const hasLiveRetainedLearningEvent =
            runtimeLearningEventsMode === 'remote' &&
            pendingLearningEventCountRef.current > 0;
          if (hasLiveRetainedLearningEvent) {
            if (hydration.accountBootstrap === null) {
              throw new Error(
                'Pending learning events require validated account state.',
              );
            }

            if (explicitChinaDayRefreshRef.current === requestDayKey) {
              explicitChinaDayRefreshRef.current = null;
            }
            accountBootstrapStatusRef.current = 'ready';
            setAccountBootstrapStatus('ready');
            return hydration.accountBootstrapStatus === 'ready';
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

          applyAuthenticatedRuntimeHydration(hydration, {forceFresh});
          if (
            hydration.accountBootstrapStatus === 'ready' &&
            learningSession === null
          ) {
            setLearningBootstrapStatus('idle');
            setLearningBootstrapError(null);
          }
          return hydration.accountBootstrapStatus === 'ready';
        } catch (error) {
          if (error instanceof AccountBootstrapIntegrityError) {
            accountBootstrapIntegrityBlockedRef.current = true;
            setAccountBootstrapIntegrityBlocked(true);
          }

          if (
            await clearOriginSessionAfterAuthorizationError(
              error,
              sessionScopeKey,
              session.phoneNumber,
            )
          ) {
            return false;
          }

          if (!isCurrentRequest()) {
            throw new RemoteRequestLifecycleError('caller_cancelled');
          }

          throw error;
        }
      })();
      const scopedRetry = {
        allowRetainedEventReplay,
        lease: requestLease,
        preserveLocalState,
        requestKey,
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
        accountBootstrapRequestGate.finish(requestLease);
      }
    },
    [
      applyAuthenticatedRuntimeHydration,
      accountBootstrapRequestGate,
      authSessionCoordinator,
      authenticatedRuntimeContext,
      clearOriginSessionAfterAuthorizationError,
      learningTrack,
      learningSession,
      loadAuthenticatedRuntimeHydration,
      runtimeAccountBootstrapMode,
      runtimeLearningEventsMode,
    ],
  );
  useEffect(() => {
    if (
      runtimeAccountBootstrapMode !== 'remote' ||
      !isAuthenticated ||
      accountBootstrapSnapshot === null ||
      accountBootstrapSnapshot.dayKey === todayKey ||
      explicitChinaDayRefreshRef.current === todayKey
    ) {
      return;
    }

    accountBootstrapHydrationSettledRef.current = false;
    setAccountBootstrapHydrationSettled(false);
    setProgressSyncState({
      detail: '日期已更新，正在签到。',
      label: '更新中',
      state: 'syncing',
    });
    const rolloverSessionScopeKey = getAuthSessionScopeKey(
      authSessionCoordinator.getCurrentSession(),
    );
    const canReportRolloverFailure = () =>
      rolloverSessionScopeKey !== null &&
      getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
        rolloverSessionScopeKey &&
      getChinaDayKey() === todayKey &&
      accountBootstrapSnapshotRef.current?.dayKey !== todayKey;
    const hasRetainedLearningEvent =
      runtimeLearningEventsMode === 'remote' &&
      pendingLearningEventCountRef.current > 0;
    if (hasRetainedLearningEvent) {
      accountBootstrapRefreshRequired.current = true;
      learningEventReplayPaused.current = false;
      setRetainedReplayWakeGeneration(generation => generation + 1);
      return;
    }
    retryCanonicalAccountBootstrap({forceFresh: true})
      .then(succeeded => {
        if (!succeeded && canReportRolloverFailure()) {
          setProgressSyncState({
            detail: '今天的学习进度暂时无法确认。',
            label: '待更新',
            state: 'error',
          });
        }
      })
      .catch(error => {
        if (isRemoteRequestCancellationError(error)) {
          return;
        }

        if (!canReportRolloverFailure()) {
          return;
        }

        setProgressSyncState({
          detail: getUserFacingErrorMessage(
            error,
            '今天的学习进度暂时无法确认。',
          ),
          label: '待更新',
          state: 'error',
        });
      });
  }, [
    accountBootstrapSnapshot,
    authSessionCoordinator,
    isAuthenticated,
    retryCanonicalAccountBootstrap,
    runtimeAccountBootstrapMode,
    runtimeLearningEventsMode,
    runtimeMembershipRepositoryMode,
    todayKey,
  ]);
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
  const startMutationReplay = useCallback(
    (options: {allowCanonicalRefreshRetry?: boolean} = {}) => {
    if (!isAuthenticated || authenticatedRuntimeContext === null) {
      return Promise.resolve();
    }

    const replayAuthContext = authenticatedRuntimeContext;
    const replayPhoneNumber = replayAuthContext.phoneNumber;
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
      mutationReplayAllowsCanonicalRetryAfterCurrent.current =
        mutationReplayAllowsCanonicalRetryAfterCurrent.current ||
        options.allowCanonicalRefreshRetry === true;
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

      if (accountBootstrapIntegrityBlockedRef.current) {
        if (options.allowCanonicalRefreshRetry !== true) {
          return;
        }

        const integrityRecovered = await retryCanonicalAccountBootstrap({
          forceFresh: true,
        });
        if (
          !isReplayAccountCurrent() ||
          !integrityRecovered ||
          accountBootstrapIntegrityBlockedRef.current
        ) {
          return;
        }
      }

      let queuedLearningEventCount = 0;
      let queuedMutationCount = 0;

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
            label: '同步失败',
            state: 'error',
          });
          return;
        }
      }

      try {
        queuedMutationCount = await mutationQueueRepository.getQueueSize();
      } catch (error) {
        if (!isReplayAccountCurrent()) {
          return;
        }

        setProgressSyncState({
          detail: getUserFacingErrorMessage(
            error,
            '待同步记录读取失败，请重试。',
          ),
          label: '同步失败',
          state: 'error',
        });
        return;
      }

      if (queuedLearningEventCount === 0 && queuedMutationCount === 0) {
        if (
          options.allowCanonicalRefreshRetry === true &&
          runtimeAccountBootstrapMode === 'remote' &&
          accountBootstrapStatusRef.current !== 'ready'
        ) {
          await retryCanonicalAccountBootstrap({forceFresh: true});
        }
        return;
      }

      if (
        runtimeLearningEventsMode === 'remote' &&
        queuedLearningEventCount > 0 &&
        learningEventReplayPaused.current
      ) {
        return;
      }

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        queuedLearningEventCount > 0
      ) {
        try {
          const contentStillValid = await retryCanonicalAccountBootstrap({
            allowRetainedEventReplay: true,
            forceFresh: true,
            preserveLocalState: true,
          });

          if (!isReplayAccountCurrent()) {
            return;
          }

          if (!contentStillValid) {
            setLearningSession(null);
            setLearningCardState(null);
            setLearningBootstrapStatus('error');
            setLearningBootstrapError('卡片更新失败，答题记录已保留。');
            return;
          }

          accountBootstrapRefreshRequired.current = false;
        } catch (error) {
          if (!isReplayAccountCurrent()) {
            return;
          }

          if (isRemoteRequestCancellationError(error)) {
            return;
          }

          setLearningSession(null);
          setLearningCardState(null);
          setLearningBootstrapStatus('error');
          setLearningBootstrapError(
            getUserFacingErrorMessage(
              error,
              '卡片更新失败，答题记录已保留。',
            ),
          );
          return;
        }
      }

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        accountBootstrapStatusRef.current !== 'ready'
      ) {
        const retainedBootstrap = accountBootstrapSnapshotRef.current;
        const hasCurrentBootstrapAuthority =
          retainedBootstrap !== null &&
          retainedBootstrap.track === learningTrackRef.current &&
          retainedBootstrap.dayKey === getChinaDayKey();

        if (
          hasCurrentBootstrapAuthority &&
          options.allowCanonicalRefreshRetry !== true
        ) {
          return;
        }

        const bootstrapRecovered = await retryCanonicalAccountBootstrap({
          forceFresh: options.allowCanonicalRefreshRetry === true,
        });
        if (!bootstrapRecovered) {
          if (!isReplayAccountCurrent()) {
            return;
          }

          if (queuedLearningEventCount > 0) {
            setLearningStateSyncState({
              detail: '答题记录已保存在本机，稍后会重试同步。',
              label: '待重试',
              state: 'error',
            });
          }
          return;
        }
      }

      if (!isReplayAccountCurrent()) {
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
          detail: '正在同步答题记录。',
          label: '同步中',
          state: 'syncing',
        });

        if (accountBootstrapIntegrityBlockedRef.current) {
          return;
        }

        try {
          const replay = await learningEventSyncRepository.startReplay(
            replayAuthContext,
            {
              canSubmit: () =>
                isReplayAccountCurrent() &&
                !accountBootstrapIntegrityBlockedRef.current,
            },
          );

          if (!isReplayAccountCurrent()) {
            return;
          }

          learningEventReplayPaused.current = false;
          pendingLearningEventCountRef.current = replay.pendingCount;
          setPendingLearningEventCount(replay.pendingCount);
          setRejectedLearningNotice({sessionScopeKey: replaySessionScopeKey, count: replay.rejectedCount});
          const hasNewRejection = replay.rejectedEntries.length > 0;
          if (replay.acknowledgedEntries.length > 0 || hasNewRejection) {
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
                detail: hasNewRejection
                  ? '这次结果未计入，正在更新学习安排。'
                  : '答题记录已保存，正在更新学习状态。',
                label: '同步中',
                state: 'syncing',
              });

              try {
                const bootstrapRefreshed =
                  await retryCanonicalAccountBootstrap({ forceFresh: true });

                if (!isReplayAccountCurrent()) {
                  return;
                }

                if (!bootstrapRefreshed) {
                  setLearningBootstrapStatus('error');
                  setLearningBootstrapError(
                    '学习进度还未更新，请刷新后继续。',
                  );
                  setLearningStateSyncState({
                    detail: hasNewRejection
                      ? '这次结果未计入，联网后会刷新学习进度。'
                      : '答题记录已保存，联网后会自动更新学习状态。',
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

                if (isRemoteRequestCancellationError(error)) {
                  return;
                }

                setLearningBootstrapStatus('error');
                setLearningBootstrapError(
                  '学习进度更新失败，请重试后继续。',
                );
                setLearningStateSyncState({
                  detail: `${getUserFacingErrorMessage(
                    error,
                    '学习进度更新失败。',
                  )} 服务恢复后会自动再试。`,
                  label: '待刷新',
                  state: 'error',
                });
              }
              return;
            }

            setLearningStateSyncState({
              detail: hasNewRejection ? '这次结果未计入，请刷新学习进度。' : '当前答题记录已同步。',
              label: hasNewRejection ? '未计入' : '已同步',
              state: hasNewRejection ? 'error' : 'synced',
            });
          }
        } catch (error) {
          if (
            await clearOriginSessionAfterAuthorizationError(
              error,
              replaySessionScopeKey,
              replayPhoneNumber,
            )
          ) {
            return;
          }

          if (!isReplayAccountCurrent()) {
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
              '学习记录同步失败。',
            )} 答题记录已保存在本机，网络恢复后会自动再试。`,
            label: '待重试',
            state: 'error',
          });
          if (
            accountBootstrapSnapshotRef.current?.dayKey !== getChinaDayKey()
          ) {
            setProgressSyncState({
              detail: '答题记录已保留，今天的进展联网后会自动更新。',
              label: '待更新',
              state: 'error',
            });
          }
          return;
        }
      }

      // Retained learning events are immutable and may replay after account
      // validation alone. Every other mutation must wait for current content
      // hydration before its payload can be rebound to canonical scope.
      if (!accountBootstrapHydrationSettledRef.current) {
        return;
      }

      const pausedCanonicalRefresh = spaceCanonicalRefreshPauseRef.current;

      if (
        pausedCanonicalRefresh !== null &&
        pausedCanonicalRefresh.sessionScopeKey !== replaySessionScopeKey
      ) {
        spaceCanonicalRefreshPauseRef.current = null;
      } else if (pausedCanonicalRefresh !== null) {
        const currentBootstrap = accountBootstrapSnapshotRef.current;
        const currentObservation = accountBootstrapObservationRef.current;
        const hasCausalAdvance =
          currentBootstrap !== null &&
          currentObservation?.snapshot === currentBootstrap &&
          hasCausalSpaceBootstrapAdvance(
            {
              ...replayAuthContext,
              bootstrapObservation: currentObservation.proof,
              componentRevisions: currentBootstrap.componentRevisions,
              contentVersion: currentBootstrap.content.version,
              dayKey: currentBootstrap.dayKey,
              track: currentBootstrap.track,
            },
            pausedCanonicalRefresh.baseline,
          );

        if (
          !hasCausalAdvance &&
          options.allowCanonicalRefreshRetry !== true
        ) {
          return;
        }

        spaceCanonicalRefreshPauseRef.current = null;
      }

      const canonicalReplayBootstrap = accountBootstrapSnapshotRef.current;

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        (canonicalReplayBootstrap === null ||
          canonicalReplayBootstrap.track !== learningTrackRef.current ||
          canonicalReplayBootstrap.dayKey !== getChinaDayKey())
      ) {
        return;
      }

      const mutationReplayContext = {
        ...replayAuthContext,
        bootstrapObservation:
          accountBootstrapObservationRef.current?.snapshot ===
          canonicalReplayBootstrap
            ? accountBootstrapObservationRef.current.proof
            : undefined,
        componentRevisions:
          canonicalReplayBootstrap?.componentRevisions ?? undefined,
        contentVersion:
          canonicalReplayBootstrap?.content.version ?? undefined,
        dayKey: canonicalReplayBootstrap?.dayKey ?? getChinaDayKey(),
        track: canonicalReplayBootstrap?.track ?? learningTrackRef.current,
      };
      let replayedResults;

      if (accountBootstrapIntegrityBlockedRef.current) {
        return;
      }

      try {
        replayedResults = await mutationQueueRepository.startReplay(
          mutationReplayContext,
          {
            canSubmit: () =>
              isReplayAccountCurrent() &&
              !accountBootstrapIntegrityBlockedRef.current,
          },
        );
      } catch (error) {
        if (
          await clearOriginSessionAfterAuthorizationError(
            error,
            replaySessionScopeKey,
            replayPhoneNumber,
          )
        ) {
          return;
        }

        if (!isReplayAccountCurrent()) {
          return;
        }

        if (isRemoteRequestCancellationError(error)) {
          return;
        }

        throw error;
      }

      if (!isReplayAccountCurrent()) {
        return;
      }

      let replayedCheckInDayKey: string | null = null;
      let replayedSpaceAction = false;
      let quarantinedSpaceAction = false;
      let canonicalSpaceRefreshBaseline: SpaceCanonicalRefreshBaseline | null =
        null;

      for (const result of replayedResults) {
        if (result.entry.type === 'check_in_daily_progress') {
          if (result.entry.payload.dayKey === todayKey) {
            replayedCheckInDayKey = result.entry.payload.dayKey;
            setProgressSyncState({
              detail: '签到已提交，正在确认。',
              label: '确认中',
              state: 'syncing',
            });
          }
          continue;
        }

        if (result.entry.type === 'apply_space_action') {
          if ('canonicalRefreshRequired' in result) {
            canonicalSpaceRefreshBaseline = result.canonicalRefreshRequired;
            setSpaceStateSyncState({
              detail: '内容已更新，正在重新确认这项空间操作。',
              label: '刷新中',
              state: 'syncing',
            });
            continue;
          }

          if ('terminalRejection' in result) {
            quarantinedSpaceAction = true;
            setSpaceStateSyncState({
              detail: '这项操作未能保存，正在恢复空间状态。',
              label: '恢复中',
              state: 'syncing',
            });
            continue;
          }

          replayedSpaceAction = true;
          setSpaceStateSyncState({
            detail: '空间正在更新。',
            label: '确认中',
            state: 'syncing',
          });

          continue;
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
      }

      const replayBootstrap = accountBootstrapSnapshotRef.current;
      const remainingPendingSpaceActionCount =
        replayBootstrap === null
          ? 0
          : (
              await mutationQueueRepository.getPendingSpaceActions(
                replayPhoneNumber,
                {
                  contentVersion: replayBootstrap.content.version,
                  track: replayBootstrap.track,
                },
              )
            ).length;

      if (!isReplayAccountCurrent()) {
        return;
      }

      if (
        !replayedSpaceAction &&
        !quarantinedSpaceAction &&
        canonicalSpaceRefreshBaseline === null &&
        remainingPendingSpaceActionCount > 0
      ) {
        setSpaceStateSyncState({
          detail:
            '设置已保存在本机，联网后会同步。',
          label: '待重试',
          state: 'error',
        });
      }

      if (
        replayedResults.length > 0 &&
        runtimeAccountBootstrapMode === 'remote'
      ) {
        accountBootstrapStatusRef.current = 'pending';
        setAccountBootstrapStatus('pending');
        accountBootstrapHydrationSettledRef.current = false;
        setAccountBootstrapHydrationSettled(false);
        const bootstrapRefreshed = await retryCanonicalAccountBootstrap({
          forceFresh: true,
        });

        if (!isReplayAccountCurrent()) {
          return;
        }

        if (canonicalSpaceRefreshBaseline !== null) {
          const refreshedBootstrap = accountBootstrapSnapshotRef.current;
          const refreshedObservation =
            accountBootstrapObservationRef.current?.snapshot ===
            refreshedBootstrap
              ? accountBootstrapObservationRef.current.proof
              : undefined;
          const hasCausalAdvance =
            refreshedBootstrap !== null &&
            hasCausalSpaceBootstrapAdvance(
              {
                ...mutationReplayContext,
                bootstrapObservation: refreshedObservation,
                componentRevisions: refreshedBootstrap.componentRevisions,
                contentVersion: refreshedBootstrap.content.version,
                dayKey: refreshedBootstrap.dayKey,
                track: refreshedBootstrap.track,
              },
              canonicalSpaceRefreshBaseline,
            );

          if (bootstrapRefreshed && hasCausalAdvance) {
            spaceCanonicalRefreshPauseRef.current = null;
            mutationReplayRequestedAfterCurrent.current =
              replaySessionScopeKey;
            setSpaceStateSyncState({
              detail: '进度已更新，正在重试保存。',
              label: '确认中',
              state: 'syncing',
            });
          } else {
            spaceCanonicalRefreshPauseRef.current = {
              baseline: canonicalSpaceRefreshBaseline,
              sessionScopeKey: replaySessionScopeKey,
            };
            if (
              mutationReplayRequestedAfterCurrent.current ===
              replaySessionScopeKey
            ) {
              mutationReplayRequestedAfterCurrent.current = null;
              mutationReplayAllowsCanonicalRetryAfterCurrent.current = false;
            }
            setSpaceStateSyncState({
              detail:
                '设置已保存在本机，稍后会重试同步。',
              label: '待更新',
              state: 'error',
            });
          }
        } else if (replayedSpaceAction || quarantinedSpaceAction) {
          if (!bootstrapRefreshed) {
            setSpaceStateSyncState({
              detail: quarantinedSpaceAction
                ? '这项操作未能保存，空间暂时无法更新。'
                : '空间已保留这项操作，联网后会自动更新。',
              label: '待确认',
              state: 'error',
            });
          } else if (remainingPendingSpaceActionCount > 0) {
            setSpaceStateSyncState({
              detail: '部分设置还未同步，联网后会自动重试。',
              label: '待重试',
              state: 'error',
            });
          } else if (quarantinedSpaceAction) {
            setSpaceStateSyncState({
              detail: '这项操作未能保存，空间已恢复到上次可用状态。',
              label: '已恢复',
              state: 'synced',
              requiresAttention: true,
            });
          } else {
            setSpaceStateSyncState({
              detail: '收藏和休眠状态已更新。',
              label: '已同步',
              state: 'synced',
            });
          }
        }

        if (replayedCheckInDayKey !== null) {
          const canonicalProgress =
            accountBootstrapSnapshotRef.current?.progress.snapshot;

          if (
            bootstrapRefreshed &&
            canonicalProgress?.dayKey === replayedCheckInDayKey &&
            canonicalProgress.checkedInToday
          ) {
            setCheckedInDayKey(replayedCheckInDayKey);
            unreconciledCheckInDayKeyRef.current = null;
            confirmedCheckInDayKeyRef.current = replayedCheckInDayKey;
            setProgressSyncState({
              detail: '签到已更新。',
              label: '已同步',
              state: 'synced',
            });
          } else {
            setCheckedInDayKey(replayedCheckInDayKey);
            unreconciledCheckInDayKeyRef.current = replayedCheckInDayKey;
            confirmedCheckInDayKeyRef.current = null;
            setProgressSyncState({
              detail: '签到已提交，等待重新确认。',
              label: '待确认',
              state: 'error',
            });
          }
        }
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

      const allowCanonicalRefreshRetry =
        mutationReplayAllowsCanonicalRetryAfterCurrent.current;

      if (
        mutationReplayRequestedAfterCurrent.current === replaySessionScopeKey
      ) {
        mutationReplayRequestedAfterCurrent.current = null;
        mutationReplayAllowsCanonicalRetryAfterCurrent.current = false;
      }

      if (shouldReplayAgain) {
        startMutationReplay({allowCanonicalRefreshRetry}).catch(
          () => undefined,
        );
      }
    };

    replayTask.then(finishReplay, finishReplay);
    return replayTask;
  }, [
    authenticatedRuntimeContext,
    authSessionCoordinator,
    clearOriginSessionAfterAuthorizationError,
    isAuthenticated,
    learningEventSyncRepository,
    mutationQueueRepository,
    retryCanonicalAccountBootstrap,
    runtimeAccountBootstrapMode,
    runtimeLearningEventsMode,
    todayKey,
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
      setLocalBatchComplete(false);
      setLearningPhase('learning');
      setLearningCurrentResult(null);
      setLearningRoundContinuePending(false);
      setLearningRoundContinueError(null);
      setLearningCompletedResults([]);
      setReviewSessionCards([]);
      setReviewCompletedResults([]);
      setLearningCardState(
        nextVisibleCards[0]
          ? createTrackedLearningAttemptState(nextVisibleCards[0], stateMap)
          : null,
      );
    },
    [
      createTrackedLearningAttemptState,
      learningSession,
      membershipState,
      resolveVisibleLearningCards,
      spaceCardStateById,
    ],
  );

  // Today's development counts must not be relabelled as the next day's work.
  const localProgressDay = useRef(todayKey);
  useEffect(() => {
    if (runtimeAccountBootstrapMode === 'local' && localProgressDay.current !== todayKey) {
      localProgressDay.current = todayKey;
      persistedLocalProgress.current = null;
      resetLearningDeck();
    }
  }, [todayKey, runtimeAccountBootstrapMode, resetLearningDeck]);

  const reconcileLearningDeckState = useCallback(
    (
      stateMap: Record<string, SpaceCardState> = spaceCardStateById,
      nextSession: LearningSession | null = learningSession,
      nextMembershipState: MembershipState = membershipState,
    ) => {
      if (nextSession?.schedulingMode === 'server') {
        const currentId = currentLearningCardIdRef.current;
        if (currentId) {
          setLearningCardState(current => current === null ? null : {
            ...current,
            isFavorited: stateMap[currentId]?.isFavorited ?? false,
          });
        }
        return;
      }
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
      setReviewSessionCards(shouldStayInReview ? nextReviewCards : []);
      const nextCard = nextSessionCards[nextIndex];
      // A state change elsewhere in Space can change the deck's indices while
      // leaving this same attempt active. Keep its draft and revealed result.
      if (
        nextPhase === learningPhase &&
        nextCard?.card_id === currentLearningCardIdRef.current
      ) {
        setLearningCardState(current => current === null ? null : {
          ...current,
          isFavorited: stateMap[nextCard.card_id]?.isFavorited ?? false,
        });
        return;
      }
      setLearningCurrentResult(null);
      setLearningCardState(
        nextCard
          ? createTrackedLearningAttemptState(
              nextCard,
              stateMap,
            )
          : null,
      );
    },
    [
      countCompletedCards,
      createTrackedLearningAttemptState,
      learningCompletedResults,
      learningPhase,
      learningSession,
      membershipState,
      resolveVisibleLearningCards,
      reviewCompletedResults,
      spaceCardStateById,
    ],
  );

  const persistenceHydrationCallbacksRef = useRef({
    apply: applyAuthenticatedRuntimeHydration,
    clearSession: clearAuthenticatedSession,
    load: loadAuthenticatedRuntimeHydration,
  });
  persistenceHydrationCallbacksRef.current = {
    apply: applyAuthenticatedRuntimeHydration,
    clearSession: clearAuthenticatedSession,
    load: loadAuthenticatedRuntimeHydration,
  };

  useEffect(() => {
    let isCancelled = false;
    let restoringSessionScopeKey: string | null = null;
    let restoringAccountPhoneNumber: string | null = null;

    const hydratePersistence = async () => {
      // Resolve the durable deletion authority before reading or refreshing
      // credentials. A requesting marker never grants an ordinary session.
      let recovery;
      try {
        recovery = await accountDeletionRecoveryStore.load();
      } catch {
        if (!isCancelled) {
          setDeletionRecoveryReadBlocked(true);
          setDeletionRecoveryError('上次暂时无法加载账号信息，请重试。');
        }
        return;
      }
      if (isCancelled) return;
      setDeletionRecoveryReadBlocked(false);
      setDeletionRecoveryBusy(null);
      setDeletionRecoveryError(null);
      if (recovery.state !== null) {
        const receipt = recovery as AccountDeletionRecoveryReceipt;
        deletionRecoveryReceiptRef.current = receipt;
        setDeletionRecoverySnapshot(receipt);
        if (receipt.state.phase !== 'requesting') {
          acceptedAccountDeletionCleanupRef.current = {
            phoneNumber: receipt.state.phoneNumber,
            sessionScopeKey: null,
            receipt,
            registrationReady: receipt.state.phase === 'registration_ready',
            generation: deletionRecoveryLifetimeRef.current.generation,
            fromRecovery: true,
          };
          await completeAcceptedAccountDeletionCleanup();
        }
        return;
      }
      let pendingAccountLogoutCleanup;
      try {
        pendingAccountLogoutCleanup = await accountLogoutCleanupStore.load();
      } catch (error) {
        setAccountLogoutState('cleanup_required');
        throw error;
      }
      if (pendingAccountLogoutCleanup !== null) {
        pendingAccountLogoutCleanupRef.current = {
          phoneNumber: pendingAccountLogoutCleanup.phoneNumber,
          sessionScopeKey: null,
          error: null,
          revokeRemote: false,
        };
        await persistenceHydrationCallbacksRef.current.clearSession();
        return;
      }
      if (pendingAccountLogoutCleanupRef.current === null) {
        setAccountLogoutState('idle');
      }
      let pendingAccountDeletionCleanup;
      try {
        pendingAccountDeletionCleanup = await accountDeletionCleanupStore.load();
      } catch {
        if (!isCancelled) {
          setDeletionRecoveryReadBlocked(true);
          setDeletionRecoveryError('上次账户清理状态暂时无法读取，请重试。');
        }
        return;
      }
      if (isCancelled) return;
      if (pendingAccountDeletionCleanup !== null) {
        acceptedAccountDeletionCleanupRef.current = {
          phoneNumber: pendingAccountDeletionCleanup.phoneNumber,
          sessionScopeKey: null,
        };
        await completeAcceptedAccountDeletionCleanup();
        return;
      }

      const session = await authSessionCoordinator.restore(restoredSession => {
        restoringSessionScopeKey = getAuthSessionScopeKey(restoredSession);
        restoringAccountPhoneNumber = restoredSession.phoneNumber;
      });

      if (isCancelled) {
        return;
      }

      if (session === null) {
        if (restoringSessionScopeKey !== null) {
          await persistenceHydrationCallbacksRef.current.clearSession(
            '登录已失效，请重新登录。',
            false,
            restoringAccountPhoneNumber,
          );
        }
        return;
      }

      if (restoringSessionScopeKey === null) {
        return;
      }

      const hydration =
        await persistenceHydrationCallbacksRef.current.load(session);

      if (
        isCancelled ||
        getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) !==
          restoringSessionScopeKey
      ) {
        return;
      }

      persistenceHydrationCallbacksRef.current.apply(hydration);
      setAuthState({
        ...INITIAL_AUTH_STATE,
        authToken: getAuthAccessToken(session) ?? null,
        phoneNumber: session.phoneNumber,
        stage: 'authenticated',
      });
    };

    hydratePersistence()
      .catch(async (error: unknown) => {
        if (isRemoteRequestCancellationError(error)) {
          return;
        }

        if (
          findClientUpdateRequiredError(error) &&
          restoringSessionScopeKey !== null
        ) {
          const retainedSession = authSessionCoordinator.getCurrentSession();
          if (
            retainedSession !== null &&
            getAuthSessionScopeKey(retainedSession) === restoringSessionScopeKey
          ) {
            accountBootstrapIntegrityBlockedRef.current = true;
            setAccountBootstrapIntegrityBlocked(true);
            setLearningBootstrapStatus('error');
            setLearningBootstrapError(CLIENT_UPDATE_REQUIRED_COPY);
            setMembershipError(CLIENT_UPDATE_REQUIRED_COPY);
            setAuthState({
              ...INITIAL_AUTH_STATE,
              authToken:
                retainedSession === null
                  ? null
                  : getAuthAccessToken(retainedSession) ?? null,
              error: CLIENT_UPDATE_REQUIRED_COPY,
              phoneNumber: retainedSession.phoneNumber,
              stage: 'authenticated',
            });
            return;
          }
        }

        if (
          isRemoteAuthorizationError(error) &&
          restoringSessionScopeKey !== null &&
          [null, restoringSessionScopeKey].includes(
            getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()),
          )
        ) {
          await persistenceHydrationCallbacksRef.current.clearSession(
            '登录已失效，请重新登录。',
            false,
            restoringAccountPhoneNumber,
          );
          return;
        }

        console.warn('[AppPersistence] Failed to hydrate app state.', error);
      })
      .finally(() => {
        if (!isCancelled) {
          setDeletionRecoveryBusy(null);
          setPersistenceHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    accountLogoutCleanupStore,
    accountRecoveryRetryGeneration,
    accountDeletionRecoveryStore,
    accountDeletionCleanupStore,
    authSessionCoordinator,
    completeAcceptedAccountDeletionCleanup,
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

    if (runtimeAccountBootstrapMode === 'local' &&
        learningSession?.schedulingMode === 'local' && learningBootstrapStatus === 'ready') {
      // A day rollover schedules a reset before the next render. Do not write
      // yesterday's results during that intervening render.
      if ([...learningCompletedResults, ...reviewCompletedResults].some(
        result => getChinaDayKey(new Date(result.completedAt)) !== todayKey,
      )) return;
      persistedLocalProgress.current = {
        dayKey: todayKey,
        sourceId: learningSession.sourceId,
        track: learningSession.track,
        phase: learningPhase,
        cursorCardId: currentLearningCard?.card_id ?? null,
        learningResults: learningCompletedResults,
        reviewResults: reviewCompletedResults,
        reviewCardIds: reviewSessionCards.map(card => card.card_id),
      };
    }

    userStateStore
      .save(authState.phoneNumber, {
        ...(runtimeAccountBootstrapMode === 'local'
          ? {localLearningProgress: persistedLocalProgress.current} : {}),
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
    runtimeAccountBootstrapMode,
    learningBootstrapStatus,
    learningCompletedResults,
    reviewCompletedResults,
    reviewSessionCards,
    todayKey,
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
      setLearningRoundContinuePending(false);
      setLearningRoundContinueError(null);
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
      unreconciledCheckInDayKeyRef.current = null;
      confirmedCheckInDayKeyRef.current = null;
      pendingLearningEventCountRef.current = 0;
      setPendingLearningEventCount(0);
      setLearningEventRecoveryPending(false);
      setProgressSyncState(INITIAL_PROGRESS_SYNC_STATE);
      setLearningStateSyncState(INITIAL_LEARNING_STATE_SYNC_STATE);
      setSpaceStateSyncState(INITIAL_SPACE_STATE_SYNC_STATE);
      return;
    }

    if (!isAccountStateReconciled) {
      if (learningBootstrapStatus !== 'error') {
        // Keep the hidden attempt through a temporary authority read failure.
        // A successful reload must still match its original account and selection.
        setLearningBootstrapStatus('error');
        setLearningBootstrapError(
          '暂时无法加载账号信息，服务恢复后再加载本轮卡片。',
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

        if (isRemoteRequestCancellationError(error)) {
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
    const membershipRefreshSession =
      authSessionCoordinator.getCurrentSession();
    const membershipRefreshSessionScopeKey = getAuthSessionScopeKey(
      membershipRefreshSession,
    );
    if (
      membershipRefreshSessionScopeKey === null ||
      membershipRefreshSession?.phoneNumber !==
        authenticatedRuntimeContext.phoneNumber
    ) {
      return;
    }
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

        if (isRemoteRequestCancellationError(error)) {
          return;
        }

        if (isRemoteAuthorizationError(error)) {
          clearOriginSessionAfterAuthorizationError(
            error,
            membershipRefreshSessionScopeKey,
            authenticatedRuntimeContext.phoneNumber,
          ).catch(() => undefined);
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
    authSessionCoordinator,
    canWriteAccountState,
    clearOriginSessionAfterAuthorizationError,
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

    const shouldReplayRetainedLearningEvent =
      runtimeLearningEventsMode === 'remote' &&
      pendingLearningEventCount > 0 &&
      accountBootstrapStatus === 'ready';
    const hasValidatedAccountReplayAuthority =
      runtimeAccountBootstrapMode === 'remote' &&
      accountBootstrapStatus === 'ready';

    if (
      !shouldReplayRetainedLearningEvent &&
      !hasValidatedAccountReplayAuthority &&
      learningBootstrapStatus !== 'ready'
    ) {
      return;
    }

    startMutationReplay().catch(() => undefined);
  }, [
    activeRoute,
    accountBootstrapHydrationSettled,
    accountBootstrapStatus,
    isAuthenticated,
    learningBootstrapStatus,
    pendingLearningEventCount,
    retainedReplayWakeGeneration,
    runtimeAccountBootstrapMode,
    runtimeLearningEventsMode,
    startMutationReplay,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const replayAfterExternalWake = () => {
      const wake = externalReplayWakeRef.current;

      if (
        !wake.pending ||
        wake.appState === 'background' ||
        wake.appState === 'inactive' ||
        wake.networkOnline === false
      ) {
        return;
      }

      wake.pending = false;

      if (
        runtimeAccountBootstrapMode === 'remote' &&
        accountBootstrapRefreshRequired.current &&
        pendingLearningEventCountRef.current === 0
      ) {
        accountBootstrapRefreshRequired.current = false;
        if (spaceCanonicalRefreshPauseRef.current === null) {
          accountBootstrapStatusRef.current = 'pending';
          setAccountBootstrapStatus('pending');
        }
      }

      learningEventReplayPaused.current = false;
      const wakeScope = getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession());
      startMutationReplay({allowCanonicalRefreshRetry: true}).then(() => {
        if (
          wakeScope !== null &&
          getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) === wakeScope &&
          isServerSelectionEmptyRef.current &&
          pendingLearningEventCountRef.current === 0
        ) requestLearningSessionRefresh();
      }).catch(() => undefined);
    };

    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const networkOnline =
        Boolean(state.isConnected) && state.isInternetReachable !== false;
      const previousNetworkOnline =
        externalReplayWakeRef.current.networkOnline;
      externalReplayWakeRef.current.networkOnline = networkOnline;

      if (!networkOnline) {
        externalReplayWakeRef.current.pending = true;
        accountBootstrapRefreshRequired.current = true;
        return;
      }

      if (previousNetworkOnline === false) {
        externalReplayWakeRef.current.pending = true;
      }
      replayAfterExternalWake();
    });

    const subscription = AppState.addEventListener('change', nextState => {
      const previousAppState = externalReplayWakeRef.current.appState;
      externalReplayWakeRef.current.appState = nextState;

      if (nextState === 'active') {
        if (previousAppState !== 'active') {
          externalReplayWakeRef.current.pending = true;
        }
        replayAfterExternalWake();
        return;
      }

      externalReplayWakeRef.current.pending = true;
      accountBootstrapRefreshRequired.current = true;
    });

    return () => {
      unsubscribeNetInfo();
      subscription.remove();
    };
  }, [
    isAuthenticated,
    runtimeAccountBootstrapMode,
    authSessionCoordinator,
    requestLearningSessionRefresh,
    startMutationReplay,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      learningBootstrapStatus !== 'loading' ||
      (runtimeLearningEventsMode === 'remote' &&
        pendingLearningEventCount > 0)
    ) {
      return;
    }

    let isCancelled = false;

    if (authenticatedRuntimeContext === null) {
      setLearningSession(null);
      setLearningCardState(null);
      setLearningBootstrapStatus('error');
      setLearningBootstrapError('登录已失效，请重新登录。');
      return;
    }

    const learningLoadSession = authSessionCoordinator.getCurrentSession();
    const learningLoadSessionScopeKey = getAuthSessionScopeKey(
      learningLoadSession,
    );
    if (
      learningLoadSessionScopeKey === null ||
      learningLoadSession?.phoneNumber !==
        authenticatedRuntimeContext.phoneNumber
    ) {
      setLearningSession(null);
      setLearningCardState(null);
      setLearningBootstrapStatus('error');
      setLearningBootstrapError('登录已失效，请重新登录。');
      return;
    }

    learningSessionRepository
      .loadSession(authenticatedRuntimeContext, learningTrack)
      .then(async session => {
        if (isCancelled ||
          getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) !== learningLoadSessionScopeKey) {
          return;
        }

        const bootstrapMembership = accountBootstrapSnapshot?.membership.state;
        const hasServerMembershipProjection =
          session.schedulingMode === 'server' &&
          session.membershipStage !== null;
        const sessionMembershipIdentityDiffers = Boolean(
          hasServerMembershipProjection &&
            bootstrapMembership &&
            (bootstrapMembership.stage !== session.membershipStage ||
              bootstrapMembership.trialStartedAt !==
                session.membershipTrialStartedAt ||
              bootstrapMembership.trialExpiresAt !==
                session.membershipTrialExpiresAt),
        );
        const sessionClaimsMoreTrialTime = Boolean(
          hasServerMembershipProjection &&
            bootstrapMembership?.stage === 'trial' &&
            session.membershipStage === 'trial' &&
            session.membershipTrialRemainingSeconds >
              bootstrapMembership.trialRemainingSeconds,
        );

        if (
          runtimeAccountBootstrapMode === 'remote' &&
          accountBootstrapSnapshot !== null &&
          (sessionMembershipIdentityDiffers || sessionClaimsMoreTrialTime)
        ) {
          const bootstrapRefreshed = await retryCanonicalAccountBootstrap({
            forceFresh: true,
          });

          if (isCancelled ||
            getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) !== learningLoadSessionScopeKey) {
            return;
          }

          const refreshedMembership =
            accountBootstrapSnapshotRef.current?.membership.state;
          if (
            !bootstrapRefreshed ||
            refreshedMembership === undefined ||
            refreshedMembership.stage !== session.membershipStage ||
            refreshedMembership.trialStartedAt !==
              session.membershipTrialStartedAt ||
            refreshedMembership.trialExpiresAt !==
              session.membershipTrialExpiresAt ||
            sessionClaimsMoreTrialTime
          ) {
            throw new Error(
              'Canonical membership did not reconcile with the learning session.',
            );
          }

          setLearningSession(null);
          setLearningCardState(null);
          setMappedAccountBootstrapSnapshot(null);
          setLearningBootstrapStatus('idle');
          setLearningBootstrapError(null);
          return;
        }

        const currentMembershipState = membershipStateRef.current;
        let effectiveMembershipState = currentMembershipState;
        if (
          runtimeMembershipRepositoryMode === 'local' &&
          session.schedulingMode === 'local' &&
          currentMembershipState.stage === 'trial_available'
        ) {
          effectiveMembershipState = startMembershipTrial(
            currentMembershipState,
          );
        }
        if (effectiveMembershipState !== currentMembershipState) {
          setMembershipState(effectiveMembershipState);
        }

        const storedProgress = persistedLocalProgress.current;
        const localProgress = runtimeAccountBootstrapMode === 'local' &&
          session.schedulingMode === 'local' && storedProgress?.dayKey === todayKey &&
          storedProgress.sourceId === session.sourceId && storedProgress.track === session.track
          ? storedProgress : null;
        const matchingResults = (results: LearningCardResult[]) => results.filter(result =>
          session.catalogCards.some(card => card.card_id === result.cardId &&
            card.interaction_id === result.interactionId));
        const restoredReviewCards = localProgress?.reviewCardIds.flatMap(id => {
          const card = session.cards.find(candidate => candidate.card_id === id);
          return card && !readSpaceCardState(id).isSleeping ? [card] : [];
        }) ?? [];
        const canonicalLearningState = accountBootstrapSnapshot
          ? resolveAccountBootstrapLearningState(
              accountBootstrapSnapshot,
              session,
            )
          : {
              learningResults: matchingResults(localProgress?.learningResults ?? []),
              reviewResults: matchingResults(localProgress?.reviewResults ?? []),
            };

        const preservesServerAttempt =
          learningSessionScopeKeyRef.current === learningLoadSessionScopeKey &&
          learningSession?.schedulingMode === 'server' &&
          session.schedulingMode === 'server' &&
          learningSession.serverSelection !== null &&
          session.serverSelection?.selectionId ===
            learningSession.serverSelection.selectionId &&
          session.track === learningSession.track &&
          session.sourceId === learningSession.sourceId &&
          session.contentVersion === learningSession.contentVersion &&
          session.serverSelection?.phase === learningSession.serverSelection.phase &&
          session.cards[0]?.card_id === currentLearningCardIdRef.current;
        learningSessionScopeKeyRef.current = learningLoadSessionScopeKey;
        learningAuthoritySnapshotRef.current = accountBootstrapSnapshot;
        setMappedAccountBootstrapSnapshot(accountBootstrapSnapshot);
        setLearningSession(session);
        setLearningRoundContinuePending(false);
        setLearningRoundContinueError(null);
        if (!preservesServerAttempt) setLearningCurrentResult(null);
        setLearningCompletedResults(canonicalLearningState.learningResults);
        const scheduledPhase =
          session.schedulingMode === 'server' &&
          session.serverSelection?.phase === 'review'
            ? 'review'
            : localProgress?.phase === 'review' && restoredReviewCards.length > 0
            ? 'review' : 'learning';
        setLearningPhase(scheduledPhase);
        setReviewSessionCards(scheduledPhase === 'review'
          ? session.schedulingMode === 'server' ? session.cards : restoredReviewCards : []);
        setReviewCompletedResults(canonicalLearningState.reviewResults);
        const nextVisibleCards =
          session.schedulingMode === 'server'
            ? session.cards
            : session.cards
                .slice(
                  0,
                  resolveAccessibleLearningCardCount(
                    session.cards.length,
                    effectiveMembershipState,
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
        const restoredActiveCards = scheduledPhase === 'review' && session.schedulingMode === 'local'
          ? restoredReviewCards : nextVisibleCards;
        const progressIndex = localProgress === null ? -1 : localProgress.cursorCardId === null
          ? restoredActiveCards.length
          : restoredActiveCards.findIndex(card => card.card_id === localProgress.cursorCardId);
        const nextIndex = progressIndex >= 0 ? progressIndex : restoredIndex >= 0 ? restoredIndex : 0;

        setLearningIndex(nextIndex);
        const nextCard = restoredActiveCards[nextIndex];
        if (preservesServerAttempt && nextCard) {
          setLearningCardState(current => current === null ? null : {
            ...current,
            isFavorited: readSpaceCardState(nextCard.card_id).isFavorited,
          });
        } else {
          setLearningCardState(
            nextCard ? createTrackedLearningAttemptState(nextCard) : null,
          );
        }
        setLearningBootstrapStatus('ready');
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        if (isRemoteRequestCancellationError(error)) {
          return;
        }

        if (isRemoteAuthorizationError(error)) {
          clearOriginSessionAfterAuthorizationError(
            error,
            learningLoadSessionScopeKey,
            authenticatedRuntimeContext.phoneNumber,
          ).catch(() => undefined);
          return;
        }

        // The error surface blocks this attempt until fresh authority arrives;
        // a transient load failure must not erase sticky assistance or mistakes.
        setLearningBootstrapStatus('error');
        setLearningBootstrapError(
          getUserFacingErrorMessage(error, '卡片加载失败。'),
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
    authSessionCoordinator,
    createTrackedLearningAttemptState,
    authenticatedRuntimeContext,
    clearOriginSessionAfterAuthorizationError,
    isAuthenticated,
    learningBootstrapStatus,
    learningTrack,
    learningSession,
    learningSessionRepository,
    pendingLearningEventCount,
    readSpaceCardState,
    retryCanonicalAccountBootstrap,
    runtimeAccountBootstrapMode,
    runtimeLearningEventsMode,
    runtimeMembershipRepositoryMode,
    todayKey,
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
      const previousAuthority = learningAuthoritySnapshotRef.current;
      const selectedCardId = learningSession.serverSelection?.cardId;
      const canonicalSleepingCards = accountBootstrapSnapshot.space.snapshot.states
        .filter(state => state.isSleeping).map(state => state.cardId).sort();
      const previousSleepingCards = previousAuthority?.space.snapshot.states
        .filter(state => state.isSleeping).map(state => state.cardId).sort() ?? [];
      const needsServerSelection =
        learningSession.schedulingMode === 'server' &&
        previousAuthority !== null &&
        (previousAuthority.componentRevisions.learning.eventServerSequence !==
          accountBootstrapSnapshot.componentRevisions.learning.eventServerSequence ||
          previousAuthority.componentRevisions.learning.sessionRevision !==
          accountBootstrapSnapshot.componentRevisions.learning.sessionRevision ||
          (selectedCardId !== undefined && canonicalSleepingCards.includes(selectedCardId)) ||
          (learningSession.serverSelection === null &&
            JSON.stringify(previousSleepingCards) !== JSON.stringify(canonicalSleepingCards)));
      learningAuthoritySnapshotRef.current = accountBootstrapSnapshot;
      setMappedAccountBootstrapSnapshot(accountBootstrapSnapshot);
      setLearningCompletedResults(canonicalLearningState.learningResults);
      setReviewCompletedResults(canonicalLearningState.reviewResults);
      if (needsServerSelection) {
        requestLearningSessionRefresh();
        return;
      }
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
        restoredCursor &&
        restoredCursor.sourceId === learningSession.sourceId &&
        restoredCursor.track === learningSession.track &&
        learningSession.schedulingMode === 'local'
          ? nextVisibleCards.findIndex(
              card => card.card_id === restoredCursor.cardId,
            )
          : -1;
      const nextIndex = restoredIndex >= 0 ? restoredIndex : 0;
      const nextCard = nextVisibleCards[nextIndex];
      const preservesCurrentAttempt =
        nextCard?.card_id === currentLearningCardIdRef.current &&
        scheduledPhase === learningPhase;
      setLearningIndex(nextIndex);
      if (preservesCurrentAttempt && nextCard) {
        setLearningCardState(current => current === null ? null : {
          ...current,
          isFavorited: spaceCardStateById[nextCard.card_id]?.isFavorited ?? false,
        });
      } else {
        setLearningCurrentResult(null);
        setLearningCardState(
          nextCard ? createTrackedLearningAttemptState(nextCard, spaceCardStateById) : null,
        );
      }
    } catch (error) {
      accountBootstrapStatusRef.current = 'deferred';
      setAccountBootstrapStatus('deferred');
      setLearningSession(null);
      setLearningCardState(null);
      setLearningBootstrapStatus('error');
      setLearningBootstrapError(
        getUserFacingErrorMessage(error, '卡片加载失败。'),
      );
    }
  }, [
    accountBootstrapSnapshot,
    createTrackedLearningAttemptState,
    learningBootstrapStatus,
    learningPhase,
    learningSession,
    mappedAccountBootstrapSnapshot,
    membershipState,
    resolveVisibleLearningCards,
    requestLearningSessionRefresh,
    spaceCardStateById,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated || !isServerSelectionEmpty ||
      learningBootstrapStatus !== 'ready' ||
      pendingLearningEventCount > 0 ||
      !learningSession?.nextDueAt
    ) return;
    const dueAt = Date.parse(learningSession.nextDueAt);
    if (!Number.isFinite(dueAt)) return;
    const dueKey = `${getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession())}:${learningSession.track}:${learningSession.contentVersion}:${learningSession.nextDueAt}`;
    if (lastDueRefreshKeyRef.current === dueKey) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshWhenDue = () => {
      const remaining = dueAt - Date.now();
      if (remaining > 0) {
        timer = setTimeout(refreshWhenDue, Math.min(remaining, 2_147_483_647));
        return;
      }
      if (externalReplayWakeRef.current.appState !== 'active') return;
      lastDueRefreshKeyRef.current = dueKey;
      requestLearningSessionRefresh();
    };
    refreshWhenDue();
    return () => {if (timer !== undefined) clearTimeout(timer);};
  }, [
    authSessionCoordinator,
    isAuthenticated,
    isServerSelectionEmpty,
    learningBootstrapStatus,
    learningSession,
    pendingLearningEventCount,
    requestLearningSessionRefresh,
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
    if (
      dailyProgressSnapshot.checkedInToday ||
      dailyProgressSnapshot.totalCompletedCount > 0
    ) {
      const checkInNeedsCanonicalConfirmation =
        unreconciledCheckInDayKeyRef.current === dailyProgressSnapshot.dayKey;
      const checkInWasJustConfirmed =
        dailyProgressSnapshot.checkedInToday &&
        confirmedCheckInDayKeyRef.current === dailyProgressSnapshot.dayKey;
      if (!checkInNeedsCanonicalConfirmation) {
        setProgressSyncState({
          detail: checkInWasJustConfirmed
            ? '签到已更新。'
            : '今天的学习进度已恢复。',
          label: '已同步',
          state: 'synced',
        });
      }
      if (checkInWasJustConfirmed) {
        confirmedCheckInDayKeyRef.current = null;
      }
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
              detail: '学习状态已恢复。',
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
    dailyProgressSnapshot.checkedInToday,
    dailyProgressSnapshot.dayKey,
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
      setMembershipError('正在加载账号信息，请稍后重试。');
      retryCanonicalAccountBootstrap().catch(() => undefined);
      return;
    }

    setMembershipError(null);
    setMembershipGate(nextGate);

    if (runtimeMembershipRepositoryMode === 'local') {
      completeMembershipUnlock(startMembershipTrial(membershipState), nextGate);
      return;
    }
    startTransition(() => {
      setActiveRoute('learning');
      setLearningScreen('practice');
      setSpaceScreen('overview');
    });
    setLearningBootstrapStatus('idle');
    setLearningBootstrapError(null);
  };

  const applySelectedRoute = (nextRoute: RouteKey) => {
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

  const handleSelectRoute = (nextRoute: RouteKey) => {
    if (trackSwitchInFlight.current) return;
    if (pendingRoute.current === nextRoute) return;
    routeMotion.cancel(); pendingRoute.current = nextRoute;
    if (nextRoute === activeRoute) {pendingRoute.current = null; applySelectedRoute(nextRoute); return;}
    routeMotion.perform(nextRoute === 'space' ? 'space' : 'focus', () => {pendingRoute.current = null; applySelectedRoute(nextRoute);});
  };

  function submitAuthentication(localStart: boolean) {
    if (authenticationInFlight.current || (localStart && authRepositoryConfig.mode !== 'local')) return;

    if (
      !persistenceHydrated ||
      deletionRecoveryReadBlocked ||
      deletionRecoveryReceiptRef.current !== null ||
      accountLogoutState !== 'idle' ||
      pendingAccountLogoutCleanupRef.current !== null ||
      accountDeletionOriginRef.current !== null ||
      acceptedAccountDeletionCleanupRef.current !== null ||
      authState.pendingAction !== null
    ) {
      return;
    }

    if (!localStart && authState.stage !== 'code_sent') {
      setAuthState(current => ({
        ...current,
        error: '请先请求验证码。',
      }));
      return;
    }

    if (!localStart && authState.challenge === null) {
      setAuthState(current => ({
        ...current,
        error: '验证码请求已失效，请重新获取。',
        stage: 'logged_out',
      }));
      return;
    }

    if (!localStart && !isSmsCodeReady(authState.smsCode)) {
      setAuthState(current => ({
        ...current,
        error: '请输入 4-6 位验证码。',
      }));
      return;
    }

    authenticationInFlight.current = true;
    const phoneNumber = localStart ? LOCAL_DEVICE_OWNER : authState.phoneNumber;
    const smsCode = authState.smsCode;
    const challenge = authState.challenge;
    setAuthState(current => ({
      ...current,
      error: null,
      errorAction: undefined,
      errorKind: undefined,
      pendingAction: 'verify_code',
    }));
    setMembershipError(null);
    setMembershipPendingAction(null);

    let loginStage: 'verify_code' | 'save_session' | 'hydrate_account' = 'verify_code';
    let sessionEstablished = false;
    let establishedSessionScopeKey: string | null = null;

    (async () => {
      const pendingAccountLogoutCleanup =
        await accountLogoutCleanupStore.load();
      if (pendingAccountLogoutCleanup !== null) {
        pendingAccountLogoutCleanupRef.current = {
          phoneNumber: pendingAccountLogoutCleanup.phoneNumber,
          sessionScopeKey: null,
          error: null,
          revokeRemote: false,
        };
        await clearAuthenticatedSession();
        throw new Error('Account cleanup must finish before authentication.');
      }
      const pendingAccountDeletionCleanup =
        await accountDeletionCleanupStore.load();
      if (pendingAccountDeletionCleanup !== null) {
        acceptedAccountDeletionCleanupRef.current = {
          phoneNumber: pendingAccountDeletionCleanup.phoneNumber,
          sessionScopeKey: null,
        };
        await completeAcceptedAccountDeletionCleanup();
        throw new Error(
          'Account deletion cleanup must finish before authentication.',
        );
      }
      const session: AuthSession = localStart
        ? {mode: 'local', phoneNumber: LOCAL_DEVICE_OWNER}
        : await authRepository.verifySmsCode({challenge: challenge!, phoneNumber, smsCode});
      smsChallengesByPhone.current.delete(phoneNumber);
      loginStage = 'save_session';
      await authSessionCoordinator.establish(session);
      sessionEstablished = true;
      establishedSessionScopeKey = getAuthSessionScopeKey(session);

      if (establishedSessionScopeKey === null) {
        throw new Error('Authenticated session scope is unavailable.');
      }

      loginStage = 'hydrate_account';
      const hydration = await loadAuthenticatedRuntimeHydration(session);

      return {
        hydration,
        session,
      };
    })()
      .then(({ hydration, session }) => {
        if (
          establishedSessionScopeKey === null ||
          getAuthSessionScopeKey(
            authSessionCoordinator.getCurrentSession(),
          ) !== establishedSessionScopeKey
        ) {
          return;
        }

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
        const establishedSessionIsCurrent =
          establishedSessionScopeKey !== null &&
          getAuthSessionScopeKey(
            authSessionCoordinator.getCurrentSession(),
          ) === establishedSessionScopeKey;

        if (
          sessionEstablished &&
          establishedSessionScopeKey !== null &&
          (await clearOriginSessionAfterAuthorizationError(
            error,
            establishedSessionScopeKey,
            phoneNumber,
          ))
        ) {
          return;
        }

        if (
          isRemoteRequestCancellationError(error) ||
          (sessionEstablished && !establishedSessionIsCurrent)
        ) {
          return;
        }

        if (
          sessionEstablished &&
          establishedSessionIsCurrent &&
          findClientUpdateRequiredError(error)
        ) {
          accountBootstrapIntegrityBlockedRef.current = true;
          setAccountBootstrapIntegrityBlocked(true);
          setLearningBootstrapStatus('error');
          setLearningBootstrapError(CLIENT_UPDATE_REQUIRED_COPY);
          setMembershipError(CLIENT_UPDATE_REQUIRED_COPY);
          const retainedSession = authSessionCoordinator.getCurrentSession();
          setAuthState({
            ...INITIAL_AUTH_STATE,
            authToken:
              retainedSession === null
                ? null
                : getAuthAccessToken(retainedSession) ?? null,
            error: CLIENT_UPDATE_REQUIRED_COPY,
            phoneNumber,
            stage: 'authenticated',
          });
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

        if (loginStage === 'save_session') {
          // Verification has already consumed this challenge. Retain only
          // the phone's resend deadline; retry must request a fresh code.
          setAuthState(current => ({
            ...current,
            authToken: null,
            challenge: null,
            error: '本机暂时无法保存登录状态。',
            errorAction: 'save_session',
            pendingAction: null,
            smsCode: '',
            stage: 'logged_out',
          }));
          return;
        }

        setAuthState(current => ({
          ...current,
          error: authFailure(error).message,
          errorKind: authFailure(error).kind,
          errorAction: 'verify_code',
          pendingAction: null,
        }));
      })
      .finally(() => { authenticationInFlight.current = false; });
  }

  const authHandlers: AuthHandlers = {
    onChangePhone: value => {
      const phoneNumber = value.replace(/[^\d]/g, '').slice(0, 11);
      const rememberedChallenge = smsChallengesByPhone.current.get(phoneNumber);
      const challenge = rememberedChallenge?.mode === 'remote' &&
        Date.parse(rememberedChallenge.expiresAt) > Date.now()
        ? rememberedChallenge
        : null;

      setAuthState(current => ({
        ...current,
        challenge:
          current.phoneNumber === phoneNumber ? current.challenge : challenge,
        error: null,
        errorAction: undefined,
        errorKind: undefined,
        phoneNumber,
        resendAvailableAt: smsResendAvailableAtByPhone.current.get(phoneNumber) ?? 0,
        smsCode: current.phoneNumber === phoneNumber ? current.smsCode : '',
        stage:
          current.phoneNumber === phoneNumber ||
          current.stage === 'authenticated'
            ? current.stage
            : challenge !== null ? 'code_sent' : 'logged_out',
      }));
    },
    onChangeCode: value => {
      setAuthState(current => ({
        ...current,
        smsCode: value.replace(/[^\d]/g, '').slice(0, 6),
        error: null,
        errorAction: undefined,
        errorKind: undefined,
      }));
    },
    onResetPhone: () => {
      setAuthState(current => ({
        ...current,
        challenge: null,
        error: null,
        errorAction: undefined,
        errorKind: undefined,
        pendingAction: null,
        phoneNumber: '',
        resendAvailableAt: 0,
        smsCode: '',
        stage: 'logged_out',
      }));
    },
    onOpenUpdate: () => {
      const updateUrl =
        Platform.OS === 'ios'
          ? 'itms-beta://'
          : 'market://details?id=com.softbook.cet';
      void Linking.openURL(updateUrl).catch(() => {
        setAuthState(current => ({
          ...current,
          error:
            '请从原内测渠道安装最新版本，更新后可继续学习。',
        }));
      });
    },
    onRequestCode: () => {
      if (
        !persistenceHydrated ||
        deletionRecoveryReadBlocked ||
        deletionRecoveryReceiptRef.current !== null ||
        accountLogoutState !== 'idle' ||
        pendingAccountLogoutCleanupRef.current !== null ||
        accountDeletionOriginRef.current !== null ||
        acceptedAccountDeletionCleanupRef.current !== null ||
        authState.pendingAction !== null ||
        smsResendRemainingSeconds(
          smsResendAvailableAtByPhone.current.get(authState.phoneNumber) ?? 0,
        ) > 0
      ) {
        return;
      }

      if (!isPhoneNumberReady(authState.phoneNumber)) {
        setAuthState(current => ({
          ...current,
          error: '请输入 11 位手机号。',
        }));
        return;
      }

      const phoneNumber = authState.phoneNumber;
      setAuthState(current => ({
        ...current,
        error: null,
        errorAction: undefined,
        errorKind: undefined,
        pendingAction: 'request_code',
      }));

      authRepository
        .requestSmsCode(phoneNumber)
        .then(challenge => {
          const resendAvailableAt = challenge.mode === 'remote'
            ? Date.now() + challenge.retryAfterSeconds * 1000
            : 0;
          smsResendAvailableAtByPhone.current.set(phoneNumber, resendAvailableAt);
          smsChallengesByPhone.current.set(phoneNumber, challenge);
          setAuthState(current =>
            current.phoneNumber === phoneNumber
              ? {
                  ...current,
                  challenge,
                  error: null,
                  pendingAction: null,
                  resendAvailableAt,
                  smsCode: current.stage === 'code_sent' ? current.smsCode : '',
                  stage: 'code_sent',
                }
              : {
                  ...current,
                  pendingAction: null,
                },
          );
        })
        .catch((error: unknown) => {
          const rateLimited = error instanceof RemoteHttpError && error.status === 429;
          if (rateLimited) {
            smsResendAvailableAtByPhone.current.set(
              phoneNumber,
              Date.now() + DEFAULT_SMS_RESEND_SECONDS * 1000,
            );
          }
          setAuthState(current => ({
            ...current,
            error: rateLimited
              ? '操作太频繁，请稍后重试。已收到的验证码仍可使用。'
              : getUserFacingErrorMessage(error, '验证码发送失败，请重试。'),
            errorAction: 'request_code',
            pendingAction: null,
            resendAvailableAt: smsResendAvailableAtByPhone.current.get(current.phoneNumber) ?? 0,
          }));
        });
    },
    onSubmitCode: () => submitAuthentication(false),
    onStartLocal: () => submitAuthentication(true),
    onLogout: async () => {
      if (authRepositoryConfig.mode === 'local') {
        try {
          await userStateStore.save(authState.phoneNumber, {checkedInDayKey, learningCursor: persistedLearningCursor.current, spaceCardStateById});
          await authSessionCoordinator.invalidate();
          resetRuntimeAfterLogout(null);
        } catch {
          setAuthState(current => ({...current, error: '记录还没保存，请重试后返回首页。'}));
        }
        return;
      }
      await clearAuthenticatedSession(null, true);
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
        setMembershipError('正在加载账号信息，请稍后重试。');
        retryCanonicalAccountBootstrap().catch(() => undefined);
        return;
      }

      setMembershipError(null);
      if (runtimeMembershipRepositoryMode === 'local') {
        completeMembershipUnlock(purchaseMembership(membershipState));
        return;
      }

      const purchaseSession = authSessionCoordinator.getCurrentSession();
      const purchaseSessionScopeKey = getAuthSessionScopeKey(purchaseSession);
      if (
        purchaseSessionScopeKey === null ||
        purchaseSession?.phoneNumber !== authenticatedRuntimeContext.phoneNumber
      ) {
        setMembershipError('登录状态已失效，请重新登录后再继续。');
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
            setMembershipPendingAction(null);
            clearOriginSessionAfterAuthorizationError(
              error,
              purchaseSessionScopeKey,
              authenticatedRuntimeContext.phoneNumber,
            ).catch(() => undefined);
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
        setMembershipError('正在加载账号信息，请稍后重试。');
        retryCanonicalAccountBootstrap().catch(() => undefined);
        return;
      }

      setMembershipError(null);
      if (runtimeMembershipRepositoryMode === 'local') {
        setMembershipState(current => dismissMembershipRecovery(current));
        return;
      }

      const dismissSession = authSessionCoordinator.getCurrentSession();
      const dismissSessionScopeKey = getAuthSessionScopeKey(dismissSession);
      if (
        dismissSessionScopeKey === null ||
        dismissSession?.phoneNumber !== authenticatedRuntimeContext.phoneNumber
      ) {
        setMembershipError('登录状态已失效，请重新登录后再继续。');
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
            setMembershipPendingAction(null);
            clearOriginSessionAfterAuthorizationError(
              error,
              dismissSessionScopeKey,
              authenticatedRuntimeContext.phoneNumber,
            ).catch(() => undefined);
            return;
          }

          setMembershipError(
            getUserFacingErrorMessage(error, '续费提醒暂时无法更新。'),
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
      if (isLocalLearning) setLearningCompletedResults(previous => [...previous.filter(result => result.cardId !== completedResult.cardId), completedResult]);
    } else {
      setLearningCompletedResults(nextResults);
    }
    setLearningCurrentResult(null);
    setLearningScreen('practice');
    if (isLocalLearning) setLocalBatchComplete(endsLocalBatch(nextIndex, activeSessionCards.length));

    if (nextIndex >= activeSessionCards.length) {
      setLearningIndex(nextIndex);
      setLearningCardState(null);
      return;
    }

    const nextCard = activeSessionCards[nextIndex];
    setLearningIndex(nextIndex);
    setLearningCardState(createTrackedLearningAttemptState(nextCard));
  };

  const applyDurableSpaceAction = useCallback((action: SpaceAction) => {
    const nextStateMap = applySpaceActionToMap(
      spaceCardStateByIdRef.current,
      action,
    );
    spaceCardStateByIdRef.current = nextStateMap;
    setSpaceCardStateById(nextStateMap);
    return nextStateMap;
  }, []);

  const persistSpaceAction = useCallback(
    (
      cardId: string,
      dimension: SpaceActionDimension,
      value: boolean,
      applyAfterDurableWrite: (action: SpaceAction) => void,
    ) => {
      if (!canWriteAccountState) {
        setSpaceStateSyncState({
          detail: '正在加载账号信息，请稍后重试。',
          label: '暂不可用',
          state: 'error',
        });
        return;
      }

      const actionKey = `${dimension}:${cardId}`;

      if (spaceActionPersistenceInFlight.current.has(actionKey)) {
        return;
      }

      const action = createSpaceAction({ cardId, dimension, value });

      if (runtimeSpaceStateMode === 'local') {
        applyAfterDurableWrite(action);
        setSpaceStateSyncState({
          detail: '收藏和休眠设置已保存。',
          label: '已记录',
          state: 'synced',
        });
        return;
      }

      const bootstrap = accountBootstrapSnapshotRef.current;

      if (
        authenticatedRuntimeContext === null ||
        bootstrap === null ||
        bootstrap.track !== learningTrack
      ) {
        setSpaceStateSyncState({
          detail: '当前无法保存这项操作，请重新登录后再试。',
          label: '保存失败',
          state: 'error',
        });
        return;
      }

      const persistenceSession = authSessionCoordinator.getCurrentSession();
      const persistenceSessionScopeKey =
        getAuthSessionScopeKey(persistenceSession);

      if (
        persistenceSession === null ||
        persistenceSessionScopeKey === null ||
        persistenceSession.phoneNumber !==
          authenticatedRuntimeContext.phoneNumber
      ) {
        setSpaceStateSyncState({
          detail: '登录状态已失效，请重新登录后再试。',
          label: '保存失败',
          state: 'error',
        });
        return;
      }

      const isPersistenceSessionCurrent = () =>
        getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
        persistenceSessionScopeKey;

      spaceActionPersistenceInFlight.current.add(actionKey);
      mutationQueueRepository
        .enqueueMutation(
          'apply_space_action',
          {
            action,
            contentVersion: bootstrap.content.version,
            context: authenticatedRuntimeContext,
            track: learningTrack,
          },
          action.actionId,
        )
        .then(() => {
          if (!isPersistenceSessionCurrent()) {
            return;
          }

          applyAfterDurableWrite(action);
          setSpaceStateSyncState({
            detail: '操作已保留，联网后会自动更新。',
            label: '已排队',
            state: 'syncing',
          });

          if (pendingLearningEventCountRef.current === 0) {
            startMutationReplay().catch(() => undefined);
          }
        })
        .catch((error: unknown) => {
          if (!isPersistenceSessionCurrent()) {
            return;
          }

          setSpaceStateSyncState({
            detail: getUserFacingErrorMessage(
              error,
              '设置保存失败，请重试。',
            ),
            label: '保存失败',
            state: 'error',
          });
        })
        .finally(() => {
          spaceActionPersistenceInFlight.current.delete(actionKey);
        });
    },
    [
      authenticatedRuntimeContext,
      authSessionCoordinator,
      canWriteAccountState,
      learningTrack,
      mutationQueueRepository,
      runtimeSpaceStateMode,
      startMutationReplay,
    ],
  );

  const learningHandlers = {
    onTogglePeek: () => {
      patchLearningCardState(current => ({
        ...current,
        hasUsedPeek: true,
        isPeeked: !current.isPeeked,
      }));
    },
    onToggleFavorite: () => {
      if (currentLearningCard === null || learningCardState === null) {
        return;
      }

      const cardId = currentLearningCard.card_id;
      const nextFavorited = !learningCardState.isFavorited;

      persistSpaceAction(cardId, 'favorite', nextFavorited, action => {
        applyDurableSpaceAction(action);

        if (currentLearningCardIdRef.current === cardId) {
          setLearningCardState(current =>
            current === null
              ? null
              : { ...current, isFavorited: nextFavorited },
          );
        }
      });
    },
    onToggleHint: () => {
      patchLearningCardState(current => ({
        ...current,
        hasUsedHint: true,
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
      if (!currentLearningCard || currentLearningCard.interaction_id !== 'lock' || !learningCardState || learningCurrentResult) return;
      const nextState = selectLockOption(currentLearningCard, learningCardState, slotId, value);
      setLearningCardState(nextState);
      const result = evaluateLearningCard(currentLearningCard, nextState);
      if (result) {setLearningCurrentResult(result); setLearningScreen('practice');}
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
      if (currentLearningCard === null || learningCardState === null) {
        return;
      }

      const nextState = {
        ...learningCardState,
        swipeSelection: stateId,
      };

      setLearningCardState(nextState);
      setLearningCurrentResult(
        evaluateLearningCard(currentLearningCard, nextState),
      );
      setLearningScreen('practice');
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
        learningAdvancePending ||
        learningEventEnqueueInFlight.current !== null
      ) {
        return;
      }

      if (
        runtimeLearningEventsMode === 'remote' &&
        pendingLearningEventCountRef.current > 0
      ) {
        setLearningAdvancePending(true);
        setLearningStateSyncState({
          detail: '正在同步答题记录，完成后即可继续。',
          label: '同步中',
          state: 'syncing',
        });
        startMutationReplay()
          .catch((error: unknown) => {
            setLearningStateSyncState({
              detail: getUserFacingErrorMessage(
                error,
                '已保留的答题记录暂时无法同步，请重试。',
              ),
              label: '同步失败',
              state: 'error',
            });
          })
          .finally(() => setLearningAdvancePending(false));
        return;
      }

      const completedResult = learningCurrentResult;

      if (runtimeLearningEventsMode === 'local') {
        commitLearningCardAdvance(completedResult);
        setLearningStateSyncState({
          detail: '答题记录已保存。',
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
            ? '正在恢复上次的答题记录，请稍候。'
            : learningSession?.contentVersion === null
            ? '卡片暂时不可用，这次作答还未保存。'
            : '正在加载账号信息，这次作答还未保存，请稍后重试。',
          label: '暂未保存',
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
      setLearningAdvancePending(true);
      setLearningStateSyncState({
        detail: '正在保存答题记录。',
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
            detail: '答题记录已保留，联网后会自动更新。',
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
              '答题记录保存失败，请重试。',
            ),
            label: '记录失败',
            state: 'error',
          });
        } finally {
          if (learningEventEnqueueInFlight.current === enqueueOperation) {
            learningEventEnqueueInFlight.current = null;
          }
          setLearningAdvancePending(false);
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

      if (isLocalLearning && learningPhase === 'learning') localResumeCardId.current = visibleLearningCards[learningIndex]?.card_id ?? null;
      setLocalBatchComplete(false);
      setLearningPhase('review');
      setReviewSessionCards(reviewCandidateCards);
      setReviewCompletedResults([]);
      setLearningIndex(0);
      setLearningCurrentResult(null);
      setLearningScreen('practice');
      setLearningCardState(
        createTrackedLearningAttemptState(reviewCandidateCards[0]),
      );
    },
    onRestartDeck: () => {
      if (isLocalLearning && learningPhase === 'review' && resumeLearningIndex < visibleLearningCards.length) {
        const index = resumeLearningIndex;
        setLearningPhase('learning'); setReviewSessionCards([]); setReviewCompletedResults([]);
        setLearningIndex(index); setLocalBatchComplete(false); setLearningCurrentResult(null);
        setLearningCardState(createTrackedLearningAttemptState(visibleLearningCards[index]));
        return;
      }
      resetLearningDeck();
    },
    onContinueRound: () => {
      if (
        learningRoundContinuePending ||
        currentRoundCompletion === null ||
        learningSession === null ||
        authenticatedRuntimeContext === null
      ) {
        return;
      }
      const continuationSession = authSessionCoordinator.getCurrentSession();
      const continuationScopeKey = getAuthSessionScopeKey(continuationSession);
      if (
        continuationSession === null ||
        continuationScopeKey === null ||
        continuationSession.phoneNumber !==
          authenticatedRuntimeContext.phoneNumber
      ) {
        setLearningRoundContinueError('登录状态已失效，请重新登录后再继续。');
        return;
      }
      setLearningRoundContinuePending(true);
      setLearningRoundContinueError(null);
      learningSessionRepository
        .continueRound(authenticatedRuntimeContext, learningSession)
        .then(() => {
          if (
            getAuthSessionScopeKey(
              authSessionCoordinator.getCurrentSession(),
            ) !== continuationScopeKey
          ) {
            return;
          }
          setLearningSession(null);
          setLearningCardState(null);
          setLearningBootstrapStatus('idle');
          setLearningBootstrapError(null);
          setLearningRoundContinuePending(false);
        })
        .catch((error: unknown) => {
          if (
            getAuthSessionScopeKey(
              authSessionCoordinator.getCurrentSession(),
            ) !== continuationScopeKey ||
            isRemoteRequestCancellationError(error)
          ) {
            return;
          }
          if (isRemoteAuthorizationError(error)) {
            clearOriginSessionAfterAuthorizationError(
              error,
              continuationScopeKey,
              continuationSession.phoneNumber,
            ).catch(() => undefined);
            return;
          }
          setLearningRoundContinuePending(false);
          setLearningRoundContinueError(
            getUserFacingErrorMessage(error, '暂时无法继续下一轮，请重试。'),
          );
        });
    },
  };

  const spaceHandlers = {
    onToggleFavoriteTag: (cardId: string) => {
      const currentState = readSpaceCardState(cardId);
      const nextFavorited = !currentState.isFavorited;

      persistSpaceAction(cardId, 'favorite', nextFavorited, action => {
        applyDurableSpaceAction(action);

        if (currentLearningCardIdRef.current === cardId) {
          setLearningCardState(current =>
            current === null
              ? null
              : { ...current, isFavorited: nextFavorited },
          );
        }
      });
    },
    onToggleSleepState: (cardId: string) => {
      const currentState = readSpaceCardState(cardId);
      const nextSleeping = !currentState.isSleeping;

      persistSpaceAction(cardId, 'sleep', nextSleeping, action => {
        const nextStateMap = applyDurableSpaceAction(action);
        setLocalBatchComplete(false);
        reconcileLearningDeckState(nextStateMap);
      });
    },
  };

  const statisticsHandlers = {
    onCheckIn: () => {
      const liveDayKey = getChinaDayKey();
      const requiresCanonicalDayRefresh =
        runtimeAccountBootstrapMode === 'remote' &&
        accountBootstrapSnapshotRef.current?.dayKey !== liveDayKey;

      if (requiresCanonicalDayRefresh) {
        explicitChinaDayRefreshRef.current = liveDayKey;
      }

      if (liveDayKey !== todayKey) {
        setTodayKey(liveDayKey);
      }

      if (requiresCanonicalDayRefresh) {
        accountBootstrapHydrationSettledRef.current = false;
        setAccountBootstrapHydrationSettled(false);
        setProgressSyncState({
          detail: '日期已更新，先签到再签到。',
          label: '更新中',
          state: 'syncing',
        });
        const rolloverSessionScopeKey = getAuthSessionScopeKey(
          authSessionCoordinator.getCurrentSession(),
        );
        const canReportRolloverFailure = () =>
          rolloverSessionScopeKey !== null &&
          getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
            rolloverSessionScopeKey &&
          getChinaDayKey() === liveDayKey &&
          accountBootstrapSnapshotRef.current?.dayKey !== liveDayKey;
        const hasRetainedLearningEvent =
          runtimeLearningEventsMode === 'remote' &&
          pendingLearningEventCountRef.current > 0;
        if (hasRetainedLearningEvent) {
          accountBootstrapRefreshRequired.current = true;
          learningEventReplayPaused.current = false;
          setRetainedReplayWakeGeneration(generation => generation + 1);
          return;
        }
        retryCanonicalAccountBootstrap({forceFresh: true})
          .then(succeeded => {
            if (
              succeeded &&
              explicitChinaDayRefreshRef.current === liveDayKey
            ) {
              explicitChinaDayRefreshRef.current = null;
            }
            if (!succeeded && canReportRolloverFailure()) {
              setProgressSyncState({
                detail: '今天的学习进度暂时无法确认。',
                label: '待更新',
                state: 'error',
              });
            }
          })
          .catch(error => {
            if (isRemoteRequestCancellationError(error)) {
              return;
            }

            if (!canReportRolloverFailure()) {
              return;
            }

            setProgressSyncState({
              detail: getUserFacingErrorMessage(
                error,
                '今天的学习进度暂时无法确认。',
              ),
              label: '待更新',
              state: 'error',
            });
          });
        return;
      }

      const canCheckInLiveDay =
        checkedInDayKey !== liveDayKey &&
        progressSyncState.state !== 'syncing' &&
        learningCompletedCount + reviewCompletedCount > 0;

      if (!canCheckInLiveDay || !canWriteAccountState) {
        return;
      }

      if (runtimeProgressSyncMode === 'local') {
        unreconciledCheckInDayKeyRef.current = null;
        setCheckedInDayKey(liveDayKey);
        setProgressSyncState({
          detail: '今天的签到已记录。',
          label: '已记录',
          state: 'synced',
        });
        return;
      }

      if (authenticatedRuntimeContext === null) {
        setProgressSyncState({
          detail: '当前无法签到，请重新登录后再试。',
          label: '签到失败',
          state: 'error',
        });
        return;
      }

      const sessionScopeKey = getAuthSessionScopeKey(
        authSessionCoordinator.getCurrentSession(),
      );

      if (sessionScopeKey === null) {
        setProgressSyncState({
          detail: '登录状态已失效，请重新登录后再试。',
          label: '签到失败',
          state: 'error',
        });
        return;
      }

      confirmedCheckInDayKeyRef.current = null;
      setProgressSyncState({
        detail:
          pendingLearningEventCount > 0
            ? '答题记录确认后再提交签到。'
            : '正在保存签到。',
        label: '保存中',
        state: 'syncing',
      });

      mutationQueueRepository
        .enqueueMutation(
          'check_in_daily_progress',
          {
            context: authenticatedRuntimeContext,
            dayKey: liveDayKey,
          },
          `check-in:${authenticatedRuntimeContext.phoneNumber}:${liveDayKey}`,
        )
        .then(() => {
          if (
            getAuthSessionScopeKey(
              authSessionCoordinator.getCurrentSession(),
            ) !== sessionScopeKey
          ) {
            return;
          }

          unreconciledCheckInDayKeyRef.current = liveDayKey;
          setCheckedInDayKey(liveDayKey);
          setProgressSyncState({
            detail: '签到已保存，联网后会自动更新。',
            label: '已排队',
            state: 'syncing',
          });
          startMutationReplay().catch(() => undefined);
        })
        .catch((error: unknown) => {
          if (
            getAuthSessionScopeKey(
              authSessionCoordinator.getCurrentSession(),
            ) !== sessionScopeKey
          ) {
            return;
          }

          setProgressSyncState({
            detail: getUserFacingErrorMessage(
              error,
              '签到保存失败，请重试。',
            ),
            label: '保存失败',
            state: 'error',
          });
        });
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
  const retryEmptyLearningSession = () => {
    if (pendingLearningEventCountRef.current > 0 || isServerSelectionSleeping) {
      const retryScope = getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession());
      startMutationReplay({allowCanonicalRefreshRetry: true}).then(() => {
        if (
          retryScope === null ||
          getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) !== retryScope ||
          pendingLearningEventCountRef.current > 0
        ) return;
        const canonicalSleeping = accountBootstrapSnapshotRef.current?.space.snapshot.states.some(
          state => state.cardId === currentLearningCardIdRef.current && state.isSleeping,
        );
        if (isServerSelectionEmptyRef.current || canonicalSleeping) requestLearningSessionRefresh();
      }).catch(() => undefined);
      return;
    }
    requestLearningSessionRefresh();
  };
  const audioRefreshIdentity = JSON.stringify([
    activeLearningNoticeScope, activeRoute, learningSession?.track,
    learningSession?.sourceId, learningSession?.contentVersion,
    learningAudioAttemptId, currentLearningCard?.card_id,
    currentLearningCard?.audio?.asset_id, currentLearningCard?.audio?.sha256,
    currentLearningCard?.audio?.duration_ms, isServerSelectionSleeping,
    canWriteAccountState,
  ]);
  const audioRefreshIdentityRef = useRef(audioRefreshIdentity);
  audioRefreshIdentityRef.current = audioRefreshIdentity;
  const refreshLearningAudioDownload = useCallback<RefreshLearningAudioDownload>(async selection => {
    const origin = authSessionCoordinator.getCurrentSession();
    const originScope = getAuthSessionScopeKey(origin);
    const card = currentLearningCard;
    const session = learningSession;
    const isCurrent = () =>
      originScope !== null &&
      getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) === originScope &&
      audioRefreshIdentityRef.current === audioRefreshIdentity;
    if (
      !origin || !isCurrent() || activeRoute !== 'learning' ||
      !canWriteAccountState || isServerSelectionSleeping ||
      !card?.audio || !session ||
      !learningSessionRepository.refreshAudioDownload ||
      selection.authorityToken !== learningAudioAttemptId ||
      selection.cardToken !== `${card.card_id}:${card.audio.sha256}` ||
      selection.asset.asset_id !== card.audio.asset_id ||
      selection.asset.sha256 !== card.audio.sha256 ||
      selection.asset.duration_ms !== card.audio.duration_ms
    ) throw new RemoteRequestLifecycleError('caller_cancelled');
    const download = await learningSessionRepository.refreshAudioDownload(
      {phoneNumber: origin.phoneNumber, authToken: getAuthAccessToken(origin)},
      session,
      card.audio.asset_id,
      {isCurrent},
    );
    if (!isCurrent()) throw new RemoteRequestLifecycleError('caller_cancelled');
    return download;
  }, [
    activeRoute, audioRefreshIdentity, authSessionCoordinator, canWriteAccountState,
    currentLearningCard, isServerSelectionSleeping, learningAudioAttemptId,
    learningSession, learningSessionRepository,
  ]);

  const accessibleSpaceCards = learningSession
    ? learningSession.schedulingMode === 'server'
      ? learningSession.catalogCards
      : learningSession.catalogCards.slice(
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
                purchaseAvailable={clientPurchaseAvailable}
              />
            </>
          ),
          detail:
            '可以查看已解锁卡片。收藏、休眠和完整空间需要试用或会员。',
          label:
            membershipPendingAction === 'start_trial'
              ? '正在开通'
              : '需要会员',
          title: '完整空间需要试用或会员',
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
                  style={[
                    styles.primaryButtonLabel,
                    { color: palette.primaryActionText },
                  ]}
                >
                  重新加载空间内容
                </Text>
              </Pressable>
            ) : null,
          detail:
            learningBootstrapStatus === 'error'
              ? `${learningBootstrapError ?? '空间内容暂时不可用。'} 请重试。`
              : '正在加载卡片。',
          label: learningBootstrapStatus === 'error' ? '可重试' : '加载中',
          state: learningBootstrapStatus === 'error' ? 'error' : 'loading',
          title:
            learningBootstrapStatus === 'error'
              ? '空间内容暂时不可用'
              : '正在加载空间',
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
          requiresAttention: spaceStateSyncState.requiresAttention,
          title:
            spaceStateSyncState.requiresAttention
              ? '空间状态已恢复'
              : spaceStateSyncState.state === 'error'
              ? '设置同步失败'
              : spaceStateSyncState.state === 'syncing'
              ? '正在同步设置'
              : '设置已同步',
        }
      : null;
  const learningAdvanceState = {
    busy: learningAdvancePending,
    detail:
      learningCurrentResult === null
        ? null
        : learningStateSyncState.state === 'error'
        ? learningStateSyncState.detail
        : pendingLearningEventCount > 0 || learningEventRecoveryPending
        ? '这次答案已保留，先完成同步再进入下一张。'
        : learningAdvancePending
        ? '正在保存答题记录。'
        : null,
    needsRetry:
      learningCurrentResult !== null &&
      !learningAdvancePending &&
      (learningStateSyncState.state === 'error' ||
        pendingLearningEventCount > 0 ||
        learningEventRecoveryPending),
  };

  const switchLearningTrack = async (nextTrack: LearningTrack) => {
    if (nextTrack === learningTrack || trackSwitchInFlight.current || !canWriteAccountState) return;
    const session = authSessionCoordinator.getCurrentSession();
    if (session?.mode !== 'remote' || authenticatedRuntimeContext === null) return;
    const scopeKey = getAuthSessionScopeKey(session);
    if (scopeKey === null) return;
    trackSwitchInFlight.current = true;
    setTrackSwitchPending(true);
    setTrackSwitchError(null);
    try {
      const pendingSpace = accountBootstrapSnapshot === null ? [] : await mutationQueueRepository.getPendingSpaceActions(session.phoneNumber, {track: learningTrack, contentVersion: accountBootstrapSnapshot.content.version});
      if (learningAdvancePending || learningRoundContinuePending || spaceActionPersistenceInFlight.current.size > 0 || pendingSpace.length > 0 || pendingLearningEventCountRef.current > 0 || learningEventRecoveryPending || await learningEventSyncRepository.getPendingCount(session.phoneNumber) > 0 || await mutationQueueRepository.hasPendingCheckIn(session.phoneNumber, todayKey)) {
        throw new Error('还有记录等待同步，请联网同步后再切换。');
      }
      const nextSession = await learningSessionRepository.loadSession(authenticatedRuntimeContext, nextTrack);
      const hydration = await loadAuthenticatedRuntimeHydration(session, {track: nextTrack, forceFresh: true});
      if (getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) !== scopeKey || accountDeletionOriginRef.current !== null || pendingAccountLogoutCleanupRef.current !== null) return;
      if (hydration.accountBootstrapStatus !== 'ready' || hydration.accountBootstrap === null) throw new Error('暂时无法加载，请稍后再切换。');
      const canonical = resolveAccountBootstrapLearningState(hydration.accountBootstrap, nextSession);
      if (nextSession.membershipStage !== null && nextSession.membershipStage !== hydration.membershipState.stage) throw new Error('账号权限尚未更新，请稍后再切换。');
      // Commit the new track only after both canonical reads have succeeded.
      learningTrackRef.current = nextTrack;
      setLearningTrack(nextTrack);
      applyAuthenticatedRuntimeHydration(hydration, {forceFresh: true});
      learningSessionScopeKeyRef.current = scopeKey;
      learningAuthoritySnapshotRef.current = hydration.accountBootstrap;
      setLearningSession(nextSession);
      setMappedAccountBootstrapSnapshot(hydration.accountBootstrap);
      setLearningIndex(0);
      setLearningCurrentResult(null);
      setLearningCompletedResults(canonical.learningResults);
      setReviewCompletedResults(canonical.reviewResults);
      const phase = nextSession.serverSelection?.phase ?? 'learning';
      setLearningPhase(phase);
      setReviewSessionCards(phase === 'review' ? nextSession.cards : []);
      setLearningCardState(nextSession.cards[0] ? createTrackedLearningAttemptState(nextSession.cards[0]) : null);
      setLearningRoundContinueError(null);
      setLearningBootstrapError(null);
      setLearningBootstrapStatus('ready');
      setSpaceScreen('overview');
    } catch (error) {
      if (getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) === scopeKey) {
        if (isRemoteAuthorizationError(error)) await clearOriginSessionAfterAuthorizationError(error, scopeKey, session.phoneNumber);
        else setTrackSwitchError(getUserFacingErrorMessage(error, '切换失败，当前考试和记录已保留。'));
      }
    } finally {
      trackSwitchInFlight.current = false;
      setTrackSwitchPending(false);
    }
  };

  const content = route.key === 'mine' ? (
    <MineSurface
      learningTrack={learningTrack}
      onSwitchTrack={authRepositoryConfig.mode === 'remote' && runtimeAccountBootstrapMode === 'remote' ? nextTrack => void switchLearningTrack(nextTrack) : undefined}
      trackSwitchPending={trackSwitchPending || !canWriteAccountState || learningAdvancePending || learningRoundContinuePending}
      trackSwitchError={trackSwitchError}
      accountDeletionAvailable={accountDeletionRepository !== null}
      authMode={authRepositoryConfig.mode}
      authState={authState}
      deviceClass={deviceClass}
      handlers={authHandlers}
      membershipError={membershipError}
      membershipGate={membershipGate}
      membershipHandlers={membershipHandlers}
      membershipPendingAction={membershipPendingAction}
      purchaseAvailable={clientPurchaseAvailable}
      membershipRepositoryMode={runtimeMembershipRepositoryMode}
      membershipState={membershipState}
      onOpenAccountDeletion={openAccountDeletionConfirmation}
      palette={learningPalette}
      learningStateSyncState={learningStateSyncState}
      progressSyncState={progressSyncState}
    />
  ) : route.key === 'learning' && learningBootstrapStatus !== 'ready' ? (
    <LearningBootstrapSurface
      error={
        learningBootstrapStatus === 'error' ? learningBootstrapError : null
      }
      onOpenUpdate={authHandlers.onOpenUpdate}
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
    !isServerSelectionSleeping &&
    currentLearningCard !== null &&
    learningCardState !== null &&
    learningCurrentResult !== null ? (
    <LearningResultDetailSurface
      advanceState={learningAdvanceState}
      card={currentLearningCard}
      cardState={learningCardState}
      currentIndex={presentedIndex}
      isLastCard={isLocalLearning && learningIndex + 1 >= localGroup.end}
      onAdvanceCard={() => routeMotion.perform('advance', learningHandlers.onAdvanceCard)}
      onBackToPractice={() => setLearningScreen('practice')}
      palette={palette}
      phase={learningPhase}
      result={learningCurrentResult}
      sessionCardCount={presentedCards.length}
      sessionLabel={formatLearningSessionDisplayLabel(learningPhase)}
    />
  ) : route.key === 'learning' ? (
    <LearningSurface
      advanceState={learningAdvanceState}
      audioAttemptId={learningAudioAttemptId}
      showCardProgress={learningSession?.schedulingMode !== 'server'}
      allowBundledAudio={learningSession?.schedulingMode === 'local' && learningSession.sourceId === 'bundled-card-make-v1'}
      completedResults={presentedResults}
      contentManifest={learningSession?.contentManifest ?? null}
      refreshAudioDownload={refreshLearningAudioDownload}
      currentCard={isServerSelectionSleeping || (isLocalLearning && localBatchComplete) ? null : currentLearningCard}
      currentCardState={isServerSelectionSleeping ? null : learningCardState}
      emptySession={learningSession?.schedulingMode === 'server' ? {
        nextDueAt: learningSession.nextDueAt,
        pendingSleep: isServerSelectionSleeping,
        pendingSync: pendingLearningEventCount > 0 || learningEventRecoveryPending,
        onRefresh: retryEmptyLearningSession,
        onOpenSpace: () => handleSelectRoute('space'),
      } : null}
      currentIndex={presentedIndex}
      currentResult={learningCurrentResult}
      phase={learningPhase}
      onAdvanceCard={learningHandlers.onAdvanceCard}
      onFlip={learningHandlers.onFlip}
      onOpenResultDetail={() => setLearningScreen('result_detail')}
      onRestartDeck={learningHandlers.onRestartDeck}
      onContinueLocalBatch={isLocalLearning && localBatchComplete && localGroup.hasMore ? () => setLocalBatchComplete(false) : undefined}
      resumeLocalLearning={isLocalLearning && learningPhase === 'review' && resumeLearningIndex < visibleLearningCards.length}
      onContinueRound={learningHandlers.onContinueRound}
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
      roundCompletion={
        currentRoundCompletion && currentRoundSpaceCard
          ? {
              completedCount: currentRoundCompletion.completedCount,
              reviewCardCount: currentRoundCompletion.reviewCardIds.length,
              spaceCard: currentRoundSpaceCard,
            }
          : null
      }
      roundContinueError={learningRoundContinueError}
      roundContinuePending={learningRoundContinuePending}
      sessionCards={presentedCards}
      sessionLabel={formatLearningSessionDisplayLabel(learningPhase)}
    />
  ) : route.key === 'space' ? (
    <SpaceSurface
      cardStateById={spaceCardStateById}
      currentLearningCard={activeLearningContextCard}
      pendingReviewIds={pendingSpaceReviewIds}
      deviceClass={deviceClass}
      onBackToOverview={() => setSpaceScreen('overview')}
      onOpenCardList={() => setSpaceScreen('card_list')}
      onReturnToLearning={() => handleSelectRoute('learning')}
      onToggleFavoriteTag={spaceHandlers.onToggleFavoriteTag}
      onToggleSleepState={spaceHandlers.onToggleSleepState}
      palette={palette}
      screen={spaceScreen}
      spaceCards={spaceSurfaceCards}
      spaceGateRail={spaceGateRail}
      spaceStatusRail={spaceStatusRail}
      spaceSyncRail={spaceSyncRail}
      usesAccessibilityLayout={usesAccessibilityLayout}
    />
  ) : route.key === 'statistics' ? (
    <StatisticsSurface
      canCheckInToday={canCheckInToday}
      cumulativeLearnedCount={runtimeAccountBootstrapMode === 'remote' && mappedAccountBootstrapSnapshot !== null && learningSession !== null && mappedAccountBootstrapSnapshot.content.version === learningSession.contentVersion ? catalogResults.length : undefined}
      deviceClass={deviceClass}
      hasCheckedInToday={hasCheckedInToday}
      learningCompletedCount={dailyProgressSnapshot.learningCompletedCount}
      onCheckIn={statisticsHandlers.onCheckIn}
      onGoToLearning={openLearningRoute}
      onStartReview={startReviewFromStatistics}
      palette={palette}
      pendingReviewCount={dailyProgressSnapshot.pendingReviewCount}
      reviewCompletedCount={dailyProgressSnapshot.reviewCompletedCount}
      syncStatusDetail={progressSyncState.detail}
      syncStatusLabel={progressSyncState.label}
    />
  ) : null;
  const contentWithLearningNotice = route.key === 'learning' &&
    rejectedLearningNotice?.sessionScopeKey === activeLearningNoticeScope &&
    rejectedLearningNotice.count > 0 ? (
      <>
        <Text accessibilityLiveRegion="polite" testID="learning-rejected-result-notice"
          style={[styles.learningRecoveryNotice, {color: palette.textMuted}]}>
          {learningBootstrapStatus === 'ready' && accountBootstrapHydrationSettled
            ? '这次结果未计入，已更新学习安排。'
            : learningBootstrapStatus === 'error'
            ? '这次结果未计入，请重试更新学习安排。'
            : '这次结果未计入，正在更新学习安排。'}
        </Text>
        {content}
      </>
    ) : content;
  const isAccountDeletionSheetVisible =
    !accountDeletionSheetDismissed &&
    (accountDeletionState === 'confirmation' ||
      accountDeletionState === 'submitting' ||
      accountDeletionState === 'recoverable_unknown');

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <StatusBar
        backgroundColor={palette.background}
        barStyle="dark-content"
        translucent={false}
      />
      <AppCanvasBackdrop palette={palette} />
      <View
        accessibilityElementsHidden={isAccountDeletionSheetVisible}
        importantForAccessibility={
          isAccountDeletionSheetVisible ? 'no-hide-descendants' : 'auto'
        }
        style={styles.safeAreaBody}
      >
        {accountDeletionState === 'accepted' ? (
          <AccountDeletionAcceptedSurface
            onReturnToVerification={() => {
              setAccountDeletionState('closed');
              startTransition(() => {
                setActiveRoute('learning');
                setLearningScreen('practice');
                setSpaceScreen('overview');
              });
            }}
            palette={palette}
          />
        ) : accountDeletionState === 'cleanup_required' ||
          accountDeletionState === 'cleanup_retrying' ? (
          <AccountDeletionCleanupSurface
            onRetry={() => {
              completeAcceptedAccountDeletionCleanup().catch(
                () => undefined,
              );
            }}
            palette={palette}
            pending={accountDeletionState === 'cleanup_retrying'}
            purpose={acceptedAccountDeletionCleanupRef.current?.registrationReady ? 'registration' : 'deletion'}
          />
        ) : accountLogoutState !== 'idle' ? (
          <AccountDeletionCleanupSurface
            onRetry={() => {
              if (pendingAccountLogoutCleanupRef.current !== null) {
                clearAuthenticatedSession().catch(() =>
                  setAccountLogoutState('cleanup_required'),
                );
              } else {
                setAccountLogoutState('cleanup_retrying');
                setAccountRecoveryRetryGeneration(current => current + 1);
              }
            }}
            palette={palette}
            pending={accountLogoutState === 'cleanup_retrying'}
            purpose="logout"
          />
        ) : accountDeletionState === 'recoverable_unknown' && accountDeletionSheetDismissed ? (
          <AccountDeletionCleanupSurface
            onRetry={() => setAccountDeletionSheetDismissed(false)}
            onQueryStatus={deletionRecoverySnapshot === null ? undefined : switchUnknownDeletionToSmsRecovery}
            palette={palette}
            pending={false}
            purpose="deletion_unknown"
          />
        ) : deletionRecoveryReadBlocked || !persistenceHydrated ||
          (deletionRecoverySnapshot !== null && accountDeletionOriginRef.current === null) ? (
          <AccountDeletionRecoverySurface
            accepted={deletionRecoverySnapshot?.state.phase === 'accepted'}
            busy={!persistenceHydrated ? 'checking' : deletionRecoveryBusy}
            error={deletionRecoveryError}
            hasChallenge={deletionRecoveryChallenge !== null}
            onChangeCode={code => setDeletionRecoveryCode(code.replace(/\D/g, '').slice(0, 6))}
            onRequestCode={() => queryAccountDeletionRecovery(false)}
            onRetryLoad={() => {
              setDeletionRecoveryBusy('checking');
              setAccountRecoveryRetryGeneration(current => current + 1);
            }}
            onVerifyCode={() => queryAccountDeletionRecovery(true)}
            palette={palette}
            phoneNumber={deletionRecoverySnapshot?.state.phoneNumber ?? null}
            resendAvailableAt={deletionRecoveryResendAt}
            smsCode={deletionRecoveryCode}
          />
        ) : !isAuthenticated ? (
          <View style={styles.standaloneAuthRoot} testID="standalone-auth-root">
            <AuthGate
              authMode={authRepositoryConfig.mode}
              authState={authState}
              handlers={authHandlers}
              palette={palette}
              route={ROUTES[0]}
              standalone
            />
          </View>
        ) : deviceClass === 'tablet' ? (
          <TabletShell
            activeRoute={activeRoute}
            authState={authState}
            content={<Animated.View style={[{flex: 1}, routeMotion.cardStyle]}>{contentWithLearningNotice}</Animated.View>}
            onSelectRoute={handleSelectRoute}
            palette={palette}
            route={route}
          />
        ) : (
          <PhoneShell
            activeRoute={activeRoute}
            track={learningTrack}
            readingResetKey={`${currentLearningCard?.card_id ?? 'complete'}:${learningPhase}:${learningScreen}:${Boolean(learningCurrentResult)}:${Boolean(learningCardState?.isFlipped)}`}
            authState={authState}
            content={<Animated.View style={[{flex: 1}, routeMotion.cardStyle]}>{contentWithLearningNotice}</Animated.View>}
            onSelectRoute={handleSelectRoute}
            palette={palette}
            route={route}
          />
        )}
      </View>
      <AccountDeletionSheet
        onCancel={closeAccountDeletionSheet}
        onSubmit={submitAccountDeletion}
        palette={palette}
        preparationFailed={accountDeletionPreparationFailed}
        state={accountDeletionSheetDismissed ? 'closed' : accountDeletionState}
      />
    </SafeAreaView>
  );
}

function LearningBootstrapSurface({
  error,
  onOpenUpdate,
  onRetry,
  palette,
  status,
}: {
  error: string | null;
  onOpenUpdate: () => void;
  onRetry: () => void;
  palette: Palette;
  status: LearningBootstrapStatus;
}) {
  const isLoading = status === 'idle' || status === 'loading';
  const isClientUpdateRequired = error === CLIENT_UPDATE_REQUIRED_COPY;

  return (
    <View style={styles.stateScreen}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          加载卡片
        </Text>
        <Text
          style={[styles.heroTitle, { color: palette.text }]}
          testID={isClientUpdateRequired ? 'auth-error-title' : undefined}
        >
          {isLoading
            ? '正在加载卡片'
            : isClientUpdateRequired
            ? '需要安装最新版本'
            : '卡片加载失败'}
        </Text>
        <Text
          style={[styles.heroSummary, { color: palette.textMuted }]}
          testID={isClientUpdateRequired ? 'auth-error-detail' : undefined}
        >
          {isLoading
            ? '正在加载本轮卡片。'
            : isClientUpdateRequired
            ? '登录状态已保留，安装最新版本后可直接继续。'
            : '卡片加载失败，请重试。'}
        </Text>
      </View>
      <InfoCard
        palette={palette}
        title={isLoading ? '加载中' : '无法开始学习'}
        items={
          isLoading
            ? ['正在加载本轮卡片。', '加载完成后自动开始。']
            : [
                error ?? '卡片加载失败。',
                '当前没有答题记录。',
                '请重新加载。',
              ]
        }
      />
      {!isLoading ? (
        <Pressable
          onPress={isClientUpdateRequired ? onOpenUpdate : onRetry}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID={
            isClientUpdateRequired
              ? 'auth-update-required-button'
              : 'learning-bootstrap-retry-button'
          }
        >
          <Text
            style={[
              styles.primaryButtonLabel,
              { color: palette.primaryActionText },
            ]}
          >
            {isClientUpdateRequired ? '获取更新' : '重新加载'}
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
            卡片加载后即可开始。
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
          所有卡片都在休眠中
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {canRecoverInPlace
            ? '恢复一张卡后即可继续学习。'
            : '到空间恢复一张卡后即可继续学习。'}
        </Text>
      </View>
      <InfoCard
        palette={palette}
        title="如何继续"
        items={
          canRecoverInPlace
            ? [
                '休眠中的卡不会出现在学习中。',
                '恢复一张卡后即可继续。',
                recoverableCard
                  ? `下一张可恢复卡：${recoverableCard.front.prompt}`
                  : '当前没有可恢复卡。',
              ]
            : [
                '休眠中的卡不会出现在学习中。',
                '在空间中恢复一张卡。',
                '返回学习继续。',
              ]
        }
      />
      {canRecoverInPlace ? (
        <Pressable
          onPress={onRecoverCard}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID="learning-recover-sleeping-card-button"
        >
          <Text
            style={[
              styles.primaryButtonLabel,
              { color: palette.primaryActionText },
            ]}
          >
            恢复一张可学习卡
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onGoToSpace}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID="learning-go-space-button"
        >
          <Text
            style={[
              styles.primaryButtonLabel,
              { color: palette.primaryActionText },
            ]}
          >
            去空间管理休眠卡
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function AccountDeletionCleanupSurface({
  onRetry,
  onQueryStatus,
  palette,
  pending,
  purpose = 'deletion',
}: {
  onRetry: () => void;
  onQueryStatus?: () => void;
  palette: Palette;
  pending: boolean;
  purpose?: 'deletion' | 'logout' | 'deletion_unknown' | 'registration';
}) {
  const headingRef = useRef<React.ElementRef<typeof Text>>(null);
  const title = purpose === 'registration'
    ? pending ? '正在准备重新登录' : '本机记录还未清理完成'
    : purpose === 'logout'
    ? pending ? '正在退出登录' : '退出尚未完成'
    : purpose === 'deletion_unknown'
    ? '尚未确认注销结果'
    : '注销申请已收到';
  const summary = purpose === 'registration'
    ? '没有待处理的注销申请。清理本机的旧登录记录后，即可重新登录。'
    : purpose === 'logout'
    ? '本机记录还未清理完成，请重试退出后再登录。'
    : purpose === 'deletion_unknown'
    ? '注销结果尚未确认，请先查询进度，暂时不能继续学习。'
    : '注销申请已收到，请重试清理本机记录。';
  const testPrefix = purpose === 'deletion' || purpose === 'registration'
    ? 'account-deletion-cleanup'
    : purpose === 'logout'
    ? 'account-logout-cleanup'
    : 'account-deletion-unknown';

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      purpose !== 'deletion'
        ? `${title}。${summary}`
        : pending
        ? '注销申请已收到，正在清理本机记录。'
        : '注销申请已收到，本机记录清理失败，请重试。',
    );
    const headingHandle = findNodeHandle(headingRef.current);
    if (headingHandle !== null) {
      AccessibilityInfo.setAccessibilityFocus(headingHandle);
    }
  }, [pending, purpose, summary, title]);

  return (
    <ScrollView
      accessibilityLiveRegion="assertive"
      contentContainerStyle={styles.accountDeletionAcceptedScreen}
      showsVerticalScrollIndicator={false}
      style={styles.accountDeletionAcceptedScroll}
      testID={`${testPrefix}-screen`}
    >
      <View
        style={[
          styles.accountDeletionAcceptedCard,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <View
          style={[
            styles.accountDeletionAcceptedMark,
            { backgroundColor: hexToRgba(palette.warning, 0.12) },
          ]}
        >
          <Text
            style={[
              styles.accountDeletionAcceptedMarkLabel,
              { color: palette.warning },
            ]}
          >
            !
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          ref={headingRef}
          style={[styles.accountDeletionAcceptedTitle, { color: palette.text }]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.accountDeletionAcceptedSummary,
            { color: palette.textMuted },
          ]}
        >
          {summary}
        </Text>
        <View
          style={[
            styles.accountDeletionBoundaryNote,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <Text
            style={[
              styles.accountDeletionBoundaryText,
              { color: palette.textMuted },
            ]}
          >
            {purpose === 'logout'
              ? '退出登录不会注销账号。'
              : purpose === 'deletion_unknown'
              ? '尚未确认是否收到注销申请，请查询后再继续。'
              : '注销还在处理中，请等待账号数据清理完成。'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={onRetry}
          style={[
            styles.accountDeletionPrimaryButton,
            {
              backgroundColor: pending
                ? hexToRgba(palette.accent, 0.1)
                : palette.accent,
            },
          ]}
          testID={`${testPrefix}-retry-button`}
        >
          <Text
            style={[
              styles.accountDeletionPrimaryButtonLabel,
              {
                color: pending
                  ? palette.accent
                  : palette.primaryActionText,
              },
            ]}
          >
            {purpose === 'deletion_unknown'
              ? '查询注销进度'
              : pending ? '正在清理本机数据' : '重试退出'}
          </Text>
        </Pressable>
        {onQueryStatus ? (
          <Pressable accessibilityRole="button" disabled={pending}
            onPress={onQueryStatus}
            style={[styles.accountDeletionPrimaryButton, {backgroundColor: palette.panelStrong}]}
            testID="account-deletion-unknown-sms-button">
            <Text style={[styles.accountDeletionPrimaryButtonLabel, {color: palette.text}]}>
              用短信查询状态
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function AccountDeletionAcceptedSurface({
  onReturnToVerification,
  palette,
}: {
  onReturnToVerification: () => void;
  palette: Palette;
}) {
  const headingRef = useRef<React.ElementRef<typeof Text>>(null);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      '注销申请已提交。当前账户已退出，账户数据仍在继续清理。',
    );
    const headingHandle = findNodeHandle(headingRef.current);
    if (headingHandle !== null) {
      AccessibilityInfo.setAccessibilityFocus(headingHandle);
    }
  }, []);

  return (
    <ScrollView
      accessibilityLiveRegion="polite"
      contentContainerStyle={styles.accountDeletionAcceptedScreen}
      showsVerticalScrollIndicator={false}
      style={styles.accountDeletionAcceptedScroll}
      testID="account-deletion-accepted-screen"
    >
      <View
        style={[
          styles.accountDeletionAcceptedCard,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <View
          style={[
            styles.accountDeletionAcceptedMark,
            { backgroundColor: hexToRgba(palette.success, 0.12) },
          ]}
        >
          <Text
            style={[
              styles.accountDeletionAcceptedMarkLabel,
              { color: palette.success },
            ]}
          >
            ✓
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          ref={headingRef}
          style={[styles.accountDeletionAcceptedTitle, { color: palette.text }]}
        >
          注销申请已提交
        </Text>
        <Text
          style={[
            styles.accountDeletionAcceptedSummary,
            { color: palette.textMuted },
          ]}
        >
          你已退出登录。账号数据清理完成前，暂时不能用这个手机号重新登录。
        </Text>
        <View
          style={[
            styles.accountDeletionBoundaryNote,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
          testID="account-deletion-boundary-note"
        >
          <Text
            style={[
              styles.accountDeletionBoundaryText,
              { color: palette.textMuted },
            ]}
          >
            注销仍在处理中。
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onReturnToVerification}
          style={[
            styles.accountDeletionPrimaryButton,
            { backgroundColor: palette.accent },
          ]}
          testID="account-deletion-return-to-verification"
        >
          <Text
            style={[
              styles.accountDeletionPrimaryButtonLabel,
              { color: palette.primaryActionText },
            ]}
          >
            返回登录
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AccountDeletionSheet({
  onCancel,
  onSubmit,
  palette,
  preparationFailed,
  state,
}: {
  onCancel: () => void;
  onSubmit: () => Promise<void>;
  palette: Palette;
  preparationFailed: boolean;
  state: AccountDeletionPresentationState;
}) {
  const visible =
    state === 'confirmation' ||
    state === 'submitting' ||
    state === 'recoverable_unknown';

  if (!visible) {
    return null;
  }

  const isConfirmation = state === 'confirmation';
  const isSubmitting = state === 'submitting';

  return (
    <Modal
      animationType="fade"
      onRequestClose={isSubmitting ? () => undefined : onCancel}
      statusBarTranslucent
      transparent
      visible
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        style={styles.accountDeletionModal}
        testID="account-deletion-modal"
      >
        <ScrollView
          contentContainerStyle={styles.accountDeletionModalScrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.accountDeletionModalScroll}
        >
          <View
            style={[
              styles.accountDeletionSheet,
              { backgroundColor: palette.panel, borderColor: palette.border },
            ]}
            testID={`account-deletion-${state}`}
          >
            <View
              style={[
                styles.accountDeletionSheetHandle,
                { backgroundColor: palette.border },
              ]}
            />
            <Text
              style={[
                styles.accountDeletionSheetKicker,
                { color: palette.danger },
              ]}
            >
              注销账号
            </Text>
            <Text
              accessibilityRole="header"
              style={[
                styles.accountDeletionSheetTitle,
                { color: palette.text },
              ]}
            >
              {isConfirmation
                ? '确认注销账号？'
                : isSubmitting
                ? '正在提交注销申请'
                : preparationFailed ? '注销申请尚未发出' : '还没有收到确认'}
            </Text>
            <Text
              style={[
                styles.accountDeletionSheetSummary,
                { color: palette.textMuted },
              ]}
            >
              {isConfirmation
                ? '注销申请受理后，将退出登录并删除学习记录、收藏、休眠设置和会员信息。'
                : isSubmitting
                ? '请稍候，正在提交注销申请。'
                : preparationFailed
                ? '暂时无法提交注销申请，请重试。申请尚未发出。'
                : '还没收到注销结果，请重试查询。'}
            </Text>

            {isConfirmation ? (
            <View
              style={[
                styles.accountDeletionConsequence,
                {
                  backgroundColor: hexToRgba(palette.danger, 0.06),
                  borderColor: hexToRgba(palette.danger, 0.14),
                },
              ]}
              testID="account-deletion-consequences"
            >
              {[
                '注销申请无法撤销',
                '清理完成前不能再次登录',
                '注销完成后可重新注册，原有记录无法恢复',
              ].map(item => (
                <Text
                  key={item}
                  style={[
                    styles.accountDeletionConsequenceText,
                    { color: palette.text },
                  ]}
                >
                  • {item}
                </Text>
              ))}
            </View>
            ) : (
            <View
              accessibilityLiveRegion={isSubmitting ? 'polite' : 'assertive'}
              style={[
                styles.accountDeletionStateCard,
                {
                  backgroundColor: isSubmitting
                    ? palette.panelStrong
                    : hexToRgba(palette.warning, 0.1),
                  borderColor: isSubmitting
                    ? palette.border
                    : hexToRgba(palette.warning, 0.24),
                },
              ]}
              testID="account-deletion-state-card"
            >
              <Text
                style={[
                  styles.accountDeletionStateMark,
                  { color: isSubmitting ? palette.accent : palette.warning },
                ]}
              >
                {isSubmitting ? '…' : '!'}
              </Text>
              <View style={styles.accountDeletionStateCopy}>
                <Text
                  style={[
                    styles.accountDeletionStateTitle,
                    { color: palette.text },
                  ]}
                >
                  {isSubmitting ? '正在确认' : preparationFailed ? '尚未发送' : '结果尚未确认'}
                </Text>
                <Text
                  style={[
                    styles.accountDeletionStateDetail,
                    { color: palette.textMuted },
                  ]}
                >
                  {isSubmitting
                    ? '注销需要一些时间，请等待结果。'
                    : preparationFailed ? '请重试提交注销申请。' : '请先查询注销进度。'}
                </Text>
              </View>
            </View>
            )}

            {isSubmitting ? (
            <Pressable
              accessibilityState={{disabled: true}}
              disabled
              style={[
                styles.accountDeletionPrimaryButton,
                { backgroundColor: hexToRgba(palette.accent, 0.1) },
              ]}
              testID="account-deletion-submitting-button"
            >
              <Text
                style={[
                  styles.accountDeletionPrimaryButtonLabel,
                  { color: palette.accent },
                ]}
              >
                正在提交
              </Text>
            </Pressable>
            ) : (
            <View style={styles.accountDeletionSheetActions}>
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={[
                  styles.accountDeletionSecondaryButton,
                  {
                    backgroundColor: palette.panelStrong,
                    borderColor: palette.border,
                  },
                ]}
                testID="account-deletion-cancel-button"
              >
                <Text
                  style={[
                    styles.accountDeletionSecondaryButtonLabel,
                    { color: palette.text },
                  ]}
                >
                  {isConfirmation ? '暂不注销' : '返回我的'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onSubmit().catch(() => undefined);
                }}
                style={[
                  styles.accountDeletionDangerButton,
                  { backgroundColor: palette.danger },
                ]}
                testID="account-deletion-submit-button"
              >
                <Text
                  style={[
                    styles.accountDeletionDangerButtonLabel,
                    { color: palette.panel },
                  ]}
                >
                  {isConfirmation ? '确认注销账号' : '重新确认'}
                </Text>
              </Pressable>
            </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function AppCanvasBackdrop({palette}: {palette: Palette}) {
  return <View pointerEvents="none" style={[styles.appCanvasBackdrop, {backgroundColor:palette.background}]} />;
}

function PhoneShell({
  activeRoute,
  track,
  readingResetKey,
  authState,
  content,
  onSelectRoute,
  palette,
  route,
}: {
  activeRoute: RouteKey;
  track: LearningTrack;
  readingResetKey: string;
  authState: AuthState;
  content: React.ReactNode;
  onSelectRoute: (route: RouteKey) => void;
  palette: Palette;
  route: ShellRoute;
}) {
  const { fontScale } = useWindowDimensions();
  const usesAccessibilityLayout = fontScale >= 1.3;
  const readingScroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (activeRoute === 'learning') readingScroll.current?.scrollTo({y: 0, animated: false});
  }, [activeRoute, readingResetKey]);

  return (
    <View style={styles.shellRoot}>
      <PhoneTopBar
        track={track}
        authState={authState}
        onOpenAccount={() => onSelectRoute('mine')}
        palette={palette}
        route={route}
      />
      <View style={styles.shellContent}>
        {usesAccessibilityLayout ? (
          <ScrollView
            ref={readingScroll}
            contentContainerStyle={styles.shellAccessibleContent}
            key={activeRoute}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID="phone-accessibility-scroll"
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </View>
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
                accessibilityState={{selected: isActive}}
                key={item.key}
                onPress={() => {
                  startTransition(() => onSelectRoute(item.key));
                }}
                style={[
                  styles.phoneTabButton,
                  isActive
                    ? [
                        styles.phoneTabButtonActive,
                        {
                        backgroundColor: palette.activeSurface,
                        shadowColor: palette.activeSurface,
                        },
                      ]
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

function PhoneTopBar({
  authState,
  track,
  onOpenAccount,
  palette,
  route,
}: {
  authState: AuthState;
  track: LearningTrack;
  onOpenAccount: () => void;
  palette: Palette;
  route: ShellRoute;
}) {
  const accountChipCopy = getShellAccountChipCopy(authState);
  const courseLabel = track === 'cet6' ? 'CET 6' : 'CET 4';

  return (
    <View
      style={[
        styles.phoneTopBar,
        route.key === 'learning' ? styles.phoneTopBarLearning : null,
        { backgroundColor: 'transparent', borderColor: 'transparent' },
      ]}
    >
      <View style={styles.phoneBrandLockup}>
        <StudioMark />
        <View style={styles.phoneTopCopy}>
          <Text
            style={[
              styles.phoneTopTitle,
              route.key === 'learning' ? styles.phoneTopTitleLearning : null,
              { color: palette.text },
            ]}
          >
            软书
          </Text>
        </View>
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
        <Text style={[styles.phoneTopMeta,{color:palette.textMuted}]}>{courseLabel}</Text>
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
  const { width } = useWindowDimensions();
  const isNarrowTablet = width < 820;

  return (
    <View
      style={[
        styles.tabletRoot,
        isNarrowTablet ? styles.tabletRootNarrow : null,
      ]}
    >
      <View
        style={[
          styles.sidebar,
          isNarrowTablet ? styles.sidebarNarrow : null,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <StudioMark />
          <Text style={[styles.brandTitle, { color: palette.text }]}>软书</Text>
        </View>
        <Text style={[styles.brandSummary, { color: palette.textMuted }]}>
          继续学习，或查看卡片、进度和账号。
        </Text>
        <AuthStatusBadge authState={authState} palette={palette} />
        <View style={styles.sidebarNav}>
          {ROUTES.map(item => {
            const isActive = item.key === activeRoute;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{selected: isActive}}
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
}: {
  authState: AuthState;
  onOpenAccount: () => void;
  palette: Palette;
  route: ShellRoute;
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
            ? '继续今天的学习。'
            : route.key === 'space'
            ? '查看卡片、收藏和休眠设置。'
            : route.key === 'statistics'
            ? '查看今天的学习和复习记录。'
            : '管理账号和会员。'}
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
  authMode = 'remote',
  authState,
  cardTestID,
  embedded = false,
  handlers,
  palette,
  route,
  standalone = false,
}: {
  authMode?: 'local' | 'remote';
  authState: AuthState;
  cardTestID?: string;
  embedded?: boolean;
  handlers: AuthHandlers;
  palette: Palette;
  route: ShellRoute;
  standalone?: boolean;
}) {
  if (authMode === 'local') {
    return <View style={[styles.authPanel, {backgroundColor: palette.panel}]} testID="local-learning-entry">
      <Text style={[styles.authGateTitle, {color: palette.text}]}>在这台设备上学习</Text>
      <Text style={[styles.authGateSummary, {color: palette.textMuted}]}>无需手机号或验证码。</Text>
      {authState.error ? <Text accessibilityLiveRegion="polite" style={{color: palette.danger}}>{authState.error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={authState.pendingAction !== null} onPress={handlers.onStartLocal}
        style={[styles.primaryButton, {backgroundColor: palette.accent}]} testID="local-start-learning-button">
        <Text style={[styles.primaryButtonLabel, {color: palette.primaryActionText}]}>{authState.pendingAction !== null ? '正在准备…' : '开始学习'}</Text>
      </Pressable>
    </View>;
  }
  const hasSentCode = authState.stage === 'code_sent';

  const isMineAccountGate = embedded && route.key === 'mine';
  const isRouteObjectGate = !standalone && route.key !== 'mine';
  const isCompactAuthGate = isMineAccountGate || isRouteObjectGate;
  const authGateContent = standalone
    ? {
        continuityPill: '学习',
        eyebrow: '软书四六级',
        gateSummary: hasSentCode
          ? '输入短信中的验证码。'
          : '登录后同步学习进度。',
        gateTitle: hasSentCode ? '输入验证码' : '登录',
        retainedSummary: '',
        retainedTitle: '',
        returnTarget: '学习',
      }
    : route.key === 'space'
      ? {
          continuityPill: '空间',
          eyebrow: '空间',
          gateSummary: '登录后同步书架和卡片位置。',
          gateTitle: '登录后查看空间',
          retainedSummary: '登录后会恢复上次的位置。',
          retainedTitle: '保存你的卡片位置',
          returnTarget: '空间',
        }
      : route.key === 'statistics'
      ? {
          continuityPill: '统计',
          eyebrow: '今日进展',
          gateSummary: '登录后同步今天的学习记录。',
          gateTitle: '登录后查看进度',
          retainedSummary: '登录后会恢复今天的记录。',
          retainedTitle: '保存今天的进度',
          returnTarget: '今日进展',
        }
      : route.key === 'mine'
      ? {
          continuityPill: '账户',
          eyebrow: '学习账户',
          gateSummary: '登录后同步学习进度和会员信息。',
          gateTitle: '登录',
          retainedSummary: hasSentCode
            ? '输入验证码即可登录。'
            : '用手机号登录。',
          retainedTitle: '保存学习进度',
          returnTarget: '我的',
        }
      : {
          continuityPill: '学习',
          eyebrow: '软书四六级',
          gateSummary: '登录后同步学习进度。',
          gateTitle: '登录',
          retainedSummary: '登录后继续上次的学习。',
          retainedTitle: '保存学习进度',
          returnTarget: '学习',
        };

  const gateTitle = authGateContent.gateTitle;
  const gateSummary = authGateContent.gateSummary;

  return (
    <View
      style={[
        styles.authGateScreen,
        embedded ? styles.authGateScreenEmbedded : null,
        isRouteObjectGate ? styles.authGateScreenRouteObject : null,
      ]}
      testID={
        standalone
          ? 'standalone-auth-screen'
          : isRouteObjectGate
          ? 'auth-route-object-screen'
          : undefined
      }
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
          (standalone
            ? 'standalone-auth-card'
            : isRouteObjectGate
            ? 'auth-route-object-card'
            : undefined)
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
                      {hasSentCode ? '验证码' : '手机'}
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
                  {gateTitle}
                </Text>
                <Text
                  onPress={Keyboard.dismiss}
                  style={[styles.authGateSummary, { color: palette.textMuted }]}
                  testID="auth-gate-keyboard-dismiss-target"
                >
                  {gateSummary}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.authHeaderMeta}>
                <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
                  {authGateContent.eyebrow}
                </Text>
                {!standalone ? (
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
                      {hasSentCode ? '输入验证码' : '短信登录'}
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
                ) : null}
              </View>
              <Text
                style={[
                  styles.authGateTitle,
                  isRouteObjectGate ? styles.authGateTitleRouteObject : null,
                  { color: palette.text },
                ]}
                testID="auth-gate-title"
              >
                {gateTitle}
              </Text>
              <Text
                onPress={Keyboard.dismiss}
                style={[styles.authGateSummary, { color: palette.textMuted }]}
                testID="auth-gate-keyboard-dismiss-target"
              >
                {gateSummary}
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
          {!standalone ? (
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
          ) : null}
          <PhoneSmsPanel
            accountDock={isMineAccountGate}
            authState={authState}
            embedded
            handlers={handlers}
            minimal={standalone}
            palette={palette}
            routeDock={isRouteObjectGate}
            returnTarget={authGateContent.returnTarget}
            title="手机号登录"
            summary="输入手机号获取验证码。"
            successMessage="登录成功。"
          />
        </View>
      </View>
    </View>
  );
}

function MineSurface({
  learningTrack,
  onSwitchTrack,
  trackSwitchPending,
  trackSwitchError,
  accountDeletionAvailable,
  authMode,
  authState,
  deviceClass,
  handlers,
  learningStateSyncState,
  membershipError,
  membershipGate,
  membershipHandlers,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  purchaseAvailable,
  onOpenAccountDeletion,
  palette,
  progressSyncState,
}: {
  learningTrack: LearningTrack;
  onSwitchTrack?: (track: LearningTrack) => void;
  trackSwitchPending: boolean;
  trackSwitchError: string | null;
  accountDeletionAvailable: boolean;
  authMode: 'local' | 'remote';
  authState: AuthState;
  deviceClass: DeviceClass;
  handlers: AuthHandlers;
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
  purchaseAvailable: boolean;
  onOpenAccountDeletion: () => void;
  palette: Palette;
  progressSyncState: ProgressSyncState;
}) {
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();
  const isCompactPhone = isCompactMineViewport(viewportWidth, viewportHeight);
  const isAuthenticated = authState.stage === 'authenticated';
  const hasSentCode = authState.stage === 'code_sent';
  const profileName = isAuthenticated
    ? maskPhoneNumber(authState.phoneNumber)
    : '待验证';
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
  if (!isAuthenticated) {
    return (
      <View
        style={[
          styles.mineScreen,
          deviceClass === 'tablet' ? styles.mineScreenTablet : null,
          isCompactPhone ? styles.mineScreenCompact : null,
        ]}
        testID="mine-surface"
      >
        <AuthGate
          authMode={authMode}
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
    <ScrollView
      style={{flex: 1}}
      contentContainerStyle={[
        styles.mineScreen,
        {flex: 0, flexGrow: 1, paddingBottom: 20},
        deviceClass === 'tablet' ? styles.mineScreenTablet : null,
        isCompactPhone ? styles.mineScreenCompact : null,
      ]}
      testID="mine-surface"
    >
      <View
        style={[
          styles.mineProfilePanel,
          isCompactPhone ? styles.mineProfilePanelCompact : null,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
        testID="mine-profile-card"
      >
        <View
          style={[
            styles.minePassportStack,
            isCompactPhone ? styles.minePassportStackCompact : null,
          ]}
          testID="mine-passport-stack"
        >
          <View style={styles.mineAccountTitleRow}>
            <View style={styles.mineAccountHeaderCopy}>
              <Text
                style={[
                  styles.mineAccountEyebrow,
                  isCompactPhone ? styles.mineAccountEyebrowCompact : null,
                  { color: palette.accent },
                ]}
              >
                我的会员
              </Text>
            </View>
            <View
              style={[
                styles.mineMembershipPill,
                isCompactPhone ? styles.mineMembershipPillCompact : null,
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
          <Text
            style={[
              styles.mineAccountTitle,
              isCompactPhone ? styles.mineAccountTitleCompact : null,
              { color: palette.text },
            ]}
          >
            会员与试用
          </Text>
          <Text
            style={[
              styles.mineAccountSummary,
              isCompactPhone ? styles.mineAccountSummaryCompact : null,
              { color: palette.textMuted },
            ]}
          >
            查看会员状态，管理登录账号。
          </Text>
          <View
            style={[
              styles.mineAccountLedger,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
              },
            ]}
            testID="mine-account-ledger"
          >
            <MineAccountRow
              label={authMode === 'local' ? '学习档案' : '手机号'}
              palette={palette}
              value={profileName}
              valueTestID="mine-profile-phone"
            />
            <MineAccountRow
              label="学习记录"
              palette={palette}
              value={syncDetail}
              valueTestID="mine-profile-sync"
            />
            <MineAccountRow
              label="学习顺序"
              last
              palette={palette}
              value="系统推荐"
              valueTestID="mine-profile-route"
            />
          </View>
        </View>
        {onSwitchTrack ? <View style={{paddingVertical: 16, gap: 12}}>
          <Text accessibilityRole="header" style={{color: palette.text, fontSize: 18, fontWeight: '600'}}>备考科目</Text>
          <View style={{flexDirection: 'row', gap: 12}}>
            {([
              {value: 'cet4', label: '英语四级'},
              {value: 'cet6', label: '英语六级'},
            ] as const).map(({value, label}) => (
              <Pressable
                key={value}
                testID={`mine-track-${value}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{selected: learningTrack === value, disabled: trackSwitchPending}}
                disabled={trackSwitchPending}
                onPress={() => onSwitchTrack(value)}
                style={{flex: 1, padding: 14, borderRadius: 12, borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: learningTrack === value ? palette.accentSoft : palette.panel}}
              >
                <Text style={{color: palette.text, textAlign: 'center', fontWeight: '600'}}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{color: palette.textMuted}}>四六级的学习进度分别保存，切换后可以接着学。</Text>
          {trackSwitchPending ? <Text accessibilityRole="text" style={{color: palette.textMuted}}>正在同步账号…</Text> : null}
          {trackSwitchError ? <Text accessibilityRole="alert" style={{color: palette.text}}>{trackSwitchError}</Text> : null}
        </View> : null}
        <MembershipHostCard
            compact={isCompactPhone}
            deviceClass={deviceClass}
            focusGate={membershipGate}
            handlers={membershipHandlers}
            membershipError={membershipError}
            membershipPendingAction={membershipPendingAction}
            membershipRepositoryMode={membershipRepositoryMode}
            membershipState={membershipState}
            palette={palette}
            purchaseAvailable={purchaseAvailable}
          />
        <View
            style={[
              styles.mineAccountPrivacyCard,
              styles.mineSessionCard,
              isCompactPhone ? styles.mineAccountPrivacyCardCompact : null,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
              },
            ]}
            testID="mine-session-card"
          >
            <View style={styles.mineAccountPrivacyCopy}>
              <Text
                style={[
                  styles.mineAccountPrivacyLabel,
                  {color: palette.text},
                ]}
              >
                当前登录
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.mineAccountPrivacyDetail,
                  {color: palette.textMuted},
                ]}
              >
                退出后可以改用其他手机号
              </Text>
            </View>
            <Pressable
              accessibilityHint="退出当前学习账户并返回登录"
              accessibilityRole="button"
              disabled={authState.pendingAction !== null}
              onPress={() => void handlers.onLogout()}
              style={[
                styles.secondaryButton,
                styles.mineAccountLogoutButton,
                {
                  backgroundColor: palette.panel,
                  borderColor: palette.border,
                },
              ]}
              testID="mine-account-logout-button"
            >
              <Text style={[styles.secondaryButtonLabel, {color: palette.text}]}>
                退出登录
              </Text>
            </Pressable>
          </View>
        {accountDeletionAvailable ? (
            <View
              style={[
                styles.mineAccountPrivacyCard,
                isCompactPhone ? styles.mineAccountPrivacyCardCompact : null,
                {
                  backgroundColor: palette.panelStrong,
                  borderColor: hexToRgba(palette.danger, 0.14),
                },
              ]}
              testID="mine-account-privacy-card"
            >
              <View style={styles.mineAccountPrivacyCopy}>
                <Text
                  style={[
                    styles.mineAccountPrivacyLabel,
                    { color: palette.text },
                  ]}
                >
                  隐私与账户
                </Text>
                {isCompactPhone ? null : (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.mineAccountPrivacyDetail,
                      { color: palette.textMuted },
                    ]}
                  >
                    永久删除需要再次确认
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityHint="打开账户删除后果确认"
                accessibilityRole="button"
                onPress={onOpenAccountDeletion}
                style={[
                  styles.mineAccountDeleteButton,
                  {
                    backgroundColor: hexToRgba(palette.danger, 0.08),
                    borderColor: hexToRgba(palette.danger, 0.18),
                  },
                ]}
                testID="mine-account-delete-button"
              >
                <Text
                  style={[
                    styles.mineAccountDeleteButtonLabel,
                    { color: palette.danger },
                  ]}
                >
                  注销账号
                </Text>
              </Pressable>
            </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function MineAccountRow({
  label,
  last = false,
  palette,
  value,
  valueTestID,
}: {
  label: string;
  last?: boolean;
  palette: Palette;
  value: string;
  valueTestID: string;
}) {
  return (
    <View
      style={[
        styles.mineAccountRow,
        last ? styles.mineAccountRowLast : null,
        { borderColor: palette.border },
      ]}
    >
      <Text style={[styles.mineAccountRowLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.mineAccountRowValue, { color: palette.text }]}
        testID={valueTestID}
      >
        {value}
      </Text>
    </View>
  );
}

function MembershipHostCard({
  compact,
  deviceClass,
  focusGate,
  handlers,
  membershipError,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
  purchaseAvailable,
}: {
  compact: boolean;
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
  purchaseAvailable: boolean;
}) {
  const access = resolveMembershipAccess(membershipState);
  const benefitSummary = [
    { label: '完整卡库', open: access.completeCardLibrary },
    { label: '完整空间', open: access.completePhysicalSpace },
    { label: '智能复习', open: access.completeAlgorithm },
  ];
  const isTrialAvailable = membershipState.stage === 'trial_available';
  const focusCopy =
    focusGate === null
      ? null
      : focusGate === 'review'
      ? '复习需要试用或会员。开通后继续本轮复习。'
      : focusGate === 'space'
      ? '完整空间需要试用或会员。'
      : '完整卡库需要试用或会员。';

  return (
    <View
      style={[
        styles.membershipHostCard,
        compact ? styles.membershipHostCardCompact : null,
        {
          backgroundColor: 'transparent',
          borderColor: hexToRgba(palette.accent, 0.1),
        },
      ]}
      testID="membership-host-card"
    >
      {isTrialAvailable || compact ? null : (
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
            会员功能
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
                免费试用
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
              试用期间可使用全部卡片、空间和复习功能。
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
                  { color: palette.primaryActionText },
                ]}
              >
                {membershipPendingAction === 'start_trial'
                  ? '开通中'
                  : '开始试用'}
              </Text>
            </Pressable>
            {purchaseAvailable ? (
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
                {membershipPendingAction === 'purchase' ? '同步中' : '开通会员'}
              </Text>
              </Pressable>
            ) : (
              <Text
                style={[
                  styles.membershipAccessCompactMeta,
                  styles.membershipOperatorEntitlementCopy,
                  {color: palette.textMuted},
                ]}
                testID="membership-operator-entitlement-copy"
              >
                需要内测资格
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.membershipAccessTrack,
            deviceClass === 'tablet'
              ? styles.membershipAccessTrackTablet
              : null,
            compact ? styles.membershipAccessTrackCompact : null,
          ]}
          testID="membership-access-strip"
        >
          {benefitSummary.map(item => (
            <View
              key={item.label}
              style={[
                styles.membershipAccessStep,
                compact ? styles.membershipAccessStepCompact : null,
                {
                  backgroundColor: palette.panelStrong,
                  borderColor: 'transparent',
                },
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
                {item.open ? '可用' : '不可用'}
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
            {purchaseAvailable ? '续费提醒' : '内测资格'}
          </Text>
          <Text
            style={[styles.membershipSummary, { color: palette.textMuted }]}
          >
            {purchaseAvailable
              ? membershipState.lastExperienceEndedBy === 'premium'
                ? '会员已到期，续费后可继续使用全部卡片和复习功能。'
                : '试用已结束，开通会员可继续使用全部卡片和复习功能。'
                : '获得内测资格后即可使用。'}
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
              收起续费提醒
            </Text>
          </Pressable>
        </View>
      ) : null}
      {membershipPendingAction ? (
        <Text style={[styles.authHint, { color: palette.textMuted }]}>
          {membershipPendingAction === 'start_trial'
            ? '正在开通试用。'
            : membershipPendingAction === 'purchase'
            ? '正在开通会员。'
            : '正在更新。'}
        </Text>
      ) : null}
      {membershipError ? (
        <Text style={[styles.authError, { color: palette.danger }]}>
          {membershipError}
        </Text>
      ) : null}
      {isTrialAvailable ? null : (
        <MembershipActionGroup
          compact={compact}
          handlers={handlers}
          membershipPendingAction={membershipPendingAction}
          membershipRepositoryMode={membershipRepositoryMode}
          membershipState={membershipState}
          palette={palette}
          purchaseAvailable={purchaseAvailable}
          quiet
        />
      )}
    </View>
  );
}

function MembershipActionGroup({
  compact = false,
  handlers,
  membershipPendingAction,
  membershipRepositoryMode,
  membershipState,
  palette,
  purchaseAvailable,
  quiet = false,
}: {
  compact?: boolean;
  handlers: MembershipHandlers;
  membershipPendingAction:
    | 'dismiss_recovery'
    | 'purchase'
    | 'start_trial'
    | null;
  membershipRepositoryMode: 'local' | 'remote';
  membershipState: MembershipState;
  palette: Palette;
  purchaseAvailable: boolean;
  quiet?: boolean;
}) {
  const isPending = membershipPendingAction !== null;
  const actionBackground = palette.accent;
  const actionBorder = 'transparent';
  const actionText = palette.primaryActionText;
  const showLocalDebugActions =
    membershipRepositoryMode === 'local' && process.env.NODE_ENV === 'test';
  const operatorEntitlementCopy = (
    <Text
      style={[
        styles.authHint,
        styles.membershipOperatorEntitlementCopy,
        {color: palette.textMuted},
      ]}
      testID="membership-operator-entitlement-copy"
    >
      获得内测资格后即可使用。
    </Text>
  );

  return membershipState.stage === 'trial_available' ? (
    <View style={styles.membershipTrialActionRow}>
      <Pressable
        disabled={isPending}
        onPress={handlers.onStartTrial}
        style={[
          styles.primaryButton,
          styles.membershipPrimaryAction,
          quiet ? styles.membershipQuietAction : null,
          { backgroundColor: actionBackground, borderColor: actionBorder },
        ]}
        testID="membership-start-trial-button"
      >
        <Text
          style={[styles.primaryButtonLabel, { color: actionText }]}
        >
          {membershipPendingAction === 'start_trial'
            ? '正在开通试用'
            : '开始试用'}
        </Text>
      </Pressable>
      {purchaseAvailable ? (
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
      ) : operatorEntitlementCopy}
    </View>
  ) : membershipState.stage === 'trial' ? (
    <View style={styles.authActions}>
      {purchaseAvailable ? (
        <Pressable
        disabled={isPending}
        onPress={handlers.onPurchase}
        style={[
          styles.primaryButton,
          compact ? styles.membershipPrimaryActionCompact : null,
          quiet ? styles.membershipQuietAction : null,
          { backgroundColor: actionBackground, borderColor: actionBorder },
        ]}
        testID="membership-purchase-button"
      >
        <Text
          style={[styles.primaryButtonLabel, { color: actionText }]}
        >
          {membershipPendingAction === 'purchase'
            ? '正在开通会员'
            : '直接开通会员'}
        </Text>
      </Pressable>
      ) : operatorEntitlementCopy}
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
        会员已开通。
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
      {purchaseAvailable ? (
        <Pressable
        disabled={isPending}
        onPress={handlers.onPurchase}
        style={[
          styles.primaryButton,
          compact ? styles.membershipPrimaryActionCompact : null,
          quiet ? styles.membershipQuietAction : null,
          { backgroundColor: actionBackground, borderColor: actionBorder },
        ]}
        testID="membership-purchase-button"
      >
        <Text
          style={[styles.primaryButtonLabel, { color: actionText }]}
        >
          {membershipPendingAction === 'purchase'
            ? '正在续费'
            : '续费会员'}
        </Text>
        </Pressable>
      ) : operatorEntitlementCopy}
    </View>
  );
}

function PhoneSmsPanel({
  accountDock = false,
  authState,
  embedded = false,
  handlers,
  minimal = false,
  palette,
  returnTarget,
  routeDock = false,
  stateLabel,
  title,
  summary,
  successMessage = '已登录。',
}: {
  accountDock?: boolean;
  authState: AuthState;
  embedded?: boolean;
  handlers: AuthHandlers;
  minimal?: boolean;
  palette: Palette;
  returnTarget: string;
  routeDock?: boolean;
  stateLabel?: string;
  title: string;
  summary: string;
  successMessage?: string;
}) {
  const isDockedPanel = accountDock || routeDock || minimal;
  const isAuthenticated = authState.stage === 'authenticated';
  const isPending = authState.pendingAction !== null;
  const resendRemainingSeconds = useSmsResendRemainingSeconds(authState.resendAvailableAt);
  const hasRequestedCode = authState.stage !== 'logged_out';
  const hasAuthError = authState.error !== null;
  const isSessionSaveError = hasAuthError && authState.errorAction === 'save_session';
  const isClientUpdateRequired =
    isAuthenticated && authState.error === CLIENT_UPDATE_REQUIRED_COPY;
  const hasCodeError =
    hasAuthError && hasRequestedCode && authState.errorKind === 'invalid_code';
  const isExpiredSessionError =
    hasAuthError &&
    !hasRequestedCode &&
    authState.error?.startsWith('登录已失效');
  const isPhoneReady = isPhoneNumberReady(authState.phoneNumber);
  const canRequestCode = isPhoneReady && !isPending && !isAuthenticated &&
    resendRemainingSeconds === 0;
  const canSubmitCode =
    isSmsCodeReady(authState.smsCode) && !isPending && !isAuthenticated;
  const requestCodeLabelColor = canRequestCode
    ? palette.primaryActionText
    : palette.accent;
  const requestReadinessLabel =
    authState.pendingAction === 'request_code'
      ? '发送中'
      : canRequestCode
      ? '可以继续'
      : '待输入';
  const requestDockTitle =
    authState.pendingAction === 'request_code'
      ? '正在发送验证码'
      : canRequestCode
      ? '可以继续'
      : accountDock
      ? '填写手机号'
      : '手机号';
  const requestDockDetail =
    authState.pendingAction === 'request_code'
      ? '正在发送验证码。'
      : canRequestCode
      ? '可以获取验证码。'
      : '输入手机号获取验证码。';
  const dockSummary = hasRequestedCode
    ? `填写验证码，登录后返回${returnTarget}。`
    : requestDockDetail;
  const requestStatusTone = canRequestCode ? palette.success : palette.accent;
  const authErrorTitle = isSessionSaveError
    ? '本机暂时无法保存登录状态'
    : isClientUpdateRequired
    ? '需要安装最新版本'
    : isExpiredSessionError
    ? '登录已失效'
    : hasCodeError
    ? '验证码不正确'
    : authState.errorKind === 'expired_code' ? '验证码已失效'
    : authState.errorKind === 'network' ? '连接失败'
    : authState.errorKind === 'throttled' ? '操作太频繁'
    : authState.errorAction === 'request_code' ? '验证码发送失败' : '登录未完成';
  const authErrorDetail = isSessionSaveError
    ? resendRemainingSeconds > 0
      ? '倒计时结束后，请重新获取验证码。'
      : '请重新获取验证码后登录。'
    : isClientUpdateRequired
    ? '登录状态已保留，更新后可直接继续。'
    : isExpiredSessionError
    ? '请重新登录。'
    : authState.errorAction === 'request_code' && hasRequestedCode
    ? authState.error ?? '重发暂时失败，仍可填写已收到的验证码。'
    : hasCodeError
    ? '请检查验证码后重试。'
    : authState.error ?? '请稍后重试。';
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
          numberOfLines={isSessionSaveError ? undefined : 1}
          style={[styles.authErrorTitle, { color: palette.text }]}
          testID="auth-error-title"
        >
          {authErrorTitle}
        </Text>
        <Text
          numberOfLines={isSessionSaveError ? undefined : 2}
          style={[styles.authErrorDetail, { color: palette.textMuted }]}
          testID="auth-error-detail"
        >
          {minimal ? authErrorDetail : `${authState.error} ${authErrorDetail}`}
        </Text>
      </View>
      <Pressable
        accessibilityRole={isClientUpdateRequired ? 'button' : undefined}
        disabled={!isClientUpdateRequired}
        onPress={
          isClientUpdateRequired ? handlers.onOpenUpdate : undefined
        }
        style={[
          styles.authErrorPill,
          {
            backgroundColor: palette.panel,
            borderColor: hexToRgba(palette.warning, 0.22),
          },
        ]}
        testID={
          isClientUpdateRequired
            ? 'auth-update-required-button'
            : 'auth-error-retry-pill'
        }
      >
        <Text
          numberOfLines={1}
          style={[styles.authErrorPillText, { color: palette.warning }]}
        >
          {isClientUpdateRequired ? '获取更新' : isSessionSaveError ? '重新取码' : '可重试'}
        </Text>
      </Pressable>
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
                {isSessionSaveError ? '登录未完成' : hasCodeError ? '请检查验证码' : '请输入验证码'}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.authCodeSentMeta, { color: palette.textMuted }]}
              >
                {`登录手机号：${maskPhoneNumber(authState.phoneNumber)}`}
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
                  ? '发送中'
                  : resendRemainingSeconds > 0
                  ? `${resendRemainingSeconds} 秒后重发`
                  : '重新发送'}
              </Text>
            </Pressable>
          </View>
          {!isAuthenticated ? (
            <Pressable
              disabled={isPending}
              onPress={handlers.onResetPhone}
              style={[
                styles.authChangePhoneButton,
                {backgroundColor: palette.panel, borderColor: palette.border},
              ]}
              testID="auth-change-phone-button"
            >
              <Text style={[styles.authCodeResendLabel, {color: palette.text}]}>
                更换手机号
              </Text>
            </Pressable>
          ) : null}
          {!minimal ? (
            <Text
              numberOfLines={1}
              style={[
                styles.authCodeSentMeta,
                styles.authCodeReturnText,
                { color: palette.textMuted },
              ]}
            >
              {'请输入短信中的验证码。'}
            </Text>
          ) : null}
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
                accessibilityHint={'输入短信中的验证码'}
                accessibilityLabel={'短信验证码'}
                accessibilityState={{
                  disabled: isPending || isAuthenticated,
                }}
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
                    ? '登录'
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
          {!minimal ? (
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
          ) : null}
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
                accessibilityHint="输入用于登录软书四六级的十一位手机号"
                accessibilityLabel="手机号码"
                accessibilityState={{
                  disabled: isPending || isAuthenticated,
                }}
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
                  : resendRemainingSeconds > 0
                  ? `${resendRemainingSeconds} 秒后重发`
                  : '获取验证码'}
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
                  { color: palette.primaryActionText },
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
  return Math.min(width, height) >= 600 ? 'tablet' : 'phone';
}

export function isCompactMineViewport(width: number, height: number) {
  return width <= 340 || height <= 850;
}

function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber === LOCAL_DEVICE_OWNER) return '本地学习';
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
      return '可试用';
    case 'trial':
      return '试用中';
    case 'free':
      return '免费版';
    case 'premium':
      return '会员';
  }
}

function getMembershipHostTitle(stage: MembershipStage) {
  switch (stage) {
    case 'trial_available':
      return '免费试用';
    case 'trial':
      return '试用';
    case 'free':
      return '免费版';
    case 'premium':
      return '会员已开通';
  }
}

function getMembershipStatusChipLabel(stage: MembershipStage) {
  switch (stage) {
    case 'trial_available':
      return '未开始';
    case 'trial':
      return '试用中';
    case 'free':
      return '免费';
    case 'premium':
      return '已开通';
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

function getMembershipCardSummary(
  membershipState: MembershipState,
  mode: 'local' | 'remote',
) {
  switch (membershipState.stage) {
    case 'trial_available':
      return '开始学习后即可试用全部卡片、空间和复习功能。';
    case 'trial':
      return mode === 'remote'
        ? `试用还剩 ${Math.ceil(
            membershipState.trialRemainingSeconds / (24 * 60 * 60),
          )} 天，完整卡库、空间和复习已开启。`
        : `已开始 ${membershipState.trialDurationDays} 天试用。`;
    case 'free':
      return '你仍可学习免费卡片，会员可使用全部卡片、空间和复习。';
    case 'premium':
      return '会员已开通，可使用完整卡库、空间和复习。';
  }
}

const styles = StyleSheet.create({
  learningRecoveryNotice: {fontSize: 14, lineHeight: 22, paddingHorizontal: 18, paddingVertical: 8},
  safeArea: {
    flex: 1,
  },
  safeAreaBody: {
    flex: 1,
  },
  appCanvasBackdrop: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  appAuroraTop: {
    borderRadius: 999,
    height: 360,
    left: -160,
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 80,
    top: -190,
    width: 480,
  },
  appAuroraBottom: {
    borderRadius: 999,
    bottom: -260,
    height: 440,
    position: 'absolute',
    right: -220,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 90,
    width: 520,
  },
  shellRoot: {
    flex: 1,
    gap: 8,
  },
  shellContent: {
    flex: 1,
    minHeight: 0,
  },
  shellAccessibleContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  phoneTopBar: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: STUDIO.space.phone, paddingVertical: 2, minHeight: 48,
  },
  phoneTopBarLearning: {
    marginTop: 0, paddingVertical: 0,
  },
  phoneTopCopy: {
    flex: 1,
    gap: 2,
  },
  phoneBrandLockup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  phoneBrandMark: {
    alignItems: 'center',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0,
    shadowRadius: 14,
    width: 28,
  },
  phoneBrandMarkLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -1,
  },
  phoneTopTitle: {
    fontSize: 18, fontWeight: '600',
  },
  phoneTopTitleLearning: {
    fontSize: 18,
  },
  phoneTopMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  phoneTopMetaLearning: {
    fontSize: 11,
  },
  phoneAccountChip: {
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 22, minWidth: 70, minHeight: 44, paddingHorizontal: 13,
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
    fontWeight: '600',
    lineHeight: 11,
  },
  phoneAccountChipValue: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  tabletRoot: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  tabletRootNarrow: {
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  sidebar: {
    width: 212,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 0,
    borderRadius: 24,
    gap: 18,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0,
    shadowRadius: 36,
    elevation: 0,
  },
  sidebarNarrow: {
    borderRadius: 20,
    gap: 13,
    paddingHorizontal: 13,
    paddingVertical: 16,
    width: 170,
  },
  sidebarNav: {
    gap: 12,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sidebarCopy: {
    flex: 1,
    gap: 4,
  },
  sidebarLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 1.05,
  },
  statusBadgeValue: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
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
    fontWeight: '600',
    lineHeight: 12,
  },
  headerAccountValue: {
    fontSize: 12,
    fontWeight: '600',
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
  standaloneAuthRoot: {
    flex: 1,
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
    borderWidth: 0,
    borderRadius: STUDIO.radius.card,
    gap: 13,
    paddingHorizontal: 22,
    paddingVertical: 26,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.035,
    shadowRadius: 34,
    elevation: 1,
  },
  authEntryCardEmbedded: {
    flexShrink: 1,
  },
  authEntryCardRouteObject: {
    flexShrink: 1,
    gap: 18,
    justifyContent: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 26,
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
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 34,
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
    fontSize: 14,
    lineHeight: 22,
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
    borderWidth: 0,
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
    borderWidth: 0,
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
    fontWeight: '600',
    lineHeight: 23,
  },
  authRetainedSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  authContinuityPromisePill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 0,
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  authContinuityPromiseText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  authObjectBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 0,
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
    fontWeight: '600',
    textAlign: 'center',
  },
  authObjectBadgeLabel: {
    fontSize: 10,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  heroSummary: {
    fontSize: 15,
    lineHeight: 23,
  },
  authPanel: {
    borderWidth: 0,
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
    borderWidth: 0,
    maxWidth: 96,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  authPanelStatePillText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
  authSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  authRequestInlineDock: {
    borderRadius: 18,
    borderWidth: 0,
    gap: 14,
    paddingHorizontal: 0,
    paddingVertical: 0,
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
    paddingBottom: 0,
    paddingTop: 0,
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
    borderWidth: 0,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 56,
    paddingHorizontal: 9,
  },
  authRequestReadinessText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  authRequestTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  authRequestDetail: {
    fontSize: 11,
    lineHeight: 15,
  },
  authRequestButton: {
    alignItems: 'center',
    borderRadius: STUDIO.radius.control,
    borderWidth: 0,
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
    fontWeight: '600',
    lineHeight: 19,
  },
  authCodeInlineDock: {
    borderRadius: 20,
    borderWidth: 0,
    gap: 16,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  authCodeInlineDockAccount: {
    gap: 10,
    minHeight: 205,
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  authCodeInlineDockRoute: {
    paddingBottom: 0,
    paddingTop: 0,
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
    fontWeight: '600',
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
    minHeight: 58,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 0,
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
    borderRadius: 10,
    borderWidth: 0,
    height: 44,
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
    fontWeight: '600',
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
    borderRadius: STUDIO.radius.control,
    borderWidth: 0,
    justifyContent: 'center',
    minHeight: 50,
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
    fontWeight: '600',
    lineHeight: 16,
  },
  authCodeResendButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 0,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  authCodeResendLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  authChangePhoneButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  authPhoneFieldDock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 14,
    borderWidth: 1,
    flex: 0,
    flexDirection: 'row',
    gap: 8,
    minHeight: 56,
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
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
    lineHeight: 14,
  },
  authSuccess: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: STUDIO.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0,
    shadowRadius: 24,
    elevation: 0,

    minHeight: 48,
  },
  compactButton: {
    alignSelf: 'flex-start',
    minWidth: 128,
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
  accountDeletionAcceptedScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  accountDeletionAcceptedScroll: {
    flex: 1,
  },
  accountDeletionAcceptedCard: {
    alignItems: 'stretch',
    borderRadius: 28,
    borderWidth: 0,
    gap: 14,
    maxWidth: 560,
    paddingHorizontal: 22,
    paddingVertical: 28,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 34,
    width: '100%',
    elevation: 5,
  },
  accountDeletionAcceptedMark: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  accountDeletionAcceptedMarkLabel: {
    fontSize: 28,
    fontWeight: '800',
  },
  accountDeletionAcceptedTitle: {
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 33,
    textAlign: 'center',
  },
  accountDeletionAcceptedSummary: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  accountDeletionBoundaryNote: {
    borderRadius: 18,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountDeletionBoundaryText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  accountDeletionModal: {
    backgroundColor: 'rgba(28, 22, 48, 0.48)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 56,
  },
  accountDeletionModalScroll: {
    flex: 1,
    width: '100%',
  },
  accountDeletionModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  accountDeletionSheet: {
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: 0,
    gap: 13,
    maxWidth: 560,
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 10,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    width: '100%',
    elevation: 12,
  },
  accountDeletionSheetHandle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: 2,
    width: 46,
  },
  accountDeletionSheetKicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  accountDeletionSheetTitle: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
  },
  accountDeletionSheetSummary: {
    fontSize: 14,
    lineHeight: 21,
  },
  accountDeletionConsequence: {
    borderRadius: 18,
    borderWidth: 0,
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountDeletionConsequenceText: {
    fontSize: 13,
    lineHeight: 19,
  },
  accountDeletionStateCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  accountDeletionStateMark: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    width: 30,
  },
  accountDeletionStateCopy: {
    flex: 1,
    gap: 3,
  },
  accountDeletionStateTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  accountDeletionStateDetail: {
    fontSize: 12,
    lineHeight: 18,
  },
  accountDeletionSheetActions: {
    flexDirection: 'row',
    gap: 9,
  },
  accountDeletionPrimaryButton: {
    alignItems: 'center',
    borderRadius: STUDIO.radius.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  accountDeletionPrimaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountDeletionSecondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  accountDeletionSecondaryButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountDeletionDangerButton: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  accountDeletionDangerButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  mineScreen: {
    flex: 1,
    gap: 12,
    paddingHorizontal: STUDIO.space.phone,
    paddingVertical: 6,
  },
  mineScreenTablet: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  mineScreenCompact: {
    gap: 10,
    paddingHorizontal: STUDIO.space.phone,
    paddingVertical: 6,
  },
  mineProfilePanel: {
    alignItems: 'stretch',
    borderRadius: STUDIO.radius.card,
    borderWidth: 0,
    gap: 18,
    justifyContent: 'flex-start',
    minHeight: 0,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0,
    shadowRadius: 34,
    elevation: 0,
  },
  mineProfilePanelCompact: {
    gap: 14,
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  minePassportStack: {
    flexShrink: 0,
    gap: 8,
  },
  minePassportStackCompact: {
    gap: 5,
  },
  mineAccountHeaderCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  mineAccountTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mineAccountEyebrow: {
    fontSize: 12,
    fontWeight: '600',
  },
  mineAccountEyebrowCompact: {
    fontSize: 10,
  },
  mineAccountTitle: {
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 25,
  },
  mineAccountTitleCompact: {
    fontSize: 22,
    lineHeight: 30,
  },
  mineAccountSummary: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 21,
  },
  mineAccountSummaryCompact: {
    fontSize: 13,
    lineHeight: 21,
  },
  mineAccountLedger: {
    borderRadius: 14,
    borderWidth: 0,
    overflow: 'hidden',
  },
  mineAccountRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mineAccountRowLast: {
    borderBottomWidth: 0,
  },
  mineAccountRowLabel: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  mineAccountRowValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginLeft: 16,
    textAlign: 'right',
  },
  mineMembershipPill: {
    borderRadius: 999,
    borderWidth: 0,
    maxWidth: 108,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  mineMembershipPillCompact: {
    maxWidth: 90,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  mineMembershipPillText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  mineAccountPrivacyCard: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mineAccountPrivacyCardCompact: {
    minHeight: 44,
    paddingVertical: 4,
  },
  mineSessionCard: {
    marginTop: 8,
  },
  mineAccountPrivacyCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  mineAccountPrivacyLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  mineAccountPrivacyDetail: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 17,
  },
  mineAccountDeleteButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 0,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: 12,
  },
  mineAccountLogoutButton: {
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mineAccountDeleteButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  membershipHostCard: {
    borderTopWidth: 0,
    gap: 8,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 1,
    paddingTop: 0,
    shadowOpacity: 0,
    elevation: 0,

    paddingVertical: 18,
    borderRadius: 18,
  },
  membershipHostCardCompact: {
    gap: 10,
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
    fontWeight: '600',
    lineHeight: 18,
  },
  membershipSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  membershipInlineStatus: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  membershipInlineStatusText: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  membershipFocusCard: {
    borderWidth: 0,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  membershipFocusTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  membershipRecoveryCard: {
    borderWidth: 0,
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
  membershipAccessTrackCompact: {
    gap: 4,
  },
  membershipAccessCompactDock: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0,
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
    fontWeight: '600',
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
    borderWidth: 0,
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
    fontWeight: '600',
    lineHeight: 12,
  },
  membershipCompactTrialButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 80,
    paddingHorizontal: 9,
  },
  membershipCompactTrialLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  membershipCompactPurchaseButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 0,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 82,
    paddingHorizontal: 10,
  },
  membershipCompactPurchaseLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  membershipAccessStep: {
    borderRadius: 12,
    borderWidth: 0,
    flex: 1,
    gap: 5,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  membershipAccessStepCompact: {
    gap: 3,
    minHeight: 55,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  membershipAccessDot: {
    borderRadius: 999,
    borderWidth: 0,
    height: 8,
    width: 8,
  },
  membershipAccessLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  membershipAccessValue: {
    fontSize: 10,
    fontWeight: '600',
  },
  membershipTrialActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  membershipOperatorEntitlementCopy: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 18,
  },
  membershipPrimaryAction: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  membershipPrimaryActionCompact: {
    minHeight: 44,
    paddingVertical: 8,
  },
  membershipQuietAction: {
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
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
    fontWeight: '600',
  },
  phoneTabBarWrap: {
    paddingHorizontal: STUDIO.space.phone,
    paddingBottom: 8,
  },
  phoneTabBar: {
    borderWidth: 0, borderRadius: STUDIO.radius.navigation, flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 6, shadowOpacity: 0.04, elevation: 2,

    shadowRadius: 14,
    shadowOffset: {width: 0, height: 5},
  },
  phoneTabButton: {
    flex: 1, alignItems: 'center', gap: 4, minHeight: 48, justifyContent: 'center', paddingVertical: 4, borderRadius: STUDIO.radius.control,
  },
  phoneTabButtonActive: {
    shadowOpacity: 0, elevation: 0,
  },
  phoneTabLabel: {
    fontSize: 10, fontWeight: '500', lineHeight: 15,
  },
});

export default App;
