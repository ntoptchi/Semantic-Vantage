"""Service for fetching wildfire hotspot detections.

Uses NASA FIRMS CSV API when FIRMS_MAP_KEY is configured, otherwise falls back
to realistic mock data so the feature works out of the box.
"""

import csv
import io
import time
import hashlib
from datetime import datetime, timedelta

import httpx

from app.config import settings
from app.models.fire import FireDetection

_cache: dict[str, tuple[float, list[FireDetection]]] = {}
CACHE_TTL = 300  # 5 minutes


def _cache_key(bbox: str | None, source: str, days: int, limit: int) -> str:
    raw = f"{bbox}|{source}|{days}|{limit}"
    return hashlib.md5(raw.encode()).hexdigest()


def _in_bbox(lat: float, lon: float, bbox: str | None) -> bool:
    if not bbox:
        return True
    parts = [float(x) for x in bbox.split(",")]
    if len(parts) != 4:
        return True
    west, south, east, north = parts
    return south <= lat <= north and west <= lon <= east


# ---------------------------------------------------------------------------
# FIRMS live fetch (requires FIRMS_MAP_KEY env var)
# ---------------------------------------------------------------------------

FIRMS_CSV_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


async def _fetch_firms(source: str, days: int, bbox: str | None, limit: int) -> list[FireDetection]:
    """Fetch from NASA FIRMS CSV API.  source = 'viirs' | 'modis' | 'all'."""
    map_key = getattr(settings, "firms_map_key", None) or ""
    if not map_key:
        return []

    source_map = {
        "viirs": "VIIRS_SNPP_NRT",
        "modis": "MODIS_NRT",
    }
    sources_to_fetch = (
        list(source_map.values()) if source == "all" else [source_map.get(source, "VIIRS_SNPP_NRT")]
    )

    detections: list[FireDetection] = []
    world_area = "-180,-90,180,90" if not bbox else bbox

    async with httpx.AsyncClient(timeout=30) as client:
        for src_key in sources_to_fetch:
            url = f"{FIRMS_CSV_URL}/{map_key}/{src_key}/{world_area}/{days}"
            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue
                reader = csv.DictReader(io.StringIO(resp.text))
                for i, row in enumerate(reader):
                    if len(detections) >= limit:
                        break
                    lat = float(row.get("latitude", 0))
                    lon = float(row.get("longitude", 0))
                    if not _in_bbox(lat, lon, bbox):
                        continue
                    conf_raw = row.get("confidence", "")
                    if conf_raw.isdigit():
                        c = int(conf_raw)
                        conf = "high" if c >= 80 else "nominal" if c >= 30 else "low"
                    else:
                        conf = conf_raw.lower() if conf_raw else None
                    detections.append(
                        FireDetection(
                            id=f"{src_key}-{i}",
                            lat=lat,
                            lon=lon,
                            confidence=conf,
                            brightness=_float_or_none(row.get("bright_ti4") or row.get("brightness")),
                            satellite=row.get("satellite"),
                            instrument=row.get("instrument"),
                            acq_date=row.get("acq_date"),
                            acq_time=row.get("acq_time"),
                            frp=_float_or_none(row.get("frp")),
                            daynight=row.get("daynight"),
                            source=src_key,
                        )
                    )
            except Exception:
                continue

    return detections[:limit]


def _float_or_none(val: str | None) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Mock data fallback
# ---------------------------------------------------------------------------

