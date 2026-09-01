import { getBusArrivals, getTrainArrivals } from '@cta-tracker/lib';
import type { Arrival, TransitOption } from '@cta-tracker/lib';

export const CACHE_TTL_SECONDS = 60;
const CTA_FETCH_LIMIT = 20;

export interface CachedStopEntry {
  fetchedAt: string;
  arrivals: Arrival[];
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function cacheKey(request: Request, mode: TransitOption, stopId: string): Request {
  const url = new URL(request.url);
  url.pathname = `/__cta-cache/${mode}/${stopId}`;
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}

function reviveArrival(arrival: Arrival): Arrival {
  return {
    ...arrival,
    arrivalTime: new Date(arrival.arrivalTime),
    generatedAt: new Date(arrival.generatedAt),
  };
}

async function readCachedStop(request: Request): Promise<CachedStopEntry | undefined> {
  const response = await caches.default.match(request);
  if (!response) return undefined;
  const body = (await response.json()) as CachedStopEntry;
  return { ...body, arrivals: body.arrivals.map(reviveArrival) };
}

function writeCachedStop(request: Request, body: CachedStopEntry, ctx: ExecutionContext): void {
  const response = json(body, { headers: { 'cache-control': `public, max-age=${CACHE_TTL_SECONDS}` } });
  ctx.waitUntil(caches.default.put(request, response));
}

async function fetchUnfilteredStop(mode: TransitOption, stopId: string, env: Env): Promise<CachedStopEntry> {
  const arrivals =
    mode === 'train'
      ? await getTrainArrivals(stopId, env.CTA_TRAIN_KEY, { limit: CTA_FETCH_LIMIT })
      : await getBusArrivals(stopId, env.CTA_BUS_KEY, { limit: CTA_FETCH_LIMIT });

  return { fetchedAt: new Date().toISOString(), arrivals };
}

export async function getUnfilteredStop(
  request: Request,
  mode: TransitOption,
  stopId: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<{
  cachedStop: CachedStopEntry | undefined;
  unfiltered: CachedStopEntry;
}> {
  const key = cacheKey(request, mode, stopId);
  const cachedStop = await readCachedStop(key);
  const unfiltered = cachedStop ?? (await fetchUnfilteredStop(mode, stopId, env));

  if (!cachedStop) writeCachedStop(key, unfiltered, ctx);

  return { cachedStop, unfiltered };
}
