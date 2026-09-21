import type {
  LearningCard,
  LearningCardResult,
  LearningCardState,
  LearningTrack,
} from '../learning/model';
import {
  createLearningCardState,
  evaluateLearningCard,
} from '../learning/sessionCore';
import { getChinaDayKey } from '../shared/chinaDay';

export type StudyFrame = {
  phase: 'learning' | 'review';
  ids: string[];
  index: number;
  complete: boolean;
  draft: LearningCardState | null;
  resolved: LearningCardResult | null;
  results: LearningCardResult[];
};
export type ReviewTiming = { dueAt: string; days: number; successes: number };
export type StudyState = {
  frame: StudyFrame;
  resume: StudyFrame | null;
  results: LearningCardResult[];
  favorites: string[];
  sleeping: string[];
  schedule: Record<string, ReviewTiming>;
  days: Record<
    string,
    { learning: number; review: number; correct: number; hints: number }
  >;
  checkIns: string[];
};
export type StudyAction =
  | { type: 'draft'; draft: LearningCardState }
  | { type: 'patch'; patch: Partial<LearningCardState> }
  | { type: 'answer'; draft?: LearningCardState }
  | { type: 'advance' }
  | { type: 'continue' }
  | { type: 'review' }
  | { type: 'practice' }
  | { type: 'favorite'; id: string }
  | { type: 'sleep'; id: string }
  | { type: 'checkin' };
const DAY = 86400000;
export const GROUP_SIZE = 5;

