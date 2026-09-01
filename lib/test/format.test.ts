import { describe, expect, it } from 'vitest';

import { render } from '../src/format.js';
import type { Arrival } from '../src/types.js';

function arrival(overrides: Partial<Arrival> = {}): Arrival {
  return {
    mode: 'bus',
    stopName: 'Broadway & Granville',
    route: '36',
    destination: 'LaSalle Metra Station',
    direction: 'Southbound',
    arrivalTime: new Date('2026-09-01T15:15:00Z'),
    minutesUntil: 14,
    generatedAt: new Date('2026-09-01T15:01:00Z'),
    isApproaching: false,
    isDelayed: false,
    isScheduled: false,
    ...overrides,
  };
}

describe('render', () => {
  it('says so when nothing is predicted', () => {
    expect(render([])).toBe('No arrivals predicted.');
  });

  it('groups a multi-stop request under one heading per stop', () => {
    const out = render([
      arrival(),
      arrival({ stopName: 'Sheridan & Granville', route: '151', minutesUntil: 4 }),
      arrival({ stopName: 'Broadway & Granville', minutesUntil: 27 }),
    ]);

    expect(out).toBe(
      [
        'Broadway & Granville',
        ' 14 min 10:15 AM  36 Southbound to LaSalle Metra Station',
        ' 27 min 10:15 AM  36 Southbound to LaSalle Metra Station',
        '',
        'Sheridan & Granville',
        '  4 min 10:15 AM  151 Southbound to LaSalle Metra Station',
      ].join('\n'),
    );
  });

  it('keeps the stop each arrival belongs to, not the first one seen', () => {
    const out = render([arrival(), arrival({ stopName: 'Sheridan & Granville' })]);
    expect(out).toContain('Sheridan & Granville');
    expect(out.indexOf('Broadway & Granville')).toBeLessThan(out.indexOf('Sheridan & Granville'));
  });

  it('marks an approaching train and its flags', () => {
    const out = render([
      arrival({
        mode: 'train',
        stopName: 'Granville',
        route: 'Red',
        destination: '95th/Dan Ryan',
        isApproaching: true,
        isDelayed: true,
        isScheduled: true,
        direction: undefined,
      }),
    ]);
    expect(out).toContain('    Due 10:15 AM  Red to 95th/Dan Ryan (delayed, scheduled)');
  });

  it('lines the time column up at double-digit hours', () => {
    const rows = render([
      arrival({ arrivalTime: new Date('2026-09-01T14:59:00Z') }),
      arrival({ arrivalTime: new Date('2026-09-01T15:15:00Z') }),
    ]).split('\n');
    const columns = rows.slice(1).map((row) => row.indexOf('  36'));
    expect(new Set(columns).size).toBe(1);
  });
});
