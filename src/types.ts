/** A single predicted arrival, normalized across the bus and train APIs. */
export interface Arrival {
  mode: 'bus' | 'train';
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
  /** Whole minutes from `generatedAt` until `arrivalTime`; floored, never negative. */
  minutesUntil: number;
  /** When the prediction itself was generated. */
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
