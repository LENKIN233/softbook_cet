import React from 'react';
import {AccessibilityInfo, Animated, Easing, Pressable, Text, View} from 'react-native';
import type {PressableProps, StyleProp, TextProps, ViewProps, ViewStyle} from 'react-native';
import {STUDIO} from '../visual/studio';

const MotionPreference = React.createContext(true);
export const useReducedMotion = () => React.useContext(MotionPreference);
const ease = Easing.out(Easing.cubic);

export function NativeMotionProvider({children}: {children: React.ReactNode}) {
  const [reduced, setReduced] = React.useState(true);
  React.useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {if (live) setReduced(value);}).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {live = false; listener.remove();};
  }, []);
  return <MotionPreference.Provider value={reduced}>{children}</MotionPreference.Provider>;
}

// Visual feedback never owns the answer. Interruptions cancel only the motion.
function useFeedback(trigger: unknown, enter = false) {
  const reduced = useReducedMotion();
  const progress = React.useRef(new Animated.Value(1)).current;
  const previous = React.useRef(trigger);
  const first = React.useRef(true);
  React.useLayoutEffect(() => {
    const changed = previous.current !== trigger || (first.current && enter);
    previous.current = trigger;
    first.current = false;
    progress.stopAnimation();
    if (!changed || reduced) {progress.setValue(1); return;}
    progress.setValue(0);
    const animation = Animated.timing(progress, {toValue: 1, duration: STUDIO.motion.enter, easing: ease, useNativeDriver: true, isInteraction: false});
    animation.start();
    return () => animation.stop();
  }, [enter, progress, reduced, trigger]);
  return progress;
}

