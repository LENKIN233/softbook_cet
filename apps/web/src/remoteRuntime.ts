import {createPinnedContentManifestSignatureVerifier} from '../../mobile/src/audio/contentManifestSignature';
import {
  createAccountDeletionRepository,
  type AccountDeletionRepository,
} from '../../mobile/src/account/accountDeletionRepository';
import {
  createAuthRepository,
  createSoftbookRemoteAuthConfig,
  type AuthRepository,
} from '../../mobile/src/auth/authRepository';
import type {AuthChallenge} from '../../mobile/src/auth/authSession';
import {getAuthSessionScopeKey} from '../../mobile/src/auth/authSession';
import {
  createAuthSessionCoordinator,
  type AuthSessionCoordinator,
} from '../../mobile/src/auth/authSessionCoordinator';
import {createAuthenticatedFetch} from '../../mobile/src/auth/authenticatedFetch';
import {
  createAccountBootstrapRepository,
  createSoftbookRemoteAccountBootstrapConfig,
  type AccountBootstrapRepository,
  type AccountBootstrapSnapshot,
} from '../../mobile/src/bootstrap/accountBootstrapRepository';
import {resolveAccountBootstrapLearningState} from '../../mobile/src/bootstrap/accountBootstrapHydration';
import type {LearningSessionRepository} from '../../mobile/src/learning/learningRepository';
import {createRemoteLearningSessionRepository} from '../../mobile/src/learning/remoteLearningRepository';
import {
  resolveLearningSessionRepositoryConfig,
  type SoftbookAppRuntimeConfig,
} from '../../mobile/src/learning/learningRuntimeConfig';
import type {
  LearningCard,
  LearningCardResult,
  LearningSession,
  LearningTrack,
} from '../../mobile/src/learning/model';
import {createMembershipRepository} from '../../mobile/src/membership/membershipRepository';
import {resolveMembershipRepositoryConfig} from '../../mobile/src/membership/membershipRuntimeConfig';
import {resolveMembershipAccess} from '../../mobile/src/membership/localMembership';
import {getChinaDayKey} from '../../mobile/src/shared/chinaDay';
import {isRemoteAuthorizationError} from '../../mobile/src/runtime/remoteHttpError';
import {isRemoteRequestCancellationError} from '../../mobile/src/runtime/remoteRequest';
import {createSoftbookClientHeaders} from '../../mobile/src/runtime/remoteClient';
import {
  applySpaceActionToMap,
  createSpaceAction,
  createSpaceStateRepository,
  spaceStateSnapshotToMap,
  type SpaceActionDimension,
} from '../../mobile/src/space/spaceStateRepository';
import {resolveSpaceStateRepositoryConfig} from '../../mobile/src/space/spaceStateRuntimeConfig';
import {LearningEventOutbox} from '../../mobile/src/sync/learningEventOutbox';
import {createLearningEventSyncRepository} from '../../mobile/src/sync/learningEventSyncRepository';
import {createLearningEventsRepository} from '../../mobile/src/sync/learningEventsRepository';
import {resolveLearningEventsRepositoryConfig} from '../../mobile/src/sync/learningEventsRuntimeConfig';
import {MutationQueueManager} from '../../mobile/src/sync/mutationQueue';
import {
  createMutationQueueRepository,
  type MutationQueueRepository,
} from '../../mobile/src/sync/mutationQueueRepository';
import {createProgressSyncRepository} from '../../mobile/src/sync/progressSyncRepository';
import {resolveProgressSyncRepositoryConfig} from '../../mobile/src/sync/progressSyncRuntimeConfig';

import type {WebRuntime} from './runtime';
import {prepareVerifiedCardAudio} from './webAudio';
import {
  createMemoryOnlyAuthSessionStore,
  createWebLearningEventStorage,
  createWebMutationQueueStorage,
} from './webStorage';
import {
  createWebAccountDeletionStateStore,
  type WebAccountDeletionStateStore,
} from './webAccountDeletionState';
import {
  createWebAccountDeletionRecoveryRepository,
  type WebAccountDeletionRecoveryChallenge,
  type WebAccountDeletionRecoveryRepository,
} from './webAccountDeletionRecovery';

type RemoteWebRuntime = Extract<WebRuntime, {mode: 'remote'}>;

export type WebRemoteSnapshot = {
  bootstrap: AccountBootstrapSnapshot;
  favorites: string[];
  learningResults: LearningCardResult[];
  learningSession: LearningSession;
  checkInSync: {
    checkedInToday: boolean;
    pending: boolean;
    status: 'confirmed' | 'queued' | 'ready' | 'unavailable';
  };
  learningSync: {
    pendingEventCount: number;
    status: 'confirmed' | 'queued';
  };
  membership: AccountBootstrapSnapshot['membership']['state'];
  reviewResults: LearningCardResult[];
  sleeping: string[];
  spaceSync: {
    pendingActionCount: number;
    rejectedActionCount: number;
    rejectionCodes: Array<
      'space_action_id_conflict' | 'space_card_not_in_content'
    >;
    status: 'confirmed' | 'queued' | 'queued_and_rejected' | 'rejected';
  };
};

