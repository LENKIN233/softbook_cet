export type MembershipStage = 'trial_available' | 'trial' | 'free' | 'premium';

export type MembershipAccess = {
  basicLearning: boolean;
  completeCardLibrary: boolean;
  completePhysicalSpace: boolean;
  completeAlgorithm: boolean;
};

export type MembershipState = {
  countedEntryCount: number;
  lastExperienceEndedBy: 'trial' | 'premium' | null;
  recoveryPromptVisible: boolean;
  stage: MembershipStage;
  trialDurationDays: number;
  trialStartedAtEntryCount: number | null;
};

export const LOCAL_TRIAL_DURATION_DAYS = 5;

export function createInitialMembershipState(): MembershipState {
  return {
    countedEntryCount: 0,
    lastExperienceEndedBy: null,
    recoveryPromptVisible: false,
    stage: 'trial_available',
    trialDurationDays: LOCAL_TRIAL_DURATION_DAYS,
    trialStartedAtEntryCount: null,
  };
}

export function resolveMembershipAccess(
  membershipState: MembershipState,
): MembershipAccess {
  if (
    membershipState.stage === 'trial' ||
    membershipState.stage === 'premium'
  ) {
    return {
      basicLearning: true,
      completeAlgorithm: true,
      completeCardLibrary: true,
      completePhysicalSpace: true,
    };
  }

  return {
    basicLearning: true,
    completeAlgorithm: false,
    completeCardLibrary: false,
    completePhysicalSpace: false,
  };
}

export function startMembershipTrial(
  membershipState: MembershipState,
): MembershipState {
  if (membershipState.stage !== 'trial_available') {
    return membershipState;
  }

  const countedEntryCount = membershipState.countedEntryCount + 1;

  return {
    ...membershipState,
    countedEntryCount,
    lastExperienceEndedBy: null,
    recoveryPromptVisible: false,
    stage: 'trial',
    trialStartedAtEntryCount: countedEntryCount,
  };
}

export function expireMembershipTrial(
  membershipState: MembershipState,
): MembershipState {
  if (membershipState.stage !== 'trial') {
    return membershipState;
  }

  return {
    ...membershipState,
    lastExperienceEndedBy: 'trial',
    recoveryPromptVisible: true,
    stage: 'free',
  };
}

export function purchaseMembership(
  membershipState: MembershipState,
): MembershipState {
  return {
    ...membershipState,
    lastExperienceEndedBy: null,
    recoveryPromptVisible: false,
    stage: 'premium',
  };
}

export function expirePremiumMembership(
  membershipState: MembershipState,
): MembershipState {
  if (membershipState.stage !== 'premium') {
    return membershipState;
  }

  return {
    ...membershipState,
    lastExperienceEndedBy: 'premium',
    recoveryPromptVisible: true,
    stage: 'free',
  };
}

export function dismissMembershipRecovery(
  membershipState: MembershipState,
): MembershipState {
  return {
    ...membershipState,
    recoveryPromptVisible: false,
  };
}

export function resolveAccessibleLearningCardCount(
  totalCardCount: number,
  membershipState: MembershipState,
): number {
  if (totalCardCount <= 0) {
    return 0;
  }

  if (resolveMembershipAccess(membershipState).completeCardLibrary) {
    return totalCardCount;
  }

  return Math.min(totalCardCount, Math.max(1, Math.ceil(totalCardCount * 0.5)));
}
