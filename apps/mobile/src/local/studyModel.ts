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
import type {TrackStudyStatistics} from '../statistics/trackStudyStatistics';
import {advanceKnowledgeWindow, baseLearningCardOrder, KNOWLEDGE_POINT_WINDOW_SIZE, knowledgePointOf, nextKnowledgeCandidateIndex, orderLearningCards, separateKnowledgePoints} from '../learning/learningSequence';

export type StudyFrame = {
  phase: 'learning' | 'review';
  // Present only on normal course rounds, which may space reviews with new cards.
  // Explicit review rounds keep their review-only batch semantics.
  taskPhases?: StudyFrame['phase'][];
  ids: string[];
  index: number;
  complete: boolean;
  draft: LearningCardState | null;
  resolved: LearningCardResult | null;
  results: LearningCardResult[];
};
export type ReviewTiming = { dueAt: string; days: number; successes: number };
export type StudyDayCounts = {
  learning: number;
  review: number;
  correct: number;
  hints: number;
  // Missing on old nonempty days whose distinct cards cannot be reconstructed.
  completedCardIds?: string[];
};
export type StudyState = {
  frame: StudyFrame;
  resume: StudyFrame | null;
  results: LearningCardResult[];
  // Retained across content updates, independently of current-card results.
  learnedCardIds?: string[];
  favorites: string[];
  sleeping: string[];
  schedule: Record<string, ReviewTiming>;
  days: Record<string, StudyDayCounts>;
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

export function planLocalCards(cards: readonly LearningCard[]): LearningCard[] {
  return orderLearningCards(cards);
}

function recentStudyResults(state: StudyState, cards: readonly LearningCard[]): LearningCardResult[] {
  const known = new Map(cards.map(card => [card.card_id, card])), latestByPoint = new Map<string, LearningCardResult>();
  for (const result of state.results.filter(value => known.has(value.cardId))
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))) {
    const point = knowledgePointOf(known.get(result.cardId)!);
    latestByPoint.delete(point);latestByPoint.set(point, result);
  }
  return [...latestByPoint.values()].slice(-KNOWLEDGE_POINT_WINDOW_SIZE);
}
function recentStudyPoints(state: StudyState, cards: readonly LearningCard[]): string[] {
  const byId = new Map(cards.map(card => [card.card_id, card]));
  return recentStudyResults(state, cards).map(result => knowledgePointOf(byId.get(result.cardId)!));
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
  return separateKnowledgePoints(reviewCandidates(state, cards, now), recentStudyPoints(state, cards)).map(card => card.card_id);
}
function reviewCandidates(state: StudyState, cards: readonly LearningCard[], now: Date) {
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
    );
}

type StudyTask = {card: LearningCard; phase: StudyFrame['phase']};
function normalTasks(state: StudyState, cards: readonly LearningCard[], now: Date,
  window = recentStudyPoints(state, cards), limit = GROUP_SIZE, excluded = new Set<string>(), previousPhase = state.frame.phase): StudyTask[] {
  const due = reviewCandidates(state, cards, now).filter(card =>
    !excluded.has(card.card_id) && Date.parse(state.schedule[card.card_id]?.dueAt ?? '') <= now.getTime());
  const learned = new Set(state.results.map(result => result.cardId));
  const dueIds = new Set(due.map(card => card.card_id));
  const fresh = baseLearningCardOrder(cards).filter(card => !learned.has(card.card_id) &&
    !dueIds.has(card.card_id) && !state.sleeping.includes(card.card_id) && !excluded.has(card.card_id));
  const tasks: StudyTask[] = [];
  while (tasks.length < limit && (due.length || fresh.length)) {
    const variedDue = nextKnowledgeCandidateIndex(due, window);
    const variedNew = nextKnowledgeCandidateIndex(fresh, window);
    const previousPoint = window.at(-1);
    const needsWindowSpacing = previousPhase === 'review' && variedNew >= 0 &&
      !window.includes(knowledgePointOf(fresh[variedNew])) &&
      due.every(card => window.includes(knowledgePointOf(card)));
    const useReview = due.length > 0 && !needsWindowSpacing && (knowledgePointOf(due[variedDue]) !== previousPoint ||
      variedNew < 0 || knowledgePointOf(fresh[variedNew]) === previousPoint);
    const queue = useReview ? due : fresh;
    const preferred = useReview ? variedDue : variedNew;
    const [card] = queue.splice(preferred < 0 ? 0 : preferred, 1);
    tasks.push({card, phase: useReview ? 'review' : 'learning'});
    previousPhase = useReview ? 'review' : 'learning';
    window = advanceKnowledgeWindow(window, knowledgePointOf(card));
  }
  return tasks;
}
function normalFrame(state: StudyState, cards: readonly LearningCard[], now: Date): StudyFrame {
  const tasks = normalTasks(state, cards, now);
  return {...makeFrame(tasks.map(task => task.card.card_id), tasks[0]?.phase ?? 'learning', state, cards),
    taskPhases: tasks.map(task => task.phase)};
}
function isNormalFrame(frame: StudyFrame): boolean {
  return frame.taskPhases !== undefined || frame.phase === 'learning';
}

