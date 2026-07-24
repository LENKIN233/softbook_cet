#!/usr/bin/env node

import http from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {
  createMemoryStore,
  validateCardSourceForImport,
} = require('./functions/softbook-api/index.js');
const {
  createDailyCheckInV2Service,
} = require('./functions/softbook-api/daily-check-in-v2.js');
const {
  createLearningEventsV2Service,
} = require('./functions/softbook-api/learning-events-v2.js');
const {
  createLearningSchedulerV1Service,
} = require('./functions/softbook-api/learning-scheduler-v1.js');

const port = Number(process.env.PORT || 48731);
const host = process.env.HOST || '127.0.0.1';
const smsCode = process.env.SOFTBOOK_CET_TEST_CODE || '123456';
const challenges = new Map();
const sessions = new Map();
const memberships = new Map();
const spaceStates = new Map();
const learningEventsStore = createMemoryStore();
const dailyCheckInService = createDailyCheckInV2Service({
  now: () => new Date(),
  store: learningEventsStore,
});
const learningEventsService = createLearningEventsV2Service({
  now: () => new Date(),
  runtimeMode: 'development',
  store: learningEventsStore,
});
const learningSchedulerService = createLearningSchedulerV1Service({
  now: () => new Date(),
  runtimeMode: 'development',
  store: learningEventsStore,
});
let sequence = 0;

