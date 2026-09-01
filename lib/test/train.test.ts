import { beforeEach, describe, expect, it } from 'vitest';

import { CtaApiError } from '../src/errors.js';
import { getTrainArrivals } from '../src/train.js';
import { chicagoTime, fixture, stubFetch } from './helpers.js';

describe('getTrainArrivals', () => {
  it('requests JSON output for the given platform stop', async () => {
    const { fetch, calls } = stubFetch(fixture('train-arrivals'));
    await getTrainArrivals('30960', { fetch, limit: 5, routes: ['Org', 'Red'] });

    const url = new URL(calls[0]!);
    expect(url.origin + url.pathname).toBe('https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'test-key',
      max: '5',
      rt: 'Org,Red',
      outputType: 'JSON',
      stpid: '30960',
    });
  });

  it('rejects a non-numeric stop id', async () => {
    const { fetch, calls } = stubFetch(fixture('train-arrivals'));
    await expect(getTrainArrivals('Belmont', { fetch })).rejects.toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });

  it('normalizes predictions and sorts them soonest-first', async () => {
    const { fetch } = stubFetch(fixture('train-arrivals'));
    const arrivals = await getTrainArrivals('30960', { fetch });

    expect(arrivals).toHaveLength(2);
    expect(arrivals[0]).toMatchObject({
      mode: 'train',
      stopName: 'Pulaski',
      route: 'Org',
      destination: 'Midway',
      minutesUntil: 1,
      isApproaching: true,
      isDelayed: true,
      isScheduled: true,
    });
    // The scheduled entry carries run number "0"; there is no vehicle to name.
    expect(arrivals[0]!.vehicleId).toBeUndefined();
    expect(chicagoTime(arrivals[0]!.arrivalTime)).toBe('2015-04-30 20:25');

    expect(arrivals[1]).toMatchObject({
      destination: 'Loop',
      minutesUntil: 8,
      isApproaching: false,
      isScheduled: false,
      vehicleId: '726',
    });
  });

  it("counts down from the response clock, not each prediction's own", async () => {
    // A busy station returns predictions generated a minute or more apart; if
    // each counted down from its own prdt the countdowns would not be ordered.
    const raw = fixture('train-arrivals') as any;
    raw.ctatt.eta[0].prdt = '2015-04-30T20:20:00';
    const { fetch } = stubFetch(raw);
    const arrivals = await getTrainArrivals('30960', { fetch });

    const countdowns = arrivals.map((a) => a.minutesUntil);
    expect(countdowns).toEqual([...countdowns].sort((a, b) => a - b));
    expect(countdowns).toEqual([1, 8]);
  });

  it('turns an errCd body into a CtaApiError', async () => {
    const { fetch } = stubFetch(fixture('train-error'));
    await expect(getTrainArrivals('30960', { fetch })).rejects.toMatchObject({
      name: 'CtaApiError',
      message: 'Invalid API key',
      code: '102',
      api: 'train',
    });
  });

  it('returns an empty list when the station has no predictions', async () => {
    const { fetch } = stubFetch({ ctatt: { errCd: '0', errNm: null } });
    await expect(getTrainArrivals('30960', { fetch })).resolves.toEqual([]);
  });

  it('accepts a single eta object as well as an array', async () => {
    const single = { ctatt: { errCd: '0', eta: (fixture('train-arrivals') as any).ctatt.eta[0] } };
    const { fetch } = stubFetch(single);
    await expect(getTrainArrivals('30960', { fetch })).resolves.toHaveLength(1);
  });

  it('reports a non-JSON body rather than throwing a SyntaxError', async () => {
    const { fetch } = stubFetch(null, { text: '<html>Access denied</html>' });
    await expect(getTrainArrivals('30960', { fetch })).rejects.toBeInstanceOf(CtaApiError);
  });
});
