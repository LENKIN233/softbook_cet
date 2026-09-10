import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, Animated, Pressable, View, StyleSheet} from 'react-native';
import {NativeMotionProvider, MotionPressable, useCardMotion} from '../src/learning/NativeMotion';

let completions: Array<() => void>;
let changePreference: (reduced: boolean) => void;
beforeEach(() => {
  completions = [];
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_name, listener) => {
    changePreference = listener as unknown as (reduced: boolean) => void;
    return {remove: jest.fn()} as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: callback => {completions.push(() => {if (value instanceof Animated.Value && typeof config.toValue === 'number') value.setValue(config.toValue); callback?.({finished: true});});},
    stop: jest.fn(), reset: jest.fn(),
  }));
});
afterEach(() => jest.restoreAllMocks());

function Harness({identity, action}: {identity: string; action: () => void}) {
  const motion = useCardMotion(identity);
  return <><Pressable testID="go" onPress={() => motion.perform('advance', action)} /><Pressable testID="cancel" onPress={motion.cancel} /></>;
}
async function mount(identity: string, action: () => void) {
  let view!: TestRenderer.ReactTestRenderer;
  await act(async () => {view = TestRenderer.create(<NativeMotionProvider><Harness identity={identity} action={action} /></NativeMotionProvider>);});
  return view;
}
function finishQueued() {const queued = completions.splice(0); queued.forEach(finish => finish());}

it('advances once after the outgoing phase, even with two presses', async () => {
  const action = jest.fn(); const view = await mount('a', action);
  act(() => {view.root.findByProps({testID: 'go'}).props.onPress(); view.root.findByProps({testID: 'go'}).props.onPress();});
  expect(action).not.toHaveBeenCalled();
  act(finishQueued); expect(action).toHaveBeenCalledTimes(1);
  act(finishQueued); expect(action).toHaveBeenCalledTimes(1);
  act(() => view.unmount());
});

it('does not advance a superseded card or an unmounted surface', async () => {
  const action = jest.fn(); const view = await mount('a', action);
  act(() => view.root.findByProps({testID: 'go'}).props.onPress());
  act(() => view.update(<NativeMotionProvider><Harness identity="b" action={action} /></NativeMotionProvider>));
  act(finishQueued); expect(action).not.toHaveBeenCalled();
  act(() => view.root.findByProps({testID: 'go'}).props.onPress());
  act(() => view.unmount()); act(finishQueued);
  expect(action).not.toHaveBeenCalled();
});

it('completes the pending action once when reduced motion interrupts it', async () => {
  const action = jest.fn(); const view = await mount('a', action);
  act(() => view.root.findByProps({testID: 'go'}).props.onPress());
  act(() => changePreference(true));
  expect(action).toHaveBeenCalledTimes(1);
  act(finishQueued); expect(action).toHaveBeenCalledTimes(1);
  act(() => view.unmount());
});


it('cancels a superseded navigation intent and accepts the next one', async () => {
  const action = jest.fn(); const view = await mount('a', action);
  act(() => {view.root.findByProps({testID: 'go'}).props.onPress(); view.root.findByProps({testID: 'cancel'}).props.onPress();});
  act(finishQueued); expect(action).not.toHaveBeenCalled();
  act(() => view.root.findByProps({testID: 'go'}).props.onPress());
  act(finishQueued); expect(action).toHaveBeenCalledTimes(1);
  act(() => view.unmount());
});

it('keeps caller layout and the accessible label on animated controls', async () => {
  let view!: TestRenderer.ReactTestRenderer;
  const action = jest.fn();
  await act(async () => {view = TestRenderer.create(<MotionPressable motionKey={false}
    accessibilityLabel="Answer option" onPress={action} style={{width: 123, minHeight: 48, borderWidth: 1}} />);});
  const layouts = view.root.findAllByType(View).map(node => StyleSheet.flatten(node.props.style));
  expect(layouts.some(style => style?.width === 123 && style?.minHeight === 48 && style?.borderWidth === 1)).toBe(true);
  expect(view.root.findAllByType(View).some(node => node.props.accessibilityLabel === 'Answer option')).toBe(true);
  act(() => view.unmount());
});

it('keeps an outgoing route hidden until the new route commits', async () => {
  const changeRoute = jest.fn();
  function RouteHarness({route}: {route: string}) {
    const motion = useCardMotion(route, 'space');
    return <><View testID="page" style={motion.cardStyle} /><Pressable testID="space" onPress={() => motion.perform('space', changeRoute)} /></>;
  }
  let view!: TestRenderer.ReactTestRenderer;
  await act(async () => {view = TestRenderer.create(<NativeMotionProvider><RouteHarness route="learning" /></NativeMotionProvider>);});
  act(() => view.root.findByProps({testID: 'space'}).props.onPress());
  act(finishQueued);
  expect(changeRoute).toHaveBeenCalledTimes(1);
  const opacity = view.root.findByProps({testID: 'page'}).props.style.opacity as Animated.Value & {__getValue: () => number};
  expect(opacity.__getValue()).toBe(0);
  expect(completions).toHaveLength(0);
  act(() => view.update(<NativeMotionProvider><RouteHarness route="space" /></NativeMotionProvider>));
  expect(opacity.__getValue()).toBe(0);
  act(finishQueued);
  expect(opacity.__getValue()).toBe(1);
  act(() => view.unmount());
});
