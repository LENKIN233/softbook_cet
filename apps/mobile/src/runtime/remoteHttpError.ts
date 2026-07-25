export class RemoteHttpError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'RemoteHttpError';
    this.code = code;
    this.status = status;
  }
}

export function isRemoteAuthorizationError(error: unknown): boolean {
  return (
    error instanceof RemoteHttpError &&
    (error.status === 401 || error.status === 403)
  );
}
