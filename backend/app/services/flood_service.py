"""Service for flood/water extent layer metadata and tile sampling."""

import io
import time

import httpx
from PIL import Image

from app.config import settings
from app.models.flood import FloodLayer
from app.utils.tile_math import (
    build_gibs_tile_url,
    get_tile_coords_3857,
    get_pixel_in_tile_3857,
    tile_matrix_set_id_to_3857,
)

WATER_NONE = "No water detected"
WATER_POSSIBLE = "Possible water presence"
WATER_HIGH = "High water/flood presence"

NEIGHBORHOOD_WINDOW = 5

# Curated GIBS flood/water layers for MVP.
# These layers are already in EPSG:3857 (GoogleMapsCompatible_Level9).
_FLOOD_LAYERS: list[FloodLayer] = [
    FloodLayer(
        identifier="MODIS_Combined_Flood_3-Day",
        title="MODIS Flood 3-Day",
        format="image/png",
        style="default",
        tile_matrix_set_id="GoogleMapsCompatible_Level9",
        time_start=None,
        time_end=None,
        time_default=None,
    ),
    FloodLayer(
        identifier="VIIRS_Combined_Flood_3-Day",
        title="VIIRS Flood 3-Day",
        format="image/png",
        style="default",
        tile_matrix_set_id="GoogleMapsCompatible_Level9",
        time_start=None,
        time_end=None,
        time_default=None,
    ),
    FloodLayer(
        identifier="MODIS_Combined_Flood_1-Day",
        title="MODIS Flood 1-Day",
        format="image/png",
        style="default",
        tile_matrix_set_id="GoogleMapsCompatible_Level9",
        time_start=None,
        time_end=None,
        time_default=None,
    ),
]

_layer_cache: dict[str, tuple[float, list[FloodLayer]]] = {}
_LAYER_CACHE_TTL = 3600


def get_flood_layers() -> list[FloodLayer]:
    now = time.time()
    if "layers" in _layer_cache:
        ts, cached = _layer_cache["layers"]
        if now - ts < _LAYER_CACHE_TTL:
            return cached
    _layer_cache["layers"] = (now, _FLOOD_LAYERS)
    return _FLOOD_LAYERS


def get_flood_layer_by_id(identifier: str) -> FloodLayer | None:
    for layer in get_flood_layers():
        if layer.identifier == identifier:
            return layer
    return None


def _classify_water_pixel(r: int, g: int, b: int, a: int) -> str | None:
    """Classify a single pixel from a flood visualization tile.

    GIBS MODIS flood layers use a specific colormap:
    - Blue shades indicate open water / flood
    - Red/orange may indicate other flood classes
    - Transparent = no data / land outside coverage

    For MVP we use a blue-dominance heuristic:
    - High blue (b > 140, b > r+30, b > g+30) → high water
    - Moderate blue (b > 80, b > r, b > g) → possible water
    - Otherwise → land / no water
    """
    if a < 30:
        return None
    if r < 30 and g < 30 and b < 30:
        return None

    if b > 140 and b > r + 30 and b > g + 30:
        return WATER_HIGH
    if b > 80 and b > r and b > g:
        return WATER_POSSIBLE
    return WATER_NONE


_PIXEL_SCORE = {WATER_HIGH: 1.0, WATER_POSSIBLE: 0.5, WATER_NONE: 0.0}

_SCORE_HIGH_THRESHOLD = 0.65
_SCORE_POSSIBLE_THRESHOLD = 0.35


