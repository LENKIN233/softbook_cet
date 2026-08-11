export type AccountBootstrapRequestLease = {
  abortController: AbortController;
  epoch: number;
  key: string;
};

export type AccountBootstrapRequestGate = {
  begin: (
    key: string,
    options?: {forceFresh?: boolean},
  ) => {lease: AccountBootstrapRequestLease; reused: boolean};
  finish: (lease: AccountBootstrapRequestLease) => void;
  invalidate: () => void;
  isCurrent: (lease: AccountBootstrapRequestLease) => boolean;
};

export function createAccountBootstrapRequestGate(): AccountBootstrapRequestGate {
  let active: AccountBootstrapRequestLease | null = null;
  let epoch = 0;

  return {
    begin(key, options = {}) {
      if (
        options.forceFresh !== true &&
        active !== null &&
        active.key === key
      ) {
        return {lease: active, reused: true};
      }

      active?.abortController.abort();
      epoch += 1;
      active = {
        abortController: new AbortController(),
        epoch,
        key,
      };
      return {lease: active, reused: false};
    },
    finish(lease) {
      if (active === lease) {
        active = null;
      }
    },
    invalidate() {
      active?.abortController.abort();
      active = null;
      epoch += 1;
    },
    isCurrent(lease) {
      return active === lease && lease.epoch === epoch;
    },
  };
}
