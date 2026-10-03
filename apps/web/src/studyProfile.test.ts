import { describe, it, expect, vi } from "vitest";
import type {
  LearningCard,
  LearningCardState,
} from "../../mobile/src/learning/model";
import { createLearningCardState } from "../../mobile/src/learning/sessionCore";
import {
  activeStudyCard,
  createStudyState,
  pendingStudyIds,
  planLocalCards,
  reduceStudy,
  studyDay,
  studyStatistics,
  validateStudyState,
  type StudyState,
} from "../../mobile/src/local/studyModel";
import {
  createStudyStore,
  type StudyStorage,
} from "../../mobile/src/local/studyStore";
import { localStudyLock } from "../../mobile/src/local/useStudyProfile";
import {normalizeLearningCardRecords, type LearningCardRecord} from '../../mobile/src/learning/sourceContract';
import {knowledgePointOf} from '../../mobile/src/learning/learningSequence';
import cet4Records from '../../../infra/cloudbase/functions/softbook-api/card-content/cet4-0.json';
import cet6Records from '../../../infra/cloudbase/functions/softbook-api/card-content/cet6-0.json';

function makeCards(): LearningCard[] {
  return Array.from({ length: 14 }, (_, index) => ({
    card_id: String(index + 1).padStart(6, "0"),
    track: "cet4",
    knowledge_ref: `k${index}`,
    interaction_id: "multiple_choice",
    front: {
      prompt: `Question ${index}`,
      support: "Read this sentence.",
      context: "",
      eyebrow: "",
    },
    analysis: {
      title: "Explanation",
      summary: "Because of the context.",
      exam_tip: "Read carefully.",
    },
    options: [
      { id: "a", label: "A", text: "first" },
      { id: "b", label: "B", text: "second" },
    ],
    auto_scoring: true,
    answer_key: { correct_option: "a" },
    space_metadata: {
      library: index < 7 ? "听力" : "词汇",
      group: "group",
      box: "box",
      box_ref: `box-${index < 7 ? "listening" : "words"}`,
    },
  }));
}
const cards = makeCards();
const now = new Date("2026-09-19T02:00:00.000Z");
function answer(state: StudyState, choice = "a", date = now) {
  const card = activeStudyCard(state, cards)!;
  return reduceStudy(
    state,
    {
      type: "answer",
      draft: {
        ...(state.frame.draft ?? createLearningCardState(card)),
        selectedOptionId: choice,
      },
    },
    cards,
    date
  );
}
function finish(state: StudyState, choice = "a") {
  while (!state.frame.complete) {
    state = answer(state, choice);
    state = reduceStudy(state, { type: "advance" }, cards, now);
  }
  return state;
}
function fixture() {
  const values = new Map<string, string>();
  const storage: StudyStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    getAllKeys: async () => [...values.keys()],
  };
  return {
    values,
    storage,
    store: (
      contentVersion = "v1",
      catalog = cards,
      track: "cet4" | "cet6" = "cet4"
    ) =>
      createStudyStore({
        track,
        contentVersion,
        cards: catalog,
        storage,
        withLock: localStudyLock,
      }),
  };
}

