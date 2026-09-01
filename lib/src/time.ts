import { CTA_TIMEZONE } from './config.js';
import { TransitOption } from './types.js';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CTA_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Offset of the CTA timezone from UTC, in ms, at the given instant. */
function zoneOffsetMs(instantMs: number): number {
  const p: Record<string, number> = Object.fromEntries(
    partsFormatter.formatToParts(instantMs).map(({ type, value }) => [type, Number(value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instantMs;
}

/**
 * Interpret naive wall-clock components as Chicago local time.
 *
 * Both CTA APIs report timestamps without a zone or offset. We guess the
 * instant using the offset at the naive value, then correct once — enough to
 * settle every case except times inside the spring-forward gap, which do not
 * exist locally and land on the hour after it.
 */
export function chicagoWallClockToDate(year: number, month: number, day: number, hour: number, minute: number, second = 0): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstGuess = naiveUtc - zoneOffsetMs(naiveUtc);
  return new Date(naiveUtc - zoneOffsetMs(firstGuess));
}

const TRAIN_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
const BUS_PATTERN = /^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;

function parseTimestamp(api: TransitOption, pattern: RegExp, value: string): Date {
  const match = pattern.exec(value.trim());
  if (!match) throw new Error(`Unrecognized ${api} timestamp: ${value}`);
  const [, y, mo, d, h, mi, s = '0'] = match;
  return chicagoWallClockToDate(+y, +mo, +d, +h, +mi, +s);
}

/** Train Tracker format: `2015-04-30T20:23:32`. */
export const parseTrainTimestamp = (value: string): Date => parseTimestamp('train', TRAIN_PATTERN, value);

/** Bus Tracker format: `20250421 14:07` or, with `tmres=s`, `20250421 14:07:33`. */
export const parseBusTimestamp = (value: string): Date => parseTimestamp('bus', BUS_PATTERN, value);

/** Whole minutes between two instants, floored at zero. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}
