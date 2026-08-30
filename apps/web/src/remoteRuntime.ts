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
import {
  isRemoteRequestCancellationError,
  RemoteRequestLifecycleError,
} from '../../mobile/src/runtime/remoteRequest';
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
  createWebAccountWriteFence,
  createMemoryOnlyAuthSessionStore,
  createWebLearningEventStorage,
  createWebMutationQueueStorage,
} from './webStorage';
import {
  createWebAccountDeletionStateStore,
  WEB_ACCOUNT_DELETION_STORAGE_KEY,
  type WebAccountDeletionStateStore,
} from './webAccountDeletionState';
import {
  createWebAccountDeletionRecoveryRepository,
  type WebAccountDeletionRecoveryChallenge,
  type WebAccountDeletionRecoveryRepository,
} from './webAccountDeletionRecovery';

type RemoteWebRuntime = Extract<WebRuntime, {mode: 'remote'}>;

type WebAudioAuthority = {
  contentVersion: string;
  deletionRevision: number | null;
  selectionId: string;
  sessionScopeKey: string;
};

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
    authority: WebAudioAuthority,
  ) => Promise<'paused' | 'playing' | 'ready'>;
  stopAudio?: () => void;
  runtimeSessionId?: string;
  runAccountDeletionCleanup?: <Result>(
    scope: {ownerPhoneNumber: string; revision: number},
    operation: () => Promise<Result>,
  ) => Promise<Result>;
  setAccountDeletionQuarantine?: (
    sessionScopeKey: string,
    active: boolean,
  ) => void;
  setAccountWriteRevision?: (revision: number | null) => void;
  subscribeAccountEpochChanges?: (listener: () => void) => () => void;
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

