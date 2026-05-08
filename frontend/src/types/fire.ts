export interface FireDetection {
  id: string;
  lat: number;
  lon: number;
  confidence: string | null;
  brightness: number | null;
  satellite: string | null;
  instrument: string | null;
  acq_date: string | null;
  acq_time: string | null;
  frp: number | null;
  daynight: string | null;
  source: string | null;
}

export interface FiresResponse {
  fires: FireDetection[];
  count: number;
  source: string;
  notes: string;
}

export interface FireImpact {
  lat: number;
  lon: number;
  fire_date: string;
  before_date: string;
  after_date: string;
  before_class: string | null;
  after_class: string | null;
  change: string;
  confidence: number | null;
}
