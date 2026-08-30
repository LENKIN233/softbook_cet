const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {before, test} = require('node:test');

let beta;

before(async () => {
  beta = await import(
    pathToFileURL(resolve(__dirname, '../../../beta-entitlement-v1.mjs'))
  );
});

test('grant creates premium access evidence without changing base membership', () => {
  const base = membership('trial');
  const plan = beta.planBetaEntitlementMutation(command('grant'), null, base);

  assert.equal(plan.changed, true);
  assert.equal(plan.document.active_grant.campaign_id, 'cet4-beta-campaign-001');
  assert.equal(plan.document.active_grant.grant_id, 'cet4-beta-grant-0001');
  assert.equal(plan.document.audit.length, 1);
  assert.equal(plan.document.audit[0].previous_stage, 'trial');
  assert.equal(plan.document.audit[0].resulting_stage, 'premium');
  assert.equal(beta.applyBetaEntitlementToMembership(base, plan.document).stage, 'premium');
  assert.equal(base.stage, 'trial');
  assert.equal(JSON.stringify(plan.document).includes('13800138000'), true);
  const publicPlan = beta.publicBetaEntitlementPlan(plan);
  assert.equal(publicPlan.schema_version, 'beta-entitlement-plan.v2');
  assert.equal(JSON.stringify(publicPlan).includes('13800138000'), false);
  assert.deepEqual(Object.keys(publicPlan).sort(), [
    'action',
    'actor_id',
    'campaign_id',
    'changed',
    'event_id',
    'grant_id',
    'idempotent',
    'previous_stage',
    'resulting_stage',
    'schema_version',
  ]);
});

test('exact event replay is idempotent while event collisions fail closed', () => {
  const first = beta.planBetaEntitlementMutation(command('grant'), null, membership('free'));
  const duplicate = beta.planBetaEntitlementMutation(
    command('grant'),
    first.document,
    membership('free'),
  );

  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.idempotent, true);
  assert.throws(
    () =>
      beta.planBetaEntitlementMutation(
        {...command('grant'), reason: 'different_reason'},
        first.document,
        membership('free'),
      ),
    /another command/,
  );
});

test('revoke removes only the matching grant and resolves current base membership', () => {
  const grant = beta.planBetaEntitlementMutation(command('grant'), null, membership('trial'));
  const revoke = beta.planBetaEntitlementMutation(
    command('revoke'),
    grant.document,
    membership('premium'),
  );

  assert.equal(revoke.document.active_grant, null);
  assert.equal(revoke.document.audit.length, 2);
  assert.equal(revoke.resultingStage, 'premium');
  assert.equal(
    beta.applyBetaEntitlementToMembership(membership('premium'), revoke.document).stage,
    'premium',
  );
  assert.throws(
    () =>
      beta.planBetaEntitlementMutation(
        {...command('revoke'), grant_id: 'cet4-beta-grant-other'},
        grant.document,
        membership('free'),
      ),
    /matching active beta campaign and grant/,
  );
  assert.throws(
    () =>
      beta.planBetaEntitlementMutation(
        {...command('revoke'), campaign_id: 'cet4-beta-campaign-other'},
        grant.document,
        membership('free'),
      ),
    /matching active beta campaign and grant/,
  );
});

test('grant records an expired canonical trial as free without rewriting base input', () => {
  const base = {
    ...membership('trial'),
    trial_started_at: '2026-07-20T10:00:00.000Z',
    trial_expires_at: '2026-07-25T10:00:00.000Z',
  };
  const grant = beta.planBetaEntitlementMutation(command('grant'), null, base);

  assert.equal(grant.previousStage, 'free');
  assert.equal(grant.document.audit[0].previous_stage, 'free');
  assert.equal(base.stage, 'trial');
});

test('command schema rejects extra fields, invalid phones, and noncanonical time', () => {
  assert.throws(
    () => beta.validateBetaEntitlementCommand({...command('grant'), secret: 'no'}),
    /fields are invalid/,
  );
  assert.throws(
    () => beta.validateBetaEntitlementCommand({...command('grant'), phone_number: '123'}),
    /phone_number is invalid/,
  );
  assert.throws(
    () =>
      beta.validateBetaEntitlementCommand({
        ...command('grant'),
        occurred_at: '2026-07-29T10:00:00+00:00',
      }),
    /canonical UTC timestamp/,
  );
});

test('stored beta entitlement rejects unknown fields and active campaign drift', () => {
  const grant = beta.planBetaEntitlementMutation(
    command('grant'),
    null,
    membership('free'),
  );
  const malformedDocuments = [
    {...grant.document, unregistered_authority: true},
    {
      ...grant.document,
      audit: [{...grant.document.audit[0], unregistered_authority: true}],
    },
    {
      ...grant.document,
      active_grant: {
        ...grant.document.active_grant,
        unregistered_authority: true,
      },
    },
    {
      ...grant.document,
      active_grant: {
        ...grant.document.active_grant,
        campaign_id: 'cet4-beta-campaign-other',
      },
    },
  ];

  for (const document of malformedDocuments) {
    assert.throws(
      () => beta.betaEntitlementInternals.normalizeBetaEntitlementDocument(document),
      /(fields are invalid|audit is invalid|active beta grant)/,
    );
  }
});

test('stored beta audit command hashes reject phone-owner transplants', () => {
  const grant = beta.planBetaEntitlementMutation(
    command('grant'),
    null,
    membership('free'),
  );
  const transplanted = {
    ...grant.document,
    phone_number: '13900139000',
  };

  assert.throws(
    () => beta.betaEntitlementInternals.normalizeBetaEntitlementDocument(transplanted),
    /audit sequence is invalid/,
  );
});

test('public beta identifiers reject literal and separator-normalized phones', () => {
  for (const value of ['scope-13800138000', 'scope-138-0013-8000']) {
    for (const field of ['actor_id', 'campaign_id', 'event_id', 'grant_id']) {
      assert.throws(
        () =>
          beta.validateBetaEntitlementCommand({
            ...command('grant'),
            [field]: value,
          }),
        /invalid/,
      );
    }
  }
});

function command(action) {
  return {
    schema_version: 'beta-entitlement-command.v1',
    event_id: action === 'grant' ? 'beta-event-grant-0001' : 'beta-event-revoke-0001',
    action,
    phone_number: '13800138000',
    campaign_id: 'cet4-beta-campaign-001',
    grant_id: 'cet4-beta-grant-0001',
    actor_id: 'receiver-operator',
    reason: 'closed_beta_access',
    occurred_at: action === 'grant' ? '2026-07-29T10:00:00.000Z' : '2026-07-30T10:00:00.000Z',
  };
}

function membership(stage) {
  const hasTrialClock = stage === 'trial';
  return {
    counted_entry_count: stage === 'trial_available' ? 0 : 1,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage,
    trial_duration_days: 5,
    trial_expires_at: hasTrialClock ? '2026-08-02T10:00:00.000Z' : null,
    trial_started_at: hasTrialClock ? '2026-07-28T10:00:00.000Z' : null,
    trial_started_at_entry_count: stage === 'trial_available' ? null : 1,
  };
}
