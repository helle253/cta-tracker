import { describe, expect, it } from 'vitest';

import { CtaApiError } from '../src/errors.js';
import { getTrainArrivals, toTrainStop } from '../src/train.js';
import { chicagoTime, fixture, stubFetch } from './helpers.js';

const KEY = { key: 'test-key' };

describe('toTrainStop', () => {
  it('treats a 4xxxx id as a parent station', () => {
    expect(toTrainStop(40380)).toEqual({ mapid: '40380' });
  });

  it('treats a 3xxxx id as a single platform', () => {
    expect(toTrainStop('30185')).toEqual({ stpid: '30185' });
  });

  it('passes an explicit stop through untouched', () => {
    expect(toTrainStop({ stpid: '40380' })).toEqual({ stpid: '40380' });
  });

  it('rejects a non-numeric id', () => {
    expect(() => toTrainStop('Belmont')).toThrow(TypeError);
  });
});

describe('getTrainArrivals', () => {
  it('requests JSON output for the given station', async () => {
    const { fetch, calls } = stubFetch(fixture('train-arrivals'));
    await getTrainArrivals('40960', { ...KEY, fetch, limit: 5, routes: ['Org', 'Red'] });

    const url = new URL(calls[0]!);
    expect(url.origin + url.pathname).toBe('https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'test-key',
      mapid: '40960',
      max: '5',
      rt: 'Org,Red',
      outputType: 'JSON',
    });
  });

  it('normalizes predictions and sorts them soonest-first', async () => {
    const { fetch } = stubFetch(fixture('train-arrivals'));
    const arrivals = await getTrainArrivals('40960', { ...KEY, fetch });

    expect(arrivals).toHaveLength(2);
    expect(arrivals[0]).toMatchObject({
      mode: 'train',
      stopName: 'Pulaski',
      route: 'Org',
      destination: 'Midway',
      minutesUntil: 2,
      isApproaching: true,
      isDelayed: true,
      isScheduled: true,
    });
    // The scheduled entry carries run number "0"; there is no vehicle to name.
    expect(arrivals[0]!.vehicleId).toBeUndefined();
    expect(chicagoTime(arrivals[0]!.arrivalTime)).toBe('2015-04-30 20:25');

    expect(arrivals[1]).toMatchObject({
      destination: 'Loop',
      minutesUntil: 9,
      isApproaching: false,
      isScheduled: false,
      vehicleId: '726',
    });
  });

  it('turns an errCd body into a CtaApiError', async () => {
    const { fetch } = stubFetch(fixture('train-error'));
    await expect(getTrainArrivals('40960', { ...KEY, fetch })).rejects.toMatchObject({
      name: 'CtaApiError',
      message: 'Invalid API key',
      code: '102',
      api: 'train',
    });
  });

  it('returns an empty list when the station has no predictions', async () => {
    const { fetch } = stubFetch({ ctatt: { errCd: '0', errNm: null } });
    await expect(getTrainArrivals('40960', { ...KEY, fetch })).resolves.toEqual([]);
  });

  it('accepts a single eta object as well as an array', async () => {
    const single = { ctatt: { errCd: '0', eta: (fixture('train-arrivals') as any).ctatt.eta[0] } };
    const { fetch } = stubFetch(single);
    await expect(getTrainArrivals('40960', { ...KEY, fetch })).resolves.toHaveLength(1);
  });

  it('reports a non-JSON body rather than throwing a SyntaxError', async () => {
    const { fetch } = stubFetch(null, { text: '<html>Access denied</html>' });
    await expect(getTrainArrivals('40960', { ...KEY, fetch })).rejects.toBeInstanceOf(CtaApiError);
  });

  it('requires a key', async () => {
    const { fetch } = stubFetch(fixture('train-arrivals'));
    const saved = process.env.CTA_TRAIN_KEY;
    delete process.env.CTA_TRAIN_KEY;
    try {
      await expect(getTrainArrivals('40960', { fetch })).rejects.toThrow(/CTA_TRAIN_KEY/);
    } finally {
      if (saved !== undefined) process.env.CTA_TRAIN_KEY = saved;
    }
  });
});
