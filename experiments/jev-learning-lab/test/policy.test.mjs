import test from "node:test";
import assert from "node:assert/strict";
import { Rating } from "ts-fsrs";
import {
  baseSnapshot,
  scenarios,
  card,
  event,
} from "../fixtures/scenarios.mjs";
import {
  POLICY,
  prepare,
  makeRequest,
  ratingForEvent,
  digest,
} from "../src/policy.mjs";
import { evaluateSnapshot } from "../src/algorithm.mjs";
import { createFixtureProvider } from "../src/provider.mjs";
import { fixtureFor, runEvaluation } from "../src/evaluation.mjs";

test("each synthetic snapshot owns its evidence objects", () => {
  const a = baseSnapshot();
  const b = baseSnapshot();
  delete a.events[0].evidence.correctAnswer;
  assert.ok(b.events[0].evidence.correctAnswer);
});

for (const scenario of scenarios()) {
  test(`scenario: ${scenario.id}`, async () => {
    const before = digest(scenario.snapshot);
    const result = await evaluateSnapshot(scenario.snapshot, {
      provider: fixtureFor(scenario),
      mode: "rerank",
    });
    assert.equal(result.baselineCardId, scenario.expected.baseline);
    assert.equal(result.recommendedCardId, scenario.expected.recommended);
    assert.equal(result.selectedCardId, scenario.expected.recommended);
    assert.equal(result.reason, scenario.expected.reason);
    assert.equal(result.fsrsDigest, prepare(scenario.snapshot).fsrsDigest);
    assert.equal(digest(scenario.snapshot), before);
    assert.equal(result.learningEffectVerified, false);
    assert.equal(result.modelQualityVerified, false);
  });
}

test("shadow remains the default even when the recommendation changes", async () => {
  const snapshot = baseSnapshot();
  const result = await evaluateSnapshot(snapshot, {
    provider: createFixtureProvider(["contrast", "contrast"]),
  });
  assert.equal(result.recommendedCardId, "new_contrast");
  assert.equal(result.selectedCardId, "new_vocab");
});

test("no provider leaves a working deterministic baseline", async () => {
  const result = await evaluateSnapshot(baseSnapshot());
  assert.equal(result.reason, "no_provider");
  assert.equal(result.selectedCardId, "new_vocab");
});

test("event ratings follow the product mapping; Easy is never inferred", () => {
  assert.equal(ratingForEvent(event("a", "a")), Rating.Again);
  assert.equal(
    ratingForEvent(event("a", "a", { answerGrade: "passed" })),
    Rating.Good
  );
  assert.equal(
    ratingForEvent(event("a", "a", { answerGrade: "passed", usedHint: true })),
    Rating.Hard
  );
  assert.equal(
    ratingForEvent(event("a", "a", { answerGrade: "passed", usedPeek: true })),
    Rating.Hard
  );
});

test("duplicate delivery neither updates memory twice nor creates a second evidence source", async () => {
  const s = baseSnapshot();
  s.events = [s.events[0]];
  const initial = prepare(s).fsrsDigest;
  s.events.push(structuredClone(s.events[0]));
  const result = await evaluateSnapshot(s, {
    provider: createFixtureProvider(["contrast", "contrast"]),
  });
  assert.equal(result.fsrsDigest, initial);
  assert.equal(result.reason, "insufficient_evidence");
});

test("same-card repeated errors are one independent evidence source", async () => {
  const s = baseSnapshot();
  s.events[1] = {
    ...s.events[0],
    id: "second",
    acceptedAt: "2026-09-19T08:00:10.000Z",
  };
  const result = await evaluateSnapshot(s, {
    provider: createFixtureProvider(["contrast", "contrast"]),
  });
  assert.equal(result.reason, "insufficient_evidence");
});

test("property-order changes in an exact duplicate do not alter replay", () => {
  const s = baseSnapshot();
  const before = prepare(s).fsrsDigest;
  s.events.push(Object.fromEntries(Object.entries(s.events[0]).reverse()));
  assert.equal(prepare(s).fsrsDigest, before);
});

