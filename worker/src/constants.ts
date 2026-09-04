type TransitType = 'bus' | 'train';

type Stop = {
  transitType: TransitType;
  stopId: string;
  label: string;
};

export const STOPS: Array<Stop> = [
  { label: 'Granville Red Line', transitType: 'train', stopId: '30148' },
  { label: 'Granville/Broadway bus', transitType: 'bus', stopId: '14444' },
  { label: 'Granville/Sheridan bus', transitType: 'bus', stopId: '1033' },
];
