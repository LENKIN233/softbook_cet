import React, { startTransition, useCallback, useEffect, useState } from 'react';
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
import { createLearningSessionRepository } from './src/learning/learningRepository';
import { resolveLearningSessionRepositoryConfig } from './src/learning/learningRuntimeConfig';
import { SpaceSurface } from './src/space/SpaceSurface';

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type DeviceClass = 'phone' | 'tablet';
type AuthStage = 'logged_out' | 'code_sent' | 'authenticated';

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
  stage: AuthStage;
  phoneNumber: string;
  smsCode: string;
  error: string | null;
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
      '统计只用于增强信心和连续性，不成为产品中心。当前壳层只保留入口和信息位。',
    highlights: [
      '不把复杂计数器和状态机抬成核心体验。',
      '后续只补最小必要的签到、学习趋势和反馈摘要。',
      '页面会跟随设备形态变化，但入口顺序保持一致。',
    ],
    focus: ['basic check-in', 'light progress summary'],
  },
  {
    key: 'mine',
    label: '我的',
    badge: '04',
    eyebrow: '账户与会员',
    title: '个人页',
    summary:
      '这里承接账号、会员、恢复购买和设置等内容。当前阶段先把手机号验证码登录挂进来，再在后续分支接入会员合同。',
    highlights: [
      '手机号验证码是主登录方式。',
      '当前分支只做本地门禁，不接真实短信服务。',
      '试用、购买恢复和会员统一权限后续再接。',
    ],
    focus: ['phone sms login', 'trial/paywall', 'purchase recovery'],
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
  stage: 'logged_out',
  phoneNumber: '',
  smsCode: '',
  error: null,
};

