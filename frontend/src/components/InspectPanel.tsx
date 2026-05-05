import type { InspectResult, InspectSeries, PolygonStats, CompareResult, ComparePolygonResult, FloodInspect, FloodPolygonStats, AlertInspect, NeutralInspect } from "../types/globe";
import type { FireDetection } from "../types/fire";

interface InspectPanelProps {
  neutralInspect: NeutralInspect | null;
  inspect: InspectResult | null;
  inspectSeries: InspectSeries | null;
  polygonStats: PolygonStats | null;
  fireInspect: FireDetection | null;
  fireImpact: import("../types/fire").FireImpact | null;
  fireImpactLoading?: boolean;
  fireImpactError?: string | null;
  compareResult: CompareResult | null;
  comparePolygon: ComparePolygonResult | null;
  floodInspect: FloodInspect | null;
  floodPolygonStats: FloodPolygonStats | null;
  alertInspect: AlertInspect | null;
  onClose: () => void;
  onDrawPolygon: () => void;
  isDrawing: boolean;
}

/* ═══ Helpers ═══ */

const CHART_HEIGHT = 70;
const CHART_NDVI_MIN = -0.2;
const CHART_NDVI_MAX = 1;

function NDVIMiniChart({ points }: { points: Array<{ date: string; ndvi: number | null }> }) {
  if (points.length === 0) return null;
  const width = 260;
  const pad = { top: 3, right: 3, bottom: 3, left: 3 };
  const pw = width - pad.left - pad.right;
  const ph = CHART_HEIGHT - pad.top - pad.bottom;
  const n = points.length;
  const sy = (v: number) =>
    pad.top + ph * (1 - (v - CHART_NDVI_MIN) / (CHART_NDVI_MAX - CHART_NDVI_MIN));
  const sx = (i: number) => pad.left + (i / Math.max(1, n - 1)) * pw;
  const pts = points
    .map((p, i) => (p.ndvi !== null ? [sx(i), sy(Math.max(CHART_NDVI_MIN, Math.min(CHART_NDVI_MAX, p.ndvi)))] as const : null))
    .filter((x): x is [number, number] => x !== null);
  const d = pts.length > 0
    ? pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ")
    : "";
  return (
    <div className="ip-chart">
      <div className="ip-chart-meta">
        <span className="ip-chart-title">LOCAL NDVI HISTORY</span>
        <span className="ip-chart-scale">8 SCENES</span>
      </div>
      <svg width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`}>
        <rect x={pad.left} y={pad.top} width={pw} height={ph} fill="rgba(0,0,0,0.3)" />
        <line x1={pad.left} y1={pad.top + ph * 0.25} x2={pad.left + pw} y2={pad.top + ph * 0.25} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1={pad.left} y1={pad.top + ph * 0.5} x2={pad.left + pw} y2={pad.top + ph * 0.5} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1={pad.left} y1={pad.top + ph * 0.75} x2={pad.left + pw} y2={pad.top + ph * 0.75} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {d && (
          <path d={d} fill="none" stroke="#34d399" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <div className="ip-chart-labels">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[n - 1]?.date ?? ""}</span>
      </div>
      <div className="ip-chart-caption">Earliest to latest local imagery samples.</div>
    </div>
  );
}

function vegetationClass(val: number | null): string {
  if (val === null) return "No data";
  if (val < 0.2) return "Low vegetation";
  if (val < 0.5) return "Moderate vegetation";
  return "High vegetation";
}

function colorForVegetationClass(label: string): string {
  if (label === "High vegetation") return "#1a9850";
  if (label === "Moderate vegetation") return "#66bd63";
  if (label === "Low vegetation") return "#fee08b";
  return "#555";
}

function ndviColor(val: number | null): string {
  if (val === null) return "#555";
  if (val < 0) return "#d73027";
  if (val < 0.2) return "#fee08b";
  if (val < 0.4) return "#d9ef8b";
  if (val < 0.6) return "#66bd63";
  return "#1a9850";
}

function changeBadgeClass(change: string): string {
  const l = change.toLowerCase();
  if (l.includes("decline")) return "decline";
  if (l.includes("increase")) return "increase";
  if (l.includes("stable")) return "stable";
  return "unknown";
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "severe": return "severity-severe";
    case "moderate": return "severity-moderate";
    case "mild": return "severity-mild";
    default: return "severity-mild";
  }
}

function waterClassColor(cls: string): string {
  if (cls.toLowerCase().includes("high")) return "#3b82f6";
  if (cls.toLowerCase().includes("possible")) return "#eab308";
  return "#ef4444";
}

function waterBadgeClass(cls: string): string {
  const l = cls.toLowerCase();
  if (l.includes("high")) return "water-high";
  if (l.includes("possible")) return "water-possible";
  return "water-none";
}

function waterClassDisplay(cls: string): string {
  const l = cls.toLowerCase();
  if (l.includes("high")) return "High water presence";
  if (l.includes("possible")) return "Possible water";
  if (l.includes("no water") || l.includes("none")) return "No water detected";
  return cls;
}

function confidenceColor(c: string | null): string {
  switch (c?.toLowerCase()) {
    case "high": return "#ef4444";
    case "nominal": return "#f97316";
    case "low": return "#facc15";
    default: return "#6b7280";
  }
}

function fmtTime(t: string | null): string {
  if (!t || t.length < 4) return t ?? "—";
  return `${t.slice(0, 2)}:${t.slice(2)}`;
}

/* ═══ Micro-components ═══ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="ip-section-label">{children}</div>;
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="ip-row">
      <span className="ip-key">{k}</span>
      <span className={`ip-val ${mono ? "ip-mono" : ""}`}>{v}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="ip-note">{children}</div>;
}

/* ═══ Component ═══ */

export function InspectPanel({
  neutralInspect,
  inspect,
  inspectSeries,
  polygonStats,
  fireInspect,
  fireImpact,
  fireImpactLoading,
  fireImpactError,
  compareResult,
  comparePolygon,
  floodInspect,
  floodPolygonStats,
  alertInspect,
  onClose,
  onDrawPolygon,
  isDrawing,
}: InspectPanelProps) {
  const hasContent = neutralInspect || inspect || polygonStats || fireInspect || compareResult || comparePolygon || floodInspect || floodPolygonStats || alertInspect;
  const contentKey = neutralInspect
    ? `neutral-${neutralInspect.lat}-${neutralInspect.lon}`
    : inspect
      ? `inspect-${inspect.lat}-${inspect.lon}-${inspect.date}-${inspect.loading ? "loading" : "ready"}`
      : polygonStats
        ? `polygon-${polygonStats.loading ? "loading" : "ready"}`
        : compareResult
          ? `compare-point-${compareResult.loading ? "loading" : "ready"}-${compareResult.before_date ?? ""}-${compareResult.after_date ?? ""}`
          : comparePolygon
            ? `compare-area-${comparePolygon.loading ? "loading" : "ready"}-${comparePolygon.before_date ?? ""}-${comparePolygon.after_date ?? ""}`
            : floodInspect
              ? `flood-point-${floodInspect.lat ?? "na"}-${floodInspect.lon ?? "na"}-${floodInspect.loading ? "loading" : "ready"}`
              : floodPolygonStats
                ? `flood-area-${floodPolygonStats.loading ? "loading" : "ready"}-${floodPolygonStats.imagery_date ?? ""}`
                : alertInspect
                  ? `alert-${alertInspect.lat}-${alertInspect.lon}-${alertInspect.severity}`
                  : fireInspect
                    ? `fire-${fireInspect.id}`
                    : "empty";

  return (
    <div className={`ip-panel ${hasContent ? "ip-open" : ""}`}>
      {/* Header */}
      <div className="ip-header">
        <span className="ip-header-label">INSPECT</span>
        <button className="ip-close" onClick={onClose}>✕</button>
      </div>

      <div className="ip-body">
        <div key={contentKey} className="ip-content">
        {/* ── Neutral Location ── */}
        {neutralInspect && (
          <div className="ip-section">
            <SectionLabel>LOCATION</SectionLabel>
            <Row k="Latitude" v={neutralInspect.lat.toFixed(4)} mono />
            <Row k="Longitude" v={neutralInspect.lon.toFixed(4)} mono />

            <SectionLabel>STATUS</SectionLabel>
            <Note>{neutralInspect.status}</Note>
            {neutralInspect.helperText && <Note>{neutralInspect.helperText}</Note>}
          </div>
        )}

        {/* ── NDVI Point ── */}
        {inspect && (
          <div className="ip-section">
            <SectionLabel>VEGETATION POINT QUERY</SectionLabel>
            {inspect.loading ? (
              <div className="ip-loading">Sampling vegetation…</div>
            ) : (
              <>
                <SectionLabel>LOCATION</SectionLabel>
                <Row k="Latitude" v={inspect.lat.toFixed(4)} mono />
                <Row k="Longitude" v={inspect.lon.toFixed(4)} mono />

                <SectionLabel>DATA SOURCE</SectionLabel>
                <Row k="Imagery date" v={inspect.date} mono />
                <Row k="Layer" v={<span className="ip-truncate">{inspect.layer}</span>} />

                <SectionLabel>CLASSIFICATION</SectionLabel>
                <Row
                  k="Vegetation"
                  v={
                    <span style={{ color: inspect.vegetation_class ? colorForVegetationClass(inspect.vegetation_class) : ndviColor(inspect.ndvi), fontWeight: 600 }}>
                      {inspect.vegetation_class ?? vegetationClass(inspect.ndvi)}
                    </span>
                  }
                />
                {inspect.confidence_percent != null && (
                  <Row k="Agreement" v={`${inspect.confidence_percent}%`} mono />
                )}

                <SectionLabel>INTERPRETATION</SectionLabel>
                <Note>NDVI-based classification from local imagery samples.</Note>
                {inspect.confidence_note && <Note>{inspect.confidence_note}</Note>}

                {inspectSeries && (
                  <>
                    <SectionLabel>TEMPORAL TREND</SectionLabel>
                    {inspectSeries.loading ? (
                      <div className="ip-loading">Loading series…</div>
                    ) : (
                      <NDVIMiniChart points={inspectSeries.points} />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── NDVI Polygon ── */}
        {polygonStats && (
          <div className="ip-section">
            <SectionLabel>AREA VEGETATION SUMMARY</SectionLabel>
            {polygonStats.loading ? (
              <div className="ip-loading">Computing…</div>
            ) : (
              <>
                <SectionLabel>CLASSIFICATION</SectionLabel>
                <Row
                  k="Level"
                  v={
                    <span style={{ color: ndviColor(polygonStats.mean), fontWeight: 600 }}>
                      {vegetationClass(polygonStats.mean)}
                    </span>
                  }
                />
                <Row k="Range" v={`${vegetationClass(polygonStats.min)} – ${vegetationClass(polygonStats.max)}`} />
                <Row k="Samples" v={`${polygonStats.valid_samples} / ${polygonStats.sample_count}`} mono />

                <SectionLabel>INTERPRETATION</SectionLabel>
                <Note>NDVI-based classification from local imagery samples.</Note>
              </>
            )}
          </div>
        )}

        {/* ── Compare Point ── */}
        {compareResult && (
          <div className="ip-section">
            <SectionLabel>VEGETATION COMPARISON</SectionLabel>
            {compareResult.loading ? (
              <div className="ip-loading">Comparing vegetation…</div>
            ) : (
              <>
                <SectionLabel>BEFORE / AFTER</SectionLabel>
                <Row
                  k={`T0 (${compareResult.before_date})`}
                  v={
                    <span style={{ color: colorForVegetationClass(compareResult.before_class ?? ""), fontWeight: 600 }}>
                      {compareResult.before_class ?? "No data"}
                    </span>
                  }
                />
                <Row
                  k={`T1 (${compareResult.after_date})`}
                  v={
                    <span style={{ color: colorForVegetationClass(compareResult.after_class ?? ""), fontWeight: 600 }}>
                      {compareResult.after_class ?? "No data"}
                    </span>
                  }
                />

                <SectionLabel>CLASSIFICATION</SectionLabel>
                <Row
                  k="Change"
                  v={<span className={`change-badge ${changeBadgeClass(compareResult.change ?? "")}`}>{compareResult.change}</span>}
                />
                {compareResult.confidence != null && (
                  <Row k="Agreement" v={`${compareResult.confidence}%`} mono />
                )}

                <SectionLabel>INTERPRETATION</SectionLabel>
                <Note>{compareResult.notes}</Note>
              </>
            )}
          </div>
        )}

        {/* ── Compare Polygon ── */}
        {comparePolygon && (
          <div className="ip-section">
            <SectionLabel>AREA VEGETATION CHANGE</SectionLabel>
            {comparePolygon.loading ? (
              <div className="ip-loading">Comparing area…</div>
            ) : (
              <>
                <SectionLabel>BEFORE / AFTER</SectionLabel>
                <Row
                  k={`T0 (${comparePolygon.before_date})`}
                  v={
                    <span style={{ color: colorForVegetationClass(comparePolygon.before_class ?? ""), fontWeight: 600 }}>
                      {comparePolygon.before_class ?? "No data"}
                    </span>
                  }
                />
                <Row
                  k={`T1 (${comparePolygon.after_date})`}
                  v={
                    <span style={{ color: colorForVegetationClass(comparePolygon.after_class ?? ""), fontWeight: 600 }}>
                      {comparePolygon.after_class ?? "No data"}
                    </span>
                  }
                />

                <SectionLabel>CLASSIFICATION</SectionLabel>
                <Row
                  k="Change"
                  v={<span className={`change-badge ${changeBadgeClass(comparePolygon.change ?? "")}`}>{comparePolygon.change}</span>}
                />
                <Row k="Samples" v={`${comparePolygon.before_valid} / ${comparePolygon.after_valid} of ${comparePolygon.sample_count}`} mono />

                <SectionLabel>INTERPRETATION</SectionLabel>
                <Note>{comparePolygon.notes}</Note>
              </>
            )}
          </div>
        )}

        {/* ── Flood Point ── */}
        {floodInspect && (
          <div className="ip-section">
            <SectionLabel>WATER PRESENCE</SectionLabel>
            {floodInspect.loading ? (
              <div className="ip-loading">Analyzing water presence…</div>
            ) : (
              <>
                {floodInspect.lat != null && (
                  <>
                    <SectionLabel>LOCATION</SectionLabel>
                    <Row k="Latitude" v={floodInspect.lat?.toFixed(4)} mono />
                    <Row k="Longitude" v={floodInspect.lon?.toFixed(4)} mono />
                  </>
                )}

                <SectionLabel>DATA SOURCE</SectionLabel>
                <Row k="Imagery date" v={floodInspect.imagery_date ?? "—"} mono />

                <SectionLabel>CLASSIFICATION</SectionLabel>
                <Row
                  k="Water class"
                  v={
                    <span className={`water-badge ${waterBadgeClass(floodInspect.water_class ?? "")}`}>
                      {waterClassDisplay(floodInspect.water_class ?? "")}
                    </span>
                  }
                />
                {floodInspect.confidence != null && (
                  <Row k="Local agreement" v={`${floodInspect.confidence}%`} mono />
                )}

                <SectionLabel>INTERPRETATION</SectionLabel>
                <Note>{floodInspect.note ?? "Water classification from local imagery samples."}</Note>
              </>
            )}
          </div>
        )}

        {/* ── Flood Polygon ── */}
        {floodPolygonStats && (
          <div className="ip-section">
            <SectionLabel>AREA WATER SUMMARY</SectionLabel>
            {floodPolygonStats.loading ? (
              <div className="ip-loading">Analyzing area…</div>
            ) : (
              <>
                <SectionLabel>DATA SOURCE</SectionLabel>
                <Row k="Imagery date" v={floodPolygonStats.imagery_date ?? "—"} mono />

                <SectionLabel>CLASSIFICATION</SectionLabel>
                <Row
                  k="Water class"
                  v={
                    <span className={`water-badge ${waterBadgeClass(floodPolygonStats.water_class ?? "")}`}>
                      {waterClassDisplay(floodPolygonStats.water_class ?? "")}
                    </span>
                  }
                />
                {floodPolygonStats.coverage_percent != null && (
                  <>
                    <Row
                      k="Area coverage"
                      v={
                        <span style={{ color: waterClassColor(floodPolygonStats.water_class ?? ""), fontWeight: 700 }}>
                          {floodPolygonStats.coverage_percent}%
                        </span>
                      }
                    />
                    <div className="ip-bar-track">
                      <div className="ip-bar-fill" style={{ width: `${Math.min(100, floodPolygonStats.coverage_percent)}%` }} />
                    </div>
                  </>
                )}
                <Row k="Samples" v={`${floodPolygonStats.valid_samples} / ${floodPolygonStats.sample_count}`} mono />

                <SectionLabel>INTERPRETATION</SectionLabel>
                <Note>{floodPolygonStats.note ?? "Water classification from local imagery samples."}</Note>
              </>
            )}
          </div>
        )}

        {/* ── Vegetation Loss Alert ── */}
        {alertInspect && (
          <div className="ip-section">
            <SectionLabel>VEGETATION LOSS ALERT</SectionLabel>

            <SectionLabel>LOCATION</SectionLabel>
            <Row k="Latitude" v={alertInspect.lat.toFixed(4)} mono />
            <Row k="Longitude" v={alertInspect.lon.toFixed(4)} mono />

            <SectionLabel>CLASSIFICATION</SectionLabel>
            <Row
              k="Severity"
              v={<span className={`severity-badge ${severityBadgeClass(alertInspect.severity)}`}>{alertInspect.severity}</span>}
            />
            <Row
              k={`T0${alertInspect.before_date ? ` (${alertInspect.before_date})` : ""}`}
              v={
                <span style={{ color: colorForVegetationClass(alertInspect.before_class ?? ""), fontWeight: 600 }}>
                  {alertInspect.before_class ?? "No data"}
                </span>
              }
            />
            <Row
              k={`T1${alertInspect.after_date ? ` (${alertInspect.after_date})` : ""}`}
              v={
                <span style={{ color: colorForVegetationClass(alertInspect.after_class ?? ""), fontWeight: 600 }}>
                  {alertInspect.after_class ?? "No data"}
                </span>
              }
            />
            <Row
              k="Change"
              v={<span className={`change-badge ${changeBadgeClass(alertInspect.change)}`}>{alertInspect.change}</span>}
            />
            {alertInspect.confidence != null && (
              <Row k="Agreement" v={`${alertInspect.confidence}%`} mono />
            )}

            <SectionLabel>INTERPRETATION</SectionLabel>
            <Note>Vegetation loss from before/after NDVI change analysis.</Note>
          </div>
        )}

        {/* ── Wildfire ── */}
        {fireInspect && (
          <div className="ip-section">
            <SectionLabel>WILDFIRE DETECTION</SectionLabel>

            <SectionLabel>LOCATION</SectionLabel>
            <Row k="Latitude" v={fireInspect.lat.toFixed(4)} mono />
            <Row k="Longitude" v={fireInspect.lon.toFixed(4)} mono />

            <SectionLabel>CLASSIFICATION</SectionLabel>
            <Row
              k="Confidence"
              v={
                <span style={{ color: confidenceColor(fireInspect.confidence), fontWeight: 700 }}>
                  {fireInspect.confidence ?? "Unknown"}
                </span>
              }
            />
            {fireInspect.brightness != null && (
              <Row k="Brightness temp" v={`${fireInspect.brightness.toFixed(1)} K`} mono />
            )}
            {fireInspect.frp != null && (
              <Row k="FRP" v={`${fireInspect.frp.toFixed(1)} MW`} mono />
            )}

            <SectionLabel>DATA SOURCE</SectionLabel>
            {(fireInspect.satellite || fireInspect.instrument) && (
              <Row k="Satellite" v={[fireInspect.satellite, fireInspect.instrument].filter(Boolean).join(" / ")} />
            )}
            {fireInspect.acq_date && (
              <Row k="Acquired" v={`${fireInspect.acq_date} ${fmtTime(fireInspect.acq_time)} UTC`} mono />
            )}
            {fireInspect.daynight && (
              <Row k="Day / Night" v={fireInspect.daynight === "D" ? "Day" : fireInspect.daynight === "N" ? "Night" : fireInspect.daynight} />
            )}

            <SectionLabel>INTERPRETATION</SectionLabel>
            <Note>
              Thermal anomaly from {fireInspect.source === "mock" ? "sample" : "FIRMS"} data. Location may represent a sub-pixel hotspot.
            </Note>

            {/* Vegetation impact sub-section */}
            <SectionLabel>VEGETATION IMPACT</SectionLabel>
            {fireImpactLoading ? (
              <div className="ip-loading">Analyzing vegetation impact…</div>
            ) : fireImpactError ? (
              <Note>Impact unavailable: {fireImpactError}</Note>
            ) : fireImpact ? (
              <>
                <Row
                  k={`T0 (${fireImpact.before_date})`}
                  v={
                    <span style={{ color: colorForVegetationClass(fireImpact.before_class ?? ""), fontWeight: 600 }}>
                      {fireImpact.before_class ?? "No data"}
                    </span>
                  }
                />
                <Row
                  k={`T1 (${fireImpact.after_date})`}
                  v={
                    <span style={{ color: colorForVegetationClass(fireImpact.after_class ?? ""), fontWeight: 600 }}>
                      {fireImpact.after_class ?? "No data"}
                    </span>
                  }
                />
                <Row
                  k="Change"
                  v={<span className={`change-badge ${changeBadgeClass(fireImpact.change)}`}>{fireImpact.change}</span>}
                />
                {fireImpact.confidence != null && (
                  <Row k="Agreement" v={`${fireImpact.confidence}%`} mono />
                )}
                <Note>NDVI change across a +/-16 day fire window.</Note>
              </>
            ) : (
              <Note>Impact analysis requires a valid acquisition date.</Note>
            )}
          </div>
        )}

        {/* ── Draw polygon ── */}
        <div className="ip-section">
          <button
            className={`ip-draw-btn ${isDrawing ? "ip-draw-active" : ""}`}
            onClick={onDrawPolygon}
          >
            {isDrawing ? "DRAWING — DOUBLE-CLICK TO FINISH" : "DRAW POLYGON"}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
