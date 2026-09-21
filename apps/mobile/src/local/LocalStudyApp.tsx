import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  LearningCardState,
  LearningSession,
  LearningTrack,
} from '../learning/model';
import {
  LearningResultDetailSurface,
  LearningSurface,
} from '../learning/LearningSurface';
import { SpaceSurface, type SpaceSurfaceScreen } from '../space/SpaceSurface';
import { StatisticsSurface } from '../statistics/StatisticsSurface';
import { createLearningSessionRepository } from '../learning/learningRepository';
import {
  createLearningCardState,
  selectLockOption,
  canSubmitLearningCard,
} from '../learning/sessionCore';
import { createAuthSessionStore } from '../persistence/authSessionStore';
import { USER_STATE_STORAGE_KEY } from '../persistence/userStateStore';
import {
  hasStudyActivity,
  activeStudyCard,
  createStudyState,
  nextStudyDue,
  pendingStudyIds,
  planLocalCards,
  studyDay,
  type StudyState,
} from './studyModel';
import { StudyStorageError, type StudyStorage } from './studyStore';
import {
  localStudyLock,
  useChinaDay,
  useStudyProfile,
} from './useStudyProfile';

type Palette = Parameters<typeof StatisticsSurface>[0]['palette'];
const storage: StudyStorage = {
  removeItem: key => AsyncStorage.removeItem(key),
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  getAllKeys: () => AsyncStorage.getAllKeys(),
};
const PREF = 'softbook-cet/local-track';
type Route = 'learning' | 'space' | 'statistics' | 'mine';
export function LocalStudyApp({
  initialTrack,
  palette,
}: {
  initialTrack: LearningTrack;
  palette: Palette;
}) {
  const [track, setTrack] = useState(initialTrack);
  const [trackReady, setTrackReady] = useState(false);
  const [session, setSession] = useState<LearningSession | null>(null);
  const [libraryError, setLibraryError] = useState('');
  const [libraryAttempt, setLibraryAttempt] = useState(0);
  const [entered, setEntered] = useState(false);
  const [route, setRoute] = useState<Route>('learning');
  const [detail, setDetail] = useState(false);
  const [spaceScreen, setSpaceScreen] =
    useState<SpaceSurfaceScreen>('overview');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [archives, setArchives] = useState<
    | { key: string; date: string; count: number | null; canRestore: boolean }[]
    | null
  >(null);
  const { width, height, fontScale } = useWindowDimensions();
  const deviceClass = Math.min(width, height) >= 600 ? 'tablet' : 'phone';
  const { now, day, refresh } = useChinaDay();
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PREF)
      .then(saved => {
        if (active && (saved === 'cet4' || saved === 'cet6')) setTrack(saved);
      })
      .catch(() => {
        if (active) setActionError('考级设置暂时无法读取，将使用默认考级。');
      })
      .finally(() => {
        if (active) setTrackReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => {
      if (value === 'active') refresh();
    });
    return () => listener.remove();
  }, [refresh]);
  useEffect(() => {
    if (!trackReady) return;
    let active = true;
    setSession(null);
    setLibraryError('');
    createLearningSessionRepository({ mode: 'local' })
      .loadSession({ phoneNumber: '00000000000' }, track)
      .then(next => {
        if (active) setSession(next);
      })
      .catch(() => {
        if (active) setLibraryError('卡库暂时无法读取，请重试。');
      });
    return () => {
      active = false;
    };
  }, [track, trackReady, libraryAttempt]);
  const input = useMemo(
    () =>
      session?.track === track
        ? {
            track,
            contentVersion: session.contentVersion ?? session.sourceId,
            cards: session.catalogCards,
          }
        : null,
    [track, session],
  );
  const legacyNative = useCallback(async (): Promise<StudyState | null> => {
    if (!session) return null;
    const raw = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
    if (raw === null) return null;
    let old;
    try {
      old = JSON.parse(raw);
    } catch {
      const backupKey = `softbook-cet/study/v2/${track}/archive/legacy-invalid`;
      await AsyncStorage.setItem(backupKey, raw);
      if ((await AsyncStorage.getItem(backupKey)) !== raw)
        throw new StudyStorageError('unavailable');
      throw new StudyStorageError('invalid');
    }
    const oldAuth =
      old.owner_phone_number === '00000000000'
        ? null
        : await createAuthSessionStore().load();
    if (
      old.owner_phone_number !== '00000000000' &&
      !(
        oldAuth?.mode === 'local' &&
        old.owner_phone_number === oldAuth.phoneNumber
      )
    )
      return null;
    const next = createStudyState(session.catalogCards);
    const known = new Set(session.catalogCards.map(card => card.card_id));
    if (
      !old.space_card_state_by_id ||
      typeof old.space_card_state_by_id !== 'object'
    )
      throw new StudyStorageError('invalid');
    for (const [id, value] of Object.entries(old.space_card_state_by_id)) {
      if (!known.has(id)) continue;
      const item = value as { is_favorited: boolean; is_sleeping: boolean };
      if (item.is_favorited) next.favorites.push(id);
      if (item.is_sleeping) next.sleeping.push(id);
    }
    if (typeof old.checked_in_day_key === 'string')
      next.checkIns = [old.checked_in_day_key];
    const current =
      old.learning_cursor?.track === track
        ? session.cards.find(
            card =>
              card.card_id === old.learning_cursor.card_id &&
              !next.sleeping.includes(card.card_id),
          )
        : null;
    const ids = [
      ...(current ? [current] : []),
      ...planLocalCards(session.catalogCards).filter(
        card =>
          card.card_id !== current?.card_id &&
          !next.sleeping.includes(card.card_id),
      ),
    ]
      .slice(0, 5)
      .map(card => card.card_id);
    const card = session.cards.find(item => item.card_id === ids[0]);
    next.frame = {
      ...next.frame,
      ids,
      complete: !card,
      draft: card
        ? {
            ...createLearningCardState(card),
            isFavorited: next.favorites.includes(card.card_id),
          }
        : null,
    };
    const backupKey = `softbook-cet/study/v2/${track}/archive/legacy-native`;
    await AsyncStorage.setItem(backupKey, raw);
    if ((await AsyncStorage.getItem(backupKey)) !== raw)
      throw new StudyStorageError('unavailable');
    return next;
  }, [session, track]);
  const study = useStudyProfile(input, storage, localStudyLock, legacyNative);
  const state = input ? study.state : null;
  const cards = session?.catalogCards ?? [];
  const card = state ? activeStudyCard(state, cards) : null;
  const pending = state ? pendingStudyIds(state, cards, now) : [];
  const counts = state
    ? studyDay(state, now)
    : { learning: 0, review: 0, correct: 0, hints: 0 };
  const perform = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setActionError('');
    try {
      await work();
    } catch {
      setActionError('操作未完成，原记录已保留。请重试。');
    } finally {
      setBusy(false);
    }
  };
  const navigate = (next: Route) => {
    setDetail(false);
    setSpaceScreen('overview');
    setRoute(next);
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (detail) {
        setDetail(false);
        return true;
      }
      if (route === 'space' && spaceScreen === 'card_list') {
        setSpaceScreen('overview');
        return true;
      }
      if (route !== 'learning') {
        navigate('learning');
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [detail, route, spaceScreen]);
  const button = (
    label: string,
    action: () => void,
    id?: string,
    disabled = false,
    primary = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      testID={id}
      style={[
        styles.button,
        {
          borderColor: primary ? palette.accent : palette.border,
          backgroundColor: primary ? palette.accent : palette.panel,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={{ color: primary ? palette.primaryActionText : palette.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const chooseTrack = (next: LearningTrack) => {
    if (next === track) return;
    void perform(async () => {
      await study.flush();
      await AsyncStorage.setItem(PREF, next);
      setTrack(next);
      navigate('learning');
    });
  };
  const trackPicker = (
    <View style={styles.row} accessibilityRole="toolbar">
      {(['cet4', 'cet6'] as const).map(value => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityLabel={value === 'cet4' ? '英语四级' : '英语六级'}
          accessibilityState={{ selected: track === value, disabled: busy }}
          disabled={busy}
          onPress={() => chooseTrack(value)}
          testID={`local-track-${value}`}
          style={[
            styles.button,
            {
              backgroundColor:
                track === value ? palette.accentSoft : palette.panel,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={{ color: palette.text }}>
            {value === 'cet4' ? '英语四级' : '英语六级'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const exportBackup = () =>
    void perform(async () => {
      await Share.share({
        title: '软书学习备份',
        message: await study.backup(),
      });
    });
  const recovery = (
    <View style={styles.stack}>
      {button(
        '导出学习备份',
        exportBackup,
        'local-export-backup',
        busy || !session,
      )}
      {button(
        '导入学习备份',
        () => setShowImport(value => !value),
        'local-import-backup',
        busy || !session,
      )}
      {showImport ? (
        <View>
          <TextInput
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            value={importText}
            onChangeText={setImportText}
            accessibilityLabel="备份内容"
            placeholder="粘贴之前导出的备份内容"
            style={[
              styles.input,
              { color: palette.text, borderColor: palette.border },
            ]}
          />
          {button(
            '恢复备份',
            () =>
              void perform(async () => {
                await study.restore(importText);
                setShowImport(false);
                setImportText('');
              }),
            'local-restore-backup',
            busy || !importText,
          )}
        </View>
      ) : null}
      {button(
        '查看已有备份',
        () => void perform(async () => setArchives(await study.archives())),
        'local-list-backups',
        busy || !session,
      )}
      {archives?.map((item, index) => (
        <View key={item.key}>
          <Text style={{ color: palette.text }}>
            {item.date} ·{' '}
            {item.count === null ? '原始备份' : `${item.count} 张学习记录`}
          </Text>
          {button(
            item.canRestore ? '恢复这份记录' : '原内容已保留，可导出备份',
            () =>
              Alert.alert('恢复备份', '当前记录会先备份，再恢复所选记录。', [
                { text: '取消', style: 'cancel' },
                {
                  text: '恢复',
                  onPress: () =>
                    void perform(async () => study.restoreArchive(item.key)),
                },
              ]),
            `local-restore-archive-${index}`,
            !item.canRestore || busy,
          )}
          {button(
            '移除本机备份',
            () =>
              Alert.alert(
                '移除备份',
                '请先导出备份。移除后将无法从本机恢复这份历史记录，当前档案不受影响。',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '移除',
                    style: 'destructive',
                    onPress: () =>
                      void perform(async () => {
                        await study.deleteArchive(item.key);
                        setArchives(await study.archives());
                      }),
                  },
                ],
              ),
            undefined,
            busy,
          )}
        </View>
      ))}
      {button(
        '备份后重新开始',
        () =>
          Alert.alert(
            '开始新的学习记录',
            '原记录会先备份保留，再开始新的记录。',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '备份并开始',
                onPress: () => void perform(study.reset),
              },
            ],
          ),
        'local-reset-records',
        busy || !session,
      )}
    </View>
  );
  const error = libraryError || study.error || actionError;
  const notices = (
    <>
      {study.notice ? (
        <View style={[styles.notice, { backgroundColor: palette.panelStrong }]}>
          <Text style={{ color: palette.text }}>{study.notice}</Text>
          {button('知道了', study.clearNotice)}
        </View>
      ) : null}
      {error ? (
        <View style={[styles.notice, { backgroundColor: palette.panelStrong }]}>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: palette.danger }}
          >
            {error}
          </Text>
          {libraryError ? (
            button('重新加载卡库', () => setLibraryAttempt(value => value + 1))
          ) : (
            <>
              {state
                ? button('重试保存', study.retry, 'local-retry-save')
                : null}
              {button('读取已保存进度', () =>
                Alert.alert(
                  '读取已有记录',
                  '本页未保存的修改将被替换，可先导出备份。',
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '读取',
                      onPress: () => void perform(study.reload),
                    },
                  ],
                ),
              )}
              {recovery}
            </>
          )}
        </View>
      ) : null}
    </>
  );
  const saveLabel =
    study.status === 'saved'
      ? '已保存在本机'
      : study.status === 'error'
      ? '尚未保存'
      : '正在保存';
  if (!entered)
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: palette.background }]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={palette.background}
        />
        <ScrollView contentContainerStyle={styles.entry}>
          <Text style={[styles.title, { color: palette.text }]}>
            软书四六级
          </Text>
          <Text style={{ color: palette.textMuted }}>
            无需手机号或验证码，进度保存在本机。
          </Text>
          {trackPicker}
          {notices}
          {button(
            !state && !error
              ? '正在准备…'
              : state && hasStudyActivity(state)
              ? '继续学习'
              : '开始学习',
            () => setEntered(true),
            'local-start-learning-button',
            !state || busy,
            true,
          )}
        </ScrollView>
      </SafeAreaView>
    );
  const patch = (value: Partial<LearningCardState>) => {
    if (state?.frame.draft) study.dispatch({ type: 'patch', patch: value });
  };
  const rows = state
    ? Object.fromEntries(
        cards.map(item => [
          item.card_id,
          {
            isFavorited: state.favorites.includes(item.card_id),
            isSleeping: state.sleeping.includes(item.card_id),
          },
        ]),
      )
    : {};
  const sessionCards = state
    ? state.frame.ids.flatMap(id => {
        const found = cards.find(item => item.card_id === id);
        return found ? [found] : [];
      })
    : [];
  const resumeLabel = state?.resume !== null;
  const examLabel = track === 'cet4' ? '英语四级' : '英语六级';
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: palette.background }]}
      testID="local-study-root"
    >
      <StatusBar barStyle="dark-content" backgroundColor={palette.background} />
      <View style={styles.header}>
        <Text style={[styles.brand, { color: palette.text }]}>软书四六级</Text>
        <Text style={{ color: palette.textMuted }}>
          {examLabel}
        </Text>
      </View>
      {error || study.notice ? (
        <ScrollView style={styles.notices}>{notices}</ScrollView>
      ) : null}
      <View style={styles.body}>
        {!state ? (
          <Text style={{ color: palette.text }}>正在读取学习记录…</Text>
        ) : (
          <>
            {route === 'learning' ? (
              detail && card && state.frame.draft && state.frame.resolved ? (
                <LearningResultDetailSurface
                  card={card}
                  cardState={state.frame.draft}
                  result={state.frame.resolved}
                  phase={state.frame.phase}
                  currentIndex={state.frame.index}
                  sessionCardCount={state.frame.ids.length}
                  sessionLabel="学习"
                  isLastCard={state.frame.index + 1 >= state.frame.ids.length}
                  onAdvanceCard={() => {
                    setDetail(false);
                    study.dispatch({ type: 'advance' });
                  }}
                  onBackToPractice={() => setDetail(false)}
                  palette={palette}
                />
              ) : state.frame.complete ? (
                <ScrollView
                  contentContainerStyle={styles.entry}
                  testID="local-group-complete"
                >
                  <Text style={[styles.title, { color: palette.text }]}>
                    {state.frame.ids.length ? '本组完成' : '当前安排已完成'}
                  </Text>
                  <Text style={{ color: palette.text }}>
                    完成 {state.frame.results.length} 张卡片。
                  </Text>
                  {pending.length
                    ? button(
                        `开始复习 ${pending.length} 张`,
                        () => study.dispatch({ type: 'review' }),
                        'learning-start-review-button',
                      )
                    : null}
                  {button(
                    resumeLabel ? '回到原来的学习' : '继续下一组',
                    () => study.dispatch({ type: 'continue' }),
                    'learning-restart-button',
                  )}
                  {!pending.length && nextStudyDue(state) ? (
                    <Text style={{ color: palette.textMuted }}>
                      下次复习：
                      {new Date(nextStudyDue(state)!).toLocaleString('zh-CN', {
                        timeZone: 'Asia/Shanghai',
                      })}
                    </Text>
                  ) : null}
                  {button('查看卡片', () => navigate('space'))}
                  {!state.frame.ids.length
                    ? button('重新练习', () =>
                        study.dispatch({ type: 'practice' }),
                      )
                    : null}
                </ScrollView>
              ) : (
                <LearningSurface
                  palette={palette}
                  sessionCards={sessionCards}
                  sessionLabel="学习"
                  phase={state.frame.phase}
                  currentCard={card}
                  currentCardState={state.frame.draft}
                  currentIndex={state.frame.index}
                  currentResult={state.frame.resolved}
                  completedResults={state.frame.results}
                  reviewCandidateCount={pending.length}
                  audioAttemptId={`${track}:${
                    state.frame.phase
                  }:${state.frame.ids.join(',')}:${state.frame.index}`}
                  allowBundledAudio={
                    session?.sourceId === 'bundled-card-make-v1'
                  }
                  onTogglePeek={() =>
                    patch({
                      isPeeked: !state.frame.draft?.isPeeked,
                      hasUsedPeek: true,
                    })
                  }
                  onToggleHint={() =>
                    patch({
                      isHintVisible: !state.frame.draft?.isHintVisible,
                      hasUsedHint: true,
                    })
                  }
                  onToggleFavorite={() => {
                    if (card)
                      study.dispatch({ type: 'favorite', id: card.card_id });
                  }}
                  onFlip={() => patch({ isFlipped: true })}
                  onSetFlipConfidence={value => {
                    if (state.frame.draft)
                      study.dispatch({
                        type: 'answer',
                        draft: {
                          ...state.frame.draft,
                          isFlipped: true,
                          flipConfidence: value,
                        },
                      });
                  }}
                  onSelectOption={value => patch({ selectedOptionId: value })}
                  onSetLockSelection={(slot, value) => {
                    if (card && state.frame.draft) {
                      const draft = selectLockOption(
                        card,
                        state.frame.draft,
                        slot,
                        value,
                      );
                      study.dispatch({
                        type: canSubmitLearningCard(card, draft)
                          ? 'answer'
                          : 'draft',
                        draft,
                      });
                    }
                  }}
                  onToggleEliminationItem={id =>
                    patch({
                      eliminatedItemIds:
                        state.frame.draft!.eliminatedItemIds.includes(id)
                          ? state.frame.draft!.eliminatedItemIds.filter(
                              value => value !== id,
                            )
                          : [...state.frame.draft!.eliminatedItemIds, id],
                    })
                  }
                  onSelectSwipeState={value => {
                    if (state.frame.draft)
                      study.dispatch({
                        type: 'answer',
                        draft: { ...state.frame.draft, swipeSelection: value },
                      });
                  }}
                  onSubmitCurrentCard={() =>
                    study.dispatch({ type: 'answer' })
                  }
                  onOpenResultDetail={() => setDetail(true)}
                  onAdvanceCard={() => study.dispatch({ type: 'advance' })}
                  onRestartDeck={() => study.dispatch({ type: 'continue' })}
                />
              )
            ) : null}
            {route === 'space' ? (
              <SpaceSurface
                palette={palette}
                deviceClass={deviceClass}
                usesAccessibilityLayout={fontScale >= 1.3}
                spaceCards={cards}
                cardStateById={rows}
                currentLearningCard={card}
                pendingReviewIds={pending}
                screen={spaceScreen}
                onOpenCardList={() => setSpaceScreen('card_list')}
                onBackToOverview={() => setSpaceScreen('overview')}
                onReturnToLearning={() => navigate('learning')}
                onToggleFavoriteTag={id =>
                  study.dispatch({ type: 'favorite', id })
                }
                onToggleSleepState={id =>
                  study.dispatch({ type: 'sleep', id })
                }
              />
            ) : null}
            {route === 'statistics' ? (
              <StatisticsSurface
                palette={palette}
                deviceClass={deviceClass}
                canCheckInToday={counts.learning + counts.review > 0}
                hasCheckedInToday={
                  study.savedState?.checkIns.includes(day) === true
                }
                learningCompletedCount={counts.learning}
                reviewCompletedCount={counts.review}
                cumulativeLearnedCount={state.results.length}
                pendingReviewCount={pending.length}
                onCheckIn={() => {
                  study.dispatch({ type: 'checkin' });
                  study.retry();
                }}
                onGoToLearning={() => navigate('learning')}
                onStartReview={() => {
                  study.dispatch({ type: 'review' });
                  navigate('learning');
                }}
                syncStatusDetail={study.error || ''}
                syncStatusLabel={saveLabel}
              />
            ) : null}
            {route === 'mine' ? (
              <ScrollView
                contentContainerStyle={styles.entry}
                testID="mine-surface"
              >
                <Text style={[styles.title, { color: palette.text }]}>
                  本地学习
                </Text>
                {trackPicker}
                <Text style={{ color: palette.textMuted }}>
                  学习记录保存在本机。卸载应用或清除数据前，请先导出备份。
                </Text>
                <Text style={{ color: palette.text }}>{saveLabel}</Text>
                {recovery}
                {button(
                  '返回首页',
                  () =>
                    void perform(async () => {
                      await study.flush();
                      setEntered(false);
                      navigate('learning');
                    }),
                  'mine-account-logout-button',
                  busy,
                )}
              </ScrollView>
            ) : null}
          </>
        )}
      </View>
      <View
        style={[styles.tabs, { borderColor: palette.border }]}
        accessibilityRole="toolbar"
      >
        {(
          [
            ['learning', '学习'],
            ['space', '空间'],
            ['statistics', '统计'],
            ['mine', '我的'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: route === value }}
            onPress={() => navigate(value)}
            style={[
              styles.tab,
              {
                backgroundColor:
                  route === value ? palette.panelStrong : 'transparent',
              },
            ]}
            testID={`route-tab-${value}`}
          >
            <Text style={{ color: palette.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
  entry: { padding: 24, gap: 18, flexGrow: 1 },
  title: { fontSize: 25, lineHeight: 34, fontWeight: '600' },
  brand: { fontSize: 17, fontWeight: '600' },
  header: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stack: { gap: 8 },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
  },
  notice: { padding: 14, gap: 8, borderRadius: 10 },
  notices: { maxHeight: 210 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: 'top',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 16,
    padding: 5,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
});
