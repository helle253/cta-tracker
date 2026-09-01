import { beforeEach, describe, expect, it } from 'vitest';

import { getBusArrivals } from '../src/bus.js';
import { chicagoTime, fixture, stubFetch } from './helpers.js';

beforeEach(() => {
  process.env.CTA_BUS_KEY = 'test-key';
});

describe('getBusArrivals', () => {
  it('requests JSON predictions for the given stops', async () => {
    const { fetch, calls } = stubFetch(fixture('bus-predictions'));
    await getBusArrivals([456, '457'], { fetch, limit: 3, routes: ['20'] });

    const url = new URL(calls[0]!);
    expect(url.origin + url.pathname).toBe('https://www.ctabustracker.com/bustime/api/v3/getpredictions');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'test-key',
      stpid: '456,457',
      rt: '20',
      top: '3',
      format: 'json',
    });
  });

  it('normalizes predictions', async () => {
    const { fetch } = stubFetch(fixture('bus-predictions'));
    const arrivals = await getBusArrivals('456', { fetch });

    expect(arrivals).toHaveLength(2);
    expect(arrivals[0]).toMatchObject({
      mode: 'bus',
      stopName: 'Madison & Jefferson',
      route: '20',
      direction: 'Westbound',
      destination: 'Austin',
      minutesUntil: 0,
      isApproaching: true,
      isDelayed: false,
      isScheduled: false,
      vehicleId: '8184',
    });
    expect(chicagoTime(arrivals[1]!.arrivalTime)).toBe('2025-04-21 16:16');
    expect(arrivals[1]).toMatchObject({ minutesUntil: 12, isApproaching: false, isDelayed: true });
  });

  it('treats "no service scheduled" as an empty result', async () => {
    const { fetch } = stubFetch(fixture('bus-no-service'));
    await expect(getBusArrivals('456', { fetch })).resolves.toEqual([]);
  });

  it('throws on a real API error', async () => {
    const { fetch } = stubFetch(fixture('bus-bad-key'));
    await expect(getBusArrivals('456', { fetch })).rejects.toMatchObject({
      name: 'CtaApiError',
      api: 'bus',
      message: 'Invalid API access key supplied',
    });
  });

  it('keeps predictions when only some stops errored', async () => {
    const mixed = {
      'bustime-response': {
        prd: (fixture('bus-predictions') as any)['bustime-response'].prd,
        error: [{ stpid: '999', msg: 'No service scheduled' }],
      },
    };
    const { fetch } = stubFetch(mixed);
    await expect(getBusArrivals(['456', '999'], { fetch })).resolves.toHaveLength(2);
  });

  it('rejects more than ten stops before making a request', async () => {
    const { fetch, calls } = stubFetch(fixture('bus-predictions'));
    const stops = Array.from({ length: 11 }, (_, i) => i + 1);
    await expect(getBusArrivals(stops, { fetch })).rejects.toThrow(/At most 10/);
    expect(calls).toHaveLength(0);
  });

  it('surfaces an HTTP failure', async () => {
    const { fetch } = stubFetch(null, { status: 503, text: 'unavailable' });
    await expect(getBusArrivals('456', { fetch })).rejects.toMatchObject({ status: 503 });
  });
});
