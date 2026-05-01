import {
  Color,
  ImageryLayer,
  TextureMagnificationFilter,
  TextureMinificationFilter,
  WebMapTileServiceImageryProvider,
} from "cesium";
import type { FloodLayer } from "../types/flood";

function tileMatrixSetFor3857(nativeId: string): string {
  if (nativeId.startsWith("GoogleMapsCompatible_Level")) return nativeId;
  switch (nativeId) {
    case "2km":
      return "GoogleMapsCompatible_Level6";
    case "1km":
      return "GoogleMapsCompatible_Level7";
    case "500m":
      return "GoogleMapsCompatible_Level8";
    case "250m":
      return "GoogleMapsCompatible_Level9";
    default:
      return "GoogleMapsCompatible_Level6";
  }
}

export function getValidFloodDate(layer: FloodLayer, uiDate: string): string {
  return layer.time_default ?? uiDate;
}

export function createFloodImageryLayer(
  layer: FloodLayer,
  snappedDate: string,
  alpha: number = 0.7
): ImageryLayer {
  const tileMatrixSetId = tileMatrixSetFor3857(layer.tile_matrix_set_id);

  const provider = new WebMapTileServiceImageryProvider({
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi",
    layer: layer.identifier,
    style: layer.style,
    format: layer.format,
    tileMatrixSetID: tileMatrixSetId,
    tileWidth: 256,
    tileHeight: 256,
    maximumLevel: 9,
    subdomains: [],
    dimensions: {
      TIME: snappedDate,
    },
    credit: "NASA GIBS",
  });

  return new ImageryLayer(provider, {
    alpha,
    brightness: 1.4,
    contrast: 1.3,
    saturation: 1.6,
    colorToAlpha: Color.fromBytes(175, 175, 175),
    colorToAlphaThreshold: 0.08,
    minificationFilter: TextureMinificationFilter.NEAREST,
    magnificationFilter: TextureMagnificationFilter.NEAREST,
  });
}
