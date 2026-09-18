#!/usr/bin/env node

import http from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

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
const {
  createSpaceActionsV2Service,
  serializeSpaceState,
} = require('./functions/softbook-api/space-actions-v2.js');

const port = Number(process.env.PORT || 48731);
const host = process.env.HOST || '127.0.0.1';
const smsCode = process.env.SOFTBOOK_CET_TEST_CODE || '123456';
const challenges = new Map();
const sessions = new Map();
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
const spaceActionsService = createSpaceActionsV2Service({
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

  if (path === '/v1/space/state-sync') {
    sendJson(response, 410, {
      error: {
        code: 'legacy_space_snapshot_disabled',
        message: 'Legacy physical-space snapshot APIs are disabled.',
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

  if (method === 'POST' && path === '/v2/space/actions') {
    const body = await readJson(request);
    const data = await spaceActionsService.submit({
      request: {body},
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
      await bootstrapPayload(session.phoneNumber, track, dayKey),
    );
    return;
  }

  if (
    method === 'GET' &&
    (path === '/v2/learning/card-source' ||
      path === '/v1/learning/card-source')
  ) {
    const track =
      url.searchParams.get('track') ||
      (path.startsWith('/v1/') ? 'cet4' : null);

    if (track !== 'cet4' && track !== 'cet6') {
      sendJson(response, 400, {error: 'track must be cet4 or cet6'});
      return;
    }

    if (
      path === '/v2/learning/card-source' &&
      (url.searchParams.size !== 1 || !url.searchParams.has('track'))
    ) {
      sendJson(response, 400, {
        error: {code: 'learning_card_source_input_forbidden'},
      });
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

  if (
    method === 'GET' &&
    (path === '/v2/membership/entitlement' ||
      path === '/v1/membership/entitlement')
  ) {
    sendJson(
      response,
      200,
      entitlementPayload(
        await learningEventsStore.getMembership(
          session.phoneNumber,
          new Date().toISOString(),
        ),
      ),
    );
    return;
  }

  if (
    method === 'POST' &&
    path === '/v2/membership/start-trial'
  ) {
    sendJson(response, 404, {error: {code: 'route_not_found'}});
    return;
  }

  if (method === 'POST' && path === '/v1/membership/start-trial') {
    const body = await readJson(request);
    assertSessionPhone(body, session);
    const membership = await learningEventsStore.startTrial(
      session.phoneNumber,
      new Date().toISOString(),
    );
    sendJson(response, 200, entitlementPayload(membership));
    return;
  }

  if (
    method === 'POST' &&
    (path === '/v2/membership/purchase' ||
      path === '/v1/membership/purchase')
  ) {
    const body = await readJson(request);
    if (path.startsWith('/v1/')) assertSessionPhone(body, session);
    const membership = await learningEventsStore.purchase(
      session.phoneNumber,
      new Date().toISOString(),
    );
    sendJson(response, 200, entitlementPayload(membership));
    return;
  }

  if (
    method === 'POST' &&
    (path === '/v2/membership/dismiss-recovery' ||
      path === '/v1/membership/dismiss-recovery')
  ) {
    const body = await readJson(request);
    if (path.startsWith('/v1/')) assertSessionPhone(body, session);
    const membership = await learningEventsStore.dismissRecovery(
      session.phoneNumber,
      new Date().toISOString(),
    );
    sendJson(response, 200, entitlementPayload(membership));
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

function entitlementPayload(membership) {
  const {acknowledged_at, component_revision, ...entitlement} = membership;
  return {
    data: {
      entitlement,
    },
  };
}

async function bootstrapPayload(phoneNumber, track, dayKey) {
  const accountKey = accountKeyForPhone(phoneNumber);
  const cardSource = getMockCardSource(track);
  const learning = learningEventsStore.getLearningState(
    phoneNumber,
    dayKey,
    track,
    {accountKey},
  );
  const progress = learningEventsStore.getDailyProgress(phoneNumber, dayKey, {
    accountKey,
  });
  const space = await learningEventsStore.getSpaceState(
    phoneNumber,
    dayKey,
    {
      accountKey,
      acknowledgedAt: new Date().toISOString(),
    },
  );
  const {component_revision: progressRevision, ...progressProjection} =
    progress;
  const membership = await learningEventsStore.getMembership(
    phoneNumber,
    new Date().toISOString(),
  );
  const {component_revision: membershipComponentRevision, ...membershipProjection} =
    membership;
  const membershipRevision =
    membershipComponentRevision.base_membership_revision;

  return {
    data: {
      schema_version: 'bootstrap.v2',
      generated_at: new Date().toISOString(),
      day_key: dayKey,
      track,
      component_revisions: {
        schema_version: 'bootstrap-component-revisions.v1',
        membership: {
          base_membership_revision: membershipRevision,
          beta_entitlement_revision: 0,
        },
        learning: {
          event_server_sequence:
            learning.component_revision.event_server_sequence,
          session_revision: learning.component_revision.session_revision,
          space_revision: space.revision,
        },
        progress: {
          check_in_revision: progressRevision.check_in_revision,
          learning_server_sequence:
            progressRevision.learning_server_sequence,
          space_revision: space.revision,
        },
        space: {state_revision: space.revision},
      },
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
        ...membershipProjection,
      },
      progress: progressProjection,
      space: serializeSpaceState(space, {
        accountKey,
        cardIds: new Set(
          cardSource.card_records.map(card => card.card_id),
        ),
        contentVersion: cardSource.content_version,
        track,
      }),
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
    const injectedFile = process.env[
      track === 'cet4'
        ? 'SOFTBOOK_CET_CARD_SOURCE_CET4_FILE'
        : 'SOFTBOOK_CET_CARD_SOURCE_CET6_FILE'
    ];
    if (!injectedFile) throw new Error('Set SOFTBOOK_CET_CARD_SOURCE_CET4_FILE or SOFTBOOK_CET_CARD_SOURCE_CET6_FILE to an imported real payload.');
    cardSources.set(track, validateCardSourceForImport(JSON.parse(readFileSync(injectedFile, 'utf8')), track));
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
