export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class RepositoryConflictError extends Error {
  constructor(
    readonly code:
      | 'sms_resend_limited'
      | 'content_release_unavailable'
      | 'device_cursor_conflict'
      | 'idempotency_key_conflict',
  ) {
    super(code);
  }
}
