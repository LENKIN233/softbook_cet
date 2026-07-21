import type {AuthSessionCoordinator} from './authSessionCoordinator';
import {getAuthSessionScopeKey} from './authSession';

export function createAuthenticatedFetch(options: {
  authSessionCoordinator: AuthSessionCoordinator;
  fetchImpl?: typeof fetch;
}): typeof fetch {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (input, init) => {
    const requestSessionScopeKey = getAuthSessionScopeKey(
      options.authSessionCoordinator.getCurrentSession(),
    );
    const isRequestSessionCurrent = () =>
      getAuthSessionScopeKey(
        options.authSessionCoordinator.getCurrentSession(),
      ) === requestSessionScopeKey;
    const firstResponse = await fetchWithCurrentAccessToken(
      input,
      init,
      options.authSessionCoordinator,
      fetchImpl,
      requestSessionScopeKey,
    );

    if (!isRequestSessionCurrent()) {
      return firstResponse;
    }

    if (firstResponse.status === 403) {
      await options.authSessionCoordinator.invalidate();
      return firstResponse;
    }

    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    await options.authSessionCoordinator.forceRefresh();

    if (!isRequestSessionCurrent()) {
      return firstResponse;
    }

    const retryResponse = await fetchWithCurrentAccessToken(
      input,
      init,
      options.authSessionCoordinator,
      fetchImpl,
      requestSessionScopeKey,
    );

    if (
      isRequestSessionCurrent() &&
      (retryResponse.status === 401 || retryResponse.status === 403)
    ) {
      await options.authSessionCoordinator.invalidate();
    }

    return retryResponse;
  };
}

async function fetchWithCurrentAccessToken(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  authSessionCoordinator: AuthSessionCoordinator,
  fetchImpl: typeof fetch,
  expectedSessionScopeKey: string | null,
) {
  const accessToken = await authSessionCoordinator.getAccessToken();

  if (
    getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) !==
    expectedSessionScopeKey
  ) {
    throw new Error('Authenticated request was superseded by a newer session.');
  }

  const headers = new Headers(init?.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetchImpl(input, {
    ...init,
    headers,
  });
}
