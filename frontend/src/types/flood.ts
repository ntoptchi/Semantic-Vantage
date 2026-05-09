export interface FloodLayer {
  identifier: string;
  title: string;
  format: string;
  style: string;
  tile_matrix_set_id: string;
  time_start: string | null;
  time_end: string | null;
  time_default: string | null;
}

export interface FloodLayersResponse {
  layers: FloodLayer[];
}

export interface FloodPointDebug {
  center_rgba?: number[];
  avg_rgb?: number[];
  window?: number;
  total_sampled?: number;
  transparent?: number;
  class_counts?: { none: number; possible: number; high: number };
  avg_score?: number;
  zoom?: number;
  tile_col?: number;
  tile_row?: number;
  px?: number;
  py?: number;
  img_size?: number[];
}

export interface FloodPointResult {
  lat: number;
  lon: number;
  layer: string;
  imagery_date: string | null;
  water_class: string;
  confidence: number | null;
  note: string | null;
  debug: FloodPointDebug | null;
}

export interface FloodStatsRequest {
  polygon: GeoJSON.Geometry;
  date: string;
  layer: string;
  sample_count?: number;
}

export interface FloodStatsResult {
  layer: string;
  imagery_date: string | null;
  water_class: string;
  coverage_percent: number | null;
  sample_count: number;
  valid_samples: number;
  note: string | null;
}
