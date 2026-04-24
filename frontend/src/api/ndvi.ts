import { api } from "./client";
import type {
  CapabilitiesResponse,
  ComparePointResponse,
  CompareStatsRequest,
  CompareStatsResponse,
  LossAlertsResponse,
  PointResponse,
  PointSeriesResponse,
  PolygonStatsRequest,
  PolygonStatsResponse,
} from "../types/ndvi";

export async function fetchCapabilities(): Promise<CapabilitiesResponse> {
  return api.get<CapabilitiesResponse>("/gibs/capabilities");
}

export async function fetchPointNDVI(
  lat: number,
  lon: number,
  date: string,
  layer: string
): Promise<PointResponse> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    date,
    layer,
  });
  return api.get<PointResponse>(`/ndvi/point?${params}`);
}

export async function fetchPointNDVISeries(
  lat: number,
  lon: number,
  layer: string,
  count: number = 8
): Promise<PointSeriesResponse> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    layer,
    count: count.toString(),
  });
  return api.get<PointSeriesResponse>(`/ndvi/point/series?${params}`);
}

export async function fetchPolygonStats(
  req: PolygonStatsRequest
): Promise<PolygonStatsResponse> {
  return api.post<PolygonStatsResponse>("/ndvi/stats", req);
}

export async function fetchComparePoint(
  lat: number,
  lon: number,
  layer: string,
  beforeDate: string,
  afterDate: string
): Promise<ComparePointResponse> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    layer,
    before: beforeDate,
    after: afterDate,
  });
  return api.get<ComparePointResponse>(`/ndvi/compare?${params}`);
}

export async function fetchCompareStats(
  req: CompareStatsRequest
): Promise<CompareStatsResponse> {
  return api.post<CompareStatsResponse>("/ndvi/compare/stats", req);
}

export async function fetchLossAlerts(
  bbox: [number, number, number, number],
  before: string,
  after: string,
  layer: string,
  gridSize?: number
): Promise<LossAlertsResponse> {
  const params = new URLSearchParams({
    bbox: bbox.join(","),
    before,
    after,
    layer,
  });
  if (gridSize != null) params.set("grid_size", gridSize.toString());
  return api.get<LossAlertsResponse>(`/ndvi/loss-alerts?${params}`);
}
