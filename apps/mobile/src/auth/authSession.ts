export type LocalAuthChallenge = {
  mode: 'local';
  phoneNumber: string;
};

export type RemoteAuthChallenge = {
  challengeId: string;
  expiresAt: string;
  mode: 'remote';
  phoneNumber: string;
  retryAfterSeconds: number;
};

export type AuthChallenge = LocalAuthChallenge | RemoteAuthChallenge;

export type LocalAuthSession = {
  mode: 'local';
  phoneNumber: string;
};

export type RemoteAuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  mode: 'remote';
  phoneNumber: string;
  refreshExpiresAt: string;
  refreshToken: string;
  sessionId: string;
  tokenType: 'Bearer';
};

export type AuthSession = LocalAuthSession | RemoteAuthSession;

export function getAuthAccessToken(session: AuthSession): string | undefined {
  return session.mode === 'remote' ? session.accessToken : undefined;
}

export function isRemoteAuthSession(
  session: AuthSession,
): session is RemoteAuthSession {
  return session.mode === 'remote';
}
