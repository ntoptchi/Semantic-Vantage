export type IntelligenceKind = "wildfire" | "vegetation_loss" | "flood";

export type IntelligenceSeverity = "severe" | "moderate" | "mild" | "info";

export interface IntelligenceItem {
  id: string;
  kind: IntelligenceKind;
  title: string;
  subtitle: string;
  severity: IntelligenceSeverity;
  lat: number;
  lon: number;
  confidence?: number | null;
  timestamp?: string | null;
  metadata?: Record<string, string | number | null>;
}
