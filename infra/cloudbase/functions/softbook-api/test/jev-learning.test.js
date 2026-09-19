const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {setup, responseFor, NOW} = require('./fixtures/jev-learning');
const {
  createJevLearningAdvisor,
  buildAdvisorInput,
  JEV_POLICY,
} = require('../jev-learning-advisor');

test('a stalled HTTP body reaches the deadline and falls back to a usable product selection', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write('{');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const t = await setup({fetchImpl: (_body, options) => fetch(`http://127.0.0.1:${server.address().port}`, options)});
    await t.prime();
    const started = Date.now();
    const result = await t.read();
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data.selection.card_id, '052103');
    assert.ok(Date.now() - started < JEV_POLICY.timeoutMs + 1500);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('real product event/session chain ranks canonical content and preserves FSRS', async () => {
  const telemetry = [];
  const t = await setup({observe: (x) => telemetry.push(x)});
  await t.prime();
  const before = JSON.stringify([
    ...t.store.snapshot().learningStates.values(),
  ]);
  const res = await t.read();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.selection.card_id, '052104');
  assert.equal(t.calls.length, 1);
  assert.equal(
    JSON.stringify([...t.store.snapshot().learningStates.values()]),
    before,
  );
  assert.equal(
    (await t.read()).body.data.selection.selection_id,
    res.body.data.selection.selection_id,
  );
  assert.equal(t.calls.length, 1);
  const body = JSON.stringify(t.calls[0].body);
  assert.ok(!body.includes('13800138000'));
  assert.ok(!body.includes('jev_test_device'));
  assert.ok(!body.includes('SYNTHETIC_TEST_KEY'));
  assert.ok(telemetry.some((x) => x.status === 'evaluated'));
  assert.ok(!JSON.stringify(telemetry).includes('13800138000'));
});

test('shadow computes advice but preserves canonical baseline', async () => {
  const t = await setup({mode: 'shadow'});
  await t.prime();
  assert.equal((await t.read()).body.data.selection.card_id, '052103');
  assert.equal(t.calls.length, 1);
});

test('off switch does not contact Jev', async () => {
  const t = await setup({mode: 'off'});
  await t.prime();
  assert.equal((await t.read()).body.data.selection.card_id, '052103');
  assert.equal(t.calls.length, 0);
});

test('old clients receive legacy DTO and submit unchanged payloads', async () => {
  const t = await setup({capability: false});
  const res = await t.read();
  assert.ok(
    !Object.hasOwn(res.body.data.selection, 'answer_evidence_schema_version'),
  );
  assert.ok(
    !Object.hasOwn(t.makeEvent(res.body.data.selection), 'answer_evidence'),
  );
  await t.prime();
  assert.equal((await t.read()).body.data.selection.card_id, '052103');
  assert.equal(t.calls.length, 0);
});

test('canonical option and outcome checks reject forged evidence without changing cursor', async () => {
  const t = await setup();
  const first = (await t.read()).body.data.selection;
  const event = t.makeEvent(first);
  for (const evidence of [
    null,
    {
      schema_version: 'learning-answer-evidence.v2',
      selected_option_id: 'wrong',
    },
    {
      schema_version: 'learning-answer-evidence.v1',
      selected_option_id: 'invented',
    },
    {
      schema_version: 'learning-answer-evidence.v1',
      selected_option_id: 'right',
    },
    {...event.answer_evidence, phone_number: '13800138000'},
  ]) {
    const result = await t.submit({...event, answer_evidence: evidence});
    assert.equal(result.statusCode, 400, JSON.stringify(result.body));
    assert.equal(
      (await t.read()).body.data.selection.selection_id,
      first.selection_id,
    );
  }
  assert.equal((await t.submit(event)).statusCode, 200);
  const before = JSON.stringify([
    ...t.store.snapshot().learningStates.values(),
  ]);
  assert.equal(
    (await t.submit(event)).body.data.results[0].status,
    'duplicate',
  );
  const changed = await t.submit({
    ...event,
    answer_evidence: {...event.answer_evidence, selected_option_id: 'right'},
  });
  assert.equal(changed.statusCode, 409);
  assert.equal(changed.body.error.code, 'learning_event_id_conflict');
  assert.equal(
    JSON.stringify([...t.store.snapshot().learningStates.values()]),
    before,
  );
});

for (const status of [401, 429, 500])
  test(`HTTP ${status} falls back without invalidating the learner session`, async () => {
    const t = await setup({
      fetchImpl: async () => new Response('PRIVATE_DIAGNOSTIC', {status}),
    });
    await t.prime();
    const result = await t.read();
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data.selection.card_id, '052103');
    assert.ok(!JSON.stringify(result).includes('PRIVATE_DIAGNOSTIC'));
  });