// Keep adjacent cards within each subject in their authored order. Alternate
// short subject blocks so a learner does not spend 55 sessions on listening alone.
export function planLocalCards(cards: readonly LearningCard[]): LearningCard[] {
  const libraries = [
    '听力',
    '词汇',
    '语法',
    '仔细阅读',
    '选词填空',
    '写作',
    '翻译',
  ];
  const groups = new Map<string, LearningCard[]>();
  for (const card of [...cards].sort((a, b) =>
    a.card_id.localeCompare(b.card_id),
  )) {
    const name = card.space_metadata.library;
    groups.set(name, [...(groups.get(name) ?? []), card]);
  }
  const names = [
    ...libraries.filter(name => groups.has(name)),
    ...[...groups.keys()].filter(name => !libraries.includes(name)),
  ];
  const result: LearningCard[] = [];
  while ([...groups.values()].some(group => group.length)) {
    for (const name of names) result.push(...groups.get(name)!.splice(0, 2));
  }
  return result;
}
export function activeStudyCard(
  state: StudyState,
  cards: readonly LearningCard[],
) {
  return (
    cards.find(card => card.card_id === state.frame.ids[state.frame.index]) ??
    null
  );
}
export function pendingStudyIds(
  state: StudyState,
  cards: readonly LearningCard[],
  now = new Date(),
) {
  const resultById = new Map(
    state.results.map(result => [result.cardId, result]),
  );
  return cards
    .filter(
      card =>
        !state.sleeping.includes(card.card_id) &&
        (['incorrect', 'review'].includes(
          resultById.get(card.card_id)?.outcome ?? '',
        ) ||
          Date.parse(state.schedule[card.card_id]?.dueAt ?? '') <=
            now.getTime()),
    )
    .sort(
      (a, b) =>
        Date.parse(state.schedule[a.card_id]?.dueAt ?? now.toISOString()) -
        Date.parse(state.schedule[b.card_id]?.dueAt ?? now.toISOString()),
    )
    .map(card => card.card_id);
}
function makeFrame(
  ids: string[],
  phase: StudyFrame['phase'],
  state: Pick<StudyState, 'favorites'>,
  cards: readonly LearningCard[],
): StudyFrame {
  const card = cards.find(item => item.card_id === ids[0]);
  return {
    phase,
    ids,
    index: 0,
    complete: !card,
    resolved: null,
    results: [],
    draft: card
      ? {
          ...createLearningCardState(card),
          isFavorited: state.favorites.includes(card.card_id),
        }
      : null,
  };
}
function newIds(state: StudyState, cards: readonly LearningCard[]) {
  const learned = new Set(state.results.map(result => result.cardId));
  return planLocalCards(cards)
    .filter(
      card =>
        !learned.has(card.card_id) && !state.sleeping.includes(card.card_id),
    )
    .slice(0, GROUP_SIZE)
    .map(card => card.card_id);
}
export function createStudyState(cards: readonly LearningCard[]): StudyState {
  const state: StudyState = {
    frame: {
      phase: 'learning',
      ids: [],
      index: 0,
      complete: true,
      draft: null,
      resolved: null,
      results: [],
    },
    resume: null,
    results: [],
    favorites: [],
    sleeping: [],
    schedule: {},
    days: {},
    checkIns: [],
  };
  state.frame = makeFrame(newIds(state, cards), 'learning', state, cards);
  return state;
}
function reconcileFrame(
  frame: StudyFrame,
  state: StudyState,
  cards: readonly LearningCard[],
): StudyFrame {
  // A completed group is a stable receipt, even when one of its cards is paused.
  if (frame.complete) return frame;
  let index = frame.index;
  while (
    index < frame.ids.length &&
    (state.sleeping.includes(frame.ids[index]) ||
      !cards.some(card => card.card_id === frame.ids[index]))
  )
    index++;
  if (index >= frame.ids.length)
    return { ...frame, index, complete: true, draft: null, resolved: null };
  const card = cards.find(item => item.card_id === frame.ids[index])!;
  return {
    ...frame,
    index,
    draft:
      index === frame.index && frame.draft
        ? {
            ...frame.draft,
            isFavorited: state.favorites.includes(card.card_id),
          }
        : {
            ...createLearningCardState(card),
            isFavorited: state.favorites.includes(card.card_id),
          },
    resolved: index === frame.index ? frame.resolved : null,
  };
}
export function reduceStudy(
  state: StudyState,
  action: StudyAction,
  cards: readonly LearningCard[],
  now = new Date(),
): StudyState {
  const card = activeStudyCard(state, cards);
  const frame = state.frame;
  if (action.type === 'patch')
    return !frame.draft || frame.resolved || frame.complete
      ? state
      : {
          ...state,
          frame: { ...frame, draft: { ...frame.draft, ...action.patch } },
        };
  if (action.type === 'draft')
    return !card || frame.complete || frame.resolved
      ? state
      : { ...state, frame: { ...frame, draft: action.draft } };
  if (action.type === 'answer') {
    const draft = action.draft ?? frame.draft;
    if (!card || frame.complete || frame.resolved || !draft) return state;
    const evaluated = evaluateLearningCard(card, draft);
    if (!evaluated) return state;
    const result = { ...evaluated, completedAt: now.toISOString() };
    const passed = ['correct', 'confident'].includes(result.outcome);
    const previous = state.schedule[card.card_id];
    const successes = passed ? (previous?.successes ?? 0) + 1 : 0;
    const days = passed ? [1, 3, 7, 14, 30, 60][Math.min(successes - 1, 5)] : 0;
    const day = getChinaDayKey(now),
      counts = state.days[day] ?? {
        learning: 0,
        review: 0,
        correct: 0,
        hints: 0,
      };
    return {
      ...state,
      frame: {
        ...frame,
        draft,
        resolved: result,
        results: [
          ...frame.results.filter(item => item.cardId !== result.cardId),
          result,
        ],
      },
      results: [
        ...state.results.filter(item => item.cardId !== result.cardId),
        result,
      ],
      schedule: {
        ...state.schedule,
        [card.card_id]: {
          dueAt: new Date(
            now.getTime() + (passed ? days * DAY : 10 * 60000),
          ).toISOString(),
          days,
          successes,
        },
      },
      days: {
        ...state.days,
        [day]: {
          ...counts,
          [frame.phase]: counts[frame.phase] + 1,
          correct: counts.correct + (result.outcome === 'correct' ? 1 : 0),
          hints: counts.hints + (result.usedHint ? 1 : 0),
        },
      },
    };
  }
  if (action.type === 'advance') {
    if (!frame.resolved || frame.complete) return state;
    return {
      ...state,
      frame: reconcileFrame(
        { ...frame, index: frame.index + 1, draft: null, resolved: null },
        state,
        cards,
      ),
    };
  }
  if (action.type === 'favorite' || action.type === 'sleep') {
    if (!cards.some(item => item.card_id === action.id)) return state;
    const key = action.type === 'favorite' ? 'favorites' : 'sleeping';
    const next = {
      ...state,
      [key]: state[key].includes(action.id)
        ? state[key].filter(id => id !== action.id)
        : [...state[key], action.id],
    };
    return {
      ...next,
      frame: reconcileFrame(frame, next, cards),
      resume: next.resume ? reconcileFrame(next.resume, next, cards) : null,
    };
  }
  if (action.type === 'checkin') {
    const day = getChinaDayKey(now),
      counts = state.days[day];
    return !counts ||
      counts.learning + counts.review === 0 ||
      state.checkIns.includes(day)
      ? state
      : { ...state, checkIns: [...state.checkIns, day] };
  }
  if (action.type === 'review') {
    const ids = pendingStudyIds(state, cards, now).slice(0, GROUP_SIZE);
    return !ids.length
      ? state
      : {
          ...state,
          resume: frame.phase === 'learning' ? frame : state.resume,
          frame: makeFrame(ids, 'review', state, cards),
        };
  }
  if (action.type === 'continue') {
    if (!frame.complete) return state;
    if (frame.phase === 'review' && state.resume && !state.resume.complete)
      return {
        ...state,
        frame: reconcileFrame(state.resume, state, cards),
        resume: null,
      };
    const due = pendingStudyIds(state, cards, now)
      .filter(
        id => Date.parse(state.schedule[id]?.dueAt ?? '') <= now.getTime(),
      )
      .slice(0, GROUP_SIZE);
    const ids = newIds(state, cards);
    return {
      ...state,
      resume: null,
      frame: makeFrame(
        due.length ? due : ids,
        due.length ? 'review' : 'learning',
        state,
        cards,
      ),
    };
  }
  if (action.type === 'practice')
    return {
      ...state,
      resume: null,
      frame: makeFrame(
        planLocalCards(cards)
          .filter(item => !state.sleeping.includes(item.card_id))
          .slice(0, GROUP_SIZE)
          .map(item => item.card_id),
        'review',
        state,
        cards,
      ),
    };
  return state;
}