const LEARNING_TRACK: LearningTrack = 'cet4';
const learningSessionRepository = createLearningSessionRepository({
  ...resolveLearningSessionRepositoryConfig(),
});

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
  const [spaceCardStateById, setSpaceCardStateById] = useState<
    Record<string, SpaceCardState>
  >({});
  const { width, height } = useWindowDimensions();
  const deviceClass = getDeviceClass(width, height);
  const route = ROUTES.find(item => item.key === activeRoute) ?? ROUTES[0];
  const isAuthenticated = authState.stage === 'authenticated';
  const routeRequiresAuth = PROTECTED_ROUTES.includes(route.key);
  const shouldShowAuthGate = routeRequiresAuth && !isAuthenticated;
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
  const visibleLearningCards =
    learningSession?.cards.filter(
      card => !readSpaceCardState(card.card_id).isSleeping,
    ) ?? [];
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

  const resetLearningDeck = (
    stateMap: Record<string, SpaceCardState> = spaceCardStateById,
    nextSession: LearningSession | null = learningSession,
  ) => {
    const nextVisibleCards =
      nextSession?.cards.filter(
        card => !readSpaceCardState(card.card_id, stateMap).isSleeping,
      ) ?? [];

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
      setSpaceCardStateById({});
      return;
    }

    if (learningBootstrapStatus !== 'idle') {
      return;
    }

    setLearningBootstrapStatus('loading');
    setLearningBootstrapError(null);
  }, [isAuthenticated, learningBootstrapStatus]);

  useEffect(() => {
    if (!isAuthenticated || learningBootstrapStatus !== 'loading') {
      return;
    }

    let isCancelled = false;

    learningSessionRepository
      .loadSession(LEARNING_TRACK)
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
        setLearningCardState(
          session.cards[0]
            ? createTrackedLearningCardState(session.cards[0])
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
  }, [createTrackedLearningCardState, isAuthenticated, learningBootstrapStatus]);

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
      setAuthState(current => {
        if (current.phoneNumber.length !== 11) {
          return {
            ...current,
            error: '请输入 11 位手机号后再请求验证码。',
          };
        }

        return {
          ...current,
          stage: 'code_sent',
          error: null,
          smsCode: '',
        };
      });
    },
    onSubmitCode: () => {
      setAuthState(current => {
        if (current.stage !== 'code_sent') {
          return {
            ...current,
            error: '请先请求验证码。',
          };
        }

        if (current.smsCode.length < 4) {
          return {
            ...current,
            error: '请输入 4-6 位验证码。',
          };
        }

        return {
          ...current,
          stage: 'authenticated',
          error: null,
          smsCode: '',
        };
      });
    },
    onLogout: () => {
      setAuthState(INITIAL_AUTH_STATE);
      setLearningPhase('learning');
      setReviewSessionCards([]);
      setReviewCompletedResults([]);
      setSpaceCardStateById({});
      startTransition(() => {
        setActiveRoute('mine');
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

  const content = shouldShowAuthGate ? (
    <AuthGate
      authState={authState}
      handlers={authHandlers}
      palette={palette}
      route={route}
    />
  ) : route.key === 'mine' ? (
    <MineSurface
      authState={authState}
      handlers={authHandlers}
      palette={palette}
      route={route}
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
      onGoToSpace={() => {
        startTransition(() => {
          setActiveRoute('space');
        });
      }}
      palette={palette}
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
  onGoToSpace,
  palette,
}: {
  onGoToSpace: () => void;
  palette: Palette;
}) {
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
          根据空间规则，进入休眠区的卡不会继续出现在学习流里。先去空间里把需要恢复的卡移出休眠区，再继续当前学习。
        </Text>
      </View>
      <InfoCard
        palette={palette}
        title="这一步为什么拦住学习流"
        items={[
          '休眠是 remove-from-flow 行为，不是普通标签。',
          '当前实现会立刻把休眠卡移出当前学习集合。',
          '恢复后再回学习入口，就能重新进入学习流。',
        ]}
      />
      <Pressable
        onPress={onGoToSpace}
        style={[styles.primaryButton, { backgroundColor: palette.accent }]}
        testID="learning-go-space-button"
      >
        <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
          去空间管理休眠卡
        </Text>
      </Pressable>
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
  authState,
  handlers,
  palette,
  route,
}: {
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
        authState={authState}
        handlers={handlers}
        palette={palette}
        title="手机号验证码登录"
        summary="先把主登录方式接进壳层。真实短信服务、试用起算和会员矩阵后续再接。"
      />
      <InfoCard
        palette={palette}
        title="当前门禁只落实什么"
        items={[
          '学习开始前必须登录。',
          '手机号验证码是主登录方式。',
          '本地状态机只服务壳层验证，不等于后端真实认证。',
        ]}
      />
    </ScrollView>
  );
}

function MineSurface({
  authState,
  handlers,
  palette,
  route,
}: {
  authState: AuthState;
  handlers: AuthHandlers;
  palette: Palette;
  route: ShellRoute;
}) {
  const isAuthenticated = authState.stage === 'authenticated';

  return (
    <ScrollView contentContainerStyle={styles.canvasContent}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          ACCOUNT HOST
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {isAuthenticated ? '账号已接入壳层' : '从“我的”完成身份建立'}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {isAuthenticated
            ? '当前已经完成本地登录态验证。后续会在这里接入试用、会员、恢复购买和账号设置。'
            : '“我的”作为账号与会员宿主页，当前先承接手机号验证码登录。'}
        </Text>
      </View>
      <PhoneSmsPanel
        authState={authState}
        handlers={handlers}
        palette={palette}
        title={isAuthenticated ? '当前登录状态' : '手机号验证码登录'}
        summary={
          isAuthenticated
            ? '当前是本地壳层登录态。继续后会接试用起算、会员权限和跨端统一 entitlement。'
            : '先从这里完成身份建立，再让学习流和用户态页面具备真实入口。'
        }
      />
      <RouteCanvas palette={palette} route={route} deviceClass="phone" />
    </ScrollView>
  );
}

function PhoneSmsPanel({
  authState,
  handlers,
  palette,
  title,
  summary,
}: {
  authState: AuthState;
  handlers: AuthHandlers;
  palette: Palette;
  title: string;
  summary: string;
}) {
  const isAuthenticated = authState.stage === 'authenticated';

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
          onPress={handlers.onRequestCode}
          style={[
            styles.primaryButton,
            styles.compactButton,
            { backgroundColor: palette.accent },
          ]}
          testID="auth-request-code-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            {authState.stage === 'code_sent' ? '重新发送验证码' : '请求验证码'}
          </Text>
        </Pressable>
        <Text style={[styles.authHint, { color: palette.textMuted }]}>
          {authState.stage === 'code_sent'
            ? `已向 ${maskPhoneNumber(authState.phoneNumber)} 发送验证码。`
            : '当前是本地壳层验证，不会真的发短信。'}
        </Text>
      </View>

      {authState.stage !== 'logged_out' ? (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
            验证码
          </Text>
          <TextInput
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
            已完成本地登录态验证。
          </Text>
          <Pressable
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
          onPress={handlers.onSubmitCode}
          style={[styles.primaryButton, { backgroundColor: palette.accent }]}
          testID="auth-submit-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            完成登录
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
            '认证先落到壳层，会员与同步后续独立接入。',
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

function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber.length !== 11) {
    return phoneNumber || '未填写手机号';
  }

  return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`;
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
