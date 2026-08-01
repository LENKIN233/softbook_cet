import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { reactNativeContentAssetCache } from './reactNativeContentAssetCache';
import {
  LearningAudioController,
  type LearningAudioPlaybackState,
  type LearningAudioSelection,
} from './learningAudioController';
import { nativeLearningAudioEngine } from './nativeLearningAudioEngine';
import type { LearningSurfacePalette } from '../learning/LearningSurface';
import { hexToRgba } from '../visual/tokens';

export type LearningAudioPlayerProps = {
  palette: LearningSurfacePalette;
  selection: LearningAudioSelection;
};

export function LearningAudioPlayer({
  palette,
  selection,
}: LearningAudioPlayerProps) {
  const controller = useMemo(
    () =>
      new LearningAudioController({
        cache: reactNativeContentAssetCache,
        engine: nativeLearningAudioEngine,
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
  const foreground = isError ? palette.warning : palette.accent;

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
      <AudioGlyph color={foreground} mode={glyphMode} />
      <Text
        numberOfLines={1}
        style={[styles.label, { color: foreground }]}
        testID="learning-audio-control-label"
      >
        {presentation.label}
      </Text>
    </Pressable>
  );
}

export function getAudioPresentation(state: LearningAudioPlaybackState) {
  switch (state.status) {
    case 'loading':
      return {
        hint: '音频准备完成后会开始播放',
        label: '正在准备听力…',
      };
    case 'playing':
      return { hint: '暂停当前听力', label: '暂停' };
    case 'paused':
      return { hint: '继续播放当前听力', label: '继续播放' };
    case 'error':
      return state.reason === 'offline'
        ? { hint: '联网后重试', label: '连接网络后可播放 · 重试' }
        : { hint: '重新准备当前听力', label: '暂时无法播放 · 重试' };
    case 'idle':
    default:
      return { hint: '播放当前卡片的听力', label: '播放听力' };
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
      <View style={[styles.speakerBody, { backgroundColor: color }]} />
      <View style={[styles.speakerCone, { borderRightColor: color }]} />
      <Text style={[styles.soundMark, { color }]}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 14,
  },
  label: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
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
