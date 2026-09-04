import type { Arrival, TransitOption } from '@cta-tracker/lib';
import { LINE_DATA, STOPS } from './constants';

const REFRESH_SECONDS = 45;

type GetArrivals = (mode: TransitOption, stopId: string) => Promise<Arrival[]>;

function minutesUntil(arrival: Arrival): string {
  if (arrival.isApproaching) return 'Due';
  return `${Math.max(0, Math.floor((arrival.arrivalTime.getTime() - Date.now()) / 60_000))} min`;
}

function renderIcon(arrival: Arrival): string {
  if (arrival.mode === 'bus') {
    return `<span aria-hidden="true" style="margin-right: 0.35rem;">🚌</span>`;
  }

  const lineInfo = LINE_DATA[arrival.route.toLowerCase()] ?? LINE_DATA['unknown'];

  return `<span role="img" aria-label="${arrival.route}" style="color: ${lineInfo.color}; margin-right: 0.35rem;">■</span>`;
}

function renderArrival(arrival: Arrival): string {
  const route = arrival.direction ? `${arrival.route} ${arrival.direction}` : arrival.route;
  return `<li>${renderIcon(arrival)}<span>${arrival.destination} - ${minutesUntil(arrival)}</span></li>`;
}

export async function handleHome(getArrivals: GetArrivals): Promise<Response> {
  const sections = await Promise.all(
    STOPS.map(async ({ label, transitType, stopId }) => {
      const arrivals = (await getArrivals(transitType, stopId)).sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
      const list = arrivals.length > 0 ? `<ul>${arrivals.map(renderArrival).join('')}</ul>` : '<p>No arrivals predicted.</p>';
      return `<h2>${label}</h2>${list}`;
    }),
  );

  return new Response(
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="${REFRESH_SECONDS}">
  <title>CTA arrivals near Granville</title>
</head>
<body>
  <h1>CTA arrivals near Granville</h1>
  <p>Refreshes every ${REFRESH_SECONDS} seconds.</p>
  ${sections.join('\n  ')}
</body>
</html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}
