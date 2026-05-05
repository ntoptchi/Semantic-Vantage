import type { FloodLayer } from "../types/flood";

const FLOOD_STOPS = [
  { label: "High water presence", color: "#3b82f6", glow: "rgba(59,130,246,0.25)" },
  { label: "Possible water", color: "#eab308", glow: "rgba(234,179,8,0.15)" },
  { label: "No water detected", color: "#ef4444", glow: "none" },
];

interface FloodLegendProps {
  visible: boolean;
  selectedLayer: FloodLayer | null;
  activeDate: string | null;
  error?: string | null;
}

export function FloodLegend({ visible, selectedLayer, activeDate, error }: FloodLegendProps) {
  if (!visible) return null;

  return (
    <div className="control-card flood-legend">
      <label className="control-label flood-label">
        <span className="flood-label-icon">💧</span>
        Flood / Water
      </label>
      <div className="legend-gradient">
        {FLOOD_STOPS.map((s) => (
          <div key={s.label} className="legend-stop">
            <div
              className="legend-color flood-legend-chip"
              style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.glow}` }}
            />
            <span className="legend-label">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="legend-text">
        <div className="legend-meta">
          <div className="legend-meta-line">
            <span className="legend-label-meta">Layer</span>
            <span className="legend-value-meta">
              {selectedLayer ? selectedLayer.title : "—"}
            </span>
          </div>
          <div className="legend-meta-line">
            <span className="legend-label-meta">Imagery date</span>
            <span className="legend-value-meta">{activeDate ?? "—"}</span>
          </div>
          <div className="legend-note">
            {error
              ? `Error loading flood layer: ${error}`
              : "Click the map to inspect water presence, or draw a polygon for area coverage."}
          </div>
        </div>
      </div>
    </div>
  );
}
