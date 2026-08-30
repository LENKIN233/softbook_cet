const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {before, test} = require('node:test');

let pilot;

before(async () => {
  pilot = await import(
    pathToFileURL(resolve(__dirname, '../../../pilot-entitlement-v1.mjs'))
  );
});

test('grant creates pilot-premium audit evidence while clients receive premium', () => {
  const base = membership('free');
  const plan = pilot.planPilotEntitlementMutation(command('grant', 'free'), null, base);

  assert.equal(plan.changed, true);
  assert.equal(plan.resultingStage, 'pilot_premium');
  assert.equal(plan.document.active_grant.pilot_id, 'cet4-pilot-2026');
  assert.equal(plan.document.audit[0].previous_stage, 'free');
  assert.equal(
    pilot.applyPilotEntitlementToMembership(base, plan.document, 'cet4-pilot-2026').stage,
    'premium',
  );
  assert.equal(base.stage, 'free');
  const publicPlan = pilot.publicPilotEntitlementPlan(plan);
  assert.equal(publicPlan.schema_version, 'pilot-entitlement-plan.v2');
  assert.equal(JSON.stringify(publicPlan).includes('13800138000'), false);
  assert.deepEqual(Object.keys(publicPlan).sort(), [
    'action',
    'actor',
    'changed',
    'event_id',
    'idempotent',
    'pilot_id',
    'previous_stage',
    'resulting_stage',
    'schema_version',
  ]);
});

test('exact replay is idempotent while event collisions fail closed', () => {
  const first = pilot.planPilotEntitlementMutation(
    command('grant', 'trial_available'),
    null,
    membership('trial_available'),
  );
  const replay = pilot.planPilotEntitlementMutation(
    command('grant', 'trial_available'),
    first.document,
    membership('trial_available'),
  );

  assert.equal(replay.changed, false);
  assert.equal(replay.idempotent, true);
  assert.throws(
    () =>
      pilot.planPilotEntitlementMutation(
        {...command('grant', 'trial_available'), reason: 'another_reason'},
        first.document,
        membership('trial_available'),
      ),
    /another pilot entitlement command/,
  );
});

test('revoke restores the current canonical base and permits a later pilot', () => {
  const firstGrant = pilot.planPilotEntitlementMutation(
    command('grant', 'trial'),
    null,
    membership('trial'),
  );
  const revoke = pilot.planPilotEntitlementMutation(
    command('revoke', 'premium'),
    firstGrant.document,
    membership('premium'),
  );
  const laterGrant = pilot.planPilotEntitlementMutation(
    {
      ...command('grant', 'premium'),
      event_id: 'pilot-event-grant-0002',
      pilot_id: 'cet4-pilot-2027',
      occurred_at: '2027-01-10T10:00:00.000Z',
    },
    revoke.document,
    membership('premium'),
  );

  assert.equal(revoke.document.active_grant, null);
  assert.equal(revoke.resultingStage, 'premium');
  assert.equal(laterGrant.document.pilot_id, 'cet4-pilot-2027');
  assert.equal(laterGrant.document.revision, 3);
  assert.equal(
    pilot.applyPilotEntitlementToMembership(
      membership('premium'),
      revoke.document,
      'cet4-pilot-2027',
    ).stage,
    'premium',
  );
});

test('stages are rederived and an active grant is exact-pilot bound', () => {
  assert.throws(
    () =>
      pilot.planPilotEntitlementMutation(
        command('grant', 'free'),
        null,
        membership('trial_available'),
      ),
    /canonical base membership/,
  );
  const grant = pilot.planPilotEntitlementMutation(
    command('grant', 'free'),
    null,
    membership('free'),
  );
  assert.throws(
    () =>
      pilot.applyPilotEntitlementToMembership(
        membership('free'),
        grant.document,
        'another-pilot',
      ),
    /active runtime pilot/,
  );
  const corrupted = structuredClone(grant.document);
  corrupted.audit[0].previous_stage = 'pilot_premium';
  assert.throws(
    () => pilot.pilotEntitlementInternals.normalizePilotEntitlementDocument(corrupted),
    /audit sequence is invalid/,
  );
});

test('expired trial is rederived as free at command occurrence time', () => {
  const expiredTrial = {
    ...membership('trial'),
    trial_started_at: '2026-08-01T00:00:00.000Z',
    trial_expires_at: '2026-08-06T00:00:00.000Z',
  };
  const plan = pilot.planPilotEntitlementMutation(
    command('grant', 'free'),
    null,
    expiredTrial,
  );

  assert.equal(plan.previousStage, 'free');
});

test('pilot audit hashes reject phone-owner transplants', () => {
  const grant = pilot.planPilotEntitlementMutation(
    command('grant', 'free'),
    null,
    membership('free'),
  );
  const transplanted = {
    ...grant.document,
    phone_number: '13900139000',
  };

  assert.throws(
    () => pilot.pilotEntitlementInternals.normalizePilotEntitlementDocument(transplanted),
    /audit sequence is invalid/,
  );
});

test('public pilot identifiers reject literal and separator-normalized phones', () => {
  for (const value of ['scope-13800138000', 'scope-138-0013-8000']) {
    for (const field of ['actor', 'event_id', 'pilot_id']) {
      assert.throws(
        () =>
          pilot.validatePilotEntitlementCommand({
            ...command('grant', 'free'),
            [field]: value,
          }),
        /invalid/,
      );
    }
  }
});

function command(action, baseStage) {
  return {
    schema_version: 'pilot-entitlement-command.v1',
    event_id:
      action === 'grant' ? 'pilot-event-grant-0001' : 'pilot-event-revoke-0001',
    pilot_id: 'cet4-pilot-2026',
    phone_number: '13800138000',
    action,
    actor: 'receiver-operator',
    reason: 'controlled_pilot_continued_access',
    occurred_at:
      action === 'grant' ? '2026-08-10T10:00:00.000Z' : '2026-08-11T10:00:00.000Z',
    previous_stage: action === 'grant' ? baseStage : 'pilot_premium',
    resulting_stage: action === 'grant' ? 'pilot_premium' : baseStage,
  };
}

function membership(stage) {
  return {
    counted_entry_count: stage === 'trial_available' ? 0 : 1,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage,
    trial_duration_days: 5,
    trial_expires_at: null,
    trial_started_at: null,
    trial_started_at_entry_count: stage === 'trial_available' ? null : 1,
  };
}
