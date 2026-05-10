import { useState, useCallback, useEffect, useRef } from "react";
import { GlobeViewer } from "./cesium/GlobeViewer";
import { InspectPanel } from "./components/InspectPanel";
import { IntelligencePanel } from "./components/IntelligencePanel";
import { useCapabilities } from "./hooks/useCapabilities";
import { useDatePlayer } from "./hooks/useDatePlayer";
import { useDebounce } from "./hooks/useDebounce";
import { useWildfires } from "./hooks/useWildfires";
import { useFloodLayers } from "./hooks/useFloodLayers";
import { fetchFireImpact } from "./api/fires";
import { fetchPointNDVI, fetchPointNDVISeries, fetchPolygonStats, fetchComparePoint, fetchCompareStats, fetchLossAlerts } from "./api/ndvi";
import { fetchFloodPoint, fetchFloodStats } from "./api/flood";
import type { InspectResult, InspectSeries, PolygonStats, CompareResult, ComparePolygonResult, FloodInspect, FloodPolygonStats, AlertInspect, NeutralInspect } from "./types/globe";
import type { LossAlert } from "./types/ndvi";
import type { FireDetection, FireImpact } from "./types/fire";

export default function App() {
  const { layers, loading: layersLoading } = useCapabilities();
  const { date, setDate, isPlaying, play, pause, toggle, stepDays, setStepDays } = useDatePlayer();
  const debouncedDate = useDebounce(date, 400);

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [ndviOpacity, setNdviOpacity] = useState(0.7);
  const [ndviVisible, setNdviVisible] = useState(true);
  const [lastClickedLocation, setLastClickedLocation] = useState<{ lat: number; lon: number } | null>(null);

  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [neutralInspect, setNeutralInspect] = useState<NeutralInspect | null>(null);
  const [inspectSeries, setInspectSeries] = useState<InspectSeries | null>(null);
  const [polygonStats, setPolygonStats] = useState<PolygonStats | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeNdviDate, setActiveNdviDate] = useState<string | null>(null);

  const [firesVisible, setFiresVisible] = useState(false);
  const {
    fires,
    loading: firesLoading,
    error: firesError,
    sourceLabel: firesSource,
  } = useWildfires({
    enabled: firesVisible,
  });
  const [fireInspect, setFireInspect] = useState<FireDetection | null>(null);
  const [fireImpact, setFireImpact] = useState<FireImpact | null>(null);
  const [fireImpactLoading, setFireImpactLoading] = useState(false);
  const [fireImpactError, setFireImpactError] = useState<string | null>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [beforeDate, setBeforeDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [afterDate, setAfterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparePolygon, setComparePolygon] = useState<ComparePolygonResult | null>(null);

  const { layers: floodLayers, error: floodLayersError } = useFloodLayers();
  const [floodVisible, setFloodVisible] = useState(false);
  const [floodOpacity, setFloodOpacity] = useState(0.7);
  const [activeFloodDate, setActiveFloodDate] = useState<string | null>(null);
  const [floodInspect, setFloodInspect] = useState<FloodInspect | null>(null);
  const [floodPolygonStats, setFloodPolygonStats] = useState<FloodPolygonStats | null>(null);

  const [alertsVisible, setAlertsVisible] = useState(false);
  const [alerts, setAlerts] = useState<LossAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertInspect, setAlertInspect] = useState<AlertInspect | null>(null);
  const [alertBbox, setAlertBbox] = useState<[number, number, number, number] | null>(null);
  const [alertDates, setAlertDates] = useState<{ before: string; after: string } | null>(null);
  const bboxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointInspectRequestIdRef = useRef(0);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lon: number; key: number } | null>(null);

  const selectedFloodLayer = floodLayers.length > 0 ? floodLayers[0] : null;

  // Auto-select a sensible default NDVI layer when capabilities load.
  useEffect(() => {
    if (layers.length > 0 && !selectedLayerId) {
      const preferredOrder = [
        "VIIRS_NOAA20_NDVI_8Day",
        "MODIS_Terra_NDVI_8Day",
        "VIIRS_SNPP_NDVI_8Day",
      ];

      const byId = new Map(layers.map((l) => [l.identifier, l]));
      let chosenId: string | null = null;

      for (const id of preferredOrder) {
        if (byId.has(id)) {
          chosenId = id;
          break;
        }
      }

      if (!chosenId) {
        chosenId = layers[0].identifier;
      }

      setSelectedLayerId(chosenId);
    }
  }, [layers, selectedLayerId]);

  const selectedLayer = layers.find((l) => l.identifier === selectedLayerId);

  const handleBboxChange = useCallback(
    (bbox: [number, number, number, number]) => {
      if (bboxDebounceRef.current) clearTimeout(bboxDebounceRef.current);
      bboxDebounceRef.current = setTimeout(() => {
        setAlertBbox(bbox);
      }, 1500);
    },
    []
  );

  useEffect(() => {
    if (!alertsVisible || !alertBbox || !selectedLayerId) return;

    const abortCtrl = new AbortController();
    setAlertsLoading(true);

    fetchLossAlerts(alertBbox, beforeDate, afterDate, selectedLayerId)
      .then((data) => {
        if (!abortCtrl.signal.aborted) {
          setAlerts(data.alerts);
          setAlertDates({ before: data.before_date, after: data.after_date });
          setAlertsLoading(false);
        }
      })
      .catch((err) => {
        if (!abortCtrl.signal.aborted) {
          console.error("[Loss alerts]", err);
          setAlertsLoading(false);
        }
      });

    return () => { abortCtrl.abort(); };
  }, [alertsVisible, alertBbox, beforeDate, afterDate, selectedLayerId]);

  const handleDateChange = useCallback(
    (nextDate: string) => {
      if (isPlaying) {
        pause();
      }
      setDate(nextDate);
    },
    [isPlaying, pause, setDate]
  );

  const handleAlertClick = useCallback((alert: LossAlert) => {
    setLastClickedLocation(null);
    setNeutralInspect(null);
    setInspect(null);
    setInspectSeries(null);
    setPolygonStats(null);
    setCompareResult(null);
    setComparePolygon(null);
    setFloodInspect(null);
    setFloodPolygonStats(null);
    setFireInspect(null);
    setFireImpact(null);
    setFireImpactError(null);
    setAlertInspect({
      ...alert,
      before_date: alertDates?.before,
      after_date: alertDates?.after,
    });
  }, [alertDates]);

  const handleFireClick = useCallback((fire: FireDetection) => {
    setLastClickedLocation(null);
    setNeutralInspect(null);
    setInspect(null);
    setInspectSeries(null);
    setPolygonStats(null);
    setCompareResult(null);
    setComparePolygon(null);
    setFloodInspect(null);
    setFloodPolygonStats(null);
    setAlertInspect(null);
    setFireInspect(fire);
    setFireImpact(null);
    setFireImpactError(null);

    if (!fire.acq_date) {
      return;
    }

    setFireImpactLoading(true);
    fetchFireImpact(fire.lat, fire.lon, fire.acq_date, selectedLayerId ?? undefined)
      .then((data) => {
        setFireImpact(data);
        setFireImpactLoading(false);
      })
      .catch((err) => {
        setFireImpactError(err instanceof Error ? err.message : "Failed to compute impact");
        setFireImpactLoading(false);
      });
  }, [selectedLayerId]);

  const runPointInspect = useCallback(
    async (lat: number, lon: number) => {
      const requestId = pointInspectRequestIdRef.current + 1;
      pointInspectRequestIdRef.current = requestId;

      setNeutralInspect(null);
      setInspect(null);
      setInspectSeries(null);
      setCompareResult(null);
      setComparePolygon(null);
      setFloodInspect(null);
      setFloodPolygonStats(null);

      if (floodVisible && selectedFloodLayer) {
        setFloodInspect({ loading: true });
        try {
          const data = await fetchFloodPoint(lat, lon, debouncedDate, selectedFloodLayer.identifier);
          if (pointInspectRequestIdRef.current !== requestId) return;
          setFloodInspect({
            loading: false,
            lat: data.lat,
            lon: data.lon,
            layer: data.layer,
            imagery_date: data.imagery_date,
            water_class: data.water_class,
            confidence: data.confidence,
            note: data.note,
          });
        } catch (err) {
          if (pointInspectRequestIdRef.current !== requestId) return;
          setFloodInspect({
            loading: false,
            water_class: "Error",
            note: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        }
        return;
      }

      if (compareMode && selectedLayerId) {
        setCompareResult({ loading: true });
        try {
          const data = await fetchComparePoint(lat, lon, selectedLayerId, beforeDate, afterDate);
          if (pointInspectRequestIdRef.current !== requestId) return;
          setCompareResult({
            loading: false,
            before_date: data.before_date,
            after_date: data.after_date,
            before_class: data.before_class,
            after_class: data.after_class,
            before_confidence: data.before_confidence,
            after_confidence: data.after_confidence,
            change: data.change,
            confidence: data.confidence,
            notes: data.notes,
          });
        } catch (err) {
          if (pointInspectRequestIdRef.current !== requestId) return;
          setCompareResult({
            loading: false,
            change: "Error",
            notes: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        }
        return;
      }

      if (!ndviVisible || !selectedLayerId) {
        setNeutralInspect({
          lat,
          lon,
          status: "No active analysis layer selected.",
          helperText: "Enable NDVI, Flood / Water, or Wildfire layers to inspect environmental signals.",
        });
        return;
      }

      setInspect({
        lat,
        lon,
        date: debouncedDate,
        layer: selectedLayerId,
        ndvi: null,
        notes: "",
        loading: true,
      });

      try {
        const result = await fetchPointNDVI(lat, lon, debouncedDate, selectedLayerId);
        if (pointInspectRequestIdRef.current !== requestId) return;
        setInspect({
          lat: result.lat,
          lon: result.lon,
          date: result.date,
          layer: result.layer,
          ndvi: result.ndvi,
          notes: result.notes,
          loading: false,
          vegetation_class: result.vegetation_class ?? undefined,
          confidence_note: result.confidence_note ?? undefined,
          confidence_percent: result.confidence_percent ?? undefined,
        });
        setInspectSeries({ loading: true, points: [] });
        fetchPointNDVISeries(lat, lon, selectedLayerId, 8)
          .then((data) => {
            if (pointInspectRequestIdRef.current !== requestId) return;
            setInspectSeries({ loading: false, points: data.series });
          })
          .catch(() => {
            if (pointInspectRequestIdRef.current !== requestId) return;
            setInspectSeries((prev) => (prev ? { ...prev, loading: false } : null));
          });
      } catch (err) {
        if (pointInspectRequestIdRef.current !== requestId) return;
        setInspect((prev) =>
          prev
            ? { ...prev, loading: false, notes: `Error: ${err instanceof Error ? err.message : "Unknown error"}` }
            : null
        );
        setInspectSeries(null);
      }
    },
    [afterDate, beforeDate, compareMode, debouncedDate, floodVisible, ndviVisible, selectedFloodLayer, selectedLayerId]
  );

  const handleGlobeClick = useCallback(
    (lat: number, lon: number) => {
      if (isDrawing) return;
      setLastClickedLocation({ lat, lon });
      setPolygonStats(null);
      setComparePolygon(null);
      setFloodPolygonStats(null);
      setFireInspect(null);
      setFireImpact(null);
      setFireImpactError(null);
      setAlertInspect(null);
    },
    [isDrawing]
  );

  useEffect(() => {
    if (!lastClickedLocation || isDrawing || fireInspect || alertInspect || polygonStats || comparePolygon || floodPolygonStats) {
      return;
    }

    void runPointInspect(lastClickedLocation.lat, lastClickedLocation.lon);
  }, [
    alertInspect,
    compareMode,
    comparePolygon,
    fireInspect,
    floodPolygonStats,
    floodVisible,
    isDrawing,
    lastClickedLocation,
    ndviVisible,
    polygonStats,
    runPointInspect,
    selectedFloodLayer,
    selectedLayerId,
  ]);

  const handleDrawPolygon = useCallback(() => {
    setIsDrawing((prev) => !prev);
    if (!isDrawing) {
      setLastClickedLocation(null);
      setPolygonStats(null);
    }
  }, [isDrawing]);

  const handlePolygonComplete = useCallback(
    async (geojson: GeoJSON.Geometry) => {
      setIsDrawing(false);
      setLastClickedLocation(null);

      if (floodVisible && selectedFloodLayer) {
        setPolygonStats(null);
        setComparePolygon(null);
        setFloodInspect(null);
        setFloodPolygonStats({ loading: true });
        try {
          const data = await fetchFloodStats({
            polygon: geojson,
            date: debouncedDate,
            layer: selectedFloodLayer.identifier,
            sample_count: 50,
          });
          setFloodPolygonStats({
            loading: false,
            layer: data.layer,
            imagery_date: data.imagery_date,
            water_class: data.water_class,
            coverage_percent: data.coverage_percent,
            sample_count: data.sample_count,
            valid_samples: data.valid_samples,
            note: data.note,
          });
        } catch (err) {
          setFloodPolygonStats({
            loading: false,
            water_class: "Error",
            note: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        }
        return;
      }

      if (!selectedLayerId) return;

      setFloodInspect(null);
      setFloodPolygonStats(null);

      if (compareMode) {
        setPolygonStats(null);
        setComparePolygon({ loading: true });
        setCompareResult(null);
        try {
          const data = await fetchCompareStats({
            polygon: geojson,
            layer: selectedLayerId,
            before_date: beforeDate,
            after_date: afterDate,
            sample_count: 50,
          });
          setComparePolygon({
            loading: false,
            before_date: data.before_date,
            after_date: data.after_date,
            before_class: data.before_class,
            after_class: data.after_class,
            change: data.change,
            before_valid: data.before_valid,
            after_valid: data.after_valid,
            sample_count: data.sample_count,
            notes: data.notes,
          });
        } catch (err) {
          setComparePolygon({
            loading: false,
            change: "Error",
            notes: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        }
        return;
      }

      setComparePolygon(null);
      setPolygonStats({
        mean: null,
        min: null,
        max: null,
        sample_count: 0,
        valid_samples: 0,
        notes: "",
        loading: true,
      });

      try {
        const result = await fetchPolygonStats({
          polygon: geojson,
          date: debouncedDate,
          layer: selectedLayerId,
          sample_count: 50,
        });
        setPolygonStats({ ...result, loading: false });
      } catch (err) {
        setPolygonStats({
          mean: null,
          min: null,
          max: null,
          sample_count: 0,
          valid_samples: 0,
          notes: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          loading: false,
        });
      }
    },
    [debouncedDate, selectedLayerId, compareMode, beforeDate, afterDate, floodVisible, selectedFloodLayer]
  );

  const handleClosePanel = useCallback(() => {
    pointInspectRequestIdRef.current += 1;
    setLastClickedLocation(null);
    setNeutralInspect(null);
    setInspect(null);
    setInspectSeries(null);
    setPolygonStats(null);
    setFireInspect(null);
    setFireImpact(null);
    setFireImpactError(null);
    setCompareResult(null);
    setComparePolygon(null);
    setFloodInspect(null);
    setFloodPolygonStats(null);
    setAlertInspect(null);
  }, []);

  return (
    <div className="app-root">
      <GlobeViewer
        date={debouncedDate}
        selectedLayer={selectedLayer ?? null}
        ndviOpacity={ndviOpacity}
        ndviVisible={ndviVisible}
        onActiveNdviDateChange={setActiveNdviDate}
        isDrawing={isDrawing}
        fires={fires}
        firesVisible={firesVisible}
        floodLayer={selectedFloodLayer}
        floodVisible={floodVisible}
        floodOpacity={floodOpacity}
        onActiveFloodDateChange={setActiveFloodDate}
        alerts={alerts}
        alertsVisible={alertsVisible}
        onGlobeClick={handleGlobeClick}
        onFireClick={handleFireClick}
        onAlertClick={handleAlertClick}
        onPolygonComplete={handlePolygonComplete}
        onBboxChange={handleBboxChange}
        flyToTarget={flyToTarget}
      />

      <IntelligencePanel
        fires={fires}
        firesVisible={firesVisible}
        alerts={alerts}
        alertsVisible={alertsVisible}
        floodVisible={floodVisible}
        activeNdviDate={activeNdviDate}
        activeFloodDate={activeFloodDate}
        onFlyTo={(lat, lon) => setFlyToTarget({ lat, lon, key: Date.now() })}
        layers={layers}
        selectedLayerId={selectedLayerId}
        selectedLayer={selectedLayer ?? null}
        onLayerChange={setSelectedLayerId}
        ndviOpacity={ndviOpacity}
        onNdviOpacityChange={setNdviOpacity}
        ndviVisible={ndviVisible}
        onToggleNdvi={() => setNdviVisible((v) => !v)}
        layersLoading={layersLoading}
        compareMode={compareMode}
        onToggleCompare={() => {
          setCompareMode((v) => !v);
          setCompareResult(null);
          setComparePolygon(null);
        }}
        beforeDate={beforeDate}
        afterDate={afterDate}
        onBeforeDateChange={setBeforeDate}
        onAfterDateChange={setAfterDate}
        onToggleFlood={() => {
          setFloodVisible((v) => !v);
          setFloodInspect(null);
          setFloodPolygonStats(null);
        }}
        floodOpacity={floodOpacity}
        onFloodOpacityChange={setFloodOpacity}
        selectedFloodLayer={selectedFloodLayer}
        floodLayersError={floodLayersError}
        onToggleFires={() =>
          setFiresVisible((v) => {
            const next = !v;
            if (!next) setFireInspect(null);
            return next;
          })
        }
        firesLoading={firesLoading}
        firesSource={firesSource}
        firesError={firesError}
        onToggleAlerts={() => {
          setAlertsVisible((v) => {
            const next = !v;
            if (!next) {
              setAlerts([]);
              setAlertInspect(null);
              setAlertBbox(null);
            }
            return next;
          });
        }}
        alertsLoading={alertsLoading}
        alertCount={alerts.length}
        inspect={inspect}
        polygonStats={polygonStats}
        compareResult={compareResult}
        floodInspect={floodInspect}
        floodPolygonStats={floodPolygonStats}
        date={date}
        onDateChange={handleDateChange}
        isPlaying={isPlaying}
        onTogglePlay={toggle}
        stepDays={stepDays}
        onChangeStepDays={setStepDays}
      />

      <InspectPanel
        neutralInspect={neutralInspect}
        inspect={inspect}
        inspectSeries={inspectSeries}
        polygonStats={polygonStats}
        fireInspect={fireInspect}
        fireImpact={fireImpact}
        fireImpactLoading={fireImpactLoading}
        fireImpactError={fireImpactError}
        compareResult={compareResult}
        comparePolygon={comparePolygon}
        floodInspect={floodInspect}
        floodPolygonStats={floodPolygonStats}
        alertInspect={alertInspect}
        onClose={handleClosePanel}
        onDrawPolygon={handleDrawPolygon}
        isDrawing={isDrawing}
      />
    </div>
  );
}
