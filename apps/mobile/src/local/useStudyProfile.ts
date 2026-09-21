import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getChinaDayKey,
  getMillisecondsUntilNextChinaDay,
} from '../shared/chinaDay';
import {
  createStudyStore,
  StudyStorageError,
  type StudyStorage,
} from './studyStore';
import type { LearningCardState } from '../learning/model';
import {
  reduceStudy,
  type StudyAction,
  type StudyProfileInput,
  type StudyState,
} from './studyModel';

export function useChinaDay() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const current = new Date();
      setNow(current);
      timer = setTimeout(
        update,
        Math.min(getMillisecondsUntilNextChinaDay(current) + 50, 60000),
      );
    };
    update();
    return () => clearTimeout(timer);
  }, []);
  const refresh = useCallback(() => setNow(new Date()), []);
  return { now, day: getChinaDayKey(now), refresh };
}
const nativeTails = new Map<string, Promise<unknown>>();
export async function localStudyLock<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const result = (nativeTails.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(work);
  nativeTails.set(key, result);
  try {
    return await result;
  } finally {
    if (nativeTails.get(key) === result) nativeTails.delete(key);
  }
}
export function studyStorageMessage(error: unknown) {
  if (error instanceof StudyStorageError) {
    if (error.kind === 'conflict')
      return '其他页面更新了进度，请读取已保存的记录后继续。本页未保存的记录也可以先导出。';
    if (error.kind === 'wrong_track')
      return '备份不属于当前考级，请切换考级后再导入。';
    if (error.kind === 'invalid')
      return '记录暂时无法读取，原内容已保留。可以导出备份，或备份后重新开始。';
  }
  return '这次进度还没保存，请重试。';
}
export function useStudyProfile(
  input: StudyProfileInput | null,
  storage: StudyStorage,
  withLock: typeof localStudyLock,
  legacyNative?: () => Promise<StudyState | null>,
) {
  const store = useMemo(
    () =>
      input
        ? createStudyStore({ ...input, storage, withLock, legacyNative })
        : null,
    [input, storage, withLock, legacyNative],
  );
  const [state, setState] = useState<StudyState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'saving' | 'saved' | 'error'
  >('loading');
  const [reload, setReload] = useState(0);
  const [retry, setRetry] = useState(0);
  const loadedStore = useRef<typeof store>(null);
  const currentState = useRef(state);
  currentState.current = state;
  const [savedState, setSavedState] = useState<StudyState | null>(null);
  useEffect(() => {
    let active = true;
    loadedStore.current = null;
    setState(null);
    setSavedState(null);
    setStatus('loading');
    setError('');
    if (!store) return;
    store
      .load()
      .then(result => {
        if (active) {
          loadedStore.current = store;
          setState(result.state);
          setNotice(result.notice);
        }
      })
      .catch(problem => {
        if (active) {
          setStatus('error');
          setError(studyStorageMessage(problem));
        }
      });
    return () => {
      active = false;
    };
  }, [store, reload]);
  useEffect(() => {
    if (!store || loadedStore.current !== store || !state) return;
    let active = true;
    setStatus('saving');
    store
      .save(state)
      .then(() => {
        if (active) {
          setSavedState(state);
          setStatus('saved');
          setError('');
        }
      })
      .catch(problem => {
        if (active) {
          setStatus('error');
          setError(studyStorageMessage(problem));
        }
      });
    return () => {
      active = false;
    };
  }, [store, state, retry]);
  const attempt = async <T>(work: () => Promise<T>) => {
    try {
      return await work();
    } catch (problem) {
      setError(studyStorageMessage(problem));
      setStatus('error');
      throw problem;
    }
  };
  return {
    state,
    savedState,
    status:
      status === 'error' || !state
        ? status
        : savedState === state
        ? ('saved' as const)
        : ('saving' as const),
    error,
    notice,
    clearNotice: () => setNotice(null),
    updateDraft: (
      update:
        | LearningCardState
        | null
        | ((previous: LearningCardState | null) => LearningCardState | null),
    ) => {
      if (input)
        setState(previous => {
          if (!previous) return previous;
          const draft =
            typeof update === 'function'
              ? update(previous.frame.draft)
              : update;
          return draft
            ? reduceStudy(previous, { type: 'draft', draft }, input.cards)
            : previous;
        });
    },
    dispatch: (action: StudyAction) => {
      if (input)
        setState(previous =>
          previous
            ? reduceStudy(previous, action, input.cards, new Date())
            : previous,
        );
    },
    retry: () => setRetry(value => value + 1),
    reload: async () => {
      await store?.flush();
      setReload(value => value + 1);
    },
    flush: async () => {
      if (store && currentState.current && loadedStore.current === store)
        await attempt(() => store.save(currentState.current!));
      await store?.flush();
    },
    backup: () =>
      attempt(async () => {
        if (!store) throw new StudyStorageError('unavailable');
        return store.backup(currentState.current ?? undefined);
      }),
    deleteArchive: (key: string) =>
      attempt(async () => {
        if (!store) throw new StudyStorageError('unavailable');
        await store.deleteArchive(key);
      }),
    archives: () => attempt(async () => (store ? store.archives() : [])),
    restoreArchive: (key: string) =>
      attempt(async () => {
        if (!store) throw new StudyStorageError('unavailable');
        const next = await store.restoreArchive(key);
        loadedStore.current = store;
        setState(next.state);
        setNotice(next.notice ?? '备份已恢复。');
        setError('');
      }),
    reset: () =>
      attempt(async () => {
        if (!store) throw new StudyStorageError('unavailable');
        const next = await store.reset();
        loadedStore.current = store;
        setState(next);
        setNotice('原记录已备份，已开始新的学习记录。');
        setError('');
      }),
    restore: (backup: string) =>
      attempt(async () => {
        if (!store) throw new StudyStorageError('unavailable');
        const next = await store.restore(backup);
        loadedStore.current = store;
        setState(next.state);
        setNotice(next.notice ?? '备份已恢复。');
        setError('');
      }),
  };
}
