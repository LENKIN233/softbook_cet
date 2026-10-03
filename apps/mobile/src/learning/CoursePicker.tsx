import React from 'react';
import {Modal, ScrollView, StyleSheet, View} from 'react-native';
import {ScaledText as Text} from '../visual/ScaledText';
import {StudioActionLabel} from '../visual/StudioActionLabel';
import {STUDIO} from '../visual/studio';
import {StudioPressable as Pressable} from './NativeMotion';
import type {LearningTrack} from './model';
import type {LearningSurfacePalette} from './LearningSurface';

export function CoursePicker({visible, track, onChoose, onClose, busy = false,
  disabled = false, error, palette}: {
  visible: boolean;
  track: LearningTrack;
  onChoose: (track: LearningTrack) => void;
  onClose: () => void;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  palette: LearningSurfacePalette;
}) {
  return <Modal visible={visible} transparent animationType="fade"
    onRequestClose={() => {if (!busy) onClose();}} testID="course-picker-modal">
    <View style={styles.backdrop}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View accessibilityViewIsModal style={[styles.paper, {backgroundColor: palette.panel, borderColor: palette.border}]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, {color: palette.text}]}>备考科目</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="取消科目选择" disabled={busy}
              onPress={onClose} style={styles.close} testID="course-picker-close">
              <StudioActionLabel icon="close" color={palette.textMuted} textStyle={styles.closeText}>取消</StudioActionLabel>
            </Pressable>
          </View>
          <Text style={[styles.detail, {color: palette.textMuted}]}>四、六级的学习进度分别保存。</Text>
          <View style={[styles.options, {backgroundColor: palette.panelStrong, borderColor: palette.border}]}>
            {(['cet4', 'cet6'] as const).map(value => {
              const selected = value === track;
              return <Pressable key={value} accessibilityRole="radio"
                accessibilityState={{checked: selected, disabled: disabled || busy}}
                disabled={disabled || busy} onPress={() => onChoose(value)} testID={`course-picker-${value}`}
                style={[styles.option, {backgroundColor: selected ? STUDIO.color.brand : palette.panel,
                  borderColor: selected ? STUDIO.color.brand : palette.border, opacity: disabled || busy ? 0.6 : 1}]}>
                <StudioActionLabel icon={selected ? 'checkCircle' : 'book'} color={selected ? '#FFFFFF' : palette.text}
                  textStyle={[styles.optionText, selected ? styles.selectedText : null]}>
                  {value === 'cet6' ? '英语六级' : '英语四级'}
                </StudioActionLabel>
              </Pressable>;
            })}
          </View>
          {busy ? <Text accessibilityLiveRegion="polite" style={[styles.detail, {color: palette.textMuted}]}>正在切换科目…</Text>
            : disabled ? <Text style={[styles.detail, {color: palette.textMuted}]}>学习记录正在更新，请稍后切换。</Text> : null}
          {error ? <Text accessibilityRole="alert" style={[styles.detail, {color: palette.danger}]}>{error}</Text> : null}
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(36,36,53,0.32)'},
  scroll: {flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
  paper: {width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1, padding: 22, gap: 18},
  header: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  title: {fontSize: 22, lineHeight: 30, fontWeight: '600'},
  close: {minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8},
  closeText: {fontSize: 13, lineHeight: 20},
  detail: {fontSize: 14, lineHeight: 23},
  options: {borderWidth: 1, borderRadius: 18, padding: 6, gap: 8},
  option: {minHeight: 52, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderRadius: 12},
  optionText: {fontSize: 16, lineHeight: 24, fontWeight: '500'},
  selectedText: {fontWeight: '700'},
});