def _sample_water_neighborhood(
    img: Image.Image, cx: int, cy: int
) -> tuple[list[str], str, float | None, dict]:
    """Sample a neighborhood window with score-based smoothing.

    Each valid pixel contributes a water score (high=1.0, possible=0.5,
    none=0.0).  The neighborhood average score determines the final class,
    which smooths over mixed coastline pixels.

    Returns (per_pixel_classes, smoothed_class, confidence, debug_info).
    """
    half = NEIGHBORHOOD_WINDOW // 2
    w, h = img.size
    classes: list[str] = []
    transparent_count = 0
    sum_r, sum_g, sum_b = 0, 0, 0
    opaque_count = 0

    center_pixel = list(img.getpixel((cx, cy))[:4])

    for dy in range(-half, half + 1):
        for dx in range(-half, half + 1):
            px = max(0, min(w - 1, cx + dx))
            py = max(0, min(h - 1, cy + dy))
            pixel = img.getpixel((px, py))
            r, g, b, a = pixel[:4]
            cls = _classify_water_pixel(r, g, b, a)
            if cls is None:
                transparent_count += 1
            else:
                classes.append(cls)
                sum_r += r
                sum_g += g
                sum_b += b
                opaque_count += 1

    total_sampled = NEIGHBORHOOD_WINDOW * NEIGHBORHOOD_WINDOW
    none_c = sum(1 for c in classes if c == WATER_NONE)
    poss_c = sum(1 for c in classes if c == WATER_POSSIBLE)
    high_c = sum(1 for c in classes if c == WATER_HIGH)

    debug: dict = {
        "center_rgba": center_pixel,
        "window": NEIGHBORHOOD_WINDOW,
        "total_sampled": total_sampled,
        "transparent": transparent_count,
        "class_counts": {"none": none_c, "possible": poss_c, "high": high_c},
    }

    if opaque_count > 0:
        debug["avg_rgb"] = [
            round(sum_r / opaque_count),
            round(sum_g / opaque_count),
            round(sum_b / opaque_count),
        ]

    if not classes:
        return [], WATER_NONE, None, debug

    score_sum = sum(_PIXEL_SCORE.get(c, 0.0) for c in classes)
    avg_score = score_sum / len(classes)

    if avg_score >= _SCORE_HIGH_THRESHOLD:
        water_class = WATER_HIGH
    elif avg_score >= _SCORE_POSSIBLE_THRESHOLD:
        water_class = WATER_POSSIBLE
    else:
        water_class = WATER_NONE

    matching = sum(1 for c in classes if c == water_class)
    confidence = round((matching / len(classes)) * 100, 1)

    debug["avg_score"] = round(avg_score, 3)

    return classes, water_class, confidence, debug


async def sample_flood_at_point(
    lat: float, lon: float, date: str, layer_identifier: str
) -> tuple[str, float | None, str | None, str, dict | None]:
    """Fetch a GIBS flood tile and sample a neighborhood.

    Returns (water_class, confidence, note, effective_date, debug).
    """
    layer = get_flood_layer_by_id(layer_identifier)
    if layer is None:
        return WATER_NONE, None, f"Unknown flood layer: {layer_identifier}", date, None

    effective_date = layer.time_default if layer.time_default else date

    tms_id = layer.tile_matrix_set_id
    if tms_id.startswith("GoogleMapsCompatible_Level"):
        matrix_set_3857 = tms_id
        zoom = int(tms_id.rsplit("Level", 1)[1])
    else:
        matrix_set_3857, zoom = tile_matrix_set_id_to_3857(tms_id)

    tile_col, tile_row = get_tile_coords_3857(lat, lon, zoom)

    url = build_gibs_tile_url(
        settings.gibs_wmts_base_3857,
        layer.identifier,
        effective_date,
        matrix_set_3857,
        zoom,
        tile_row,
        tile_col,
        layer.format,
        layer.style,
    )

    tile_debug: dict = {"zoom": zoom, "tile_col": tile_col, "tile_row": tile_row}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return WATER_NONE, None, "No tile available for this date/location", effective_date, tile_debug
            resp.raise_for_status()
    except httpx.HTTPError as e:
        return WATER_NONE, None, f"Tile fetch error: {e}", effective_date, tile_debug

    try:
        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception as e:
        return WATER_NONE, None, f"Image decode error: {e}", effective_date, tile_debug

    w, h = img.size
    px, py = get_pixel_in_tile_3857(lat, lon, zoom, tile_col, tile_row, tile_size=w)
    tile_debug["px"] = px
    tile_debug["py"] = py

    classes, water_class, confidence, sample_debug = _sample_water_neighborhood(img, px, py)
    debug = {**tile_debug, "img_size": [w, h], **sample_debug}

    if not classes:
        return WATER_NONE, None, "No valid samples in neighborhood (transparent tiles).", effective_date, debug

    note = "Qualitative water classification from visualization layer (neighborhood sampling)."
    return water_class, confidence, note, effective_date, debug