export function MotionView({children, motionKey, style, testID, onLayout, enter = false, kind = 'reveal'}: {
  children: React.ReactNode; motionKey: unknown; style?: StyleProp<ViewStyle>; enter?: boolean;
  testID?: string; onLayout?: ViewProps['onLayout'];
  kind?: 'reveal' | 'result' | 'space' | 'focus';
}) {
  const p = useFeedback(motionKey, enter);
  return <Animated.View testID={testID} onLayout={onLayout} style={[style, {
    opacity: p.interpolate({inputRange: [0, 1], outputRange: [0.3, 1]}),
    transform: [
      {translateY: p.interpolate({inputRange: [0, 1], outputRange: [kind === 'reveal' ? -4 : 8, 0]})},
      {scale: p.interpolate({inputRange: [0, 1], outputRange: [kind === 'space' ? 1.02 : kind === 'focus' ? 0.985 : 0.995, 1]})},
    ],
  }]}>{children}</Animated.View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function MotionPressable({motionKey, style, ...props}: PressableProps & {motionKey?: unknown}) {
  const p = useFeedback(motionKey);
  const reduced = useReducedMotion();
  const pressure = React.useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = React.useState(false);
  React.useEffect(() => {
    pressure.stopAnimation();
    pressure.setValue(1);
    return () => pressure.stopAnimation();
  }, [pressure, reduced]);
  const respond = (down: boolean) => {
    pressure.stopAnimation();
    if (reduced || props.disabled) {pressure.setValue(1); return;}
    Animated.spring(pressure, {toValue: down ? STUDIO.motion.pressScale : 1,
      ...STUDIO.motion.spring, useNativeDriver: true, isInteraction: false}).start();
  };
  return <AnimatedPressable {...props}
    onPressIn={event => {setPressed(true); respond(true); props.onPressIn?.(event);}}
    onPressOut={event => {setPressed(false); respond(false); props.onPressOut?.(event);}}
    style={[typeof style === 'function' ? style({pressed}) : style, {
      transform: [{scale: Animated.multiply(pressure, p.interpolate({inputRange: [0, 1], outputRange: [0.98, 1]}))}],
    }]} />;
}

export function StudioPressable(props: PressableProps) {
  return <MotionPressable {...props} motionKey={props.accessibilityState?.selected ?? props.accessibilityState?.checked} />;
}

/** A playback-state cue, not an invented signal or playback-progress meter. */
export function MotionWaveform({playing, color}: {playing: boolean; color: string}) {
  const reduced = useReducedMotion();
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    pulse.stopAnimation(); pulse.setValue(0);
    if (!playing || reduced) return;
    const wave = Animated.loop(Animated.sequence([
      Animated.timing(pulse, {toValue: 1, duration: STUDIO.motion.wave, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
      Animated.timing(pulse, {toValue: 0, duration: STUDIO.motion.wave, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false}),
    ]));
    wave.start();
    return () => {wave.stop(); pulse.setValue(0);};
  }, [playing, pulse, reduced]);
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    pointerEvents="none" style={{flexDirection: 'row', alignItems: 'center', gap: 3, height: 28, overflow: 'hidden'}}>
    {STUDIO.motion.waveHeights.map((height, index) =>
      <Animated.View key={index} style={{width: 2, height, borderRadius: 2, backgroundColor: color,
        opacity: playing ? 0.8 : 0.32,
        transform: [{scaleY: pulse.interpolate({inputRange: [0, 0.5, 1], outputRange: index % 2 ? [0.55, 1, 0.7] : [1, 0.45, 0.9]})}],
      }} />)}
  </View>;
}

export function LockMotionGlyph({open, color}: {open: boolean; color: string}) {
  const reduced = useReducedMotion();
  const p = React.useRef(new Animated.Value(open ? 1 : 0)).current;
  React.useEffect(() => {
    p.stopAnimation();
    if (reduced) {p.setValue(open ? 1 : 0); return;}
    const animation = Animated.timing(p, {toValue: open ? 1 : 0, duration: STUDIO.motion.reveal, easing: ease, useNativeDriver: true});
    animation.start();
    return () => animation.stop();
  }, [open, p, reduced]);
  return <View accessible={false} pointerEvents="none" style={{width: 22, height: 26, transform: [{scale: 0.75}]}}>
    <Animated.View style={{position: 'absolute', width: 13, height: 12, left: 4.5, top: 3,
      borderWidth: 2, borderBottomWidth: 0, borderColor: color, borderTopLeftRadius: 7, borderTopRightRadius: 7,
      transform: [{translateY: p.interpolate({inputRange: [0, 1], outputRange: [0, -4]})},
        {rotate: p.interpolate({inputRange: [0, 1], outputRange: ['0deg', '-24deg']})}],
    }} />
    <View style={{position: 'absolute', width: 18, height: 13, left: 2, bottom: 1, borderWidth: 2, borderColor: color, borderRadius: 3}} />
  </View>;
}

export function StrikeText({struck, color, style, ...props}: TextProps & {struck: boolean; color: string}) {
  const reduced = useReducedMotion();
  const p = React.useRef(new Animated.Value(struck ? 1 : 0)).current;
  const [lines, setLines] = React.useState<Array<{x: number; y: number; width: number; height: number}>>([]);
  React.useEffect(() => {
    p.stopAnimation();
    if (reduced) {p.setValue(struck ? 1 : 0); return;}
    const animation = Animated.timing(p, {toValue: struck ? 1 : 0, duration: STUDIO.motion.strike, easing: ease, useNativeDriver: true});
    animation.start();
    return () => animation.stop();
  }, [p, reduced, struck]);
  return <View>
    <Text {...props} style={[style, reduced && struck ? {textDecorationLine: 'line-through'} : null]}
      onTextLayout={event => {
        const next = event.nativeEvent.lines.map(({x, y, width, height}) => ({x, y, width, height}));
        setLines(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
      }} />
    {!reduced && lines.map((line, index) => <Animated.View key={index} pointerEvents="none" accessible={false} style={{
      position: 'absolute', left: line.x, top: line.y + line.height * 0.55, width: line.width, height: 1.5,
      backgroundColor: color, opacity: p,
      transform: [{translateX: p.interpolate({inputRange: [0, 1], outputRange: [-line.width / 2, 0]})}, {scaleX: p}],
    }} />)}
  </View>;
}

export function useCardMotion(identity: string | null, arrival: 'card' | 'space' | 'focus' = 'card') {
  const reduced = useReducedMotion();
  const opacity = React.useRef(new Animated.Value(1)).current;
  const travel = React.useRef(new Animated.Value(0)).current;
  const zoom = React.useRef(new Animated.Value(1)).current;
  const pending = React.useRef<(() => void) | null>(null);
  const flip = React.useRef(new Animated.Value(0)).current;
  const flipOpacity = React.useRef(new Animated.Value(1)).current;
  const sequence = React.useRef(0);
  const active = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const lastIdentity = React.useRef(identity);
  const stop = React.useCallback(() => {
    opacity.stopAnimation(); travel.stopAnimation(); zoom.stopAnimation(); flip.stopAnimation(); flipOpacity.stopAnimation();
  }, [flip, flipOpacity, opacity, travel, zoom]);
  const reset = React.useCallback(() => {
    stop();
    opacity.setValue(1); travel.setValue(0); zoom.setValue(1); flip.setValue(0); flipOpacity.setValue(1);
  }, [flip, flipOpacity, opacity, stop, travel, zoom]);
  React.useLayoutEffect(() => {
    const finishImmediately = reduced && lastIdentity.current === identity ? pending.current : null;
    pending.current = null;
    sequence.current += 1;
    active.current = false;
    setBusy(false);
    stop();
    const changed = lastIdentity.current !== identity;
    lastIdentity.current = identity;
    finishImmediately?.();
    if (!reduced && changed && identity) {
      opacity.setValue(0); travel.setValue(arrival === 'card' ? 28 : 0); zoom.setValue(arrival === 'space' ? 1.04 : arrival === 'focus' ? 0.94 : 1);
      flip.setValue(0); flipOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(opacity, {toValue: 1, duration: STUDIO.motion.enter, easing: ease, useNativeDriver: true}),
        Animated.timing(travel, {toValue: 0, duration: STUDIO.motion.enter, easing: ease, useNativeDriver: true}),
        Animated.timing(zoom, {toValue: 1, duration: STUDIO.motion.reveal, easing: ease, useNativeDriver: true}),
      ]).start();
    } else reset();
    return () => {sequence.current += 1; active.current = false; stop();};
  }, [arrival, flip, flipOpacity, identity, opacity, reduced, reset, stop, travel, zoom]);
  const perform = React.useCallback((kind: 'flip' | 'advance' | 'space' | 'focus', action: () => void) => {
    if (active.current) return;
    if (reduced) {action(); return;}
    const token = ++sequence.current;
    reset(); active.current = true; pending.current = action; setBusy(true);
    const isFlip = kind === 'flip';
    const isRoute = kind === 'space' || kind === 'focus';
    const fade = isFlip ? flipOpacity : opacity;
    const position = isFlip ? flip : isRoute ? zoom : travel;
    Animated.parallel([
      Animated.timing(fade, {toValue: 0, duration: STUDIO.motion.leave, easing: ease, useNativeDriver: true}),
      Animated.timing(position, {toValue: isFlip ? 1 : kind === 'space' ? 0.94 : kind === 'focus' ? 1.04 : -28, duration: STUDIO.motion.leave, easing: ease, useNativeDriver: true}),
    ]).start(({finished}) => {
      if (!finished || token !== sequence.current) return;
      active.current = false; pending.current = null; setBusy(false);
      action();
      // Routes may commit later through React.startTransition. Keep the old
      // page hidden; only the new identity's layout effect owns its entrance.
      if (isRoute || token !== sequence.current) return;
      position.setValue(isFlip ? -1 : 28);
      Animated.parallel([
        Animated.timing(fade, {toValue: 1, duration: STUDIO.motion.release, easing: ease, useNativeDriver: true}),
        Animated.timing(position, {toValue: 0, duration: STUDIO.motion.release, easing: ease, useNativeDriver: true}),
      ]).start();
    });
  }, [flip, flipOpacity, opacity, reduced, reset, travel, zoom]);
  const cancel = React.useCallback(() => {
    sequence.current += 1; pending.current = null; active.current = false; setBusy(false); reset();
  }, [reset]);
  return {busy, perform, cancel,
    cardStyle: {opacity, transform: [{translateX: travel}, {scale: zoom}]},
    flipStyle: {opacity: flipOpacity, transform: [{perspective: 1200}, {rotateY: flip.interpolate({inputRange: [-1, 0, 1], outputRange: ['-80deg', '0deg', '80deg']})}]},
  };
}

