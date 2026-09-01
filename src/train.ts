import { TRAIN_ARRIVALS_URL, resolveKey } from './config.js';
import { CtaApiError } from './errors.js';
import { buildUrl, getJson } from './http.js';
import { minutesBetween, parseTrainTimestamp } from './time.js';
import type { Arrival, RequestOptions } from './types.js';

/**
 * Which train stop to look up.
 *
 * `mapid` is a parent station (five digits, 4xxxx) and covers every platform
 * there; `stpid` is a single directional platform (3xxxx).
 */
export type TrainStop = { mapid: string | number } | { stpid: string | number };

/** Raw `eta` entry as returned by ttarrivals with `outputType=JSON`. */
interface RawEta {
  staId: string;
  stpId: string;
  staNm: string;
  stpDe: string;
  rn: string;
  rt: string;
  destSt: string;
  destNm: string;
  trDr: string;
  prdt: string;
  arrT: string;
  isApp: string;
  isSch: string;
  isDly: string;
  isFlt: string;
}

interface RawTrainResponse {
  ctatt?: {
    tmst?: string;
    errCd?: string;
    errNm?: string | null;
    eta?: RawEta | RawEta[];
  };
}

/**
 * Interpret a bare stop identifier. CTA numbers parent stations in the 4xxxx
 * range and individual platforms in the 3xxxx range, so the id says which
 * parameter it belongs to. Pass a `TrainStop` object to be explicit.
 */
export function toTrainStop(stop: TrainStop | string | number): TrainStop {
  if (typeof stop === 'object') return stop;
  const id = String(stop).trim();
  if (!/^\d+$/.test(id)) throw new TypeError(`Train stop id must be numeric, got "${id}"`);
  return id.startsWith('3') ? { stpid: id } : { mapid: id };
}

function asArray(eta: RawEta | RawEta[] | undefined): RawEta[] {
  if (eta === undefined) return [];
  return Array.isArray(eta) ? eta : [eta];
}

function toArrival(raw: RawEta, referenceTime: Date): Arrival {
  const generatedAt = parseTrainTimestamp(raw.prdt);
  const arrivalTime = parseTrainTimestamp(raw.arrT);
  return {
    mode: 'train',
    stopName: raw.staNm,
    route: raw.rt,
    destination: raw.destNm,
    arrivalTime,
    minutesUntil: minutesBetween(referenceTime, arrivalTime),
    generatedAt,
    isApproaching: raw.isApp === '1',
    isDelayed: raw.isDly === '1',
    isScheduled: raw.isSch === '1',
    // Schedule-based entries report run number "0" — there is no train yet.
    ...(raw.rn && raw.rn !== '0' ? { vehicleId: raw.rn } : {}),
  };
}

/**
 * Arrival predictions for a train station or platform.
 *
 * Results are sorted soonest-first; the API does not guarantee an order when a
 * station serves several lines.
 */
export async function getTrainArrivals(
  stop: TrainStop | string | number,
  options: RequestOptions = {},
): Promise<Arrival[]> {
  const target = toTrainStop(stop);
  const url = buildUrl(TRAIN_ARRIVALS_URL, {
    key: resolveKey('train', options.key),
    mapid: 'mapid' in target ? String(target.mapid) : undefined,
    stpid: 'stpid' in target ? String(target.stpid) : undefined,
    max: options.limit,
    rt: options.routes?.join(','),
    outputType: 'JSON',
  });

  const body = await getJson<RawTrainResponse>('train', url, {
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });

  const ctatt = body.ctatt;
  if (!ctatt) throw new CtaApiError('train', 'Malformed response: missing ctatt element');
  // The train API reports failures in the body with HTTP 200; errCd "0" is success.
  if (ctatt.errCd !== undefined && ctatt.errCd !== '0') {
    throw new CtaApiError('train', ctatt.errNm ?? `Train Tracker error ${ctatt.errCd}`, {
      code: ctatt.errCd,
    });
  }

  const etas = asArray(ctatt.eta);
  // Each prediction carries its own generation time, and they differ by a
  // minute or more across a busy station. Counting down from the response's
  // own clock instead keeps the countdowns ordered the same way the arrival
  // times are.
  const referenceTime =
    ctatt.tmst !== undefined
      ? parseTrainTimestamp(ctatt.tmst)
      : new Date(Math.max(...etas.map((eta) => parseTrainTimestamp(eta.prdt).getTime())));

  return etas
    .map((eta) => toArrival(eta, referenceTime))
    .sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
}
