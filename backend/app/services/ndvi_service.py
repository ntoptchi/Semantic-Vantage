"""Service for sampling NDVI values from GIBS tiles."""

import io
from datetime import datetime, timedelta

import httpx
from PIL import Image

from app.config import settings
from app.services.gibs_service import get_ndvi_layer_by_identifier
from app.utils.tile_math import (
    build_gibs_tile_url,
    get_tile_coords_3857,
    get_pixel_in_tile_3857,
    tile_matrix_set_id_to_3857,
)

# Neighborhood sampling: window size (e.g. 5 = 5x5 centered on click)
TILE_SIZE_PX = 512
NEIGHBORHOOD_WINDOW = 5

VEGETATION_LOW = "Low vegetation"
VEGETATION_MODERATE = "Moderate vegetation"
VEGETATION_HIGH = "High vegetation"


def describe_vegetation_change(before_class: str | None, after_class: str | None) -> str:
    """Qualitative change description between two vegetation classes."""
    if before_class is None or after_class is None:
        return "Insufficient data"
    rank = {VEGETATION_LOW: 0, VEGETATION_MODERATE: 1, VEGETATION_HIGH: 2}
    diff = rank.get(after_class, -1) - rank.get(before_class, -1)
    if diff >= 2:
        return "Significant increase"
    if diff == 1:
        return "Moderate increase"
    if diff == 0:
        return "Stable"
    if diff == -1:
        return "Moderate decline"
    return "Significant decline"


def _pixel_to_ndvi_estimate(r: int, g: int, b: int, a: int) -> float | None:
    """Convert RGBA from colorized tile to an NDVI-like estimate; None if no data."""
    if a == 0:
        return None
    if r == 0 and g == 0 and b == 0:
        return None
    val = (g / 255.0) * 2.0 - 1.0
    return max(-1.0, min(1.0, val))


def _ndvi_to_vegetation_class(ndvi: float) -> str:
    if ndvi < 0.2:
        return VEGETATION_LOW
    if ndvi < 0.5:
        return VEGETATION_MODERATE
    return VEGETATION_HIGH


def _sample_neighborhood(
    img: Image.Image, cx: int, cy: int
) -> tuple[list[float], str | None, float | None, str]:
    """Sample a NEIGHBORHOOD_WINDOW x NEIGHBORHOOD_WINDOW window centered on (cx, cy).
    Returns (list of valid ndvi estimates, vegetation_class, confidence_percent, confidence_note).
    confidence_percent = majority_class_count / total_valid_samples * 100 (0-100).
    """
    half = NEIGHBORHOOD_WINDOW // 2
    w, h = img.size
    values: list[float] = []
    classes: list[str] = []

    for dy in range(-half, half + 1):
        for dx in range(-half, half + 1):
            px = max(0, min(w - 1, cx + dx))
            py = max(0, min(h - 1, cy + dy))
            pixel = img.getpixel((px, py))
            r, g, b, a = pixel[:4]
            est = _pixel_to_ndvi_estimate(r, g, b, a)
            if est is not None:
                values.append(est)
                classes.append(_ndvi_to_vegetation_class(est))

    if not values:
        return [], None, None, "No valid data in neighborhood (transparent or no-data pixels)"

    # Majority vegetation class; confidence = majority_class_count / total_valid_samples * 100
    low_c = sum(1 for c in classes if c == VEGETATION_LOW)
    mod_c = sum(1 for c in classes if c == VEGETATION_MODERATE)
    high_c = sum(1 for c in classes if c == VEGETATION_HIGH)
    n = len(classes)
    majority = max(
        [(VEGETATION_LOW, low_c), (VEGETATION_MODERATE, mod_c), (VEGETATION_HIGH, high_c)],
        key=lambda x: x[1],
    )
    vegetation_class = majority[0]
    majority_count = majority[1]
    confidence_percent = round((majority_count / n) * 100, 1)

    return values, vegetation_class, confidence_percent, "Based on nearby visualization-layer samples; not scientific certainty."


