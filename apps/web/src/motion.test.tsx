import {act, fireEvent, render, screen} from '@testing-library/react';
import {useRef, useState} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useObjectMotion, useRouteMotion} from './motion';

type PendingAnimation = {finish: () => void; cancel: () => void; text: string | null};
let animations: PendingAnimation[];
let reduced = false;
let preferenceListeners: Array<() => void>;
const originalAnimate = Element.prototype.animate;
const originalPreference = window.matchMedia;
const originalTransition = document.startViewTransition;

beforeEach(() => {
  animations = []; preferenceListeners = []; reduced = false;
  window.matchMedia = vi.fn(() => ({get matches() {return reduced;}, addEventListener: (_: string, fn: () => void) => preferenceListeners.push(fn), removeEventListener: (_: string, fn: () => void) => {preferenceListeners = preferenceListeners.filter(item => item !== fn);}} as unknown as MediaQueryList));
  Element.prototype.animate = vi.fn(function(this: Element) {
    let finish!: () => void; let reject!: () => void;
    const finished = new Promise<void>((resolve, failure) => {finish = resolve; reject = failure;});
    const animation = {finish, cancel: reject, finished, text: this.textContent};
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

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {resolve = done; reject = fail;});
  return {promise, resolve, reject};
}

function AsyncAdvanceHarness({request, changeCard = true}: {request: () => Promise<void>; changeCard?: boolean}) {
  const [identity, setIdentity] = useState('old-answer');
  const ref = useRef<HTMLDivElement | null>(null);
  const motion = useObjectMotion(identity, ref);
  return <div ref={ref}><p>{identity}</p><button onClick={() => motion.perform('advance', async () => {
    await request();
    if (changeCard) setIdentity('new-question');
  })}>Continue</button><span>{motion.busy ? 'moving' : 'ready'}</span></div>;
}

it('waits for successful remote continuation and enters the new object only once', async () => {
  const response = deferred(); const request = vi.fn(() => response.promise);
  render(<AsyncAdvanceHarness request={request} />);
  fireEvent.click(screen.getByText('Continue'));
  await act(async () => animations[0].finish());
  expect(request).toHaveBeenCalledTimes(1);
  expect(animations).toHaveLength(1);
  expect(screen.getByText('moving')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Continue'));
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => response.resolve());
  expect(animations).toHaveLength(2);
  expect(animations[1].text).toContain('new-question');
  expect(animations[1].text).not.toContain('old-answer');
  expect(screen.getByText('ready')).toBeInTheDocument();
});

it('restores the previous object only after the asynchronous continuation fails', async () => {
  const response = deferred();
  render(<AsyncAdvanceHarness request={() => response.promise} />);
  fireEvent.click(screen.getByText('Continue'));
  await act(async () => animations[0].finish());
  expect(animations).toHaveLength(1);
  await act(async () => response.reject(new Error('Offline')));
  expect(animations).toHaveLength(2);
  expect(animations[1].text).toContain('old-answer');
  expect(screen.getByText('ready')).toBeInTheDocument();
});

it('does not restore pixels or busy state for a superseded asynchronous intent', async () => {
  const response = deferred();
  const view = render(<ObjectHarness identity="old" action={() => response.promise} />);
  fireEvent.click(screen.getByText('Reveal'));
  await act(async () => animations[0].finish());
  view.rerender(<ObjectHarness identity="replacement" action={() => undefined} />);
  const count = animations.length;
  await act(async () => response.resolve());
  expect(animations).toHaveLength(count);
  expect(screen.getByText('ready')).toBeInTheDocument();
});

it('ignores a continuation that settles after its surface is unmounted', async () => {
  const response = deferred();
  const view = render(<AsyncAdvanceHarness request={() => response.promise} changeCard={false} />);
  fireEvent.click(screen.getByText('Continue'));
  await act(async () => animations[0].finish());
  view.unmount();
  await act(async () => response.resolve());
  expect(animations).toHaveLength(1);
});

it('keeps an in-flight request single when reduced motion interrupts its wait', async () => {
  const response = deferred(); const request = vi.fn(() => response.promise);
  render(<AsyncAdvanceHarness request={request} />);
  fireEvent.click(screen.getByText('Continue'));
  await act(async () => animations[0].finish());
  act(() => {reduced = true; preferenceListeners.forEach(listener => listener());});
  fireEvent.click(screen.getByText('Continue'));
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByText('moving')).toBeInTheDocument();
  await act(async () => response.resolve());
  expect(screen.getByText('new-question')).toBeInTheDocument();
  expect(screen.getByText('ready')).toBeInTheDocument();
  expect(animations).toHaveLength(1);
});

it.each(['reduced', 'unsupported'])('keeps asynchronous advance exclusive with the %s fallback', async fallback => {
  if (fallback === 'reduced') reduced = true;
  else Element.prototype.animate = undefined as unknown as typeof Element.prototype.animate;
  const response = deferred(); const request = vi.fn(() => response.promise);
  render(<AsyncAdvanceHarness request={request} />);
  fireEvent.click(screen.getByText('Continue')); fireEvent.click(screen.getByText('Continue'));
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByText('moving')).toBeInTheDocument();
  await act(async () => response.resolve());
  expect(screen.getByText('new-question')).toBeInTheDocument();
  expect(screen.getByText('ready')).toBeInTheDocument();
  expect(animations).toHaveLength(0);
});

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
