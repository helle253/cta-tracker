import { CtaApiError } from './errors.js';
import { TransitOption } from './types.js';

export const CTA_TIMEZONE = 'America/Chicago';

export const TRAIN_ARRIVALS_URL = 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx';
export const BUS_PREDICTIONS_URL = 'https://www.ctabustracker.com/bustime/api/v3/getpredictions';

export const DEFAULT_TIMEOUT_MS = 10_000;

const ENV_VAR = { train: 'CTA_TRAIN_KEY', bus: 'CTA_BUS_KEY' } as const;

export function resolveKey(api: TransitOption): string {
  const key = process.env[ENV_VAR[api]];
  if (!key) throw new CtaApiError(api, `Missing ${api} API key`);

  return key;
}
