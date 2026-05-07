import { useCallback } from "react";
import type { NDVILayer } from "../types/ndvi";

interface LayerControlsProps {
  layers: NDVILayer[];
  selectedLayerId: string | null;
  onLayerChange: (id: string) => void;
  opacity: number;
  onOpacityChange: (val: number) => void;
  visible: boolean;
  onToggleVisible: () => void;
  loading: boolean;
  firesVisible: boolean;
  onToggleFires: () => void;
  firesLoading: boolean;
  compareMode: boolean;
  onToggleCompare: () => void;
  beforeDate: string;
  afterDate: string;
  onBeforeDateChange: (d: string) => void;
  onAfterDateChange: (d: string) => void;
  floodVisible: boolean;
  onToggleFlood: () => void;
  floodOpacity: number;
  onFloodOpacityChange: (val: number) => void;
  alertsVisible: boolean;
  onToggleAlerts: () => void;
  alertsLoading: boolean;
  alertCount: number;
}

export function LayerControls({
  layers,
  selectedLayerId,
  onLayerChange,
  opacity,
  onOpacityChange,
  visible,
  onToggleVisible,
  loading,
  firesVisible,
  onToggleFires,
  firesLoading,
  compareMode,
  onToggleCompare,
  beforeDate,
  afterDate,
  onBeforeDateChange,
  onAfterDateChange,
  floodVisible,
  onToggleFlood,
  floodOpacity,
  onFloodOpacityChange,
  alertsVisible,
  onToggleAlerts,
  alertsLoading,
  alertCount,
}: LayerControlsProps) {
  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onLayerChange(e.target.value);
    },
    [onLayerChange]
  );

  const handleOpacity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onOpacityChange(Number(e.target.value));
    },
    [onOpacityChange]
  );

  return (
    <div className="control-card layer-controls">
      <label className="control-label">NDVI Layer</label>

      {loading ? (
        <div className="loading-text">Loading layers...</div>
      ) : layers.length === 0 ? (
        <div className="loading-text">No NDVI layers found</div>
      ) : (
        <select
          className="select-input"
          value={selectedLayerId ?? ""}
          onChange={handleSelect}
        >
          <option value="">Select layer...</option>
          {layers.map((l) => (
            <option key={l.identifier} value={l.identifier}>
              {l.title}
            </option>
          ))}
        </select>
      )}

      <div className="control-row">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={visible}
            onChange={onToggleVisible}
            className="toggle-input"
          />
          <span className="toggle-text">Show NDVI</span>
        </label>
      </div>

      <div className="control-row">
        <label className="control-sublabel">Opacity</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={handleOpacity}
          className="slider"
        />
        <span className="opacity-value">{Math.round(opacity * 100)}%</span>
      </div>

      <div className="layer-divider" />
      <label className="control-label">Vegetation Compare</label>

      <div className="control-row">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={onToggleCompare}
            className="toggle-input"
          />
          <span className="toggle-text">Compare Mode</span>
        </label>
      </div>

      {compareMode && (
        <div className="compare-dates">
          <div className="compare-date-row">
            <label className="control-sublabel">Before</label>
            <input
              type="date"
              className="date-input"
              value={beforeDate}
              onChange={(e) => onBeforeDateChange(e.target.value)}
            />
          </div>
          <div className="compare-date-row">
            <label className="control-sublabel">After</label>
            <input
              type="date"
              className="date-input"
              value={afterDate}
              onChange={(e) => onAfterDateChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="layer-divider" />
      <label className="control-label">Flood / Water Extent</label>

      <div className="control-row">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={floodVisible}
            onChange={onToggleFlood}
            className="toggle-input"
          />
          <span className="toggle-text">Show Flood Layer</span>
        </label>
      </div>

      {floodVisible && (
        <div className="control-row">
          <label className="control-sublabel">Opacity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={floodOpacity}
            onChange={(e) => onFloodOpacityChange(Number(e.target.value))}
            className="slider"
          />
          <span className="opacity-value">{Math.round(floodOpacity * 100)}%</span>
        </div>
      )}

      <div className="layer-divider" />
      <label className="control-label">Vegetation Loss Alerts</label>

      <div className="control-row">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={alertsVisible}
            onChange={onToggleAlerts}
            className="toggle-input"
            disabled={alertsLoading}
          />
          <span className="toggle-text">
            {alertsLoading
              ? "Scanning…"
              : alertsVisible
                ? `${alertCount} alert${alertCount !== 1 ? "s" : ""}`
                : "Scan Viewport"}
          </span>
        </label>
      </div>

      <div className="layer-divider" />
      <label className="control-label">Wildfire Hotspots</label>

      <div className="control-row">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={firesVisible}
            onChange={onToggleFires}
            className="toggle-input"
            disabled={firesLoading}
          />
          <span className="toggle-text">
            {firesLoading ? "Loading fires…" : "Show Hotspots"}
          </span>
        </label>
      </div>
    </div>
  );
}
