import {useCallback, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {flushSync} from 'react-dom';

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const easing = 'cubic-bezier(.2,.75,.25,1)';

// Pair only the same card across routes, even if scheduling changes mid-transition.
export const transitionObjectName = (cardId: string) =>
  `learning-object-${Array.from(cardId, char => char.codePointAt(0)!.toString(16)).join('-')}`;
type MotionKind = 'flip' | 'advance' | 'left' | 'right';

export function useObjectMotion(identity: string | null, ref: RefObject<HTMLElement | null>) {
  const running = useRef<Animation | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const [state, setState] = useState({identity, busy: false});
  if (state.identity !== identity) setState({identity, busy: false});
  const previous = useRef(identity);

  useLayoutEffect(() => {
    generation.current += 1;
    pending.current = null;
    running.current?.cancel();
    running.current = null;
    const node = ref.current;
    const changed = previous.current !== identity;
    previous.current = identity;
    if (changed && node?.animate && !prefersReducedMotion()) {
      running.current = node.animate([{opacity: 0, transform: 'translateX(28px)'}, {opacity: 1, transform: 'none'}], {duration: 200, easing});
      void running.current.finished.catch(() => undefined);
    }
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reduce = () => {
      if (!preference?.matches) return;
      generation.current += 1;
      running.current?.cancel(); running.current = null;
      const action = pending.current; pending.current = null;
      setState({identity, busy: false}); action?.();
    };
    preference?.addEventListener?.('change', reduce);
    return () => {
      generation.current += 1; pending.current = null;
      running.current?.cancel(); running.current = null;
      preference?.removeEventListener?.('change', reduce);
    };
  }, [identity, ref]);

  const perform = useCallback((kind: MotionKind, action: () => void) => {
    if (pending.current) return;
    const node = ref.current;
    if (!node?.animate || prefersReducedMotion()) {action(); return;}
    const token = ++generation.current;
    running.current?.cancel();
    pending.current = action; setState({identity, busy: true});
    const transform = kind === 'flip' ? 'perspective(1000px) rotateY(80deg)'
      : kind === 'advance' ? 'translateX(-32px) rotate(-1deg)'
      : `translateX(${kind === 'left' ? '-' : ''}${Math.max(node.getBoundingClientRect().width * 1.2, 320)}px) rotate(${kind === 'left' ? '-' : ''}8deg)`;
    const commit = () => {
      if (token !== generation.current || !pending.current) return;
      const callback = pending.current; pending.current = null;
      running.current?.cancel(); running.current = null; setState({identity, busy: false});
      flushSync(callback);
      if (token !== generation.current || !ref.current?.animate || prefersReducedMotion()) return;
      running.current = ref.current.animate([
        {opacity: 0, transform: kind === 'flip' ? 'perspective(1000px) rotateY(-80deg)' : 'translateX(28px)'},
        {opacity: 1, transform: 'none'},
      ], {duration: 180, easing});
      void running.current.finished.catch(() => undefined);
    };
    try {
      running.current = node.animate([{opacity: 1, transform: getComputedStyle(node).transform}, {opacity: 0, transform}], {duration: kind === 'left' || kind === 'right' ? 220 : 130, easing, fill: 'forwards'});
      void running.current.finished.then(commit, commit);
    } catch {commit();}
  }, [identity, ref]);
  return {perform, busy: state.identity === identity && state.busy};
}

// View-transition snapshots carry pixels only; account and learning state stay
// owned by React. Stale navigation callbacks cannot revive a superseded route.
export function useRouteMotion(scope: string) {
  const active = useRef<ViewTransition | null>(null);
  const generation = useRef(0);
  useLayoutEffect(() => () => {generation.current += 1; active.current?.skipTransition();}, [scope]);
  return useCallback((update: () => void) => {
    const token = ++generation.current;
    active.current?.skipTransition();
    if (!document.startViewTransition || prefersReducedMotion()) {update(); return;}
    try {
      const transition = document.startViewTransition(() => {
        if (generation.current === token) flushSync(update);
      });
      active.current = transition;
      void transition.ready.catch(() => undefined);
      void transition.finished.catch(() => undefined);
    } catch {
      if (generation.current === token) update();
    }
  }, []);
}
