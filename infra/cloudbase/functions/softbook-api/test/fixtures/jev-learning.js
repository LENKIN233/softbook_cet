const assert = require('node:assert/strict');
const {
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('./api');
const {
  ANSWER_EVIDENCE_ACCEPT,
  ANSWER_EVIDENCE_SCHEMA,
} = require('../../learning-answer-evidence');
const {JEV_POLICY, SKILLS} = require('../../jev-learning-advisor');
const prototype = require('./interaction-cards').cet4.find(
  (c) => c.interaction_id === 'multiple_choice',
);
const NOW = '2026-09-19T08:00:00.000Z';

function testSource(track = 'cet4') {
  if (track !== 'cet4') throw new Error('CET4 fixture only');
  const texts = [
    [
      'Although the plan was popular, it was rejected because it cost too much. Why was it rejected?',
      'It was popular.',
      'It cost too much.',
      'The although clause concedes popularity. The main clause gives cost as the reason for rejection.',
    ],
    [
      'The new route was shorter. However, people chose the old route because it was safer. Which route did people choose?',
      'The new route because it was shorter.',
      'The old route because it was safer.',
      'However contrasts the initial benefit with the actual choice in the second sentence.',
    ],
    [
      'What does sensible mean in: This is a sensible proposal?',
      'Sensitive to touch.',
      'Reasonable and practical.',
      'Sensible means reasonable in this context.',
    ],
    [
      'Although the train was fast, passengers preferred the bus because it was cheaper. Which did they prefer?',
      'The train because it was fast.',
      'The bus because it was cheaper.',
      'The although clause concedes speed; the main clause states the actual preference.',
    ],
  ];
  return validateCardSourceForImport(
    {
      source: {id: 'jev-synthetic-fixture', label: 'Jev 合成测试卡源'},
      track,
      release: null,
      card_records: texts.map(([prompt, wrong, correct, summary], index) => ({
        ...structuredClone(prototype),
        card_id: `05210${index + 1}`,
        front: {
          eyebrow: '合成测试',
          prompt,
          support: 'Choose the supported answer.',
          context: 'Synthetic fixture; use only the supplied material.',
        },
        options: [
          {id: 'wrong', label: 'A', text: wrong},
          {id: 'right', label: 'B', text: correct},
          {id: 'other_c', label: 'C', text: 'No answer was given.'},
          {
            id: 'other_d',
            label: 'D',
            text: 'None of the descriptions applies.',
          },
        ],
        answer_key: {correct_option: 'right'},
        analysis: {title: 'Synthetic reference', summary, exam_tip: summary},
      })),
    },
    track,
  );
}

function responseFor(request) {
  const answers = {};
  for (const name of Object.keys(request.questions)) {
    const text = name.startsWith('error_')
      ? request.state.attempts[Number(name.slice(6))]
      : request.state.candidates[Number(name.slice(10))];
    const choice = /although|however/i.test(text.front.prompt)
      ? 'contrast'
      : 'vocabulary';
    answers[name] = {
      type: 'choice',
      choice,
      confidence: 0.98,
      probabilities: Object.fromEntries(
        Object.keys(SKILLS).map((skill) => [
          skill,
          skill === choice ? 0.99 : 0.01 / (Object.keys(SKILLS).length - 1),
        ]),
      ),
    };
  }
  return {
    model: JEV_POLICY.model,
    answers,
    usage: {input_tokens: 1000, output_tokens: 50},
  };
}

async function setup({
  mode = 'rerank',
  fetchImpl,
  observe,
  capability = true,
  advisor,
} = {}) {
  let now = new Date(NOW);
  const calls = [];
  const store = createMemoryStore({developmentCardSource: testSource});
  const api = createSoftbookApi({
    store,
    now: () => new Date(now),
    runtimeMode: 'development',
    smsCode: '2468',
    tokenSecret: 'jev-test-secret',
    authV2IndexSecret: 'softbook-cloudbase-dev-secret',
    authV2AcknowledgementSleeper: async () => undefined,
    learningAdvisorEnv: {
      SOFTBOOK_JEV_MODE: mode,
      TYPESAFE_API_KEY: 'SYNTHETIC_TEST_KEY',
    },
    learningAdvisor: advisor,
    learningAdvisorObserver: observe,
    learningAdvisorFetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({url, body});
      return fetchImpl
        ? fetchImpl(body, options)
        : Response.json(responseFor(body));
    },
  });
  const request = (method, path, body, headers = {}, query = {}) =>
    api.handleHttpRequest({
      method,
      path,
      body,
      headers,
      query,
      clientIp: '127.0.0.1',
    });
  const challenge = await request('POST', '/v2/auth/request-code', {
    phone_number: '13800138000',
  });
  assert.equal(challenge.statusCode, 200, JSON.stringify(challenge.body));
  const auth = await request('POST', '/v2/auth/verify-code', {
    phone_number: '13800138000',
    challenge_id: challenge.body.data.challenge_id,
    sms_code: '2468',
  });
  assert.equal(auth.statusCode, 200, JSON.stringify(auth.body));
  const headers = {authorization: `Bearer ${auth.body.data.access_token}`};
  const read = (supported = capability) =>
    request(
      'GET',
      '/v2/learning/session',
      undefined,
      {...headers, ...(supported ? {accept: ANSWER_EVIDENCE_ACCEPT} : {})},
      {track: 'cet4'},
    );
  const source = testSource();
  let sequence = 0;
  const makeEvent = (selection) => ({
    event_id: `jev_test_event_${++sequence}`,
    selection_id: selection.selection_id,
    card_id: selection.card_id,
    interaction_id: 'multiple_choice',
    phase: selection.phase,
    outcome: 'incorrect',
    answer_grade: 'review_needed',
    used_hint: false,
    used_peek: false,
    client_occurred_at: now.toISOString(),
    content_version: source.content_version,
    device_cursor: {device_id: 'jev_test_device_0001', sequence},
    ...(selection.answer_evidence_schema_version
      ? {
          answer_evidence: {
            schema_version: ANSWER_EVIDENCE_SCHEMA,
            selected_option_id: 'wrong',
          },
        }
      : {}),
  });
  const submit = (event) =>
    request(
      'POST',
      '/v2/learning/events',
      {schema_version: 'learning-events.v2', track: 'cet4', events: [event]},
      headers,
    );
  const prime = async () => {
    for (let i = 0; i < 2; i++) {
      const result = await read();
      assert.equal(result.statusCode, 200, JSON.stringify(result.body));
      const accepted = await submit(makeEvent(result.body.data.selection));
      assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
    }
  };
  return {
    store,
    api,
    request,
    headers,
    source,
    read,
    makeEvent,
    submit,
    prime,
    calls,
    setNow: (value) => {
      now = new Date(value);
    },
  };
}

module.exports = {setup, testSource, responseFor, NOW};