test('low confidence and inconsistent responses fall back', async () => {
  for (const mutate of [
    (r) => {
      Object.values(r.answers).forEach((a) => (a.confidence = 0.2));
    },
    (r) => {
      r.model = 'unknown';
    },
    (r) => {
      r.answers.error_0.choice = 'foreign_card';
    },
  ]) {
    const t = await setup({
      fetchImpl: async (body) => {
        const r = responseFor(body);
        mutate(r);
        return Response.json(r);
      },
    });
    await t.prime();
    assert.equal((await t.read()).body.data.selection.card_id, '052103');
  }
});

test('model delay cannot put new cards before newly due reviews', async () => {
  let t;
  t = await setup({
    fetchImpl: async (body) => {
      t.setNow('2026-09-19T08:11:00.000Z');
      return Response.json(responseFor(body));
    },
  });
  await t.prime();
  const result = await t.read();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.data.selection.phase, 'review');
  assert.equal(result.body.data.selection.card_id, '052101');
  assert.equal(t.calls.length, 1);
});

test('sleep during inference discards advice and respects the latest space state', async () => {
  let t;
  t = await setup({
    fetchImpl: async (body) => {
      const r = await t.request(
        'POST',
        '/v2/space/actions',
        {
          schema_version: 'space-actions.v2',
          track: 'cet4',
          content_version: t.source.content_version,
          actions: [
            {
              action_id: 'jev_sleep_action_0001',
              dimension: 'sleep',
              value: true,
              client_occurred_at: NOW,
              card_id: '052104',
            },
          ],
        },
        t.headers,
      );
      assert.equal(r.statusCode, 200, JSON.stringify(r.body));
      return Response.json(responseFor(body));
    },
  });
  await t.prime();
  const result = await t.read();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.data.selection.card_id, '052103');
  assert.ok(
    [...t.store.snapshot().spaceStates.values()].some(
      (s) => s.states_by_card_id?.['052104']?.is_sleeping === true,
    ),
  );
});

test('simultaneous session reads converge on one persisted selection', async () => {
  const t = await setup();
  await t.prime();
  const results = await Promise.all([t.read(), t.read()]);
  results.forEach((r) =>
    assert.equal(r.statusCode, 200, JSON.stringify(r.body)),
  );
  assert.equal(
    results[0].body.data.selection.selection_id,
    results[1].body.data.selection.selection_id,
  );
  assert.equal(t.calls.length, 1);
});

test('space mutation after revalidation is rejected by the atomic cursor guard', async () => {
  const t = await setup();
  await t.prime();
  const save = t.store.saveLearningSessionCursor;
  let mutated = false;
  t.store.saveLearningSessionCursor = async (input) => {
    if (input.selectionGuard && !mutated) {
      mutated = true;
      const response = await t.request(
        'POST',
        '/v2/space/actions',
        {
          schema_version: 'space-actions.v2',
          track: 'cet4',
          content_version: t.source.content_version,
          actions: [
            {
              action_id: 'jev_sleep_commit_race',
              dimension: 'sleep',
              value: true,
              client_occurred_at: NOW,
              card_id: '052104',
            },
          ],
        },
        t.headers,
      );
      assert.equal(response.statusCode, 200);
    }
    return save(input);
  };
  const result = await t.read();
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.selection.card_id, '052103');
  assert.equal(t.calls.length, 1);
  assert.equal(mutated, true);
});

test('single-flight and bounded cache do not cross account identity', async () => {
  // Capture an input from the actual product scheduler, without bypassing evidence validation.
  let input;
  const t = await setup({
    advisor: {
      mode: 'shadow',
      async recommend(value) {
        input = value;
        return null;
      },
    },
  });
  await t.prime();
  await t.read();
  let calls = 0;
  const advisor = createJevLearningAdvisor({
    env: {SOFTBOOK_JEV_MODE: 'rerank', TYPESAFE_API_KEY: 'TEST'},
    fetchImpl: async (_url, options) => {
      calls++;
      return Response.json(responseFor(JSON.parse(options.body)));
    },
  });
  const [a, b] = await Promise.all([
    advisor.recommend(input),
    advisor.recommend(input),
  ]);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  await advisor.recommend(input);
  assert.equal(calls, 1);
  await advisor.recommend({...input, accountKey: 'a-different-account'});
  assert.equal(calls, 2);
});

test('missing credentials and transport exceptions never block baseline selection', async () => {
  for (const env of [
    {SOFTBOOK_JEV_MODE: 'rerank'},
    {SOFTBOOK_JEV_MODE: 'rerank', TYPESAFE_API_KEY: 'TEST'},
  ]) {
    const advisor = createJevLearningAdvisor({
      env,
      fetchImpl: () => {
        throw new Error('DO_NOT_LEAK_SECRET');
      },
    });
    const t = await setup({advisor});
    await t.prime();
    assert.equal((await t.read()).body.data.selection.card_id, '052103');
  }
});