const invalid = [
  ["cross-track event", (s) => (s.events[0].track = "cet6")],
  [
    "stale content event",
    (s) => (s.events[0].contentVersion = "previous-version"),
  ],
  [
    "future event",
    (s) => (s.events[0].acceptedAt = "2027-01-01T00:00:00.000Z"),
  ],
  [
    "conflicting replay",
    (s) => s.events.push({ ...s.events[0], usedHint: true }),
  ],
  ["wrong card scope", (s) => (s.cards[0].track = "cet6")],
  ["absent eligibility", (s) => delete s.cards[0].allowed],
  ["non-boolean eligibility", (s) => (s.cards[0].allowed = "yes")],
  ["duplicate card ID", (s) => s.cards.push(structuredClone(s.cards[0]))],
  ["unknown skill", (s) => (s.cards[0].skills = ["carelessness"])],
  ["incomplete reference", (s) => delete s.events[0].evidence.correctAnswer],
  ["contradictory evidence", (s) => (s.events[0].answerGrade = "passed")],
  ["production data", (s) => (s.environment = "production")],
  ["non-synthetic data", (s) => (s.dataSource = "customer")],
  [
    "unordered acceptance",
    (s) => {
      s.events[0].acceptedAt = "2026-09-19T08:00:10.000Z";
    },
  ],
];
for (const [name, mutate] of invalid)
  test(`rejects ${name} before any model call`, async () => {
    const s = baseSnapshot();
    mutate(s);
    let called = false;
    await assert.rejects(
      evaluateSnapshot(s, {
        provider: {
          kind: "test",
          async evaluate() {
            called = true;
          },
        },
      })
    );
    assert.equal(called, false);
  });

test("snapshot mutation while the provider runs cannot alter the decision", async () => {
  const s = baseSnapshot();
  const provider = createFixtureProvider(["contrast", "contrast"]);
  const result = await evaluateSnapshot(s, {
    mode: "rerank",
    provider: {
      kind: "fixture",
      async evaluate(request) {
        s.events[0].cardId = "unknown";
        s.cards[1].id = "injected";
        return provider.evaluate(request);
      },
    },
  });
  assert.equal(result.selectedCardId, "new_contrast");
});

test("old rich evidence expires even when memory remains", async () => {
  const s = baseSnapshot();
  s.now = "2026-11-19T08:00:30.000Z";
  const result = await evaluateSnapshot(s, {
    provider: createFixtureProvider(["contrast", "contrast"]),
  });
  assert.equal(result.reason, "insufficient_evidence");
});

test("hidden or sleeping history cannot produce weakness evidence", async () => {
  for (const field of ["allowed", "sleeping"]) {
    const s = baseSnapshot();
    s.cards.find((c) => c.id === "error_a")[field] = field === "sleeping";
    const result = await evaluateSnapshot(s, {
      provider: createFixtureProvider(["contrast", "contrast"]),
    });
    assert.equal(result.reason, "insufficient_evidence");
  }
});

test("a later due card cannot overtake an earlier due card", async () => {
  const s = scenarios().find((c) => c.id === "due_tie").snapshot;
  s.events[1].acceptedAt = "2026-09-01T09:00:00.000Z";
  const result = await evaluateSnapshot(s, {
    provider: createFixtureProvider(["contrast", "contrast"]),
    mode: "rerank",
  });
  assert.deepEqual(result.candidateIds, ["due_vocab"]);
  assert.equal(result.selectedCardId, "due_vocab");
});

test("future review cards never enter the pool before due time", async () => {
  const s = baseSnapshot();
  s.cards = s.cards.filter((c) => c.id.startsWith("error_"));
  const result = await evaluateSnapshot(s, {
    provider: createFixtureProvider(["contrast", "contrast"]),
  });
  assert.equal(result.selectedCardId, null);
  assert.equal(result.reason, "no_eligible_card");
  assert.ok(Date.parse(result.nextDueAt) > Date.parse(s.now));
});

