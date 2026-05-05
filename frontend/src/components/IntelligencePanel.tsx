import { useState, useMemo } from "react";
import type { FireDetection } from "../types/fire";
import type { LossAlert, NDVILayer } from "../types/ndvi";
import type { FloodLayer } from "../types/flood";
import type { CompareResult, FloodInspect, FloodPolygonStats, InspectResult, PolygonStats } from "../types/globe";
import type {
  IntelligenceItem,
  IntelligenceKind,
  IntelligenceSeverity,
} from "../types/intelligence";
import { computeHazardOutlook, type HazardLevel } from "../utils/hazardOutlook";

/* ═══ Date helpers (absorbed from DateSlider) ═══ */

const MIN_DATE = "2012-01-01";

function dateToNum(d: string): number {
  return new Date(d + "T00:00:00Z").getTime();
}

function numToDate(n: number): string {
  return new Date(n).toISOString().slice(0, 10);
}

function getMaxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const SPEED_OPTIONS = [1, 3, 7, 14];

/* ═══ Legend data ═══ */

const NDVI_GRADIENT = [
  "#d73027", "#fee08b", "#d9ef8b", "#66bd63", "#1a9850", "#006837",
];

const FLOOD_CHIPS = [
  { label: "High water presence", color: "#3b82f6" },
  { label: "Possible water", color: "#eab308" },
  { label: "No water detected", color: "#ef4444" },
];

const FIRE_CHIPS = [
  { label: "High", color: "#f97373" },
  { label: "Nominal", color: "#fdba74" },
  { label: "Low", color: "#fef08a" },
];

/* ═══ Intelligence adapter ═══ */

const SEVERITY_RANK: Record<IntelligenceSeverity, number> = {
  severe: 0,
  moderate: 1,
  mild: 2,
  info: 3,
};

const KIND_ICON: Record<IntelligenceKind, string> = {
  wildfire: "🔥",
  vegetation_loss: "🌱",
  flood: "💧",
};

function fireConfidenceToSeverity(c: string | null): IntelligenceSeverity {
  switch (c?.toLowerCase()) {
    case "high":
      return "severe";
    case "nominal":
      return "moderate";
    case "low":
      return "mild";
    default:
      return "info";
  }
}

function adaptFires(fires: FireDetection[]): IntelligenceItem[] {
  return fires.map((f) => ({
    id: `fire_${f.id}`,
    kind: "wildfire" as const,
    title: "WILDFIRE DETECTION",
    subtitle:
      [f.satellite, f.instrument].filter(Boolean).join(" / ") ||
      `${f.lat.toFixed(2)}, ${f.lon.toFixed(2)}`,
    severity: fireConfidenceToSeverity(f.confidence),
    lat: f.lat,
    lon: f.lon,
    confidence: null,
    timestamp: f.acq_date ?? null,
    metadata: {
      brightness: f.brightness,
      frp: f.frp,
      confidence: f.confidence,
      satellite: f.satellite,
      acq_date: f.acq_date,
    },
  }));
}

function adaptAlerts(alerts: LossAlert[]): IntelligenceItem[] {
  return alerts.map((a, i) => ({
    id: `alert_${i}_${a.lat}_${a.lon}`,
    kind: "vegetation_loss" as const,
    title: "VEGETATION LOSS",
    subtitle: a.change,
    severity: (["severe", "moderate", "mild"].includes(a.severity)
      ? a.severity
      : "info") as IntelligenceSeverity,
    lat: a.lat,
    lon: a.lon,
    confidence: a.confidence,
    timestamp: null,
    metadata: {
      before_class: a.before_class,
      after_class: a.after_class,
      change: a.change,
    },
  }));
}

const MAX_VISIBLE = 50;

function rankItems(items: IntelligenceItem[]): IntelligenceItem[] {
  return [...items].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const confA = a.confidence ?? -1;
    const confB = b.confidence ?? -1;
    if (confB !== confA) return confB - confA;
    if (a.timestamp && b.timestamp)
      return b.timestamp.localeCompare(a.timestamp);
    return 0;
  });
}

