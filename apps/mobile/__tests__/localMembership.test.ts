import {
  createInitialMembershipState,
  dismissMembershipRecovery,
  expireMembershipTrial,
  purchaseMembership,
  resolveAccessibleLearningCardCount,
  resolveMembershipAccess,
  startMembershipTrial,
} from '../src/membership/localMembership';

test('starts trial only on first counted entry', () => {
  const initialState = createInitialMembershipState();

  const trialState = startMembershipTrial(initialState);

  expect(trialState.stage).toBe('trial');
  expect(trialState.countedEntryCount).toBe(1);
  expect(trialState.trialStartedAtEntryCount).toBe(1);
  expect(startMembershipTrial(trialState)).toBe(trialState);
});

test('keeps free learning near half library while gating full access', () => {
  const freeState = expireMembershipTrial(
    startMembershipTrial(createInitialMembershipState()),
  );

  expect(resolveMembershipAccess(freeState)).toEqual({
    basicLearning: true,
    completeAlgorithm: false,
    completeCardLibrary: false,
    completePhysicalSpace: false,
  });
  expect(resolveAccessibleLearningCardCount(5, freeState)).toBe(3);
});

test('purchase clears recovery reminder and restores full access', () => {
  const freeState = expireMembershipTrial(
    startMembershipTrial(createInitialMembershipState()),
  );
  const premiumState = purchaseMembership(freeState);

  expect(premiumState.recoveryPromptVisible).toBe(false);
  expect(resolveMembershipAccess(premiumState).completePhysicalSpace).toBe(true);
});

test('recovery reminder can be dismissed after membership experience ends', () => {
  const freeState = expireMembershipTrial(
    startMembershipTrial(createInitialMembershipState()),
  );

  expect(freeState.recoveryPromptVisible).toBe(true);
  expect(dismissMembershipRecovery(freeState).recoveryPromptVisible).toBe(false);
});
