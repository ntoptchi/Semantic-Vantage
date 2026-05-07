interface WildfireLegendProps {
  visible: boolean;
  fireCount: number;
  sourceLabel: string;
  error?: string | null;
}

const CONFIDENCE_STOPS = [
  { label: "High", color: "#f97373" },
  { label: "Nominal", color: "#fdba74" },
  { label: "Low", color: "#fef08a" },
  { label: "Unknown", color: "#e5e7eb" },
];

export function WildfireLegend({ visible, fireCount, sourceLabel, error }: WildfireLegendProps) {
  if (!visible) return null;

  return (
    <div className="control-card wildfire-legend">
      <label className="control-label">Wildfire Hotspots</label>
      <div className="legend-gradient">
        {CONFIDENCE_STOPS.map((s) => (
          <div key={s.label} className="legend-stop">
            <div
              className="legend-color fire-legend-dot"
              style={{ backgroundColor: s.color }}
            />
            <span className="legend-label">{s.label} Confidence</span>
          </div>
        ))}
      </div>
      <div className="legend-text">
        <div className="legend-meta">
          <div className="legend-meta-line">
            <span className="legend-label-meta">Detections</span>
            <span className="legend-value-meta">{fireCount}</span>
          </div>
          <div className="legend-meta-line">
            <span className="legend-label-meta">Source</span>
            <span className="legend-value-meta">
              {sourceLabel === "mock" ? "Sample data" : "NASA FIRMS"}
            </span>
          </div>
          <div className="legend-note">
            {error
              ? `Error loading fires: ${error}`
              : fireCount === 0
              ? "No recent hotspots in the last few days."
              : "Click a hotspot to inspect detection metadata."}
          </div>
        </div>
      </div>
    </div>
  );
}