export function studyDay(state: StudyState, now = new Date()) {
  return (
    state.days[getChinaDayKey(now)] ?? {
      learning: 0,
      review: 0,
      correct: 0,
      hints: 0,
    }
  );
}
export function nextStudyDue(state: StudyState): string | null {
  const dates = Object.entries(state.schedule)
    .filter(([id]) => !state.sleeping.includes(id))
    .map(([, item]) => item.dueAt)
    .sort();
  return dates[0] ?? null;
}
export function validateStudyState(
  value: unknown,
  cards: readonly LearningCard[],
): asserts value is StudyState {
  const state = value as StudyState;
  const known = new Map(cards.map(card => [card.card_id, card]));
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const keys = (v: unknown, names: string[]) =>
    object(v) &&
    Object.keys(v).length === names.length &&
    names.every(name => Object.hasOwn(v, name));
  const ids = (v: unknown) =>
    Array.isArray(v) &&
    v.length <= cards.length &&
    new Set(v).size === v.length &&
    v.every(id => typeof id === 'string' && known.has(id));
  const fail = () => {
    throw new Error('invalid_study_record');
  };
  const date = (v: unknown) =>
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  const result = (r: LearningCardResult) => {
    const c = known.get(r?.cardId);
    return (
      keys(r, [
        'cardId',
        'interactionId',
        'outcome',
        'usedHint',
        'usedPeek',
        'isFavorited',
        'completedAt',
      ]) &&
      c &&
      c.interaction_id === r.interactionId &&
      (c.interaction_id === 'flip'
        ? ['confident', 'review']
        : ['correct', 'incorrect']
      ).includes(r.outcome) &&
      ['usedHint', 'usedPeek', 'isFavorited'].every(
        k => typeof r[k as keyof LearningCardResult] === 'boolean',
      ) &&
      typeof r.completedAt === 'string' &&
      Number.isFinite(Date.parse(r.completedAt))
    );
  };
  const frame = (f: StudyFrame) => {
    if (
      !keys(f, [
        'phase',
        'ids',
        'index',
        'complete',
        'draft',
        'resolved',
        'results',
      ]) ||
      !['learning', 'review'].includes(f.phase) ||
      !ids(f.ids) ||
      f.ids.length > GROUP_SIZE ||
      !Number.isInteger(f.index) ||
      f.index < 0 ||
      f.index > f.ids.length ||
      typeof f.complete !== 'boolean' ||
      !Array.isArray(f.results) ||
      !f.results.every(r => result(r) && f.ids.includes(r.cardId)) ||
      new Set(f.results.map(r => r.cardId)).size !== f.results.length
    )
      fail();
    if (f.complete && (f.draft !== null || f.resolved !== null)) fail();
    if (!f.complete && f.index >= f.ids.length) fail();
    if (
      f.resolved !== null &&
      (!result(f.resolved) ||
        f.resolved.cardId !== f.ids[f.index] ||
        !f.results.some(r => r.cardId === f.resolved!.cardId))
    )
      fail();
    if (f.draft !== null) {
      const c = known.get(f.ids[f.index]);
      const d = f.draft;
      if (
        !c ||
        !object(d) ||
        Object.keys(d).some(
          k =>
            ![
              'hasUsedHint',
              'hasUsedPeek',
              'hasMadeLockMistake',
              'isPeeked',
              'isFavorited',
              'isHintVisible',
              'isFlipped',
              'flipConfidence',
              'selectedOptionId',
              'lockSelections',
              'eliminatedItemIds',
              'swipeSelection',
            ].includes(k),
        ) ||
        ![
          'hasUsedHint',
          'hasUsedPeek',
          'hasMadeLockMistake',
          'isPeeked',
          'isFavorited',
          'isHintVisible',
          'isFlipped',
        ].every(k => typeof d[k as keyof LearningCardState] === 'boolean') ||
        ![null, 'confident', 'review'].includes(d.flipConfidence)
      )
        fail();
      if (
        d.selectedOptionId !== null &&
        (c!.interaction_id !== 'multiple_choice' ||
          !c!.options.some(o => o.id === d.selectedOptionId))
      )
        fail();
      if (
        d.swipeSelection !== null &&
        (c!.interaction_id !== 'swipe' ||
          !c!.swipe_states.some(o => o.id === d.swipeSelection))
      )
        fail();
      const slots = c!.interaction_id === 'lock' ? c!.lock_slots : [];
      if (
        !object(d.lockSelections) ||
        Object.keys(d.lockSelections).length !== slots.length ||
        !slots.every(
          slot =>
            Object.hasOwn(d.lockSelections, slot.id) &&
            (d.lockSelections[slot.id] === null ||
              slot.options.includes(d.lockSelections[slot.id]!)),
        )
      )
        fail();
      if (
        !Array.isArray(d.eliminatedItemIds) ||
        new Set(d.eliminatedItemIds).size !== d.eliminatedItemIds.length ||
        d.eliminatedItemIds.some(
          id =>
            c!.interaction_id !== 'elimination' ||
            !c!.elimination_items.some(item => item.id === id),
        )
      )
        fail();
    }
  };
  if (
    !keys(state, [
      'frame',
      'resume',
      'results',
      'favorites',
      'sleeping',
      'schedule',
      'days',
      'checkIns',
    ]) ||
    !ids(state.favorites) ||
    !ids(state.sleeping) ||
    !Array.isArray(state.results) ||
    state.results.length > cards.length ||
    !state.results.every(result) ||
    new Set(state.results.map(r => r.cardId)).size !== state.results.length ||
    !object(state.schedule) ||
    !object(state.days) ||
    !Array.isArray(state.checkIns) ||
    !state.checkIns.every(date)
  )
    fail();
  frame(state.frame);
  if (state.resume !== null) frame(state.resume);
  for (const [id, timing] of Object.entries(state.schedule)) {
    if (
      !known.has(id) ||
      !keys(timing, ['dueAt', 'days', 'successes']) ||
      typeof timing.dueAt !== 'string' ||
      !Number.isFinite(Date.parse(timing.dueAt)) ||
      !Number.isInteger(timing.days) ||
      timing.days < 0 ||
      timing.days > 60 ||
      !Number.isInteger(timing.successes) ||
      timing.successes < 0
    )
      fail();
  }
  for (const [day, counts] of Object.entries(state.days)) {
    if (
      !date(day) ||
      !keys(counts, ['learning', 'review', 'correct', 'hints']) ||
      !Object.values(counts).every(n => Number.isSafeInteger(n) && n >= 0)
    )
      fail();
  }
}
export type StudyProfileInput = {
  track: LearningTrack;
  contentVersion: string;
  cards: LearningCard[];
};

export function hasStudyActivity(state: StudyState): boolean {
  const draft = state.frame.draft;
  return (
    state.results.length > 0 ||
    state.favorites.length > 0 ||
    state.sleeping.length > 0 ||
    state.checkIns.length > 0 ||
    state.frame.index > 0 ||
    state.resume !== null ||
    Boolean(
      draft &&
        (draft.isFlipped ||
          draft.hasUsedHint ||
          draft.hasUsedPeek ||
          draft.selectedOptionId !== null ||
          draft.swipeSelection !== null ||
          draft.eliminatedItemIds.length ||
          Object.values(draft.lockSelections).some(value => value !== null)),
    )
  );
}
