import type {AuthSessionCoordinator} from './authSessionCoordinator';

export function createAuthenticatedFetch(options: {
  authSessionCoordinator: AuthSessionCoordinator;
  fetchImpl?: typeof fetch;
}): typeof fetch {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (input, init) => {
    const firstResponse = await fetchWithCurrentAccessToken(
      input,
      init,
      options.authSessionCoordinator,
      fetchImpl,
    );

    if (firstResponse.status === 403) {
      await options.authSessionCoordinator.invalidate();
      return firstResponse;
    }

    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    await options.authSessionCoordinator.forceRefresh();
    const retryResponse = await fetchWithCurrentAccessToken(
      input,
      init,
      options.authSessionCoordinator,
      fetchImpl,
    );

    if (retryResponse.status === 401 || retryResponse.status === 403) {
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
) {
  const accessToken = await authSessionCoordinator.getAccessToken();
  const headers = new Headers(init?.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetchImpl(input, {
    ...init,
    headers,
  });
}
