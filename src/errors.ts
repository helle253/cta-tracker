/** Thrown when the CTA returns an error payload, or the transport fails. */
export class CtaApiError extends Error {
  readonly api: 'bus' | 'train';
  /** The API's own error code, when it supplies one (train `errCd`). */
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(
    api: 'bus' | 'train',
    message: string,
    options: { code?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'CtaApiError';
    this.api = api;
    this.code = options.code;
    this.status = options.status;
  }
}