export type WebAccountDeletionOutcome =
  | {
      status:
        | 'accepted'
        | 'cleanup_required'
        | 'none'
        | 'registration_cleanup_required'
        | 'registration_ready'
        | 'unknown';
    }
  | {
      phoneNumber: string;
      status: 'reauthentication_required';
    };

export type WebLearningCompletionSync = WebRemoteSnapshot['learningSync'];

type RemoteRuntimeDependencies = {
  accountDeletionRecoveryRepository?: WebAccountDeletionRecoveryRepository;
  accountDeletionRepository?: AccountDeletionRepository;
  accountDeletionStateStore?: WebAccountDeletionStateStore;
  accountBootstrapRepository: AccountBootstrapRepository;
  authRepository: AuthRepository;
  authSessionCoordinator: AuthSessionCoordinator;
  learningEventSyncRepository: ReturnType<
    typeof createLearningEventSyncRepository
  >;
  learningSessionRepository: LearningSessionRepository;
  mutationQueueRepository: MutationQueueRepository;
  now?: () => Date;
  playAudio: (
    card: LearningCard,
    session: LearningSession,
  ) => Promise<'paused' | 'playing' | 'ready'>;
  stopAudio?: () => void;
  runtimeSessionId?: string;
  setAccountDeletionQuarantine?: (
    sessionScopeKey: string,
    active: boolean,
  ) => void;
  subscribeAudioStatus?: (
    listener: (status: 'error' | 'idle') => void,
  ) => () => void;
  track: LearningTrack;
};

export type WebRemoteRuntimeController = {
  applySpaceState: (
    cardId: string,
    dimension: SpaceActionDimension,
    value: boolean,
  ) => Promise<WebRemoteSnapshot>;
  cleanupInvalidatedSession: () => Promise<void>;
  checkInToday: () => Promise<WebRemoteSnapshot>;
  completeCurrentCard: (
    result: LearningCardResult,
  ) => Promise<WebLearningCompletionSync>;
  continueServerRound: () => Promise<WebRemoteSnapshot>;
  isAuthenticated: () => boolean;
  loadAuthenticatedState: () => Promise<WebRemoteSnapshot>;
  logout: () => Promise<void>;
  playCardAudio: (
    card: LearningCard,
  ) => Promise<'paused' | 'playing' | 'ready'>;
  requestSmsCode: (phoneNumber: string) => Promise<AuthChallenge>;
  requestAccountDeletion: () => Promise<WebAccountDeletionOutcome>;
  requestAccountDeletionRecoverySmsCode: () => Promise<WebAccountDeletionRecoveryChallenge>;
  resumeAccountDeletion: () => Promise<WebAccountDeletionOutcome>;
  subscribeAudioStatus: (
    listener: (status: 'error' | 'idle') => void,
  ) => () => void;
  verifyAccountDeletionRecoverySmsCode: (
    smsCode: string,
  ) => Promise<WebAccountDeletionOutcome>;
  verifySmsCode: (
    phoneNumber: string,
    smsCode: string,
  ) => Promise<WebRemoteSnapshot>;
};

export class WebRemotePostAuthError extends Error {
  constructor(cause: unknown) {
    super('Authenticated Web bootstrap failed.', {cause});
    this.name = 'WebRemotePostAuthError';
  }
}