def _snap_date_for_layer(date: str, time_default: str | None) -> str:
    """For MVP: use layer.time_default if present, otherwise the requested date."""
    return time_default if time_default else date


def _recent_valid_dates_for_layer(time_default: str | None, count: int, step_days: int = 8) -> list[str]:
    """Return a list of recent valid imagery dates (newest first). For 8-day products, step back by step_days."""
    if not time_default:
        # Fallback: use today and step back
        d = datetime.utcnow().date()
    else:
        d = datetime.strptime(time_default, "%Y-%m-%d").date()
    out = []
    for i in range(count):
        out.append((d - timedelta(days=i * step_days)).strftime("%Y-%m-%d"))
    return out


async def sample_ndvi_at_point(
    lat: float,
    lon: float,
    date: str,
    layer_identifier: str,
    effective_date_override: str | None = None,
) -> tuple[str | None, str | None, float | None, float | None, list[int] | None, str, str]:
    """Fetch the GIBS tile and sample a neighborhood around the point.

    Uses a small window (e.g. 5x5) centered on the click, aggregates by majority
    vegetation class, and returns a qualitative classification plus confidence percent.
    Uses the same EPSG:3857 endpoint and GoogleMapsCompatible matrix set as the
    Cesium overlay.
    Returns (vegetation_class, confidence_note, confidence_percent, ndvi_mean_for_chart, raw_pixel, notes, effective_date).
    """
    layer = await get_ndvi_layer_by_identifier(layer_identifier)
    if layer is None:
        return None, None, None, None, None, f"Unknown layer: {layer_identifier}", date

    effective_date = (
        effective_date_override
        if effective_date_override is not None
        else _snap_date_for_layer(date, layer.time_default)
    )
    matrix_set_3857, zoom = tile_matrix_set_id_to_3857(layer.tile_matrix_set_id)

    tile_col, tile_row = get_tile_coords_3857(lat, lon, zoom)
    px, py = get_pixel_in_tile_3857(lat, lon, zoom, tile_col, tile_row)

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

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return (
                    None,
                    None,
                    None,
                    None,
                    None,
                    "No tile available for this date/location",
                    effective_date,
                )
            resp.raise_for_status()
    except httpx.HTTPError as e:
        return None, None, None, None, None, f"Tile fetch error: {e}", effective_date

    try:
        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception as e:
        return None, None, None, None, None, f"Image decode error: {e}", effective_date

    w, h = img.size
    px = max(0, min(w - 1, px))
    py = max(0, min(h - 1, py))

    values, vegetation_class, confidence_percent, confidence_note = _sample_neighborhood(img, px, py)

    if not values:
        center = list(img.getpixel((px, py)))
        return (
            None,
            confidence_note or "No valid data in neighborhood",
            None,
            None,
            center,
            "No valid samples in neighborhood.",
            effective_date,
        )

    ndvi_mean = round(sum(values) / len(values), 4)
    ndvi_mean = max(-1.0, min(1.0, ndvi_mean))
    center_pixel = list(img.getpixel((px, py)))

    notes = (
        "Qualitative classification from visualization layer (neighborhood sampling). "
        "Not a calibrated NDVI value."
    )

    return (
        vegetation_class,
        confidence_note,
        confidence_percent,
        ndvi_mean,
        center_pixel,
        notes,
        effective_date,
    )


async def sample_ndvi_series(
    lat: float,
    lon: float,
    layer_identifier: str,
    count: int = 8,
) -> list[dict]:
    """Sample NDVI at the same point for several recent valid imagery dates. Returns [{ date, ndvi }, ...]."""
    layer = await get_ndvi_layer_by_identifier(layer_identifier)
    if layer is None:
        return []

    dates = _recent_valid_dates_for_layer(layer.time_default, count, step_days=8)
    out = []
    for d in dates:
        _, _, _, ndvi, _, _, _ = await sample_ndvi_at_point(
            lat, lon, d, layer_identifier, effective_date_override=d
        )
        out.append({"date": d, "ndvi": ndvi})
    return out
