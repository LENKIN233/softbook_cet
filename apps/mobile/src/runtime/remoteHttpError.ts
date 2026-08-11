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
  const errorStatus = (error as {status?: unknown} | null)?.status;

  return (
    error instanceof Error &&
    (errorStatus === 401 || errorStatus === 403)
  );
}
