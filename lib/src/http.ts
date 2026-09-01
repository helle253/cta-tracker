import { DEFAULT_TIMEOUT_MS } from './config.js';
import { CtaApiError } from './errors.js';
import { TransitOption } from './types.js';

export type QueryValue = string | number | boolean | undefined;

/** Build a URL, dropping undefined params so callers can pass options through. */
export function buildUrl(base: string, params: Record<string, QueryValue>): string {
  const url = new URL(base);
  Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .forEach(([name, value]) => url.searchParams.set(name, String(value)));
  return url.toString();
}

export interface GetJsonOptions {
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

/** GET a URL and parse JSON, translating transport and parse failures into CtaApiError. */
export async function getJson<T>(api: TransitOption, url: string, options: GetJsonOptions = {}): Promise<T> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let response: Response;
  try {
    response = await doFetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === 'TimeoutError';
    const detail = timedOut ? `request timed out after ${timeoutMs}ms` : 'request failed';
    throw new CtaApiError(api, `CTA ${api} API ${detail}`, { cause });
  }

  if (!response.ok) {
    throw new CtaApiError(api, `CTA ${api} API returned HTTP ${response.status}`, {
      status: response.status,
    });
  }

  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch (cause) {
    throw new CtaApiError(api, `CTA ${api} API returned a non-JSON response`, {
      status: response.status,
      cause,
    });
  }
}
