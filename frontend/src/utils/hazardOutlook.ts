import type { FireDetection } from "../types/fire";
import type {
  CompareResult,
  FloodInspect,
  FloodPolygonStats,
  InspectResult,
  PolygonStats,
} from "../types/globe";
import type { LossAlert } from "../types/ndvi";

export type HazardLevel = "severe" | "moderate" | "low" | null;

export interface HazardOutlook {
  fire: HazardLevel;
  vegetation: HazardLevel;
  water: HazardLevel;
}

interface HazardInput {
  fires: FireDetection[];
  firesVisible: boolean;
  alerts: LossAlert[];
  alertsVisible: boolean;
  ndviVisible: boolean;
  inspect: InspectResult | null;
  polygonStats: PolygonStats | null;
  compareResult: CompareResult | null;
  floodVisible: boolean;
  floodInspect: FloodInspect | null;
  floodPolygonStats: FloodPolygonStats | null;
}

function isLowVegetation(inspect: InspectResult | null, polygonStats: PolygonStats | null): boolean {
  if (inspect && !inspect.loading) {
    if (inspect.vegetation_class?.toLowerCase().includes("low")) return true;
    if (inspect.ndvi != null && inspect.ndvi < 0.2) return true;
  }

  return Boolean(polygonStats && !polygonStats.loading && polygonStats.mean != null && polygonStats.mean < 0.2);
}

function hasVegetationDecline(compareResult: CompareResult | null): boolean {
  return Boolean(compareResult && !compareResult.loading && compareResult.change?.toLowerCase().includes("decline"));
}

function normalizeWaterClass(value?: string | null): string {
  return value?.toLowerCase() ?? "";
}

export function computeHazardOutlook({
  fires,
  firesVisible,
  alerts,
  alertsVisible,
  ndviVisible,
  inspect,
  polygonStats,
  compareResult,
  floodVisible,
  floodInspect,
  floodPolygonStats,
}: HazardInput): HazardOutlook {
  const lowVegetation = isLowVegetation(inspect, polygonStats);
  const vegetationDecline = hasVegetationDecline(compareResult);

  let fire: HazardLevel = null;
  if (firesVisible) {
    const highConfidenceCount = fires.filter((fireItem) => fireItem.confidence?.toLowerCase() === "high").length;
    if (fires.length === 0) {
      fire = "low";
    } else if (fires.length >= 3 || highConfidenceCount > 0 || (fires.length >= 2 && lowVegetation)) {
      fire = "severe";
    } else {
      fire = "moderate";
    }
  }

  let vegetation: HazardLevel = null;
  if (alertsVisible || ndviVisible || compareResult || polygonStats) {
    const severeAlerts = alerts.filter((alert) => alert.severity === "severe").length;
    const moderateAlerts = alerts.length;
    if (severeAlerts >= 2 || moderateAlerts >= 4 || vegetationDecline) {
      vegetation = "severe";
    } else if (moderateAlerts > 0 || lowVegetation) {
      vegetation = "moderate";
    } else if (ndviVisible && (inspect || polygonStats)) {
      vegetation = "low";
    }
  }

  let water: HazardLevel = null;
  if (floodVisible) {
    const pointClass = normalizeWaterClass(floodInspect?.loading ? null : floodInspect?.water_class);
    const areaClass = normalizeWaterClass(floodPolygonStats?.loading ? null : floodPolygonStats?.water_class);
    const hasHighWater = pointClass.includes("high") || areaClass.includes("high");
    const hasPossibleWater = pointClass.includes("possible") || areaClass.includes("possible");
    const highCoverage = Boolean(floodPolygonStats && !floodPolygonStats.loading && (floodPolygonStats.coverage_percent ?? 0) >= 50);

    if (hasHighWater || highCoverage) {
      water = "severe";
    } else if (hasPossibleWater) {
      water = "moderate";
    } else if (floodInspect || floodPolygonStats) {
      water = "low";
    }
  }

  return { fire, vegetation, water };
}