_MOCK_FIRES: list[dict] = [
    # California
    {"lat": 38.55, "lon": -121.50, "confidence": "high", "brightness": 367.2, "satellite": "N20", "instrument": "VIIRS", "frp": 42.5, "daynight": "D"},
    {"lat": 34.22, "lon": -118.56, "confidence": "high", "brightness": 352.8, "satellite": "N20", "instrument": "VIIRS", "frp": 35.1, "daynight": "D"},
    {"lat": 39.75, "lon": -121.62, "confidence": "nominal", "brightness": 328.1, "satellite": "N20", "instrument": "VIIRS", "frp": 18.4, "daynight": "D"},
    {"lat": 36.78, "lon": -119.42, "confidence": "nominal", "brightness": 315.6, "satellite": "Terra", "instrument": "MODIS", "frp": 12.8, "daynight": "D"},
    {"lat": 37.88, "lon": -120.35, "confidence": "low", "brightness": 305.2, "satellite": "Terra", "instrument": "MODIS", "frp": 8.2, "daynight": "N"},
    # Pacific Northwest
    {"lat": 44.05, "lon": -121.75, "confidence": "high", "brightness": 345.0, "satellite": "N20", "instrument": "VIIRS", "frp": 28.9, "daynight": "D"},
    {"lat": 47.50, "lon": -120.85, "confidence": "nominal", "brightness": 322.3, "satellite": "N20", "instrument": "VIIRS", "frp": 15.6, "daynight": "D"},
    # Amazon
    {"lat": -3.12, "lon": -60.02, "confidence": "high", "brightness": 380.5, "satellite": "N20", "instrument": "VIIRS", "frp": 85.3, "daynight": "D"},
    {"lat": -8.45, "lon": -63.18, "confidence": "high", "brightness": 372.1, "satellite": "N20", "instrument": "VIIRS", "frp": 68.7, "daynight": "D"},
    {"lat": -5.88, "lon": -55.30, "confidence": "nominal", "brightness": 340.6, "satellite": "Terra", "instrument": "MODIS", "frp": 45.2, "daynight": "D"},
    {"lat": -10.22, "lon": -56.78, "confidence": "nominal", "brightness": 335.2, "satellite": "Aqua", "instrument": "MODIS", "frp": 38.4, "daynight": "D"},
    {"lat": -7.60, "lon": -58.90, "confidence": "low", "brightness": 310.8, "satellite": "Terra", "instrument": "MODIS", "frp": 12.1, "daynight": "N"},
    # Central Africa
    {"lat": -4.32, "lon": 22.45, "confidence": "high", "brightness": 356.8, "satellite": "N20", "instrument": "VIIRS", "frp": 52.6, "daynight": "D"},
    {"lat": -6.10, "lon": 24.80, "confidence": "nominal", "brightness": 330.4, "satellite": "N20", "instrument": "VIIRS", "frp": 25.8, "daynight": "D"},
    {"lat": -2.55, "lon": 28.65, "confidence": "nominal", "brightness": 325.3, "satellite": "Terra", "instrument": "MODIS", "frp": 22.0, "daynight": "D"},
    # Australia
    {"lat": -33.85, "lon": 150.20, "confidence": "high", "brightness": 365.4, "satellite": "N20", "instrument": "VIIRS", "frp": 55.8, "daynight": "D"},
    {"lat": -37.50, "lon": 145.10, "confidence": "nominal", "brightness": 332.0, "satellite": "N20", "instrument": "VIIRS", "frp": 20.5, "daynight": "D"},
    {"lat": -25.78, "lon": 148.90, "confidence": "low", "brightness": 308.5, "satellite": "Terra", "instrument": "MODIS", "frp": 9.8, "daynight": "N"},
    # Siberia
    {"lat": 62.30, "lon": 120.50, "confidence": "high", "brightness": 358.2, "satellite": "N20", "instrument": "VIIRS", "frp": 48.0, "daynight": "D"},
    {"lat": 60.15, "lon": 115.80, "confidence": "nominal", "brightness": 318.7, "satellite": "N20", "instrument": "VIIRS", "frp": 16.3, "daynight": "D"},
    # Mediterranean
    {"lat": 38.90, "lon": 23.75, "confidence": "high", "brightness": 348.6, "satellite": "N20", "instrument": "VIIRS", "frp": 32.4, "daynight": "D"},
    {"lat": 37.05, "lon": -3.80, "confidence": "nominal", "brightness": 320.5, "satellite": "Terra", "instrument": "MODIS", "frp": 14.2, "daynight": "D"},
    # Southeast Asia
    {"lat": 15.88, "lon": 103.25, "confidence": "high", "brightness": 370.3, "satellite": "N20", "instrument": "VIIRS", "frp": 62.5, "daynight": "D"},
    {"lat": -2.50, "lon": 111.40, "confidence": "nominal", "brightness": 326.8, "satellite": "N20", "instrument": "VIIRS", "frp": 19.7, "daynight": "D"},
    {"lat": 18.50, "lon": 100.12, "confidence": "low", "brightness": 302.4, "satellite": "Terra", "instrument": "MODIS", "frp": 7.5, "daynight": "N"},
    # Canada
    {"lat": 53.80, "lon": -122.40, "confidence": "high", "brightness": 360.1, "satellite": "N20", "instrument": "VIIRS", "frp": 45.6, "daynight": "D"},
    {"lat": 55.20, "lon": -115.60, "confidence": "nominal", "brightness": 328.9, "satellite": "N20", "instrument": "VIIRS", "frp": 21.0, "daynight": "D"},
]


def _generate_mock_fires(bbox: str | None, source: str, days: int, limit: int) -> list[FireDetection]:
    today = datetime.utcnow().date()
    detections: list[FireDetection] = []

    for i, m in enumerate(_MOCK_FIRES):
        if len(detections) >= limit:
            break
        if not _in_bbox(m["lat"], m["lon"], bbox):
            continue
        if source != "all":
            inst = m.get("instrument", "").upper()
            if source == "viirs" and inst != "VIIRS":
                continue
            if source == "modis" and inst != "MODIS":
                continue

        days_ago = i % min(days, 7)
        acq_date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        hour = 10 + (i * 3) % 14
        minute = (i * 17) % 60
        acq_time = f"{hour:02d}{minute:02d}"

        detections.append(
            FireDetection(
                id=f"mock-{i}",
                lat=m["lat"],
                lon=m["lon"],
                confidence=m.get("confidence"),
                brightness=m.get("brightness"),
                satellite=m.get("satellite"),
                instrument=m.get("instrument"),
                acq_date=acq_date,
                acq_time=acq_time,
                frp=m.get("frp"),
                daynight=m.get("daynight"),
                source="mock",
            )
        )

    return detections


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def get_recent_fires(
    bbox: str | None = None,
    source: str = "all",
    days: int = 3,
    limit: int = 200,
) -> tuple[list[FireDetection], str]:
    """Return recent fire detections and a source label.

    Attempts FIRMS API if configured, otherwise returns mock data.
    Results are cached in-memory by request signature for CACHE_TTL seconds.
    """
    key = _cache_key(bbox, source, days, limit)
    now = time.time()
    if key in _cache:
        ts, cached = _cache[key]
        if now - ts < CACHE_TTL:
            src_label = "firms" if (getattr(settings, "firms_map_key", None) or "") else "mock"
            return cached, src_label

    firms_key = getattr(settings, "firms_map_key", None) or ""
    if firms_key:
        fires = await _fetch_firms(source, days, bbox, limit)
        if fires:
            _cache[key] = (now, fires)
            return fires, "firms"

    fires = _generate_mock_fires(bbox, source, days, limit)
    _cache[key] = (now, fires)
    return fires, "mock"