const server = http.createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    sendJson(response, statusFromError(error), {
      error: {
        code: error?.code ?? 'mock_request_failed',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

server.listen(port, host, () => {
  console.log(`Mock Softbook remote listening on http://${host}:${port}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});

async function route(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const path = url.pathname;
  const method = request.method || 'GET';

  if (method === 'POST' && path === '/v2/auth/request-code') {
    const body = await readJson(request);
    const phoneNumber = requireString(body.phone_number, 'phone_number');
    const challengeId = `mock-challenge-${++sequence}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    challenges.set(challengeId, {expiresAt, phoneNumber});
    sendJson(response, 200, {
      data: {
        challenge_id: challengeId,
        delivery: 'mock_sms',
        expires_at: expiresAt,
        retry_after_seconds: 60,
      },
    });
    return;
  }

  if (method === 'POST' && path === '/v2/auth/verify-code') {
    const body = await readJson(request);
    const challengeId = requireString(body.challenge_id, 'challenge_id');
    const phoneNumber = requireString(body.phone_number, 'phone_number');
    const submittedCode = requireString(body.sms_code, 'sms_code');
    const challenge = challenges.get(challengeId);

    if (
      !challenge ||
      challenge.phoneNumber !== phoneNumber ||
      Date.parse(challenge.expiresAt) <= Date.now() ||
      submittedCode !== smsCode
    ) {
      sendJson(response, 401, {error: {code: 'invalid_sms_challenge'}});
      return;
    }

    challenges.delete(challengeId);
    const session = createSession(phoneNumber);
    sessions.set(session.sessionId, session);
    sendJson(response, 200, {data: sessionPayload(session)});
    return;
  }

  if (method === 'POST' && path === '/v2/auth/refresh') {
    const body = await readJson(request);
    const refreshToken = requireString(body.refresh_token, 'refresh_token');
    const session = [...sessions.values()].find(
      candidate => candidate.refreshToken === refreshToken && candidate.active,
    );

    if (!session) {
      sendJson(response, 401, {error: {code: 'invalid_refresh_token'}});
      return;
    }

    session.rotation += 1;
    session.accessToken = `softbook_v2.mock.${session.sessionId}.${session.rotation}`;
    session.refreshToken = `softbook_refresh.mock.${session.sessionId}.${session.rotation}`;
    sendJson(response, 200, {data: sessionPayload(session)});
    return;
  }

  if (method === 'POST' && path === '/v2/auth/logout') {
    const session = requireBearerToken(request);
    session.active = false;
    response.writeHead(204);
    response.end();
    return;
  }

  if (
    method === 'POST' &&
    (path === '/v1/progress/daily-sync' ||
      path === '/v1/learning/state-sync')
  ) {
    sendJson(response, 410, {
      error: {
        code: 'legacy_snapshot_write_disabled',
        message: 'Legacy daily and learning snapshot writes are disabled.',
      },
    });
    return;
  }

  const session = requireBearerToken(request);

  if (method === 'POST' && path === '/v2/progress/check-in') {
    const body = await readJson(request);
    const data = await dailyCheckInService.checkIn({
      request: {body},
      session,
    });
    sendJson(response, 200, {data});
    return;
  }

  if (method === 'POST' && path === '/v2/learning/events') {
    const body = await readJson(request);
    const data = await learningEventsService.submit({
      request: {
        body,
        query: Object.fromEntries(url.searchParams.entries()),
      },
      session,
    });
    sendJson(response, 200, {data});
    return;
  }

  if (method === 'GET' && path === '/v2/learning/session') {
    const track = url.searchParams.get('track');

    if (track !== 'cet4' && track !== 'cet6') {
      sendJson(response, 400, {error: {code: 'invalid_track'}});
      return;
    }

    if (url.searchParams.has('phone_number')) {
      sendJson(response, 400, {
        error: {code: 'learning_session_authority_input_forbidden'},
      });
      return;
    }

    const data = await learningSchedulerService.read({
      accountKey: session.accountKey,
      phoneNumber: session.phoneNumber,
      track,
    });
    sendJson(response, 200, {data});
    return;
  }

  if (method === 'GET' && path === '/v2/bootstrap') {
    const track = url.searchParams.get('track');
    const dayKey = url.searchParams.get('day_key');

    if (track !== 'cet4' && track !== 'cet6') {
      sendJson(response, 400, {error: {code: 'invalid_track'}});
      return;
    }

    if (!isValidDayKey(dayKey)) {
      sendJson(response, 400, {error: {code: 'invalid_day_key'}});
      return;
    }

    if (url.searchParams.has('phone_number')) {
      sendJson(response, 400, {
        error: {code: 'bootstrap_identity_input_forbidden'},
      });
      return;
    }

    sendJson(
      response,
      200,
      bootstrapPayload(session.phoneNumber, track, dayKey),
    );
    return;
  }

  if (method === 'GET' && path === '/v1/learning/card-source') {
    const track = url.searchParams.get('track') || 'cet4';

    if (track !== 'cet4' && track !== 'cet6') {
      sendJson(response, 400, {error: 'track must be cet4 or cet6'});
      return;
    }

    const cardSource = getMockCardSource(track);

    sendJson(response, 200, {
      data: {
        source: cardSource.source,
        track,
        card_records: cardSource.card_records,
        content_version: cardSource.content_version,
      },
    });
    return;
  }

  if (method === 'GET' && path === '/v1/membership/entitlement') {
    sendJson(
      response,
      200,
      entitlementPayload(getMembership(session.phoneNumber)),
    );
    return;
  }

  if (method === 'POST' && path === '/v1/membership/start-trial') {
    const body = await readJson(request);
    assertSessionPhone(body, session);
    const membership = createMembership('trial');
    memberships.set(session.phoneNumber, {
      acknowledged_at: new Date().toISOString(),
      entitlement: membership,
    });
    sendJson(response, 200, entitlementPayload(membership));
    return;
  }

  if (method === 'POST' && path === '/v1/membership/purchase') {
    const body = await readJson(request);
    assertSessionPhone(body, session);
    const membership = createMembership('premium');
    memberships.set(session.phoneNumber, {
      acknowledged_at: new Date().toISOString(),
      entitlement: membership,
    });
    sendJson(response, 200, entitlementPayload(membership));
    return;
  }

  if (method === 'POST' && path === '/v1/membership/dismiss-recovery') {
    const body = await readJson(request);
    assertSessionPhone(body, session);
    const membership = createMembership('free', false, 'trial');
    memberships.set(session.phoneNumber, {
      acknowledged_at: new Date().toISOString(),
      entitlement: membership,
    });
    sendJson(response, 200, entitlementPayload(membership));
    return;
  }

  if (method === 'POST' && path === '/v1/space/state-sync') {
    const body = await readJson(request);
    assertSessionPhone(body, session);
    const acknowledgedAt = new Date().toISOString();
    const existing = spaceStates.get(session.phoneNumber) ?? {
      states_by_card_id: {},
    };
    const statesByCardId = {...existing.states_by_card_id};

    for (const state of body.states ?? []) {
      statesByCardId[state.card_id] = {...state};
    }

    spaceStates.set(session.phoneNumber, {
      acknowledged_at: acknowledgedAt,
      day_key: body.day_key,
      states_by_card_id: statesByCardId,
    });
    sendJson(response, 200, {data: {acknowledged_at: acknowledgedAt}});
    return;
  }

  sendJson(response, 404, {error: `No mock route for ${method} ${path}`});
}

function requireBearerToken(request) {
  const authorization = request.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const session = [...sessions.values()].find(
    candidate => candidate.accessToken === accessToken && candidate.active,
  );

  if (!session) {
    const error = new Error('Missing or invalid Authorization bearer token.');
    error.status = 401;
    throw error;
  }

  return session;
}

function createSession(phoneNumber) {
  const sessionId = `mock-session-${++sequence}`;

  return {
    accountKey: createHash('sha256')
      .update(`mock-account:${phoneNumber}`)
      .digest('hex'),
    accessToken: `softbook_v2.mock.${sessionId}.0`,
    active: true,
    phoneNumber,
    refreshExpiresAt: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    refreshToken: `softbook_refresh.mock.${sessionId}.0`,
    rotation: 0,
    sessionId,
  };
}

function sessionPayload(session) {
  return {
    access_token: session.accessToken,
    expires_in: 900,
    phone_number: session.phoneNumber,
    refresh_expires_at: session.refreshExpiresAt,
    refresh_token: session.refreshToken,
    session_id: session.sessionId,
    token_type: 'Bearer',
  };
}

function createMembership(
  stage,
  recoveryPromptVisible = false,
  lastExperienceEndedBy = null,
) {
  return {
    stage,
    counted_entry_count: stage === 'trial_available' ? 0 : 1,
    last_experience_ended_by: lastExperienceEndedBy,
    recovery_prompt_visible: recoveryPromptVisible,
    trial_duration_days: 5,
    trial_started_at_entry_count:
      stage === 'trial' || stage === 'premium' ? 1 : null,
  };
}

function getMembership(phoneNumber) {
  return (
    memberships.get(phoneNumber)?.entitlement ??
    createMembership('trial_available')
  );
}

function entitlementPayload(membership) {
  return {
    data: {
      entitlement: {...membership},
    },
  };
}

function bootstrapPayload(phoneNumber, track, dayKey) {
  const accountKey = accountKeyForPhone(phoneNumber);
  const cardSource = getMockCardSource(track);
  const progress = learningEventsStore.getDailyProgress(phoneNumber, dayKey, {
    accountKey,
  });
  const learning = learningEventsStore.getLearningState(
    phoneNumber,
    dayKey,
    track,
    {accountKey},
  );
  const space = spaceStates.get(phoneNumber);

  return {
    data: {
      schema_version: 'bootstrap.v2',
      generated_at: new Date().toISOString(),
      day_key: dayKey,
      track,
      content: {
        card_count: cardSource.card_records.length,
        release_id: null,
        minimum_client_version: null,
        parent_release_id: null,
        published_at: null,
        source: cardSource.source,
        version: cardSource.content_version,
      },
      learning: {
        acknowledged_at: learning.acknowledged_at ?? null,
        card_states: Object.values(learning.events_by_card_id ?? {}).sort(
          (left, right) => left.card_id.localeCompare(right.card_id),
        ),
        cursor: learning.cursor ?? null,
        source: learning.source_id
          ? {id: learning.source_id, label: learning.source_label}
          : null,
      },
      membership: {
        acknowledged_at: memberships.get(phoneNumber)?.acknowledged_at ?? null,
        ...getMembership(phoneNumber),
      },
      progress,
      space: {
        acknowledged_at: space?.acknowledged_at ?? null,
        day_key: dayKey,
        states: Object.values(space?.states_by_card_id ?? {}).sort(
          (left, right) => left.card_id.localeCompare(right.card_id),
        ),
      },
    },
  };
}

function accountKeyForPhone(phoneNumber) {
  return createHash('sha256')
    .update(`mock-account:${phoneNumber}`)
    .digest('hex');
}

function getMockCardSource(track) {
  const cardSources = learningEventsStore.snapshot().cardSources;

  if (!cardSources.has(track)) {
    cardSources.set(
      track,
      validateCardSourceForImport(
        {
          card_records: createCardRecords(track),
          release: null,
          source: {
            id: `mock-${track}-source`,
            label: `Mock ${track.toUpperCase()} Source`,
          },
          track,
        },
        track,
      ),
    );
  }

  return cardSources.get(track);
}

function assertSessionPhone(body, session) {
  if (body.phone_number !== session.phoneNumber) {
    const error = new Error('phone_number must match active session.');
    error.status = 403;
    throw error;
  }
}

function isValidDayKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function createCardRecords(track) {
  return [
    {
      card_id: '100101',
      track,
      knowledge_ref: '1001',
      interaction_id: 'flip',
      front: {
        eyebrow: 'CET listening transition',
        prompt: 'however',
        support: '判断转折词在听力语境中的作用。',
        context:
          'The report was detailed; however, it missed the core argument.',
      },
      analysis: {
        title: 'however marks contrast',
        summary: 'however 表示转折，常用于连接两个方向相反的判断。',
        exam_tip: '听力中先抓转折，再判断说话人真正态度。',
      },
      hint_layer: {
        label: '看转折',
        content: '听到 however 后，后半句通常是得分关键。',
        reveal_gesture: '下滑',
      },
      space_metadata: {
        box_ref: '1001',
        library: '听力',
        group: '转折信号',
        box: 'however / nevertheless',
      },
      back_text: 'however = 然而，用于提示后半句和前半句形成反差。',
    },
    {
      card_id: '100201',
      track,
      knowledge_ref: '1002',
      interaction_id: 'multiple_choice',
      front: {
        eyebrow: 'CET reading collocation',
        prompt: 'Choose the best collocation.',
        support: 'The article offers a ____ explanation.',
        context: '优先选能和 explanation 搭配的形容词。',
      },
      analysis: {
        title: 'compelling explanation',
        summary: 'compelling explanation 表示有说服力的解释。',
        exam_tip: '阅读选词常考高频搭配，不只看单词中文意思。',
      },
      hint_layer: {
        label: '看搭配',
        content: '先找名词 explanation，再判断哪个形容词最自然。',
        reveal_gesture: '下滑',
      },
      auto_scoring: true,
      space_metadata: {
        box_ref: '1002',
        library: '阅读',
        group: '高频搭配',
        box: 'academic adjectives',
      },
      options: [
        {id: 'a', label: 'A', text: 'compelling'},
        {id: 'b', label: 'B', text: 'remote'},
        {id: 'c', label: 'C', text: 'manual'},
        {id: 'd', label: 'D', text: 'ordinary'},
      ],
      answer_key: {
        correct_option: 'a',
      },
    },
    {
      card_id: '100301',
      track,
      knowledge_ref: '1003',
      interaction_id: 'lock',
      front: {
        eyebrow: 'CET grammar lock',
        prompt: 'Unlock the sentence structure.',
        support: 'Although the policy was unpopular, it remained effective.',
        context: '识别让步从句和主句关系。',
      },
      analysis: {
        title: 'although introduces concession',
        summary: 'although 引导让步，从句不能再和 but 连用。',
        exam_tip: '语法题常用 although/but 共现诱导错误。',
      },
      auto_scoring: true,
      space_metadata: {
        box_ref: '1003',
        library: '语法',
        group: '从句关系',
        box: 'concession clauses',
      },
      lock_slots: [
        {id: 'marker', label: '连接词', options: ['Although', 'Because']},
        {id: 'relation', label: '关系', options: ['让步', '因果']},
        {
          id: 'main',
          label: '主句',
          options: ['it remained effective', 'the policy was unpopular'],
        },
      ],
      answer_key: {
        lock_pattern: ['Although', '让步', 'it remained effective'],
      },
    },
    {
      card_id: '100401',
      track,
      knowledge_ref: '1004',
      interaction_id: 'elimination',
      front: {
        eyebrow: 'CET cloze elimination',
        prompt: 'Remove the words that do not fit the register.',
        support:
          'The committee reached a ____ decision after reviewing evidence.',
        context: '排除语体不适合正式语境的词。',
      },
      analysis: {
        title: 'formal register matters',
        summary: '正式语境中应避开过口语或情绪化的表达。',
        exam_tip: '选词填空要同时看语义、词性和语体。',
      },
      auto_scoring: true,
      space_metadata: {
        box_ref: '1004',
        library: '选词填空',
        group: '语体判断',
        box: 'formal register',
      },
      elimination_items: [
        {id: 'slang', text: 'cool'},
        {id: 'casual', text: 'kind-of'},
        {id: 'formal', text: 'reasoned'},
        {id: 'vague', text: 'stuff-based'},
      ],
      answer_key: {
        correct_items: ['slang', 'casual', 'vague'],
      },
    },
    {
      card_id: '100501',
      track,
      knowledge_ref: '1005',
      interaction_id: 'swipe',
      front: {
        eyebrow: 'CET writing judgement',
        prompt: 'The sentence is suitable for a formal essay.',
        support: 'It is super important that students get tons of chances.',
        context: '判断句子是否符合四六级作文正式语体。',
      },
      analysis: {
        title: 'informal wording weakens writing',
        summary: 'super 和 tons of 偏口语，正式作文里应替换。',
        exam_tip: '写作提分常来自语体稳定，而不是堆复杂词。',
      },
      auto_scoring: true,
      space_metadata: {
        box_ref: '1005',
        library: '写作',
        group: '正式语体',
        box: 'academic tone',
      },
      swipe_states: [
        {id: 'formal', label: '适合', description: '可直接用于正式作文'},
        {id: 'informal', label: '不适合', description: '需要替换口语化表达'},
      ],
      answer_key: {
        correct_state: 'informal',
      },
    },
  ];
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');

  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {'content-type': 'application/json'});
  response.end(JSON.stringify(payload));
}

function statusFromError(error) {
  if (
    error &&
    typeof error === 'object' &&
    (Number.isInteger(error.status) || Number.isInteger(error.statusCode))
  ) {
    return error.status ?? error.statusCode;
  }

  return 500;
}
