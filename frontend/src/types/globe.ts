export interface GlobeState {
  selectedDate: string;
  ndviLayerId: string | null;
  ndviOpacity: number;
  ndviVisible: boolean;
  isPlaying: boolean;
}

export interface InspectResult {
  lat: number;
  lon: number;
  date: string;
  layer: string;
  ndvi: number | null;
  notes: string;
  loading: boolean;
  /** From backend neighborhood sampling; prefer over deriving from ndvi */
  vegetation_class?: string | null;
  confidence_note?: string | null;
  /** Majority class count / valid samples * 100 (0–100) */
  confidence_percent?: number | null;
}

export interface NeutralInspect {
  lat: number;
  lon: number;
  status: string;
  helperText?: string;
}

export interface PolygonStats {
  mean: number | null;
  min: number | null;
  max: number | null;
  sample_count: number;
  valid_samples: number;
  notes: string;
  loading: boolean;
}

export interface InspectSeries {
  loading: boolean;
  points: Array<{ date: string; ndvi: number | null }>;
}

export interface CompareResult {
  loading: boolean;
  before_date?: string;
  after_date?: string;
  before_class?: string | null;
  after_class?: string | null;
  before_confidence?: number | null;
  after_confidence?: number | null;
  change?: string;
  confidence?: number | null;
  notes?: string;
}

export interface ComparePolygonResult {
  loading: boolean;
  before_date?: string;
  after_date?: string;
  before_class?: string | null;
  after_class?: string | null;
  change?: string;
  before_valid?: number;
  after_valid?: number;
  sample_count?: number;
  notes?: string;
}

export interface FloodInspect {
  loading: boolean;
  lat?: number;
  lon?: number;
  layer?: string;
  imagery_date?: string | null;
  water_class?: string;
  confidence?: number | null;
  note?: string | null;
}

export interface FloodPolygonStats {
  loading: boolean;
  layer?: string;
  imagery_date?: string | null;
  water_class?: string;
  coverage_percent?: number | null;
  sample_count?: number;
  valid_samples?: number;
  note?: string | null;
}

export interface AlertInspect {
  lat: number;
  lon: number;
  severity: string;
  before_class: string | null;
  after_class: string | null;
  change: string;
  confidence: number | null;
  before_date?: string;
  after_date?: string;
}
