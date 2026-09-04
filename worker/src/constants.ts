type TransitType = 'bus' | 'train';

type LineInfo = {
  color: string;
};

export const LINE_DATA: Record<string, LineInfo> = {
  red: {
    color: '#c60c30',
  },
  blue: {
    color: '#00a1de',
  },
  brn: {
    color: '#62361b',
  },
  g: {
    color: '#009b3a',
  },
  org: {
    color: '#f9461c',
  },
  p: {
    color: '#522398',
  },
  pink: {
    color: '#e27ea6',
  },
  y: {
    color: '#f9e300',
  },
  unknown: {
    color: '#565a5c',
  },
};

type Stop = {
  transitType: TransitType;
  stopId: string;
  label: string;
};

export const STOPS: Array<Stop> = [
  { label: 'Granville Southbound Train', transitType: 'train', stopId: '30148' },
  { label: 'Granville/Broadway Southbound buses', transitType: 'bus', stopId: '14444' },
  { label: 'Granville/Sheridan Southbound buses', transitType: 'bus', stopId: '1033' },
];