/* ═══ Props ═══ */

interface IntelligencePanelProps {
  fires: FireDetection[];
  firesVisible: boolean;
  alerts: LossAlert[];
  alertsVisible: boolean;
  floodVisible: boolean;
  activeNdviDate: string | null;
  activeFloodDate: string | null;
  onFlyTo: (lat: number, lon: number) => void;

  layers: NDVILayer[];
  selectedLayerId: string | null;
  selectedLayer: NDVILayer | null;
  onLayerChange: (id: string) => void;
  ndviOpacity: number;
  onNdviOpacityChange: (val: number) => void;
  ndviVisible: boolean;
  onToggleNdvi: () => void;
  layersLoading: boolean;

  compareMode: boolean;
  onToggleCompare: () => void;
  beforeDate: string;
  afterDate: string;
  onBeforeDateChange: (d: string) => void;
  onAfterDateChange: (d: string) => void;

  onToggleFlood: () => void;
  floodOpacity: number;
  onFloodOpacityChange: (val: number) => void;
  selectedFloodLayer: FloodLayer | null;
  floodLayersError: string | null;

  onToggleFires: () => void;
  firesLoading: boolean;
  firesSource: string;
  firesError: string | null;

  onToggleAlerts: () => void;
  alertsLoading: boolean;
  alertCount: number;
  inspect: InspectResult | null;
  polygonStats: PolygonStats | null;
  compareResult: CompareResult | null;
  floodInspect: FloodInspect | null;
  floodPolygonStats: FloodPolygonStats | null;

