import React from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import {ScaledText as Text} from '../visual/ScaledText';
import {STUDIO} from '../visual/studio';
import {MotionView, StudioPressable as Pressable} from './NativeMotion';
import type {LearningTrack} from './model';
import type {LearningSurfacePalette} from './LearningSurface';

export type StudySceneProgress = {round: number; completed: number; total: number};

export function StudyScene({children, track, progress, learnedCount, catalogCount, catalogRestricted = false, onPause, onOpenSpace, palette}: {
  children: React.ReactNode;
  track: LearningTrack;
  progress: StudySceneProgress | null;
  learnedCount: number | null;
  catalogCount: number | null;
  catalogRestricted?: boolean;
  onPause: () => void;
  onOpenSpace: () => void;
  palette: LearningSurfacePalette;
}) {
  const {width} = useWindowDimensions();
  const completed = progress ? Math.min(progress.completed, progress.total) : 0;
  return <View style={[styles.stage, width >= 600 ? styles.tabletStage : null]}>
    <View style={[styles.paper, {backgroundColor: palette.panel, borderColor: palette.border}]} testID="learning-study-scene">
      <View style={[styles.header, {borderBottomColor: palette.border}]}>
        <View style={styles.toolbar}>
          <Pressable accessibilityRole="button" accessibilityLabel="先到这里，保留当前练习并退出学习" onPress={onPause} style={styles.quietAction} testID="learning-pause-button">
            <Text maxFontSizeMultiplier={STUDIO.accessibility.chromeMaxFontSizeMultiplier} style={[styles.actionLabel, {color: palette.textMuted}]}>先到这里</Text>
          </Pressable>
          <Text maxFontSizeMultiplier={STUDIO.accessibility.chromeMaxFontSizeMultiplier} style={[styles.course, {color: palette.textMuted}]}>{track === 'cet6' ? '英语六级' : '英语四级'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="空间，查看当前卡片的位置" onPress={onOpenSpace} style={styles.quietAction} testID="route-tab-space">
            <Text maxFontSizeMultiplier={STUDIO.accessibility.chromeMaxFontSizeMultiplier} style={[styles.actionLabel, {color: palette.textMuted}]}>空间</Text>
          </Pressable>
        </View>
        <View style={styles.progressCopy}>
          {progress ? <Text maxFontSizeMultiplier={STUDIO.accessibility.chromeMaxFontSizeMultiplier} style={[styles.count, {color: palette.text}]} testID="learning-segment-progress">{`第 ${progress.round} 轮 · 已完成 ${completed}/${progress.total}`}</Text> : <Text style={[styles.count, {color: palette.textMuted}]}>准备本轮学习</Text>}
          <Text maxFontSizeMultiplier={STUDIO.accessibility.chromeMaxFontSizeMultiplier} style={[styles.coverage, {color: palette.textMuted}]} testID="learning-catalog-progress">{learnedCount !== null && catalogCount !== null ? `${catalogRestricted ? '可学卡片已练' : '已练过'} ${learnedCount}/${catalogCount} 张` : '正在读取进度'}</Text>
        </View>
        {progress ? <View accessibilityRole="progressbar" accessibilityLabel="本轮练习进度" accessibilityValue={{min: 0, max: progress.total, now: completed, text: `已完成 ${completed} 次练习，共 ${progress.total} 次`}} style={styles.steps}>
          {Array.from({length: progress.total}, (_, index) => <View accessible={false} pointerEvents="none" key={index} style={styles.step}>
            <MotionView motionKey={`${progress.round}:${index < completed}`} kind="focus" style={[styles.stepFill, {backgroundColor: index < completed ? palette.accent : palette.accentSoft}]}>{null}</MotionView>
          </View>)}
        </View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stage: {flex: 1, minHeight: 0, alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10},
  tabletStage: {paddingHorizontal: 28, paddingVertical: 18},
  paper: {flex: 1, minHeight: 0, width: '100%', maxWidth: 880, borderWidth: 1, borderRadius: 28, overflow: 'hidden'},
  header: {flexShrink: 0, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8},
  toolbar: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  quietAction: {minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 4},
  actionLabel: {fontSize: 13, lineHeight: 20},
  course: {fontSize: 12, lineHeight: 18, fontWeight: '500'},
  progressCopy: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6},
  count: {fontSize: 13, lineHeight: 20, fontWeight: '600'},
  coverage: {fontSize: 11, lineHeight: 18},
  steps: {flexDirection: 'row', gap: 6},
  step: {flex: 1},
  stepFill: {height: 3, borderRadius: 2},
  body: {flex: 1, minHeight: 0},
});
