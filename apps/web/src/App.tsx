import {StudioMark} from './StudioMark';
import {StudioAudio} from './StudioAudio';
import {useChinaDay} from '../../mobile/src/local/useStudyProfile';
import {lazy, Suspense} from 'react';
import {isLongQuestion, stackChoiceOptions} from '../../mobile/src/learning/readability';
import {filterSpaceCards, latestCardResults, reviewCardIds, type SpaceCardFilter} from '../../mobile/src/space/cardFilters';
import {createLocalLearningStore, LocalLearningStorageError, type LocalLearningSnapshot} from './localLearningStore';
import {getChinaDayKey as chinaDayKey} from '../../mobile/src/shared/chinaDay';
import {authFailure} from '../../mobile/src/auth/authErrorCopy';
import {endsLocalBatch, localBatch, localResumeIndex} from '../../mobile/src/learning/localBatch';
import {displayCardText, frontMaterial, eliminationPassage, answerComparison, spaceCardPreview} from '../../mobile/src/learning/presentation';
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
  LearningTrack,
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
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3" width="17" height="18" rx="5"/><path d="M8 5v14M12 10h5M12 15h3"/></svg>;
  }
  if (route === 'space') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 11 5-3m-5 7 6 2"/><circle cx="5.5" cy="13" r="3.2"/><circle cx="15" cy="6.5" r="3.2"/><circle cx="17" cy="18" r="3.2"/></svg>;
  }
  if (route === 'statistics') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21v-9m6 9V7m6 14V3"/></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>;
}

function libraryStyle(library?: string): React.CSSProperties {
  const tone = resolveLibraryTone(library);
  const channels = tone.accent.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return {'--hall': tone.accent, '--hall-action': tone.accentStrong, '--hall-soft': tone.accentSoft, '--hall-deep': tone.accentStrong, '--on-hall': 1.05 / (luminance + 0.05) >= 4.5 ? '#FFFFFF' : '#0B0B14'} as React.CSSProperties;
}

const PHONE_PATTERN = /^1\d{10}$/;

type AppProps = {
  remoteRuntimeFactory?: typeof createWebRemoteRuntime;
};

const LocalStudyApp = import.meta.env.MODE === 'test' || import.meta.env.MODE === 'device'
  ? lazy(() => import('./LocalStudyApp').then(module => ({default: module.LocalStudyApp}))) : null;
export type LocalWebSurfaces = {Learning: typeof LearningSurface; Space: typeof SpaceSurface; Statistics: typeof StatisticsSurface};
export function App(props: AppProps = {}) {
  const runtime = useMemo(() => resolveWebRuntime(), []);
  if (LocalStudyApp && runtime.mode === 'development') {
    return <Suspense fallback={<main className="auth-shell">正在准备学习…</main>}><LocalStudyApp initialTrack={runtime.track} views={{Learning: LearningSurface, Space: SpaceSurface, Statistics: StatisticsSurface}} /></Suspense>;
  }
  return <AccountApp {...props} />;
}