export function MotionPresence({children}: {children: React.ReactNode}) {
  const reduced = useReducedMotion();
  const [retained, setRetained] = React.useState(children);
  const [height, setHeight] = React.useState(0);
  const p = React.useRef(new Animated.Value(children ? 1 : 0)).current;
  const generation = React.useRef(0);
  React.useLayoutEffect(() => {
    const token = ++generation.current;
    p.stopAnimation();
    if (reduced) {p.setValue(children ? 1 : 0); setRetained(children); return;}
    if (children) setRetained(children);
    const animation = Animated.timing(p, {toValue: children ? 1 : 0, duration: STUDIO.motion.release, easing: ease, useNativeDriver: false});
    animation.start(({finished}) => {
      if (finished && token === generation.current && !children) setRetained(null);
    });
    return () => {generation.current += 1; animation.stop();};
  }, [children, p, reduced]);
  if (reduced) return <>{children}</>;
  if (!retained) return null;
  return <Animated.View accessibilityElementsHidden={!children}
    importantForAccessibility={children ? 'auto' : 'no-hide-descendants'}
    pointerEvents={children ? 'auto' : 'none'}
    style={{overflow: 'hidden', opacity: p, height: height ? p.interpolate({inputRange: [0, 1], outputRange: [0, height]}) : undefined,
      transform: [{translateX: p.interpolate({inputRange: [0, 1], outputRange: [10, 0]})}]}}>
    <View onLayout={event => setHeight(event.nativeEvent.layout.height)}>{retained}</View>
  </Animated.View>;
}
