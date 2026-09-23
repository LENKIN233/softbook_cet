import { utf8ToBytes } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type {
  LearningCard,
  LearningCardResult,
  LearningCardState,
} from '../learning/model';
import { createLearningCardState } from '../learning/sessionCore';
import {
  createStudyState,
  planLocalCards,
  validateStudyState,
  type StudyFrame,
  type StudyProfileInput,
  type StudyState,
} from './studyModel';
import { getChinaDayKey } from '../shared/chinaDay';

export type StudyStorage = {
  removeItem?: (key: string) => unknown | Promise<unknown>;
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => unknown | Promise<unknown>;
  getAllKeys: () => readonly string[] | Promise<readonly string[]>;
};
export class StudyStorageError extends Error {
  constructor(
    readonly kind: 'invalid' | 'unavailable' | 'conflict' | 'wrong_track',
  ) {
    super(kind);
  }
}
type Envelope = {
  schemaVersion: 2;
  track: string;
  contentVersion: string;
  savedAt: string;
  fingerprints: Record<string, string>;
  state: StudyState;
};
type StoreOptions = StudyProfileInput & {
  storage: StudyStorage;
  withLock: <T>(key: string, work: () => Promise<T>) => Promise<T>;
  legacyNative?: () => Promise<StudyState | null>;
};
const hash = (value: string) =>
  Array.from(sha256(utf8ToBytes(value)), byte =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function cardFingerprints(cards: readonly LearningCard[]) {
  return Object.fromEntries(
    cards.map(card => [card.card_id, hash(canonical(card))]),
  );
}
function parse(raw: string, limit = 8_000_000): Record<string, unknown> {
  if (raw.length > limit) throw new StudyStorageError('invalid');
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error();
    return data;
  } catch {
    throw new StudyStorageError('invalid');
  }
}
function migrateState(
  old: StudyState,
  compatible: Set<string>,
  cards: LearningCard[],
): StudyState {
  const fresh = createStudyState(cards);
  const results = old.results.filter(result => compatible.has(result.cardId));
  const favorites = old.favorites.filter(id => compatible.has(id));
  const sleeping = old.sleeping.filter(id => compatible.has(id));
  const adapt = (frame: StudyFrame): StudyFrame => {
    const ids = frame.ids.filter(id => compatible.has(id));
    const retained = frame.ids
      .slice(frame.index)
      .find(id => compatible.has(id) && !sleeping.includes(id));
    const index = retained ? ids.indexOf(retained) : ids.length;
    const currentCompatible = retained === frame.ids[frame.index];
    const card = cards.find(c => c.card_id === retained);
    const complete = frame.complete || !card;
    return {
      ...frame,
      ids,
      index,
      complete,
      results: frame.results.filter(r => ids.includes(r.cardId)),
      draft: complete
        ? null
        : currentCompatible
        ? frame.draft
        : {
            ...createLearningCardState(card!),
            isFavorited: favorites.includes(card!.card_id),
          },
      resolved: complete || !currentCompatible ? null : frame.resolved,
    };
  };
  const next = {
    ...fresh,
    frame: adapt(old.frame),
    resume: old.resume ? adapt(old.resume) : null,
    results,
    favorites,
    sleeping,
    schedule: Object.fromEntries(
      Object.entries(old.schedule).filter(([id]) => compatible.has(id)),
    ),
    days: old.days,
    checkIns: old.checkIns,
  };
  validateStudyState(next, cards);
  return next;
}
function legacyState(
  data: Record<string, unknown>,
  cards: LearningCard[],
): StudyState {
  const old = data.state as Record<string, unknown>;
  if (
    !old ||
    typeof old !== 'object' ||
    !Array.isArray(old.results) ||
    !Array.isArray(old.favorites) ||
    !Array.isArray(old.sleeping)
  )
    throw new StudyStorageError('invalid');
  const known = new Set(cards.map(card => card.card_id));
  const state = createStudyState(cards);
  state.results = old.results as LearningCardResult[];
  state.favorites = old.favorites as string[];
  state.sleeping = old.sleeping as string[];
  if (typeof old.checkedInDay === 'string') state.checkIns = [old.checkedInDay];
  for (const result of state.results) {
    const day = getChinaDayKey(new Date(result.completedAt));
    const counts = state.days[day] ?? {
      learning: 0,
      review: 0,
      correct: 0,
      hints: 0,
    };
    state.days[day] = {
      ...counts,
      learning: counts.learning + 1,
      correct: counts.correct + (result.outcome === 'correct' ? 1 : 0),
      hints: counts.hints + (result.usedHint ? 1 : 0),
    };
    state.schedule[result.cardId] = {
      dueAt: result.completedAt,
      days: 0,
      successes: 0,
    };
  }
  const current =
    typeof old.currentCardId === 'string' && known.has(old.currentCardId)
      ? old.currentCardId
      : null;
  const remaining = planLocalCards(cards)
    .filter(
      card =>
        card.card_id !== current &&
        !state.sleeping.includes(card.card_id) &&
        !state.results.some(r => r.cardId === card.card_id),
    )
    .map(card => card.card_id);
  const oldReview = Array.isArray(old.reviewCardIds)
    ? (old.reviewCardIds as string[]).filter(
        id => known.has(id) && !state.sleeping.includes(id),
      )
    : [];
  const ids =
    old.phase === 'review'
      ? oldReview.slice(
          Math.max(0, oldReview.indexOf(current ?? '')),
          Math.max(0, oldReview.indexOf(current ?? '')) + 5,
        )
      : [...(current ? [current] : []), ...remaining].slice(0, 5);
  const index = current && ids.includes(current) ? ids.indexOf(current) : 0;
  const card = cards.find(c => c.card_id === ids[index]);
  state.frame = {
    phase: old.phase === 'review' ? 'review' : 'learning',
    ids,
    index: card ? index : ids.length,
    complete: !card,
    draft: card
      ? {
          ...createLearningCardState(card),
          ...(old.draft as LearningCardState | null),
          isFavorited: state.favorites.includes(card.card_id),
        }
      : null,
    resolved: card
      ? state.results.find(r => r.cardId === old.resolved) ?? null
      : null,
    results: state.results.filter(r => r.cardId === old.resolved),
  };
  if (
    old.phase === 'review' &&
    typeof old.resumeCardId === 'string' &&
    known.has(old.resumeCardId)
  ) {
    const resumeCard = cards.find(card => card.card_id === old.resumeCardId)!;
    const resumeIds = [
      resumeCard.card_id,
      ...remaining.filter(id => id !== resumeCard.card_id),
    ].slice(0, 5);
    state.resume = {
      phase: 'learning',
      ids: resumeIds,
      index: 0,
      complete: false,
      draft: {
        ...createLearningCardState(resumeCard),
        isFavorited: state.favorites.includes(resumeCard.card_id),
      },
      resolved: null,
      results: [],
    };
  }
  validateStudyState(state, cards);
  return state;
}
export function createStudyStore(options: StoreOptions) {
  const { storage, track, cards, contentVersion, withLock } = options;
  const key = `softbook-cet/study/v2/${track}`;
  const legacyPrefix = `softbook-cet/local-learning/v1/${track}/`;
  const fingerprints = cardFingerprints(cards);
  let observed: string | null | undefined;
  let lastAttempt: string | null = null;
  let tail = Promise.resolve();
  const read = async (name: string) => {
    try {
      return await storage.getItem(name);
    } catch {
      throw new StudyStorageError('unavailable');
    }
  };
  const write = async (name: string, raw: string) => {
    try {
      await storage.setItem(name, raw);
      if ((await read(name)) !== raw) throw new Error();
    } catch {
      throw new StudyStorageError('unavailable');
    }
  };
  const envelope = (state: StudyState): Envelope => ({
    schemaVersion: 2,
    track,
    contentVersion,
    savedAt: new Date().toISOString(),
    fingerprints,
    state,
  });
  const archive = async (raw: string) => {
    const name = `${key}/archive/${hash(raw)}`;
    await write(name, raw);
    return name;
  };
  const decode = (
    raw: string,
  ): { state: StudyState; notice: string | null } => {
    const data = parse(raw);
    if (data.track !== track) throw new StudyStorageError('wrong_track');
    try {
      if (
        data.schemaVersion === 1 &&
        Object.keys(data).some(
          k =>
            !['schemaVersion', 'track', 'contentVersion', 'state'].includes(k),
        )
      )
        throw new Error();
      if (data.schemaVersion === 1 && data.contentVersion === contentVersion)
        return {
          state: legacyState(data, cards),
          notice: '已保留之前的进度，并更新学习安排。',
        };
      if (
        data.schemaVersion !== 2 ||
        !data.fingerprints ||
        typeof data.fingerprints !== 'object' ||
        !data.state
      )
        throw new Error();
      if (
        Object.keys(data).some(
          k =>
            ![
              'schemaVersion',
              'track',
              'contentVersion',
              'savedAt',
              'fingerprints',
              'state',
            ].includes(k),
        )
      )
        throw new Error();
      if (data.contentVersion === contentVersion) {
        validateStudyState(data.state, cards);
        if (
          Object.entries(fingerprints).some(
            ([id, value]) =>
              (data.fingerprints as Record<string, string>)[id] !== value,
          )
        )
          throw new Error();
        return { state: data.state, notice: null };
      }
      const compatible = new Set(
        Object.entries(fingerprints)
          .filter(
            ([id, value]) =>
              (data.fingerprints as Record<string, string>)[id] === value,
          )
          .map(([id]) => id),
      );
      return {
        state: migrateState(data.state as StudyState, compatible, cards),
        notice: '卡库已更新。未变化卡片的进度已恢复，其余记录保留在备份中。',
      };
    } catch (error) {
      if (error instanceof StudyStorageError) throw error;
      throw new StudyStorageError('invalid');
    }
  };
  const queue = <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(() => withLock(key, work));
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const save = async (state: StudyState) => {
    validateStudyState(state, cards);
    const detached = JSON.parse(JSON.stringify(state)) as StudyState;
    return queue(async () => {
      const current = await read(key);
      if (
        observed === undefined ||
        (current !== observed && current !== lastAttempt)
      )
        throw new StudyStorageError('conflict');
      const raw = JSON.stringify(envelope(detached));
      lastAttempt = raw;
      await write(key, raw);
      observed = raw;
      lastAttempt = null;
    });
  };
  return {
    key,
    save,
    flush: () => tail,
    async load(): Promise<{ state: StudyState; notice: string | null }> {
      await tail;
      const raw = await read(key);
      observed = raw;
      if (raw !== null) {
        const decoded = decode(raw);
        if (decoded.notice) await archive(raw);
        return decoded;
      }
      const keys = await storage.getAllKeys();
      const candidates = keys.filter(name => name.startsWith(legacyPrefix));
      const exact = `${legacyPrefix}${encodeURIComponent(contentVersion)}`;
      if (candidates.includes(exact)) {
        const legacy = await read(exact);
        if (legacy !== null) return decode(legacy);
      }
      if (candidates.length)
        return {
          state: createStudyState(cards),
          notice:
            '发现旧卡库记录，已保留在备份中。可在“我的”查看和导出，当前卡库从新安排开始。',
        };
      const legacy = await options.legacyNative?.();
      if (legacy) {
        validateStudyState(legacy, cards);
        return {
          state: legacy,
          notice: '已恢复本机原有的收藏、暂停卡片和学习位置。',
        };
      }
      return { state: createStudyState(cards), notice: null };
    },
    backup(state?: StudyState) {
      return queue(async () => {
        if (state) validateStudyState(state, cards);
        const names = (await storage.getAllKeys()).filter(
          name =>
            name === key ||
            name.startsWith(`${key}/archive/`) ||
            name.startsWith(legacyPrefix),
        );
        const records = await Promise.all(
          names.map(async name => ({ key: name, raw: await read(name) })),
        );
        if (state) {
          const current = records.findIndex(record => record.key === key);
          if (current >= 0) records.splice(current, 1);
          records.unshift({ key, raw: JSON.stringify(envelope(state)) });
        }
        return JSON.stringify(
          {
            format: 'softbook-study-backup/v1',
            track,
            exportedAt: new Date().toISOString(),
            records,
          },
          null,
          2,
        );
      });
    },
    async archives() {
      const names = (await storage.getAllKeys()).filter(
        name =>
          name.startsWith(`${key}/archive/`) || name.startsWith(legacyPrefix),
      );
      return Promise.all(
        names.map(async name => {
          const raw = await read(name);
          let date = '之前的记录',
            count: number | null = null,
            canRestore = false;
          try {
            const data = parse(raw ?? '');
            date =
              typeof data.savedAt === 'string'
                ? data.savedAt.slice(0, 10)
                : date;
            const results = (data.state as { results?: unknown[] })?.results;
            count = Array.isArray(results) ? results.length : null;
            decode(raw!);
            canRestore = true;
          } catch {
            /* Raw data remains exportable even when restoration is unsafe. */
          }
          return { key: name, date, count, canRestore };
        }),
      );
    },
    deleteArchive(name: string) {
      return queue(async () => {
        if (
          (!name.startsWith(`${key}/archive/`) &&
            !name.startsWith(legacyPrefix)) ||
          !storage.removeItem
        )
          throw new StudyStorageError('invalid');
        try {
          await storage.removeItem(name);
          if ((await read(name)) !== null) throw new Error();
        } catch {
          throw new StudyStorageError('unavailable');
        }
      });
    },
    restoreArchive(name: string) {
      return queue(async () => {
        if (
          !name.startsWith(`${key}/archive/`) &&
          !name.startsWith(legacyPrefix)
        )
          throw new StudyStorageError('invalid');
        const raw = await read(name);
        if (raw === null) throw new StudyStorageError('invalid');
        const decoded = decode(raw);
        const current = await read(key);
        if (current !== observed) throw new StudyStorageError('conflict');
        if (current !== null) await archive(current);
        const next = JSON.stringify(envelope(decoded.state));
        await write(key, next);
        observed = next;
        return decoded;
      });
    },
    reset() {
      return queue(async () => {
        const current = await read(key);
        if (observed !== current) throw new StudyStorageError('conflict');
        if (current !== null) await archive(current);
        const names = (await storage.getAllKeys()).filter(name =>
          name.startsWith(legacyPrefix),
        );
        for (const name of names) {
          const legacy = await read(name);
          if (legacy !== null) await archive(legacy);
        }
        const state = createStudyState(cards);
        const raw = JSON.stringify(envelope(state));
        await write(key, raw);
        observed = raw;
        return state;
      });
    },
    restore(backup: string) {
      return queue(async () => {
        const bundle = parse(backup, 64_000_000);
        if (
          bundle.format !== 'softbook-study-backup/v1' ||
          bundle.track !== track ||
          !Array.isArray(bundle.records)
        )
          throw new StudyStorageError('wrong_track');
        const records = bundle.records as { key: string; raw: string }[];
        const record =
          records.find(item => item.key === key) ??
          records.find(
            item =>
              item.key ===
              `${legacyPrefix}${encodeURIComponent(contentVersion)}`,
          );
        if (!record || typeof record.raw !== 'string')
          throw new StudyStorageError('invalid');
        const decoded = decode(record.raw);
        const current = await read(key);
        if (current !== observed) throw new StudyStorageError('conflict');
        if (current !== null) await archive(current);
        const raw = JSON.stringify(envelope(decoded.state));
        await write(key, raw);
        observed = raw;
        return decoded;
      });
    },
  };
}
