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

test('grant creates a pilot premium overlay without changing base membership', () => {
  const base = membership('free');
  const plan = pilot.planPilotEntitlementMutation(
    command('grant', 'free', 'pilot_premium'),
    null,
    base,
  );

  assert.equal(plan.changed, true);
  assert.equal(plan.document.active_grant.pilot_id, 'cet4-pilot-2026');
  assert.equal(plan.document.audit.length, 1);
  assert.equal(plan.document.audit[0].previous_stage, 'free');
  assert.equal(plan.document.audit[0].resulting_stage, 'pilot_premium');
  assert.equal(
    pilot.applyPilotEntitlementToMembership(base, plan.document).stage,
    'pilot_premium',
  );
  assert.equal(base.stage, 'free');
  assert.equal(
    JSON.stringify(pilot.publicPilotEntitlementPlan(plan)).includes(
      '13800138000',
    ),
    false,
  );
});

test('exact command replay is idempotent and event collisions fail closed', () => {
  const first = pilot.planPilotEntitlementMutation(
    command('grant', 'trial', 'pilot_premium'),
    null,
    membership('trial'),
  );
  const duplicate = pilot.planPilotEntitlementMutation(
    command('grant', 'trial', 'pilot_premium'),
    first.document,
    membership('trial'),
  );

  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.idempotent, true);
  assert.throws(
    () =>
      pilot.planPilotEntitlementMutation(
        {
          ...command('grant', 'trial', 'pilot_premium'),
          reason: 'different controlled pilot reason',
        },
        first.document,
        membership('trial'),
      ),
    /another command/,
  );
});

test('grant and revoke rederive stages and reject operator-supplied drift', () => {
  assert.throws(
    () =>
      pilot.planPilotEntitlementMutation(
        command('grant', 'trial', 'pilot_premium'),
        null,
        membership('free'),
      ),
    /do not match server state/,
  );

  const grant = pilot.planPilotEntitlementMutation(
    command('grant', 'free', 'pilot_premium'),
    null,
    membership('free'),
  );
  assert.throws(
    () =>
      pilot.planPilotEntitlementMutation(
        command('revoke', 'pilot_premium', 'trial'),
        grant.document,
        membership('free'),
      ),
    /do not match server state/,
  );

  const revoke = pilot.planPilotEntitlementMutation(
    command('revoke', 'pilot_premium', 'free'),
    grant.document,
    membership('free'),
  );
  assert.equal(revoke.document.active_grant, null);
  assert.equal(revoke.document.audit.length, 2);
  assert.equal(revoke.resultingStage, 'free');
  assert.equal(
    pilot.applyPilotEntitlementToMembership(
      membership('free'),
      revoke.document,
    ).stage,
    'free',
  );
});

test('revoke requires the active pilot and membership timestamps are preserved', () => {
  const base = membership('trial');
  const grant = pilot.planPilotEntitlementMutation(
    command('grant', 'trial', 'pilot_premium'),
    null,
    base,
  );
  const applied = pilot.applyPilotEntitlementToMembership(base, grant.document);

  assert.equal(applied.trial_started_at, '2026-08-01T00:00:00.000Z');
  assert.equal(applied.trial_expires_at, '2026-08-06T00:00:00.000Z');
  assert.throws(
    () =>
      pilot.planPilotEntitlementMutation(
        {
          ...command('revoke', 'pilot_premium', 'trial'),
          pilot_id: 'different-pilot',
        },
        grant.document,
        base,
      ),
    /matching active pilot grant/,
  );
});

function command(action, previousStage, resultingStage) {
  return {
    schema_version: 'pilot-entitlement-command.v1',
    event_id:
      action === 'grant' ? 'pilot-event-grant-0001' : 'pilot-event-revoke-0001',
    pilot_id: 'cet4-pilot-2026',
    phone_number: '13800138000',
    action,
    actor: 'receiver-operator',
    reason: 'continue controlled pilot after trial',
    occurred_at:
      action === 'grant'
        ? '2026-08-07T00:00:00.000Z'
        : '2026-08-08T00:00:00.000Z',
    previous_stage: previousStage,
    resulting_stage: resultingStage,
  };
}

function membership(stage) {
  const trialStarted = stage === 'trial';
  return {
    counted_entry_count: stage === 'trial_available' ? 0 : 1,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage,
    trial_duration_days: 5,
    trial_expires_at: trialStarted ? '2026-08-06T00:00:00.000Z' : null,
    trial_started_at: trialStarted ? '2026-08-01T00:00:00.000Z' : null,
    trial_started_at_entry_count: stage === 'trial_available' ? null : 1,
  };
}
