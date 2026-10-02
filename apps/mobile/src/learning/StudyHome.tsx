import React from 'react';
import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import {ScaledText as Text} from '../visual/ScaledText';
import {STUDIO} from '../visual/studio';
import {StudioPressable as Pressable} from './NativeMotion';
import type {LearningTrack} from './model';
import type {LearningSurfacePalette} from './LearningSurface';
import type {StudySceneProgress} from './StudyScene';

export function StudyHome({track, todayCount, reviewCount, progress, learnedCount, catalogCount,
  catalogRestricted = false, resumeKnowledgePoint, canResume, reviewIntent, notice, noticeTestID = 'learning-pause-notice', onStart, palette}: {
  track: LearningTrack;
  todayCount: number | null;
  reviewCount: number | null;
  progress: StudySceneProgress | null;
  learnedCount: number | null;
  catalogCount: number | null;
  catalogRestricted?: boolean;
  resumeKnowledgePoint: string | null;
  canResume: boolean;
  reviewIntent: boolean;
  notice: string | null;
  noticeTestID?: string;
  onStart: () => void;
  palette: LearningSurfacePalette;
}) {
  const {width} = useWindowDimensions();
  const completed = progress ? Math.min(progress.completed, progress.total) : 0;
  return <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, width >= 600 ? styles.tabletContent : null]}
    showsVerticalScrollIndicator={false} testID="learning-study-home">
    <View style={[styles.paper, {backgroundColor: palette.panel, borderColor: palette.border}]}>
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, {color: palette.textMuted}]}>当前课程</Text>
        <Text accessibilityRole="header" style={[styles.title, {color: palette.text}]}>{track === 'cet6' ? '英语六级' : '英语四级'}</Text>
        {reviewIntent ? <Text style={[styles.subtitle, {color: palette.textMuted}]}>回看需要复习的内容</Text> : null}
      </View>
      <View style={[styles.metrics, {borderColor: palette.border}]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, {color: palette.textMuted}]}>今天练过</Text>
          <Text style={[styles.metricValue, {color: palette.text}]} testID="learning-home-today-count">{todayCount === null ? '—' : `${todayCount} 张`}</Text>
        </View>
        <View style={[styles.metricDivider, {backgroundColor: palette.border}]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, {color: palette.textMuted}]}>待复习</Text>
          <Text style={[styles.metricValue, {color: palette.text}]} testID="learning-home-review-count">{reviewCount === null ? '—' : `${reviewCount} 张`}</Text>
        </View>
      </View>
      <View style={styles.resume}>
        <Text style={[styles.resumeLabel, {color: palette.textMuted}]}>{reviewIntent ? '本次复习' : canResume ? '接着练' : '准备开始'}</Text>
        <Text style={[styles.resumeTitle, {color: palette.text}]}>{reviewIntent ? '需要再看的知识' : resumeKnowledgePoint ?? '每轮五次练习'}</Text>
        <Text style={[styles.resumeDetail, {color: palette.textMuted}]}>{reviewIntent ? '按当前复习安排继续。' : canResume ? resumeKnowledgePoint ? '保留当前练习，随时接着学。' : '从已保存的进度继续。' : '读题、作答，再看解析。可以随时停下。'}</Text>
      </View>
      <View style={styles.progress}>
        {progress ? <>
          <Text style={[styles.progressCopy, {color: palette.textMuted}]} testID="learning-home-round-progress">{`第 ${progress.round} 轮 · 已完成 ${completed}/${progress.total}`}</Text>
          <View accessibilityRole="progressbar" accessibilityLabel="本轮练习进度" accessibilityValue={{min: 0, max: progress.total, now: completed}} style={styles.steps}>
            {Array.from({length: progress.total}, (_, index) => <View key={index} accessible={false} style={[styles.step, {backgroundColor: index < completed ? STUDIO.color.brand : STUDIO.color.brandSoft}]} />)}
          </View>
        </> : null}
        {learnedCount !== null && catalogCount !== null ? <Text style={[styles.coverage, {color: palette.textMuted}]}>{`${catalogRestricted ? '可学卡片已练' : '已练过'} ${learnedCount}/${catalogCount} 张`}</Text> : null}
      </View>
      {notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, {color: palette.textMuted}]} testID={noticeTestID}>{notice}</Text> : null}
      <Pressable accessibilityRole="button" onPress={onStart} style={[styles.start, {backgroundColor: STUDIO.color.brand}]} testID="learning-home-start-button">
        <Text style={styles.startLabel}>{reviewIntent ? '开始复习' : canResume ? '继续学习' : '开始学习'}</Text>
      </Pressable>
      {todayCount === null || reviewCount === null ? <Text style={[styles.unavailable, {color: palette.textMuted}]}>部分学习记录暂未读取</Text> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20},
  tabletContent: {paddingHorizontal: 32, paddingVertical: 28},
  paper: {width: '100%', maxWidth: 640, padding: 26, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth},
  heading: {gap: 8, paddingTop: 12, paddingBottom: 30},
  eyebrow: {fontSize: 12, lineHeight: 20, fontWeight: '500'},
  title: {fontSize: 32, lineHeight: 44, fontWeight: '700', letterSpacing: -0.8},
  subtitle: {fontSize: 14, lineHeight: 23},
  metrics: {flexDirection: 'row', gap: 20, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth},
  metric: {flex: 1, gap: 7},
  metricDivider: {width: StyleSheet.hairlineWidth},
  metricLabel: {fontSize: 12, lineHeight: 20},
  metricValue: {fontSize: 21, lineHeight: 30, fontWeight: '600'},
  resume: {gap: 8, paddingTop: 26, paddingBottom: 20},
  resumeLabel: {fontSize: 12, lineHeight: 20},
  resumeTitle: {fontSize: 19, lineHeight: 28, fontWeight: '600'},
  resumeDetail: {fontSize: 13, lineHeight: 22},
  progress: {gap: 8, paddingBottom: 22},
  progressCopy: {fontSize: 12, lineHeight: 20},
  steps: {flexDirection: 'row', gap: 6},
  step: {flex: 1, height: 3, borderRadius: 2},
  coverage: {fontSize: 11, lineHeight: 18, paddingTop: 2},
  notice: {fontSize: 12, lineHeight: 20, paddingBottom: 14},
  start: {minHeight: 56, paddingHorizontal: 20, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 16},
  startLabel: {color: '#FFFFFF', fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'center'},
  unavailable: {fontSize: 11, lineHeight: 18, textAlign: 'center', paddingTop: 12},
});