export function createWebRemoteRuntime(
  runtime: RemoteWebRuntime,
  options: {
    fetchImpl?: typeof fetch;
    storage?: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
  } = {},
): WebRemoteRuntimeController {
  const fetchImpl = options.fetchImpl ?? fetch;
  const browserStorage = options.storage ?? window.localStorage;
  const deletionQuarantinedSessionScopes = new Set<string>();
  const isDeletionQuarantined = (sessionScopeKey: string | null) =>
    sessionScopeKey !== null &&
    deletionQuarantinedSessionScopes.has(sessionScopeKey);
  const authRepository = createAuthRepository({
    fetchImpl,
    mode: 'remote',
    remoteConfig: createSoftbookRemoteAuthConfig({
      baseUrl: runtime.baseUrl,
      clientKind: 'web',
    }),
  });
  const authSessionCoordinator = createAuthSessionCoordinator({
    authRepository,
    authSessionStore: createMemoryOnlyAuthSessionStore(),
    shouldPreserveAuthorizationRejection: isDeletionQuarantined,
  });
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator,
    fetchImpl,
    shouldPreserveAuthorizationRejection: isDeletionQuarantined,
    shouldQuarantineSession: isDeletionQuarantined,
  });
  const sharedRuntimeConfig = createSharedRemoteRuntimeConfig(runtime);
  const accountDeletionRepository = createAccountDeletionRepository({
    endpoint: `${runtime.baseUrl}/v2/account/deletion`,
    fetchImpl,
    headers: createSoftbookClientHeaders('web'),
  });
  const accountDeletionRecoveryRepository =
    createWebAccountDeletionRecoveryRepository({
      baseUrl: runtime.baseUrl,
      fetchImpl,
    });
  const accountDeletionStateStore = createWebAccountDeletionStateStore(
    browserStorage,
  );
  const accountBootstrapRepository = createAccountBootstrapRepository({
    fetchImpl: authenticatedFetch,
    mode: 'remote',
    remoteConfig: createSoftbookRemoteAccountBootstrapConfig({
      baseUrl: runtime.baseUrl,
      clientKind: 'web',
      installedClientIdentityProvider: () => runtime.clientIdentity,
    }),
  });
  const learningConfig = resolveLearningSessionRepositoryConfig(
    sharedRuntimeConfig,
  );
  const learningSessionRepository = createRemoteLearningSessionRepository({
    ...learningConfig,
    contentManifestConfig: {
      baseUrl: runtime.baseUrl,
      clientKind: 'web',
      installedClientIdentityProvider: () => runtime.clientIdentity,
      mode: 'remote',
      verifySignature: createPinnedContentManifestSignatureVerifier(
        runtime.contentManifestPublicKeys,
      ),
    },
    fetchImpl: authenticatedFetch,
  });
  const membershipRepository = createMembershipRepository({
    ...resolveMembershipRepositoryConfig(sharedRuntimeConfig),
    fetchImpl: authenticatedFetch,
  });
  const progressSyncRepository = createProgressSyncRepository({
    ...resolveProgressSyncRepositoryConfig(sharedRuntimeConfig),
    fetchImpl: authenticatedFetch,
  });
  const spaceStateRepository = createSpaceStateRepository({
    ...resolveSpaceStateRepositoryConfig(sharedRuntimeConfig),
    fetchImpl: authenticatedFetch,
  });
  const learningEventsRepository = createLearningEventsRepository({
    ...resolveLearningEventsRepositoryConfig(sharedRuntimeConfig),
    fetchImpl: authenticatedFetch,
  });
  const learningEventSyncRepository = createLearningEventSyncRepository({
    eventsRepository: learningEventsRepository,
    outbox: new LearningEventOutbox({
      storage: createWebLearningEventStorage(browserStorage),
    }),
  });
  const mutationQueueRepository = createMutationQueueRepository({
    membershipRepository,
    progressSyncRepository,
    queueManager: new MutationQueueManager({
      storage: createWebMutationQueueStorage(browserStorage),
    }),
    spaceStateRepository,
  });

  let activeAudio: {
    cardToken: string;
    pause: () => void;
    play: () => Promise<void>;
    status: 'paused' | 'playing' | 'ready';
    stop: () => void;
  } | null = null;
  const audioStatusListeners = new Set<
    (status: 'error' | 'idle') => void
  >();
  return createWebRemoteRuntimeController({
    accountDeletionRecoveryRepository,
    accountDeletionRepository,
    accountDeletionStateStore,
    accountBootstrapRepository,
    authRepository,
    authSessionCoordinator,
    learningEventSyncRepository,
    learningSessionRepository,
    mutationQueueRepository,
    playAudio: async (card, session) => {
      if (session.contentManifest === null) {
        throw new Error('当前学习内容没有经过签名音频清单校验。');
      }
      const cardToken = `${card.card_id}:${card.audio?.sha256 ?? 'no-audio'}`;
      if (activeAudio?.cardToken === cardToken) {
        if (activeAudio.status === 'playing') {
          activeAudio.pause();
          activeAudio.status = 'paused';
          return 'paused';
        }
        await activeAudio.play();
        activeAudio.status = 'playing';
        return 'playing';
      }
      activeAudio?.stop();
      const playback = await prepareVerifiedCardAudio({
        card,
        contentManifest: session.contentManifest,
        dependencies: {
          fetchImpl,
          onPlaybackTerminated(reason) {
            if (activeAudio?.cardToken === cardToken) {
              activeAudio = null;
            }
            const status = reason === 'error' ? 'error' : 'idle';
            for (const listener of audioStatusListeners) {
              try {
                listener(status);
              } catch {
                // One view listener cannot block playback cleanup.
              }
            }
          },
        },
      });
      activeAudio = {...playback, cardToken, status: 'ready'};
      return 'ready';
    },
    stopAudio: () => {
      activeAudio?.stop();
      activeAudio = null;
    },
    setAccountDeletionQuarantine(sessionScopeKey, active) {
      if (active) deletionQuarantinedSessionScopes.add(sessionScopeKey);
      else deletionQuarantinedSessionScopes.delete(sessionScopeKey);
    },
    subscribeAudioStatus(listener) {
      audioStatusListeners.add(listener);
      return () => audioStatusListeners.delete(listener);
    },
    track: runtime.track,
  });
}

