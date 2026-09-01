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

| Variable | API | Where to apply |
| --- | --- | --- |
| `CTA_TRAIN_KEY` | Train Tracker | <https://www.transitchicago.com/developers/traintrackerapply/> |
| `CTA_BUS_KEY` | Bus Tracker | <https://www.transitchicago.com/developers/bustracker/> |

## Library

```ts
import { getBusArrivals, getTrainArrivals } from 'cta-tracker';

const train = await getTrainArrivals('40380');        // Clark/Lake, all platforms
const bus = await getBusArrivals('456');              // Madison & Jefferson

for (const a of [...train, ...bus]) {
  console.log(`${a.route} to ${a.destination}: ${a.minutesUntil} min`);
}
```

Both accept the same options: `key`, `limit`, `routes`, `timeoutMs`, `fetch`.

Train stop ids are interpreted by range — `4xxxx` is a parent station (every
platform), `3xxxx` is one directional platform. Pass `{ mapid }` or `{ stpid }`
to be explicit. Bus lookups take up to ten stop ids at once.

## CLI

```sh
node --env-file=.env dist/cli.js train 40380
node --env-file=.env dist/cli.js bus 456 --limit 5 --route 20
node --env-file=.env dist/cli.js train 40380 --json
```

```
Clark/Lake
    Due 8:25 PM  Brn to Kimball (scheduled)
  9 min 8:32 PM  G to Harlem/Lake
```

## The `Arrival` shape

| Field | Notes |
| --- | --- |
| `mode` | `'bus'` or `'train'` |
| `stopName` | station or stop display name |
| `route` | `"Red"`, `"Brn"`, `"20"`, `"X49"` |
| `destination` | destination sign text |
| `direction` | buses only (`"Westbound"`) |
| `arrivalTime` / `generatedAt` | `Date` |
| `minutesUntil` | floored, never negative |
| `isApproaching` | train `isApp`, or bus countdown of `"DUE"` |
| `isDelayed` | |
| `isScheduled` | train only; a scheduled departure, not a live prediction |
| `vehicleId` | train run number or bus vehicle id |

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
