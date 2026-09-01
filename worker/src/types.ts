import { TransitOption } from '@cta-tracker/lib';

export interface DeviceArrival {
  mode: TransitOption;
  stopName: string;
  route: string;
  destination: string;
  direction?: string;
  arrivalTime: string;
  minutesUntil: number;
  generatedAt: string;
  approaching: boolean;
  delayed: boolean;
  scheduled: boolean;
  vehicleId?: string;
}

export interface DeviceResponse {
  mode: TransitOption;
  stopId: string;
  updatedAt: string;
  cachedForSeconds: number;
  cached: boolean;
  arrivals: DeviceArrival[];
}
