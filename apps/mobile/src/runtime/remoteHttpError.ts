export class RemoteHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RemoteHttpError';
    this.status = status;
  }
}

export function isRemoteAuthorizationError(error: unknown): boolean {
  return (
    error instanceof RemoteHttpError &&
    (error.status === 401 || error.status === 403)
  );
}
