import {
  ImageryLayer,
  WebMapTileServiceImageryProvider,
} from "cesium";

const WATER_MASK_LAYER = "MODIS_Water_Mask";
const WATER_MASK_TMS = "GoogleMapsCompatible_Level9";

/**
 * Creates a permanent water baseline layer from GIBS MODIS_Water_Mask.
 *
 * This static layer renders oceans and lakes as a soft cyan/blue and is fully
 * transparent over land.  It sits underneath the flood detection overlay so
 * coastlines look complete while flood detections remain visually prominent.
 */
export function createWaterBaselineLayer(alpha: number = 0.3): ImageryLayer {
  const provider = new WebMapTileServiceImageryProvider({
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi",
    layer: WATER_MASK_LAYER,
    style: "default",
    format: "image/png",
    tileMatrixSetID: WATER_MASK_TMS,
    tileWidth: 256,
    tileHeight: 256,
    maximumLevel: 9,
    subdomains: [],
    credit: "NASA GIBS",
  });

  return new ImageryLayer(provider, {
    alpha,
    brightness: 0.7,
    saturation: 0.5,
    contrast: 0.9,
  });
}
