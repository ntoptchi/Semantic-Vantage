import { useEffect, useRef } from "react";
import {
  Viewer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
  ImageryLayer,
  Color,
  CallbackProperty,
  PolygonHierarchy,
  Cartesian3,
  defined,
} from "cesium";
import {
  configureCesium,
  createWorldTerrain,
  createNDVILayer,
  getValidNDVIDate,
} from "./config";
import {
  addFireEntities,
  removeFireEntities,
  isFireEntity,
  getFireDetectionFromEntity,
} from "./fireLayer";
import {
  addAlertEntities,
  removeAlertEntities,
  isAlertEntity,
  getAlertFromEntity,
} from "./alertLayer";
import {
  createFloodImageryLayer,
  getValidFloodDate,
} from "./floodLayer";
import { createWaterBaselineLayer } from "./waterBaseline";
import type { NDVILayer, LossAlert } from "../types/ndvi";
import type { FloodLayer } from "../types/flood";
import type { FireDetection } from "../types/fire";

interface GlobeViewerProps {
  date: string;
  selectedLayer: NDVILayer | null;
  ndviOpacity: number;
  ndviVisible: boolean;
  isDrawing: boolean;
  fires: FireDetection[];
  firesVisible: boolean;
  floodLayer: FloodLayer | null;
  floodVisible: boolean;
  floodOpacity: number;
  alerts: LossAlert[];
  alertsVisible: boolean;
  onGlobeClick: (lat: number, lon: number) => void;
  onFireClick: (fire: FireDetection) => void;
  onAlertClick: (alert: LossAlert) => void;
  onPolygonComplete: (geojson: GeoJSON.Geometry) => void;
  onActiveNdviDateChange?: (date: string | null) => void;
  onActiveFloodDateChange?: (date: string | null) => void;
  onBboxChange?: (bbox: [number, number, number, number]) => void;
  flyToTarget?: { lat: number; lon: number; key: number } | null;
}