export function createWebRemoteRuntimeController(
  dependencies: RemoteRuntimeDependencies,
): WebRemoteRuntimeController {
  let challenge: AuthChallenge | null = null;
  let deletionRecoveryChallenge: WebAccountDeletionRecoveryChallenge | null =
    null;
  let activeAccountPhoneNumber: string | null = null;
  let currentBootstrap: AccountBootstrapSnapshot | null = null;
  let currentLearningSession: LearningSession | null = null;
  let persistedLearningResult: LearningCardResult | null = null;
  let persistedSelectionId: string | null = null;
  let sessionDeletionRevision: number | null = null;
  let acceptedDeletionPhoneNumber: string | null = null;
  let registrationReadyPhoneNumber: string | null = null;
  let bootstrapGeneration = 0;
  const now = dependencies.now ?? (() => new Date());
  const runtimeSessionId =
    dependencies.runtimeSessionId ?? createBootstrapRuntimeSessionId();

  const requireAuthenticatedContext = async () => {
    const session = dependencies.authSessionCoordinator.getCurrentSession();
    if (session === null || session.mode !== 'remote') {
      throw new Error('需要先完成手机号验证。');
    }
    const deletionStateStore = dependencies.accountDeletionStateStore;
    const revisionBefore =
      deletionStateStore === undefined
        ? null
        : await deletionStateStore.getRevision();
    if (sessionDeletionRevision === null) {
      sessionDeletionRevision = revisionBefore;
    }
    if (revisionBefore !== sessionDeletionRevision) {
      const sessionScopeKey = getAuthSessionScopeKey(session);
      if (sessionScopeKey !== null) {
        dependencies.setAccountDeletionQuarantine?.(sessionScopeKey, true);
      }
      throw new Error('账户隔离状态已变化，请完成当前恢复操作。');
    }
    const deletionState = await deletionStateStore?.load();
    const revisionAfter =
      deletionStateStore === undefined
        ? null
        : await deletionStateStore.getRevision();
    if (revisionAfter !== sessionDeletionRevision) {
      const sessionScopeKey = getAuthSessionScopeKey(session);
      if (sessionScopeKey !== null) {
        dependencies.setAccountDeletionQuarantine?.(sessionScopeKey, true);
      }
      throw new Error('账户隔离状态已变化，请完成当前恢复操作。');
    }
    if (deletionState !== undefined && deletionState !== null) {
      if (deletionState.phoneNumber !== session.phoneNumber) {
        throw new Error('删除状态属于另一个 Web 账户。');
      }
      const sessionScopeKey = getAuthSessionScopeKey(session);
      if (sessionScopeKey === null) {
        throw new Error('Web account deletion session scope is invalid.');
      }
      dependencies.setAccountDeletionQuarantine?.(sessionScopeKey, true);
      throw new Error('删除结果确认期间已暂停新的账户操作。');
    }
    activeAccountPhoneNumber = session.phoneNumber;
    return {
      authToken: await dependencies.authSessionCoordinator.getAccessToken(),
      phoneNumber: session.phoneNumber,
    };
  };

  const clearDurableAccountState = async () => {
    const phoneNumber = activeAccountPhoneNumber;
    if (phoneNumber === null) {
      throw new Error('没有可安全清理的 Web 账户作用域。');
    }
    const cleanupResults = await Promise.allSettled([
      dependencies.learningEventSyncRepository.clearAccount(phoneNumber),
      dependencies.mutationQueueRepository.clear(),
    ]);
    if (cleanupResults.some(result => result.status === 'rejected')) {
      throw new Error('退出后的本地待同步状态未能完整清理。');
    }
    challenge = null;
    deletionRecoveryChallenge = null;
    activeAccountPhoneNumber = null;
    currentBootstrap = null;
    currentLearningSession = null;
    persistedLearningResult = null;
    persistedSelectionId = null;
    sessionDeletionRevision = null;
  };

  const finishAcceptedAccountDeletion = async (
    phoneNumber: string,
  ): Promise<WebAccountDeletionOutcome> => {
    const stateStore = dependencies.accountDeletionStateStore;
    if (stateStore === undefined) {
      throw new Error('Web account deletion state store is unavailable.');
    }
    activeAccountPhoneNumber = phoneNumber;
    try {
      if (dependencies.authSessionCoordinator.getCurrentSession() !== null) {
        await dependencies.authSessionCoordinator.invalidate();
      }
      await clearDurableAccountState();
      await stateStore.clear();
      acceptedDeletionPhoneNumber = null;
      return {status: 'accepted'};
    } catch {
      return {status: 'cleanup_required'};
    }
  };

  const finishRegistrationReady = async (
    phoneNumber: string,
  ): Promise<WebAccountDeletionOutcome> => {
    const stateStore = dependencies.accountDeletionStateStore;
    if (stateStore === undefined) {
      throw new Error('Web account deletion state store is unavailable.');
    }
    activeAccountPhoneNumber = phoneNumber;
    try {
      if (dependencies.authSessionCoordinator.getCurrentSession() !== null) {
        await dependencies.authSessionCoordinator.invalidate();
      }
      await clearDurableAccountState();
      await stateStore.clear();
      registrationReadyPhoneNumber = null;
      return {status: 'registration_ready'};
    } catch {
      return {status: 'registration_cleanup_required'};
    }
  };

  const submitAccountDeletionRequest = async (): Promise<
    WebAccountDeletionOutcome
  > => {
    const repository = dependencies.accountDeletionRepository;
    const stateStore = dependencies.accountDeletionStateStore;
    if (stateStore === undefined) {
      throw new Error('Web account deletion state store is unavailable.');
    }
    const revisionBefore = await stateStore.getRevision();
    const persisted = await stateStore.load();
    const revisionAfter = await stateStore.getRevision();
    if (registrationReadyPhoneNumber !== null) {
      if (persisted === null) {
        registrationReadyPhoneNumber = null;
        return {status: 'registration_ready'};
      }
      if (persisted.phoneNumber !== registrationReadyPhoneNumber) {
        return {status: 'registration_cleanup_required'};
      }
      if (persisted.phase === 'requesting') {
        try {
          await stateStore.mark(
            registrationReadyPhoneNumber,
            'registration_ready',
          );
        } catch {
          return {status: 'registration_cleanup_required'};
        }
      }
      return finishRegistrationReady(registrationReadyPhoneNumber);
    }
    if (persisted?.phase === 'accepted') {
      return finishAcceptedAccountDeletion(persisted.phoneNumber);
    }
    if (persisted?.phase === 'registration_ready') {
      return finishRegistrationReady(persisted.phoneNumber);
    }
    if (repository === undefined) {
      throw new Error('Web account deletion runtime is unavailable.');
    }
    if (acceptedDeletionPhoneNumber !== null) {
      try {
        await stateStore.mark(acceptedDeletionPhoneNumber, 'accepted');
      } catch {
        return {status: 'cleanup_required'};
      }
      return finishAcceptedAccountDeletion(acceptedDeletionPhoneNumber);
    }

    const session = dependencies.authSessionCoordinator.getCurrentSession();
    if (session === null || session.mode !== 'remote') {
      return {status: persisted === null ? 'none' : 'unknown'};
    }
    if (sessionDeletionRevision === null) {
      sessionDeletionRevision = revisionAfter;
    }
    if (
      persisted === null &&
      (revisionBefore !== revisionAfter ||
        revisionAfter !== sessionDeletionRevision)
    ) {
      throw new Error('Web account deletion marker changed in another tab.');
    }
    if (
      persisted !== null &&
      persisted.phoneNumber !== session.phoneNumber
    ) {
      throw new Error('删除状态属于另一个 Web 账户。');
    }
    activeAccountPhoneNumber = session.phoneNumber;
    const sessionScopeKey = getAuthSessionScopeKey(session);
    if (sessionScopeKey === null) {
      throw new Error('Web account deletion session scope is invalid.');
    }
    dependencies.setAccountDeletionQuarantine?.(sessionScopeKey, true);
    if (persisted === null) {
      try {
        await stateStore.mark(session.phoneNumber, 'requesting');
      } catch (error) {
        dependencies.setAccountDeletionQuarantine?.(sessionScopeKey, false);
        throw error;
      }
    }
    try {
      await repository.requestDeletion({
        accessToken: session.accessToken,
        tokenType: 'Bearer',
      });
    } catch {
      return {status: 'unknown'};
    }
    acceptedDeletionPhoneNumber = session.phoneNumber;
    try {
      await stateStore.mark(session.phoneNumber, 'accepted');
    } catch {
      return {status: 'cleanup_required'};
    }
    return finishAcceptedAccountDeletion(session.phoneNumber);
  };

  const loadBootstrap = async (forceFresh: boolean) => {
    const dayKey = getChinaDayKey(now());
    const bootstrap = await dependencies.accountBootstrapRepository.load(
      dependencies.track,
      dayKey,
      {forceFresh},
    );
    if (bootstrap === null) {
      throw new Error('远端账户没有返回可验证的当前状态。');
    }
    bootstrapGeneration += 1;
    return {
      bootstrap,
      observation: {
        forceFresh,
        generation: bootstrapGeneration,
        runtimeSessionId,
        schemaVersion: 'account-bootstrap-observation.v1' as const,
      },
    };
  };

  const loadAuthenticatedState = async (): Promise<WebRemoteSnapshot> => {
    const context = await requireAuthenticatedContext();

    // The retained event ledger is replayed before the first canonical read so
    // bootstrap can never silently outrun an acknowledged card completion.
    const eventReplay =
      await dependencies.learningEventSyncRepository.startReplay(context);
    if (eventReplay.pendingCount !== 0) {
      throw new Error('仍有学习结果等待服务端确认。');
    }

    let {bootstrap, observation} = await loadBootstrap(false);
    await dependencies.mutationQueueRepository.hydrate();
    const mutationResults =
      await dependencies.mutationQueueRepository.startReplay({
        ...context,
        bootstrapObservation: observation,
        componentRevisions: bootstrap.componentRevisions,
        contentVersion: bootstrap.content.version,
        dayKey: bootstrap.dayKey,
        track: bootstrap.track,
      });
    const terminalSpaceRejections = mutationResults.flatMap(result =>
      'terminalRejection' in result
        ? [result.terminalRejection.code]
        : [],
    );
    if (mutationResults.length > 0) {
      ({bootstrap, observation} = await loadBootstrap(true));
      const requiresCausalRetry = mutationResults.some(
        result => 'canonicalRefreshRequired' in result,
      );
      if (requiresCausalRetry) {
        const retryResults =
          await dependencies.mutationQueueRepository.startReplay({
            ...context,
            bootstrapObservation: observation,
            componentRevisions: bootstrap.componentRevisions,
            contentVersion: bootstrap.content.version,
            dayKey: bootstrap.dayKey,
            track: bootstrap.track,
          });
        terminalSpaceRejections.push(
          ...retryResults.flatMap(result =>
            'terminalRejection' in result
              ? [result.terminalRejection.code]
              : [],
          ),
        );
        ({bootstrap} = await loadBootstrap(true));
      }
    }

    const learningSession =
      await dependencies.learningSessionRepository.loadSession(
        context,
        dependencies.track,
      );
    if (
      learningSession.membershipStage !== null &&
      learningSession.membershipStage !== bootstrap.membership.state.stage
    ) {
      ({bootstrap} = await loadBootstrap(true));
      if (
        learningSession.membershipStage !== bootstrap.membership.state.stage
      ) {
        throw new Error(
          '服务端学习权限与当前账户会员状态尚未一致。',
        );
      }
    }
    const hydrated = resolveAccountBootstrapLearningState(
      bootstrap,
      learningSession,
    );
    const pendingSpaceActions =
      await dependencies.mutationQueueRepository.getPendingSpaceActions(
        context.phoneNumber,
        {
          contentVersion: bootstrap.content.version,
          track: bootstrap.track,
        },
      );
    const quarantinedSpaceActions =
      await dependencies.mutationQueueRepository.getQuarantinedSpaceActions(
        context.phoneNumber,
        {track: bootstrap.track},
      );
    const pendingCheckIn =
      await dependencies.mutationQueueRepository.hasPendingCheckIn(
        context.phoneNumber,
        bootstrap.dayKey,
      );
    const persistedSpaceRejectionCodes = [...new Set([
      ...terminalSpaceRejections,
      ...quarantinedSpaceActions.map(item => item.rejection.code),
    ])];
    const visibleSpaceState = pendingSpaceActions.reduce(
      applySpaceActionToMap,
      spaceStateSnapshotToMap(bootstrap.space.snapshot),
    );
    const favorites = Object.entries(visibleSpaceState)
      .filter(([, state]) => state.isFavorited)
      .map(([cardId]) => cardId);
    const sleeping = Object.entries(visibleSpaceState)
      .filter(([, state]) => state.isSleeping)
      .map(([cardId]) => cardId);

    const previousCardId = currentLearningSession?.cards[0]?.card_id ?? null;
    const nextCardId = learningSession.cards[0]?.card_id ?? null;
    if (previousCardId !== null && previousCardId !== nextCardId) {
      dependencies.stopAudio?.();
    }
    currentBootstrap = bootstrap;
    currentLearningSession = learningSession;
    const nextSelectionId = learningSession.serverSelection?.selectionId ?? null;
    if (
      persistedSelectionId !== null &&
      nextSelectionId !== persistedSelectionId
    ) {
      persistedLearningResult = null;
      persistedSelectionId = null;
    }
    return {
      bootstrap,
      checkInSync: {
        checkedInToday: bootstrap.progress.snapshot.checkedInToday,
        pending: pendingCheckIn,
        status: bootstrap.progress.snapshot.checkedInToday
          ? 'confirmed'
          : pendingCheckIn
          ? 'queued'
          : bootstrap.progress.snapshot.totalCompletedCount < 1
          ? 'unavailable'
          : 'ready',
      },
      favorites,
      learningResults: hydrated.learningResults,
      learningSession,
      learningSync: {
        pendingEventCount: eventReplay.pendingCount,
        status: eventReplay.pendingCount === 0 ? 'confirmed' : 'queued',
      },
      membership: bootstrap.membership.state,
      reviewResults: hydrated.reviewResults,
      sleeping,
      spaceSync: {
        pendingActionCount: pendingSpaceActions.length,
        rejectedActionCount: quarantinedSpaceActions.length,
        rejectionCodes: persistedSpaceRejectionCodes,
        status:
          persistedSpaceRejectionCodes.length > 0 &&
          pendingSpaceActions.length > 0
            ? 'queued_and_rejected'
            : persistedSpaceRejectionCodes.length > 0
            ? 'rejected'
            : pendingSpaceActions.length === 0
            ? 'confirmed'
            : 'queued',
      },
    };
  };

  return {
    async applySpaceState(cardId, dimension, value) {
      const context = await requireAuthenticatedContext();
      if (currentBootstrap === null) {
        throw new Error('需要先读取当前账户状态。');
      }
      if (
        !resolveMembershipAccess(currentBootstrap.membership.state)
          .completePhysicalSpace
      ) {
        throw new Error('当前会员状态不能修改完整物理空间。');
      }
      const action = createSpaceAction({cardId, dimension, value});
      await dependencies.mutationQueueRepository.enqueueMutation(
        'apply_space_action',
        {
          action,
          contentVersion: currentBootstrap.content.version,
          context,
          track: currentBootstrap.track,
        },
        action.actionId,
      );
      return loadAuthenticatedState();
    },

    async cleanupInvalidatedSession() {
      if (dependencies.accountDeletionStateStore !== undefined) {
        const deletionState =
          await dependencies.accountDeletionStateStore.load();
        if (deletionState !== null) {
          throw new Error(
            'Web account deletion state must be resolved before generic cleanup.',
          );
        }
      }
      if (dependencies.authSessionCoordinator.getCurrentSession() !== null) {
        throw new Error('当前 Web 会话尚未失效，不能跳过远端注销。');
      }
      dependencies.stopAudio?.();
      await clearDurableAccountState();
    },

    async checkInToday() {
      let snapshot = await loadAuthenticatedState();
      const context = await requireAuthenticatedContext();
      if (snapshot.bootstrap.progress.snapshot.totalCompletedCount < 1) {
        throw new Error('完成至少一张学习卡后再记录今天。');
      }
      const dayKey = snapshot.bootstrap.dayKey;
      const alreadyPending =
        await dependencies.mutationQueueRepository.hasPendingCheckIn(
          context.phoneNumber,
          dayKey,
        );
      if (
        !snapshot.bootstrap.progress.snapshot.checkedInToday &&
        !alreadyPending
      ) {
        await dependencies.mutationQueueRepository.enqueueMutation(
          'check_in_daily_progress',
          {context, dayKey},
          `check-in:${context.phoneNumber}:${dayKey}`,
        );
      }
      snapshot = await loadAuthenticatedState();
      return snapshot;
    },

    async completeCurrentCard(result) {
      const context = await requireAuthenticatedContext();
      const selection = currentLearningSession?.serverSelection;
      const contentVersion = currentLearningSession?.contentVersion;
      if (
        currentLearningSession === null ||
        currentLearningSession.schedulingMode !== 'server' ||
        selection == null ||
        contentVersion == null ||
        selection.cardId !== result.cardId
      ) {
        throw new Error('当前学习结果没有对应的服务端选择。');
      }
      if (
        persistedSelectionId === selection.selectionId &&
        persistedLearningResult !== null &&
        !areLearningResultsEqual(persistedLearningResult, result)
      ) {
        throw new Error(
          'Queued Learning result retry must match the durably persisted answer.',
        );
      }
      if (persistedSelectionId !== selection.selectionId) {
        await dependencies.learningEventSyncRepository.enqueueCompletion({
          accountPhoneNumber: context.phoneNumber,
          contentVersion,
          phase: selection.phase,
          result,
          selectionId: selection.selectionId,
          track: currentLearningSession.track,
        });
        persistedLearningResult = {...result};
        persistedSelectionId = selection.selectionId;
      }
      let replay: Awaited<
        ReturnType<
          RemoteRuntimeDependencies['learningEventSyncRepository']['startReplay']
        >
      >;
      try {
        replay =
          await dependencies.learningEventSyncRepository.startReplay(context);
      } catch (error) {
        if (
          isRemoteAuthorizationError(error) ||
          isRemoteRequestCancellationError(error)
        ) {
          throw error;
        }
        let pendingEventCount = 1;
        try {
          pendingEventCount = Math.max(
            1,
            await dependencies.learningEventSyncRepository.getPendingCount(
              context.phoneNumber,
            ),
          );
        } catch {
          // Durable enqueue succeeded, so an ambiguous replay/read remains
          // queued until exact acknowledgement can be proven.
        }
        return {pendingEventCount, status: 'queued'};
      }
      if (replay.pendingCount !== 0) {
        return {
          pendingEventCount: replay.pendingCount,
          status: 'queued',
        };
      }
      return {pendingEventCount: 0, status: 'confirmed'};
    },

    async continueServerRound() {
      const context = await requireAuthenticatedContext();
      if (currentLearningSession === null) {
        throw new Error('当前没有可继续的服务端学习轮次。');
      }
      await dependencies.learningSessionRepository.continueRound(
        context,
        currentLearningSession,
      );
      return loadAuthenticatedState();
    },

    isAuthenticated() {
      return dependencies.authSessionCoordinator.getCurrentSession() !== null;
    },

    loadAuthenticatedState,

    async logout() {
      const currentSession =
        dependencies.authSessionCoordinator.getCurrentSession();
      if (currentSession !== null) {
        activeAccountPhoneNumber = currentSession.phoneNumber;
      }
      dependencies.stopAudio?.();
      if (currentSession !== null) {
        await dependencies.authSessionCoordinator.logout();
      }
      await clearDurableAccountState();
    },

    async playCardAudio(card) {
      await requireAuthenticatedContext();
      if (currentLearningSession === null) {
        throw new Error('当前没有经过验证的学习内容。');
      }
      return dependencies.playAudio(card, currentLearningSession);
    },

    async requestSmsCode(phoneNumber) {
      const deletionState =
        await dependencies.accountDeletionStateStore?.load();
      if (deletionState !== undefined && deletionState !== null) {
        throw new Error(
          '请先通过删除恢复入口确认原账户状态。',
        );
      }
      if (
        activeAccountPhoneNumber !== null &&
        dependencies.authSessionCoordinator.getCurrentSession() === null
      ) {
        throw new Error(
          '上一个 Web 会话的本地待同步状态尚未安全清理。',
        );
      }
      challenge = await dependencies.authRepository.requestSmsCode(phoneNumber);
      return challenge;
    },

    async requestAccountDeletion() {
      return submitAccountDeletionRequest();
    },

    async requestAccountDeletionRecoverySmsCode() {
      const recoveryRepository =
        dependencies.accountDeletionRecoveryRepository;
      const stateStore = dependencies.accountDeletionStateStore;
      if (recoveryRepository === undefined || stateStore === undefined) {
        throw new Error('Web account deletion recovery is unavailable.');
      }
      const persisted = await stateStore.load();
      if (persisted?.phase !== 'requesting') {
        throw new Error('当前没有需要重新验证的删除申请。');
      }
      if (dependencies.authSessionCoordinator.getCurrentSession() !== null) {
        throw new Error('当前删除申请仍可在本页面继续确认。');
      }
      deletionRecoveryChallenge = await recoveryRepository.requestCode(
        persisted.phoneNumber,
      );
      return deletionRecoveryChallenge;
    },

    async resumeAccountDeletion() {
      const stateStore = dependencies.accountDeletionStateStore;
      if (stateStore === undefined) {
        throw new Error('Web account deletion state store is unavailable.');
      }
      if (
        acceptedDeletionPhoneNumber !== null ||
        registrationReadyPhoneNumber !== null
      ) {
        return submitAccountDeletionRequest();
      }
      const persisted = await stateStore.load();
      if (persisted === null) {
        return {status: 'none'};
      }
      activeAccountPhoneNumber = persisted.phoneNumber;
      if (persisted.phase === 'accepted') {
        return finishAcceptedAccountDeletion(persisted.phoneNumber);
      }
      if (persisted.phase === 'registration_ready') {
        return finishRegistrationReady(persisted.phoneNumber);
      }
      const session = dependencies.authSessionCoordinator.getCurrentSession();
      return session?.mode === 'remote' &&
        session.phoneNumber === persisted.phoneNumber
        ? {status: 'unknown'}
        : {
            phoneNumber: persisted.phoneNumber,
            status: 'reauthentication_required',
          };
    },

    async verifyAccountDeletionRecoverySmsCode(smsCode) {
      const recoveryRepository =
        dependencies.accountDeletionRecoveryRepository;
      const stateStore = dependencies.accountDeletionStateStore;
      if (recoveryRepository === undefined || stateStore === undefined) {
        throw new Error('Web account deletion recovery is unavailable.');
      }
      const persisted = await stateStore.load();
      if (persisted?.phase !== 'requesting') {
        throw new Error('当前没有需要重新验证的删除申请。');
      }
      if (
        deletionRecoveryChallenge === null ||
        deletionRecoveryChallenge.phoneNumber !== persisted.phoneNumber
      ) {
        throw new Error('请先向原手机号获取验证码。');
      }
      const recovery = await recoveryRepository.verifyCode({
        challenge: deletionRecoveryChallenge,
        smsCode,
      });
      deletionRecoveryChallenge = null;
      if (dependencies.authSessionCoordinator.getCurrentSession() !== null) {
        throw new Error('删除恢复不得创建通用登录会话。');
      }
      if (recovery.state === 'pending') {
        acceptedDeletionPhoneNumber = persisted.phoneNumber;
        try {
          await stateStore.mark(persisted.phoneNumber, 'accepted');
        } catch {
          return {status: 'cleanup_required'};
        }
        return finishAcceptedAccountDeletion(persisted.phoneNumber);
      }

      registrationReadyPhoneNumber = persisted.phoneNumber;
      try {
        await stateStore.mark(
          persisted.phoneNumber,
          'registration_ready',
        );
      } catch {
        return {status: 'registration_cleanup_required'};
      }
      return finishRegistrationReady(persisted.phoneNumber);
    },

    subscribeAudioStatus(listener) {
      return dependencies.subscribeAudioStatus?.(listener) ?? (() => undefined);
    },

    async verifySmsCode(phoneNumber, smsCode) {
      const deletionState =
        await dependencies.accountDeletionStateStore?.load();
      if (deletionState !== undefined && deletionState !== null) {
        throw new Error(
          '请先通过删除恢复入口确认原账户状态。',
        );
      }
      if (challenge === null) {
        throw new Error('请先获取短信验证码。');
      }
      const session = await dependencies.authRepository.verifySmsCode({
        challenge,
        phoneNumber,
        smsCode,
      });
      if (session.mode !== 'remote') {
        throw new Error('生产 Web 只接受远端账户会话。');
      }
      await dependencies.authSessionCoordinator.establish(session);
      activeAccountPhoneNumber = session.phoneNumber;
      sessionDeletionRevision =
        dependencies.accountDeletionStateStore === undefined
          ? null
          : await dependencies.accountDeletionStateStore.getRevision();
      challenge = null;
      try {
        return await loadAuthenticatedState();
      } catch (error) {
        throw new WebRemotePostAuthError(error);
      }
    },
  };
}

