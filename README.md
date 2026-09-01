# cta-tracker

Arrival lookups for a CTA bus stop and a CTA train stop, in TypeScript. Both
APIs are normalized to one `Arrival` shape so callers don't branch on mode.

## Setup

```sh
npm install
cp .env.example .env   # then paste your keys
npm test
npm run build
```

The two trackers issue **separate** keys:

| Variable        | API           | Where to apply                                                 |
| --------------- | ------------- | -------------------------------------------------------------- |
| `CTA_TRAIN_KEY` | Train Tracker | <https://www.transitchicago.com/developers/traintrackerapply/> |
| `CTA_BUS_KEY`   | Bus Tracker   | <https://www.transitchicago.com/developers/bustracker/>        |

## Library

```ts
import { getBusArrivals, getTrainArrivals } from 'cta-tracker';

const train = await getTrainArrivals('40760'); // Granville, both platforms
const bus = await getBusArrivals(['14444', '1033']); // Broadway & Sheridan at Granville

[...train, ...bus].forEach((a) => {
  console.log(`${a.route} to ${a.destination}: ${a.minutesUntil} min`);
});
```

Both accept the same options: `limit`, `routes`, `timeoutMs`, `fetch`.

Train stop ids are interpreted by range — `4xxxx` is a parent station (every
platform), `3xxxx` is one directional platform. Pass `{ mapid }` or `{ stpid }`
to be explicit. Bus lookups take up to ten stop ids at once.

## CLI

```sh
node --env-file=.env dist/cli.js train 40760
node --env-file=.env dist/cli.js bus 14444 1033 --route 36
node --env-file=.env dist/cli.js bus 14444 1033
node --env-file=.env dist/cli.js train 40760 --json
```

Multi-stop lookups are grouped under one heading per stop:

```
Sheridan & Granville
    Due 10:06 AM  151 Southbound to Union Station
 10 min 10:14 AM  147 Southbound to Congress Plaza

Broadway & Granville
 11 min 10:15 AM  36 Southbound to LaSalle Metra Station
```

## The `Arrival` shape

| Field                         | Notes                                                    |
| ----------------------------- | -------------------------------------------------------- |
| `mode`                        | `'bus'` or `'train'`                                     |
| `stopName`                    | station or stop display name                             |
| `route`                       | `"Red"`, `"Brn"`, `"20"`, `"X49"`                        |
| `destination`                 | destination sign text                                    |
| `direction`                   | buses only (`"Westbound"`)                               |
| `arrivalTime` / `generatedAt` | `Date`                                                   |
| `minutesUntil`                | floored, never negative                                  |
| `isApproaching`               | train `isApp`, or bus countdown of `"DUE"`               |
| `isDelayed`                   |                                                          |
| `isScheduled`                 | train only; a scheduled departure, not a live prediction |
| `vehicleId`                   | train run number or bus vehicle id                       |

## Things the APIs do that this package smooths over

- **Errors arrive with HTTP 200.** The train API puts them in `ctatt.errCd`, the
  bus API in a `bustime-response.error[]` array. Both become a `CtaApiError`.
- **Bus "errors" aren't always errors.** `No service scheduled` for a stop is a
  normal empty result, so it returns `[]` instead of throwing — but only when
  there are no predictions at all, since errors and predictions can arrive
  together for a multi-stop request.
- **Timestamps carry no zone.** Everything is naive Chicago local time
  (`2015-04-30T20:23:32`, `20250421 16:04`) and is resolved against
  `America/Chicago`, DST included.
- **Schedule-based train entries report run number `"0"`** and no position;
  `vehicleId` is left undefined for those.
- **A single train prediction may come back as an object, not an array.**

## Sources

- Train Tracker API: <https://www.transitchicago.com/developers/ttdocs/>
- Bus Tracker API v3 (rev. 2025-04-21):
  <https://www.transitchicago.com/assets/1/6/cta_Bus_Tracker_API_Developer_Guide_and_Documentation_2025-04-21.pdf>
