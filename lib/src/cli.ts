#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { env } from 'node:process';

import { getBusArrivals } from './bus.js';
import { CtaApiError } from './errors.js';
import { render } from './format.js';
import { getTrainArrivals } from './train.js';

const USAGE = `cta — CTA arrival lookups

Usage:
  cta train <stop-id> [options]    train platform stop id (stpid)
  cta bus <stop-id>... [options]   up to 10 stop ids

Options:
  -n, --limit <n>       maximum predictions to return
  -r, --route <route>   restrict to a route (repeatable)
      --json            print raw JSON instead of a table
  -h, --help            show this help

Keys come from CTA_TRAIN_KEY and CTA_BUS_KEY. With a .env file:
  node --env-file=.env dist/cli.js train 30185
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      limit: { type: 'string', short: 'n' },
      route: { type: 'string', short: 'r', multiple: true },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const TRAIN_API_KEY = env.CTA_TRAIN_KEY;
  if (!TRAIN_API_KEY) throw new Error('missing CTA_TRAIN_KEY');
  const BUS_API_KEY = env.CTA_BUS_KEY;
  if (!BUS_API_KEY) throw new Error('missing BUS_API_KEY');

  const [mode, ...stops] = positionals;
  if (values.help || !mode) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 1;
  }
  if (mode !== 'bus' && mode !== 'train') {
    process.stderr.write(`Unknown mode "${mode}". Expected "bus" or "train".\n`);
    return 1;
  }
  if (stops.length === 0) {
    process.stderr.write(`Missing stop id. See --help.\n`);
    return 1;
  }

  const limit = values.limit === undefined ? undefined : Number(values.limit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    process.stderr.write(`--limit must be a positive integer.\n`);
    return 1;
  }

  const options = { limit, routes: values.route };

  const arrivals =
    mode === 'train' ? await getTrainArrivals(stops[0], TRAIN_API_KEY, options) : await getBusArrivals(stops, BUS_API_KEY, options);

  process.stdout.write((values.json ? JSON.stringify(arrivals, null, 2) : render(arrivals)) + '\n');
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof CtaApiError || error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