  date: string;
  onDateChange: (date: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  stepDays: number;
  onChangeStepDays: (days: number) => void;
}

/* ═══ Component ═══ */

export function IntelligencePanel({
  fires,
  firesVisible,
  alerts,
  alertsVisible,
  floodVisible,
  activeNdviDate,
  activeFloodDate,
  onFlyTo,
  layers,
  selectedLayerId,
  selectedLayer,
  onLayerChange,
  ndviOpacity,
  onNdviOpacityChange,
  ndviVisible,
  onToggleNdvi,
  layersLoading,
  compareMode,
  onToggleCompare,
  beforeDate,
  afterDate,
  onBeforeDateChange,
  onAfterDateChange,
  onToggleFlood,
  floodOpacity,
  onFloodOpacityChange,
  selectedFloodLayer,
  floodLayersError,
  onToggleFires,
  firesLoading,
  firesSource,
  firesError,
  onToggleAlerts,
  alertsLoading,
  alertCount,
  inspect,
  polygonStats,
  compareResult,
  floodInspect,
  floodPolygonStats,
  date,
  onDateChange,
  isPlaying,
  onTogglePlay,
  stepDays,
  onChangeStepDays,
}: IntelligencePanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const maxDate = getMaxDate();

  const items = useMemo(() => {
    const raw: IntelligenceItem[] = [];
    if (firesVisible) raw.push(...adaptFires(fires));
    if (alertsVisible) raw.push(...adaptAlerts(alerts));
    return rankItems(raw).slice(0, MAX_VISIBLE);
  }, [fires, firesVisible, alerts, alertsVisible]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const fireCt = firesVisible ? fires.length : 0;
  const alertCt = alertsVisible ? alerts.length : 0;
  const { severeCt, moderateCt } = useMemo(() => (
    items.reduce(
      (counts, item) => {
        if (item.severity === "severe") counts.severeCt += 1;
        if (item.severity === "moderate") counts.moderateCt += 1;
        return counts;
      },
      { severeCt: 0, moderateCt: 0 },
    )
  ), [items]);
  const hazardOutlook = useMemo(() => computeHazardOutlook({
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
  }), [
    alerts,
    alertsVisible,
    compareResult,
    fires,
    firesVisible,
    floodInspect,
    floodPolygonStats,
    floodVisible,
    inspect,
    ndviVisible,
    polygonStats,
  ]);

  function handleCardClick(item: IntelligenceItem) {
    setSelectedId((prev) => (prev === item.id ? null : item.id));
    onFlyTo(item.lat, item.lon);
  }

  const accentLevel = severeCt > 0 ? "severe" : items.length > 0 ? "active" : "idle";

  return (
    <div className="intel-panel">
      <div className={`intel-accent intel-accent-${accentLevel}`} />

      {/* ── Header ── */}
      <div className="intel-header">
        <span className="intel-header-label">SEMANTIC / VANTAGE</span>
        <div className="intel-header-meta">
          {severeCt > 0 && (
            <span className="intel-header-count intel-header-count-crit">
              <span className="intel-header-count-value">{severeCt}</span>
              <span className="intel-header-count-label">CRIT</span>
            </span>
          )}
          {moderateCt > 0 && (
            <span className="intel-header-count intel-header-count-mod">
              <span className="intel-header-count-value">{moderateCt}</span>
              <span className="intel-header-count-label">MOD</span>
            </span>
          )}
        </div>
      </div>

      <div className="intel-body">
        {/* ── ACTIVE INTELLIGENCE ── */}
        {items.length > 0 && (
          <div className="intel-section">
            <div className="intel-section-label">ACTIVE INTELLIGENCE</div>
            <div className="intel-list">
              {items.map((item) => (
                <IntelCard
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onClick={() => handleCardClick(item)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── CONTROLS ── */}
        <div className="intel-section">
          <div className="intel-section-label">CONTROLS</div>
          <div className="sb-controls">
            {/* NDVI */}
            <div className="sb-group">
              <div className="sb-row sb-row-spread">
                <label className="sb-toggle">
                  <input type="checkbox" checked={ndviVisible} onChange={onToggleNdvi} />
                  <span className={`sb-dot ${ndviVisible ? "sb-dot-green" : ""}`} />
                  <span>NDVI</span>
                </label>
                {ndviVisible && (
                  <div className="sb-opacity">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={ndviOpacity}
                      onChange={(e) => onNdviOpacityChange(Number(e.target.value))}
                    />
                    <span className="sb-opacity-val">{Math.round(ndviOpacity * 100)}%</span>
                  </div>
                )}
              </div>
              {ndviVisible && (
                <>
                  {layersLoading ? (
                    <div className="sb-note">Loading…</div>
                  ) : (
                    <select
                      className="sb-select"
                      value={selectedLayerId ?? ""}
                      onChange={(e) => onLayerChange(e.target.value)}
                    >
                      <option value="">Select layer…</option>
                      {layers.map((l) => (
                        <option key={l.identifier} value={l.identifier}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="sb-ndvi-strip">
                    <div
                      className="sb-ndvi-bar"
                      style={{
                        background: `linear-gradient(90deg, ${NDVI_GRADIENT.join(", ")})`,
                      }}
                    />
                    <div className="sb-ndvi-labels">
                      <span>LOW</span>
                      <span>HIGH</span>
                    </div>
                  </div>
                  <div className="sb-meta-row">
                    <span>{selectedLayer?.title ?? "—"}</span>
                    <span>{activeNdviDate ?? "—"}</span>
                  </div>
                </>
              )}
            </div>

            {/* Compare */}
            <div className="sb-group">
              <div className="sb-row">
                <label className="sb-toggle">
                  <input type="checkbox" checked={compareMode} onChange={onToggleCompare} />
                  <span className={`sb-dot ${compareMode ? "sb-dot-purple" : ""}`} />
                  <span>COMPARE</span>
                </label>
              </div>
              {compareMode && (
                <div className="sb-compare">
                  <div className="sb-compare-row">
                    <span className="sb-compare-label">T0</span>
                    <input
                      type="date"
                      className="sb-date-input"
                      value={beforeDate}
                      onChange={(e) => onBeforeDateChange(e.target.value)}
                    />
                  </div>
                  <div className="sb-compare-row">
                    <span className="sb-compare-label">T1</span>
                    <input
                      type="date"
                      className="sb-date-input"
                      value={afterDate}
                      onChange={(e) => onAfterDateChange(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Flood */}
            <div className="sb-group">
              <div className="sb-row sb-row-spread">
                <label className="sb-toggle">
                  <input type="checkbox" checked={floodVisible} onChange={onToggleFlood} />
                  <span className={`sb-dot ${floodVisible ? "sb-dot-blue" : ""}`} />
                  <span>FLOOD / WATER</span>
                </label>
                {floodVisible && (
                  <div className="sb-opacity">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={floodOpacity}
                      onChange={(e) => onFloodOpacityChange(Number(e.target.value))}
                    />
                    <span className="sb-opacity-val">{Math.round(floodOpacity * 100)}%</span>
                  </div>
                )}
              </div>
              {floodVisible && (
                <>
                  <div className="sb-chip-row">
                    {FLOOD_CHIPS.map((c) => (
                      <span key={c.label} className="sb-chip">
                        <span className="sb-chip-swatch" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </span>
                    ))}
                  </div>
                  <div className="sb-meta-row">
                    <span>{selectedFloodLayer?.title ?? "—"}</span>
                    <span>{activeFloodDate ?? "—"}</span>
                  </div>
                  {floodLayersError && (
                    <div className="sb-error">{floodLayersError}</div>
                  )}
                </>
              )}
            </div>

            {/* Wildfire */}
            <div className="sb-group">
              <div className="sb-row">
                <label className="sb-toggle">
                  <input
                    type="checkbox"
                    checked={firesVisible}
                    onChange={onToggleFires}
                    disabled={firesLoading}
                  />
                  <span className={`sb-dot ${firesVisible ? "sb-dot-red" : ""}`} />
                  <span>WILDFIRES</span>
                  {firesLoading && <span className="sb-status-text">LOADING</span>}
                </label>
              </div>
              {firesVisible && (
                <>
                  <div className="sb-chip-row">
                    {FIRE_CHIPS.map((c) => (
                      <span key={c.label} className="sb-chip">
                        <span className="sb-chip-circle" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </span>
                    ))}
                  </div>
                  <div className="sb-meta-row">
                    <span>{fireCt} detections</span>
                    <span>{firesSource === "mock" ? "SAMPLE" : "FIRMS"}</span>
                  </div>
                  {firesError && <div className="sb-error">{firesError}</div>}
                </>
              )}
            </div>

            {/* Alerts */}
            <div className="sb-group">
              <div className="sb-row">
                <label className="sb-toggle">
                  <input
                    type="checkbox"
                    checked={alertsVisible}
                    onChange={onToggleAlerts}
                    disabled={alertsLoading}
                  />
                  <span className={`sb-dot ${alertsVisible ? "sb-dot-orange" : ""}`} />
                  <span>VEG LOSS SCAN</span>
                  {alertsLoading ? (
                    <span className="sb-status-text">SCANNING</span>
                  ) : alertsVisible ? (
                    <span className="sb-status-count">{alertCount}</span>
                  ) : null}
                </label>
              </div>
            </div>

            {/* Date */}
            <div className="sb-group sb-group-date">
              <div className="sb-section-sub">DATE</div>
              <div className="sb-date-controls">
                <div className="sb-speed-row">
                  {SPEED_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`sb-speed-btn ${stepDays === d ? "sb-speed-active" : ""}`}
                      onClick={() => onChangeStepDays(d)}
                    >
                      {d}d
                    </button>
                  ))}
                  <button
                    className="sb-play-btn"
                    onClick={onTogglePlay}
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                </div>
                <div className="sb-slider-row">
                  <input
                    type="range"
                    className="sb-slider"
                    min={dateToNum(MIN_DATE)}
                    max={dateToNum(maxDate)}
                    step={86400000}
                    value={dateToNum(date)}
                    onChange={(e) => onDateChange(numToDate(Number(e.target.value)))}
                  />
                  <span className="sb-date-current">{date}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── STATUS ── */}
        <div className="intel-section">
          <div className="intel-section-label">STATUS</div>
          <div className="intel-summary-grid">
            <SummaryRow label="Wildfires" value={fireCt} active={firesVisible} />
            <SummaryRow label="Vegetation Loss" value={alertCt} active={alertsVisible} />
            <SummaryRow
              label="Flood"
              value={floodVisible ? "ON" : "—"}
              active={floodVisible}
            />
            <SummaryRow label="NDVI Date" value={activeNdviDate ?? "—"} />
            {activeFloodDate && (
              <SummaryRow label="Flood Date" value={activeFloodDate} />
            )}
            <div className="intel-section-label">HAZARD OUTLOOK</div>
            <SummaryRow
              label="Fire Conditions"
              value={hazardOutlook.fire ? hazardOutlook.fire.toUpperCase() : "—"}
              tone={hazardOutlook.fire}
            />
            <SummaryRow
              label="Vegetation Stress"
              value={hazardOutlook.vegetation ? hazardOutlook.vegetation.toUpperCase() : "—"}
              tone={hazardOutlook.vegetation}
            />
            <SummaryRow
              label="Water Conditions"
              value={hazardOutlook.water ? hazardOutlook.water.toUpperCase() : "—"}
              tone={hazardOutlook.water}
            />
          </div>
        </div>

        {/* ── SELECTED ── */}
        {selected && (
          <div className="intel-section">
            <div className="intel-section-label">SELECTED</div>
            <div className="intel-detail">
              <div className="intel-detail-header">
                <span className="intel-kind-icon">
                  {KIND_ICON[selected.kind]}
                </span>
                <span>{selected.title}</span>
                <SeverityBadge severity={selected.severity} />
              </div>
              <DetailRow
                label="Coordinates"
                value={`${selected.lat.toFixed(4)}, ${selected.lon.toFixed(4)}`}
              />
              {selected.confidence != null && (
                <DetailRow label="Confidence" value={`${selected.confidence}%`} />
              )}
              {selected.timestamp && (
                <DetailRow label="Timestamp" value={selected.timestamp} />
              )}
              {selected.metadata &&
                Object.entries(selected.metadata).map(([k, v]) =>
                  v != null ? (
                    <DetailRow
                      key={k}
                      label={k.replace(/_/g, " ")}
                      value={String(v)}
                    />
                  ) : null,
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ Sub-components ═══ */

function SeverityBadge({ severity }: { severity: IntelligenceSeverity }) {
  return (
    <span className={`intel-sev intel-sev-${severity}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function IntelCard({
  item,
  isSelected,
  onClick,
}: {
  item: IntelligenceItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`intel-card ${isSelected ? "intel-card-selected" : ""}`}
      onClick={onClick}
    >
      <div className="intel-card-top">
        <span className="intel-kind-icon">{KIND_ICON[item.kind]}</span>
        <span className="intel-card-title">{item.title}</span>
        <SeverityBadge severity={item.severity} />
      </div>
      <div className="intel-card-sub">{item.subtitle}</div>
      {item.confidence != null && (
        <div className="intel-card-conf">Confidence: {item.confidence}%</div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  active,
  tone,
}: {
  label: string;
  value: string | number;
  active?: boolean;
  tone?: HazardLevel;
}) {
  return (
    <div className="intel-sum-row">
      <span className="intel-sum-label">{label}</span>
      <span className={`intel-sum-value ${active ? "intel-sum-active" : ""} ${tone ? `intel-sum-value-${tone}` : ""}`}>
        {value}
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="intel-detail-row">
      <span className="intel-detail-key">{label}</span>
      <span className="intel-detail-val">{value}</span>
    </div>
  );
}
