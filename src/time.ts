import { CTA_TIMEZONE } from './config.js';

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
  const parts = partsFormatter.formatToParts(instantMs);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part === undefined ? 0 : Number(part.value);
  };
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asIfUtc - instantMs;
}

/**
 * Interpret naive wall-clock components as Chicago local time.
 *
 * Both CTA APIs report timestamps without a zone or offset. We guess the
 * instant using the offset at the naive value, then correct once — enough to
 * settle every case except times inside the spring-forward gap, which do not
 * exist locally and land on the hour after it.
 */
export function chicagoWallClockToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstGuess = naiveUtc - zoneOffsetMs(naiveUtc);
  const corrected = naiveUtc - zoneOffsetMs(firstGuess);
  return new Date(corrected);
}

/** Train Tracker format: `2015-04-30T20:23:32`. */
export function parseTrainTimestamp(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Unrecognized train timestamp: ${value}`);
  const [, y, mo, d, h, mi, s] = match as unknown as string[];
  return chicagoWallClockToDate(+y!, +mo!, +d!, +h!, +mi!, +s!);
}

/** Bus Tracker format: `20250421 14:07` or, with `tmres=s`, `20250421 14:07:33`. */
export function parseBusTimestamp(value: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) throw new Error(`Unrecognized bus timestamp: ${value}`);
  const [, y, mo, d, h, mi, s] = match as unknown as (string | undefined)[];
  return chicagoWallClockToDate(+y!, +mo!, +d!, +h!, +mi!, s === undefined ? 0 : +s);
}

/** Whole minutes between two instants, floored at zero. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}
