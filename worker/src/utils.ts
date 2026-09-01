import { Arrival } from '@cta-tracker/lib';
import { DeviceArrival } from './types';

export function toJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function minutesUntil(now: Date, arrivalTime: Date): number {
  return Math.max(0, Math.floor((arrivalTime.getTime() - now.getTime()) / 60_000));
}

export function toDeviceArrival(now: Date): (arrival: Arrival) => DeviceArrival {
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

export function filterArrivals(arrivals: Arrival[], routes: string[], limit: number): Arrival[] {
  const routeSet = new Set(routes.map((route) => route.toUpperCase()));
  return arrivals.filter((arrival) => routeSet.size === 0 || routeSet.has(arrival.route.toUpperCase())).slice(0, limit);
}
