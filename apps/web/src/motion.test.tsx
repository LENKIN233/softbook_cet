import {act, fireEvent, render, screen} from '@testing-library/react';
import {useRef} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useObjectMotion, useRouteMotion} from './motion';

type PendingAnimation = {finish: () => void; cancel: () => void};
let animations: PendingAnimation[];
let reduced = false;
let preferenceListeners: Array<() => void>;
const originalAnimate = Element.prototype.animate;
const originalPreference = window.matchMedia;
const originalTransition = document.startViewTransition;

beforeEach(() => {
  animations = []; preferenceListeners = []; reduced = false;
  window.matchMedia = vi.fn(() => ({get matches() {return reduced;}, addEventListener: (_: string, fn: () => void) => preferenceListeners.push(fn), removeEventListener: (_: string, fn: () => void) => {preferenceListeners = preferenceListeners.filter(item => item !== fn);}} as unknown as MediaQueryList));
  Element.prototype.animate = vi.fn(() => {
    let finish!: () => void; let reject!: () => void;
    const finished = new Promise<void>((resolve, failure) => {finish = resolve; reject = failure;});
    const animation = {finish, cancel: reject, finished};
    animations.push(animation);
    return animation as unknown as Animation;
  });
});
afterEach(() => {Element.prototype.animate = originalAnimate; window.matchMedia = originalPreference; document.startViewTransition = originalTransition;});

function ObjectHarness({identity, action}: {identity: string; action: () => void}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const motion = useObjectMotion(identity, ref);
  return <div ref={ref}><button onClick={() => motion.perform('flip', action)}>Reveal</button><span>{motion.busy ? 'moving' : 'ready'}</span></div>;
}

it('commits once at the midpoint despite repeated activation', async () => {
  const action = vi.fn(); render(<ObjectHarness identity="card-a" action={action} />);
  fireEvent.click(screen.getByText('Reveal')); fireEvent.click(screen.getByText('Reveal'));
  expect(action).not.toHaveBeenCalled();
  await act(async () => animations[0].finish());
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => animations[1].finish());
  expect(action).toHaveBeenCalledTimes(1);
});

it('cancels an outgoing callback when card identity changes or unmounts', async () => {
  const action = vi.fn(); const view = render(<ObjectHarness identity="card-a" action={action} />);
  fireEvent.click(screen.getByText('Reveal'));
  view.rerender(<ObjectHarness identity="card-b" action={action} />);
  await act(async () => animations[0].finish());
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Reveal'));
  view.unmount();
  await act(async () => animations.at(-1)?.finish());
  expect(action).not.toHaveBeenCalled();
});

it('finishes a pending intent once when reduced motion is enabled', async () => {
  const action = vi.fn(); render(<ObjectHarness identity="card-a" action={action} />);
  fireEvent.click(screen.getByText('Reveal'));
  act(() => {reduced = true; preferenceListeners.forEach(fn => fn());});
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => animations[0].finish());
  expect(action).toHaveBeenCalledTimes(1);
});

it('works immediately without animation support and with reduced motion', () => {
  const action = vi.fn(); reduced = true;
  render(<ObjectHarness identity="card-a" action={action} />);
  fireEvent.click(screen.getByText('Reveal'));
  expect(action).toHaveBeenCalledTimes(1); expect(animations).toHaveLength(0);
  reduced = false; Element.prototype.animate = undefined as unknown as typeof Element.prototype.animate;
  fireEvent.click(screen.getByText('Reveal'));
  expect(action).toHaveBeenCalledTimes(2);
});

it('ignores superseded route snapshots and cancels navigation on account scope change', async () => {
  const updates: Array<() => void> = [];
  document.startViewTransition = vi.fn((update: unknown) => {
    updates.push(update as () => void);
    return {skipTransition: vi.fn(), ready: Promise.resolve(), finished: Promise.resolve()} as unknown as ViewTransition;
  });
  const action = vi.fn();
  function RouteHarness({scope}: {scope: string}) {
    const transition = useRouteMotion(scope);
    return <button onClick={() => transition(action)}>Navigate</button>;
  }
  const view = render(<RouteHarness scope="account-a" />);
  fireEvent.click(screen.getByText('Navigate')); fireEvent.click(screen.getByText('Navigate'));
  await act(async () => {updates[0](); updates[1]();});
  expect(action).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Navigate'));
  view.rerender(<RouteHarness scope="signed-out" />);
  await act(async () => updates[2]());
  expect(action).toHaveBeenCalledTimes(1);
});


it('keeps navigation usable when snapshot creation is unavailable', () => {
  const action = vi.fn();
  document.startViewTransition = vi.fn(() => {throw new Error('snapshot unavailable');});
  function Harness() {
    const navigate = useRouteMotion('account-a');
    return <button onClick={() => navigate(action)}>Go</button>;
  }
  render(<Harness />); fireEvent.click(screen.getByText('Go'));
  expect(action).toHaveBeenCalledTimes(1);
});