/** Keep everything already presented; only unfinished, unseen slots adopt the current order. */
export function refreshStudyOrder(state: StudyState, cards: readonly LearningCard[], now = new Date()): StudyState {
  const byId = new Map(cards.map(card => [card.card_id, card]));
  const refreshFrame = (frame: StudyFrame): StudyFrame => {
    if (frame.complete) return frame;
    const prefix = frame.ids.slice(0, frame.index + 1), current = byId.get(prefix.at(-1)!);
    if (!current) return frame;
    const moveCurrent = state.sleeping.includes(current.card_id);
    if (!moveCurrent && frame.index >= frame.ids.length - 1) return frame;
    const recent = recentStudyResults(state, cards), latest = recent.at(-1);
    let window = recent.map(result => knowledgePointOf(byId.get(result.cardId)!));
    const alreadyConfirmed = frame.resolved !== null && latest?.cardId === current.card_id &&
      latest.completedAt === frame.resolved.completedAt;
    if (!alreadyConfirmed) window = advanceKnowledgeWindow(window, knowledgePointOf(current));
    const excluded = new Set([...prefix, ...frame.results.map(result => result.cardId)]);
    const slots = frame.ids.length - prefix.length;
    let ids: string[], taskPhases = frame.taskPhases;
    if (isNormalFrame(frame)) {
      const tasks = normalTasks(state, cards, now, window, slots, excluded, frame.phase);
      ids = [...prefix, ...tasks.map(task => task.card.card_id)];
      taskPhases = [...(frame.taskPhases?.slice(0, prefix.length) ?? prefix.map(() => frame.phase)), ...tasks.map(task => task.phase)];
    } else {
      const queued = frame.ids.slice(prefix.length).map(id => byId.get(id)).filter((card): card is LearningCard =>
        card !== undefined && !state.sleeping.includes(card.card_id) && !excluded.has(card.card_id));
      const candidates = [...queued, ...reviewCandidates(state, cards, now).filter(card => !excluded.has(card.card_id))];
      const unique = [...new Map(candidates.map(card => [card.card_id, card])).values()];
      const tail = separateKnowledgePoints(unique, window).slice(0, slots);
      ids = [...prefix, ...tail.map(card => card.card_id)];
    }
    const index = moveCurrent ? prefix.length : frame.index, nextCard = byId.get(ids[index]);
    return {...frame, ids, index, ...(taskPhases ? {taskPhases} : {}),
      phase: taskPhases?.[index] ?? frame.phase, complete: !nextCard,
      draft: moveCurrent ? nextCard ? {...createLearningCardState(nextCard), isFavorited: state.favorites.includes(nextCard.card_id)} : null : frame.draft,
      resolved: moveCurrent ? null : frame.resolved};
  };
  return {...state, frame: refreshFrame(state.frame), resume: state.resume ? refreshFrame(state.resume) : null};
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
    learnedCardIds: [],
    favorites: [],
    sleeping: [],
    schedule: {},
    days: {},
    checkIns: [],
  };
  state.frame = normalFrame(state, cards, new Date());
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
    phase: frame.taskPhases?.[index] ?? frame.phase,
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
        completedCardIds: [],
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
      learnedCardIds: [...new Set([...learnedStudyCardIds(state), result.cardId])],
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
          ...(counts.completedCardIds || counts.learning + counts.review === 0
            ? {completedCardIds: [...new Set([...(counts.completedCardIds ?? []), result.cardId])]}
            : {}),
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
    const reconciled = {
      ...next,
      frame: action.type === 'sleep' ? frame : reconcileFrame(frame, next, cards),
      resume: next.resume && action.type !== 'sleep' ? reconcileFrame(next.resume, next, cards) : next.resume,
    };
    return action.type === 'sleep' ? refreshStudyOrder(reconciled, cards, now) : reconciled;
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
          resume: isNormalFrame(frame) ? frame : state.resume,
          frame: makeFrame(ids, 'review', state, cards),
        };
  }
  if (action.type === 'continue') {
    if (!frame.complete) return state;
    if (!isNormalFrame(frame) && state.resume && !state.resume.complete)
      return {
        ...state,
        frame: reconcileFrame(state.resume, state, cards),
        resume: null,
      };
    return {
      ...state,
      resume: null,
      frame: normalFrame(state, cards, now),
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
      completedCardIds: [],
    }
  );
}
export function learnedStudyCardIds(state: StudyState): string[] {
  return [...new Set([
    ...(state.learnedCardIds ?? []),
    ...state.results.map(result => result.cardId),
    ...Object.values(state.days).flatMap(day => day.completedCardIds ?? []),
  ])];
}
export function studyStatistics(
  state: StudyState,
  track: LearningTrack,
  now = new Date(),
): TrackStudyStatistics | undefined {
  const counts = studyDay(state, now);
  if (!counts.completedCardIds && counts.learning + counts.review > 0) {
    return undefined;
  }
  return {
    dayKey: getChinaDayKey(now),
    track,
    completedCardCount: counts.completedCardIds?.length ?? 0,
    completedAttemptCount: counts.learning + counts.review,
    reviewAttemptCount: counts.review,
    cumulativeLearnedCardCount: learnedStudyCardIds(state).length,
  };
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
        ...(Object.hasOwn(f, 'taskPhases') ? ['taskPhases'] : []),
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
    if (f.taskPhases !== undefined && (!Array.isArray(f.taskPhases) || f.taskPhases.length !== f.ids.length ||
      f.taskPhases.some(phase => phase !== 'learning' && phase !== 'review') ||
      !f.complete && f.taskPhases[f.index] !== f.phase)) fail();
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
      ...(Object.hasOwn(state, 'learnedCardIds') ? ['learnedCardIds'] : []),
    ]) ||
    (Object.hasOwn(state, 'learnedCardIds') && (
      !Array.isArray(state.learnedCardIds) ||
      new Set(state.learnedCardIds).size !== state.learnedCardIds.length ||
      state.learnedCardIds.some(id => typeof id !== 'string' || !/^\d{6}$/.test(id))
    )) ||
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
      !keys(counts, ['learning', 'review', 'correct', 'hints',
        ...(Object.hasOwn(counts, 'completedCardIds') ? ['completedCardIds'] : [])]) ||
      ![counts.learning, counts.review, counts.correct, counts.hints]
        .every(n => Number.isSafeInteger(n) && n >= 0) ||
      (counts.completedCardIds !== undefined && (
        !Array.isArray(counts.completedCardIds) ||
        new Set(counts.completedCardIds).size !== counts.completedCardIds.length ||
        counts.completedCardIds.some(id => typeof id !== 'string' || !/^\d{6}$/.test(id)) ||
        counts.completedCardIds.length > counts.learning + counts.review ||
        (counts.completedCardIds.length === 0) !== (counts.learning + counts.review === 0)
      ))
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
    (state.learnedCardIds?.length ?? 0) > 0 ||
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
