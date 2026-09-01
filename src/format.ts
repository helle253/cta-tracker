import { CTA_TIMEZONE } from './config.js';
import type { Arrival } from './types.js';

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CTA_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
});

function formatRow(arrival: Arrival): string {
  const when = arrival.isApproaching ? 'Due' : `${arrival.minutesUntil} min`;
  const flags = [arrival.isDelayed ? 'delayed' : undefined, arrival.isScheduled ? 'scheduled' : undefined].filter(
    (flag) => flag !== undefined,
  );

  const route = arrival.direction ? `${arrival.route} ${arrival.direction}` : arrival.route;
  return [
    when.padStart(7),
    timeFormatter.format(arrival.arrivalTime).padStart(9),
    `  ${route} to ${arrival.destination}`,
    flags.length > 0 ? ` (${flags.join(', ')})` : '',
  ].join('');
}

/**
 * Render arrivals as a table, one section per stop.
 *
 * A single request can cover several bus stops, so the stop name belongs to
 * the section rather than the whole table. Stops appear in the order they
 * first show up, which keeps the soonest arrival at the top.
 */
export function render(arrivals: Arrival[]): string {
  if (arrivals.length === 0) return 'No arrivals predicted.';

  const byStop = Map.groupBy(arrivals, (arrival) => arrival.stopName);

  return [...byStop].map(([stopName, group]) => [stopName, ...group.map(formatRow)].join('\n')).join('\n\n');
}
