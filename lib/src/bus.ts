import { BUS_PREDICTIONS_URL } from './config.js';
import { CtaApiError } from './errors.js';
import { buildUrl, getJson } from './http.js';
import { minutesBetween, parseBusTimestamp } from './time.js';
import type { Arrival, RequestOptions } from './types.js';

/** getpredictions accepts at most ten stop ids per request. */
export const MAX_BUS_STOPS = 10;

interface RawPrediction {
  tmstmp: string;
  typ: string;
  stpid: string;
  stpnm: string;
  vid: string;
  rt: string;
  rtdir: string;
  des: string;
  prdtm: string;
  dly: boolean | string;
  prdctdn: string;
}

interface RawBusError {
  stpid?: string;
  rt?: string;
  msg?: string;
}

interface RawBusResponse {
  'bustime-response'?: {
    prd?: RawPrediction[];
    error?: RawBusError[];
  };
}

/**
 * Messages the API returns in its `error` array that simply mean "nothing is
 * coming right now". They are a normal outcome, not a failure.
 */
const EMPTY_RESULT_MESSAGES = ['no service scheduled', 'no arrival times', 'no data found for parameter'];

function isEmptyResultMessage(message: string | undefined): boolean {
  const text = (message ?? '').toLowerCase();
  return EMPTY_RESULT_MESSAGES.some((known) => text.includes(known));
}

function toArrival(raw: RawPrediction, referenceTime: Date): Arrival {
  const generatedAt = parseBusTimestamp(raw.tmstmp);
  const arrivalTime = parseBusTimestamp(raw.prdtm);
  return {
    mode: 'bus',
    stopName: raw.stpnm,
    route: raw.rt,
    destination: raw.des,
    direction: raw.rtdir,
    arrivalTime,
    minutesUntil: minutesBetween(referenceTime, arrivalTime),
    generatedAt,
    // "DUE" is what BusTime sends instead of a countdown under a minute.
    isApproaching: raw.prdctdn.trim().toUpperCase() === 'DUE',
    isDelayed: raw.dly === true || raw.dly === 'true',
    isScheduled: false,
    vehicleId: raw.vid || undefined,
  };
}

/**
 * Arrival predictions for one or more bus stops (at most ten).
 *
 * The API already returns predictions in ascending time order across all
 * requested stops.
 */
export async function getBusArrivals(
  stop: string | number | Array<string | number>,
  key: string,
  options: RequestOptions = {},
): Promise<Arrival[]> {
  const stopIds = (Array.isArray(stop) ? stop : [stop]).map((id) => String(id).trim());
  if (stopIds.length === 0) throw new TypeError('At least one bus stop id is required');
  if (stopIds.length > MAX_BUS_STOPS) {
    throw new TypeError(`At most ${MAX_BUS_STOPS} bus stop ids per request, got ${stopIds.length}`);
  }

  const url = buildUrl(BUS_PREDICTIONS_URL, {
    key,
    stpid: stopIds.join(','),
    rt: options.routes?.join(','),
    top: options.limit,
    format: 'json',
  });

  const body = await getJson<RawBusResponse>('bus', url, { timeoutMs: options.timeoutMs, fetch: options.fetch });

  const response = body['bustime-response'];
  if (!response) throw new CtaApiError('bus', 'Malformed response: missing bustime-response element');

  const predictions = response.prd ?? [];
  const errors = response.error ?? [];

  // Errors and predictions can arrive together when only some stops have
  // service, so only a response with nothing to show can be a real failure.
  if (predictions.length === 0 && errors.length > 0) {
    const fatal = errors.filter((error) => !isEmptyResultMessage(error.msg));
    if (fatal.length > 0) throw new CtaApiError('bus', fatal.map((error) => error.msg ?? 'Unknown error').join('; '));
  }

  if (predictions.length === 0) return [];

  // Count every prediction down from one clock — the freshest timestamp in the
  // response — so the countdowns stay ordered. See getTrainArrivals.
  const referenceTime = new Date(Math.max(...predictions.map((prediction) => parseBusTimestamp(prediction.tmstmp).getTime())));

  return predictions.map((prediction) => toArrival(prediction, referenceTime));
}
