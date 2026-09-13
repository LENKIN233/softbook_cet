import {frontMaterial, eliminationPassage, answerComparison, spaceCardPreview} from '../../mobile/src/learning/presentation';
import {resolveLibraryTone} from '../../mobile/src/visual/tokens';
import {useObjectMotion, useRouteMotion, transitionObjectName} from './motion';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  LearningCard,
  LearningCardResult,
  LearningCardState,
  LearningSession,
} from '../../mobile/src/learning/model';
import {INTERACTION_LABELS} from '../../mobile/src/learning/model';
import {
  canSubmitLearningCard,
  createLearningCardState,
  evaluateLearningCard,
  selectLockOption,
  summarizeLearningResults,
} from '../../mobile/src/learning/sessionCore';
import {
  createInitialMembershipState,
  resolveAccessibleLearningCardCount,
  resolveMembershipAccess,
  type MembershipState,
} from '../../mobile/src/membership/localMembership';
import {getUserFacingErrorMessage} from '../../mobile/src/runtime/userFacingError';
import {findClientUpdateRequiredError} from '../../mobile/src/runtime/clientVersion';
import {formatSpaceDisplayName} from '../../mobile/src/shared/uiMetadata/displayMetadata';
import {
  createWebRemoteRuntime,
  WebRemotePostAuthError,
  type WebAccountDeletionOutcome,
  type WebAccountPresentationInvalidation,
  type WebRemoteSnapshot,
  type WebLearningCompletionSync,
} from './remoteRuntime';
import {resolveWebRuntime} from './runtime';

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type AuthStage = 'phone' | 'code' | 'authenticated';
type AccountDeletionStage =
  | 'accepted'
  | 'checking'
  | 'cleanup_required'
  | 'confirming'
  | 'none'
  | 'registration_cleanup_required'
  | 'registration_ready'
  | 'recovery_code'
  | 'recovery_phone'
  | 'session_cleanup_required'
  | 'submitting'
  | 'unknown';

const ROUTES: {id: RouteKey; label: string}[] = [
  {id: 'learning', label: '学习'},
  {id: 'space', label: '空间'},
  {id: 'statistics', label: '统计'},
  {id: 'mine', label: '我的'},
];

function RouteIcon({route}: {route: RouteKey}) {
  if (route === 'learning') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3v-12Z"/><path d="M17 7.5h2a2 2 0 0 1 2 2v10h-8"/><path d="M8.5 9h5M8.5 12.5h5"/></svg>;
  }
  if (route === 'space') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 12 3l8 3.5-8 3.5-8-3.5Z"/><path d="m4 11 8 3.5 8-3.5M4 15.5l8 3.5 8-3.5"/></svg>;
  }
  if (route === 'statistics') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9m7 10V5m7 14v-7"/></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>;
}

function libraryStyle(library?: string): React.CSSProperties {
  const tone = resolveLibraryTone(library);
  const channels = tone.accent.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return {'--hall': tone.accent, '--hall-soft': tone.accentSoft, '--hall-deep': '#41464F', '--on-hall': 1.05 / (luminance + 0.05) >= 4.5 ? '#FFFFFF' : '#0B0B14'} as React.CSSProperties;
}

const PHONE_PATTERN = /^1\d{10}$/;

type AppProps = {
  remoteRuntimeFactory?: typeof createWebRemoteRuntime;
};