function AccountApp({
  remoteRuntimeFactory = createWebRemoteRuntime,
}: AppProps = {}) {
  const {day: liveChinaDay, refresh: refreshDay} = useChinaDay();
  const previousChinaDay = useRef(liveChinaDay);
  const [dayNeedsRefresh, setDayNeedsRefresh] = useState(false);
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
  const [knownResults, setKnownResults] = useState<(LearningCardResult & {serverSequence?: number})[]>([]);
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
  const [localLibraryStatus, setLocalLibraryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [localLibraryAttempt, setLocalLibraryAttempt] = useState(0);
  const localStore = useRef<ReturnType<typeof createLocalLearningStore> | null>(null);
  const [localHydrated, setLocalHydrated] = useState(false);
  const [localSaveState, setLocalSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [localSaveError, setLocalSaveError] = useState('');
  const [localSaveAttempt, setLocalSaveAttempt] = useState(0);
  const [localSavedFingerprint, setLocalSavedFingerprint] = useState('');
  const [localSavedCheckInDay, setLocalSavedCheckInDay] = useState<string | null>(null);
  const [localResumeCardId, setLocalResumeCardId] = useState<string | null>(null);
  const [localCheckedInDay, setLocalCheckedInDay] = useState<string | null>(null);
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
      bundledAudio.current?.stop();
      setAudioStatus('idle');
    }
    routeMotion(() => setRoute(next));
  };
  const resolutionInFlight = useRef(false);
  const audioRequestGeneration = useRef(0);
  const bundledAudio = useRef<ReturnType<typeof import('./bundledAudio').createBundledAudioController> | null>(null);
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

  useEffect(() => {
    const onFocus = () => {if (!document.hidden) refreshDay();};
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {window.removeEventListener('focus', onFocus);document.removeEventListener('visibilitychange', onFocus);};
  }, [refreshDay]);
  const reloadForNewDay = useEffectEvent(() => {setDayNeedsRefresh(true);void reloadRemoteState();});
  useEffect(() => {
    if (previousChinaDay.current === liveChinaDay) return;
    previousChinaDay.current = liveChinaDay;
    if (runtime.mode === 'remote' && authStage === 'authenticated' && remoteController !== null) {
      reloadForNewDay();
    }
  }, [liveChinaDay, runtime.mode, authStage, remoteController]);

  const localLearningCards = session && membership
    ? session.cards.slice(0, resolveAccessibleLearningCardCount(session.cards.length, membership))
      .filter(card => !sleeping.includes(card.card_id))
    : [];
  const resumeLearningIndex = localResumeIndex(session?.cards ?? [], localLearningCards, localResumeCardId);
  const activeCards = runtime.mode === 'remote'
    ? session?.cards ?? []
    : learningPhase === 'review'
    ? reviewCards.filter(card => !sleeping.includes(card.card_id))
    : localLearningCards;
  const currentCard = activeCards[currentIndex] ?? null;
  const batch = localBatch(activeCards.length, currentIndex, sessionComplete);
  const localBatchCards = activeCards.slice(batch.start, batch.end);
  useEffect(() => () => {
    audioRequestGeneration.current += 1;
    bundledAudio.current?.dispose();
    bundledAudio.current = null;
  }, [runtime.mode]);
  useEffect(() => {
    bundledAudio.current?.stop();
    audioRequestGeneration.current += 1;
  }, [currentCard?.card_id, currentIndex, route, authStage, learningPhase]);
  // Hide presentation without changing the server selection or its draft.
  const isServerSelectionSleeping = runtime.mode === 'remote' &&
    session?.schedulingMode === 'server' && currentCard !== null &&
    sleeping.includes(currentCard.card_id);
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
  const knownCardIds = new Set((session?.catalogCards ?? []).map(card => card.card_id));
  const catalogResults = latestCardResults(runtime.mode === 'development' ? results : knownResults).filter(result => knownCardIds.has(result.cardId));
  const pendingReviewIds = reviewCardIds(catalogResults, sleeping);
  const remoteSyncFacts = [
    checkInSync?.status === 'queued' ? '今日签到等待同步' : null,
    (learningSync?.pendingEventCount ?? 0) > 0
      ? `${learningSync?.pendingEventCount} 项学习结果等待同步`
      : null,
    (learningSync?.rejectedEventCount ?? 0) > 0
      ? `${learningSync?.rejectedEventCount} 次学习结果未计入`
      : null,
    (spaceSync?.rejectedActionCount ?? 0) > 0
      ? `${spaceSync?.rejectedActionCount ?? 0} 项设置未能保存`
      : null,
    (spaceSync?.pendingActionCount ?? 0) > 0
      ? `${spaceSync?.pendingActionCount ?? 0} 项设置等待同步`
      : null,
  ].filter((fact): fact is string => fact !== null);
  const localSnapshot = useMemo<LocalLearningSnapshot>(() => ({
    phase: learningPhase, complete: sessionComplete, currentCardId: currentCard?.card_id ?? null,
    resumeCardId: localResumeCardId, reviewCardIds: reviewCards.map(card => card.card_id),
    favorites, sleeping, results, draft: cardState, resolved: resolved?.cardId ?? null,
    checkedInDay: localCheckedInDay,
  }), [learningPhase, sessionComplete, currentCard?.card_id, localResumeCardId, reviewCards, favorites, sleeping, results, cardState, resolved?.cardId, localCheckedInDay]);
  const localFingerprint = useMemo(() => runtime.mode === 'development' ? JSON.stringify(localSnapshot) : '', [runtime.mode, localSnapshot]);
  const genericSyncStatus = runtime.mode === 'remote'
    ? remoteSyncFacts.join('；') || '已同步'
    : localSaveState === 'error' ? '尚未保存' : localSavedFingerprint === localFingerprint ? '已保存在本机' : '正在保存';
  useEffect(() => {
    if (runtime.mode !== 'development' || authStage !== 'authenticated' || !localHydrated || !localStore.current) return;
    let current = true;
    setLocalSaveState('saving');
    void localStore.current.save(localSnapshot).then(() => {
      if (current) { setLocalSaveState('saved'); setLocalSaveError(''); setLocalSavedFingerprint(localFingerprint); setLocalSavedCheckInDay(localSnapshot.checkedInDay); }
    }).catch(error => {
      if (current) {
        setLocalSaveState('error');
        setLocalSaveError(error instanceof LocalLearningStorageError && error.kind === 'conflict'
          ? '其他页面已更新学习进度，请读取最新记录后继续。'
          : '这次进度还没保存，请重试。');
      }
    });
    return () => { current = false; };
  }, [runtime.mode, authStage, localHydrated, localSnapshot, localFingerprint, localSaveAttempt]);
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
    (runtime.mode === 'development' && (!localHydrated || localLibraryStatus !== 'ready')) ||
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

    setLocalLibraryStatus('loading');
    setLocalHydrated(false);
    import('../../mobile/src/learning/session').then(({createLocalLearningSession}) => {
      if (!active) return;
      const nextSession = createLocalLearningSession(runtime.track);
      const store = createLocalLearningStore({
        getStorage: () => window.localStorage,
        track: runtime.track,
        contentVersion: nextSession.contentVersion ?? nextSession.sourceId,
        cards: nextSession.catalogCards,
        withLock: (key, operation) => {
          if (!navigator.locks) return Promise.reject(new LocalLearningStorageError('unavailable'));
          return navigator.locks.request(key, operation);
        },
      });
      const saved = store.load();
      localStore.current = store;
      setSession(nextSession);
      const savedSleeping = saved?.sleeping ?? [];
      const eligible = nextSession.cards.filter(card => !savedSleeping.includes(card.card_id));
      const savedReview = saved?.reviewCardIds.map(id => nextSession.catalogCards.find(card => card.card_id === id)!).filter(Boolean) ?? [];
      const deck = saved?.phase === 'review' ? savedReview.filter(card => !savedSleeping.includes(card.card_id)) : eligible;
      const position = saved ? saved.currentCardId === null ? deck.length : deck.findIndex(card => card.card_id === saved.currentCardId) : 0;
      const index = Math.max(0, position);
      const card = deck[index] ?? null;
      setFavorites(saved?.favorites ?? []);
      setSleeping(savedSleeping);
      setResults(saved?.results ?? []);
      setReviewCards(savedReview);
      setLearningPhase(saved?.phase ?? 'learning');
      setCurrentIndex(index);
      setSessionComplete(saved?.complete ?? false);
      setLocalResumeCardId(saved?.resumeCardId ?? null);
      setLocalCheckedInDay(saved?.checkedInDay ?? null);
      setLocalSavedCheckInDay(saved?.checkedInDay ?? null);
      setLocalSavedFingerprint(saved ? JSON.stringify(saved) : '');
      setResolved(saved?.results.find(result => result.cardId === saved.resolved) ?? null);
      setCardState(card ? saved?.draft ?? withFavoriteState(card, saved?.favorites ?? []) : null);
      setLocalSaveError('');
      setLocalSaveState(saved ? 'saved' : 'idle');
      setLocalHydrated(true);
      setLocalLibraryStatus('ready');
    }).catch(() => {
      if (active) {
        setLocalLibraryStatus('error');
        setLocalSaveError('卡库或学习记录读取失败，已有记录已保留。请重试。');
      }
    });

    return () => {
      active = false;
    };
  }, [runtime, localLibraryAttempt]);

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
    setDayNeedsRefresh(false);
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
    setKnownResults(snapshot.bootstrap.learning.cardStates);
    if (nextCard !== null && snapshot.sleeping.includes(nextCard.card_id)) {
      audioRequestGeneration.current += 1;
      remoteController?.stopCardAudio?.();
      setAudioStatus('idle');
    }
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
        ? '设置未能保存。请刷新后重新操作。'
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
        setAuthError('暂时无法连接服务，请稍后重试。');
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
        setAuthError('暂时无法连接服务，请稍后重试。');
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
            '请刷新页面，更新后可继续学习。',
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
              setRemoteError('登录已失效，但退出尚未完成，请重试。');
            }
            return;
          }
          setCode('');
          setAuthStage('authenticated');
          setRemoteError('已登录，学习进度加载失败，请重试。');
        } else {
          setAuthError(
            authFailure(error).message,
          );
        }
      } finally {
        if (accountAuthorityGeneration.current === generation) {
          setRemoteBusy(false);
        }
      }
      return;
    }
  }

  async function switchRemoteTrack(nextTrack: LearningTrack) {
    if (remoteController === null || remoteBusy || accountDeletionLocksAccount || resolutionInFlight.current) return;
    const generation = ++accountAuthorityGeneration.current;
    setRemoteBusy(true);
    setRemoteError('');
    audioRequestGeneration.current += 1;
    remoteController.stopCardAudio?.();
    setAudioStatus('idle');
    try {
      const snapshot = await remoteController.switchTrack(nextTrack);
      if (accountAuthorityGeneration.current === generation) applyRemoteSnapshot(snapshot);
    } catch (error) {
      if (accountAuthorityGeneration.current === generation) await handleRemoteFailure(error, '切换失败，已保留当前考试和学习记录，请重试。');
    } finally {
      if (accountAuthorityGeneration.current === generation) setRemoteBusy(false);
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
      if (accountAuthorityGeneration.current === generation) await handleRemoteFailure(error, '学习进度加载失败，请重试。');
    } finally {
      if (accountAuthorityGeneration.current === generation) setRemoteBusy(false);
    }
  }

  async function toggleFavorite(cardId: string) {
    const nextActive = !favorites.includes(cardId);
    if (!membershipAccess?.completePhysicalSpace) {
      setRemoteError('试用或开通会员后，可收藏卡片。');
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
        await handleRemoteFailure(error, '收藏状态暂时没有更新。');
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
    setDayNeedsRefresh(false);
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
    setKnownResults([]);
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
    if (runtime.mode === 'development') {
      audioRequestGeneration.current += 1;
      bundledAudio.current?.stop();
      setAuthStage('phone');
      setRoute('learning');
      return;
    }
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
        setRemoteError('退出未完成，请重试。');
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
        setRemoteError('登录已失效，但退出尚未完成，请重试。');
      }
      return;
    }
    setRemoteError(getUserFacingErrorMessage(error, fallback));
  }

  async function resolveCurrentCard(stateOverride?: LearningCardState) {
    const stateToResolve = stateOverride ?? cardState;
    if (isServerSelectionSleeping || !currentCard || !stateToResolve || resolved || queuedLearningResult || resolutionInFlight.current) return;
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
          setRemoteError('答题记录已保存在本机，正在同步。');
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
    if (isServerSelectionSleeping) return;
    if (runtime.mode === 'remote') {
      await reloadRemoteState();
      return;
    }
    if (!activeCards.length || !resolved) return;
    const nextIndex = currentIndex + 1;
    setResolved(null);
    setCurrentIndex(nextIndex);
    setCardState(activeCards[nextIndex] ? withFavoriteState(activeCards[nextIndex], favorites) : null);
    setSessionComplete(endsLocalBatch(nextIndex, activeCards.length));
  }

  function presentAcknowledgedLearningResult(result: LearningCardResult) {
    setKnownResults(previous => [...previous.filter(item => item.cardId !== result.cardId), result]);
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
        setRemoteError('答题记录已保存在本机，还未完成同步。');
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
    if (isServerSelectionSleeping || !currentCard) {
      return;
    }
    if (runtime.mode === 'development') {
      const generation = ++audioRequestGeneration.current;
      setAudioStatus('loading');
      try {
        if (!bundledAudio.current && import.meta.env.DEV) {
          const {createBundledAudioController} = await import('./bundledAudio');
          if (generation !== audioRequestGeneration.current) return;
          const controller = createBundledAudioController();
          controller.subscribe(state => setAudioStatus(state.status));
          bundledAudio.current = controller;
        }
        if (generation !== audioRequestGeneration.current) return;
        await bundledAudio.current?.play(currentCard, `${phone}:${learningPhase}:${currentIndex}:${currentCard.card_id}`);
      } catch {
        if (generation === audioRequestGeneration.current) setAudioStatus('error');
      }
      return;
    }
    if (runtime.mode !== 'remote' || remoteController === null) return;
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
    if (runtime.mode === 'development') {setLocalCheckedInDay(chinaDayKey()); return;}
    if (runtime.mode !== 'remote' || remoteController === null) return;
    setRemoteBusy(true);
    setRemoteError('');
    try {
      const snapshot = await remoteController.checkInToday();
      applyRemoteSnapshot(snapshot);
      setRemoteError(
        snapshot.checkInSync.status === 'queued'
          ? '签到已保存在本机，正在同步。'
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
        getUserFacingErrorMessage(error, '注销申请提交失败，请重试。'),
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
        getUserFacingErrorMessage(error, '账号状态查询失败，请重试。'),
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
        authFailure(error).message,
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

  if (runtime.mode === 'development' && authStage !== 'authenticated') {
    return <main className="auth-shell"><section className="auth-object" aria-labelledby="local-entry-title">
      <div className="brand-lockup"><span aria-hidden="true" className="brand-mark"><StudioMark /></span><span className="wordmark">软书</span></div>
      <h1 id="local-entry-title">在这台设备上学习</h1>
      <p className="lede">无需手机号或验证码。学习记录保存在当前浏览器中。</p>
      {localSaveError ? <p className="notice error" role="alert">{localSaveError}</p> : null}
      <button className="primary wide" disabled={localLibraryStatus !== 'ready'} onClick={() => {
        setPhone('local-device');
        setMembership(previous => ({...(previous ?? createInitialMembershipState()), stage: 'trial'}));
        setAuthStage('authenticated');
      }}>{localLibraryStatus === 'loading' ? '正在准备…' : localSavedFingerprint ? '继续学习' : '开始学习'}</button>
      {localLibraryStatus === 'error' ? <button className="text-button" onClick={() => setLocalLibraryAttempt(value => value + 1)}>重新读取</button> : null}
    </section></main>;
  }

  if (authStage !== 'authenticated') {
    return (
      <main className="auth-shell">
        <section className="auth-object" aria-labelledby="auth-title">
          <div className="brand-lockup"><span aria-hidden="true" className="brand-mark"><StudioMark /></span><span className="wordmark">软书</span></div>
          <h1 id="auth-title" className="auth-title">
            {authStage === 'phone' ? '登录软书' : '输入验证码'}
          </h1>
          <p className="lede">{authStage === 'phone' ? '未注册的手机号，验证后将自动创建账号。' : '请填写验证码。'}</p>
          {import.meta.env.MODE === 'backend' ? <p className="notice">本地体验使用测试验证码，不发送短信。</p> : null}
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
            {remoteBusy ? authStage === 'phone' ? '正在发送…' : '正在登录…'
              : authStage === 'phone' ? '获取验证码' : '登录'}
          </button>
          {authStage === 'code' ? (
            <button className="text-button" disabled={remoteBusy} onClick={() => {setAuthStage('phone'); setCode('');}}>
              更换手机号
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <div className="brand-lockup"><span aria-hidden="true" className="brand-mark"><StudioMark /></span><span className="wordmark">软书</span></div>
        <button className="course-switch" aria-label="选择备考科目" disabled={remoteBusy || accountDeletionLocksAccount} onClick={() => navigateRoute('mine')}>{(session?.track ?? runtime.track) === 'cet6' ? 'CET 6' : 'CET 4'} <span aria-hidden="true">⌄</span></button>
      </header>
      <nav className="route-rail" aria-label="主要导航">
        <div className="brand-lockup rail-brand"><span aria-hidden="true" className="brand-mark"><StudioMark /></span><span className="wordmark">软书</span></div>
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

      {runtime.mode === 'development' && localSaveError ? <section className="notice error" role="alert">
        <p>{localSaveError}</p><button disabled={!localHydrated} onClick={() => setLocalSaveAttempt(value => value + 1)}>重试保存</button>
        <button onClick={() => {setLocalHydrated(false); void (localStore.current?.flush() ?? Promise.resolve()).then(() => setLocalLibraryAttempt(value => value + 1));}}>读取已保存进度</button>
      </section> : null}
      {route === 'learning' ? (
        runtime.mode === 'development' && localLibraryStatus !== 'ready' ? (
          <main className="workbench"><section className="learning-card" aria-live="polite">
            <p className="notice">{localLibraryStatus === 'loading' ? '正在准备卡库…' : '卡库暂时无法读取。'}</p>
            {localLibraryStatus === 'error' ? <button onClick={() => setLocalLibraryAttempt(value => value + 1)}>重新加载卡库</button> : null}
          </section></main>
        ) : runtime.mode === 'remote' && session === null ? (
          <main className="workbench">
            <section className="learning-card" aria-live="polite">
              <p className="eyebrow">已登录</p>
              <h1>暂时无法加载学习进度</h1>
              <p className="notice error" role="alert">{remoteError || '请重试加载学习进度。'}</p>
              <button className="primary" disabled={remoteBusy} onClick={() => void reloadRemoteState()}>重新读取</button>
            </section>
          </main>
        ) : isServerSelectionSleeping ? (
          <main className="workbench">
            <section className="learning-card" aria-labelledby="learning-sleep-title">
              <p className="eyebrow">学习安排</p>
              <h1 id="learning-sleep-title">这张卡已暂停学习</h1>
              <p className="notice" role="status">{(spaceSync?.pendingActionCount ?? 0) > 0
                ? '休眠操作等待同步，确认后再读取下一张。也可以到空间唤醒这张卡。'
                : '刷新学习进度后即可继续，也可以到空间唤醒这张卡。'}</p>
              {remoteError ? <p className="notice error" role="alert">{remoteError}</p> : null}
              <button className="primary" disabled={remoteBusy || remoteCleanupPending || accountDeletionLocksAccount} onClick={() => void reloadRemoteState()}>刷新学习进度</button>
              <button className="secondary" onClick={() => navigateRoute('space')}>前往空间</button>
              <p className="notice" role="status">学习记录 · {genericSyncStatus}</p>
            </section>
          </main>
        ) : sessionComplete ? (
          <SessionCompleteSurface
            phase={learningPhase}
            results={runtime.mode === 'remote'
              ? results
              : results.filter(result => localBatchCards.some(card => card.card_id === result.cardId))}
            total={runtime.mode === 'remote'
              ? session?.roundCompletion?.completedCount ?? results.length
              : batch.size}
            reviewCountOverride={runtime.mode === 'remote'
              ? session?.roundCompletion?.reviewCardIds.length
              : undefined}
            serverSequenced={runtime.mode === 'remote'}
            continueLabel={runtime.mode === 'development' ? batch.hasMore ? '继续下一组' : learningPhase === 'review' && resumeLearningIndex < localLearningCards.length ? '继续学习' : undefined : undefined}
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
              if (batch.hasMore) {
                setSessionComplete(false);
                return;
              }
              const resumeIndex = learningPhase === 'review' && resumeLearningIndex < localLearningCards.length ? resumeLearningIndex : 0;
              const nextIndex = Math.max(0, resumeIndex);
              setLearningPhase('learning');
              setReviewCards([]);
              setSessionComplete(false);
              setCurrentIndex(nextIndex);
              setResolved(null);
              setCardState(localLearningCards[nextIndex] ? withFavoriteState(localLearningCards[nextIndex], favorites) : null);
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
                  .catch(error => handleRemoteFailure(error, '复习暂时无法开始。'))
                  .finally(() => setRemoteBusy(false));
                return;
              }
              const candidates = (session?.cards ?? []).filter(card =>
                !sleeping.includes(card.card_id) && results.some(result => result.cardId === card.card_id &&
                  (result.outcome === 'incorrect' || result.outcome === 'review')),
              );
              if (!candidates.length) return;
              if (learningPhase === 'learning') setLocalResumeCardId(localLearningCards[currentIndex]?.card_id ?? null);
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
          currentIndex={runtime.mode === 'development' ? batch.index : currentIndex}
          phase={learningPhase}
          total={runtime.mode === 'development' ? batch.size : activeCards.length}
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
          onPlayAudio={() => void playCurrentAudio()}
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
          pendingReviewIds={pendingReviewIds}
          favorites={favorites}
          sleeping={sleeping}
          membership={membership}
          statusMessage={remoteError}
          syncStatus={genericSyncStatus}
          onFavorite={cardId => void toggleFavorite(cardId)}
          onSleep={id => {
            if (!membershipAccess?.completePhysicalSpace) {
              setRemoteError('试用或开通会员后，可暂停或恢复卡片学习。');
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
            const nextSleeping = toggle(sleeping, id);
            const nextCards = (learningPhase === 'review' ? reviewCards : session?.cards.slice(
              0, resolveAccessibleLearningCardCount(session.cards.length, membership),
            ) ?? []).filter(card => !nextSleeping.includes(card.card_id));
            const retainedIndex = nextCards.findIndex(card => card.card_id === currentCard?.card_id);
            const nextIndex = retainedIndex >= 0 ? retainedIndex : Math.min(currentIndex, Math.max(0, nextCards.length - 1));
            setSessionComplete(false);
            setSleeping(nextSleeping);
            setCurrentIndex(nextIndex);
            if (retainedIndex < 0) {
              setResolved(null);
              setCardState(nextCards[nextIndex] ? withFavoriteState(nextCards[nextIndex], favorites) : null);
            }
          }}
          onReturn={() => navigateRoute('learning')}
        />
      ) : null}
      {route === 'statistics' ? (
        dayNeedsRefresh ? <main className="ledger-workbench"><section className="ledger"><h1>学习统计</h1><p role="status">{remoteBusy ? '正在读取今天的记录…' : '今天的记录还未更新，请重新读取。'}</p><button className="primary" disabled={remoteBusy} onClick={() => void reloadRemoteState()}>重新读取</button></section></main> : <StatisticsSurface
          localOnly={runtime.mode === 'development'}
          busy={remoteBusy}
          checkInSync={runtime.mode === 'development' ? {checkedInToday: localSavedCheckInDay === chinaDayKey(), pending: localCheckedInDay === chinaDayKey() && localSavedCheckInDay !== chinaDayKey(), status: localSavedCheckInDay === chinaDayKey() ? 'confirmed' : localCheckedInDay === chinaDayKey() ? 'queued' : results.some(result => chinaDayKey(new Date(result.completedAt)) === chinaDayKey()) ? 'ready' : 'unavailable'} : checkInSync}
          disabled={productBusy}
          onCheckIn={() => void submitCheckIn()}
          results={runtime.mode === 'development' ? results.filter(result => chinaDayKey(new Date(result.completedAt)) === chinaDayKey()) : results}
          syncStatus={genericSyncStatus}
          cumulativeLearnedCount={catalogResults.length}
          pendingReviewCount={pendingReviewIds.length}
          onContinueLearning={() => navigateRoute('learning')}
        />
      ) : null}
      {route === 'mine' && membership === null ? (
        <main className="account-workbench">
          <section className="account-object" aria-labelledby="mine-recovery-title">
            <p className="eyebrow">已登录</p>
            <h1 id="mine-recovery-title">暂时无法加载账号信息</h1>
            <p className="notice error" role="alert">
              {remoteError || '请重试加载，或退出后重新登录。'}
            </p>
            <button
              className="primary"
              disabled={remoteBusy}
              onClick={() => void reloadRemoteState()}
            >
              {remoteBusy ? '正在加载…' : '重试'}
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
          track={session?.track ?? runtime.track}
          onSwitchTrack={runtime.mode === 'remote' ? nextTrack => void switchRemoteTrack(nextTrack) : undefined}
          localOnly={runtime.mode === 'development'}
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
    const body = cardRef.current?.querySelector('.paper-body');
    if (body) body.scrollTop = 0;
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
  const courseName = card.track === 'cet6' ? '英语六级' : '英语四级';
  const library = formatSpaceDisplayName(card.space_metadata.library, '当前书架');
  const group = formatSpaceDisplayName(card.space_metadata.group, '当前分区');
  const box = formatSpaceDisplayName(card.space_metadata.box, '当前卡盒');
  const passage = card.interaction_id === 'elimination' ? eliminationPassage(card) : null;
  const material = frontMaterial(card).filter(text => !passage || text !== passage.source);
  const comparison = answerComparison(card, cardState);
  const continueLabel = props.serverSequenced || props.currentIndex < props.total - 1 ? '下一张' : '完成本组';
  const questionContext = spaceCardPreview(card);
  const backVisible = card.interaction_id === 'flip' && cardState.isFlipped;
  const resolveLock = (slotId: string, value: string) => {
    const next = selectLockOption(card, cardState, slotId, value);
    if (canSubmitLearningCard(card, next)) onResolve(next);
    else patchState(next);
  };
  const audioControl = card.audio ? <StudioAudio status={props.audioStatus} durationMs={card.audio.duration_ms} disabled={props.busy} onPlay={props.onPlayAudio} /> : null;
  const interaction = <Interaction key={props.motionIdentity} card={card} state={cardState} onFlip={onFlip} resolved={false} patch={patchState} disabled={props.busy || motionBusy || Boolean(props.queuedResult)}
            onResolveLock={resolveLock}
            onResolveFlip={value => onResolve({...cardState, isFlipped: true, flipConfidence: value})}
            onResolveSwipe={value => onResolve({...cardState, swipeSelection: value})} />;
  return <main className="workbench learning-workbench" style={libraryStyle(library)} aria-labelledby="learning-title">
    <div className="learning-address">
      <button className="address-button" onClick={props.onOpenSpace}><small><span className="library-dot" />{courseName} · {library} / {group}</small><strong id="learning-title">{box}</strong></button>
      <div className="studio-address-tools"><span className="counter">{props.serverSequenced ? (props.phase === 'review' ? '复习' : '学习') : `${props.currentIndex + 1} / ${props.total}`}</span><button className="card-favorite" aria-label={cardState.isFavorited ? '已收藏' : '收藏'} aria-pressed={cardState.isFavorited} disabled={props.busy || !props.canMutateSpace} onClick={() => props.onFavorite(card.card_id)}>{cardState.isFavorited ? '★' : '☆'}</button></div>
    </div>
    {props.serverSequenced && resolved && motionBusy ? <p className="notice next-card-status" role="status">正在准备下一张…</p> : null}
    <div className="studio-learning-layout">
    <article ref={cardRef} inert={props.serverSequenced && Boolean(resolved) && motionBusy} style={{'--learning-object': transitionObjectName(card.card_id)} as React.CSSProperties} className={`learning-card interaction-${card.interaction_id}${resolved ? ' has-result' : ''}`}>
      <span className="sr-only">{props.phase === 'review' ? '复习' : INTERACTION_LABELS[card.interaction_id]}</span>
      <div className="paper-body">
        {resolved ? audioControl : null}
        {resolved ? <section className={`result-slip ${resultTone(resolved)}`} aria-label="答案对照" aria-live="polite">
          <p className="result-label">{card.interaction_id === 'flip' ? resultLabel(resolved) : '正确答案'}</p>
          <h2 ref={answerRef} tabIndex={-1} className={`answer-first${isLongQuestion(comparison.correct) ? ' long-question' : ''}`}>{comparison.correct}</h2>
          {comparison.selected && comparison.selected !== comparison.correct ? <p className="selected-answer"><span>你的选择</span> {comparison.selected}</p> : null}
          <p className="question-context">{questionContext.title}</p>
          {questionContext.detail.map(text => <p className="question-context" key={text}>{text}</p>)}
          <p className="answer-reason">{card.analysis.summary}</p>
          {card.interaction_id === 'lock' && resolved.outcome === 'incorrect' ? <p className="answer-reason">已解锁，稍后复习。</p> : null}
          {card.audio?.transcript?.trim() ? <details className="full-analysis"><summary>听力原文</summary><p className="front-material">{card.audio.transcript}</p></details> : null}
          <ResultExplanation card={card} />
        </section> : <>
          {card.interaction_id !== 'swipe' ? <h2 className={isLongQuestion(backVisible ? comparison.correct : card.front.prompt) ? 'long-question' : undefined}>{backVisible ? comparison.correct : displayCardText(card, card.front.prompt)}</h2> : null}
          {backVisible ? <p className="question-context">{displayCardText(card, card.front.prompt)}</p> : null}
          {!backVisible ? material.map(text => <p className="front-material" key={text}>{text}</p>) : null}
          {audioControl}
          {card.interaction_id !== 'flip' ? interaction : null}
          <LearningHelp key={`help:${props.motionIdentity}`} card={card} state={cardState} patch={patchState} />
        </>}

        {props.queuedResult ? <section className="notice" aria-live="polite"><h3>{props.rejectedCompletion ? '这次结果未计入' : '学习结果等待同步'}</h3><p>{props.rejectedCompletion ? '这张卡的学习安排已经变化，重新读取后可继续。' : '答案已保存，确认后即可继续。'}</p>{!props.rejectedCompletion ? <button className="secondary" disabled={props.retryBusy} onClick={props.onRetryQueued}>重试同步</button> : null}<button className="text-button" disabled={props.retryBusy} onClick={props.onReloadQueued}>刷新学习进度</button></section> : null}
        {props.statusMessage ? <p className="notice error" role="alert">{props.statusMessage}</p> : null}
        {!['已保存在本机', '已同步', ''].includes(props.syncStatus) ? <p className="notice" role="status">学习记录 · {props.syncStatus}</p> : null}
      </div>
      {resolved ? <div className="learning-dock"><button className="primary" disabled={props.busy || motionBusy} onClick={onContinue}>{continueLabel}</button></div> : !props.queuedResult && (card.interaction_id === 'multiple_choice' || card.interaction_id === 'elimination') ? <div className="learning-dock"><button className="primary" disabled={props.busy || !canSubmitVisibleLearningCard(card, cardState)} onClick={() => onResolve()}>提交答案</button></div> : card.interaction_id === 'flip' ? <div className="learning-dock">{interaction}</div> : null}
    </article>
    <aside className="learning-context"><p className="context-caption">卡片位置</p><p className="context-address">{library} / {group}</p><button className="context-box" onClick={props.onOpenSpace}><small>打开卡盒 →</small><strong>{box}</strong></button></aside>
    </div>
    {resolved || !backVisible ? <p className="shortcut-note">{resolved ? `键盘：Enter ${continueLabel}` : shortcutLabel(card)}</p> : null}
  </main>;
}

function LearningHelp({card, state, patch}: {card: LearningCard; state: LearningCardState; patch: (value: Partial<LearningCardState>) => void}) {
  const [open, setOpen] = useState(state.isHintVisible || state.isPeeked);
  return <details className="learning-help" open={open} onToggle={event => {
    const nextOpen = event.currentTarget.open;
    setOpen(nextOpen);
    if (!nextOpen && (state.isHintVisible || state.isPeeked)) patch({isHintVisible: false, isPeeked: false});
  }}>
    <summary>需要帮助</summary>
    {card.hint_layer ? <div>
      <button className="text-button" aria-expanded={state.isHintVisible} onClick={() => patch({hasUsedHint: true, isHintVisible: !state.isHintVisible})}>{state.isHintVisible ? '收起提示' : '查看提示'}</button>
      {state.isHintVisible ? <p className="attached-note">{card.hint_layer.content}</p> : null}
    </div> : null}
    <div>
      <button className="text-button" aria-expanded={state.isPeeked} onClick={() => patch({hasUsedPeek: true, isPeeked: !state.isPeeked})}>{state.isPeeked ? '收起思路' : '解题思路'}</button>
      {state.isPeeked ? <p className="attached-note">{card.analysis.exam_tip}</p> : null}
    </div>
  </details>;
}

function ChoiceOptions({card, state, disabled, patch}: {card: Extract<LearningCard, {interaction_id: 'multiple_choice'}>; state: LearningCardState; disabled: boolean; patch: (value: Partial<LearningCardState>) => void}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => Math.min(620, window.innerWidth - 72));
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]?.contentRect.width > 0) setWidth(entries[0].contentRect.width);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`interaction choice-grid${stackChoiceOptions(card.options, width) ? ' choice-grid-stacked' : ''}`} role="group" aria-label="四选一选项">
    {card.options.map(option => <button key={option.id} className={state.selectedOptionId === option.id ? 'choice selected' : 'choice'} aria-pressed={state.selectedOptionId === option.id} disabled={disabled} onClick={() => patch({selectedOptionId: option.id})}><span>{option.label}</span><span className="choice-text">{option.text}</span></button>)}
  </div>;
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
                <button className={state.flipConfidence === 'review' ? 'confidence-review selected' : 'confidence-review'} aria-pressed={state.flipConfidence === 'review'} disabled={disabled} onClick={() => onResolveFlip('review')}>需要复习</button>
              </div>
            </>
          )}
        </div>
      );
    case 'multiple_choice':
      return <ChoiceOptions card={card} state={state} disabled={disabled} patch={patch} />;
    case 'lock':
      return (
        <div className="interaction lock-list" role="group" aria-label="开锁槽位">
          <p className="forming-sentence" aria-label="已填写的内容">{card.lock_slots.map((slot, index) => state.lockSelections[slot.id] === card.answer_key.lock_pattern[index] ? state.lockSelections[slot.id] : '____').join(' ')}</p>
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
              {item.description.trim() !== item.label.trim() ? <small>{item.description}</small> : null}
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

function SpaceSurface({busy, cards, canMutate, currentCardId, pendingReviewIds, favorites, sleeping, membership, onFavorite, onSleep, onReturn, statusMessage, syncStatus}: {busy: boolean; cards: LearningCard[]; canMutate: boolean; currentCardId: string | null; pendingReviewIds: string[]; favorites: string[]; sleeping: string[]; membership: MembershipState; onFavorite: (id: string) => void; onSleep: (id: string) => void; onReturn: () => void; statusMessage: string; syncStatus: string}) {
  const [filter, setFilter] = useState<SpaceCardFilter>('all');
  const [filterLimit, setFilterLimit] = useState(40);
  const boxTray = useRef<HTMLElement>(null);
  const matches = filterSpaceCards(cards, filter, favorites, pendingReviewIds);
  const openFilteredCard = (card: LearningCard) => {
    setSelectedBoxRef(card.space_metadata.box_ref);
    setSelectedId(card.card_id);
    setFilter('all');
    requestAnimationFrame(() => {boxTray.current?.scrollIntoView?.({block: 'start'}); boxTray.current?.focus({preventScroll: true});});
  };
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
        <span className="contained-card-tags">{favorites.includes(card.card_id) ? <small className="favorite-tag">收藏</small> : null}<small>{isSleeping ? '休眠中' : isCurrent ? '当前学习' : isSelected ? '正在浏览' : '同盒卡'}</small></span>
      </button>
      {isSelected ? <div className="object-actions" aria-label="所选卡片操作"><button className="text-button" disabled={busy || !canMutate} onClick={() => onFavorite(card.card_id)}>{favorites.includes(card.card_id) ? '取消收藏' : '收藏'}</button><button className="text-button" disabled={busy || !canMutate} onClick={() => onSleep(card.card_id)}>{isSleeping ? '恢复学习' : '暂不学习这张卡'}</button></div> : null}
    </div>;
  };
  return <main className="space-workbench" style={libraryStyle(selectedBox?.library)} aria-labelledby="space-title">
    <div className="space-topline"><span className="space-title">知识空间</span><button className="text-button" onClick={onReturn}>继续学习</button></div>
    <div className="space-filters" role="group" aria-label="卡片筛选">
      {([['all', '全部卡片', '全部卡片'], ['favorites', '收藏', '只看收藏'], ['review', '待复习', '只看待复习']] as const).map(([value, label, name]) => <button key={value} className="text-button" aria-label={name} aria-pressed={filter === value} onClick={() => {setFilter(value); setFilterLimit(40);}}>{label}</button>)}
    </div>
    {filter !== 'all' ? <section className="filtered-cards" aria-label="筛选结果">
      <p className="muted" role="status">{matches.length ? `${matches.length} 张卡片` : filter === 'favorites' ? '还没有收藏的卡片。' : '目前没有待复习的卡片。'}</p>
      {matches.slice(0, filterLimit).map(card => <button className="filtered-card" key={card.card_id} onClick={() => openFilteredCard(card)}>
        <span className="muted">{[card.space_metadata.library, card.space_metadata.group, card.space_metadata.box].map(name => formatSpaceDisplayName(name, '')).join(' / ')}</span>
        <strong>{spaceCardPreview(card).title}</strong>
        {card.card_id === currentCardId ? <small>当前学习</small> : null}
      </button>)}
      {matches.length > filterLimit ? <button className="text-button" onClick={() => setFilterLimit(value => value + 40)}>显示更多</button> : null}
    </section> : <>
    <section className="shelf-map" aria-label="知识空间层级">
      <div className="library-tabs" aria-label="书架">{libraries.map(library => <button key={library} className={selectedBox?.library === library ? 'library-tab selected' : 'library-tab'} aria-pressed={selectedBox?.library === library} onClick={() => {const first = boxes.find(box => box.library === library); if (first) selectBox(first);}}><span style={{backgroundColor: resolveLibraryTone(library).accent}} />{library}</button>)}</div>
      <div className="space-group-tabs" aria-label="书架分区">{groups.map(group => <button key={group} aria-pressed={selectedBox?.group === group} onClick={() => {const first = boxes.find(box => box.library === selectedBox?.library && box.group === group); if (first) selectBox(first);}}>{group}</button>)}</div>
      <div className="shelf-groups">{groups.filter(group => group === selectedBox?.group).map(group => <section className="shelf-group" key={group} aria-label={group}><h2>{group}</h2><div className="sibling-boxes">{boxes.filter(box => box.library === selectedBox?.library && box.group === group).map(box => <button key={box.boxRef} className={box.boxRef === selectedBox?.boxRef ? 'shelf-box selected' : 'shelf-box'} aria-label={`${box.box} ${box.cards.length} 张`} aria-current={box.boxRef === selectedBox?.boxRef ? 'location' : undefined} onClick={() => selectBox(box)}><strong>{box.box}</strong><small>{box.cards.length} 张</small></button>)}</div></section>)}</div>
    </section>
    <section ref={boxTray} tabIndex={-1} className="box-tray" aria-label={`当前卡盒 ${selectedBox?.box ?? '暂无'}`}>
      <div className="workbench-heading"><div aria-label="当前卡片位置"><p className="eyebrow"><span>{selectedBox?.library}</span> / <span>{selectedBox?.group}</span></p><h1 id="space-title">{selectedBox?.box ?? '当前没有卡盒'}</h1></div><span className="counter">{selectedBox?.cards.length ?? 0} 张</span></div>
      <div className="box-contents" aria-label="盒内卡片"><div className="contained-cards">{activeCards.map(renderCard)}</div>
        <section className="sleep-region" aria-label="盒内休眠区"><div className="sleep-heading"><span>休眠区</span><small>{sleepingCards.length ? `${sleepingCards.length} 张卡暂时离开学习流，保留在这个盒中` : '暂时离开学习流，保留在这个盒中'}</small></div>{sleepingCards.length ? <div className="contained-cards">{sleepingCards.map(renderCard)}</div> : <p className="sleep-empty">暂无休眠卡片</p>}</section>
      </div>
    </section>
    </>}
    {statusMessage ? <p className="notice error" role="alert">{statusMessage}</p> : null}
    {!['已保存在本机', '已同步', ''].includes(syncStatus) ? <p className="notice" role="status">学习记录 · {syncStatus}</p> : null}
    {!resolveMembershipAccess(membership).completePhysicalSpace ? <p className="membership-note">你可以学习已解锁的卡片，会员可查看全部内容。</p> : null}
  </main>;
}

function StatisticsSurface({
  localOnly,
  busy,
  checkInSync,
  disabled,
  onCheckIn,
  results,
  syncStatus,
  cumulativeLearnedCount,
  pendingReviewCount,
  onContinueLearning,
  dailyCounts,
  onReview,
}: {
  localOnly: boolean;
  busy: boolean;
  checkInSync: WebRemoteSnapshot['checkInSync'] | null;
  disabled: boolean;
  onCheckIn: () => void;
  results: LearningCardResult[];
  syncStatus: string;
  onReview?: () => void;
  dailyCounts?: {learning:number;review:number;correct:number;hints:number};
  cumulativeLearnedCount: number;
  pendingReviewCount: number;
  onContinueLearning: () => void;
}) {
  const summary = summarizeLearningResults(results, results.length);
  const rows = [
    ['今日完成', `${dailyCounts ? dailyCounts.learning + dailyCounts.review : summary.completed} 张`],
    ['待复习', `${pendingReviewCount} 张`],
    ['累计学过', `${cumulativeLearnedCount} 张`],
    ['今日答对', String(dailyCounts?.correct ?? summary.autoCorrectCount)],
    ['使用提示', String(dailyCounts?.hints ?? summary.hintUseCount)],
  ];
  const checkInLabel = busy
    ? '正在提交'
    : checkInSync?.status === 'confirmed'
    ? '今日已签到'
    : checkInSync?.status === 'queued'
    ? localOnly ? '重试保存' : '重试同步'
    : checkInSync?.status === 'ready'
    ? '签到'
    : '签到暂不可用';
  return (
    <main className="ledger-workbench">
      <section className="ledger" aria-labelledby="statistics-title">
        <h1 id="statistics-title">学习统计</h1>
        {!['已保存在本机', '已同步', ''].includes(syncStatus) ? <p className="muted" role="status">学习记录 · {syncStatus}</p> : null}
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <button className="primary wide" disabled={disabled} onClick={pendingReviewCount > 0 && onReview ? onReview : onContinueLearning}>{pendingReviewCount > 0 && onReview ? '开始复习' : '继续学习'}</button>
        <section className="account-policy" aria-live="polite">
          <p>
            {checkInSync?.status === 'queued'
              ? localOnly ? '签到正在保存到本机。' : '签到已保存在本机，联网后会同步。'
              : checkInSync?.status === 'confirmed'
              ? localOnly ? '签到已保存在本机。' : '签到已同步。'
              : checkInSync?.status === 'unavailable'
              ? '完成一张卡片后就可以签到。'
              : '完成学习后，点下方按钮签到。'}
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
  track,
  onSwitchTrack,
  localOnly,
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
  track: LearningTrack;
  onSwitchTrack?: (track: LearningTrack) => void;
  localOnly: boolean;
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
  const stageLabel = {trial_available: '尚未开始试用', trial: '试用中', free: '基础版', premium: '会员'}[membership.stage];
  return <main className="account-workbench"><section className="account-object" aria-labelledby="mine-title">
    <p className="eyebrow">我的账户</p><h1 id="mine-title">{maskPhone(phone)}</h1>
    <div className="account-row"><span>{localOnly ? '使用方式' : '会员状态'}</span><strong>{localOnly ? '本地体验' : stageLabel}</strong></div>
    <div className="account-row"><span>学习记录</span><strong>{syncStatus}</strong></div>
    {onSwitchTrack ? <fieldset className="account-track-selector" disabled={busy || accountLocked}>
      <legend>备考科目</legend>
      {(['cet4', 'cet6'] as const).map(value => <button key={value} className={track === value ? 'primary' : 'secondary'} aria-pressed={track === value} onClick={() => onSwitchTrack(value)}>{value === 'cet4' ? '英语四级' : '英语六级'}</button>)}
      <p className="muted">四六级的学习进度分别保存，切换后可以接着学。</p>
    </fieldset> : null}
    {statusMessage ? <p className="notice error" role="alert">{statusMessage}</p> : null}
    {membership.stage === 'premium' ? <p className="notice">已解锁全部卡片、复习和知识空间。</p> : null}
    {!localOnly ? <p className="muted">内测资格需邀请开通</p> : null}
    <p className="muted">{localOnly ? '学习记录保存在当前浏览器中，刷新后可继续。清除浏览器数据会删除这些记录。' : '获得邀请后，登录对应账号即可使用。'}</p>
    <button className="tool" aria-expanded={showPrivacy} onClick={() => setShowPrivacy(value => !value)}>账号与隐私</button>
    {showPrivacy ? <section className="account-policy" aria-label="账号与隐私说明"><h2>账号与隐私</h2><p>{localOnly ? '本地体验不会发送短信，也不会创建在线账号。' : '手机号用于登录和同步学习记录。'}</p></section> : null}
    {accountDeletionStage === 'confirming' ? (
      <section
        className="account-policy"
        aria-labelledby="delete-account-title"
        role="dialog"
      >
        <p className="eyebrow">注销账号</p>
        <h2 id="delete-account-title">确认注销账号？</h2>
        <p>
          申请受理后，将退出登录并删除学习记录、收藏、休眠设置和会员信息。
          注销无法撤销，删除的记录无法恢复。数据清理需要一些时间。
        </p>
        <button className="secondary" disabled={busy} onClick={onCancelDelete}>
          暂不注销
        </button>
        <button className="tool danger" disabled={busy} onClick={onConfirmDelete}>
          确认注销账号
        </button>
      </section>
    ) : accountDeletionStage === 'submitting' ? (
      <section className="account-policy" aria-live="polite">
        <p className="eyebrow">注销账号</p>
        <h2>正在提交注销申请</h2>
        <p>正在确认申请是否收到，请稍候。</p>
        <button className="tool danger" disabled>正在提交</button>
      </section>
    ) : accountDeletionStage === 'unknown' ? (
      <section className="account-policy" aria-live="polite">
        <p className="eyebrow">结果尚未确认</p>
        <h2>尚未确认注销结果</h2>
        <p>
          还没收到注销结果，请重试查询。
        </p>
        <button className="tool danger" disabled={busy} onClick={onRetryDelete}>
          {busy ? '正在重试' : '重新查询'}
        </button>
      </section>
    ) : (
      <button
        className="tool danger"
        disabled={busy || !canDeleteAccount}
        onClick={onRequestDelete}
      >
        {canDeleteAccount ? '注销账号' : localOnly ? '本地体验无需注销账号' : '暂时无法注销账号'}
      </button>
    )}
    <button className="text-button account-logout" disabled={busy || accountLocked} onClick={onLogout}>{localOnly ? '返回首页' : '退出登录'}</button>
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
      eyebrow: '注销账号',
      title: '注销申请已提交',
      detail:
        '你已退出登录。注销正在处理中，完成前暂时不能重新登录。',
    },
    checking: {
      eyebrow: '账号状态',
      title: '正在查询注销进度',
      detail: '正在查询注销进度。',
    },
    cleanup_required: {
      eyebrow: '本机清理',
      title: '正在清理本机记录',
      detail:
        '正在清理本机的登录信息和学习记录，请稍候。',
    },
    registration_cleanup_required: {
      eyebrow: '重新登录',
      title: '本机记录还未清理完成',
      detail:
        '没有待处理的注销申请。请先清理本机的旧登录记录，再重新登录。',
    },
    registration_ready: {
      eyebrow: '可以登录',
      title: '可以重新登录了',
      detail:
        '没有待处理的注销申请，可以重新登录。',
    },
    session_cleanup_required: {
      eyebrow: '本机清理',
      title: '正在退出登录',
      detail:
        '正在清理本机记录，完成后可以重新登录。',
    },
    unknown: {
      eyebrow: '结果尚未确认',
      title: '尚未确认注销结果',
      detail:
        '还没收到注销结果，请重试查询。',
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
            返回登录
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
              ? '重新清理'
              : '重新查询'}
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
          <span aria-hidden="true" className="brand-mark"><StudioMark /></span>
          <span className="wordmark">软书</span>
        </div>
        <p className="eyebrow">注销进度</p>
        <h1 id="deletion-recovery-title">查询注销进度</h1>
        <p className="lede">
          请验证原账号的 {maskPhone(phone)}，查询注销进度。
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
            ? '获取验证码'
            : '验证并查询'}
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

function SessionCompleteSurface({continueLabel, busy, phase, results, total, onOpenSpace, onRestart, onStartReview, reviewCountOverride, serverSequenced, statusMessage, syncStatus}: {continueLabel?: string; busy: boolean; phase: 'learning' | 'review'; results: LearningCardResult[]; total: number; onOpenSpace: () => void; onRestart: () => void; onStartReview: () => void; reviewCountOverride?: number; serverSequenced: boolean; statusMessage: string; syncStatus: string}) {
  const summary = summarizeLearningResults(results, total);
  const reviewCount = reviewCountOverride ?? results.filter(result => result.outcome === 'incorrect' || result.outcome === 'review').length;
  return <main className="completion-workbench"><section className="completion-object" aria-labelledby="session-complete-title">
    <h1 id="session-complete-title">{phase === 'review' ? '复习完成' : serverSequenced ? '本轮完成' : '本组完成'}</h1>
    {statusMessage ? <p className="notice error" role="alert">{statusMessage}</p> : null}
    {!['已保存在本机', '已同步', ''].includes(syncStatus) ? <p className="muted" role="status">学习记录 · {syncStatus}</p> : null}
    <div className="completion-summary" aria-label="本轮摘要"><span>完成 <strong>{summary.completed}</strong></span><span>待复习 <strong>{reviewCount}</strong></span></div>
    {phase === 'learning' && reviewCount > 0 ? <button className="primary" disabled={busy} onClick={onStartReview}>开始复习 {reviewCount} 张</button> : null}
    <button className="secondary" disabled={busy} onClick={onOpenSpace}>查看卡片</button>
    <button className="tool" disabled={busy} onClick={onRestart}>{serverSequenced ? '刷新学习进度' : continueLabel ?? '再学一遍'}</button>
  </section></main>;
}

function maskPhone(phone: string) {
  if (phone === 'local-device') return '本地学习';
  return phone.length === 11 ? `${phone.slice(0, 3)} **** ${phone.slice(-4)}` : '已登录';
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
  const labels: Record<LearningCardResult['outcome'], string> = {correct: '判断正确', incorrect: '这张需要复习', confident: '有把握', review: '已加入复习'};
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