function createSharedRemoteRuntimeConfig(
  runtime: RemoteWebRuntime,
): SoftbookAppRuntimeConfig {
  const remote = {baseUrl: runtime.baseUrl};
  return {
    accountBootstrap: {mode: 'remote', remote},
    auth: {mode: 'remote', remote},
    clientKind: 'web',
    contentManifest: {
      mode: 'remote',
      remote: {
        ...remote,
        publicKeys: runtime.contentManifestPublicKeys,
      },
    },
    learningSource: {mode: 'remote', remote, track: runtime.track},
    learningState: {mode: 'remote', remote},
    learningTrack: runtime.track,
    membership: {mode: 'remote', remote},
    mutationQueue: {mode: 'local'},
    progressSync: {mode: 'remote', remote},
    spaceState: {mode: 'remote', remote},
  };
}

function createBootstrapRuntimeSessionId() {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `bootstrap-runtime:web-${randomPart}`;
}

function areLearningResultsEqual(
  left: LearningCardResult,
  right: LearningCardResult,
) {
  return (
    left.cardId === right.cardId &&
    left.completedAt === right.completedAt &&
    left.interactionId === right.interactionId &&
    left.isFavorited === right.isFavorited &&
    left.outcome === right.outcome &&
    left.usedHint === right.usedHint &&
    left.usedPeek === right.usedPeek
  );
}