class WebAccountEpochError extends Error {
  constructor(
    message = '账户隔离状态已变化，请完成当前恢复操作。',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WebAccountEpochError';
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
  const accountWriteFence = createWebAccountWriteFence(browserStorage);
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
      storage: createWebLearningEventStorage(browserStorage, accountWriteFence),
    }),
  });
  const mutationQueueRepository = createMutationQueueRepository({
    membershipRepository,
    progressSyncRepository,
    queueManager: new MutationQueueManager({
      storage: createWebMutationQueueStorage(browserStorage, accountWriteFence),
    }),
    spaceStateRepository,
  });

  let activeAudio: {
    cardToken: string;
    generation: number;
    pause: () => void;
    play: () => Promise<void>;
    status: 'paused' | 'playing' | 'ready';
    stop: () => void;
  } | null = null;
  let activeAudioPreparation: AbortController | null = null;
  let audioGeneration = 0;
  const audioStatusListeners = new Set<
    (status: 'error' | 'idle') => void
  >();
  const notifyAudioStatus = (status: 'error' | 'idle') => {
    for (const listener of audioStatusListeners) {
      try {
        listener(status);
      } catch {
        // One view listener cannot block playback cleanup.
      }
    }
  };
  const stopActiveAudio = () => {
    const hadActiveAudio =
      activeAudio !== null || activeAudioPreparation !== null;
    audioGeneration += 1;
    activeAudioPreparation?.abort();
    activeAudioPreparation = null;
    const playback = activeAudio;
    activeAudio = null;
    playback?.stop();
    if (hadActiveAudio) {
      notifyAudioStatus('idle');
    }
  };
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
    runAccountDeletionCleanup: (scope, operation) =>
      accountWriteFence.runDeletionCleanup(scope, operation),
    playAudio: async (card, session, authority) => {
      if (session.contentManifest === null) {
        throw new Error('当前学习内容没有经过签名音频清单校验。');
      }
      const cardToken = JSON.stringify([
        authority.sessionScopeKey,
        authority.deletionRevision,
        authority.selectionId,
        authority.contentVersion,
        card.card_id,
        card.audio?.sha256 ?? 'no-audio',
      ]);
      if (activeAudio?.cardToken === cardToken) {
        const currentAudio = activeAudio;
        if (currentAudio.status === 'playing') {
          currentAudio.pause();
          currentAudio.status = 'paused';
          return 'paused';
        }
        await currentAudio.play();
        if (activeAudio !== currentAudio) {
          throw new Error('卡片音频播放已中断，请重新准备。');
        }
        currentAudio.status = 'playing';
        return 'playing';
      }
      audioGeneration += 1;
      const preparationGeneration = audioGeneration;
      activeAudioPreparation?.abort();
      const previousAudio = activeAudio;
      activeAudio = null;
      previousAudio?.stop();
      const preparationController = new AbortController();
      activeAudioPreparation = preparationController;
      let terminatedDuringPreparation: 'ended' | 'error' | 'stopped' | null =
        null;
      let playback: Awaited<ReturnType<typeof prepareVerifiedCardAudio>>;
      try {
        playback = await prepareVerifiedCardAudio({
          card,
          contentManifest: session.contentManifest,
          dependencies: {
            fetchImpl,
            onPlaybackTerminated(reason) {
              terminatedDuringPreparation = reason;
              if (audioGeneration !== preparationGeneration) {
                return;
              }
              if (activeAudio?.generation === preparationGeneration) {
                activeAudio = null;
              }
              const status = reason === 'error' ? 'error' : 'idle';
              notifyAudioStatus(status);
            },
            signal: preparationController.signal,
          },
        });
      } finally {
        if (activeAudioPreparation === preparationController) {
          activeAudioPreparation = null;
        }
      }
      if (
        audioGeneration !== preparationGeneration ||
        terminatedDuringPreparation !== null
      ) {
        playback.stop();
        throw new RemoteRequestLifecycleError('session_superseded');
      }
      activeAudio = {
        ...playback,
        cardToken,
        generation: preparationGeneration,
        status: 'ready',
      };
      return 'ready';
    },
    stopAudio: stopActiveAudio,
    setAccountDeletionQuarantine(sessionScopeKey, active) {
      if (active) deletionQuarantinedSessionScopes.add(sessionScopeKey);
      else deletionQuarantinedSessionScopes.delete(sessionScopeKey);
    },
    setAccountWriteRevision(revision) {
      accountWriteFence.bindSessionRevision(revision);
    },
    subscribeAccountEpochChanges(listener) {
      const handleStorage = (event: StorageEvent) => {
        if (
          event.key === WEB_ACCOUNT_DELETION_STORAGE_KEY &&
          (event.storageArea === null || event.storageArea === browserStorage)
        ) {
          listener();
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
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
  let challengeDeletionRevision: number | null = null;
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
  dependencies.subscribeAccountEpochChanges?.(() => {
    dependencies.stopAudio?.();
  });

  const readStableDeletionState = async () => {
    const stateStore = dependencies.accountDeletionStateStore;
    if (stateStore === undefined) {
      return {revision: null, state: null};
    }
    const revisionBefore = await stateStore.getRevision();
    const state = await stateStore.load();
    const revisionAfter = await stateStore.getRevision();
    if (revisionBefore !== revisionAfter) {
      throw new WebAccountEpochError();
    }
    return {revision: revisionAfter, state};
  };

  const runAtAccountWriteEpoch = async <Result>(
    expectedRevision: number | null,
    operation: () => Promise<Result> | Result,
  ): Promise<Result> => {
    const runAtNullRevision =
      dependencies.accountDeletionStateStore?.runAtNullRevision;
    if (expectedRevision === null || runAtNullRevision === undefined) {
      return operation();
    }
    let operationFailure: unknown = null;
    try {
      return await runAtNullRevision(expectedRevision, async () => {
        try {
          return await operation();
        } catch (error) {
          operationFailure = error;
          throw error;
        }
      });
    } catch (error) {
      if (operationFailure !== null) {
        throw operationFailure;
      }
      throw new WebAccountEpochError(undefined, {cause: error});
    }
  };

  const runWithAuthenticatedAuthority = async <Result>(
    sessionScopeKey: string,
    deletionRevision: number | null,
    operation: () => Promise<Result> | Result,
  ) => {
    try {
      return await runAtAccountWriteEpoch(deletionRevision, () => {
        const currentScopeKey = getAuthSessionScopeKey(
          dependencies.authSessionCoordinator.getCurrentSession(),
        );
        if (
          currentScopeKey !== sessionScopeKey ||
          sessionDeletionRevision !== deletionRevision
        ) {
          throw new WebAccountEpochError();
        }
        return operation();
      });
    } catch (error) {
      if (
        error instanceof WebAccountEpochError &&
        getAuthSessionScopeKey(
          dependencies.authSessionCoordinator.getCurrentSession(),
        ) === sessionScopeKey
      ) {
        dependencies.stopAudio?.();
      }
      throw error;
    }
  };

  const requireAuthenticatedContext = async () => {
    const session = dependencies.authSessionCoordinator.getCurrentSession();
    if (session === null || session.mode !== 'remote') {
      throw new Error('需要先完成手机号验证。');
    }
    const deletionState = await readStableDeletionState();
    const revisionBefore = deletionState.revision;
    if (sessionDeletionRevision === null) {
      sessionDeletionRevision = revisionBefore;
      dependencies.setAccountWriteRevision?.(revisionBefore);
    }
    if (revisionBefore !== sessionDeletionRevision) {
      const sessionScopeKey = getAuthSessionScopeKey(session);
      if (sessionScopeKey !== null) {
        dependencies.setAccountDeletionQuarantine?.(sessionScopeKey, true);
      }
      dependencies.stopAudio?.();
      throw new WebAccountEpochError();
    }
    if (deletionState.state !== null) {
      if (deletionState.state.phoneNumber !== session.phoneNumber) {
        throw new WebAccountEpochError();
      }
      const sessionScopeKey = getAuthSessionScopeKey(session);
      if (sessionScopeKey === null) {
        throw new Error('Web account deletion session scope is invalid.');
      }
      dependencies.setAccountDeletionQuarantine?.(sessionScopeKey, true);
      dependencies.stopAudio?.();
      throw new WebAccountEpochError(
        '删除结果确认期间已暂停新的账户操作。',
      );
    }
    activeAccountPhoneNumber = session.phoneNumber;
    return {
      authToken: await dependencies.authSessionCoordinator.getAccessToken(),
      phoneNumber: session.phoneNumber,
    };
  };

  const advanceTerminalAccountWriteEpoch = async () => {
    const advanceNullRevision =
      dependencies.accountDeletionStateStore?.advanceNullRevision;
    if (
      sessionDeletionRevision === null ||
      advanceNullRevision === undefined
    ) {
      return;
    }
    try {
      const nextRevision = await advanceNullRevision(sessionDeletionRevision);
      sessionDeletionRevision = nextRevision;
      dependencies.setAccountWriteRevision?.(nextRevision);
    } catch (error) {
      throw new WebAccountEpochError(undefined, {cause: error});
    }
  };

  const clearDurableAccountState = async (
    options: {advanceNullEpoch?: boolean} = {},
  ) => {
    const phoneNumber = activeAccountPhoneNumber;
    if (phoneNumber === null) {
      throw new Error('没有可安全清理的 Web 账户作用域。');
    }
    if (options.advanceNullEpoch) {
      await advanceTerminalAccountWriteEpoch();
    }
    const cleanupResults = await Promise.allSettled([
      dependencies.learningEventSyncRepository.clearAccount(phoneNumber),
      dependencies.mutationQueueRepository.clear(),
    ]);
    if (cleanupResults.some(result => result.status === 'rejected')) {
      throw new Error('退出后的本地待同步状态未能完整清理。');
    }
    dependencies.setAccountWriteRevision?.(null);
    challenge = null;
    challengeDeletionRevision = null;
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
    const cleanup = async (): Promise<WebAccountDeletionOutcome> => {
      dependencies.stopAudio?.();
      if (dependencies.authSessionCoordinator.getCurrentSession() !== null) {
        await dependencies.authSessionCoordinator.invalidate();
      }
      await clearDurableAccountState();
      await stateStore.clear();
      acceptedDeletionPhoneNumber = null;
      return {status: 'accepted'};
    };
    try {
      const revision = await stateStore.getRevision();
      return dependencies.runAccountDeletionCleanup === undefined
        ? await cleanup()
        : await dependencies.runAccountDeletionCleanup(
            {ownerPhoneNumber: phoneNumber, revision},
            cleanup,
          );
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
    const cleanup = async (): Promise<WebAccountDeletionOutcome> => {
      dependencies.stopAudio?.();
      if (dependencies.authSessionCoordinator.getCurrentSession() !== null) {
        await dependencies.authSessionCoordinator.invalidate();
      }
      await clearDurableAccountState();
      await stateStore.clear();
      registrationReadyPhoneNumber = null;
      return {status: 'registration_ready'};
    };
    try {
      const revision = await stateStore.getRevision();
      return dependencies.runAccountDeletionCleanup === undefined
        ? await cleanup()
        : await dependencies.runAccountDeletionCleanup(
            {ownerPhoneNumber: phoneNumber, revision},
            cleanup,
          );
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
    dependencies.stopAudio?.();
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

  const loadAuthenticatedState = async (): Promise<WebRemoteSnapshot> => {
    const context = await requireAuthenticatedContext();
    const requestSessionScopeKey = getAuthSessionScopeKey(
      dependencies.authSessionCoordinator.getCurrentSession(),
    );
    const requestDeletionRevision = sessionDeletionRevision;
    if (requestSessionScopeKey === null) {
      throw new WebAccountEpochError();
    }
    const initialBootstrapGeneration = bootstrapGeneration;
    let requestBootstrapGeneration = initialBootstrapGeneration;
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
      requestBootstrapGeneration += 1;
      return {
        bootstrap,
        observation: {
          forceFresh,
          generation: requestBootstrapGeneration,
          runtimeSessionId,
          schemaVersion: 'account-bootstrap-observation.v1' as const,
        },
      };
    };

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

    const nextSelectionId = learningSession.serverSelection?.selectionId ?? null;
    const nextSnapshot: WebRemoteSnapshot = {
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
    return runWithAuthenticatedAuthority(
      requestSessionScopeKey,
      requestDeletionRevision,
      () => {
        if (bootstrapGeneration !== initialBootstrapGeneration) {
          throw new WebAccountEpochError(
            '较新的账户状态已经先完成，本次迟到结果不会呈现。',
          );
        }
        const previousCardId =
          currentLearningSession?.cards[0]?.card_id ?? null;
        const nextCardId = learningSession.cards[0]?.card_id ?? null;
        const previousSelectionId =
          currentLearningSession?.serverSelection?.selectionId ?? null;
        const previousContentVersion =
          currentLearningSession?.contentVersion ?? null;
        if (
          previousCardId !== null &&
          (previousCardId !== nextCardId ||
            previousSelectionId !== nextSelectionId ||
            previousContentVersion !== learningSession.contentVersion)
        ) {
          dependencies.stopAudio?.();
        }
        currentBootstrap = bootstrap;
        currentLearningSession = learningSession;
        bootstrapGeneration = requestBootstrapGeneration;
        if (
          persistedSelectionId !== null &&
          nextSelectionId !== persistedSelectionId
        ) {
          persistedLearningResult = null;
          persistedSelectionId = null;
        }
        return nextSnapshot;
      },
    );
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
      await clearDurableAccountState({advanceNullEpoch: true});
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
      const requestSessionScopeKey = getAuthSessionScopeKey(
        dependencies.authSessionCoordinator.getCurrentSession(),
      );
      const requestDeletionRevision = sessionDeletionRevision;
      if (requestSessionScopeKey === null) {
        throw new WebAccountEpochError();
      }
      const finish = (sync: WebLearningCompletionSync) =>
        runWithAuthenticatedAuthority(
          requestSessionScopeKey,
          requestDeletionRevision,
          () => sync,
        );
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
        await runWithAuthenticatedAuthority(
          requestSessionScopeKey,
          requestDeletionRevision,
          () => {
            persistedLearningResult = {...result};
            persistedSelectionId = selection.selectionId;
          },
        );
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
        return finish({pendingEventCount, status: 'queued'});
      }
      if (replay.pendingCount !== 0) {
        return finish({
          pendingEventCount: replay.pendingCount,
          status: 'queued',
        });
      }
      return finish({pendingEventCount: 0, status: 'confirmed'});
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
      const deletionStateBeforeLogout = await readStableDeletionState();
      if (
        deletionStateBeforeLogout.state !== null ||
        (sessionDeletionRevision !== null &&
          deletionStateBeforeLogout.revision !== sessionDeletionRevision)
      ) {
        throw new Error(
          '账户删除状态已变化，普通退出不会清理待确认记录。',
        );
      }
      if (currentSession !== null) {
        activeAccountPhoneNumber = currentSession.phoneNumber;
      }
      dependencies.stopAudio?.();
      if (currentSession !== null) {
        await dependencies.authSessionCoordinator.logout();
      }
      const deletionStateAfterLogout = await readStableDeletionState();
      if (
        deletionStateAfterLogout.state !== null ||
        deletionStateAfterLogout.revision !==
          deletionStateBeforeLogout.revision
      ) {
        throw new Error(
          '账户删除状态已变化，普通退出不会清理待确认记录。',
        );
      }
      await clearDurableAccountState({advanceNullEpoch: true});
    },

    async playCardAudio(card) {
      await requireAuthenticatedContext();
      const sessionScopeKey = getAuthSessionScopeKey(
        dependencies.authSessionCoordinator.getCurrentSession(),
      );
      const deletionRevision = sessionDeletionRevision;
      const learningSession = currentLearningSession;
      const selection = learningSession?.serverSelection;
      if (
        learningSession === null ||
        sessionScopeKey === null ||
        selection == null ||
        learningSession.contentVersion === null ||
        learningSession.cards[0]?.card_id !== card.card_id ||
        selection.cardId !== card.card_id
      ) {
        throw new Error('当前没有经过验证的学习内容。');
      }
      const authority = {
        contentVersion: learningSession.contentVersion,
        deletionRevision,
        selectionId: selection.selectionId,
        sessionScopeKey,
      };
      try {
        const status = await dependencies.playAudio(
          card,
          learningSession,
          authority,
        );
        return await runWithAuthenticatedAuthority(
          sessionScopeKey,
          deletionRevision,
          () => {
            const currentSelection =
              currentLearningSession?.serverSelection;
            if (
              currentLearningSession?.contentVersion !==
                authority.contentVersion ||
              currentSelection?.selectionId !== authority.selectionId ||
              currentSelection?.cardId !== card.card_id
            ) {
              throw new WebAccountEpochError(
                'Web audio selection authority changed.',
              );
            }
            return status;
          },
        );
      } catch (error) {
        if (
          getAuthSessionScopeKey(
            dependencies.authSessionCoordinator.getCurrentSession(),
          ) === sessionScopeKey
        ) {
          dependencies.stopAudio?.();
        }
        throw error;
      }
    },

    async requestSmsCode(phoneNumber) {
      const deletionStateBeforeRequest = await readStableDeletionState();
      if (deletionStateBeforeRequest.state !== null) {
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
      const requestedChallenge =
        await dependencies.authRepository.requestSmsCode(phoneNumber);
      const deletionStateAfterRequest = await readStableDeletionState();
      if (
        deletionStateAfterRequest.state !== null ||
        deletionStateAfterRequest.revision !==
          deletionStateBeforeRequest.revision
      ) {
        throw new Error(
          '请先通过删除恢复入口确认原账户状态。',
        );
      }
      challenge = requestedChallenge;
      challengeDeletionRevision = deletionStateAfterRequest.revision;
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
      if (challenge === null) {
        throw new Error('请先获取短信验证码。');
      }
      const deletionStateBeforeVerify = await readStableDeletionState();
      if (
        deletionStateBeforeVerify.state !== null ||
        deletionStateBeforeVerify.revision !== challengeDeletionRevision
      ) {
        throw new Error(
          '请先通过删除恢复入口确认原账户状态。',
        );
      }
      const session = await dependencies.authRepository.verifySmsCode({
        challenge,
        phoneNumber,
        smsCode,
      });
      if (session.mode !== 'remote') {
        throw new Error('生产 Web 只接受远端账户会话。');
      }
      const deletionStateAfterVerify = await readStableDeletionState();
      if (
        deletionStateAfterVerify.state !== null ||
        deletionStateAfterVerify.revision !== challengeDeletionRevision
      ) {
        challenge = null;
        challengeDeletionRevision = null;
        try {
          await dependencies.authRepository.logout(session);
        } catch {
          // The deletion path may already have revoked this unbound session.
        }
        throw new Error(
          '请先通过删除恢复入口确认原账户状态。',
        );
      }
      let sessionEstablished = false;
      try {
        await runAtAccountWriteEpoch(
          deletionStateAfterVerify.revision,
          async () => {
            await dependencies.authSessionCoordinator.establish(session);
            sessionEstablished = true;
            activeAccountPhoneNumber = session.phoneNumber;
            sessionDeletionRevision = deletionStateAfterVerify.revision;
            dependencies.setAccountWriteRevision?.(sessionDeletionRevision);
          },
        );
      } catch (error) {
        const rejectedSessionScopeKey = getAuthSessionScopeKey(session);
        const currentSessionScopeKey = getAuthSessionScopeKey(
          dependencies.authSessionCoordinator.getCurrentSession(),
        );
        const rejectedSessionIsCurrent =
          sessionEstablished &&
          currentSessionScopeKey === rejectedSessionScopeKey;
        if (rejectedSessionIsCurrent) {
          try {
            await dependencies.authSessionCoordinator.invalidate();
          } catch {
            // Epoch rejection remains authoritative over memory cleanup errors.
          }
          dependencies.setAccountWriteRevision?.(null);
          sessionDeletionRevision = null;
          activeAccountPhoneNumber = null;
        }
        challenge = null;
        challengeDeletionRevision = null;
        try {
          await dependencies.authRepository.logout(session);
        } catch {
          // The deletion path may already have revoked this unbound session.
        }
        throw error instanceof WebAccountEpochError
          ? error
          : new Error('手机号验证后的账户建立没有安全完成。', {
              cause: error,
            });
      }
      challenge = null;
      challengeDeletionRevision = null;
      try {
        return await loadAuthenticatedState();
      } catch (error) {
        let accountAuthorityChanged = error instanceof WebAccountEpochError;
        if (!accountAuthorityChanged) {
          try {
            const currentDeletionState = await readStableDeletionState();
            accountAuthorityChanged =
              currentDeletionState.state !== null ||
              currentDeletionState.revision !== sessionDeletionRevision ||
              getAuthSessionScopeKey(
                dependencies.authSessionCoordinator.getCurrentSession(),
              ) !== getAuthSessionScopeKey(session);
          } catch {
            accountAuthorityChanged = true;
          }
        }
        if (accountAuthorityChanged) {
          const rejectedSessionScopeKey = getAuthSessionScopeKey(session);
          const rejectedSessionIsCurrent =
            getAuthSessionScopeKey(
              dependencies.authSessionCoordinator.getCurrentSession(),
            ) === rejectedSessionScopeKey;
          if (rejectedSessionIsCurrent) {
            dependencies.stopAudio?.();
            try {
              await dependencies.authSessionCoordinator.invalidate();
            } catch {
              // Epoch rejection remains authoritative over memory cleanup errors.
            }
            dependencies.setAccountWriteRevision?.(null);
            sessionDeletionRevision = null;
            activeAccountPhoneNumber = null;
          }
          try {
            await dependencies.authRepository.logout(session);
          } catch {
            // The deletion path may already have revoked this session.
          }
          throw error instanceof WebAccountEpochError
            ? error
            : new WebAccountEpochError(undefined, {cause: error});
        }
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
