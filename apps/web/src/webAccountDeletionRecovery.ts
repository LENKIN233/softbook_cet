import {createAccountDeletionRecoveryRepository} from '../../mobile/src/account/accountDeletionRecoveryRepository';
export type {
  AccountDeletionRecoveryChallenge as WebAccountDeletionRecoveryChallenge,
  AccountDeletionRecoveryRequest as WebAccountDeletionRecoveryRequest,
  AccountDeletionRecoveryResult as WebAccountDeletionRecoveryResult,
  AccountDeletionRecoveryRepository as WebAccountDeletionRecoveryRepository,
} from '../../mobile/src/account/accountDeletionRecoveryRepository';

export function createWebAccountDeletionRecoveryRepository(
  options: Parameters<typeof createAccountDeletionRecoveryRepository>[0],
) {
  return createAccountDeletionRecoveryRepository({...options, clientKind: 'web'});
}
