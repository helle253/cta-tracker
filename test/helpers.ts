import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Records the URLs requested and replies with a canned body. */
export function stubFetch(body: unknown, init: { status?: number; text?: string } = {}) {
  const calls: string[] = [];
  const fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(init.text ?? JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

export function fixture(name: string): unknown {
  const path = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Format an instant as Chicago wall-clock, so assertions ignore the runner's zone. */
export function chicagoTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
