import { describe, expect, it } from 'vitest';

import { chicagoWallClockToDate, minutesBetween, parseBusTimestamp, parseTrainTimestamp } from '../src/time.js';
import { chicagoTime } from './helpers.js';

describe('chicagoWallClockToDate', () => {
  it('reads a summer time as CDT (UTC-5)', () => {
    expect(chicagoWallClockToDate(2025, 7, 4, 12, 0, 0).toISOString()).toBe('2025-07-04T17:00:00.000Z');
  });

  it('reads a winter time as CST (UTC-6)', () => {
    expect(chicagoWallClockToDate(2025, 1, 4, 12, 0, 0).toISOString()).toBe('2025-01-04T18:00:00.000Z');
  });

  it('resolves the hour after the fall-back transition', () => {
    // 01:30 occurs twice on 2025-11-02; we take the first (CDT) occurrence.
    expect(chicagoWallClockToDate(2025, 11, 2, 1, 30, 0).toISOString()).toBe('2025-11-02T06:30:00.000Z');
  });
});

describe('parseTrainTimestamp', () => {
  it('parses the documented format as Chicago local time', () => {
    expect(chicagoTime(parseTrainTimestamp('2015-04-30T20:23:32'))).toBe('2015-04-30 20:23');
  });

  it('rejects an unrecognized shape', () => {
    expect(() => parseTrainTimestamp('30 Apr 2015')).toThrow(/Unrecognized train timestamp/);
  });
});

describe('parseBusTimestamp', () => {
  it('parses minute resolution', () => {
    expect(chicagoTime(parseBusTimestamp('20250421 16:04'))).toBe('2025-04-21 16:04');
  });

  it('parses second resolution from tmres=s', () => {
    expect(chicagoTime(parseBusTimestamp('20250421 16:04:33'))).toBe('2025-04-21 16:04');
  });

  it('rejects an unrecognized shape', () => {
    expect(() => parseBusTimestamp('2025-04-21 16:04')).toThrow(/Unrecognized bus timestamp/);
  });
});

describe('minutesBetween', () => {
  it('floors partial minutes', () => {
    expect(minutesBetween(new Date(0), new Date(119_000))).toBe(1);
  });

  it('clamps a prediction already in the past to zero', () => {
    expect(minutesBetween(new Date(60_000), new Date(0))).toBe(0);
  });
});
