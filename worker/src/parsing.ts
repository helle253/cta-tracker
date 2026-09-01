import { TransitOption } from '@cta-tracker/lib';

const DEFAULT_RESPONSE_LIMIT = 3;
const MAX_RESPONSE_LIMIT = 20;

export function parseRoutes(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((route) => route.trim())
    .filter((route) => route.length > 0);
}

export function parseLimit(value: string | null): number {
  if (value === null) return DEFAULT_RESPONSE_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('limit must be a positive integer');
  return Math.min(limit, MAX_RESPONSE_LIMIT);
}

export function parseMode(value: string | null): TransitOption {
  if (value === 'bus' || value === 'train') return value;
  throw new TypeError('mode must be "bus" or "train"');
}

export function parseStopId(value: string | null): string {
  const stopId = (value ?? '').trim();
  if (!/^\d+$/.test(stopId)) throw new TypeError('stopId must be numeric');
  return stopId;
}
