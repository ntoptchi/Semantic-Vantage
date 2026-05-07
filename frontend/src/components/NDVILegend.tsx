import type { NDVILayer } from "../types/ndvi";

const LEGEND_STOPS = [
  { value: -0.2, color: "#d73027", label: "-0.2 (Bare)" },
  { value: 0.0, color: "#fee08b", label: "0.0" },
  { value: 0.2, color: "#d9ef8b", label: "0.2" },
  { value: 0.4, color: "#66bd63", label: "0.4" },
  { value: 0.6, color: "#1a9850", label: "0.6" },
  { value: 0.8, color: "#006837", label: "0.8+ (Dense)" },
];

interface NDVILegendProps {
  selectedLayer: NDVILayer | null;
  activeDate: string | null;
}

export function NDVILegend({ selectedLayer, activeDate }: NDVILegendProps) {
  return (
    <div className="control-card ndvi-legend">
      <label className="control-label">NDVI Legend</label>
      <div className="legend-gradient">
        {LEGEND_STOPS.map((s, i) => (
          <div key={i} className="legend-stop">
            <div
              className="legend-color"
              style={{ backgroundColor: s.color }}
            />
            <span className="legend-label">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="legend-text">
        <div className="legend-row">
          <span className="legend-label">Low vegetation</span>
          <span className="legend-label">High vegetation</span>
        </div>
        <div className="legend-meta">
          <div className="legend-meta-line">
            <span className="legend-label-meta">Layer</span>
            <span className="legend-value-meta">
              {selectedLayer ? selectedLayer.title : "None selected"}
            </span>
          </div>
          <div className="legend-meta-line">
            <span className="legend-label-meta">Imagery date</span>
            <span className="legend-value-meta">
              {activeDate ?? "—"}
            </span>
          </div>
          <div className="legend-note">
            8‑day NDVI products snap to the nearest available date, not every calendar day.
          </div>
        </div>
      </div>
    </div>
  );
}
