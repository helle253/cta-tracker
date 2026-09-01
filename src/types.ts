export type TransitOption = 'bus' | 'train';

/** A single predicted arrival, normalized across the bus and train APIs. */
export interface Arrival {
  mode: TransitOption;
  /** Human-readable stop or station name, as the API reports it. */
  stopName: string;
  /** Route designator: "Red", "Brn" for trains; "22", "X49" for buses. */
  route: string;
  /** Destination sign text. */
  destination: string;
  /** Compass-ish direction of travel ("Eastbound"). Buses only. */
  direction?: string;
  /** Predicted arrival/departure instant. */
  arrivalTime: Date;
  /**
   * Whole minutes until `arrivalTime`, floored and never negative, measured
   * from when the response was generated rather than from this prediction's
   * own `generatedAt` — predictions in one response are made seconds to
   * minutes apart, and a shared reference keeps countdowns in arrival order.
   */
  minutesUntil: number;
  /** When this individual prediction was generated. */
  generatedAt: Date;
  /** Train is approaching/at the platform, or bus prediction reads "DUE". */
  isApproaching: boolean;
  isDelayed: boolean;
  /** Schedule-based rather than live. Always false for buses. */
  isScheduled: boolean;
  /** Run number (train) or vehicle ID (bus). */
  vehicleId?: string;
}

export interface RequestOptions {
  /** Override the key from the environment. */
  key?: string;
  /** Limit the number of predictions returned. */
  limit?: number;
  /** Restrict to one or more routes. */
  routes?: string[];
  /** Abort the request after this many ms. Default 10000. */
  timeoutMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}
