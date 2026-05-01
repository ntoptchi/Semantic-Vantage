import { Viewer, Cartesian3, Color, HeightReference, Entity } from "cesium";
import type { FireDetection } from "../types/fire";

const FIRE_ENTITY_PREFIX = "__fire__";

/**
 * In-memory lookup for fire detection data keyed by entity id.
 * Avoids the complexity of round-tripping through Cesium PropertyBag.
 */
const _fireDataById = new Map<string, FireDetection>();

function confidenceColor(confidence: string | null): Color {
  switch (confidence?.toLowerCase()) {
    case "high":
      return Color.fromCssColorString("#f97373");
    case "nominal":
      return Color.fromCssColorString("#fdba74");
    case "low":
      return Color.fromCssColorString("#fef08a");
    default:
      return Color.fromCssColorString("#e5e7eb");
  }
}

function confidenceSize(confidence: string | null): number {
  switch (confidence?.toLowerCase()) {
    case "high":
      return 11;
    case "nominal":
      return 9;
    case "low":
      return 7;
    default:
      return 6;
  }
}

export function addFireEntities(viewer: Viewer, fires: FireDetection[]): void {
  for (const f of fires) {
    const color = confidenceColor(f.confidence);
    const size = confidenceSize(f.confidence);
    const entityId = `${FIRE_ENTITY_PREFIX}${f.id}`;

    _fireDataById.set(entityId, f);

    viewer.entities.add(
      new Entity({
        id: entityId,
        position: Cartesian3.fromDegrees(f.lon, f.lat),
        point: {
          pixelSize: size,
          color,
          outlineColor: Color.fromCssColorString("#020617").withAlpha(0.9),
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    );
  }
}

export function removeFireEntities(viewer: Viewer): void {
  const toRemove: Entity[] = [];
  const entities = viewer.entities.values;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.id.startsWith(FIRE_ENTITY_PREFIX)) {
      toRemove.push(e);
    }
  }
  for (const e of toRemove) {
    _fireDataById.delete(e.id);
    viewer.entities.remove(e);
  }
}

export function isFireEntity(entity: Entity | undefined | null): boolean {
  if (!entity) return false;
  return entity.id?.startsWith(FIRE_ENTITY_PREFIX) ?? false;
}

export function getFireDetectionFromEntity(entity: Entity): FireDetection | null {
  if (!isFireEntity(entity)) return null;
  return _fireDataById.get(entity.id) ?? null;
}
