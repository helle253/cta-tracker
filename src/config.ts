import { CtaApiError } from './errors.js';

/** All CTA timestamps are naive local time in Chicago. */
export const CTA_TIMEZONE = 'America/Chicago';

export const TRAIN_ARRIVALS_URL = 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx';
export const BUS_PREDICTIONS_URL = 'https://www.ctabustracker.com/bustime/api/v3/getpredictions';

export const DEFAULT_TIMEOUT_MS = 10_000;

const ENV_VAR = { train: 'CTA_TRAIN_KEY', bus: 'CTA_BUS_KEY' } as const;

/**
 * Resolve an API key: explicit override first, then the environment.
 * The two trackers issue separate keys, so they read separate variables.
 */
export function resolveKey(api: 'bus' | 'train', override?: string): string {
  const key = override ?? process.env[ENV_VAR[api]];
  if (!key) {
    throw new CtaApiError(api, `Missing ${api} API key: set ${ENV_VAR[api]} or pass options.key`);
  }
  return key;
}
