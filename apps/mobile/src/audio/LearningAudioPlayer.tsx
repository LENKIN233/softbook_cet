import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {StudioPressable as Pressable, MotionWaveform} from '../learning/NativeMotion';
import {STUDIO} from '../visual/studio';

import { reactNativeContentAssetCache } from './reactNativeContentAssetCache';
import {
  LearningAudioController,
  type LearningAudioPlaybackState,
  type AnyLearningAudioSelection,
  type RefreshLearningAudioDownload,
} from './learningAudioController';
import { nativeLearningAudioEngine } from './nativeLearningAudioEngine';
import {resolveNativeBundledAudio} from './nativeBundledAudio';
import type { LearningSurfacePalette } from '../learning/LearningSurface';
import { hexToRgba } from '../visual/tokens';

export type LearningAudioPlayerProps = {
  palette: LearningSurfacePalette;
  selection: AnyLearningAudioSelection;
  refreshDownload?: RefreshLearningAudioDownload;
};

export function LearningAudioPlayer({
  palette,
  selection,
  refreshDownload,
}: LearningAudioPlayerProps) {
  const refreshDownloadRef = useRef(refreshDownload);
  refreshDownloadRef.current = refreshDownload;
  const controller = useMemo(
    () =>
      new LearningAudioController({
        cache: reactNativeContentAssetCache,
        resolveBundledAsset: resolveNativeBundledAudio,
        engine: nativeLearningAudioEngine,
        refreshDownload: async currentSelection => {
          if (!refreshDownloadRef.current) throw new Error('Audio authorization refresh is unavailable.');
          return refreshDownloadRef.current(currentSelection);
        },
        isOnline: async () => {
          const network = await NetInfo.fetch();
          return (
            network.isConnected !== false &&
            network.isInternetReachable !== false
          );
        },
      }),
    [],
  );
  const [state, setState] = useState<LearningAudioPlaybackState>(() =>
    controller.getState(),
  );

  useEffect(() => controller.subscribe(setState), [controller]);

  useEffect(() => {
    controller.select(selection);
  }, [controller, selection]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        controller.pauseForInterruption().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [controller]);

  useEffect(() => () => controller.dispose(), [controller]);

  const presentation = getAudioPresentation(state);
  const isLoading = state.status === 'loading';
  const isPlaying = state.status === 'playing';
  const isError = state.status === 'error';
  const glyphMode = state.status;
  const foreground = isError ? STUDIO.color.reviewInk : palette.accentStrong;

  return (
    <Pressable
      accessibilityHint={presentation.hint}
      accessibilityLabel={presentation.label}
      accessibilityRole="button"
      accessibilityState={{
        busy: isLoading,
        disabled: isLoading,
        selected: isPlaying,
      }}
      disabled={isLoading}
      onPress={() => controller.press().catch(() => undefined)}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: isError
            ? hexToRgba(palette.warning, 0.1)
            : hexToRgba(palette.accent, 0.1),
          borderColor: hexToRgba(foreground, 0.34),
          opacity: pressed ? 0.84 : 1,
        },
      ]}
      testID="learning-audio-control"
    >
      <View style={[styles.playDisc, {backgroundColor: foreground}]} testID={`learning-audio-state-${state.status}`}>
        <AudioGlyph color={palette.panel} mode={glyphMode} />
      </View>
      <View style={styles.copy}>
      <Text
        style={[styles.label, { color: foreground }]}
        testID="learning-audio-control-label"
      >
        {presentation.label}
      </Text>
      <Text style={[styles.duration, {color: palette.textMuted}]}>{Math.max(1, Math.round(selection.asset.duration_ms / 1000))} 秒录音</Text>
      </View>
      <View style={styles.wave}><MotionWaveform color={palette.accent} playing={isPlaying} /></View>
    </Pressable>
  );
}

export function getAudioPresentation(state: LearningAudioPlaybackState) {
  switch (state.status) {
    case 'loading':
      return {
        hint: '加载后开始播放',
        label: '正在加载音频…',
      };
    case 'playing':
      return { hint: '暂停音频', label: '暂停' };
    case 'paused':
      return { hint: '继续播放音频', label: '继续播放' };
    case 'error':
      return state.reason === 'offline'
        ? { hint: '联网后重试', label: '网络不可用，点击重试' }
        : { hint: '重新加载音频', label: '播放失败，点击重试' };
    case 'idle':
    default:
      return { hint: '播放这张卡片的音频', label: '播放音频' };
  }
}

function AudioGlyph({
  color,
  mode,
}: {
  color: string;
  mode: LearningAudioPlaybackState['status'];
}) {
  if (mode === 'loading') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.loadingRing, { borderColor: color }]}
      />
    );
  }

  if (mode === 'playing') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.pauseGlyph}
      >
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.playGlyph}
    >
      <View style={[styles.playTriangle, { borderLeftColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  playDisc: {width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  copy: {flex: 1, minWidth: 0, gap: 3},
  duration: {fontSize: 10, lineHeight: 15, fontVariant: ['tabular-nums']},
  wave: {flexShrink: 1, maxWidth: 70, overflow: 'hidden'},
  playTriangle: {width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 11, borderTopColor: 'transparent', borderBottomColor: 'transparent', marginLeft: 4},
  chip: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: STUDIO.radius.control,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 11,
    justifyContent: 'center',
    minHeight: 62,
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  label: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  loadingRing: {
    borderRadius: 8,
    borderRightColor: 'transparent',
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  pauseBar: {
    borderRadius: 1,
    height: 14,
    width: 4,
  },
  pauseGlyph: {
    flexDirection: 'row',
    gap: 3,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  playGlyph: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 16,
    width: 18,
  },
  soundMark: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 17,
    marginLeft: 1,
  },
  speakerBody: {
    borderRadius: 1,
    height: 7,
    width: 5,
  },
  speakerCone: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 6,
    borderRightWidth: 7,
    borderTopColor: 'transparent',
    borderTopWidth: 6,
    height: 0,
    width: 0,
  },
});
