import { api } from "./client";
import type {
  FloodLayersResponse,
  FloodPointResult,
  FloodStatsRequest,
  FloodStatsResult,
} from "../types/flood";

export async function fetchFloodLayers(): Promise<FloodLayersResponse> {
  return api.get<FloodLayersResponse>("/flood/layers");
}

export async function fetchFloodPoint(
  lat: number,
  lon: number,
  date: string,
  layer: string
): Promise<FloodPointResult> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    date,
    layer,
  });
  return api.get<FloodPointResult>(`/flood/point?${params}`);
}

export async function fetchFloodStats(
  req: FloodStatsRequest
): Promise<FloodStatsResult> {
  return api.post<FloodStatsResult>("/flood/stats", req);
}
