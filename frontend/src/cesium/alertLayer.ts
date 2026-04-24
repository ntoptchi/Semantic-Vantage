import { Viewer, Cartesian3, Color, HeightReference, Entity } from "cesium";
import type { LossAlert } from "../types/ndvi";

const ALERT_ENTITY_PREFIX = "__alert__";

const _alertDataById = new Map<string, LossAlert>();

function severityColor(severity: string): Color {
  switch (severity) {
    case "severe":
      return Color.fromCssColorString("#ef4444");
    case "moderate":
      return Color.fromCssColorString("#f97316");
    case "mild":
      return Color.fromCssColorString("#facc15");
    default:
      return Color.fromCssColorString("#e5e7eb");
  }
}

function severitySize(severity: string): number {
  switch (severity) {
    case "severe":
      return 12;
    case "moderate":
      return 10;
    case "mild":
      return 8;
    default:
      return 7;
  }
}

export function addAlertEntities(viewer: Viewer, alerts: LossAlert[]): void {
  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i];
    const entityId = `${ALERT_ENTITY_PREFIX}${i}_${a.lat}_${a.lon}`;

    _alertDataById.set(entityId, a);

    viewer.entities.add(
      new Entity({
        id: entityId,
        position: Cartesian3.fromDegrees(a.lon, a.lat),
        point: {
          pixelSize: severitySize(a.severity),
          color: severityColor(a.severity),
          outlineColor: Color.fromCssColorString("#020617").withAlpha(0.9),
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    );
  }
}

export function removeAlertEntities(viewer: Viewer): void {
  const toRemove: Entity[] = [];
  const entities = viewer.entities.values;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.id.startsWith(ALERT_ENTITY_PREFIX)) {
      toRemove.push(e);
    }
  }
  for (const e of toRemove) {
    _alertDataById.delete(e.id);
    viewer.entities.remove(e);
  }
}

export function isAlertEntity(entity: Entity | undefined | null): boolean {
  if (!entity) return false;
  return entity.id?.startsWith(ALERT_ENTITY_PREFIX) ?? false;
}

export function getAlertFromEntity(entity: Entity): LossAlert | null {
  if (!isAlertEntity(entity)) return null;
  return _alertDataById.get(entity.id) ?? null;
}
