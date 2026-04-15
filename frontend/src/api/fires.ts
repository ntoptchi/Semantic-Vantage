import { api } from "./client";
import type { FiresResponse, FireImpact } from "../types/fire";

export interface FetchFiresParams {
  bbox?: string;
  source?: string;
  days?: number;
  limit?: number;
}

export async function fetchRecentFires(
  params: FetchFiresParams = {}
): Promise<FiresResponse> {
  const qs = new URLSearchParams();
  if (params.bbox) qs.set("bbox", params.bbox);
  if (params.source) qs.set("source", params.source);
  if (params.days != null) qs.set("days", params.days.toString());
  if (params.limit != null) qs.set("limit", params.limit.toString());

  const query = qs.toString();
  return api.get<FiresResponse>(`/fires/recent${query ? `?${query}` : ""}`);
}

export async function fetchFireImpact(
  lat: number,
  lon: number,
  fireDate: string,
  layer?: string
): Promise<FireImpact> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    fire_date: fireDate,
  });
  if (layer) params.set("layer", layer);
  return api.get<FireImpact>(`/fires/impact?${params}`);
}
