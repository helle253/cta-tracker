import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleRequest } from './worker.js';

class MemoryCache {
  private responses = new Map<string, Response>();

  async match(request: Request): Promise<Response | undefined> {
    return this.responses.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.responses.set(request.url, response.clone());
  }
}

function stubWorkerRuntime(): { ctx: ExecutionContext; waits: Promise<unknown>[] } {
  const waits: Promise<unknown>[] = [];
  const cache = new MemoryCache();
  const ctx = { waitUntil: (promise: Promise<unknown>) => waits.push(promise) } as unknown as ExecutionContext;
  vi.stubGlobal('caches', { default: cache });
  return { ctx, waits };
}

const busBody = {
  'bustime-response': {
    prd: [
      {
        tmstmp: '20250421 16:04',
        typ: 'A',
        stpid: '14444',
        stpnm: 'Sheridan & Granville',
        vid: '8184',
        rt: '147',
        rtdir: 'Southbound',
        des: 'Congress Plaza',
        prdtm: '20250421 16:14',
        dly: false,
        prdctdn: '10',
      },
      {
        tmstmp: '20250421 16:04',
        typ: 'A',
        stpid: '14444',
        stpnm: 'Sheridan & Granville',
        vid: '8185',
        rt: '151',
        rtdir: 'Southbound',
        des: 'Union Station',
        prdtm: '20250421 16:09',
        dly: false,
        prdctdn: '5',
      },
    ],
  },
};

describe('worker arrivals endpoint', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches the unfiltered stop response and filters routes per request', async () => {
    const urls: string[] = [];
    const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0]) => {
      urls.push(String(input));
      return new Response(JSON.stringify(busBody), { headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetch);

    const env = { CTA_BUS_KEY: 'bus-key', CTA_TRAIN_KEY: 'train-key' };
    const { ctx, waits } = stubWorkerRuntime();

    const first = await handleRequest(new Request('https://worker.example/arrivals?mode=bus&stopId=14444&routes=147&limit=3'), env, ctx);
    await Promise.all(waits);
    const second = await handleRequest(new Request('https://worker.example/arrivals?mode=bus&stopId=14444&routes=151&limit=3'), env, ctx);

    await expect(first.json()).resolves.toMatchObject({
      cached: false,
      arrivals: [{ route: '147', destination: 'Congress Plaza' }],
    });
    await expect(second.json()).resolves.toMatchObject({
      cached: true,
      arrivals: [{ route: '151', destination: 'Union Station' }],
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(urls[0]).toContain('stpid=14444');
    expect(urls[0]).not.toContain('rt=');
  });

  it('validates required query parameters', async () => {
    const { ctx } = stubWorkerRuntime();
    const response = await handleRequest(
      new Request('https://worker.example/arrivals?mode=bus&stopId=Belmont'),
      { CTA_BUS_KEY: 'bus-key', CTA_TRAIN_KEY: 'train-key' },
      ctx,
    );

    await expect(response.json()).resolves.toEqual({ error: 'stopId must be numeric' });
    expect(response.status).toBe(400);
  });
});
