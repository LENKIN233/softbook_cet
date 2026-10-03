import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StudioPressable as Pressable } from '../learning/NativeMotion';
import { ScaledText as Text } from '../visual/ScaledText';
import {StudioIcon} from '../visual/StudioIcon';
import type { LearningTrack } from '../learning/model';
import {
  createFirstRunGuidanceStore,
  InvalidFirstRunGuidanceError,
  type FirstRunGuidanceRecord,
} from './firstRunGuidanceStore';
import { FirstTrackSelectionBlockedError } from './firstTrackSelectionGuard';

export type FirstRunGuidance = {
  record: FirstRunGuidanceRecord;
  selectTrack: (track: LearningTrack) => Promise<void>;
  markLearningGuideSeen: () => Promise<void>;
};

function GuidanceModal({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID: string;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
      testID={testID}
    >
      <SafeAreaView style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View accessibilityViewIsModal style={styles.card}>
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function FirstRunGuidanceBoundary({
  children,
  beforeSelectTrack,
}: {
  children: (guidance: FirstRunGuidance) => React.ReactNode;
  beforeSelectTrack?: (track: LearningTrack) => Promise<void>;
}) {
  const store = useMemo(() => createFirstRunGuidanceStore(), []);
  const [record, setRecord] = useState<FirstRunGuidanceRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [choice, setChoice] = useState<LearningTrack | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [invalidRecord, setInvalidRecord] = useState(false);
  const alive = useRef(true);
  const selecting = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError(null);
    setInvalidRecord(false);
    store
      .load()
      .then(saved => {
        if (active) {
          setRecord(saved);
          setLoaded(true);
        }
      })
      .catch(problem => {
        if (active) {
          const invalid = problem instanceof InvalidFirstRunGuidanceError;
          setInvalidRecord(invalid);
          setError(
            invalid
              ? '原来的科目选择未能读出，请重新选一次。学习记录仍会保留。'
              : '备考科目暂时无法读取，请重试。',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [store, retry]);
  const selectTrack = useCallback(
    async (track: LearningTrack) => {
      const saved = await store.selectTrack(track);
      if (alive.current) setRecord(saved);
    },
    [store],
  );
  const markLearningGuideSeen = useCallback(async () => {
    const saved = await store.markLearningGuideSeen();
    if (alive.current) setRecord(saved);
  }, [store]);
  if (loaded && record !== null)
    return <>{children({ record, selectTrack, markLearningGuideSeen })}</>;
  const continueWithChoice = async () => {
    if (!loaded || choice === null || selecting.current) return;
    selecting.current = true;
    setBusy(true);
    setError(null);
    try {
      await beforeSelectTrack?.(choice);
      await selectTrack(choice);
    } catch (problem) {
      if (alive.current)
        setError(
          problem instanceof FirstTrackSelectionBlockedError
            ? problem.message
            : '备考科目还没保存，请重试。',
        );
    } finally {
      selecting.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <GuidanceModal testID="first-subject-modal">
      <Text accessibilityRole="header" style={styles.title}>
        先选一个备考科目
      </Text>
      <Text style={styles.body}>你现在准备哪一场考试？</Text>
      <View style={styles.choices}>
        {(['cet4', 'cet6'] as const).map(subject => (
          <Pressable
            key={subject}
            accessibilityRole="button"
            accessibilityState={{
              selected: choice === subject,
              disabled: !loaded || busy,
            }}
            disabled={!loaded || busy}
            testID={`first-subject-${subject}`}
            onPress={() => setChoice(subject)}
            style={[styles.choice, choice === subject && styles.selected]}
          >
            <StudioIcon name={choice === subject ? 'checkCircle' : 'book'} color={choice === subject ? '#4144AF' : '#626477'} size={22} />
            <Text style={styles.choiceText}>
              {subject === 'cet4' ? '英语四级' : '英语六级'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.body}>
        学习首页右上角可直接切换科目，也可以到“我的 → 备考科目”。四、六级进度分别保留。
      </Text>
      {error !== null && (
        <Text
          accessibilityLiveRegion="polite"
          style={styles.error}
          testID="first-subject-error"
        >
          {error}
        </Text>
      )}
      {!loaded && error !== null ? (
        <Pressable
          accessibilityRole="button"
          testID="first-subject-retry"
          onPress={() => {
            if (invalidRecord) {
              setInvalidRecord(false);
              setError(null);
              setChoice(null);
              setLoaded(true);
            } else setRetry(value => value + 1);
          }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            {invalidRecord ? '重新选择科目' : '重新读取'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !loaded || choice === null || busy }}
          disabled={!loaded || choice === null || busy}
          testID="first-subject-continue"
          onPress={continueWithChoice}
          style={[
            styles.primary,
            (!loaded || choice === null || busy) && styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>
            {!loaded
              ? '正在读取…'
              : busy
              ? '正在保存…'
              : choice === null
              ? '选择科目后继续'
              : '继续'}
          </Text>
        </Pressable>
      )}
    </GuidanceModal>
  );
}

export function FirstLearningGuide({
  guidance,
  visible,
}: {
  guidance: FirstRunGuidance;
  visible: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  if (!visible || guidance.record.learningGuideSeen) return null;
  const start = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await guidance.markLearningGuideSeen();
    } catch {
      setError('这次设置还没保存，请重试。');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <GuidanceModal testID="first-learning-guide-modal">
      <Text accessibilityRole="header" style={styles.title}>
        从一张卡开始
      </Text>
      <Text style={styles.body}>
        先读题，再按卡片要求作答。需要提示时点“看判断方法”；答题后看解释，再继续下一张。
      </Text>
      <Text style={styles.body}>在“空间”里查找卡片、收藏或休眠。</Text>
      <Text style={styles.body}>学习首页右上角可切换科目，“我的 → 备考科目”也保留。</Text>
      {error !== null && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        testID="first-learning-guide-start"
        onPress={start}
        style={[styles.primary, busy && styles.disabled]}
      >
        <Text style={styles.primaryText}>
          {busy ? '正在保存…' : '开始学习'}
        </Text>
      </Pressable>
    </GuidanceModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,29,48,0.42)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: '#20232B' },
  body: { fontSize: 16, lineHeight: 26, color: '#626477' },
  choices: { gap: 12 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E4E2DD',
    padding: 16,
  },
  selected: { borderColor: '#5658D6', backgroundColor: '#E7E8FF' },
  choiceText: { fontSize: 18, fontWeight: '600', color: '#20232B', flexShrink: 1 },
  primary: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5658D6',
    borderRadius: 16,
    padding: 14,
  },
  primaryText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabled: { opacity: 0.45 },
  error: { fontSize: 15, lineHeight: 24, color: '#A7394D' },
});
