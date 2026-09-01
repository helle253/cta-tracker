import { CtaApiError } from '@cta-tracker/lib';

import { CACHE_TTL_SECONDS, getUnfilteredStop } from './src/cache.js';
import { handleHome } from './src/home.js';
import { parseLimit, parseMode, parseRoutes, parseStopId } from './src/parsing.js';
import { filterArrivals, toDeviceArrival, toJsonResponse } from './src/utils.js';
import { DeviceResponse } from './src/types.js';

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'GET') return toJsonResponse({ error: 'method not allowed' }, { status: 405 });

  try {
    if (url.pathname === '/') {
      return handleHome(async (mode, stopId) => {
        const { unfiltered } = await getUnfilteredStop(request, mode, stopId, env, ctx);
        return unfiltered.arrivals;
      });
    }
    if (url.pathname !== '/arrivals') return toJsonResponse({ error: 'not found' }, { status: 404 });
    const mode = parseMode(url.searchParams.get('mode'));
    const stopId = parseStopId(url.searchParams.get('stopId'));
    const routes = parseRoutes(url.searchParams.get('routes'));
    const limit = parseLimit(url.searchParams.get('limit'));
    const { cachedStop, unfiltered } = await getUnfilteredStop(request, mode, stopId, env, ctx);

    const body: DeviceResponse = {
      mode,
      stopId,
      updatedAt: unfiltered.fetchedAt,
      cachedForSeconds: CACHE_TTL_SECONDS,
      cached: cachedStop !== undefined,
      arrivals: filterArrivals(unfiltered.arrivals, routes, limit).map(toDeviceArrival(new Date())),
    };

    return toJsonResponse(body, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof TypeError) return toJsonResponse({ error: error.message }, { status: 400 });
    if (error instanceof CtaApiError) return toJsonResponse({ error: error.message, api: error.api, code: error.code }, { status: 502 });
    throw error;
  }
}

export default {
  fetch: handleRequest,
};
