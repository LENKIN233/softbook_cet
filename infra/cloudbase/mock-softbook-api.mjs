#!/usr/bin/env node

import http from 'node:http';

const port = Number(process.env.PORT || 48731);
const host = process.env.HOST || '127.0.0.1';
const authToken = 'mock-softbook-token';

const server = http.createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    sendJson(response, statusFromError(error), {
      error: error instanceof Error ? error.message : String(error),
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

  if (method === 'POST' && path === '/v1/auth/request-code') {
    const body = await readJson(request);
    requireString(body.phone_number, 'phone_number');
    sendJson(response, 200, {data: {sent: true}});
    return;
  }

  if (method === 'POST' && path === '/v1/auth/verify-code') {
    const body = await readJson(request);
    const phoneNumber = requireString(body.phone_number, 'phone_number');
    requireString(body.sms_code, 'sms_code');
    sendJson(response, 200, {
      data: {
        auth_token: authToken,
        phone_number: phoneNumber,
      },
    });
    return;
  }

  requireBearerToken(request);

  if (method === 'GET' && path === '/v1/learning/card-source') {
    const track = url.searchParams.get('track') || 'cet4';

    if (track !== 'cet4' && track !== 'cet6') {
      sendJson(response, 400, {error: 'track must be cet4 or cet6'});
      return;
    }

    sendJson(response, 200, {
      data: {
        source: {
          id: `mock-${track}-source`,
          label: `Mock ${track.toUpperCase()} Source`,
        },
        track,
        card_records: createCardRecords(track),
      },
    });
    return;
  }

  if (method === 'GET' && path === '/v1/membership/entitlement') {
    sendJson(response, 200, entitlementPayload('trial_available'));
    return;
  }

  if (method === 'POST' && path === '/v1/membership/start-trial') {
    await readJson(request);
    sendJson(response, 200, entitlementPayload('trial'));
    return;
  }

  if (method === 'POST' && path === '/v1/membership/purchase') {
    await readJson(request);
    sendJson(response, 200, entitlementPayload('premium'));
    return;
  }

  if (method === 'POST' && path === '/v1/membership/dismiss-recovery') {
    await readJson(request);
    sendJson(response, 200, entitlementPayload('free', false, 'trial'));
    return;
  }

  if (
    method === 'POST' &&
    (path === '/v1/progress/daily-sync' ||
      path === '/v1/learning/state-sync' ||
      path === '/v1/space/state-sync')
  ) {
    await readJson(request);
    sendJson(response, 200, {data: {acknowledged_at: new Date().toISOString()}});
    return;
  }

  sendJson(response, 404, {error: `No mock route for ${method} ${path}`});
}

function requireBearerToken(request) {
  const authorization = request.headers.authorization || '';

  if (authorization !== `Bearer ${authToken}`) {
    const error = new Error('Missing or invalid Authorization bearer token.');
    error.status = 401;
    throw error;
  }
}

function entitlementPayload(
  stage,
  recoveryPromptVisible = false,
  lastExperienceEndedBy = null,
) {
  return {
    data: {
      entitlement: {
        stage,
        counted_entry_count: stage === 'trial_available' ? 0 : 1,
        last_experience_ended_by: lastExperienceEndedBy,
        recovery_prompt_visible: recoveryPromptVisible,
        trial_duration_days: 5,
        trial_started_at_entry_count:
          stage === 'trial' || stage === 'premium' ? 1 : null,
      },
    },
  };
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
        {id: 'main', label: '主句', options: ['it remained effective', 'the policy was unpopular']},
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
        support: 'The committee reached a ____ decision after reviewing evidence.',
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
    'status' in error &&
    Number.isInteger(error.status)
  ) {
    return error.status;
  }

  return 500;
}
