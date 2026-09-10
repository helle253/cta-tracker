import { describe, expect, it } from 'vitest';

import type { Arrival } from '@cta-tracker/lib';

import { STOPS } from './constants.js';
import { handleHome } from './home.js';

function arrival(route: string, destination: string): Arrival {
  return {
    mode: 'train',
    stopName: 'Granville',
    route,
    destination,
    arrivalTime: new Date(Date.now() + 5 * 60_000),
    minutesUntil: 5,
    generatedAt: new Date(),
    isApproaching: false,
    isDelayed: false,
    isScheduled: false,
  };
}

describe('handleHome', () => {
  it('renders the remaining stops when one stop fails', async () => {
    const failing = STOPS[1];
    const response = await handleHome(async (_mode, stopId) => {
      if (stopId === failing.stopId) throw new Error('CTA bus API request timed out after 10000ms');
      return [arrival('Red', 'Howard')];
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    for (const stop of STOPS) expect(html).toContain(`<h2>${stop.label}</h2>`);
    expect(html).toContain('Howard');
    expect(html).toContain('Arrivals temporarily unavailable.');
  });
});