export function App({
  remoteRuntimeFactory = createWebRemoteRuntime,
}: AppProps = {}) {
  const runtime = useMemo(() => resolveWebRuntime(), []);
  const remoteController = useMemo(() => {
    if (runtime.mode !== 'remote') return null;
    try {
      return remoteRuntimeFactory(runtime);
    } catch {
      return null;
    }
  }, [remoteRuntimeFactory, runtime]);
  const [session, setSession] = useState<LearningSession | null>(null);
  const [authStage, setAuthStage] = useState<AuthStage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [route, setRoute] = useState<RouteKey>('learning');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [learningPhase, setLearningPhase] = useState<'learning' | 'review'>('learning');
  const [reviewCards, setReviewCards] = useState<LearningCard[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [cardState, setCardState] = useState<LearningCardState | null>(() =>
    null,
  );
  const [results, setResults] = useState<LearningCardResult[]>([]);
  const [resolved, setResolved] = useState<LearningCardResult | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sleeping, setSleeping] = useState<string[]>([]);
  const [membership, setMembership] = useState<MembershipState | null>(() =>
    runtime.mode === 'development' ? createInitialMembershipState() : null,
  );
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const [audioStatus, setAudioStatus] = useState<
    'idle' | 'loading' | 'paused' | 'playing' | 'ready' | 'error'
  >('idle');
  const [spaceSync, setSpaceSync] = useState<
    WebRemoteSnapshot['spaceSync'] | null
  >(null);
  const [learningSync, setLearningSync] = useState<
    WebRemoteSnapshot['learningSync'] | null
  >(null);
  const [checkInSync, setCheckInSync] = useState<
    WebRemoteSnapshot['checkInSync'] | null
  >(null);
  const [queuedLearningResult, setQueuedLearningResult] =
    useState<LearningCardResult | null>(null);
  const [rejectedCompletion, setRejectedCompletion] = useState(false);
  const [accountDeletionStage, setAccountDeletionStage] =
    useState<AccountDeletionStage>(
      runtime.mode === 'remote' ? 'checking' : 'none',
    );
  const routeMotion = useRouteMotion(`${authStage}:${phone}:${accountDeletionStage}`);
  const navigateRoute = (next: RouteKey) => {
    if (route === 'learning' && next !== 'learning') {
      audioRequestGeneration.current += 1;
      remoteController?.stopCardAudio?.();
      setAudioStatus('idle');
    }
    routeMotion(() => setRoute(next));
  };
  const resolutionInFlight = useRef(false);
  const audioRequestGeneration = useRef(0);
  const accountAuthorityGeneration = useRef(0);
  const handleAccountPresentationInvalidation = useEffectEvent(
    (event: WebAccountPresentationInvalidation) => {
      const generation = accountAuthorityGeneration.current + 1;
      accountAuthorityGeneration.current = generation;
      resetAccountState();
      setRemoteBusy(false);
      if (event.source === 'session_authority') {
        if (
          event.reason === 'authorization_invalidated' &&
          remoteController !== null
        ) {
          setAccountDeletionStage('checking');
          void Promise.resolve()
            .then(() => remoteController.cleanupInvalidatedSession())
            .then(outcome => {
              if (accountAuthorityGeneration.current !== generation) {
                return;
              }
              if (outcome !== null && outcome.status !== 'none') {
                applyAccountDeletionOutcome(outcome);
                return;
              }
              setAccountDeletionStage('none');
              setAuthError('登录已失效，请重新验证。');
            })
            .catch(() => {
              if (accountAuthorityGeneration.current === generation) {
                setAccountDeletionStage('session_cleanup_required');
              }
            });
          return;
        }
        setAccountDeletionStage('none');
        setAuthError('登录已失效，请重新验证。');
        return;
      }
      setAccountDeletionStage('checking');
      if (remoteController === null) {
        return;
      }
      void Promise.resolve()
        .then(() => remoteController.resumeAccountDeletion())
        .then(outcome => {
          if (accountAuthorityGeneration.current === generation) {
            applyAccountDeletionOutcome(outcome);
          }
        })
        .catch(() => {
          if (accountAuthorityGeneration.current === generation) {
            setAccountDeletionStage('unknown');
          }
        });
    },
  );

  const activeCards = runtime.mode === 'remote'
    ? session?.cards ?? []
    : learningPhase === 'review'
    ? reviewCards
    : session?.cards ?? [];
  const currentCard = activeCards[currentIndex] ?? null;
  const membershipAccess = membership
    ? resolveMembershipAccess(membership)
    : null;
  const accessibleSpaceCards = runtime.mode === 'remote'
    ? session?.catalogCards ?? []
    : membership && session
    ? session.catalogCards.slice(
        0,
        resolveAccessibleLearningCardCount(
          session.catalogCards.length,
          membership,
        ),
      )
    : [];
  const spaceCards = membershipAccess?.completePhysicalSpace
    ? session?.catalogCards ?? []
    : accessibleSpaceCards;
  const remoteSyncFacts = [
    checkInSync?.status === 'queued' ? '今日签到等待同步' : null,
    (learningSync?.pendingEventCount ?? 0) > 0
      ? `${learningSync?.pendingEventCount} 项学习结果等待同步`
      : null,
    (learningSync?.rejectedEventCount ?? 0) > 0
      ? `${learningSync?.rejectedEventCount} 次学习结果未计入`
      : null,
    (spaceSync?.rejectedActionCount ?? 0) > 0
      ? `${spaceSync?.rejectedActionCount ?? 0} 项空间操作已被拒绝`
      : null,
    (spaceSync?.pendingActionCount ?? 0) > 0
      ? `${spaceSync?.pendingActionCount ?? 0} 项空间操作等待同步`
      : null,
  ].filter((fact): fact is string => fact !== null);
  const genericSyncStatus = runtime.mode === 'remote'
    ? remoteSyncFacts.join('；') || '服务端已确认'
    : '当前设备可继续';
  const remoteCleanupPending =
    runtime.mode === 'remote' &&
    authStage === 'authenticated' &&
    remoteController !== null &&
    !remoteController.isAuthenticated();
  const accountDeletionLocksAccount =
    accountDeletionStage === 'submitting' ||
    accountDeletionStage === 'unknown' ||
    accountDeletionStage === 'recovery_code' ||
    accountDeletionStage === 'recovery_phone' ||
    accountDeletionStage === 'registration_cleanup_required' ||
    accountDeletionStage === 'session_cleanup_required' ||
    accountDeletionStage === 'cleanup_required';
  const productBusy =
    remoteBusy ||
    remoteCleanupPending ||
    accountDeletionLocksAccount ||
    rejectedCompletion ||
    (learningSync?.pendingEventCount ?? 0) > 0;

  useEffect(() => {
    if (remoteController === null) {
      return;
    }
    const unsubscribePresentation =
      remoteController.subscribeAccountPresentationInvalidation(
        handleAccountPresentationInvalidation,
      );
    remoteController.start();
    return () => {
      unsubscribePresentation();
      remoteController.dispose();
    };
  }, [remoteController]);

  useEffect(() => {
    let active = true;
    if (!import.meta.env.DEV || runtime.mode !== 'development') return;

    import('../../mobile/src/learning/session').then(({createLocalLearningSession}) => {
      if (!active) return;
      const nextSession = createLocalLearningSession(runtime.track);
      setSession(nextSession);
      setCardState(
        nextSession.cards[0] ? createLearningCardState(nextSession.cards[0]) : null,
      );
    });

    return () => {
      active = false;
    };
  }, [runtime]);

  useEffect(() => {
    let active = true;
    const generation = accountAuthorityGeneration.current;
    if (runtime.mode !== 'remote' || remoteController === null) {
      setAccountDeletionStage('none');
      return;
    }
    void remoteController
      .resumeAccountDeletion()
      .then(outcome => {
        if (!active || accountAuthorityGeneration.current !== generation) {
          return;
        }
        setAccountDeletionStage(
          outcome.status === 'accepted'
            ? 'accepted'
            : outcome.status === 'cleanup_required'
            ? 'cleanup_required'
            : outcome.status === 'unknown'
            ? 'unknown'
            : outcome.status === 'reauthentication_required'
            ? 'recovery_phone'
            : outcome.status === 'registration_cleanup_required'
            ? 'registration_cleanup_required'
            : outcome.status === 'registration_ready'
            ? 'registration_ready'
            : outcome.status === 'session_cleanup_required'
            ? 'session_cleanup_required'
            : 'none',
        );
        if (outcome.status === 'reauthentication_required') {
          setPhone(outcome.phoneNumber);
          setCode('');
        }
      })
      .catch(() => {
        if (
          active &&
          accountAuthorityGeneration.current === generation
        ) {
          setAccountDeletionStage('unknown');
        }
      });
    return () => {
      active = false;
    };
  }, [remoteController, runtime.mode]);

  useEffect(() => {
    if (remoteController === null) {
      return;
    }
    return remoteController.subscribeAudioStatus(status => {
      setAudioStatus(status);
      if (status === 'error') {
        setRemoteError('卡片音频播放已中断，请重试。');
      }
    });
  }, [remoteController]);

  useLayoutEffect(() => {
    window.scrollTo({behavior: 'auto', top: 0});
  }, [currentIndex, currentCard?.card_id, session?.serverSelection?.selectionId, learningPhase, route]);

  function applyRemoteSnapshot(snapshot: WebRemoteSnapshot) {
    const nextSession = snapshot.learningSession;
    const nextCard = nextSession.cards[0] ?? null;
    const previousSelectionId = session?.serverSelection?.selectionId ?? null;
    const nextSelectionId = nextSession.serverSelection?.selectionId ?? null;
    const preservesCurrentCardDraft =
      previousSelectionId !== null &&
      previousSelectionId === nextSelectionId &&
      session?.contentVersion === nextSession.contentVersion &&
      session?.serverSelection?.phase === nextSession.serverSelection?.phase &&
      currentCard !== null &&
      nextCard?.card_id === currentCard.card_id;
    setSession(nextSession);
    setCurrentIndex(0);
    setLearningPhase(nextSession.serverSelection?.phase ?? 'learning');
    setReviewCards([]);
    setSessionComplete(nextSession.cards.length === 0);
    setResults([...snapshot.learningResults, ...snapshot.reviewResults]);
    if (!preservesCurrentCardDraft) {
      audioRequestGeneration.current += 1;
      setResolved(null);
    }
    setFavorites(snapshot.favorites);
    setSleeping(snapshot.sleeping);
    setSpaceSync(snapshot.spaceSync);
    setLearningSync(snapshot.learningSync);
    setCheckInSync(snapshot.checkInSync);
    if (!preservesCurrentCardDraft) {
      setQueuedLearningResult(null);
      setRejectedCompletion(false);
    }
    setMembership(snapshot.membership);
    setCardState(previous => {
      if (preservesCurrentCardDraft && previous !== null && nextCard !== null) {
        return {
          ...previous,
          isFavorited: snapshot.favorites.includes(nextCard.card_id),
        };
      }
      return nextCard ? withFavoriteState(nextCard, snapshot.favorites) : null;
    });
    setRemoteError(
      snapshot.spaceSync.rejectedActionCount > 0
        ? '空间操作未被服务端接受，已停止自动重试。请重新读取后再操作。'
        : '',
    );
    if (!preservesCurrentCardDraft) {
      setAudioStatus('idle');
    }
  }

  async function requestCode() {
    if (!PHONE_PATTERN.test(phone)) {
      setAuthError('请输入 11 位中国大陆手机号。');
      return;
    }
    if (runtime.mode === 'unavailable') {
      setAuthError(runtime.reason);
      return;
    }
    if (runtime.mode === 'remote') {
      if (remoteController === null) {
        setAuthError('服务配置尚未完整，请稍后再试。');
        return;
      }
      const generation = accountAuthorityGeneration.current;
      setRemoteBusy(true);
      setAuthError('');
      try {
        await remoteController.requestSmsCode(phone);
        if (accountAuthorityGeneration.current !== generation) {
          return;
        }
        setAuthStage('code');
      } catch (error) {
        if (accountAuthorityGeneration.current !== generation) {
          return;
        }
        setAuthError(
          getUserFacingErrorMessage(error, '暂时无法发送验证码，请稍后再试。'),
        );
      } finally {
        if (accountAuthorityGeneration.current === generation) {
          setRemoteBusy(false);
        }
      }
      return;
    }
    setAuthError('');
    setAuthStage('code');
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) {
      setAuthError('请输入 6 位验证码。');
      return;
    }
    if (runtime.mode === 'remote') {
      if (remoteController === null) {
        setAuthError('服务配置尚未完整，请稍后再试。');
        return;
      }
      const generation = accountAuthorityGeneration.current;
      setRemoteBusy(true);
      setAuthError('');
      try {
        const snapshot = await remoteController.verifySmsCode(phone, code);
        if (accountAuthorityGeneration.current !== generation) {
          return;
        }
        setCode('');
        setAuthStage('authenticated');
        applyRemoteSnapshot(snapshot);
      } catch (error) {
        if (accountAuthorityGeneration.current !== generation) {
          return;
        }
        if (findClientUpdateRequiredError(error)) {
          setCode('');
          setAuthStage('authenticated');
          setRemoteError(
            '当前版本需要更新；请刷新到最新版本后继续，登录状态会保留。',
          );
        } else if (error instanceof WebRemotePostAuthError) {
          if (!remoteController.isAuthenticated()) {
            try {
              await remoteController.cleanupInvalidatedSession();
              if (accountAuthorityGeneration.current !== generation) {
                return;
              }
              resetAccountState();
              setAuthError('登录已失效，请重新验证。');
            } catch {
              if (accountAuthorityGeneration.current !== generation) {
                return;
              }
              setCode('');
              setAuthStage('authenticated');
              setRemoteError('登录已失效，本地待同步记录尚未安全清理。请重试退出。');
            }
            return;
          }
          setCode('');
          setAuthStage('authenticated');
          setRemoteError('账户已验证，当前学习状态暂时无法读取。');
        } else {
          setAuthError(
            getUserFacingErrorMessage(error, '验证码暂时没通过，请稍后再试。'),
          );
        }
      } finally {
        if (accountAuthorityGeneration.current === generation) {
          setRemoteBusy(false);
        }
      }
      return;
    }
    if (runtime.mode === 'development' && import.meta.env.DEV) {
      const {startMembershipTrial} =
        await import('../../mobile/src/membership/localMembership');
      setMembership(previous =>
        startMembershipTrial(previous ?? createInitialMembershipState()),
      );
      setAuthError('');
      setAuthStage('authenticated');
    }
  }

  async function reloadRemoteState() {
    if (remoteController === null) return;
    const generation = accountAuthorityGeneration.current;
    setRemoteBusy(true);
    try {
      const snapshot = await remoteController.loadAuthenticatedState();
      if (accountAuthorityGeneration.current === generation) applyRemoteSnapshot(snapshot);
    } catch (error) {
      if (accountAuthorityGeneration.current === generation) await handleRemoteFailure(error, '当前学习状态暂时无法读取。');
    } finally {
      if (accountAuthorityGeneration.current === generation) setRemoteBusy(false);
    }
  }

  async function toggleFavorite(cardId: string) {
    const nextActive = !favorites.includes(cardId);
    if (!membershipAccess?.completePhysicalSpace) {
      setRemoteError('完整物理空间需要试用或会员，当前不能修改喜欢状态。');
      return;
    }
    if (runtime.mode === 'remote') {
      if (remoteController === null) return;
      setRemoteBusy(true);
      try {
        applyRemoteSnapshot(
          await remoteController.applySpaceState(
            cardId,
            'favorite',
            nextActive,
          ),
        );
      } catch (error) {
        await handleRemoteFailure(error, '喜欢状态暂时没有更新。');
      } finally {
        setRemoteBusy(false);
      }
      return;
    }
    setFavorites(
      nextActive
        ? unique([...favorites, cardId])
        : favorites.filter(id => id !== cardId),
    );
    if (currentCard?.card_id === cardId) {
      setCardState(state => state ? {...state, isFavorited: nextActive} : state);
    }
  }

  function resetAccountState() {
    audioRequestGeneration.current += 1;
    setAuthStage('phone');
    setPhone('');
    setCode('');
    setAuthError('');
    setRoute('learning');
    setCurrentIndex(0);
    setLearningPhase('learning');
    setReviewCards([]);
    setSessionComplete(false);
    setResults([]);
    setResolved(null);
    setFavorites([]);
    setSleeping([]);
    setMembership(
      runtime.mode === 'development' ? createInitialMembershipState() : null,
    );
    if (runtime.mode === 'development') {
      setCardState(
        session?.cards[0] ? createLearningCardState(session.cards[0]) : null,
      );
    } else {
      setSession(null);
      setCardState(null);
    }
    setRemoteError('');
    setAudioStatus('idle');
    setSpaceSync(null);
    setLearningSync(null);
    setCheckInSync(null);
    setQueuedLearningResult(null);
    setRejectedCompletion(false);
    setAccountDeletionStage('none');
  }

  function applyAccountDeletionOutcome(outcome: WebAccountDeletionOutcome) {
    if (outcome.status === 'accepted') {
      resetAccountState();
      setAccountDeletionStage('accepted');
      return;
    }
    if (outcome.status === 'cleanup_required') {
      setAccountDeletionStage('cleanup_required');
      return;
    }
    if (outcome.status === 'unknown') {
      setAccountDeletionStage('unknown');
      return;
    }
    if (outcome.status === 'reauthentication_required') {
      setPhone(outcome.phoneNumber);
      setCode('');
      setAuthError('');
      setAccountDeletionStage('recovery_phone');
      return;
    }
    if (outcome.status === 'registration_cleanup_required') {
      setAccountDeletionStage('registration_cleanup_required');
      return;
    }
    if (outcome.status === 'registration_ready') {
      resetAccountState();
      setAccountDeletionStage('registration_ready');
      return;
    }
    if (outcome.status === 'session_cleanup_required') {
      setAccountDeletionStage('session_cleanup_required');
      return;
    }
    setAccountDeletionStage('none');
  }

  async function signOut() {
    if (runtime.mode === 'remote' && remoteController !== null) {
      setRemoteBusy(true);
      try {
        const outcome = await remoteController.logout();
        if (outcome !== null && outcome.status !== 'none') {
          applyAccountDeletionOutcome(outcome);
          return;
        }
        resetAccountState();
      } catch {
        try {
          const deletionOutcome =
            await remoteController.resumeAccountDeletion();
          if (
            deletionOutcome.status === 'none' &&
            !remoteController.isAuthenticated()
          ) {
            resetAccountState();
            return;
          }
          if (deletionOutcome.status !== 'none') {
            applyAccountDeletionOutcome(deletionOutcome);
            return;
          }
        } catch {
          // Preserve the authenticated recovery shell below when state is unreadable.
        }
        setRemoteError('本地待同步记录尚未安全清理，当前页面不会退出。请重试。');
      } finally {
        setRemoteBusy(false);
      }
      return;
    }
    resetAccountState();
  }

  async function handleRemoteFailure(error: unknown, fallback: string) {
    if (remoteController !== null && !remoteController.isAuthenticated()) {
      try {
        const outcome = await remoteController.cleanupInvalidatedSession();
        if (outcome !== null && outcome.status !== 'none') {
          applyAccountDeletionOutcome(outcome);
          return;
        }
        resetAccountState();
        setAuthError('登录已失效，请重新验证。');
      } catch {
        setRemoteError('登录已失效，本地待同步记录尚未安全清理。请重试退出。');
      }
      return;
    }
    setRemoteError(getUserFacingErrorMessage(error, fallback));
  }

  async function resolveCurrentCard(stateOverride?: LearningCardState) {
    const stateToResolve = stateOverride ?? cardState;
    if (!currentCard || !stateToResolve || resolved || queuedLearningResult || resolutionInFlight.current) return;
    const next = evaluateLearningCard(currentCard, stateToResolve);
    if (!next) return;
    setCardState(stateToResolve);

    if (runtime.mode === 'remote') {
      if (remoteController === null) return;
      const generation = accountAuthorityGeneration.current;
      resolutionInFlight.current = true;
      setRemoteBusy(true);
      try {
        const completionSync =
          await remoteController.completeCurrentCard(next);
        if (accountAuthorityGeneration.current !== generation) return;
        setLearningSync(completionSync);
        const status = currentCompletionStatus(completionSync);
        if (status === 'rejected') {
          await recoverRejectedCompletion(next);
          return;
        }
        if (status === 'queued') {
          setQueuedLearningResult({...next});
          setRejectedCompletion(false);
          setRemoteError('学习结果已安全保存，正在等待服务端确认。');
          return;
        }
        presentAcknowledgedLearningResult(next);
      } catch (error) {
        if (accountAuthorityGeneration.current === generation) await handleRemoteFailure(error, '当前学习结果暂时没有同步。');
      } finally {
        if (accountAuthorityGeneration.current === generation) {
          resolutionInFlight.current = false;
          setRemoteBusy(false);
        }
      }
      return;
    }

    setResolved(next);
    setResults(previous => [...previous.filter(item => item.cardId !== next.cardId), next]);
    setFavorites(previous => stateToResolve.isFavorited
      ? unique([...previous, currentCard.card_id])
      : previous.filter(id => id !== currentCard.card_id));
  }

  async function continueLearning() {
    if (runtime.mode === 'remote') {
      await reloadRemoteState();
      return;
    }
    if (!activeCards.length) return;
    if (currentIndex >= activeCards.length - 1) {
      setResolved(null);
      setSessionComplete(true);
      return;
    }
    const nextIndex = currentIndex + 1;
    const nextState = withFavoriteState(activeCards[nextIndex], favorites);
    setResolved(null);
    setCurrentIndex(nextIndex);
    setCardState(nextState);
  }

  function presentAcknowledgedLearningResult(result: LearningCardResult) {
    setResolved(result);
    setResults(previous => [
      ...previous.filter(item => item.cardId !== result.cardId),
      result,
    ]);
    setQueuedLearningResult(null);
    setRejectedCompletion(false);
    setRemoteError('');
  }

  async function recoverRejectedCompletion(result: LearningCardResult) {
    if (remoteController === null) return;
    const generation = accountAuthorityGeneration.current;
    setQueuedLearningResult({...result});
    setRejectedCompletion(true);
    setResolved(null);
    try {
      const snapshot = await remoteController.loadAuthenticatedState();
      if (accountAuthorityGeneration.current !== generation) return;
      applyRemoteSnapshot(snapshot);
      setQueuedLearningResult(null);
      setRejectedCompletion(false);
      setRemoteError('这次结果未计入，学习安排已更新，可以继续。');
    } catch (error) {
      if (accountAuthorityGeneration.current === generation) await handleRemoteFailure(error, '这次结果未计入，暂时无法更新学习安排。请重新读取。');
    }
  }

  async function retryQueuedLearningResult() {
    if (remoteController === null || queuedLearningResult === null) {
      return;
    }
    const generation = accountAuthorityGeneration.current;
    setRemoteBusy(true);
    try {
      const completionSync =
        await remoteController.completeCurrentCard(queuedLearningResult);
      if (accountAuthorityGeneration.current !== generation) return;
      setLearningSync(completionSync);
      const status = currentCompletionStatus(completionSync);
      if (status === 'rejected') {
        await recoverRejectedCompletion(queuedLearningResult);
        return;
      }
      if (status === 'queued') {
        setRemoteError('学习结果已安全保存，仍在等待服务端确认。');
        return;
      }
      presentAcknowledgedLearningResult(queuedLearningResult);
    } catch (error) {
      if (accountAuthorityGeneration.current === generation) await handleRemoteFailure(error, '当前学习结果暂时没有同步。');
    } finally {
      if (accountAuthorityGeneration.current === generation) setRemoteBusy(false);
    }
  }

  async function playCurrentAudio() {
    if (runtime.mode !== 'remote' || remoteController === null || !currentCard) {
      return;
    }
    const requestGeneration = audioRequestGeneration.current + 1;
    audioRequestGeneration.current = requestGeneration;
    setRemoteError('');
    setAudioStatus('loading');
    try {
      const status = await remoteController.playCardAudio(currentCard);
      if (audioRequestGeneration.current === requestGeneration) {
        setAudioStatus(status);
      }
    } catch (error) {
      if (audioRequestGeneration.current !== requestGeneration) {
        return;
      }
      setAudioStatus('error');
      await handleRemoteFailure(error, '卡片音频暂时无法播放。');
    }
  }

  async function submitCheckIn() {
    if (runtime.mode !== 'remote' || remoteController === null) return;
    setRemoteBusy(true);
    setRemoteError('');
    try {
      const snapshot = await remoteController.checkInToday();
      applyRemoteSnapshot(snapshot);
      setRemoteError(
        snapshot.checkInSync.status === 'queued'
          ? '签到已安全保存，正在等待服务端确认。'
          : '',
      );
    } catch (error) {
      await handleRemoteFailure(error, '今天的签到暂时没有确认。');
    } finally {
      setRemoteBusy(false);
    }
  }

  async function submitAccountDeletion() {
    if (runtime.mode !== 'remote' || remoteController === null) return;
    const generation = accountAuthorityGeneration.current;
    setAccountDeletionStage('submitting');
    setRemoteBusy(true);
    setRemoteError('');
    try {
      const outcome = await remoteController.requestAccountDeletion();
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      applyAccountDeletionOutcome(outcome);
    } catch (error) {
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      setAccountDeletionStage('confirming');
      setRemoteError(
        getUserFacingErrorMessage(error, '删除申请暂时无法安全提交。'),
      );
    } finally {
      if (accountAuthorityGeneration.current === generation) {
        setRemoteBusy(false);
      }
    }
  }

  async function requestAccountDeletionRecoveryCode() {
    if (remoteController === null) return;
    const generation = accountAuthorityGeneration.current;
    setRemoteBusy(true);
    setAuthError('');
    try {
      await remoteController.requestAccountDeletionRecoverySmsCode();
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      setCode('');
      setAccountDeletionStage('recovery_code');
    } catch (error) {
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      setAuthError(
        getUserFacingErrorMessage(error, '暂时无法发送验证码，请稍后再试。'),
      );
    } finally {
      if (accountAuthorityGeneration.current === generation) {
        setRemoteBusy(false);
      }
    }
  }

  async function retryAccountDeletionRecoveryState() {
    if (remoteController === null) return;
    const generation = accountAuthorityGeneration.current;
    setRemoteBusy(true);
    setAuthError('');
    try {
      const outcome = await remoteController.resumeAccountDeletion();
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      if (outcome.status === 'none' && !remoteController.isAuthenticated()) {
        resetAccountState();
        setAccountDeletionStage('none');
        return;
      }
      applyAccountDeletionOutcome(outcome);
    } catch (error) {
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      setAuthError(
        getUserFacingErrorMessage(error, '账户状态暂时无法安全恢复。'),
      );
    } finally {
      if (accountAuthorityGeneration.current === generation) {
        setRemoteBusy(false);
      }
    }
  }

  async function verifyAccountDeletionRecoveryCode() {
    if (remoteController === null) return;
    if (!/^\d{6}$/.test(code)) {
      setAuthError('请输入 6 位验证码。');
      return;
    }
    const generation = accountAuthorityGeneration.current;
    setRemoteBusy(true);
    setAuthError('');
    try {
      const outcome =
        await remoteController.verifyAccountDeletionRecoverySmsCode(code);
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      setCode('');
      applyAccountDeletionOutcome(outcome);
    } catch (error) {
      if (accountAuthorityGeneration.current !== generation) {
        return;
      }
      setAuthError(
        getUserFacingErrorMessage(error, '验证码暂时没通过，请稍后再试。'),
      );
    } finally {
      if (accountAuthorityGeneration.current === generation) {
        setRemoteBusy(false);
      }
    }
  }

  if (
    runtime.mode === 'remote' &&
    (accountDeletionStage === 'recovery_phone' ||
      accountDeletionStage === 'recovery_code')
  ) {
    return (
      <AccountDeletionRecoverySurface
        busy={remoteBusy}
        code={code}
        errorMessage={authError}
        onCodeChange={setCode}
        onRequestCode={() => void requestAccountDeletionRecoveryCode()}
        onVerifyCode={() => void verifyAccountDeletionRecoveryCode()}
        phone={phone}
        stage={accountDeletionStage}
      />
    );
  }

  if (
    runtime.mode === 'remote' &&
    ([
      'accepted',
      'checking',
      'cleanup_required',
      'registration_cleanup_required',
      'registration_ready',
      'session_cleanup_required',
    ].includes(accountDeletionStage) ||
      (accountDeletionStage === 'unknown' &&
        authStage !== 'authenticated'))
  ) {
    return (
      <AccountDeletionStatusSurface
        busy={remoteBusy}
        errorMessage={authError}
        stage={accountDeletionStage as
          | 'accepted'
          | 'checking'
          | 'cleanup_required'
          | 'registration_cleanup_required'
          | 'registration_ready'
          | 'session_cleanup_required'
          | 'unknown'}
        onReturn={() => setAccountDeletionStage('none')}
        onRetry={() => void retryAccountDeletionRecoveryState()}
      />
    );
  }

  if (authStage !== 'authenticated') {
    return (
      <main className="auth-shell">
        <section className="auth-object" aria-labelledby="auth-title">
          <div className="brand-lockup"><span aria-hidden="true" className="brand-mark">软</span><span className="wordmark">软书四六级</span></div>
          <p className="eyebrow">同一账户 · 连续学习</p>
          <h1 id="auth-title" className="auth-title">
            <span>验证后开始</span>
            <span>今天的学习</span>
          </h1>
          <p className="lede">手机号用于建立同一学习账户；已有进度会在验证后读取，新用户会从第一张卡开始。</p>
          <div className="field-stack">
            <label htmlFor="phone">手机号</label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))}
              disabled={authStage === 'code'}
              placeholder="11 位手机号"
            />
            {authStage === 'code' ? (
              <>
                <label htmlFor="code">短信验证码</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 位验证码"
                  autoFocus
                />
              </>
            ) : null}
          </div>
          {authError ? <p className="notice error" role="alert">{authError}</p> : null}
          <button className="primary wide" disabled={remoteBusy} onClick={authStage === 'phone' ? requestCode : verifyCode}>
            {remoteBusy ? '正在连接…' : authStage === 'phone' ? '获取验证码' : '验证并继续'}
          </button>
          {authStage === 'code' ? (
            <button className="text-button" disabled={remoteBusy} onClick={() => {setAuthStage('phone'); setCode('');}}>
              更换手机号
            </button>
          ) : null}
          <p className="privacy-copy">手机号仅用于账户验证与学习进度同步。验证码不会显示在页面或错误信息中。</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <div className="brand-lockup"><span aria-hidden="true" className="brand-mark">软</span><span className="wordmark">软书四六级</span></div>
        {route !== 'mine' ? (
          <button className="text-button" disabled={remoteBusy || accountDeletionLocksAccount} onClick={() => void signOut()}>退出</button>
        ) : null}
      </header>
      <nav className="route-rail" aria-label="主要导航">
        <div className="brand-lockup rail-brand"><span aria-hidden="true" className="brand-mark">软</span><span className="wordmark">软书四六级</span></div>
        <div className="route-list">
          {ROUTES.map(item => (
            <button
              key={item.id}
              className={route === item.id ? 'route active' : 'route'}
              aria-current={route === item.id ? 'page' : undefined}
              disabled={
                runtime.mode === 'remote' &&
                session === null &&
                item.id !== 'mine'
              }
              onClick={() => {
                navigateRoute(item.id);
                if (session !== null) {
                  setRemoteError('');
                }
              }}
            >
              <span className="route-icon"><RouteIcon route={item.id}/></span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="rail-account">
          <span className="avatar" aria-hidden="true">{phone.slice(-2) || '我'}</span>
          <span>{maskPhone(phone)}</span>
        </div>
      </nav>

      {route === 'learning' ? (
        runtime.mode === 'remote' && session === null ? (
          <main className="workbench">
            <section className="learning-card" aria-live="polite">
              <p className="eyebrow">账户已确认</p>
              <h1>当前学习状态暂时不可用</h1>
              <p className="notice error" role="alert">{remoteError || '请重新读取当前学习状态。'}</p>
              <button className="primary" disabled={remoteBusy} onClick={() => void reloadRemoteState()}>重新读取</button>
            </section>
          </main>
        ) : sessionComplete ? (
          <SessionCompleteSurface
            phase={learningPhase}
            results={runtime.mode === 'remote'
              ? results
              : results.filter(result => activeCards.some(card => card.card_id === result.cardId))}
            total={runtime.mode === 'remote'
              ? session?.roundCompletion?.completedCount ?? results.length
              : activeCards.length}
            reviewCountOverride={runtime.mode === 'remote'
              ? session?.roundCompletion?.reviewCardIds.length
              : undefined}
            serverSequenced={runtime.mode === 'remote'}
            busy={productBusy}
            statusMessage={remoteError}
            syncStatus={genericSyncStatus}
            onOpenSpace={() => navigateRoute('space')}
            onRestart={() => {
              if (runtime.mode === 'remote') {
                if (remoteController === null) return;
                setRemoteBusy(true);
                const action = session?.roundCompletion
                  ? remoteController.continueServerRound()
                  : remoteController.loadAuthenticatedState();
                void action
                  .then(applyRemoteSnapshot)
                  .catch(error => handleRemoteFailure(error, '下一轮暂时无法开始。'))
                  .finally(() => setRemoteBusy(false));
                return;
              }
              const first = session?.cards[0] ?? null;
              setLearningPhase('learning');
              setReviewCards([]);
              setSessionComplete(false);
              setCurrentIndex(0);
              setResults([]);
              setResolved(null);
              setCardState(first ? withFavoriteState(first, favorites) : null);
            }}
            onStartReview={() => {
              if (runtime.mode === 'remote') {
                if (remoteController === null) return;
                setRemoteBusy(true);
                const action = session?.roundCompletion
                  ? remoteController.continueServerRound()
                  : remoteController.loadAuthenticatedState();
                void action
                  .then(applyRemoteSnapshot)
                  .catch(error => handleRemoteFailure(error, '回看暂时无法开始。'))
                  .finally(() => setRemoteBusy(false));
                return;
              }
              const candidates = (session?.cards ?? []).filter(card =>
                results.some(result => result.cardId === card.card_id &&
                  (result.outcome === 'incorrect' || result.outcome === 'review')),
              );
              if (!candidates.length) return;
              setLearningPhase('review');
              setReviewCards(candidates);
              setSessionComplete(false);
              setCurrentIndex(0);
              setResolved(null);
              setCardState(withFavoriteState(candidates[0], favorites));
            }}
          />
        ) : <LearningSurface
          card={currentCard}
          cardState={cardState}
          motionIdentity={`${currentCard?.card_id}:${session?.contentVersion}:${session?.serverSelection?.selectionId ?? 'local'}:${learningPhase}:${currentIndex}`}
          currentIndex={currentIndex}
          phase={learningPhase}
          total={activeCards.length}
          resolved={resolved}
          queuedResult={queuedLearningResult}
          rejectedCompletion={rejectedCompletion}
          busy={productBusy}
          audioStatus={audioStatus}
          canMutateSpace={membershipAccess?.completePhysicalSpace === true}
          serverSequenced={runtime.mode === 'remote'}
          statusMessage={remoteError}
          syncStatus={genericSyncStatus}
          onState={setCardState}
          onResolve={stateOverride => void resolveCurrentCard(stateOverride)}
          onContinue={continueLearning}
          onPlayAudio={runtime.mode === 'remote' ? () => void playCurrentAudio() : null}
          onReloadQueued={() => {
            if (rejectedCompletion && queuedLearningResult) {
              const generation = accountAuthorityGeneration.current;
              setRemoteBusy(true);
              void recoverRejectedCompletion(queuedLearningResult).finally(() => {
                if (accountAuthorityGeneration.current === generation) setRemoteBusy(false);
              });
            } else void reloadRemoteState();
          }}
          onRetryQueued={() => void retryQueuedLearningResult()}
          onOpenSpace={() => navigateRoute('space')}
          onFavorite={cardId => void toggleFavorite(cardId)}
          retryBusy={remoteBusy}
        />
      ) : null}
      {route === 'space' && membership !== null ? (
        <SpaceSurface
          busy={productBusy}
          cards={spaceCards}
          canMutate={membershipAccess?.completePhysicalSpace === true}
          currentCardId={currentCard?.card_id ?? null}
          favorites={favorites}
          sleeping={sleeping}
          membership={membership}
          statusMessage={remoteError}
          syncStatus={genericSyncStatus}
          onFavorite={cardId => void toggleFavorite(cardId)}
          onSleep={id => {
            if (!membershipAccess?.completePhysicalSpace) {
              setRemoteError('完整物理空间需要试用或会员，当前不能修改休眠状态。');
              return;
            }
            if (runtime.mode === 'remote') {
              if (remoteController === null) return;
              setRemoteBusy(true);
              void remoteController.applySpaceState(id, 'sleep', !sleeping.includes(id))
                .then(applyRemoteSnapshot)
                .catch(error => handleRemoteFailure(error, '休眠状态暂时没有更新。'))
                .finally(() => setRemoteBusy(false));
              return;
            }
            setSleeping(items => toggle(items, id));
          }}
          onReturn={() => navigateRoute('learning')}
        />
      ) : null}
      {route === 'statistics' ? (
        <StatisticsSurface
          busy={remoteBusy}
          checkInSync={checkInSync}
          disabled={productBusy}
          onCheckIn={() => void submitCheckIn()}
          results={results}
          syncStatus={genericSyncStatus}
          total={runtime.mode === 'remote'
            ? session?.catalogCards.length ?? 0
            : session?.cards.length ?? 0}
        />
      ) : null}
      {route === 'mine' && membership === null ? (
        <main className="account-workbench">
          <section className="account-object" aria-labelledby="mine-recovery-title">
            <p className="eyebrow">账户已确认</p>
            <h1 id="mine-recovery-title">当前账户状态暂时无法读取</h1>
            <p className="notice error" role="alert">
              {remoteError || '可以重新读取，或安全退出后改用其他手机号。'}
            </p>
            <button
              className="primary"
              disabled={remoteBusy}
              onClick={() => void reloadRemoteState()}
            >
              {remoteBusy ? '正在重新读取…' : '重新读取账户状态'}
            </button>
            <button
              className="secondary"
              disabled={remoteBusy || accountDeletionLocksAccount}
              onClick={() => void signOut()}
            >
              退出登录
            </button>
          </section>
        </main>
      ) : route === 'mine' && membership !== null ? (
        <MineSurface
          accountLocked={accountDeletionLocksAccount}
          accountDeletionStage={
            accountDeletionStage === 'confirming' ||
            accountDeletionStage === 'submitting' ||
            accountDeletionStage === 'unknown'
              ? accountDeletionStage
              : 'none'
          }
          phone={phone}
          canDeleteAccount={runtime.mode === 'remote'}
          membership={membership}
          syncStatus={genericSyncStatus}
          statusMessage={remoteError}
          busy={remoteBusy}
          onCancelDelete={() => setAccountDeletionStage('none')}
          onConfirmDelete={() => void submitAccountDeletion()}
          onRequestDelete={() => setAccountDeletionStage('confirming')}
          onRetryDelete={() => void submitAccountDeletion()}
          onLogout={() => void signOut()}
        />
      ) : null}
    </div>
  );
}

type LearningSurfaceProps = {
  motionIdentity: string;
  audioStatus: 'idle' | 'loading' | 'paused' | 'playing' | 'ready' | 'error';
  busy: boolean;
  canMutateSpace: boolean;
  card: LearningCard | null;
  cardState: LearningCardState | null;
  currentIndex: number;
  phase: 'learning' | 'review';
  total: number;
  resolved: LearningCardResult | null;
  onState: React.Dispatch<React.SetStateAction<LearningCardState | null>>;
  onResolve: (stateOverride?: LearningCardState) => void;
  onContinue: () => void | Promise<void>;
  onOpenSpace: () => void;
  onFavorite: (cardId: string) => void;
  onPlayAudio: (() => void) | null;
  onReloadQueued: () => void;
  onRetryQueued: () => void;
  queuedResult: LearningCardResult | null;
  rejectedCompletion: boolean;
  retryBusy: boolean;
  serverSequenced: boolean;
  statusMessage: string;
  syncStatus: string;
};

function LearningSurface(props: LearningSurfaceProps) {
  const {card, cardState, resolved, onResolve, onState} = props;
  const cardRef = useRef<HTMLElement | null>(null);
  const answerRef = useRef<HTMLHeadingElement | null>(null);
  const {perform, busy: motionBusy} = useObjectMotion(props.motionIdentity, cardRef);
  const onContinue = useCallback(() => perform('advance', props.onContinue), [perform, props.onContinue]);
  const onFlip = useCallback(() => perform('flip', () => onState(previous => previous ? {...previous, isFlipped: true} : previous)), [onState, perform]);
  useEffect(() => {
    if (!resolved || !answerRef.current) return;
    answerRef.current.focus({preventScroll: true});
    answerRef.current.scrollIntoView?.({block: 'start'});
  }, [resolved]);
  useLayoutEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (props.busy || motionBusy || (event.target as HTMLElement | null)?.closest('button, input, textarea, select, summary')) return;
      if (resolved && event.key === 'Enter') {event.preventDefault(); onContinue(); return;}
      if (!card || !cardState || resolved) return;
      if (card.interaction_id === 'flip' && event.key === 'Enter' && !cardState.isFlipped) {event.preventDefault(); onFlip();}
      if (card.interaction_id === 'multiple_choice' && /^[1-4]$/.test(event.key)) {
        const option = card.options[Number(event.key) - 1];
        if (option) {event.preventDefault(); onState(previous => previous ? {...previous, selectedOptionId: option.id} : previous);}
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [card, cardState, motionBusy, onContinue, onFlip, onState, props.busy, resolved]);
  if (!card || !cardState) return <main className="workbench"><p className="notice">当前没有可用学习卡。</p></main>;
  const patchState = (patch: Partial<LearningCardState>) => onState(previous => previous ? {...previous, ...patch} : previous);
  const library = formatSpaceDisplayName(card.space_metadata.library, '当前书架');
  const group = formatSpaceDisplayName(card.space_metadata.group, '当前分区');
  const box = formatSpaceDisplayName(card.space_metadata.box, '当前卡盒');
  const passage = card.interaction_id === 'elimination' ? eliminationPassage(card) : null;
  const material = frontMaterial(card).filter(text => !passage || text !== passage.source);
  const comparison = answerComparison(card, cardState);
  const continueLabel = props.serverSequenced || props.currentIndex < props.total - 1 ? '继续下一张' : '完成本轮';
  const questionContext = spaceCardPreview(card);
  const backVisible = card.interaction_id === 'flip' && cardState.isFlipped;
  const resolveLock = (slotId: string, value: string) => {
    const next = selectLockOption(card, cardState, slotId, value);
    if (canSubmitLearningCard(card, next)) onResolve(next);
    else patchState(next);
  };
  const interaction = <Interaction key={props.motionIdentity} card={card} state={cardState} onFlip={onFlip} resolved={false} patch={patchState} disabled={props.busy || motionBusy || Boolean(props.queuedResult)}
            onResolveLock={resolveLock}
            onResolveFlip={value => onResolve({...cardState, isFlipped: true, flipConfidence: value})}
            onResolveSwipe={value => onResolve({...cardState, swipeSelection: value})} />;
  return <main className="workbench learning-workbench" style={libraryStyle(library)} aria-labelledby="learning-title">
    <div className="learning-address">
      <button className="text-button address-button" onClick={props.onOpenSpace}><span className="library-dot" />{library} / {group} / <strong id="learning-title">{box}</strong></button>
      <span className="counter">{props.serverSequenced ? (props.phase === 'review' ? '回看' : '学习') : `${props.currentIndex + 1} / ${props.total}`}</span>
    </div>
    {props.serverSequenced && resolved && motionBusy ? <p className="notice next-card-status" role="status">正在准备下一张…</p> : null}
    <article ref={cardRef} inert={props.serverSequenced && Boolean(resolved) && motionBusy} style={{'--learning-object': transitionObjectName(card.card_id)} as React.CSSProperties} className={`learning-card interaction-${card.interaction_id}${resolved ? ' has-result' : ''}`}>
      <div className="paper-identity"><span>{props.phase === 'review' ? '回看' : INTERACTION_LABELS[card.interaction_id]}</span><button className="card-favorite" aria-label={cardState.isFavorited ? '已标记喜欢' : '标记喜欢'} aria-pressed={cardState.isFavorited} disabled={props.busy || !props.canMutateSpace} onClick={() => props.onFavorite(card.card_id)}>{cardState.isFavorited ? '★' : '☆'}</button></div>
      <div className="paper-body">
        {resolved ? <section className={`result-slip ${resultTone(resolved)}`} aria-label="答案对照" aria-live="polite">
          <p className="result-label">{card.interaction_id === 'flip' ? resultLabel(resolved) : '正确答案'}</p>
          <h2 ref={answerRef} tabIndex={-1} className="answer-first">{comparison.correct}</h2>
          {comparison.selected && comparison.selected !== comparison.correct ? <p className="selected-answer"><span>你的选择</span> {comparison.selected}</p> : null}
          <p className="question-context">{questionContext.title}</p>
          {questionContext.detail.map(text => <p className="question-context" key={text}>{text}</p>)}
          <p className="answer-reason">{card.analysis.summary}</p>
          {card.interaction_id === 'lock' && resolved.outcome === 'incorrect' ? <p className="answer-reason">已解锁，稍后再回看。</p> : null}
          {card.audio?.transcript?.trim() ? <details className="full-analysis"><summary>听力原文</summary><p className="front-material">{card.audio.transcript}</p></details> : null}
          <ResultExplanation card={card} />
        </section> : <>
          {card.interaction_id !== 'swipe' ? <h2>{backVisible ? comparison.correct : card.front.prompt}</h2> : null}
          {backVisible ? <p className="question-context">{card.front.prompt}</p> : null}
          {!backVisible ? material.map(text => <p className="front-material" key={text}>{text}</p>) : null}
          {card.interaction_id !== 'flip' ? interaction : null}
          <div className="learning-tools">
            {card.hint_layer ? <button className="text-button" aria-expanded={cardState.isHintVisible} onClick={() => patchState({hasUsedHint: true, isHintVisible: !cardState.isHintVisible})}>{cardState.isHintVisible ? '收起提示' : '查看提示'}</button> : null}
            <button className="text-button" aria-expanded={cardState.isPeeked} onClick={() => patchState({hasUsedPeek: true, isPeeked: !cardState.isPeeked})}>{cardState.isPeeked ? '收起思路' : '解题思路'}</button>
          </div>
          {card.hint_layer ? <p className="attached-note" hidden={!cardState.isHintVisible}>{card.hint_layer.content}</p> : null}
          <p className="attached-note" hidden={!cardState.isPeeked}>{card.analysis.exam_tip}</p>
        </>}
        {card.audio ? <div className="learning-tools"><button className="text-button" disabled={props.onPlayAudio === null || props.busy || props.audioStatus === 'loading'} onClick={props.onPlayAudio ?? undefined}>{props.audioStatus === 'loading' ? '正在准备音频' : props.audioStatus === 'playing' ? '暂停音频' : props.audioStatus === 'paused' ? '继续播放' : props.audioStatus === 'error' ? '重试播放' : '播放音频'}</button></div> : null}
        {props.queuedResult ? <section className="notice" aria-live="polite"><h3>{props.rejectedCompletion ? '这次结果未计入' : '学习结果等待同步'}</h3><p>{props.rejectedCompletion ? '这张卡的学习安排已经变化，重新读取后可继续。' : '答案已保存，确认后即可继续。'}</p>{!props.rejectedCompletion ? <button className="secondary" disabled={props.retryBusy} onClick={props.onRetryQueued}>重试同步当前结果</button> : null}<button className="text-button" disabled={props.retryBusy} onClick={props.onReloadQueued}>重新读取服务端进度</button></section> : null}
        {props.statusMessage ? <p className="notice error" role="alert">{props.statusMessage}</p> : null}
        {!['当前设备可继续', '服务端已确认', ''].includes(props.syncStatus) ? <p className="notice" role="status">跨端同步 · {props.syncStatus}</p> : null}
      </div>
      {resolved ? <div className="learning-dock"><button className="primary" disabled={props.busy || motionBusy} onClick={onContinue}>{continueLabel}</button></div> : !props.queuedResult && (card.interaction_id === 'multiple_choice' || card.interaction_id === 'elimination') ? <div className="learning-dock"><button className="primary" disabled={props.busy || !canSubmitVisibleLearningCard(card, cardState)} onClick={() => onResolve()}>提交判断</button></div> : card.interaction_id === 'flip' ? <div className="learning-dock">{interaction}</div> : null}
    </article>
    {resolved || !backVisible ? <p className="shortcut-note">{resolved ? `键盘：Enter ${continueLabel}` : shortcutLabel(card)}</p> : null}
  </main>;
}

function ResultExplanation({card}: {card: LearningCard}) {
  const [open, setOpen] = useState(false);
  return <details className="full-analysis" onToggle={event => setOpen(event.currentTarget.open)}><summary>{open ? '收起完整解析' : '展开完整解析'}</summary><h3>{card.analysis.title}</h3><p>{card.analysis.exam_tip}</p></details>;
}

function Interaction({card, state, patch, disabled, resolved, onFlip, onResolveLock, onResolveFlip, onResolveSwipe}: {onResolveLock: (slotId: string, value: string) => void; resolved: boolean; onFlip: () => void; card: LearningCard; state: LearningCardState; patch: (value: Partial<LearningCardState>) => void; disabled: boolean; onResolveFlip: (value: 'confident' | 'review') => void; onResolveSwipe: (value: string) => void}) {
  switch (card.interaction_id) {
    case 'flip':
      return (
        <div className="interaction flip-panel">
          {!state.isFlipped ? (
            <button className="reveal" disabled={disabled} onClick={onFlip}>翻面看答案</button>
          ) : (
            <>
              <div className="confidence" role="group" aria-label="自我评估">
                <button className={state.flipConfidence === 'confident' ? 'confidence-good selected' : 'confidence-good'} aria-pressed={state.flipConfidence === 'confident'} disabled={disabled} onClick={() => onResolveFlip('confident')}>有把握</button>
                <button className={state.flipConfidence === 'review' ? 'confidence-review selected' : 'confidence-review'} aria-pressed={state.flipConfidence === 'review'} disabled={disabled} onClick={() => onResolveFlip('review')}>再回看</button>
              </div>
            </>
          )}
        </div>
      );
    case 'multiple_choice':
      return <div className="interaction choice-grid" role="group" aria-label="四选一选项">{card.options.map(option => <button key={option.id} className={state.selectedOptionId === option.id ? 'choice selected' : 'choice'} aria-pressed={state.selectedOptionId === option.id} disabled={disabled} onClick={() => patch({selectedOptionId: option.id})}><span>{option.label}</span>{option.text}</button>)}</div>;
    case 'lock':
      return (
        <div className="interaction lock-list" role="group" aria-label="开锁槽位">
          <p className="forming-sentence" aria-label="当前句子主干">{card.lock_slots.map((slot, index) => state.lockSelections[slot.id] === card.answer_key.lock_pattern[index] ? state.lockSelections[slot.id] : '____').join(' ')}</p>
          {card.lock_slots.map((slot, slotIndex) => {
            const selectedValue = state.lockSelections[slot.id];
            const expectedValue = card.answer_key.lock_pattern[slotIndex];
            const isUnlocked = selectedValue === expectedValue;
            const currentSlotIndex = card.lock_slots.findIndex(
              (candidate, candidateIndex) =>
                state.lockSelections[candidate.id] !==
                card.answer_key.lock_pattern[candidateIndex],
            );
            const isAvailable = currentSlotIndex === slotIndex;
            const statusLabel = isUnlocked
              ? '已开锁'
              : selectedValue !== null && isAvailable
              ? '再试一次'
              : isAvailable
              ? '当前锁位'
              : '等待上一行';

            return (
              <div
                key={slot.id}
                className={`lock-row${isUnlocked ? ' unlocked' : ''}${isAvailable ? ' available' : ''}`}
                role="group"
                aria-label={`${slot.label}锁位`}
              >
                <span className="lock-glyph" aria-hidden="true">
                  <span className="lock-shackle" /><span className="lock-core" />
                </span>
                <div className="lock-body">
                  <div className="lock-heading">
                    <strong>{slot.label}</strong>
                    <span aria-live="polite">{statusLabel}</span>
                  </div>
                  {isAvailable ? (
                    <div className="lock-options" role="group" aria-label={`${slot.label}选项`}>
                      {slot.options.map(option => (
                        <button
                          key={option}
                          type="button"
                          className={selectedValue === option ? 'lock-option selected' : 'lock-option'}
                          aria-pressed={selectedValue === option}
                          disabled={disabled}
                          onClick={() => onResolveLock(slot.id, option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={isUnlocked ? 'lock-answer' : 'lock-placeholder'}>
                      {isUnlocked ? selectedValue : '完成上一行后继续'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    case 'elimination': {
      const passage = eliminationPassage(card);
      return passage ? <div className="interaction passage-interaction" role="group" aria-label="在原句中选择要删除的成分"><p className="interactive-passage">{passage.segments.map((segment, index) => segment.itemId ? <button key={index} className={state.eliminatedItemIds.includes(segment.itemId) ? 'passage-part selected' : 'passage-part'} aria-pressed={state.eliminatedItemIds.includes(segment.itemId)} disabled={disabled} onClick={() => patch({eliminatedItemIds: toggle(state.eliminatedItemIds, segment.itemId!)})}><span className="strike-text">{segment.text}</span></button> : <span key={index}>{segment.text}</span>)}</p><p className="interaction-guidance">轻点成分可划掉，再点可恢复。</p></div>
        : <div className="interaction elimination-list" role="group" aria-label="选择要删除的干扰成分">{card.elimination_items.map(item => {const active = state.eliminatedItemIds.includes(item.id); return <button key={item.id} className={active ? 'elimination selected' : 'elimination'} aria-pressed={active} disabled={disabled} onClick={() => patch({eliminatedItemIds: toggle(state.eliminatedItemIds, item.id)})}><span className="strike-text">{item.text}</span></button>;})}</div>;
    }
    case 'swipe':
      return (
        <SwipeInteraction
          card={card}
          state={state}
          disabled={disabled}
          resolved={resolved}
          onCommit={onResolveSwipe}
        />
      );
  }
}

function canSubmitVisibleLearningCard(
  card: LearningCard,
  state: LearningCardState,
) {
  if (card.interaction_id === 'lock') {
    return card.lock_slots.every(
      (slot, index) =>
        state.lockSelections[slot.id] === card.answer_key.lock_pattern[index],
    );
  }
  return canSubmitLearningCard(card, state);
}

function SwipeInteraction({
  card,
  state,
  disabled,
  resolved,
  onCommit,
}: {
  resolved: boolean;
  card: Extract<LearningCard, {interaction_id: 'swipe'}>;
  state: LearningCardState;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const swipeRef = useRef<HTMLDivElement | null>(null);
  const {perform, busy: motionBusy} = useObjectMotion(card.card_id, swipeRef);
  const [dragX, setDragX] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const selectedState = card.swipe_states.find(
    item => item.id === state.swipeSelection,
  );

  useLayoutEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (disabled || motionBusy || (event.target as HTMLElement | null)?.closest('button, input, textarea, select')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const direction = event.key === 'ArrowLeft' ? 'left' : 'right';
      const option = card.swipe_states[direction === 'left' ? 0 : 1];
      if (!option) return;
      event.preventDefault();
      perform(direction, () => onCommit(option.id));
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [card.swipe_states, disabled, motionBusy, onCommit, perform]);

  function settleFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) return;
    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (disabled || Math.abs(distance) < 72) {setDragX(0); return;}
    const nextState = card.swipe_states[distance < 0 ? 0 : 1];
    if (nextState) perform(distance < 0 ? 'left' : 'right', () => {setDragX(0); onCommit(nextState.id);});
  }

  return (
    <div className="interaction swipe-stage" role="group" aria-label="左右滑动判断">
      <div className="swipe-deck">
        <span className="swipe-ghost swipe-ghost-back" aria-hidden="true" />
        <span className="swipe-ghost swipe-ghost-middle" aria-hidden="true" />
        <div
          ref={swipeRef}
          className={`swipe-top-card${selectedState ? ' selected' : ''}${dragX !== 0 ? ' dragging' : ''}`}
          role="group"
          aria-label="当前滑动卡，可拖动或使用左右选项"
          tabIndex={disabled ? -1 : 0}
          style={{
            transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`,
          }}
          onPointerDown={event => {
            if (disabled || motionBusy) return;
            pointerStart.current = event.clientX;
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={event => {
            if (pointerStart.current === null || disabled) return;
            const distance = event.clientX - pointerStart.current;
            setDragX(Math.max(-140, Math.min(140, distance)));
          }}
          onPointerUp={settleFromPointer}
          onPointerCancel={() => {
            pointerStart.current = null;
            setDragX(0);
          }}
        >

          <strong>{resolved ? '已完成本次判断' : card.front.prompt}</strong>
          {resolved ? <div className="swipe-comparison"><p>你的选择：{selectedState?.label} · {selectedState?.description}</p><p>正确判断：{card.swipe_states.find(item => item.id === card.answer_key.correct_state)?.description}</p></div> : <p>向左或向右拖动，也可点下方选项。</p>}
        </div>
      </div>
      <div className="swipe-trails">
        {card.swipe_states.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={state.swipeSelection === item.id ? 'swipe-trail selected' : 'swipe-trail'}
            aria-pressed={state.swipeSelection === item.id}
            disabled={disabled || motionBusy}
            onClick={() => perform(index === 0 ? 'left' : 'right', () => onCommit(item.id))}
          >
            <span aria-hidden="true">{index === 0 ? '←' : '→'}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type SpaceBox = {
  box: string;
  boxRef: string;
  cards: LearningCard[];
  group: string;
  library: string;
};

function SpaceSurface({busy, cards, canMutate, currentCardId, favorites, sleeping, membership, onFavorite, onSleep, onReturn, statusMessage, syncStatus}: {busy: boolean; cards: LearningCard[]; canMutate: boolean; currentCardId: string | null; favorites: string[]; sleeping: string[]; membership: MembershipState; onFavorite: (id: string) => void; onSleep: (id: string) => void; onReturn: () => void; statusMessage: string; syncStatus: string}) {
  const boxes = useMemo(() => buildSpaceBoxes(cards), [cards]);
  const currentBoxRef = cards.find(card => card.card_id === currentCardId)?.space_metadata.box_ref;
  const [selectedBoxRef, setSelectedBoxRef] = useState(currentBoxRef ?? boxes[0]?.boxRef ?? '');
  const selectedBox = boxes.find(box => box.boxRef === selectedBoxRef) ?? boxes[0];
  const [selectedId, setSelectedId] = useState(currentCardId ?? selectedBox?.cards[0]?.card_id ?? '');
  const selected = selectedBox?.cards.find(card => card.card_id === selectedId) ?? selectedBox?.cards[0];
  const libraries = unique(boxes.map(box => box.library));
  const groups = unique(boxes.filter(box => box.library === selectedBox?.library).map(box => box.group));
  const selectBox = (box: SpaceBox) => {setSelectedBoxRef(box.boxRef); setSelectedId(box.cards[0]?.card_id ?? '');};
  const sleepingCards = selectedBox?.cards.filter(card => sleeping.includes(card.card_id)) ?? [];
  const activeCards = selectedBox?.cards.filter(card => !sleeping.includes(card.card_id)) ?? [];
  const renderCard = (card: LearningCard) => {
    const isSelected = selected?.card_id === card.card_id;
    const isCurrent = card.card_id === currentCardId;
    const isSleeping = sleeping.includes(card.card_id);
    const preview = spaceCardPreview(card);
    return <div className="space-card-object" key={card.card_id}>
      <button className={`${isSelected ? 'contained-card selected' : 'contained-card'}${isSleeping ? ' sleeping' : ''}`} aria-pressed={isSelected} data-learning-current={isCurrent || undefined}
        style={{'--learning-object': transitionObjectName(card.card_id)} as React.CSSProperties} onClick={() => setSelectedId(card.card_id)}>
        <span className="contained-card-kind">{INTERACTION_LABELS[card.interaction_id]}</span><strong>{preview.title}</strong>
        {isSelected ? preview.detail.map(text => <span className="card-preview-material" key={text}>{text}</span>) : null}
        <span className="contained-card-tags">{favorites.includes(card.card_id) ? <small className="favorite-tag">喜欢</small> : null}<small>{isSleeping ? '休眠中' : isCurrent ? '当前学习' : isSelected ? '正在浏览' : '同盒卡'}</small></span>
      </button>
      {isSelected ? <div className="object-actions" aria-label="所选卡片操作"><button className="text-button" disabled={busy || !canMutate} onClick={() => onFavorite(card.card_id)}>{favorites.includes(card.card_id) ? '取消喜欢' : '标记喜欢'}</button><button className="text-button" disabled={busy || !canMutate} onClick={() => onSleep(card.card_id)}>{isSleeping ? '唤醒到学习流' : '移入盒内休眠区'}</button></div> : null}
    </div>;
  };
  return <main className="space-workbench" style={libraryStyle(selectedBox?.library)} aria-labelledby="space-title">
    <div className="space-topline"><span className="space-title">知识空间</span><button className="text-button" onClick={onReturn}>回到当前学习卡</button></div>
    <section className="shelf-map" aria-label="知识空间层级">
      <div className="library-tabs" aria-label="书架">{libraries.map(library => <button key={library} className={selectedBox?.library === library ? 'library-tab selected' : 'library-tab'} aria-pressed={selectedBox?.library === library} onClick={() => {const first = boxes.find(box => box.library === library); if (first) selectBox(first);}}><span style={{backgroundColor: resolveLibraryTone(library).accent}} />{library}</button>)}</div>
      <div className="shelf-groups">{groups.map(group => <section className="shelf-group" key={group} aria-label={group}><h2>{group}</h2><div className="sibling-boxes">{boxes.filter(box => box.library === selectedBox?.library && box.group === group).map(box => <button key={box.boxRef} className={box.boxRef === selectedBox?.boxRef ? 'shelf-box selected' : 'shelf-box'} aria-label={`${box.box} ${box.cards.length} 张`} aria-current={box.boxRef === selectedBox?.boxRef ? 'location' : undefined} onClick={() => selectBox(box)}><strong>{box.box}</strong><small>{box.cards.length} 张</small></button>)}</div></section>)}</div>
    </section>
    <section className="box-tray" aria-label={`当前卡盒 ${selectedBox?.box ?? '暂无'}`}>
      <div className="workbench-heading"><div aria-label="当前空间地址"><p className="eyebrow"><span>{selectedBox?.library}</span> / <span>{selectedBox?.group}</span></p><h1 id="space-title">{selectedBox?.box ?? '当前没有卡盒'}</h1></div><span className="counter">{selectedBox?.cards.length ?? 0} 张</span></div>
      <div className="box-contents" aria-label="盒内卡片"><div className="contained-cards">{activeCards.map(renderCard)}</div>
        <section className="sleep-region" aria-label="盒内休眠区"><div className="sleep-heading"><span>休眠区</span><small>{sleepingCards.length ? `${sleepingCards.length} 张卡暂时离开学习流，保留在这个盒中` : '暂时离开学习流，保留在这个盒中'}</small></div>{sleepingCards.length ? <div className="contained-cards">{sleepingCards.map(renderCard)}</div> : <p className="sleep-empty">暂无休眠卡片</p>}</section>
      </div>
    </section>
    {statusMessage ? <p className="notice error" role="alert">{statusMessage}</p> : null}
    {!['当前设备可继续', '服务端已确认', ''].includes(syncStatus) ? <p className="notice" role="status">跨端同步 · {syncStatus}</p> : null}
    {!resolveMembershipAccess(membership).completePhysicalSpace ? <p className="membership-note">当前卡盒保持可用；会员可查看完整书架。</p> : null}
  </main>;
}

function StatisticsSurface({
  busy,
  checkInSync,
  disabled,
  onCheckIn,
  results,
  syncStatus,
  total,
}: {
  busy: boolean;
  checkInSync: WebRemoteSnapshot['checkInSync'] | null;
  disabled: boolean;
  onCheckIn: () => void;
  results: LearningCardResult[];
  syncStatus: string;
  total: number;
}) {
  const summary = summarizeLearningResults(results, total);
  const rows = [
    ['已完成', `${summary.completed} / ${summary.total}`],
    ['自动判定正确', String(summary.autoCorrectCount)],
    ['需要回看', String(summary.autoIncorrectCount + summary.reviewFlipCount)],
    ['使用提示', String(summary.hintUseCount)],
    ['标记喜欢', String(summary.favoriteCount)],
  ];
  const checkInLabel = busy
    ? '正在提交'
    : checkInSync?.status === 'confirmed'
    ? '今日已记录'
    : checkInSync?.status === 'queued'
    ? '重新确认'
    : checkInSync?.status === 'ready'
    ? '记录今天'
    : '签到暂不可用';
  return (
    <main className="ledger-workbench">
      <section className="ledger" aria-labelledby="statistics-title">
        <p className="eyebrow">今日记录</p>
        <h1 id="statistics-title">学习账页</h1>
        <p className="lede">
          看看今天完成的学习，以及还需要回看的内容。
        </p>
        <p className="muted">跨端同步 · {syncStatus}</p>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <section className="account-policy" aria-live="polite">
          <p className="eyebrow">今日签到</p>
          <h2>
            {checkInSync?.status === 'confirmed'
              ? '今天已收好'
              : checkInSync?.status === 'queued'
              ? '签到等待确认'
              : checkInSync?.status === 'unavailable'
              ? '先完成今天的学习'
              : '确认今天的学习进展'}
          </h2>
          <p>
            {checkInSync?.status === 'queued'
              ? '记录已经安全留在本机，联网后会继续确认。'
              : checkInSync?.status === 'confirmed'
              ? '这条记录已由学习账户确认。'
              : checkInSync?.status === 'unavailable'
              ? '完成至少一张学习卡后，再确认今天已经发生的学习。'
              : '签到只确认今天已经发生的学习，不增加额外奖励。'}
          </p>
          <button
            className="primary"
            disabled={
              busy ||
              disabled ||
              checkInSync === null ||
              checkInSync.status === 'unavailable' ||
              checkInSync.status === 'confirmed'
            }
            onClick={onCheckIn}
          >
            {checkInLabel}
          </button>
        </section>
      </section>
    </main>
  );
}

function MineSurface({
  accountDeletionStage,
  accountLocked,
  busy,
  canDeleteAccount,
  membership,
  onCancelDelete,
  onConfirmDelete,
  onLogout,
  onRequestDelete,
  onRetryDelete,
  phone,
  statusMessage,
  syncStatus,
}: {
  accountDeletionStage: 'confirming' | 'none' | 'submitting' | 'unknown';
  accountLocked: boolean;
  busy: boolean;
  canDeleteAccount: boolean;
  membership: MembershipState;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onLogout: () => void;
  onRequestDelete: () => void;
  onRetryDelete: () => void;
  phone: string;
  statusMessage: string;
  syncStatus: string;
}) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const stageLabel = {trial_available: '体验待自动开启', trial: '5 天体验中', free: '基础版', premium: '会员'}[membership.stage];
  return <main className="account-workbench"><section className="account-object" aria-labelledby="mine-title">
    <p className="eyebrow">我的账户</p><h1 id="mine-title">{maskPhone(phone)}</h1>
    <div className="account-row"><span>会员状态</span><strong>{stageLabel}</strong></div>
    <div className="account-row"><span>跨端同步</span><strong>{syncStatus}</strong></div>
    {statusMessage ? <p className="notice error" role="alert">{statusMessage}</p> : null}
    {membership.stage === 'premium' ? <p className="notice">完整卡片库、算法与空间访问已开启。</p> : null}
    <button className="secondary" disabled>封闭内测权益由邀请开通</button>
    <p className="muted">获得资格后会随当前账号自动同步，不需要在产品内购买。</p>
    <button className="tool" aria-expanded={showPrivacy} onClick={() => setShowPrivacy(value => !value)}>隐私与账户规则</button>
    {showPrivacy ? <section className="account-policy" aria-label="隐私与账户规则说明"><h2>账户与隐私</h2><p>手机号只用于登录、账户归属和学习进度同步。账户操作不可用时会明确停用，不会提交未确认的请求。</p></section> : null}
    {accountDeletionStage === 'confirming' ? (
      <section
        className="account-policy"
        aria-labelledby="delete-account-title"
        role="dialog"
      >
        <p className="eyebrow">删除学习账户</p>
        <h2 id="delete-account-title">确认永久删除这个账户？</h2>
        <p>
          申请接收后会退出当前账户，并开始删除学习进度、空间位置、签到和会员归属。
          数据清理需要一些时间。
        </p>
        <button className="secondary" disabled={busy} onClick={onCancelDelete}>
          保留账户
        </button>
        <button className="tool danger" disabled={busy} onClick={onConfirmDelete}>
          确认删除账户
        </button>
      </section>
    ) : accountDeletionStage === 'submitting' ? (
      <section className="account-policy" aria-live="polite">
        <p className="eyebrow">删除学习账户</p>
        <h2>正在提交删除申请</h2>
        <p>正在确认申请是否收到，请稍候。</p>
        <button className="tool danger" disabled>正在提交</button>
      </section>
    ) : accountDeletionStage === 'unknown' ? (
      <section className="account-policy" aria-live="polite">
        <p className="eyebrow">结果尚未确认</p>
        <h2>删除结果暂时未知</h2>
        <p>
          暂时没有收到申请确认。请重试查询这次删除的状态。
        </p>
        <button className="tool danger" disabled={busy} onClick={onRetryDelete}>
          {busy ? '正在重试' : '重试确认'}
        </button>
      </section>
    ) : (
      <button
        className="tool danger"
        disabled={busy || !canDeleteAccount}
        onClick={onRequestDelete}
      >
        {canDeleteAccount ? '删除账户' : '暂时无法删除账户'}
      </button>
    )}
    <button className="tool danger" disabled={busy || accountLocked} onClick={onLogout}>退出登录</button>
  </section></main>;
}

function AccountDeletionStatusSurface({
  busy,
  errorMessage,
  onRetry,
  onReturn,
  stage,
}: {
  busy: boolean;
  errorMessage: string;
  onRetry: () => void;
  onReturn: () => void;
  stage:
    | 'accepted'
    | 'checking'
    | 'cleanup_required'
    | 'registration_cleanup_required'
    | 'registration_ready'
    | 'session_cleanup_required'
    | 'unknown';
}) {
  const content = {
    accepted: {
      eyebrow: '删除学习账户',
      title: '删除申请已提交',
      detail:
        '当前账户已退出，删除申请正在处理，数据清理完成后才能重新登录。',
    },
    checking: {
      eyebrow: '账户恢复',
      title: '正在读取删除状态',
      detail: '正在确认本机是否还有需要完成的账户清理。',
    },
    cleanup_required: {
      eyebrow: '本机清理',
      title: '删除申请已接收，正在完成本机清理',
      detail:
        '正在清理这台设备上保存的登录信息和待同步记录。完成后可继续。',
    },
    registration_cleanup_required: {
      eyebrow: '本机恢复',
      title: '重新验证前还要完成本机清理',
      detail:
        '当前没有待处理的删除申请。先完成这台设备的旧记录清理，即可重新验证手机号。',
    },
    registration_ready: {
      eyebrow: '账户入口可用',
      title: '现在可以重新验证手机号',
      detail:
        '当前没有待处理的删除申请，现在可以重新验证手机号并登录。',
    },
    session_cleanup_required: {
      eyebrow: '本机清理',
      title: '退出前的本机记录还在清理',
      detail:
        '正在清理这台设备的学习与空间记录，完成后可重新验证手机号。',
    },
    unknown: {
      eyebrow: '结果尚未确认',
      title: '删除结果暂时未知',
      detail:
        '暂时没有收到申请确认。请在这里重试查询删除状态。',
    },
  }[stage];
  return (
    <main className="auth-shell">
      <section className="auth-object" aria-live="polite">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="lede">{content.detail}</p>
        {errorMessage ? (
          <p className="notice error" role="alert">{errorMessage}</p>
        ) : null}
        {stage === 'accepted' || stage === 'registration_ready' ? (
          <button className="primary wide" onClick={onReturn}>
            返回手机号验证
          </button>
        ) : stage === 'checking' ? (
          <button className="primary wide" disabled>正在确认</button>
        ) : (
          <button className="primary wide" disabled={busy} onClick={onRetry}>
            {busy
              ? '正在重试'
              : stage === 'cleanup_required' ||
                stage === 'registration_cleanup_required' ||
                stage === 'session_cleanup_required'
              ? '重试本机清理'
              : '重试确认'}
          </button>
        )}
      </section>
    </main>
  );
}

function AccountDeletionRecoverySurface({
  busy,
  code,
  errorMessage,
  onCodeChange,
  onRequestCode,
  onVerifyCode,
  phone,
  stage,
}: {
  busy: boolean;
  code: string;
  errorMessage: string;
  onCodeChange: (value: string) => void;
  onRequestCode: () => void;
  onVerifyCode: () => void;
  phone: string;
  stage: 'recovery_code' | 'recovery_phone';
}) {
  return (
    <main className="auth-shell">
      <section className="auth-object" aria-labelledby="deletion-recovery-title">
        <div className="brand-lockup">
          <span aria-hidden="true" className="brand-mark">软</span>
          <span className="wordmark">软书四六级</span>
        </div>
        <p className="eyebrow">删除结果尚待确认</p>
        <h1 id="deletion-recovery-title">重新验证手机号，继续确认删除</h1>
        <p className="lede">
          请验证原账户绑定的 {maskPhone(phone)}，查询这次删除申请的最新状态。
        </p>
        {stage === 'recovery_code' ? (
          <div className="field-stack">
            <label htmlFor="deletion-recovery-code">短信验证码</label>
            <input
              autoComplete="one-time-code"
              autoFocus
              id="deletion-recovery-code"
              inputMode="numeric"
              onChange={event =>
                onCodeChange(
                  event.target.value.replace(/\D/g, '').slice(0, 6),
                )
              }
              placeholder="6 位验证码"
              value={code}
            />
          </div>
        ) : null}
        {errorMessage ? (
          <p className="notice error" role="alert">{errorMessage}</p>
        ) : null}
        <button
          className="primary wide"
          disabled={busy}
          onClick={
            stage === 'recovery_phone' ? onRequestCode : onVerifyCode
          }
        >
          {busy
            ? '正在确认…'
            : stage === 'recovery_phone'
            ? '向原手机号获取验证码'
            : '验证并继续确认删除'}
        </button>
        {stage === 'recovery_code' ? (
          <button
            className="text-button"
            disabled={busy}
            onClick={onRequestCode}
          >
            重新获取验证码
          </button>
        ) : null}
        <p className="privacy-copy">
          暂时无法查询时，可以稍后在这里重试。
        </p>
      </section>
    </main>
  );
}

function SessionCompleteSurface({busy, phase, results, total, onOpenSpace, onRestart, onStartReview, reviewCountOverride, serverSequenced, statusMessage, syncStatus}: {busy: boolean; phase: 'learning' | 'review'; results: LearningCardResult[]; total: number; onOpenSpace: () => void; onRestart: () => void; onStartReview: () => void; reviewCountOverride?: number; serverSequenced: boolean; statusMessage: string; syncStatus: string}) {
  const summary = summarizeLearningResults(results, total);
  const reviewCount = reviewCountOverride ?? results.filter(result => result.outcome === 'incorrect' || result.outcome === 'review').length;
  return <main className="completion-workbench"><section className="completion-object" aria-labelledby="session-complete-title">
    <p className="eyebrow">{phase === 'review' ? '回看完成' : '本轮完成'}</p>
    <h1 id="session-complete-title">这一轮到这里</h1>
    <p className="lede">已经完成 {summary.completed} 张。需要再看的内容仍保留在原卡盒，可在本轮结束后集中回看。</p>
    {statusMessage ? <p className="notice error" role="alert">{statusMessage}</p> : null}
    <p className="muted">跨端同步 · {syncStatus}</p>
    <div className="completion-summary" aria-label="本轮摘要"><span>完成 <strong>{summary.completed}</strong></span><span>待回看 <strong>{reviewCount}</strong></span></div>
    {phase === 'learning' && reviewCount > 0 ? <button className="primary" disabled={busy} onClick={onStartReview}>开始回看 {reviewCount} 张</button> : null}
    <button className="secondary" disabled={busy} onClick={onOpenSpace}>查看这些卡的位置</button>
    <button className="tool" disabled={busy} onClick={onRestart}>{serverSequenced ? '重新读取学习安排' : '重新开始完整一轮'}</button>
  </section></main>;
}

function maskPhone(phone: string) {
  return phone.length === 11 ? `${phone.slice(0, 3)} **** ${phone.slice(-4)}` : '已验证账户';
}

function toggle(items: string[], id: string) {
  return items.includes(id) ? items.filter(item => item !== id) : [...items, id];
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function withFavoriteState(card: LearningCard, favorites: string[]) {
  const state = createLearningCardState(card);
  state.isFavorited = favorites.includes(card.card_id);
  return state;
}

function buildSpaceBoxes(cards: LearningCard[]): SpaceBox[] {
  const boxes = new Map<string, SpaceBox>();
  cards.forEach(card => {
    const metadata = card.space_metadata;
    const existing = boxes.get(metadata.box_ref);
    if (existing) {
      existing.cards.push(card);
      return;
    }
    boxes.set(metadata.box_ref, {
      box: formatSpaceDisplayName(metadata.box, '当前卡盒'),
      boxRef: metadata.box_ref,
      cards: [card],
      group: formatSpaceDisplayName(metadata.group, '当前分区'),
      library: formatSpaceDisplayName(metadata.library, '当前书架'),
    });
  });
  return [...boxes.values()];
}

function resultTone(result: LearningCardResult) {
  return result.outcome === 'correct' || result.outcome === 'confident' ? 'good' : 'review';
}

function currentCompletionStatus(sync: WebLearningCompletionSync) {
  return sync.completionStatus ?? (sync.status === 'confirmed' ? 'confirmed' : sync.pendingEventCount > 0 ? 'queued' : 'rejected');
}

function resultLabel(result: LearningCardResult) {
  const labels: Record<LearningCardResult['outcome'], string> = {correct: '判断正确', incorrect: '这张需要回看', confident: '已记为有把握', review: '已加入回看'};
  return labels[result.outcome];
}

function shortcutLabel(card: LearningCard) {
  switch (card.interaction_id) {
    case 'flip': return '键盘：Enter 翻面';
    case 'multiple_choice': return '键盘：1–4 选择';
    case 'lock': return '键盘：Tab 逐槽选择';
    case 'elimination': return '键盘：Tab + Space 切换删除';
    case 'swipe': return '键盘：← / → 选择方向';
  }
}