for (const track of ['cet4', 'cet6'] as const) {
  const source = normalizeLearningCardRecords((track === 'cet4' ? cet4Records : cet6Records) as LearningCardRecord[]);
  const points = [...new Set(source.filter(card => card.space_metadata.library === source[0].space_metadata.library).map(knowledgePointOf))].slice(0, 3);
  const catalog = points.flatMap(point => source.filter(card => knowledgePointOf(card) === point).slice(0, 5));
  const samePoint = catalog.slice(0, 5), date = new Date('2026-10-03T08:00:00Z');
  const answerCurrent = (state: StudyState, outcome: 'confident' | 'review' = 'confident') => reduceStudy(state,
    {type: 'answer', draft: {...state.frame.draft!, isFlipped: true, flipConfidence: outcome, hasUsedHint: true}}, catalog, date);
  const oldFrame = () => {
    let state = createStudyState(catalog);
    state.frame = {...state.frame, phase: 'learning', ids: samePoint.map(card => card.card_id), index: 0,
      draft: createLearningCardState(samePoint[0]), resolved: null, results: []};
    Reflect.deleteProperty(state.frame, 'taskPhases');
    state = answerCurrent(state, 'review');
    state = reduceStudy(state, {type: 'advance'}, catalog, date);
    return answerCurrent(state);
  };
  it(`${track} upgrades a same-content old tail while retaining current feedback, confirmed prefix and saved history`, async () => {
    const f = fixture(), store = f.store('same-content', catalog, track);
    await store.load();const old = oldFrame();await store.save(old);
    const raw = f.values.get(store.key), restored = (await f.store('same-content', catalog, track).load()).state;
    expect(restored.frame.ids.slice(0, 2)).toEqual(old.frame.ids.slice(0, 2));
    expect(restored.frame.index).toBe(old.frame.index);
    expect(restored.frame.draft).toEqual(old.frame.draft);expect(restored.frame.resolved).toEqual(old.frame.resolved);
    expect(restored.frame.results).toEqual(old.frame.results);
    expect(restored.frame.ids).toHaveLength(5);
    for (let index = restored.frame.index + 1; index < restored.frame.ids.length; index++) {
      expect(knowledgePointOf(catalog.find(card => card.card_id === restored.frame.ids[index])!))
        .not.toBe(knowledgePointOf(catalog.find(card => card.card_id === restored.frame.ids[index - 1])!));
    }
    expect({...restored, frame: old.frame}).toEqual(old);
    expect(f.values.get(store.key)).toBe(raw);
    expect((await f.store('same-content', catalog, track).load()).state).toEqual(restored);
  });
  it(`${track} upgrades the suspended normal tail and returns to its exact active feedback after explicit review`, async () => {
    const f = fixture(), store = f.store('same-content', catalog, track);
    await store.load();const old = oldFrame(), reviewing = reduceStudy(old, {type: 'review'}, catalog, date);
    await store.save(reviewing);let restored = (await f.store('same-content', catalog, track).load()).state;
    expect(restored.frame.phase).toBe('review');expect(restored.frame.ids).toEqual([samePoint[0].card_id]);
    expect(restored.resume?.draft).toEqual(old.frame.draft);expect(restored.resume?.resolved).toEqual(old.frame.resolved);
    expect(restored.resume?.ids.slice(0, 2)).toEqual(old.frame.ids.slice(0, 2));
    expect(knowledgePointOf(catalog.find(card => card.card_id === restored.resume!.ids[2])!)).not.toBe(points[0]);
    restored = answerCurrent(restored);
    restored = reduceStudy(restored, {type: 'advance'}, catalog, date);
    const resume = structuredClone(restored.resume);
    restored = reduceStudy(restored, {type: 'continue'}, catalog, date);
    expect(restored.frame).toEqual(resume);expect(restored.resume).toBeNull();
    expect(restored.frame.draft).toEqual(old.frame.draft);expect(restored.frame.resolved).toEqual(old.frame.resolved);
  });
  it(`${track} leaves a completed old round receipt intact when upgrading the ordering policy`, async () => {
    const f = fixture(), store = f.store('same-content', catalog, track);await store.load();let old = oldFrame();
    while (!old.frame.complete) {old = answerCurrent(old);old = reduceStudy(old, {type: 'advance'}, catalog, date);}
    await store.save(old);const restored = (await f.store('same-content', catalog, track).load()).state;
    expect(restored.frame).toEqual(old.frame);expect(restored.results).toEqual(old.results);expect(restored.days).toEqual(old.days);
  });
  it(`${track} keeps task phases aligned when a content change removes a card before the active position`, async () => {
    vi.useFakeTimers({toFake: ['Date']});vi.setSystemTime(date);
    try {
    const f = fixture(), store = f.store('v1-real', catalog, track);await store.load();
    const state = createStudyState(catalog), ids = [samePoint[0].card_id, catalog[5].card_id, samePoint[1].card_id, catalog[6].card_id, samePoint[2].card_id];
    state.results = samePoint.map(card => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: 'confident', completedAt: date.toISOString(), usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(samePoint.map(card => [card.card_id, {dueAt: new Date(date.getTime() - 60000).toISOString(), days: 1, successes: 1}]));
    state.frame = {phase: 'learning', taskPhases: ['review', 'learning', 'review', 'learning', 'review'],
      ids, index: 1, complete: false, draft: createLearningCardState(catalog[5]), resolved: null, results: [state.results[0]]};
    await store.save(state);const nextCatalog = catalog.filter(card => card.card_id !== ids[0]);
    const restored = (await f.store('v2-real', nextCatalog, track).load()).state;
    expect(restored.frame.index).toBe(0);expect(restored.frame.ids[0]).toBe(ids[1]);
    expect(restored.frame.draft).toEqual(state.frame.draft);expect(restored.frame.phase).toBe('learning');
    expect(restored.frame.taskPhases).toHaveLength(restored.frame.ids.length);
    expect(restored.frame.taskPhases).toContain('review');expect(restored.frame.taskPhases).toContain('learning');
    restored.frame.ids.forEach((id, index) => expect(restored.frame.taskPhases![index])
      .toBe(samePoint.some(card => card.card_id === id) ? 'review' : 'learning'));
    expect(() => validateStudyState(restored, nextCatalog)).not.toThrow();
    for (const taskPhases of [restored.frame.taskPhases!.slice(1), ['review', ...restored.frame.taskPhases!.slice(1)]]) {
      expect(() => validateStudyState({...restored, frame: {...restored.frame, taskPhases}}, nextCatalog)).toThrow();
    }
    } finally {vi.useRealTimers();}
  });
  it(`${track} restores confirmed third-card feedback without duplicating that point in the diversity window`, async () => {
    vi.useFakeTimers({toFake: ['Date']});vi.setSystemTime(date);
    try {
      const five = [...new Set(source.map(knowledgePointOf))].slice(0, 5).map(point => source.find(card => knowledgePointOf(card) === point)!);
      const ids = [five[0].card_id, five[1].card_id, five[2].card_id,
        source.filter(card => knowledgePointOf(card) === knowledgePointOf(five[1]))[1].card_id,
        source.filter(card => knowledgePointOf(card) === knowledgePointOf(five[2]))[1].card_id];
      let old = createStudyState(source);
      old.frame = {...old.frame, ids, taskPhases: ids.map(() => 'learning')};
      for (let index = 0; index < 3; index++) {
        const card = activeStudyCard(old, source)!, draft = createLearningCardState(card);
        old = reduceStudy(old, {type: 'answer', draft: card.interaction_id === 'flip'
          ? {...draft, isFlipped: true, flipConfidence: 'confident', hasUsedHint: true}
          : {...draft, selectedOptionId: card.interaction_id === 'multiple_choice' ? card.answer_key.correct_option : null}}, source, date);
        expect(old.frame.resolved).not.toBeNull();
        if (index < 2) old = reduceStudy(old, {type: 'advance'}, source, date);
      }
      const f = fixture(), store = f.store('same-content', source, track);await store.load();await store.save(old);
      const restored = (await f.store('same-content', source, track).load()).state;
      expect(restored.frame.ids.slice(0, 3)).toEqual(old.frame.ids.slice(0, 3));
      expect(restored.frame.draft).toEqual(old.frame.draft);expect(restored.frame.resolved).toEqual(old.frame.resolved);
      expect(restored.frame.results).toEqual(old.frame.results);expect(restored.results).toEqual(old.results);
      expect(new Set(restored.frame.ids.map(id => knowledgePointOf(source.find(card => card.card_id === id)!))).size).toBe(5);
    } finally {vi.useRealTimers();}
  });
}

describe("shared local study workflow", () => {
  it("persists distinct cards and attempts separately across retries, reviews and China days", async () => {
    const f = fixture(), store = f.store();
    await store.load();
    let state = finish(createStudyState(cards));
    state = reduceStudy(state, { type: "practice" }, cards, now);
    state = answer(state);
    const once = studyStatistics(state, "cet4", now);
    expect(once).toEqual({dayKey: "2026-09-19", track: "cet4", completedCardCount: 5,
      completedAttemptCount: 6, reviewAttemptCount: 1, cumulativeLearnedCardCount: 5});
    state = answer(state);
    expect(studyStatistics(state, "cet4", now)).toEqual(once);
    await store.save(state);
    const restored = (await f.store().load()).state;
    expect(studyStatistics(restored, "cet4", now)).toEqual(once);
    const nextDay = new Date("2026-09-19T16:00:00.000Z");
    state = reduceStudy(restored, {type: "advance"}, cards, nextDay);
    state = answer(state, "a", nextDay);
    expect(studyStatistics(state, "cet4", nextDay)).toMatchObject({dayKey: "2026-09-20",
      completedCardCount: 1, completedAttemptCount: 1, reviewAttemptCount: 1,
      cumulativeLearnedCardCount: 5});
    expect(studyStatistics(state, "cet4", now)).toEqual(once);
    expect(studyStatistics((await f.store("v1", cards, "cet6").load()).state, "cet6", now))
      .toMatchObject({track: "cet6", completedCardCount: 0, completedAttemptCount: 0});
  });
  it("keeps incomplete legacy day history unavailable and starts exact counts on a new day", () => {
    let state = finish(createStudyState(cards));
    delete state.days["2026-09-19"].completedCardIds;
    expect(() => validateStudyState(state, cards)).not.toThrow();
    expect(studyStatistics(state, "cet4", now)).toBeUndefined();
    state = reduceStudy(state, {type: "practice"}, cards, now);
    state = answer(state);
    expect(studyStatistics(state, "cet4", now)).toBeUndefined();
    expect(studyStatistics(state, "cet4", new Date("2026-09-19T16:00:00Z")))
      .toMatchObject({completedCardCount: 0, completedAttemptCount: 0, cumulativeLearnedCardCount: 5});
  });
  it("rejects duplicate, malformed or inconsistent persisted distinct-card records", () => {
    const state = answer(createStudyState(cards));
    for (const ids of [["000001", "000001"], ["bad-id"], [], ["000001", "000002"]]) {
      const invalid = structuredClone(state);
      invalid.days["2026-09-19"].completedCardIds = ids;
      expect(() => validateStudyState(invalid, cards)).toThrow();
    }
  });

  it("separates adjacent knowledge points and preserves authored box order and the complete corpus", () => {
    const order = planLocalCards(cards);
    expect(order.every((card, index) => index === 0 ||
      card.space_metadata.box_ref !== order[index - 1].space_metadata.box_ref)).toBe(true);
    expect(order.map(card => card.card_id).sort()).toEqual(cards.map(card => card.card_id).sort());
    for (const box of new Set(cards.map(card => card.space_metadata.box_ref))) {
      expect(order.filter(card => card.space_metadata.box_ref === box).map(card => card.card_id))
        .toEqual(cards.filter(card => card.space_metadata.box_ref === box).map(card => card.card_id));
    }
  });
  it("keeps a completed group stable when an earlier card is paused", () => {
    const completed = finish(createStudyState(cards));
    const paused = reduceStudy(
      completed,
      { type: "sleep", id: completed.frame.ids[0] },
      cards,
      now
    );
    expect(paused.frame).toEqual(completed.frame);
    expect(paused.frame.complete).toBe(true);
    const next = reduceStudy(paused, { type: "continue" }, cards, now);
    expect(next.frame.index).toBe(0);
    expect(next.frame.ids.some((id) => completed.frame.ids.includes(id))).toBe(
      false
    );
  });
  it("skips only the paused active card and retains unrelated drafts", () => {
    let state = createStudyState(cards);
    state = reduceStudy(
      state,
      {
        type: "draft",
        draft: { ...state.frame.draft!, selectedOptionId: "b" },
      },
      cards,
      now
    );
    const untouched = reduceStudy(
      state,
      { type: "sleep", id: cards.at(-1)!.card_id },
      cards,
      now
    );
    expect(untouched.frame.draft).toEqual(state.frame.draft);
    const skipped = reduceStudy(
      untouched,
      { type: "sleep", id: state.frame.ids[0] },
      cards,
      now
    );
    expect(skipped.frame.index).toBe(1);
    expect(skipped.frame.draft?.selectedOptionId).toBeNull();
  });
  it("restores the unfinished learning draft after review and keeps a failed review pending", () => {
    let state = createStudyState(cards);
    state = answer(state, "b");
    state = reduceStudy(state, { type: "advance" }, cards, now);
    state = reduceStudy(
      state,
      {
        type: "draft",
        draft: {
          ...state.frame.draft!,
          selectedOptionId: "b",
          hasUsedHint: true,
          isHintVisible: true,
        },
      },
      cards,
      now
    );
    const original = structuredClone(state.frame);
    state = reduceStudy(state, { type: "review" }, cards, now);
    state = finish(state, "b");
    expect(pendingStudyIds(state, cards, now)).toHaveLength(1);
    state = reduceStudy(state, { type: "continue" }, cards, now);
    expect(state.frame).toEqual(original);
  });
  it("does not count duplicate submissions and separates daily attempts from lifetime coverage", () => {
    let state = answer(createStudyState(cards));
    const duplicate = answer(state);
    expect(duplicate).toBe(state);
    expect(studyDay(state, now).learning).toBe(1);
    expect(
      pendingStudyIds(state, cards, new Date(now.getTime() + 86400001))
    ).toHaveLength(1);
    state = reduceStudy(
      state,
      { type: "review" },
      cards,
      new Date(now.getTime() + 86400001)
    );
    state = answer(state, "a", new Date(now.getTime() + 86400001));
    expect(state.results).toHaveLength(1);
    expect(studyDay(state, new Date(now.getTime() + 86400001)).review).toBe(1);
    expect(studyDay(state, now).learning).toBe(1);
  });
  it("preserves the full review return frame through save and reload", async () => {
    const f = fixture(),
      store = f.store();
    await store.load();
    let state = answer(createStudyState(cards), "b");
    state = reduceStudy(state, { type: "advance" }, cards, now);
    state = reduceStudy(
      state,
      {
        type: "draft",
        draft: { ...state.frame.draft!, selectedOptionId: "b" },
      },
      cards,
      now
    );
    state = reduceStudy(state, { type: "review" }, cards, now);
    await store.save(state);
    expect((await f.store().load()).state).toEqual(state);
  });
  it("backs up damaged records before reset and allows restoration from a valid exported backup", async () => {
    const f = fixture(),
      store = f.store();
    await store.load();
    const state = finish(createStudyState(cards));
    await store.save(state);
    const backup = await store.backup();
    f.values.set(store.key, "{broken");
    const corrupt = f.store();
    await expect(corrupt.load()).rejects.toMatchObject({ kind: "invalid" });
    expect(await corrupt.backup()).toContain("{broken");
    await corrupt.reset();
    expect(
      [...f.values.entries()].some(
        ([key, raw]) => key.includes("/archive/") && raw === "{broken"
      )
    ).toBe(true);
    await corrupt.restore(backup);
    expect((await f.store().load()).state).toEqual(state);
  });
  it("migrates identical cards but archives and excludes changed card results", async () => {
    const f = fixture(),
      v1 = f.store();
    await v1.load();
    const state = finish(createStudyState(cards));
    await v1.save(state);
    const unchanged = await f.store("v2").load();
    expect(unchanged.state.results).toEqual(state.results);
    const changed = structuredClone(cards);
    changed.find(
      (card) => card.card_id === state.results[0].cardId
    )!.front.prompt = "Changed task";
    const next = await f.store("v2", changed).load();
    expect(next.state.results).toHaveLength(4);
    expect(next.notice).toContain("备份");
    expect([...f.values.keys()].some((key) => key.includes("/archive/"))).toBe(
      true
    );
  });
  it("retains legacy cumulative cards when content changes without guessing daily history", async () => {
    const f = fixture(), oldStore = f.store();
    await oldStore.load();
    const old = finish(createStudyState(cards));
    delete old.learnedCardIds;
    delete old.days["2026-09-19"].completedCardIds;
    await oldStore.save(old);
    const learnedIds = old.results.map(result => result.cardId);
    const changedCards = cards.map(card => learnedIds.includes(card.card_id)
      ? {...card, front: {...card.front, prompt: `${card.front.prompt} corrected`}}
      : card);
    const newStore = f.store("v2", changedCards);
    const migrated = (await newStore.load()).state;
    expect(migrated.results).toEqual([]);
    expect(new Set(migrated.learnedCardIds)).toEqual(new Set(learnedIds));
    expect(studyStatistics(migrated, "cet4", now)).toBeUndefined();
    const nextDay = new Date("2026-09-20T02:00:00Z");
    expect(studyStatistics(migrated, "cet4", nextDay)).toMatchObject({
      completedCardCount: 0, completedAttemptCount: 0, cumulativeLearnedCardCount: 5,
    });
    await newStore.save(migrated);
    const restored = (await f.store("v2", changedCards).load()).state;
    expect(studyStatistics(restored, "cet4", nextDay)?.cumulativeLearnedCardCount).toBe(5);
    const withoutOldCards = cards.filter(card => !learnedIds.includes(card.card_id));
    const later = (await f.store("v3", withoutOldCards).load()).state;
    expect(studyStatistics(later, "cet4", nextDay)?.cumulativeLearnedCardCount).toBe(5);
  });
  it("rejects malformed or duplicate retained cumulative card IDs", () => {
    for (const learnedCardIds of [["000001", "000001"], ["bad-id"]]) {
      expect(() => validateStudyState({...createStudyState(cards), learnedCardIds}, cards)).toThrow();
    }
  });
  it("refuses stale cross-window writes and foreign-track backup imports", async () => {
    const f = fixture(),
      first = f.store(),
      second = f.store();
    await first.load();
    await second.load();
    await first.save(answer(createStudyState(cards)));
    await expect(second.save(createStudyState(cards))).rejects.toMatchObject({
      kind: "conflict",
    });
    const other = f.store("v1", cards, "cet6");
    await other.load();
    await expect(other.restore(await first.backup())).rejects.toMatchObject({
      kind: "wrong_track",
    });
  });
  it("retries a failed save without replacing the existing record on failure", async () => {
    const f = fixture(),
      store = f.store();
    await store.load();
    const state = answer(createStudyState(cards));
    const write = f.storage.setItem;
    f.storage.setItem = () => {
      throw new Error("Quota");
    };
    await expect(store.save(state)).rejects.toMatchObject({
      kind: "unavailable",
    });
    expect(f.values.size).toBe(0);
    f.storage.setItem = write;
    await store.save(state);
    expect((await f.store().load()).state).toEqual(state);
  });
  it("rejects invalid card selections and extra credential fields", () => {
    const state = createStudyState(cards);
    expect(() =>
      validateStudyState({ ...state, accessToken: "never" }, cards)
    ).toThrow();
    expect(() =>
      validateStudyState(
        {
          ...state,
          frame: {
            ...state.frame,
            draft: {
              ...state.frame.draft,
              selectedOptionId: "invalid",
            } as LearningCardState,
          },
        },
        cards
      )
    ).toThrow();
  });
});
