import { TRAIN_ARRIVALS_URL, resolveKey } from './config.js';
import { CtaApiError } from './errors.js';
import { buildUrl, getJson } from './http.js';
import { minutesBetween, parseTrainTimestamp } from './time.js';
import type { Arrival, RequestOptions } from './types.js';

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
    vehicleId: raw.rn && raw.rn !== '0' ? raw.rn : undefined,
  };
}

/**
 * Arrival predictions for a train platform stop id (`stpid`).
 *
 * Results are sorted soonest-first; the API does not guarantee an order when a
 * platform serves several lines.
 */
export async function getTrainArrivalsForKey(stopId: string | number, key: string, options: RequestOptions = {}): Promise<Arrival[]> {
  const stpid = String(stopId).trim();
  if (!/^\d+$/.test(stpid)) throw new TypeError(`Train stop id must be numeric, got "${stpid}"`);

  const url = buildUrl(TRAIN_ARRIVALS_URL, {
    key,
    stpid,
    max: options.limit,
    rt: options.routes?.join(','),
    outputType: 'JSON',
  });

  const body = await getJson<RawTrainResponse>('train', url, { timeoutMs: options.timeoutMs, fetch: options.fetch });

  const ctatt = body.ctatt;
  if (!ctatt) throw new CtaApiError('train', 'Malformed response: missing ctatt element');
  // The train API reports failures in the body with HTTP 200; errCd "0" is success.
  if (ctatt.errCd !== undefined && ctatt.errCd !== '0') {
    throw new CtaApiError('train', ctatt.errNm ?? `Train Tracker error ${ctatt.errCd}`, {
      code: ctatt.errCd,
    });
  }

  const etas = [ctatt.eta ?? []].flat();
  // Each prediction carries its own generation time, and they differ by a
  // minute or more across a busy station. Counting down from the response's
  // own clock instead keeps the countdowns ordered the same way the arrival
  // times are.
  const referenceTime =
    ctatt.tmst !== undefined
      ? parseTrainTimestamp(ctatt.tmst)
      : new Date(Math.max(...etas.map((eta) => parseTrainTimestamp(eta.prdt).getTime())));

  return etas.map((eta) => toArrival(eta, referenceTime)).sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
}

export async function getTrainArrivals(stopId: string | number, options: RequestOptions = {}): Promise<Arrival[]> {
  return getTrainArrivalsForKey(stopId, resolveKey('train'), options);
}
