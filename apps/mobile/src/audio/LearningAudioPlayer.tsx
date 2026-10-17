import {ScaledText as Text} from '../visual/ScaledText';
import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import {StudioPressable as Pressable, MotionWaveform} from '../learning/NativeMotion';
import {STUDIO} from '../visual/studio';
import {StudioIcon} from '../visual/StudioIcon';

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
  disabled?: boolean;
};

export function LearningAudioPlayer({
  palette,
  selection,
  refreshDownload,
  disabled = false,
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

  useEffect(() => {
    if (disabled) controller.pauseForInterruption().catch(() => undefined);
  }, [controller, disabled]);

  useEffect(() => () => controller.dispose(), [controller]);

  const allowed = useRef(!disabled);
  allowed.current = !disabled;
  const [position, setPosition] = useState<number | null>(null);
  useEffect(() => {
    let current = true;
    const read = () => {void controller.getPosition().then(value => {if (current) setPosition(value);}).catch(() => {if (current) setPosition(null);});};
    read(); const timer = ['playing', 'paused'].includes(state.status) ? setInterval(read, 500) : undefined;
    return () => {current = false; clearInterval(timer);};
  }, [controller, selection, state.status]);
  const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const presentation = getAudioPresentation(state);
  const isLoading = state.status === 'loading';
  const isPlaying = state.status === 'playing';
  const isError = state.status === 'error';
  const glyphMode = state.status;
  const foreground = isError ? STUDIO.color.reviewInk : palette.accentStrong;

  return (
    <View style={{alignSelf: 'stretch'}}>
    <Pressable
      accessibilityHint={presentation.hint}
      accessibilityLabel={presentation.label}
      accessibilityValue={position === null ? undefined : {text: `${clock(position)} / ${clock(selection.asset.duration_ms)}`}}
      accessibilityRole="button"
      accessibilityState={{
        busy: isLoading,
        disabled: disabled || isLoading,
        selected: isPlaying,
      }}
      disabled={disabled || isLoading}
      onPress={() => {if (!disabled) controller.press().catch(() => undefined);}}
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
      <Text style={[styles.duration, {color: palette.textMuted}]}>{position === null ? `${Math.max(1, Math.round(selection.asset.duration_ms / 1000))} 秒录音` : `${clock(position)} / ${clock(selection.asset.duration_ms)}`}</Text>
      </View>
      <View style={styles.wave}><MotionWaveform color={palette.accent} playing={isPlaying} /></View>
    </Pressable>
    <View style={styles.repeatActions}>
      <Pressable accessibilityRole="button" accessibilityLabel="从头重听" disabled={disabled || isLoading} onPress={() => {if (allowed.current) void controller.restart(() => allowed.current && AppState.currentState === 'active').catch(() => undefined);}} style={styles.repeatButton} testID="learning-audio-restart"><StudioIcon name="refresh" color={palette.textMuted} size={16}/><Text style={{color: palette.textMuted}}>从头重听</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="后退五秒" disabled={disabled || isLoading || position === null || position <= 0} onPress={() => {if (allowed.current) void controller.seekTo(Math.max(0, (position ?? 0) - 5000)).catch(() => undefined);}} style={styles.repeatButton} testID="learning-audio-rewind"><StudioIcon name="chevronLeft" color={palette.textMuted} size={16}/><Text style={{color: palette.textMuted}}>后退5秒</Text></Pressable>
    </View>
    </View>
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
  return <StudioIcon name={mode === 'playing' ? 'pause' : mode === 'loading' ? 'clock'
    : mode === 'error' ? 'refresh' : 'play'} color={color} size={22} />;
}

const styles = StyleSheet.create({
  repeatActions: {flexDirection: 'row', gap: 14},
  repeatButton: {flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44},
  playDisc: {width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  copy: {flex: 1, minWidth: 0, gap: 3},
  duration: {fontSize: 10, lineHeight: 15, fontVariant: ['tabular-nums']},
  wave: {flexShrink: 1, maxWidth: 70, overflow: 'hidden'},
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
});
