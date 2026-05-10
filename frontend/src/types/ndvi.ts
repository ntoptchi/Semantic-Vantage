export interface NDVILayer {
  identifier: string;
  title: string;
  format: string;
  style: string;
  tile_matrix_set_id: string;
  time_start: string | null;
  time_end: string | null;
  time_default: string | null;
}

export interface CapabilitiesResponse {
  layers: NDVILayer[];
  fetched_at: string;
}

export interface PointResponse {
  lat: number;
  lon: number;
  date: string;
  layer: string;
  ndvi: number | null;
  raw_pixel: number[] | null;
  notes: string;
  vegetation_class: string | null;
  confidence_note: string | null;
  confidence_percent: number | null;
}

export interface PointSeriesItem {
  date: string;
  ndvi: number | null;
}

export interface PointSeriesResponse {
  series: PointSeriesItem[];
}

export interface PolygonStatsRequest {
  polygon: GeoJSON.Geometry;
  date: string;
  layer: string;
  sample_count?: number;
}

export interface PolygonStatsResponse {
  mean: number | null;
  min: number | null;
  max: number | null;
  sample_count: number;
  valid_samples: number;
  notes: string;
}

export interface ComparePointResponse {
  lat: number;
  lon: number;
  layer: string;
  before_date: string;
  after_date: string;
  before_class: string | null;
  after_class: string | null;
  before_confidence: number | null;
  after_confidence: number | null;
  change: string;
  confidence: number | null;
  notes: string;
}

export interface CompareStatsRequest {
  polygon: GeoJSON.Geometry;
  layer: string;
  before_date: string;
  after_date: string;
  sample_count?: number;
}

export interface CompareStatsResponse {
  before_date: string;
  after_date: string;
  before_class: string | null;
  after_class: string | null;
  change: string;
  before_valid: number;
  after_valid: number;
  sample_count: number;
  notes: string;
}

export interface LossAlert {
  lat: number;
  lon: number;
  severity: "severe" | "moderate" | "mild";
  before_class: string | null;
  after_class: string | null;
  change: string;
  confidence: number | null;
}

export interface LossAlertsResponse {
  before_date: string;
  after_date: string;
  alerts: LossAlert[];
  grid_size: number;
  sampled: number;
  notes: string;
}
