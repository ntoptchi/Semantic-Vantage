import {
  Ion,
  Terrain,
  IonWorldImageryStyle,
  ImageryLayer,
  WebMapTileServiceImageryProvider,
} from "cesium";
import type { NDVILayer } from "../types/ndvi";

export function configureCesium() {
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
  if (token) {
    Ion.defaultAccessToken = token;
  } else {
    console.warn("VITE_CESIUM_ION_TOKEN not set – terrain and imagery may be limited");
  }
}

export function createWorldTerrain() {
  return Terrain.fromWorldTerrain();
}

export function createBaseImagery(): ImageryLayer {
  return ImageryLayer.fromWorldImagery({
    style: IonWorldImageryStyle.AERIAL,
  });
}

export function createLabelsOverlay(): ImageryLayer {
  return ImageryLayer.fromWorldImagery({
    style: IonWorldImageryStyle.AERIAL_WITH_LABELS,
  });
}

/** Snaps the UI date to a valid NDVI product date for the layer. For 8-day products, use time_default until full snap logic exists. */
export function getValidNDVIDate(layer: NDVILayer, uiDate: string): string {
  if (layer.time_default) {
    return layer.time_default;
  }
  // TODO: snap uiDate to nearest 8-day boundary using time_start / time_end when ready
  return uiDate;
}

/** Creates an NDVI imagery layer from a matched layer bundle and snapped date. Uses epsg3857 WMTS path. */
export function createNDVILayer(layer: NDVILayer, snappedDate: string): ImageryLayer {
  // Map the layer's native EPSG:4326 matrix set to the corresponding EPSG:3857 GoogleMapsCompatible set.
  let tileMatrixSetId3857: string;
  switch (layer.tile_matrix_set_id) {
    case "1km":
      tileMatrixSetId3857 = "GoogleMapsCompatible_Level7";
      break;
    case "500m":
      tileMatrixSetId3857 = "GoogleMapsCompatible_Level8";
      break;
    case "250m":
      tileMatrixSetId3857 = "GoogleMapsCompatible_Level9";
      break;
    default:
      // Fallback to Level7 if we don't recognize the matrix set id.
      tileMatrixSetId3857 = "GoogleMapsCompatible_Level7";
      break;
  }

  const provider = new WebMapTileServiceImageryProvider({
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi",
    layer: layer.identifier,
    style: layer.style,
    format: layer.format,
    tileMatrixSetID: tileMatrixSetId3857,
    tileWidth: 512,
    tileHeight: 512,
    maximumLevel: 9,
    subdomains: [],
    dimensions: {
      TIME: snappedDate,
    },
    credit: "NASA GIBS",
  });

  return new ImageryLayer(provider, {
    alpha: 0.7,
  });
}