test("candidate shortlist is bounded and respects canonical catalog order", () => {
  const s = baseSnapshot();
  for (let i = 20; i < 45; i++)
    s.cards.push(card(`extra_${i}`, i, ["contrast"]));
  const c = prepare(s);
  assert.equal(c.candidates.length, POLICY.maxCandidates);
  assert.equal(c.candidates[0].id, "new_vocab");
});

test("expired-scope cursor is not reused", () => {
  const s = baseSnapshot();
  s.cursor = {
    cardId: "new_inference",
    track: "cet6",
    contentVersion: s.contentVersion,
  };
  assert.equal(prepare(s).baseline.id, "new_vocab");
});

test("request is allowlisted and excludes user identity, expected labels, and raw log fields", () => {
  const s = baseSnapshot();
  s.phone = "13800138000";
  s.events[0].accessToken = "SECRET_TEST";
  s.expectedSkill = "SECRET_LABEL";
  const body = JSON.stringify(makeRequest(prepare(s)));
  assert.ok(!body.includes("13800138000"));
  assert.ok(!body.includes("SECRET_TEST"));
  assert.ok(!body.includes("SECRET_LABEL"));
  assert.ok(!body.includes("new_contrast"));
});

const badAnswers = [
  ["unknown choice", (r) => (r.answers.error_0.choice = "foreign_card")],
  ["missing answer", (r) => delete r.answers.error_0],
  ["extra answer", (r) => (r.answers.extra = r.answers.error_0)],
  ["wrong model", (r) => (r.model = "jev-latest")],
  ["nonfinite confidence", (r) => (r.answers.error_0.confidence = NaN)],
  [
    "wrong distribution",
    (r) => (r.answers.error_0.probabilities.contrast = 0.2),
  ],
  [
    "mismatched maximum",
    (r) => (r.answers.error_0.choice = "insufficient_evidence"),
  ],
  [
    "negative probability",
    (r) => (r.answers.error_0.probabilities.vocabulary = -1),
  ],
];
for (const [name, mutate] of badAnswers)
  test(`falls back on ${name}`, async () => {
    const canned = createFixtureProvider(["contrast", "contrast"]);
    const result = await evaluateSnapshot(baseSnapshot(), {
      mode: "rerank",
      provider: {
        kind: "fixture",
        async evaluate(request) {
          const r = await canned.evaluate(request);
          mutate(r.response);
          return r;
        },
      },
    });
    assert.equal(result.status, "fallback");
    assert.equal(result.reason, "invalid_model_response");
    assert.equal(result.selectedCardId, "new_vocab");
  });

test("insufficient evidence labels are abstentions, not a weakness", async () => {
  const r = await evaluateSnapshot(baseSnapshot(), {
    provider: createFixtureProvider([
      "insufficient_evidence",
      "insufficient_evidence",
    ]),
  });
  assert.equal(r.weaknesses.length, 0);
  assert.equal(r.reason, "insufficient_supported_weakness");
});

test("passing fixture evaluations never claims model quality or live access", async () => {
  const r = await runEvaluation();
  assert.equal(r.contractChecksPassed, true);
  assert.equal(r.liveStatus, "not_run");
  assert.equal(r.modelQuality.accuracy, null);
  assert.equal(r.realModelCallsCompleted, 0);
  assert.equal(r.learningEffectVerified, false);
});

test("API failure cannot be reported as a successful live evaluation", async () => {
  const r = await runEvaluation({
    providerKind: "jev",
    provider: createFixtureProvider([], { failure: "missing_api_key" }),
  });
  assert.equal(r.liveStatus, "incomplete");
  assert.equal(r.modelQuality.status, "not_verified");
  assert.equal(r.realModelCallsCompleted, 0);
});