export function GlobeViewer({
  date,
  selectedLayer,
  ndviOpacity,
  ndviVisible,
  isDrawing,
  fires,
  firesVisible,
  floodLayer,
  floodVisible,
  floodOpacity,
  alerts,
  alertsVisible,
  onGlobeClick,
  onFireClick,
  onAlertClick,
  onPolygonComplete,
  onActiveNdviDateChange,
  onActiveFloodDateChange,
  onBboxChange,
  flyToTarget,
}: GlobeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const ndviLayerRef = useRef<ImageryLayer | null>(null);
  const floodLayerRef = useRef<ImageryLayer | null>(null);
  const waterBaselineRef = useRef<ImageryLayer | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const drawHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const drawEntityRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    configureCesium();

    const viewer = new Viewer(containerRef.current, {
      terrain: createWorldTerrain(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
      creditContainer: document.createElement("div"),
    });

    viewer.scene.globe.enableLighting = true
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.dynamicAtmosphereLighting = true;

    viewerRef.current = viewer;

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // Click handler — picks alert/fire entities first, then falls through to globe click
  const onGlobeClickRef = useRef(onGlobeClick);
  onGlobeClickRef.current = onGlobeClick;
  const onFireClickRef = useRef(onFireClick);
  onFireClickRef.current = onFireClick;
  const onAlertClickRef = useRef(onAlertClick);
  onAlertClickRef.current = onAlertClick;

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (handlerRef.current) {
      handlerRef.current.destroy();
    }

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (event: { position: { x: number; y: number } }) => {
        const picked = viewer.scene.pick(event.position);
        if (defined(picked) && picked?.id) {
          if (isAlertEntity(picked.id)) {
            const alert = getAlertFromEntity(picked.id);
            if (alert) {
              onAlertClickRef.current(alert);
              return;
            }
          }
          if (isFireEntity(picked.id)) {
            const fire = getFireDetectionFromEntity(picked.id);
            if (fire) {
              onFireClickRef.current(fire);
              return;
            }
          }
        }

        const cartesian = viewer.camera.pickEllipsoid(
          event.position,
          viewer.scene.globe.ellipsoid
        );
        if (defined(cartesian) && cartesian) {
          const carto = Cartographic.fromCartesian(cartesian);
          const lat = CesiumMath.toDegrees(carto.latitude);
          const lon = CesiumMath.toDegrees(carto.longitude);
          onGlobeClickRef.current(
            Math.round(lat * 10000) / 10000,
            Math.round(lon * 10000) / 10000
          );
        }
      },
      ScreenSpaceEventType.LEFT_CLICK
    );
    handlerRef.current = handler;
  }, []);

  // NDVI layer management
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (ndviLayerRef.current) {
      viewer.imageryLayers.remove(ndviLayerRef.current, true);
      ndviLayerRef.current = null;
    }

    if (selectedLayer && ndviVisible) {
      try {
        const snappedDate = getValidNDVIDate(selectedLayer, date);
        const layer = createNDVILayer(selectedLayer, snappedDate);
        viewer.imageryLayers.add(layer);
        ndviLayerRef.current = layer;
        if (onActiveNdviDateChange) {
          onActiveNdviDateChange(snappedDate);
        }
      } catch (err) {
        // Prevent NDVI layer failures from crashing the whole app.
        console.error("[NDVI WMTS] failed to create imagery layer", err);
        if (onActiveNdviDateChange) {
          onActiveNdviDateChange(null);
        }
      }
    } else if (onActiveNdviDateChange) {
      onActiveNdviDateChange(null);
    }
  }, [selectedLayer, date, ndviVisible]);

  // Opacity updates (without recreating layer); ndviOpacity is 0–1
  useEffect(() => {
    if (ndviLayerRef.current) {
      ndviLayerRef.current.alpha = ndviOpacity;
    }
  }, [ndviOpacity]);

  // Camera fly-to for intelligence panel navigation
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToTarget) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(flyToTarget.lon, flyToTarget.lat, 500000),
      duration: 1.5,
    });
  }, [flyToTarget]);

  // Flood layer management (baseline water mask + flood detection overlay)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (floodLayerRef.current) {
      viewer.imageryLayers.remove(floodLayerRef.current, true);
      floodLayerRef.current = null;
    }
    if (waterBaselineRef.current) {
      viewer.imageryLayers.remove(waterBaselineRef.current, true);
      waterBaselineRef.current = null;
    }

    if (floodLayer && floodVisible) {
      try {
        const baseline = createWaterBaselineLayer(0.3);
        viewer.imageryLayers.add(baseline);
        waterBaselineRef.current = baseline;
      } catch (err) {
        console.error("[Water baseline] failed to create imagery layer", err);
      }

      try {
        const snappedDate = getValidFloodDate(floodLayer, date);
        const layer = createFloodImageryLayer(floodLayer, snappedDate, floodOpacity);
        viewer.imageryLayers.add(layer);
        floodLayerRef.current = layer;
        if (onActiveFloodDateChange) {
          onActiveFloodDateChange(snappedDate);
        }
      } catch (err) {
        console.error("[Flood WMTS] failed to create imagery layer", err);
        if (onActiveFloodDateChange) {
          onActiveFloodDateChange(null);
        }
      }
    } else if (onActiveFloodDateChange) {
      onActiveFloodDateChange(null);
    }
  }, [floodLayer, date, floodVisible]);

  useEffect(() => {
    if (floodLayerRef.current) {
      floodLayerRef.current.alpha = floodOpacity;
    }
  }, [floodOpacity]);

  // Wildfire entity lifecycle
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    removeFireEntities(viewer);

    if (firesVisible && fires.length > 0) {
      addFireEntities(viewer, fires);
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        removeFireEntities(viewerRef.current);
      }
    };
  }, [fires, firesVisible]);

  // Alert entity lifecycle
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    removeAlertEntities(viewer);

    if (alertsVisible && alerts.length > 0) {
      addAlertEntities(viewer, alerts);
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        removeAlertEntities(viewerRef.current);
      }
    };
  }, [alerts, alertsVisible]);

  // Viewport bbox reporting for alert scanning
  const onBboxChangeRef = useRef(onBboxChange);
  onBboxChangeRef.current = onBboxChange;

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !alertsVisible) return;

    function reportBbox() {
      const v = viewerRef.current;
      if (!v || !onBboxChangeRef.current) return;
      const rect = v.camera.computeViewRectangle();
      if (!rect) return;
      const west = CesiumMath.toDegrees(rect.west);
      const south = CesiumMath.toDegrees(rect.south);
      const east = CesiumMath.toDegrees(rect.east);
      const north = CesiumMath.toDegrees(rect.north);
      onBboxChangeRef.current([
        Math.max(-180, Math.round(west * 1e4) / 1e4),
        Math.max(-85, Math.round(south * 1e4) / 1e4),
        Math.min(180, Math.round(east * 1e4) / 1e4),
        Math.min(85, Math.round(north * 1e4) / 1e4),
      ]);
    }

    reportBbox();
    viewer.camera.moveEnd.addEventListener(reportBbox);
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.camera.moveEnd.removeEventListener(reportBbox);
      }
    };
  }, [alertsVisible]);

  // Polygon drawing mode
  const onPolygonCompleteRef = useRef(onPolygonComplete);
  onPolygonCompleteRef.current = onPolygonComplete;

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Cleanup previous draw state
    if (drawHandlerRef.current) {
      drawHandlerRef.current.destroy();
      drawHandlerRef.current = null;
    }
    if (drawEntityRef.current) {
      const ent = viewer.entities.getById(drawEntityRef.current);
      if (ent) viewer.entities.remove(ent);
      drawEntityRef.current = null;
    }

    if (!isDrawing) return;

    const positions: Cartesian3[] = [];
    const entityId = "draw-polygon-" + Date.now();
    drawEntityRef.current = entityId;

    viewer.entities.add({
      id: entityId,
      polygon: {
        hierarchy: new CallbackProperty(() => new PolygonHierarchy(positions), false),
        material: Color.CYAN.withAlpha(0.3),
        outline: true,
        outlineColor: Color.CYAN,
        outlineWidth: 2,
      },
    });

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    drawHandlerRef.current = handler;

    handler.setInputAction(
      (event: { position: { x: number; y: number } }) => {
        const cartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
        if (defined(cartesian) && cartesian) {
          positions.push(cartesian.clone());
        }
      },
      ScreenSpaceEventType.LEFT_CLICK
    );

    handler.setInputAction(
      () => {
        if (positions.length < 3) return;

        const coords: Array<[number, number]> = positions.map((pos) => {
          const carto = Cartographic.fromCartesian(pos);
          return [
            Math.round(CesiumMath.toDegrees(carto.longitude) * 10000) / 10000,
            Math.round(CesiumMath.toDegrees(carto.latitude) * 10000) / 10000,
          ];
        });

        const ring = [...coords, coords[0]];
        onPolygonCompleteRef.current({ type: "Polygon", coordinates: [ring] });
      },
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    return () => {
      if (drawHandlerRef.current) {
        drawHandlerRef.current.destroy();
        drawHandlerRef.current = null;
      }
    };
  }, [isDrawing]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
    />
  );
}
