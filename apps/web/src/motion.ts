import {useCallback, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {flushSync} from 'react-dom';
import {STUDIO} from '../../mobile/src/visual/studio';

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const easing = STUDIO.motion.easing;

// Pair only the same card across routes, even if scheduling changes mid-transition.
export const transitionObjectName = (cardId: string) =>
  `learning-object-${Array.from(cardId, char => char.codePointAt(0)!.toString(16)).join('-')}`;
type MotionKind = 'flip' | 'advance' | 'left' | 'right';
export type MotionAction = () => void | Promise<void>;

export function useObjectMotion(identity: string | null, ref: RefObject<HTMLElement | null>) {
  const running = useRef<Animation | null>(null);
  const operation = useRef<{token: number; committed: boolean} | null>(null);
  const commitPending = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const [state, setState] = useState({identity, busy: false});
  if (state.identity !== identity) setState({identity, busy: false});
  const previous = useRef(identity);

  useLayoutEffect(() => {
    generation.current += 1;
    operation.current = null;
    commitPending.current = null;
    running.current?.cancel();
    running.current = null;
    const node = ref.current;
    const changed = previous.current !== identity;
    previous.current = identity;
    if (changed && node?.animate && !prefersReducedMotion()) {
      running.current = node.animate([{opacity: 0, transform: 'translateX(28px)'}, {opacity: 1, transform: 'none'}], {duration: STUDIO.motion.enter, easing});
      void running.current.finished.catch(() => undefined);
    }
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reduce = () => {
      if (!preference?.matches) return;
      running.current?.cancel(); running.current = null;
      // Finish the outgoing intent once, but keep an already-started request
      // pending. Changing a motion preference must never submit it again.
      commitPending.current?.();
    };
    preference?.addEventListener?.('change', reduce);
    return () => {
      generation.current += 1; operation.current = null; commitPending.current = null;
      running.current?.cancel(); running.current = null;
      preference?.removeEventListener?.('change', reduce);
    };
  }, [identity, ref]);

  const perform = useCallback((kind: MotionKind, action: MotionAction) => {
    if (operation.current) return;
    const node = ref.current;
    const token = ++generation.current;
    running.current?.cancel();
    const current = {token, committed: false};
    operation.current = current;
    setState({identity, busy: true});
    const transform = kind === 'flip' ? 'perspective(1000px) rotateY(80deg)'
      : kind === 'advance' ? 'translateX(-32px) rotate(-1deg)'
      : `translateX(${kind === 'left' ? '-' : ''}${Math.max((node?.getBoundingClientRect().width ?? 0) * 1.2, 320)}px) rotate(${kind === 'left' ? '-' : ''}8deg)`;
    const finish = () => {
      if (token !== generation.current || operation.current !== current) return;
      // Flush state queued by an async continuation before deciding whether
      // this is still the old object. A new identity owns its own entrance.
      flushSync(() => setState({identity, busy: false}));
      if (token !== generation.current || operation.current !== current) return;
      operation.current = null; commitPending.current = null;
      running.current?.cancel(); running.current = null;
      if (token !== generation.current || !ref.current?.animate || prefersReducedMotion()) return;
      running.current = ref.current.animate([
        {opacity: 0, transform: kind === 'flip' ? 'perspective(1000px) rotateY(-80deg)' : 'translateX(28px)'},
        {opacity: 1, transform: 'none'},
      ], {duration: STUDIO.motion.release, easing});
      void running.current.finished.catch(() => undefined);
    };
    const commit = () => {
      if (token !== generation.current || operation.current !== current || current.committed) return;
      current.committed = true;
      let completion!: void | Promise<void>;
      try {
        flushSync(() => {completion = action();});
      } catch {
        finish();
        return;
      }
      // Keep the outgoing object's final frame until the request settles.
      // Failure (or no replacement) restores it; success enters only the new card.
      if (completion && typeof completion.then === 'function') {
        void completion.then(finish, finish);
      } else finish();
    };
    commitPending.current = commit;
    if (!node?.animate || prefersReducedMotion()) {commit(); return;}
    try {
      running.current = node.animate([{opacity: 1, transform: getComputedStyle(node).transform}, {opacity: 0, transform}], {duration: kind === 'left' || kind === 'right' ? STUDIO.motion.reveal : STUDIO.motion.leave, easing, fill: 'forwards'});
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
