import { CtaApiError, getBusArrivalsForKey, getTrainArrivalsForKey } from '@cta-tracker/lib';
import type { Arrival, TransitOption } from '@cta-tracker/lib';

const CACHE_TTL_SECONDS = 60;
const CTA_FETCH_LIMIT = 20;
const DEFAULT_RESPONSE_LIMIT = 3;
const MAX_RESPONSE_LIMIT = 20;

interface CachedStopEntry {
  fetchedAt: string;
  arrivals: Arrival[];
}

interface DeviceArrival {
  mode: TransitOption;
  stopName: string;
  route: string;
  destination: string;
  direction?: string;
  arrivalTime: string;
  minutesUntil: number;
  generatedAt: string;
  approaching: boolean;
  delayed: boolean;
  scheduled: boolean;
  vehicleId?: string;
}

interface DeviceResponse {
  mode: TransitOption;
  stopId: string;
  updatedAt: string;
  cachedForSeconds: number;
  cached: boolean;
  arrivals: DeviceArrival[];
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function parseRoutes(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((route) => route.trim())
    .filter((route) => route.length > 0);
}

function parseLimit(value: string | null): number {
  if (value === null) return DEFAULT_RESPONSE_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('limit must be a positive integer');
  return Math.min(limit, MAX_RESPONSE_LIMIT);
}

function parseMode(value: string | null): TransitOption {
  if (value === 'bus' || value === 'train') return value;
  throw new TypeError('mode must be "bus" or "train"');
}

function parseStopId(value: string | null): string {
  const stopId = (value ?? '').trim();
  if (!/^\d+$/.test(stopId)) throw new TypeError('stopId must be numeric');
  return stopId;
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
      ? await getTrainArrivalsForKey(stopId, env.CTA_TRAIN_KEY, { limit: CTA_FETCH_LIMIT })
      : await getBusArrivalsForKey(stopId, env.CTA_BUS_KEY, { limit: CTA_FETCH_LIMIT });

  return { fetchedAt: new Date().toISOString(), arrivals };
}

function minutesUntil(now: Date, arrivalTime: Date): number {
  return Math.max(0, Math.floor((arrivalTime.getTime() - now.getTime()) / 60_000));
}

function toDeviceArrival(now: Date): (arrival: Arrival) => DeviceArrival {
  return (arrival) => ({
    mode: arrival.mode,
    stopName: arrival.stopName,
    route: arrival.route,
    destination: arrival.destination,
    direction: arrival.direction,
    arrivalTime: arrival.arrivalTime.toISOString(),
    minutesUntil: minutesUntil(now, arrival.arrivalTime),
    generatedAt: arrival.generatedAt.toISOString(),
    approaching: arrival.isApproaching,
    delayed: arrival.isDelayed,
    scheduled: arrival.isScheduled,
    vehicleId: arrival.vehicleId,
  });
}

function filterArrivals(arrivals: Arrival[], routes: string[], limit: number): Arrival[] {
  const routeSet = new Set(routes.map((route) => route.toUpperCase()));
  return arrivals.filter((arrival) => routeSet.size === 0 || routeSet.has(arrival.route.toUpperCase())).slice(0, limit);
}

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 });
  if (url.pathname !== '/arrivals') return json({ error: 'not found' }, { status: 404 });

  try {
    const mode = parseMode(url.searchParams.get('mode'));
    const stopId = parseStopId(url.searchParams.get('stopId'));
    const routes = parseRoutes(url.searchParams.get('routes'));
    const limit = parseLimit(url.searchParams.get('limit'));
    const key = cacheKey(request, mode, stopId);
    const cachedStop = await readCachedStop(key);
    const unfiltered = cachedStop ?? (await fetchUnfilteredStop(mode, stopId, env));

    if (!cachedStop) writeCachedStop(key, unfiltered, ctx);

    const body: DeviceResponse = {
      mode,
      stopId,
      updatedAt: unfiltered.fetchedAt,
      cachedForSeconds: CACHE_TTL_SECONDS,
      cached: cachedStop !== undefined,
      arrivals: filterArrivals(unfiltered.arrivals, routes, limit).map(toDeviceArrival(new Date())),
    };

    return json(body, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, { status: 400 });
    if (error instanceof CtaApiError) return json({ error: error.message, api: error.api, code: error.code }, { status: 502 });
    throw error;
  }
}

export default {
  fetch: handleRequest,
};
